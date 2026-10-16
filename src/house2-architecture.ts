/** House 2.0 artwork is independent of the shared VTT catalog and saved transforms. */
export function house2Architecture(id: string) {
  const match = /^house-empty-(001|002|003)$/.exec(id);
  if (!match) return undefined;
  return {
    interior: `/house2/interior-plan-${match[1]}-v3-20261016.webp`,
    roof: `/house2/roof-plan-${match[1]}-v1-20261016.webp`,
    roofScale: 1.04,
  };
}

export const house2CutawayImage = (id: string) => house2Architecture(id)?.interior;
