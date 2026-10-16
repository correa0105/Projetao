import { createAuthClient } from 'better-auth/react';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { accountPreviewHeaders } from './account-preview';
export const authClient = createAuthClient();
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...accountPreviewHeaders(),
      ...(path.startsWith('/vtt') ? { 'X-Vtt-Schema-Version': String(vttProtocolVersion) } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}
export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
