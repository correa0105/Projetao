export type PlayerNotification = {
  id: string;
  characterId: string;
  characterName: string;
  kind: 'origin' | 'roll' | 'assignment' | 'rank' | 'level';
  title: string;
  description: string;
  target: 'profile' | 'board';
  action: string;
  level?: number;
};
