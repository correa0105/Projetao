export type ChatPart =
  { kind: 'text'; text: string } | { kind: 'image'; label: string; url: string };

export function chatImageUrl(value: string): string | null {
  const raw = value.trim();
  // Matches the deployed image CSP. Relative images remain on this site.
  if (/^\/(?!\/)/.test(raw) && !/[\\\s\u0000-\u001f]/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function chatImageParts(text: string): ChatPart[] {
  const pattern = /\(([^()\n]*)\)\[([^\[\]\n]+)\]|\[([^\[\]\n]*)\]\(([^()\n]+)\)/g;
  const parts: ChatPart[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const url = chatImageUrl(match[2] ?? match[4]);
    if (!url) continue;
    if (match.index! > end) parts.push({ kind: 'text', text: text.slice(end, match.index) });
    parts.push({ kind: 'image', label: (match[1] ?? match[3]).trim() || 'Imagem', url });
    end = match.index! + match[0].length;
  }
  if (end < text.length || !parts.length) parts.push({ kind: 'text', text: text.slice(end) });
  return parts;
}
