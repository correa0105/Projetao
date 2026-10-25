-- New replacement jobs wait for their owner; legacy jobs and first creations retain their flow.
ALTER TABLE character_art_jobs
  ADD COLUMN replacement_revision integer CHECK(replacement_revision>=0),
  ADD COLUMN proposed_portrait bytea,
  ADD COLUMN proposed_token bytea,
  ADD COLUMN art_decision text CHECK(art_decision IN('pending','accepted','kept')),
  ADD COLUMN decided_at timestamptz,
  ADD CONSTRAINT character_art_choice_pair CHECK (
    (proposed_portrait IS NULL)=(proposed_token IS NULL)
  ),
  ADD CONSTRAINT character_art_choice_ready CHECK (
    art_decision IS DISTINCT FROM 'pending' OR
    (status='completed' AND character_id IS NOT NULL AND replacement_revision IS NOT NULL
      AND proposed_portrait IS NOT NULL AND proposed_token IS NOT NULL)
  );
CREATE UNIQUE INDEX character_art_one_choice ON character_art_jobs(character_id)
  WHERE art_decision='pending';
