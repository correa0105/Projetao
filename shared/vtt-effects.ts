import { z } from 'zod';
// The original six IDs and ordering are part of saved rooms and hotbar presets.
export const effectKinds = [
  'death',
  'fire',
  'frost',
  'poison',
  'heal',
  'sparks',
  'lightning',
  'arcane',
  'shield',
  'radiant',
  'shadow',
  'acid',
  'wind',
  'water',
  'earth',
  'vines',
  'portal',
  'teleport',
  'shockwave',
  'explosion',
  'vortex',
  'smoke',
  'blizzard',
  'embers',
  'chain-lightning',
  'lava',
  'runes',
  'curse',
  'bless',
  'necrotic',
  'web',
  'swarm',
  'leaves',
  'petals',
  'blades',
  'sonic',
] as const;
export type EffectKind = (typeof effectKinds)[number];
export const effectLibrary: {
  kind: EffectKind;
  name: string;
  color: string;
  group: string;
  description: string;
}[] = [
  {
    kind: 'death',
    name: 'Sangue e token vermelho',
    color: '#801b19',
    group: 'Estado',
    description:
      'Sangue com bordas irregulares e reflexos discretos. O token permanece inteiro e vermelho.',
  },
  {
    kind: 'fire',
    name: 'Chamas',
    color: '#ed7836',
    group: 'Elementos',
    description: 'Línguas de fogo turbulentas, núcleo quente, fumaça e brasas que sobem.',
  },
  {
    kind: 'frost',
    name: 'Gelo',
    color: '#9dd7ef',
    group: 'Elementos',
    description: 'Cristais facetados, fraturas luminosas, névoa fria e pequenos flocos.',
  },
  {
    kind: 'poison',
    name: 'Veneno',
    color: '#92b65f',
    group: 'Estado',
    description: 'Vapor denso e sinuoso, com bordas transparentes e fluxos esverdeados.',
  },
  {
    kind: 'heal',
    name: 'Cura',
    color: '#99d5aa',
    group: 'Magia',
    description: 'Círculo de luz sob o corpo, espiral suave ao redor e pequenas estrelas.',
  },
  {
    kind: 'sparks',
    name: 'Faíscas',
    color: '#d8bc76',
    group: 'Elementos',
    description: 'Arcos curtos ramificados, centelhas rápidas e núcleos incandescentes.',
  },
  {
    kind: 'lightning',
    name: 'Relâmpagos',
    color: '#96beff',
    group: 'Elementos',
    description: 'Múltiplas descargas de pontos distribuídos, com ramificações e luz elétrica.',
  },
  {
    kind: 'arcane',
    name: 'Selo arcano',
    color: '#b79aef',
    group: 'Magia',
    description: 'Inscrições geométricas, fios de energia e fragmentos ao redor da silhueta.',
  },
  {
    kind: 'shield',
    name: 'Barreira',
    color: '#73c9eb',
    group: 'Magia',
    description: 'Facetas translúcidas e pulsos de proteção acompanhando os contornos do corpo.',
  },
  {
    kind: 'radiant',
    name: 'Luz radiante',
    color: '#f2cf79',
    group: 'Magia',
    description: 'Luz dourada sobre o corpo, fios luminosos e pequenas estrelas delicadas.',
  },
  {
    kind: 'shadow',
    name: 'Sombras',
    color: '#9270b7',
    group: 'Magia',
    description: 'Véus escuros, fios de sombra e brasas violetas nas bordas.',
  },
  {
    kind: 'acid',
    name: 'Ácido',
    color: '#b5d74f',
    group: 'Elementos',
    description: 'Vapor corrosivo denso e respingos viscosos com bordas que se desfazem.',
  },
  {
    kind: 'wind',
    name: 'Vendaval',
    color: '#b6dbda',
    group: 'Elementos',
    description: 'Correntes espirais com trilhas afiladas, poeira e pequenos detritos.',
  },
  {
    kind: 'water',
    name: 'Água',
    color: '#59bddd',
    group: 'Elementos',
    description: 'Ondas translúcidas, gotas brilhantes e anéis de água em expansão.',
  },
  {
    kind: 'earth',
    name: 'Terra',
    color: '#b39165',
    group: 'Natureza',
    description: 'Fragmentos de rocha facetada, fissuras quentes e poeira rasteira.',
  },
  {
    kind: 'vines',
    name: 'Raízes',
    color: '#80ae68',
    group: 'Natureza',
    description: 'Ramos entrelaçados, folhas com nervuras e pequenas sementes luminosas.',
  },
];
effectLibrary.push(
  {
    kind: 'portal',
    name: 'Portal',
    color: '#7eb5ff',
    group: 'Magia',
    description: 'Borda turbulenta com abertura escura e filamentos girando sobre o chão.',
  },
  {
    kind: 'teleport',
    name: 'Teletransporte',
    color: '#b79aef',
    group: 'Magia',
    description: 'Selo em pulso e fragmentos de energia que convergem antes de se espalhar.',
  },
  {
    kind: 'shockwave',
    name: 'Onda de choque',
    color: '#a8dce6',
    group: 'Elementos',
    description: 'Frentes de pressão largas se expandem com névoa e bordas irregulares.',
  },
  {
    kind: 'explosion',
    name: 'Explosão',
    color: '#ff9a4c',
    group: 'Elementos',
    description: 'Clarão quente, frentes de fogo e detritos angulares em expansão.',
  },
  {
    kind: 'vortex',
    name: 'Vórtice',
    color: '#91bdd1',
    group: 'Elementos',
    description: 'Correntes em funil vistas de cima, com fluxos em direção ao centro.',
  },
  {
    kind: 'smoke',
    name: 'Cortina de fumaça',
    color: '#b6c8d3',
    group: 'Estado',
    description: 'Camadas densas de fumaça turbulenta se espalham ao redor da silhueta.',
  },
  {
    kind: 'blizzard',
    name: 'Nevasca',
    color: '#d0edff',
    group: 'Elementos',
    description: 'Rajadas de neve com flocos ramificados e névoa fria em movimento.',
  },
  {
    kind: 'embers',
    name: 'Brasas',
    color: '#ffba67',
    group: 'Elementos',
    description: 'Fragmentos incandescentes irregulares sobem de várias regiões do corpo.',
  },
  {
    kind: 'chain-lightning',
    name: 'Corrente elétrica',
    color: '#9cbfff',
    group: 'Elementos',
    description: 'Descargas ligam pontos distribuídos em torno do corpo em circuitos variáveis.',
  },
  {
    kind: 'lava',
    name: 'Lava',
    color: '#fa6d32',
    group: 'Elementos',
    description: 'Crosta escura, rachaduras ramificadas quentes e pequenos jatos de fogo.',
  },
  {
    kind: 'runes',
    name: 'Runas de invocação',
    color: '#c4a2ff',
    group: 'Magia',
    description: 'Anéis concêntricos e inscrições luminosas se movimentam em sentidos opostos.',
  },
  {
    kind: 'curse',
    name: 'Maldição',
    color: '#b46cd5',
    group: 'Estado',
    description: 'Inscrições partidas e garras sombrias se fecham em direção ao corpo.',
  },
  {
    kind: 'bless',
    name: 'Bênção',
    color: '#f7dc8f',
    group: 'Magia',
    description: 'Raios dourados, estrela sagrada e coroas de luz orbitam o personagem.',
  },
  {
    kind: 'necrotic',
    name: 'Drenagem vital',
    color: '#bc6594',
    group: 'Estado',
    description: 'Veios escuros e fluxos de energia convergem das bordas para a silhueta.',
  },
  {
    kind: 'web',
    name: 'Teia',
    color: '#d8d4c4',
    group: 'Natureza',
    description: 'Fios radiais ligados por malhas irregulares cobrem o chão e o corpo.',
  },
  {
    kind: 'swarm',
    name: 'Enxame de morcegos',
    color: '#a691c5',
    group: 'Natureza',
    description: 'Silhuetas articuladas de morcegos circulam em alturas e ritmos diferentes.',
  },
  {
    kind: 'leaves',
    name: 'Folhas ao vento',
    color: '#a9c376',
    group: 'Natureza',
    description: 'Folhas com nervuras percorrem correntes curvas em torno do personagem.',
  },
  {
    kind: 'petals',
    name: 'Pétalas',
    color: '#e9a5c4',
    group: 'Natureza',
    description: 'Pétalas translúcidas giram, inclinam e sobem ao redor da silhueta.',
  },
  {
    kind: 'blades',
    name: 'Lâminas orbitais',
    color: '#c3dbe4',
    group: 'Magia',
    description: 'Lâminas metálicas facetadas orbitam com rastros curvos de movimento.',
  },
  {
    kind: 'sonic',
    name: 'Ressonância sonora',
    color: '#dda8ef',
    group: 'Magia',
    description: 'Frentes concêntricas de som ondulam com padrões de interferência.',
  },
);
export const effectNames = effectLibrary.map((e) => e.name);
export const effectColors = effectLibrary.map((e) => e.color);
const appearance = {
  kind: z.enum(effectKinds),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  scale: z.number().min(0.5).max(3),
  duration: z.number().int().min(0).max(60),
};
export const effectPresetSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(60),
    ...appearance,
  })
  .strict();
export const tokenEffectSchema = z
  .object({
    id: z.string().uuid(),
    ...appearance,
    at: z.number().int().min(0).max(9999999999999),
  })
  .strict();
export type EffectPreset = z.infer<typeof effectPresetSchema>;
export type TokenEffect = z.infer<typeof tokenEffectSchema>;
export function effectEnds(effect: TokenEffect) {
  return effect.duration ? effect.at + effect.duration * 1000 : 0;
}
