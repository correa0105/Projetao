-- Retain every catalog row, inventory, equipped item and order. Withdraw sales only.
UPDATE catalog_items SET active = false
WHERE active AND (
  raw_data->>'upstream_source' = 'AU'
  OR raw_data->'upstream_facts'->>'source' = 'AU'
  OR raw_data->>'source_book' = 'Arcana Unleashed'
  OR source ILIKE '%Arcana Unleashed%'
);

UPDATE catalog_items piece SET active = false
FROM catalog_items parent
WHERE piece.active AND piece.raw_data->>'armor_bundle_parent' = parent.id
  AND (
    parent.raw_data->>'upstream_source' = 'AU'
    OR parent.raw_data->'upstream_facts'->>'source' = 'AU'
    OR parent.raw_data->>'source_book' = 'Arcana Unleashed'
    OR parent.source ILIKE '%Arcana Unleashed%'
  );
