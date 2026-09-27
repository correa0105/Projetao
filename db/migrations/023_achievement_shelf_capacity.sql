ALTER TABLE achievement_shelves DROP CONSTRAINT achievement_shelves_slots_check;
UPDATE achievement_shelves SET slots =
  jsonb_build_array(slots->0,slots->1,slots->2,NULL,NULL,NULL,
                    slots->3,slots->4,slots->5,NULL,NULL,NULL,
                    slots->6,slots->7,slots->8,NULL,NULL,NULL);
ALTER TABLE achievement_shelves ALTER COLUMN slots SET DEFAULT '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb;
ALTER TABLE achievement_shelves ADD CONSTRAINT achievement_shelves_slots_check CHECK (jsonb_typeof(slots)='array' AND jsonb_array_length(slots)=18);
