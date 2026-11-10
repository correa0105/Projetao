import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { relicShopArt } from './page-assets';
import { PrestigeCenter, SpecialShop } from './SpecialEconomy';
import './relic-shop.css';

const vendorGreeting =
  'Chegue mais, viajante. Se ouvir um rangido, é o baú. Minhas engrenagens estão em dia.';
const sceneWidth = 1440;
const sceneHeight = 960;
const robotBounds = { x: 710, y: 201, width: 476, height: 483 };
// Coordinates in the shop illustration. The second subpath is the gap inside the right arm.
const robotOutline = `
  M1011 210 C1011 201 1042 201 1048 209 L1046 232 Q1045 245 1037 249
  L1038 267 C1085 272 1114 306 1127 347 C1135 375 1132 403 1133 430
  L1131 466 Q1129 478 1098 485 L1090 490 Q1102 494 1113 499
  C1123 503 1129 514 1125 522 C1144 546 1167 581 1174 602
  C1187 607 1181 620 1174 625 Q1149 648 1123 653
  Q1118 661 1102 669 L1090 681 Q1084 686 1077 679 Q1071 684 1064 678
  Q1057 681 1052 675 Q1042 675 1047 663 L963 666
  Q965 642 967 627 L968 551 Q937 576 889 596 L873 600
  Q862 603 856 595 Q826 594 791 580 Q784 585 776 580
  Q753 584 743 570 C727 564 713 549 714 537 Q715 533 720 540 L741 551
  Q750 550 749 540 Q745 531 731 528 Q727 525 736 523 Q754 520 764 526
  C778 531 792 537 796 552 Q818 563 859 573 Q865 571 869 575
  Q918 550 939 521 Q944 502 965 497 L972 487
  Q931 482 908 469 Q903 465 904 453 L905 421 L910 416
  C891 409 873 400 874 381 C875 358 897 340 920 347
  C933 302 969 280 1018 268 L1019 250 Q1011 247 1011 234 Z
  M1103 538 C1121 559 1144 591 1154 608 Q1137 619 1117 628
  Q1104 625 1092 630 L1094 555 Z`;
const vendorTopics = [
  {
    question: 'O que tem nos baús?',
    answer:
      'Bordas de perfil, skins para suas armas, montarias e mascotes raros. Escolha uma prateleira e veja o que tenho em estoque. Aqui, a moeda é Prestígio.',
  },
  {
    question: 'Como ganho Prestígio?',
    answer:
      'Aposente um personagem no acampamento a partir do nível 5. Quanto maior o nível, mais Prestígio você ganha. Os maiores saltos são nos níveis 5, 9, 13 e 17.',
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
  const [view, setView] = useState<'greeting' | 'closed' | 'talk'>('greeting');
  const [topic, setTopic] = useState<(typeof vendorTopics)[number] | null>(null);
  const vendor = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const topicsId = useId();
  const talking = view === 'talk';

  function endConversation() {
    setView('closed');
    setTopic(null);
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
      if (!vendor.current?.contains(event.target as Node)) endConversation();
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [talking]);

  function closeAndFocus() {
    endConversation();
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <aside
      ref={vendor}
      aria-label="Robô de bronze"
      onKeyDown={(event) => {
        if (talking && event.key === 'Escape') {
          event.stopPropagation();
          closeAndFocus();
        }
      }}
    >
      <div className="relic-shop-backdrop">
        <div className="relic-shop-scene">
          <div className="relic-shop-art">
            <img
              src={relicShopArt}
              width={sceneWidth}
              height={sceneHeight}
              alt="Um robô de bronze atende no balcão, entre baús antigos e velas acesas."
            />
            <button
              ref={trigger}
              type="button"
              className="relic-vendor-trigger"
              data-greeting={view === 'greeting' || undefined}
              aria-label="Conversar com o robô de bronze"
              title="Conversar com o robô de bronze"
              aria-expanded={talking}
              aria-controls={topicsId}
              style={{
                left: `${(robotBounds.x / sceneWidth) * 100}%`,
                top: `${(robotBounds.y / sceneHeight) * 100}%`,
                width: `${(robotBounds.width / sceneWidth) * 100}%`,
                height: `${(robotBounds.height / sceneHeight) * 100}%`,
              }}
              onClick={() => (talking ? closeAndFocus() : setView('talk'))}
            >
              <svg
                viewBox={`${robotBounds.x} ${robotBounds.y} ${robotBounds.width} ${robotBounds.height}`}
                aria-hidden="true"
              >
                <path d={robotOutline} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="relic-vendor-speech" hidden={view === 'closed'}>
        <header>
          <strong>Robô de bronze</strong>
          {talking && (
            <button type="button" aria-label="Encerrar conversa" onClick={closeAndFocus}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </header>
        <p aria-live="polite">
          {talking ? (topic?.answer ?? 'O que quer saber, viajante?') : vendorGreeting}
        </p>
        <ul id={topicsId} className="relic-vendor-topics" aria-label="Perguntas ao robô" hidden={!talking}>
          {vendorTopics.map((entry) => (
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

export function RelicShop({
  characterId,
  onPurchased,
}: {
  characterId?: string;
  onPurchased: () => Promise<void>;
}) {
  const [prestigeOpen, setPrestigeOpen] = useState(false);

  return (
    <article className="relic-shop">
      <RelicVendor />
      <SpecialShop
        currency="prestige"
        characterId={characterId}
        changed={onPurchased}
        onPrestige={() => setPrestigeOpen(true)}
      />
      {prestigeOpen && <PrestigeCenter close={() => setPrestigeOpen(false)} />}
    </article>
  );
}
