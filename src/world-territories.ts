/** World-space geography is independent of the close-up kingdom coordinates in SQL. */
export const WORLD_TERRITORIES = [
  { id: 'reino-do-norte', x: 0.3, y: 0.33, land: true },
  { id: 'northundria', x: 0.69, y: 0.27, land: true },
  { id: 'pomar-branco', x: 0.81, y: 0.69, land: true },
  { id: 'valdrakken', x: 0.86, y: 0.38, land: true },
  { id: 'skelliege', x: 0.13, y: 0.23, land: true },
  { id: 'marchas-do-poente', x: 0.16, y: 0.48, land: true },
  { id: 'dunas-de-auren', x: 0.57, y: 0.44, land: true },
  { id: 'costa-cinzenta', x: 0.35, y: 0.63, land: true },
  { id: 'olho-da-tormenta', x: 0.156, y: 0.673, land: false },
  { id: 'fulkushima', x: 1.04, y: 0.79, land: false },
  { id: 'coroa-da-geada', x: 0.305, y: 0.13, land: true },
  { id: 'vale-dos-pinheiros', x: 0.4103, y: 0.2795, land: true },
  { id: 'falesias-de-sal', x: 0.305, y: 0.72, land: true },
  { id: 'altos-de-boreal', x: 0.64, y: 0.115, land: true },
  { id: 'campos-de-vesper', x: 0.8, y: 0.185, land: true },
  { id: 'terras-de-ambar', x: 0.815, y: 0.53, land: true },
  { id: 'peninsula-de-lume', x: 0.77, y: 0.86, land: true },
  { id: 'escarpas-de-cinabrio', x: 0.9, y: 0.27, land: true },
  { id: 'vigias-do-gelo', x: 0.1902, y: 0.1254, land: true },
  { id: 'vale-do-cervo', x: 0.235, y: 0.46, land: true },
  { id: 'ermos-de-salvia', x: 0.69, y: 0.45, land: true },
  { id: 'portas-de-arenito', x: 0.55, y: 0.34, land: true },
] as const;

const STORM_INDEX = WORLD_TERRITORIES.findIndex((t) => t.id === 'olho-da-tormenta') + 1;

export function landTerritory(u: number, v: number) {
  // The entire broken archipelago around the eye belongs to the storm, not the mainland.
  if (inStormWaters(u, v)) return STORM_INDEX;
  // Gentle geographic warping avoids straight Voronoi seams across valleys.
  const x = u * 36 + Math.sin(v * 39 + Math.sin(u * 24)) * 0.42;
  const y = v * 20.25 + Math.sin(u * 47 + v * 13) * 0.33;
  let nearest = Infinity,
    index = 0;
  WORLD_TERRITORIES.forEach((territory, i) => {
    if (!territory.land) return;
    const d = (x - territory.x * 36) ** 2 + (y - territory.y * 20.25) ** 2;
    if (d < nearest) {
      nearest = d;
      index = i + 1;
    }
  });
  return index;
}

export function inStormWaters(u: number, v: number) {
  return (((u - 0.156) * 36) / 3.8) ** 2 + (((v - 0.673) * 20.25) / 2.8) ** 2 < 1;
}

export function seaTerritory(u: number, v: number) {
  if (inStormWaters(u, v)) return 'olho-da-tormenta';
  for (const t of WORLD_TERRITORIES) {
    if (t.land || t.id === 'olho-da-tormenta') continue;
    const dx = (u - t.x) * 36,
      dy = (v - t.y) * 20.25;
    const a = Math.atan2(-dy / 0.8, dx);
    const coast = 3.15 * (1 + 0.13 * Math.sin(a * 3 + 19.44) + 0.06 * Math.sin(a * 7 - 5.8725));
    if (Math.hypot(dx, dy / 0.8) < coast) return t.id;
  }
  return null;
}

/** Same partition as CPU picking, evaluated per fragment rather than in a pixelated ID map. */
export const TERRITORY_GLSL = `
vec3 worldDivision(vec2 uv) {
  vec2 p = vec2(uv.x * 36.0 + sin(uv.y * 39.0 + sin(uv.x * 24.0)) * 0.42,
                uv.y * 20.25 + sin(uv.x * 47.0 + uv.y * 13.0) * 0.33);
  float first = 1e6, second = 1e6, id = 0.0, secondId = 0.0;
  vec2 firstPoint = vec2(0.0), secondPoint = vec2(0.0);
  ${WORLD_TERRITORIES.map((territory, index) => ({ territory, index }))
    .filter(({ territory }) => territory.land)
    .map(
      ({ territory: t, index: i }) => `{
    vec2 anchor = vec2(${(t.x * 36).toFixed(6)}, ${(t.y * 20.25).toFixed(6)});
    float d = dot(p - anchor, p - anchor);
    if (d < first) {
      second = first; secondId = id; secondPoint = firstPoint;
      first = d; id = ${(i + 1).toFixed(1)}; firstPoint = anchor;
    } else if (d < second) { second = d; secondId = ${(i + 1).toFixed(1)}; secondPoint = anchor; }
  }`,
    )
    .join('\n')}
  float boundaryDistance = (second - first) / max(2.0 * length(secondPoint - firstPoint), 0.001);
  float pixelWidth = max(length(fwidth(p)), 0.0001);
  float border = 1.0 - smoothstep(pixelWidth * 0.25, pixelWidth * 0.8, boundaryDistance);
  float firstSelected = (1.0 - step(0.5, abs(id - worldHovered))) * step(0.5, worldHovered);
  float secondSelected = (1.0 - step(0.5, abs(secondId - worldHovered))) * step(0.5, worldHovered);
  float selected = mix(secondSelected, firstSelected, smoothstep(-pixelWidth * 0.6, pixelWidth * 0.6, boundaryDistance));
  vec2 storm = (uv - vec2(0.156, 0.673)) * vec2(36.0 / 3.8, 20.25 / 2.8);
  float stormDistance = length(storm);
  float stormBlend = 1.0 - smoothstep(1.0 - fwidth(stormDistance), 1.0 + fwidth(stormDistance), stormDistance);
  selected = mix(selected, 1.0 - step(0.5, abs(${STORM_INDEX.toFixed(1)} - worldHovered)), stormBlend);
  return vec3(id, border * (1.0 - stormBlend), selected);
}
`;
