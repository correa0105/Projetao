import {useId} from 'react';
export function CardFrame({cell,metallic=false,chrome=false,gold=false,engraved=false}:{cell:number;metallic?:boolean;chrome?:boolean;gold?:boolean;engraved?:boolean}) {
  const id='card-frame-metal-'+useId().replaceAll(':','');
  const ink=metallic?`url(#${id})`:'var(--card-frame-ink)';
  const paper=metallic?`url(#${id})`:'var(--card-paper)';
  const curl='M22 137 C3 101 10 53 33 29 C54 7 92 6 122 24 C151 42 161 58 151 78 C130 61 116 59 98 71 C104 47 89 28 67 31 C41 34 34 57 48 78 C22 73 16 94 22 137 Z';
  if (engraved) return <svg className="arcana-card-frame" viewBox="0 0 700 1000" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={chrome?'#819da9':'#8c6d38'}/><stop offset=".3" stopColor={chrome?'#eef2ed':'#ebd193'}/><stop offset=".6" stopColor={chrome?'#9ab7bf':'#a67e3e'}/><stop offset="1" stopColor={chrome?'#e3e8e3':'#d9bc77'}/></linearGradient></defs>
    <g fill="none" stroke={`url(#${id})`} strokeWidth="2.5">
      <rect x="20" y="18" width="660" height="964" rx="19"/><rect x="32" y="30" width="636" height="940" rx="12" strokeWidth="1" opacity=".6"/>
      <path d="M46 66V44h76m456 0h76v22M46 930v22h76m456 0h76v-22M46 826h608M46 937h608"/>
      <path d="m326 31 24 39 24-39M92 826l11-12 11 12m372 0 11-12 11 12"/>
      <circle cx="350" cy="794" r="5"/><path d="M287 794h46m34 0h46M320 954h60" opacity=".65"/>
    </g>
    <text x="350" y="102" textAnchor="middle" fill="var(--card-frame-ink)" fontFamily="Georgia, serif" fontSize="25" letterSpacing="4">{['I','II','III','IV','V','VI','VII','VIII'][cell]}</text>
  </svg>;
  return <svg className="arcana-card-frame" viewBox="0 0 700 1000" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={chrome?'#b5c2c9':gold?'#977238':'#696e75'}/><stop offset=".23" stopColor={chrome?'#f2eee8':gold?'#f5dc95':'#faf4df'}/>
      <stop offset=".45" stopColor={chrome?'#96aeb9':gold?'#b78942':'#a8acb4'}/><stop offset=".62" stopColor={chrome?'#edf3ef':gold?'#ebcb7c':'#ede2bf'}/>
      <stop offset=".8" stopColor={chrome?'#b6becb':gold?'#aa7d37':'#767a84'}/><stop offset="1" stopColor={chrome?'#e8ded8':gold?'#f7e4b0':'#f5efdc'}/>
    </linearGradient></defs>
    <g fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="round">
      <rect x="23" y="17" width="654" height="966" rx="42"/>
      <rect x="32" y="26" width="636" height="948" rx="36" strokeWidth="2"/>
      <path d="M245 26 Q250 81 300 81 H400 Q450 81 455 26" fill={paper}/>
      <rect x="60" y="869" width="580" height="98" rx="13" fill={paper} strokeWidth="4"/>
      <path d={curl} fill={paper}/><path d={curl} fill={paper} transform="translate(700 0) scale(-1 1)"/>
      <path d={curl} fill={paper} transform="translate(0 1000) scale(1 -1)"/>
      <path d={curl} fill={paper} transform="translate(700 1000) scale(-1 -1)"/>
    </g>
    <text x="350" y="59" textAnchor="middle" fill="var(--card-frame-ink)" fontFamily="Georgia, serif" fontSize="34">{['I','II','III','IV','V','VI','VII','VIII'][cell]}</text>
  </svg>;
}
