// Stay in the host's serialized save lane. Its helper swallows failures, so
// read the original chat back and verify only our message and metadata field.
import { CHAT_GLOSSARY_KEY } from '../chat-glossary.js';
import { STYLE_PROFILE_KEY } from '../style-profile.js';
const owned = extra => Object.fromEntries(['display_text','original_translation_backup','translation_edited','translation_source'].map(k=>[k,extra?.[k]]));
export async function saveTermChat(ctx, job) {
    const chatId = ctx.getCurrentChatId?.();
    const bundle=Array.isArray(job.metadataKeys) && job.metadataKeys.length===2 && new Set(job.metadataKeys).size===2 && job.metadataKeys.every(key=>[CHAT_GLOSSARY_KEY,STYLE_PROFILE_KEY].includes(key));
    const metadataOnly=job.metadataOnly===true && (bundle || job.metadataKey===STYLE_PROFILE_KEY);
    if (!chatId || ctx.chatMetadata !== job.metadata || (!metadataOnly&&(ctx.chat[job.id] !== job.message || job.message.swipe_id !== job.swipe))) throw Error('채팅이 바뀌어 저장을 멈췄어요.');
    const group = ctx.groupId != null;
    const character = ctx.characters?.[ctx.characterId];
    if (!group && !character?.avatar) throw Error('현재 캐릭터를 확인하지 못했어요.');
    const payload = group ? {id:chatId} : {ch_name:character.name,file_name:chatId,avatar_url:character.avatar};
    const metadataKey = job.metadataKey===STYLE_PROFILE_KEY ? STYLE_PROFILE_KEY : CHAT_GLOSSARY_KEY;
    const metadataKeys = bundle ? job.metadataKeys : [metadataKey];
    const fields = metadata => metadataKeys.map(key=>metadata?.[key]);
    const expected = JSON.stringify(metadataOnly?fields(ctx.chatMetadata):[ctx.chatMetadata[metadataKey], owned(job.message.extra),job.message.mes,job.message.swipe_id]);
    const headers = ctx.getRequestHeaders();
    // Once saving has started, a failed readback is an unknown outcome. Never
    // roll back locally and silently overwrite a successful server save later.
    try {
        await ctx.saveChat();
        const controller = new AbortController(); let timer;
        try {
            return await Promise.race([
                (async()=>{
                    const response = await fetch(group ? '/api/chats/group/get' : '/api/chats/get', {method:'POST',headers,body:JSON.stringify(payload),signal:controller.signal});
                    if (!response.ok) return {confirmed:false};
                    const saved = await response.json(), message = saved?.[job.id+1];
                    const actual = JSON.stringify(metadataOnly?fields(saved?.[0]?.chat_metadata):[saved?.[0]?.chat_metadata?.[metadataKey],owned(message?.extra),message?.mes,message?.swipe_id]);
                    return {confirmed:actual === expected};
                })(),
                new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({confirmed:false});},8000);}),
            ]);
        } finally { clearTimeout(timer); controller.abort(); }
    } catch { return {confirmed:false}; }
}
