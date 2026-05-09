import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { seedEmptyWork } from './seed';

export type TestRole = 'writer' | 'admin';

const STORAGE_DIR = './e2e/.auth';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
// Matches @supabase/ssr utils/chunker.js MAX_CHUNK_SIZE — keep in sync on dep upgrade.
const COOKIE_CHUNK_SIZE = 3180;
const WRITER_NAT_BALANCE = 30;

export function getStorageStatePath(role: TestRole): string {
  return `${STORAGE_DIR}/${role}.json`;
}

function getMetaPath(role: TestRole): string {
  return `${STORAGE_DIR}/${role}.meta.json`;
}

export function getTestEmail(role: TestRole): string {
  if (role === 'writer') {
    return process.env.E2E_TEST_WRITER_EMAIL ?? 'e2e_test_writer@novelagent.kr';
  }
  return process.env.E2E_TEST_ADMIN_EMAIL ?? 'e2e_test_admin@novelagent.kr';
}

export async function isStorageStateExpired(path: string): Promise<boolean> {
  if (!existsSync(path)) return true;
  const s = await stat(path);
  return Date.now() - s.mtimeMs > STORAGE_TTL_MS;
}

function validateServiceRoleKey(key: string): void {
  if (key.startsWith('eyJ') && key.length >= 200) return;
  if (key.startsWith('sb_secret_') && key.length >= 41) return;
  throw new Error(
    `E2E_SUPABASE_SERVICE_ROLE_KEY format invalid: prefix="${key.slice(0, 11)}", length=${key.length}. ` +
      'Expected legacy JWT (eyJ..., ≥200 chars) or sb_secret_* (≥41 chars).',
  );
}

export function getAdminClient(): SupabaseClient {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
  }
  validateServiceRoleKey(key);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient(): SupabaseClient {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY must be set in .env.local.');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function findAuthUserIdByEmail(
  client: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const match = data.users.find((u) => u.email === email);
  return match?.id ?? null;
}

async function ensureAuthUser(
  client: SupabaseClient,
  email: string,
  role: TestRole,
): Promise<string> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { e2e_role: role },
  });
  if (!error && data.user) return data.user.id;

  const msg = error?.message ?? '';
  const alreadyExists = /already (registered|been)/i.test(msg) || /User already exists/i.test(msg);
  if (!alreadyExists) throw error;

  const id = await findAuthUserIdByEmail(client, email);
  if (!id) throw new Error(`Auth user lookup failed for ${email} after duplicate-create`);
  return id;
}

async function ensureAppUserRow(
  client: SupabaseClient,
  authUserId: string,
  email: string,
  role: TestRole,
): Promise<number> {
  const desiredRole = role === 'admin' ? 'admin' : 'user';
  const nickname = email.split('@')[0]?.slice(0, 50) || 'user';
  const now = new Date().toISOString();

  const { data: upserted, error: upsertErr } = await client
    .from('users')
    .upsert(
      {
        auth_id: authUserId,
        email,
        nickname,
        role: desiredRole,
        terms_agreed_at: now,
        privacy_agreed_at: now,
        // /api/analyze 가 phone_verified 미인증 사용자를 PHONE_NOT_VERIFIED 로 차단함.
        // E2E writer는 verify-phone UI 거치지 않고 바로 분석을 호출할 수 있어야 한다.
        phone_verified_at: now,
      },
      { onConflict: 'auth_id' },
    )
    .select('id, role')
    .single();
  if (upsertErr) throw new Error(`ensureAppUserRow upsert failed: ${upsertErr.message}`);

  if (role === 'admin' && upserted.role !== 'admin') {
    throw new Error(`Admin role verification failed: got ${upserted.role ?? 'null'}`);
  }
  return Number(upserted.id);
}

/**
 * Reset coin_balance to 0, then credit a fixed amount via credit_nat RPC for audit-log
 * fidelity. Idempotent across re-runs (final balance is always WRITER_NAT_BALANCE).
 */
async function resetAndCreditNat(
  client: SupabaseClient,
  userId: number,
  amount: number,
): Promise<void> {
  const { error: resetErr } = await client
    .from('users')
    .update({ coin_balance: 0 })
    .eq('id', userId);
  if (resetErr) throw new Error(`coin_balance reset failed: ${resetErr.message}`);

  // p_reason must be one of credit_nat's allowlist:
  // ('purchase_credit','refund','bonus','admin_adjust','manual_adjust','other').
  // The function returns {ok:false, error:...} for validation failures (no SQL exception),
  // so we must inspect the JSON body — not just creditErr.
  const { data: creditData, error: creditErr } = await client.rpc('credit_nat', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: 'bonus',
    p_ref_type: 'e2e_test',
    p_ref_id: 0,
    p_metadata: { e2e_seed: true },
    p_expires_at: null,
    p_grant_type: 'bonus',
  });
  if (creditErr) throw new Error(`credit_nat failed: ${creditErr.message}`);
  if (creditData && typeof creditData === 'object' && (creditData as { ok?: boolean }).ok === false) {
    throw new Error(`credit_nat rejected: ${JSON.stringify(creditData)}`);
  }

  const { data: check, error: chkErr } = await client
    .from('users')
    .select('coin_balance')
    .eq('id', userId)
    .single();
  if (chkErr) throw chkErr;
  if (check?.coin_balance !== amount) {
    throw new Error(
      `NAT balance verification failed for user ${userId}: expected ${amount}, got ${check?.coin_balance}`,
    );
  }
}

async function bootstrapSession(role: TestRole): Promise<{
  session: Session;
  meta: AuthMeta;
}> {
  const admin = getAdminClient();
  const email = getTestEmail(role);
  const authUserId = await ensureAuthUser(admin, email, role);
  const userId = await ensureAppUserRow(admin, authUserId, email, role);

  let seededWorkId: number | undefined;
  if (role === 'writer') {
    await resetAndCreditNat(admin, userId, WRITER_NAT_BALANCE);
    seededWorkId = await seedEmptyWork(authUserId, undefined, admin);
  }

  // generateLink yields a hashed_token alongside the action_link. We don't follow
  // the action_link (Supabase admin-issued magic links are implicit-flow — tokens land
  // in URL fragment which neither /auth/callback nor exchangeCodeForSession can consume).
  // Instead, hand the hashed_token to verifyOtp, which mints a Session entirely server-side.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) throw new Error(`generateLink returned no hashed_token for ${email}`);

  const anon = getAnonClient();
  const { data: verify, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;
  if (!verify.session) throw new Error(`verifyOtp returned no session for ${email}`);

  return {
    session: verify.session,
    meta: { role, email, userId, authUserId, ...(seededWorkId !== undefined ? { seededWorkId } : {}) },
  };
}

type CookieChunk = { name: string; value: string };

function createSsrCookieChunks(name: string, encodedValue: string): CookieChunk[] {
  // @supabase/ssr applies chunkSize against encodeURIComponent(value).length. Our value is
  // 'base64-' + base64url(...), entirely URL-safe ASCII, so encoded length === raw length.
  if (encodedValue.length <= COOKIE_CHUNK_SIZE) {
    return [{ name, value: encodedValue }];
  }
  const chunks: CookieChunk[] = [];
  for (let i = 0; i * COOKIE_CHUNK_SIZE < encodedValue.length; i++) {
    chunks.push({
      name: `${name}.${i}`,
      value: encodedValue.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE),
    });
  }
  return chunks;
}

type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
};

function buildStorageState(session: Session): {
  cookies: PlaywrightCookie[];
  origins: never[];
} {
  const supabaseUrl = new URL(process.env.E2E_SUPABASE_URL!);
  const projectRef = supabaseUrl.hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  const sessionJson = JSON.stringify(session);
  const cookieValue = `base64-${Buffer.from(sessionJson, 'utf8').toString('base64url')}`;

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
  const domain = new URL(baseURL).hostname;

  // Mirror @supabase/ssr DEFAULT_COOKIE_OPTIONS: path '/', sameSite Lax, httpOnly false, maxAge 400d.
  const expires = Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60;
  const attrs = {
    domain,
    path: '/',
    expires,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  };

  const cookies = createSsrCookieChunks(cookieName, cookieValue).map(
    (c): PlaywrightCookie => ({ name: c.name, value: c.value, ...attrs }),
  );

  return { cookies, origins: [] };
}

export type AuthMeta = {
  role: TestRole;
  email: string;
  userId: number; // public.users.id
  authUserId: string; // auth.users.id (uuid)
  seededWorkId?: number;
};

export type AuthContext = {
  storageStatePath: string;
  meta: AuthMeta;
};

async function createAuthArtifacts(role: TestRole): Promise<AuthContext> {
  const { session, meta } = await bootstrapSession(role);
  const sp = getStorageStatePath(role);
  const mp = getMetaPath(role);
  await mkdir(dirname(sp), { recursive: true });
  await writeFile(sp, JSON.stringify(buildStorageState(session), null, 2));
  await writeFile(mp, JSON.stringify(meta, null, 2));
  return { storageStatePath: sp, meta };
}

export async function ensureStorageState(role: TestRole): Promise<AuthContext> {
  const sp = getStorageStatePath(role);
  const mp = getMetaPath(role);
  if (existsSync(sp) && existsSync(mp) && !(await isStorageStateExpired(sp))) {
    const meta = JSON.parse(await readFile(mp, 'utf8')) as AuthMeta;
    return { storageStatePath: sp, meta };
  }
  return createAuthArtifacts(role);
}

/**
 * Extract the access_token from the persisted storageState. Used by specs that need
 * to call Supabase RPCs directly as the role (e.g., consume_nat which keys off auth.uid()).
 */
export async function readAccessToken(role: TestRole): Promise<string> {
  const sp = getStorageStatePath(role);
  const raw = JSON.parse(await readFile(sp, 'utf8')) as {
    cookies: Array<{ name: string; value: string }>;
  };
  const supabaseUrl = new URL(process.env.E2E_SUPABASE_URL!);
  const projectRef = supabaseUrl.hostname.split('.')[0];
  const baseName = `sb-${projectRef}-auth-token`;
  // Recombine chunked cookies in order: base, then .0, .1, ... (matches @supabase/ssr combineChunks).
  const chunks = raw.cookies
    .filter((c) => c.name === baseName || c.name.startsWith(`${baseName}.`))
    .sort((a, b) => {
      if (a.name === baseName) return -1;
      if (b.name === baseName) return 1;
      const ai = parseInt(a.name.slice(baseName.length + 1), 10);
      const bi = parseInt(b.name.slice(baseName.length + 1), 10);
      return ai - bi;
    });
  if (chunks.length === 0) throw new Error(`No auth cookie chunks for role=${role}`);
  let combined = chunks.map((c) => c.value).join('');
  if (combined.startsWith('base64-')) combined = combined.slice('base64-'.length);
  const sessionJson = Buffer.from(combined, 'base64url').toString('utf8');
  const session = JSON.parse(sessionJson) as { access_token?: string };
  if (!session.access_token) throw new Error(`Decoded session for role=${role} missing access_token`);
  return session.access_token;
}

/**
 * Build a Supabase client that authenticates as the role (auth.uid() === their auth_id).
 * Use for RPCs/queries that depend on the row-level user identity.
 */
export async function getAuthenticatedClient(role: TestRole): Promise<SupabaseClient> {
  const accessToken = await readAccessToken(role);
  const url = process.env.E2E_SUPABASE_URL!;
  const anon = process.env.E2E_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
