-- Cast history, slot expenditure and visual placements are committed together.
-- Kept separate from legacy room JSON so saved maps and tokens are untouched.
CREATE TABLE vtt_spell_casts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id),
 idempotency_key uuid NOT NULL,
 command jsonb NOT NULL,
 effect jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 ended_by text REFERENCES "user"(id),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX vtt_spell_casts_room ON vtt_spell_casts(room_id,created_at DESC);
CREATE INDEX vtt_spell_casts_active ON vtt_spell_casts(room_id) WHERE ended_at IS NULL;
