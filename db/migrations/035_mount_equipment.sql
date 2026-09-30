ALTER TABLE character_mounts ADD COLUMN equipment jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(equipment)='array');
ALTER TABLE character_mounts ADD COLUMN equipment_price_cp integer NOT NULL DEFAULT 0 CHECK(equipment_price_cp >= 0);
