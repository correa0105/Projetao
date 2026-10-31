export const vttPersonalHref = (id: string) => '#vtt?table=' + encodeURIComponent(id);
/** Invitation URLs use the address from which the player is accessing the site. */
export const vttInviteHref = (invite: string) => '#vtt?invite=' + encodeURIComponent(invite);
export const vttRoomHref = (id: string) => '#vtt?room=' + encodeURIComponent(id);
export type VttEntryTarget = { kind: 'table' | 'invite' | 'room'; id: string };
/** Parse a table address without navigating to its host; access remains server-authorized. */
export function vttEntryTarget(value: string): VttEntryTarget | null {
  const input = value.trim();
  if (/^[0-9a-f]{48}$/.test(input)) return { kind: 'invite', id: input };
  try {
    const url = new URL(input, 'http://localhost');
    if (!['http:', 'https:'].includes(url.protocol) || url.hash.split('?')[0] !== '#vtt')
      return null;
    const params = new URLSearchParams(url.hash.split('?')[1] || '');
    const targets = (['table', 'invite', 'room'] as const).filter((key) => params.has(key));
    if (targets.length !== 1 || params.getAll(targets[0]).length !== 1) return null;
    const kind = targets[0],
      id = params.get(kind)!;
    const valid =
      kind === 'invite'
        ? /^[0-9a-f]{48}$/.test(id)
        : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    return valid ? { kind, id } : null;
  } catch {
    return null;
  }
}
export function vttInviteCode(value: string): string | null {
  const input = value.trim();
  if (/^[0-9a-f]{48}$/.test(input)) return input;
  try {
    const url = new URL(input, 'http://localhost');
    const code = new URLSearchParams(url.hash.split('?')[1] || '').get('invite');
    return code && /^[0-9a-f]{48}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
