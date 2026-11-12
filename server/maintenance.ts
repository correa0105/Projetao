import {
  maintenanceMessage,
  launchLockedAreas,
  parseMaintenanceAreas,
  type MaintenanceArea,
} from '../shared/maintenance.js';
import { AppError } from './services.js';
import { administrationFor } from './administrators.js';

export const maintenanceAreas = () => [
  ...new Set([...launchLockedAreas, ...parseMaintenanceAreas(process.env.MAINTENANCE_AREAS)]),
];
export async function requireAreaAvailable(area: MaintenanceArea, userId: string) {
  if (
    launchLockedAreas.includes(area) ||
    (maintenanceAreas().includes(area) &&
      !(await administrationFor(area === 'cristais' ? 'tower' : area).has(userId)))
  )
    throw new AppError(503, maintenanceMessage(area));
}
