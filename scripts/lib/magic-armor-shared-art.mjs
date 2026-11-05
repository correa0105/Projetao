import assert from 'node:assert/strict';

// The owner chose one +1 drawing per physical armor model for all three bonuses.
export function magicArmorSharedArt(items) {
  const models = [...items.values()].filter(item => item.raw_data?.magic_family === 'Armor, +1, +2, or +3');
  const sources = new Map();
  for (const item of models) {
    const source = models.find(candidate => candidate.raw_data.base_item === item.raw_data.base_item && candidate.raw_data.enhancement === 1);
    assert(source, 'Missing +1 armor artwork source: ' + item.id);
    if (item.id === source.id) continue;
    for (const suffix of ['', '--head', '--shoulders', '--bracers', '--legs', '--feet'])
      sources.set(item.id + suffix, source.id + suffix);
  }
  return sources;
}
