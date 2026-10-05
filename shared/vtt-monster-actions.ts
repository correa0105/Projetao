export type MonsterAction = {
  id: string;
  name: string;
  description: string;
  attack: string | null;
  damage: string[];
};
// The compendium and 5etools imports keep each action name on its own line.
// Only explicit attack bonuses and dice are used; never infer missing game rules.
export function monsterActions(details: string): MonsterAction[] {
  const lines = details.split('\n').map((s) => s.trim());
  const actions: MonsterAction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const hit =
      line.match(/\bAtaque\s+[a-zà-ÿ, ]+\s+([+-]?\d{1,3})\b/i) ||
      line.match(
        /\b(?:Melee|Ranged)(?: or Ranged)?(?: Weapon| Spell)? Attack(?: Roll)?:?\s*([+-]?\d{1,3})\b/i,
      ) ||
      line.match(/([+-]?\d{1,3})\s+to hit\b/i);
    if (!hit && !/\b(?:Salvaguarda|Saving Throw|Hit:|Acerto:|Falha:)\b/i.test(line)) continue;
    const name = lines[i - 1];
    if (!name || name.length > 150 || /[.!?:]/.test(name)) continue;
    const damage = [...line.matchAll(/\b(\d{1,3})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?\b/gi)]
      .filter(
        (m) =>
          Number(m[1]) >= 1 && Number(m[1]) <= 100 && Number(m[2]) >= 2 && Number(m[2]) <= 1000,
      )
      .map((m) => m[1] + 'd' + m[2] + (m[3] ? m[3] + m[4] : ''));
    if (!hit && !damage.length) continue;
    const bonus = hit ? Number(hit[1]) : null;
    actions.push({
      id: 'action-' + (i - 1),
      name,
      description: line,
      attack: bonus === null ? null : '1d20' + (bonus >= 0 ? '+' : '') + bonus,
      damage,
    });
  }
  return actions.slice(0, 100);
}
