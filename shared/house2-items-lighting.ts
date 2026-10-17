export type House2Light = {
  radius: number;
  color: string;
  pulse: number;
  strength: number;
  sound: 'lamp' | 'fire' | 'candle';
};
const lamp: House2Light = {
    radius: 5,
    color: '#ffc56b',
    pulse: 3.7,
    strength: 0.18,
    sound: 'lamp',
  },
  candle: House2Light = {
    radius: 2.4,
    color: '#ffd58b',
    pulse: 2.6,
    strength: 0.12,
    sound: 'candle',
  },
  fire: House2Light = { radius: 6, color: '#ffad46', pulse: 1.8, strength: 0.24, sound: 'fire' };
export const house2LightItems: Record<string, House2Light> = {
  'furniture-031': lamp,
  'furniture-032': candle,
  'furniture-033': fire,
  'furniture-034': fire,
  'furniture-035': fire,
  'furniture-143': fire,
  'furniture-144': fire,
  'furniture-145': candle,
  'furniture-146': lamp,
  'outdoor-048': fire,
  'urban-035': fire,
  'h2-candle': candle,
  'h2-firepit': fire,
};
export const house2ExtraLightItems = [
  {
    id: 'h2-candle',
    name: 'Velas em suporte',
    category: 'Iluminação',
    width: 0.6,
    height: 0.6,
    image: '/vtt/animated-assets-20261009/candles.webp',
  },
  {
    id: 'h2-firepit',
    name: 'Fogueira de pedras',
    category: 'Iluminação',
    width: 1.8,
    height: 1.8,
    image: '/vtt/animated-assets-20261009/firepit.webp',
  },
];
