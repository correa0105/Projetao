import {useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {cardTableProjection,cardTablePlacement} from './card-table-projection';

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
      const positions:Record<string,string>={};
      const count=room.querySelectorAll('.cards-catalog > button').length;
      for(let i=0;i<count;i++){
        const point=cardTablePlacement(projection.kind,i,count);
        positions[`--fan-${i}-x`]=`${point.x-140}px`;
        positions[`--fan-${i}-y`]=`${point.y-200}px`;
        positions[`--fan-${i}-angle`]=`${point.angle}deg`;
      }
      setStyle({width:projection.size.width,height:projection.size.height,transform:projection.css,...positions});
    };
    const observer=new ResizeObserver(update);observer.observe(room);
    const catalog=room.querySelector('.cards-catalog'),cardsObserver=new MutationObserver(update);
    if(catalog)cardsObserver.observe(catalog,{childList:true});
    update();
    return()=>{observer.disconnect();cardsObserver.disconnect();};
  },[]);
  return <div ref={surface} className="cards-reading-surface" style={style} aria-label="Cartas em arco sobre a mesa">{children}</div>;
}
