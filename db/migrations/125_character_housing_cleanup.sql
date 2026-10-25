-- Vacate land without refunding purchases or deleting the account's collection.
CREATE FUNCTION release_house2_plots(requested_ids uuid[]) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE owner_id text; affected_ids uuid[]; released integer;
BEGIN
  FOR owner_id IN
    SELECT DISTINCT c.user_id FROM house2_plots p
    JOIN characters c ON c.id=p.character_id
    WHERE p.id=ANY(requested_ids) ORDER BY c.user_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('house2-layout:' || owner_id,0));
  END LOOP;
  PERFORM id FROM house2_plots WHERE id=ANY(requested_ids) ORDER BY id FOR UPDATE;
  SELECT array_agg(p.id) INTO affected_ids FROM house2_plots p
    WHERE p.id=ANY(requested_ids) AND (
      p.character_id IS NOT NULL OR p.house_id IS NOT NULL OR p.purchased_at IS NOT NULL
      OR p.ground<>'[]'::jsonb OR p.finishes<>'{}'::jsonb OR p.door_open
      OR p.house_rotation<>0 OR EXISTS(SELECT 1 FROM house2_items i WHERE i.plot_id=p.id)
    );
  IF affected_ids IS NULL THEN RETURN 0; END IF;
  UPDATE house2_items SET plot_id=NULL,x=NULL,y=NULL,light_on=false,
    light_revision=light_revision+CASE WHEN light_on THEN 1 ELSE 0 END
    WHERE plot_id=ANY(affected_ids);
  UPDATE house2_plots SET character_id=NULL,house_id=NULL,house_x=NULL,house_y=NULL,
    house_rotation=0,purchased_at=NULL,ground='[]'::jsonb,finishes='{}'::jsonb,
    door_open=false,revision=revision+1 WHERE id=ANY(affected_ids);
  GET DIAGNOSTICS released=ROW_COUNT;
  RETURN released;
END $$;

CREATE FUNCTION remove_character_housing(removed_character uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM release_house2_plots(ARRAY(SELECT id FROM house2_plots WHERE character_id=removed_character));
  DELETE FROM house2_tokens WHERE character_id=removed_character;
  DELETE FROM house_presence WHERE character_id=removed_character OR home_id IN
    (SELECT id FROM house_homes WHERE character_id=removed_character);
  DELETE FROM house_invites WHERE home_id IN
    (SELECT id FROM house_homes WHERE character_id=removed_character);
  DELETE FROM house_messages WHERE home_id IN
    (SELECT id FROM house_homes WHERE character_id=removed_character);
  DELETE FROM house_homes WHERE character_id=removed_character;
  -- house_items/orders/rewards/gifts and house2_orders retain their audit history.
END $$;

CREATE FUNCTION character_housing_deleted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM remove_character_housing(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER character_housing_deleted
  AFTER UPDATE OF deleted_at ON characters FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION character_housing_deleted();

-- Clear houses left by characters deleted before this rule existed.
DO $$
DECLARE removed_id uuid;
BEGIN
  FOR removed_id IN SELECT id FROM characters WHERE deleted_at IS NOT NULL ORDER BY id
  LOOP PERFORM remove_character_housing(removed_id); END LOOP;
END $$;
