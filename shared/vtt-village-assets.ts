import catalog from './vtt-village-catalog.json';
import animals from './vtt-animal-catalog.json';
import type {VttToken} from './vtt';
export const villageAssets=catalog;
const residents=new Map([...catalog,...animals].filter(a=>'actor' in a&&a.actor).map(a=>[a.image,a]));
export function residentAsset(token:Pick<VttToken,'image'|'layer'>){return token.layer==='tokens'?residents.get(token.image):undefined;}
/** Idle villagers and animals do not uncover buildings until they become the active viewpoint. */
export function houseViewActors(actors:VttToken[],gm:boolean,userId:string,selected:readonly string[],viewerId?:string){
 return actors.filter(t=>!residentAsset(t)||(gm&&selected.includes(t.id))||!!userId&&t.controller===userId||t.id===viewerId);
}
