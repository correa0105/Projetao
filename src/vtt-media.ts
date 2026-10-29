const listeners=new Set<()=>void>();
export function watchVttMedia(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}

/** Importing a renderer must not download every effect in the catalog. */
export function createVttMedia<K extends string>(keys:readonly K[],load:(key:K)=>Promise<void>){
  const jobs=new Map<K,Promise<void>>();
  function request(key:K){
    let job=jobs.get(key);
    if(!job){
      job=Promise.resolve().then(()=>load(key)).then(()=>{for(const listener of listeners)listener();});
      jobs.set(key,job);
    }
    return job;
  }
  const ready:PromiseLike<void[]>={then:(yes,no)=>Promise.all(keys.map(request)).then(yes,no)};
  return {request,ready};
}
export function lazyVttMedia<T>(load:()=>Promise<T>):PromiseLike<T>{
  let job:Promise<T>|undefined;
  return {then:(yes,no)=>(job??=load()).then(yes,no)};
}
