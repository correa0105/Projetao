-- Recompose unused land, preserving every purchased plot, house position and decoration.
ALTER TABLE house2_plots DROP CONSTRAINT house2_plots_check;
ALTER TABLE house2_plots ADD CONSTRAINT house2_plots_world_bounds CHECK(x+width<=200 AND y+height<=200);
ALTER TABLE house2_plots ADD COLUMN retired_at timestamptz;
ALTER TABLE house2_plots ADD COLUMN village_slot integer CHECK(village_slot BETWEEN 1 AND 12);
ALTER TABLE house2_items ADD COLUMN scale double precision NOT NULL DEFAULT 1 CHECK(scale BETWEEN .25 AND 3);
CREATE TABLE house2_village_layout_backups (
  plot_id uuid PRIMARY KEY REFERENCES house2_plots(id),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO house2_village_layout_backups(plot_id,snapshot)
 SELECT p.id,jsonb_build_object('plot',to_jsonb(p),'items',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM house2_items i WHERE i.plot_id=p.id),'[]'::jsonb)) FROM house2_plots p;

-- Additional villages retain owned plots if a neighborhood already has more than twelve owners.
CREATE TEMP TABLE house2_village_groups ON COMMIT DROP AS
 SELECT n.id source_id,g.part,CASE WHEN g.part=0 THEN n.id ELSE gen_random_uuid() END target_id
 FROM house2_neighborhoods n CROSS JOIN LATERAL generate_series(0,greatest(0,((SELECT count(*)::integer FROM house2_plots p WHERE p.neighborhood_id=n.id AND p.character_id IS NOT NULL)-1)/12)) g(part);
INSERT INTO house2_neighborhoods(id,name,description,terrain)
 SELECT g.target_id,left(n.name,58)||' · Extensão '||(g.part+1),n.description,n.terrain FROM house2_village_groups g JOIN house2_neighborhoods n ON n.id=g.source_id WHERE g.part>0;
CREATE TEMP TABLE house2_owned_village ON COMMIT DROP AS
 SELECT p.id,p.neighborhood_id source_id,(row_number() OVER(PARTITION BY p.neighborhood_id ORDER BY p.number)-1)::integer idx FROM house2_plots p WHERE p.character_id IS NOT NULL;
UPDATE house2_plots p SET neighborhood_id=g.target_id,village_slot=o.idx%12+1,revision=revision+1
 FROM house2_owned_village o JOIN house2_village_groups g ON g.source_id=o.source_id AND g.part=o.idx/12 WHERE p.id=o.id;
UPDATE house2_plots SET retired_at=now() WHERE character_id IS NULL;

CREATE TEMP TABLE house2_village_candidates(ord,x,y) ON COMMIT DROP AS VALUES
 (1,3,35),(2,41,35),(3,71,43),(4,3,64),(5,32,65),(6,73,73),
 (7,11,91),(8,46,93),(9,83,97),(10,23,121),(11,60,122),(12,86,119),
 (13,115,20),(14,132,39),(15,117,58),(16,130,77),(17,117,96),(18,129,115),
 (19,112,148),(20,86,155),(21,63,156),(22,38,155),(23,13,153),(24,3,5),
 (25,29,8),(26,54,9),(27,79,12),(28,102,3),(29,3,174),(30,28,173),
 (31,53,175),(32,78,174),(33,103,173),(34,145,153),(35,166,42),(36,166,78);
DO $$
DECLARE g record; n_owned integer; candidate record; free_id uuid; slot integer;
BEGIN
 FOR g IN SELECT * FROM house2_village_groups ORDER BY source_id,part LOOP
  SELECT count(*) INTO n_owned FROM house2_plots WHERE neighborhood_id=g.target_id AND character_id IS NOT NULL;
  slot:=n_owned;
  FOR candidate IN SELECT * FROM house2_village_candidates ORDER BY ord LOOP
   EXIT WHEN slot>=12;
   IF EXISTS(SELECT 1 FROM house2_plots p WHERE p.neighborhood_id=g.target_id AND p.retired_at IS NULL AND candidate.x<p.x+p.width+1 AND candidate.x+13>p.x AND candidate.y<p.y+p.height+1 AND candidate.y+13>p.y) THEN CONTINUE; END IF;
   SELECT id INTO free_id FROM house2_plots WHERE neighborhood_id=g.source_id AND character_id IS NULL AND retired_at IS NOT NULL ORDER BY number LIMIT 1;
   IF free_id IS NULL THEN RAISE EXCEPTION 'Not enough unused plots to preserve the village'; END IF;
   slot:=slot+1;
   UPDATE house2_plots SET neighborhood_id=g.target_id,village_slot=slot,x=candidate.x,y=candidate.y,retired_at=NULL,revision=revision+1 WHERE id=free_id;
  END LOOP;
  IF slot<12 THEN RAISE EXCEPTION 'Could not allocate twelve nonoverlapping village plots'; END IF;
 END LOOP;
END $$;
CREATE UNIQUE INDEX house2_village_slots ON house2_plots(neighborhood_id,village_slot) WHERE retired_at IS NULL;
