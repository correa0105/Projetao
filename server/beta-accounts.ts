import type {PoolClient} from 'pg';
/** Historical beta grant only. New creation/finalization use grantCharacterStartingGold. */
export async function grantBetaStartingGold(db:PoolClient,userId:string,characterId:string){
 const {rows:[grant]}=await db.query('UPDATE beta_accounts SET granted_at=now(),granted_character_id=$2 WHERE user_id=$1 AND granted_at IS NULL RETURNING initial_gold_cp',[userId,characterId]);
 if(!grant)return false;
 const result=await db.query('UPDATE characters SET gold_cp=gold_cp+$3,starting_wealth_granted=true WHERE id=$1 AND user_id=$2 RETURNING id',[characterId,userId,grant.initial_gold_cp]);
 if(result.rowCount!==1)throw Error('Personagem da conta beta não encontrado.');
 return true;
}
