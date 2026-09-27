ALTER TABLE achievement_shelves ADD COLUMN material text NOT NULL DEFAULT 'walnut' CHECK (material IN ('walnut','oak','ebony'));
ALTER TABLE achievement_shelves ADD COLUMN medal_frame text NOT NULL DEFAULT 'bronze' CHECK (medal_frame IN ('bronze','silver','dragon'));
ALTER TABLE achievement_shelves DROP CONSTRAINT achievement_shelves_slots_check;
UPDATE achievement_shelves SET slots=slots || '[null,null,null,null,null,null]'::jsonb;
ALTER TABLE achievement_shelves ALTER COLUMN slots SET DEFAULT '[null,null,null,null,null,null,null,null,null]'::jsonb;
ALTER TABLE achievement_shelves ADD CONSTRAINT achievement_shelves_slots_check CHECK (jsonb_typeof(slots)='array' AND jsonb_array_length(slots)=9);
