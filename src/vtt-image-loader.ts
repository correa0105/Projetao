/** A transient request failure must not leave saved terrain permanently blank. */
export function createVttImageLoader(
  images: Map<string, HTMLImageElement>,
  source: (path: string) => string,
  changed: () => void,
  failed: () => void,
) {
  type Task = {
    attempt: number;
    timer?: ReturnType<typeof setTimeout>;
    timeout?: ReturnType<typeof setTimeout>;
    image?: HTMLImageElement;
  };
  const pending = new Map<string, Task>();
  let disposed = false;
  function start(path: string) {
    if (disposed) return;
    const task = pending.get(path);
    if (!task) return;
    clearTimeout(task.timer);
    clearTimeout(task.timeout);
    task.timer = undefined;
    const image = new Image();
    task.image = image;
    images.set(path, image);
    const current = () => !disposed && task.image === image && pending.get(path) === task;
    const fail = () => {
      if (!current()) return;
      clearTimeout(task.timeout);
      image.onload = image.onerror = null;
      changed();
      if (task.attempt < 4) {
        const delay = [300, 800, 2000, 5000][task.attempt++];
        task.timer = setTimeout(() => start(path), delay);
      } else failed();
    };
    const done = () => {
      if (!current()) return;
      clearTimeout(task.timeout);
      image.onload = image.onerror = null;
      pending.delete(path);
      changed();
    };
    image.onload = () => {
      if (typeof image.decode === 'function') void image.decode().then(done, fail);
      else done();
    };
    image.onerror = fail;
    task.timeout = setTimeout(fail, 45000);
    image.src = source(path);
  }
  function ready(path: string) {
    return !path || (!pending.has(path) && !!images.get(path)?.naturalWidth);
  }
  function load(path: string) {
    if (!path || disposed || pending.has(path) || ready(path)) return;
    pending.set(path, { attempt: 0 });
    start(path);
  }
  function retry() {
    for (const [path, task] of pending) {
      task.attempt = 0;
      start(path);
    }
  }
  function dispose() {
    disposed = true;
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      clearTimeout(task.timeout);
      if (task.image) task.image.onload = task.image.onerror = null;
    }
    pending.clear();
  }
  return { load, retry, dispose, ready };
}
