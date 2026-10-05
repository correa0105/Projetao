import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Hourglass,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from './api';
import { Modal } from './components';
import { useLoreMechanism } from './lore-mechanism';
import { loreFolderPath, type LoreFolder } from '../shared/lore';
import {
  type LoreEra,
  type LoreTimelineDocument,
  type LoreTimelineResponse,
} from '../shared/lore-timeline';
import './lore-timeline.css';

export type LoreTimelineHandle = { travelToFolder: (folderId: string) => Promise<boolean> };
type Props = {
  folders: LoreFolder[];
  regions: { id: string; name: string }[];
  onFolder: (folderId: string) => void;
};
const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
export const LoreTimeline = forwardRef<LoreTimelineHandle, Props>(function LoreTimeline(
  { folders, regions, onFolder },
  ref,
) {
  const [timeline, setTimeline] = useState<LoreTimelineResponse | null>(null);
  const [selected, setSelected] = useState('');
  const [phase, setPhase] = useState<'idle' | 'travelling' | 'arriving'>('idle');
  const [arrival, setArrival] = useState(0);
  const [beam, setBeam] = useState({ origin: 0, tip: 0, duration: 0, token: 0 });
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const host = useRef<HTMLElement>(null);
  const active = useRef('');
  const flight = useRef(0);
  const sound = useLoreMechanism();
  const mechanism = useRef<((locked?: boolean) => void) | null>(null);
  const [gears, setGears] = useState<{ position: number; active: boolean; angle: number }[]>([]);
  useEffect(() => {
    if (!host.current) return;
    const track = host.current.querySelector<HTMLElement>('.lore-era-thread')!;
    const measure = () => {
      const width = track.clientWidth,
        count = Math.max(1, Math.round(width / 25));
      setGears(
        Array.from({ length: count }, (_, i) => ({
          position: (i + 0.5) / count,
          active: false,
          angle: 0,
        })),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [timeline?.document.eras.length]);
  async function refresh() {
    const value = await api<LoreTimelineResponse>('/lore-timeline');
    setTimeline(value);
    if (!value.document.eras.some((era) => era.id === active.current)) {
      active.current = value.document.eras.at(-1)!.id;
      setSelected(active.current);
    }
  }
  useEffect(() => {
    void refresh().catch((error: Error) => setError(error.message));
    return () => {
      flight.current++;
      mechanism.current?.();
    };
  }, []);
  async function travel(eraId: string) {
    if (!timeline) return false;
    const token = ++flight.current;
    const eras = timeline.document.eras;
    const destination = eras.findIndex((era) => era.id === eraId);
    if (destination < 0) return false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
    mechanism.current?.();
    const finish = sound(false);
    mechanism.current = finish;
    const from = Math.max(
      0,
      eras.findIndex((era) => era.id === active.current),
    );
    if (from !== destination && !reduced) {
      setBeam({ origin: from, tip: from, duration: 0, token });
      setPhase('travelling');
      const step = from > destination ? -1 : 1;
      const duration = 560;
      finish();
      const moving = sound(true);
      mechanism.current = moving;
      // Give the new, empty strip a frame before extending it toward the next era.
      await pause(40);
      for (let index = from + step; index !== destination + step; index += step) {
        if (flight.current !== token) return false;
        setBeam({ origin: from, tip: index, duration, token });
        host.current
          ?.querySelector<HTMLElement>(`[data-era-id="${eras[index].id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        const start = performance.now();
        await new Promise<void>((resolve) => {
          const tick = (now: number) => {
            if (flight.current !== token) {
              resolve();
              return;
            }
            const progress = Math.min(1, (now - start) / duration),
              front = (index - step + step * progress) / Math.max(1, eras.length - 1),
              origin = from / Math.max(1, eras.length - 1);
            setGears((gs) =>
              gs.map((g, i) => {
                const reached =
                  g.position >= Math.min(origin, front) - 0.01 &&
                  g.position <= Math.max(origin, front) + 0.01;
                return {
                  ...g,
                  active: reached,
                  angle: reached ? g.angle + (i % 2 ? -1 : 1) * 3 : g.angle,
                };
              }),
            );
            if (progress < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        if (flight.current !== token) return false;
        active.current = eras[index].id;
        setSelected(active.current);
      }
    } else {
      setBeam({ origin: destination, tip: destination, duration: 0, token });
    }
    if (flight.current !== token) return false;
    active.current = eraId;
    setSelected(eraId);
    setArrival((value) => value + 1);
    setPhase('arriving');
    mechanism.current?.(true);
    setGears((gs) => gs.map((g) => ({ ...g, active: false })));
    await pause(reduced ? 120 : 1050);
    if (flight.current !== token) return false;
    setPhase('idle');
    return true;
  }
  useImperativeHandle(ref, () => ({
    async travelToFolder(folderId) {
      let folder = folders.find((item) => item.id === folderId);
      const visited = new Set<string>();
      while (folder && !visited.has(folder.id)) {
        visited.add(folder.id);
        const era = timeline?.document.eras.find((era) => era.folder_ids.includes(folder!.id));
        if (era) return travel(era.id);
        folder = folders.find((item) => item.id === folder!.parent_id);
      }
      return true;
    },
  }));
  if (!timeline)
    return error ? (
      <p className="lore-timeline-error" role="alert">
        {error}{' '}
        <button onClick={() => void refresh().catch((e: Error) => setError(e.message))}>
          Tentar novamente
        </button>
      </p>
    ) : null;
  const { document } = timeline;
  const era = document.eras.find((item) => item.id === selected) || document.eras.at(-1)!;
  const position = document.eras.findIndex((item) => item.id === era.id);
  const linked = folders.filter((folder) => era.folder_ids.includes(folder.id));
  return (
    <section
      ref={host}
      className="lore-timeline"
      aria-label="Linha do tempo das eras"
      data-phase={phase}
      data-era={era.id}
      data-locked={phase === 'idle' || phase === 'arriving'}
      style={{ '--era-position': position, '--era-count': document.eras.length } as CSSProperties}
    >
      <header className="lore-timeline-heading">
        <div>
          <span className="lore-kicker">O TEMPO GUARDA SEUS SEGREDOS</span>
          {document.title && <h2>{document.title}</h2>}
        </div>
        {timeline.can_edit && (
          <button className="lore-timeline-edit" onClick={() => setEdit(true)}>
            <Pencil size={14} /> Editar eras
          </button>
        )}
      </header>
      <div className="lore-era-window">
        <div className="lore-era-track">
          <div className="lore-era-thread" aria-hidden="true">
            <div className="lore-era-gears">
              {gears.map((g, i) => (
                <svg
                  key={i}
                  viewBox="0 0 40 40"
                  className="lore-time-gear"
                  data-powered={g.active}
                  style={{
                    left: `${g.position * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${g.angle}deg)`,
                  }}
                >
                  <path d="M16 2h8l1 5 4 2 5-2 4 7-4 3v6l4 3-4 7-5-2-4 2-1 5h-8l-1-5-4-2-5 2-4-7 4-3v-6l-4-3 4-7 5 2 4-2z" />
                  <circle cx="20" cy="20" r="10" />
                  <circle cx="20" cy="20" r="3" />
                  <path className="gear-spokes" d="M20 10v7m0 6v7m-10-10h7m6 0h7" />
                </svg>
              ))}
            </div>
            <span
              key={beam.token}
              className="lore-era-light"
              style={
                {
                  '--light-start': Math.min(beam.origin, beam.tip),
                  '--light-length': Math.abs(beam.tip - beam.origin),
                  '--light-duration': `${beam.duration}ms`,
                } as CSSProperties
              }
            />
          </div>
          {document.eras.map((item, index) => (
            <button
              key={item.id}
              className="lore-era"
              data-era-id={item.id}
              data-revealed={item.revealed}
              data-seated={(phase === 'arriving' || phase === 'idle') && item.id === era.id}
              aria-pressed={item.id === era.id}
              onClick={() => {
                void travel(item.id).then((arrived) => {
                  if (arrived) {
                    const folder = folders.find((folder) => item.folder_ids.includes(folder.id));
                    if (folder) onFolder(folder.id);
                  }
                });
              }}
            >
              <span className="lore-era-year">{item.year}</span>
              <span className="lore-era-medallion" aria-hidden="true">
                {item.revealed ? (
                  <Hourglass size={25} strokeWidth={1} />
                ) : (
                  <LockKeyhole size={21} strokeWidth={1} />
                )}
                <i />
              </span>
              <small>ERA {String(index + 1).padStart(2, '0')}</small>
              <strong>{item.revealed ? item.title || 'Era revelada' : 'Desconhecida'}</strong>
              <span className="lore-era-footnote">
                {item.revealed ? 'Registro preservado' : 'Sob o véu do tempo'}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        className="lore-era-record"
        key={`${era.id}-${arrival}`}
        data-arriving={phase === 'arriving'}
        aria-live="polite"
      >
        <span className="lore-era-arrival" aria-hidden="true">
          <Sparkles size={19} strokeWidth={1} />
        </span>
        <div>
          <span className="lore-kicker">
            {phase === 'travelling' ? 'ATRAVESSANDO OS VESTÍGIOS…' : era.year}
          </span>
          <h3>{era.revealed ? era.title || 'Era revelada' : 'Uma era sem registros'}</h3>
          <p>
            {era.revealed ? era.description : 'O que aconteceu neste tempo ainda é um mistério.'}
          </p>
          {linked.length > 0 && (
            <div className="lore-era-folders">
              {linked.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() =>
                    void travel(era.id).then((arrived) => {
                      if (arrived) onFolder(folder.id);
                    })
                  }
                >
                  {loreFolderPath(folder.id, folders)} <span>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {edit && (
        <TimelineEditor
          timeline={timeline}
          folders={folders}
          regions={regions}
          onClose={() => setEdit(false)}
          onSaved={(value) => {
            setTimeline(value);
            setEdit(false);
            if (!value.document.eras.some((era) => era.id === active.current)) {
              active.current = value.document.eras.at(-1)!.id;
              setSelected(active.current);
            }
          }}
        />
      )}
    </section>
  );
});

function TimelineEditor({
  timeline,
  folders,
  regions,
  onClose,
  onSaved,
}: Omit<Props, 'onFolder'> & {
  timeline: LoreTimelineResponse;
  onClose: () => void;
  onSaved: (value: LoreTimelineResponse) => void;
}) {
  const [draft, setDraft] = useState<LoreTimelineDocument>(() => ({
    ...structuredClone(timeline.document),
    eras: timeline.document.eras.map((era) => ({
      ...era,
      folder_ids: era.folder_ids.filter((id) => folders.some((folder) => folder.id === id)),
    })),
  }));
  const [current, setCurrent] = useState(draft.eras.at(-1)!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const era = draft.eras.find((item) => item.id === current) || draft.eras[0];
  const update = (patch: Partial<LoreEra>) =>
    setDraft((value) => ({
      ...value,
      eras: value.eras.map((item) => (item.id === era.id ? { ...item, ...patch } : item)),
    }));
  function move(offset: number) {
    const eras = [...draft.eras],
      index = eras.findIndex((item) => item.id === era.id),
      next = index + offset;
    if (next < 0 || next >= eras.length) return;
    [eras[index], eras[next]] = [eras[next], eras[index]];
    setDraft({ ...draft, eras });
  }
  return (
    <Modal title="Editar linha do tempo" close={onClose}>
      <form
        className="lore-era-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          void api<LoreTimelineResponse>('/lore-timeline', {
            method: 'PUT',
            body: JSON.stringify({ revision: timeline.revision, document: draft }),
          })
            .then(onSaved)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {error && <p role="alert">{error}</p>}
        <label>
          Título da linha do tempo
          <input
            value={draft.title}
            maxLength={120}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Opcional"
          />
        </label>
        <div className="lore-era-editor-tabs">
          {draft.eras.map((item, index) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === era.id}
              onClick={() => setCurrent(item.id)}
            >
              {index + 1}. {item.year}
            </button>
          ))}
          <button
            type="button"
            disabled={draft.eras.length >= 24}
            onClick={() => {
              const id = crypto.randomUUID();
              setDraft({
                ...draft,
                eras: [
                  ...draft.eras,
                  {
                    id,
                    year: 'Nova era',
                    title: '',
                    description: '',
                    revealed: false,
                    folder_ids: [],
                  },
                ],
              });
              setCurrent(id);
            }}
          >
            <Plus size={14} /> Adicionar era
          </button>
        </div>
        <div className="lore-era-editor-order">
          <button type="button" onClick={() => move(-1)} disabled={draft.eras[0].id === era.id}>
            <ArrowUp size={14} /> Mais antiga
          </button>
          <button type="button" onClick={() => move(1)} disabled={draft.eras.at(-1)!.id === era.id}>
            <ArrowDown size={14} /> Mais recente
          </button>
          <button
            type="button"
            disabled={draft.eras.length <= 1}
            onClick={() => {
              const eras = draft.eras.filter((item) => item.id !== era.id);
              setDraft({ ...draft, eras });
              setCurrent(eras.at(-1)!.id);
            }}
          >
            <Trash2 size={14} /> Excluir era
          </button>
        </div>
        <label>
          Ano ou período
          <input
            required
            maxLength={60}
            value={era.year}
            onChange={(event) => update({ year: event.target.value })}
          />
        </label>
        <label>
          Título da era
          <input
            maxLength={120}
            value={era.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>
        <label>
          Descrição
          <textarea
            rows={4}
            maxLength={1600}
            value={era.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </label>
        <label className="lore-era-checkbox">
          <input
            type="checkbox"
            checked={era.revealed}
            onChange={(event) => update({ revealed: event.target.checked })}
          />{' '}
          Revelar esta era aos leitores
        </label>
        <fieldset disabled={busy}>
          <legend>Pastas vinculadas à era</legend>
          <p>
            Subpastas também acompanham a era da pasta principal. Cada pasta pode ser vinculada a
            uma era.
          </p>
          <div className="lore-era-folder-options">
            {folders.map((folder) => {
              const other = draft.eras.find(
                (item) => item.id !== era.id && item.folder_ids.includes(folder.id),
              );
              return (
                <label key={folder.id} className="lore-era-checkbox">
                  <input
                    type="checkbox"
                    checked={era.folder_ids.includes(folder.id)}
                    disabled={Boolean(other)}
                    onChange={(event) =>
                      update({
                        folder_ids: event.target.checked
                          ? [...era.folder_ids, folder.id]
                          : era.folder_ids.filter((id) => id !== folder.id),
                      })
                    }
                  />
                  <span>
                    {regions.find((item) => item.id === folder.region_id)?.name} ·{' '}
                    {loreFolderPath(folder.id, folders)}
                    {other && <small>Vinculada a {other.year}</small>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            <Save size={15} /> {busy ? 'Salvando…' : 'Salvar eras'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
