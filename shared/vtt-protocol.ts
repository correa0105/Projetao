export const vttProtocolVersion = 10;
export const vttUpdateMessage =
  'A mesa foi atualizada. Recarregue a página para usar a versão atual. Os dados salvos continuam preservados.';

export function vttErrorMessage(error: unknown) {
  return error instanceof Error && error.name === 'ZodError'
    ? vttUpdateMessage
    : error instanceof Error
      ? error.message
      : 'Não foi possível concluir a ação na mesa.';
}
