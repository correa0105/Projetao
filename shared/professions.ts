import { extendProfessionRecipes } from './profession-advanced';
export type WorkshopStep =
  | {
      kind: 'balance';
      title: string;
      instruction: string;
      visual: string;
      labels: string[];
      target: number[];
      tolerance: number;
    }
  | {
      kind: 'assembly';
      title: string;
      instruction: string;
      visual: string;
      parts: string[];
      target: number[];
    }
  | {
      kind: 'trace';
      title: string;
      instruction: string;
      visual: string;
      guide: { x: number; y: number }[];
      tolerance: number;
    }
  | {
      kind: 'dial';
      title: string;
      instruction: string;
      visual: string;
      target: number;
      tolerance: number;
      unit: string;
    }
  | {
      kind: 'order';
      title: string;
      instruction: string;
      visual: string;
      tiles: string[];
      target: number[];
    }
  | { kind: 'pattern'; title: string; instruction: string; visual: string; target: number[] }
  | { kind: 'map'; title: string; instruction: string; visual: string; target: number[] };
export type WorkshopInput = {
  value?: number;
  points?: number[];
  ratios?: number[];
  slots?: number[];
  path?: { x: number; y: number }[];
};
export type CraftIngredient = { item_id: string; quantity: number };
export type CraftRecipe = {
  required_level?: number;
  experience?: number;
  id: string;
  profession_id: string;
  name: string;
  description: string;
  hours: number;
  ingredients: CraftIngredient[];
  output: { item_id: string; quantity: number };
  steps: WorkshopStep[];
};
export type Profession = {
  id: string;
  name: string;
  title: string;
  description: string;
  tools: string[];
  badge: string;
  accent: string;
  background: string;
  recipes: CraftRecipe[];
};
export const professionMaterials = [
  [
    'arcane',
    'Essência arcana',
    'Reagente mágico raro obtido em aventuras e usado em criações avançadas.',
  ],
  ['alloy', 'Liga metálica refinada', 'Lingotes especiais obtidos em mesa para obras de precisão.'],
  [
    'silk',
    'Seda de ofício',
    'Fibras nobres obtidas em aventura para acabamentos de alta qualidade.',
  ],
  ['hide', 'Couro de animal', 'Pele obtida em aventura e preparada para o ofício.'],
  ['iron', 'Minério de ferro', 'Ferro bruto recuperado durante uma aventura.'],
  ['wood', 'Madeira de cerne', 'Madeira escolhida e recolhida em mesa.'],
  ['herb', 'Ervas medicinais', 'Plantas medicinais identificadas durante a aventura.'],
  ['aromatic', 'Ervas aromáticas', 'Folhas e flores colhidas para receitas e extratos.'],
  [
    'venom',
    'Reagente venenoso fantástico',
    'Reagente fictício concedido pelo mestre; uso restrito às receitas do jogo.',
  ],
  ['pigment', 'Pigmento mineral', 'Minerais coloridos obtidos em exploração.'],
  ['clay', 'Argila de olaria', 'Argila própria para modelar e queimar.'],
  ['quartz', 'Areia de quartzo', 'Matéria-prima vítrea encontrada em mesa.'],
  ['gem', 'Gema bruta', 'Pedra sem lapidação recuperada em aventura.'],
  ['wool', 'Lã bruta', 'Fibras de animal recolhidas durante uma aventura.'],
  ['flax', 'Fibras de linho', 'Fibras vegetais recolhidas durante uma aventura.'],
  ['wax', 'Cera de abelha', 'Cera recolhida em exploração para selar e dar acabamento.'],
  ['grain', 'Cereal de colheita', 'Grãos obtidos em mesa para cozinha e fermentação.'],
  ['hops', 'Lúpulo silvestre', 'Flores aromáticas recolhidas para cervejaria.'],
  ['fat', 'Gordura animal preparada', 'Material de aventura usado no acabamento do ofício.'],
  ['meat', 'Carne de caça', 'Provisão obtida e conservada durante a aventura.'],
  ['feather', 'Penas de ave', 'Penas recolhidas para escrita, máscaras e acabamento.'],
  [
    'notes',
    'Registros de exploração',
    'Anotações de uma região que o mestre autorizou o personagem a mapear.',
  ],
  ['stone', 'Pedra de cantaria', 'Pedra apropriada para entalhe, recolhida em mesa.'],
] as const;
export const materialItemId = (id: string) => 'craft-material-' + id;
export const professionMaterialIds = new Set(professionMaterials.map(([id]) => materialItemId(id)));
const ingredient = (id: string, quantity = 1): CraftIngredient => ({ item_id: id, quantity });
const loot = (id: string, quantity = 1) => ingredient(materialItemId(id), quantity);
const dial = (title: string, visual: string, target: number, unit = '%'): WorkshopStep => ({
  kind: 'dial',
  title,
  visual,
  target,
  tolerance: 3,
  unit,
  instruction: `Ajuste o marcador até a faixa de ${target}${unit}. A faixa dourada mostra o ponto desejado.`,
});
const order = (title: string, visual: string, tiles: string[]): WorkshopStep => ({
  kind: 'order',
  title,
  visual,
  tiles,
  target: tiles.map((_, i) => i),
  instruction:
    'Monte a sequência indicada, da esquerda para a direita. Você pode recomeçar sem perder outros materiais.',
});
const pattern = (title: string, visual: string, target: number[]): WorkshopStep => ({
  kind: 'pattern',
  title,
  visual,
  target,
  instruction:
    'Marque na peça os mesmos pontos do molde dourado. Toque novamente para retirar uma marca.',
});
const map = (title: string): WorkshopStep => ({
  kind: 'map',
  title,
  visual: 'chart',
  target: [6, 3, 4, 1, 2],
  instruction:
    'Trace o percurso no pergaminho: acampamento → ponte → bosque → colina → torre. O mapa representa apenas os registros entregues em mesa.',
});
type RecipeSpec = [string, string, string, number, CraftIngredient[], number?];
function workshop(
  id: string,
  name: string,
  title: string,
  description: string,
  tools: string[],
  steps: WorkshopStep[],
  recipes: RecipeSpec[],
  accent = '#c89c61',
): Profession {
  return {
    id,
    name,
    title,
    description,
    tools,
    badge: id === 'luthiery' ? 'lute' : id === 'games' ? 'dice' : id,
    accent,
    background: `/professions/20261113/${id}.webp`,
    recipes: recipes.map(([key, product, output, hours, ingredients, quantity = 1]) => ({
      id: `${id}-${key}`,
      profession_id: id,
      name: product,
      description: `Produção de ${product.toLocaleLowerCase('pt-BR')} na bancada de ${name.toLocaleLowerCase('pt-BR')}.`,
      hours,
      ingredients,
      output: { item_id: output, quantity },
      steps,
    })),
  };
}
export const professions: Profession[] = [
  workshop(
    'smithing',
    'Ferraria',
    'O ferro ganha forma',
    'Aqueça o metal, distribua os golpes e finalize a têmpera.',
    ['Ferramentas de ferreiro'],
    [
      dial('Regular o calor da forja', 'heat', 72),
      pattern('Marcar os pontos de martelagem', 'anvil', [1, 3, 4, 5, 7]),
      order('Dar acabamento à peça', 'anvil', ['Martelar', 'Resfriar', 'Polir']),
    ],
    [
      ['dagger', 'Adaga', 'dagger', 8, [loot('iron', 3), loot('wood'), ingredient('oil')]],
      ['chain', 'Corrente', 'chain', 12, [loot('iron', 5), ingredient('oil', 2)]],
    ],
  ),
  workshop(
    'alchemy',
    'Alquimia',
    'Entre vapores e descobertas',
    'Dose os reagentes, estabilize a mistura e faça a filtragem.',
    ['Ferramentas de alquimista', 'Suprimentos de alquimista'],
    [
      dial('Equilibrar os reagentes', 'mixture', 60),
      order('Preparar a solução', 'mixture', ['Macerar', 'Misturar', 'Filtrar']),
      dial('Estabilizar a mistura', 'mixture', 45),
    ],
    [
      [
        'acid',
        'Frasco de ácido',
        'acid',
        12,
        [loot('pigment', 2), loot('aromatic'), ingredient('vial')],
      ],
      [
        'antitoxin',
        'Antitoxina',
        'antitoxin',
        24,
        [loot('herb', 3), loot('venom'), ingredient('vial')],
      ],
    ],
    '#a6a1c4',
  ),
  workshop(
    'herbalism',
    'Herbalismo',
    'O cuidado começa na colheita',
    'Separe as plantas, macere e prepare extratos medicinais.',
    ['Kit de herbalismo'],
    [
      pattern('Selecionar as folhas do preparo', 'leaves', [0, 2, 4, 6, 8]),
      dial('Ajustar a maceração', 'mixture', 65),
      order('Preparar e envasar', 'leaves', ['Selecionar', 'Macerar', 'Coar', 'Envasar']),
    ],
    [
      [
        'healing',
        'Poção de cura',
        'potion-of-healing',
        24,
        [loot('herb', 4), loot('aromatic', 2), ingredient('vial')],
      ],
      [
        'antitoxin',
        'Antitoxina',
        'antitoxin',
        24,
        [loot('herb', 3), loot('venom'), ingredient('vial')],
      ],
    ],
    '#aea378',
  ),
  workshop(
    'cartography',
    'Cartografia',
    'Cada jornada deixa um traço',
    'Organize os registros da aventura e desenhe caminhos conhecidos.',
    ['Ferramentas de cartógrafo'],
    [
      map('Traçar a rota conhecida'),
      dial('Ajustar a escala do mapa', 'alignment', 50),
      pattern('Posicionar a legenda', 'chart', [0, 4, 8]),
    ],
    [
      [
        'field',
        'Mapa de exploração',
        'craft-field-map',
        4,
        [loot('notes'), ingredient('parchment', 2), ingredient('ink')],
      ],
      [
        'route',
        'Mapa de rotas',
        'craft-route-map',
        6,
        [loot('notes', 2), ingredient('paper', 3), ingredient('ink')],
      ],
    ],
    '#8ca8b5',
  ),
  workshop(
    'leatherwork',
    'Couraria',
    'Da pele à peça pronta',
    'Recorte o couro, una o molde e controle a tensão da costura.',
    ['Ferramentas de couro', 'Ferramentas de coureiro'],
    [
      pattern('Recortar o molde de couro', 'hide', [0, 1, 2, 3, 5, 6, 7, 8]),
      dial('Ajustar a tensão da costura', 'tension', 58),
      order('Costurar e proteger', 'hide', ['Recortar', 'Costurar', 'Encerar']),
    ],
    [
      ['pack', 'Mochila', 'backpack', 8, [loot('hide', 3), loot('wax'), ingredient('string', 2)]],
      [
        'armor',
        'Armadura de couro',
        'leather-armor',
        24,
        [loot('hide', 6), loot('wax', 2), ingredient('string', 3)],
      ],
    ],
  ),
  workshop(
    'brewing',
    'Cervejaria',
    'O tempo revela o sabor',
    'Combine os grãos, regule o preparo e sele os recipientes.',
    ['Ferramentas de cervejeiro', 'Suprimentos de cervejeiro'],
    [
      dial('Dosar malte e lúpulo', 'mixture', 40),
      dial('Regular o aquecimento', 'heat', 62),
      order('Preparar o lote', 'barrel', ['Misturar', 'Coar', 'Fermentar', 'Engarrafar']),
    ],
    [
      [
        'ale',
        'Cerveja artesanal',
        'craft-ale',
        24,
        [loot('grain', 3), loot('hops'), ingredient('glass-bottle', 2)],
        2,
      ],
      [
        'extract',
        'Extrato de malte',
        'craft-malt-extract',
        12,
        [loot('grain', 2), loot('aromatic'), ingredient('flask')],
      ],
    ],
  ),
  workshop(
    'calligraphy',
    'Caligrafia',
    'Palavras que merecem durar',
    'Escolha os traços, alinhe a escrita e sele o documento.',
    ['Suprimentos de caligrafia', 'Suprimentos de calígrafo'],
    [
      pattern('Traçar a capitular', 'glyph', [0, 1, 2, 3, 4, 6, 8]),
      dial('Alinhar as linhas do texto', 'alignment', 50),
      order('Finalizar o manuscrito', 'script', ['Riscar linhas', 'Escrever', 'Secar', 'Selar']),
    ],
    [
      [
        'manuscript',
        'Manuscrito iluminado',
        'craft-manuscript',
        6,
        [loot('pigment'), loot('wax'), ingredient('parchment', 2), ingredient('ink')],
      ],
      [
        'letter',
        'Carta selada',
        'craft-sealed-letter',
        2,
        [loot('wax'), loot('feather'), ingredient('paper'), ingredient('ink')],
      ],
    ],
  ),
  workshop(
    'carpentry',
    'Carpintaria',
    'Encaixes feitos para durar',
    'Meça as tábuas e monte juntas firmes sem desperdiçar madeira.',
    ['Ferramentas de carpinteiro'],
    [
      dial('Conferir a medida do corte', 'cut', 64),
      pattern('Marcar os encaixes', 'joinery', [0, 2, 3, 5, 6, 8]),
      order('Montar e proteger a madeira', 'joinery', [
        'Medir',
        'Cortar',
        'Encaixar',
        'Envernizar',
      ]),
    ],
    [
      ['chest', 'Baú', 'chest', 12, [loot('wood', 4), loot('iron'), ingredient('oil')]],
      ['bucket', 'Balde', 'bucket', 4, [loot('wood', 2), loot('iron'), ingredient('string')]],
    ],
  ),
  workshop(
    'cobbling',
    'Sapataria',
    'Um passo bem construído',
    'Monte a sola e ajuste uma costura que acompanhe o couro.',
    ['Ferramentas de sapateiro'],
    [
      pattern('Marcar o contorno da sola', 'sole', [0, 1, 2, 3, 5, 6, 7, 8]),
      dial('Tensionar a costura', 'tension', 55),
      order('Montar o calçado', 'sole', ['Cortar sola', 'Costurar cabedal', 'Prender fivelas']),
    ],
    [
      [
        'boots',
        'Botas de couro',
        'craft-leather-boots',
        8,
        [loot('hide', 2), loot('wax'), ingredient('string')],
      ],
      [
        'lined',
        'Botas forradas',
        'craft-lined-boots',
        12,
        [loot('hide', 2), loot('wool', 2), ingredient('string', 2)],
      ],
    ],
  ),
  workshop(
    'cooking',
    'Culinária',
    'Provisões para o próximo caminho',
    'Organize os ingredientes, regule o fogo e conserve a refeição.',
    ['Ferramentas de cozinheiro', 'Utensílios de cozinheiro'],
    [
      order('Separar e preparar os alimentos', 'food', [
        'Limpar',
        'Cortar',
        'Temperar',
        'Cozinhar',
      ]),
      dial('Controlar o fogo', 'heat', 55),
      pattern('Distribuir as porções', 'food', [0, 2, 4, 6, 8]),
    ],
    [
      [
        'rations',
        'Rações de viagem',
        'rations',
        4,
        [loot('meat', 2), loot('grain', 2), loot('aromatic'), ingredient('parchment')],
        3,
      ],
      [
        'meal',
        'Refeição de trilha',
        'craft-trail-meal',
        2,
        [loot('meat'), loot('grain'), ingredient('rations')],
      ],
    ],
  ),
  workshop(
    'glassblowing',
    'Vidraria',
    'Luz moldada pelo sopro',
    'Aqueça a massa, controle o sopro e molde o recipiente.',
    ['Ferramentas de vidreiro'],
    [
      dial('Regular o forno de vidro', 'heat', 78),
      dial('Controlar a pressão do sopro', 'pressure', 46),
      pattern('Conferir a simetria do vidro', 'glass', [1, 3, 4, 5, 7]),
    ],
    [
      [
        'bottles',
        'Garrafas de vidro',
        'glass-bottle',
        8,
        [loot('quartz', 3), ingredient('oil', 2)],
        2,
      ],
      ['vials', 'Ampolas', 'vial', 6, [loot('quartz', 2), ingredient('oil')], 3],
    ],
  ),
  workshop(
    'jewelry',
    'Joalheria',
    'Uma história em cada faceta',
    'Escolha o desenho, lapide e assente a gema na peça.',
    ['Ferramentas de joalheiro'],
    [
      pattern('Marcar as facetas da gema', 'gem', [1, 3, 4, 5, 7]),
      dial('Alinhar o engaste', 'alignment', 50),
      order('Dar o acabamento final', 'gem', ['Lapidar', 'Engastar', 'Polir']),
    ],
    [
      ['ring', 'Anel artesanal', 'craft-ring', 12, [loot('gem'), loot('iron'), ingredient('oil')]],
      [
        'amulet',
        'Amuleto lapidado',
        'craft-gem-amulet',
        16,
        [loot('gem', 2), loot('iron'), ingredient('string')],
      ],
    ],
    '#b7a0c4',
  ),
  workshop(
    'masonry',
    'Cantaria',
    'O que fica depois da jornada',
    'Marque a pedra, distribua os cortes e confira o alinhamento.',
    ['Ferramentas de pedreiro'],
    [
      pattern('Marcar o relevo na pedra', 'stone', [0, 1, 2, 3, 6, 7, 8]),
      dial('Ajustar a profundidade do corte', 'cut', 38),
      order('Desbastar e finalizar', 'stone', ['Marcar', 'Desbastar', 'Nivelar', 'Polir']),
    ],
    [
      [
        'relief',
        'Relevo de cantaria',
        'craft-stone-relief',
        12,
        [loot('stone', 3), loot('pigment'), ingredient('oil')],
      ],
      ['sharpening', 'Pedra de afiar', 'craft-whetstone', 4, [loot('stone'), ingredient('oil')]],
    ],
  ),
  workshop(
    'painting',
    'Pintura',
    'Cor, memória e identidade',
    'Misture o pigmento e componha uma imagem para levar consigo.',
    ['Ferramentas de pintor', 'Suprimentos de pintor'],
    [
      dial('Misturar o pigmento', 'mixture', 42),
      pattern('Compor as áreas da pintura', 'canvas', [0, 2, 4, 6, 8]),
      order('Aplicar as camadas', 'canvas', [
        'Preparar suporte',
        'Pintar fundo',
        'Detalhar',
        'Secar',
      ]),
    ],
    [
      [
        'banner',
        'Estandarte pintado',
        'craft-painted-banner',
        8,
        [loot('pigment', 2), loot('flax', 2), ingredient('oil')],
      ],
      [
        'landscape',
        'Paisagem pintada',
        'craft-landscape',
        12,
        [loot('pigment', 3), loot('wood'), ingredient('paper', 2)],
      ],
    ],
    '#ae7e83',
  ),
  workshop(
    'pottery',
    'Olaria',
    'Terra que encontra sua forma',
    'Centralize a argila, modele a parede e regule a queima.',
    ['Ferramentas de oleiro'],
    [
      dial('Centralizar a argila no torno', 'alignment', 50),
      dial('Modelar a espessura da parede', 'pressure', 35),
      order('Secar, queimar e esmaltar', 'pottery', ['Modelar', 'Secar', 'Queimar', 'Esmaltar']),
    ],
    [
      [
        'jugs',
        'Jarros de barro',
        'jug',
        8,
        [loot('clay', 3), loot('pigment'), ingredient('oil')],
        2,
      ],
      [
        'pot',
        'Pote esmaltado',
        'craft-glazed-pot',
        12,
        [loot('clay', 2), loot('pigment', 2), ingredient('oil')],
      ],
    ],
  ),
  workshop(
    'tinkering',
    'Funilaria',
    'Pequenas peças, grandes soluções',
    'Encaixe a engrenagem, calibre o mecanismo e faça a montagem.',
    ['Ferramentas de funileiro'],
    [
      pattern('Encaixar os eixos do mecanismo', 'gear', [1, 3, 4, 5, 7]),
      dial('Calibrar a folga entre peças', 'alignment', 48),
      order('Montar o mecanismo', 'gear', [
        'Fixar base',
        'Encaixar engrenagens',
        'Tensionar mola',
        'Testar',
      ]),
    ],
    [
      ['lock', 'Cadeado', 'lock', 12, [loot('iron', 3), loot('wax'), ingredient('oil')]],
      [
        'tackle',
        'Roldanas e cordame',
        'block-and-tackle',
        8,
        [loot('iron', 2), loot('wood'), ingredient('hempen-rope-50-feet')],
      ],
    ],
  ),
  workshop(
    'weaving',
    'Tecelagem',
    'Fios que se tornam abrigo',
    'Prepare a urdidura, equilibre a tensão e componha a trama.',
    ['Ferramentas de tecelão'],
    [
      pattern('Passar os fios da urdidura', 'loom', [0, 2, 3, 5, 6, 8]),
      dial('Regular a tensão do tear', 'tension', 62),
      order('Tramar e arrematar', 'loom', ['Urdir', 'Passar lançadeira', 'Compactar', 'Arrematar']),
    ],
    [
      ['blanket', 'Cobertor', 'blanket', 12, [loot('wool', 4), ingredient('string')]],
      [
        'rope',
        'Corda',
        'hempen-rope-50-feet',
        8,
        [loot('flax', 4), loot('wax'), ingredient('string', 2)],
      ],
    ],
  ),
  workshop(
    'woodcarving',
    'Entalhe',
    'A forma escondida na madeira',
    'Siga o veio, marque o desenho e trabalhe as curvas da peça.',
    ['Ferramentas de entalhador'],
    [
      pattern('Desenhar o entalhe', 'wood', [1, 3, 4, 5, 6, 8]),
      dial('Regular a profundidade do formão', 'cut', 32),
      order('Entalhar e polir', 'wood', ['Marcar o veio', 'Desbastar', 'Entalhar', 'Polir']),
    ],
    [
      ['staff', 'Bordão', 'quarterstaff', 8, [loot('wood', 2), loot('wax'), ingredient('oil')]],
      [
        'talisman',
        'Talismã de madeira',
        'craft-wood-talisman',
        4,
        [loot('wood'), loot('wax'), ingredient('string')],
      ],
    ],
  ),
  workshop(
    'thieves-tools',
    'Chaveiro',
    'O segredo está no mecanismo',
    'Estude os pinos de uma fechadura de treino e prepare peças de precisão.',
    ['Ferramentas de ladrão'],
    [
      pattern('Alinhar os pinos da fechadura', 'lock', [0, 1, 4, 5, 8]),
      dial('Ajustar a tensão do mecanismo', 'tension', 36),
      order('Preparar as peças de precisão', 'lock', [
        'Medir pinos',
        'Modelar hastes',
        'Polir pontas',
        'Testar',
      ]),
    ],
    [
      [
        'picks',
        'Gazuas de precisão',
        'craft-lock-picks',
        8,
        [loot('iron', 2), loot('wax'), ingredient('oil')],
      ],
      [
        'practice',
        'Fechadura de treino',
        'craft-practice-lock',
        12,
        [loot('iron', 3), loot('wood'), ingredient('oil')],
      ],
    ],
  ),
  workshop(
    'navigation',
    'Navegação',
    'As estrelas apontam o caminho',
    'Relacione seus registros de viagem com a bússola e a carta.',
    ['Ferramentas de navegador'],
    [
      dial('Orientar a bússola da carta', 'compass', 50),
      map('Ligar as referências da viagem'),
      pattern('Marcar as estrelas de referência', 'stars', [0, 2, 4, 7, 8]),
    ],
    [
      [
        'sea',
        'Carta de navegação',
        'craft-sea-chart',
        6,
        [loot('notes', 2), ingredient('parchment', 2), ingredient('ink')],
      ],
      [
        'stars',
        'Carta celeste',
        'craft-star-chart',
        8,
        [loot('notes', 2), loot('pigment'), ingredient('paper', 2), ingredient('ink')],
      ],
    ],
    '#8498bc',
  ),
  workshop(
    'disguise',
    'Disfarce',
    'Uma nova presença em cena',
    'Componha a máscara e harmonize os pigmentos do personagem.',
    ['Kit de disfarce'],
    [
      pattern('Compor os detalhes da máscara', 'mask', [0, 2, 3, 5, 7]),
      dial('Misturar o tom dos pigmentos', 'mixture', 58),
      order('Montar os elementos do disfarce', 'mask', [
        'Preparar base',
        'Aplicar pigmentos',
        'Fixar tecido',
        'Ajustar',
      ]),
    ],
    [
      [
        'mask',
        'Máscara de cena',
        'craft-stage-mask',
        8,
        [loot('hide'), loot('pigment', 2), ingredient('string')],
      ],
      [
        'pigments',
        'Pigmentos de disfarce',
        'craft-disguise-pigments',
        4,
        [loot('pigment', 2), loot('fat'), ingredient('flask')],
      ],
    ],
  ),
  workshop(
    'forgery',
    'Copista',
    'Cada detalhe deixa uma marca',
    'Observe um modelo autorizado e prepare réplicas para o jogo.',
    ['Kit de falsificação'],
    [
      pattern('Reproduzir o desenho do selo', 'seal', [0, 1, 2, 4, 6, 7, 8]),
      dial('Ajustar o espaçamento dos traços', 'alignment', 50),
      order('Preparar a cópia de cena', 'script', [
        'Estudar modelo',
        'Copiar traços',
        'Secar',
        'Aplicar selo',
      ]),
    ],
    [
      [
        'seal',
        'Selo de réplica',
        'craft-replica-seal',
        8,
        [loot('wax', 2), loot('wood'), ingredient('ink')],
      ],
      [
        'copy',
        'Cópia de documento',
        'craft-document-copy',
        6,
        [loot('notes'), loot('wax'), ingredient('parchment'), ingredient('ink')],
      ],
    ],
  ),
  workshop(
    'poison',
    'Venenos',
    'Precisão entre frascos selados',
    'Trabalhe somente os reagentes fictícios do cenário e sele cada lote.',
    ['Kit de venenos'],
    [
      dial('Equilibrar o reagente fantástico', 'mixture', 35),
      pattern('Conferir os lacres do lote', 'seal', [0, 2, 4, 6, 8]),
      order('Preparar o lote do jogo', 'mixture', [
        'Separar reagentes',
        'Estabilizar',
        'Envasar',
        'Lacrar',
      ]),
    ],
    [
      [
        'poison',
        'Veneno básico',
        'basic-poison',
        24,
        [loot('venom', 3), loot('aromatic'), ingredient('vial')],
      ],
      [
        'repellent',
        'Repelente de trilha',
        'craft-repellent',
        8,
        [loot('aromatic', 3), loot('wax'), ingredient('flask')],
      ],
    ],
    '#a391b1',
  ),
  workshop(
    'luthiery',
    'Luteria e música',
    'Madeira que encontra a própria voz',
    'Monte o instrumento, alinhe as peças e encontre a afinação.',
    [
      'Alaúde',
      'Flauta',
      'Tambor',
      'Lira',
      'Gaita de foles',
      'Trombeta',
      'Violino',
      'Dulcimer',
      'Flauta de pã',
      'Charamela',
    ],
    [
      pattern('Montar a caixa de ressonância', 'strings', [0, 2, 3, 4, 5, 7]),
      dial('Ajustar a tensão e a afinação', 'tuning', 50),
      order('Finalizar o instrumento', 'strings', [
        'Montar corpo',
        'Fixar cordas',
        'Afinar',
        'Polir',
      ]),
    ],
    [
      [
        'lyre',
        'Lira',
        'lyre',
        24,
        [loot('wood', 3), loot('flax', 2), ingredient('string', 3), ingredient('oil')],
      ],
      ['flute', 'Flauta', 'flute', 12, [loot('wood', 2), loot('wax'), ingredient('oil')]],
    ],
  ),
  workshop(
    'games',
    'Jogos e peças',
    'Um mundo sobre a mesa',
    'Desenhe as peças, grave as marcas e dê acabamento ao conjunto.',
    ['Dados de jogo', 'Baralho', 'Xadrez de dragão', 'Três dragões'],
    [
      pattern('Marcar as faces das peças', 'dice', [0, 2, 3, 5, 6, 8]),
      dial('Equilibrar o corte das peças', 'cut', 50),
      order('Finalizar o conjunto', 'dice', [
        'Cortar peças',
        'Gravar faces',
        'Pintar marcas',
        'Polir',
      ]),
    ],
    [
      [
        'dice',
        'Conjunto de dados',
        'gaming-dice',
        8,
        [loot('wood', 2), loot('pigment'), ingredient('oil')],
      ],
      [
        'chess',
        'Jogo de peças entalhadas',
        'craft-carved-game',
        16,
        [loot('wood', 4), loot('pigment', 2), ingredient('parchment')],
      ],
    ],
  ),
];
extendProfessionRecipes(professions);
export const craftRecipes = professions.flatMap((p) => p.recipes);
export function professionUnlocked(profession: Profession, proficiencies: readonly string[]) {
  return profession.tools.some((tool) => proficiencies.includes(tool));
}
export function validWorkshopInput(step: WorkshopStep, input: WorkshopInput) {
  const field =
    step.kind === 'dial'
      ? 'value'
      : step.kind === 'balance'
        ? 'ratios'
        : step.kind === 'assembly'
          ? 'slots'
          : step.kind === 'trace'
            ? 'path'
            : 'points';
  if (Object.keys(input).some((key) => key !== field)) return false;
  if (step.kind === 'balance')
    return (
      !!input.ratios &&
      input.ratios.length === step.target.length &&
      input.ratios.every(
        (v, i) =>
          Number.isInteger(v) &&
          v >= 0 &&
          v <= 100 &&
          Math.abs(v - step.target[i]) <= step.tolerance,
      ) &&
      input.ratios.reduce((a, b) => a + b, 0) === 100
    );
  if (step.kind === 'assembly')
    return (
      !!input.slots &&
      input.slots.length === step.target.length &&
      input.slots.every((v, i) => v === step.target[i])
    );
  if (step.kind === 'trace') {
    const path = input.path;
    if (
      !path ||
      path.length < 12 ||
      path.length > 256 ||
      path.some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          p.x < 0 ||
          p.x > 100 ||
          p.y < 0 ||
          p.y > 100,
      )
    )
      return false;
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    if (
      distance(path[0], step.guide[0]) > step.tolerance ||
      distance(path[path.length - 1], step.guide[step.guide.length - 1]) > step.tolerance
    )
      return false;
    let cursor = 0;
    for (const guide of step.guide) {
      const next = path.findIndex((p, i) => i >= cursor && distance(p, guide) <= step.tolerance);
      if (next < 0) return false;
      cursor = next;
    }
    for (const p of path) {
      let nearest = Infinity;
      for (let i = 1; i < step.guide.length; i++) {
        const a = step.guide[i - 1],
          b = step.guide[i],
          dx = b.x - a.x,
          dy = b.y - a.y,
          t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, distance(p, { x: a.x + t * dx, y: a.y + t * dy }));
      }
      if (nearest > step.tolerance) return false;
    }
    return true;
  }
  if (step.kind === 'dial')
    return (
      typeof input.value === 'number' &&
      Number.isFinite(input.value) &&
      Math.abs(input.value - step.target) <= step.tolerance &&
      input.points === undefined
    );
  if (
    input.value !== undefined ||
    !input.points ||
    input.points.length !== step.target.length ||
    new Set(input.points).size !== input.points.length
  )
    return false;
  const selected = step.kind === 'pattern' ? [...input.points].sort((a, b) => a - b) : input.points;
  const target = step.kind === 'pattern' ? [...step.target].sort((a, b) => a - b) : step.target;
  return selected.every((value, index) => value === target[index]);
}
export type CraftProject = {
  id: string;
  character_id: string;
  recipe_id: string;
  profession_id: string;
  recipe: CraftRecipe;
  step: number;
  revision: number;
  ready_at: string;
  created_at: string;
  claimed_at: string | null;
};
export type ProfessionInventoryItem = {
  id: string;
  name: string;
  image_path: string | null;
  quantity: number;
  available: number;
  price_cp: number | null;
  active: boolean;
};
export type ProfessionState = {
  capabilities?: { all_professions: boolean; unlimited_materials: boolean };
  progress?: {
    profession_id: string;
    experience: number;
    level: number;
    level_start: number;
    next_level: number | null;
    title: string;
  }[];
  server_time: string;
  character: { id: string; name: string } | null;
  proficiencies: string[];
  inventory: ProfessionInventoryItem[];
  projects: CraftProject[];
  rooms: { id: string; name: string }[];
};
