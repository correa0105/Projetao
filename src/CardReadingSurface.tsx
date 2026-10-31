import {useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {cardTableProjection,cardTableCardSize,cardTablePlacement,cardTableCardCorners,cardTableDeckCorners,projectTablePoint} from './card-table-projection';

export function CardReadingSurface({children}:{children:ReactNode}) {
  const surface=useRef<HTMLDivElement>(null);
  const [style,setStyle]=useState<CSSProperties>({visibility:'hidden'});
  useLayoutEffect(()=>{
    const room=surface.current?.closest<HTMLElement>('.cards-room');
    if(!room)return;
    const update=()=>{
      const width=room.clientWidth,height=room.clientHeight;
      if(!width||!height)return;
      const projection=cardTableProjection(width,height);
      room.style.setProperty('--cards-dialogue-limit',`${projection.dialogueLimit}px`);
      const active=[...[0,1,2].flatMap(i=>cardTableCardCorners(projection.kind,i)),...cardTableDeckCorners(projection.kind)];
      room.style.setProperty('--cards-dialogue-after',`${Math.max(...active.map(p=>projectTablePoint(projection.matrix,p.x,p.y).y))+28}px`);
      const positions:Record<string,string>={
        '--table-card-width':`${cardTableCardSize.width}px`,'--table-card-height':`${cardTableCardSize.height}px`,
        '--table-slot-y':`${projection.size.slotY}px`,'--table-deck-x':`${projection.size.deckX}px`,'--table-deck-y':`${projection.size.deckY}px`,
      };
      for(let i=0;i<3;i++)positions[`--table-slot-${i+1}-x`]=`${cardTablePlacement(projection.kind,i).x}px`;
      setStyle({width:projection.size.width,height:projection.size.height,transform:projection.css,...positions});
    };
    const observer=new ResizeObserver(update);observer.observe(room);
    update();
    return()=>{observer.disconnect();room.style.removeProperty('--cards-dialogue-limit');room.style.removeProperty('--cards-dialogue-after');};
  },[]);
  return <div ref={surface} className="cards-reading-surface" style={style} aria-label="Baralho do Anfitrião e três espaços de cartas na mesa">{children}</div>;
}
