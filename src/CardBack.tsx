import {useId} from 'react';
import {cardBacks,cardEye} from './card-backs';
import {cardVisualLevel} from '../shared/card-presentation';
import {CardPrismaticFoil} from './CardPrismaticFoil';
import './card-emblems.css';

// Inner edge of the native 1024 × 1536 back, including its four metal points.
const eyeAperture='M872 768L871 777L867 785L861 794L840 817L807 842L782 857L757 869L708 886L657 899L593 910L541 913L538 916L515 889L512 879L506 896L503 896L486 916L483 913L436 911L361 898L315 886L285 876L241 857L199 830L169 802L152 777L151 768L160 759L175 751L161 742L153 733L154 724L159 716L172 700L187 686L202 674L235 653L267 637L313 620L317 616L326 616L365 605L419 594L448 590L481 589L485 585L508 614L512 624L516 610L520 608L539 585L543 589L585 591L654 604L711 620L765 641L813 669L844 693L865 716L870 724L871 733L863 742L849 751L864 759L872 768Z';

/** The photographic iris stays rigid; the eyelids clip it as they close. */
export function CardBack({level=1}:{level?:number}) {
  const id='arcana-eye-'+useId().replaceAll(':','');
  const visualLevel=cardVisualLevel(level);
  return <span className="arcana-card-back" data-level={visualLevel} aria-hidden="true">
    <img className="arcana-back-paper" src={cardBacks.original} alt="" draggable={false}/>
    <svg className="arcana-back-eye" viewBox="0 0 1024 1536" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-frame`}><path d={eyeAperture}/></clipPath>
        <clipPath id={id}><path className="arcana-eye-lid" d="M-20 55C-20 -55 260 -55 260 55C260 165 -20 165 -20 55Z"/></clipPath>
      </defs>
      <g clipPath={`url(#${id}-frame)`}>
        <g transform="translate(140 582) scale(3.1)">
          <image href={cardEye} x="-90" y="-32.5" width="420" height="175" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id})`}/>
          <path className="arcana-eye-seam" d="M-20 55C60 81 180 81 260 55" fill="none" stroke="#b8b2a4" strokeWidth=".8"/>
        </g>
      </g>
    </svg>
    {visualLevel===3&&<CardPrismaticFoil/>}
  </span>;
}
