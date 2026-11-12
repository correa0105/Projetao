import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { crystalMerchantArt, crystalShopArt } from './page-assets';
import { SpecialShop } from './SpecialEconomy';
import type { Character } from './types';
import './crystal-shop.css';
import { robotBounds, robotOutline, sceneHeight, sceneWidth } from './RelicShop';

const merchant = 'Robô de bronze';
const greeting =
  'Bem-vindo, viajante. Pode deixar os cristais no balcão. Conto cada um com muito cuidado. Minhas engrenagens ajudam.';
const topics = [
  {
    question: 'Como ganho cristais?',
    answer:
      'Volte de uma expedição e resgate as recompensas na Torre. Os cristais ficam na carteira do personagem que os recebeu.',
  },
  {
    question: 'Onde uso os itens?',
    answer:
      'Use os itens nas mesas oficiais de expedições ativas da Torre em que seu personagem participa. Suas compras aparecem em Itens do personagem.',
  },
  {
    question: 'Posso usar cristais na guilda?',
    answer:
      'A guilda evolui com ouro e tags de monstros. Guarde seus cristais para as ofertas e expedições da Torre.',
  },
  {
    question: 'Quem é você?',
    answer: 'Cuido das relíquias e confiro cada cristal. Pode confiar na contagem. Tenho mais prática com números do que com dobradiças.',
  },
] as const;

function CrystalMerchant() {
  const [view, setView] = useState<'greeting' | 'closed' | 'talk'>('greeting');
  const [topic, setTopic] = useState<(typeof topics)[number] | null>(null);
  const host = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const topicsId = useId();
  const clipId = useId();
  const talking = view === 'talk';

  function closeConversation() {
    setView('closed');
    setTopic(null);
  }

  function closeAndFocus() {
    closeConversation();
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setView((current) => (current === 'greeting' ? 'closed' : current));
    }, 8500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!talking) return;
    function closeOutside(event: PointerEvent) {
      if (!host.current?.contains(event.target as Node)) closeConversation();
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [talking]);

  return (
    <aside
      ref={host}
      className="crystal-vendor"
      aria-label={merchant}
      onKeyDown={(event) => {
        if (talking && event.key === 'Escape') {
          event.stopPropagation();
          closeAndFocus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="crystal-vendor-figure"
        data-greeting={view === 'greeting' || undefined}
        aria-label={`Conversar com o ${merchant}`}
        title={`Conversar com o ${merchant}`}
        aria-expanded={talking}
        aria-controls={topicsId}
        onClick={() => (talking ? closeAndFocus() : setView('talk'))}
      >
        <svg viewBox={`${robotBounds.x} ${robotBounds.y} ${robotBounds.width} ${robotBounds.height}`} aria-hidden="true">
          <defs><clipPath id={clipId}><path d={robotOutline} fillRule="evenodd" clipRule="evenodd" /></clipPath></defs>
          <image href={crystalMerchantArt} width={sceneWidth} height={sceneHeight} clipPath={`url(#${clipId})`} />
        </svg>
      </button>
      <div className="relic-vendor-speech crystal-vendor-speech" hidden={view === 'closed'}>
        <header>
          <strong>{merchant}</strong>
          {talking && (
            <button type="button" aria-label="Encerrar conversa" onClick={closeAndFocus}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </header>
        <p aria-live="polite">
          {talking ? (topic?.answer ?? 'O que quer saber, viajante?') : greeting}
        </p>
        <ul
          id={topicsId}
          className="relic-vendor-topics"
          aria-label={`Perguntas para o ${merchant}`}
          hidden={!talking}
        >
          {topics.map((entry) => (
            <li key={entry.question}>
              <button type="button" aria-pressed={topic === entry} onClick={() => setTopic(entry)}>
                {entry.question}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function CrystalShop({
  character,
  onPurchased,
}: {
  character?: Character;
  onPurchased: () => Promise<void>;
}) {
  return (
    <article className="crystal-shop">
      <img
        className="crystal-shop-backdrop"
        src={crystalShopArt}
        width={1440}
        height={960}
        alt=""
      />
      <CrystalMerchant />
      <SpecialShop
        key={character?.id || 'guest'}
        currency="crystals"
        storefront
        characterId={character?.id}
        characterName={character?.name}
        changed={onPurchased}
      />
    </article>
  );
}
