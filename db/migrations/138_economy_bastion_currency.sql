-- New spending currency; existing gold, test balances, orders and completed rewards survive.
ALTER TABLE house2_accounts ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE player_guilds ADD COLUMN bastion_treasury_cp integer NOT NULL DEFAULT 0 CHECK(bastion_treasury_cp>=0);
ALTER TABLE player_guilds ADD COLUMN founding_currency text NOT NULL DEFAULT 'gold' CHECK(founding_currency IN ('gold','bastion'));
ALTER TABLE player_guild_ledger ADD COLUMN currency text NOT NULL DEFAULT 'gold' CHECK(currency IN ('gold','bastion'));
CREATE TABLE bastion_currency_ledger (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id),
 kind text NOT NULL, reference text NOT NULL, amount integer NOT NULL,
 balance_after integer NOT NULL CHECK(balance_after>=0), metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,kind,reference)
);
CREATE TABLE economy_price_history (
 version text NOT NULL,item_id text NOT NULL,before_price_cp integer,after_price_cp integer,
 before_override jsonb,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(version,item_id)
);
CREATE TABLE economy_settings_history (
 version text NOT NULL,area text NOT NULL,reference text NOT NULL,document jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(version,area,reference)
);
INSERT INTO economy_settings_history(version,area,reference,document)
 SELECT 'economy-20261102','community','settings',document FROM community_settings WHERE singleton;
UPDATE community_settings SET document=jsonb_set(document,'{founding_po}','1500'),revision=revision+1 WHERE singleton;
INSERT INTO economy_settings_history(version,area,reference,document)
 SELECT 'economy-20261102','facility',room,jsonb_build_object('progression',progression,'revision',revision)
 FROM guild_facility_definitions WHERE progression IS NOT NULL;
-- Only monetary requirements change; benefits, enablement and all achievement goals stay intact.
UPDATE guild_facility_definitions d SET progression=jsonb_set(progression,'{levels}',(
 SELECT jsonb_agg(jsonb_set(t,'{requirements}',(
   SELECT coalesce(jsonb_agg(CASE WHEN r->>'kind'='treasury' THEN jsonb_set(r,'{target}',to_jsonb(
    (CASE (t->>'level')::int WHEN 2 THEN 300 WHEN 3 THEN 600 WHEN 4 THEN 1000 WHEN 5 THEN 1600
      WHEN 6 THEN 2400 WHEN 7 THEN 3600 WHEN 8 THEN 5200 WHEN 9 THEN 7500 WHEN 10 THEN 10000 ELSE 0 END)*100)) ELSE r END),'[]'::jsonb)
   FROM jsonb_array_elements(t->'requirements')r
 ))) FROM jsonb_array_elements(progression->'levels')t
)),revision=revision+1 WHERE progression IS NOT NULL;
INSERT INTO economy_settings_history(version,area,reference,document)
 SELECT 'economy-20261102','free_plot',id::text,jsonb_build_object('price',price) FROM house2_plots WHERE character_id IS NULL;
UPDATE house2_plots SET price=600 WHERE character_id IS NULL;
CREATE FUNCTION house2_current_market_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.character_id IS NULL THEN NEW.price:=600; END IF; RETURN NEW; END $$;
CREATE TRIGGER house2_market_price BEFORE INSERT OR UPDATE OF character_id ON house2_plots
 FOR EACH ROW EXECUTE FUNCTION house2_current_market_price();
ALTER TABLE board_posts ADD COLUMN bastion_credits integer NOT NULL DEFAULT 0 CHECK(bastion_credits>=0);
INSERT INTO economy_settings_history(version,area,reference,document)
 SELECT 'economy-20261102','open_mission',id::text,jsonb_build_object('reward_cp',reward_cp)
 FROM board_posts WHERE kind='mission' AND status IN ('open','active');
UPDATE board_posts SET reward_cp=(CASE mission_rank
 WHEN 'Ferro' THEN CASE difficulty WHEN 'Tranquila' THEN 100 WHEN 'Perigosa' THEN 150 ELSE 125 END
 WHEN 'Bronze' THEN CASE difficulty WHEN 'Tranquila' THEN 250 WHEN 'Perigosa' THEN 350 ELSE 300 END
 WHEN 'Adamantium' THEN CASE difficulty WHEN 'Tranquila' THEN 500 WHEN 'Perigosa' THEN 750 ELSE 625 END
 WHEN 'Ametista' THEN CASE difficulty WHEN 'Tranquila' THEN 1000 WHEN 'Perigosa' THEN 1500 ELSE 1250 END
 ELSE CASE difficulty WHEN 'Tranquila' THEN 2000 WHEN 'Perigosa' THEN 3000 ELSE 2500 END END)*100,
 bastion_credits=CASE mission_rank
 WHEN 'Ferro' THEN CASE difficulty WHEN 'Tranquila' THEN 40 WHEN 'Perigosa' THEN 60 ELSE 50 END
 WHEN 'Bronze' THEN CASE difficulty WHEN 'Tranquila' THEN 60 WHEN 'Perigosa' THEN 90 ELSE 75 END
 WHEN 'Adamantium' THEN CASE difficulty WHEN 'Tranquila' THEN 80 WHEN 'Perigosa' THEN 120 ELSE 100 END
 WHEN 'Ametista' THEN CASE difficulty WHEN 'Tranquila' THEN 120 WHEN 'Perigosa' THEN 180 ELSE 150 END
 ELSE CASE difficulty WHEN 'Tranquila' THEN 160 WHEN 'Perigosa' THEN 240 ELSE 200 END END
 WHERE kind='mission' AND status IN ('open','active');
