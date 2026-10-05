CREATE TABLE vtt_character_links (
 room_id uuid NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 imported_by text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(room_id,character_id)
);
INSERT INTO vtt_character_links(room_id,character_id,imported_by)
SELECT DISTINCT r.id,c.id,c.user_id FROM vtt_rooms r
CROSS JOIN LATERAL jsonb_array_elements(r.document->'scenes') scene
CROSS JOIN LATERAL jsonb_array_elements(scene->'tokens') token
JOIN characters c ON c.id::text=token->>'characterId' AND c.user_id=token->>'controller'
WHERE r.owner_id=c.user_id OR EXISTS(SELECT 1 FROM vtt_members m WHERE m.room_id=r.id AND m.user_id=c.user_id)
ON CONFLICT DO NOTHING;
CREATE TABLE vtt_character_resources (
 character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
 slots_total jsonb NOT NULL, slots_used jsonb NOT NULL,
 hit_dice_used integer NOT NULL DEFAULT 0 CHECK(hit_dice_used>=0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vtt_resource_uses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES vtt_rooms(id),
 character_id uuid NOT NULL REFERENCES characters(id), user_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL CHECK(kind IN ('slot','hit-die','consumable')),
 item_id text REFERENCES catalog_items(id), slot integer CHECK(slot BETWEEN 1 AND 9),
 idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 restored_at timestamptz, restored_by text REFERENCES "user"(id),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX vtt_resource_uses_character ON vtt_resource_uses(character_id,created_at DESC);
ALTER TABLE vtt_messages ADD COLUMN spell jsonb;
