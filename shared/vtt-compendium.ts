const tags: Record<string, string> = {
  h: 'Acerto:',
  actSave: 'Salvaguarda',
  actSaveFail: 'Falha:',
  actSaveSuccess: 'Sucesso:',
  actSaveSuccessOrFail: 'Sucesso ou falha:',
  recharge: 'Recarga',
};
export function compendiumText(value: unknown): string {
  if (typeof value === 'string')
    return value
      .replace(/\{@(\w+)(?: ([^}]*))?\}/g, (_, tag: string, content = '') => {
        const parts = content.split('|');
        if (tag === 'atk' || tag === 'atkr') {
          const modes =
            content.includes('m') && content.includes('r')
              ? 'corpo a corpo ou a distância'
              : content.includes('r')
                ? 'a distância'
                : 'corpo a corpo';
          return 'Ataque ' + modes;
        }
        if (tag === 'hit') return /^[0-9]+$/.test(parts[0]) ? '+' + parts[0] : parts[0];
        if (tag === 'h') return 'Acerto: ';
        return tags[tag] ? `${tags[tag]} ${parts[0]}`.trim() : parts[2] || parts[0] || tag;
      })
      .replace(/<[^>]+>/g, '');
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(compendiumText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return [
      o.name,
      o.entries,
      o.items,
      o.entry,
      o.rows,
      o.preNote,
      o.resist,
      o.immune,
      o.vulnerable,
      o.conditionImmune,
      o.special,
      o.note,
    ]
      .filter(Boolean)
      .map(compendiumText)
      .join('\n');
  }
  return '';
}
export const monsterSectionFields = [
  ['trait', 'Características'],
  ['action', 'Ações'],
  ['bonus', 'Ações bônus'],
  ['reaction', 'Reações'],
  ['legendary', 'Ações lendárias'],
  ['lair', 'Ações de covil'],
] as const;
export function monsterDetails(raw: Record<string, unknown>) {
  return monsterSectionFields
    .map(([key, title]) => {
      const text = compendiumText(raw[key]);
      return text ? `### ${title}\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
export type MonsterBlock = { name: string; paragraphs: string[] };
export type MonsterSection = { title: string; blocks: MonsterBlock[] };
/** Explicit headings for new imports; conservative, lossless grouping for saved
 * plain-text sheets. All paragraphs stay visible, including action continuations. */
export function monsterSections(details: string): MonsterSection[] {
  const sections: MonsterSection[] = [];
  let section: MonsterSection | undefined, block: MonsterBlock | undefined;
  const explicit = /^### /m.test(details);
  for (const [groupIndex, group] of details.split(/\n\s*\n/).entries()) {
    if (!explicit) {
      section = {
        title:
          groupIndex === 0
            ? 'Características e ações'
            : groupIndex === 1
              ? 'Ações'
              : 'Outras ações',
        blocks: [],
      };
      sections.push(section);
      block = undefined;
    }
    for (const raw of group.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('### ')) {
        section = { title: line.slice(4), blocks: [] };
        sections.push(section);
        block = undefined;
        continue;
      }
      if (!section) {
        section = { title: 'Características e ações', blocks: [] };
        sections.push(section);
      }
      if (line.length <= 150 && !/[.!?:]/.test(line)) {
        block = { name: line, paragraphs: [] };
        section.blocks.push(block);
      } else {
        if (!block) {
          block = { name: '', paragraphs: [] };
          section.blocks.push(block);
        }
        block.paragraphs.push(line);
      }
    }
  }
  return sections.filter((s) => s.blocks.length > 0);
}
