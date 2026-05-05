-- Applied by: npm run db:migrate
-- Safe for existing DBs (idempotent).

CREATE TABLE IF NOT EXISTS oauth_exchange_codes (
    code        VARCHAR(64) PRIMARY KEY,
    user_id     CHAR(36) NOT NULL,
    expires_at  DATETIME NOT NULL,
    used        TINYINT(1) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_oauth_expires (expires_at),
    INDEX idx_oauth_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
