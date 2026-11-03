export function rejectLegacyEquipmentCoating() {
  throw new Error('Geração por sobreposição de texturas desativada. Criar arte temática nativa de cada item/peça com imagegen e importar pelo scripts/import-themed-equipment-art.mjs. Guia: docs/THEMATIC-EQUIPMENT-ART.md. As artes antigas permanecem preservadas.');
}
