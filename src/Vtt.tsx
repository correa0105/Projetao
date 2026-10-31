import { lazy, Suspense, useState } from 'react';
import type { Character, User } from './types';
import { useVttMediaPreferences } from './vtt-media-preferences';
import { VttVisualChoices } from './VttVisualChoices';
import { AssetLoading } from './AssetLoading';
import { ArrowRight, Compass } from 'lucide-react';
import { VttRememberChoices } from './VttVisualChoices';
import './vtt-entry.css';

const Session = lazy(() =>
  import('./VttSession').then((module) => ({ default: module.VttSession })),
);
export function Vtt({ characters, user }: { characters: Character[]; user: User }) {
  const media = useVttMediaPreferences(user.id);
  const [entered, setEntered] = useState(() => media.skipVisualPrompt);
  if (!entered)
    return (
      <section className="vtt-entry" aria-label="Preferências de entrada da mesa">
        <div className="vtt-entry-layout">
          <header className="vtt-entry-intro">
            <span className="vtt-entry-brand">Alvorada Cinzenta · Mesa virtual</span>
            <Compass className="vtt-entry-emblem" size={64} strokeWidth={1} aria-hidden="true" />
            <h1>
              Escolha como
              <br />
              ver a aventura.
            </h1>
            <p>Ajuste os efeitos ao seu computador e ao seu jeito de jogar.</p>
            <span className="vtt-entry-caption">
              Suas preferências acompanham você em todas as mesas deste navegador.
            </span>
          </header>
          <form
            className="vtt-entry-panel"
            onSubmit={(event) => {
              event.preventDefault();
              setEntered(true);
            }}
          >
            <span className="vtt-entry-kicker">Sua experiência</span>
            <h2>Um lugar à mesa</h2>
            <p>Escolha quais efeitos deseja exibir.</p>
            <VttVisualChoices media={media} />
            <VttRememberChoices media={media} />
            <button className="button primary vtt-entry-primary" type="submit">
              Entrar no VTT <ArrowRight size={17} aria-hidden="true" />
            </button>
            <small className="vtt-entry-footnote">
              Você pode rever essas escolhas nas configurações da mesa.
            </small>
          </form>
        </div>
      </section>
    );
  return (
    <Suspense fallback={<AssetLoading title="Preparando a mesa" />}>
      <Session
        characters={characters}
        user={user}
        media={media}
        reviewVisualPreferences={() => setEntered(false)}
      />
    </Suspense>
  );
}
