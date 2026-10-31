import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Eye, Link2, Map, Settings2, Users } from 'lucide-react';

type Room = { id: string; name: string; is_owner: boolean; is_admin?: boolean };
export function VttLobby({
  rooms,
  personalRoomId,
  loading,
  busy,
  notice,
  join,
  open,
  retry,
  preferences,
  children,
}: {
  rooms: Room[];
  personalRoomId: string | null;
  loading: boolean;
  busy: boolean;
  notice: string;
  join: (input: string, role: 'player' | 'spectator') => void;
  open: (id: string) => void;
  retry: () => void;
  preferences: () => void;
  children?: ReactNode;
}) {
  const [invite, setInvite] = useState('');
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const personal = rooms.find((room) => room.id === personalRoomId);
  const others = rooms.filter((room) => room.id !== personalRoomId);
  return (
    <section className="vtt-lobby vtt-entry-hub" aria-label="Escolher uma mesa">
      <div className="vtt-entry-hub-inner">
        <header className="vtt-entry-hub-heading">
          <span className="vtt-entry-brand">Alvorada Cinzenta · Mesa virtual</span>
          <h1>Qual é a aventura de hoje?</h1>
          <p>Entre na mesa do seu grupo ou prepare a sua próxima sessão.</p>
        </header>
        {notice && (
          <div className="vtt-entry-notice" role="alert">
            {notice}
            {!personalRoomId && (
              <button type="button" onClick={retry} disabled={loading}>
                Tentar novamente
              </button>
            )}
          </div>
        )}
        <div className="vtt-entry-paths">
          <article className="vtt-entry-panel vtt-entry-join">
            <span className="vtt-entry-card-icon">
              <Link2 size={25} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="vtt-entry-kicker">Com o seu grupo</span>
            <h2>Entrar em uma mesa</h2>
            <p>Recebeu um convite? Cole o link completo ou o código enviado pelo mestre.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                join(invite, role);
              }}
            >
              <label className="vtt-entry-field">
                Link ou código de convite
                <input
                  required
                  maxLength={2048}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Cole aqui o link da mesa"
                  value={invite}
                  disabled={busy || loading}
                  onChange={(event) => setInvite(event.target.value)}
                />
              </label>
              <fieldset className="vtt-entry-roles">
                <legend>Como você quer participar?</legend>
                {(
                  [
                    ['player', 'Jogador', 'Com meus personagens', Users],
                    ['spectator', 'Espectador', 'Somente assistir', Eye],
                  ] as const
                ).map(([id, label, hint, Icon]) => (
                  <label key={id} className={role === id ? 'is-selected' : ''}>
                    <input
                      type="radio"
                      name="vtt-entry-role"
                      aria-label={label}
                      value={id}
                      checked={role === id}
                      disabled={busy || loading}
                      onChange={() => setRole(id)}
                    />
                    <Icon size={19} aria-hidden="true" />
                    <span>
                      <b>{label}</b>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                className="button primary vtt-entry-primary"
                type="submit"
                disabled={busy || loading || !invite.trim()}
              >
                {busy ? 'Abrindo mesa…' : 'Entrar na mesa'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          </article>
          <article className="vtt-entry-panel vtt-entry-own">
            <span className="vtt-entry-card-icon">
              <Map size={25} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="vtt-entry-kicker">Para conduzir a história</span>
            <h2>Minha mesa</h2>
            <p>Continue a preparação dos seus mapas e reúna o grupo no seu espaço.</p>
            <div className="vtt-entry-personal">
              <Map size={36} strokeWidth={1} aria-hidden="true" />
              <div>
                <b>{loading ? 'Consultando sua mesa…' : personal?.name || 'Sua mesa pessoal'}</b>
                <span>Seu link fixo e suas aventuras salvas.</span>
              </div>
            </div>
            <button
              type="button"
              className="button outline vtt-entry-primary"
              disabled={busy || loading || !personalRoomId}
              onClick={() => personalRoomId && open(personalRoomId)}
            >
              Abrir minha mesa
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            {children && (
              <details className="vtt-entry-create">
                <summary>
                  Criar outra mesa
                  <ChevronDown size={15} aria-hidden="true" />
                </summary>
                {children}
              </details>
            )}
          </article>
        </div>
        {others.length > 0 && (
          <details className="vtt-entry-saved">
            <summary>
              Outras mesas disponíveis <span>{others.length}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <ul>
              {others.map((room) => (
                <li key={room.id}>
                  <button type="button" disabled={busy || loading} onClick={() => open(room.id)}>
                    <Map size={19} aria-hidden="true" />
                    <span>
                      <b>{room.name}</b>
                      <small>
                        {room.is_owner
                          ? 'Sua mesa'
                          : room.is_admin
                            ? 'Acesso administrativo'
                            : 'Participante'}
                      </small>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <footer className="vtt-entry-hub-footer">
          <span>
            {loading ? 'Preparando suas opções…' : 'Você escolhe a mesa a cada aventura.'}
          </span>
          <button type="button" onClick={preferences}>
            <Settings2 size={15} aria-hidden="true" />
            Preferências visuais
          </button>
        </footer>
      </div>
    </section>
  );
}
