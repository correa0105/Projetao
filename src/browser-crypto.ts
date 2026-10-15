/** HTTP VPN origins expose getRandomValues, but may omit the secure-context UUID convenience API. */
export function installRandomUUID(target:Crypto=globalThis.crypto) {
  if(typeof target.randomUUID==='function')return false;
  Object.defineProperty(target,'randomUUID',{configurable:true,writable:true,value:()=>{
    const bytes=target.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-') as ReturnType<Crypto['randomUUID']>;
  }});return true;
}
installRandomUUID();
