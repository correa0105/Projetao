import visuals from './vtt-asset-visuals.json';
type Visual={image:string;thumbnail:string};
const sources:Record<string,Visual>=visuals;
/** Resolve stored logical URLs without changing scene identities or catalog lookups. */
export const vttVisualSource=(path:string)=>sources[path]?.image??path;
export const vttVisualThumbnail=(path:string,fallback?:string)=>sources[path]?.thumbnail??fallback??path;
