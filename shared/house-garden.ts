import { z } from 'zod';

const cropIds = ['erva-balsamo', 'raiz-dourada'] as const;
const compostIds = ['cascas', 'composto'] as const;
type CropId = (typeof cropIds)[number];
type CompostId = (typeof compostIds)[number];

export const gardenCrops: Record<
  CropId,
  { name: string; seedCp: number; hours: number; saleCp: number; healing: boolean }
> = {
  'erva-balsamo': { name: 'Erva-bálsamo', seedCp: 500, hours: 8, saleCp: 1200, healing: true },
  'raiz-dourada': { name: 'Raiz-dourada', seedCp: 800, hours: 12, saleCp: 2000, healing: false },
};

export const gardenComposts: Record<
  CompostId,
  { name: string; costCp: number; hours: number; reductionHours: number }
> = {
  cascas: { name: 'Cascas de fruta', costCp: 300, hours: 2, reductionHours: 2 },
  composto: { name: 'Composto de folhas', costCp: 600, hours: 4, reductionHours: 4 },
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
  fertilized: boolean;
  compost: CompostId | null;
  compost_ready_at: string | null;
};
