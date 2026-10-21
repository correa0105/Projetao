ALTER TABLE board_posts
 ADD COLUMN deleted_at timestamptz,
 ADD COLUMN deleted_by text REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX board_posts_visible_idx ON board_posts(created_at DESC) WHERE deleted_at IS NULL;
