import { useId, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { relicShopArt } from './page-assets';
import { PrestigeCenter, SpecialShop } from './SpecialEconomy';
import './relic-shop.css';

const vendorGreeting =
  'Chegue mais, viajante. Se ouvir um rangido, é o baú. Minhas engrenagens estão em dia.';
const vendorTopics = [
  {
    question: 'O que tem nos baús?',
    answer:
      'Bordas de perfil, skins para suas armas, montarias e mascotes raros. Escolha uma prateleira e veja o que tenho em estoque. Aqui, a moeda é Prestígio.',
  },
  {
    question: 'Como ganho Prestígio?',
    answer:
      'Aposente um personagem no acampamento a partir do nível 5. Quanto mais longe ele chegou, mais Prestígio a conta recebe. Os níveis 5, 9, 13 e 17 dão os maiores saltos.',
  },
  {
    question: 'Onde ficam minhas compras?',
    answer:
      'A sacola ao lado do saldo abre sua coleção. É lá que você equipa bordas e aplica skins. Montarias e mascotes vão para o personagem que você escolheu na compra.',
  },
  {
    question: 'Quem é você?',
    answer:
      'Cuido dos baús, confiro as relíquias e guardo o balcão. É serviço para três, mas só me deram uma manivela.',
  },
] as const;

function RelicVendor() {
  const [talking, setTalking] = useState(false);
  const [topic, setTopic] = useState<(typeof vendorTopics)[number] | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const topicsId = useId();

  function endConversation() {
    setTalking(false);
    setTopic(null);
    trigger.current?.focus();
  }

  return (
    <aside
      className="relic-vendor-speech"
      aria-label="Robô de bronze"
      onKeyDown={(event) => {
        if (talking && event.key === 'Escape') {
          event.stopPropagation();
          endConversation();
        }
      }}
    >
      <strong>Robô de bronze</strong>
      <p aria-live="polite">{topic?.answer ?? vendorGreeting}</p>
      <button
        ref={trigger}
        type="button"
        className="relic-vendor-trigger"
        aria-expanded={talking}
        aria-controls={topicsId}
        onClick={() => (talking ? endConversation() : setTalking(true))}
      >
        {talking ? <X size={15} aria-hidden="true" /> : <MessageCircle size={15} aria-hidden="true" />}
        {talking ? 'Encerrar conversa' : 'Conversar'}
      </button>
      <ul id={topicsId} className="relic-vendor-topics" aria-label="Perguntas ao robô" hidden={!talking}>
        {vendorTopics.map((entry) => (
          <li key={entry.question}>
            <button type="button" aria-pressed={topic === entry} onClick={() => setTopic(entry)}>
              {entry.question}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function RelicShop({
  characterId,
  onPurchased,
}: {
  characterId?: string;
  onPurchased: () => Promise<void>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <article className="relic-shop">
      <div className="relic-shop-backdrop">
        <img
          src={relicShopArt}
          width={1440}
          height={960}
          alt="Um robô de bronze atende no balcão, entre baús antigos e velas acesas."
        />
      </div>
      <RelicVendor />
      <SpecialShop
        currency="prestige"
        characterId={characterId}
        changed={onPurchased}
        onHistory={() => setHistoryOpen(true)}
      />
      {historyOpen && <PrestigeCenter close={() => setHistoryOpen(false)} />}
    </article>
  );
}
