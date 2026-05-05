-- Agent task queue: core-api enqueues, agent-worker polls + processes.
-- Real SOA split: HTTP service writes a row; background worker drains it.

CREATE TABLE IF NOT EXISTS agent_tasks (
    id            CHAR(36)      NOT NULL PRIMARY KEY,
    user_id       CHAR(36)      NOT NULL,
    message       TEXT          NOT NULL,
    status        ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
    reply         TEXT          NULL,
    error         TEXT          NULL,
    attempts      TINYINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    started_at    TIMESTAMP     NULL,
    finished_at   TIMESTAMP     NULL,
    INDEX idx_agent_tasks_status_created (status, created_at),
    INDEX idx_agent_tasks_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
