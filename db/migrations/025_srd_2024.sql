-- Immutable pre-conversion snapshot. No player property or rolled dice are deleted.
CREATE TABLE character_sheet_legacy_snapshots (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  character_data jsonb NOT NULL,
  sheet_data jsonb,
  archived_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO character_sheet_legacy_snapshots(character_id,character_data,sheet_data)
SELECT c.id,to_jsonb(c),to_jsonb(s) FROM characters c
LEFT JOIN character_sheets s ON s.character_id=c.id;
ALTER TABLE character_sheets ADD COLUMN rules_version text NOT NULL DEFAULT '5.2.1';
ALTER TABLE character_sheets ALTER COLUMN choices DROP NOT NULL;
UPDATE character_sheets SET rules_version='5.1',choices=NULL,finalized_at=NULL,
  prepared='[]',slots_used=0 WHERE choices->>'version'='1';
ALTER TABLE characters ADD COLUMN starting_wealth_granted boolean NOT NULL DEFAULT true;
-- New characters are explicitly created with zero gold and granted their legal
-- class/background starting wealth exactly once on sheet finalization.

INSERT INTO character_sheets(character_id,choices,rules_version) SELECT c.character_id,NULL,'5.1' FROM character_sheet_legacy_snapshots c WHERE NOT EXISTS(SELECT 1 FROM character_sheets s WHERE s.character_id=c.character_id);
UPDATE world_entries SET subtitle='D&D 5.5e · SRD 5.2.1 (2024)',body='Base SRD 5.2.1. Criação de nível 1 com espécies, antecedentes, talentos, maestrias e conjuração revisada. Atributos: 4d6 descartando o menor, uma rolagem; bônus do antecedente. Subclasses no nível 3. Progressão e combate automático ainda não implementados.' WHERE id='base' AND section='rules';
UPDATE world_entries SET subtitle='Equipamento e riqueza inicial',body='Novos personagens recebem o ouro de classe e antecedente ao concluir a ficha, uma vez. Conversões preservam saldo e compras existentes. Itens iniciais ficam na ficha; compras no inventário. 1 PO = 100 PC.' WHERE id='economia' AND section='rules';
