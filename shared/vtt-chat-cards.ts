export type ChatCardKind = 'arma' | 'magia';
export type ChatCard = { kind: ChatCardKind; name: string; description: string };

/** Cards remain ordinary saved messages; descriptions never execute commands. */
export function chatCard(text: string): ChatCard | null {
  if (text.length > 2000) return null;
  const match = /^\/(arma|magia)[ \t]+([^|\r\n]+)\|([\s\S]+)$/i.exec(text.trim());
  if (!match) return null;
  const name = match[2].trim(),
    description = match[3].trim();
  if (!name || name.length > 120 || !description) return null;
  return { kind: match[1].toLowerCase() as ChatCardKind, name, description };
}

/** Inserting a template preserves an existing draft or changes a card's kind. */
export function chatCardTemplate(kind: ChatCardKind, draft: string) {
  const existing = chatCard(draft);
  const name = existing?.name ?? (kind === 'arma' ? 'Nome da arma' : 'Nome da magia');
  const description =
    existing?.description ||
    draft.trim() ||
    (kind === 'arma'
      ? 'Descreva a arma, dano, alcance e propriedades.'
      : 'Descreva o ataque, dano, alcance e efeitos.');
  return `/${kind} ${name} | ${description}`;
}
