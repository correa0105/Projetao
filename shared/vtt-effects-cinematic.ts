export const cinematicEffectKinds = [
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
  'frost-ring',
  'ice-bloom',
  'snow-drift',
  'ice-comet',
  'electric-cage',
  'ball-lightning',
  'storm-vortex',
  'static-corona',
  'acid-splash',
  'corrosive-puddle',
  'toxic-spiral',
  'poison-breath',
  'rain-curtain',
  'water-tornado',
  'water-geyser',
  'tidal-wave',
  'dust-devil',
  'wind-shear',
  'sand-veil',
  'air-burst',
  'stone-orbit',
  'shattering-rocks',
  'ground-rupture',
  'crystal-growth',
  'rose-vortex',
  'falling-blossoms',
  'leaf-cyclone',
  'seed-trails',
  'soul-vortex',
  'spirit-procession',
  'ghost-wake',
  'umbra-bloom',
  'healing-stream',
  'celestial-rain',
  'prism-pulse',
  'dimensional-rift',
] as const;
export type CinematicEffectKind = (typeof cinematicEffectKinds)[number];
export type Phenomenon = {
  family:
    'fire' | 'ice' | 'electric' | 'acid' | 'water' | 'air' | 'earth' | 'nature' | 'soul' | 'light';
  layout:
    | 'comet'
    | 'surge'
    | 'jet'
    | 'spiral'
    | 'ring'
    | 'bloom'
    | 'rain'
    | 'cage'
    | 'orbit'
    | 'burst'
    | 'wave'
    | 'rift';
  name: string;
  speed: number;
  count: number;
  spread: number;
};
const rows: [
  CinematicEffectKind,
  string,
  Phenomenon['family'],
  Phenomenon['layout'],
  number,
  number,
  number,
][] = [
  ['ember-comet', 'Cometas de brasas', 'fire', 'comet', 0.8, 7, 1.15],
  ['fire-surge', 'Maré de fogo', 'fire', 'surge', 0.55, 18, 1],
  ['fire-geyser', 'Gêiser de chamas', 'fire', 'jet', 0.9, 16, 0.75],
  ['fire-spiral', 'Espiral incandescente', 'fire', 'spiral', 0.62, 19, 1.1],
  ['frost-ring', 'Coroa de geada', 'ice', 'ring', 0.24, 16, 1],
  ['ice-bloom', 'Flor de gelo', 'ice', 'bloom', 0.22, 14, 1.12],
  ['snow-drift', 'Neve flutuante', 'ice', 'rain', 0.2, 45, 1.3],
  ['ice-comet', 'Cometas de cristal', 'ice', 'comet', 0.55, 7, 1.1],
  ['electric-cage', 'Gaiola elétrica', 'electric', 'cage', 1.8, 9, 1],
  ['ball-lightning', 'Esferas de plasma', 'electric', 'orbit', 1.3, 5, 1],
  ['storm-vortex', 'Vórtice de tempestade', 'electric', 'spiral', 1.5, 17, 1.2],
  ['static-corona', 'Coroa de descargas', 'electric', 'ring', 2.1, 12, 1.12],
  ['acid-splash', 'Salpicos corrosivos', 'acid', 'burst', 0.8, 26, 1],
  ['corrosive-puddle', 'Poça corrosiva', 'acid', 'bloom', 0.2, 14, 0.8],
  ['toxic-spiral', 'Espiral tóxica', 'acid', 'spiral', 0.35, 16, 1.1],
  ['poison-breath', 'Sopro venenoso', 'acid', 'surge', 0.4, 20, 1.18],
  ['rain-curtain', 'Cortina de chuva', 'water', 'rain', 0.65, 38, 1.2],
  ['water-tornado', 'Tornado de água', 'water', 'spiral', 0.45, 25, 1],
  ['water-geyser', 'Gêiser de água', 'water', 'jet', 0.75, 26, 0.9],
  ['tidal-wave', 'Onda de maré', 'water', 'wave', 0.3, 18, 1.2],
  ['dust-devil', 'Redemoinho de poeira', 'air', 'spiral', 0.55, 18, 1.1],
  ['wind-shear', 'Correntes cruzadas', 'air', 'surge', 0.9, 18, 1.2],
  ['sand-veil', 'Véu de areia', 'air', 'rain', 0.25, 42, 1.3],
  ['air-burst', 'Rajada de pressão', 'air', 'burst', 0.65, 22, 1.1],
  ['stone-orbit', 'Pedras suspensas', 'earth', 'orbit', 0.25, 9, 1.12],
  ['shattering-rocks', 'Rocha estilhaçada', 'earth', 'burst', 0.75, 24, 1.1],
  ['ground-rupture', 'Ruptura do chão', 'earth', 'wave', 0.4, 16, 1],
  ['crystal-growth', 'Cristais emergentes', 'ice', 'bloom', 0.3, 18, 1.2],
  ['rose-vortex', 'Vórtice de rosas', 'nature', 'spiral', 0.3, 22, 1.15],
  ['falling-blossoms', 'Chuva de flores', 'nature', 'rain', 0.18, 27, 1.2],
  ['leaf-cyclone', 'Ciclone de folhas', 'nature', 'orbit', 0.6, 25, 1.13],
  ['seed-trails', 'Trilhas de sementes', 'nature', 'comet', 0.3, 18, 1.05],
  ['soul-vortex', 'Vórtice de almas', 'soul', 'spiral', 0.32, 14, 1.12],
  ['spirit-procession', 'Morte na Espreita', 'soul', 'orbit', 0.16, 8, 1.15],
  ['ghost-wake', 'Rastro espectral', 'soul', 'surge', 0.45, 16, 1.14],
  ['umbra-bloom', 'Flor de sombras', 'soul', 'bloom', 0.24, 14, 1.2],
  ['healing-stream', 'Fluxo restaurador', 'light', 'spiral', 0.36, 28, 1],
  ['celestial-rain', 'Chuva celeste', 'light', 'rain', 0.3, 34, 1.25],
  ['prism-pulse', 'Pulsos prismáticos', 'light', 'wave', 0.6, 18, 1.1],
  ['dimensional-rift', 'Fenda dimensional', 'light', 'rift', 0.65, 24, 1.1],
];
const colors = {
  fire: '#f28542',
  ice: '#b0ddf4',
  electric: '#a1cfff',
  acid: '#a6c969',
  water: '#75bdd3',
  air: '#c3bbb0',
  earth: '#b69a7c',
  nature: '#e5b6c6',
  soul: '#a9a3dc',
  light: '#d4d9ad',
};
export const cinematicPhenomena = Object.fromEntries(
  rows.map(([id, name, family, layout, speed, count, spread]) => [
    id,
    { name, family, layout, speed, count, spread },
  ]),
) as Record<CinematicEffectKind, Phenomenon>;
export const cinematicEffects = rows.map(([kind, name, family, layout]) => ({
  kind,
  name,
  color: colors[family],
  group:
    family === 'nature' || family === 'earth'
      ? 'Natureza'
      : family === 'soul'
        ? 'Estado'
        : family === 'light'
          ? 'Magia'
          : 'Elementos',
  description:
    kind === 'spirit-procession' ? 'Morte na Espreita' : name +
    ' · matéria detalhada com fluxo, volume e movimento ' +
    {
      comet: 'com rastros',
      surge: 'em correntes',
      jet: 'em jatos',
      spiral: 'em espiral',
      ring: 'no contorno',
      bloom: 'em crescimento',
      rain: 'de partículas',
      cage: 'com descargas',
      orbit: 'orbital',
      burst: 'de dispersão',
      wave: 'em ondas',
      rift: 'de abertura',
    }[layout] +
    '.',
}));
