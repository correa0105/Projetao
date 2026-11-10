import { VttAssetImage } from './VttAssetImage';
import { useEffect, useState, type DragEvent } from 'react';
import { api } from './api';
import { companionMime, type VttCompanion, type VttCompanionAid } from '../shared/vtt-companions';
import { companionAid, companionAidSummary } from '../shared/companion-aid';
export function VttCompanions({
  roomId,
  kind,
  disabled,
  aidContext,
  rollAid,
  bring,
}: {
  roomId: string;
  kind: 'mount' | 'pet';
  disabled: boolean;
  aidContext?: string;
  rollAid: (id: string) => void;
  bring: (id: string) => void;
}) {
  const [animals, setAnimals] = useState<VttCompanion[]>([]),
    [aids, setAids] = useState<VttCompanionAid[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ companions: VttCompanion[]; aids: VttCompanionAid[] }>(
      '/vtt/rooms/' + roomId + '/companions',
    )
      .then((data) => {
        if (!active) return;
        setAnimals(data.companions);
        setAids(data.aids ?? []);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId, kind, aidContext]);
  const drag = (event: DragEvent<HTMLButtonElement>, id: string) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(companionMime, id);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const shown = animals.filter((a) => a.kind === kind);
  const checks = aids.filter((a) => a.kind === kind);
  return (
    <section
      aria-label={kind === 'mount' ? 'Montarias dos personagens' : 'Mascotes dos personagens'}
    >
      <h3>{kind === 'mount' ? 'Trazer montaria' : 'Trazer mascote'}</h3>
      <p className="vtt-muted">Clique ou arraste a imagem para colocar no mapa.</p>
      {!!checks.length && (
        <section aria-label="Auxílio de companheiros em cena">
          <h4>Auxílio em cena</h4>
          <p className="vtt-muted">
            O mestre rola quando a situação se aplica. Cada personagem tem um auxílio a cada 24
            horas.
          </p>
          {checks.map(({ id, name, characterName, aid, readyAt }) => (
            <div className="vtt-list-row vtt-companion-aid-row" key={id}>
              <span>
                <strong>
                  {name} · {characterName}
                </strong>
                <small>{companionAidSummary(aid)}</small>
              </span>
              <button
                type="button"
                disabled={disabled || loading || !!readyAt}
                onClick={() => rollAid(id)}
              >
                {readyAt ? 'Em recarga' : 'Rolar auxílio'}
              </button>
            </div>
          ))}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {loading && <p>Carregando animais…</p>}
      {!loading && !error && !shown.length && (
        <p>Nenhum animal deste tipo pertence aos seus personagens.</p>
      )}
      {shown.map((a) => {
        const aid = companionAid(a.kind, a.species, a.appearance);
        return (
          <button
            key={a.id}
            className="vtt-list-row vtt-character-row"
            data-companion-id={a.id}
            aria-label={'Colocar ' + a.name + ' · ' + a.characterName}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(e) => drag(e, a.id)}
            onClick={() => bring(a.id)}
            title="Arraste para o mapa"
          >
            <span className="vtt-companion-thumbnail">
              <VttAssetImage thumbnail src={a.portraitUrl || a.tokenUrl} alt="" />
            </span>
            <span>
              <strong>{a.name}</strong>
              <small>{a.speciesName}</small>
              <small>
                Pertence a {a.characterName} · {a.ownerName}
              </small>
              {aid && <small>{companionAidSummary(aid)}</small>}
            </span>
            <span className="vtt-companion-token-mini" title="Token visto de cima">
              <VttAssetImage thumbnail src={a.tokenUrl} alt="Token visto de cima" />
            </span>
          </button>
        );
      })}
    </section>
  );
}
