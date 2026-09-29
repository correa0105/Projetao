ALTER TABLE characters ADD COLUMN progression_missions integer NOT NULL DEFAULT 0
  CHECK (progression_missions BETWEEN 0 AND 114);
ALTER TABLE board_posts ADD COLUMN rank_test_level smallint
  CHECK (rank_test_level IN (4,8,12,16)),
  ADD CONSTRAINT rank_test_is_mission CHECK (rank_test_level IS NULL OR kind='mission');
ALTER TABLE mission_rewards
  ADD COLUMN gold_cp integer NOT NULL DEFAULT 0 CHECK (gold_cp >= 0),
  ADD COLUMN progression_credit smallint CHECK (progression_credit IN (0,1)),
  ADD COLUMN level_before smallint CHECK (level_before BETWEEN 1 AND 20),
  ADD COLUMN level_after smallint CHECK (level_after BETWEEN 1 AND 20),
  ADD COLUMN rank_promoted boolean NOT NULL DEFAULT false;

-- Preserva patentes existentes; histórico não concede uma promoção sem teste.
WITH thresholds AS (
  SELECT ARRAY[0,2,6,14,22,30,38,46,53,60,67,74,80,86,92,98,102,106,110,114] AS counts
)
UPDATE characters c SET progression_missions = LEAST(
  counts[LEAST(20,((c.level-1)/4+1)*4+1)],
  GREATEST(counts[c.level], (SELECT count(*) FROM mission_rewards r WHERE r.character_id=c.id))
) FROM thresholds;
WITH thresholds AS (
  SELECT row_number() OVER () AS level, value FROM unnest(ARRAY[0,2,6,14,22,30,38,46,53,60,67,74,80,86,92,98,102,106,110,114]) AS value
)
UPDATE characters c SET level = GREATEST(c.level, (
  SELECT max(t.level) FROM thresholds t
  WHERE t.value <= c.progression_missions AND t.level <= ((c.level-1)/4+1)*4
));

UPDATE world_entries SET body='Missões exigem data e hora. Somente o autor inicia e conclui, com resumo e gancho opcional. Cada inscrito recebe o ouro anunciado e a progressão é calculada automaticamente. Patentes: Ferro, Bronze, Adamantium, Ametista e Obsidiana. Testes liberados com nível 4/22 missões, 8/53, 12/80 e 16/102. Até esses totais missões normais continuam contando; depois concedem apenas ouro até concluir o teste. O teste promove sem somar à contagem. Só a staff publica eventos. O histórico é preservado.' WHERE id='aventuras';
UPDATE world_entries SET body=replace(body,'progressão de níveis e resolução automática de combate não estão implementadas.','níveis e patentes evoluem por missões, mas recursos completos de classe nos níveis superiores e combate automático ainda não estão implementados.') WHERE id='base';
