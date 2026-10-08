import { z } from 'zod';
import catalog from './vtt-sound-catalog.json';
export type SoundKind = 'music' | 'ambience' | 'effect';
export type SoundEntry = {
  id: string;
  name: string;
  kind: SoundKind;
  category: string;
  path: string;
  duration: number;
  loop: boolean;
  volume: number;
  credit: string;
  description: string;
};
export const soundCatalog = catalog as SoundEntry[];
const byId = new Map(soundCatalog.map((s) => [s.id, s]));
export const soundSourceSchema = z
  .string()
  .refine(
    (s) =>
      byId.has(s) ||
      /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s),
    'Som inexistente.',
  );
export const soundSettingsSchema = z
  .object({
    sourceId: soundSourceSchema,
    channel: z.enum(['music', 'ambience', 'effect']),
    volume: z.number().min(0).max(1),
    loop: z.boolean(),
  })
  .strict();
export type SoundSettings = z.infer<typeof soundSettingsSchema>;
export const soundVoiceSchema = soundSettingsSchema
  .extend({ id: z.string().uuid(), startedAt: z.number().int().min(0).max(8640000000000000) })
  .strict();
export type SoundVoice = z.infer<typeof soundVoiceSchema>;
export const soundboardSchema = z
  .object({
    volume: z.number().min(0).max(1).default(0.8),
    settings: z.array(soundSettingsSchema).max(300).default([]),
    voices: z.array(soundVoiceSchema).max(16).default([]),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (
      new Set(s.settings.map((s) => s.sourceId)).size !== s.settings.length ||
      new Set(s.voices.map((s) => s.id)).size !== s.voices.length ||
      s.voices.some((v) => v.loop && s.voices.filter((w) => w.sourceId === v.sourceId).length > 1)
    )
      ctx.addIssue({ code: 'custom', message: 'Sons repetidos.' });
    if (s.voices.filter((v) => v.channel === 'music').length > 1)
      ctx.addIssue({ code: 'custom', message: 'Escolha uma música por vez.' });
    for (const v of [...s.settings, ...s.voices])
      if (byId.has(v.sourceId) && byId.get(v.sourceId)!.kind !== v.channel)
        ctx.addIssue({ code: 'custom', message: 'Categoria de áudio inválida.' });
  });
export type Soundboard = z.infer<typeof soundboardSchema>;
export const emptySoundboard = (): Soundboard => ({ volume: 0.8, settings: [], voices: [] });
export function soundEntry(sourceId: string): SoundEntry | undefined {
  return byId.get(sourceId);
}
export function soundPath(sourceId: string) {
  return (
    byId.get(sourceId)?.path ||
    (soundSourceSchema.safeParse(sourceId).success && sourceId.startsWith('asset:')
      ? '/api/vtt/assets/' + sourceId.slice(6)
      : '')
  );
}
export function soundSettings(sourceId: string, board: Soundboard): SoundSettings {
  const e = byId.get(sourceId);
  return (
    board.settings.find((s) => s.sourceId === sourceId) || {
      sourceId,
      channel: e?.kind || 'effect',
      volume: e?.volume ?? 0.65,
      loop: e?.loop ?? false,
    }
  );
}
export function soundAlive(v: SoundVoice, now = Date.now()) {
  return v.loop || now - v.startedAt < (byId.get(v.sourceId)?.duration ?? 300) * 1000 + 1500;
}
export const soundCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('play'),
      sourceId: soundSourceSchema,
      settings: soundSettingsSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal('stop'), sourceId: soundSourceSchema }).strict(),
  z.object({ kind: z.literal('settings'), settings: soundSettingsSchema }).strict(),
  z.object({ kind: z.literal('volume'), volume: z.number().min(0).max(1) }).strict(),
  z.object({ kind: z.literal('stopAll') }).strict(),
]);
export type SoundCommand = z.infer<typeof soundCommandSchema>;
export type SoundSnapshot = {
  revision: number;
  serverTime: number;
  soundboard: Soundboard;
  music: { assetId: string | null; playing: boolean; loop: boolean; volume: number };
};
