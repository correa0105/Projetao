import { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Trophy,
  Star,
  Shield,
  Flag,
  Settings2,
  Search,
  ArrowUpRight,
  UserRound,
  X,
} from 'lucide-react';
import { api } from './api';
import type { HallEntry, HallSettings } from '../shared/social';
import './hall-profiles.css';
export function visitProfile(user: string, character?: string) {
  location.hash =
    'profiles?user=' +
    encodeURIComponent(user) +
    (character ? '&character=' + encodeURIComponent(character) : '');
}
const rankings = [
  { id: 'general', name: 'Geral', icon: Crown },
  { id: 'achievements', name: 'Conquistas', icon: Trophy },
  { id: 'prestige', name: 'Prestígio', icon: Shield },
  { id: 'missions', name: 'Aventureiros', icon: Flag },
  { id: 'rating', name: 'Melhores perfis', icon: Star },
  { id: 'titles', name: 'Honrarias', icon: Crown },
] as const;
type Ranking = (typeof rankings)[number]['id'];
type HallResponse = {
  document: HallSettings;
  revision: number;
  can_edit: boolean;
  entries: HallEntry[];
};
export function HallOfFame({
  focusCharacterId,
  embedded = false,
}: {
  focusCharacterId?: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<HallResponse | null>(null),
    [error, setError] = useState(''),
    [ranking, setRanking] = useState<Ranking>('general'),
    [query, setQuery] = useState(''),
    [editing, setEditing] = useState<HallSettings | null>(null),
    [page, setPage] = useState(1);
  const load = () =>
    api<HallResponse>('/hall')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('profile-rating-updated', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('profile-rating-updated', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const ordered = useMemo(() => {
    if (!data) return [];
    const value = (e: HallEntry) =>
      ranking === 'general'
        ? e.score
        : ranking === 'prestige'
          ? e.parts.level + e.parts.titles
          : ranking === 'rating'
            ? e.rating
            : e[ranking];
    const entries =
      ranking === 'rating'
        ? [
            ...new Map(
              data.entries.filter((e) => e.rating_count > 0).map((e) => [e.user_id, e]),
            ).values(),
          ]
        : data.entries;
    return [...entries]
      .sort((a, b) => value(b) - value(a) || b.score - a.score || a.rank - b.rank)
      .map((e, i) => ({ ...e, categoryRank: i + 1, categoryValue: value(e) }));
  }, [data, ranking]);
  const filtered = ordered.filter((e) =>
    `${e.name} ${e.owner_name} ${e.class} ${e.race}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(
        query
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      ),
  );
  function portrait(e: HallEntry) {
    return (
      <span className="hall-portrait">
        <UserRound size={40} />
        <img
          src={e.portrait + '&thumb=1'}
          alt=""
          onLoad={(event) => event.currentTarget.style.removeProperty('display')}
          onError={(event) => (event.currentTarget.style.display = 'none')}
        />
      </span>
    );
  }
  return (
    <section className={`hall-of-fame ${embedded ? 'embedded' : ''}`}>
      <div className="hall-heading">
        <span className="social-eyebrow">Nomes gravados na história</span>
        <h2>
          {data?.document.title && data.document.title !== 'Hall da Fama'
            ? data.document.title
            : embedded
              ? 'Hall da Fama'
              : 'Personagens em destaque'}
        </h2>
        <p>{data?.document.intro || 'As histórias que deixam sua marca na Alvorada.'}</p>
        {data?.can_edit && !embedded && (
          <button
            className="button outline"
            onClick={() => setEditing(structuredClone(data.document))}
          >
            <Settings2 size={15} />
            Editar pontuação e apresentação
          </button>
        )}
      </div>
      {error && (
        <p className="social-error" role="alert">
          {error}
        </p>
      )}
      <nav className="hall-rankings" aria-label="Tipos de ranking">
        {rankings.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={ranking === id}
            onClick={() => {
              setRanking(id);
              setPage(1);
            }}
          >
            <Icon size={15} />
            {name}
          </button>
        ))}
      </nav>
      {!query && ordered.length > 0 && (
        <div className="hall-podium">
          {ordered.slice(0, 3).map((e) => (
            <button
              className={`hall-champion place-${e.categoryRank} ${e.id === focusCharacterId ? 'focused' : ''}`}
              key={e.id}
              onClick={() => visitProfile(e.user_id, e.id)}
            >
              <span className="hall-place">
                {e.categoryRank === 1 ? <Crown size={26} /> : <Trophy size={22} />}
                <b>#{e.categoryRank}</b>
              </span>
              {portrait(e)}
              <h2>{ranking === 'rating' ? e.owner_name : e.name}</h2>
              <span>
                {e.class} · Nível {e.level}
              </span>
              <small>{e.owner_name}</small>
              <strong className="hall-champion-value">
                {ranking === 'rating'
                  ? e.categoryValue.toFixed(2)
                  : e.categoryValue.toLocaleString('pt-BR')}
                <small>
                  {ranking === 'rating'
                    ? 'avaliação ponderada'
                    : ranking === 'general' || ranking === 'prestige'
                      ? 'pontos'
                      : 'registros'}
                </small>
              </strong>
              <span className="hall-profile-link">
                Visitar perfil <ArrowUpRight size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="hall-search">
        <Search size={16} />
        <input
          aria-label="Buscar personagem no Hall da Fama"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Procure um personagem, jogador ou classe…"
        />
        <span>
          {filtered.length} {ranking === 'rating' ? 'perfis' : 'personagens'}
        </span>
      </div>
      {data && data.entries.length === 0 && (
        <p className="social-empty">
          Os primeiros nomes serão gravados aqui quando os jogadores criarem personagens.
        </p>
      )}
      {ranking === 'rating' && filtered.length === 0 && (
        <p className="social-empty">Nenhum perfil recebeu avaliações ainda.</p>
      )}
      <div
        className="hall-table"
        role="table"
        aria-label={ranking === 'rating' ? 'Ranking de perfis' : 'Ranking de personagens'}
      >
        <div className="hall-table-head" role="row">
          <span>Posição</span>
          <span>{ranking === 'rating' ? 'Perfil' : 'Personagem'}</span>
          <span>Prestígio</span>
          <span>Conquistas</span>
          <span>Missões</span>
          <span>{ranking === 'rating' ? 'Avaliação' : 'Pontuação'}</span>
        </div>
        {filtered.slice((page - 1) * 20, page * 20).map((e) => (
          <div
            key={e.id}
            className={`hall-table-row ${e.id === focusCharacterId ? 'focused' : ''}`}
            role="row"
          >
            <span className="hall-rank">{String(e.categoryRank).padStart(2, '0')}</span>
            <button className="hall-character" onClick={() => visitProfile(e.user_id, e.id)}>
              {portrait(e)}
              <span>
                <strong>{ranking === 'rating' ? e.owner_name : e.name}</strong>
                <small>
                  {ranking === 'rating' ? e.name : e.owner_name} · {e.class} · Nível {e.level}
                </small>
              </span>
            </button>
            <span>{e.parts.level + e.parts.titles}</span>
            <span>{e.achievements}</span>
            <span>{e.missions}</span>
            <strong>
              {ranking === 'rating' ? e.rating.toFixed(2) : e.score.toLocaleString('pt-BR')}
              <small>
                {ranking === 'rating' ? e.rating_count + ' avaliações' : 'pontos gerais'}
              </small>
            </strong>
          </div>
        ))}
      </div>
      {filtered.length > 20 && (
        <div className="hall-pagination">
          <button disabled={page === 1} onClick={() => setPage((v) => v - 1)}>
            Anterior
          </button>
          <span>
            {page} / {Math.ceil(filtered.length / 20)}
          </span>
          <button disabled={page * 20 >= filtered.length} onClick={() => setPage((v) => v + 1)}>
            Próxima
          </button>
        </div>
      )}
      {data && (
        <details className="hall-score-guide">
          <summary>Como a pontuação é calculada</summary>
          <p>
            {data.document.weights.level} por nível acima do primeiro ·{' '}
            {data.document.weights.achievement} por conquista · {data.document.weights.mission} por
            missão creditada · {data.document.weights.title} por título ativo.
          </p>
          <p>
            Avaliações do perfil contribuem até {data.document.weights.rating} pontos. Uma avaliação
            por conta, sem autoavaliação. A média usa cinco votos de referência com nota 3,5 para
            reduzir o peso de uma única avaliação. Empates gerais usam nível, conquistas, nome e ID.
            Os filtros mantêm visível a pontuação geral para comparação.
          </p>
        </details>
      )}
      {editing && data && (
        <div className="social-modal-backdrop">
          <form
            className="social-modal"
            role="dialog"
            aria-label="Editar Hall da Fama"
            onSubmit={(e) => {
              e.preventDefault();
              void api('/hall/settings', {
                method: 'PUT',
                body: JSON.stringify({ document: editing, revision: data.revision }),
              })
                .then(() => {
                  setEditing(null);
                  void load();
                })
                .catch((e) => setError(e.message));
            }}
          >
            <button
              type="button"
              className="social-modal-close"
              aria-label="Fechar edição"
              onClick={() => setEditing(null)}
            >
              <X size={18} />
            </button>
            <h2>As marcas de uma história</h2>
            <label>
              Título
              <input
                value={editing.title}
                onChange={(e) => setEditing((v) => (v ? { ...v, title: e.target.value } : v))}
                maxLength={100}
              />
            </label>
            <label>
              Apresentação
              <textarea
                value={editing.intro}
                onChange={(e) => setEditing((v) => (v ? { ...v, intro: e.target.value } : v))}
                maxLength={1000}
              />
            </label>
            {Object.entries({
              level: 'Pontos por nível',
              achievement: 'Pontos por conquista',
              mission: 'Pontos por missão',
              title: 'Pontos por título',
              rating: 'Máximo por avaliações',
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={editing.weights[key as keyof HallSettings['weights']]}
                  onChange={(e) =>
                    setEditing((v) =>
                      v
                        ? {
                            ...v,
                            weights: {
                              ...v.weights,
                              [key]: Math.max(0, Math.min(1000, Number(e.target.value) || 0)),
                            },
                          }
                        : v,
                    )
                  }
                />
              </label>
            ))}
            <button className="button primary" type="submit">
              Salvar critérios
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
