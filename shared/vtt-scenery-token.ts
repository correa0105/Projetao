import type {VttToken} from './vtt';
/** Only this placed instance changes; its library entry remains scenery. */
export function convertSceneryToToken(token:VttToken){
  if(token.layer!=='map'&&!token.sceneryToken)return false;
  token.layer='tokens';token.sceneryToken=true;token.bleeds=false;token.blood=null;
  token.hp=0;token.maxHp=1;token.ac=0;token.conditions=[];
  token.vision=0;token.deathAt=null;token.deathAutomatic=false;token.bossStyle=null;
  return true;
}
