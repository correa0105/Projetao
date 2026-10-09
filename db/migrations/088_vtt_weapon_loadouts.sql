CREATE TABLE vtt_weapon_loadouts (
  room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  main_hand text,
  off_hand text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(room_id, character_id),
  CHECK(main_hand IS NULL OR off_hand IS NULL OR main_hand <> off_hand)
);
