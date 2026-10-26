-- Attribute results belong to an account slot, independently of a character's lifecycle.
ALTER TABLE characters ADD COLUMN creation_slot smallint CHECK(creation_slot BETWEEN 1 AND 2);
ALTER TABLE character_art_jobs ADD COLUMN creation_slot smallint CHECK(creation_slot BETWEEN 1 AND 2);
ALTER TABLE character_art_jobs ADD COLUMN roll_generation integer CHECK(roll_generation>0);
ALTER TABLE character_sheets ADD COLUMN rolls_revealed smallint NOT NULL DEFAULT 6 CHECK(rolls_revealed BETWEEN 0 AND 6);

-- Reconstruct slots chronologically, including soft-deleted occupants. No game values change.
DO $$ DECLARE c record; chosen smallint; BEGIN
 FOR c IN SELECT id,user_id,created_at FROM characters ORDER BY user_id,created_at,id LOOP
  SELECT n INTO chosen FROM generate_series(1,2) n WHERE NOT EXISTS(
   SELECT 1 FROM characters old WHERE old.user_id=c.user_id AND old.creation_slot=n
    AND (old.deleted_at IS NULL OR old.deleted_at>c.created_at)
  ) ORDER BY n LIMIT 1;
  IF chosen IS NOT NULL THEN UPDATE characters SET creation_slot=chosen WHERE id=c.id; END IF;
 END LOOP;
END $$;
CREATE UNIQUE INDEX characters_live_creation_slot ON characters(user_id,creation_slot) WHERE deleted_at IS NULL AND creation_slot IS NOT NULL;

CREATE TABLE character_slot_rolls(
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 2),
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 rolls jsonb CHECK(rolls IS NULL OR(jsonb_typeof(rolls)='array' AND jsonb_array_length(rolls)=6)),
 minimum smallint NOT NULL DEFAULT 8 CHECK(minimum IN(0,8)),
 revealed smallint NOT NULL DEFAULT 0 CHECK(revealed BETWEEN 0 AND 6),
 character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
 matured boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,slot)
);
INSERT INTO character_slot_rolls(user_id,slot,rolls,minimum,revealed,character_id,matured)
 SELECT u.id,n,s.rolls,CASE WHEN s.rolls IS NULL THEN 8 ELSE s.ability_roll_floor END,CASE WHEN s.rolls IS NULL THEN 0 ELSE 6 END,c.id,coalesce(c.level>=4,false)
 FROM "user" u CROSS JOIN generate_series(1,2)n
 LEFT JOIN LATERAL(SELECT ch.* FROM characters ch WHERE ch.user_id=u.id AND ch.creation_slot=n ORDER BY(ch.deleted_at IS NULL) DESC,ch.created_at DESC,ch.id DESC LIMIT 1)c ON true
 LEFT JOIN LATERAL(
  SELECT sh.rolls,sh.ability_roll_floor FROM characters history JOIN character_sheets sh ON sh.character_id=history.id
  WHERE history.user_id=u.id AND history.creation_slot=n AND sh.rolls IS NOT NULL
   AND (history.id=c.id OR(history.created_at<c.created_at AND NOT EXISTS(
    SELECT 1 FROM characters veteran WHERE veteran.user_id=u.id AND veteran.creation_slot=n AND veteran.level>=4
     AND veteran.created_at>=history.created_at AND veteran.created_at<c.created_at
   ))) ORDER BY history.created_at DESC,history.id DESC LIMIT 1
 )s ON true;

-- Reserve existing jobs without making them re-roll or interrupting the illustrator.
DO $$ DECLARE j record; chosen smallint; BEGIN
 FOR j IN SELECT id,user_id FROM character_art_jobs WHERE character_id IS NULL AND status IN('queued','running') ORDER BY created_at,id LOOP
  SELECT n INTO chosen FROM generate_series(1,2)n WHERE NOT EXISTS(SELECT 1 FROM characters c WHERE c.user_id=j.user_id AND c.creation_slot=n AND c.deleted_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM character_art_jobs a WHERE a.user_id=j.user_id AND a.creation_slot=n AND a.character_id IS NULL AND a.status IN('queued','running')) ORDER BY n LIMIT 1;
  IF chosen IS NOT NULL THEN UPDATE character_art_jobs SET creation_slot=chosen,roll_generation=1 WHERE id=j.id; END IF;
 END LOOP;
END $$;
UPDATE character_slot_rolls p SET rolls=CASE WHEN p.matured THEN NULL ELSE p.rolls END,revealed=CASE WHEN p.matured THEN 0 ELSE p.revealed END,minimum=CASE WHEN p.matured THEN 8 ELSE p.minimum END,matured=false,character_id=NULL
 WHERE EXISTS(SELECT 1 FROM character_art_jobs j WHERE j.user_id=p.user_id AND j.creation_slot=p.slot AND j.character_id IS NULL AND j.status IN('queued','running'));

CREATE FUNCTION preserve_character_slot_rolls() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.creation_slot IS NOT NULL THEN
  UPDATE character_slot_rolls p SET matured=p.matured OR NEW.level>=4,
   rolls=coalesce(s.rolls,p.rolls),minimum=CASE WHEN s.rolls IS NOT NULL THEN s.ability_roll_floor ELSE p.minimum END,
   revealed=greatest(p.revealed,coalesce(s.rolls_revealed,0)),updated_at=now()
  FROM character_sheets s WHERE p.user_id=NEW.user_id AND p.slot=NEW.creation_slot AND p.character_id=NEW.id AND s.character_id=NEW.id;
  UPDATE character_slot_rolls SET matured=true,updated_at=now() WHERE user_id=NEW.user_id AND slot=NEW.creation_slot AND character_id=NEW.id AND NEW.level>=4;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER character_slot_rolls_lifecycle AFTER UPDATE OF level,deleted_at ON characters FOR EACH ROW EXECUTE FUNCTION preserve_character_slot_rolls();
