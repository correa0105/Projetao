import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = 'data/vtt/srd-2024.json';
const { spells } = JSON.parse(await fs.readFile(source, 'utf8'));
const words = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  twenty: 20,
};
const number = (s) => Number(s) || words[s.toLowerCase()] || 1;
const names = (s) => s.split('|');
const self = new Set(
  names(
    'Comprehend Languages|Disguise Self|Divine Favor|Divine Smite|Ensnaring Strike|Expeditious Retreat|False Life|Goodberry|Searing Smite|Shield|Speak with Animals|Alter Self|Augury|Blur|Detect Thoughts|Flame Blade|Locate Animals or Plants|Locate Object|Mirror Image|Rope Trick|See Invisibility|Shining Smite|Blink|Meld into Stone|Sending|Vampiric Touch|Fire Shield|Locate Creature|Secret Chest|Commune|Commune with Nature|Contact Other Plane|Dispel Evil and Good|Dream|Legend Lore|Mislead|Tree Stride|Contingency|Eyebite|Find the Path|Forbiddance|Guards and Wards|Instant Summons|Magic Jar|Etherealness|Mirage Arcane|Glibness|Control Weather|Shapechange|Time Stop|Wish|Produce Flame|Shillelagh|True Strike',
  ),
);
const touch = new Set(
  names(
    "Chill Touch|Guidance|Light|Mending|Resistance|Shocking Grasp|Cure Wounds|Heroism|Identify|Inflict Wounds|Jump|Longstrider|Mage Armor|Protection from Evil and Good|Barkskin|Darkvision|Dragon's Breath|Enhance Ability|Gentle Repose|Invisibility|Lesser Restoration|Magic Weapon|Protection from Poison|Spider Climb|Warding Bond|Bestow Curse|Fly|Gaseous Form|Nondetection|Protection from Energy|Remove Curse|Revivify|Tongues|Death Ward|Freedom of Movement|Greater Invisibility|Stoneskin|Awaken|Greater Restoration|Raise Dead|Reincarnate|True Seeing|Regenerate|Resurrection|Sequester|Simulacrum|Clone|Mind Blank|Foresight|True Resurrection",
  ),
);
const patches = {};
const patch = (list, p) => names(list).forEach((n) => (patches[n] = { ...patches[n], ...p }));
patch('Bane|Bless', { mode: 'targets', count: 3 });
patch('Aid', { mode: 'targets', count: 3 });
patch('Feather Fall|Prayer of Healing', { mode: 'targets', count: 5 });
patch('Mass Healing Word|Mass Cure Wounds|Slow', { mode: 'targets', count: 6 });
patch('Water Breathing|Water Walk', { mode: 'targets', count: 10 });
patch('Mass Suggestion', { mode: 'targets', count: 12 });
patch(
  'Animal Shapes|Mass Heal|Animal Friendship|Beacon of Hope|Compulsion|Enthrall|Seeming|Divine Word',
  { mode: 'targets', count: 100 },
);
patch('Animal Friendship', { count: 1 });
patch('Magic Missile', { mode: 'targets', count: 3, repeat: true, increment: 1 });
patch('Scorching Ray', { mode: 'targets', count: 3, repeat: true, increment: 1 });
patch('Eldritch Blast', { mode: 'targets', count: 1, repeat: true, cantripBeams: true });
patch('Chromatic Orb', { mode: 'targets', count: 2, chain: 30, conditional: true, increment: 1 });
patch('Chain Lightning', { mode: 'targets', count: 4, chain: 30, increment: 1 });
patch('Animate Dead', {
  mode: 'targets',
  count: 1,
  increment: 2,
  alternatives: [
    { label: 'Animar', count: 1 },
    { label: 'Reafirmar controle', count: 4 },
  ],
});
patch('Create Undead', {
  mode: 'targets',
  count: 3,
  undead: true,
  alternatives: [
    { label: 'Ghouls', count: 3 },
    { label: 'Ghasts / Wights', count: 2, minSlot: 8 },
    { label: 'Mummies', count: 2, minSlot: 9 },
  ],
});
patch('Animate Objects', { mode: 'targets', count: 1, objectBudget: true });
patch('Wind Walk', { mode: 'targets', count: 11, includeSelf: true });
patch('Teleport|Plane Shift|Astral Projection', { mode: 'targets', count: 9, includeSelf: true });
patch('Telepathic Bond', { mode: 'targets', count: 8 });
patch('Word of Recall', { mode: 'targets', count: 6, includeSelf: true, range: 5 });
patch('Dimension Door', {
  mode: 'targets',
  count: 2,
  includeSelf: true,
  range: 5,
  destinationRange: 500,
});
patch('Misty Step', { mode: 'point', range: 30, size: 5, shape: 'cube' });
patch('Dancing Lights', { mode: 'area', shape: 'sphere', size: 2.5, areas: 4 });
patch('Fire Storm', { mode: 'area', shape: 'cube', size: 10, areas: 10, contiguous: true });
patch('Meteor Swarm', { mode: 'area', shape: 'sphere', size: 40, areas: 4, exactAreas: true });
patch("Dragon's Breath", {
  mode: 'targets',
  count: 1,
  shape: null,
  size: 0,
  breath: { shape: 'cone', size: 15 },
});
patch('Conjure Animals', { mode: 'area', shape: 'sphere', size: 10, range: 60, movable: true });
patch(
  'Find Familiar|Find Steed|Faithful Hound|Guardian of Faith|Giant Insect|Conjure Elemental|Conjure Fey|Summon Dragon|Planar Ally',
  { mode: 'point', size: 5, shape: 'cube' },
);
patch('Arcane Hand', { mode: 'point', shape: 'cube', size: 10, movable: true });
patch('Arcane Eye|Mage Hand|Unseen Servant|Spiritual Weapon|Arcane Sword', {
  mode: 'point',
  shape: 'cube',
  size: 5,
  movable: true,
});
patch('Call Lightning', { mode: 'area', shape: 'sphere', size: 60 });
patch('Black Tentacles', { mode: 'area', shape: 'cube', size: 20 });
patch('Grease', { mode: 'area', shape: 'cube', size: 10 });
patch('Entangle', { mode: 'area', shape: 'cube', size: 20 });
patch('Private Sanctum', { mode: 'area', shape: 'cube', size: 100, sizeIncrement: 100 });
patch('Creation', { mode: 'area', shape: 'cube', size: 5, sizeIncrement: 5 });
patch('Create or Destroy Water', { mode: 'area', shape: 'cube', size: 30, sizeIncrement: 5 });
patch('Control Water', { mode: 'area', shape: 'cube', size: 100 });
patch('Move Earth', { mode: 'area', shape: 'cube', size: 40 });
patch('Forcecage', {
  mode: 'area',
  shape: 'cube',
  size: 20,
  alternatives: [
    { label: 'Grade', size: 20 },
    { label: 'Caixa', size: 10 },
  ],
});
patch('Fireball|Delayed Blast Fireball', { mode: 'area', shape: 'sphere', size: 20 });
patch('Fog Cloud', { sizeIncrement: 20 });
patch('Confusion', { sizeIncrement: 5 });
patch('Sunbeam|Lightning Bolt|Gust of Wind', { mode: 'area', shape: 'line', origin: 'caster' });
patch('Lightning Bolt', { size: 100, width: 5 });
patch('Gust of Wind', { size: 60, width: 10, movable: true });
patch('Sunbeam', { size: 60, width: 5 });
patch('Burning Hands|Color Spray|Fear|Cone of Cold|Prismatic Spray', {
  mode: 'area',
  shape: 'cone',
  origin: 'caster',
});
patch('Thunderwave', { mode: 'area', shape: 'cube', size: 15, origin: 'caster-face' });
patch('Detect Magic|Detect Evil and Good|Detect Poison and Disease', {
  mode: 'self',
  shape: 'sphere',
  size: 30,
  follow: true,
});
patch('Pass without Trace|Aura of Life|Holy Aura', {
  mode: 'self',
  shape: 'sphere',
  size: 30,
  follow: true,
});
patch('Spirit Guardians|Conjure Minor Elementals', {
  mode: 'self',
  shape: 'sphere',
  size: 15,
  follow: true,
});
patch('Conjure Woodland Beings|Antilife Shell|Antimagic Field|Globe of Invulnerability', {
  mode: 'self',
  shape: 'sphere',
  size: 10,
  follow: true,
});
patch('Tiny Hut', { mode: 'self', shape: 'sphere', size: 10, follow: false });
patch('Speak with Plants', { mode: 'self', shape: 'sphere', size: 30, follow: false });
patch('Wall of Fire', {
  mode: 'area',
  shape: 'wall',
  size: 60,
  width: 1,
  alternatives: [
    { label: 'Parede', shape: 'wall', size: 60, width: 1 },
    { label: 'Anel', shape: 'ring', size: 10, width: 1 },
  ],
});
patch('Wind Wall', { mode: 'area', shape: 'wall', size: 50, width: 1 });
patch('Blade Barrier', {
  mode: 'area',
  shape: 'wall',
  size: 100,
  width: 5,
  alternatives: [
    { label: 'Parede', shape: 'wall', size: 100, width: 5 },
    { label: 'Anel', shape: 'ring', size: 30, width: 5 },
  ],
});
patch('Wall of Thorns', {
  mode: 'area',
  shape: 'wall',
  size: 60,
  width: 5,
  alternatives: [
    { label: 'Parede', shape: 'wall', size: 60, width: 5 },
    { label: 'Anel', shape: 'ring', size: 10, width: 5 },
  ],
});
patch('Prismatic Wall', {
  mode: 'area',
  shape: 'wall',
  size: 90,
  width: 1 / 12,
  alternatives: [
    { label: 'Parede', shape: 'wall', size: 90, width: 1 / 12 },
    { label: 'Globo', shape: 'sphere', size: 15 },
  ],
});
patch('Wall of Force|Wall of Stone|Wall of Ice', {
  mode: 'area',
  shape: 'cube',
  size: 10,
  areas: 10,
  contiguous: true,
});
patch('Wall of Force', {
  alternatives: [
    { label: 'Painéis', shape: 'cube', size: 10, areas: 10 },
    { label: 'Globo', shape: 'sphere', size: 10, areas: 1 },
  ],
});
patch('Wall of Ice', {
  alternatives: [
    { label: 'Painéis', shape: 'cube', size: 10, areas: 10 },
    { label: 'Globo', shape: 'sphere', size: 10, areas: 1 },
  ],
});
patch('Tsunami', { mode: 'area', shape: 'wall', size: 300, width: 50 });
patch('Earthquake', { mode: 'area', shape: 'sphere', size: 100 });
patch('Storm of Vengeance', { mode: 'area', shape: 'sphere', size: 300 });
patch('Flaming Sphere', { mode: 'area', shape: 'sphere', size: 2.5, movable: true });
patch('Slow', { shape: 'cube', size: 40 });
patch('Plant Growth', {
  alternatives: [
    { label: 'Crescimento imediato', shape: 'sphere', size: 100 },
    { label: 'Enriquecer terreno (8 horas)', shape: 'sphere', size: 2640 },
  ],
});
patch('Etherealness', { ethereal: true });
patch('Enlarge/Reduce|Polymorph|True Polymorph', { alternatives: [{ label: 'Transformar' }] });
// Explicit placement rules for utility spells whose descriptions mention areas
// belonging to a later activation or an interior, rather than the initial cast.
patch('Phantasmal Force', {mode:'targets',shape:null,size:0,count:1});
patch('Floating Disk', {mode:'point',shape:'sphere',size:1.5,movable:true});
patch('Phantom Steed', {mode:'point',shape:'cube',size:10});
patch('Clairvoyance|Project Image', {mode:'point',shape:'cube',size:5});
patch('Create Food and Water', {mode:'point',shape:'cube',size:5});
patch('Find Traps', {mode:'self',range:120,shape:'sphere',size:120,follow:true});
patch('Detect Thoughts', {mode:'self',range:30,shape:'sphere',size:30,follow:true});
patch('Teleportation Circle', {mode:'point',shape:'sphere',size:5});
patch('Transport via Plants', {mode:'point',shape:'cube',size:5});
patch('Gate', {mode:'point',shape:'sphere',size:10});
patch('Demiplane|Magnificent Mansion', {mode:'point',shape:'cube',size:5});
patch('Passwall', {mode:'point',shape:'cube',size:5});
patch('Reverse Gravity', {mode:'area',shape:'sphere',size:50});
patch('Hallow', {mode:'area',shape:'sphere',size:60});
patch('Forbiddance', {mode:'area',shape:'cube',size:200,follow:false});
patch('Guards and Wards', {mode:'area',shape:'cube',size:50,follow:false});
patch('Mirage Arcane', {mode:'area',shape:'cube',size:5280,follow:false});
patch('Control Weather', {mode:'self',shape:'sphere',size:26400,follow:false});
patch('Contagion', {mode:'targets',shape:null,size:0,count:1});
patch('Prestidigitation|Thaumaturgy', {mode:'point',shape:'cube',size:5});
patch('Arcanist\'s Magic Aura', {mode:'targets',shape:null,size:0,count:1});
patch('Divination|Scrying', {mode:'self',shape:null,size:0,follow:true});
patch('Moonbeam|Cloudkill|Incendiary Cloud|Conjure Celestial|Silent Image|Major Image', {movable:true});
patch('Ice Knife', {mode:'targets',shape:'sphere',size:5,areaFromTargets:true});
patch('Chromatic Orb', {chainFromLast:true});
patch('Dragon\'s Breath', {alternatives:[{label:'Fogo',element:'fire'},{label:'Gelo',element:'frost'},{label:'Eletricidade',element:'lightning'},{label:'Ácido',element:'acid'},{label:'Veneno',element:'poison'}]});

const families = [
  [
    'fire',
    '#e88737',
    '#fff4bd',
    'Fire Bolt|Burning Hands|Fireball|Delayed Blast Fireball|Flame Blade|Flaming Sphere|Flame Strike|Fire Shield|Hellish Rebuke|Searing Smite|Continual Flame|Produce Flame|Wall of Fire|Fire Storm|Incendiary Cloud|Meteor Swarm',
  ],
  [
    'frost',
    '#83cfe9',
    '#f4fbff',
    'Ray of Frost|Ice Knife|Ice Storm|Cone of Cold|Freezing Sphere|Sleet Storm|Wall of Ice',
  ],
  [
    'lightning',
    '#78b5ff',
    '#f1edff',
    "Shocking Grasp|Lightning Bolt|Chain Lightning|Call Lightning|Storm of Vengeance|Dragon's Breath",
  ],
  ['acid', '#a4d857', '#f7ffb6', 'Acid Splash|Acid Arrow|Vitriolic Sphere'],
  [
    'poison',
    '#8eaf58',
    '#e0e797',
    'Poison Spray|Ray of Sickness|Stinking Cloud|Cloudkill|Contagion|Protection from Poison|Detect Poison and Disease',
  ],
  [
    'heal',
    '#e8cc88',
    '#fff8d6',
    "Cure Wounds|Healing Word|Mass Healing Word|Mass Cure Wounds|Heal|Mass Heal|Power Word Heal|Lesser Restoration|Greater Restoration|Regenerate|Revivify|Raise Dead|Reincarnate|Resurrection|True Resurrection|Spare the Dying|Prayer of Healing|Aid|Aura of Life|Beacon of Hope|Goodberry|Heroes' Feast",
  ],
  [
    'radiant',
    '#f2d695',
    '#fff5cf',
    'Sacred Flame|Starry Wisp|Guiding Bolt|Divine Favor|Divine Smite|Shining Smite|Sunbeam|Sunburst|Daylight|Light|Dancing Lights|Holy Aura|Guardian of Faith|Conjure Celestial|Spirit Guardians|Divine Word',
  ],
  [
    'nature',
    '#6bae76',
    '#dbeac1',
    'Druidcraft|Shillelagh|Entangle|Ensnaring Strike|Spike Growth|Plant Growth|Wall of Thorns|Barkskin|Commune with Nature|Tree Stride|Transport via Plants|Speak with Plants|Conjure Woodland Beings|Conjure Animals|Awaken|Animal Shapes|Animal Friendship|Animal Messenger|Speak with Animals|Giant Insect|Insect Plague',
  ],
  [
    'necrotic',
    '#925ba8',
    '#d6b7da',
    "Chill Touch|Inflict Wounds|Hex|Hunter's Mark|Vampiric Touch|Animate Dead|Create Undead|Circle of Death|Finger of Death|Harm|Blight|Bestow Curse|Gentle Repose|Death Ward|False Life|Power Word Kill|Magic Jar|Clone",
  ],
  [
    'psychic',
    '#c088c0',
    '#f4d8ed',
    'Vicious Mockery|Dissonant Whispers|Mind Spike|Hideous Laughter|Charm Person|Charm Monster|Bane|Command|Hold Person|Hold Monster|Suggestion|Mass Suggestion|Dominate Beast|Dominate Person|Dominate Monster|Detect Thoughts|Calm Emotions|Compulsion|Confusion|Enthrall|Fear|Phantasmal Killer|Weird|Befuddlement|Power Word Stun|Irresistible Dance|Modify Memory|Mind Blank|Antipathy/Sympathy',
  ],
  [
    'illusion',
    '#ab97e6',
    '#e7dcff',
    "Minor Illusion|Silent Image|Major Image|Programmed Illusion|Hypnotic Pattern|Color Spray|Disguise Self|Alter Self|Blur|Mirror Image|Invisibility|Greater Invisibility|Phantasmal Force|Hallucinatory Terrain|Mislead|Seeming|Project Image|Mirage Arcane|Simulacrum|Illusory Script|Arcanist's Magic Aura",
  ],
  [
    'portal',
    '#8cc8c2',
    '#f0e3fa',
    'Misty Step|Dimension Door|Teleport|Teleportation Circle|Plane Shift|Gate|Word of Recall|Blink|Etherealness|Demiplane|Magnificent Mansion|Banishment|Maze|Secret Chest|Rope Trick|Astral Projection|Summon Dragon|Find Familiar|Find Steed|Planar Ally|Conjure Fey|Conjure Elemental|Conjure Minor Elementals',
  ],
  [
    'water',
    '#72b8d3',
    '#c5f3ee',
    'Create or Destroy Water|Water Breathing|Water Walk|Control Water|Tsunami|Fog Cloud|Gaseous Form',
  ],
  [
    'wind',
    '#b0cdd4',
    '#e9f9f2',
    'Gust of Wind|Wind Wall|Wind Walk|Fly|Feather Fall|Levitate|Jump|Longstrider|Expeditious Retreat|Freedom of Movement|Haste|Spider Climb',
  ],
  [
    'earth',
    '#bea77f',
    '#e5d5b5',
    'Stone Shape|Stoneskin|Flesh to Stone|Wall of Stone|Move Earth|Earthquake|Meld into Stone|Passwall|Grease|Fabricate|Creation|Mending',
  ],
  ['time', '#8cbdbb', '#f3e4bb', 'Slow|Time Stop|Foresight|Contingency'],
  [
    'ward',
    '#a8c0e2',
    '#f9edc9',
    'Shield|Shield of Faith|Mage Armor|Sanctuary|Protection from Evil and Good|Protection from Energy|Dispel Evil and Good|Globe of Invulnerability|Antilife Shell|Antimagic Field|Tiny Hut|Magic Circle|Hallow|Forbiddance|Private Sanctum|Guards and Wards|Alarm|Arcane Lock|Nondetection|Sequester|Warding Bond|Resistance|Bless',
  ],
  [
    'divination',
    '#89bdd6',
    '#efdca4',
    'Guidance|Detect Magic|Detect Evil and Good|Identify|Augury|Clairvoyance|Arcane Eye|See Invisibility|True Seeing|Find Traps|Find the Path|Locate Animals or Plants|Locate Object|Locate Creature|Divination|Commune|Contact Other Plane|Scrying|Legend Lore|Dream|Sending|Message|Comprehend Languages|Tongues|Telepathic Bond|Speak with Dead|Glibness|Zone of Truth',
  ],
  [
    'force',
    '#b39ae4',
    '#f1e1ff',
    'Eldritch Blast|Magic Missile|Sorcerous Burst|Chromatic Orb|Spiritual Weapon|Arcane Sword|Arcane Hand|Mage Hand|Unseen Servant|Floating Disk|Magic Weapon|True Strike|Disintegrate|Resilient Sphere|Wall of Force|Forcecage|Telekinesis|Animate Objects|Enlarge/Reduce|Polymorph|True Polymorph|Shapechange|Reverse Gravity|Imprisonment|Prestidigitation|Elementalism|Thaumaturgy|Wish|Counterspell|Dispel Magic|Knock|Magic Mouth|Instant Summons|Purify Food and Drink|Create Food and Water|Enhance Ability|Symbol|Glyph of Warding|Web|Black Tentacles|Prismatic Spray|Prismatic Wall|Thunderwave|Shatter|Silence|Planar Binding|Geas',
  ],
];
families.push(
  ['radiant', '#e9d990', '#fff8da', 'Faerie Fire|Moonbeam'],
  ['ward', '#b8c9e0', '#fff0cc', 'Heroism|Remove Curse|Faithful Hound'],
  ['psychic', '#b094c7', '#f0ddf2', 'Sleep|Blindness/Deafness|Eyebite'],
  ['necrotic', '#8667ab', '#d6c4e8', 'Darkness|Ray of Enfeeblement'],
  ['divination', '#95c1cf', '#e7f1e9', 'Darkvision'],
  ['fire', '#e8a054', '#fff1bf', 'Scorching Ray|Heat Metal'],
  ['nature', '#81ac8e', '#e3eac5', 'Pass without Trace'],
  ['portal', '#98b7c9', '#e8def0', 'Phantom Steed'],
  ['force', '#b4a3d5', '#f5efff', 'Blade Barrier'],
  ['wind', '#a8bfd1', '#f0f7ef', 'Control Weather'],
);
const specialMotifs = {
  Fireball: ['ember', 'shockwave'],
  'Burning Hands': ['flame', 'ember'],
  'Fire Bolt': ['flame', 'comet'],
  'Meteor Swarm': ['meteor', 'impact'],
  'Flame Strike': ['column', 'flame'],
  'Wall of Fire': ['flame', 'barrier'],
  'Flaming Sphere': ['vortex', 'flame'],
  'Delayed Blast Fireball': ['bead', 'ember'],
  'Incendiary Cloud': ['smoke', 'ember'],
  'Ray of Frost': ['crystal', 'comet'],
  'Ice Knife': ['blade', 'crystal'],
  'Cone of Cold': ['crystal', 'mist'],
  'Ice Storm': ['hail', 'crystal'],
  'Wall of Ice': ['barrier', 'crystal'],
  'Freezing Sphere': ['crystal', 'shockwave'],
  'Sleet Storm': ['hail', 'mist'],
  'Lightning Bolt': ['bolt', 'branch'],
  'Chain Lightning': ['branch', 'bolt'],
  'Call Lightning': ['storm', 'bolt'],
  'Storm of Vengeance': ['storm', 'hail'],
  'Shocking Grasp': ['hand', 'bolt'],
  'Magic Missile': ['comet', 'rune'],
  'Eldritch Blast': ['lance', 'vortex'],
  'Scorching Ray': ['lance', 'ember'],
  'Acid Arrow': ['arrow', 'droplet'],
  'Acid Splash': ['droplet', 'splash'],
  'Vitriolic Sphere': ['splash', 'vortex'],
  Entangle: ['vine', 'leaf'],
  'Ensnaring Strike': ['chain', 'vine'],
  'Spike Growth': ['thorn', 'vine'],
  'Wall of Thorns': ['barrier', 'thorn'],
  Web: ['web', 'filament'],
  'Black Tentacles': ['tentacle', 'vortex'],
  'Spirit Guardians': ['spirit', 'halo'],
  'Spiritual Weapon': ['blade', 'halo'],
  'Arcane Sword': ['blade', 'rune'],
  'Arcane Hand': ['hand', 'rune'],
  'Mage Hand': ['hand', 'filament'],
  'Cure Wounds': ['petal', 'halo'],
  'Healing Word': ['wave', 'petal'],
  'Mass Heal': ['halo', 'constellation'],
  Revivify: ['phoenix', 'halo'],
  Regenerate: ['vine', 'petal'],
  'Lesser Restoration': ['petal', 'droplet'],
  'Greater Restoration': ['halo', 'phoenix'],
  Bless: ['star', 'halo'],
  Bane: ['sigil', 'chain'],
  Shield: ['shield', 'impact'],
  'Shield of Faith': ['shield', 'halo'],
  'Mage Armor': ['armor', 'rune'],
  'Magic Circle': ['rune', 'barrier'],
  'Globe of Invulnerability': ['shell', 'rune'],
  'Hold Person': ['chain', 'sigil'],
  'Hold Monster': ['chain', 'eye'],
  Sleep: ['crescent', 'star'],
  Silence: ['wave', 'shell'],
  'Vicious Mockery': ['wave', 'sigil'],
  'Dissonant Whispers': ['wave', 'spiral'],
  'Dancing Lights': ['star', 'orbit'],
  Light: ['halo', 'star'],
  'Sacred Flame': ['flame', 'halo'],
  'Starry Wisp': ['star', 'comet'],
  'Guiding Bolt': ['comet', 'star'],
  Sunbeam: ['column', 'halo'],
  Sunburst: ['halo', 'shockwave'],
  'Animate Dead': ['bone', 'sigil'],
  'Create Undead': ['bone', 'spirit'],
  'Circle of Death': ['skull', 'vortex'],
  'Chill Touch': ['hand', 'skull'],
  'Vampiric Touch': ['filament', 'droplet'],
  'Inflict Wounds': ['scar', 'smoke'],
  'Finger of Death': ['lance', 'skull'],
  'Power Word Kill': ['sigil', 'skull'],
  Blight: ['leaf', 'scar'],
  Hex: ['eye', 'sigil'],
  Invisibility: ['filament', 'shell'],
  'Greater Invisibility': ['shell', 'constellation'],
  'Mirror Image': ['echo', 'shell'],
  Blur: ['echo', 'mist'],
  'Hypnotic Pattern': ['prism', 'spiral'],
  'Color Spray': ['prism', 'wave'],
  'Prismatic Spray': ['prism', 'lance'],
  'Prismatic Wall': ['barrier', 'prism'],
  'Misty Step': ['portal', 'mist'],
  'Dimension Door': ['door', 'portal'],
  Gate: ['portal', 'chain'],
  Teleport: ['portal', 'constellation'],
  'Teleportation Circle': ['rune', 'portal'],
  'Plane Shift': ['prism', 'portal'],
  'Astral Projection': ['filament', 'constellation'],
  Maze: ['maze', 'portal'],
  'Detect Magic': ['eye', 'rune'],
  'Arcane Eye': ['eye', 'orbit'],
  Clairvoyance: ['eye', 'shell'],
  Scrying: ['eye', 'droplet'],
  'True Seeing': ['eye', 'star'],
  Identify: ['rune', 'eye'],
  'Comprehend Languages': ['script', 'rune'],
  Tongues: ['script', 'wave'],
  'Illusory Script': ['script', 'echo'],
  'Legend Lore': ['script', 'constellation'],
  'Fog Cloud': ['mist', 'vortex'],
  Cloudkill: ['smoke', 'droplet'],
  'Stinking Cloud': ['smoke', 'wave'],
  'Gust of Wind': ['wave', 'filament'],
  'Wind Wall': ['barrier', 'wave'],
  Fly: ['feather', 'orbit'],
  'Feather Fall': ['feather', 'mist'],
  'Water Breathing': ['droplet', 'shell'],
  'Water Walk': ['ripple', 'droplet'],
  Tsunami: ['wave', 'splash'],
  'Wall of Stone': ['barrier', 'stone'],
  Earthquake: ['crack', 'stone'],
  Stoneskin: ['stone', 'armor'],
  'Flesh to Stone': ['stone', 'scar'],
  'Move Earth': ['crack', 'wave'],
  Grease: ['ripple', 'droplet'],
  'Stone Shape': ['stone', 'rune'],
  Slow: ['clock', 'chain'],
  Haste: ['clock', 'lance'],
  'Time Stop': ['clock', 'shell'],
  Foresight: ['clock', 'eye'],
  'Find Familiar': ['beast', 'portal'],
  'Find Steed': ['beast', 'rune'],
  'Summon Dragon': ['dragon', 'portal'],
  'Conjure Animals': ['beast', 'leaf'],
  'Giant Insect': ['insect', 'vine'],
  'Insect Plague': ['insect', 'vortex'],
  'Conjure Celestial': ['spirit', 'column'],
  'Conjure Elemental': ['prism', 'vortex'],
  'Conjure Fey': ['spirit', 'leaf'],
  Mending: ['filament', 'script'],
  'Create Food and Water': ['fruit', 'droplet'],
  Goodberry: ['fruit', 'leaf'],
  "Heroes' Feast": ['fruit', 'halo'],
  Wish: ['constellation', 'prism'],
  "Hunter's Mark": ['eye', 'arrow'],
  'True Strike': ['blade', 'star'],
  Disintegrate: ['lance', 'scar'],
  'Resilient Sphere': ['shell', 'prism'],
  Forcecage: ['barrier', 'chain'],
  Imprisonment: ['chain', 'shell'],
  'Antimagic Field': ['shell', 'scar'],
  'Zone of Truth': ['rune', 'eye'],
  "Dragon's Breath": ['dragon', 'flame'],
};
const remainingThemes = {
  Druidcraft: 'leaf,mist',
  Elementalism: 'prism,droplet',
  Guidance: 'constellation,eye',
  Message: 'filament,wave',
  'Minor Illusion': 'echo,rune',
  'Poison Spray': 'droplet,mist',
  Prestidigitation: 'star,script',
  'Produce Flame': 'flame,hand',
  Resistance: 'shield,star',
  Shillelagh: 'vine,blade',
  'Sorcerous Burst': 'prism,comet',
  'Spare the Dying': 'petal,clock',
  Thaumaturgy: 'wave,crack',
  Alarm: 'rune,wave',
  'Animal Friendship': 'beast,petal',
  'Charm Person': 'petal,spiral',
  'Chromatic Orb': 'prism,bead',
  Command: 'sigil,wave',
  'Create or Destroy Water': 'splash,ripple',
  'Detect Evil and Good': 'eye,halo',
  'Detect Poison and Disease': 'eye,droplet',
  'Disguise Self': 'echo,script',
  'Divine Favor': 'blade,halo',
  'Divine Smite': 'blade,column',
  'Expeditious Retreat': 'feather,lance',
  'Faerie Fire': 'leaf,star',
  'False Life': 'bone,shell',
  'Floating Disk': 'orbit,shell',
  'Hellish Rebuke': 'flame,chain',
  Heroism: 'shield,petal',
  'Hideous Laughter': 'spiral,wave',
  Jump: 'feather,impact',
  Longstrider: 'feather,filament',
  'Protection from Evil and Good': 'shield,spirit',
  'Purify Food and Drink': 'fruit,ripple',
  'Ray of Sickness': 'lance,droplet',
  Sanctuary: 'halo,shield',
  'Searing Smite': 'blade,flame',
  'Silent Image': 'echo,filament',
  'Speak with Animals': 'beast,wave',
  Thunderwave: 'wave,impact',
  'Unseen Servant': 'hand,echo',
  Aid: 'armor,petal',
  'Alter Self': 'echo,beast',
  'Animal Messenger': 'feather,script',
  'Arcane Lock': 'chain,rune',
  "Arcanist's Magic Aura": 'rune,echo',
  Augury: 'constellation,script',
  Barkskin: 'armor,leaf',
  'Blindness/Deafness': 'eye,scar',
  'Calm Emotions': 'petal,wave',
  'Continual Flame': 'flame,orbit',
  Darkness: 'shell,smoke',
  Darkvision: 'eye,crescent',
  'Detect Thoughts': 'eye,spiral',
  'Enhance Ability': 'beast,star',
  'Enlarge/Reduce': 'shell,orbit',
  Enthrall: 'wave,eye',
  'Find Traps': 'eye,crack',
  'Flame Blade': 'blade,flame',
  'Gentle Repose': 'bone,petal',
  'Heat Metal': 'armor,ember',
  Knock: 'door,shockwave',
  Levitate: 'orbit,filament',
  'Locate Animals or Plants': 'eye,leaf',
  'Locate Object': 'eye,arrow',
  'Magic Mouth': 'wave,script',
  'Magic Weapon': 'blade,rune',
  'Mind Spike': 'lance,spiral',
  Moonbeam: 'crescent,column',
  'Pass without Trace': 'leaf,echo',
  'Phantasmal Force': 'echo,scar',
  'Prayer of Healing': 'petal,script',
  'Protection from Poison': 'shield,droplet',
  'Ray of Enfeeblement': 'lance,bone',
  'Rope Trick': 'filament,portal',
  'See Invisibility': 'eye,echo',
  Shatter: 'crack,shockwave',
  'Shining Smite': 'blade,star',
  'Spider Climb': 'web,hand',
  Suggestion: 'script,spiral',
  'Warding Bond': 'filament,shield',
  'Beacon of Hope': 'column,petal',
  'Bestow Curse': 'sigil,scar',
  Blink: 'echo,portal',
  Counterspell: 'scar,rune',
  Daylight: 'halo,column',
  'Dispel Magic': 'scar,prism',
  Fear: 'skull,spiral',
  'Gaseous Form': 'mist,echo',
  'Glyph of Warding': 'rune,sigil',
  'Major Image': 'echo,constellation',
  'Mass Healing Word': 'wave,halo',
  'Meld into Stone': 'stone,echo',
  Nondetection: 'eye,shell',
  'Phantom Steed': 'beast,mist',
  'Plant Growth': 'vine,fruit',
  'Protection from Energy': 'shield,prism',
  'Remove Curse': 'scar,halo',
  Sending: 'filament,script',
  'Speak with Dead': 'skull,wave',
  'Speak with Plants': 'leaf,wave',
  'Tiny Hut': 'shell,door',
  'Aura of Life': 'petal,shell',
  Banishment: 'portal,scar',
  'Charm Monster': 'beast,spiral',
  Compulsion: 'chain,spiral',
  Confusion: 'spiral,maze',
  'Conjure Minor Elementals': 'prism,orbit',
  'Conjure Woodland Beings': 'spirit,leaf',
  'Control Water': 'vortex,ripple',
  'Death Ward': 'shield,phoenix',
  Divination: 'eye,constellation',
  'Dominate Beast': 'chain,beast',
  Fabricate: 'stone,filament',
  'Faithful Hound': 'beast,eye',
  'Fire Shield': 'shield,flame',
  'Freedom of Movement': 'chain,feather',
  'Guardian of Faith': 'spirit,shield',
  'Hallucinatory Terrain': 'echo,stone',
  'Locate Creature': 'eye,beast',
  'Phantasmal Killer': 'skull,echo',
  Polymorph: 'beast,spiral',
  'Private Sanctum': 'door,shell',
  'Secret Chest': 'door,rune',
  'Animate Objects': 'filament,armor',
  'Antilife Shell': 'shell,spirit',
  Awaken: 'beast,eye',
  Commune: 'halo,script',
  'Commune with Nature': 'leaf,eye',
  'Contact Other Plane': 'portal,eye',
  Contagion: 'droplet,scar',
  Creation: 'stone,star',
  'Dispel Evil and Good': 'shield,scar',
  'Dominate Person': 'chain,eye',
  Dream: 'crescent,echo',
  Geas: 'chain,script',
  Hallow: 'halo,rune',
  'Mass Cure Wounds': 'petal,constellation',
  Mislead: 'echo,filament',
  'Modify Memory': 'clock,spiral',
  Passwall: 'door,stone',
  'Planar Binding': 'portal,chain',
  'Raise Dead': 'bone,phoenix',
  Reincarnate: 'beast,phoenix',
  Seeming: 'echo,petal',
  Telekinesis: 'hand,filament',
  'Telepathic Bond': 'filament,eye',
  'Tree Stride': 'vine,portal',
  'Wall of Force': 'barrier,shell',
  'Blade Barrier': 'blade,barrier',
  Contingency: 'clock,rune',
  Eyebite: 'eye,skull',
  'Find the Path': 'arrow,constellation',
  Forbiddance: 'barrier,sigil',
  'Guards and Wards': 'door,maze',
  Harm: 'scar,skull',
  Heal: 'phoenix,petal',
  'Instant Summons': 'portal,rune',
  'Irresistible Dance': 'wave,chain',
  'Magic Jar': 'bead,spirit',
  'Mass Suggestion': 'script,constellation',
  'Planar Ally': 'spirit,portal',
  'Programmed Illusion': 'echo,clock',
  'Transport via Plants': 'leaf,portal',
  'Wind Walk': 'mist,feather',
  'Word of Recall': 'portal,halo',
  'Divine Word': 'script,column',
  Etherealness: 'filament,echo',
  'Fire Storm': 'flame,meteor',
  'Magnificent Mansion': 'door,star',
  'Mirage Arcane': 'echo,vortex',
  'Project Image': 'echo,eye',
  Resurrection: 'phoenix,spirit',
  'Reverse Gravity': 'orbit,lance',
  Sequester: 'shell,clock',
  Simulacrum: 'echo,crystal',
  Symbol: 'sigil,rune',
  'Animal Shapes': 'beast,constellation',
  'Antipathy/Sympathy': 'wave,eye',
  Befuddlement: 'maze,scar',
  Clone: 'echo,bone',
  'Control Weather': 'storm,vortex',
  Demiplane: 'door,vortex',
  'Dominate Monster': 'chain,skull',
  Glibness: 'script,star',
  'Holy Aura': 'halo,spirit',
  'Mind Blank': 'shell,eye',
  'Power Word Stun': 'script,chain',
  'Power Word Heal': 'script,phoenix',
  Shapechange: 'beast,prism',
  'True Polymorph': 'prism,beast',
  'True Resurrection': 'phoenix,constellation',
  Weird: 'skull,maze',
};
Object.entries(remainingThemes).forEach(
  ([name, motifs]) => (specialMotifs[name] = motifs.split(',')),
);

const familyMotifs = {
  fire: ['flame', 'ember'],
  frost: ['crystal', 'mist'],
  lightning: ['bolt', 'branch'],
  acid: ['droplet', 'splash'],
  poison: ['smoke', 'droplet'],
  heal: ['petal', 'halo'],
  radiant: ['halo', 'star'],
  nature: ['leaf', 'vine'],
  necrotic: ['sigil', 'spirit'],
  psychic: ['spiral', 'wave'],
  illusion: ['echo', 'prism'],
  portal: ['portal', 'mist'],
  water: ['ripple', 'droplet'],
  wind: ['feather', 'wave'],
  earth: ['stone', 'crack'],
  time: ['clock', 'orbit'],
  ward: ['shield', 'rune'],
  divination: ['eye', 'script'],
  force: ['rune', 'lance'],
};
if (process.argv.includes('--unassigned')) {
  console.log(
    spells
      .filter((s) => !specialMotifs[s.name])
      .map((s) => s.name)
      .join('\n'),
  );
  process.exit(0);
}
const profiles = spells.map((s) => {
  const rules = s.details.split(/Using a Higher-Level Spell Slot|Cantrip Upgrade/)[0],
    higher = s.details.match(/Using a Higher-Level Spell Slot\n?([\s\S]*)/)?.[1] || '';
  const concentration = /concentra/.test(s.duration);
  const durationMatch = s.duration.match(/(\d+)\s*(round|minute|hour|day)/);
  const duration = durationMatch
    ? Number(durationMatch[1]) * { round: 6, minute: 60, hour: 3600, day: 86400 }[durationMatch[2]]
    : /permanent/.test(s.duration)
      ? null
      : 0;
  let mode = self.has(s.name)
    ? 'self'
    : touch.has(s.name)
      ? 'targets'
      : s.range === 'point'
        ? 'point'
        : 'targets';
  let range =
    s.range === 'point'
      ? 5
      : Number(s.range.match(/[\d.]+/)?.[0] || 30) * (/miles/.test(s.range) ? 5280 : 1);
  let shape = null,
    size = 0,
    width = 5,
    origin = 'point',
    count = 1,
    increment = 0;
  const radius =
    rules.match(/(\d+)-foot-radius(?:, [\d-]+-foot-(?:high|tall))? (Sphere|Cylinder)/i) ||
    rules.match(/Cylinder[^.]*?(\d+)-foot radius/i);
  const cone = rules.match(/(\d+)-foot Cone/i);
  const cube = rules.match(/(\d+)-foot Cube/i);
  const emanation = rules.match(/(\d+)-foot Emanation/i);
  if (radius) {
    shape = 'sphere';
    size = Number(radius[1]);
    mode = 'area';
  } else if (cone) {
    shape = 'cone';
    size = Number(cone[1]);
    mode = 'area';
    origin = 'caster';
  } else if (cube) {
    shape = 'cube';
    size = Number(cube[1]);
    mode = 'area';
  } else if (emanation) {
    shape = 'sphere';
    size = Number(emanation[1]);
    mode = 'self';
  }
  const multi = rules.match(
    /(?:up to|choose|targets?)[ \n]+(\d+|one|two|three|four|five|six|eight|ten|twelve)[ \n]+(?:willing |falling )?creatures/i,
  );
  if (multi) count = number(multi[1]);
  if (/one additional (?:creature|Humanoid|Beast)/i.test(higher)) increment = 1;
  if (touch.has(s.name)) {
    mode = 'targets';
    shape = null;
    size = 0;
  }
  if (self.has(s.name)) {
    mode = 'self';
    shape = null;
    size = 0;
  }
  if (
    /creatures of your choice|any number of|each creature you choose/i.test(rules) &&
    mode === 'targets'
  )
    count = 100;
  const group = families.find((f) => names(f[3]).includes(s.name));
  if (!group) {
    console.error('Missing visual family: ' + s.name);
    return null;
  }
  const digest = createHash('sha256').update(s.id).digest();
  const visual = {
    family: group[0],
    color: group[1],
    light: group[2],
    motifs: specialMotifs[s.name] || familyMotifs[group[0]],
    signature: digest.readUInt32LE(),
    arms: 3 + (digest[4] % 7),
    twist: (digest[5] % 2 ? 1 : -1) * (0.12 + digest[6] / 400),
    pulse: 0.7 + digest[7] / 256,
    delivery: /Bolt|Ray|Missile|Arrow|Blast|Lance|Orb|Finger/.test(s.name)
      ? 'projectile'
      : /Touch|Grasp/.test(s.name)
        ? 'contact'
        : mode === 'area'
          ? 'field'
          : mode === 'self'
            ? 'aura'
            : 'weave',
  };
  const p = {
    id: s.id,
    name: s.name,
    level: s.level,
    mode,
    range,
    shape,
    size,
    width,
    origin,
    count,
    increment,
    repeat: false,
    areas: 1,
    concentration,
    duration,
    follow: mode === 'self',
    movable: false,
    higher,
    visual,
    ...patches[s.name],
  };
  if (p.mode === 'self' && p.follow === undefined) p.follow = true;
  return p;
});
if (profiles.some((s) => !s)) throw Error('Visual families incomplete');
if (profiles.length !== 339 || new Set(profiles.map((s) => s.id)).size !== 339)
  throw Error('Spell coverage changed');
await fs.writeFile('shared/vtt-spell-profiles.json', JSON.stringify(profiles, null, 2) + '\n');
console.log(
  JSON.stringify({
    spells: profiles.length,
    modes: profiles.reduce((a, s) => ((a[s.mode] = (a[s.mode] || 0) + 1), a), {}),
    sourceSha256: createHash('sha256')
      .update(await fs.readFile(source))
      .digest('hex'),
  }),
);
