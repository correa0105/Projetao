import { FlashMessage } from './FlashMessage';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Coins, Check, Footprints } from 'lucide-react';
import { mounts, mountNameComment, mountCoats } from '../shared/mounts';
import { stableGear, stableGearComments } from '../shared/stable-gear';
import type { Character } from './types';
import { post } from './api';
import { money } from '../shared/rules';
import { Modal } from './components';
import { GinnaBalloon } from './GinnaBalloon';
import { useMusicInterlude } from './SiteMusic';
import {
  ginnaGreeting,
  ginnaFarewell,
  ginnaMountLines,
  ginnaQuestions,
  ginnaExcuses,
  ginnaWarnings,
  type GinnaTopic,
} from './stable-ginna';
import './stable.css';

// Load the 3D compositor only when the visitor enters Ginna's vision.
const GinnaVision = lazy(() =>
  import('./GinnaVision').then((module) => ({ default: module.GinnaVision })),
);
const GinnaReturn = lazy(() =>
  import('./GinnaReturn').then((module) => ({ default: module.GinnaReturn })),
);

type Hoof = { x: number; y: number; width: number };
const hoofCache = new Map<string, Hoof[]>();
function MountArt({ image, name }: { image: string; name: string }) {
  const [hooves, setHooves] = useState<Hoof[]>([]);
  const measure = (img: HTMLImageElement) => {
    const cached = hoofCache.get(image);
    if (cached) {
      setHooves(cached);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = Math.round((canvas.width * img.naturalHeight) / img.naturalWidth);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const bottoms = Array.from({ length: canvas.width }, (_, x) => {
      for (let y = canvas.height - 1; y > canvas.height * 0.7; y--)
        if (data[(y * canvas.width + x) * 4 + 3] > 190) return y;
      return 0;
    });
    const ground = Math.max(...bottoms);
    const contacts: Hoof[] = [];
    let start = -1;
    for (let x = 0; x <= bottoms.length; x++) {
      const touches = x < bottoms.length && bottoms[x] >= ground - canvas.height * 0.055;
      if (touches && start < 0) start = x;
      if (!touches && start >= 0) {
        if (x - start >= 3)
          contacts.push({
            x: ((start + x) / 2 / canvas.width) * 100,
            y: (Math.max(...bottoms.slice(start, x)) / canvas.height) * 100,
            width: Math.max(3.5, ((x - start) / canvas.width) * 100),
          });
        start = -1;
      }
    }
    hoofCache.set(image, contacts);
    setHooves(contacts);
  };
  return (
    <div className="stable-animal-art">
      <img className="stable-cast-shadow" src={image} alt="" aria-hidden="true" />
      {hooves.map((hoof, i) => (
        <span
          key={i}
          className="stable-hoof-contact"
          aria-hidden="true"
          style={{ left: `${hoof.x}%`, top: `${hoof.y}%`, width: `${hoof.width * 1.15}%` }}
        />
      ))}
      <img
        className="stable-animal-base"
        src={image}
        alt={`${name} de corpo inteiro no campo`}
        onLoad={(event) => measure(event.currentTarget)}
      />
    </div>
  );
}

export function Stable({
  character,
  onPurchased,
}: {
  character?: Character;
  onPurchased: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>(mounts[0].id);
  const mount = mounts.find((m) => m.id === selected)!;
  const [name, setName] = useState('');
  const [speech, setSpeech] = useState(ginnaGreeting);
  const [greetingVisible, setGreetingVisible] = useState(true);
  const [talk, setTalk] = useState<'questions' | 'warning' | null>(null);
  const [known, setKnown] = useState(false);
  const [vision, setVision] = useState(false);
  useEffect(() => {
    if (vision) void import('./GinnaReturn');
  }, [vision]);
  const [returning, setReturning] = useState(false);
  const breathing = useRef<HTMLAudioElement>(null);
  const { muted, volume } = useMusicInterlude();
  const warnings = useRef(0);
  const keeperTrigger = useRef<HTMLButtonElement>(null);
  const mountVisits = useRef<Record<string, number>>({});
  useEffect(() => {
    const portrait = new Image();
    portrait.src = '/stable/ginna-serious.webp';
    const timer = window.setTimeout(() => setGreetingVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);
  function askGinna(next: GinnaTopic) {
    if (next === 'identity') setKnown(true);
    if (next !== 'warning') {
      setTalk(null);
      setSpeech(ginnaQuestions.find((question) => question.id === next)!.answer);
      window.requestAnimationFrame(() => keeperTrigger.current?.focus({ preventScroll: true }));
      return;
    }
    if (warnings.current >= 5) return;
    warnings.current += 1;
    if (warnings.current === 5) {
      setTalk(null);
      setVision(true);
      return;
    }
    setSpeech(ginnaWarnings[warnings.current - 1]);
    setTalk('warning');
  }
  function closeConversation() {
    setTalk(null);
    window.requestAnimationFrame(() => keeperTrigger.current?.focus({ preventScroll: true }));
  }
  const finishVision = useCallback(() => {
    const player = breathing.current;
    if (player) {
      player.currentTime = 0;
      void player.play().catch(() => {});
    }
    setVision(false);
    setSpeech(ginnaFarewell);
    warnings.current = 0;
  }, []);
  const finishReturn = useCallback(() => {
    setReturning(false);
    window.requestAnimationFrame(() => keeperTrigger.current?.focus({ preventScroll: true }));
  }, []);
  function beginReturn() {
    if (returning) return;
    setReturning(true);
  }
  useEffect(() => {
    const player = breathing.current;
    if (player) {
      player.muted = muted;
      player.volume = Math.min(1, volume * 1.25);
    }
  }, [muted, volume]);
  useEffect(() => {
    const player = breathing.current;
    const pauseWhenHidden = () => {
      if (document.hidden) player?.pause();
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      player?.pause();
    };
  }, []);
  useEffect(() => {
    for (const path of [
      '/stable/ginna-shadow.webp',
      '/stable/paddock-ruined-eye-mountain.webp',
      '/stable/ginna-raised-eyes.webp',
    ]) {
      const image = new Image();
      image.src = path;
    }
  }, []);
  const [details, setDetails] = useState(false);
  const [coat, setCoat] = useState('original');
  const coats = mountCoats[mount.id];
  const [equipment, setEquipment] = useState<string[]>([]);
  const saddle = equipment.find((id) => id === 'saddle-riding' || id === 'saddle-military');
  const armor = equipment.find((id) => id.startsWith('barding-'));
  const saddleImage = saddle
    ? `/stable/saddled/${mount.id}-${coat}-${saddle.replace('saddle-', '')}.png`
    : '';
  const image = armor
    ? `/stable/barded/${mount.id}-${coat}-${armor.replace('barding-', '')}.png`
    : saddleImage || `/stable/${mount.id}${coat === 'alternate' ? '-alternate' : ''}.png`;
  const chosenGear = stableGear.filter((g) => equipment.includes(g.id));
  const total = mount.price_cp + chosenGear.reduce((sum, g) => sum + g.price_cp, 0);
  function toggleGear(id: string) {
    setTalk(null);
    const item = stableGear.find((g) => g.id === id)!;
    setEquipment((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [
            ...current.filter((x) => {
              const slot = stableGear.find((g) => g.id === x)?.slot;
              return item.slot === 'feed' ? slot !== 'feed' : slot === 'feed';
            }),
            id,
          ].sort(),
    );
    setSpeech(
      equipment.includes(id)
        ? 'Sem esse, então. O cavalo agradece o peso a menos; eu vou guardar de volta.'
        : stableGearComments[item.id],
    );
  }
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    if (!name.trim()) return;
    const timer = window.setTimeout(() => setSpeech(mountNameComment(name)), 650);
    return () => window.clearTimeout(timer);
  }, [name]);
  async function buy() {
    if (!character || busy) return;
    const finalName = name.trim() || mount.name;
    const fingerprint = `${character.id}:${mount.id}:${coat}:${finalName}:${equipment.join(',')}`;
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      await post('/stable/purchase', {
        character_id: character.id,
        mount_id: mount.id,
        coat,
        equipment,
        name: finalName,
        idempotency_key: request.current.key,
      });
      setSpeech(
        `Cuide bem de ${finalName}! ${mountNameComment(finalName)} Boa viagem — e mande notícias, de preferência sem um dragão atrás.`,
      );
      setNotice(`${finalName} agora pertence a ${character.name}.`);
      setConfirm(false);
      setDetails(false);
      request.current = null;
      try {
        await onPurchased();
      } catch {
        setNotice(`${finalName} foi comprado. Recarregue a página para atualizar o saldo.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stable-page" aria-label="Estábulo" data-ginna-vision={vision || undefined}>
      <div className="stable-background" aria-hidden="true" />
      <header className="stable-selected-title">
        <h2>{mount.name}</h2>
      </header>

      <div className="stable-layout">
        <div className="stable-sidebar">
          <div className="stable-name stable-panel">
            <label htmlFor="mount-name">Como vai se chamar?</label>
            <input
              id="mount-name"
              form="stable-checkout"
              value={name}
              maxLength={40}
              pattern="[\p{L}\p{M}\p{N} '\-]+"
              placeholder="Dê um nome à sua montaria"
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <aside className="stable-choices stable-panel" aria-label="Montarias disponíveis">
            <h2>Companheiros de estrada</h2>
            <p>Escolha quem seguirá ao seu lado.</p>
            <div className="stable-portraits">
              {mounts.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={m.id === selected}
                  aria-label={`Ver ${m.name}`}
                  disabled={busy}
                  onClick={() => {
                    setTalk(null);
                    setSelected(m.id);
                    setCoat('original');
                    const lines = ginnaMountLines[m.id];
                    const visit = mountVisits.current[m.id] || 0;
                    setSpeech(lines[visit % lines.length]);
                    mountVisits.current[m.id] = visit + 1;
                    setNotice('');
                    setError('');
                  }}
                >
                  <span
                    className="stable-head"
                    style={{ '--head-position': m.head } as CSSProperties}
                  >
                    <img src={`/stable/${m.id}.png`} alt="" />
                  </span>
                  <span>{m.name}</span>
                  <small>{money(m.price_cp)} PO</small>
                </button>
              ))}
            </div>
            <div className="stable-selection-tools">
              <fieldset className="stable-coats">
                <legend>Pelagem</legend>
                {coats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={coat === c.id}
                    onClick={() => setCoat(c.id)}
                  >
                    <i style={{ background: c.color }} />
                    {c.label}
                  </button>
                ))}
              </fieldset>
            </div>
          </aside>
          <section
            className="stable-tack-shop stable-panel"
            aria-label="Loja de equipamentos de montaria"
          >
            <h2>Selaria</h2>
            <p>Experimente no animal · clique novamente para retirar</p>
            <div className="stable-tack-items">
              {stableGear.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={equipment.includes(g.id)}
                  aria-label={`Experimentar ${g.name}`}
                  onClick={() => toggleGear(g.id)}
                  disabled={busy}
                >
                  <img src={`/stable/gear/${g.id}.png`} alt="" />
                  <span>
                    {g.name}
                    <small>
                      {money(g.price_cp)} PO · {g.weight} lb
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <form
            id="stable-checkout"
            className="stable-order"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setConfirm(true);
            }}
          >
            <div className="stable-price">
              <strong>{money(total)} PO</strong>
              <span>
                <Coins size={15} /> {money(character?.gold_cp || 0)} PO disponíveis
              </span>
            </div>
            <div className="stable-order-actions">
              <button
                type="button"
                className="button stable-view-details"
                aria-haspopup="dialog"
                onClick={() => setDetails(true)}
              >
                Ver detalhes
              </button>
              <button
                aria-label="Comprar conjunto"
                className="button primary"
                disabled={!character || busy || character.gold_cp < total}
              >
                <Footprints size={17} /> Comprar conjunto{' '}
                <span className="stable-mobile-total">· {money(total)} PO</span>
              </button>
            </div>
            {!character ? (
              <p>Selecione um personagem para comprar.</p>
            ) : (
              character.gold_cp < total && <p>Faltam {money(total - character.gold_cp)} PO.</p>
            )}
          </form>
        </div>
        <div className="stable-field" aria-label={`No campo: ${mount.name}`}>
          <div className="stable-animal" style={{ '--animal-scale': mount.scale } as CSSProperties}>
            <MountArt key={image} image={image} name={mount.name} />
          </div>
          {equipment.includes('feed') && (
            <img
              className="stable-feed"
              src="/stable/gear/feed.png"
              alt="Ração ao lado da montaria"
            />
          )}
          <div className="stable-keeper">
            <button
              ref={keeperTrigger}
              className="stable-keeper-trigger"
              type="button"
              aria-label={known ? 'Conversar com Ginna' : 'Conversar com a cuidadora'}
              aria-expanded={Boolean(talk)}
              onClick={() => {
                if (talk) {
                  closeConversation();
                  return;
                }
                setTalk('questions');
              }}
            >
              <img
                src={warnings.current >= 3 ? '/stable/ginna-serious.webp' : '/stable/ginna.webp'}
                alt={
                  warnings.current >= 3
                    ? 'Ginna séria, com expressão de impaciência'
                    : 'Jovem cuidadora dos animais, sem chapéu'
                }
              />
            </button>
          </div>
          {(talk || speech !== ginnaGreeting || greetingVisible) && (
            <GinnaBalloon
              speaker={known ? 'Ginna' : 'Cuidadora'}
              text={talk === 'questions' ? 'O que deseja saber?' : speech}
              textEffect={talk !== 'questions' && speech === ginnaWarnings[3] ? 'shake' : 'plain'}
              label={talk ? 'Perguntas à cuidadora' : undefined}
              close={closeConversation}
            >
              {talk === 'warning' ? (
                <button
                  type="button"
                  data-ginna-question="warning"
                  onClick={() => askGinna('warning')}
                >
                  {ginnaExcuses[warnings.current]}
                </button>
              ) : (
                talk === 'questions' &&
                ginnaQuestions.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    data-ginna-question={question.id}
                    onClick={() => askGinna(question.id)}
                  >
                    {question.id === 'warning' ? ginnaExcuses[warnings.current] : question.question}
                  </button>
                ))
              )}
            </GinnaBalloon>
          )}
        </div>
      </div>
      {vision && (
        <Suspense fallback={null}>
          <GinnaVision known={known} returning={returning} onFinished={beginReturn} />
        </Suspense>
      )}
      {returning && (
        <Suspense fallback={null}>
          <GinnaReturn onCovered={finishVision} onFinished={finishReturn} />
        </Suspense>
      )}
      <audio
        ref={breathing}
        src="/audio/ginna-panting.mp3"
        preload="auto"
        muted={muted}
        data-ginna-breathing
        aria-hidden="true"
      />
      {notice && (
        <FlashMessage kind="success">
          <Check size={16} />
          {notice}
        </FlashMessage>
      )}
      {details && !confirm && (
        <Modal title="Especificações da montaria" close={() => setDetails(false)}>
          <aside className="stable-details stable-panel" aria-label="Ficha da montaria">
            <span className="stable-kicker">BESTA · {mount.size.toUpperCase()}</span>
            <h3>{mount.name}</h3>
            <p>{mount.description}</p>
            {chosenGear.map((g) => (
              <section
                key={g.id}
                className="stable-saddle-description"
                aria-label={
                  g.slot === 'saddle'
                    ? 'Sela selecionada'
                    : g.slot === 'armor'
                      ? 'Barda selecionada'
                      : 'Ração selecionada'
                }
              >
                <h3>{g.name}</h3>
                <p>{g.description}</p>
                <p>
                  {money(g.price_cp)} PO · {g.weight} lb
                </p>
              </section>
            ))}
            <dl>
              {[
                ['Deslocamento', `${mount.speed} pés (${mount.speed * 0.3} m)`],
                ['Capacidade de carga', `${mount.capacity} lb`],
                ['Classe de armadura', mount.ac],
                ['Pontos de vida', mount.hp],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="stable-rule-note">
              Equipamentos selecionados são cobrados à parte no conjunto. A montaria precisa ser
              maior que o cavaleiro. Dados para consulta durante a sessão.
            </p>

            {error && !confirm && <FlashMessage>{error}</FlashMessage>}
            <a
              className="stable-source"
              href="https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf#page=100"
              target="_blank"
              rel="noreferrer"
            >
              Regras: SRD 5.2.1 · CC BY 4.0
            </a>
          </aside>
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Levar um novo companheiro"
          close={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>
            Comprar <strong>{name.trim() || mount.name}</strong> ({mount.name}) por{' '}
            <strong>{money(total)} PO</strong> para {character?.name}?
          </p>
          <ul>
            {chosenGear.map((g) => (
              <li key={g.id}>
                {g.name} — {money(g.price_cp)} PO
              </li>
            ))}
          </ul>
          <p>A montaria, a pelagem e os equipamentos ficarão salvos no seu personagem.</p>
          {error && <FlashMessage>{error}</FlashMessage>}
          <button className="button primary" disabled={busy} onClick={buy}>
            {busy ? 'Registrando…' : 'Confirmar compra'}
          </button>
        </Modal>
      )}
    </section>
  );
}
