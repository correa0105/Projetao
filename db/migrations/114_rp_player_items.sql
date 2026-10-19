ALTER TABLE rp_room_presence ADD COLUMN depth_layer smallint NOT NULL DEFAULT 4 CHECK(depth_layer BETWEEN 1 AND 6);
ALTER TABLE rp_room_presence ADD COLUMN scene_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(scene_items)='array');
