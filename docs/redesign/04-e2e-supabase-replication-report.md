# e2e Supabase 복제 결과

## 실행 일시
2026-05-08

## 환경
- Production: ystx****idh (마스킹)
- E2E: zejr****isjq (마스킹)
- 양쪽 모두 aws-1-ap-southeast-2 (Session pooler 경유, IPv6 회피)

## Novel Agent 규모 (정량화)
| 카테고리 | 수 |
|---|---|
| public 테이블 | 31 |
| RLS 정책 | 61 |
| public 함수 | 15 |
| RLS enabled 테이블 | 28/31 (91% 커버리지) |
| trigger | 5 |
| Storage bucket | 0 |

## 복제 결과 매트릭스

| # | 카테고리 | PROD | E2E | 판정 |
|---|---|---:|---:|:---:|
| 4-1 | public BASE TABLE 수 | 31 | 31 | ✅ |
| 4-2 | public RLS 정책 수 | 61 | 61 | ✅ |
| 4-3 | public 함수 수 (RPC 포함) | 15 | 15 | ✅ |
| 4-4 | `admin_debit_nat` 시그니처 | `admin_debit_nat / pronargs=5` | `admin_debit_nat / pronargs=5` | ✅ |
| 4-5 | RLS enabled 테이블 수 | 28 | 28 | ✅ |
| 4-6 | trigger 수 | 5 | 5 | ✅ |

## 핵심 함수 검증
- admin_debit_nat: ✅ 존재, pronargs=5, 시그니처 일치

## 발견된 함정 + 해결
1. IPv6 only Direct connection 거부
   → Session pooler URL로 우회
2. CREATE SCHEMA public 충돌
   → IF NOT EXISTS 패치
3. storage schema 권한 거부
   → --schema=public만 dump (storage는 Supabase 자동 provisioning)
4. sb_secret_* 키 + Storage v1 REST API 비호환
   → SQL 레이어 직접 사용 (storage.buckets 테이블)

## 알려진 차이 (의도됨)
- production 데이터: 실제 사용자/작품 N건
- e2e 데이터: 0건 (Playwright spec이 매 실행마다 시드)
- OAuth provider: production은 Google/Naver, e2e는 Email magiclink만

## 재실행 방법
환경변수 6개 셸 export 후:
```bash
bash scripts/replicate-supabase-schema.sh --dry-run    # 검증만
bash scripts/replicate-supabase-schema.sh              # 실제 적용
```

## Open issues
- Production service_role key 로테이션 권장 (이번 작업 중 셸 노출)
- Supabase legacy JWT vs sb_secret_* 호환성 모니터링 필요
- 향후 storage bucket 도입 시 e2e 동기화 필요

## 관련 commit
- `fa02daf`: feat(redesign): e2e Supabase schema 복제 자동화 스크립트
- 이 보고서 자체: 같은 PR/branch (`feat/redesign`) 내 후속 커밋 — `git log -- docs/redesign/04-e2e-supabase-replication-report.md` 로 확인
