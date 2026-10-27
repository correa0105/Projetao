ALTER TABLE vtt_siege_weapons ADD COLUMN last_load jsonb;
CREATE TABLE vtt_siege_impacts (
 id uuid PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 scene_id uuid NOT NULL,
 shot_id uuid NOT NULL UNIQUE,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vtt_siege_impacts_scene ON vtt_siege_impacts(room_id,scene_id);
