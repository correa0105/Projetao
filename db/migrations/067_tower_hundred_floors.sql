ALTER TABLE tower_expeditions DROP CONSTRAINT tower_expeditions_cleared_floor_check;
ALTER TABLE tower_expeditions ADD CONSTRAINT tower_expeditions_cleared_floor_check CHECK(cleared_floor BETWEEN 0 AND 100);
ALTER TABLE tower_claims DROP CONSTRAINT tower_claims_floor_check;
ALTER TABLE tower_claims ADD CONSTRAINT tower_claims_floor_check CHECK(floor BETWEEN 1 AND 100);
ALTER TABLE tower_claims DROP CONSTRAINT tower_claims_tier_check;
ALTER TABLE tower_claims ADD CONSTRAINT tower_claims_tier_check CHECK(tier BETWEEN 0 AND 100);

CREATE TABLE tower_floors (
 number integer PRIMARY KEY CHECK(number BETWEEN 1 AND 100),
 name varchar(100) NOT NULL,
 description varchar(3000) NOT NULL DEFAULT '',
 challenge varchar(3000) NOT NULL DEFAULT '',
 hazard varchar(3000) NOT NULL DEFAULT '',
 traps varchar(3000) NOT NULL DEFAULT '',
 creatures jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(creatures)='array'),
 boss boolean NOT NULL DEFAULT false,
 boss_name varchar(100) NOT NULL DEFAULT '',
 revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tower_floors(number,name,boss)
SELECT n,'Andar '||n,n%5=0 FROM generate_series(1,100) n;
