import { mkdir, writeFile } from 'node:fs/promises';

// Deliberately allowlisted SRD equipment, not an import of published supplements.
const choices: Record<string, [string, string, string]> = {
  Longsword: [
    'Espada longa',
    'Armas',
    '1d8 cortante · Versátil (1d10). Uma arma marcial para a linha de frente.',
  ],
  Dagger: ['Adaga', 'Armas', '1d4 perfurante · Acuidade, leve e arremesso (20/60 pés).'],
  Shortbow: ['Arco curto', 'Armas', '1d6 perfurante · Duas mãos, munição e alcance de 80/320 pés.'],
  'Leather Armor': [
    'Armadura de couro',
    'Armaduras',
    'Armadura leve · CA 11 + modificador de Destreza.',
  ],
  Shield: ['Escudo', 'Armaduras', '+2 na classe de armadura quando empunhado. Ocupa uma mão.'],
  Backpack: [
    'Mochila',
    'Equipamento',
    'Leve os suprimentos da próxima jornada. Capacidade: 30 libras.',
  ],
  Torch: ['Tocha', 'Equipamento', 'Ilumina as trilhas e masmorras. Duração: 1 hora.'],
  'Hempen Rope (50 feet)': [
    'Corda de cânhamo',
    'Equipamento',
    '50 pés de corda para escaladas e travessias.',
  ],
};
const repo = '5etools-mirror-3/5etools-src';
const response = await fetch(`https://api.github.com/repos/${repo}/commits/main`);
if (!response.ok) throw new Error(`GitHub: ${response.status}`);
const { sha } = (await response.json()) as { sha: string };
const records: Record<string, unknown>[] = [];
for (const file of ['items-base.json', 'items.json']) {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/data/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catálogo: ${response.status}`);
  const data = (await response.json()) as Record<string, Record<string, unknown>[]>;
  for (const item of [...(data.baseitem || []), ...(data.item || [])]) {
    const original = String(item.name);
    if (!choices[original] || item.source !== 'PHB' || !item.srd) continue;
    if (!Number.isSafeInteger(item.value) || Number(item.value) <= 0)
      throw new Error(`Preço inválido: ${original}`);
    const [name, category, description] = choices[original];
    records.push({
      id: original
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, ''),
      name,
      original_name: original,
      category,
      description,
      price_cp: item.value,
      weight_lb: item.weight || 0,
      source: 'SRD 5.1 · 5etools (PHB)',
      source_url: `https://5e.tools/items.html#${encodeURIComponent(original.toLowerCase())}_phb`,
      raw_data: {
        name: item.name,
        source: item.source,
        srd: item.srd,
        value: item.value,
        weight: item.weight,
        type: item.type,
        dmg1: item.dmg1,
        dmg2: item.dmg2,
        ac: item.ac,
        property: item.property,
      },
    });
  }
}
if (records.length !== Object.keys(choices).length)
  throw new Error(
    `Esperados 8 itens; encontrados ${records.length}: ${records.map((r) => r.original_name).join(', ')}`,
  );
await mkdir('data', { recursive: true });
await writeFile(
  'data/catalog.json',
  JSON.stringify(
    {
      source: `https://github.com/${repo}/tree/${sha}/data`,
      imported_at: new Date().toISOString(),
      edition: 'SRD 5.1 / 2014',
      items: records,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Snapshot salvo: ${records.length} itens SRD. Execute npm run db:seed para atualizar o SQL.`,
);
