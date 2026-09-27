ALTER TABLE achievements DROP CONSTRAINT achievements_code_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_code_check CHECK (code IN (
  'first_character','first_purchase','first_mission',
  'north_veteran','first_story','shop_patron','north_renown'
));
