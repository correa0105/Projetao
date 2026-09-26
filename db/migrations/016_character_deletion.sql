-- Retain economic audit and mission history when a player removes a character.
ALTER TABLE characters ADD COLUMN deleted_at timestamptz;
