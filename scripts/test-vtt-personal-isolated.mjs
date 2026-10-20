import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('PostgreSQL local obrigatório.');
const admin = new pg.Pool({connectionString:url.toString()}),database='alvorada_test_'+randomUUID().replaceAll('-','');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname='/'+database;
  const args=process.argv.includes('--browser')
    ? ['--import','tsx','scripts/smoke-vtt-personal.ts']
    : ['--import','tsx','--test','--test-concurrency=1',...(process.argv.includes('--art')?['tests/character-token-art.test.ts','tests/equipment-illustrator.test.ts','tests/companion-illustrator.test.ts','tests/companion-token-illustrator.test.ts','tests/magic-armor-appearance.test.ts']:process.argv.includes('--all')?['tests/*.test.ts']:process.argv.includes('--personal-only')?['tests/vtt-personal.test.ts']:['tests/vtt-personal.test.ts','tests/vtt-social.test.ts','tests/vtt-sounds-api.test.ts','tests/vtt-premium.test.ts','tests/account-preview.test.ts'])];
  process.exitCode=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env:{...process.env,DATABASE_URL:url.toString(),NODE_ENV:'test'},stdio:'inherit',windowsHide:true});
    child.on('error',reject);child.on('exit',code=>resolve(code??1));
  });
}finally{await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();}
