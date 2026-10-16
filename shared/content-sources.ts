/** Sources withdrawn by the project owner. Tasha (TCE) remains permitted. */
export const withdrawnSources: readonly string[] = ['AU'];

export function permittedSource(source: string | undefined | null): boolean {
  return !withdrawnSources.includes(source ?? '');
}
