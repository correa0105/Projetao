const jobs = new Map<string, Promise<void>>();
const ready = new Set<string>();
const queue: Array<() => void> = [];
let active = 0;
function pump() {
  while (active < 4 && queue.length) {
    active++;
    queue.shift()!();
  }
}
const keyFor = (path: string) => new URL(path, location.href).href;
export const assetReady = (path: string) => !path || ready.has(keyFor(path));
export function preloadImage(path: string): Promise<void> {
  if (path) path = keyFor(path);
  if (!path || ready.has(path)) return Promise.resolve();
  const existing = jobs.get(path);
  if (existing) return existing;
  const job = new Promise<void>((resolve, reject) => {
    queue.push(() => {
      const image = new Image();
      let finished = false;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        image.onload = image.onerror = null;
        active--;
        pump();
        if (error) {
          jobs.delete(path);
          reject(error);
        } else {
          ready.add(path);
          resolve();
        }
      };
      const timeout = setTimeout(() => finish(new Error('A imagem demorou para carregar.')), 45000);
      image.onload = () => {
        void image
          .decode()
          .catch(() => {
            if (!image.naturalWidth) throw Error('Imagem inválida.');
          })
          .then(
            () => finish(),
            () => finish(new Error('Não foi possível preparar uma imagem.')),
          );
      };
      image.onerror = () => finish(new Error('Não foi possível carregar uma imagem.'));
      image.decoding = 'async';
      image.src = path;
    });
    pump();
  });
  jobs.set(path, job);
  return job;
}
export async function preloadImages(
  paths: readonly string[],
  progress?: (done: number, total: number) => void,
) {
  const unique = [...new Set(paths.filter(Boolean))];
  let done = unique.filter(assetReady).length;
  progress?.(done, unique.length);
  const results = await Promise.allSettled(
    unique.filter((path) => !assetReady(path)).map(async (path) => {
      await preloadImage(path);
      progress?.(++done, unique.length);
    }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
