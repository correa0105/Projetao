import { useState } from 'react';
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
      <div className="relic-shop-backdrop">
        <img
          src={relicShopArt}
          width={1440}
          height={960}
          alt="Um robô de bronze atende no balcão, entre baús antigos e velas acesas."
        />
      </div>
      <aside className="relic-vendor-speech" aria-label="Fala do vendedor">
        <strong>Robô de bronze</strong>
        <p>Pode chegar, viajante. Por aqui, cada peça custa Prestígio.</p>
      </aside>
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
