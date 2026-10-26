export const adminScopes = ['lore', 'rules', 'home', 'world'] as const;
export type AdminScope = (typeof adminScopes)[number];
export const adminScopeNames: Record<AdminScope, string> = {
  lore: 'Lore',
  rules: 'Regras',
  home: 'Início',
  world: 'Mundo',
};
