import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {build} from 'esbuild';import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:"export {drawTerrain,terrainCacheStats} from './src/vtt-terrain-canvas';export {newScene,newToken,terrainStrokeSchema} from './shared/vtt';export {terrainTextures,woodlandFloorImage} from './shared/vtt-terrain';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',globalName:'QA'});
const manifest=JSON.parse(await fs.readFile('data/vtt/terrain-v4-reviewed-20261013.json'));const files=[...manifest,...JSON.parse(await fs.readFile('data/vtt/terrain-v3-reviewed-20261013.json')).filter(a=>a.id==='earth')];const inputs=await Promise.all(files.map(async a=>[a.image,'data:image/webp;base64,'+(await fs.readFile('public'+a.image)).toString('base64')]));
const browser=await chromium.launch({channel:'msedge',headless:true});await fs.mkdir('test-results/grass-ground',{recursive:true});
try{const page=await browser.newPage();await page.setContent('<canvas width="800" height="320"></canvas>');await page.addScriptTag({content:bundle.outputFiles[0].text});
const report=await page.evaluate(async inputs=>{
 const images=new Map(await Promise.all(inputs.map(async([path,url])=>{const im=new Image();im.src=url;await im.decode();return[path,im]})));
 let sequence=0;const uuid=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
 const scene=QA.newScene(uuid());scene.width=800;scene.height=320;scene.grid.type='none';scene.fog=false;scene.lighting=false;
 const stroke={id:uuid(),texture:'grass',erase:false,radius:120,softness:0,opacity:1,textureScale:360,shape:'square',layer:'base',points:[{x:128,y:160}]};scene.terrain=[stroke];
 const tree=QA.newToken(uuid(),scene);Object.assign(tree,{layer:'map',image:'/vtt/trees-20261013/oak-young.png',x:220,y:160,width:200,height:200});scene.tokens=[tree];
 const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true}),o={images,camera:{x:400,y:160,zoom:1},dpr:1,gm:false,preview:false,viewer:null};
 const draw=s=>{c.clearRect(0,0,800,320);QA.drawTerrain(c,s,o);return c.getImageData(0,0,800,320).data;};
 const delta=(a,b)=>{let pixels=0,maxX=0,maximum=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(a[i+k]-b[i+k]));if(d>2){pixels++;maxX=Math.max(maxX,(i/4)%800);maximum=Math.max(maximum,d)}}return{pixels,maxX,maximum}};
 const plain=draw({...scene,tokens:[]}),ground=draw(scene),visible=delta(plain,ground),warm=QA.terrainCacheStats(canvas);draw(scene);draw(structuredClone(scene));const after=QA.terrainCacheStats(canvas);
 const moved=delta(plain,draw({...scene,tokens:[{...tree,x:650}]})),hidden=delta(plain,draw({...scene,tokens:[{...tree,hidden:true}]}));
 const erasedScene={...scene,terrain:[stroke,{...stroke,id:uuid(),erase:true,radius:500}]};const erased=delta(draw({...erasedScene,tokens:[]}),draw(erasedScene));
 const hiddenScene={...scene,terrainLayers:[{id:'base',name:'Grama',visible:false,opacity:1}]};const hiddenLayer=delta(draw({...hiddenScene,tokens:[]}),draw(hiddenScene));
 const earth={...scene,terrain:[stroke,{...stroke,id:uuid(),texture:'earth',radius:500}]};const earthLayer=delta(draw({...earth,tokens:[]}),draw(earth));
 const rocky={...scene,terrain:[{...stroke,texture:'rocky-grass'}]};const rockyPlain=draw({...rocky,tokens:[]}), rockyDelta=delta(rockyPlain,draw(rocky)), distinctBrushes=delta(plain,rockyPlain);
 const partial={...scene,terrain:[stroke,{...stroke,id:uuid(),texture:'earth',radius:500,layer:'path'}],terrainLayers:[{id:'base',name:'Grama',visible:true,opacity:1},{id:'path',name:'Terra',visible:true,opacity:.5}]};const partialDelta=delta(draw({...partial,tokens:[]}),draw(partial));
 return{visible,warm,after,moved,hidden,erased,hiddenLayer,earthLayer,rockyDelta,distinctBrushes,partialDelta,rockyAccepted:QA.terrainStrokeSchema.safeParse({...stroke,texture:'rocky-grass'}).success};
},inputs);
assert(report.visible.pixels>1000);assert(report.visible.maxX<=248,'No soil outside painted grass');assert.equal(report.warm.strokesDrawn,report.after.strokesDrawn);assert.equal(report.warm.groundTilesBuilt,report.after.groundTilesBuilt);for(const key of ['moved','hidden','erased','hiddenLayer','earthLayer'])assert.equal(report[key].pixels,0,key);assert(report.rockyDelta.pixels>1000);assert(report.distinctBrushes.pixels>1000);assert(report.partialDelta.pixels>0&&report.partialDelta.maximum<report.visible.maximum);assert(report.rockyAccepted);await fs.writeFile('test-results/grass-ground/result.json',JSON.stringify({passed:true,...report},null,2));console.log(JSON.stringify({passed:true,masking:true,privacy:true,cache:true,rockyBrush:true}));
}finally{await browser.close()}
