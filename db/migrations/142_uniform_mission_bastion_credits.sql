UPDATE board_posts AS mission
SET bastion_credits = reward.credits
FROM (VALUES ('Tranquila', 40), ('Moderada', 50), ('Perigosa', 60)) AS reward(difficulty, credits)
WHERE mission.kind = 'mission'
  AND mission.deleted_at IS NULL
  AND mission.status IN ('open', 'active')
  AND mission.difficulty = reward.difficulty
  AND mission.bastion_credits <> reward.credits;
