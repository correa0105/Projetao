-- Appearance options do not split, consume or unequip a purchased barding.
-- Existing requests retain the full-barding default without rewriting their rows.
ALTER TABLE companion_art_jobs ADD COLUMN barding_parts text[]
  CHECK (barding_parts IS NULL OR (
    cardinality(barding_parts) <= 6 AND
    barding_parts <@ ARRAY['head','neck','chest','body','front_legs','hind_legs']::text[]
  ));
