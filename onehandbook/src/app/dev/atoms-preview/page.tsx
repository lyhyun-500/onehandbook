/**
 * atoms-preview — 페이즈 1 atoms (Button / Input / Card) 시각 검증 페이지.
 * /dev/* 는 proxy.ts 의 production 차단 정책 적용 — production 빌드에서 404.
 * 페이즈 4~5 다크/라이트 토글 도입 시 본 페이지에 토글 박음 (현재는 다크 default 만).
 */
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";

export default function AtomsPreviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">atoms preview (페이즈 1)</h1>
          <p className="text-sm text-muted-foreground">
            Button / Input / Card — 다크 default. ADR-0024 시각 검증 페이지.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Button — variant × size</h2>
          <div className="grid grid-cols-4 gap-4 items-center">
            <span className="text-xs text-muted-foreground">primary</span>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>

            <span className="text-xs text-muted-foreground">secondary</span>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="secondary" size="md">Medium</Button>
            <Button variant="secondary" size="lg">Large</Button>

            <span className="text-xs text-muted-foreground">ghost</span>
            <Button variant="ghost" size="sm">Small</Button>
            <Button variant="ghost" size="md">Medium</Button>
            <Button variant="ghost" size="lg">Large</Button>

            <span className="text-xs text-muted-foreground">destructive</span>
            <Button variant="destructive" size="sm">Small</Button>
            <Button variant="destructive" size="md">Medium</Button>
            <Button variant="destructive" size="lg">Large</Button>
          </div>

          <h3 className="pt-4 text-sm font-medium">disabled state</h3>
          <div className="flex gap-3 flex-wrap">
            <Button variant="primary" disabled>Primary disabled</Button>
            <Button variant="secondary" disabled>Secondary disabled</Button>
            <Button variant="ghost" disabled>Ghost disabled</Button>
            <Button variant="destructive" disabled>Destructive disabled</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Input — 기본 / error / disabled</h2>
          <div className="space-y-3 max-w-md">
            <Input placeholder="기본 input" />
            <Input placeholder="error state (aria-invalid)" aria-invalid />
            <Input placeholder="disabled" disabled />
            <Input type="email" placeholder="email" />
            <Input type="password" placeholder="password" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Card — 기본 + 서브컴포넌트</h2>
          <Card className="max-w-md">
            <CardHeader>
              <h3 className="text-base font-semibold">카드 제목</h3>
              <p className="text-sm text-muted-foreground">
                CardHeader / CardContent / CardFooter 박힘 검증.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                본문 내용 박힘. 카드 내부 padding / border / shadow 토큰 확인.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="primary" size="sm">확인</Button>
              <Button variant="ghost" size="sm">취소</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  );
}
