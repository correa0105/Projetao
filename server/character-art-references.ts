// Keep role ordering and equipment numbers aligned with the native tool's five-image limit.
export function characterArtReferences(input: {
  style: string;
  reference?: string;
  companion: boolean;
  equipmentPaths: string[];
  sheetPath: string;
  hornReference?: string;
  warforgedReferences: string[];
}) {
  const subject = input.companion ? [] : [input.style];
  if (input.reference) subject.push(input.reference);
  const details = [
    ...(input.hornReference ? [input.hornReference] : []),
    ...input.warforgedReferences,
  ];
  const useSheet = input.equipmentPaths.length > 5 - subject.length - details.length;
  return {
    useSheet,
    equipmentImageStart: subject.length + 1,
    references: [...subject, ...(useSheet ? [input.sheetPath] : input.equipmentPaths), ...details],
  };
}
