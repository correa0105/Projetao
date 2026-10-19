import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
type Actor = {
  id: string;
  name: string;
  image: string;
  can_move: boolean;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};
type Source = Pick<Actor, 'id' | 'name' | 'image'>;
export function GuildEstateActors({
  guildId,
  characterId,
  member,
  svg,
  roof,
  focus,
  notice,
}: {
  guildId: string;
  characterId: string;
  member: boolean;
  svg: RefObject<SVGSVGElement | null>;
  roof: boolean;
  focus: () => void;
  notice: (s: string) => void;
}) {
  const [actors, setActors] = useState<Actor[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const drag = useRef<{ id: string; dx: number; dy: number; pointer: number } | null>(null),
    current = useRef(actors);
  current.current = actors;
  const url = '/guilds/' + guildId + '/estate/actors',
    query = '?character_id=' + encodeURIComponent(characterId);
  function point(x: number, y: number) {
    const p = svg.current!.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  }
  async function refresh() {
    const r = await api<{ actors: Actor[]; source: Source[] }>(url + query);
    if (!drag.current) {
      setActors(r.actors);
      setSources(r.source);
    }
  }
  useEffect(() => {
    if (!member || !characterId) return;
    let stop = false;
    const load = () => {
      if (!stop && !drag.current) void refresh().catch((e) => notice(e.message));
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [guildId, characterId, member]);
  async function save(a: Actor, present = true) {
    setBusy(true);
    try {
      await api(url + '/me' + query, {
        method: 'PATCH',
        body: JSON.stringify({ x: a.x, y: a.y, rotation: a.rotation, scale: a.scale, present }),
      });
      await refresh();
      notice(present ? 'Posição do personagem salva.' : 'Personagem retirado da sede.');
    } catch (e) {
      notice((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  function place(source: Source, x = 30, y = 33.7) {
    const a = {
      ...source,
      can_move: true,
      x: Math.max(7, Math.min(53, x)),
      y: Math.max(5, Math.min(45, y)),
      rotation: 0,
      scale: 1,
    };
    setActors((old) => [...old.filter((t) => t.id !== a.id), a]);
    focus();
    void save(a);
  }
  useEffect(() => {
    const node = svg.current;
    if (!node || !member) return;
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/x-guild-character')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const id = e.dataTransfer?.getData('application/x-guild-character'),
        source = sources.find((s) => s.id === id);
      if (!source || busy) return;
      e.preventDefault();
      const p = point(e.clientX, e.clientY);
      place(source, p.x, p.y);
    };
    node.addEventListener('dragover', over);
    node.addEventListener('drop', drop);
    return () => {
      node.removeEventListener('dragover', over);
      node.removeEventListener('drop', drop);
    };
  }, [sources, member, busy]);
  if (!member || !characterId) return null;
  return (
    <>
      <div className="guild-estate-actors-tools">
        <button type="button" onClick={() => setOpen(!open)}>
          Meu personagem
        </button>
        {open && (
          <div className="guild-estate-actors-panel">
            <p>Arraste seu personagem para a cena ou use Trazer. A posição é salva ao soltar.</p>
            {sources.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-guild-character', s.id)}
              >
                <img src={s.image} alt="" />
                <b>{s.name}</b>
                <button disabled={busy} onClick={() => place(s)}>
                  Trazer personagem
                </button>
                {actors.some((a) => a.id === s.id) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void save(
                        actors.find((a) => a.id === s.id)!,
                        false,
                      )
                    }
                  >
                    Retirar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {svg.current &&
        createPortal(
          <g data-estate-actors="members">
            {actors
              .filter((a) => !roof || a.x < 21 || a.x > 39 || a.y < 17 || a.y > 31)
              .map((a) => (
                <g
                  key={a.id}
                  data-estate-interactive="actor"
                  data-estate-actor={a.id}
                  role="button"
                  tabIndex={0}
                  aria-label={'Mover ' + a.name}
                  transform={`translate(${a.x} ${a.y})`}
                  style={{ cursor: a.can_move ? 'grab' : 'default', touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if (!a.can_move || busy) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const p = point(e.clientX, e.clientY);
                    drag.current = { id: a.id, dx: p.x - a.x, dy: p.y - a.y, pointer: e.pointerId };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.id !== a.id || d.pointer !== e.pointerId) return;
                    e.stopPropagation();
                    const p = point(e.clientX, e.clientY);
                    setActors((old) =>
                      old.map((t) =>
                        t.id === a.id
                          ? {
                              ...t,
                              x: Math.max(7, Math.min(53, p.x - d.dx)),
                              y: Math.max(5, Math.min(45, p.y - d.dy)),
                            }
                          : t,
                      ),
                    );
                  }}
                  onPointerUp={(e) => {
                    if (drag.current?.id !== a.id) return;
                    e.stopPropagation();
                    drag.current = null;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    void save(current.current.find((t) => t.id === a.id)!);
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                    void refresh();
                  }}
                  onKeyDown={(e) => {
                    if (!a.can_move || busy) return;
                    const steps: Record<string, number[]> = {
                      ArrowLeft: [-0.25, 0],
                      ArrowRight: [0.25, 0],
                      ArrowUp: [0, -0.25],
                      ArrowDown: [0, 0.25],
                    };
                    if (steps[e.key]) {
                      e.preventDefault();
                      const [x, y] = steps[e.key];
                      void save({
                        ...a,
                        x: Math.max(7, Math.min(53, a.x + x)),
                        y: Math.max(5, Math.min(45, a.y + y)),
                      });
                    }
                  }}
                >
                  <ellipse
                    cy={a.scale * 0.65}
                    rx={a.scale * 0.65}
                    ry={a.scale * 0.25}
                    fill="#121510"
                    opacity=".4"
                  />
                  <image
                    href={a.image}
                    x={-a.scale}
                    y={-a.scale}
                    width={a.scale * 2}
                    height={a.scale * 2}
                    transform={`rotate(${a.rotation})`}
                    preserveAspectRatio="xMidYMid meet"
                  />
                  <text y={a.scale + 0.35} textAnchor="middle" className="guild-estate-item-level">
                    {a.name}
                  </text>
                </g>
              ))}
          </g>,
          svg.current,
        )}
    </>
  );
}
