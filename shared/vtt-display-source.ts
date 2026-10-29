import displayImages from './vtt-display-images.json';
const images: Readonly<Record<string,string>> = displayImages;
/** Delivery only: stored URLs, map backgrounds and native atlas coordinates stay intact. */
export function vttDisplaySource(path:string) {
  if(!path)return path;
  if(path.startsWith('/api/')){
    const url=new URL(path,'http://vtt.invalid');
    if(url.searchParams.get('original')==='1')return path;
    url.searchParams.set('display','1');
    return url.pathname+url.search+url.hash;
  }
  return images[path.split('?')[0]]||path;
}
