-- Add position_index to pcs for manual layout management (0-indexed position in a grid)
ALTER TABLE pcs ADD COLUMN position_index INT NULL;
