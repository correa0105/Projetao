import { relative } from 'node:path';
export function staticAssetCacheControl(root: string, file: string) {
  const path = relative(root, file).replaceAll('\\', '/');
  if (path.endsWith('.html')) return 'no-store';
  if (path.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  if (/\.(png|jpe?g|webp|avif|svg|woff2?|ttf)$/i.test(path))
    return /(?:^|\/)[^/]*-20\d{6}(?:\/|[.-])/.test(path)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600';
  return null;
}
