-- Audited once per character; transferring or discarding gear never regenerates it.
CREATE TABLE character_starting_item_grants (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  source_labels jsonb NOT NULL,
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
