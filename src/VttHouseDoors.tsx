import {DoorClosed,DoorOpen} from 'lucide-react';
import {visibleHouseDoors,houseAsset,houseWorld} from '../shared/vtt-houses';
import type {VttScene,VttToken} from '../shared/vtt';
import type {VttCamera} from './vtt-canvas';
import './vtt-house-doors.css';
export function VttHouseDoors({scene,camera,width,height,gm,userId,selected,disabled,toggle}:{scene:VttScene;camera:VttCamera;width:number;height:number;gm:boolean;userId:string;selected:string[];disabled:boolean;toggle:(h:VttToken)=>void}) {
  return <div className="vtt-house-doors">{visibleHouseDoors(scene,gm,userId,selected).map(h=>{
    const a=houseAsset(h)!,f=a.footprint,p=houseWorld({x:(f.doorStart+f.doorEnd)/2,y:a.doorVisual.baseY},h),out=houseWorld({x:(f.doorStart+f.doorEnd)/2,y:a.doorVisual.baseY+.1},h),length=Math.hypot(out.x-p.x,out.y-p.y);
    const x=width/2+(p.x-camera.x)*camera.zoom+(out.x-p.x)/length*17,y=height/2+(p.y-camera.y)*camera.zoom+(out.y-p.y)/length*17;
    if(x<16||y<16||x>width-16||y>height-16)return null;
    const title=(h.houseDoorOpen?'Fechar':'Abrir')+' porta — '+h.name;
    return <button key={h.id} style={{left:x,top:y}} title={title} aria-label={title} aria-pressed={h.houseDoorOpen===true} disabled={disabled} onClick={()=>toggle(h)}>{h.houseDoorOpen?<DoorOpen size={17}/>:<DoorClosed size={17}/>}</button>;
  })}</div>;
}
