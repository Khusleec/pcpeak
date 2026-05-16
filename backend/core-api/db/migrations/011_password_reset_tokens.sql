-- ============================================================
-- 11. PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token       VARCHAR(64) PRIMARY KEY,
    user_id     CHAR(36) NOT NULL,
    expires_at  DATETIME NOT NULL,
    used        TINYINT(1) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_reset_token_expires (expires_at),
    INDEX idx_reset_token_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
