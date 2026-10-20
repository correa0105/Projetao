import { lazy, type ComponentType } from 'react';

/** A short interruption while loading a page should recover inside Suspense. */
export function lazyPage<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  exportName: string,
) {
  return lazy(async () => {
    let failedModule: URL | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        if (failedModule) {
          // Browsers memoize a rejected module URL; a fresh URL permits a real retry.
          const retry = new URL(failedModule);
          retry.searchParams.set('page_retry', String(attempt));
          const module = await import(/* @vite-ignore */ retry.href);
          return { default: module[exportName] as T };
        }
        return await load();
      } catch (error) {
        if (attempt === 2) throw error;
        const address = String(error).match(/https?:\/\/[^\s'"<>]+?\.js(?:\?[^\s'"<>]*)?/);
        if (address) {
          const url = new URL(address[0]);
          if (url.origin === location.origin && /^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(url.pathname))
            failedModule = url;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
  });
}
