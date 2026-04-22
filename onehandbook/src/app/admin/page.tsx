const STAT_CARDS: { label: string }[] = [
  { label: "전체 유저 수" },
  { label: "오늘 가입자" },
  { label: "미답장 문의 수" },
  { label: "이번 주 탈퇴 수" },
];

export default function AdminHomePage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-admin-text-primary">
          어드민 홈
        </h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          주요 운영 지표와 빠른 이동 진입점입니다.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-admin-border bg-admin-bg-page p-6"
          >
            <div className="text-sm text-admin-text-secondary">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-admin-text-primary">
              —
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-admin-border bg-admin-bg-surface p-8 text-center text-sm text-admin-text-secondary">
        데이터 연결은 다음 구현 단계에서 붙입니다. 현재는 권한 차단과 레이아웃 골격만 검증 중입니다.
      </div>
    </div>
  );
}
