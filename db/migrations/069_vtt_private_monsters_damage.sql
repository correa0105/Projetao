ALTER TABLE "user" ADD COLUMN vtt_premium boolean NOT NULL DEFAULT false;
CREATE TABLE vtt_monster_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  source_token_id uuid NOT NULL,
  source_room_id uuid REFERENCES vtt_rooms(id) ON DELETE SET NULL,
  token jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_token_id)
);
ALTER TABLE vtt_messages ADD COLUMN damage jsonb;
ALTER TABLE vtt_messages ADD COLUMN discarded boolean NOT NULL DEFAULT false;
CREATE TABLE vtt_damage_applications (
  message_id bigint NOT NULL REFERENCES vtt_messages(id) ON DELETE CASCADE,
  token_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 100000),
  applied_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, token_id)
);
CREATE INDEX vtt_damage_room_idx ON vtt_damage_applications(room_id, message_id);
INSERT INTO vtt_monster_presets(user_id,source_room_id,source_token_id,token)
SELECT r.owner_id,r.id,(t->>'id')::uuid,t FROM vtt_rooms r,
  LATERAL jsonb_array_elements(r.document->'scenes') s,
  LATERAL jsonb_array_elements(s->'tokens') t
WHERE t->'sheet' IS NOT NULL AND t->'sheet' <> 'null'::jsonb
  AND (t->>'characterId') IS NULL AND t->>'layer' <> 'map'
ON CONFLICT(user_id,source_token_id) DO NOTHING;
