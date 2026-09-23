import { captureStyle, applyStyleData, sameStyle } from './styles.js';
export const HISTORY_LIMIT=8;
export function appearanceArchive(s){return (Array.isArray(s.appearanceHistory)?s.appearanceHistory:[]).filter(x=>x&&typeof x.id==='string'&&Number.isFinite(x.at)&&x.data&&typeof x.data==='object'&&!Array.isArray(x.data)).slice(0,HISTORY_LIMIT);}
export function rememberAppearance(s,label='꾸미기 변경 전'){
    const data=captureStyle(s),list=appearanceArchive(s);
    if(list[0]&&sameStyle(list[0].data,data))return true;
    const entry={id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,at:Date.now(),label:String(label).slice(0,60),data};
    if(JSON.stringify(entry).length>1000000)return false;
    list.unshift(entry);let bytes=0;
    s.appearanceHistory=list.slice(0,HISTORY_LIMIT).filter(x=>{bytes+=JSON.stringify(x).length;return bytes<=2000000;});return true;
}
export function restoreAppearance(s,id){
    const entry=appearanceArchive(s).find(x=>x.id===id);if(!entry)return false;
    const data=structuredClone(entry.data);rememberAppearance(s,'복구하기 전');
    const locks=s.settingLocks;s.settingLocks={};
    try{applyStyleData(s,data);}finally{s.settingLocks=locks;}
    return true;
}
