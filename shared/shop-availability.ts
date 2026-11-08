import { permittedSource } from './content-sources.js';

/** Withdrawn offers keep their catalog rows for existing inventories and orders. */
export const withdrawnWeaponModels = [
  'laser-pistol',
  'semiautomatic-pistol',
  'revolver',
  'automatic-rifle',
  'antimatter-rifle',
  'laser-rifle',
] as const;

const withdrawnAmmunitionModels = ['energy-cell', 'modern-bullet'] as const;

export function withdrawnWeaponOffer(item: {
  id: string;
  raw_data?: {
    base_item?: string;
    ammunition_type?: string;
    age?: string;
    upstream_facts?: { age?: string };
  } | null;
}) {
  const data = item.raw_data;
  return (
    withdrawnWeaponModels.some((model) => model === item.id || model === data?.base_item) ||
    withdrawnAmmunitionModels.some(
      (model) => model === item.id || model === data?.base_item || model === data?.ammunition_type,
    ) ||
    data?.age === 'futuristic' ||
    data?.upstream_facts?.age === 'futuristic'
  );
}

export function withdrawnBookOffer(item: {
  source?: string | null;
  raw_data?: {
    upstream_source?: string;
    upstream_facts?: { source?: string };
    source_book?: string;
  } | null;
}) {
  return (
    !permittedSource(item.raw_data?.upstream_source) ||
    !permittedSource(item.raw_data?.upstream_facts?.source) ||
    /\bArcana Unleashed\b/i.test(item.raw_data?.source_book ?? item.source ?? '')
  );
}
