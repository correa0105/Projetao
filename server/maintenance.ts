import {
  maintenanceMessage,
  parseMaintenanceAreas,
  type MaintenanceArea,
} from '../shared/maintenance.js';
import { AppError } from './services.js';

export const maintenanceAreas = () => parseMaintenanceAreas(process.env.MAINTENANCE_AREAS);
export function requireAreaAvailable(area: MaintenanceArea) {
  if (maintenanceAreas().includes(area)) throw new AppError(503, maintenanceMessage(area));
}
