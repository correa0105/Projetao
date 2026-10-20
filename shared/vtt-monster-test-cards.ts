export const monsterTestCards = [
  { id: 'giant-spider', sourceId: 'monster-giant-spider', name: 'Aranha gigante' },
  { id: 'goblin-warrior', sourceId: 'monster-goblin-warrior', name: 'Goblin guerreiro' },
  { id: 'owlbear', sourceId: 'monster-owlbear', name: 'Urso-coruja' },
  { id: 'mimic', sourceId: 'monster-mimic', name: 'Mímico' },
] as const;
const folder = '/vtt/monsters/bonus-test-20261019/';
export function monsterTestArt(image?: string) {
  const card = monsterTestCards.find(c => image === folder + c.id + '-token.webp' || image === folder + c.id + '-body.webp');
  return card ? { ...card, body: folder + card.id + '-body.webp', token: folder + card.id + '-token.webp' } : null;
}
/** Additive visual copies; original entries and every rule field remain untouched. */
export function appendMonsterTestCards<T extends {id: string; name: string; image?: string}>(monsters: T[]): T[] {
  const bonuses = monsterTestCards.flatMap(card => {
    const base = monsters.find(m => m.id === card.sourceId);
    const id = 'bonus-test-' + card.sourceId;
    return base && !monsters.some(m => m.id === id)
      ? [{...base, id, name: card.name + ' · Bônus de teste', image: folder + card.id + '-token.webp'}]
      : [];
  });
  return [...monsters, ...bonuses];
}
