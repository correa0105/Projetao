-- Preserve the approved portrait while the independent VTT token is generated.
-- Private recovery data stays attached to the existing owner-scoped job.
ALTER TABLE character_art_jobs ADD COLUMN approved_portrait bytea;
