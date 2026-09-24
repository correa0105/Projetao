-- A sixth explorable location in the existing Reino do Norte.
-- Missions created here still use board_posts and the normal location_id flow.
INSERT INTO world_locations (id,region_id,name,description,map_x,map_y)
VALUES (
  'floresta-negra',
  'reino-do-norte',
  'Floresta Negra',
  'Uma mata antiga e sombria, onde um círculo de pedras marca trilhas quase esquecidas.',
  0.21,
  0.79
)
ON CONFLICT (id) DO NOTHING;
