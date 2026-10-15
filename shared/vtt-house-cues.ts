import type {VttScene} from './vtt';
const sounds={'door-open':'sfx-dooropen-1','door-close':'sfx-doorclose-1','window-open':'sfx-creak1','window-close':'sfx-metallatch'} as const;
export const houseCuePath=(kind:VttScene['houseCues'][number]['kind'])=>'/audio/vtt/'+sounds[kind]+'.ogg';
/** First snapshot and scene changes establish a baseline; history never replays on reload. */
export class HouseCueTracker {
  private scope='';private seen=new Set<string>();
  consume(roomId:string,scene:VttScene,now=Date.now()) {
    const scope=roomId+':'+scene.id,first=this.scope!==scope;this.scope=scope;
    const cues=scene.houseCues??[],fresh=first?[]:cues.filter(c=>!this.seen.has(c.id)&&now-c.at>=0&&now-c.at<10000);
    this.seen=new Set(cues.map(c=>c.id));return fresh;
  }
}
