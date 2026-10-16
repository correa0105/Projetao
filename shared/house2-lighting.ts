export const house2DayPhases = {
  morning: {
    name: 'Manhã',
    dx: 1.75,
    dy: 0.95,
    blur: 0.23,
    opacity: 0.38,
    tint: '#f1d7a6',
    tintOpacity: 0.045,
  },
  afternoon: {
    name: 'Tarde',
    dx: -0.48,
    dy: 0.38,
    blur: 0.16,
    opacity: 0.38,
    tint: '#e6d4b1',
    tintOpacity: 0,
  },
  dusk: {
    name: 'Entardecer',
    dx: -2.3,
    dy: 1.1,
    blur: 0.34,
    opacity: 0.44,
    tint: '#b96735',
    tintOpacity: 0.14,
  },
  night: {
    name: 'Anoitecer',
    dx: 0,
    dy: 0.12,
    blur: 0.26,
    opacity: 0.26,
    tint: '#101a38',
    tintOpacity: 0.55,
  },
} as const;
export type House2DayPhase = keyof typeof house2DayPhases;
