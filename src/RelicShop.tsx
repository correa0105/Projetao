import { useState } from 'react';
import { ScrollText } from 'lucide-react';
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
      <img
        className="relic-shop-art"
        src={relicShopArt}
        width={1440}
        height={960}
        alt="Um robô de bronze atende no balcão, entre baús antigos e velas acesas."
      />
      <div className="relic-shop-counter">
        <header className="relic-shop-intro">
          <span className="relic-shop-kicker">
            <img src="/navigation/illustrated-20261020/reliquias.webp" width={20} height={20} alt="" />
            Loja de Prestígio
          </span>
          <h1>Relíquias</h1>
          <blockquote>“Pode chegar, viajante. Por aqui, cada peça custa Prestígio.”</blockquote>
          <button type="button" className="button outline" onClick={() => setHistoryOpen(true)}>
            <ScrollText size={16} aria-hidden="true" /> Histórico e recompensas
          </button>
        </header>
        <div className="relic-shop-catalogue">
          <SpecialShop currency="prestige" characterId={characterId} changed={onPurchased} />
        </div>
      </div>
      {historyOpen && <PrestigeCenter close={() => setHistoryOpen(false)} />}
    </article>
  );
}
