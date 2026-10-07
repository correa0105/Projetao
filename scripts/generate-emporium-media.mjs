import fs from 'node:fs';
import { createHash } from 'node:crypto';
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
if (only && !/^[a-z0-9-]+$/.test(only)) throw Error('Invalid sound identity');
const expansion = JSON.parse(fs.readFileSync('data/emporium-expansion.json', 'utf8')).items;
const old = JSON.parse(fs.readFileSync('data/shop-export/loja.json', 'utf8')).items;
const equipment = JSON.parse(fs.readFileSync('data/equipment-catalog.json', 'utf8')).filter(
  (x) => x.active,
);
const source = fs
  .readFileSync('src/shop-counter-audio.ts', 'utf8')
  .split('const materials:')[1]
  .split('const materialLevels:')[0];
const materials = Object.fromEntries(
  [
    ...source.matchAll(
      /(?:'([^']+)'|(\w+)):\s*'(wood|liquid|waterskin|metal|chain|spheres|glass|paper|leather|cloth)'/g,
    ),
  ].map((m) => [m[1] || m[2], m[3]]),
);
const media = Object.fromEntries(expansion.map((x) => [x.id, x.raw_data.sound_material]));
const entries = [
  ...old,
  ...equipment,
  ...expansion,
  ...Object.keys(materials)
    .filter((x) => x.startsWith('house-'))
    .map((id) => ({ id })),
];
if (new Set(entries.map((x) => x.id)).size !== entries.length)
  throw Error('Duplicate sound identity');
const pcm = new Map();
function readWave(kind) {
  if (pcm.has(kind)) return pcm.get(kind);
  const b = fs.readFileSync('public/audio/shop-counter-' + kind + '.wav');
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE')
    throw Error('Bad WAV');
  let rate, channels, bits, format, data;
  for (let p = 12; p + 8 <= b.length;) {
    const size = b.readUInt32LE(p + 4),
      id = b.toString('ascii', p, p + 4),
      start = p + 8;
    if (id === 'fmt ') {
      format = b.readUInt16LE(start);
      channels = b.readUInt16LE(start + 2);
      rate = b.readUInt32LE(start + 4);
      bits = b.readUInt16LE(start + 14);
    }
    if (id === 'data') data = b.subarray(start, start + size);
    p = start + size + (size % 2);
  }
  if (format !== 1 || channels !== 1 || bits !== 16 || !data)
    throw Error('Expected own mono PCM16 source ' + kind);
  const samples = Float64Array.from(
    { length: data.length / 2 },
    (_, i) => data.readInt16LE(i * 2) / 32768,
  );
  const result = { rate, samples };
  pcm.set(kind, result);
  return result;
}
function wav(id, kind) {
  const { rate, samples } = readWave(kind),
    seed = createHash('sha256').update(id).digest();
  const pitch = 0.94 + (seed.readUInt32LE(0) / 4294967296) * 0.12;
  const prefix = 32 + (seed.readUInt16LE(4) % 169),
    delay = Math.round(rate * (0.008 + (seed[6] / 255) * 0.016));
  const length = prefix + Math.ceil(samples.length / pitch) + delay;
  const out = new Float64Array(length);
  let prev = 0,
    peak = 0;
  const damping = 0.5 + (seed[7] / 255) * 0.4,
    echo = 0.012 + (seed[8] / 255) * 0.027;
  for (let i = prefix; i < length - delay; i++) {
    const pos = (i - prefix) * pitch,
      k = Math.floor(pos),
      f = pos - k;
    const sample = (samples[k] || 0) * (1 - f) + (samples[k + 1] || 0) * f;
    prev = prev * (1 - damping) + sample * damping;
    out[i] += prev;
    out[i + delay] += prev * echo;
  }
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  const bytes = Buffer.alloc(44 + length * 2),
    gain = peak > 0.75 ? 0.75 / peak : 1;
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), 44 + i * 2);
  return bytes;
}
const slots = {},
  consumables = [];
function equip(x) {
  if (x.raw_data.equipment_slots !== undefined) return x.raw_data.equipment_slots;
  const n = x.original_name.toLowerCase();
  if (x.category === 'Veículos' || x.category === 'Equipamento de montaria') return [];
  if (/^(boots|slippers)/.test(n)) return ['feet'];
  if (/^(gloves|gauntlets)/.test(n)) return ['hands'];
  if (/^bracers/.test(n)) return ['bracers'];
  if (/^(ring|rings)\b/.test(n)) return ['ring_left', 'ring_right'];
  if (/^(helm|hat|circlet|headband|eyes|goggles)/.test(n)) return ['head'];
  if (/^(amulet|necklace|medallion|periapt|scarab|brooch)/.test(n)) return ['neck'];
  if (/^(cloak|cape|mantle|wings of flying)/.test(n)) return ['cloak'];
  if (/^robe/.test(n)) return ['armor'];
  if (/^(belt|pouch|bag|quiver|portable hole)/.test(n)) return ['belt'];
  if (/backpack|haversack/.test(n)) return ['back'];
  if (
    /^(wand|rod|staff|potion|scroll|spell scroll)/.test(n) ||
    x.category === 'Ferramentas e instrumentos'
  )
    return ['main_hand', 'off_hand'];
  if (
    ['chest', 'barrel', 'ladder', 'portable-ram', 'tent', 'barding', 'feed'].some((k) =>
      x.id.includes(k),
    )
  )
    return [];
  if (x.category === 'Itens mundanos' || x.category === 'Comida e bebida')
    return ['main_hand', 'off_hand'];
  return [];
}
for (const x of expansion) {
  slots[x.id] = { slots: equip(x), two_handed: x.raw_data.two_handed === true };
  if (
    x.raw_data.consumable ||
    x.category === 'Comida e bebida' ||
    ['poison-basic', 'holy-water', 'perfume', 'soap', 'ink', 'paper', 'parchment'].includes(x.id)
  )
    consumables.push(x.id);
}
if (!only) {
  fs.writeFileSync('shared/emporium-materials.json', JSON.stringify(media, null, 2) + '\n');
  fs.writeFileSync('shared/emporium-equipment.json', JSON.stringify(slots, null, 2) + '\n');
  fs.writeFileSync('shared/emporium-consumables.json', JSON.stringify(consumables, null, 2) + '\n');
}
fs.mkdirSync('public/audio/emporium', { recursive: true });
const manifest = [];
for (const x of entries.filter((entry) => !only || entry.id === only)) {
  const kind = media[x.id] || materials[x.id];
  if (!kind) throw Error('Missing material ' + x.id);
  const bytes = wav(x.id, kind),
    path =
      'public/audio/emporium/' +
      (x.id === 'house-statue' ? 'house-statue-refit-20261007' : x.id) +
      '.wav';
  fs.writeFileSync(path, bytes);
  manifest.push({
    id: x.id,
    path,
    kind,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    source: 'public/audio/shop-counter-' + kind + '.wav',
    algorithm:
      'Own material sample, deterministic item-specific pitch, damping and short reflection; PCM16 mono',
  });
}
if (only) {
  if (!manifest.length) throw Error('Unknown sound identity: ' + only);
  const previous = JSON.parse(fs.readFileSync('public/audio/emporium/manifest.json', 'utf8'));
  const generated = new Map(manifest.map((item) => [item.id, item]));
  const combined = previous.map((item) => generated.get(item.id) || item);
  for (const item of manifest) if (!previous.some((old) => old.id === item.id)) combined.push(item);
  manifest.splice(0, manifest.length, ...combined);
}
if (new Set(manifest.map((x) => x.sha256)).size !== manifest.length)
  throw Error('Duplicate waveform');
fs.writeFileSync('public/audio/emporium/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    items: entries.length,
    uniqueSounds: manifest.length,
    equipmentRules: expansion.length,
    consumables: consumables.length,
  }),
);
