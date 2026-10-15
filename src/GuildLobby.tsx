import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Coins,
  Home,
  Plus,
  Search,
  Settings2,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { Crest } from '../shared/guilds';
import { GuildCrest } from './GuildCrest';

type Entry = {
  id: string;
  name: string;
  crest: Crest;
  prestige: number;
  members: number;
  rank: string;
};
export function GuildLobby({
  entries,
  mine,
  activeName,
  cost,
  canFound,
  foundingHint,
  onFound,
  onAdmin,
  invites,
}: {
  entries: Entry[];
  mine: string | null;
  activeName: string;
  cost: number | null | undefined;
  canFound: boolean;
  foundingHint: string;
  onFound: () => void;
  onAdmin?: () => void;
  invites: ReactNode;
}) {
  const [query, setQuery] = useState(''),
    [vacancies, setVacancies] = useState(false),
    [sort, setSort] = useState('prestige');
  const own = entries.find((e) => e.id === mine);
  const filtered = entries
    .map((entry, rank) => ({ ...entry, position: rank + 1 }))
    .filter(
      (e) =>
        e.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')) &&
        (!vacancies || e.members < 8),
    )
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : a.position - b.position,
    );
  const visit = (id: string) => {
    location.hash = 'guild?id=' + id;
  };
  return (
    <div className="guild-lobby">
      <header className="guild-lobby-masthead">
        <span>
          <Shield size={18} />
          Registro das companhias
        </span>
        {onAdmin && (
          <button onClick={onAdmin}>
            <Settings2 size={14} />
            Administrar guildas
          </button>
        )}
      </header>
      <section className="guild-lobby-hero" aria-labelledby="guild-lobby-title">
        <div className="guild-lobby-hero-copy">
          <span className="social-eyebrow">Guildas da Alvorada</span>
          <h1 id="guild-lobby-title">
            Toda aventura merece
            <br />
            uma companhia.
          </h1>
          <p>
            Um brasão para representar vocês. Uma sede para voltar. Encontre seu lugar entre as
            companhias da Alvorada.
          </p>
          <div className="guild-lobby-hero-actions">
            {mine ? (
              <button className="guild-lobby-primary" onClick={() => visit(mine)}>
                <Home size={17} />
                Minha guilda
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="guild-lobby-primary" disabled={!canFound} onClick={onFound}>
                <Plus size={17} />
                Fundar uma guilda
              </button>
            )}
            <button
              onClick={() =>
                document
                  .getElementById('guild-directory')
                  ?.scrollIntoView({
                    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  })
              }
            >
              <Search size={16} />
              Procurar guildas
            </button>
          </div>
          <span className="guild-lobby-cost">
            {mine ? (
              `${activeName} já tem uma companhia.`
            ) : cost === null || cost === undefined ? (
              'Fundação aguardando configuração.'
            ) : (
              <>
                <Coins size={14} />
                {cost.toLocaleString('pt-BR')} PO para fundar · quatro salas iniciais
              </>
            )}
          </span>
          {!mine && !canFound && <span className="guild-lobby-hint">{foundingHint}</span>}
        </div>
        <div className="guild-lobby-scene-label">
          <Home size={14} />
          <span>
            Seu próximo ponto de encontro<small>Salão principal · sede inicial</small>
          </span>
        </div>
        {own && (
          <button className="guild-lobby-own" onClick={() => visit(own.id)}>
            <GuildCrest crest={own.crest} size={52} />
            <span>
              <small>Sua companhia</small>
              <strong>{own.name}</strong>
              <em>
                {own.members}/8 jogadores · {own.rank}
              </em>
            </span>
            <ArrowRight size={18} />
          </button>
        )}
      </section>
      <div className="guild-lobby-benefits">
        <div>
          <Shield />
          <span>
            <strong>Uma identidade em comum</strong>
            <small>Crie seu brasão e personalize a sede.</small>
          </span>
        </div>
        <div>
          <Users />
          <span>
            <strong>Até oito jogadores</strong>
            <small>A entrada acontece por convite da companhia.</small>
          </span>
        </div>
        <div>
          <Trophy />
          <span>
            <strong>Histórias que rendem frutos</strong>
            <small>Cumpram missões e conquistem novas salas.</small>
          </span>
        </div>
      </div>
      {invites}
      <section className="guild-lobby-register" aria-labelledby="guild-directory">
        <header className="guild-lobby-register-heading">
          <div>
            <span className="social-eyebrow">Encontre seu lugar</span>
            <h2 id="guild-directory">
              Companhias da Alvorada <small>{entries.length}</small>
            </h2>
            <p>Visite uma sede, conheça os membros e combine seu convite.</p>
          </div>
          <label className="guild-lobby-search">
            <Search size={17} />
            <input
              type="search"
              aria-label="Procurar guildas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pelo nome da guilda…"
            />
          </label>
        </header>
        <div className="guild-lobby-filters">
          <div role="group" aria-label="Filtrar guildas">
            <button aria-pressed={!vacancies} onClick={() => setVacancies(false)}>
              Todas as guildas
            </button>
            <button aria-pressed={vacancies} onClick={() => setVacancies(true)}>
              Com vagas
            </button>
          </div>
          <label>
            Ordenar por
            <select
              aria-label="Ordenar guildas"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="prestige">Prestígio</option>
              <option value="name">Nome</option>
            </select>
          </label>
        </div>
        <div className="guild-directory guild-lobby-list">
          {filtered.map((e) => (
            <button
              key={e.id}
              className="guild-lobby-entry"
              onClick={() => visit(e.id)}
              aria-label={'Visitar ' + e.name}
            >
              <GuildCrest crest={e.crest} size={76} />
              <span className="guild-lobby-entry-copy">
                <small>{e.id === mine ? 'Sua guilda' : e.rank}</small>
                <h3>{e.name}</h3>
                <span>
                  <Users size={13} />
                  {e.members}/8 jogadores <i /> <Trophy size={13} />
                  {e.prestige.toLocaleString('pt-BR')}
                </span>
              </span>
              <span className="guild-lobby-position">{String(e.position).padStart(2, '0')}</span>
              <span className="guild-lobby-visit">
                Visitar sede
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <div className="guild-lobby-empty">
            <Shield size={30} />
            <h3>
              {entries.length ? 'Nenhuma companhia por aqui.' : 'O primeiro brasão pode ser o seu.'}
            </h3>
            <p>
              {entries.length
                ? 'Tente outro nome ou mostre todas as guildas.'
                : 'Funde uma guilda para começar uma história em companhia.'}
            </p>
            {entries.length > 0 && (
              <button
                onClick={() => {
                  setQuery('');
                  setVacancies(false);
                }}
              >
                <X size={14} />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
