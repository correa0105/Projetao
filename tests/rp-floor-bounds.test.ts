import{test}from'node:test';import assert from'node:assert/strict';import{rpDragPosition}from'../shared/rp-perspective';import{rpPlacementSchema}from'../shared/rp-lobby';
test('RP permite usar o chão ao fundo da praia e mantém o limite da borda',()=>{
  const bounds={width:1600,height:900};
  for(const y of [.22,.3,.38,.85]){const p=rpDragPosition({x:400,y:y*900},{x:0,y:0},bounds,.84,'beach');assert(Math.abs(p.y-y)<1e-8);}
  assert.equal(rpDragPosition({x:400,y:0},{x:0,y:0},bounds,.84,'beach').y,.18);
  assert.equal(rpDragPosition({x:400,y:0},{x:0,y:0},bounds,.84,'tavern').y,.4);
  assert(rpPlacementSchema.safeParse({id:'00000000-0000-4000-8000-000000000001',catalog:'bench',x:.25,y:.25,scale:.1,facing:1,rotation:0,layer:4}).success);
});
