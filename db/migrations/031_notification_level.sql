ALTER TABLE characters ADD COLUMN notification_level_read smallint NOT NULL DEFAULT 1
  CHECK (notification_level_read BETWEEN 1 AND 20);
