import repairs from './house-view-repairs.json';
type ViewRepair = { image: string; width: number };
export function houseViewRepair(id: string, facing: number): ViewRepair | undefined {
  return (repairs as Record<string, Record<string, ViewRepair>>)[id]?.[facing];
}
