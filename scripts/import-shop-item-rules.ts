import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { translateMonsterLines } from '../server/vtt-translate.js';
import { itemRulesGlossary, spellNamesPortuguese } from './shop-rules-glossary.js';

// Only the explicitly SRD 5.2 records are imported, from an immutable revision.
const commit = 'b9061583536101068b3a59d27e886d1fa664e366';
const root = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${commit}/data/`;
type Source = Record<string, any>;
type CatalogItem = {
  id: string;
  name: string;
  original_name: string;
  source: string;
  raw_data?: Record<string, any>;
  description: string;
};
const rawSources: Record<string, any> = {},
  sourceHashes: Record<string, string> = {};
await mkdir('test-results/item-source', { recursive: true });
for (const filename of ['items.json', 'items-base.json', 'magicvariants.json']) {
  const response = await fetch(root + filename);
  if (!response.ok) throw Error('Fonte indisponível: ' + filename);
  const raw = await response.text();
  sourceHashes[filename] = createHash('sha256').update(raw).digest('hex');
  rawSources[filename] = JSON.parse(raw);
}
const open = (entry: Source) => !!(entry.srd52 || entry.inherits?.srd52);
const sources: Source[] = [
  ...rawSources['items.json'].item.filter(open),
  ...rawSources['items.json'].itemGroup.filter(open),
  ...rawSources['items-base.json'].baseitem.filter(open),
  ...rawSources['magicvariants.json'].magicvariant.filter(open),
];
const norm = (name: string) =>
  (name || '')
    .toLowerCase()
    .replace(/\(\*\)/g, '')
    .replace(/[^a-z0-9]/g, '');
const byName = new Map<string, Source>();
for (const entry of sources) {
  const alias = entry.srd52 || entry.inherits?.srd52;
  byName.set(norm(entry.name), entry);
  if (typeof alias === 'string') byName.set(norm(alias), entry);
}
const get = (name: string) => byName.get(norm(name));
const catalogs: CatalogItem[] = [
  ...JSON.parse(await readFile('data/shop-export/loja.json', 'utf8')).items,
  ...JSON.parse(await readFile('data/equipment-catalog.json', 'utf8')).filter(
    (item: any) => item.active,
  ),
  ...JSON.parse(await readFile('data/emporium-expansion.json', 'utf8')).items,
];
const catalogById = new Map(catalogs.map((item) => [item.id, item]));
const aliases: Record<string, string> = {
  'glass-bottle': 'Glass Bottle',
  'hooded-lantern': 'Hooded Lantern',
  'gaming-dice': 'Dice Set',
  'dragonchess-set': 'Dragonchess Set',
  'playing-card-set': 'Playing Cards',
  'three-dragon-ante-set': 'Three-Dragon Ante Set',
  'arrows-20': 'Arrows (20)',
  'bolts-20': 'Bolts (20)',
  'firearm-bullets-10': 'Firearm Bullets (10)',
  'sling-bullets-20': 'Sling Bullets (20)',
  'blowgun-needles-50': 'Needles (50)',
  'arcane-focus-crystal': 'Crystal',
  'arcane-focus-orb': 'Orb',
  'arcane-focus-rod': 'Rod',
  'arcane-focus-staff': 'Staff',
  'arcane-focus-wand': 'Wand',
  'druidic-focus-staff': 'Wooden Staff',
  'holy-symbol-amulet': 'Amulet',
  'holy-symbol-emblem': 'Emblem',
  'holy-symbol-reliquary': 'Reliquary',
  'crossbow-bolt-case': 'Crossbow Bolt Case',
  'map-scroll-case': 'Map or Scroll Case',
  'bullseye-lantern': 'Bullseye Lantern',
  'basic-poison': 'Basic Poison',
  'iron-pot': 'Iron Pot',
  'portable-ram': 'Portable Ram',
  'iron-spikes-10': 'Iron Spikes',
  'wine-common': 'Common Wine (bottle)',
  'wine-fine': 'Fine Wine (bottle)',
  'spell-scroll-level-1': 'Spell Scroll (Level 1)',
};
const damagePT: Record<string, string> = {
  acid: 'ácido',
  cold: 'frio',
  fire: 'fogo',
  force: 'força',
  lightning: 'elétrico',
  necrotic: 'necrótico',
  poison: 'veneno',
  psychic: 'psíquico',
  radiant: 'radiante',
  thunder: 'trovejante',
  bludgeoning: 'contundente',
  piercing: 'perfurante',
  slashing: 'cortante',
};
const upper = (s: string) => s[0].toUpperCase() + s.slice(1);
const defaultVariant: Record<string, string> = {
  'Bag of Tricks': 'gray',
  'Dragon Scale Mail': 'bronze',
  'Carpet of Flying': '3x5',
  'Elemental Gem': 'air',
  'Feather Token': 'anchor',
  'Figurine of Wondrous Power': 'bronze-griffon',
  'Horn of Valhalla': 'silver',
  'Ioun Stone': 'awareness',
  'Manual of Golems': 'clay',
  'Ring of Elemental Command': 'air',
  'Ring of Resistance': 'acid',
  'Potion of Resistance': 'acid',
};
function match(item: CatalogItem): Source | undefined {
  const r = item.raw_data || {},
    f = r.magic_family,
    v = /^[a-z0-9-]+$/.test(r.variant || '') ? r.variant : defaultVariant[f];
  if (r.enhancement && /^(Ammunition|Armor|Shield|Weapon),/.test(f || ''))
    return get(`+${r.enhancement} ${f.split(',')[0]}`);
  if ((f || '').startsWith('Wand of the War Mage,'))
    return get(`+${r.enhancement || Number(String(v || '').at(-1)) || 1} Wand of the War Mage`);
  if (f === 'Potions of Healing') return get(`Potion of ${upper(v)} Healing`);
  if (['Belt of Giant Strength', 'Potion of Giant Strength'].includes(f)) {
    const giant = (
      { 21: 'Hill', 23: 'Frost', 25: 'Fire', 27: 'Cloud', 29: 'Storm' } as Record<number, string>
    )[r.strength];
    return get(`${f.split(' of ')[0]} of ${giant} Giant Strength`);
  }
  if (f && r.damage_type && /Resistance$/.test(f))
    return get(f.replace('Resistance', upper(r.damage_type) + ' Resistance'));
  if (f === 'Armor of Vulnerability') return get(`${f} (${upper(r.damage_type || 'bludgeoning')})`);
  if (f === 'Dragon Scale Mail') return get(`${upper(v)} Dragon Scale Mail`);
  if (f === 'Bag of Tricks') return get(`${f}, ${upper(v)}`);
  if (f === 'Carpet of Flying') return get(`${f}, ${(v || '3x5').replace('x', ' ft. × ')} ft.`);
  if (f === 'Elemental Gem')
    return get(
      `${f}, ${({ air: 'Blue Sapphire', water: 'Emerald', fire: 'Red Corundum', earth: 'Yellow Diamond' } as Record<string, string>)[v]}`,
    );
  if (f === 'Feather Token') return get(`${f}, ${v.split('-').map(upper).join(' ')}`);
  if (f === 'Figurine of Wondrous Power') return get(`${f}, ${v.split('-').map(upper).join(' ')}`);
  if (f === 'Horn of Valhalla' || f === 'Ioun Stone')
    return get(`${f}, ${v.split('-').map(upper).join(' ')}`);
  if (f === 'Manual of Golems') return get(`Manual of ${upper(v)} Golems`);
  if (f === 'Ring of Elemental Command') return get(`${f} (${upper(v)})`);
  if (f === 'Spell Scroll') return get(`Spell Scroll (Level ${String(v).split('-')[1]})`);
  if (f === 'Stone of Good Luck (Luckstone)') return get('Stone of Good Luck');
  if (item.id.startsWith('barding-'))
    return get(
      catalogById.get(item.id.slice(8))?.original_name ||
        item.original_name.replace(/ Barding$/, ''),
    );
  return get(aliases[item.id] || f || item.original_name);
}
// Lossless plain-text rendering, including headings, table labels, rows and cells.
function text(value: any): string {
  if (typeof value === 'string')
    return value
      .replace(/\{@(\w+)(?: ([^}]*))?\}/g, (_, tag, content = '') =>
        tag === 'dc'
          ? 'DC ' + content.split('|')[0]
          : tag === 'hit'
            ? (content.startsWith('-') || content.startsWith('+') ? '' : '+') +
              content.split('|')[0]
            : tag === 'spell'
              ? 'Spell ' + content.split('|')[0]
              : content.split('|')[2] || content.split('|')[0],
      )
      .replace(/<[^>]*>/g, '');
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return '';
  if (value.type === 'table')
    return [
      value.caption,
      text(value.colLabels),
      ...(value.rows || []).map((row: any[]) => row.map(text).join(' · ')),
    ]
      .filter(Boolean)
      .join('\n');
  return [
    value.name,
    value.entries,
    value.items,
    value.entry,
    value.rows,
    value.preNote,
    value.footnotes,
  ]
    .map(text)
    .filter(Boolean)
    .join('\n');
}
function expandedEntries(source: Source): string {
  let result = text(source.entries);
  result = result.replace(/\{#itemEntry ([^}]+)\}/g, (_, ref: string) => {
    const [name, sourceId = source.source] = ref.split('|');
    // These templates are used only inside a parent explicitly licensed srd52.
    const entry = rawSources['items-base.json'].itemEntry.find(
      (e: Source) => e.name === name && e.source === sourceId,
    );
    if (!entry) throw Error('Referência SRD não resolvida: ' + ref);
    return text(entry.entriesTemplate)
      .replace(/\{\{getFullImmRes item\.(\w+)\}\}/g, (_, field) =>
        (source[field] || []).join(' or '),
      )
      .replace(/\{\{item\.(\w+)\}\}/g, (_, field) => String(source[field] ?? ''));
  });
  return result.replace(/\{=(\w+)\}/g, (_, field) => String(source[field] ?? ''));
}
const damageCode: Record<string, string> = {
  B: 'contundente',
  P: 'perfurante',
  S: 'cortante',
  A: 'ácido',
  C: 'frio',
  F: 'fogo',
  O: 'força',
  L: 'elétrico',
  N: 'necrótico',
  I: 'psíquico',
  R: 'radiante',
  T: 'trovejante',
  Y: 'veneno',
};
const properties: Record<string, string> = {
  '2H': 'Duas mãos',
  A: 'Munição',
  F: 'Acuidade',
  H: 'Pesada',
  L: 'Leve',
  LD: 'Recarga',
  R: 'Alcance',
  T: 'Arremesso',
  V: 'Versátil',
};
const masteryNames: Record<string, string> = {
  Cleave: 'Fender',
  Graze: 'Raspar',
  Nick: 'Entalhar',
  Push: 'Empurrar',
  Sap: 'Enfraquecer',
  Slow: 'Lentidão',
  Topple: 'Derrubar',
  Vex: 'Provocar',
};
function basicStats(source: Source): string {
  const s = source.inherits ? { ...source, ...source.inherits } : source,
    out: string[] = [];
  if (s.dmg1) out.push(`Dano: ${s.dmg1} ${damageCode[s.dmgType] || s.dmgType}.`);
  if (s.dmg2) out.push(`Dano com duas mãos (Versátil): ${s.dmg2}.`);
  if (s.range) out.push(`Alcance normal/máximo: ${s.range} pés.`);
  const propertyList = Array.isArray(s.property)
    ? s.property.filter((p: unknown) => typeof p === 'string')
    : [];
  if (propertyList.length)
    out.push(
      `Propriedades: ${propertyList.map((p: string) => properties[p.split('|')[0]] || p.split('|')[0]).join(', ')}.`,
    );
  if (s.ac !== undefined)
    out.push(
      s.type?.startsWith('S|')
        ? `Escudo: +${s.ac} à CA enquanto empunhado.`
        : `CA: ${s.ac}${s.type?.startsWith('LA|') ? ' + modificador de Destreza' : s.type?.startsWith('MA|') ? ' + modificador de Destreza (máximo +2)' : ''}.`,
    );
  if (s.strength) out.push(`Força mínima: ${s.strength}.`);
  if (s.stealth) out.push('Impõe desvantagem nos testes de Destreza (Furtividade).');
  if (s.reqAttune) {
    const classes: Record<string, string> = {
      spellcaster: 'um conjurador',
      wizard: 'um mago',
      cleric: 'um clérigo',
      druid: 'um druida',
      paladin: 'um paladino',
      sorcerer: 'um feiticeiro',
      warlock: 'um bruxo',
      bard: 'um bardo',
    };
    const restriction =
      typeof s.reqAttune !== 'string'
        ? ''
        : s.reqAttune.includes('Dwarf')
          ? 'por um anão ou por uma criatura sintonizada com um Cinto dos Anões'
          : 'por ' +
            s.reqAttune
              .replace(/^by a /, '')
              .replace(/, or /, ', ou ')
              .replace(/ or /, ' ou ')
              .replace(
                /\b(?:spellcaster|wizard|cleric|druid|paladin|sorcerer|warlock|bard)\b/g,
                (word: string) => classes[word],
              );
    out.push('Requer sintonia' + (restriction ? ' ' + restriction : '') + '.');
  }
  if (!s.entries?.length && !out.length)
    out.push(
      s.type?.startsWith('FD|')
        ? 'Alimento ou bebida para consumo; não concede efeitos mágicos.'
        : `Equipamento mundano: ${catalogs.find((item) => norm(item.original_name) === norm(s.name))?.name || s.name}. Não possui efeito mágico próprio.`,
    );
  return out.join('\n');
}
type RecordData = {
  name: string;
  source: string;
  english: string;
  portuguese: string;
  reference_url: string;
  stats: string;
  srd52: boolean;
};
const records: Record<string, RecordData> = {},
  items: Record<
    string,
    {
      keys: string[];
      reference_key: string;
      variant: string;
      reference_url?: string;
      stats_overrides?: Record<string, string>;
    }
  > = {};
function register(source: Source): string {
  const s = source.inherits ? { ...source, ...source.inherits } : source;
  const key = `${s.source}:${source.name}`;
  if (!records[key]) {
    if (!open(source)) throw Error('Entrada sem licença SRD 5.2: ' + key);
    const english = expandedEntries(s);
    records[key] = {
      name: source.name,
      source: s.source,
      english,
      portuguese: '',
      reference_url: `https://5e.tools/items.html#${encodeURIComponent(source.name.toLowerCase())}_${s.source.toLowerCase()}`,
      stats: basicStats(source),
      srd52: true,
    };
  }
  return key;
}
const missing: string[] = [];
for (const item of catalogs.filter((item) => item.source === 'SRD 5.2.1')) {
  if (item.id.startsWith('meal-')) {
    const key = 'SRD52:Meals';
    records[key] = {
      name: 'Meals',
      source: 'SRD52',
      english: '',
      portuguese:
        'Uma refeição é comida pronta para consumo. O padrão de vida determina a qualidade e o preço; ela não é uma poção e não concede bônus de combate ou cura automática.',
      stats: '',
      reference_url:
        'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=100',
      srd52: true,
    };
    items[item.id] = { keys: [key], reference_key: key, variant: '' };
    continue;
  }
  const source = match(item);
  if (!source) {
    missing.push(item.id + ': ' + (item.raw_data?.magic_family || item.original_name));
    continue;
  }
  const keys = [register(source)],
    primary = keys[0],
    r = item.raw_data || {};
  const base = r.base_item && catalogById.get(r.base_item);
  const baseSource = base && get(aliases[base.id] || base.original_name);
  if (baseSource && baseSource !== source) keys.push(register(baseSource));
  const weapon = baseSource || source;
  for (const mastery of weapon.mastery || []) {
    const name = mastery.split('|')[0],
      definition = rawSources['items-base.json'].itemMastery.find(
        (m: Source) => m.srd52 && m.name === name,
      );
    if (definition)
      keys.push(register({ ...definition, name: `Maestria: ${masteryNames[name] || name}` }));
  }
  let variant = '';
  if (r.damage_type)
    variant = `Tipo de dano desta variante: ${damagePT[r.damage_type] || r.damage_type}.`;
  if (r.enhancement) variant += `\nBônus desta variante: +${r.enhancement}.`;
  if (r.strength) variant += `\nForça concedida por esta variante: ${r.strength}.`;
  if (item.id.startsWith('barding-'))
    variant +=
      '\nBarda ajustada à anatomia da montaria: custa quatro vezes e pesa duas vezes a armadura humanoide equivalente. No aplicativo, equipar não altera a CA automaticamente.';
  if (r.pack_quantity)
    variant += `\nQuantidade de munição desta oferta: ${r.pack_quantity} unidades.`;
  const inherited = source.inherits;
  const generatedName =
    inherited && baseSource
      ? `${inherited.namePrefix || ''}${baseSource.name}${inherited.nameSuffix || ''}`
      : '';
  items[item.id] = {
    keys: [...new Set(keys)],
    reference_key: primary,
    variant: variant.trim(),
    ...(generatedName
      ? {
          reference_url: `https://5e.tools/items.html#${encodeURIComponent(generatedName.toLowerCase())}_${inherited.source.toLowerCase()}`,
        }
      : {}),
    ...(r.magic_family === 'Energy Bow' && baseSource
      ? {
          stats_overrides: {
            [register(baseSource)]: basicStats(baseSource).replace('perfurante', 'de força'),
          },
        }
      : {}),
  };
}
if (missing.length) throw Error('SRD sem correspondência:\n' + missing.join('\n'));
console.log(
  `${Object.keys(items).length} itens SRD mapeados em ${Object.keys(records).length} textos únicos.`,
);
const cachePath = 'test-results/shop-rules-translations-v3.json';
let cache: Record<string, string> = {};
try {
  cache = JSON.parse(await readFile(cachePath, 'utf8'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const reviewed: Record<string, string> = JSON.parse(
  await readFile('data/shop-item-rules-reviewed.json', 'utf8'),
);
const glossary = { ...itemRulesGlossary };
for (const [english, portuguese] of Object.entries(spellNamesPortuguese))
  glossary['Spell ' + english] = portuguese;
for (const item of catalogs) {
  if (item.original_name && item.source === 'SRD 5.2.1')
    glossary[item.original_name] ||= /\d/.test(item.original_name)
      ? item.name
      : item.name.replace(/\s*\([^)]*\d[^)]*\)/g, '').trim();
}
// Reuse the existing guarded translator, through a local proxy to Docker's
// internal LibreTranslate. No API key, public service or host port exposure.
const python =
  "import sys,json,urllib.request; d=sys.stdin.buffer.read(); r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:5000/translate',data=d,headers={'Content-Type':'application/json'}),timeout=600); sys.stdout.buffer.write(r.read())";
const proxy = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      process.env.SHOP_TRANSLATOR_CONTAINER || 'alvorada-cinzenta-translator-1',
      'python',
      '-c',
      python,
    ],
    { windowsHide: true },
  );
  let output = '',
    error = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (error += b));
  child.stdin.end(Buffer.concat(chunks));
  child.on('error', () => {
    res.writeHead(503);
    res.end('{}');
  });
  child.on('exit', (code) => {
    res.writeHead(code === 0 ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(code === 0 ? output : '{}');
    if (code) console.error('Tradutor Docker falhou:', error.slice(0, 300));
  });
});
await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const address = proxy.address();
if (!address || typeof address === 'string') throw Error('Proxy local indisponível');
process.env.VTT_TRANSLATOR_URL = `http://127.0.0.1:${address.port}`;
try {
  let done = 0;
  for (const record of Object.values(records)) {
    if (!record.english) {
      record.portuguese ||= '';
      continue;
    }
    const key = createHash('sha256')
      .update(JSON.stringify(glossary) + '\n' + record.english)
      .digest('hex');
    if (reviewed[`${record.source}:${record.name}`])
      cache[key] = reviewed[`${record.source}:${record.name}`];
    if (!cache[key]) {
      cache[key] = (await translateMonsterLines([record.english], glossary))[0]
        .replace(/\bDC\s*(\d+)/g, 'CD $1')
        .replace(/\bAC\b/g, 'CA');
      await writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');
    }
    record.portuguese = cache[key]
      .replace(/\\n/g, '\n')
      .replace(/\bHP\b/g, 'PV')
      .replace(/\bDM\b/g, 'Mestre')
      .replace(/\bSpellcasting Focus\b/gi, 'foco de conjuração')
      .replace(/\bSpellcasting\b/gi, 'conjuração')
      .replace(
        /\b(?:GP|SP|CP|EP|PP)\b/g,
        (currency) => ({ GP: 'PO', SP: 'PP', CP: 'PC', EP: 'PE', PP: 'PL' })[currency]!,
      );
    if (++done % 10 === 0)
      console.log(`Tradução: ${done}/${Object.values(records).filter((r) => r.english).length}`);
  }
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');
} finally {
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
}
const data = {
  schema_version: 1,
  edition: 'SRD 5.2.1 · D&D 2024',
  license: 'CC BY 4.0',
  attribution:
    'This work includes material from the System Reference Document 5.2.1 by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. Licensed under Creative Commons Attribution 4.0, https://creativecommons.org/licenses/by/4.0/legalcode. Portuguese translation by the project.',
  upstream_commit: commit,
  upstream_sha256: sourceHashes,
  records,
  items,
};
await writeFile('data/shop-item-rules.json', JSON.stringify(data, null, 2) + '\n');
console.log(
  `Regras completas salvas: ${Object.keys(items).length} itens, ${Object.keys(records).length} entradas deduplicadas.`,
);
