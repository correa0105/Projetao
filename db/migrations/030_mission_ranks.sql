ALTER TABLE board_posts ADD COLUMN mission_rank text NOT NULL DEFAULT 'Ferro'
  CHECK (mission_rank IN ('Ferro','Bronze','Adamantium','Ametista','Obsidiana'));
-- Testes pertencem à patente de origem; histórico de pagamentos não é reescrito.
UPDATE board_posts SET mission_rank=CASE rank_test_level
  WHEN 8 THEN 'Bronze' WHEN 12 THEN 'Adamantium' WHEN 16 THEN 'Ametista' ELSE 'Ferro' END;
ALTER TABLE board_posts ADD CONSTRAINT rank_test_matches_mission_rank CHECK (
  rank_test_level IS NULL OR mission_rank=CASE rank_test_level
    WHEN 4 THEN 'Ferro' WHEN 8 THEN 'Bronze' WHEN 12 THEN 'Adamantium' WHEN 16 THEN 'Ametista' END
);
UPDATE board_posts SET reward_cp=CASE mission_rank
  WHEN 'Ferro' THEN 15000 WHEN 'Bronze' THEN 23000 WHEN 'Adamantium' THEN 30000
  WHEN 'Ametista' THEN 39000 WHEN 'Obsidiana' THEN 50000 END
WHERE kind='mission' AND status IN ('open','active');
