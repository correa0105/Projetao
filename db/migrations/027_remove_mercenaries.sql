-- Remove somente conteúdo demonstrativo desta seção, sem afetar personagens de jogadores.
DELETE FROM world_entries WHERE section = 'mercenaries';
ALTER TABLE world_entries DROP CONSTRAINT world_entries_section_check;
ALTER TABLE world_entries ADD CONSTRAINT world_entries_section_check
  CHECK (section IN ('world','lore','rules','house'));
