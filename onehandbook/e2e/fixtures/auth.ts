import { existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

export type TestRole = 'writer' | 'admin';

const STORAGE_DIR = './e2e/.auth';
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
// Matches @supabase/ssr utils/chunker.js MAX_CHUNK_SIZE — keep in sync on dep upgrade.
const COOKIE_CHUNK_SIZE = 3180;

export function getStorageStatePath(role: TestRole): string {
  return `${STORAGE_DIR}/${role}.json`;
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

function getAdminClient(): SupabaseClient {
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
): Promise<void> {
  const desiredRole = role === 'admin' ? 'admin' : 'user';
  const nickname = email.split('@')[0]?.slice(0, 50) || 'user';
  const now = new Date().toISOString();

  const { error: upsertErr } = await client.from('users').upsert(
    {
      auth_id: authUserId,
      email,
      nickname,
      role: desiredRole,
      terms_agreed_at: now,
      privacy_agreed_at: now,
    },
    { onConflict: 'auth_id' },
  );
  if (upsertErr) throw new Error(`ensureAppUserRow upsert failed: ${upsertErr.message}`);

  if (role !== 'admin') return;

  const { data, error: selErr } = await client
    .from('users')
    .select('role')
    .eq('auth_id', authUserId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (data?.role !== 'admin') {
    throw new Error(`Admin role verification failed: got ${data?.role ?? 'null'}`);
  }
}

async function bootstrapSession(role: TestRole): Promise<Session> {
  const admin = getAdminClient();
  const email = getTestEmail(role);
  const authUserId = await ensureAuthUser(admin, email, role);
  await ensureAppUserRow(admin, authUserId, email, role);

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
  return verify.session;
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

async function createStorageState(role: TestRole): Promise<string> {
  const session = await bootstrapSession(role);
  const path = getStorageStatePath(role);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(buildStorageState(session), null, 2));
  return path;
}

export async function ensureStorageState(role: TestRole): Promise<string> {
  const path = getStorageStatePath(role);
  if (await isStorageStateExpired(path)) {
    return createStorageState(role);
  }
  return path;
}
