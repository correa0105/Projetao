CREATE TABLE home_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 author_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 title varchar(140) NOT NULL,
 body text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK (kind IN ('article','meeting','image')),
 layout text NOT NULL CHECK (layout IN ('feature','landscape','portrait','compact')),
 image_path text NOT NULL DEFAULT '',
 image_side text NOT NULL CHECK (image_side IN ('left','right')),
 image_fit text NOT NULL CHECK (image_fit IN ('contain','cover')),
 link text NOT NULL DEFAULT '',
 starts_at timestamptz,
 location varchar(160) NOT NULL DEFAULT '',
 text_align text NOT NULL CHECK (text_align IN ('left','center')),
 text_size text NOT NULL CHECK (text_size IN ('normal','large')),
 position integer NOT NULL DEFAULT 0,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX home_updates_order ON home_updates(position,created_at DESC);
CREATE TABLE home_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 author_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
