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

export function withdrawnWeaponOffer(item: { id: string; raw_data?: { base_item?: string } }) {
  return withdrawnWeaponModels.some(
    (model) => model === item.id || model === item.raw_data?.base_item,
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
