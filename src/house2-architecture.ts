import { house2Houses } from '../shared/house-v2';

/** Both clients share orthographic art without changing saved transforms. */
export function house2Architecture(id: string) {
  const house = house2Houses.find((house) => house.id === id);
  if (!house) return undefined;
  return {
    interior: house.interior,
    roof: house.image,
    roofScale: 1,
  };
}

export const house2CutawayImage = (id: string) => house2Architecture(id)?.interior;
