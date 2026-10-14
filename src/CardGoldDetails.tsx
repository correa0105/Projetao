import {useId} from 'react';
/** Retain only the warm accents of the original art and plate those shapes in gold. */
export function CardGoldDetails({art}:{art:string}) {
  const id='card-gold-'+useId().replaceAll(':','');
  return <svg className="arcana-card-gold" viewBox="0 0 700 1000" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <filter id={id+'-extract'} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  3 3 -6 0 -.22"/>
      </filter>
      <mask id={id+'-mask'} maskUnits="userSpaceOnUse" x="0" y="0" width="700" height="1000" style={{maskType:'alpha'}}>
        <image href={art} width="700" height="1000" preserveAspectRatio="none" filter={'url(#'+id+'-extract)'}/>
      </mask>
      <linearGradient id={id+'-metal'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#94621d"/><stop offset=".18" stopColor="#efbd48"/>
        <stop offset=".32" stopColor="#ffe5a0"/><stop offset=".46" stopColor="#b27a20"/>
        <stop offset=".62" stopColor="#f6ca5a"/><stop offset=".8" stopColor="#ffebb1"/>
        <stop offset="1" stopColor="#b68027"/>
      </linearGradient>
    </defs>
    <rect width="700" height="1000" fill={'url(#'+id+'-metal)'} mask={'url(#'+id+'-mask)'}/>
  </svg>;
}
