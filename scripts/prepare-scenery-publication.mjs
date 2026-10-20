import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Additive image: the installed application supplies every existing media file.
const source=path.resolve(process.argv[2]||'../vtt-scenery-validation');
const stage='.local/scenery-release-20261012';
const live=JSON.parse(execFileSync('docker',['inspect','alvorada-cinzenta-app'],{encoding:'utf8',windowsHide:true}))[0];
assert.match(live.Config.Image,/^alvorada-cinzenta-app:[a-zA-Z0-9_.-]+$/);
const image='alvorada-cinzenta-app:scenery-v2-20261012';
const catalog=JSON.parse(await fs.readFile(path.join(source,'shared/vtt-scenery-catalog.json'),'utf8'));
assert.equal(catalog.length,250,'Publish only after the complete requested collection is reviewed.');
for(const category of new Set(catalog.map(a=>a.category)))assert.equal(catalog.filter(a=>a.category===category).length,25);
await fs.mkdir(stage,{recursive:true});
for(const file of ['dist/client/index.html','dist/server/index.js']){
 const output=path.join(stage,file);await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(path.join(source,file),output);
}
await fs.cp(path.join(source,'dist/client/assets'),path.join(stage,'dist/client/assets'),{recursive:true});
const directory='public/vtt/scenery-v2-20261012';
await fs.mkdir(path.join(stage,directory),{recursive:true});
for(const file of [...catalog.map(a=>path.basename(a.image)),...['grass','earth','sand','stone','wood','snow'].map(id=>'terrain-'+id+'.webp'),'catalog.json']){
 await fs.copyFile(path.join(source,directory,file),path.join(stage,directory,file));
}
await fs.writeFile(path.join(stage,'Dockerfile'),`FROM ${live.Config.Image}\nCOPY dist/client/assets/ /app/dist/client/assets/\nCOPY dist/client/index.html /app/dist/client/index.html\nCOPY dist/server/index.js /app/dist/server/index.js\nCOPY public/vtt/scenery-v2-20261012/ /app/dist/client/vtt/scenery-v2-20261012/\n`);
await fs.writeFile(path.join(stage,'.dockerignore'),'**\n!Dockerfile\n!dist/\n!dist/client/\n!dist/client/assets/\n!dist/client/assets/**\n!dist/client/index.html\n!dist/server/\n!dist/server/index.js\n!public/\n!public/vtt/\n!public/vtt/scenery-v2-20261012/\n!public/vtt/scenery-v2-20261012/**\n');
await fs.writeFile(path.join(stage,'publication.json'),JSON.stringify({previous:live.Config.Image,previousId:live.Image,next:image,available:catalog.length},null,2));
await fs.writeFile('.local/scenery-compose-20261012.yaml',`services:\n  app:\n    image: ${image}\n`);
console.log(JSON.stringify({stage,previous:live.Config.Image,next:image,assets:catalog.length}));
