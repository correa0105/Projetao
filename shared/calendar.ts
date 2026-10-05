import { z } from 'zod';
import { eventImagePathSchema, type GuildEvent } from './events';
export const calendarTimeZone = 'America/Sao_Paulo';
export const calendarSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    subtitle: z.string().trim().max(500),
    background: eventImagePathSchema,
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    week_start: z.enum(['monday', 'sunday']),
  })
  .strict();
export type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
export const defaultCalendarSettings: CalendarSettings = {
  title: 'Calendário',
  subtitle: '',
  background: '',
  accent: '#c7a66a',
  week_start: 'monday',
};
export type CalendarEntry = {
  id: string;
  source: 'event' | 'mission' | 'publication';
  title: string;
  description: string;
  starts_at: string;
  location: string;
  status: string;
  image: string;
  event?: GuildEvent;
};
export type CalendarResponse = {
  document: CalendarSettings;
  revision: number;
  can_edit: boolean;
  entries: CalendarEntry[];
};
export function calendarDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: calendarTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
