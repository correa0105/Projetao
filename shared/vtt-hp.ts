// A signed number changes PV; an unsigned number replaces the current value.
export function hpCommand(value: string, current: number, maximum: number) {
  const text = value.trim();
  if (!/^[+-]?\d+$/.test(text)) throw Error('Use um número, +quantidade ou -quantidade.');
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100000)
    throw Error('Quantidade inválida.');
  return Math.max(0, Math.min(maximum, /^[+-]/.test(text) ? current + amount : amount));
}
