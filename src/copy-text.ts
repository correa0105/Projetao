/** Radmin/LAN HTTP pages do not expose the secure Clipboard API. */
export async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text);
  const previous = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text; field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-10000px;top:0';
  document.body.append(field); field.select();
  try { if (!document.execCommand('copy')) throw new Error('Selecione o link e copie manualmente.'); }
  finally { field.remove(); if (previous instanceof HTMLElement) previous.focus(); }
}
