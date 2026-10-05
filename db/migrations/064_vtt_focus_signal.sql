-- Transient focus events are independent of document revisions and autosaves.
ALTER TABLE vtt_rooms ADD COLUMN focus_signal jsonb;
