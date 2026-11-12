ALTER TABLE house2_gardens ADD COLUMN watered_at timestamptz;
UPDATE house2_gardens g SET watered_at=coalesce(
  (SELECT max(created_at) FROM house2_garden_actions a
    WHERE a.plot_id=g.plot_id AND a.character_id=g.character_id AND a.action->>'action'='water'),
  g.ready_at - CASE g.crop WHEN 'erva-balsamo' THEN interval '8 hours' ELSE interval '12 hours' END
) WHERE g.ready_at IS NOT NULL;

ALTER TABLE house2_items
  ADD COLUMN garden_plot_id uuid REFERENCES house2_plots(id) ON DELETE CASCADE,
  ADD COLUMN garden_role text CHECK(garden_role IN ('bed','compost')),
  ADD CONSTRAINT house2_garden_item_role CHECK((garden_plot_id IS NULL)=(garden_role IS NULL)),
  ADD CONSTRAINT house2_garden_item_unique UNIQUE(garden_plot_id,garden_role);

-- Existing active gardens become visible without changing their crops or timers.
INSERT INTO house2_items(user_id,catalog_id,plot_id,x,y,garden_plot_id,garden_role)
SELECT c.user_id,CASE role WHEN 'bed' THEN 'h2-garden-bed' ELSE 'h2-garden-compost' END,
  CASE WHEN (SELECT count(*) FROM house2_items i WHERE i.plot_id=p.id) <= 198 THEN p.id END,
  CASE WHEN (SELECT count(*) FROM house2_items i WHERE i.plot_id=p.id) <= 198 THEN p.x+2.5 END,
  CASE WHEN (SELECT count(*) FROM house2_items i WHERE i.plot_id=p.id) <= 198 THEN p.y+CASE role WHEN 'bed' THEN 2.5 ELSE 4.7 END END,p.id,role
FROM house2_gardens g JOIN house2_plots p ON p.id=g.plot_id AND p.character_id=g.character_id
JOIN characters c ON c.id=g.character_id
CROSS JOIN (VALUES ('bed'),('compost')) AS roles(role)
WHERE p.retired_at IS NULL AND p.house_id IS NOT NULL AND c.deleted_at IS NULL
ON CONFLICT(garden_plot_id,garden_role) DO NOTHING;

UPDATE house2_plots p SET revision=revision+1
WHERE EXISTS(SELECT 1 FROM house2_items i WHERE i.garden_plot_id=p.id AND i.plot_id=p.id);
