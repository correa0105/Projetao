// Mechanical-data helpers. Upstream narrative and artwork are never published.
import assert from 'node:assert/strict';
export const magicFactsKeys = [
  'name',
  'source',
  'page',
  'rarity',
  'type',
  'wondrous',
  'staff',
  'weapon',
  'armor',
  'baseItem',
  'reqAttune',
  'reqAttuneTags',
  'weight',
  'value',
  'charges',
  'recharge',
  'rechargeAmount',
  'bonusWeapon',
  'bonusWeaponAttack',
  'bonusWeaponDamage',
  'bonusSpellAttack',
  'bonusSpellSaveDc',
  'bonusSpellDamage',
  'bonusAc',
  'bonusSavingThrow',
  'bonusProficiencyBonus',
  'ability',
  'resist',
  'immune',
  'vulnerable',
  'conditionImmune',
  'attachedSpells',
  'grantsProficiency',
  'grantsLanguage',
  'grantsSense',
  'dmg1',
  'dmg2',
  'dmgType',
  'property',
  'range',
  'ac',
  'stealth',
  'strength',
  'curse',
  'sentient',
  'srd',
  'srd52',
  'basicRules2024',
  'age',
  'edition',
  'modifySpeed',
  'light',
  'spellScrollLevel',
];
export const magicFacts = (x) =>
  Object.fromEntries(magicFactsKeys.filter((k) => x[k] !== undefined).map((k) => [k, x[k]]));
export const nameKey = (name) =>
  String(name)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/potions/g, 'potion')
    .replace(/stones/g, 'stone')
    .match(/[a-z0-9]+/g)
    ?.sort()
    .join(' ') || '';
// Matches Renderer.item.isMundane's rarity distinction; unknown (magic) remains magic.
export const isMagic = (x) => Boolean(x.rarity) && !['none', 'unknown'].includes(x.rarity);
export function resolveCopies(records) {
  const registry = new Map(records.map((x) => [`${x.name}|${x.source || x.inherits?.source}`, x]));
  function resolve(x, seen = new Set()) {
    if (!x._copy) return structuredClone(x);
    const id = `${x.name}|${x.source || x.inherits?.source}`;
    assert(!seen.has(id), 'Cyclic item ' + id);
    seen.add(id);
    const base = registry.get(`${x._copy.name}|${x._copy.source}`);
    assert(base, 'Unresolved copy ' + id);
    const copied = resolve(base, seen);
    // Page/licence/reprint metadata belongs to the copied record only when
    // upstream explicitly preserves it. It is not an inherited game statistic.
    for (const key of [
      'page',
      'otherSources',
      'referenceSources',
      'srd',
      'srd52',
      'basicRules',
      'basicRules2024',
      'reprintedAs',
      'hasFluff',
      'hasFluffImages',
      'hasToken',
      'tokenCredit',
      'tokenCustom',
      'foundryTokenScale',
      'altArt',
      '_versions',
      'lootTables',
      'tier',
    ]) {
      if (x[key] === undefined && !x._copy._preserve?.['*'] && !x._copy._preserve?.[key])
        delete copied[key];
    }
    const result = { ...copied, ...structuredClone(x) };
    for (const [path, spec] of Object.entries(x._copy._mod || {})) {
      // Prose modifications are irrelevant to this fact-only pipeline.
      if (/(?:^|\.)(?:entries|additionalEntries)(?:\.|$)/.test(path)) continue;
      const parts = path.split('.'),
        prop = parts.pop();
      let target = result;
      for (const part of parts) target = target[part] ||= {};
      const mods = Array.isArray(spec) ? spec : [spec];
      for (const mod of mods) {
        if (mod === 'remove') {
          delete target[prop];
          continue;
        }
        if (mod.mode === 'setProp') {
          target[prop] = structuredClone(mod.value);
          continue;
        }
        if (['appendIfNotExistsArr', 'appendArr'].includes(mod.mode)) {
          const current = target[prop] || [],
            adds = Array.isArray(mod.items) ? mod.items : [mod.items];
          target[prop] = [
            ...current,
            ...adds.filter(
              (v) =>
                mod.mode === 'appendArr' ||
                !current.some((w) => JSON.stringify(w) === JSON.stringify(v)),
            ),
          ];
          continue;
        }
        throw Error('Unsupported mechanical copy modification ' + id + ' ' + path + ' ' + mod.mode);
      }
    }
    return result;
  }
  return records.map((x) => resolve(x));
}
// Requirements are alternatives; each alternative requires every field. An
// exclusion rejects when any field matches, including nested/array fields.
export function matchFields(candidate, requirements, every = true) {
  if (candidate == null || requirements == null) return false;
  const results = Object.entries(requirements).map(([k, v]) => {
    const actual = candidate[k];
    if (Array.isArray(v))
      return Array.isArray(actual) ? actual.some((a) => v.includes(a)) : v.includes(actual);
    if (v && typeof v === 'object') return matchFields(actual, v, every);
    return Array.isArray(actual) ? actual.includes(v) : actual === v;
  });
  return every ? results.every(Boolean) : results.some(Boolean);
}
export function acceptsBase(base, variant) {
  return (
    !base.packContents &&
    (variant.requires || []).some((r) => matchFields(base, r)) &&
    !matchFields(base, variant.excludes, false)
  );
}
