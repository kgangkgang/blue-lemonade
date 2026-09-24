import { getSettings } from './settings.js';
let key='',queue=Promise.resolve();
export async function restorePendingAddons() {
    const {getCurrentUserHandle}=await import('../../../../user.js');
    key=`blue-lemonade:addons-pending:${getCurrentUserHandle()}`;
    try {
        const pending=JSON.parse(sessionStorage.getItem(key)||'null');
        if(!pending||Date.now()-pending.at>3600000){sessionStorage.removeItem(key);return false;}
        const s=getSettings();
        for(const [id,value] of Object.entries(pending.flags||{}))if(Object.hasOwn(s.addons,id)&&typeof value==='boolean')s.addons[id]=value;
        return true;
    } catch{return false;}
}
export function saveAddonsNow() {
    queue=queue.catch(()=>{}).then(async()=>{
        // Snapshot inside the queued task: a fast on→off toggle must compare the latest flags, not a stale copy.
        const flags={...getSettings().addons},mode=getSettings().usageMode||'both',pending=JSON.stringify({flags,at:Date.now()});
        try{if(key)sessionStorage.setItem(key,pending);}catch{/* Server persistence still works. */}
        const host=await import('../../../../../script.js');
        await host.saveSettings();
        // The host catches save errors itself. Verify its persisted copy before reload.
        const response=await fetch('/api/settings/get',{method:'POST',headers:host.getRequestHeaders(),body:'{}',signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error('설정 저장을 확인하지 못했어요. 연결을 확인하고 다시 적용해 주세요.');
        const data=await response.json(),saved=typeof data.settings==='string'?JSON.parse(data.settings):data.settings;
        if(!saved||(saved.extension_settings?.salty?.usageMode||'both')!==mode||Object.entries(flags).some(([id,on])=>saved.extension_settings?.salty?.addons?.[id]!==on))throw Error('아직 설정이 저장되지 않았어요. 잠시 뒤 다시 적용해 주세요.');
        try{if(key&&sessionStorage.getItem(key)===pending)sessionStorage.removeItem(key);}catch{/* ignore */}
    });
    return queue;
}
