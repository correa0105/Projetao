// Only legacy default colors are upgraded. Saved/custom user colors remain their chosen value.
export const vividEffectPalette: Record<string, readonly [string, string]> = {
  frost: ['#9dd7ef', '#73dcff'],
  poison: ['#92b65f', '#96df45'],
  heal: ['#99d5aa', '#64e89a'],
  arcane: ['#b79aef', '#aa6bff'],
  shield: ['#73c9eb', '#34c1ef'],
  radiant: ['#f2cf79', '#ffd05a'],
  shadow: ['#9270b7', '#a85ddd'],
  acid: ['#b5d74f', '#c2ea48'],
  leaves: ['#a9c376', '#97d14f'],
  petals: ['#e9a5c4', '#ef84bd'],
  starfield: ['#b9abff', '#a087ff'],
  spores: ['#b7d782', '#acd955'],
};
export function effectRenderColor(kind: string, color: string) {
  const palette = vividEffectPalette[kind];
  return palette && color.toLowerCase() === palette[0] ? palette[1] : color;
}
