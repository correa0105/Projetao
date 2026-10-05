-- Combat has its own revision so player rolls cannot race a master's map autosave.
ALTER TABLE vtt_rooms ADD COLUMN combat jsonb;
