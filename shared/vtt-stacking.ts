import type { VttToken } from './vtt';
import { attachmentRoot } from './vtt-attachments';

export type StackAction = 'front' | 'up' | 'down' | 'back';

/** Reorder only within a visual layer. Attached branches move together with their base. */
export function reorderVttItems(tokens: VttToken[], selection: string[], action: StackAction) {
  const chosen = new Set(
    tokens.filter((t) => selection.includes(t.id)).map((t) => attachmentRoot(tokens, t).id),
  );
  for (const layer of ['map', 'tokens', 'gm'] as const) {
    const roots = tokens
      .filter((t) => t.layer === layer && !t.attachment)
      .sort((a, b) => a.level - b.level);
    const ordered = [...roots];
    if (action === 'front' || action === 'back') {
      const active = ordered.filter((t) => chosen.has(t.id)),
        others = ordered.filter((t) => !chosen.has(t.id));
      ordered.splice(
        0,
        ordered.length,
        ...(action === 'front' ? [...others, ...active] : [...active, ...others]),
      );
    } else if (action === 'up') {
      for (let i = ordered.length - 2; i >= 0; i--)
        if (chosen.has(ordered[i].id) && !chosen.has(ordered[i + 1].id))
          [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
    } else {
      for (let i = 1; i < ordered.length; i++)
        if (chosen.has(ordered[i].id) && !chosen.has(ordered[i - 1].id))
          [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
    }
    if (ordered.every((t, i) => t.id === roots[i].id)) continue;
    ordered.forEach((t, i) => {
      t.level = i;
    });
  }
}
