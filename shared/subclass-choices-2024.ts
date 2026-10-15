import { statNames } from './rules.js';
import common from './sheet-common.json';
import catalog from './character-rules-2024.json';
import type { AdvanceField, ClassState } from './character-advancement.js';
const artisanTools = [
  'Ferramentas de alquimista',
  'Ferramentas de cervejeiro',
  'Suprimentos de caligrafia',
  'Ferramentas de carpinteiro',
  'Ferramentas de cartógrafo',
  'Ferramentas de sapateiro',
  'Ferramentas de cozinheiro',
  'Ferramentas de vidreiro',
  'Ferramentas de joalheiro',
  'Ferramentas de couro',
  'Ferramentas de pedreiro',
  'Ferramentas de pintor',
  'Ferramentas de oleiro',
  'Ferramentas de ferreiro',
  'Ferramentas de funileiro',
  'Ferramentas de tecelão',
  'Ferramentas de entalhador',
];
export { artisanTools };
const maneuvers = [
  'Ataque ameaçador',
  'Ataque de desarme',
  'Ataque de distração',
  'Ataque de empurrão',
  'Ataque de finta',
  'Ataque de manobra',
  'Ataque de precisão',
  'Ataque de provocação',
  'Ataque em investida',
  'Ataque varredor',
  'Derrubar',
  'Emboscada',
  'Estocada',
  'Golpe do comandante',
  'Presença imponente',
  'Ripostar',
  'Aparar',
  'Avaliação tática',
  'Reagrupar',
];
const shots = [
  'Flecha de banimento',
  'Flecha enfeitiçante',
  'Flecha explosiva',
  'Flecha enredante',
  'Flecha perfurante',
  'Flecha perseguidora',
  'Flecha sombria',
  'Flecha debilitante',
];
export const subclassToolGrants: Record<string, string[]> = {
  'Artífice/alchemist': ['Ferramentas de alquimista', 'Kit de herbalismo'],
  'Artífice/armorer': ['Ferramentas de ferreiro'],
  'Artífice/artillerist': ['Ferramentas de entalhador'],
  'Artífice/battle-smith': ['Ferramentas de ferreiro'],
  'Artífice/cartographer': ['Suprimentos de caligrafia', 'Ferramentas de cartógrafo'],
  'Artífice/reanimator': ['Ferramentas de alquimista'],
  'Monge/mercy': ['Kit de herbalismo'],
  'Ladino/assassin': ['Kit de disfarce', 'Kit de venenos'],
  'Bardo/spirits': ['Baralho'],
};
export function subclassFields(input: {
  cls: string;
  sub: string;
  level: number;
  previous?: ClassState;
  trained: string[];
  tools: string[];
  cantrips: string[];
  choices: Record<string, string[]>;
  languages: string[];
  saves: number[];
}): AdvanceField[] {
  const { cls, sub, level, previous, trained, tools, cantrips, choices, languages, saves } =
    input;
  const fields: AdvanceField[] = [];
  const add = (key: string, label: string, count: number, options: string[]) => {
    if (count > 0) fields.push({ key, label, count, options: [...new Set(options)] });
  };
  const skills = (options = common.skills) => options.filter((v) => !trained.includes(v));
  const spellChoices = (list: string, circle = 0) =>
    catalog.spells
      .filter((s) => s.level === circle && s.classes.includes(list) && !cantrips.includes(s.id))
      .map((s) => s.id);
  const selectSkill = (label: string, options = common.skills, count = 1, key = 'subSkills') =>
    add(key, label, count, skills(options).length >= count ? skills(options) : skills());
  const selectTool = (label: string, count = 1) =>
    add(
      'subTools',
      label,
      count,
      artisanTools.filter((v) => !tools.includes(v)),
    );
  if (level === 3) {
    if (cls === 'Guerreiro' && sub === 'battle-master') {
      selectSkill(
        'Perícia de Estudioso da Guerra',
        (common.classes.Guerreiro.skills as string[]).concat('Persuasão'),
      );
      selectTool('Ferramenta de Estudioso da Guerra');
    }
    if (cls === 'Guerreiro' && sub === 'arcane-archer') {
      selectSkill('Conhecimento do Arqueiro Arcano', ['Arcanismo', 'Natureza']);
      add(
        'subCantrips',
        'Truque do Arqueiro Arcano (Inteligência)',
        1,
        ['druidcraft', 'prestidigitation'].filter((v) => !cantrips.includes(v)),
      );
    }
    if (cls === 'Guerreiro' && sub === 'banneret') {
      selectSkill('Perícia do Porta-estandarte', [
        'Intuição',
        'Intimidação',
        'Persuasão',
        'Atuação',
      ]);
      add('languages', 'Idioma do Porta-estandarte', 1, languages);
    }
    if (cls === 'Bardo' && sub === 'moon') {
      selectSkill('Conhecimento primal', [
        'Adestrar Animais',
        'Intuição',
        'Medicina',
        'Natureza',
        'Percepção',
        'Sobrevivência',
      ]);
      add('subCantrips', 'Truque primal (Carisma)', 1, spellChoices('druid'));
    }
    if (cls === 'Clérigo' && sub === 'knowledge') {
      add('knowledgeSkills', 'Bênçãos do Conhecimento: duas especializações', 2, [
        'Arcanismo',
        'História',
        'Natureza',
        'Religião',
      ]);
      selectTool('Ferramenta do Conhecimento');
    }
    if (cls === 'Clérigo' && sub === 'arcana') {
      selectSkill('Estudante do Arcano', ['Arcanismo']);
      add(
        'subCantrips',
        'Truques de mago do Domínio Arcano (Sabedoria)',
        2,
        spellChoices('wizard'),
      );
    }
    if (cls === 'Patrulheiro' && sub === 'fey-wanderer')
      selectSkill('Glamour sobrenatural', ['Enganação', 'Atuação', 'Persuasão']);
    if (cls === 'Ladino' && sub === 'scion-of-three')
      add('deity', 'Divindade dos Três Mortos', 1, ['Bane', 'Bhaal', 'Myrkul']);
    if (cls === 'Ladino' && sub === 'phantom')
      add('phantomTraining', 'Sussurros dos Mortos: proficiência inicial', 1, [
        ...skills(),
        ...artisanTools.filter((v) => !tools.includes(v)),
      ]);
    if (cls === 'Paladino' && sub === 'noble-genies')
      selectSkill('Dádiva dos Gênios Nobres', [
        'Acrobacia',
        'Intimidação',
        'Atuação',
        'Persuasão',
      ]);
    if (cls === 'Mago' && sub === 'bladesinger')
      selectSkill('Treinamento na Canção da Lâmina', [
        'Acrobacia',
        'Atletismo',
        'Atuação',
        'Persuasão',
      ]);
    if (cls === 'Mago' && sub === 'enchanter')
      selectSkill('Lábia encantadora', ['Enganação', 'Intimidação', 'Persuasão']);
    if (cls === 'Bruxo' && sub === 'vestige')
      add('vestigeDomain', 'Domínio do vestígio', 1, ['Vida', 'Luz', 'Trapaça', 'Guerra']);
    if (cls === 'Artífice' && sub === 'armorer')
      add('armorModel', 'Modelo inicial da armadura', 1, [
        'Couraçado',
        'Guardião',
        'Infiltrador',
      ]);
    const replacements = (subclassToolGrants[cls + '/' + sub] || []).filter((v) =>
      tools.includes(v),
    ).length;
    if (cls === 'Artífice' && replacements)
      selectTool('Ferramentas substitutas da especialização', replacements);
  }
  if (cls === 'Guerreiro' && sub === 'battle-master' && [3, 7, 10, 15].includes(level))
    add(
      'maneuvers',
      'Novas manobras do Mestre de Batalha',
      level === 3 ? 3 : 2,
      maneuvers.filter((v) => !previous?.choices.maneuvers?.includes(v)),
    );
  if (cls === 'Guerreiro' && sub === 'arcane-archer' && [3, 7, 10, 15, 18].includes(level))
    add(
      'arcaneShots',
      'Novos disparos arcanos',
      level === 3 ? 2 : 1,
      shots.filter((v) => !previous?.choices.arcaneShots?.includes(v)),
    );
  if (
    (cls === 'Clérigo' && sub === 'knowledge' && level === 6) ||
    (cls === 'Patrulheiro' && sub === 'gloom-stalker' && level === 7)
  ) {
    const fixed = cls === 'Clérigo' ? 3 : 4;
    if (saves.includes(fixed))
      add(
        'subSave',
        'Salvaguarda substituta',
        1,
        (cls === 'Clérigo' ? [0, 1, 2, 3, 4, 5] : [3, 5])
          .filter((i) => !saves.includes(i))
          .map((i) => statNames[i]),
      );
  }
  if (cls === 'Clérigo' && sub === 'arcana' && level === 17)
    for (const circle of [6, 7, 8, 9])
      add(
        'arcana' + circle,
        'Maestria Arcana: círculo ' + circle,
        1,
        spellChoices('wizard', circle),
      );
  if (cls === 'Artífice') {
    const total = catalog.artificer.rows[level - 1].numbers[0],
      previousPlans = previous?.choices.plans || [];
    add(
      'plans',
      'Novos planos de itens mágicos',
      Math.max(0, total - previousPlans.length),
      catalog.artificer.plans
        .filter(
          (p) =>
            p.level <= level &&
            !previousPlans.includes(p.label) &&
            !previous?.choices.armorPlans?.includes(p.label),
        )
        .map((p) => p.label),
    );
    if (sub === 'armorer' && level === 9)
      add(
        'armorPlans',
        'Plano adicional de armadura',
        1,
        catalog.artificer.plans
          .filter((p) => p.armor && p.level <= level && !previousPlans.includes(p.label))
          .map((p) => p.label),
      );
  }
  if (cls === 'Artífice' && sub === 'reanimator' && [5, 9].includes(level))
    add(
      'modifications',
      'Modificações do companheiro',
      1,
      (level === 5
        ? ['Condutor arcano', 'Ferocidade']
        : ['Condutor arcano', 'Ferocidade', 'Inchado', 'Esquálido']
      ).filter((v) => !previous?.choices.modifications?.includes(v)),
    );
  return fields;
}
