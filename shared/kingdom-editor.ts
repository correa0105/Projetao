export const KINGDOM_EDITOR_CATALOG = [
  { kind: 'pine', label: 'Pinheiro', group: 'Natureza', height: 520 },
  { kind: 'oak', label: 'Carvalho', group: 'Natureza', height: 520 },
  { kind: 'rock', label: 'Rochas', group: 'Natureza', height: 240 },
  { kind: 'fortress', label: 'Fortaleza', group: 'Construções', height: 820 },
  { kind: 'tower', label: 'Torre', group: 'Construções', height: 680 },
  { kind: 'inn', label: 'Estalagem', group: 'Construções', height: 620 },
  { kind: 'cottage', label: 'Casa simples', group: 'Construções', height: 470 },
  { kind: 'shop', label: 'Loja', group: 'Construções', height: 470 },
  { kind: 'chapel', label: 'Capela', group: 'Construções', height: 580 },
  { kind: 'townhouse', label: 'Sobrado', group: 'Construções', height: 560 },
  { kind: 'stable', label: 'Estábulo', group: 'Construções', height: 510 },
  { kind: 'townhall', label: 'Prefeitura', group: 'Construções', height: 760 },
  { kind: 'warehouse', label: 'Armazém', group: 'Construções', height: 590 },
  { kind: 'forge', label: 'Forja', group: 'Construções', height: 500 },
  { kind: 'granary', label: 'Celeiro', group: 'Construções', height: 500 },
  { kind: 'tavern', label: 'Taverna', group: 'Construções', height: 540 },
  { kind: 'ranger', label: 'Posto de patrulha', group: 'Construções', height: 570 },
  { kind: 'barracks', label: 'Quartel', group: 'Construções', height: 640 },
  { kind: 'harbor', label: 'Capitania', group: 'Marcos', height: 650 },
  { kind: 'totem', label: 'Totem', group: 'Marcos', height: 590 },
  { kind: 'stoneCircle', label: 'Círculo de pedras', group: 'Marcos', height: 500 },
  { kind: 'sailboat', label: 'Veleiro', group: 'Marcos', height: 590 },
] as const;

export type KingdomEditorKind = (typeof KINGDOM_EDITOR_CATALOG)[number]['kind'];
export type KingdomEditorItem = {
  id: string;
  kind: KingdomEditorKind;
  x: number;
  y: number;
  height: number;
  direction: number;
};
export type KingdomEditorLayout = { revision: number; items: KingdomEditorItem[] };
