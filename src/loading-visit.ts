const key='alvorada-initial-load-complete-v1';
let completed=false;
export function initialLoadComplete() {
  try { return completed || localStorage.getItem(key)==='1'; }
  catch { return completed; }
}
export function markInitialLoadComplete() {
  completed=true;
  try { localStorage.setItem(key,'1'); } catch { /* Still remember this visit. */ }
}
