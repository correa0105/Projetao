// An open tab may still reference a page chunk from the previous publication.
// Recover once, preserving the current route and preventing reload loops.
addEventListener('vite:preloadError', (event) => {
  const failure = event as Event & { payload?: unknown };
  const message = String(failure.payload || '');
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message)) return;
  try {
    const key = 'alvorada-page-load-recovery';
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - previous < 60000) return;
    sessionStorage.setItem(key, String(Date.now()));
    event.preventDefault();
    location.reload();
  } catch {
    // Keep the normal retry screen if storage is unavailable.
  }
});
