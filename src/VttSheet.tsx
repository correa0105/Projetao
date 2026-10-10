import { useEffect, useState } from 'react';
import {
  Dices,
  Shield,
  Heart,
  Footprints,
  Sparkles,
  RotateCcw,
  ScrollText,
  UserRound,
} from 'lucide-react';
import { api } from './api';
import { VttSheetWindow } from './VttSheetWindow';
import type { VttToken } from '../shared/vtt';
import type { VttSheetData } from '../shared/vtt-sheet';
import { spells, skills, skillAbilities } from '../shared/character-sheet';
import { ItemThumbnail } from './ItemThumbnail';
import { modifier, statNames } from '../shared/rules';
import { armorBundle } from '../shared/armor-bundles';
import type { AttackRequest } from '../shared/vtt-attack';
import './vtt-sheet.css';
import { ActionShortcut } from './VttHotbar';
import { requestSpellCast } from './useVttSpells';
const signed = (n: number) => (n >= 0 ? '+' : '') + n;
export function VttSheet({
  roomId,
  token,
  close,
  roll,
  onAttack,
  refresh,
  shareSpell,
}: {
  roomId: string;
  token: VttToken;
  close: () => void;
  roll: (formula: string, label: string) => Promise<unknown>;
  onAttack: (request: AttackRequest) => void;
  refresh: () => Promise<void>;
  shareSpell: (name: string) => Promise<void>;
}) {
  const [data, setData] = useState<VttSheetData | null>(null),
    [tab, setTab] = useState('Essencial'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [totals, setTotals] = useState<number[] | null>(null),
    [damage, setDamage] = useState(''),
    [healing, setHealing] = useState('');
  const url = `/vtt/rooms/${roomId}/sheets/${token.id}`;
  useEffect(() => {
    let live = true;
    const load = () =>
      api<VttSheetData>(url)
        .then((d) => {
          if (live && !busy) setData(d);
        })
        .catch((e) => live && setError(e.message));
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && !busy) void load();
    }, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [url, busy]);
  async function action(path: string, body: object, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const d = await api<VttSheetData>(url + path, { method, body: JSON.stringify(body) });
      setData(d);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const use = (body: object) =>
    void action('/use', { ...body, idempotency_key: crypto.randomUUID() });
  const restore = (body: object) => void action('/restore', body);
  const weaponDamage = async (itemId: string) => {
    setBusy(true);
    setError('');
    try {
      const current = await api<VttSheetData>(url);
      const weapon = current.attacks.find((w) => w.itemId === itemId);
      if (!weapon)
        throw Error('A arma foi trocada ou saiu da mochila. Selecione o ataque novamente.');
      await roll(weapon.dice + signed(weapon.ability), t.name + ' · ' + weapon.name + ' · dano');
      setData(current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const selectWeapon = (hand: 'main_hand' | 'off_hand', value: string) => {
    if (!data) return;
    const weapon = data.available_weapons.find((w) => w.itemId === value);
    const slots = { ...data.weapon_slots, [hand]: value || null };
    if (hand === 'main_hand') slots.main_hand_two_handed = !!weapon?.twoHanded;
    if (hand === 'main_hand' && (weapon?.twoHanded || slots.off_hand === value))
      slots.off_hand = null;
    void action('/weapons', slots, 'PUT');
  };
  const d = data?.derived,
    c = data?.character,
    choices = data?.sheet?.choices,
    primary = data?.available_weapons.find((w) => w.itemId === data.weapon_slots.main_hand);
  const t = data?.token || token;
  const hiddenArmorParts = new Set(
    data?.inventory.flatMap((item) =>
      (armorBundle(item.id)?.pieces || [])
        .filter((piece) => piece.slot !== 'armor')
        .map((piece) => piece.id),
    ),
  );
  const check = (n: number, name: string) =>
    void roll(`1d20${signed(n)}`, t.name + ' · ' + name).catch((e) => setError(e.message));
  const box = (name: string, content: React.ReactNode) => (
    <section className="vtt-sheet-box">
      <h3>{name}</h3>
      {content}
    </section>
  );
  const spellIds = [
    ...new Set([
      ...(d?.cantrips || []),
      ...(d?.known || []),
      ...(data?.sheet?.prepared || []),
      ...(d?.alwaysPrepared || []),
      ...(d?.spellGrants.flatMap((g) => [...g.cantrips, ...g.spells]) || []),
    ]),
  ];
  return (
    <VttSheetWindow title={'Ficha · ' + token.name} close={close}>
      <nav className="vtt-sheet-tabs" aria-label="Páginas da ficha">
        {['Essencial', 'Biografia', 'Magias'].map((name) => (
          <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
      <div className="vtt-sheet-paper">
        {error && (
          <p role="alert" className="vtt-map-error">
            {error}
          </p>
        )}
        {!data ? (
          <p>Carregando ficha do personagem…</p>
        ) : (
          <>
            <header className="vtt-sheet-banner">
              <div className="vtt-sheet-identity">
                <div className="vtt-sheet-portrait">
                  <UserRound aria-hidden="true" />
                  <img
                    key={token.id + token.image}
                    src={`/api/vtt/rooms/${roomId}/tokens/${token.id}/portrait?v=${encodeURIComponent(token.image)}`}
                    alt={'Retrato de ' + c!.name}
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                    }}
                  />
                </div>
                <div>
                  <h2>{c!.name}</h2>
                  <div className="vtt-sheet-character-traits">
                    <span>{c!.race}</span>
                    <span>{c!.class}</span>
                    <span className="vtt-sheet-level">Nível {c!.level}</span>
                  </div>
                  <dl className="vtt-sheet-character-origins">
                    <div>
                      <dt>Antecedente</dt>
                      <dd>{c!.background || 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt>Alinhamento</dt>
                      <dd>{choices?.alignment || 'Não informado'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </header>
            {tab === 'Essencial' && (
              <div className="vtt-sheet-columns">
                <div>
                  <div className="vtt-sheet-abilities">
                    {c!.stats.map((value, i) => (
                      <button key={i} onClick={() => check(modifier(value), statNames[i])}>
                        <span>{statNames[i]}</span>
                        <strong>{signed(modifier(value))}</strong>
                        <small>{value}</small>
                      </button>
                    ))}
                  </div>
                  {box(
                    'Salvaguardas',
                    <ul className="vtt-sheet-checks">
                      {c!.stats.map((v, i) => (
                        <li key={i}>
                          <button
                            onClick={() =>
                              check(d?.saves[i] ?? modifier(v), 'Salvaguarda de ' + statNames[i])
                            }
                          >
                            <Dices size={13} />
                            <span>{statNames[i]}</span>
                            <b>{signed(d?.saves[i] ?? modifier(v))}</b>
                          </button>
                        </li>
                      ))}
                    </ul>,
                  )}
                  {box(
                    'Perícias',
                    <ul className="vtt-sheet-checks">
                      {(
                        d?.skills ||
                        skills.map((name, i) => ({
                          name,
                          value: modifier(c!.stats[skillAbilities[i]]),
                          trained: false,
                          expert: false,
                        }))
                      ).map((s) => (
                        <li key={s.name}>
                          <button onClick={() => check(s.value, s.name)}>
                            <span className={s.trained ? 'trained' : ''}>
                              {s.expert ? '◆' : s.trained ? '●' : '○'}
                            </span>
                            <span>{s.name}</span>
                            <b>{signed(s.value)}</b>
                          </button>
                        </li>
                      ))}
                    </ul>,
                  )}
                  {box(
                    'Outras proficiências e idiomas',
                    <>
                      <p>{d?.proficiencies.join(' · ') || 'Sem dados de origem finalizados.'}</p>
                      <p>{d?.languages.join(' · ')}</p>
                    </>,
                  )}
                </div>
                <div>
                  <div className="vtt-sheet-combat">
                    <div>
                      <Shield size={20} />
                      <b>{t.ac}</b>
                      <span>Armadura</span>
                    </div>
                    <button
                      onClick={() => check(d?.initiative ?? modifier(c!.stats[1]), 'Iniciativa')}
                    >
                      <Dices size={20} />
                      <b>{signed(d?.initiative ?? modifier(c!.stats[1]))}</b>
                      <span>Iniciativa</span>
                    </button>
                    <div>
                      <Footprints size={20} />
                      <b>{d?.speed ?? t.sheet?.speed}</b>
                      <span>{d ? 'metros' : 'pés'}</span>
                    </div>
                  </div>
                  {box(
                    'Pontos de vida',
                    <>
                      <div className="vtt-sheet-health">
                        <Heart size={25} />
                        <strong>
                          {t.hp}
                          <small> / {t.maxHp}</small>
                        </strong>
                      </div>
                      <label>
                        Registrar dano
                        <input
                          aria-label="Registrar dano"
                          type="number"
                          min={1}
                          max={Math.max(1, t.hp)}
                          placeholder="Quantidade"
                          value={damage}
                          onChange={(e) => setDamage(e.target.value)}
                        />
                      </label>
                      <button
                        disabled={busy || !data.can_use || t.hp <= 0}
                        onClick={() => {
                          const n = Number(damage);
                          if (Number.isInteger(n) && n > 0) void action('/damage', { amount: n });
                        }}
                      >
                        Aplicar dano
                      </button>
                      {data.is_gm && (
                        <>
                          <label>
                            Registrar cura
                            <input
                              aria-label="Registrar cura"
                              type="number"
                              min={1}
                              max={100000}
                              placeholder="Quantidade"
                              value={healing}
                              onChange={(e) => setHealing(e.target.value)}
                            />
                          </label>
                          <button
                            disabled={
                              busy ||
                              t.hp >= t.maxHp ||
                              !Number.isInteger(Number(healing)) ||
                              Number(healing) <= 0
                            }
                            onClick={() => void action('/heal', { amount: Number(healing) })}
                          >
                            Aplicar cura
                          </button>
                          <button disabled={busy} onClick={() => restore({ kind: 'hp' })}>
                            <RotateCcw size={13} />
                            Restaurar PV
                          </button>
                        </>
                      )}
                    </>,
                  )}
                  {box(
                    'Dados de vida',
                    <>
                      <p>
                        {Math.max(0, c!.level - data.resources.hit_dice_used)} / {c!.level} · d
                        {d?.hitDie || 8}
                      </p>
                      <button
                        disabled={busy || data.resources.hit_dice_used >= c!.level}
                        onClick={() => use({ kind: 'hit-die' })}
                      >
                        Gastar dado de vida
                      </button>
                      {data.is_gm && (
                        <button disabled={busy} onClick={() => restore({ kind: 'hit-die' })}>
                          Restaurar um
                        </button>
                      )}
                    </>,
                  )}
                  {box(
                    'Ataques',
                    <div className="vtt-sheet-attacks">
                      {choices && (
                        <details className="vtt-sheet-weapons" open>
                          <summary>Armas na mesa</summary>
                          <p>Troque entre as armas da mochila. A escolha vale nesta sala.</p>
                          <label>
                            Mão principal
                            <select
                              aria-label="Arma na mesa"
                              disabled={busy || !data.can_use}
                              value={data.weapon_slots.main_hand || ''}
                              onChange={(e) => selectWeapon('main_hand', e.target.value)}
                            >
                              <option value="">Sem arma</option>
                              {data.available_weapons.map((w) => (
                                <option key={w.itemId} value={w.itemId}>
                                  {w.name}
                                  {w.twoHanded ? ' · duas mãos' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          {primary?.versatileDice && (
                            <label>
                              Empunhadura de {primary.name}
                              <select
                                aria-label="Empunhadura da arma"
                                disabled={busy || !data.can_use}
                                value={data.weapon_slots.main_hand_two_handed ? 'two' : 'one'}
                                onChange={(e) =>
                                  void action(
                                    '/weapons',
                                    {
                                      ...data.weapon_slots,
                                      main_hand_two_handed: e.target.value === 'two',
                                      off_hand:
                                        e.target.value === 'two'
                                          ? null
                                          : data.weapon_slots.off_hand,
                                    },
                                    'PUT',
                                  )
                                }
                              >
                                <option value="one">Uma mão · {primary.dice}</option>
                                <option value="two">Duas mãos · {primary.versatileDice}</option>
                              </select>
                            </label>
                          )}
                          <label>
                            Mão secundária
                            <select
                              aria-label="Arma secundária na mesa"
                              disabled={
                                busy || !data.can_use || data.weapon_slots.main_hand_two_handed
                              }
                              value={data.weapon_slots.off_hand || ''}
                              onChange={(e) => selectWeapon('off_hand', e.target.value)}
                            >
                              <option value="">Sem arma</option>
                              {data.available_weapons
                                .filter(
                                  (w) => !w.twoHanded && w.itemId !== data.weapon_slots.main_hand,
                                )
                                .map((w) => (
                                  <option key={w.itemId} value={w.itemId}>
                                    {w.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </details>
                      )}
                      {choices ? (
                        data.attacks.map((w) => (
                          <article key={w.itemId}>
                            <div className="vtt-sheet-attack-title">
                              <ItemThumbnail image={w.image_path} name={w.name} />
                              <strong>{w.name}</strong>
                              {data.can_use && (
                                <ActionShortcut
                                  action={{
                                    kind: 'attack',
                                    characterId: c!.id,
                                    sourceId: w.itemId,
                                    label: w.name,
                                  }}
                                />
                              )}
                            </div>
                            <div>
                              <button
                                onClick={() =>
                                  onAttack({
                                    actorId: t.id,
                                    weaponItemId: w.itemId,
                                    name: t.name + ' · ' + w.name,
                                    attack: '1d20' + signed(w.attack),
                                    damage: w.dice === '—' ? [] : [w.dice + signed(w.ability)],
                                  })
                                }
                              >
                                Acerto {signed(w.attack)}
                              </button>
                              {w.dice !== '—' && (
                                <button onClick={() => void weaponDamage(w.itemId)}>
                                  {w.dice}
                                  {signed(w.ability)}
                                </button>
                              )}
                            </div>
                            <small>
                              {w.type}
                              {w.mastery ? ' · ' + w.mastery : ''}
                            </small>
                          </article>
                        ))
                      ) : (
                        <p>Finalize a origem do personagem no site para trazer seus ataques.</p>
                      )}
                    </div>,
                  )}
                  {choices && !data.attacks.length && (
                    <p>Nenhuma arma selecionada. Escolha uma arma da mochila em Armas na mesa.</p>
                  )}
                  {box(
                    'Equipamento e consumíveis',
                    <>
                      <div className="vtt-sheet-gold">
                        {c!.gold_unlimited ? '∞' : (c!.gold_cp / 100).toLocaleString('pt-BR')} PO ·
                        peso{' '}
                        {data.inventory
                          .reduce((n, i) => n + Number(i.weight_lb) * i.quantity, 0)
                          .toFixed(1)}{' '}
                        lb
                      </div>
                      {data.inventory
                        .filter((i) => !hiddenArmorParts.has(i.id))
                        .map((i) => (
                          <article className="vtt-sheet-item" key={i.id}>
                            <div>
                              <div className="vtt-sheet-item-title">
                                <ItemThumbnail image={i.image_path} name={i.name} />
                                <strong>{i.name}</strong>
                              </div>
                              <small>
                                {i.quantity} unidades{i.equipped.length ? ' · equipado' : ''}
                              </small>
                              <details>
                                <summary>Descrição</summary>
                                <p>{i.description}</p>
                              </details>
                            </div>
                            {i.consumable && (
                              <div>
                                {data.can_use && (
                                  <ActionShortcut
                                    action={{
                                      kind: 'consumable',
                                      characterId: c!.id,
                                      sourceId: i.id,
                                      label: i.name,
                                    }}
                                  />
                                )}
                                <button
                                  aria-label={'Usar ' + i.name}
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        'Usar uma unidade de ' +
                                          i.name +
                                          '? Ela será removida do inventário do personagem.',
                                      )
                                    )
                                      use({ kind: 'consumable', item_id: i.id });
                                  }}
                                >
                                  Usar
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      {d?.equipment.length && (
                        <details>
                          <summary>Equipamento inicial declarado</summary>
                          <ul>
                            {d.equipment.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>,
                  )}
                </div>
                <div>
                  {box(
                    'Características',
                    <>
                      <p>
                        Proficiência {signed(d?.proficiency ?? 2 + Math.floor((c!.level - 1) / 4))}{' '}
                        · Percepção passiva {d?.passivePerception ?? 10 + modifier(c!.stats[4])}
                      </p>
                      {d && choices ? (
                        <div className="vtt-feature-groups">
                          {(
                            [
                              ['background', 'Antecedente', choices.backgroundType],
                              ['class', 'Classe', `${c!.class} · Nível ${c!.level}`],
                              [
                                'race',
                                'Raça',
                                choices.subrace === c!.race
                                  ? c!.race
                                  : `${c!.race} · ${choices.subrace}`,
                              ],
                              ['feats', 'Talentos', ''],
                            ] as const
                          ).map(([group, title, name]) => (
                            <section key={group} aria-label={title}>
                              <h4>{title}</h4>
                              {name && <strong className="vtt-feature-group-name">{name}</strong>}
                              <ul>
                                {d.featureGroups[group].map((feature, i) => (
                                  <li key={i}>{feature}</li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <p>{t.sheet?.details}</p>
                      )}
                    </>,
                  )}
                  {(['personality', 'ideals', 'bonds', 'flaws'] as const).map((key, i) => (
                    <div key={key}>
                      {box(
                        ['Traços de personalidade', 'Ideais', 'Vínculos', 'Imperfeições'][i],
                        <p>{choices?.[key] || 'Ainda não descrito.'}</p>,
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'Biografia' && (
              <div className="vtt-sheet-biography">
                <div>
                  {token.image && <img src={token.image} alt={token.name} />}
                  {box(
                    'Aparência',
                    <>
                      <p>{choices?.appearance || 'Ainda não descrita.'}</p>
                      <p>
                        Idade: {choices?.age || '—'} · Altura: {choices?.height || '—'} · Peso:{' '}
                        {choices?.weight || '—'}
                      </p>
                    </>,
                  )}
                </div>
                <div>
                  {box(
                    'História do personagem',
                    <p>{c!.biography || 'Esta história ainda está sendo escrita.'}</p>,
                  )}
                  {box('Notas da ficha', <p>{data.sheet?.notes || 'Sem notas registradas.'}</p>)}
                </div>
              </div>
            )}
            {tab === 'Magias' && (
              <>
                <div className="vtt-sheet-spell-summary">
                  <span>
                    <Sparkles size={18} />
                    {d?.spellAbility === undefined
                      ? 'Sem atributo de conjuração'
                      : statNames[d.spellAbility]}
                  </span>
                  <strong>CD {d?.spellDC ?? '—'}</strong>
                  <strong>Ataque {d?.spellAttack == null ? '—' : signed(d.spellAttack)}</strong>
                </div>
                <div className="vtt-sheet-slots">
                  {data.resources.slots_total.map((total, i) => (
                    <section key={i}>
                      <header>
                        <b>{i + 1}</b>
                        <span>Nível {i + 1}</span>
                        <strong>
                          {total - data.resources.slots_used[i]} / {total}
                        </strong>
                      </header>
                      <div className="vtt-slot-pips">
                        {Array.from({ length: total }, (_, n) => (
                          <span
                            key={n}
                            className={n < data.resources.slots_used[i] ? 'spent' : ''}
                          />
                        ))}
                      </div>
                      <button
                        aria-label={`Gastar espaço nível ${i + 1}`}
                        disabled={busy || total <= data.resources.slots_used[i]}
                        onClick={() => use({ kind: 'slot', slot: i + 1 })}
                      >
                        Gastar espaço
                      </button>
                      {data.is_gm && (
                        <button
                          disabled={busy || data.resources.slots_used[i] <= 0}
                          onClick={() => restore({ kind: 'slot', slot: i + 1 })}
                        >
                          Restaurar um
                        </button>
                      )}
                    </section>
                  ))}
                </div>
                {data.is_gm && (
                  <details className="vtt-sheet-master">
                    <summary>Definir totais de espaços de magia</summary>
                    <p>
                      Os espaços básicos vêm da ficha. O mestre define aqui os espaços adicionais de
                      cada nível.
                    </p>
                    <div className="vtt-sheet-slot-editor">
                      {data.resources.slots_total.map((v, i) => (
                        <label key={i}>
                          Nível {i + 1}
                          <input
                            aria-label={'Total de espaços nível ' + (i + 1)}
                            type="number"
                            min={0}
                            max={30}
                            value={(totals || data.resources.slots_total)[i]}
                            onChange={(e) => {
                              const next = [...(totals || data.resources.slots_total)];
                              next[i] = Math.max(0, Math.min(30, Number(e.target.value)));
                              setTotals(next);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(
                          '/slots',
                          { totals: totals || data.resources.slots_total },
                          'PUT',
                        )
                      }
                    >
                      Salvar totais
                    </button>
                  </details>
                )}
                <div className="vtt-sheet-spells">
                  {spellIds.map((id) => {
                    const spell = spells.find((s) => s.id === id);
                    return (
                      <article key={id}>
                        {data.can_use && (
                          <ActionShortcut
                            action={{
                              kind: 'spell',
                              characterId: c!.id,
                              sourceId: id,
                              label: spell?.label || id,
                            }}
                          />
                        )}
                        <div>
                          <ScrollText size={19} />
                          <strong>{spell?.label || id}</strong>
                          <small>
                            {spell?.level === 0 ? 'Truque' : 'Nível ' + (spell?.level ?? '?')}
                          </small>
                        </div>
                        <button
                          onClick={() =>
                            void shareSpell(spell?.name || id).catch((e) => setError(e.message))
                          }
                        >
                          Descrição no chat
                        </button>
                        {data.can_use && (
                          <button
                            disabled={!spell}
                            onClick={() => {
                              requestSpellCast(token.id, spell!.name);
                              close();
                            }}
                          >
                            Preparar conjuração
                          </button>
                        )}
                      </article>
                    );
                  })}
                  {!spellIds.length && <p>Nenhuma magia registrada na ficha.</p>}
                </div>
              </>
            )}
            {data.is_gm && (
              <details className="vtt-sheet-master">
                <summary>Correções do mestre e histórico de usos</summary>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        'Restaurar PV, espaços de magia e dados de vida deste personagem? Consumíveis não são devolvidos por este botão.',
                      )
                    )
                      restore({ kind: 'all' });
                  }}
                >
                  Restaurar recursos de descanso
                </button>
                {data.uses.map((u) => (
                  <article key={u.id}>
                    <span>
                      {u.kind === 'slot'
                        ? 'Espaço de nível ' + u.slot
                        : u.kind === 'hit-die'
                          ? 'Dado de vida'
                          : u.item_name}{' '}
                      · {new Date(u.created_at).toLocaleString('pt-BR')}
                    </span>
                    {u.restored_at ? (
                      <small>Corrigido</small>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => restore({ kind: 'use', use_id: u.id })}
                      >
                        Corrigir este uso
                      </button>
                    )}
                  </article>
                ))}
              </details>
            )}
          </>
        )}
      </div>
      <footer>
        <span>Consumo real no inventário · restauração exclusiva do mestre</span>
        <button onClick={close}>Fechar ficha</button>
      </footer>
    </VttSheetWindow>
  );
}
