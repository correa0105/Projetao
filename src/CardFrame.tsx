import {useId} from 'react';
export function CardFrame({cell,metallic=false,chrome=false,gold=false}:{cell:number;metallic?:boolean;chrome?:boolean;gold?:boolean}) {
  const id='card-frame-metal-'+useId().replaceAll(':','');
  const ink=metallic?`url(#${id})`:'var(--card-frame-ink)';
  const paper=metallic?`url(#${id})`:'var(--card-paper)';
  const curl='M22 137 C3 101 10 53 33 29 C54 7 92 6 122 24 C151 42 161 58 151 78 C130 61 116 59 98 71 C104 47 89 28 67 31 C41 34 34 57 48 78 C22 73 16 94 22 137 Z';
  return <svg className="arcana-card-frame" viewBox="0 0 700 1000" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={chrome?'#78b7d7':gold?'#977238':'#696e75'}/><stop offset=".23" stopColor={chrome?'#e6cbf7':gold?'#f5dc95':'#faf4df'}/>
      <stop offset=".45" stopColor={chrome?'#8ddbe6':gold?'#b78942':'#a8acb4'}/><stop offset=".62" stopColor={chrome?'#c2f2db':gold?'#ebcb7c':'#ede2bf'}/>
      <stop offset=".8" stopColor={chrome?'#ac91d4':gold?'#aa7d37':'#767a84'}/><stop offset="1" stopColor={chrome?'#f4d3e6':gold?'#f7e4b0':'#f5efdc'}/>
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
