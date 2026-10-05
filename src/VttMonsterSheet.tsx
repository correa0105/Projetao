import { useState } from 'react';
import { Dices, Shield, Heart, Swords } from 'lucide-react';
import { modifier, statNames } from '../shared/rules';
import { monsterActions, type MonsterAction } from '../shared/vtt-monster-actions';
import { monsterSections } from '../shared/vtt-compendium';
import { VttModal } from './VttMaps';
import { ActionShortcut } from './VttHotbar';
import './vtt-monster-sheet.css';

export type MonsterProfile = {
  name: string;
  details: string;
  actionDetails?: string;
  image?: string;
  hp: number;
  maxHp?: number;
  ac: number;
  stats: number[];
  type?: string;
  size?: string;
  source?: string;
  cr?: string;
  speed?: string;
  information?: { label: string; value: string }[];
};
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
const sizes: Record<string, string> = {
  T: 'Minúsculo',
  S: 'Pequeno',
  M: 'Médio',
  L: 'Grande',
  H: 'Enorme',
  G: 'Imenso',
};
function Description({ text }: { text: string }) {
  return (
    <p>
      {text
        .split(
          /(Acerto:|Falha:|Sucesso ou falha:|Sucesso:|Hit:|Failure:|Success:|Salvaguarda\s+\w+\s+\d+)/g,
        )
        .map((part, i) =>
          /^(?:Acerto:|Falha:|Sucesso|Hit:|Failure:|Success:|Salvaguarda)/.test(part) ? (
            <strong key={i}>{part}</strong>
          ) : (
            part
          ),
        )}
    </p>
  );
}
export function VttMonsterStatblock({
  monster,
  tokenId,
  gm = false,
  compact = false,
  roll,
  useAction,
}: {
  monster: MonsterProfile;
  tokenId?: string;
  gm?: boolean;
  compact?: boolean;
  roll?: (formula: string, label: string) => Promise<unknown>;
  useAction?: (action: MonsterAction) => void;
}) {
  const [error, setError] = useState('');
  const sections = monsterSections(monster.details);
  const actions = monsterActions(monster.actionDetails ?? monster.details);
  const occurrences = new Map<string, number>();
  const prepared = sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => {
      const n = occurrences.get(b.name) || 0;
      occurrences.set(b.name, n + 1);
      return { ...b, action: actions.filter((a) => a.name === b.name)[n] };
    }),
  }));
  const actionSections = prepared.filter((s) => /^(?:Ações|Reações|Outras ações)/.test(s.title));
  const traits = prepared.filter((s) => !actionSections.includes(s));
  const check = (value: number, name: string) =>
    void roll?.(`1d20${signed(value)}`, monster.name + ' · ' + name).catch((e) =>
      setError(e.message),
    );
  const renderSections = (items: typeof prepared) =>
    items.map((section, i) => (
      <section className="vtt-monster-section" key={section.title + i}>
        <h3>{section.title}</h3>
        {section.blocks.map((block, j) => (
          <article
            className={'vtt-monster-block ' + (block.action ? 'vtt-monster-action' : '')}
            key={j}
          >
            <header>
              {block.name && <h4>{block.name}</h4>}
              {gm && tokenId && block.action && (
                <ActionShortcut
                  action={{
                    kind: 'monster',
                    tokenId,
                    sourceId: block.action.id,
                    label: (monster.name + ' · ' + block.name).slice(0, 180),
                  }}
                />
              )}
            </header>
            {block.paragraphs.map((p, k) => (
              <Description key={k} text={p} />
            ))}
            {gm && tokenId && block.action && (
              <div className="vtt-monster-action-controls">
                <span>
                  {block.action.attack || 'Salvaguarda'}
                  {block.action.damage.length > 0 && ' · ' + block.action.damage.join(' + ')}
                </span>
                {useAction && (
                  <button
                    onClick={() => useAction(block.action!)}
                    aria-label={'Usar ' + block.name}
                  >
                    <Swords size={12} />
                    {block.action.attack ? 'Usar ataque' : 'Rolar dano'}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    ));
  return (
    <div className={'vtt-monster-sheet ' + (compact ? 'compact' : '')}>
      <header className="vtt-monster-banner">
        {monster.image && <img src={monster.image} alt="" draggable={false} />}
        <div>
          <span>{monster.source || 'Ficha de sessão'}</span>
          <h2>{monster.name}</h2>
          <p>
            {[
              sizes[monster.size || ''] || monster.size,
              monster.type,
              monster.cr !== undefined ? 'ND ' + monster.cr : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="vtt-monster-columns">
        <div>
          <dl className="vtt-monster-combat">
            <div>
              <dt>
                <Shield size={14} />
                Armadura
              </dt>
              <dd>{monster.ac}</dd>
            </div>
            <div>
              <dt>
                <Heart size={14} />
                Pontos de vida
              </dt>
              <dd>
                {monster.hp}
                {monster.maxHp !== undefined && <small> / {monster.maxHp}</small>}
              </dd>
            </div>
            <div>
              <dt>Deslocamento</dt>
              <dd className="vtt-monster-speed">{monster.speed || 'Não informado'}</dd>
            </div>
          </dl>
          <div className="vtt-monster-abilities">
            {monster.stats.map((value, i) => (
              <button
                key={i}
                disabled={!gm || !roll}
                onClick={() => check(modifier(value), statNames[i])}
                title={'Rolar ' + statNames[i]}
              >
                <span>{['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'][i]}</span>
                <b>{value}</b>
                <small>{signed(modifier(value))}</small>
              </button>
            ))}
          </div>
          {!!monster.information?.length && (
            <dl className="vtt-monster-information">
              {monster.information.map((info) => (
                <div key={info.label}>
                  <dt>{info.label}</dt>
                  <dd>{info.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {renderSections(traits)}
        </div>
        <div>
          {gm && tokenId && (
            <p className="vtt-monster-bar-hint">
              Arraste “Fixar” para um espaço da barra de ações, ou clique para adicionar.
            </p>
          )}
          {renderSections(actionSections)}
        </div>
      </div>
    </div>
  );
}
export function VttMonsterSheet({
  monster,
  tokenId,
  gm,
  biography,
  close,
  roll,
  useAction,
}: {
  monster: MonsterProfile;
  tokenId: string;
  gm: boolean;
  biography: string;
  close: () => void;
  roll: (formula: string, label: string) => Promise<unknown>;
  useAction: (action: MonsterAction) => void;
}) {
  const [tab, setTab] = useState('Ficha');
  return (
    <VttModal title={'Ficha · ' + monster.name} wide close={close}>
      <nav className="vtt-monster-tabs" aria-label="Páginas da ficha do monstro">
        {['Ficha', 'Anotações'].map((name) => (
          <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
      <div className="vtt-monster-paper">
        {tab === 'Ficha' ? (
          <VttMonsterStatblock
            monster={monster}
            tokenId={tokenId}
            gm={gm}
            roll={roll}
            useAction={useAction}
          />
        ) : (
          <section className="vtt-monster-notes">
            <h3>Anotações da sessão</h3>
            <p>{biography || 'Este monstro não tem anotações.'}</p>
          </section>
        )}
      </div>
    </VttModal>
  );
}
