// Persona identity is the avatar filename; names can be duplicated or translated.
export const PERSONA_FIELDS = ['name', 'title', 'description'];
const own=(value,key)=>!!value&&Object.hasOwn(value,key);
export function personaText(state,id) {
    if (!id || !own(state?.personas,id)) throw Error('페르소나를 찾을 수 없어요. 목록을 새로고침해 주세요.');
    const detail=state.persona_descriptions?.[id]||{};
    return {name:String(state.personas[id]??''),title:String(detail.title??''),description:String(detail.description??'')};
}
export function listPersonas(state) {
    const entries=Object.entries(state?.personas||{}),counts=new Map();
    for(const [,name]of entries)counts.set(name,(counts.get(name)||0)+1);
    return entries.map(([id,name])=>({id,name:[name||id,state.persona_descriptions?.[id]?.title,counts.get(name)>1?id:''].filter(Boolean).join(' · ')}));
}
export function personaFields(state,id) {
    const data=personaText(state,id),labels={name:'이름',title:'표시 제목',description:'설명'};
    return PERSONA_FIELDS.filter(key=>data[key].trim()).map(key=>({id:key,name:labels[key],content:data[key],sourceContent:data[key],isChar:true}));
}
export function translatedPersona(state,id,selected,translation,loaded) {
    const before=personaText(state,id),patch={};
    for(const field of PERSONA_FIELDS){
        if(selected?.size&&!selected.has(field))continue;
        const text=translation(field);
        if(typeof text!=='string'||!text.trim())continue;
        const source=loaded?.find(item=>item.id===field);
        if(!source||before[field]!==source.sourceContent)throw Error('불러온 뒤 페르소나 원문이 바뀌었어요. 다시 불러와 확인해 주세요.');
        patch[field]=text;
    }
    return {before,patch,applied:Object.keys(patch).length};
}
export function personaExport(state,id,patch) {
    const text=personaText(state,id),detail=structuredClone(state.persona_descriptions?.[id]||{});
    for(const field of ['title','description'])if(own(patch,field))detail[field]=patch[field];
    // ST's persona restore merges by avatar ID; existing IDs are intentionally not overwritten.
    return {personas:{[id]:patch.name??text.name},persona_descriptions:{[id]:detail}};
}
export function createPersonaWriter(host) {
    let queue=Promise.resolve();
    return (id,patch,expected)=>{
        const next=Object.fromEntries(PERSONA_FIELDS.filter(k=>own(patch,k)&&typeof patch[k]==='string').map(k=>[k,patch[k]]));
        const snapshot=expected&&{...expected};
        const run=async()=>{
            const state=host.state(),before=personaText(state,id),keys=Object.keys(next);
            if(!keys.length)throw Error('적용할 번역이 없어요. 먼저 본문을 번역해 주세요.');
            if(snapshot&&keys.some(k=>before[k]!==snapshot[k]))throw Error('적용을 준비하는 동안 페르소나 원문이 바뀌었어요. 다시 불러와 주세요.');
            const sync=()=>{if(host.avatar()===id){if(own(next,'name'))host.setName(state.personas[id]);if(own(next,'description'))state.persona_description=state.persona_descriptions[id].description;}};
            const set=(values)=>{for(const k of keys){if(k==='name')state.personas[id]=values[k];else{state.persona_descriptions??={};state.persona_descriptions[id]??={};state.persona_descriptions[id][k]=values[k];}}sync();};
            set(next);
            try{
                await host.save();
                const saved=personaText(await host.readSaved(),id);
                if(keys.some(k=>saved[k]!==next[k]))throw Error('페르소나 저장을 확인하지 못했어요. 연결을 확인하고 다시 적용해 주세요.');
            }catch(error){
                // A newer edit wins. Roll back only fields that still contain this operation's values.
                if(own(state.personas,id)){
                    const current=personaText(state,id);
                    for(const k of keys)if(current[k]===next[k]){if(k==='name')state.personas[id]=before[k];else state.persona_descriptions[id][k]=before[k];}
                    sync();
                    try{await host.save()}catch{/* The host reports connection errors. */}
                }
                throw error;
            }
            try{await host.refresh(id,before.name,next.name)}catch{/* A UI refresh failure does not undo a verified save. */}
            return {targetName:next.name??before.name,applied:keys.length,isCurrent:host.avatar()===id};
        };
        queue=queue.catch(()=>{}).then(run);return queue;
    };
}
