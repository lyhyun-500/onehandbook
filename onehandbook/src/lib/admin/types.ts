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
  episodeId: number | null;
  status: string;
  createdAt: string;
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
