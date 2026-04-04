-- ============================================
-- Novel Agent (OHB) - MySQL DB Schema
-- ============================================
-- 테이블 3개: users, works, reader_actions

-- 1. users (작가 테이블)
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_wallet (wallet_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. works (작품 테이블)
CREATE TABLE works (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    status ENUM('연재중', '완결', '휴재') NOT NULL DEFAULT '연재중',
    total_episodes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_author (author_id),
    INDEX idx_status (status),
    INDEX idx_genre (genre),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. reader_actions (독자 행동 테이블)
CREATE TABLE reader_actions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_id BIGINT UNSIGNED NOT NULL,
    episode_number INT UNSIGNED NOT NULL,
    session_duration INT UNSIGNED NOT NULL COMMENT '체류시간(초)',
    completion_rate DECIMAL(5,2) NOT NULL COMMENT '정주행률(%)',
    drop_off TINYINT(1) NOT NULL DEFAULT 0 COMMENT '이탈여부: 0=아니오, 1=예',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_work (work_id),
    INDEX idx_work_episode (work_id, episode_number),
    INDEX idx_recorded (recorded_at),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
