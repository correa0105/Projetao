-- Public RP decor is now painted into each complete scene image.
-- Private rooms retain all placements and invitation permissions.
UPDATE rp_rooms
SET document = jsonb_set(document, '{placements}', '[]'::jsonb),
    revision = revision + 1
WHERE kind = 'fixed' AND document->'placements' <> '[]'::jsonb;
