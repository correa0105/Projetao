import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { ItemPicker } from './ItemPicker';
import { rpDecor, type RpSceneItem, type RpState } from '../shared/rp-lobby';
import { houseItemImage, houseDefaultScale, houseDefaultFacing } from '../shared/house';
import { rpFloorScale, rpDragPosition } from '../shared/rp-perspective';
type Source = { id: string; kind: 'pet' | 'mount'; name: string; image: string };
export function RpPersonalScene({
  room,
  characterId,
  userId,
  stage,
  refresh,
  notice,
}: {
  room: RpState | null;
  characterId: string;
  userId: string;
  stage: RefObject<HTMLDivElement | null>;
  refresh: () => Promise<void>;
  notice: (s: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [sources, setSources] = useState<Source[]>([]),
    [items, setItems] = useState<RpSceneItem[]>([]),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false);
  const moving = useRef(false),
    current = useRef(items);
  current.current = items;
  const drag = useRef<{ id: string; pointer: number; grab: { x: number; y: number } } | null>(null);
  const own = room?.presence.find((p) => p.user_id === userId && p.character_id === characterId),
    chosen = items.find((i) => i.id === selected);
  useEffect(() => {
    if (!moving.current) setItems(own?.scene_items || []);
  }, [own?.scene_items, characterId, room?.id]);
  useEffect(() => {
    if (!characterId) return;
    let stop = false;
    void api<{ sources: Source[] }>('/rp-lobby/companion-library?character_id=' + characterId)
      .then((r) => {
        if (!stop) setSources(r.sources);
      })
      .catch((e) => notice(e.message));
    return () => {
      stop = true;
    };
  }, [characterId]);
  async function save(next = items) {
    if (!room || !own) return;
    moving.current = true;
    setBusy(true);
    try {
      const clean = next.map(({ image, name, ...i }) => i);
      await api('/rp-lobby/' + room.id + '/scene-items', {
        method: 'PUT',
        body: JSON.stringify({ character_id: characterId, items: clean }),
      });
      await refresh();
      notice('Itens e acompanhantes salvos no lobby.');
    } catch (e) {
      notice((e as Error).message);
      setItems(own.scene_items || []);
    } finally {
      moving.current = false;
      setBusy(false);
    }
  }
  function add(kind: 'prop' | 'pet' | 'mount', id: string, x = 0.5, y = 0.84) {
    if (busy || !own || !room) return;
    if (
      kind === 'prop' &&
      (room.kind === 'fixed' || !room.is_owner) &&
      items.filter((i) => i.kind === 'prop').length >= 4
    ) {
      notice('Você já colocou os 4 itens permitidos. Retire uma peça para trocar.');
      return;
    }
    if (kind !== 'prop' && items.some((i) => i.wardrobe_id === id)) return;
    const source = sources.find((s) => s.id === id),
      catalog = kind === 'prop' ? id : rpDecor[0].id;
    const next: RpSceneItem = {
      id: crypto.randomUUID(),
      kind,
      catalog,
      x,
      y,
      scale:
        kind === 'mount' ? 0.22 : kind === 'pet' ? 0.1 : Math.min(0.5, houseDefaultScale(catalog)),
      rotation: 0,
      layer: 4,
      facing: houseDefaultFacing(catalog),
      ...(kind === 'prop' ? {} : { wardrobe_id: id, name: source?.name, image: source?.image }),
    };
    const list = [...items, next];
    setItems(list);
    setSelected(next.id);
    void save(list);
  }
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/x-rp-companion')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const id = e.dataTransfer?.getData('application/x-rp-companion'),
        s = sources.find((s) => s.id === id);
      if (!s) return;
      e.preventDefault();
      const b = node.getBoundingClientRect();
      add(
        s.kind,
        s.id,
        Math.max(0.03, Math.min(0.97, (e.clientX - b.left) / b.width)),
        Math.max(0.4, Math.min(0.98, (e.clientY - b.top) / b.height)),
      );
    };
    node.addEventListener('dragover', over);
    node.addEventListener('drop', drop);
    return () => {
      node.removeEventListener('dragover', over);
      node.removeEventListener('drop', drop);
    };
  }, [sources, items, own, busy]);
  const all =
    room?.presence.flatMap((p) =>
      (p.user_id === userId ? items : p.scene_items || []).map((i) => ({
        ...i,
        controller: p.user_id,
      })),
    ) || [];
  return (
    <>
      <div className="rp-personal-tools">
        <button onClick={() => setOpen(!open)}>Meus itens, pets e montarias</button>
        {open && (
          <aside className="rp-personal-panel" aria-label="Meus itens e acompanhantes">
            <button onClick={() => setOpen(false)}>Fechar</button>
            <p>
              {room?.kind === 'temporary' && room.is_owner
                ? 'Sala privada: mobília sem limite.'
                : 'Até 4 itens por jogador. Pets e montarias não contam nesse limite.'}
            </p>
            {!own ? (
              <p>Entre na sala com seu personagem.</p>
            ) : (
              <>
                <ItemPicker
                  disabled={busy}
                  items={rpDecor.map((i) => ({
                    id: i.id,
                    name: i.name,
                    image: houseItemImage(i.id, houseDefaultFacing(i.id)),
                  }))}
                  onPick={(id) => add('prop', id)}
                />
                <h3>Pets e montarias</h3>
                {sources.map((s) => (
                  <div
                    className="rp-companion-source"
                    draggable={!busy}
                    key={s.id}
                    onDragStart={(e) => e.dataTransfer.setData('application/x-rp-companion', s.id)}
                  >
                    <img src={s.image} alt="" />
                    <span>{s.name}</span>
                    <button
                      disabled={busy || items.some((i) => i.wardrobe_id === s.id)}
                      onClick={() => add(s.kind, s.id)}
                    >
                      Trazer
                    </button>
                  </div>
                ))}
                {!sources.length && <p>Este personagem ainda não tem pets ou montarias.</p>}
                <h3>Na cena</h3>
                {items.map((i) => (
                  <button key={i.id} onClick={() => setSelected(i.id)}>
                    {i.kind === 'prop'
                      ? rpDecor.find((s) => s.id === i.catalog)?.name
                      : i.name || sources.find((s) => s.id === i.wardrobe_id)?.name}
                  </button>
                ))}
                {chosen && (
                  <fieldset>
                    <legend>Editar peça selecionada</legend>
                    <label>
                      Tamanho
                      <input
                        type="range"
                        min=".04"
                        max=".5"
                        step=".01"
                        value={chosen.scale}
                        onChange={(e) =>
                          setItems((old) =>
                            old.map((i) =>
                              i.id === chosen.id ? { ...i, scale: Number(e.target.value) } : i,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Camada
                      <select
                        aria-label="Camada da peça pessoal"
                        value={chosen.layer}
                        onChange={(e) =>
                          setItems((old) =>
                            old.map((i) =>
                              i.id === chosen.id ? { ...i, layer: Number(e.target.value) } : i,
                            ),
                          )
                        }
                      >
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            Camada {n}
                            {n === 1 ? ' · frente' : n === 6 ? ' · fundo' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={busy} onClick={() => void save()}>
                      Salvar ajuste
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const list = items.filter((i) => i.id !== chosen.id);
                        setItems(list);
                        setSelected('');
                        void save(list);
                      }}
                    >
                      Retirar da cena
                    </button>
                  </fieldset>
                )}
              </>
            )}
          </aside>
        )}
      </div>
      {stage.current &&
        createPortal(
          all.map((i) => (
            <button
              key={i.controller + ':' + i.id}
              data-rp-personal-item={i.id}
              data-rp-companion={i.kind === 'prop' ? undefined : i.wardrobe_id}
              className={'rp-prop rp-personal-piece' + (selected === i.id ? ' selected' : '')}
              aria-label={i.name || rpDecor.find((s) => s.id === i.catalog)?.name || 'Peça de RP'}
              style={{
                left: i.x * 100 + '%',
                top: i.y * 100 + '%',
                width: i.scale * rpFloorScale(i.y, room?.document.scene) * 100 + '%',
                zIndex: (7 - i.layer) * 100 + Math.round(i.y * 90),
              }}
              onClick={() => {
                if (i.controller === userId) {
                  setSelected(i.id);
                  setOpen(true);
                }
              }}
              onPointerDown={(e) => {
                if (i.controller !== userId || busy) return;
                e.preventDefault();
                e.stopPropagation();
                const b = stage.current!.getBoundingClientRect(),
                  factor = rpFloorScale(i.y, room?.document.scene);
                drag.current = {
                  id: i.id,
                  pointer: e.pointerId,
                  grab: {
                    x: (e.clientX - b.left - i.x * b.width) / factor,
                    y: (e.clientY - b.top - i.y * b.height) / factor,
                  },
                };
                moving.current = true;
                setSelected(i.id);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== i.id || d.pointer !== e.pointerId) return;
                e.stopPropagation();
                const b = stage.current!.getBoundingClientRect(),
                  next = rpDragPosition(
                    { x: e.clientX - b.left, y: e.clientY - b.top },
                    d.grab,
                    b,
                    i.y,
                    room?.document.scene,
                  );
                setItems((old) => old.map((t) => (t.id === i.id ? { ...t, ...next } : t)));
              }}
              onPointerUp={(e) => {
                if (drag.current?.id !== i.id) return;
                drag.current = null;
                e.currentTarget.releasePointerCapture(e.pointerId);
                void save(current.current);
              }}
              onPointerCancel={() => {
                drag.current = null;
                moving.current = false;
                setItems(own?.scene_items || []);
              }}
            >
              <img
                src={i.kind === 'prop' ? houseItemImage(i.catalog, i.facing) : i.image}
                alt=""
                draggable={false}
                style={{ transform: 'rotate(' + i.rotation + 'deg)' }}
              />
            </button>
          )),
          stage.current,
        )}
    </>
  );
}
