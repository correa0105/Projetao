import { z } from 'zod';

const cropIds = ['erva-balsamo', 'raiz-dourada'] as const;
const compostIds = ['cascas', 'composto'] as const;
type CropId = (typeof cropIds)[number];
type CompostId = (typeof compostIds)[number];

export const gardenCrops: Record<
  CropId,
  { name: string; seedCp: number; hours: number; saleCp: number; healing: boolean }
> = {
  'erva-balsamo': { name: 'Erva-bálsamo', seedCp: 500, hours: 24, saleCp: 1200, healing: true },
  'raiz-dourada': { name: 'Raiz-dourada', seedCp: 800, hours: 12, saleCp: 2000, healing: false },
};

export const gardenComposts: Record<
  CompostId,
  { name: string; costCp: number; hours: number; reductionHours: number }
> = {
  cascas: { name: 'Cascas de fruta', costCp: 300, hours: 2, reductionHours: 1 },
  composto: { name: 'Composto de folhas', costCp: 600, hours: 4, reductionHours: 2 },
};

export const gardenHealingItem = 'potion-of-healing';
export const gardenActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plant'), crop: z.enum(cropIds) }).strict(),
  z.object({ action: z.literal('water') }).strict(),
  z.object({ action: z.literal('ferment'), compost: z.enum(compostIds) }).strict(),
  z.object({ action: z.literal('fertilize') }).strict(),
  z.object({ action: z.literal('harvest'), destination: z.enum(['healing', 'sell']) }).strict(),
]);
export type GardenAction = z.infer<typeof gardenActionSchema>;

export type HouseGarden = {
  gold_cp: number;
  server_time: string;
  crop: CropId | null;
  ready_at: string | null;
  watered_at: string | null;
  fertilized: boolean;
  compost: CompostId | null;
  compost_ready_at: string | null;
};

export const gardenFurniture = [
  {
    id: 'h2-garden-bed',
    name: 'Canteiro da horta',
    category: 'Horta',
    image: '/house2/garden-20261111/balsamo-0.webp',
    width: 3,
    height: 1.8,
    price: 0,
  },
  {
    id: 'h2-garden-compost',
    name: 'Fermentador da horta',
    category: 'Horta',
    image: '/house2/garden-20261111/fermentador.webp',
    width: 1.2,
    height: 1.2,
    price: 0,
  },
];

export type GardenView = Pick<
  HouseGarden,
  'crop' | 'ready_at' | 'watered_at' | 'fertilized' | 'compost' | 'compost_ready_at' | 'server_time'
>;

export function gardenGrowthStage(garden: GardenView | null | undefined, now: number) {
  if (!garden?.crop || !garden.ready_at || !garden.watered_at) return 0;
  const end = Date.parse(garden.ready_at);
  if (now >= end) return 3;
  const start = Date.parse(garden.watered_at);
  return now - start >= (end - start) / 2 ? 2 : 1;
}

export function gardenStageImage(garden: GardenView | null | undefined, now: number) {
  const crop = garden?.crop === 'raiz-dourada' ? 'raiz' : 'balsamo';
  return `/house2/garden-20261111/${crop}-${gardenGrowthStage(garden, now)}.webp`;
}
