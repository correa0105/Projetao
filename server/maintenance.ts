import {
  maintenanceMessage,
  parseMaintenanceAreas,
  type MaintenanceArea,
} from '../shared/maintenance.js';
import { AppError } from './services.js';
import { administrationFor } from './administrators.js';

export const maintenanceAreas = () => parseMaintenanceAreas(process.env.MAINTENANCE_AREAS);
export async function requireAreaAvailable(area: MaintenanceArea, userId: string) {
  if (maintenanceAreas().includes(area) && !(await administrationFor(area).has(userId)))
    throw new AppError(503, maintenanceMessage(area));
}
