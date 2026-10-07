import ids from '../shared/shop-thematic-skin-ids.json';

const thematic = new Set<string>(ids);

export function thematicModelLabel(model: { label: string; variants: readonly { id: string }[] }) {
  return model.variants.some((variant) => thematic.has(variant.id))
    ? `${model.label} – SKIN TEMÁTICA`
    : model.label;
}
