import type { PoolClient } from 'pg';
import { z } from 'zod';
import { AppError } from './services.js';

export const atlasId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function resolvePostLocation(
  client: PoolClient,
  data: { location_id?: string; location?: string },
) {
  if (!data.location_id) {
    if (!data.location) throw new AppError(400, 'Informe o local da aventura.');
    return { location: data.location, location_id: null, region_id: null };
  }

  // Lock both records until publication commits, including the availability decision.
  const {
    rows: [location],
  } = await client.query(
    `SELECT l.id,l.region_id,l.name,r.available
     FROM world_locations l JOIN world_regions r ON r.id=l.region_id
     WHERE l.id=$1 FOR SHARE OF l,r`,
    [data.location_id],
  );
  if (!location) throw new AppError(400, 'O local escolhido não existe no mapa.');
  if (!location.available)
    throw new AppError(409, 'Esta região ainda não está disponível para aventuras.');
  return { location: location.name, location_id: location.id, region_id: location.region_id };
}
