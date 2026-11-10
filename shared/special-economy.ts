import { z } from 'zod';

export const minimumPrestigeLevel = 5;
export const prestigeMilestones: readonly number[] = [minimumPrestigeLevel, 9, 13, 17];
export const prestigeRewardsSchema = z
  .array(z.number().int().min(0).max(1_000_000))
  .length(20)
  .superRefine((rewards, ctx) => {
    if (rewards.slice(0, minimumPrestigeLevel - 1).some(Boolean))
      ctx.addIssue({
        code: 'custom',
        message: 'O Prestígio começa no primeiro marco, no nível 5.',
      });
    const jumps = rewards.slice(1).map((reward, i) => reward - rewards[i]);
    const ordinary = Math.max(0, ...jumps.filter((_, i) => !prestigeMilestones.includes(i + 2)));
    jumps.forEach((jump, i) => {
      if (jump < 0 || (rewards[i] > 0 && jump === 0))
        ctx.addIssue({
          code: 'custom',
          path: [i + 1],
          message: 'A recompensa precisa aumentar com o nível.',
        });
      if (prestigeMilestones.includes(i + 2) && jump <= ordinary)
        ctx.addIssue({
          code: 'custom',
          path: [i + 1],
          message: 'O salto de patente precisa ser maior que o aumento de um nível comum.',
        });
    });
  });

export const specialCurrencySchema = z.enum(['prestige', 'crystals']);
export type SpecialCurrency = z.infer<typeof specialCurrencySchema>;
export const specialOfferCategorySchema = z.enum([
  'profile_border',
  'weapon_skin',
  'prestige_weapon',
  'mount',
  'pet',
  'tower_item',
]);
export const specialOfferCategoryLabels = {
  profile_border: 'Borda de perfil',
  weapon_skin: 'Skin de arma',
  prestige_weapon: 'Arma de Prestígio',
  mount: 'Montaria',
  pet: 'Mascote',
  tower_item: 'Item de expedição',
} satisfies Record<z.infer<typeof specialOfferCategorySchema>, string>;
export const specialOfferInput = z
  .object({
    revision: z.number().int().min(0),
    category: specialOfferCategorySchema,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(2000),
    image_path: z
      .string()
      .max(250)
      .regex(/^\/(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.(?:webp|png|avif)$/i)
      .nullable(),
    target_key: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,119}$/)
      .nullable(),
    price: z.number().int().min(1).max(1_000_000),
    active: z.boolean(),
  })
  .strict();
export type SpecialOffer = z.infer<typeof specialOfferInput> & { id: string };
export type SpecialPurchase = {
  id: string;
  offer_id: string;
  price: number;
  snapshot: Pick<SpecialOffer, 'category' | 'name' | 'description' | 'image_path' | 'target_key'>;
  used_at: string | null;
};
export type SpecialShopState = {
  balance: number;
  can_edit: boolean;
  offers: SpecialOffer[];
  purchases: SpecialPurchase[];
  equipped_border?: string | null;
};
