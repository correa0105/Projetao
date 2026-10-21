-- Add geographic stories and public pins without replacing existing geography or missions.
ALTER TABLE world_regions ADD COLUMN history_page_id uuid REFERENCES lore_pages(id);
ALTER TABLE world_locations ADD COLUMN history_page_id uuid REFERENCES lore_pages(id),
  ADD COLUMN pin_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE vtt_rooms ADD COLUMN region_id text REFERENCES world_regions(id),
  ADD COLUMN location_id text,
  ADD CONSTRAINT vtt_room_location_region_fk FOREIGN KEY(location_id,region_id) REFERENCES world_locations(id,region_id),
  ADD CONSTRAINT vtt_room_location_requires_region CHECK(location_id IS NULL OR region_id IS NOT NULL);
