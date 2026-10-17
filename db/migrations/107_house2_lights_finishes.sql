ALTER TABLE house2_items ADD COLUMN light_on boolean NOT NULL DEFAULT false;
ALTER TABLE house2_items ADD COLUMN light_revision integer NOT NULL DEFAULT 0 CHECK(light_revision>=0);
ALTER TABLE house2_plots ADD COLUMN finishes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(finishes)='object');
CREATE TABLE house2_finish_ownership (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  catalog_id text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,catalog_id)
);
