-- Same as infra/db/initdb/005_tournaments.sql (core-api migrate runner)
CREATE TABLE IF NOT EXISTS tournaments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    game_title              VARCHAR(200) NOT NULL,
    cafe_id                 INT NULL,
    starts_at               DATETIME NOT NULL,
    ends_at                 DATETIME NOT NULL,
    registration_deadline   DATETIME NULL COMMENT 'NULL = deadline is starts_at',
    max_participants        INT NOT NULL DEFAULT 32,
    prize_pool_mnt          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status                  VARCHAR(32) NOT NULL DEFAULT 'registration',
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tournament_cafe FOREIGN KEY (cafe_id) REFERENCES cafes (id) ON DELETE SET NULL,
    CONSTRAINT chk_tournament_time CHECK (ends_at > starts_at),
    UNIQUE KEY uk_tournaments_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tournament_registrations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    user_id         CHAR(36) NOT NULL,
    in_game_name    VARCHAR(120) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tr_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE KEY uk_tr_tournament_user (tournament_id, user_id),
    INDEX idx_tr_tournament (tournament_id),
    INDEX idx_tr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
