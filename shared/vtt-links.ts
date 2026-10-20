export const vttPersonalHref = (id: string) => '#vtt?table=' + encodeURIComponent(id);
/** Invitation URLs use the address from which the player is accessing the site. */
export const vttInviteHref = (invite: string) => '#vtt?invite=' + encodeURIComponent(invite);
export const vttRoomHref = (id: string) => '#vtt?room=' + encodeURIComponent(id);
export function vttInviteCode(value: string): string | null {
  const input = value.trim();
  if (/^[0-9a-f]{48}$/.test(input)) return input;
  try {
    const url = new URL(input, 'http://localhost');
    const code = new URLSearchParams(url.hash.split('?')[1] || '').get('invite');
    return code && /^[0-9a-f]{48}$/.test(code) ? code : null;
  } catch { return null; }
}
