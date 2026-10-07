// Native material skins preserve each weapon's real silhouette and proportions.
const familyMaterials = {
  'Animated Shield': ['runic-steel', '#b29cff', 0.42, 3],
  'Arrow-Catching Shield': ['bronze', '#cbb77a', 0.4, 2],
  'Dagger of Venom': ['venom', '#7cec8d', 0.52, 3],
  'Dwarven Plate': ['bronze', '#dab97b', 0.43, 1],
  'Elven Chain': ['mithral', '#c0e6ea', 0.48, 1],
  'Glamoured Studded Leather': ['runic-steel', '#cca6ec', 0.34, 2],
  'Hammer of Thunderbolts': ['runic-steel', '#8fccff', 0.5, 4],
  'Javelin of Lightning': ['runic-steel', '#75c8ff', 0.54, 4],
  'Mace of Disruption': ['holy', '#e5daae', 0.48, 3],
  'Mace of Smiting': ['bronze', '#f8c577', 0.49, 3],
  'Mace of Terror': ['shadow', '#ad85c2', 0.48, 3],
  'Quarterstaff of the Acrobat': ['runic-steel', '#c8b2ef', 0.38, 2],
  'Scimitar of Speed': ['mithral', '#a6deff', 0.48, 3],
  'Sentinel Shield': ['holy', '#e9cf93', 0.45, 2],
  'Shield of Missile Attraction': ['shadow', '#ad97c4', 0.4, 2],
  'Shield of the Cavalier': ['bronze', '#e8b76d', 0.45, 2],
  'Spellguard Shield': ['runic-steel', '#a7caed', 0.45, 3],
  'Thunderous Greatclub': ['runic-steel', '#8abcee', 0.4, 4],
  'Trident of Fish Command': ['mithral', '#7dd4c7', 0.45, 2],
  'Adamantine Armor': ['shadow', '#878fa0', 0.36, 1],
  'Armor, +1, +2, or +3': ['runic-steel', '#87c7ff', 0.42, 2],
  'Armor of Invulnerability': ['holy', '#ffe6a1', 0.48, 2],
  'Armor of Vulnerability': ['shadow', '#bb6b8c', 0.42, 2],
  'Berserker Axe': ['shadow', '#e3482f', 0.44, 3],
  'Dancing Sword': ['runic-steel', '#bba7ff', 0.44, 3],
  Defender: ['mithral', '#b5e2ff', 0.42, 2],
  'Demon Armor': ['shadow', '#ed5a48', 0.48, 3],
  'Dragon Scale Mail': ['bronze', '#dda55c', 0.4, 1],
  'Dragon Slayer': ['bronze', '#e3ad57', 0.48, 2],
  'Dwarven Thrower': ['bronze', '#ffbf6c', 0.48, 2],
  'Energy Bow': ['runic-steel', '#4badff', 0.55, 5],
  'Flame Tongue': ['flame', '#ff8c28', 0.64, 6],
  'Frost Brand': ['frost', '#86e1ff', 0.62, 5],
  'Giant Slayer': ['bronze', '#e6c074', 0.44, 2],
  'Holy Avenger': ['holy', '#ffe6ad', 0.58, 4],
  'Luck Blade': ['mithral', '#74dcc3', 0.44, 2],
  'Mithral Armor': ['mithral', '#b9e8ff', 0.58, 1],
  'Nine Lives Stealer': ['shadow', '#b87be8', 0.53, 4],
  Oathbow: ['mithral', '#abdfef', 0.45, 3],
  'Plate Armor of Etherealness': ['mithral', '#b6b1fb', 0.5, 3],
  'Shield, +1, +2, or +3': ['runic-steel', '#8dccff', 0.44, 2],
  'Sun Blade': ['holy', '#fff0c8', 0.64, 5],
  'Sword of Life Stealing': ['shadow', '#be73e8', 0.53, 4],
  'Sword of Sharpness': ['mithral', '#d6e8ff', 0.49, 2],
  'Sword of Wounding': ['shadow', '#d56863', 0.5, 3],
  'Vicious Weapon': ['shadow', '#b681d4', 0.47, 3],
  'Vorpal Sword': ['shadow', '#dbb5ff', 0.56, 4],
  'Weapon, +1, +2, or +3': ['runic-steel', '#8fcdff', 0.44, 2],
  'Weapon of Warning': ['holy', '#ebca80', 0.45, 3],
};
const resistance = [
  [/acid|ácido/i, 'venom', '#a3de64'],
  [/cold|frio/i, 'frost', '#89daff'],
  [/fire|fogo/i, 'flame', '#ffab56'],
  [/lightning|elétrico/i, 'runic-steel', '#65bfff'],
  [/necrotic|necrótico/i, 'shadow', '#ab79da'],
  [/poison|veneno/i, 'venom', '#7fdd9a'],
  [/psychic|psíquico/i, 'shadow', '#dfa2e2'],
  [/radiant|radiante/i, 'holy', '#ffe9ac'],
  [/thunder|trovejante/i, 'runic-steel', '#a3adff'],
  [/bludgeon|contundente/i, 'bronze', '#d8b37e'],
  [/pierc|perfurante/i, 'mithral', '#c5e4f1'],
  [/slash|cortante/i, 'mithral', '#d7e3f4'],
];

const weaponFamilyMaterials = {
  'Berserker Axe': 'family-berserker-axe',
  'Dancing Sword': 'family-dancing-sword',
  Defender: 'family-defender',
  'Dragon Slayer': 'family-dragon-slayer',
  'Giant Slayer': 'family-giant-slayer',
  'Hammer of Thunderbolts': 'family-hammer-thunderbolts',
  'Holy Avenger': 'family-holy-avenger',
  'Luck Blade': 'family-luck-blade',
  'Nine Lives Stealer': 'family-nine-lives-stealer',
  Oathbow: 'family-oathbow',
  'Sword of Life Stealing': 'family-sword-life-stealing',
  'Sword of Sharpness': 'family-sword-sharpness',
  'Sword of Wounding': 'family-sword-wounding',
  'Vicious Weapon': 'family-vicious-weapon',
  'Vorpal Sword': 'family-vorpal-sword',
  'Weapon, +1, +2, or +3': 'family-weapon-enhancement',
  'Weapon of Warning': 'family-weapon-warning',
};
const illustratedVariants = {
  'energy-bow-shortbow':
    'compact ornate energy shortbow with blue runes, taut energy string and one straight blue energy arrow',
  'belt-of-giant-strength-frost-stone':
    'granite and icy silver giant strength belt with pale blue gemstone',
  'belt-of-giant-strength-fire':
    'black forged steel and copper fire giant belt with ember gemstone',
  'belt-of-giant-strength-cloud':
    'cream leather and gold cloud giant belt with white opal gemstone',
  'belt-of-giant-strength-storm':
    'midnight blue leather and silver storm giant belt with sapphire lightning gemstone',
};

export function magicSkinProfile(item) {
  const raw = item.raw_data || {};
  let value = familyMaterials[raw.magic_family];
  if (raw.magic_family === 'Armor of Resistance') {
    const found = resistance.find(([regex]) => regex.test(raw.damage_type || item.name));
    value = found ? [found[1], found[2], 0.44, 2] : ['runic-steel', '#abc7ef', 0.44, 2];
  }
  if (!value) return null;
  const [material, color, opacity, glow] = value;
  const bonus = Number(raw.enhancement || 0);
  return {
    material: weaponFamilyMaterials[raw.magic_family] || material,
    color,
    opacity: opacity + bonus * 0.025,
    glow: glow + bonus * 0.4,
  };
}

export function assignMagicSkins(items, old = []) {
  const all = new Map([...items, ...old].map((x) => [x.id, x]));
  for (const item of items) {
    const raw = item.raw_data || {};
    if (illustratedVariants[item.id]) {
      item.image_path = `/shop/magic-skins/${item.id}.webp`;
      delete raw.art_source_id;
      delete raw.magic_skin;
      item.art = { subject: illustratedVariants[item.id], material: 'metal' };
      continue;
    }
    if (!raw.base_item || !raw.magic_family) continue;
    const base = all.get(raw.base_item);
    if (!base) throw Error(`Unknown magical equipment model: ${raw.base_item}`);
    let reference = base.image_path || `/shop/items/${base.id}.png`;
    const ownArtwork =
      !raw.magic_skin && item.image_path !== reference && raw.art_source_id !== base.id;
    if (ownArtwork && !weaponFamilyMaterials[raw.magic_family]) continue;
    const profile = magicSkinProfile(item);
    if (!profile) throw Error(`Missing skin for magical family: ${raw.magic_family}`);
    if (ownArtwork) reference = item.image_path;
    else if (raw.magic_skin?.reference) reference = raw.magic_skin.reference;
    const coating = ownArtwork ? 0.32 : (raw.magic_skin?.coating ?? 1);
    raw.magic_skin = {
      ...profile,
      opacity: profile.opacity * coating,
      coating,
      reference,
      texture: `/shop/magic-materials/${profile.material}.webp`,
    };
    item.image_path = `/shop/magic-skins/${item.id}.svg`;
  }
  return items;
}
