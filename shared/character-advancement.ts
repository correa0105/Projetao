import { z } from 'zod';
import tables from './class-advancement-tables.json';
import spellData from './character-rules-2024.json';
import { subclassFields, subclassToolGrants } from './subclass-choices-2024.js';
import common from './sheet-common.json';
import { classes, hitDice, modifier, statNames } from './rules.js';
import { backgroundTool, type SheetChoices } from './character-sheet.js';
import {
  featureNames,
  featureSummaries,
  subclassRules,
  landSpells,
} from './class-advancement-text.js';
export { subclassRules } from './class-advancement-text.js';
export type AdvancementCharacter = {
  class: string;
  race: string;
  stats: number[];
  level: number;
};
export const advanceChoiceSchema = z
  .object({
    class: z.enum(classes),
    subclass: z.string().max(60).default(''),
    newCantrips: z.array(z.string().max(80)).max(6).default([]),
    newSpells: z.array(z.string().max(80)).max(30).default([]),
    bonusSpells: z.array(z.string().max(80)).max(4).default([]),
    retrain: z
      .array(
        z
          .object({
            kind: z.enum(['cantrip', 'spell', 'plan', 'armorPlan']),
            from: z.string().max(100),
            to: z.string().max(100),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    boosts: z.array(z.number().int().min(0).max(2)).length(6).default([0, 0, 0, 0, 0, 0]),
    choices: z.record(z.string().max(40), z.array(z.string().max(100)).max(12)).default({}),
  })
  .strict();
export type AdvanceChoice = z.infer<typeof advanceChoiceSchema>;
export type AdvancementLevel = AdvanceChoice & {
  characterLevel: number;
  classLevel: number;
  requestId: string;
  actor: string;
  createdAt: string;
  granted: boolean;
};
export type AdvancementState = {
  version: 1;
  levels: AdvancementLevel[];
  initialSpells?: string[];
  prepared?: Record<string, string[]>;
  slotsUsed?: number[];
  pactUsed?: number;
};
export type ClassState = {
  class: string;
  level: number;
  subclass: string;
  cantrips: string[];
  known: string[];
  choices: Record<string, string[]>;
};
const spells = spellData.spells;
const classId: Record<string, string> = {
  Artífice: 'artificer',
  Bárbaro: 'barbarian',
  Bardo: 'bard',
  Clérigo: 'cleric',
  Druida: 'druid',
  Guerreiro: 'fighter',
  Monge: 'monk',
  Paladino: 'paladin',
  Patrulheiro: 'ranger',
  Ladino: 'rogue',
  Feiticeiro: 'sorcerer',
  Bruxo: 'warlock',
  Mago: 'wizard',
};
const ability: Record<string, number> = {
  Artífice: 3,
  Bardo: 5,
  Bruxo: 5,
  Clérigo: 4,
  Druida: 4,
  Feiticeiro: 5,
  Mago: 3,
  Paladino: 5,
  Patrulheiro: 4,
};
const full = ['Bardo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago'];
const half = ['Artífice', 'Paladino', 'Patrulheiro'];
const learned = ['Bardo', 'Bruxo', 'Feiticeiro', 'Patrulheiro'];
const unique = (v: string[]) => [...new Set(v)];
export function allocatedLevel(c: SheetChoices) {
  return 1 + (c.advancement?.levels.length || 0);
}
export function classStates(character: AdvancementCharacter, c: SheetChoices): ClassState[] {
  const initialChoices = { ...c.options, expertise: c.expertise };
  const state: ClassState[] = [
    {
      class: character.class,
      level: 1,
      subclass: '',
      cantrips: [...c.cantrips],
      known:
        character.class === 'Patrulheiro' ? c.advancement?.initialSpells || [] : [...c.spells],
      choices: initialChoices,
    },
  ];
  for (const row of c.advancement?.levels || []) {
    let current = state.find((s) => s.class === row.class);
    if (!current) {
      current = {
        class: row.class,
        level: 0,
        subclass: '',
        cantrips: [],
        known: [],
        choices: {},
      };
      state.push(current);
    }
    current.level++;
    if (row.subclass) current.subclass = row.subclass;
    for (const swap of row.retrain || []) {
      if (swap.kind === 'cantrip')
        current.cantrips = current.cantrips.filter((id) => id !== swap.from).concat(swap.to);
      if (swap.kind === 'spell')
        current.known = current.known.filter((id) => id !== swap.from).concat(swap.to);
      if (swap.kind === 'plan' || swap.kind === 'armorPlan') {
        const key = swap.kind === 'plan' ? 'plans' : 'armorPlans';
        current.choices[key] = (current.choices[key] || [])
          .filter((id) => id !== swap.from)
          .concat(swap.to);
      }
    }
    current.cantrips = unique([...current.cantrips, ...row.newCantrips]);
    current.known = unique([...current.known, ...row.newSpells, ...row.bonusSpells]);
    if (row.class === 'Bardo' && row.classLevel === 6)
      current.choices.loreBonus = [...row.bonusSpells];
    for (const [key, values] of Object.entries(row.choices))
      current.choices[key] = unique([...(current.choices[key] || []), ...values]);
  }
  return state;
}
export function classProfile(cls: string, level: number, subclass = '') {
  const subclassRule = subclassRules[cls]?.find((s) => s.id === subclass);
  const casting = level >= 3 ? subclassRule?.casting : undefined;
  const source = (
    tables.classes as Record<
      string,
      { rows: { level: number; features: string; numbers: number[] }[] }
    >
  )[cls];
  const row =
    cls === 'Artífice' ? spellData.artificer.rows[level - 1] : source?.rows[level - 1];
  const n = row?.numbers || [];
  const mage = full.includes(cls) || half.includes(cls) || cls === 'Bruxo' || Boolean(casting);
  const offset = cls === 'Mago' ? 0 : 1;
  const cantrips = casting
    ? casting.cantrips[level - 1]
    : cls === 'Artífice'
      ? n[2]
      : cls === 'Bruxo'
        ? n[1]
        : full.includes(cls)
          ? n[offset]
          : 0;
  const count = casting
    ? casting.prepared[level - 1]
    : cls === 'Artífice'
      ? n[3]
      : cls === 'Bruxo'
        ? n[2]
        : full.includes(cls)
          ? n[offset + 1]
          : half.includes(cls)
            ? n[1]
            : 0;
  const slots = casting
    ? [...casting.slots[level - 1]]
    : cls === 'Artífice'
      ? n.slice(4)
      : full.includes(cls)
        ? n.slice(offset + 2)
        : half.includes(cls)
          ? n.slice(2)
          : [];
  while (slots.length < 9) slots.push(0);
  const maxSpell = cls === 'Bruxo' ? n[4] || 0 : slots.findLastIndex((v) => v > 0) + 1;
  return {
    class: cls,
    level,
    features: row?.features || '',
    cantrips: cantrips || 0,
    prepareCount: count || 0,
    slots: slots.slice(0, 9),
    maxSpell,
    ability: casting ? casting.ability : mage ? ability[cls] : null,
    spellList: casting?.list || classId[cls],
    thirdCaster: Boolean(casting),
    pactSlots: cls === 'Bruxo' ? n[3] || 0 : 0,
    pactLevel: cls === 'Bruxo' ? n[4] || 0 : 0,
    resources: n,
  };
}
export function multiclassReason(
  character: AdvancementCharacter,
  c: SheetChoices,
  cls: string,
) {
  if (classStates(character, c).some((s) => s.class === cls)) return '';
  const requirements: Record<string, number[][]> = {
    Artífice: [[3]],
    Bárbaro: [[0]],
    Bardo: [[5]],
    Bruxo: [[5]],
    Clérigo: [[4]],
    Druida: [[4]],
    Feiticeiro: [[5]],
    Guerreiro: [[0], [1]],
    Ladino: [[1]],
    Mago: [[3]],
    Monge: [[1, 4]],
    Paladino: [[0, 5]],
    Patrulheiro: [[1, 4]],
  };
  for (const name of [character.class, cls]) {
    const choices = requirements[name];
    if (!choices?.some((group) => group.every((i) => character.stats[i] >= 13)))
      return `${name} exige ${choices.map((g) => g.map((i) => statNames[i]).join(' e ')).join(' ou ')} 13 para multiclasse.`;
  }
  return '';
}
export function alwaysPrepared(
  cls: string,
  level: number,
  subclass: string,
  choices: Record<string, string[]>,
) {
  const rule = subclassRules[cls]?.find((s) => s.id === subclass);
  const entries = subclass === 'arcane-archer' ? {} : rule?.spells || {};
  const domainNames: Record<string, string> = {
    Vida: 'Life Domain',
    Luz: 'Light Domain',
    Trapaça: 'Trickery Domain',
    Guerra: 'War Domain',
  };
  const variant =
    subclass === 'vestige'
      ? rule?.variants?.[domainNames[choices.vestigeDomain?.[0]] || 'Life Domain'] || {}
      : {};
  const terrain =
    cls === 'Druida' && subclass === 'land'
      ? landSpells[choices.terrain?.[0] || 'Árido'] || {}
      : {};
  const values = Object.entries({ ...entries, ...terrain, ...variant })
    .filter(([lv]) => Number(lv) <= level)
    .flatMap(([, s]) => s);
  values.push(
    ...(choices.subCantrips || []),
    ...[6, 7, 8, 9].flatMap((i) => choices['arcana' + i] || []),
  );
  if (cls === 'Artífice') values.push('mending');
  if (cls === 'Bardo' && subclass === 'spirits' && level >= 3) values.push('guidance');
  if (cls === 'Ladino' && subclass === 'scion-of-three' && level >= 3)
    values.push(
      (
        { Bane: 'minor-illusion', Bhaal: 'blade-ward', Myrkul: 'chill-touch' } as Record<
          string,
          string
        >
      )[choices.deity?.[0] || 'Bane'],
    );
  if (cls === 'Druida') values.push('speak-with-animals');
  if (cls === 'Patrulheiro') values.push('hunters-mark');
  if (cls === 'Bardo') values.push(...(choices.loreBonus || []));
  if (cls === 'Paladino' && level >= 2) values.push('divine-smite');
  if (cls === 'Paladino' && level >= 5) values.push('find-steed');
  return unique(values.filter((id) => spells.some((s) => s.id === id)));
}
export function classSpellOptions(cls: string, level: number, maximum?: number, subclass = '') {
  const profile = classProfile(cls, level, subclass);
  maximum ??= profile.maxSpell;
  const lists =
    cls === 'Bardo' && level >= 10
      ? ['bard', 'cleric', 'druid', 'wizard']
      : [profile.spellList];
  return spells
    .filter(
      (s) => s.level > 0 && s.level <= maximum && s.classes.some((v) => lists.includes(v)),
    )
    .map((s) => s.id);
}
const evoc = spells.filter((s) => s.school === 'Evocation').map((s) => s.id);
export type AdvanceField = { key: string; label: string; count: number; options: string[] };
const styles = ['Arquearia', 'Defesa', 'Combate com armas grandes', 'Combate com duas armas'];
const meta = [
  'Magia Acelerada',
  'Magia Ampliada',
  'Magia Cuidadosa',
  'Magia Distante',
  'Magia Duplicada',
  'Magia Empoderada',
  'Magia Estendida',
  'Magia Intensificada',
  'Magia Sutil',
  'Magia Transmutada',
];
export function levelPlan(
  character: AdvancementCharacter,
  c: SheetChoices,
  input: Pick<AdvanceChoice, 'class' | 'subclass' | 'choices'>,
) {
  const states = classStates(character, c),
    previous = states.find((s) => s.class === input.class),
    level = (previous?.level || 0) + 1,
    cls = input.class;
  const sub = previous?.subclass || input.subclass;
  const profile = classProfile(cls, level, sub),
    old = previous ? classProfile(cls, previous.level, sub) : null;
  const known = previous?.known || [],
    cantrips = previous?.cantrips || [];
  const combined = { ...previous?.choices, ...input.choices };
  const automatic = alwaysPrepared(cls, level, sub, combined);
  const newCantrips = Math.max(0, profile.cantrips - cantrips.length);
  const newSpells =
    cls === 'Mago'
      ? level === 1
        ? 6
        : 2
      : learned.includes(cls) || profile.thirdCaster
        ? Math.max(
            0,
            profile.prepareCount -
              known.filter(
                (s) => !automatic.includes(s) && spells.find((v) => v.id === s)?.level !== 0,
              ).length,
          )
        : 0;
  const spellOptions = classSpellOptions(cls, level, undefined, sub).filter(
    (s) => !known.includes(s) && !automatic.includes(s),
  );
  const bonusCount =
    cls === 'Mago' && Boolean(subclassRules[cls]?.find((s) => s.id === sub)?.school)
      ? level === 3
        ? 2
        : profile.maxSpell > (old?.maxSpell || 0)
          ? 1
          : 0
      : cls === 'Bardo' && sub === 'lore' && level === 6
        ? 2
        : 0;
  const bonusOptions =
    cls === 'Mago'
      ? spellOptions.filter(
          (id) =>
            spells.find((s) => s.id === id)?.school ===
            subclassRules[cls]?.find((s) => s.id === sub)?.school,
        )
      : spells
          .filter(
            (s) =>
              s.level >= 0 &&
              s.level <= 3 &&
              s.classes.some((v) => ['cleric', 'druid', 'wizard'].includes(v)) &&
              !known.includes(s.id),
          )
          .map((s) => s.id);
  const fields: AdvanceField[] = [];
  const trained = unique([
    ...c.backgroundSkills,
    ...c.classSkills,
    ...c.expertise,
    ...Object.values(c.options)
      .flat()
      .filter((s) => common.skills.includes(s)),
    ...states.flatMap((s) =>
      Object.values(s.choices)
        .flat()
        .filter((v) => common.skills.includes(v)),
    ),
  ]);
  const experts = unique([...c.expertise, ...states.flatMap((s) => s.choices.expertise || [])]);
  const add = (key: string, label: string, count: number, options: string[]) => {
    if (count > 0) fields.push({ key, label, count, options });
  };
  const previousChoice = (key: string) => previous?.choices[key] || [];
  if (level === 1 && ['Artífice', 'Bardo', 'Ladino', 'Patrulheiro'].includes(cls))
    add(
      'skills',
      'Perícia da nova classe',
      1,
      (cls === 'Bardo'
        ? common.skills
        : (common.classes as Record<string, { skills: string[] }>)[cls].skills
      ).filter((s) => !trained.includes(s)),
    );
  if (cls === 'Bardo' && level === 1)
    add('instrument', 'Instrumento da nova classe', 1, [
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
    ]);
  const languageOptions = [
    'Língua de sinais comum',
    'Dracônico',
    'Anão',
    'Élfico',
    'Gigante',
    'Gnômico',
    'Goblin',
    'Halfling',
    'Orc',
    'Abissal',
    'Celestial',
    'Infernal',
    'Primordial',
    'Silvestre',
    'Subcomum',
    'Dialeto Profundo',
  ].filter(
    (v) =>
      !c.backgroundExtras.includes(v) &&
      !states.some(
        (s) => s.choices.languages?.includes(v) || s.choices.rogueLanguage?.includes(v),
      ),
  );
  if (cls === 'Ladino' && level === 1)
    add('languages', 'Idioma adicional do ladino', 1, languageOptions);
  if (cls === 'Patrulheiro' && level === 2)
    add('languages', 'Idiomas de Explorador Hábil', 2, languageOptions);
  const masteries =
    cls === 'Guerreiro'
      ? profile.resources[1]
      : cls === 'Bárbaro'
        ? profile.resources[2]
        : ['Paladino', 'Patrulheiro', 'Ladino'].includes(cls)
          ? 2
          : 0;
  const weaponOptions = Object.entries(common.weaponData)
    .filter(
      ([name, w]) =>
        (cls !== 'Bárbaro' || !('ranged' in w && w.ranged)) &&
        (cls !== 'Ladino' ||
          !('martial' in w && w.martial) ||
          ('ability' in w && w.ability === 'finesse') ||
          ['Machadinha', 'Martelo leve', 'Espada curta', 'Cimitarra', 'Besta de mão'].includes(
            name,
          )),
    )
    .map(([name]) => name);
  add(
    'mastery',
    'Novas maestrias de armas',
    Math.max(0, masteries - previousChoice('mastery').length),
    weaponOptions.filter((v) => !previousChoice('mastery').includes(v)),
  );
  if (cls === 'Bárbaro' && level === 3)
    add(
      'skills',
      'Perícia de Conhecimento Primal',
      1,
      common.classes.Bárbaro.skills.filter((v) => !trained.includes(v)),
    );
  if (cls === 'Bardo' && sub === 'lore' && level === 3)
    add(
      'skills',
      'Perícias do Colégio do Conhecimento',
      3,
      common.skills.filter((s) => !trained.includes(s)),
    );
  const expertiseCount =
    cls === 'Ladino' && [1, 6].includes(level)
      ? 2
      : cls === 'Bardo' && [2, 9].includes(level)
        ? 2
        : cls === 'Patrulheiro' && level === 2
          ? 1
          : cls === 'Patrulheiro' && level === 9
            ? 2
            : cls === 'Mago' && level === 2
              ? 1
              : 0;
  add(
    'expertise',
    'Novas especializações',
    expertiseCount,
    unique([...trained, ...(input.choices.skills || [])]).filter(
      (s) =>
        !experts.includes(s) &&
        (cls !== 'Mago' ||
          [
            'Arcanismo',
            'História',
            'Investigação',
            'Medicina',
            'Natureza',
            'Religião',
          ].includes(s)),
    ),
  );
  if (
    (cls === 'Guerreiro' && level === 1) ||
    (['Paladino', 'Patrulheiro'].includes(cls) && level === 2) ||
    (cls === 'Guerreiro' && sub === 'champion' && level === 7)
  )
    add(
      'style',
      'Estilo de luta',
      1,
      styles.filter((s) => !previousChoice('style').includes(s)),
    );
  if (cls === 'Clérigo' && level === 1)
    add('order', 'Ordem divina', 1, ['Protetor', 'Taumaturgo']);
  if (cls === 'Druida' && level === 1)
    add('order', 'Ordem primal', 1, ['Guardião', 'Mago primal']);
  if (level === 1 && ['Taumaturgo', 'Mago primal'].includes(input.choices.order?.[0]))
    add(
      'orderCantrip',
      'Truque adicional da ordem',
      1,
      spells.filter((s) => s.level === 0 && s.classes.includes(classId[cls])).map((s) => s.id),
    );
  if (cls === 'Druida' && sub === 'land' && level === 3)
    add('terrain', 'Terreno do círculo', 1, Object.keys(landSpells));
  if (cls === 'Feiticeiro' && [2, 10, 17].includes(level))
    add(
      'metamagic',
      'Novas metamagias',
      2,
      meta.filter((s) => !previousChoice('metamagic').includes(s)),
    );
  if (cls === 'Feiticeiro' && sub === 'draconic' && level === 6)
    add('element', 'Afinidade elemental', 1, ['Ácido', 'Frio', 'Fogo', 'Elétrico', 'Veneno']);
  if (cls === 'Clérigo' && level === 7)
    add('blessed', 'Golpes abençoados', 1, ['Golpe Divino', 'Conjuração Potente']);
  if (cls === 'Druida' && level === 7)
    add('elemental', 'Fúria elemental', 1, ['Golpe Primal', 'Conjuração Potente']);
  if (cls === 'Patrulheiro' && sub === 'hunter' && level === 3)
    add('prey', 'Presa do caçador', 1, ['Matador de Colossos', 'Destruidor de Hordas']);
  if (cls === 'Patrulheiro' && sub === 'hunter' && level === 7)
    add('defense', 'Táticas defensivas', 1, ['Escape da Horda', 'Defesa de Múltiplos Ataques']);
  if (cls === 'Bruxo') {
    const inv = unique([...previousChoice('invocation'), ...previousChoice('invocations')]);
    const pool = [
      'Armadura de Sombras',
      'Mente Mística',
      'Pacto da Lâmina',
      'Pacto da Corrente',
      'Pacto do Tomo',
      ...(level >= 2
        ? [
            'Visões Nebulosas',
            'Visão do Diabo',
            'Máscara de Muitas Faces',
            'Vigor Ínfero',
            'Salto Sobrenatural',
          ]
        : []),
      ...(level >= 2 &&
      cantrips.some((v) =>
        ['eldritch-blast', 'chill-touch', 'poison-spray', 'true-strike'].includes(v),
      )
        ? ['Explosão Agonizante', 'Explosão Repulsiva']
        : []),
      ...(level >= 5
        ? [
            'Olhar de Duas Mentes',
            'Passo Ascendente',
            'Presente das Profundezas',
            'Um com as Sombras',
            'Mestre de Muitas Formas',
          ]
        : []),
      ...(level >= 5 &&
      [...inv, ...(input.choices.invocations || [])].includes('Pacto da Lâmina')
        ? ['Lâmina Sedenta', 'Destruição Mística']
        : []),
      ...(level >= 7 ? ['Sussurros do Túmulo'] : []),
      ...(level >= 9 ? ['Visões de Reinos Distantes'] : []),
      ...(level >= 9 &&
      [...inv, ...(input.choices.invocations || [])].includes('Pacto da Lâmina')
        ? ['Devorador de Vida']
        : []),
      ...(level >= 12 && inv.includes('Lâmina Sedenta') ? ['Lâmina Devoradora'] : []),
      ...(level >= 15 ? ['Visão de Bruxa'] : []),
    ];
    add(
      'invocations',
      'Novas invocações místicas',
      profile.resources[0] - inv.length,
      pool.filter((s) => !inv.includes(s)),
    );
    if (input.choices.invocations?.includes('Pacto do Tomo')) {
      add(
        'tomeCantrips',
        'Truques do tomo',
        3,
        spells.filter((s) => s.level === 0 && !cantrips.includes(s.id)).map((s) => s.id),
      );
      add(
        'tomeRituals',
        'Rituais do tomo',
        2,
        spells
          .filter(
            (s) =>
              s.level === 1 && s.ritual && !known.includes(s.id) && !automatic.includes(s.id),
          )
          .map((s) => s.id),
      );
    }
    if ([11, 13, 15, 17].includes(level))
      add(
        'arcanum',
        'Arcano místico',
        1,
        spells
          .filter((s) => s.level === (level + 1) / 2 && s.classes.includes('warlock'))
          .map((s) => s.id),
      );
  }
  if (cls === 'Mago' && level === 18) {
    add(
      'mastery1',
      'Maestria: magia de círculo 1',
      1,
      known.filter((id) => spells.find((s) => s.id === id)?.level === 1),
    );
    add(
      'mastery2',
      'Maestria: magia de círculo 2',
      1,
      known.filter((id) => spells.find((s) => s.id === id)?.level === 2),
    );
  }
  if (cls === 'Mago' && level === 20)
    add(
      'signature',
      'Magias de assinatura',
      2,
      known.filter((id) => spells.find((s) => s.id === id)?.level === 3),
    );
  const ownedTools = unique([
    backgroundTool(c),
    ...Object.values(c.options).flat(),
    ...states.flatMap((s) => [
      ...(s.choices.subTools || []),
      ...(subclassToolGrants[s.class + '/' + s.subclass] || []),
    ]),
  ]);
  if (character.class === 'Artífice')
    ownedTools.push('Ferramentas de ladrão', 'Ferramentas de funileiro');
  const saveIndexes = (common.classes as Record<string, { saves: number[] }>)[character.class]
    .saves;
  fields.push(
    ...subclassFields({
      cls,
      sub,
      level,
      previous,
      trained,
      tools: ownedTools,
      cantrips,
      choices: combined,
      languages: languageOptions,
      saves: saveIndexes,
    }),
  );
  const asi =
    profile.features.includes('Ability Score Improvement') ||
    profile.features.includes('Epic Boon');
  return {
    class: cls,
    level,
    profile,
    previous,
    subclassRequired: level === 3,
    subclasses: subclassRules[cls] || [],
    newCantrips,
    cantripOptions: spells
      .filter(
        (s) =>
          s.level === 0 &&
          s.classes.includes(profile.spellList) &&
          !cantrips.includes(s.id) &&
          !automatic.includes(s.id),
      )
      .map((s) => s.id),
    newSpells,
    spellOptions,
    bonusCount,
    bonusOptions,
    fields,
    asi,
    reason: multiclassReason(character, c, cls),
    hpGain: Math.max(
      1,
      hitDice[cls] / 2 + 1 + modifier(character.stats[2]) + (character.race === 'Anão' ? 1 : 0),
    ),
    automatic,
    retraining: [
      ...(cantrips.length
        ? [
            {
              kind: 'cantrip' as const,
              label: 'Trocar um truque da classe',
              from: cantrips,
              to: spells
                .filter(
                  (s) =>
                    s.level === 0 &&
                    s.classes.includes(profile.spellList) &&
                    !cantrips.includes(s.id) &&
                    !automatic.includes(s.id),
                )
                .map((s) => s.id),
            },
          ]
        : []),
      ...((learned.includes(cls) || profile.thirdCaster) && known.length
        ? [
            {
              kind: 'spell' as const,
              label: 'Trocar uma magia da progressão',
              from: known.filter(
                (id) =>
                  spells.find((s) => s.id === id)?.level !== 0 &&
                  !automatic.includes(id) &&
                  !(previous?.choices.loreBonus || []).includes(id),
              ),
              to: spellOptions,
            },
          ]
        : []),
      ...(cls === 'Artífice' && previousChoice('plans').length
        ? [
            {
              kind: 'plan' as const,
              label: 'Trocar um plano de item',
              from: previousChoice('plans'),
              to: spellData.artificer.plans
                .filter(
                  (p) =>
                    p.level <= level &&
                    !previousChoice('plans').includes(p.label) &&
                    !previousChoice('armorPlans').includes(p.label),
                )
                .map((p) => p.label),
            },
          ]
        : []),
      ...(cls === 'Artífice' && previousChoice('armorPlans').length
        ? [
            {
              kind: 'armorPlan' as const,
              label: 'Trocar o plano adicional de armadura',
              from: previousChoice('armorPlans'),
              to: spellData.artificer.plans
                .filter(
                  (p) =>
                    p.level <= level &&
                    p.armor &&
                    !previousChoice('plans').includes(p.label) &&
                    !previousChoice('armorPlans').includes(p.label),
                )
                .map((p) => p.label),
            },
          ]
        : []),
    ].filter((v) => v.from.length && v.to.length),
  };
}
export function defaultAdvanceChoice(cls: string): AdvanceChoice {
  return {
    class: cls as (typeof classes)[number],
    subclass: '',
    newCantrips: [],
    newSpells: [],
    bonusSpells: [],
    boosts: [0, 0, 0, 0, 0, 0],
    choices: {},
  };
}
export function validateAdvance(
  character: AdvancementCharacter,
  c: SheetChoices,
  input: unknown,
) {
  const next = advanceChoiceSchema.parse(input),
    plan = levelPlan(character, c, next);
  const check = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  check(!plan.reason, plan.reason);
  check(plan.level <= 20, 'A classe já está no nível máximo.');
  const list = (v: string[], n: number, allowed: string[], label: string) =>
    check(
      v.length === n && new Set(v).size === v.length && v.every((s) => allowed.includes(s)),
      `Confira ${label}: escolha ${n} opções válidas, sem repetir.`,
    );
  if (plan.subclassRequired)
    check(
      plan.subclasses.some((s) => s.id === next.subclass),
      'Selecione a subclasse deste nível.',
    );
  else check(next.subclass === '', 'A subclasse só é escolhida no nível 3 da classe.');
  list(next.newCantrips, plan.newCantrips, plan.cantripOptions, 'os novos truques');
  list(next.newSpells, plan.newSpells, plan.spellOptions, 'as novas magias');
  check(
    next.bonusSpells.length <= plan.bonusCount &&
      new Set(next.bonusSpells).size === next.bonusSpells.length &&
      next.bonusSpells.every(
        (s) => plan.bonusOptions.includes(s) && !next.newSpells.includes(s),
      ),
    'Confira as magias adicionais da subclasse.',
  );
  if (next.class === 'Mago' && plan.level === 3 && plan.bonusCount)
    check(next.bonusSpells.length === 2, 'Escolha as duas magias da escola da subclasse.');
  if (next.class === 'Bardo' && plan.bonusCount)
    check(
      next.bonusSpells.length === plan.bonusCount,
      'Escolha as duas magias de Descobertas Mágicas.',
    );
  check(
    new Set((next.retrain || []).map((v) => v.kind)).size === (next.retrain || []).length,
    'Só pode trocar uma opção de cada tipo por nível.',
  );
  check(
    (next.retrain || []).filter((v) => v.kind === 'plan' || v.kind === 'armorPlan').length <= 1,
    'Só pode trocar um plano de item por nível.',
  );
  for (const swap of next.retrain || []) {
    const options = plan.retraining.find((v) => v.kind === swap.kind);
    check(
      Boolean(options?.from.includes(swap.from) && options.to.includes(swap.to)),
      'Troca de característica não permitida neste nível.',
    );
    check(
      ![...next.newCantrips, ...next.newSpells, ...Object.values(next.choices).flat()].includes(
        swap.to,
      ),
      'A troca deve ser diferente das novas escolhas.',
    );
  }
  check(
    Object.keys(next.choices).every((k) => plan.fields.some((f) => f.key === k)),
    'Escolha de característica não disponível neste nível.',
  );
  for (const f of plan.fields) list(next.choices[f.key] || [], f.count, f.options, f.label);
  check(
    next.boosts.reduce((a, b) => a + b, 0) === (plan.asi ? 2 : 0),
    'Confira a melhoria de atributos deste nível.',
  );
  check(
    next.boosts.every((v, i) => !v || character.stats[i] + v <= 20),
    'A melhoria não pode elevar um atributo acima de 20.',
  );
  const extraCantrips = [
    ...(next.choices.subCantrips || []),
    ...(next.choices.orderCantrip || []),
  ];
  check(
    !extraCantrips.some((id) => next.newCantrips.includes(id)),
    'Os truques adicionais devem ser diferentes dos truques da classe.',
  );
  if (next.choices.orderCantrip)
    check(
      !next.newCantrips.includes(next.choices.orderCantrip[0]),
      'O truque da ordem deve ser diferente dos truques da classe.',
    );
  if (
    next.choices.invocations?.some((s) => ['Lâmina Sedenta', 'Devorador de Vida'].includes(s))
  )
    check(
      [
        ...(plan.previous?.choices.invocation || []),
        ...(plan.previous?.choices.invocations || []),
        ...next.choices.invocations,
      ].includes('Pacto da Lâmina'),
      'Esta invocação exige Pacto da Lâmina.',
    );
  return { choice: next, plan };
}
export function advancementStats(
  character: AdvancementCharacter,
  next: AdvanceChoice,
  level: number,
) {
  const values = character.stats.map((v, i) => v + next.boosts[i]);
  if (level === 20 && next.class === 'Bárbaro')
    for (const i of [0, 2]) values[i] = Math.min(25, values[i] + 4);
  if (level === 20 && next.class === 'Monge')
    for (const i of [1, 4]) values[i] = Math.min(25, values[i] + 4);
  return values;
}
export type ClassMagic = Omit<ReturnType<typeof classProfile>, 'cantrips'> & {
  dc: number;
  attack: number;
  cantrips: string[];
  known: string[];
  allowed: string[];
  always: string[];
  prepared: string[];
  flexible: boolean;
  subclass: string;
  choices: Record<string, string[]>;
};
export function magicClasses(character: AdvancementCharacter, c: SheetChoices): ClassMagic[] {
  const prof = 2 + Math.floor((character.level - 1) / 4);
  return classStates(character, c)
    .filter((s) => classProfile(s.class, s.level, s.subclass).ability !== null)
    .map((s) => {
      const p = classProfile(s.class, s.level, s.subclass),
        always = alwaysPrepared(s.class, s.level, s.subclass, s.choices),
        flexible = !learned.includes(s.class) && !p.thirdCaster;
      if (s.class === 'Bardo' && s.subclass === 'lore')
        always.push(
          ...(c.advancement?.levels
            .filter((r) => r.class === 'Bardo' && r.classLevel === 6)
            .flatMap((r) => r.bonusSpells) || []),
        );
      if (s.class === 'Bardo' && s.level === 20)
        always.push('power-word-heal', 'power-word-kill');
      if (s.class === 'Bruxo') {
        always.push(...(s.choices.tomeRituals || []));
        if (
          [...(s.choices.invocation || []), ...(s.choices.invocations || [])].includes(
            'Pacto da Corrente',
          )
        )
          always.push('find-familiar');
        if (s.level >= 9) always.push('contact-other-plane');
      }
      if (s.class === 'Mago')
        always.push(
          ...(s.choices.mastery1 || []),
          ...(s.choices.mastery2 || []),
          ...(s.choices.signature || []),
        );
      const allowed =
        s.class === 'Mago'
          ? s.known
          : classSpellOptions(s.class, s.level, undefined, s.subclass);
      const prepared = flexible
        ? c.advancement?.prepared?.[s.class] || []
        : s.known.filter((id) => !always.includes(id));
      return {
        ...p,
        dc: 8 + prof + modifier(character.stats[p.ability!]),
        attack: prof + modifier(character.stats[p.ability!]),
        cantrips: unique([
          ...s.cantrips,
          ...(s.choices.orderCantrip || []),
          ...(s.choices.tomeCantrips || []),
          ...always.filter((id) => spells.find((v) => v.id === id)?.level === 0),
        ]),
        known: s.known,
        allowed: allowed.filter((id) => !always.includes(id)),
        always: unique(always.filter((id) => spells.find((v) => v.id === id)?.level !== 0)),
        prepared: flexible ? prepared : prepared.slice(0, p.prepareCount),
        flexible,
        subclass: s.subclass,
        choices: s.choices,
      };
    });
}
export function combinedSlots(character: AdvancementCharacter, c: SheetChoices) {
  const states = classStates(character, c),
    casters = states.filter(
      (s) =>
        full.includes(s.class) ||
        half.includes(s.class) ||
        classProfile(s.class, s.level, s.subclass).thirdCaster,
    );
  if (casters.length === 1)
    return classProfile(casters[0].class, casters[0].level, casters[0].subclass).slots;
  const total = casters.reduce(
    (sum, s) =>
      sum +
      (half.includes(s.class)
        ? Math.ceil(s.level / 2)
        : classProfile(s.class, s.level, s.subclass).thirdCaster
          ? Math.floor(s.level / 3)
          : s.level),
    0,
  );
  return total ? classProfile('Mago', Math.min(20, total)).slots : [0, 0, 0, 0, 0, 0, 0, 0, 0];
}
export type AdvancementDerived = {
  classLevels: ClassState[];
  magicClasses: ClassMagic[];
  slotsByLevel: number[];
  hitDiceByType: Record<string, number>;
  pendingLevels: number;
  attacksPerAction: number;
  martialDie: number;
};
export function applyAdvancement<
  T extends {
    hp: number;
    speed: number;
    armorClass: number;
    unarmored: number;
    equipment: string[];
    languages: string[];
    features: string[];
    featureGroups: { class: string[]; race: string[]; feats: string[] };
    skills: { name: string; value: number; trained: boolean; expert: boolean }[];
    saves: number[];
    passivePerception: number;
    proficiencies: string[];
    cantrips: string[];
    known: string[];
    slots: number;
    prepareCount: number;
    alwaysPrepared: string[];
    spellGrants: {
      source: string;
      ability: number;
      cantrips: string[];
      spells: string[];
      note: string;
    }[];
  },
>(character: AdvancementCharacter, c: SheetChoices, base: T): T & AdvancementDerived {
  const states = classStates(character, c),
    magics = magicClasses(character, c),
    slotsByLevel = combinedSlots(character, c),
    levels = c.advancement?.levels || [];
  const prof = 2 + Math.floor((character.level - 1) / 4),
    con = modifier(character.stats[2]),
    racial = character.race === 'Anão' ? 1 : 0;
  const hitDiceByType: Record<string, number> = {};
  for (const s of states)
    hitDiceByType['d' + hitDice[s.class]] =
      (hitDiceByType['d' + hitDice[s.class]] || 0) + s.level;
  let hp =
    Math.max(1, hitDice[character.class] + con + racial) +
    levels.reduce((n, s) => n + Math.max(1, hitDice[s.class] / 2 + 1 + con + racial), 0);
  const pending = Math.max(0, character.level - allocatedLevel(c));
  hp += pending * Math.max(1, hitDice[character.class] / 2 + 1 + con + racial);
  const state = (cls: string) => states.find((s) => s.class === cls),
    level = (cls: string) => state(cls)?.level || 0;
  if (state('Feiticeiro')?.subclass === 'draconic') hp += level('Feiticeiro');
  const features: string[] = [],
    groups = {
      ...base.featureGroups,
      class: [] as string[],
      feats: [...base.featureGroups.feats],
    };
  if (levels.length) {
    for (const s of states) {
      const source = (
        tables.classes as Record<string, { rows: { level: number; features: string }[] }>
      )[s.class];
      for (const row of (s.class === 'Artífice'
        ? spellData.artificer.rows
        : source.rows
      ).filter((r) => r.level <= s.level))
        for (const en of row.features.split(',').map((v) => v.trim())) {
          if (
            !en ||
            en === '—' ||
            /Subclass|Subclass feature/.test(en) ||
            ['Ability Score Improvement', 'Epic Boon'].includes(en)
          )
            continue;
          const text = featureNames[en];
          if (!text) continue;
          if (!features.some((v) => v.startsWith(text + ':')))
            features.push(
              `${text}: ${featureSummaries[en] || `${s.class}, obtida no nível ${row.level}.`}`,
            );
        }
      const sub = subclassRules[s.class]?.find((v) => v.id === s.subclass);
      if (sub)
        for (const [lv, list] of Object.entries(sub.features))
          if (Number(lv) <= s.level) features.push(...list);
      for (const [key, list] of Object.entries(s.choices))
        if (
          [
            'style',
            'order',
            'invocations',
            'metamagic',
            'element',
            'blessed',
            'elemental',
            'prey',
            'defense',
            'terrain',
            'arcanum',
            'mastery1',
            'mastery2',
            'signature',
            'maneuvers',
            'arcaneShots',
            'armorModel',
            'modifications',
            'deity',
            'vestigeDomain',
            'plans',
            'armorPlans',
          ].includes(key)
        )
          features.push(
            `${s.class} — escolha: ${list.map((id) => spells.find((v) => v.id === id)?.label || id).join(' · ')}.`,
          );
    }
    if (level('Bárbaro')) {
      const p = classProfile('Bárbaro', level('Bárbaro'));
      features.push(
        `Fúria — recursos: ${p.resources[0]} usos e +${p.resources[1]} dano com Força.`,
      );
    }
    if (level('Bardo'))
      features.push(
        `Inspiração de bardo — dado: d${classProfile('Bardo', level('Bardo')).resources[0]}.`,
      );
    if (level('Ladino'))
      features.push(
        `Ataque furtivo — dano: ${classProfile('Ladino', level('Ladino')).resources[0]}d6 uma vez por turno.`,
      );
    if (level('Monge'))
      features.push(
        `Foco — recursos: ${classProfile('Monge', level('Monge')).resources[1]} pontos; artes marciais d${classProfile('Monge', level('Monge')).resources[0]}.`,
      );
    if (level('Artífice')) {
      const p = classProfile('Artífice', level('Artífice'));
      features.push(
        'Replicação — recursos: ' +
          p.resources[0] +
          ' planos; até ' +
          p.resources[1] +
          ' itens simultâneos' +
          (state('Artífice')?.subclass === 'armorer' && level('Artífice') >= 9
            ? ' e um plano/item adicional de armadura'
            : '') +
          '.',
      );
    }
    if (level('Paladino'))
      features.push(`Cura pelas mãos — reserva: ${level('Paladino') * 5} PV.`);
    if (level('Feiticeiro') >= 2)
      features.push(
        `Pontos de feitiçaria — reserva: ${classProfile('Feiticeiro', level('Feiticeiro')).resources[0]}.`,
      );
    if (level('Guerreiro')) {
      const p = classProfile('Guerreiro', level('Guerreiro'));
      features.push(
        `Retomar o fôlego — recursos: ${p.resources[0]} usos; cura 1d10 + ${level('Guerreiro')} PV.`,
      );
      if (level('Guerreiro') >= 2)
        features.push(
          `Surto de ação — recursos: ${level('Guerreiro') >= 17 ? 2 : 1} usos por descanso curto ou longo.`,
        );
    }
    for (const name of unique(states.flatMap((s) => s.choices.mastery || [])))
      features.push(`Maestria de ${name}: disponível em ataques com esta arma.`);
    groups.class = features;
  }
  const fixedSkills = states.flatMap((s) =>
    s.class === 'Monge' && s.subclass === 'mercy' ? ['Intuição', 'Medicina'] : [],
  );
  const addedSkills = states
      .flatMap((s) => [
        ...(s.choices.skills || []),
        ...(s.choices.subSkills || []),
        ...(s.choices.knowledgeSkills || []),
        ...(s.choices.phantomTraining || []),
      ])
      .concat(fixedSkills),
    experts = unique([
      ...c.expertise,
      ...states.flatMap((s) => [
        ...(s.choices.expertise || []),
        ...(s.choices.knowledgeSkills || []),
      ]),
    ]);
  const skills = base.skills.map((s) => {
    const trained = s.trained || addedSkills.includes(s.name),
      expert = experts.includes(s.name);
    return {
      ...s,
      trained,
      expert,
      value:
        s.value +
        (addedSkills.includes(s.name) && !s.trained ? prof : 0) +
        (expert && !s.expert ? prof : 0) +
        (!trained && level('Bardo') >= 2 ? Math.floor(prof / 2) : 0) +
        (state('Patrulheiro')?.subclass === 'fey-wanderer' &&
        [5].includes(common.skillAbilities[common.skills.indexOf(s.name)])
          ? Math.max(1, modifier(character.stats[4]))
          : 0) +
        (state('Mago')?.subclass === 'enchanter' &&
        state('Mago')?.choices.subSkills?.includes(s.name)
          ? Math.max(1, modifier(character.stats[3]))
          : 0),
    };
  });
  const monk = state('Monge'),
    barb = state('Bárbaro'),
    sorc = state('Feiticeiro');
  const unarmoredOptions = [10 + modifier(character.stats[1])];
  if (monk && !base.equipment.some((e) => /Escudo/.test(e)))
    unarmoredOptions.push(10 + modifier(character.stats[1]) + modifier(character.stats[4]));
  if (barb) unarmoredOptions.push(10 + modifier(character.stats[1]) + con);
  if (sorc?.subclass === 'draconic')
    unarmoredOptions.push(10 + modifier(character.stats[1]) + modifier(character.stats[5]));
  if (state('Bardo')?.subclass === 'dance' && !base.equipment.some((e) => /Escudo/.test(e)))
    unarmoredOptions.push(10 + modifier(character.stats[1]) + modifier(character.stats[5]));
  if (state('Paladino')?.subclass === 'noble-genies')
    unarmoredOptions.push(10 + modifier(character.stats[1]) + modifier(character.stats[5]));
  const unarmored = Math.max(...unarmoredOptions);
  const armored = base.equipment.some((e) =>
      ['Cota de malha', 'Camisão de malha', 'Couro', 'Couro batido'].includes(e),
    ),
    shield = base.equipment.some((e) => /Escudo/.test(e));
  const speed =
    base.speed +
    (level('Bárbaro') >= 5 && !base.equipment.includes('Cota de malha') ? 3 : 0) +
    (monk && !armored && !shield ? classProfile('Monge', monk.level).resources[2] * 0.3 : 0) +
    (level('Patrulheiro') >= 6 && !base.equipment.includes('Cota de malha') ? 3 : 0);
  const saves = base.saves.map((v, i) =>
    level('Monge') >= 14
      ? modifier(character.stats[i]) + prof
      : level('Ladino') >= 15 && [4, 5].includes(i)
        ? modifier(character.stats[i]) + prof
        : v,
  );
  const extraSaves = states.flatMap((s) => [
    ...(s.choices.subSave || []).map((v) => statNames.indexOf(v)),
    ...(s.class === 'Clérigo' &&
    s.subclass === 'knowledge' &&
    s.level >= 6 &&
    !s.choices.subSave?.length
      ? [3]
      : []),
    ...(s.class === 'Patrulheiro' &&
    s.subclass === 'gloom-stalker' &&
    s.level >= 7 &&
    !s.choices.subSave?.length
      ? [4]
      : []),
  ]);
  for (const i of extraSaves) saves[i] = modifier(character.stats[i]) + prof;
  if (state('Patrulheiro')?.subclass === 'hollow-warden' && level('Patrulheiro') >= 7)
    saves[2] += Math.max(1, modifier(character.stats[4]));
  const secondary: Record<string, string[]> = {
    Artífice: ['Armaduras leves, médias e escudos', 'Ferramentas de funileiro'],
    Bárbaro: ['Armas marciais', 'Escudos'],
    Bardo: ['Armaduras leves'],
    Bruxo: ['Armaduras leves'],
    Clérigo: ['Armaduras leves, médias e escudos'],
    Druida: ['Armaduras leves e escudos'],
    Feiticeiro: [],
    Guerreiro: ['Armas marciais', 'Armaduras leves, médias e escudos'],
    Ladino: ['Armaduras leves', 'Ferramentas de ladrão'],
    Mago: [],
    Monge: [],
    Paladino: ['Armas marciais', 'Armaduras leves, médias e escudos'],
    Patrulheiro: ['Armas marciais', 'Armaduras leves, médias e escudos'],
  };
  const proficiencies = unique([
    ...base.proficiencies,
    ...states.slice(1).flatMap((s) => secondary[s.class] || []),
    ...states.flatMap((s) => [
      ...(subclassToolGrants[s.class + '/' + s.subclass] || []),
      ...(s.choices.subTools || []),
      ...(s.choices.phantomTraining || []).filter((v) => !common.skills.includes(v)),
    ]),
    ...states.flatMap((s) =>
      s.subclass === 'valor'
        ? ['Armas marciais', 'Armaduras médias e escudos']
        : s.subclass === 'battle-smith'
          ? ['Armas marciais']
          : s.subclass === 'artillerist'
            ? ['Armas marciais à distância']
            : s.subclass === 'armorer'
              ? ['Armaduras pesadas']
              : s.subclass === 'bladesinger'
                ? ['Armas marciais corpo a corpo sem Pesada ou Duas Mãos']
                : [],
    ),
    ...states.flatMap((s) => s.choices.instrument || []),
    ...states.flatMap((s) =>
      s.choices.order?.includes('Protetor')
        ? ['Armas marciais e armaduras pesadas']
        : s.choices.order?.includes('Guardião')
          ? ['Armas marciais e armaduras médias']
          : [],
    ),
  ]);
  const attacksPerAction = Math.max(
    1,
    level('Guerreiro') >= 20 ? 4 : level('Guerreiro') >= 11 ? 3 : 0,
    ...states.map((s) => {
      const required = subclassRules[s.class]?.find((v) => v.id === s.subclass)?.extraAttack;
      return required && s.level >= required ? 2 : 1;
    }),
    ...['Guerreiro', 'Bárbaro', 'Monge', 'Paladino', 'Patrulheiro'].map((cls) =>
      level(cls) >= 5 ? 2 : 1,
    ),
  );
  const extraDefense =
    armored &&
    states.some((s) => s.choices.style?.includes('Defesa')) &&
    !c.options.style?.includes('Defesa')
      ? 1
      : 0;
  const result = {
    ...base,
    hp,
    speed,
    saves,
    skills,
    passivePerception: 10 + skills.find((s) => s.name === 'Percepção')!.value,
    unarmored,
    armorClass: (!armored ? unarmored + (shield ? 2 : 0) : base.armorClass) + extraDefense,
    proficiencies,
    languages: unique([
      ...base.languages,
      ...states.flatMap((s) => s.choices.languages || []),
      ...(level('Druida') || state('Bardo')?.subclass === 'moon' ? ['Druídico'] : []),
      ...(level('Ladino') ? ['Gíria dos ladrões'] : []),
    ]),
    classLevels: states,
    magicClasses: magics,
    slotsByLevel,
    hitDiceByType,
    pendingLevels: pending,
    attacksPerAction,
    martialDie:
      monk && !armored && !shield ? classProfile('Monge', monk.level).resources[0] : 0,
  };
  for (const s of states) {
    const sub = subclassRules[s.class]?.find((v) => v.id === s.subclass);
    const innate = (sub?.innate || []).filter((v) => v.level <= s.level);
    if (!magics.some((m) => m.class === s.class)) {
      const selected = alwaysPrepared(s.class, s.level, s.subclass, s.choices);
      if (selected.length)
        innate.push({
          level: 3,
          spells: selected,
          ability: s.subclass === 'scion-of-three' ? 'int' : null,
        });
    }
    for (const grant of innate) {
      const abilityIndex =
        ({ str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 } as Record<string, number>)[
          grant.ability || ''
        ] ??
        (s.class === 'Bárbaro' && s.subclass === 'wild-heart' ? 4 : (ability[s.class] ?? 3));
      result.spellGrants.push({
        source: sub?.name || s.class,
        ability: abilityIndex,
        cantrips: grant.spells.filter((id) => spells.find((v) => v.id === id)?.level === 0),
        spells: grant.spells.filter((id) => spells.find((v) => v.id === id)?.level !== 0),
        note: 'Disponibilidade, custos e usos conforme a característica da subclasse; não acrescenta espaços de magia.',
      });
    }
  }
  if (levels.length) {
    result.featureGroups = groups;
    result.features = [...groups.race, ...groups.class, ...groups.feats];
    const primary = magics.find((m) => m.class === character.class);
    if (primary) {
      result.cantrips = primary.cantrips;
      result.known = primary.known;
      result.prepareCount = primary.prepareCount;
      result.slots = primary.class === 'Bruxo' ? primary.pactSlots : slotsByLevel[0];
      result.alwaysPrepared = primary.always;
    }
  }
  return result;
}
