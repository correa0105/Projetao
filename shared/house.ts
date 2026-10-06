import { z } from 'zod';
export const roomKinds = ['sala', 'cozinha', 'varanda', 'jardim'] as const;
const roomNames = [
  ['hall-hearth', 'sala', 'Sala da Lareira'],
  ['hall-library', 'sala', 'Sala do Escriba'],
  ['hall-vault', 'sala', 'Sala do Bastião'],
  ['hall-manor', 'sala', 'Sala da Vigília'],
  ['kitchen-hearth', 'cozinha', 'Cozinha do Fogo'],
  ['kitchen-manor', 'cozinha', 'Cozinha do Solar'],
  ['kitchen-herbal', 'cozinha', 'Cozinha das Ervas'],
  ['kitchen-cellar', 'cozinha', 'Cozinha da Adega'],
  ['porch-pines', 'varanda', 'Varanda dos Pinheiros'],
  ['porch-castle', 'varanda', 'Varanda do Bastião'],
  ['porch-vines', 'varanda', 'Varanda das Vinhas'],
  ['porch-coast', 'varanda', 'Varanda do Mar Pálido'],
  ['garden-courtyard', 'jardim', 'Pátio da Fonte'],
  ['garden-herbs', 'jardim', 'Jardim das Ervas'],
  ['garden-moon', 'jardim', 'Jardim da Lua'],
  ['garden-orchard', 'jardim', 'Pomar de Outono'],
];
export const houseTemplates = roomNames.map(([id, kind, name]) => ({
  id,
  kind,
  name,
  image: `/house/rooms/${id}.webp`,
}));
export const houseCatalog = [
  {
    id: 'rug',
    name: 'Tapete da Vigília',
    price_cp: 2500,
    description: 'Lã bordô, trama antiga e franjas gastas.',
    speech: 'Este tapete já viu mais botas do que muita estrada. Ainda aguenta as suas.',
    art: 'a worn burgundy rectangular medieval wool rug with muted geometric pattern, lying flat on floor, viewed at a shallow elevated angle',
  },
  {
    id: 'sofa',
    name: 'Sofá de Carvalho',
    price_cp: 6500,
    description: 'Carvalho entalhado e almofadas de veludo escuro.',
    speech:
      'Sente-se depois da jornada. A armadura pode ficar; as botas enlameadas, por favor, não.',
    art: 'a medieval carved oak two seat sofa with dark burgundy velvet upholstery, front three quarter view',
  },
  {
    id: 'table',
    name: 'Mesa do Viajante',
    price_cp: 3000,
    description: 'Mesa robusta para mapas, refeições e histórias.',
    speech: 'A madeira tem marcas, mas não escuta segredos. É uma boa mesa.',
    art: 'a sturdy medieval rectangular oak dining table, front three quarter view',
  },
  {
    id: 'chair',
    name: 'Cadeira do Escriba',
    price_cp: 1500,
    description: 'Cadeira alta em madeira escura.',
    speech: 'Para escrever uma carta ou discutir um plano. Só não balance nas pernas de trás.',
    art: 'a medieval high back walnut chair with simple carved back, front three quarter view',
  },
  {
    id: 'chest',
    name: 'Baú de Recordações',
    price_cp: 3500,
    description: 'Baú decorativo de carvalho com ferragens envelhecidas.',
    speech: 'Cabe muita lembrança aqui. Não prometo que caiba aquele elmo de gigante.',
    art: 'a closed medieval oak treasure chest with dark aged iron straps, front three quarter view',
  },
  {
    id: 'books',
    name: 'Livros do Caminho',
    price_cp: 1200,
    description: 'Três volumes de viagens para decorar a casa.',
    speech: 'Histórias de quem voltou. As de quem não voltou ainda estão sendo escritas.',
    art: 'three weathered medieval leather bound books stacked with a small rolled parchment, front three quarter view',
  },
  {
    id: 'lantern',
    name: 'Lanterna de Cobre',
    price_cp: 1800,
    description: 'Luz quente em cobre escurecido.',
    speech: 'Uma luz pequena muda um quarto inteiro. Esta dispensa feitiço.',
    art: 'a standing medieval aged copper lantern with warm candle glow contained inside the glass, front view',
  },
  {
    id: 'plant',
    name: 'Vaso de Alecrim',
    price_cp: 600,
    description: 'Alecrim num vaso de barro simples.',
    speech: 'Cheira a cozinha e cresce sem reclamar das histórias repetidas.',
    art: 'a terracotta pot of realistic rosemary, medieval herb plant, front view',
  },
  {
    id: 'statue',
    name: 'Sentinela de Pedra',
    price_cp: 8000,
    description: 'Pequena estátua de guardião sobre um pedestal.',
    speech: 'Guarda o jardim sem pedir soldo. Só não espere que persiga ladrões.',
    art: 'a small weathered stone statue of a medieval cloaked knight on a compact square pedestal, front three quarter view',
  },
  {
    id: 'bench',
    name: 'Banco do Jardim',
    price_cp: 2200,
    description: 'Banco de madeira escura para o pátio.',
    speech: 'Para ver o dia passar com companhia. Também funciona sem companhia.',
    art: 'a medieval weathered wooden garden bench, front three quarter view',
  },
  {
    id: 'letter',
    name: 'Carta Selada',
    price_cp: 1000,
    description: 'Escreva uma mensagem e ofereça como lembrança.',
    speech: 'A tinta é sua. Eu só cuido para o selo chegar inteiro.',
    art: 'one sealed medieval parchment envelope with aged red wax seal, front view',
  },
  {
    id: 'frame',
    name: 'Quadro de Memórias',
    price_cp: 4500,
    description: 'Moldura para uma imagem pessoal e uma dedicatória.',
    speech: 'Uma parede merece alguma coisa que você queira lembrar.',
    art: 'one empty medieval portrait frame with subtle aged copper ornament, transparent opening, rectangular upright front view',
  },
].map((item) => ({ ...item, image: `/house/items/${item.id}.webp` }));
export const placementSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['item', 'pet', 'mount']),
    ref: z.string().uuid(),
    x: z.number().min(0.02).max(0.98),
    y: z.number().min(0.08).max(0.98),
    scale: z.number().min(0.03).max(0.55),
    rotation: z.number().min(-180).max(180),
    facing: z.number().int().min(0).max(7).optional(),
    layer: z.number().int().min(0).max(300),
  })
  .strict();
export type HousePlacement = z.infer<typeof placementSchema>;
export const roomSchema = z
  .object({
    kind: z.enum(roomKinds),
    template: z.string().max(60),
    placements: z.array(placementSchema).max(100),
  })
  .strict();
export const layoutSchema = z
  .object({
    revision: z.number().int().min(0),
    name: z.string().trim().min(2).max(80),
    rooms: z.array(roomSchema).length(4),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.rooms.map((r) => r.kind)).size !== 4)
      ctx.addIssue({ code: 'custom', message: 'Escolha os quatro ambientes.' });
    const placements = v.rooms.flatMap((r) => r.placements);
    if (
      new Set(placements.map((p) => p.id)).size !== placements.length ||
      new Set(placements.map((p) => `${p.kind}:${p.ref}`)).size !== placements.length
    )
      ctx.addIssue({ code: 'custom', message: 'Cada peça só pode ocupar um lugar na casa.' });
    for (const r of v.rooms)
      if (!houseTemplates.some((t) => t.id === r.template && t.kind === r.kind))
        ctx.addIssue({ code: 'custom', message: 'Cenário inválido para este ambiente.' });
  });
export const initialHouseRooms = () =>
  roomKinds.map((kind) => ({
    kind,
    template: houseTemplates.find((t) => t.kind === kind)!.id,
    placements: [] as HousePlacement[],
  }));
export type HouseItem = {
  id: string;
  catalog_id: string;
  content: { title?: string; text?: string };
  source: string;
  has_image: boolean;
  sender_name?: string;
};
export type HouseVariant = { id: string; character_id: string; name: string };
export type HouseState = {
  gold_cp?: number;
  id: string;
  character_id: string;
  name: string;
  revision: number;
  rooms: z.infer<typeof roomSchema>[];
  is_owner: boolean;
  owner_name: string;
  inventory: HouseItem[];
  items: HouseItem[];
  companions: {
    id: string;
    kind: 'pet' | 'mount';
    name: string;
    pet_id?: string;
    mount_id?: string;
    appearance?: string;
    coat?: string;
    equipment?: string[];
  }[];
  presence: {
    user_id: string;
    character_id: string;
    name: string;
    variant_id: string | null;
    room: string;
    x: number;
    y: number;
    scale: number;
    layer: number;
  }[];
  invites: { user_id: string; name: string; status: string }[];
  messages: { id: string; name: string; body: string; created_at: string }[];
};
