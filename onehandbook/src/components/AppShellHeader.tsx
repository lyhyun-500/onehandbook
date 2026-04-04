import { AppShellHeaderClient } from "@/components/AppShellHeaderClient";

type AppShellHeaderProps = {
  email: string;
  natBalance: number;
};

/** 로그인 후 스튜디오 공통 상단 — NAT·공지·메뉴(이메일·로그아웃은 사이드 패널) */
export function AppShellHeader(props: AppShellHeaderProps) {
  return <AppShellHeaderClient {...props} />;
}
