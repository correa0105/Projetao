import { defaultPositions, defaultShelfRows, type ShelfConfig } from './achievements.js';

/** Array order is the saved drawing order: the last item is in front. */
export function reorderShelfPiece(config: ShelfConfig, index: number, direction: 'front' | 'back') {
  if (index < 0 || index >= config.slots.length) return { config, selected: index };
  const order = config.slots.map((_, i) => i).filter((i) => i !== index);
  if (direction === 'front') order.push(index);
  else order.unshift(index);
  const positions = config.positions ?? defaultPositions(config.slots.length);
  const rows = config.rows ?? defaultShelfRows(config.slots.length);
  return {
    config: {
      ...config,
      slots: order.map((i) => config.slots[i]),
      positions: order.map((i) => positions[i]),
      rows: order.map((i) => rows[i]),
    },
    selected: order.indexOf(index),
  };
}
