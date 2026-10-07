export type User = {
  id: string;
  name: string;
  email: string;
  role?: 'player' | 'staff' | 'admin';
  administrador?: 0 | 1;
  gold_unlimited?: boolean;
  canEditKingdom?: boolean;
};
export type Character = {
  species_size?: string;
  portrait_revision: number;
  art_used: number;
  art_unlimited?: boolean;
  art_pending: boolean;
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  biography: string;
  level: number;
  experience: number;
  progression_missions: number;
  hp: number;
  armor_class: number;
  gold_cp: number;
  gold_unlimited?: boolean;
  stats: number[];
};
export type Item = {
  id: string;
  name: string;
  original_name: string;
  category: string;
  description: string;
  price_cp: number | null;
  image_path?: string | null;
  audio_path?: string | null;
  merchant_comment?: string;
  magic_family?: string | null;
  base_item?: string | null;
  damage_type?: string | null;
  rarity?: string | null;
  variant?: string | null;
  enhancement?: number | null;
  magic_kind?: 'weapon' | 'armor' | null;
  raw_data?: import('../shared/equipment-target').EquipmentMetadata | null;
  weight_estimated?: boolean;
  weight_lb: string;
  source: string;
  source_url: string;
  quantity?: number;
};
export type Details = {
  inventory: Item[];
  achievements: { code: string; unlocked_at: string }[];
  history: { id: string; name: string; quantity: number; total_cp: number; created_at: string }[];
};
export type EquippedItem = Item & { slot: import('../shared/equipment').EquipmentSlot };
export type StorageState = {
  inventory: Item[];
  vault: Item[];
  equipped: EquippedItem[];
  companion_allocated?: Record<string, number>;
};
export type Post = {
  paper_style: import('../shared/notice-board').PaperStyle;
  paper_summary: string;
  paper_x: number;
  paper_y: number;
  id: string;
  author_id: string | null;
  author_name: string | null;
  kind: 'mission' | 'event' | 'hook';
  rank_test_level: number | null;
  mission_rank: import('../shared/progression').Rank;
  status: 'open' | 'active' | 'completed' | 'closed';
  title: string;
  description: string;
  location: string;
  region_id: string | null;
  location_id: string | null;
  difficulty: string;
  reward_cp: number;
  participants: number;
  my_characters: string[];
  starts_at: string | null;
  completion_summary: string | null;
  source_mission_id: string | null;
  source_mission_title: string | null;
  rewards: {
    name: string;
    experience: number;
    gold_cp: number;
    progression_credit: number | null;
    level_after: number | null;
    rank_promoted: boolean;
  }[];
};
export type AtlasRegion = { id: string; name: string; description: string; available: boolean };
export type AtlasLocation = {
  id: string;
  region_id: string;
  name: string;
  description: string;
  map_x: number;
  map_y: number;
};
export type AtlasData = { regions: AtlasRegion[]; locations: AtlasLocation[] };
export type Entry = {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  body: string;
  tag: string;
};
export type Page =
  | 'tower'
  | 'overview'
  | 'characters'
  | 'profile'
  | 'inventory'
  | 'achievements'
  | 'missions'
  | 'board'
  | 'hooks'
  | 'shop'
  | 'stable'
  | 'pets'
  | 'events'
  | 'titles'
  | 'cards'
  | 'character-cards'
  | 'vtt'
  | 'hall'
  | 'profiles'
  | 'house'
  | 'world'
  | 'lore'
  | 'rules';
