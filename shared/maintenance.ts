export const MAINTENANCE_LABELS = { events: 'Eventos', tower: 'Torre', cristais: 'Loja de Cristais' } as const;
export type MaintenanceArea = keyof typeof MAINTENANCE_LABELS;
export const launchLockedAreas: readonly MaintenanceArea[] = ['tower', 'cristais'];

export function parseMaintenanceAreas(value = ''): MaintenanceArea[] {
  return [...new Set(value.split(',').map((area) => area.trim()))].filter(
    (area): area is MaintenanceArea => Object.hasOwn(MAINTENANCE_LABELS, area),
  );
}

export function maintenanceMessage(area: MaintenanceArea) {
  if (launchLockedAreas.includes(area))
    return `${MAINTENANCE_LABELS[area]} será liberada em uma próxima etapa do servidor.`;
  return `${MAINTENANCE_LABELS[area]} em manutenção. Esta ala estará disponível novamente em breve.`;
}
