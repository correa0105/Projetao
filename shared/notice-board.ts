export const PAPER_STYLES = [
  'parchment',
  'letter',
  'proclamation',
  'vellum',
  'chronicle',
  'seal',
] as const;
export type PaperStyle = (typeof PAPER_STYLES)[number];
export const PAPER_LABELS: Record<PaperStyle, string> = {
  parchment: 'Pergaminho',
  letter: 'Carta',
  proclamation: 'Edital',
  vellum: 'Velino',
  chronicle: 'Crônica',
  seal: 'Selo',
};
// Fractions of the usable board. Coordinates span the remaining travel area,
// so the whole sheet stays inside the wood at every viewport size.
export const PAPER_WIDTH = 0.18;
export const PAPER_HEIGHT = 0.42;
