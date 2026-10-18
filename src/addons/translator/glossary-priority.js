import {glossaryAlternatives,glossaryFold}from'./glossary-match.js';
// Read-only explanation of activeGlossaryEntries' whole-entry precedence.
export function glossaryPriority({entries=[],chatEntries=[],scopes=[],enabled=true,limit=100}={}){
 const rows=[],claimed=new Map();let count=0;
 const take=(entry,label)=>{
  if(!entry?.src||!entry?.dst)return;const forms=glossaryAlternatives(entry.src).map(glossaryFold).filter(Boolean);if(!forms.length)return;
  const winner=forms.map(form=>claimed.get(form)).find(Boolean),row={src:entry.src,dst:entry.dst,scope:label,applied:!winner};count++;
  if(winner)row.overlap={scope:winner.scope,src:winner.src,dst:winner.dst,same:winner.dst===entry.dst};else for(const form of forms)claimed.set(form,row);
  if(rows.length<limit)rows.push(row);
 };
 for(const entry of chatEntries)take(entry,'이 채팅');
 for(const [i,key] of scopes.entries()){if(key==='global')continue;for(const entry of entries)if(entry?.scope===key)take(entry,i===0?'현재 캐릭터·그룹':`그룹 멤버 ${i}`);}
 for(const entry of entries)if(entry?.scope==='global')take(entry,'전체');
 return {enabled,rows,total:count,shown:rows.length};
}
