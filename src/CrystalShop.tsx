import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { crystalMerchantArt, crystalShopArt } from './page-assets';
import { SpecialShop } from './SpecialEconomy';
import type { Character } from './types';
import './crystal-shop.css';

const greeting =
  'Bem-vindo, viajante. Traga seus cristais até o balcão. Eu cuido do que você leva de volta à Torre.';
const topics = [
  {
    question: 'Como consigo cristais?',
    answer:
      'Volte de uma expedição e resgate as recompensas na Torre. Os cristais ficam na carteira do personagem que os recebeu.',
  },
  {
    question: 'Onde uso os itens da loja?',
    answer:
      'Use os itens nas mesas oficiais de expedições ativas da Torre em que seu personagem participa. Suas compras aparecem em Itens do personagem.',
  },
  {
    question: 'Como ajudo a guilda?',
    answer:
      'Doe cristais para a Ferramenta de Expedição na Mesa de Estratégia da guilda. O fundador autoriza a melhoria.',
  },
  {
    question: 'Quem é você?',
    answer:
      'Sou Nara, a lapidária do Entreposto. Sei pela luz de uma pedra se ela já viu o fundo da Torre.',
  },
] as const;

function CrystalMerchant() {
  const [view, setView] = useState<'greeting' | 'closed' | 'talk'>('greeting');
  const [topic, setTopic] = useState<(typeof topics)[number] | null>(null);
  const host = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const topicsId = useId();
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
      aria-label="Nara, lapidária da Torre"
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
        aria-label="Conversar com Nara"
        title="Conversar com Nara"
        aria-expanded={talking}
        aria-controls={topicsId}
        onClick={() => (talking ? closeAndFocus() : setView('talk'))}
      >
        <img src={crystalMerchantArt} width={638} height={760} alt="" draggable={false} />
      </button>
      <div className="relic-vendor-speech crystal-vendor-speech" hidden={view === 'closed'}>
        <header>
          <strong>Nara · Lapidária da Torre</strong>
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
          aria-label="Perguntas para Nara"
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
