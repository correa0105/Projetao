-- Snapshot the rule for future rolls without silently rewriting existing sheets.
ALTER TABLE character_sheets
  ADD COLUMN ability_roll_floor smallint NOT NULL DEFAULT 0
  CHECK (ability_roll_floor IN (0, 8));
