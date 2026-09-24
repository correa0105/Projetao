-- World geography is shared by the atlas and the existing guild board.
CREATE TABLE world_regions (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  available boolean NOT NULL DEFAULT false
);

CREATE TABLE world_locations (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES world_regions(id),
  name text NOT NULL,
  description text NOT NULL,
  map_x double precision NOT NULL CHECK (map_x BETWEEN 0 AND 1),
  map_y double precision NOT NULL CHECK (map_y BETWEEN 0 AND 1),
  UNIQUE (id, region_id),
  UNIQUE (region_id, name)
);

INSERT INTO world_regions(id,name,description,available) VALUES
  ('reino-do-norte','Reino do Norte','Fortalezas de pedra, caminhos antigos e bosques de névoa. Vigília abriga a guilda Alvorada Cinzenta.',true),
  ('northundria','Northundria','Além do mar, montanhas guardam caminhos ainda não cartografados. Esta região será explorada em uma próxima etapa.',false),
  ('pomar-branco','Pomar Branco','Vales claros e antigas terras de cultivo além das rotas conhecidas. Esta região será explorada em uma próxima etapa.',false);

INSERT INTO world_locations(id,region_id,name,description,map_x,map_y) VALUES
  ('vigilia','reino-do-norte','Vigília','Ao redor do Bastião da Alvorada, a cidade reúne viajantes, artesãos e os aventureiros da guilda.',0.46,0.52),
  ('passo-da-geada','reino-do-norte','Passo da Geada','Uma passagem entre montanhas, marcada por uma torre de vigia e pelo antigo observatório.',0.30,0.24),
  ('estrada-do-ferro','reino-do-norte','Estrada do Ferro','A rota das caravanas atravessa pontes, campos e desfiladeiros a caminho de Vigília.',0.57,0.70),
  ('porto-das-brumas','reino-do-norte','Porto das Brumas','Casas de pedra e embarcações se abrigam na enseada onde o rio encontra o mar.',0.76,0.56),
  ('bosque-dos-sussurros','reino-do-norte','Bosque dos Sussurros','Trilhas estreitas cruzam árvores antigas, ruínas cobertas de musgo e clareiras silenciosas.',0.25,0.63);

ALTER TABLE board_posts
  ADD COLUMN region_id text REFERENCES world_regions(id),
  ADD COLUMN location_id text,
  ADD CONSTRAINT board_posts_location_region_fk
    FOREIGN KEY (location_id,region_id) REFERENCES world_locations(id,region_id),
  ADD CONSTRAINT board_posts_location_requires_region
    CHECK (location_id IS NULL OR region_id IS NOT NULL);

CREATE INDEX board_posts_region_created_idx ON board_posts(region_id,created_at DESC)
  WHERE region_id IS NOT NULL;
CREATE INDEX board_posts_location_created_idx ON board_posts(location_id,created_at DESC)
  WHERE location_id IS NOT NULL;

-- Link only exact known place names. Preserve player prose and all other records.
UPDATE board_posts b SET region_id=l.region_id,location_id=l.id
FROM world_locations l
WHERE l.id IN ('vigilia','passo-da-geada','estrada-do-ferro','bosque-dos-sussurros')
  AND (b.location=l.name OR (l.id='vigilia' AND b.location='Bastião da Alvorada'));
