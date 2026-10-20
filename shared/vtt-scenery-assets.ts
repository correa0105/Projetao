import catalog from './vtt-scenery-catalog.json';
export const sceneryAssetMime = 'application/x-alvorada-scenery';
export type SceneryAsset = {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  image: string;
};
export const sceneryAssets: SceneryAsset[] = catalog;
