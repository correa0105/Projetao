import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
type CatalogRuleItem = {
  id: string;
  name: string;
  description: string;
  source: string;
  source_url: string;
  category: string;
  raw_data?: Record<string, any> | null;
};
type RecordRule = { name: string; portuguese: string; stats: string; reference_url: string };
type RulesData = {
  edition: string;
  records: Record<string, RecordRule>;
  items: Record<
    string,
    {
      keys: string[];
      reference_key: string;
      variant: string;
      reference_url?: string;
      stats_overrides?: Record<string, string>;
    }
  >;
};
let cached: Promise<RulesData> | undefined;
function dataset() {
  return (cached ??= readFile(resolve('data/shop-item-rules.json'), 'utf8')
    .then((s) => JSON.parse(s) as RulesData)
    .catch((e) => {
      cached = undefined;
      throw e;
    }));
}
export const adamantineHouseRule =
  'Regra da casa — proteção adamantina (1 vez por dia da aventura): enquanto você vestir esta armadura, somente o primeiro acerto crítico sofrido no dia se torna um acerto normal. O ataque ainda acerta e causa seu dano normal; apenas os dados e efeitos adicionais do crítico são anulados. Os críticos seguintes do mesmo dia funcionam normalmente. A proteção se renova no próximo amanhecer. O limite é por personagem, compartilhado entre peças e modelos de armadura de adamante; trocar de armadura não concede outra proteção no mesmo dia.';
function adamantine(item: CatalogRuleItem) {
  return (
    item.raw_data?.magic_family === 'Adamantine Armor' ||
    /^adamantine-armor(?:-|$)/.test(item.id) ||
    /^adamantine-armor(?:-|$)/.test(item.raw_data?.armor_bundle_parent ?? '')
  );
}
const damage: Record<string, string> = {
  A: 'ácido',
  B: 'concussão',
  C: 'frio',
  F: 'fogo',
  O: 'força',
  L: 'elétrico',
  N: 'necrótico',
  P: 'perfurante',
  I: 'veneno',
  Y: 'psíquico',
  R: 'radiante',
  S: 'cortante',
  T: 'trovejante',
  fire: 'fogo',
  cold: 'frio',
  acid: 'ácido',
  lightning: 'elétrico',
  thunder: 'trovejante',
  force: 'força',
  necrotic: 'necrótico',
  radiant: 'radiante',
  poison: 'veneno',
  psychic: 'psíquico',
  bludgeoning: 'concussão',
  piercing: 'perfurante',
  slashing: 'cortante',
};
function factualStats(item: CatalogRuleItem) {
  const f = item.raw_data?.upstream_facts;
  if (!f) return '';
  const lines: string[] = [];
  if (f.dmg1)
    lines.push(
      `Dano da arma: ${f.dmg1} de ${damage[f.dmgType] ?? f.dmgType ?? 'tipo indicado nas regras'}.`,
    );
  if (f.dmg2) lines.push(`Dano com duas mãos (Versátil): ${f.dmg2}.`);
  if (f.bonusWeapon)
    lines.push(`Bônus mágico: ${f.bonusWeapon} nas jogadas de ataque e dano com esta arma.`);
  if (f.bonusWeaponDamage) lines.push(`Bônus adicional ao dano da arma: ${f.bonusWeaponDamage}.`);
  if (Array.isArray(f.resist))
    for (const type of f.resist)
      if (typeof type === 'string')
        lines.push(
          `Resistência a dano de ${damage[type] ?? type}, nas condições descritas no efeito.`,
        );
  if (/um dado de dano adicional/i.test(item.raw_data?.rules_summary ?? '')) {
    const die = String(f.dmg1 ?? '').match(/d(\d+)/i),
      versatile = String(f.dmg2 ?? '').match(/d(\d+)/i),
      type = damage[f.dmgType] ?? f.dmgType ?? 'tipo da arma';
    if (die)
      lines.push(
        `Dado adicional na condição descrita: +1d${die[1]} de dano ${type}.` +
          (versatile && versatile[1] !== die[1]
            ? ` Ao usar o dano Versátil com duas mãos: +1d${versatile[1]} de dano ${type}.`
            : ''),
      );
    else
      lines.push(
        'Este modelo tem dano base fixo, sem dado de dano próprio; a referência ao dado adicional usa um dado próprio da arma, quando houver.',
      );
  }
  return lines.join('\n');
}
const readable: Record<string, string> = {
  'XDMG:Frost Brand':
    'Ao acertar um ataque com esta arma mágica, o alvo sofre 1d6 de dano de frio adicional. Enquanto você a segura, você tem resistência a dano de fogo.\nEm temperaturas de congelamento, a arma emite luz plena em um raio de 10 pés e penumbra por mais 10 pés.\nAo sacar a arma, você pode apagar todas as chamas não mágicas a até 30 pés de você. Depois de usar essa propriedade, deve esperar 1 hora para usá-la novamente.',
  'XPHB:Maestria: Enfraquecer':
    'Se você acertar uma criatura com esta arma, ela tem desvantagem em sua próxima jogada de ataque antes do início do seu próximo turno. Exige acesso à propriedade de maestria desta arma.',
};
export async function catalogItemMechanics(item: CatalogRuleItem) {
  const house = adamantine(item),
    raw = item.raw_data ?? {};
  if (raw.shop_magic_completion === true && !house) {
    if (typeof raw.rules_summary !== 'string' || !raw.rules_summary.trim()) return null;
    return {
      description: [raw.rules_summary, factualStats(item)].filter(Boolean).join('\n\n'),
      source_name: `${raw.source_book} · resumo original do projeto`,
      source_url: item.source_url,
      reference_url: item.source_url,
      project_content: false,
      edition: raw.source_edition,
    };
  }
  if (item.source !== 'SRD 5.2.1' && !house) return null;
  const data = await dataset(),
    parent = raw.armor_bundle_parent as string | undefined,
    isPiece = !!parent && parent !== item.id;
  const mapping = data.items[item.id] ?? (house && parent ? data.items[parent] : undefined);
  if (!mapping || mapping.keys.some((k) => !data.records[k])) return null;
  const sections = mapping.keys.map((key) => {
    const r = data.records[key];
    if (house && r.name === 'Adamantine Armor') return adamantineHouseRule;
    return [
      r.name.startsWith('Maestria:') ? r.name : '',
      readable[key] ?? r.portuguese,
      mapping.stats_overrides?.[key] ?? r.stats,
    ]
      .filter(Boolean)
      .join('\n\n');
  });
  if (isPiece)
    sections.unshift(
      'Peça visual do conjunto ' +
        (raw.armor_bundle_name ?? parent) +
        '. Não concede estatísticas nem proteções independentes; a regra abaixo se refere à armadura completa.',
    );
  return {
    description: [...sections, mapping.variant].filter(Boolean).join('\n\n'),
    source_name: house
      ? 'Alvorada Cinzenta · regra da casa sobre o modelo SRD 5.2.1'
      : 'SRD 5.2.1 · Wizards of the Coast · CC BY 4.0 (tradução do projeto)',
    source_url: 'https://www.dndbeyond.com/srd',
    reference_url: mapping.reference_url || data.records[mapping.reference_key].reference_url,
    project_content: house,
    house_rule: house,
    edition: house ? 'Regra da casa · modelo 2024' : data.edition,
  };
}
export async function synchronizeCatalogMechanics(db: Pick<PoolClient, 'query'>) {
  const { rows } = await db.query(
    `SELECT id,name,description,source,source_url,category,raw_data FROM catalog_items WHERE (source='SRD 5.2.1' OR raw_data->>'shop_magic_completion'='true') AND (category='Armas' OR raw_data->'equipment_slots' ? 'main_hand' OR id LIKE 'adamantine-armor%' OR raw_data->>'armor_bundle_parent' LIKE 'adamantine-armor%')`,
  );
  const changes: { id: string; description: string }[] = [];
  for (const item of rows) {
    const rules = await catalogItemMechanics(item);
    if (rules && rules.description !== item.description)
      changes.push({ id: item.id, description: rules.description });
  }
  if (changes.length)
    await db.query(
      'UPDATE catalog_items c SET description=r.description FROM jsonb_to_recordset($1::jsonb) AS r(id text,description text) WHERE c.id=r.id',
      [JSON.stringify(changes)],
    );
}
