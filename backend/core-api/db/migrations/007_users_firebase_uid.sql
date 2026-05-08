-- Idempotent (see infra/db/initdb/007_users_firebase_uid.sql)
SET @db = DATABASE();

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'firebase_uid') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) NULL COMMENT ''Firebase Auth UID'' AFTER google_id'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_users_firebase_uid') > 0,
  'SELECT 1',
  'CREATE UNIQUE INDEX uk_users_firebase_uid ON users (firebase_uid)'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
