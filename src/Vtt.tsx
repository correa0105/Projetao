import { lazy, Suspense, useState } from 'react';
import type { Character, User } from './types';
import { useVttMediaPreferences } from './vtt-media-preferences';
import { VttVisualChoices } from './VttVisualChoices';
import { AssetLoading } from './AssetLoading';
import './vtt-entry.css';

const Session = lazy(() =>
  import('./VttSession').then((module) => ({ default: module.VttSession })),
);
export function Vtt({ characters, user }: { characters: Character[]; user: User }) {
  const media = useVttMediaPreferences(user.id);
  const [entered, setEntered] = useState(false);
  if (!entered)
    return (
      <section className="vtt-entry" aria-label="Preferências de entrada da mesa">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setEntered(true);
          }}
        >
          <span className="vtt-entry-brand">Alvorada Cinzenta · Mesa virtual</span>
          <h1>Como você quer ver a mesa?</h1>
          <p>Escolha os efeitos visuais que permite neste navegador antes de entrar.</p>
          <VttVisualChoices media={media} />
          <p>Você pode mudar essas escolhas nas configurações da mesa.</p>
          <button className="button primary" type="submit">
            Entrar no VTT
          </button>
        </form>
      </section>
    );
  return (
    <Suspense fallback={<AssetLoading title="Preparando a mesa" />}>
      <Session characters={characters} user={user} media={media} />
    </Suspense>
  );
}
