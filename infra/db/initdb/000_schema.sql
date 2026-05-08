-- ============================================================
-- Mongol PC :: MySQL Schema (3NF Normalized)
-- ============================================================

-- ============================================================
-- 1. ROLES (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. USERS (Google OAuth + RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36) PRIMARY KEY,
    google_id       VARCHAR(255) UNIQUE,
    firebase_uid    VARCHAR(128) NULL COMMENT 'Firebase Auth UID',
    email           VARCHAR(255) UNIQUE NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    password_hash   VARCHAR(255),
    role_id         INT NOT NULL DEFAULT 3,
    is_active       TINYINT(1) DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. CAFES
-- ============================================================
CREATE TABLE IF NOT EXISTS cafes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    address     TEXT NOT NULL,
    latitude    DECIMAL(10, 7) NOT NULL,
    longitude   DECIMAL(10, 7) NOT NULL,
    phone       VARCHAR(50),
    image_url   TEXT,
    is_active   TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. PC TIERS (Zaal & VIP)
-- ============================================================
CREATE TABLE IF NOT EXISTS pc_tiers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    gpu             VARCHAR(100) NOT NULL,
    ram             VARCHAR(100) NOT NULL,
    cpu             VARCHAR(100) NOT NULL,
    price_per_hour  DECIMAL(10, 2) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. PCS
-- ============================================================
CREATE TABLE IF NOT EXISTS pcs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    label       VARCHAR(50) NOT NULL,
    tier_id     INT NOT NULL,
    cafe_id     INT NOT NULL,
    status      VARCHAR(20) DEFAULT 'available',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pc_tier FOREIGN KEY (tier_id) REFERENCES pc_tiers(id),
    CONSTRAINT fk_pc_cafe FOREIGN KEY (cafe_id) REFERENCES cafes(id),
    UNIQUE KEY uk_pc_label_cafe (label, cafe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
    id              CHAR(36) PRIMARY KEY,
    user_id         CHAR(36) NOT NULL,
    cafe_id         INT NOT NULL,
    total_price     DECIMAL(10, 2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'confirmed',
    starts_at       DATETIME NOT NULL,
    ends_at         DATETIME NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_booking_cafe FOREIGN KEY (cafe_id) REFERENCES cafes(id),
    CONSTRAINT chk_booking_time CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. BOOKING ITEMS (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    booking_id  CHAR(36) NOT NULL,
    pc_id       INT NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_item_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_pc FOREIGN KEY (pc_id) REFERENCES pcs(id),
    UNIQUE KEY uk_booking_pc (booking_id, pc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. OAUTH ONE-TIME CODES (Google callback → token exchange, no JWT in URL)
-- ============================================================
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

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_pcs_cafe ON pcs(cafe_id);
CREATE INDEX idx_pcs_tier ON pcs(tier_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_cafe ON bookings(cafe_id);
CREATE INDEX idx_bookings_time ON bookings(starts_at, ends_at);
CREATE INDEX idx_booking_items_pc ON booking_items(pc_id);

-- ============================================================
-- SEED: Default Roles
-- ============================================================
INSERT IGNORE INTO roles (id, name, description) VALUES
    (1, 'admin', 'Full system access'),
    (2, 'moderator', 'Manage cafes and bookings'),
    (3, 'user', 'Book PCs and view cafes');

-- ============================================================
-- SEED: PC Tiers
-- ============================================================
INSERT IGNORE INTO pc_tiers (id, name, gpu, ram, cpu, price_per_hour, description) VALUES
    (1, 'Zaal', 'NVIDIA RTX 4070', '32GB DDR5', 'Intel Core Ultra 7', 3500.00,
     'Standard gaming tier with RTX 4070 and Ultra 7 processor'),
    (2, 'VIP', 'NVIDIA RTX 5070', '32GB DDR5', 'Intel Core Ultra 9', 5500.00,
     'Premium gaming tier with RTX 5070 and Ultra 9 processor');
