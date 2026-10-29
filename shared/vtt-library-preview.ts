import thumbnails from './vtt-library-thumbnails.json';
const images: Readonly<Record<string,string>> = thumbnails;
/** Library cards only. Never use this URL when placing or painting the map. */
export function vttLibraryPreview(path: string) {
  if (!path) return path;
  if (path.startsWith('/api/')) {
    const url = new URL(path, 'http://vtt.invalid');
    if (url.searchParams.get('original') === '1') return path;
    url.searchParams.set('thumbnail','1');
    return url.pathname + url.search + url.hash;
  }
  return images[path.split('?')[0]] || path;
}
