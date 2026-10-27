export const adminScopes = [
  'lore',
  'rules',
  'home',
  'world',
  'board',
  'events',
  'tower',
  'vtt',
] as const;
export type AdminScope = (typeof adminScopes)[number];
export const adminScopeNames: Record<AdminScope, string> = {
  lore: 'Lore',
  rules: 'Regras',
  home: 'Início',
  world: 'Mundo',
  board: 'Mural',
  events: 'Eventos',
  tower: 'Torre',
  vtt: 'Mesa virtual',
};
