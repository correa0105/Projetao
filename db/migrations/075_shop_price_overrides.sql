-- Administrative prices survive catalog imports and application startup seeds.
-- Shop IDs include the separate House offerings (house-<catalog id>).
CREATE TABLE shop_price_overrides (
  item_id text PRIMARY KEY,
  price_cp integer CHECK (price_cp IS NULL OR price_cp > 0),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (item_id NOT LIKE 'house-%' OR price_cp IS NOT NULL)
);
