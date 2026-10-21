-- Preserve the approved construction identity independently from later outfits.
ALTER TABLE character_portraits ADD COLUMN construction_base bytea;
ALTER TABLE character_art_jobs ADD COLUMN reference_mode text NOT NULL DEFAULT 'reference'
  CHECK (reference_mode IN ('construction','reference'));
-- The previous release already allowed these unambiguous creations without uploads.
UPDATE character_art_jobs SET reference_mode='construction'
WHERE status IN ('queued','running') AND reference IS NULL
  AND creation->>'race'='Warforged'
  AND creation->'choices'->'warforgedAppearance' IS NOT NULL;
