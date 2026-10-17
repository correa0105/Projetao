ALTER TABLE house2_plots ADD COLUMN ground jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK(jsonb_typeof(ground)='array' AND jsonb_array_length(ground)<=250);
