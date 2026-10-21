export const MAINTENANCE_LABELS = { events: 'Eventos', tower: 'Torre' } as const;
export type MaintenanceArea = keyof typeof MAINTENANCE_LABELS;

export function parseMaintenanceAreas(value = ''): MaintenanceArea[] {
  return [...new Set(value.split(',').map((area) => area.trim()))].filter(
    (area): area is MaintenanceArea => Object.hasOwn(MAINTENANCE_LABELS, area),
  );
}

export function maintenanceMessage(area: MaintenanceArea) {
  return `${MAINTENANCE_LABELS[area]} em manutenção. Esta ala estará disponível novamente em breve.`;
}
