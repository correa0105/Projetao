-- Administrative level grants imply the progression minimum, without fabricating
-- completed missions, gold, reward ledger entries or rank-test records.
WITH granted AS (
  SELECT s.character_id,MAX((r->>'characterLevel')::int) AS level
  FROM character_sheets s
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.choices->'advancement'->'levels')='array' THEN s.choices->'advancement'->'levels' ELSE '[]'::jsonb END) r
  WHERE r->>'granted'='true' AND r->>'characterLevel' ~ '^[0-9]{1,2}$'
  GROUP BY s.character_id
), credits AS (
  SELECT character_id,('[0,2,6,14,22,30,38,46,53,60,67,74,80,86,92,98,102,106,110,114]'::jsonb->>GREATEST(0,LEAST(19,level-1)))::int AS minimum
  FROM granted WHERE level BETWEEN 1 AND 20
)
UPDATE characters c SET progression_missions=GREATEST(c.progression_missions,g.minimum)
FROM credits g WHERE c.id=g.character_id AND c.progression_missions<g.minimum;
