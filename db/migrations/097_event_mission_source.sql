ALTER TABLE board_posts
  ADD COLUMN event_source_id uuid REFERENCES board_posts(id);

ALTER TABLE board_posts
  ADD CONSTRAINT board_event_mission_kind CHECK (event_source_id IS NULL OR kind = 'mission');

CREATE INDEX board_event_missions ON board_posts(event_source_id) WHERE event_source_id IS NOT NULL;
