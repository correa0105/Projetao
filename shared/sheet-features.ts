import tables from './class-advancement-tables.json';
import rules from './character-rules-2024.json';
import { classStates, subclassRules, type AdvancementCharacter } from './character-advancement.js';
import { featureNames, featureSummaries } from './class-advancement-text.js';
import { feats, type SheetChoices } from './character-sheet.js';
import { featRules } from './feat-choices.js';
import { classFightingStyles } from './fighting-styles.js';
import { eberronSpecies, EBERRON_SOURCE } from './eberron-species.js';
export type SheetFeatureEntry = {
  id: string;
  category: 'class' | 'feat' | 'race' | 'background';
  title: string;
  description: string;
  source: string;
  className?: string;
  classLevel?: number;
};
const labels: Record<string, string> = {
  skills: 'Perícias',
  expertise: 'Especialização',
  mastery: 'Maestrias de armas',
  order: 'Ordem',
  orderCantrip: 'Truque da ordem',
  invocation: 'Invocações místicas',
  invocations: 'Invocações místicas',
  metamagic: 'Metamagia',
  element: 'Afinidade elemental',
  blessed: 'Golpes abençoados',
  elemental: 'Fúria elemental',
  prey: 'Presa do caçador',
  defense: 'Defesa',
  terrain: 'Terreno do círculo',
  arcanum: 'Arcano místico',
  mastery1: 'Domínio de magia',
  mastery2: 'Domínio de magia',
  signature: 'Magias de assinatura',
  maneuvers: 'Manobras',
  arcaneShots: 'Disparos arcanos',
  armorModel: 'Modelo de armadura',
  modifications: 'Modificações',
  deity: 'Divindade',
  vestigeDomain: 'Domínio do vestígio',
  plans: 'Planos de itens',
  armorPlans: 'Planos de armadura',
  subSkills: 'Perícias da subclasse',
  subTools: 'Ferramentas da subclasse',
  subCantrips: 'Truques da subclasse',
  languages: 'Idiomas',
  rogueLanguage: 'Idioma de ladrão',
  instrument: 'Instrumento',
  subSave: 'Proficiência em salvaguarda',
  knowledgeSkills: 'Perícias de conhecimento',
  phantomTraining: 'Treinamento dos mortos',
  loreBonus: 'Descobertas mágicas',
  tomeCantrips: 'Truques do tomo',
  tomeRituals: 'Rituais do tomo',
  subLanguages: 'Idiomas da subclasse',
  draconicAncestor: 'Ancestralidade dracônica',
  dragon: 'Ancestralidade dracônica',
  enemy: 'Inimigo favorito',
  artificerTool: 'Ferramenta de artífice',
  monkTool: 'Ferramenta de monge',
  instruments: 'Instrumentos',
  fightingStyle: 'Estilo de luta',
};
const spell = (v: string) => rules.spells.find((s) => s.id === v)?.label || v;
const split = (text: string) => {
  const i = text.indexOf(':');
  return {
    title: i < 0 ? text : text.slice(0, i),
    description: i < 0 ? '' : text.slice(i + 1).trim(),
  };
};
export function sheetFeatureEntries(
  character: AdvancementCharacter,
  c: SheetChoices,
  groups: { race: string[]; class: string[]; feats: string[]; background?: string[] },
): SheetFeatureEntry[] {
  const entries: SheetFeatureEntry[] = [],
    states = classStates(character, c),
    levels = c.advancement?.levels || [];
  const add = (
    category: SheetFeatureEntry['category'],
    title: string,
    description: string,
    source: string,
    cls?: string,
    lv?: number,
  ) =>
    entries.push({
      id: `${category}-${entries.length}`,
      category,
      title,
      description,
      source,
      ...(cls ? { className: cls, classLevel: lv } : {}),
    });
  for (const text of groups.race) {
    const t = split(text);
    add(
      'race',
      t.title,
      t.description,
      'Espécie · ' +
        (c.subrace || character.race) +
        (Object.hasOwn(eberronSpecies, character.race) ? ' · ' + EBERRON_SOURCE : ''),
    );
  }
  for (const text of groups.background || []) {
    const t = split(text);
    add('background', t.title, t.description, 'Antecedente · ' + c.backgroundType);
  }
  feats(c).forEach((name, index) => {
    const rule = featRules.find(
        (f) =>
          f.name === name || (f.id === 'magic-initiate' && name.startsWith('Iniciado em Magia')),
      ),
      details = groups.feats.find((v) => v.startsWith(name + ':'));
    add(
      'feat',
      name,
      details
        ? split(details).description
        : rule?.text || 'Talento de origem escolhido na criação.',
      index === 0 ? 'Antecedente · ' + c.backgroundType : 'Espécie · Humano · Versatilidade',
    );
  });
  for (const s of states) {
    const rows =
      s.class === 'Artífice'
        ? rules.artificer.rows
        : (tables.classes as Record<string, { rows: { level: number; features: string }[] }>)[
            s.class
          ].rows;
    const seen = new Set<string>();
    const source = (lv: number) => `${s.class} · nível ${lv}`;
    for (const row of rows.filter((r) => r.level <= s.level))
      for (const en of row.features.split(',').map((v) => v.trim())) {
        if (!en || en === '—' || /Subclass/.test(en)) continue;
        const name = featureNames[en];
        if (!name) continue;
        if (['Ability Score Improvement', 'Epic Boon'].includes(en)) {
          const gained = levels.find((r) => r.class === s.class && r.classLevel === row.level);
          if (gained)
            add(
              'class',
              name,
              gained.feat
                ? `Escolheu o talento ${featRules.find((f) => f.id === gained.feat)?.name || gained.feat}.`
                : 'Escolheu a melhoria de atributos deste nível.',
              source(row.level),
              s.class,
              row.level,
            );
        } else if (!seen.has(name)) {
          seen.add(name);
          add(
            'class',
            name,
            featureSummaries[en] || 'Recurso da classe.',
            source(row.level),
            s.class,
            row.level,
          );
        }
      }
    const sub = subclassRules[s.class]?.find((v) => v.id === s.subclass);
    if (sub)
      for (const [lv, list] of Object.entries(sub.features))
        if (Number(lv) <= s.level)
          for (const text of list) {
            const t = split(text);
            add(
              'class',
              t.title,
              t.description,
              `${source(Number(lv))} · ${sub.name}`,
              s.class,
              Number(lv),
            );
          }
    const grantLevel = (key: string, value: string) =>
      s.class === character.class &&
      ((c.options[key] || []).includes(value) ||
        (key === 'expertise' && c.expertise.includes(value)))
        ? 1
        : levels.find((r) => r.class === s.class && r.choices[key]?.includes(value))?.classLevel;
    for (const [key, values] of Object.entries(s.choices)) {
      if (['style', 'feats'].includes(key) || key.startsWith('feat')) continue;
      const grouped = new Map<number, string[]>();
      for (const value of values) {
        if (rules.spells.some((s) => s.id === value)) continue;
        const lv = grantLevel(key, value);
        if (lv) grouped.set(lv, [...(grouped.get(lv) || []), spell(value)]);
      }
      for (const [lv, values] of grouped)
        add(
          'class',
          labels[key] || 'Escolha da classe',
          values.join(' · '),
          source(lv),
          s.class,
          lv,
        );
    }
    const active = classFightingStyles(character.class, c)[s.class] || [];
    for (const style of active) {
      let original = style,
        changed = 0;
      for (const row of [...levels].reverse())
        if (row.class === s.class)
          for (const swap of row.retrain || [])
            if (swap.kind === 'style' && swap.to === original) {
              original = swap.from;
              changed = Math.max(changed, row.classLevel);
            }
      for (const edit of [...(c.advancement?.styleChanges || [])].reverse())
        if (s.class === 'Guerreiro' && edit.to === original) {
          original = edit.from;
          changed = Math.max(changed, edit.classLevel);
        }
      const featRow = levels.find(
          (r) => r.class === s.class && featRules.find((f) => f.id === r.feat)?.name === original,
        ),
        lv =
          grantLevel('style', original) ?? featRow?.classLevel ?? (s.class === 'Guerreiro' ? 1 : 2);
      add(
        'feat',
        style,
        (featRules.find((f) => f.name === style)?.text || 'Estilo de luta escolhido.') +
          (changed ? ` Alterado no nível ${changed} de ${s.class}.` : ''),
        source(lv) + (featRow ? ' · talento escolhido na melhoria' : ' · Estilo de luta'),
        s.class,
        lv,
      );
    }
    const resourceLevel: Record<string, number> = {
      Bárbaro: 1,
      Bardo: 1,
      Ladino: 1,
      Monge: 2,
      Artífice: 2,
      Paladino: 1,
      Feiticeiro: 2,
      Guerreiro: 1,
    };
    const resourceTitles: Record<string, string[]> = {
      Bárbaro: ['Fúria'],
      Bardo: ['Inspiração de bardo'],
      Ladino: ['Ataque furtivo'],
      Monge: ['Foco'],
      Artífice: ['Replicação'],
      Paladino: ['Cura pelas mãos'],
      Feiticeiro: ['Pontos de feitiçaria'],
      Guerreiro: ['Retomar o fôlego', 'Surto de ação'],
    };
    for (const text of groups.class)
      if (
        /— (recursos|reserva|dado|dano):/.test(text) &&
        resourceTitles[s.class]?.some((t) => text.startsWith(t + ' —'))
      ) {
        const t = split(text),
          lv = text.startsWith('Surto') ? 2 : resourceLevel[s.class];
        add(
          'class',
          t.title,
          t.description,
          source(lv) + ` · valores no nível ${s.level}`,
          s.class,
          lv,
        );
      }
    for (const row of levels.filter((r) => r.class === s.class)) {
      const feat = featRules.find((f) => f.id === row.feat);
      if (feat && feat.category !== 'FS')
        add(
          'feat',
          feat.name,
          feat.text +
            ' ' +
            Object.entries(row.choices)
              .filter(([k]) => k.startsWith('feat'))
              .flatMap(([, v]) => v)
              .map(spell)
              .join(' · '),
          source(row.classLevel) + ' · talento escolhido na melhoria',
          s.class,
          row.classLevel,
        );
    }
  }
  return entries;
}
