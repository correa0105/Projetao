CREATE TABLE character_tokens (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  image bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vtt_assets ADD COLUMN character_art_source uuid REFERENCES characters(id) ON DELETE SET NULL;
CREATE INDEX vtt_assets_character_art_source ON vtt_assets(character_art_source) WHERE character_art_source IS NOT NULL;

-- Tag only existing portrait copies imported by the character owner. Custom uploads stay independent.
WITH imported AS (
  SELECT DISTINCT a.id, c.id AS character_id
  FROM vtt_rooms r
  CROSS JOIN LATERAL jsonb_array_elements(r.document->'scenes') s
  CROSS JOIN LATERAL jsonb_array_elements(s->'tokens') t
  JOIN characters c ON c.id::text=t->>'characterId' AND c.user_id=t->>'controller'
  JOIN vtt_assets a ON a.room_id=r.id AND '/api/vtt/assets/'||a.id::text=t->>'image'
    AND a.name=c.name||' · token' AND a.kind='image'
)
UPDATE vtt_assets a SET character_art_source=i.character_id FROM imported i WHERE a.id=i.id;
