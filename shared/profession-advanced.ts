import type { Profession, CraftIngredient, WorkshopStep } from './professions';
type Extra = [string, string, string, string[]];
const extraRecipes: Record<string, Extra[]> = {
  smithing: [
    ['sword', 'Espada longa', 'longsword', ['iron', 'alloy', 'wood']],
    [
      'enchanted-dagger',
      'Adaga mágica +1',
      'magic-weapon-dagger-plus-1',
      ['iron', 'alloy', 'arcane'],
    ],
    [
      'master-sword',
      'Espada longa mágica +2',
      'magic-weapon-longsword-plus-2',
      ['alloy', 'gem', 'arcane'],
    ],
  ],
  alchemy: [
    ['fire', 'Fogo alquímico', 'alchemists-fire', ['pigment', 'aromatic', 'fat']],
    [
      'resistance',
      'Poção de resistência ao fogo',
      'potion-of-resistance-fire',
      ['herb', 'gem', 'arcane'],
    ],
    [
      'invisibility',
      'Poção da invisibilidade',
      'potion-of-invisibility',
      ['herb', 'quartz', 'arcane'],
    ],
  ],
  herbalism: [
    ['climbing', 'Poção de escalada', 'potion-of-climbing', ['herb', 'aromatic', 'wax']],
    [
      'water-breathing',
      'Poção de respirar na água',
      'potion-of-water-breathing',
      ['herb', 'aromatic', 'arcane'],
    ],
    ['vitality', 'Poção de vitalidade', 'potion-of-vitality', ['herb', 'gem', 'arcane']],
  ],
  cartography: [
    ['survey', 'Mapa topográfico detalhado', 'craft-detailed-map', ['notes', 'pigment', 'wax']],
    ['atlas', 'Atlas de expedição', 'craft-survey-atlas', ['notes', 'hide', 'silk']],
    ['master-atlas', 'Atlas do cartógrafo mestre', 'craft-master-atlas', ['notes', 'silk', 'gem']],
  ],
  leatherwork: [
    ['studded', 'Armadura de couro batido', 'studded-leather', ['hide', 'iron', 'wax']],
    ['elven-boots', 'Botas élficas', 'boots-of-elvenkind', ['hide', 'silk', 'arcane']],
    ['holding', 'Bolsa de contenção', 'bag-of-holding', ['hide', 'silk', 'arcane']],
  ],
  brewing: [
    ['growth', 'Poção de crescimento', 'potion-of-growth', ['grain', 'hops', 'aromatic']],
    [
      'breathing',
      'Tônico de respirar na água',
      'potion-of-water-breathing',
      ['grain', 'herb', 'arcane'],
    ],
    ['heroism', 'Poção de heroísmo', 'potion-of-heroism', ['grain', 'gem', 'arcane']],
  ],
  calligraphy: [
    ['chronicle', 'Crônica encadernada', 'craft-chronicle', ['notes', 'hide', 'wax']],
    ['codex', 'Códice iluminado', 'craft-illuminated-codex', ['pigment', 'silk', 'gem']],
    ['grimoire', 'Manuscrito de obra-prima', 'craft-master-manuscript', ['notes', 'silk', 'gem']],
  ],
  carpentry: [
    ['shield', 'Escudo de madeira e aço', 'shield', ['wood', 'iron', 'hide']],
    ['broom', 'Vassoura voadora', 'broom-of-flying', ['wood', 'flax', 'arcane']],
    ['boat', 'Barco dobrável', 'folding-boat', ['wood', 'silk', 'arcane']],
  ],
  cobbling: [
    ['riding', 'Botas de montaria', 'cosmetic-boots-riding', ['hide', 'iron', 'wax']],
    [
      'springing',
      'Botas de caminhar e saltar',
      'boots-of-striding-and-springing',
      ['hide', 'silk', 'arcane'],
    ],
    ['speed', 'Botas de velocidade', 'boots-of-speed', ['hide', 'alloy', 'arcane']],
  ],
  cooking: [
    ['feast', 'Provisões de banquete', 'craft-feast-provisions', ['meat', 'grain', 'aromatic']],
    [
      'friendship',
      'Preparo da amizade animal',
      'potion-of-animal-friendship',
      ['meat', 'herb', 'arcane'],
    ],
    ['nourishment', 'Conta de nutrição', 'bead-of-nourishment', ['grain', 'herb', 'arcane']],
  ],
  glassblowing: [
    ['mirror', 'Espelho polido', 'mirror', ['quartz', 'alloy', 'wood']],
    ['lenses', 'Lentes de visão minuciosa', 'eyes-of-minute-seeing', ['quartz', 'gem', 'arcane']],
    ['seeing', 'Gema da visão', 'gem-of-seeing', ['quartz', 'gem', 'arcane']],
  ],
  jewelry: [
    ['necklace', 'Colar de granadas', 'cosmetic-necklace-garnet', ['gem', 'alloy', 'silk']],
    ['protection', 'Anel de proteção', 'ring-of-protection', ['gem', 'alloy', 'arcane']],
    ['health', 'Amuleto da saúde', 'amulet-of-health', ['gem', 'alloy', 'arcane']],
  ],
  masonry: [
    [
      'relief-master',
      'Relevo de cantaria refinado',
      'craft-refined-relief',
      ['stone', 'pigment', 'alloy'],
    ],
    ['luck', 'Pedra da boa sorte', 'stone-of-good-luck-luckstone', ['stone', 'gem', 'arcane']],
    [
      'earth',
      'Pedra de controlar elementais da terra',
      'stone-of-controlling-earth-elementals',
      ['stone', 'gem', 'arcane'],
    ],
  ],
  painting: [
    [
      'study',
      'Estudo de paisagem emoldurado',
      'craft-landscape-study',
      ['pigment', 'wood', 'silk'],
    ],
    ['marvelous', 'Pigmentos maravilhosos', 'marvelous-pigments', ['pigment', 'gem', 'arcane']],
    [
      'colors',
      'Robe das cores cintilantes',
      'robe-of-scintillating-colors',
      ['pigment', 'silk', 'arcane'],
    ],
  ],
  pottery: [
    ['ceremonial', 'Pote cerimonial esmaltado', 'craft-ceremonial-pot', ['clay', 'pigment', 'gem']],
    [
      'alchemy-jug',
      'Decanter de água infinita',
      'decanter-of-endless-water',
      ['clay', 'quartz', 'arcane'],
    ],
    [
      'brazier',
      'Braseiro de comandar elementais do fogo',
      'brazier-of-commanding-fire-elementals',
      ['clay', 'alloy', 'arcane'],
    ],
  ],
  tinkering: [
    ['lantern', 'Lanterna furta-fogo', 'bullseye-lantern', ['iron', 'quartz', 'wood']],
    ['goggles', 'Óculos da noite', 'goggles-of-night', ['alloy', 'quartz', 'arcane']],
    ['revealing', 'Lanterna da revelação', 'lantern-of-revealing', ['alloy', 'quartz', 'arcane']],
  ],
  weaving: [
    ['fine', 'Roupas finas', 'fine-clothes', ['wool', 'flax', 'silk']],
    ['cloak', 'Manto de proteção', 'cloak-of-protection', ['wool', 'silk', 'arcane']],
    ['displacement', 'Manto de deslocamento', 'cloak-of-displacement', ['silk', 'gem', 'arcane']],
  ],
  woodcarving: [
    ['bow', 'Arco curto', 'shortbow', ['wood', 'flax', 'wax']],
    ['secrets', 'Varinha dos segredos', 'wand-of-secrets', ['wood', 'gem', 'arcane']],
    ['healing-staff', 'Cajado da cura', 'staff-of-healing', ['wood', 'herb', 'arcane']],
  ],
  'thieves-tools': [
    ['kit', 'Ferramentas de ladrão', 'thieves-tools', ['iron', 'alloy', 'hide']],
    ['gloves', 'Luvas de ladinagem', 'gloves-of-thievery', ['hide', 'silk', 'arcane']],
    ['chime', 'Sino da abertura', 'chime-of-opening', ['alloy', 'gem', 'arcane']],
  ],
  navigation: [
    ['navigator-kit', 'Ferramentas de navegador', 'navigators-tools', ['alloy', 'quartz', 'notes']],
    ['spyglass', 'Luneta', 'spyglass', ['alloy', 'quartz', 'gem']],
    ['ocean-atlas', 'Atlas de navegação oceânica', 'craft-ocean-atlas', ['notes', 'silk', 'gem']],
  ],
  disguise: [
    ['costume', 'Traje de cena', 'costume', ['hide', 'flax', 'pigment']],
    ['hat', 'Chapéu de disfarce', 'hat-of-disguise', ['wool', 'silk', 'arcane']],
    ['elven-cloak', 'Manto élfico', 'cloak-of-elvenkind', ['silk', 'aromatic', 'arcane']],
  ],
  forgery: [
    [
      'contract',
      'Documento cerimonial de cena',
      'craft-ceremonial-document',
      ['notes', 'wax', 'pigment'],
    ],
    ['archive', 'Cópia de arquivo refinada', 'craft-archival-copy', ['notes', 'silk', 'wax']],
    ['master-seal', 'Selo de réplica de obra-prima', 'craft-master-seal', ['wax', 'gem', 'alloy']],
  ],
  poison: [
    ['antitoxin', 'Antitoxina refinada', 'antitoxin', ['venom', 'herb', 'aromatic']],
    ['poison-potion', 'Poção de veneno', 'potion-of-poison', ['venom', 'herb', 'arcane']],
    ['venom-dagger', 'Adaga de veneno', 'dagger-of-venom', ['venom', 'alloy', 'arcane']],
  ],
  luthiery: [
    ['lute', 'Alaúde', 'lute', ['wood', 'flax', 'silk']],
    ['haunting', 'Flautas assombradas', 'pipes-of-haunting', ['wood', 'alloy', 'arcane']],
    ['opening-chime', 'Sino musical da abertura', 'chime-of-opening', ['alloy', 'gem', 'arcane']],
  ],
  games: [
    ['chess', 'Conjunto de xadrez de dragão', 'dragonchess-set', ['wood', 'stone', 'pigment']],
    ['deluxe', 'Jogo de peças de obra-prima', 'craft-carved-game-deluxe', ['wood', 'gem', 'alloy']],
    ['illusions', 'Baralho das ilusões', 'deck-of-illusions', ['silk', 'pigment', 'arcane']],
  ],
};
const balance = (name: string): WorkshopStep => ({
  kind: 'balance',
  title: 'Equilibrar as proporções',
  instruction: `Prepare as proporções de ${name.toLocaleLowerCase('pt-BR')}. Distribua exatamente 100 partes conforme a fórmula da bancada.`,
  visual: 'mixture',
  labels: ['Base', 'Componente', 'Acabamento'],
  target: [50, 30, 20],
  tolerance: 2,
});
const assembly = (): WorkshopStep => ({
  kind: 'assembly',
  title: 'Encaixar os componentes',
  instruction:
    'Escolha uma peça e depois o encaixe com o mesmo desenho. Monte os três componentes nas posições indicadas.',
  visual: 'assembly',
  parts: ['Base', 'Núcleo', 'Acabamento'],
  target: [2, 0, 1],
});
const trace = (): WorkshopStep => ({
  kind: 'trace',
  title: 'Traçar o acabamento',
  instruction:
    'Siga o molde dourado do início ao fim. Arraste sobre a peça ou use os pontos numerados para guiar o traço.',
  visual: 'trace',
  guide: [
    { x: 12, y: 72 },
    { x: 25, y: 35 },
    { x: 42, y: 55 },
    { x: 58, y: 22 },
    { x: 75, y: 48 },
    { x: 88, y: 28 },
  ],
  tolerance: 9,
});
export function extendProfessionRecipes(values: Profession[]) {
  values.forEach((p, index) => {
    p.recipes.forEach((r) => {
      r.required_level = 1;
      r.experience = 20;
    });
    p.recipes[1].steps = [
      ...p.recipes[1].steps,
      index % 3 === 0 ? balance(p.name) : index % 3 === 1 ? assembly() : trace(),
    ];
    const rows = extraRecipes[p.id];
    if (!rows) throw new Error('Faltam receitas avançadas de ' + p.id);
    rows.forEach(([key, name, output, materials], tier) => {
      const required_level = [3, 6, 10][tier],
        experience = [35, 60, 100][tier];
      const ingredients: CraftIngredient[] = materials.map((id, i) => ({
        item_id: 'craft-material-' + id,
        quantity: [4, 7, 12][tier] + (i === 0 ? 2 : 0),
      }));
      const supply = ['alchemy', 'herbalism', 'poison', 'brewing', 'cooking'].includes(p.id)
        ? 'vial'
        : ['cartography', 'calligraphy', 'forgery', 'navigation', 'painting', 'games'].includes(
              p.id,
            )
          ? 'ink'
          : 'oil';
      ingredients.push({ item_id: supply, quantity: tier + 2 });
      if (output === 'dagger-of-venom' || output === 'magic-weapon-dagger-plus-1')
        ingredients.push({ item_id: 'dagger', quantity: 1 });
      if (output === 'magic-weapon-longsword-plus-2')
        ingredients.push({ item_id: 'longsword', quantity: 1 });
      p.recipes.push({
        id: p.id + '-advanced-' + key,
        profession_id: p.id,
        name,
        description: `Criação ${required_level >= 9 ? 'de mestre' : required_level >= 6 ? 'especializada' : 'refinada'} de ${p.name.toLocaleLowerCase('pt-BR')}.`,
        hours: [16, 36, 72][tier],
        required_level,
        experience,
        ingredients,
        output: { item_id: output, quantity: 1 },
        steps: [
          p.recipes[0].steps[0],
          balance(p.name),
          assembly(),
          trace(),
        ],
      });
    });
  });
}
