import furniture from './vtt-home-furniture-catalog.json';
import plants from './vtt-plants-catalog.json';
import village from './vtt-village-catalog.json';
import {houseAssets} from './vtt-houses';
export type NatureAsset={id:string;name:string;category:string;width:number;height:number;image:string;interior?:string;thumbnail?:string;actor?:boolean;notes?:string;species?:string;bodyScale?:number};
export const natureAssets:NatureAsset[]=[...plants,...houseAssets,...furniture,...village];
export const natureCategories=[...new Set(natureAssets.map(a=>a.category))];
export const natureAssetMime='application/x-alvorada-nature';
