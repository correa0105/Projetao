import {DoorClosed,DoorOpen} from 'lucide-react';
import {canReachHouseDoor,houseAsset,houseWorld} from '../shared/vtt-houses';
import type {VttScene,VttToken} from '../shared/vtt';
import type {VttCamera} from './vtt-canvas';
import './vtt-house-doors.css';
export function VttHouseDoors({scene,camera,width,height,gm,userId,disabled,toggle}:{scene:VttScene;camera:VttCamera;width:number;height:number;gm:boolean;userId:string;disabled:boolean;toggle:(h:VttToken)=>void}) {
  return <div className="vtt-house-doors">{scene.tokens.filter(t=>houseAsset(t)&&!t.hidden&&(gm||canReachHouseDoor(t,scene,userId))).map(h=>{
    const p=houseWorld({x:(houseAsset(h)!.footprint.doorStart+houseAsset(h)!.footprint.doorEnd)/2,y:Math.min(.97,houseAsset(h)!.footprint.bottom+.12)},h),x=width/2+(p.x-camera.x)*camera.zoom,y=height/2+(p.y-camera.y)*camera.zoom;
    if(x<16||y<16||x>width-16||y>height-16)return null;
    const title=(h.houseDoorOpen?'Fechar':'Abrir')+' porta — '+h.name;
    return <button key={h.id} style={{left:x,top:y}} title={title} aria-label={title} aria-pressed={h.houseDoorOpen===true} disabled={disabled} onClick={()=>toggle(h)}>{h.houseDoorOpen?<DoorOpen size={17}/>:<DoorClosed size={17}/>}</button>;
  })}</div>;
}
