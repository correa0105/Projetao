import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {auth} from '../server/auth.js';
import {pool} from '../server/db.js';

const cohort=process.argv[2],output=process.argv[3];
if(!cohort||!/^beta-[a-z0-9-]+$/.test(cohort)||!output)throw Error('Uso: tsx scripts/setup-beta-accounts.ts beta-AAAAMMDD ARQUIVO_PRIVADO.json');
if(!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname))throw Error('Use o PostgreSQL local.');
const destination=path.resolve(output),relative=path.relative(process.cwd(),destination);
if(!relative.startsWith('..')&&!relative.startsWith('.local'+path.sep))throw Error('Salve as senhas fora do repositório ou em .local.');
type Access={number:number;email:string;password:string;userId?:string};
let records:Access[];
try{const old=JSON.parse(await fs.readFile(destination,'utf8'));if(old.cohort!==cohort)throw Error('Coorte diferente no arquivo existente.');records=old.accounts;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;records=Array.from({length:8},(_,i)=>({number:i+1,email:`${cohort}-${String(i+1).padStart(2,'0')}@alvorada.test`,password:randomBytes(18).toString('base64url')}));}
await fs.mkdir(path.dirname(destination),{recursive:true});
const persist=()=>fs.writeFile(destination,JSON.stringify({cohort,initialGoldPO:20000,accounts:records},null,2)+'\n',{mode:0o600});
try{
 await persist();
 for(const account of records){
  if(account.userId){const found=await pool.query('SELECT user_id FROM beta_accounts WHERE user_id=$1 AND cohort=$2',[account.userId,cohort]);if(found.rowCount===1)continue;const known=await pool.query('SELECT email FROM "user" WHERE id=$1',[account.userId]);if(known.rows[0]?.email!==account.email||!account.email.startsWith(cohort+'-'))throw Error('Registro beta incompleto; verifique antes de repetir.');await pool.query('INSERT INTO beta_accounts(user_id,cohort,initial_gold_cp) VALUES($1,$2,2000000)',[account.userId,cohort]);continue;}
  const existing=await pool.query('SELECT id FROM "user" WHERE email=$1',[account.email]);if(existing.rowCount)throw Error('Este e-mail já existe; nenhuma senha foi alterada.');
  const result=await auth.api.signUpEmail({body:{name:'Beta '+String(account.number).padStart(2,'0'),email:account.email,password:account.password}});
  account.userId=result.user.id;await persist();
  await pool.query('INSERT INTO beta_accounts(user_id,cohort,initial_gold_cp) VALUES($1,$2,2000000)',[account.userId,cohort]);
 }
 const result=await pool.query('SELECT count(*)::int count,min(initial_gold_cp)::int gold FROM beta_accounts WHERE cohort=$1',[cohort]);
 if(result.rows[0].count!==8||result.rows[0].gold!==2000000)throw Error('Conferência das oito contas falhou.');
 console.log('8 contas beta registradas; crédito único de 20.000 PO no primeiro personagem. Acessos salvos no arquivo privado solicitado.');
}finally{await pool.end();}
