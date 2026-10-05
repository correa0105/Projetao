import { useEffect, useState } from 'react';
import { Crown, Shield, Feather, Star, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { achievementCatalog } from '../shared/achievements';
import type { AchievementDefinition } from '../shared/achievements';
import { AchievementHonors } from './AchievementHonors';
import {
  emptyTitle,
  titleGoalNames,
  type CharacterTitle,
  type TitleInput,
  type TitlesResponse,
} from '../shared/titles';
import './titles.css';
const symbols = { crown: Crown, shield: Shield, feather: Feather, star: Star };
function TitleSeal({ title }: { title: TitleInput }) {
  const Symbol = symbols[title.symbol];
  return (
    <span className={'title-seal title-' + title.tone}>
      <Symbol size={26} />
    </span>
  );
}
export function CharacterTitleLabel({ characterId }: { characterId: string }) {
  const [title, setTitle] = useState<CharacterTitle | null>(null);
  useEffect(() => {
    let live = true;
    setTitle(null);
    api<TitlesResponse>('/titles/' + characterId)
      .then((r) => {
        if (live) setTitle(r.items.find((t) => t.id === r.displayed) || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [characterId]);
  return title ? (
    <span className={'character-title-label title-' + title.tone}>{title.name}</span>
  ) : null;
}
export function TitleHall({
  characterId,
  canEdit = false,
}: {
  characterId?: string;
  canEdit?: boolean;
}) {
  const [data, setData] = useState<TitlesResponse | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [manager, setManager] = useState(false),
    [initialAchievement, setInitialAchievement] = useState<AchievementDefinition | undefined>(),
    [definitions, setDefinitions] = useState<AchievementDefinition[]>(
      [...achievementCatalog].map((a) => ({ ...a, revision: 0 })),
    );
  async function refresh() {
    if (characterId) setData(await api<TitlesResponse>('/titles/' + characterId));
    else {
      const r = await api<{ can_edit: boolean; items: CharacterTitle[] }>('/titles/catalog');
      setData({
        can_edit: r.can_edit,
        displayed: null,
        items: r.items.map((t) => ({ ...t, current: 0, earned: false })),
      });
    }
  }
  useEffect(() => {
    let live = true;
    const request = characterId
      ? api<TitlesResponse>('/titles/' + characterId)
      : api<{ can_edit: boolean; items: CharacterTitle[] }>('/titles/catalog').then((r) => ({
          can_edit: r.can_edit,
          displayed: null,
          items: r.items.map((t) => ({ ...t, current: 0, earned: false })),
        }));
    request
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [characterId]);
  async function display(id: string | null) {
    if (!characterId) return;
    setBusy(true);
    setError('');
    try {
      await api('/titles/' + characterId + '/display', {
        method: 'PUT',
        body: JSON.stringify({ title_id: id }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="title-hall" aria-label="Títulos e honrarias">
      <header>
        <div>
          <span className="eyebrow">NOMES QUE A GUILDA RECONHECE</span>
          <h2>Títulos & honrarias</h2>
          <p>Conquistas viram histórias. Histórias dão significado ao nome que você carrega.</p>
        </div>
        {(data?.can_edit || canEdit) && (
          <button
            className="button outline"
            onClick={() => {
              setInitialAchievement(undefined);
              setManager(true);
            }}
          >
            Administrar títulos
          </button>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="title-hall-cards">
        {data?.items.map((title) => (
          <article key={title.id} data-earned={title.earned}>
            <TitleSeal title={title} />
            <div>
              <h3>{title.name}</h3>
              <p>{title.description}</p>
              <small>
                {title.goal.kind === 'achievement'
                  ? `Conquista: ${definitions.find((a) => a.code === title.goal.achievement)?.title}`
                  : title.goal.kind === 'manual'
                    ? 'Concedido pelo administrador'
                    : `${titleGoalNames[title.goal.kind]}: ${title.goal.target.toLocaleString('pt-BR')}${title.goal.kind === 'spent' ? ' PO' : ''}`}
              </small>
              {!title.earned && title.goal.kind !== 'manual' && (
                <progress
                  value={title.current}
                  max={title.goal.kind === 'achievement' ? 1 : title.goal.target}
                  aria-label={'Progresso de ' + title.name}
                />
              )}
            </div>
            {characterId &&
              (title.earned ? (
                <button
                  className="text-button"
                  disabled={busy}
                  aria-pressed={data.displayed === title.id}
                  onClick={() => void display(data.displayed === title.id ? null : title.id)}
                >
                  {data.displayed === title.id ? 'Em exibição · ocultar' : 'Exibir título'}
                </button>
              ) : (
                <Lock size={15} aria-label="Ainda não conquistado" />
              ))}
          </article>
        ))}
      </div>
      {!data && !error && <p role="status">Consultando as honrarias…</p>}
      {data && (
        <AchievementHonors
          characterId={characterId}
          titles={data.items}
          onDefinitions={setDefinitions}
          canEdit={data.can_edit}
          onChanged={refresh}
          onCreateTitle={(a) => {
            setInitialAchievement(a);
            setManager(true);
          }}
        />
      )}
      {manager && (data?.can_edit || canEdit) && (
        <TitleManager
          initialAchievement={initialAchievement}
          definitions={definitions}
          close={() => setManager(false)}
          changed={refresh}
        />
      )}
    </section>
  );
}
function TitleManager({
  close,
  changed,
  initialAchievement,
  definitions,
}: {
  close: () => void;
  changed: () => Promise<void>;
  initialAchievement?: AchievementDefinition;
  definitions: AchievementDefinition[];
}) {
  const [catalog, setCatalog] = useState<CharacterTitle[]>([]),
    [selected, setSelected] = useState<CharacterTitle | null>(null),
    [draft, setDraft] = useState<TitleInput>(() =>
      initialAchievement
        ? {
            ...structuredClone(emptyTitle),
            name: initialAchievement.title,
            description: initialAchievement.description,
            goal: { kind: 'achievement', target: 1, achievement: initialAchievement.code },
          }
        : structuredClone(emptyTitle),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false),
    [query, setQuery] = useState(''),
    [characters, setCharacters] = useState<{ id: string; name: string; player_name: string }[]>([]),
    [character, setCharacter] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    const r = await api<{ items: CharacterTitle[] }>('/titles/catalog');
    setCatalog(r.items);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setCharacter('');
    setCharacters([]);
    if (query.trim().length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void api<{ id: string; name: string; player_name: string }[]>(
        '/titles/characters?q=' + encodeURIComponent(query.trim()),
        { signal: abort.signal },
      )
        .then(setCharacters)
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);
  function choose(title: CharacterTitle | null) {
    setSelected(title);
    setConfirm(false);
    setNotice('');
    setDraft(
      title
        ? {
            name: title.name,
            description: title.description,
            tone: title.tone,
            symbol: title.symbol,
            goal: { ...title.goal },
          }
        : structuredClone(emptyTitle),
    );
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = selected
        ? await api<{ id: string }>('/titles/catalog/' + selected.id, {
            method: 'PUT',
            body: JSON.stringify({ ...draft, revision: selected.revision }),
          })
        : await post<{ id: string }>('/titles/catalog', draft);
      const result = await api<{ items: CharacterTitle[] }>('/titles/catalog');
      setCatalog(result.items);
      choose(result.items.find((t) => t.id === r.id) || null);
      await changed();
      setNotice('Título salvo.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api('/titles/catalog/' + selected!.id, {
        method: 'DELETE',
        body: JSON.stringify({ revision: selected!.revision }),
      });
      choose(null);
      await load();
      await changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function grant(action: 'grant' | 'revoke') {
    setBusy(true);
    setError('');
    try {
      await post('/titles/grant', { character_id: character, title_id: selected!.id, action });
      await changed();
      setNotice(
        action === 'grant' ? 'Título concedido ao personagem.' : 'Título removido do personagem.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Administrar títulos"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="title-manager">
        <div className="title-manager-list">
          <button className="button outline" disabled={busy} onClick={() => choose(null)}>
            <Plus size={14} />
            Novo título
          </button>
          {catalog.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              aria-pressed={selected?.id === t.id}
              onClick={() => choose(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <TitleSeal title={draft} />
            <label>
              Nome do título
              <input
                required
                maxLength={80}
                minLength={2}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </label>
            <div className="event-editor-grid">
              <label>
                Símbolo
                <select
                  value={draft.symbol}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, symbol: e.target.value as TitleInput['symbol'] }))
                  }
                >
                  <option value="crown">Coroa</option>
                  <option value="shield">Escudo</option>
                  <option value="feather">Pena</option>
                  <option value="star">Estrela</option>
                </select>
              </label>
              <label>
                Metal e cor
                <select
                  value={draft.tone}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tone: e.target.value as TitleInput['tone'] }))
                  }
                >
                  <option value="copper">Cobre</option>
                  <option value="silver">Prata</option>
                  <option value="crimson">Carmesim</option>
                </select>
              </label>
            </div>
            <label>
              Forma de conquistar
              <select
                value={draft.goal.kind}
                aria-label="Forma de conquistar"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    goal: { ...d.goal, kind: e.target.value as TitleInput['goal']['kind'] },
                  }))
                }
              >
                {Object.entries(titleGoalNames).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.goal.kind === 'achievement' ? (
              <label>
                Conquista vinculada
                <select
                  required
                  aria-label="Conquista vinculada"
                  value={draft.goal.achievement}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, goal: { ...d.goal, achievement: e.target.value } }))
                  }
                >
                  <option value="">Escolha a conquista</option>
                  {definitions.map((a) => (
                    <option value={a.code} key={a.code}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              draft.goal.kind !== 'manual' && (
                <label>
                  Meta{draft.goal.kind === 'spent' ? ' em PO' : ''}
                  <input
                    type="number"
                    min={1}
                    max={draft.goal.kind === 'level' ? 20 : 10000000}
                    required
                    value={draft.goal.target}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        goal: { ...d.goal, target: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
              )
            )}
          </fieldset>
          <div className="event-editor-actions">
            {selected &&
              (confirm ? (
                <button type="button" disabled={busy} onClick={() => void remove()}>
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" className="text-button" onClick={() => setConfirm(true)}>
                  <Trash2 size={14} />
                  Excluir título
                </button>
              ))}
            <button className="button primary" disabled={busy}>
              <Save size={14} />
              Salvar título
            </button>
          </div>
        </form>
        {selected && (
          <fieldset className="title-distribution" disabled={busy}>
            <legend>Distribuir para um personagem</legend>
            <p>
              Você pode conceder uma homenagem diretamente, mesmo que a meta ainda não tenha sido
              atingida.
            </p>
            <label>
              Buscar personagem ou jogador
              <input
                value={query}
                minLength={2}
                placeholder="Digite pelo menos duas letras"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Personagem
              <select
                aria-label="Personagem"
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
              >
                <option value="">Escolha um personagem</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.player_name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                className="button primary"
                disabled={!character}
                onClick={() => void grant('grant')}
              >
                Conceder título
              </button>
              <button
                className="button outline"
                disabled={!character}
                onClick={() => void grant('revoke')}
              >
                Remover título
              </button>
            </div>
          </fieldset>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
    </Modal>
  );
}
