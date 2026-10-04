ALTER TABLE achievement_shelves DROP CONSTRAINT achievement_shelves_slots_check;
ALTER TABLE achievement_shelves DROP CONSTRAINT achievement_shelves_positions_check;
ALTER TABLE achievement_shelves ADD COLUMN rows jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE achievement_shelves s SET rows=(SELECT jsonb_agg(least(2,(n-1)/6) ORDER BY n) FROM generate_series(1,jsonb_array_length(s.slots)) n);
ALTER TABLE achievement_shelves ALTER COLUMN slots SET DEFAULT '[]'::jsonb;
ALTER TABLE achievement_shelves ALTER COLUMN positions SET DEFAULT '[]'::jsonb;
ALTER TABLE achievement_shelves ADD CONSTRAINT achievement_shelves_arrays_check CHECK(jsonb_typeof(slots)='array' AND jsonb_typeof(positions)='array' AND jsonb_typeof(rows)='array' AND jsonb_array_length(slots)=jsonb_array_length(positions) AND jsonb_array_length(slots)=jsonb_array_length(rows));
