ALTER TABLE house2_items DROP CONSTRAINT house2_items_rotation_check;
ALTER TABLE house2_items ALTER COLUMN rotation TYPE double precision USING rotation::double precision;
ALTER TABLE house2_items ADD CONSTRAINT house2_items_rotation_check CHECK(rotation >= 0 AND rotation < 360);
