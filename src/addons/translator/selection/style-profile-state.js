import { context,chatKey,exclusive,termHooks } from './state.js';
import { STYLE_PROFILE_KEY,styleProfiles,planStyleProfile } from '../style-profile.js';
const stamp=metadata=>JSON.stringify(metadata[STYLE_PROFILE_KEY]);
function alive(job){
 job.guard?.assert();const c=context();
 if(job.closed?.()||chatKey()!==job.chatKey||c.chatMetadata!==job.metadata||(!job.metadataOnly&&(c.chat[job.id]!==job.message||job.message.mes!==job.mes||job.message.swipe_id!==job.swipe||job.message.extra?.display_text!==job.display)))throw Error('채팅이나 메시지가 바뀌었어요. 창을 다시 열어 주세요.');
 if(termHooks()?.busy?.())throw Error('진행 중인 번역이 끝난 뒤 지침을 바꿔 주세요.');
 if(stamp(job.metadata)!==job.stamp)throw Error('지침이 다른 곳에서 바뀌었어요. 목록을 다시 열어 주세요.');
}
export function prepareStyleProfiles(selection,closed){
 if(!context().chatMetadata||!context().getCurrentChatId?.())throw Error('먼저 저장된 채팅을 열어 주세요.');
 const metadata=context().chatMetadata,job={...(selection??{metadataOnly:true,chatKey:chatKey()}),closed,metadata,metadataKey:STYLE_PROFILE_KEY,stamp:stamp(metadata)};alive(job);return {...job,entries:styleProfiles(metadata)};
}
async function write(job,next){
 alive(job);const before=structuredClone(job.metadata[STYLE_PROFILE_KEY]);
 if(next===undefined)delete job.metadata[STYLE_PROFILE_KEY];else job.metadata[STYLE_PROFILE_KEY]=next;
 const after=stamp(job.metadata);let saved;
 try{saved=await termHooks().save(job);}catch(error){if(stamp(job.metadata)===after){if(before===undefined)delete job.metadata[STYLE_PROFILE_KEY];else job.metadata[STYLE_PROFILE_KEY]=before;}throw error;}
 return {...job,stamp:after,entries:styleProfiles(job.metadata),before,saved};
}
export const saveStyleProfile=(job,value)=>exclusive(()=>write(job,planStyleProfile(job.metadata,value)));
export const removeStyleProfile=(job,id)=>exclusive(()=>{alive(job);const next=styleProfiles(job.metadata).filter(e=>e.id!==id);if(next.length===job.entries.length)throw Error('지침이 이미 바뀌었어요.');return write(job,next);});
export const undoStyleProfile=job=>exclusive(()=>write(job,job.before));
