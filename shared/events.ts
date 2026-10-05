import { z } from 'zod';
import { safeHomeLink } from './home-updates.js';
import { calendarBackgrounds } from './calendar-art.js';
export const eventBackgrounds = [
  { path: '/notice-village-empty-v4.png', label: 'Rua da vila' },
  { path: '/events/hall-v1.webp', label: 'Salão dos encontros' },
  { path: '/alvorada-dawn-banner.png', label: 'Alvorada nas montanhas' },
  { path: '/notice-village-tavern-v3.png', label: 'Taverna da vila' },
  { path: '/character-camp-v2.png', label: 'Acampamento' },
  ...calendarBackgrounds,
];
export const artAnimations = ['none', 'float', 'sway', 'breathe', 'glow', 'drift'] as const;
export const artAnimationNames = {
  none: 'Parada',
  float: 'Flutuar',
  sway: 'Balançar',
  breathe: 'Respirar',
  glow: 'Brilhar',
  drift: 'Deslizar',
};
const imagePath = z
  .string()
  .max(200)
  .refine(
    (v) =>
      !v ||
      eventBackgrounds.some((b) => b.path === v) ||
      /^\/api\/event-images\/[0-9a-f-]{36}$/.test(v),
    'Escolha uma arte da galeria ou envie uma imagem.',
  );
export { imagePath as eventImagePathSchema };
export const eventLayerSchema = z
  .object({
    id: z.string().uuid(),
    path: imagePath,
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(2).max(100),
    opacity: z.number().min(0.05).max(1),
    animation: z.enum(artAnimations),
    behind: z.boolean(),
  })
  .strict();
export const eventSceneSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    subtitle: z.string().trim().max(500),
    background: imagePath,
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    darkness: z.number().min(0).max(0.95),
    ambient: z.enum(['embers', 'mist', 'none']),
    layers: z.array(eventLayerSchema).max(60),
  })
  .strict()
  .refine(
    (v) => new Set(v.layers.map((l) => l.id)).size === v.layers.length,
    'Há artes repetidas.',
  );
export const eventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    description: z.string().trim().min(1).max(3000),
    starts_at: z.string().datetime({ offset: true }).nullable(),
    location: z.string().trim().max(100),
    status: z.enum(['open', 'active', 'completed', 'closed']),
    presentation: z
      .object({
        eyebrow: z.string().trim().max(80),
        image: imagePath,
        animation: z.enum(artAnimations),
        featured: z.boolean(),
        link: z
          .string()
          .trim()
          .max(2000)
          .refine(safeHomeLink, 'Use uma página do site ou um link http/https.'),
      })
      .strict(),
  })
  .strict();
export type EventScene = z.infer<typeof eventSceneSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type GuildEvent = EventInput & {
  id: string;
  event_revision: number;
  author_name: string;
  created_at: string;
};
export const defaultEventScene: EventScene = {
  title: 'Onde as histórias se encontram.',
  subtitle:
    'Celebrações, encontros e chamados da Alvorada. A próxima memória da guilda começa aqui.',
  background: eventBackgrounds[0].path,
  x: 50,
  y: 50,
  darkness: 0.42,
  ambient: 'none',
  layers: [],
};
export const blankEvent: EventInput = {
  title: '',
  description: '',
  starts_at: null,
  location: '',
  status: 'open',
  presentation: {
    eyebrow: 'Encontro da Alvorada',
    image: '',
    animation: 'float',
    featured: false,
    link: '',
  },
};
