import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const target=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port==='5437')throw Error('PostgreSQL local obrigatório.');
const admin=new pg.Pool({connectionString:target.toString()});
const database='alvorada_test_'+randomUUID().replaceAll('-','');
await admin.query(`CREATE DATABASE "${database}"`);
try {
 target.pathname='/'+database;
 process.exitCode=await new Promise((resolve,reject)=>{
  const args=process.argv.includes('--browser')?['--import','tsx','scripts/smoke-themed-equipment-art.ts']:['--import','tsx','--test','tests/thematic-equipment-art.test.ts'];
  const child=spawn(process.execPath,args,{env:{...process.env,DATABASE_URL:target.toString(),NODE_ENV:'test'},stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('exit',code=>resolve(code??1));
 });
} finally { await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end(); }
