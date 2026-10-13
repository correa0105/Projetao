import catalog from './vtt-tree-catalog.json';
export const treeAssetMime = 'application/x-alvorada-tree';
export type TreeAsset = { id: string; name: string; group: string; squares: number; image: string };
export const treeAssets: TreeAsset[] = catalog;
