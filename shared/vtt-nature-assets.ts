import plants from './vtt-plants-catalog.json';
import {houseAssets} from './vtt-houses';
export type NatureAsset={id:string;name:string;category:string;width:number;height:number;image:string;interior?:string};
export const natureAssets:NatureAsset[]=[...plants,...houseAssets];
export const natureAssetMime='application/x-alvorada-nature';
