CREATE TABLE house2_gardens (
  plot_id uuid NOT NULL REFERENCES house2_plots(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  crop text CHECK(crop IN ('erva-balsamo','raiz-dourada')),
  ready_at timestamptz,
  fertilized boolean NOT NULL DEFAULT false,
  compost text CHECK(compost IN ('cascas','composto')),
  compost_ready_at timestamptz,
  PRIMARY KEY (plot_id, character_id),
  CHECK(crop IS NOT NULL OR (ready_at IS NULL AND NOT fertilized)),
  CHECK(NOT fertilized OR ready_at IS NOT NULL),
  CHECK((compost IS NULL) = (compost_ready_at IS NULL))
);

CREATE TABLE house2_garden_actions (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  plot_id uuid NOT NULL REFERENCES house2_plots(id) ON DELETE CASCADE,
  action jsonb NOT NULL,
  gold_delta_cp integer NOT NULL,
  item_id text REFERENCES catalog_items(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, request_id)
);
