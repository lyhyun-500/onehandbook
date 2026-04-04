# MySQL vs Supabase(PostgreSQL) 스키마 비교

두 버전의 문법 차이를 이해하기 위한 비교표입니다.

---

## 1. 기본 타입 매핑

| MySQL | Supabase (PostgreSQL) | 설명 |
|-------|------------------------|------|
| `BIGINT UNSIGNED AUTO_INCREMENT` | `BIGSERIAL` | 자동 증가 PK |
| `INT UNSIGNED` | `INT` + `CHECK (>= 0)` | 음수 방지 |
| `TINYINT(1)` | `BOOLEAN` | 참/거짓 |
| `TIMESTAMP` | `TIMESTAMPTZ` | 시간대 포함 타임스탬프 |
| `DEFAULT CURRENT_TIMESTAMP` | `DEFAULT now()` | 현재 시각 |

---

## 2. ENUM 처리

**MySQL**
```sql
status ENUM('연재중', '완결', '휴재') NOT NULL DEFAULT '연재중'
```
- 테이블 정의 안에 바로 ENUM 사용

**PostgreSQL**
```sql
CREATE TYPE work_status AS ENUM ('연재중', '완결', '휴재');
-- 테이블에서
status work_status NOT NULL DEFAULT '연재중'
```
- 별도 타입을 먼저 정의 후 사용

---

## 3. 인덱스

**MySQL**
```sql
INDEX idx_email (email)  -- 컬럼 정의와 함께
```

**PostgreSQL**
```sql
CREATE INDEX idx_users_email ON users(email);  -- 별도 문장
```

---

## 4. 외래키

**MySQL**
```sql
FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
```

**PostgreSQL**
```sql
author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE
```
- 컬럼 정의에 바로 `REFERENCES` 사용

---

## 5. 제약조건

**PostgreSQL에서 추가로 사용한 CHECK**
```sql
total_episodes INT NOT NULL DEFAULT 0 CHECK (total_episodes >= 0)
completion_rate DECIMAL(5,2) NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100)
```
- MySQL은 `UNSIGNED`로 음수 방지, PostgreSQL은 `CHECK`로 명시

---

## 6. NULL vs 생략

**MySQL**
```sql
wallet_address VARCHAR(255) NULL
```

**PostgreSQL**
```sql
wallet_address VARCHAR(255)  -- 기본값이 NULL
```

---

## 7. MySQL 전용 (PostgreSQL에 없음)

| MySQL | 설명 |
|-------|------|
| `ENGINE=InnoDB` | 스토리지 엔진 |
| `CHARSET=utf8mb4` | 문자 인코딩 |
| `COLLATE=utf8mb4_unicode_ci` | 정렬 규칙 |
| `COMMENT '...'` | 컬럼 설명 (컬럼 정의 안에) |

PostgreSQL은 `COMMENT ON COLUMN`으로 별도 지정합니다.
