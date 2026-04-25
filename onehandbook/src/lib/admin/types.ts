// 어드민 UI / API 공용 타입
//   - DB 컬럼은 coin_balance, UI 표기는 NAT (rebranded). 타입 필드는 DB 명과 일치시켜 혼선 방지.
//   - users.id 는 bigint 이지만 API 경계에서는 number 로 다룸 (JSON 전송 안전 범위 내).
//   - works.id 등 UUID 가능성이 있는 식별자는 string 으로 통일.

export type LoginProvider = "google" | "naver";
export type UserStatusFilter = "active" | "withdrawn" | "all";
export type UserSortKey =
  | "created_desc"
  | "created_asc"
  | "coin_desc"
  | "coin_asc";

export type AdminUserListItem = {
  id: number;
  authId: string;
  email: string;
  nickname: string | null;
  loginProvider: LoginProvider | null;
  coinBalance: number;
  worksCount: number;
  analysesCount: number;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminUserListQuery = {
  search?: string;
  provider?: LoginProvider | "all";
  status?: UserStatusFilter;
  sort?: UserSortKey;
  page?: number;
  limit?: number;
};

export type AdminUserListResponse = {
  ok: true;
  users: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
};

export type AdminUserDetail = AdminUserListItem & {
  termsAgreedAt: string | null;
  privacyAgreedAt: string | null;
  marketingAgreed: boolean | null;
};

export type AdminUserWorkItem = {
  id: number;
  title: string;
  genre: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminUserAnalysisItem = {
  id: string;
  workId: number | null;
  workTitle: string | null;
  episodeId: number | null;
  status: string;
  createdAt: string;
  parentJobId: string | null;
};

export type AdminCoinLogItem = {
  id: string;
  amount: number;
  type: "EARN" | "USE" | "EXPIRE";
  reason: string;
  createdAt: string;
  adjustedBy: string | null;
  adminReason: string | null;
};

export type AdminUserDetailResponse = {
  ok: true;
  user: AdminUserDetail;
  works: AdminUserWorkItem[];
  recentAnalyses: AdminUserAnalysisItem[];
  coinLogs: AdminCoinLogItem[];
};

export type NatAdjustRequest = {
  userId: number;
  type: "charge" | "deduct";
  amount: number;
  reason: string;
};

export type NatAdjustSuccess = {
  ok: true;
  newBalance: number;
};

export type NatAdjustFailure = {
  ok: false;
  error: string;
  balance?: number;
  required?: number;
};

export type NatAdjustResponse = NatAdjustSuccess | NatAdjustFailure;

export const USER_LIST_LIMIT_DEFAULT = 50;
export const USER_LIST_LIMIT_MAX = 100;

// 탈퇴 로그
//   - account_withdrawals 테이블 + users 의 잔존 컬럼(login_provider, created_at) 을 조인.
//   - 닉네임/이메일/작품수/분석횟수 는 익명화·하드딜리트로 손실되어 표시 대상에서 제외.

export type WithdrawalRange = "all" | "7d" | "30d" | "90d";

export type AdminWithdrawalItem = {
  /** account_withdrawals.id (uuid) */
  id: string;
  /** users.id — 운영 추적 참고용 */
  userId: number;
  /** users.login_provider — 탈퇴 후에도 보존 */
  loginProvider: LoginProvider | null;
  /** users.created_at — 가입일 */
  signupAt: string | null;
  /** account_withdrawals.created_at — 탈퇴일 */
  withdrawnAt: string;
  /** signupAt → withdrawnAt 일수, 둘 중 하나라도 invalid 면 null */
  durationDays: number | null;
  reason: string;
  reasonDetail: string | null;
};

export type AdminWithdrawalSummary = {
  last7d: number;
  last30d: number;
  total: number;
};

export type AdminWithdrawalListQuery = {
  range?: WithdrawalRange;
  page?: number;
  limit?: number;
};

export type AdminWithdrawalListResponse = {
  ok: true;
  withdrawals: AdminWithdrawalItem[];
  total: number;
  page: number;
  limit: number;
};

export const WITHDRAWAL_LIST_LIMIT_DEFAULT = 50;
export const WITHDRAWAL_LIST_LIMIT_MAX = 200;
