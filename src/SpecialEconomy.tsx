import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './components';
import { SpecialShopCatalogue } from './SpecialShopCatalogue';
import { api, post } from './api';
import type { Character } from './types';
import {
  minimumPrestigeLevel,
  prestigeMilestones,
  specialOfferCategoryLabels,
  type SpecialCurrency,
  type SpecialOffer,
  type SpecialPurchase,
  type SpecialShopState,
} from '../shared/special-economy';
import { rankTitle } from '../shared/progression';
import { classes } from '../shared/rules';
import { eclipseStagId, mounts } from '../shared/mounts';
import { prestigeWeapon, prestigeWeapons } from '../shared/prestige-weapons';
import { pets } from '../shared/pets';
import './special-economy.css';

type PrestigeState = {
  balance: number;
  can_edit: boolean;
  rewards: number[] | null;
  revision: number;
  history: {
    character_id: string;
    cycle: number;
    name: string;
    level: number;
    points: number;
    previous_class: string;
    mode: 'restart' | 'permanent';
    retired_at: string;
  }[];
};
type RetirementPreview = {
  level: number;
  cycle: number;
  has_rolls: boolean;
  points: number | null;
  revision: number;
  blocker: string | null;
  representatives: { id: string; name: string }[] | null;
};

export function RetirementDialog({
  character,
  close,
  completed,
}: {
  character: Character;
  close: () => void;
  completed: (points: number, mode: 'restart' | 'permanent') => void | Promise<void>;
}) {
  const [preview, setPreview] = useState<RetirementPreview | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'restart' | 'permanent'>('restart');
  const [nextClass, setNextClass] = useState(character.class);
  const [dice, setDice] = useState<'keep' | 'reroll'>('keep');
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(crypto.randomUUID());
  useEffect(() => {
    let live = true;
    api<RetirementPreview>('/characters/' + character.id + '/retirement')
      .then((value) => {
        if (live) {
          setPreview(value);
          if (!value.has_rolls) setDice('reroll');
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [character.id]);
  const available =
    preview &&
    preview.points !== null &&
    !preview.blocker &&
    (mode === 'restart' || preview.representatives === null || !!replacement);
  return (
    <Modal
      title={'Aposentar ' + character.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!preview || !available || name !== character.name || busy) return;
          setBusy(true);
          setError('');
          try {
            const result = await post<{ points: number }>(
              '/characters/' + character.id + '/retirement',
              {
                name,
                mode,
                level: preview.level,
                revision: preview.revision,
                cycle: preview.cycle,
                request_id: request.current,
                ...(mode === 'restart'
                  ? { class: nextClass, dice }
                  : { replacement_id: replacement || undefined }),
              },
            );
            await completed(result.points, mode);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          O Prestígio é calculado pelo nível atual. O primeiro marco para aposentar é o nível{' '}
          {minimumPrestigeLevel}.
        </p>
        {!preview && !error && <p role="status">Consultando a recompensa…</p>}
        {preview?.points === null && !preview.blocker && (
          <p>A tabela de recompensas aguarda configuração.</p>
        )}
        {preview?.points != null && (
          <p>
            Nível {preview.level} ·{' '}
            <strong>{preview.points.toLocaleString('pt-BR')} de Prestígio</strong>
          </p>
        )}
        {preview?.blocker && <p role="status">{preview.blocker}</p>}
        <label>
          O que fazer com o personagem
          <select
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="restart">Recomeçar no nível 1</option>
            <option value="permanent">Aposentar para sempre</option>
          </select>
        </label>
        {mode === 'restart' ? (
          <>
            <p>
              O personagem conserva sua identidade, vaga e bens. A ficha abre no nível 1 para
              confirmar a classe e a distribuição dos atributos.
            </p>
            <label>
              Classe da nova jornada
              <select
                value={nextClass}
                disabled={busy}
                onChange={(e) => setNextClass(e.target.value)}
              >
                {classes.map((cls) => (
                  <option key={cls}>{cls}</option>
                ))}
              </select>
            </label>
            <label>
              Dados dos atributos
              <select
                value={dice}
                disabled={busy}
                onChange={(e) => setDice(e.target.value as typeof dice)}
              >
                <option value="keep" disabled={preview?.has_rolls === false}>
                  Manter e redistribuir os dados antigos
                </option>
                <option value="reroll">Rerrolar e distribuir os novos dados</option>
              </select>
            </label>
          </>
        ) : (
          <p>
            A aposentadoria definitiva guarda a ficha e os bens no histórico e libera a vaga no
            acampamento.
          </p>
        )}
        {mode === 'permanent' && preview?.representatives && (
          <label>
            Novo representante do fundador
            <select value={replacement} onChange={(e) => setReplacement(e.target.value)} required>
              <option value="">Selecione um personagem</option>
              {preview.representatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!preview.representatives.length && (
              <small>O fundador precisa de outro personagem ativo e livre de guilda.</small>
            )}
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <label>
          Digite o nome para confirmar
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!available || busy}
            required
          />
        </label>
        <button className="button primary" disabled={!available || name !== character.name || busy}>
          Confirmar aposentadoria
        </button>
      </form>
    </Modal>
  );
}

const prestigeLevels = Array.from({ length: 20 }, (_, index) => index + 1);

export function PrestigeCenter({ close }: { close: () => void }) {
  const [state, setState] = useState<PrestigeState | null>(null);
  const [values, setValues] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<PrestigeState>('/prestige')
      .then((value) => {
        if (live) setState(value);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <Modal title="Tabela de Prestígio" close={close}>
      <div className="stack special-economy">
        <p>
          A partir do nível {minimumPrestigeLevel}, aposente um personagem no acampamento para
          receber Prestígio. Use-o em Relíquias ou contribua para a Ferraria da sua guilda.
        </p>
        {error && <p role="alert">{error}</p>}
        {!state && !error && <p role="status">Consultando a tabela de Prestígio…</p>}
        {state && (
          <>
            {!state.rewards && <p>Os pontos dos níveis 5 a 20 ainda estão a definir.</p>}
            <div
              className="prestige-rewards-scroll"
              role="region"
              aria-label="Recompensas de aposentadoria por nível"
              tabIndex={0}
            >
              <table className="prestige-rewards-table" aria-label="Pontos de Prestígio por nível">
                <thead>
                  <tr>
                    <th scope="col">Nível</th>
                    <th scope="col">Patente</th>
                    <th scope="col">Prestígio</th>
                  </tr>
                </thead>
                <tbody>
                  {prestigeLevels.map((level) => {
                    const points = level < minimumPrestigeLevel ? 0 : state.rewards?.[level - 1];
                    const milestone = prestigeMilestones.includes(level);
                    return (
                      <tr key={level} data-milestone={milestone || undefined}>
                        <th scope="row">{level}</th>
                        <td>
                          {rankTitle(level)}
                          {milestone && <small>Marco</small>}
                        </td>
                        <td>{points?.toLocaleString('pt-BR') ?? 'A definir'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {state?.can_edit && (
          <details>
            <summary>Configurar recompensas de aposentadoria</summary>
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!values || busy) return;
                setBusy(true);
                setError('');
                try {
                  const saved = await api<Pick<PrestigeState, 'rewards' | 'revision'>>(
                    '/prestige/rewards',
                    {
                      method: 'PUT',
                      body: JSON.stringify({
                        rewards: values.map(Number),
                        revision: state.revision,
                      }),
                    },
                  );
                  setState({ ...state, ...saved });
                  setValues(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Informe os pontos de cada nível. Os saltos de patente nos níveis 5, 9, 13 e 17 devem
                ser maiores que os aumentos comuns.
              </p>
              {!values ? (
                <button
                  type="button"
                  className="button outline"
                  onClick={() =>
                    setValues(
                      state.rewards?.map(String) ??
                        prestigeLevels.map((level) => (level < minimumPrestigeLevel ? '0' : '')),
                    )
                  }
                >
                  Editar tabela
                </button>
              ) : (
                <>
                  <div className="prestige-level-grid">
                    {values.map((amount, i) => (
                      <label key={i}>
                        Nível {i + 1}
                        {prestigeMilestones.includes(i + 1) && ' · ' + rankTitle(i + 1)}
                        <input
                          type="number"
                          min={0}
                          max={1_000_000}
                          required
                          value={amount}
                          disabled={i + 1 < minimumPrestigeLevel}
                          onChange={(e) =>
                            setValues(
                              values.map((value, level) => (level === i ? e.target.value : value)),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button className="button primary" disabled={busy}>
                    Salvar recompensas
                  </button>
                </>
              )}
            </form>
          </details>
        )}
        {state && !state.history.length && <p>Nenhuma aposentadoria registrada.</p>}
        {!!state?.history.length && (
          <details>
            <summary>Histórico de aposentadorias</summary>
            <ul>
              {state.history.map((c) => (
                <li key={c.character_id + ':' + c.cycle}>
                  {c.name} · {c.previous_class} nível {c.level} ·{' '}
                  {c.mode === 'restart' ? 'Nova jornada' : 'Definitiva'} ·{' '}
                  {c.points.toLocaleString('pt-BR')} de Prestígio
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}

const currencyLabels = { prestige: 'Prestígio', crystals: 'cristais' } as const;
const offerCategories = Object.keys(specialOfferCategoryLabels) as SpecialOffer['category'][];
const blankOffer = (currency: SpecialCurrency): SpecialOffer => ({
  id: crypto.randomUUID(),
  revision: 0,
  category: currency === 'crystals' ? 'tower_item' : 'profile_border',
  name: '',
  description: '',
  image_path: null,
  target_key: null,
  price: 0,
  active: false,
});
const companionOffer = (offer: SpecialOffer) =>
  offer.category === 'mount' || offer.category === 'pet';
const characterOffer = (offer: SpecialOffer) =>
  companionOffer(offer) || offer.category === 'prestige_weapon';

export function SpecialShop({
  currency,
  characterId,
  characterName,
  characterLevel,
  storefront = false,
  changed,
  onPrestige,
}: {
  currency: SpecialCurrency;
  characterId?: string;
  characterName?: string;
  characterLevel?: number;
  storefront?: boolean;
  changed?: () => Promise<void>;
  onPrestige?: () => void;
}) {
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [state, setState] = useState<SpecialShopState | null>(null);
  const [draft, setDraft] = useState<SpecialOffer | null>(null);
  const [confirm, setConfirm] = useState<SpecialOffer | null>(null);
  const [companionName, setCompanionName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const path = '/special-shop/' + currency;
  const query =
    currency === 'crystals' && characterId
      ? '?character_id=' + encodeURIComponent(characterId)
      : '';
  const load = useCallback(
    async () => setState(await api<SpecialShopState>(path + query)),
    [path, query],
  );
  useEffect(() => {
    let live = true;
    setState(null);
    setConfirm(null);
    api<SpecialShopState>(path + query)
      .then((data) => {
        if (live) setState(data);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, query]);
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const prestige = currency === 'prestige';
  const showStorefront = prestige || storefront;
  const label = currencyLabels[currency];
  const nameNeeded = confirm?.category === 'mount' && confirm.target_key === eclipseStagId;
  const validName = /^[\p{L}\p{M}\p{N} '\-]{1,40}$/u.test(companionName.trim());
  const startPurchase = (offer: SpecialOffer) => {
    setCompanionName('');
    setConfirm(offer);
  };
  const owned = new Set(state?.purchases.map((p) => p.offer_id));
  const canBuy = (offer: SpecialOffer) => {
    const weapon = offer.category === 'prestige_weapon' ? prestigeWeapon(offer.target_key) : undefined;
    return !!state &&
      !busy &&
      ((prestige && !characterOffer(offer)) || !!characterId) &&
      (!prestige || !owned.has(offer.id)) &&
      (offer.category !== 'prestige_weapon' || (!!weapon && (characterLevel ?? 0) >= weapon.stages[0].level)) &&
      state.balance >= offer.price;
  };
  const createOffer = (category?: SpecialOffer['category']) => {
    const offer = blankOffer(currency);
    setDraft({ ...offer, category: category ?? offer.category });
  };
  const dialogOpen = showStorefront && (confirm || draft || collectionOpen);
  const feedback = (
    <>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </>
  );
  const status = (
    <>
      {!dialogOpen && feedback}
      {!state && !error && <p role="status">Consultando a loja…</p>}
    </>
  );
  const confirmation = confirm && (
    <div className="stack" role="group" aria-label="Confirmar compra especial">
      <p>
        Comprar {confirm.name} por {confirm.price.toLocaleString('pt-BR')} {label}?
      </p>
      {confirm.category === 'prestige_weapon' && <p>A arma vai para a mochila de <strong>{characterName}</strong>.</p>}
      {nameNeeded && (
        <label>
          Nome da montaria
          <input value={companionName} maxLength={40} onChange={(event) => setCompanionName(event.target.value)} />
        </label>
      )}
      <button
        className="button primary"
        disabled={busy || (nameNeeded && !validName)}
        onClick={() =>
          void act(async () => {
            const key = confirm.id + ':' + (characterId || '');
            const requestId = requestIds.current.get(key) || crypto.randomUUID();
            requestIds.current.set(key, requestId);
            await post(path + '/purchases', {
              offer_id: confirm.id,
              request_id: requestId,
              revision: confirm.revision,
              companion_name: nameNeeded ? companionName.trim() : undefined,
              character_id:
                currency === 'crystals' || characterOffer(confirm) ? characterId : undefined,
            });
            requestIds.current.delete(key);
            setConfirm(null);
            await load();
            await changed?.();
            setNotice('Compra registrada.');
          })
        }
      >
        Confirmar compra
      </button>
      <button className="button outline" disabled={busy} onClick={() => setConfirm(null)}>
        Cancelar
      </button>
    </div>
  );
  const editor = draft && (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          const { id, ...body } = draft;
          await api(path + '/offers/' + id, { method: 'PUT', body: JSON.stringify(body) });
          setDraft(null);
          await load();
          setNotice('Oferta salva.');
        });
      }}
    >
      {!showStorefront && <h4>{draft.revision ? 'Editar oferta' : 'Nova oferta'}</h4>}
      <label>
        Categoria
        <select
          value={draft.category}
          disabled={draft.revision > 0}
          onChange={(e) =>
            setDraft({
              ...draft,
              target_key: null,
              category: e.target.value as SpecialOffer['category'],
            })
          }
        >
          {offerCategories
            .filter((kind) => (kind === 'tower_item') === (currency === 'crystals'))
            .map((kind) => (
              <option key={kind} value={kind}>
                {specialOfferCategoryLabels[kind]}
              </option>
            ))}
        </select>
      </label>
      {companionOffer(draft) && (
        <label>
          Modelo de referência
          <select
            value={draft.target_key ?? ''}
            onChange={(e) => setDraft({ ...draft, target_key: e.target.value || null })}
          >
            <option value="">Escolha o modelo base</option>
            {(draft.category === 'mount' ? mounts : pets).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft.category === 'weapon_skin' && (
        <label>
          Identificador da arma do catálogo
          <input
            value={draft.target_key ?? ''}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, target_key: e.target.value || null })}
          />
        </label>
      )}
      {draft.category === 'prestige_weapon' && (
        <label>
          Arma da forja
          <select
            value={draft.target_key ?? ''}
            onChange={(event) => setDraft({ ...draft, target_key: event.target.value || null })}
          >
            <option value="">Escolha a arma</option>
            {prestigeWeapons.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
          </select>
        </label>
      )}
      <label>
        Nome
        <input
          value={draft.name}
          maxLength={100}
          required
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        Descrição e regras
        <textarea
          value={draft.description}
          maxLength={2000}
          required
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label>
        Imagem publicada no site
        <input
          value={draft.image_path || ''}
          maxLength={250}
          placeholder="/profiles/exemplo.webp"
          onChange={(e) => setDraft({ ...draft, image_path: e.target.value || null })}
        />
      </label>
      <label>
        Preço em {label}
        <input
          type="number"
          required
          min={1}
          max={1000000}
          value={draft.price || ''}
          onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />{' '}
        Publicar oferta
      </label>
      <button className="button primary" disabled={busy}>
        Salvar oferta
      </button>
      <button
        type="button"
        className="button outline"
        disabled={busy}
        onClick={() => setDraft(null)}
      >
        Cancelar edição
      </button>
    </form>
  );
  const collection = state && (
    <ul className="special-offers">
      {state.purchases.map((p) => (
        <li key={p.id}>
          {p.snapshot.image_path && <img src={p.snapshot.image_path} alt="" loading="lazy" />}
          <div>
            <strong>{p.snapshot.name}</strong>
            <p>{p.used_at ? 'Usado em uma expedição' : p.snapshot.description}</p>
            {p.snapshot.category === 'profile_border' && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api('/prestige/profile-border', {
                      method: 'PUT',
                      body: JSON.stringify({
                        purchase_id: state.equipped_border === p.id ? null : p.id,
                      }),
                    });
                    await load();
                    setNotice('Borda do perfil atualizada.');
                  })
                }
              >
                {state.equipped_border === p.id ? 'Retirar borda' : 'Usar no perfil'}
              </button>
            )}
            {p.snapshot.category === 'weapon_skin' &&
              characterId &&
              ([true, false] as const).map((enabled) => (
                <button
                  key={String(enabled)}
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api('/prestige/weapon-skin/' + p.id, {
                        method: 'PUT',
                        body: JSON.stringify({ character_id: characterId, enabled }),
                      });
                      setNotice(
                        enabled ? 'Skin aplicada à arma na mochila.' : 'Skin retirada da arma.',
                      );
                    })
                  }
                >
                  {enabled ? 'Aplicar ao personagem' : 'Retirar do personagem'}
                </button>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );

  if (showStorefront) {
    return (
      <>
        <SpecialShopCatalogue
          currency={currency}
          characterName={characterName}
          characterLevel={characterLevel}
          state={state}
          status={status}
          busy={busy}
          canBuy={canBuy}
          onBuy={startPurchase}
          onEdit={setDraft}
          onCreate={createOffer}
          onCollection={() => setCollectionOpen(true)}
          onPrestige={onPrestige}
        />
        {confirm && (
          <Modal
            title="Confirmar compra"
            close={() => {
              if (!busy) setConfirm(null);
            }}
          >
            <div className="stack special-economy">
              {feedback}
              {confirmation}
            </div>
          </Modal>
        )}
        {draft && (
          <Modal
            title={draft.revision ? 'Editar oferta' : 'Nova oferta'}
            close={() => {
              if (!busy) setDraft(null);
            }}
          >
            <div className="stack special-economy">
              {feedback}
              {editor}
            </div>
          </Modal>
        )}
        {collectionOpen && (
          <Modal
            title={prestige ? 'Minha coleção' : 'Itens do personagem'}
            close={() => {
              if (!busy) setCollectionOpen(false);
            }}
          >
            <div className="stack special-economy">
              {feedback}
              {state?.purchases.length ? (
                collection
              ) : (
                <p>
                  {prestige
                    ? 'Você ainda não tem relíquias na coleção.'
                    : 'Este personagem ainda não tem itens do Entreposto.'}
                </p>
              )}
            </div>
          </Modal>
        )}
      </>
    );
  }

  return (
    <section className="stack special-economy" aria-label={'Loja de ' + label}>
      <h3>Entreposto da Torre</h3>
      {status}
      {state && (
        <>
          <p>
            Saldo disponível ·{' '}
            <strong>
              {state.balance.toLocaleString('pt-BR')} {label}
            </strong>
          </p>
          <p>
            Os itens do Entreposto ficam com o personagem comprador e são usados nas mesas oficiais
            de uma expedição ativa.
          </p>
          {!characterId && <p>Selecione um personagem para comprar com cristais.</p>}
          {!state.offers.some((offer) => offer.active) && <p>Nenhuma oferta publicada.</p>}
          {state.can_edit && (
            <button className="button outline" disabled={busy} onClick={() => createOffer()}>
              Cadastrar oferta
            </button>
          )}
          <ul className="special-offers">
            {state.offers.map((offer) => (
              <li key={offer.id}>
                {offer.image_path && <img src={offer.image_path} alt="" loading="lazy" />}
                <div>
                  <strong>{offer.name}</strong>
                  <small>
                    {specialOfferCategoryLabels[offer.category]} ·{' '}
                    {offer.active ? offer.price.toLocaleString('pt-BR') + ' ' + label : 'Rascunho'}
                  </small>
                  <p>{offer.description}</p>
                  {offer.active && (
                    <button
                      className="button outline"
                      disabled={!canBuy(offer)}
                      onClick={() => startPurchase(offer)}
                    >
                      Comprar
                    </button>
                  )}
                  {state.can_edit && (
                    <button
                      className="button outline"
                      disabled={busy}
                      onClick={() => setDraft(offer)}
                    >
                      Editar oferta
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {confirmation}
          {editor}
          {!!state.purchases.length && (
            <details>
              <summary>Itens do personagem</summary>
              {collection}
            </details>
          )}
        </>
      )}
    </section>
  );
}

export function TowerTableItems({
  room,
  characters,
  close,
}: {
  room: string;
  characters: { id: string; name: string }[];
  close: () => void;
}) {
  const [character, select] = useState(characters[0]?.id || '');
  const [items, setItems] = useState<SpecialPurchase[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const path = '/vtt/rooms/' + room + '/tower-items/' + character;
  useEffect(() => {
    if (!character) return;
    let live = true;
    setItems(null);
    setError('');
    setConfirm(null);
    api<{ items: SpecialPurchase[] }>(path)
      .then((data) => {
        if (live) setItems(data.items);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, character]);
  return (
    <Modal
      title="Itens da Torre"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="stack special-economy">
        <label>
          Personagem da expedição
          <select value={character} onChange={(e) => select(e.target.value)} disabled={busy}>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        {!items && !error && <p role="status">Consultando os itens…</p>}
        {items?.length === 0 && <p>Nenhum item disponível para esta expedição.</p>}
        <ul className="special-offers">
          {items?.map((item) => (
            <li key={item.id}>
              {item.snapshot.image_path && <img src={item.snapshot.image_path} alt="" />}
              <div>
                <strong>{item.snapshot.name}</strong>
                <p>{item.snapshot.description}</p>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={async () => {
                    if (confirm !== item.id) {
                      setConfirm(item.id);
                      return;
                    }
                    setBusy(true);
                    setError('');
                    try {
                      await post(path + '/' + item.id + '/use', {});
                      setItems((current) => current?.filter((entry) => entry.id !== item.id) ?? []);
                      setConfirm(null);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {confirm === item.id ? 'Confirmar uso e consumir' : 'Usar na mesa'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
