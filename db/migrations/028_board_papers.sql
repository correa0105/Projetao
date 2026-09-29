ALTER TABLE board_posts
  ADD COLUMN paper_style text NOT NULL DEFAULT 'parchment'
    CHECK (paper_style IN ('parchment','letter','proclamation','vellum','chronicle','seal')),
  ADD COLUMN paper_summary varchar(180) NOT NULL DEFAULT '',
  ADD COLUMN paper_x double precision NOT NULL DEFAULT random() CHECK (paper_x >= 0 AND paper_x <= 1),
  ADD COLUMN paper_y double precision NOT NULL DEFAULT random() CHECK (paper_y >= 0 AND paper_y <= 1);

-- Spread existing real notices across the panel without changing their content.
WITH positions AS (
 SELECT id, row_number() OVER (ORDER BY created_at,id)-1 AS n FROM board_posts
)
UPDATE board_posts b SET paper_x=(p.n % 5)/4.0, paper_y=((p.n / 5) % 3)/2.0
FROM positions p WHERE p.id=b.id;
