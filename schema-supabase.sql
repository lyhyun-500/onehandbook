-- ============================================
-- Novel Agent (OHB) - Supabase (PostgreSQL) DB Schema
-- ============================================
-- Supabase SQL Editor에서 실행하거나, 마이그레이션으로 적용
-- 테이블 3개: users, works, reader_actions

-- 1. users (작가 테이블)
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(255),
    nat_balance INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- 2. works (작품 테이블)
-- PostgreSQL: ENUM 대신 CHECK 제약 또는 VARCHAR 사용
CREATE TYPE work_status AS ENUM ('연재중', '완결', '휴재');

CREATE TABLE works (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status work_status NOT NULL DEFAULT '연재중',
    total_episodes INT NOT NULL DEFAULT 0 CHECK (total_episodes >= 0),
    world_setting jsonb NOT NULL DEFAULT '{}'::jsonb,
    character_settings jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_works_author ON works(author_id);
CREATE INDEX idx_works_status ON works(status);
CREATE INDEX idx_works_genre ON works(genre);

-- 3. reader_actions (독자 행동 테이블)
CREATE TABLE reader_actions (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_number INT NOT NULL CHECK (episode_number > 0),
    session_duration INT NOT NULL CHECK (session_duration >= 0),  -- 체류시간(초)
    completion_rate DECIMAL(5,2) NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100),  -- 정주행률(%)
    drop_off BOOLEAN NOT NULL DEFAULT false,  -- 이탈여부
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reader_actions_work ON reader_actions(work_id);
CREATE INDEX idx_reader_actions_work_episode ON reader_actions(work_id, episode_number);
CREATE INDEX idx_reader_actions_recorded ON reader_actions(recorded_at);

-- 컬럼 설명 (PostgreSQL COMMENT)
COMMENT ON COLUMN reader_actions.session_duration IS '체류시간(초)';
COMMENT ON COLUMN reader_actions.completion_rate IS '정주행률(%)';
COMMENT ON COLUMN reader_actions.drop_off IS '이탈여부';

-- 4. episodes (회차 테이블)
CREATE TABLE episodes (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_number INT NOT NULL CHECK (episode_number > 0),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(work_id, episode_number)
);

CREATE INDEX idx_episodes_work ON episodes(work_id);
CREATE INDEX idx_episodes_work_number ON episodes(work_id, episode_number);

-- 5. analysis_runs (AI 분석 결과)
CREATE TABLE analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    agent_version TEXT NOT NULL,
    result_json JSONB NOT NULL,
    nat_cost INT,
    options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analysis_runs_episode ON analysis_runs(episode_id, created_at DESC);

-- 6. analysis_results (회차별 분석 스냅샷 캐시 — works → episodes → analysis_results)
CREATE TABLE analysis_results (
    id BIGSERIAL PRIMARY KEY,
    work_id BIGINT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    episode_id BIGINT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    analysis_run_id BIGINT NOT NULL UNIQUE REFERENCES analysis_runs(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback TEXT NOT NULL,
    nat_consumed INT NOT NULL CHECK (nat_consumed >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_results_episode_created ON analysis_results(episode_id, created_at DESC);
CREATE INDEX idx_analysis_results_work ON analysis_results(work_id);
