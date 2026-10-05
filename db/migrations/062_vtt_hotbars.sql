CREATE TABLE vtt_hotbars (
  room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(room_id,user_id)
);
