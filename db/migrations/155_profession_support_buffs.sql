CREATE TABLE character_profession_buffs (
 character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
 item_id text NOT NULL REFERENCES catalog_items(id),
 source_key uuid NOT NULL,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CHECK(expires_at>started_at)
);
ALTER TABLE vtt_messages ADD COLUMN skill_check_key uuid;
ALTER TABLE vtt_messages ADD COLUMN skill_check jsonb;
CREATE UNIQUE INDEX vtt_skill_check_once ON vtt_messages(author_id,skill_check_key) WHERE skill_check_key IS NOT NULL;
