export type User = { id: string; name: string; email: string; role?: 'player' | 'staff' | 'admin' };
export type Character = {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  biography: string;
  level: number;
  experience: number;
  hp: number;
  armor_class: number;
  gold_cp: number;
  stats: number[];
};
export type Item = {
  id: string;
  name: string;
  original_name: string;
  category: string;
  description: string;
  price_cp: number;
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
export type Post = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  kind: 'mission' | 'event' | 'hook';
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
  rewards: { name: string; experience: number }[];
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
  | 'overview'
  | 'characters'
  | 'profile'
  | 'inventory'
  | 'achievements'
  | 'mercenaries'
  | 'missions'
  | 'board'
  | 'hooks'
  | 'shop'
  | 'house'
  | 'world'
  | 'lore'
  | 'rules';
