import { useEffect, useState } from 'react';
import { Award, Crown, House, Package, Plus, Settings2, Tag } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { FlashMessage } from './FlashMessage';
import {
  formatTagCount,
  type TagCatalog,
  type TagState,
  type TagReward,
  type MissionTag,
  type TagAchievement,
  type TagRewardOptions,
} from '../shared/mission-tags';
import './mission-tags.css';

export function TagRewards({ rewards }: { rewards: TagReward[] }) {
  return (
    <ul className="tag-rewards">
      {rewards.map((r) => (
        <li key={r.kind + ':' + r.ref}>
          {r.image ? (
            <img src={r.image} alt="" loading="lazy" />
          ) : r.kind === 'title' ? (
            <Crown size={18} />
          ) : r.kind === 'house' ? (
            <House size={18} />
          ) : (
            <Package size={18} />
          )}
          <span>
            {r.quantity > 1 ? `${r.quantity} × ` : ''}
            {r.name}
            <small>
              {r.kind === 'title'
                ? 'Título'
                : r.kind === 'house'
                  ? 'Item de house'
                  : 'Roupa ou equipamento'}
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}
const ruleInput = (a: TagAchievement) => ({
  tag_id: a.tag_id,
  target: a.target,
  title: a.title,
  description: a.description,
  active: a.active,
  rewards: a.rewards.map(({ kind, ref, quantity }) => ({ kind, ref, quantity })),
});
export function TagProgress({
  characterId,
  changed,
}: {
  characterId: string;
  changed: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<TagCatalog | null>(null),
    [state, setState] = useState<TagState | null>(null),
    [error, setError] = useState(''),
    [manage, setManage] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([
      api<TagCatalog>('/mission-tags/catalog'),
      api<TagState>('/characters/' + characterId + '/tags'),
    ])
      .then(([c, s]) => {
        if (active) {
          setCatalog(c);
          setState(s);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [characterId, version]);
  return (
    <section className="tag-progress-panel" aria-labelledby="tag-progress-title">
      <header>
        <div>
          <span className="tag-eyebrow">Cada aventura deixa uma marca</span>
          <h2 id="tag-progress-title">
            <Tag size={22} /> Tags da jornada
          </h2>
        </div>
        {catalog?.can_edit && (
          <button className="button outline" onClick={() => setManage(true)}>
            <Settings2 size={15} /> Administrar tags
          </button>
        )}
      </header>
      <p className="small muted">
        Conclua missões para acumular tags e desbloquear conquistas. Sua contagem continua crescendo
        após cada recompensa.
      </p>
      {error && (
        <>
          <FlashMessage>{error}</FlashMessage>
          <button onClick={() => setVersion((v) => v + 1)}>Tentar novamente</button>
        </>
      )}
      {!state && !error && <p role="status">Carregando tags…</p>}
      {catalog && state && (
        <div className="tag-total-grid">
          {catalog.tags
            .filter((t) => t.active || state.totals.some((s) => s.tag_id === t.id))
            .map((t) => {
              const total = state.totals.find((s) => s.tag_id === t.id)?.total || '0';
              const next = catalog.achievements
                .filter((a) => a.tag_id === t.id && a.active && BigInt(a.target) > BigInt(total))
                .sort((a, b) => (BigInt(a.target) < BigInt(b.target) ? -1 : 1))[0];
              const earned = state.grants.filter((g) =>
                catalog.achievements.some((a) => a.code === g.code && a.tag_id === t.id),
              ).length;
              return (
                <article className="tag-total-card" key={t.id} data-tag-id={t.id}>
                  <div>
                    <span className="tag-total-symbol">
                      <Tag size={23} />
                    </span>
                    <h3>{t.name}</h3>
                    {!t.active && <small>Arquivada</small>}
                  </div>
                  <strong
                    className="tag-total"
                    aria-label={`${formatTagCount(total)} tags de ${t.name}`}
                  >
                    {formatTagCount(total)}
                  </strong>
                  <span className="small muted">tags acumuladas</span>
                  {next ? (
                    <div className="tag-next">
                      <span>Próxima conquista</span>
                      <b>{next.title}</b>
                      <small>
                        {formatTagCount(total)} / {formatTagCount(next.target)} tags
                      </small>
                      <progress
                        aria-label={'Progresso de ' + next.title}
                        max={100}
                        value={Number((BigInt(total) * 10000n) / BigInt(next.target)) / 100}
                      />
                    </div>
                  ) : (
                    <p className="tag-next small">
                      {earned
                        ? `${earned} conquista${earned === 1 ? '' : 's'} desbloqueada${earned === 1 ? '' : 's'}`
                        : 'Novas metas serão definidas pela guilda.'}
                    </p>
                  )}
                </article>
              );
            })}
        </div>
      )}
      {manage && catalog && (
        <TagManager
          catalog={catalog}
          close={() => setManage(false)}
          saved={async () => {
            setVersion((v) => v + 1);
            await changed();
          }}
        />
      )}
    </section>
  );
}
function TagManager({
  catalog: initial,
  close,
  saved,
}: {
  catalog: TagCatalog;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState(initial),
    [tab, setTab] = useState<'tags' | 'achievements'>('tags'),
    [options, setOptions] = useState<TagRewardOptions>([]),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false);
  const [tag, setTag] = useState<MissionTag | null>(null),
    [name, setName] = useState(''),
    [description, setDescription] = useState('');
  const fresh = () => ({
    tag_id: catalog.tags.find((t) => t.active)?.id || '',
    target: '10',
    title: '',
    description: '',
    active: true,
    rewards: [] as TagReward[],
  });
  const [editing, setEditing] = useState<TagAchievement | null>(null),
    [draft, setDraft] = useState(fresh),
    [kind, setKind] = useState<TagReward['kind']>('title'),
    [ref, setRef] = useState(''),
    [quantity, setQuantity] = useState(1),
    [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    api<TagRewardOptions>('/mission-tags/reward-options')
      .then((r) => {
        if (active) setOptions(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(work: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await work();
      const next = await api<TagCatalog>('/mission-tags/catalog');
      setCatalog(next);
      await saved();
      setFeedback(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const candidates = options.filter(
    (o) =>
      o.kind === kind &&
      (o.name + ' ' + (o.category || ''))
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const selected = options.find((o) => o.kind === kind && o.ref === ref);
  return (
    <Modal
      title="Administrar tags e conquistas"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="tag-manager">
        <nav className="tag-manager-tabs" aria-label="Configuração de tags">
          <button
            className="button outline"
            aria-pressed={tab === 'tags'}
            onClick={() => setTab('tags')}
          >
            Tags
          </button>
          <button
            className="button outline"
            aria-pressed={tab === 'achievements'}
            onClick={() => setTab('achievements')}
          >
            Conquistas e recompensas
          </button>
        </nav>
        {error && <FlashMessage>{error}</FlashMessage>}
        {feedback && <FlashMessage kind="success">{feedback}</FlashMessage>}
        {tab === 'tags' ? (
          <>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void save(async () => {
                  await (tag
                    ? api('/mission-tags/catalog/' + tag.id, {
                        method: 'PUT',
                        body: JSON.stringify({
                          name,
                          description,
                          active: tag.active,
                          revision: tag.revision,
                        }),
                      })
                    : post('/mission-tags/catalog', { name, description, active: true }));
                  setTag(null);
                  setName('');
                  setDescription('');
                }, 'Tag salva.');
              }}
            >
              <fieldset disabled={busy}>
                <legend>{tag ? 'Editar tag' : 'Nova tag'}</legend>
                <label>
                  Nome da tag
                  <input
                    required
                    minLength={2}
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Goblin"
                  />
                </label>
                <label>
                  Descrição da tag
                  <textarea
                    maxLength={400}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </label>
                <div className="tag-actions">
                  <button className="button primary">Salvar tag</button>
                  {tag && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setTag(null);
                        setName('');
                        setDescription('');
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
            <div className="tag-admin-list">
              {catalog.tags.map((t) => (
                <article key={t.id}>
                  <div>
                    <strong>{t.name}</strong>
                    <p>{t.description}</p>
                    <small>
                      {t.active ? 'Disponível nas missões' : 'Arquivada · contagem preservada'}
                    </small>
                  </div>
                  <div className="tag-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setTag(t);
                        setName(t.name);
                        setDescription(t.description);
                      }}
                    >
                      Editar {t.name}
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void save(
                          () =>
                            api('/mission-tags/catalog/' + t.id, {
                              method: 'PUT',
                              body: JSON.stringify({
                                ...t,
                                id: undefined,
                                revision: t.revision,
                                active: !t.active,
                              }),
                            }),
                          t.active ? 'Tag arquivada.' : 'Tag reativada.',
                        )
                      }
                    >
                      {t.active ? 'Arquivar' : 'Reativar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void save(async () => {
                  const payload = {
                    ...draft,
                    rewards: draft.rewards.map(({ kind, ref, quantity }) => ({
                      kind,
                      ref,
                      quantity,
                    })),
                  };
                  await (editing
                    ? api('/mission-tags/achievements/' + editing.code, {
                        method: 'PUT',
                        body: JSON.stringify({ ...payload, revision: editing.revision }),
                      })
                    : post('/mission-tags/achievements', payload));
                  setEditing(null);
                  setDraft(fresh());
                }, 'Conquista salva. A entrega ocorre ao atingir a meta, ou ao abrir as conquistas se a contagem já for suficiente.');
              }}
            >
              <fieldset disabled={busy}>
                <legend>{editing ? 'Editar conquista' : 'Nova conquista por tags'}</legend>
                <div className="form-grid">
                  <label>
                    Tag da conquista
                    <select
                      required
                      value={draft.tag_id}
                      disabled={editing?.awarded}
                      onChange={(e) => setDraft({ ...draft, tag_id: e.target.value })}
                    >
                      <option value="">Escolha a tag</option>
                      {catalog.tags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {!t.active ? ' · arquivada' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantidade de tags
                    <input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]{0,99}"
                      maxLength={100}
                      value={draft.target}
                      disabled={editing?.awarded}
                      onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Nome da conquista
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label>
                  Descrição da conquista
                  <textarea
                    maxLength={1000}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    rows={2}
                  />
                </label>
                <fieldset className="tag-reward-editor" disabled={Boolean(editing?.awarded)}>
                  <legend>Recompensas</legend>
                  <div className="form-grid">
                    <label>
                      Tipo de recompensa
                      <select
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value as TagReward['kind']);
                          setRef('');
                          setSearch('');
                          setQuantity(1);
                        }}
                      >
                        <option value="title">Título</option>
                        <option value="item">Roupa ou equipamento</option>
                        <option value="house">Item de house</option>
                      </select>
                    </label>
                    <label>
                      Buscar recompensa
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setRef('');
                        }}
                        placeholder="Nome do item ou título…"
                      />
                    </label>
                  </div>
                  <label>
                    Recompensa
                    <select value={ref} onChange={(e) => setRef(e.target.value)}>
                      <option value="">Escolha uma recompensa</option>
                      {candidates.slice(0, 200).map((o) => (
                        <option key={o.kind + ':' + o.ref} value={o.ref}>
                          {o.name}
                          {o.category ? ' · ' + o.category : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {candidates.length > 200 && (
                    <small className="muted">Refine a busca para ver outros itens.</small>
                  )}
                  <div className="tag-actions">
                    {kind !== 'title' && (
                      <label>
                        Quantidade
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="button outline"
                      disabled={
                        !selected ||
                        draft.rewards.length >= 20 ||
                        !Number.isInteger(quantity) ||
                        quantity < 1 ||
                        quantity > 99 ||
                        draft.rewards.some((r) => r.kind === kind && r.ref === ref)
                      }
                      onClick={() => {
                        if (selected) {
                          setDraft({
                            ...draft,
                            rewards: [
                              ...draft.rewards,
                              {
                                kind,
                                ref,
                                quantity: kind === 'title' ? 1 : quantity,
                                name: selected.name,
                                image: selected.image,
                              },
                            ],
                          });
                          setRef('');
                        }
                      }}
                    >
                      <Plus size={14} /> Adicionar recompensa
                    </button>
                  </div>
                  {draft.rewards.map((r) => (
                    <div className="tag-reward-draft" key={r.kind + ':' + r.ref}>
                      <TagRewards rewards={[r]} />
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setDraft({ ...draft, rewards: draft.rewards.filter((v) => v !== r) })
                        }
                      >
                        Remover {r.name}
                      </button>
                    </div>
                  ))}
                </fieldset>
                {editing?.awarded && (
                  <p className="small muted">
                    Esta conquista já foi entregue. A meta e as recompensas ficam preservadas; você
                    pode alterar nome, descrição e disponibilidade.
                  </p>
                )}
                <div className="tag-actions">
                  <button className="button primary">Salvar conquista por tags</button>
                  {editing && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setEditing(null);
                        setDraft(fresh());
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
            <div className="tag-admin-list">
              {catalog.achievements.map((a) => (
                <article key={a.code} data-tag-achievement={a.code}>
                  <div>
                    <strong>
                      <Award size={15} /> {a.title}
                    </strong>
                    <p>
                      {catalog.tags.find((t) => t.id === a.tag_id)?.name} ·{' '}
                      {formatTagCount(a.target)} tags{!a.active ? ' · arquivada' : ''}
                    </p>
                    <TagRewards rewards={a.rewards} />
                  </div>
                  <div className="tag-actions">
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={() => {
                        setEditing(a);
                        setDraft({ ...ruleInput(a), rewards: a.rewards });
                      }}
                    >
                      Editar {a.title}
                    </button>
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={() =>
                        void save(
                          () =>
                            api('/mission-tags/achievements/' + a.code, {
                              method: 'PUT',
                              body: JSON.stringify({
                                ...ruleInput(a),
                                revision: a.revision,
                                active: !a.active,
                              }),
                            }),
                          a.active ? 'Conquista arquivada.' : 'Conquista reativada.',
                        )
                      }
                    >
                      {a.active ? 'Arquivar' : 'Reativar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
