import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getAdminUserDetail } from "@/lib/admin/queries";
import { NatAdjustForm } from "@/components/admin/NatAdjustForm";
import type {
  AdminCoinLogItem,
  AdminUserAnalysisItem,
  AdminUserDetail,
  AdminUserWorkItem,
} from "@/lib/admin/types";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function providerLabel(p: AdminUserDetail["loginProvider"]): string {
  if (p === "google") return "Google";
  if (p === "naver") return "Naver";
  return "-";
}

function ConsentDot({ agreed }: { agreed: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{
        backgroundColor: agreed
          ? "var(--color-admin-success)"
          : "var(--color-admin-text-muted)",
      }}
      aria-label={agreed ? "동의" : "미동의"}
    />
  );
}

function LogTypeBadge({ type }: { type: AdminCoinLogItem["type"] }) {
  if (type === "EARN") {
    return (
      <span
        className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium"
        style={{ color: "var(--color-admin-success)" }}
      >
        적립
      </span>
    );
  }
  if (type === "USE") {
    return (
      <span
        className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-medium"
        style={{ color: "var(--color-admin-danger)" }}
      >
        차감
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-admin-bg-hover px-2 py-0.5 text-xs font-medium text-admin-text-secondary">
      소멸
    </span>
  );
}

function UserInfoCard({ user }: { user: AdminUserDetail }) {
  return (
    <section className="mb-6 rounded-lg border border-admin-border bg-admin-bg-page p-6">
      <div className="grid grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-admin-text-secondary">닉네임</div>
          <div className="mt-1 text-base font-medium text-admin-text-primary">
            {user.nickname ?? (
              <span className="text-admin-text-muted">-</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-admin-text-secondary">이메일</div>
          <div className="mt-1 text-sm text-admin-text-primary break-all">
            {user.email || <span className="text-admin-text-muted">-</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-admin-text-secondary">가입일</div>
          <div className="mt-1 text-sm text-admin-text-primary">
            {formatDateShort(user.createdAt)}
          </div>
        </div>
        <div>
          <div className="text-xs text-admin-text-secondary">로그인</div>
          <div className="mt-1 text-sm text-admin-text-primary">
            {providerLabel(user.loginProvider)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 border-t border-admin-border pt-4">
        <div>
          <div className="text-xs text-admin-text-secondary">상태</div>
          <div className="mt-1 text-sm">
            {user.deletedAt ? (
              <span
                className="font-medium"
                style={{ color: "var(--color-admin-danger)" }}
              >
                탈퇴 ({formatDate(user.deletedAt)})
              </span>
            ) : (
              <span
                className="font-medium"
                style={{ color: "var(--color-admin-success)" }}
              >
                활성
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-admin-text-secondary">약관</div>
            <div className="mt-1 flex items-center gap-4 text-xs text-admin-text-primary">
              <span className="flex items-center gap-1.5">
                <ConsentDot agreed={!!user.termsAgreedAt} />
                이용약관
              </span>
              <span className="flex items-center gap-1.5">
                <ConsentDot agreed={!!user.privacyAgreedAt} />
                개인정보
              </span>
              <span className="flex items-center gap-1.5">
                <ConsentDot agreed={!!user.marketingAgreed} />
                마케팅
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NatSection({ user }: { user: AdminUserDetail }) {
  return (
    <section className="mb-6 rounded-lg border border-admin-border bg-admin-bg-page p-6">
      <h2 className="text-lg font-semibold text-admin-text-primary">
        NAT 관리
      </h2>
      <div className="mt-4 flex items-end gap-8">
        <div>
          <div className="text-xs text-admin-text-secondary">현재 잔량</div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-admin-text-primary">
            {user.coinBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {user.deletedAt ? (
        <div
          className="mt-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm"
          style={{ color: "var(--color-admin-danger)" }}
        >
          탈퇴한 유저는 NAT 조정할 수 없습니다.
        </div>
      ) : (
        <NatAdjustForm userId={user.id} currentBalance={user.coinBalance} />
      )}
    </section>
  );
}

function CoinLogsTable({ logs }: { logs: AdminCoinLogItem[] }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-admin-text-primary">
        NAT 조정 히스토리 (최근 20건)
      </h3>
      <div className="overflow-hidden rounded-lg border border-admin-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-admin-bg-surface text-admin-text-secondary">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">시간</th>
              <th className="px-4 py-2.5 text-left font-medium">유형</th>
              <th className="px-4 py-2.5 text-right font-medium">수량</th>
              <th className="px-4 py-2.5 text-left font-medium">사유</th>
              <th className="px-4 py-2.5 text-left font-medium">관리자 메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-admin-text-muted"
                >
                  기록이 없습니다
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-admin-text-secondary">
                  {formatDate(l.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <LogTypeBadge type={l.type} />
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-admin-text-primary">
                  {l.amount > 0 ? "+" : ""}
                  {l.amount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {l.reason}
                </td>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {l.adminReason ?? (
                    <span className="text-admin-text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorksTable({ works }: { works: AdminUserWorkItem[] }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-admin-text-primary">
        작품 (최근 10건)
      </h3>
      <div className="overflow-hidden rounded-lg border border-admin-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-admin-bg-surface text-admin-text-secondary">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">제목</th>
              <th className="px-4 py-2.5 text-left font-medium">장르</th>
              <th className="px-4 py-2.5 text-left font-medium">생성일</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {works.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-admin-text-muted"
                >
                  작품이 없습니다
                </td>
              </tr>
            )}
            {works.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-2.5 text-admin-text-primary">
                  {w.title || <span className="text-admin-text-muted">-</span>}
                </td>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {w.genre ?? <span className="text-admin-text-muted">-</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-admin-text-secondary">
                  {formatDateShort(w.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  {w.deletedAt ? (
                    <span className="text-xs text-admin-text-muted">삭제</span>
                  ) : (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--color-admin-success)" }}
                    >
                      활성
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalysesTable({
  analyses,
}: {
  analyses: AdminUserAnalysisItem[];
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-admin-text-primary">
        최근 분석 기록 (최근 10건)
      </h3>
      <div className="overflow-hidden rounded-lg border border-admin-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-admin-bg-surface text-admin-text-secondary">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">작품</th>
              <th className="px-4 py-2.5 text-left font-medium">회차</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
              <th className="px-4 py-2.5 text-left font-medium">시간</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-bg-page">
            {analyses.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-admin-text-muted"
                >
                  분석 기록이 없습니다
                </td>
              </tr>
            )}
            {analyses.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {a.workId ?? (
                    <span className="text-admin-text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {a.episodeId ?? (
                    <span className="text-admin-text-muted">일괄</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-admin-text-secondary">
                  {a.status}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-admin-text-secondary">
                  {formatDate(a.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  const bundle = await getAdminUserDetail(supabase, id);
  if (!bundle) {
    notFound();
  }

  const { user, works, recentAnalyses, coinLogs } = bundle;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-sm text-admin-accent hover:text-admin-accent-hover"
          >
            ← 유저 목록
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-admin-text-primary">
            {user.nickname ?? user.email ?? `User #${user.id}`}
          </h1>
          <p className="mt-1 text-sm text-admin-text-secondary">
            user id: {user.id} · auth id: {user.authId}
          </p>
        </div>
      </header>

      <UserInfoCard user={user} />
      <NatSection user={user} />
      <CoinLogsTable logs={coinLogs} />
      <WorksTable works={works} />
      <AnalysesTable analyses={recentAnalyses} />
    </div>
  );
}
