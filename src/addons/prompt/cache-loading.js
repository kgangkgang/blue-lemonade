// Limit simultaneous disk-backed cache requests on mobile/local servers.
export async function forEachLimited(values,concurrency,visit){
 const list=Array.from(values);let cursor=0;
 await Promise.all(Array.from({length:Math.min(Math.max(1,Math.floor(concurrency)||1),list.length)},async()=>{
  while(cursor<list.length){const index=cursor++;await visit(list[index],index);}
 }));
}
