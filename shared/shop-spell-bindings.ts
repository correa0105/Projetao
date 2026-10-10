import dataset from './shop-spell-options.json';
import type { EquipmentMetadata } from './equipment-target.js';

export const SPELL_BINDING_SCHOOLS = ['C', 'D', 'V', 'N', 'T'] as const;
export const SPELL_SCHOOL_LABELS: Readonly<Record<string, string>> = {
  C: 'Conjuração',
  D: 'Adivinhação',
  V: 'Evocação',
  N: 'Necromancia',
  T: 'Transmutação',
};
export type SpellBindingSpec = { level: number; schools: string[] };
export type BoundSpellOption = (typeof dataset.items)[number];
export type BindableItem = { raw_data?: EquipmentMetadata | null };

export function spellBindingSpec(item: BindableItem): SpellBindingSpec | null {
  const value = item.raw_data?.spell_binding;
  if (!value || typeof value !== 'object') return null;
  const spec = value as Partial<SpellBindingSpec>;
  if (
    !Number.isInteger(spec.level) ||
    spec.level! < 0 ||
    spec.level! > 8 ||
    !Array.isArray(spec.schools) ||
    !spec.schools.length ||
    spec.schools.some(
      (x) => !SPELL_BINDING_SCHOOLS.includes(x as (typeof SPELL_BINDING_SCHOOLS)[number]),
    )
  )
    return null;
  return { level: spec.level!, schools: [...spec.schools] };
}

export function boundSpellOptions(spec: SpellBindingSpec): BoundSpellOption[] {
  return dataset.items.filter((x) => x.level === spec.level && spec.schools.includes(x.school));
}

export function selectedBoundSpell(item: BindableItem, id: string): BoundSpellOption | undefined {
  const spec = spellBindingSpec(item);
  return spec ? boundSpellOptions(spec).find((x) => x.id === id) : undefined;
}
