import {useEffect,useRef} from 'react';
import type {VttScene} from '../shared/vtt';
import {HouseCueTracker,houseCuePath} from '../shared/vtt-house-cues';
import {useVttEffectAudio} from './vtt-effect-audio';
export function VttHouseSounds({roomId,scene,enabled,volume}:{roomId:string;scene:VttScene;enabled:boolean;volume:number}) {
  const tracker=useRef(new HouseCueTracker()),audio=useVttEffectAudio(enabled,volume);
  useEffect(()=>{for(const cue of tracker.current.consume(roomId,scene))audio.play(houseCuePath(cue.kind));},[roomId,scene,audio.play]);
  return null;
}
