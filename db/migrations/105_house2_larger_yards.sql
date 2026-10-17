-- Enlarge the yard around its existing center without moving houses, furniture or paint.
ALTER TABLE house2_plots DROP CONSTRAINT house2_plots_width_check;
ALTER TABLE house2_plots DROP CONSTRAINT house2_plots_height_check;
ALTER TABLE house2_plots ADD CONSTRAINT house2_plots_yard_size CHECK(width IN(12,18) AND height=width);
ALTER TABLE house2_plots ALTER COLUMN width SET DEFAULT 18;
ALTER TABLE house2_plots ALTER COLUMN height SET DEFAULT 18;
CREATE TEMP TABLE house2_yard_expansion ON COMMIT DROP AS
 SELECT id,neighborhood_id,
  CASE WHEN width=12 THEN greatest(0,least(182,x-3)) ELSE x END AS x,
  CASE WHEN height=12 THEN greatest(0,least(182,y-3)) ELSE y END AS y,
  18 AS width,18 AS height
 FROM house2_plots WHERE retired_at IS NULL;
-- Dense legacy villages retain their current boundaries where enlarging would take a neighbor's land.
DELETE FROM house2_yard_expansion e USING (
 SELECT p.id FROM house2_yard_expansion p JOIN house2_yard_expansion q
  ON p.neighborhood_id=q.neighborhood_id AND p.id<>q.id
  AND p.x<q.x+q.width AND p.x+p.width>q.x AND p.y<q.y+q.height AND p.y+p.height>q.y
) blocked WHERE e.id=blocked.id;
UPDATE house2_plots p SET x=e.x,y=e.y,width=e.width,height=e.height,revision=p.revision+1
 FROM house2_yard_expansion e WHERE p.id=e.id AND p.width=12;
