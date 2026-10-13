import type { CSSProperties } from 'react';
import { UserRound, MessageSquare, Users, Settings2, ArrowUpRight, Trophy } from 'lucide-react';
import type { ProfileSettings } from '../shared/social';
import { CardFace } from './Cards';
import { cards } from '../shared/cards';
import { GuildCrest } from './GuildCrest';
import type { Crest } from '../shared/guilds';
import { visitProfile } from './HallOfFame';
type Character = { id: string; name: string; portrait: string; class: string; level: number };
export type PlayerOverview = {
  id: string;
  name: string;
  avatar: string;
  is_owner: boolean;
  document: ProfileSettings;
  characters: Character[];
  progress: {
    level: number;
    xp: number;
    next_xp: number | null;
    modules: number;
    unlocks: number[];
  };
  friends: { id: string; name: string; avatar: string }[];
  guild: { id: string; name: string; crest: Crest; prestige: number; character_id: string; character_name: string } | null;
  blocked: boolean;
  friend: { status: string; incoming: boolean } | null;
};
type Details = {
  achievements: { code: string }[];
  definitions: { code: string; title: string }[];
  cards: { id: string; name: string; image?: string }[];
  pets: { id: string; name: string; image_url?: string | null }[];
  mounts: { id: string; name: string; image_url?: string | null }[];
} | null;
export function PlayerProfileOverview({
  profile: p,
  details,
  edit,
  social,
  chat,
  friend,
  character,
}: {
  profile: PlayerOverview;
  details: Details;
  edit: () => void;
  social: () => void;
  chat: () => void;
  friend: () => void;
  character: (id: string) => void;
}) {
  return (
    <div
      className="player-profile-home"
      style={
        {
          '--player-bg': `url('${p.document.background}')`,
          '--player-accent': p.document.accent,
        } as CSSProperties
      }
    >
      <header className="player-profile-hero">
        <div
          className={`player-avatar border-${p.document.border} effect-${p.document.border_effect}`}
        >
          <UserRound size={64} />
          {p.avatar && (
            <img
              src={p.avatar}
              alt={`Avatar de ${p.name}`}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
        </div>
        <div className="player-identity">
          <span className="social-eyebrow">Perfil do viajante</span>
          <h1>{p.name}</h1>
          <p>{p.document.tagline || 'Uma história em construção.'}</p>
          <span className="player-level">Nível de conta {p.progress.level}</span>
          <progress max={100} value={p.progress.xp % 100} aria-label="Experiência da conta" />
          <small>{p.progress.xp} XP · missões e conquistas da conta</small>
        </div>
        <div className="player-profile-actions">
          {p.is_owner ? (
            <>
              <button onClick={edit}>
                <Settings2 size={16} />
                Personalizar perfil
              </button>
              <button onClick={social}>
                <MessageSquare size={16} />
                Amigos e mensagens
              </button>
            </>
          ) : (
            !p.blocked && (
              <>
                <button onClick={friend}>
                  <Users size={16} />
                  {p.friend?.status === 'accepted'
                    ? 'Remover amizade'
                    : p.friend?.incoming
                      ? 'Aceitar amizade'
                      : p.friend
                        ? 'Solicitação enviada'
                        : 'Adicionar amigo'}
                </button>
                {p.friend?.status === 'accepted' && (
                  <button onClick={chat}>
                    <MessageSquare size={16} />
                    Enviar mensagem
                  </button>
                )}
              </>
            )
          )}
        </div>
      </header>
      <div className="player-profile-columns">
        <main>
          <section className="player-module">
            <span className="social-eyebrow">Por trás do personagem</span>
            <h2>Sobre {p.name}</h2>
            <p className="player-bio">
              {p.document.bio || 'Este viajante ainda não escreveu sua apresentação.'}
            </p>
          </section>
          {p.document.showcases.map((m, index) => (
            <section className={`player-module showcase-${m.kind}`} key={index}>
              <span className="social-eyebrow">Vitrine {index + 1}</span>
              <h2>
                {m.title ||
                  {
                    characters: 'Aventureiros',
                    chronicle: 'Crônicas',
                    achievements: 'Conquistas',
                    cards: 'Cartas',
                    companions: 'Companheiros',
                    guild: 'Minha guilda',
                  }[m.kind]}
              </h2>
              {m.kind === 'characters' && (
                <div className="player-character-showcase">
                  {p.characters.map((c) => (
                    <button key={c.id} onClick={() => character(c.id)}>
                      <img src={c.portrait} alt={c.name} />
                      <strong>{c.name}</strong>
                      <small>
                        {c.class} · nível {c.level}
                      </small>
                    </button>
                  ))}
                  {!p.characters.length && <p>Os seus personagens aparecerão aqui.</p>}
                </div>
              )}
              {m.kind === 'chronicle' && (
                <p className="player-bio">{m.body || 'Uma página à espera de novas memórias.'}</p>
              )}
              {m.kind === 'achievements' && (
                <div className="player-honors">
                  {details?.achievements.map((a) => (
                    <span key={a.code}>
                      <Trophy size={20} />
                      {details.definitions.find((d) => d.code === a.code)?.title || a.code}
                    </span>
                  ))}
                  {!details?.achievements.length && (
                    <p>As conquistas do personagem aparecerão nesta vitrine.</p>
                  )}
                </div>
              )}
              {m.kind === 'cards' && (
                <div className="player-mini-gallery">
                  {details?.cards.map((c) => (
                    <span key={c.id}>
                      {cards.find((card) => card.id === c.id) && (
                        <CardFace card={cards.find((card) => card.id === c.id)!} small />
                      )}
                      <strong>{c.name}</strong>
                    </span>
                  ))}
                  {!details?.cards.length && <p>Sem cartas na coleção deste personagem.</p>}
                </div>
              )}
              {m.kind === 'companions' && (
                <div className="player-mini-gallery">
                  {[...(details?.pets || []), ...(details?.mounts || [])].map((c) => (
                    <span key={c.id}>
                      {c.image_url && <img src={c.image_url} alt="" />}
                      {c.name}
                    </span>
                  ))}
                  {!details?.pets.length && !details?.mounts.length && (
                    <p>Os companheiros do personagem aparecerão aqui.</p>
                  )}
                </div>
              )}
              {m.kind === 'guild' &&
                (p.guild ? (
                  <a href={'#guild?id=' + p.guild.id}>
                    <GuildCrest crest={p.guild.crest} size={64} />
                    {p.guild.name} · {p.guild.character_name}
                    <ArrowUpRight size={16} />
                  </a>
                ) : (
                  <a href="#guild">
                    Encontre sua guilda <ArrowUpRight size={16} />
                  </a>
                ))}
            </section>
          ))}
          {p.is_owner && (
            <p className="player-unlock-hint">
              {p.progress.modules} vitrines liberadas · próximos níveis:{' '}
              {p.progress.unlocks.filter((n) => n > p.progress.level).join(', ') ||
                'todas liberadas'}
            </p>
          )}
        </main>
        <aside>
          <section className="player-module">
            <h2>
              Amigos <small>{p.friends.length}</small>
            </h2>
            <div className="player-friend-list">
              {p.friends.map((f) => (
                <button key={f.id} onClick={() => visitProfile(f.id)}>
                  {f.avatar ? <img src={f.avatar} alt="" /> : <UserRound size={28} />}
                  <span>{f.name}</span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!p.friends.length && <p>A lista de amigos ainda está vazia.</p>}
            </div>
            {p.is_owner && (
              <button onClick={social}>
                Abrir conversas <MessageSquare size={14} />
              </button>
            )}
          </section>
          {p.guild && (
            <section className="player-module player-guild-badge">
              <GuildCrest crest={p.guild.crest} size={90} />
              <h2>{p.guild.name}</h2>
              <p>{p.guild.character_name} · Membro da guilda</p>
              <a href={'#guild?id=' + p.guild.id}>
                Visitar sede <ArrowUpRight size={14} />
              </a>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
