import { monsterTestArt } from '../shared/vtt-monster-test-cards';
import { modifier } from '../shared/rules';
import type { MonsterProfile } from './VttMonsterSheet';
import './vtt-monster-test-card.css';

export function VttMonsterTestCard({monster}: {monster: MonsterProfile}) {
  const art = monsterTestArt(monster.image);
  if (!art) return null;
  return <figure className="vtt-monster-test-card" data-monster-test={art.id}>
    <figcaption><span>Bestiário · Bônus de teste</span><strong>{art.name}</strong></figcaption>
    <div className="monster-test-showcase">
      <svg className="monster-test-frame" viewBox="0 0 500 520" aria-hidden="true">
        <path d="M250 24 458 141V380L250 497 42 380V141Z" fill="#50381a10" stroke="currentColor" strokeWidth="3" />
        <path d="M250 34 449 146V375L250 487 51 375V146Z" fill="none" stroke="currentColor" />
        <path d="M250 45 439 152V369L250 476 61 369V152Z" fill="none" stroke="currentColor" strokeDasharray="1 4" />
      </svg>
      <img className="monster-test-body" src={art.body} alt={art.name + ', ilustração em relevo sem fundo'} width="900" height="900" />
      <div className="monster-test-stat monster-test-ac"><small>CA</small><b>{monster.ac}</b></div>
      <div className="monster-test-stat monster-test-hp"><small>PV</small><b>{monster.hp}</b></div>
    </div>
    <dl className="monster-test-abilities">
      {monster.stats.map((v, i) => <div key={i}><dt>{['FOR','DES','CON','INT','SAB','CAR'][i]}</dt><dd>{modifier(v)>=0?'+':''}{modifier(v)}</dd></div>)}
    </dl>
    <div className="monster-test-token-preview"><img src={art.token} alt={'Token em relevo de '+art.name} width="640" height="640" /><span>Token em relevo<small>Arte de teste · ficha original preservada</small></span></div>
  </figure>;
}
