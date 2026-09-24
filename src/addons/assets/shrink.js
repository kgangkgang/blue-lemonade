// Measure actual encoded bytes. A smaller file is eligible regardless of its extension or size.
import { imageFormat } from './image-format.js';
import { fetchAssets, uploadImage, sameBaseSiblings, sanitizeBase } from './assets.js';
import { disabledSet, setDisabled, settings, saveSettings } from './state.js';
export function canShrink(){try{return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');}catch{return false;}}
const QUALITY=.9;
export const SKIP_LABELS={optimized:'이미 경량화한 파일',webp:'기존 WebP 보존',collision:'같은 이름 충돌',animated:'움직이는 이미지 보존',unsupported:'브라우저가 읽지 못하는 형식',large:'해상도가 너무 큼',smaller:'이미 원본이 더 작음',failed:'읽기·변환 실패'};
export function skipSummary(reasons={}){return Object.entries(reasons).filter(([,n])=>n).map(([key,n])=>`${SKIP_LABELS[key]||key} ${n}장`).join(' · ');}
async function decodeStill(blob,format){
 try{return await createImageBitmap(blob);}catch{
  // Some browsers display SVG/ICO through <img> but reject createImageBitmap.
  const mime={svg:'image/svg+xml',ico:'image/x-icon'}[format.type];
  if(!mime)throw Error('decode');
  const url=URL.createObjectURL(new Blob([blob],{type:mime})),img=new Image();
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{img.src='';reject(Error('timeout'));},15000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('decode'));};img.src=url;});return img;}
  finally{URL.revokeObjectURL(url);}
 }
}
async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function shrinkOne(asset){
 const response=await fetch(asset.url,{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`못 읽었어요 (${response.status})`);
 const blob=await response.blob(),before=blob.size,bytes=await blob.arrayBuffer(),format=imageFormat(new Uint8Array(bytes));
 const skip=reason=>({blob:null,before,after:before,reason});
 if(format.animated)return skip('animated');
 // Old releases did not record conversion history: preserve all existing WebP too.
 if(format.type==='webp'){
  const hash=await digest(bytes);
  return skip(settings().optimizedImages?.[JSON.stringify([asset.folder||'',asset.file||''])]===hash?'optimized':'webp');
 }
 if(!format.supported)return skip('unsupported');
 let bitmap;try{bitmap=await decodeStill(blob,format);}catch{return skip('unsupported');}
 if(bitmap.width*bitmap.height>40000000){bitmap.close?.();return skip('large');}
 const canvas=document.createElement('canvas');
 try{
  canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d',{alpha:true}).drawImage(bitmap,0,0);
  const webp=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',QUALITY));
  if(!webp||webp.type!=='image/webp')return skip('unsupported');
  if(webp.size>=before)return skip('smaller');
  return {blob:webp,before,after:webp.size};
 }finally{bitmap.close?.();canvas.width=canvas.height=0;}
}
async function collect(folders){
 const jobs=[];
 for(const folder of folders){const assets=await fetchAssets(folder);for(const asset of assets){
  const collision=sanitizeBase(asset.base)!==asset.base||assets.some(other=>other!==asset&&other.base.toLowerCase()===asset.base.toLowerCase())||sameBaseSiblings(assets,asset).length;
  jobs.push({folder,asset,reason:collision?'collision':''});
 }}return jobs;
}
export async function estimateFolders(folders,onProgress){
 const jobs=await collect(folders),result={count:0,total:jobs.length,bytes:0,estimated:0,reasons:{}};
 for(const [i,job] of jobs.entries()){
  try{
   const measured=job.reason?{reason:job.reason,before:0,after:0}:await shrinkOne(job.asset);
   if(measured.blob){result.count++;result.bytes+=measured.before;result.estimated+=measured.after;}
   else result.reasons[measured.reason]=(result.reasons[measured.reason]||0)+1;
  }catch{result.reasons.failed=(result.reasons.failed||0)+1;}
  if(typeof onProgress==='function')onProgress({done:i+1,total:jobs.length});
  await new Promise(resolve=>setTimeout(resolve,0));
 }return result;
}
export async function shrinkFolders(folders,onProgress,control){
 const jobs=await collect(folders),result={total:jobs.length,changed:0,skipped:0,failed:0,before:0,after:0,cancelled:false,reasons:{}};
 for(const [i,{folder,asset,reason}] of jobs.entries()){
  if(control?.cancelled()){result.cancelled=true;break;}
  try{
   const shrunk=reason?{reason}:await shrinkOne(asset);
   if(!shrunk.blob){result.skipped++;result.reasons[shrunk.reason]=(result.reasons[shrunk.reason]||0)+1;}
   else{
    // Re-check collisions immediately before replacing: another upload may have
    // introduced a sibling since the estimate was shown.
    const current=await fetchAssets(folder);
    const original=current.find(item=>item.file===asset.file);
    if(!original||sameBaseSiblings(current,original).length||current.some(item=>item!==original&&item.base.toLowerCase()===original.base.toLowerCase()))throw Error('파일 목록이 바뀌었어요. 다시 확인해 주세요.');
    const newFile=`${asset.base}.webp`,wasOff=disabledSet(folder).has(asset.file);
    const outputHash=await digest(await shrunk.blob.arrayBuffer());
    await uploadImage(folder,new File([shrunk.blob],newFile,{type:'image/webp'}),asset.base);
    const record=settings().optimizedImages;
    if(!record||typeof record!=='object'||Array.isArray(record))settings().optimizedImages={};
    settings().optimizedImages[JSON.stringify([folder,newFile])]=outputHash;
    saveSettings();
    if(wasOff){setDisabled(folder,newFile,true);if(asset.file!==newFile)setDisabled(folder,asset.file,false);}
    result.changed++;result.before+=shrunk.before;result.after+=shrunk.after;
   }
  }catch(error){result.failed++;console.warn('[캐릭터 에셋] 줄이기 실패',asset.file,error);}
  onProgress?.({done:i+1,total:jobs.length,name:asset.file,saved:result.before-result.after});await new Promise(resolve=>setTimeout(resolve,0));
 }return result;
}
