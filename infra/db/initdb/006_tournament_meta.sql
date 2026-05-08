-- ============================================================
-- Idempotent upgrade: DBs that applied legacy 005 (unique title,
-- no organizer columns) get ALTERs; fresh installs with new 005
-- no-op each dynamic statement.
-- ============================================================
SET @db = DATABASE();

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND INDEX_NAME = 'uk_tournaments_title') > 0,
  'ALTER TABLE tournaments DROP INDEX uk_tournaments_title',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'created_by') > 0,
  'SELECT 1',
  'ALTER TABLE tournaments ADD COLUMN created_by CHAR(36) NULL COMMENT ''Organizer user id'''
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'visibility') > 0,
  'SELECT 1',
  'ALTER TABLE tournaments ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT ''public'' COMMENT ''public | private'''
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'setup_mode') > 0,
  'SELECT 1',
  'ALTER TABLE tournaments ADD COLUMN setup_mode VARCHAR(16) NOT NULL DEFAULT ''manual'' COMMENT ''manual | automatic'''
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND COLUMN_NAME = 'bracket_type') > 0,
  'SELECT 1',
  'ALTER TABLE tournaments ADD COLUMN bracket_type VARCHAR(32) NOT NULL DEFAULT ''elimination'' COMMENT ''elimination | double_elimination'''
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND CONSTRAINT_NAME = 'fk_tournament_creator') > 0,
  'SELECT 1',
  'ALTER TABLE tournaments ADD CONSTRAINT fk_tournament_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND INDEX_NAME = 'idx_tournaments_title') > 0,
  'SELECT 1',
  'CREATE INDEX idx_tournaments_title ON tournaments (title(190))'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND INDEX_NAME = 'idx_tournaments_visibility') > 0,
  'SELECT 1',
  'CREATE INDEX idx_tournaments_visibility ON tournaments (visibility)'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tournaments' AND INDEX_NAME = 'idx_tournaments_created_by') > 0,
  'SELECT 1',
  'CREATE INDEX idx_tournaments_created_by ON tournaments (created_by)'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
