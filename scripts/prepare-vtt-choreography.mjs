import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const raw = JSON.parse(await fs.readFile('data/vtt/srd-2024.json', 'utf8')).spells;
const profiles = JSON.parse(await fs.readFile('shared/vtt-spell-profiles.json', 'utf8'));
const families = {
  fire: 'flames',
  frost: 'frost',
  lightning: 'lightning',
  acid: 'acid',
  poison: 'poison',
  heal: 'healing',
  radiant: 'radiance',
  nature: 'roots',
  necrotic: 'drain',
  psychic: 'psychic',
  illusion: 'illusion',
  portal: 'portal',
  water: 'water',
  wind: 'wind',
  earth: 'earth',
  time: 'time',
  ward: 'shield',
  divination: 'divination',
  force: 'force',
};
const rules = [
  ['teleport', /^(Misty Step|Dimension Door|Teleport|Thunder Step|Far Step)$/i],
  ['mirror', /^Mirror Image$/i],
  ['double', /^(Mislead|Project Image)$/i],
  ['illusion-image', /^(Silent Image|Major Image|Minor Illusion|Programmed Illusion)$/i],
  ['fireball', /^(Fireball|Delayed Blast Fireball|Meteor Swarm)$/i],
  ['fire-ray', /^(Fire Bolt|Scorching Ray|Produce Flame|Burning Hands)$/i],
  ['lightning', /Lightning|Witch Bolt|Shocking Grasp/i],
  ['thunder', /Thunder|Shatter|Destructive Wave/i],
  [
    'missiles',
    /Magic Missile|Eldritch Blast|Guiding Bolt|Chromatic Orb|Disintegrate|Melf.*Arrow|Acid Arrow|Ray of Frost|Ray of Sickness|Ray of Enfeeblement|Lance|Finger of Death/i,
  ],
  ['weapon', /Spiritual Weapon|Sword|Blade|Shillelagh|Magic Weapon|Elemental Weapon/i],
  ['web', /^Web$/],
  ['petrify', /Flesh to Stone|Stoneskin/i],
  ['earth', /Earthquake|Stone|Earth|Rock/i],
  ['fog', /Fog Cloud|Cloudkill|Stinking Cloud|Incendiary Cloud|Sleet Storm|Cloud/i],
  [
    'healing',
    /Cure|Heal|Healing|Regenerate|Resurrection|Revivify|Spare the Dying|Restoration|Raise Dead|Aid/i,
  ],
  ['invisible', /Invisibility|Vanish/i],
  ['summon', /Summon|Conjure|Animate Dead|Create Undead|Find Familiar|Find Steed|Raise Dead/i],
  ['water', /Water|Tsunami|Tidal|Create.*Food|Ice Storm/i],
  ['wind', /Wind|Whirlwind|Gust|Fly|Levitate|Feather Fall/i],
  ['roots', /Entangle|Plant|Spike Growth|Grasping Vine|Wall of Thorns/i],
  [
    'transmute',
    /Polymorph|Alter Self|Enlarge|Reduce|Shapechange|Gaseous Form|Animal Shapes|Disguise Self/i,
  ],
  [
    'portal',
    /Gate|Teleportation Circle|Plane Shift|Passwall|Arcane Gate|Blink|Etherealness|Rope Trick|Demiplane/i,
  ],
  ['darkness', /Darkness|Shadow|Hunger|Arms of Hadar/i],
  ['drain', /Blight|Vampiric|Inflict|Necrotic|Chill Touch|Speak with Dead/i],
  [
    'divination',
    /Detect|See Invisibility|Scry|Clair|Locate|Identify|Augury|Divination|Commune|Legend Lore|True Seeing|Find the Path/i,
  ],
  [
    'charm',
    /Charm|Friends|Dominate|Suggestion|Calm|Command|Sleep|Hold|Compulsion|Fear|Confusion|Bane|Bless/i,
  ],
  ['glyph', /Glyph|Symbol|Illusory Script|Magic Circle/i],
  [
    'shield',
    /Shield|Protection|Sanctuary|Warding|Resistance|Antimagic|Globe|Prismatic|Armor|Hallow|Forbiddance/i,
  ],
];
const result = profiles.map((p) => {
  const spell = raw.find((s) => s.id === p.id);
  if (!spell?.details) throw Error('Missing description ' + p.id);
  const rule = rules.find(([, regex]) => regex.test(p.name));
  let kind = rule?.[0] || families[p.visual.family] || 'force';
  const details = spell.details.toLowerCase();
  if (!rule) {
    if (/illusory duplicate|illusory double/.test(details)) kind = 'double';
    else if (/teleport.*unoccupied space/.test(details)) kind = 'teleport';
    else if (/a bright streak|fiery explosion/.test(details)) kind = 'fireball';
    else if (/threads|strands|silvery cord/.test(details)) kind = 'threads';
  }
  const launch =
    ['fireball', 'missiles', 'fire-ray'].includes(kind) || p.visual.delivery === 'projectile';
  return {
    id: p.id,
    kind,
    delivery: launch
      ? 'projectile'
      : p.origin.startsWith('caster') && p.shape
        ? 'outward'
        : p.shape
          ? 'field'
          : p.mode === 'self'
            ? 'aura'
            : 'arrival',
    persistent: p.concentration || p.duration === null || p.duration > 0,
    flight: kind === 'fireball' ? 0.78 : kind === 'missiles' ? 0.55 : 0.65,
    impact: kind === 'fireball' ? 2.5 : kind === 'thunder' ? 1.2 : 1.8,
    particles: Math.min(56, 16 + p.level * 4),
    material: /fire/.test(kind)
      ? 'flame'
      : /fog|dark|wind|poison|water|roots|earth|frost/.test(kind)
        ? 'vapor'
        : 'energy',
    descriptionSha256: createHash('sha256').update(spell.details).digest('hex'),
    descriptionCue: spell.details.split('\n')[0].slice(0, 230),
  };
});
await fs.writeFile('shared/vtt-spell-choreography.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  result.length +
    ' description-backed spell sequences; ' +
    new Set(result.map((r) => r.kind)).size +
    ' physical behaviours.',
);
