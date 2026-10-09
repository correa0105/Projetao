ALTER TABLE companion_artworks ADD COLUMN token_image bytea;
ALTER TABLE vtt_assets ADD COLUMN companion_art_source uuid REFERENCES companion_wardrobes(id) ON DELETE SET NULL;
CREATE INDEX vtt_assets_companion_art_source_idx ON vtt_assets(companion_art_source) WHERE companion_art_source IS NOT NULL;
