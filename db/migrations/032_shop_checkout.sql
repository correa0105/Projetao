ALTER TABLE catalog_items ALTER COLUMN price_cp DROP NOT NULL;
ALTER TABLE catalog_items ADD COLUMN image_path text,
  ADD COLUMN merchant_comment text NOT NULL DEFAULT '',
  ADD COLUMN weight_estimated boolean NOT NULL DEFAULT false;
CREATE TABLE shop_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id),
  idempotency_key uuid NOT NULL,
  lines jsonb NOT NULL,
  total_cp bigint NOT NULL CHECK (total_cp > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id,idempotency_key)
);
ALTER TABLE purchases ADD COLUMN checkout_id uuid REFERENCES shop_checkouts(id);
