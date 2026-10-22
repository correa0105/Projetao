import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { generateCharacterArt } from '../server/codex-illustrator.js';
import { characterArtReferences } from '../server/character-art-references.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { ART_CLOTHING_RULES } from '../shared/art-anatomy.js';
import {
  warforgedArtInstructions,
  warforgedBodyAtlas,
  warforgedHeadReference,
} from '../shared/warforged-appearance.js';

test('referências mantêm papéis, índices dos equipamentos e limite de cinco imagens', () => {
  for (const companion of [false, true])
    for (const uploaded of [false, true]) {
      if (companion && !uploaded) continue;
      for (const details of [[], ['body', 'head']])
        for (let count = 0; count <= 15; count++) {
          const equipmentPaths = Array.from({ length: count }, (_, i) => 'gear-' + i);
          const plan = characterArtReferences({
            style: 'style',
            reference: uploaded ? 'player' : undefined,
            companion,
            equipmentPaths,
            sheetPath: 'sheet',
            warforgedReferences: details,
          });
          assert(plan.references.length <= 5);
          assert.equal(plan.equipmentImageStart, companion || !uploaded ? 2 : 3);
          if (count)
            assert.equal(
              plan.references[plan.equipmentImageStart - 1],
              plan.useSheet ? 'sheet' : 'gear-0',
            );
          if (details.length) assert.deepEqual(plan.references.slice(-2), details);
          assert.equal(plan.references.includes('player'), uploaded);
        }
    }
});

test('ilustrador constrói Warforged sem foto, confere escolhas e corrige tecido atravessando pernas', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'warforged-cli-'));
  const entry = join(temp, 'node_modules/@openai/codex/bin');
  await mkdir(entry, { recursive: true });
  const fixture = join(temp, 'fixture.png'),
    capture = join(temp, 'capture.json');
  const image = await sharp({
    create: { width: 512, height: 768, channels: 4, background: '#00000000' },
  })
    .png()
    .toBuffer();
  await writeFile(fixture, image);
  // Exercise real CLI attachments, both review passes and the repair prompt without paid generation.
  await writeFile(
    join(entry, 'codex.js'),
    `
    const fs=require('node:fs'),path=require('node:path');
    const args=process.argv.slice(2), result=args[args.indexOf('--output-last-message')+1];
    let prompt=''; process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
      const state=fs.existsSync(${JSON.stringify(capture)})?JSON.parse(fs.readFileSync(${JSON.stringify(capture)})):{renders:[],reviews:[]};
      const review=JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema')+1])).properties.approved;
      const images=args.flatMap((v,i)=>v==='--image'?[args[i+1]]:[]);
      if(images.length>5||images.some(p=>!fs.existsSync(p)))process.exit(1);
      if(review){state.reviews.push(prompt);fs.writeFileSync(result,JSON.stringify({approved:true,clothing_correct:state.omitClothing?undefined:(state.acceptClothing||(state.reviews.length>1&&!state.rejectClothing)),selected_head_correct:state.omitHead?undefined:!state.rejectHead,appendages_correct:true,issues:[]}));}
      else {state.renders.push({prompt,images,hashes:images.map(p=>require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex'))});const output=path.join(args[args.indexOf('--cd')+1],'output.png');fs.copyFileSync(${JSON.stringify(fixture)},output);fs.writeFileSync(result,JSON.stringify({image_path:output,error:''}));}
      fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify(state));
    });
  `,
  );
  const originalPath = process.env.PATH,
    originalBin = process.env.CODEX_BIN;
  const choices = defaultChoices('Warforged', 'Guerreiro');
  choices.warforgedAppearance = {
    body: 'reinforced-arms',
    head: 'artificer',
    metal: 'copper',
    finish: 'rusted',
    accentEnabled: true,
    accentColor: '#123abc',
  };
  const hash = async (p: string) =>
    createHash('sha256')
      .update(await readFile(p))
      .digest('hex');
  const atlases = [
    warforgedBodyAtlas,
    warforgedHeadReference(choices.warforgedAppearance.head).atlas,
  ].map((p) => 'public' + p);
  const before = await Promise.all(atlases.map(hash));
  try {
    process.env.PATH = temp + delimiter + (originalPath || '');
    delete process.env.CODEX_BIN;
    assert.deepEqual(
      await generateCharacterArt({
        id: randomUUID(),
        race: 'Warforged',
        class: 'Guerreiro',
        reference: null,
        choices,
      }),
      image,
    );
    const state = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(state.renders.length, 2);
    assert.equal(state.reviews.length, 2);
    assert.equal(state.renders[0].images.length, 3);
    assert.match(state.renders[0].images[0], /character-style-v1\.png$/);
    assert(state.renders[0].images.every((p: string) => !p.endsWith('reference.png')));
    assert.match(state.renders[0].prompt, /CONSTRUÇÃO SEM IMAGEM DO JOGADOR/);
    const expectedHead = await sharp('public' + warforgedHeadReference('artificer').atlas).extract({left:512,top:512,width:512,height:512}).png().toBuffer();
    assert.equal(state.renders[0].hashes.at(-1), createHash('sha256').update(expectedHead).digest('hex'));
    assert.match(state.renders[0].images.at(-1), /selected-warforged-head\.png$/);
    assert.match(state.renders[0].prompt, /seleções ISOLADAS/);
    assert.match(state.renders[0].prompt, /amplo conjunto de engrenagens/);
    assert.match(state.renders[0].prompt, /túnica de linho/);
    assert.doesNotMatch(state.renders[0].prompt, /trapos velhos|pijama rudimentar/);
    assert.match(state.renders[1].prompt, /tecido atravessando as pernas/i);
    for (const prompt of [
      ...state.renders.map((r: { prompt: string }) => r.prompt),
      ...state.reviews,
    ]) {
      assert(prompt.includes(ART_CLOTHING_RULES));
      assert.match(prompt, /ambas as pernas.*tornozelos/);
      assert.match(prompt, /calça curta, três-quartos, barra assimétrica/);
      assert(prompt.includes(warforgedArtInstructions(choices.warforgedAppearance)));
    }
    assert.deepEqual(
      await Promise.all(atlases.map(hash)),
      before,
      'Pranchas originais inalteradas',
    );
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [] }));
    await generateCharacterArt({
      id: randomUUID(),
      character_id: randomUUID(),
      race: 'Warforged',
      class: 'Guerreiro',
      reference: image,
      reference_mode: 'construction',
      choices,
    });
    const dressed = JSON.parse(await readFile(capture, 'utf8'));
    assert.match(dressed.renders[0].prompt, /IDENTIDADE MONTADA SALVA/);
    assert.equal(dressed.renders[0].images.length, 4);
    assert(
      dressed.reviews.some((p: string) =>
        p.includes('Compare rosto, estrutura e proporções do corpo'),
      ),
    );
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [] }));
    await generateCharacterArt({
      id: randomUUID(),
      race: 'Warforged',
      class: 'Guerreiro',
      reference: image,
      reference_mode: 'reference',
      choices: { ...choices, warforgedArtMode: 'reference', warforgedAppearance: undefined },
    });
    const byReference = JSON.parse(await readFile(capture, 'utf8'));
    assert.equal(byReference.renders[0].images.length, 2);
    assert.doesNotMatch(byReference.renders[0].prompt, /APARÊNCIA DO WARFORGED ESCOLHIDA/);
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [], rejectClothing: true }));
    await assert.rejects(
      () =>
        generateCharacterArt({
          id: randomUUID(),
          race: 'Warforged',
          class: 'Guerreiro',
          reference: null,
          choices,
        }),
      /verificação/,
    );
    assert.equal(JSON.parse(await readFile(capture, 'utf8')).reviews.length, 3);
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [], acceptClothing: true, rejectHead: true }));
    await assert.rejects(() => generateCharacterArt({ id:randomUUID(),race:'Warforged',class:'Guerreiro',reference:null,choices }), /verificação/);
    const wrongHead=JSON.parse(await readFile(capture,'utf8'));
    assert.equal(wrongHead.reviews.length,3);
    assert.match(wrongHead.renders[1].prompt,/Restaurar fielmente a cabeça escolhida/);
    assert(wrongHead.reviews.every((prompt:string)=>prompt.includes('selected_head_correct=false')));
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [], acceptClothing: true, omitHead: true }));
    await assert.rejects(() => generateCharacterArt({ id:randomUUID(),race:'Warforged',class:'Guerreiro',reference:null,choices }), /conferir a composição/);
    await writeFile(capture, JSON.stringify({ renders: [], reviews: [], omitClothing: true }));
    await assert.rejects(
      () =>
        generateCharacterArt({
          id: randomUUID(),
          race: 'Warforged',
          class: 'Guerreiro',
          reference: null,
          choices,
        }),
      /conferir a composição/,
    );
    await assert.rejects(
      () =>
        generateCharacterArt({
          id: randomUUID(),
          race: 'Humano',
          class: 'Guerreiro',
          reference: null,
        }),
      /referência/,
    );
    await assert.rejects(
      () =>
        generateCharacterArt({
          id: randomUUID(),
          race: 'Warforged',
          class: 'Guerreiro',
          reference: null,
        }),
      /referência/,
    );
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    assert(temp.startsWith(join(tmpdir(), 'warforged-cli-')));
    await rm(temp, { recursive: true, force: true });
  }
});
