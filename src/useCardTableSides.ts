import {useEffect,useState} from 'react';

const prefix='alvorada:card-table-sides:v1:';
// Visual preference only. Ownership, equipment and levels always come from the API.
function readSides(characterId?:string):string[] {
  if(!characterId)return [];
  try {
    const value:unknown=JSON.parse(localStorage.getItem(prefix+characterId)||'[]');
    return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'&&id.length<100).slice(0,8):[];
  } catch {return [];}
}
export function useCardTableSides(characterId?:string) {
  const [preference,setPreference]=useState(()=>({characterId,ids:readSides(characterId)}));
  useEffect(()=>setPreference({characterId,ids:readSides(characterId)}),[characterId]);
  const ids=preference.characterId===characterId?preference.ids:[];
  function toggle(id:string) {
    if(!characterId)return;
    setPreference(previous=>{
      const current=previous.characterId===characterId?previous.ids:readSides(characterId);
      const next=current.includes(id)?current.filter(value=>value!==id):[...current,id].slice(-8);
      try {localStorage.setItem(prefix+characterId,JSON.stringify(next));} catch {/* Still works for this visit when storage is unavailable. */}
      return {characterId,ids:next};
    });
  }
  return {isFaceDown:(id:string)=>ids.includes(id),toggle};
}
