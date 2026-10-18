import fs from 'node:fs/promises';
const rows = [
  [
    'floor-parquet-oak',
    'Parquet de carvalho',
    'dense oak parquet in herringbone arrangement, warm golden worn wood, approximately twenty narrow board widths across the square',
  ],
  [
    'floor-walnut-weave',
    'Parquet trançado de nogueira',
    'dark walnut basketweave parquet with natural alternating wood grain, small square joint pattern, twenty narrow board widths across',
  ],
  [
    'floor-pine-planks',
    'Tábuas largas de pinho',
    'pale honey pine floorboards in staggered long strips, fine knots and restrained worn grain, sixteen board widths across',
  ],
  [
    'floor-cedar-planks',
    'Tábuas de cedro',
    'muted reddish cedar planks with finely visible grain and old hand-forged nail heads, eighteen board widths across',
  ],
  [
    'floor-ash-white',
    'Madeira caiada',
    'whitewashed ash floorboards, warm ivory worn paint revealing subtle pale grain, eighteen narrow board widths across',
  ],
  [
    'floor-endgrain',
    'Blocos de madeira',
    'wooden end-grain block paving with small irregular square oak and beech blocks, visible subtle growth rings, twenty blocks across',
  ],
  [
    'floor-basalt',
    'Lajes de basalto',
    'dense rectangular charcoal basalt flagstones in staggered courses, fine porous volcanic texture, subtle dark mortar, twelve slabs across',
  ],
  [
    'floor-sandstone',
    'Lajes de arenito',
    'honey and cream sandstone flagstones with gently worn edges and warm sandy fine grain, twelve slabs across',
  ],
  [
    'floor-slate-rust',
    'Ardósia rústica',
    'irregular fitted slate flagstones in muted blue gray and restrained rusty brown tones, natural layered texture, twelve slabs across',
  ],
  [
    'floor-limestone',
    'Calcário claro',
    'pale creamy limestone rectangular floor slabs with delicate fossil flecks and thin warm gray joints, twelve slabs across',
  ],
  [
    'floor-travertine',
    'Travertino',
    'warm ivory travertine floor slabs with gentle pores and understated long pale veins, twelve slabs across',
  ],
  [
    'floor-granite',
    'Granito cinzento',
    'gray granite square slabs with finely speckled mineral grains and subtle pale seams, twelve slabs across',
  ],
  [
    'floor-checker-stone',
    'Pedra xadrez',
    'alternating charcoal and ivory polished stone squares, restrained wear, balanced black and white checker floor, sixteen squares across',
  ],
  [
    'floor-mosaic-blue',
    'Mosaico azul',
    'medieval blue and ivory ceramic mosaic tesserae forming repeating geometric eight-point stars, no writing, small dense pattern',
  ],
  [
    'floor-ceramic-green',
    'Cerâmica verde',
    'muted emerald and olive glazed ceramic square floor tiles, individually uneven handmade glazing and worn pale mortar, sixteen tiles across',
  ],
  [
    'floor-hex-clay',
    'Terracota hexagonal',
    'small warm ochre and muted russet hexagonal clay floor tiles, subtle handmade wear, eighteen hexagons across',
  ],
  [
    'floor-brick-weave',
    'Tijolos em espinha',
    'small weathered brick floor pavers laid in herringbone, natural muted burnt orange and brown clay, twenty narrow brick widths across',
  ],
  [
    'floor-octagon',
    'Ladrilhos octogonais',
    'warm terracotta octagonal tiles with small cream square inserts, old medieval handmade ceramic texture, fourteen octagons across',
  ],
  [
    'floor-pebble-mosaic',
    'Mosaico de seixos',
    'flat polished river pebbles tightly bedded in pale mortar, small gray cream and muted brown oval stones forming gentle repeating wave motifs',
  ],
  [
    'floor-dwarven-inlay',
    'Pedra com entalhes anões',
    'dark gray fine-grained stone floor slabs with thin weathered brass inlay forming restrained repeating angular geometric bands, no runes or writing, dense elegant pattern',
  ],
];
const base =
  'Create ONE opaque square material texture for a medieval fantasy battlemap FLOOR. Camera exactly vertically above at 90 degrees, orthographic, no perspective. Finely hand-painted realistic game art matching warm textured timber and natural stone from a high-quality overhead VTT library. Delicate material grain, crisp small-scale detail, natural muted colors. Neutral even overhead lighting across the entire image, no central highlight, vignette or directional shadow. Fill every pixel edge-to-edge with the SAME continuous floor material. Seamless repeat on all four edges. No frame, border, room, walls, furniture, objects, ground patch, text, watermark, grid overlay or transparency. Material: ';
const plan = rows.map(([id, name, subject]) => ({
  id,
  name,
  kind: 'floor',
  price: 250,
  prompt: base + subject + '.',
  image: `/house2/floors-20261018/${id}.webp`,
}));
await fs.mkdir('data/house2/floors-20261018/completed', { recursive: true });
await fs.mkdir('.local/house2-floor-sources', { recursive: true });
await fs.writeFile(
  'data/house2/floors-20261018/prompts.json',
  JSON.stringify(plan, null, 2) + '\n',
);
console.log('Planned twenty original floor materials');
