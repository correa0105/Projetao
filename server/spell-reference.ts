import references from '../data/spell-reference-2024.json' with { type: 'json' };
import { spells } from '../shared/character-sheet.js';
import { translateMonsterLines } from './vtt-translate.js';
import { AppError } from './services.js';

const catalog = new Map(references.map((s) => [s.id, s]));
const cache = new Map<string, Promise<unknown>>();
const terms = {
  ...Object.fromEntries(spells.map((s) => [s.name, s.label])),
  'ranged spell attack': 'ataque à distância com magia',
  'melee spell attack': 'ataque corpo a corpo com magia',
  'spell attack roll': 'rolagem de ataque com magia',
  'attack roll': 'rolagem de ataque',
  'spellcasting ability modifier': 'modificador do atributo de conjuração',
  'spell save DC': 'CD de salvaguarda de magia',
  'spell slot': 'espaço de magia',
  'spell slots': 'espaços de magia',
  'using a higher-level spell slot': 'Usando um espaço de magia de círculo superior',
  'ability checks': 'testes de atributo',
  'ability check': 'teste de atributo',
  'saving throws': 'salvaguardas',
  'on a hit': 'em caso de acerto',
  'on a miss': 'em caso de erro',
  'the target takes': 'o alvo sofre',
  'on a failed save': 'em caso de falha na salvaguarda',
  'on a successful save': 'em caso de sucesso na salvaguarda',
  'on a successful one': 'em caso de sucesso',
  'half as much damage': 'metade do dano',
  'bonus action': 'ação bônus',
  'magic action': 'ação de Magia',
  'dodge action': 'ação Esquivar',
  'temporary hit points': 'pontos de vida temporários',
  'difficult terrain': 'terreno difícil',
  'long rest': 'descanso longo',
  'short rest': 'descanso curto',
  'half cover': 'meia cobertura',
  'three-quarters cover': 'cobertura de três quartos',
  'total cover': 'cobertura total',
  advantage: 'vantagem',
  disadvantage: 'desvantagem',
  concentration: 'concentração',
  charmed: 'enfeitiçado',
  frightened: 'amedrontado',
  prone: 'caído',
  restrained: 'contido',
  incapacitated: 'incapacitado',
  stunned: 'atordoado',
  paralyzed: 'paralisado',
  poisoned: 'envenenado',
  blinded: 'cego',
  deafened: 'surdo',
  invisible: 'invisível',
  unconscious: 'inconsciente',
  reaction: 'reação',
  turn: 'turno',
  round: 'rodada',
  feet: 'pés',
  spell: 'magia',
  spells: 'magias',
};
export function spellReference(id: string): Promise<unknown> {
  const spell = catalog.get(id);
  if (!spell) throw new AppError(404, 'Magia não encontrada.');
  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => ({
      ...spell,
      description: spell.translated
        ? spell.description
        : (await translateMonsterLines([spell.description], terms))[0],
      translated: true,
    }))();
    cache.set(id, pending);
    pending.catch(() => cache.delete(id));
  }
  return pending;
}
