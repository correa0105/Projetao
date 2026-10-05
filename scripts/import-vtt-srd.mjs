// Import only SRD 5.2 records. Do not import book illustrations or non-SRD entries.
import { mkdir, writeFile } from 'node:fs/promises';
const root = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/';
const tags = {
  atk: 'Ataque',
  atkr: 'Ataque',
  h: 'Acerto: ',
  actSave: 'Salvaguarda',
  actSaveFail: 'Falha: ',
  actSaveSuccess: 'Sucesso: ',
  actSaveSuccessOrFail: 'Sucesso ou falha: ',
  recharge: 'Recarga',
};
function text(value) {
  if (typeof value === 'string')
    return value
      .replace(/\{@(\w+)(?: ([^}]*))?\}/g, (_, tag, content = '') =>
        tags[tag] ? tags[tag] + ' ' + content.split('|')[0] : content.split('|').at(-1) || tag,
      )
      .replace(/<[^>]+>/g, '');
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  if (value && typeof value === 'object')
    return [value.name, value.entries, value.items, value.entry, value.rows]
      .filter(Boolean)
      .map(text)
      .join('\n');
  return '';
}
const catalog = {
  version: 'SRD 5.2.1 · D&D 2024',
  license: 'CC BY 4.0',
  source: 'https://www.dndbeyond.com/srd',
  monsters: [],
  spells: [],
};
for (const [kind, path] of [
  ['monster', 'bestiary/bestiary-xmm.json'],
  ['spell', 'spells/spells-xphb.json'],
]) {
  const response = await fetch(root + path);
  if (!response.ok) throw Error('Fonte indisponível: ' + path);
  const data = await response.json();
  for (const entry of data[kind].filter((e) => e.srd52)) {
    const name = typeof entry.srd52 === 'string' ? entry.srd52 : entry.name;
    const id = kind + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (kind === 'monster')
      catalog.monsters.push({
        id,
        name,
        source: 'SRD 5.2.1',
        cr: String(entry.cr?.cr ?? entry.cr ?? '0'),
        type: typeof entry.type === 'string' ? entry.type : entry.type.type,
        size: entry.size[0],
        hp: entry.hp.average || 1,
        ac: typeof entry.ac[0] === 'number' ? entry.ac[0] : entry.ac[0].ac,
        stats: [entry.str, entry.dex, entry.con, entry.int, entry.wis, entry.cha],
        speed: text(
          Object.entries(entry.speed).map(
            ([type, speed]) =>
              type + ': ' + (typeof speed === 'number' ? speed : speed.number) + ' ft',
          ),
        ),
        details: [
          text(entry.trait),
          text(entry.action),
          text(entry.bonus),
          text(entry.reaction),
          text(entry.legendary),
        ]
          .filter(Boolean)
          .join('\n\n'),
      });
    else
      catalog.spells.push({
        id,
        name,
        source: 'SRD 5.2.1',
        level: entry.level,
        school: entry.school,
        time: entry.time.map((t) => `${t.number} ${t.unit}`).join(' / '),
        range: entry.range.distance?.amount
          ? entry.range.distance.amount + ' ' + entry.range.distance.type
          : entry.range.type,
        duration: entry.duration
          .map((d) =>
            d.type === 'timed'
              ? `${d.duration.amount} ${d.duration.type}${d.concentration ? ' · concentração' : ''}`
              : d.type,
          )
          .join(' / '),
        components: Object.keys(entry.components)
          .map((k) => k.toUpperCase())
          .join(', '),
        details: [text(entry.entries), text(entry.entriesHigherLevel)].filter(Boolean).join('\n\n'),
      });
  }
}
catalog.monsters.sort((a, b) => a.name.localeCompare(b.name));
catalog.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
await mkdir('data/vtt', { recursive: true });
await writeFile('data/vtt/srd-2024.json', JSON.stringify(catalog, null, 2) + '\n');
await writeFile(
  'data/vtt/CREDITS.md',
  '# Compêndio da mesa virtual\n\nThis work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.\n\nDados estruturados das entradas marcadas srd52 no 5etools: ' +
    root +
    'bestiary/bestiary-xmm.json e ' +
    root +
    'spells/spells-xphb.json. Apenas blocos de estatística/magias do SRD; sem ilustrações, aventuras ou entradas não abertas. Interface em português; textos do compêndio mantidos em inglês.\n',
);
console.log(
  `${catalog.monsters.length} monstros e ${catalog.spells.length} magias SRD 2024 importados.`,
);
