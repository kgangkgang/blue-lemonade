export const LOCK_GROUPS = [
    ['fonts','글꼴',['fonts']],
    ['size','글자 크기',['type.size','type.dialogueSize','type.uiSize','type.codeSize','em.size','strong.size','profile.nameSize','userProfile.nameSize']],
    ['spacing','문단 · 여백',['type.lineHeight','type.letterSpacing','type.para','type.gutter','type.measure','type.align','type.indent','dialogue.letterSpacing','em.letterSpacing','strong.letterSpacing','code.letterSpacing']],
    ['colors','색',['palette','gradients','colorOverrides','nightTint','lightTint','customName']],
    ['profile','프로필 · 이름',['profile','userProfile']],
];
const read=(s,p)=>p.split('.').reduce((o,k)=>o?.[k],s);
export function preserveLocks(settings, source=settings, locks=settings.settingLocks){
    const values=[];
    for(const [id,,paths] of LOCK_GROUPS)if(locks?.[id]===true)for(const path of paths)values.push([path,structuredClone(read(source,path))]);
    return ()=>{for(const [path,value] of values){const parts=path.split('.'),key=parts.pop();let parent=settings;for(const part of parts)parent=parent[part]??={};if(value===undefined)delete parent[key];else parent[key]=value;}};
}
