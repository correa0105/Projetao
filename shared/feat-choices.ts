import catalog from './feats-2024.json';
import common from './sheet-common.json';
import spells from './character-rules-2024.json';
import { statNames } from './rules.js';
import { feats as originFeats, type SheetChoices } from './character-sheet.js';
import {
  classStates,
  classProfile,
  type AdvanceChoice,
  type AdvancementCharacter,
  type AdvanceField,
} from './character-advancement.js';
import { artisanTools } from './subclass-choices-2024.js';
import { classFightingStyles } from './fighting-styles.js';
type Requirement = {
  level?: number;
  ability?: Record<string, number>[];
  proficiency?: { armor?: string }[];
  spellcasting2020?: boolean;
  feature?: string[];
  otherSummary?: unknown;
};
export type FeatRule = {
  id: string;
  name: string;
  text: string;
  category: string;
  source: string;
  page: number;
  prerequisite: Requirement[];
  abilities: number[];
  boost: number;
  maximum: number;
  repeatable: boolean;
};
export const featRules = catalog as FeatRule[];
const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const instruments = [
  'Alaúde',
  'Flauta',
  'Tambor',
  'Lira',
  'Gaita de foles',
  'Trombeta',
  'Violino',
  'Dulcimer',
  'Flauta de pã',
  'Charamela',
];
export function featPlan(
  character: AdvancementCharacter,
  c: SheetChoices,
  next: Pick<AdvanceChoice, 'class' | 'choices' | 'feat'>,
) {
  const states = classStates(character, c),
    level = 2 + (c.advancement?.levels.length || 0),
    target = (states.find((s) => s.class === next.class)?.level || 0) + 1,
    origin = originFeats(c),
    prior = (c.advancement?.levels || []).flatMap((r) => (r.feat ? [r] : [])),
    owned = [...origin, ...prior.map((r) => featRules.find((f) => f.id === r.feat)?.name || '')],
    styles = Object.values(classFightingStyles(character.class, c)).flat();
  const hasStyle =
    states.some(
      (s) =>
        s.class === 'Guerreiro' || (['Paladino', 'Patrulheiro'].includes(s.class) && s.level >= 2),
    ) ||
    next.class === 'Guerreiro' ||
    (['Paladino', 'Patrulheiro'].includes(next.class) && target >= 2);
  const armor = new Set<string>();
  for (const s of [...states, { class: next.class }]) {
    if (['Bardo', 'Ladino'].includes(s.class)) armor.add('light');
    if (
      ['Artífice', 'Bárbaro', 'Clérigo', 'Druida', 'Guerreiro', 'Paladino', 'Patrulheiro'].includes(
        s.class,
      )
    ) {
      armor.add('light');
      armor.add('shield');
    }
    if (
      ['Artífice', 'Bárbaro', 'Clérigo', 'Guerreiro', 'Paladino', 'Patrulheiro'].includes(s.class)
    )
      armor.add('medium');
    if (s.class === character.class && ['Guerreiro', 'Paladino'].includes(s.class))
      armor.add('heavy');
  }
  if (c.options.order?.includes('Protetor')) armor.add('heavy');
  if (c.options.order?.includes('Guardião')) armor.add('medium');
  for (const r of prior) {
    if (r.feat === 'lightly-armored') {
      armor.add('light');
      armor.add('shield');
    }
    if (r.feat === 'moderately-armored') armor.add('medium');
    if (r.feat === 'heavily-armored') armor.add('heavy');
  }
  const casting =
    states.some((s) => classProfile(s.class, s.level, s.subclass).ability !== null) ||
    [
      'Artífice',
      'Bardo',
      'Clérigo',
      'Druida',
      'Feiticeiro',
      'Bruxo',
      'Mago',
      'Paladino',
      'Patrulheiro',
    ].includes(next.class) ||
    !!c.cantrips.length ||
    origin.some((f) => f.startsWith('Iniciado em Magia'));
  const allowed = featRules.filter(
    (f) =>
      !f.category.includes(':') &&
      (f.repeatable || (!owned.includes(f.name) && !styles.includes(f.name))) &&
      (!f.prerequisite.length ||
        f.prerequisite.some(
          (r) =>
            (!r.level || level >= r.level) &&
            (!r.ability ||
              r.ability.some((a) =>
                Object.entries(a).every(([k, v]) => character.stats[abilities.indexOf(k)] >= v),
              )) &&
            (!r.proficiency || r.proficiency.some((p) => p.armor && armor.has(p.armor))) &&
            (!r.spellcasting2020 || casting) &&
            (!r.feature || hasStyle) &&
            !r.otherSummary,
        )),
  );
  const selected = allowed.find((f) => f.id === next.feat),
    fields: AdvanceField[] = [];
  const trained = [
    ...new Set([
      ...c.backgroundSkills,
      ...c.classSkills,
      ...c.expertise,
      ...Object.values(c.options).flat(),
      ...states.flatMap((s) => Object.values(s.choices).flat()),
    ]),
  ];
  const add = (key: string, label: string, count: number, options: string[]) =>
    fields.push({ key, label, count, options });
  if (selected) {
    const id = selected.id;
    if (id === 'skilled')
      add(
        'featSkills',
        'Proficiências do talento',
        3,
        [
          ...common.skills,
          ...artisanTools,
          ...instruments,
          'Ferramentas de ladrão',
          'Kit de disfarce',
          'Kit de falsificação',
          'Kit de herbalismo',
          'Kit de venenos',
        ].filter((s) => !trained.includes(s)),
      );
    if (id === 'crafter')
      add(
        'featTools',
        'Ferramentas do talento',
        3,
        artisanTools.filter((s) => !trained.includes(s)),
      );
    if (id === 'musician')
      add(
        'featTools',
        'Instrumentos do talento',
        3,
        instruments.filter((s) => !trained.includes(s)),
      );
    if (id === 'skill-expert') {
      add(
        'featSkills',
        'Perícia do talento',
        1,
        common.skills.filter((s) => !trained.includes(s)),
      );
      add(
        'featExpertise',
        'Especialização do talento',
        1,
        [...new Set([...trained, ...(next.choices.featSkills || [])])].filter(
          (s) =>
            common.skills.includes(s) &&
            !c.expertise.includes(s) &&
            !states.some(
              (v) => v.choices.expertise?.includes(s) || v.choices.featExpertise?.includes(s),
            ),
        ),
      );
    }
    if (id === 'boon-of-skill')
      add(
        'featExpertise',
        'Especialização da dádiva',
        1,
        common.skills.filter(
          (s) =>
            !c.expertise.includes(s) &&
            !states.some(
              (v) => v.choices.expertise?.includes(s) || v.choices.featExpertise?.includes(s),
            ),
        ),
      );
    if (id === 'keen-mind')
      add(
        'featKnowledge',
        'Perícia de conhecimento',
        1,
        ['Arcanismo', 'História', 'Natureza'].filter((s) => !c.expertise.includes(s)),
      );
    if (id === 'observant')
      add(
        'featKnowledge',
        'Perícia de observação',
        1,
        ['Intuição', 'Investigação', 'Percepção'].filter((s) => !c.expertise.includes(s)),
      );
    if (['elemental-adept', 'boon-of-energy-resistance'].includes(id))
      add(
        'featDamage',
        'Tipos de dano do talento',
        id === 'elemental-adept' ? 1 : 2,
        (id === 'elemental-adept'
          ? ['Ácido', 'Frio', 'Fogo', 'Elétrico', 'Trovejante']
          : [
              'Ácido',
              'Frio',
              'Fogo',
              'Elétrico',
              'Necrótico',
              'Venenoso',
              'Psíquico',
              'Radiante',
              'Trovejante',
            ]
        ).filter((v) => !prior.some((r) => r.feat === id && r.choices.featDamage?.includes(v))),
      );
    if (id === 'weapon-master')
      add(
        'featMastery',
        'Maestria do talento',
        1,
        Object.keys(common.weaponData).filter(
          (s) =>
            !states.some(
              (v) => v.choices.mastery?.includes(s) || v.choices.featMastery?.includes(s),
            ),
        ),
      );
    if (id === 'magic-initiate') {
      const used = [
        ...origin.filter((f) => f.startsWith('Iniciado em Magia: ')).map((f) => f.split(': ')[1]),
        ...prior.filter((r) => r.feat === id).flatMap((r) => r.choices.featClass || []),
      ];
      add(
        'featClass',
        'Lista de Iniciado em Magia',
        1,
        ['Clérigo', 'Druida', 'Mago'].filter((s) => !used.includes(s)),
      );
      const cls = next.choices.featClass?.[0],
        list = ({ Clérigo: 'cleric', Druida: 'druid', Mago: 'wizard' } as Record<string, string>)[
          cls
        ];
      if (list) {
        add('featAbility', 'Atributo das magias do talento', 1, statNames.slice(3));
        add(
          'featCantrips',
          'Truques do talento',
          2,
          spells.spells.filter((s) => s.level === 0 && s.classes.includes(list)).map((s) => s.id),
        );
        add(
          'featSpell',
          'Magia do talento',
          1,
          spells.spells.filter((s) => s.level === 1 && s.classes.includes(list)).map((s) => s.id),
        );
      }
    }
    if (['fey-touched', 'shadow-touched'].includes(id))
      add(
        'featSpell',
        'Magia adicional do talento',
        1,
        spells.spells
          .filter(
            (s) =>
              s.level === 1 &&
              (id === 'fey-touched'
                ? ['Divination', 'Enchantment']
                : ['Illusion', 'Necromancy']
              ).includes(s.school),
          )
          .map((s) => s.id),
      );
    if (id === 'ritual-caster')
      add(
        'featRituals',
        'Rituais do talento',
        2 + Math.floor((level - 1) / 4),
        spells.spells.filter((s) => s.level === 1 && s.ritual).map((s) => s.id),
      );
  }
  return { allowed, selected, fields, origin, armor: [...armor] };
}
