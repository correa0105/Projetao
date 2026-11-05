import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { ART_GENERATION_LIMIT_MS, ArtGenerationDeadlineError, artGenerationTimeLeft, withArtGenerationDeadline } from '../server/art-generation-deadline.js';
import { runCodex } from '../server/codex-illustrator.js';

test('o prazo é total, não se renova entre etapas e não contamina outras execuções', async () => {
  assert.equal(ART_GENERATION_LIMIT_MS, 300_000);
  assert.equal(artGenerationTimeLeft(), Infinity);
  await withArtGenerationDeadline(new Date(Date.now()+1000), async () => {
    const before=artGenerationTimeLeft();
    await withArtGenerationDeadline(new Date(Date.now()+300_000), async () => {
      assert(artGenerationTimeLeft()<=before);
    });
    await assert.rejects(withArtGenerationDeadline(new Date(Date.now()-1),async () => artGenerationTimeLeft()),ArtGenerationDeadlineError);
    assert(artGenerationTimeLeft()>0);
  });
  assert.equal(artGenerationTimeLeft(), Infinity);
});

test('processo preso é interrompido pelo prazo compartilhado, antes do timeout de cada etapa', async () => {
  const temp=await mkdtemp(join(tmpdir(),'art-deadline-'));
  const entry=join(temp,'node_modules/@openai/codex/bin');
  await mkdir(entry,{recursive:true});
  await writeFile(join(entry,'codex.js'),'setInterval(()=>{},1000);');
  const saved={PATH:process.env.PATH,CODEX_BIN:process.env.CODEX_BIN};
  try {
    process.env.PATH=temp+delimiter+(saved.PATH??''); delete process.env.CODEX_BIN;
    const start=Date.now();
    await assert.rejects(withArtGenerationDeadline(new Date(start+150),()=>runCodex(['exec'],'',10_000)),ArtGenerationDeadlineError);
    assert(Date.now()-start<3000);
    await assert.rejects(withArtGenerationDeadline(new Date(Date.now()-1),()=>runCodex(['exec'])),ArtGenerationDeadlineError);
  } finally {
    for(const [name,value] of Object.entries(saved)) { if(value===undefined)delete process.env[name];else process.env[name]=value; }
    await rm(temp,{recursive:true,force:true});
  }
});
