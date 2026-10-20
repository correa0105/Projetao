/** A transient request failure must not leave saved terrain permanently blank. */
export function createVttImageLoader(images:Map<string,HTMLImageElement>,source:(path:string)=>string,changed:()=>void,failed:()=>void){
 const pending=new Map<string,{attempt:number;timer?:ReturnType<typeof setTimeout>;image?:HTMLImageElement}>();
 let disposed=false;
 function start(path:string){
  if(disposed)return;
  const task=pending.get(path);if(!task)return;
  if(task.timer)clearTimeout(task.timer);task.timer=undefined;
  const image=new Image();task.image=image;images.set(path,image);
  image.onload=()=>{if(disposed||task.image!==image)return;pending.delete(path);changed();};
  image.onerror=()=>{
   if(disposed||task.image!==image)return;
   changed();
   if(task.attempt<4){const delay=[300,800,2000,5000][task.attempt++];task.timer=setTimeout(()=>start(path),delay);}
   else failed();
  };
  image.src=source(path);
 }
 function load(path:string){
  if(!path||disposed||pending.has(path))return;
  const existing=images.get(path);if(existing?.naturalWidth)return;
  pending.set(path,{attempt:0});start(path);
 }
 function retry(){for(const [path,task]of pending){task.attempt=0;start(path);}}
 function dispose(){disposed=true;for(const task of pending.values()){if(task.timer)clearTimeout(task.timer);if(task.image){task.image.onload=null;task.image.onerror=null;}}pending.clear();}
 return{load,retry,dispose};
}
