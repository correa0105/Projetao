import type {ReactNode} from 'react';
import {Hammer,Mountain,Paintbrush,Trees} from 'lucide-react';
import {sceneryAssets} from '../shared/vtt-scenery-assets';
import {treeAssets} from '../shared/vtt-tree-assets';
import {rockAssets} from '../shared/vtt-rock-assets';
import {VttAssets} from './VttAssets';
import {VttSceneryAssets} from './VttSceneryAssets';

export type VttSceneryCollection='objects'|'trees'|'rocks'|'textures';
const collections=[
  {id:'objects',name:'Objetos',icon:Hammer,count:sceneryAssets.length},
  {id:'trees',name:'Árvores',icon:Trees,count:treeAssets.length},
  {id:'rocks',name:'Pedras',icon:Mountain,count:rockAssets.length},
  {id:'textures',name:'Terrenos e texturas',icon:Paintbrush},
] as const;
export function VttSceneryLibrary({collection,change,query,gm,addObject,addTree,textures}:{
  collection:VttSceneryCollection;
  change:(next:VttSceneryCollection)=>void;
  query:string;
  gm:boolean;
  addObject:(id:string,scale:number)=>void;
  addTree:(id:string,scale:number)=>void;
  textures:ReactNode;
}){
  const active=collection==='textures'&&!gm?'objects':collection;
  return <section aria-label="Acervo de peças de cenário">
    <nav className="vtt-asset-collections vtt-scenery-collections" aria-label="Coleções de peças de cenário">
      {collections.filter(c=>c.id!=='textures'||gm).map(c=><button key={c.id} aria-pressed={active===c.id} onClick={()=>change(c.id)}>
        <c.icon size={15}/><span>{c.name}</span>{'count' in c&&<small>{c.count}</small>}
      </button>)}
    </nav>
    {active==='textures'?textures:active==='trees'||active==='rocks'?
      <VttAssets key={active} collection={active} query={query} gm={gm} add={addTree}/>:
      <VttSceneryAssets query={query} gm={gm} add={addObject}/>}
  </section>;
}
