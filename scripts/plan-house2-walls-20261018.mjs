import fs from 'node:fs/promises';
const rows = [
  [
    'walls-oak',
    'Madeira de carvalho',
    220,
    'honey oak timber, horizontal wood grain and subtle broad plank joints, worn natural golden brown',
  ],
  [
    'walls-walnut',
    'Madeira de nogueira',
    260,
    'dark walnut timber, horizontal flowing fine grain, deep muted chocolate brown',
  ],
  [
    'walls-pine',
    'Madeira de pinho',
    190,
    'pale pine timber, horizontal fine grain with small knots and light honey cream tones',
  ],
  [
    'walls-cedar',
    'Madeira de cedro',
    240,
    'muted reddish cedar timber, horizontal linear grain and restrained reddish copper brown tones',
  ],
  [
    'walls-whitewood',
    'Madeira caiada',
    210,
    'whitewashed old timber, horizontal grain, worn warm ivory lime paint revealing pale wood',
  ],
  [
    'walls-charred',
    'Madeira carbonizada',
    290,
    'charred black timber, horizontal grain, fine subtly cracked black wood surface, restrained silvery highlights',
  ],
  [
    'walls-plaster-ivory',
    'Reboco de cal',
    200,
    'warm ivory lime plaster, finely hand-trowelled irregular surface with tiny pores, no cracks or stones',
  ],
  [
    'walls-plaster-ochre',
    'Reboco ocre',
    200,
    'muted golden ochre lime plaster, fine hand-trowelled surface and subtle warm earthy mottling',
  ],
  [
    'walls-plaster-clay',
    'Reboco de argila',
    200,
    'warm muted dusty terracotta lime plaster, tiny pores and subtle hand-trowelled clay variations',
  ],
  [
    'walls-plaster-sage',
    'Reboco verde-sálvia',
    230,
    'muted sage green lime plaster, fine hand-trowelled surface and subtle old mineral-pigment mottling',
  ],
  [
    'walls-plaster-blue',
    'Reboco azul mineral',
    230,
    'muted blue gray lime plaster, fine hand-trowelled surface and subtle old blue mineral-pigment mottling',
  ],
  [
    'walls-basalt',
    'Blocos de basalto',
    340,
    'dark charcoal basalt ashlar blocks in horizontal staggered courses, fine porous volcanic stone, thin dark mortar',
  ],
  [
    'walls-limestone',
    'Blocos de calcário',
    300,
    'warm cream limestone ashlar blocks in horizontal staggered courses, tiny fossil flecks and thin muted joints',
  ],
  [
    'walls-sandstone',
    'Blocos de arenito',
    290,
    'honey and tan sandstone blocks in horizontal staggered courses, softly eroded edges and fine sandy grain',
  ],
  [
    'walls-slate',
    'Pedra de ardósia',
    340,
    'layered dark blue gray slate strips in horizontal dry-stacked courses, irregular natural split faces and fine shallow seams',
  ],
  [
    'walls-granite',
    'Blocos de granito',
    360,
    'strong medium gray granite ashlar blocks in horizontal courses, fine mineral speckles and restrained rough stone texture',
  ],
  [
    'walls-fieldstone',
    'Pedra rústica com musgo',
    280,
    'irregular tightly fitted gray and muted brown fieldstone masonry, thin earthy mortar and sparse dark moss in joints',
  ],
  [
    'walls-red-brick',
    'Tijolos vermelhos',
    260,
    'weathered muted red clay bricks in horizontal running bond, thin warm gray mortar and old hand-fired texture',
  ],
  [
    'walls-white-brick',
    'Tijolos caiados',
    250,
    'whitewashed old brick masonry in horizontal running bond, warm ivory worn limewash and thin pale gray mortar',
  ],
  [
    'walls-adobe',
    'Blocos de adobe',
    220,
    'old tan adobe mud bricks in horizontal courses, warm earthen color, subtle straw fibers and soft hand-shaped edges',
  ],
  [
    'walls-dwarven',
    'Pedra com frisos anões',
    440,
    'dark gray finely dressed stone blocks with narrow worn brass geometric inlay bands, restrained angular repeating design, no runes or text',
  ],
  [
    'walls-half-timber',
    'Enxaimel de carvalho',
    350,
    'warm ivory lime plaster divided by narrow aged oak timber strips in a simple repeating rectangular half-timber construction, top-down flat material, no architecture perspective',
  ],
];
const base =
  'Use case: stylized-concept. Create ONE square opaque material tile for the visible TOP surface of a medieval fantasy battlemap WALL. Camera exactly vertically above at 90 degrees, orthographic, absolutely no side view or perspective. Finely hand-painted realistic game art matching natural timber, plaster and stone from a detailed overhead VTT library. Small-scale crisp grain, restrained natural colors, even neutral overhead lighting across the whole tile, no cast shadows or vignette. Fill every pixel edge-to-edge with the same continuous material. Seamless repeat across all four edges. No wall silhouette, room, corner, frame, floor, furniture, characters, objects, text, watermark, grid or transparent margin. Material: ';
const plan = rows.map(([id, name, price, subject]) => ({
  id,
  name,
  price,
  kind: 'walls',
  image: `/house2/walls-20261018/${id}.webp`,
  prompt: base + subject + '.',
}));
await fs.mkdir('data/house2/walls-20261018/completed', { recursive: true });
await fs.mkdir('.local/house2-wall-sources', { recursive: true });
await fs.writeFile('data/house2/walls-20261018/prompts.json', JSON.stringify(plan, null, 2) + '\n');
console.log('Planned 22 wall finishes');
