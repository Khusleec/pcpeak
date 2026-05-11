-- Seed: initial admin account
-- INSERT IGNORE is safe to re-run; the migration runner also tracks applied files.

INSERT IGNORE INTO users (id, email, display_name, role_id, google_id, firebase_uid, avatar_url, password_hash, is_active, created_at, updated_at)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'admin@pcpeak.mn',
    'Admin',
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
