import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { RpState } from '../shared/rp-lobby';
type Speech = { id: string; body: string; characterId: string; expires: number };
export function RpSpeechBubbles({
  room,
  stage,
  movement,
}: {
  room: RpState | null;
  stage: RefObject<HTMLDivElement | null>;
  movement: unknown;
}) {
  const seen = useRef<{ room: string; ids: Set<string> }>({ room: '', ids: new Set() });
  const [speeches, setSpeeches] = useState<Record<string, Speech>>({});
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number; width: number; tail: number; scale: number }>
  >({});
  useEffect(() => {
    if (!room || seen.current.room !== room.id) {
      seen.current = { room: room?.id || '', ids: new Set(room?.messages.map((m) => m.id)) };
      setSpeeches({});
      return;
    }
    const incoming = room.messages.filter((m) => !seen.current.ids.has(m.id));
    seen.current.ids = new Set(room.messages.map((m) => m.id));
    if (incoming.length)
      setSpeeches((previous) => {
        const next = { ...previous };
        for (const message of incoming)
          next[message.user_id] = {
            id: message.id,
            body: message.body,
            characterId: message.character_id,
            expires: Date.now() + 5000,
          };
        return next;
      });
  }, [room?.id, room?.messages]);
  useEffect(() => {
    const deadlines = Object.values(speeches).map((s) => s.expires);
    if (!deadlines.length) return;
    const timer = setTimeout(
      () =>
        setSpeeches((previous) =>
          Object.fromEntries(Object.entries(previous).filter(([, s]) => s.expires > Date.now())),
        ),
      Math.max(0, Math.min(...deadlines) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [speeches]);
  useLayoutEffect(() => {
    const scene = stage.current,
      viewport = scene?.parentElement;
    if (!scene || !viewport) return;
    const update = () => {
      const bounds = scene.getBoundingClientRect(),
        visible = viewport.getBoundingClientRect(),
        width = Math.min(260, viewport.clientWidth - 24),
        next: typeof positions = {};
      for (const actor of scene.querySelectorAll<HTMLElement>('[data-rp-actor]')) {
        const image = actor.querySelector('img');
        if (!image) continue;
        const rect = image.getBoundingClientRect(),
          center = rect.left - bounds.left + rect.width / 2;
        if (rect.right < visible.left || rect.left > visible.right) continue;
        const scale = Math.max(0.3, Math.min(1.15, Number(actor.dataset.depthScale) || 1));
        const visualWidth = width * scale;
        const left = visible.left - bounds.left + visualWidth / 2 + 12,
          right = visible.right - bounds.left - visualWidth / 2 - 12;
        const x = Math.max(left, Math.min(right, center));
        next[actor.dataset.rpActor!] = {
          x,
          y: Math.max(140, Math.min(scene.clientHeight - 16, rect.top - bounds.top - 12)),
          width,
          scale,
          tail: Math.max(16, Math.min(width - 16, (center - x) / scale + width / 2)),
        };
      }
      setPositions(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(scene);
    for (const image of scene.querySelectorAll('.rp-actor img')) observer.observe(image);
    viewport.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', update);
      removeEventListener('resize', update);
    };
  }, [room?.presence, movement]);
  return (
    <div className="rp-speech-bubbles" aria-label="Falas dos personagens">
      {room?.presence.map((p) => {
        const speech = speeches[p.user_id],
          position = positions[p.user_id];
        if (!speech || speech.characterId !== p.character_id || !position) return null;
        return (
          <div
            key={speech.id}
            className="rp-speech-bubble"
            data-speaker={p.user_id}
            title={`${p.name}: ${speech.body}`}
            style={
              {
                left: position.x,
                top: position.y,
                width: position.width,
                transform: `translate(-50%, -100%) scale(${position.scale})`,
                transformOrigin: 'bottom center',
                '--speech-tail': position.tail + 'px',
              } as CSSProperties
            }
          >
            <strong>{p.name}</strong>
            <p>{speech.body}</p>
          </div>
        );
      })}
    </div>
  );
}
