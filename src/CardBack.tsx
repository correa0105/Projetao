import {useId} from 'react';
import {cardBacks,cardEye} from './card-backs';
import {cardVisualLevel} from '../shared/card-presentation';
import {CardPrismaticFoil} from './CardPrismaticFoil';
import './card-emblems.css';

/** The photographic iris stays rigid; the eyelids clip it as they close. */
export function CardBack({level=1}:{level?:number}) {
  const id='arcana-eye-'+useId().replaceAll(':','');
  const visualLevel=cardVisualLevel(level);
  return <span className="arcana-card-back" data-level={visualLevel} aria-hidden="true">
    <img className="arcana-back-paper" src={cardBacks.original} alt="" draggable={false}/>
    <svg className="arcana-back-eye" viewBox="0 0 240 110" aria-hidden="true">
      <defs><clipPath id={id}><path className="arcana-eye-lid" d="M12 55C66 -4 174 -4 228 55C174 114 66 114 12 55Z"/></clipPath></defs>
      <image href={cardEye} x="0" y="5" width="240" height="100" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id})`}/>
      <path className="arcana-eye-seam" d="M12 55Q120 76 228 55" fill="none" stroke="#b8b2a4" strokeWidth=".8"/>
    </svg>
    {visualLevel===3&&<CardPrismaticFoil/>}
  </span>;
}
