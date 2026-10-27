import type { Card } from '../shared/cards';

function Stars() {
  return <g opacity=".6">{[[75,95],[514,80],[480,214],[118,258],[550,386],[70,465],[458,40],[202,55]].map(([x,y],i)=><path key={i} d={`M${x-5} ${y}h10M${x} ${y-5}v10`} />)}</g>;
}
function City() {
  return <g>{[35,112,188,267,343,426,498].map((x,i)=><g key={x}>
    <path d={`M${x} 625V${555-i%3*25}h57V625M${x-5} ${555-i%3*25}l34-35 33 35`} />
    {[0,1,2].map(j=><path key={j} opacity=".55" d={`M${x+12+j*13} ${575-i%3*25}v13m-2 8h4`}/>)}
  </g>)}<path d="M20 625H580M35 636H565M55 648H545" /></g>;
}
function Landscape() {
  return <g fill="var(--card-engraving-paper)"><path d="M20 590 125 408 196 515 286 357 388 509 451 421 580 590"/><path opacity=".55" d="m78 490 47-82 29 51m102-50 30-52 42 69m82 59 41-64 23 30M20 610q125-65 250-8t310-12"/><path d="M350 516q-96 35-66 57t-33 33q-25 18 55 27t24 35"/></g>;
}
function Illustration({id}:{id:Card['id']}) {
  switch(id) {
    case 'vigil':return <>
      <circle cx="300" cy="290" r="174" opacity=".3"/><circle cx="300" cy="290" r="151" opacity=".25"/>
      {Array.from({length:16},(_,i)=><path key={i} d="M300 91V111" transform={`rotate(${i*22.5} 300 290)`} opacity=".5"/>)}
      <path d="M300 61v110m-10-105h20M248 216l52-45 52 45-13 29h-78zm13 29v183h78V245M248 429h104l-12 24h-80zM265 229h70M280 245v182m40-182v182"/>
      <path d="M300 284c-50 70-35 109 0 116 42-12 38-55 0-116zM300 327c-19 31-19 53 0 61 18-9 20-29 0-61z" fill="currentColor" fillOpacity=".15"/>
      <path d="M47 548q55-39 104-17m294-4q54-35 108-1M40 578q60-20 121-13m280-7q73-6 119 22" opacity=".45"/><City/>
    </>;
    case 'raven':return <>
      <circle cx="315" cy="233" r="153" opacity=".35"/><circle cx="315" cy="233" r="136" opacity=".18"/>
      <path d="M146 487c38-60 56-127 84-179 6-65 29-101 69-111 38-9 71 15 76 46l42 22-45 14c-1 64-21 126-58 172l-74 91 7-66-75 76 22-62-63 50z" fill="var(--card-engraving-paper)"/>
      <path d="M286 244q-4 63-27 120-21 52-69 109m118-209q38 72-11 150l-43 55m33-112-28 50m40-28-32 50m40-25-22 34M305 451l-4 64m17-78 5 73m-36 8h38m-14-8h27M115 546q150-43 385-12m-317-11-55-27m282 37 40-37"/>
      <circle cx="333" cy="236" r="5" fill="currentColor"/>
      <g opacity=".4"><City/></g>
    </>;
    case 'mirror':return <>
      <path d="M155 470V244Q155 89 300 68q145 21 145 176v226q-18 93-145 127-126-34-145-127zM177 467V247Q177 115 300 93q123 22 123 154v220q-22 80-123 108-101-28-123-108z"/>
      <path d="m300 98-35 139 71 72-80 60 36 93-41 96m84-248 78-90m-155 149-77-25m109 118 124 15M200 271l89-130m-87 190 160-179m-6 255 47-52"/>
      <path d="M131 269q-60 45 5 101m332-101q60 45-5 101M245 593v31h-54v23h218v-23h-54v-31M215 68q85-68 170 0"/><circle cx="300" cy="31" r="12"/>
      {Array.from({length:7},(_,i)=><path key={i} opacity=".4" d={`M${105+i*65} 666l${80-i*20} -22`}/>)}
    </>;
    case 'moon':return <>
      <circle cx="300" cy="192" r="110" opacity=".6"/><circle cx="300" cy="192" r="132" opacity=".2"/>
      <path d="M339 89a110 110 0 1 0 58 177A105 105 0 0 1 339 89z" fill="currentColor" fillOpacity=".16"/>
      <path d="m96 161 72-42 21 80 54 27m172 94 58 33 46-51m-340 90-51 51-49-19" opacity=".5"/>
      {[ [96,161],[168,119],[189,199],[243,226],[415,320],[473,353],[519,302] ].map(([x,y])=><circle key={x} cx={x} cy={y} r="4"/>)}
      <Landscape/><path d="M300 583v24m-7 0h14m-13-22q6-14 12 0"/>
    </>;
    case 'roots':return <>
      <circle cx="300" cy="267" r="190" opacity=".25"/>
      <path d="M277 499q34-111 8-191-61-21-103-83m110 136q35-82 18-167m-6 83q70-23 118-98m-122 78q-51-40-53-109m60 66q22-33 22-74M270 500q-45 53-112 58m129-56q-32 62-16 111m25-107q38 57 100 64m-86-63q56 25 108 21m-126-22q-13 104-90 133m110-128q16 91 61 126M251 526q-23 35-88 15m162 1q33 53 92 51"/>
      {[[-100,-12,-23],[-64,-56,14],[0,-83,0],[67,-50,-12],[105,-4,24],[-131,43,4],[131,45,-9]].map(([x,y,r],i)=><g key={i} transform={`translate(${300+x} ${225+y}) rotate(${r})`}><path d="M0 40C-88 3-74-90 0-70 65-94 92-11 0 40z"/><path opacity=".45" d="M0 36V-62m0 44-39-24m39 5 38-19M0 5l-47-22m47 40 48-35"/></g>)}
      <path d="M55 635q117-40 212-4t278-7M95 653h405" opacity=".4"/>
    </>;
    case 'anchor':return <>
      <circle cx="300" cy="152" r="65" opacity=".3"/><path d="M300 66v172m-86-86h172m-147-61 122 122m0-122L239 213" opacity=".4"/>
      <circle cx="300" cy="288" r="36"/><circle cx="300" cy="288" r="22"/>
      <path d="M287 323v232q-79-14-125-85l42 6-51-57-13 76 19-15q38 109 141 143 102-34 141-143l19 15-13-76-51 57 42-6q-45 72-125 85V323M241 358h118m-113-10v20m108-20v20"/>
      <path d="M317 258q52-48 5-72t-9-65m7 72q-44 48-8 75"/>
      {Array.from({length:4},(_,i)=><path key={i} d={`M35 ${581+i*23}q50-27 100 0t100 0 100 0 100 0 100 0`} opacity=".5"/>)}
    </>;
    case 'blade':return <>
      <circle cx="300" cy="309" r="159" opacity=".25"/><circle cx="300" cy="309" r="142" opacity=".2"/>
      {Array.from({length:20},(_,i)=><path key={i} d="M300 111V132" transform={`rotate(${i*18} 300 309)`} opacity=".45"/>)}
      <path d="M284 252v310l16 57 16-57V252M300 266v316M261 241q39-26 78 0l42-18-9 36-72-9-72 9-9-36zM281 166h38v61h-38zM300 105l25 28-25 28-25-28zM280 181h40m-40 15h40m-40 15h40"/>
      <path d="M226 551q-67-37-69-126m218 126q67-37 69-126m-281 29-29-24m34 45-36-5m33 26-27 14m301-61 29-24m-34 45 36-5m-33 26 27 14M120 654h360" opacity=".65"/>
    </>;
    case 'throne':return <>
      <path d="M92 591V268Q92 106 300 62q208 44 208 206v323M117 575V269q0-139 183-181 183 42 183 181v306M135 593h330M115 618h370M89 644h422"/>
      <path d="M210 500V313l45-38 45 25 45-25 45 38v187M230 440h140v47H230zM240 487v54m120-54v54M192 419h38m140 0h38M205 416v86m190-86v86M257 319v101m86-101v101"/>
      <path d="M247 217l-12-43 37 16 28-47 28 47 37-16-12 43zM145 278v268m310-268v268M143 300h25m265 0h25M171 148l31 31m227-31-31 31M300 95v29"/>
      <circle cx="300" cy="366" r="24" opacity=".45"/><path d="M284 365h32m-16-16v32" opacity=".45"/>
    </>;
  }
}

export function CardEngraving({card}:{card:Card}) {
  return <svg className="card-engraving" viewBox="0 0 700 1000" aria-hidden="true">
    <g transform="translate(50 100)" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><Stars/><Illustration id={card.id}/></g>
  </svg>;
}
