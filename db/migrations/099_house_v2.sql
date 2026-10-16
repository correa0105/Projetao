-- Experimental neighborhood housing. All money is test credit, independent of character gold.
CREATE TABLE house2_neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
  terrain text NOT NULL CHECK(terrain IN ('earth','grass','stone')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE house2_accounts (
  user_id text PRIMARY KEY REFERENCES "user"(id),
  balance integer NOT NULL DEFAULT 20000 CHECK(balance>=0)
);
CREATE TABLE house2_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id uuid NOT NULL REFERENCES house2_neighborhoods(id),
  number integer NOT NULL CHECK(number BETWEEN 1 AND 36),
  x integer NOT NULL CHECK(x>=0), y integer NOT NULL CHECK(y>=0),
  width integer NOT NULL DEFAULT 12 CHECK(width=12),
  height integer NOT NULL DEFAULT 12 CHECK(height=12),
  price integer NOT NULL DEFAULT 1200 CHECK(price>0),
  character_id uuid REFERENCES characters(id),
  house_id text, house_x double precision, house_y double precision,
  house_rotation integer NOT NULL DEFAULT 0 CHECK(house_rotation IN (0,90,180,270)),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  purchased_at timestamptz,
  UNIQUE(neighborhood_id,number), CHECK(x+width<=100 AND y+height<=100),
  CHECK((house_id IS NULL AND house_x IS NULL AND house_y IS NULL) OR
    (house_id IS NOT NULL AND character_id IS NOT NULL AND house_x IS NOT NULL AND house_y IS NOT NULL))
);
CREATE INDEX house2_plots_character ON house2_plots(character_id);
CREATE TABLE house2_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id),
  catalog_id text NOT NULL,
  plot_id uuid REFERENCES house2_plots(id),
  x double precision, y double precision,
  rotation integer NOT NULL DEFAULT 0 CHECK(rotation IN (0,90,180,270)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((plot_id IS NULL AND x IS NULL AND y IS NULL) OR
    (plot_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL))
);
CREATE INDEX house2_items_owner ON house2_items(user_id);
CREATE INDEX house2_items_plot ON house2_items(plot_id);
CREATE TABLE house2_orders (
  user_id text NOT NULL REFERENCES "user"(id),
  idempotency_key uuid NOT NULL,
  fingerprint text NOT NULL,
  amount integer NOT NULL CHECK(amount>0),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,idempotency_key)
);
INSERT INTO house2_neighborhoods(name,description,terrain) VALUES
 ('Vigília · Bairro da Lareira','Ruas de pedra e lotes acolhedores aos pés da cidade.','earth'),
 ('Vigília · Bosque das Lanternas','Um bairro tranquilo entre caminhos e gramados.','grass'),
 ('Vigília · Pátio dos Viajantes','Uma vizinhança de pedra para quem sempre tem uma história para contar.','stone');
INSERT INTO house2_plots(neighborhood_id,number,x,y)
 SELECT n.id,r*6+c+1,3+c*16,3+r*16
 FROM house2_neighborhoods n CROSS JOIN generate_series(0,5) r CROSS JOIN generate_series(0,5) c;
