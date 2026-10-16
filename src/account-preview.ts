export const accountPreviewKey = 'alvorada-account-preview';
export function readAccountPreview(): { userId: string; active: boolean } | null {
  try {
    return JSON.parse(sessionStorage.getItem(accountPreviewKey) || 'null');
  } catch {
    return null;
  }
}
export function accountPreviewHeaders(): Record<string, string> {
  return readAccountPreview()?.active ? { 'X-Account-Preview': 'basic' } : {};
}
export const basicAccountPreview = () => readAccountPreview()?.active === true;
