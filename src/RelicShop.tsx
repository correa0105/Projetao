import { useState } from 'react';
import { Gem, ScrollText } from 'lucide-react';
import { relicShopArt } from './page-assets';
import { PrestigeCenter, SpecialShop } from './SpecialEconomy';
import './relic-shop.css';

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
      <header className="relic-shop-scene">
        <img
          className="relic-shop-art"
          src={relicShopArt}
          width={1440}
          height={960}
          alt="Um robô de bronze atende no balcão, entre baús antigos e velas acesas."
        />
        <div className="relic-shop-intro">
          <span className="relic-shop-kicker">
            <Gem size={16} aria-hidden="true" /> Loja de Prestígio
          </span>
          <h1>Relíquias</h1>
          <blockquote>“Pode chegar, viajante. Por aqui, cada peça custa Prestígio.”</blockquote>
          <button type="button" className="button outline" onClick={() => setHistoryOpen(true)}>
            <ScrollText size={16} aria-hidden="true" /> Histórico e recompensas
          </button>
        </div>
      </header>
      <div className="relic-shop-catalogue">
        <SpecialShop currency="prestige" characterId={characterId} changed={onPurchased} />
      </div>
      {historyOpen && <PrestigeCenter close={() => setHistoryOpen(false)} />}
    </article>
  );
}
