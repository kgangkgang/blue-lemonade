import { readingHash } from './reading-resume-anchor.js';
import { collectBranchHints } from './chat-graph-data.js';
export const libraryOwnerKey=owner=>JSON.stringify(owner?.groupId!=null?['group',String(owner.groupId)]:['character',owner?.avatar||'']);
export const libraryRecordKey=(owner,id)=>readingHash(JSON.stringify([libraryOwnerKey(owner),id]));
export function libraryRecordStamp(record){const id=record?.metadata?.integrity;return typeof id==='string'&&id.length>0&&id.length<=200?`integrity:${id}`:`revision:${readingHash(JSON.stringify([record?.messageCount,record?.lastMes,record?.fileSize]))}`;}
export function libraryOwners(ctx){
    return [...(ctx.characters||[]).filter(c=>c?.avatar).map(c=>({avatar:c.avatar,name:c.name||c.avatar})),...(ctx.groups||[]).filter(g=>g?.id!=null).map(g=>({groupId:g.id,name:g.name||'그룹',ids:[...(g.chats||[])]}))];
}
export function normalizeLibraryRows(payload,owner){
    const seen=new Set(),duplicate=new Set(),result=[],allow=owner.groupId!=null?new Set((owner.ids||[]).map(String)):null;
    for(const item of Array.isArray(payload)?payload:Object.values(payload||{})){
        if(!item||typeof item!=='object')continue;
        const id=owner.groupId!=null?item.file_name:item.file_id??String(item.file_name||'').replace(/\.jsonl$/,'');
        if(typeof id!=='string'||!id||id.length>1000||(allow&&!allow.has(id)))continue;
        if(seen.has(id)){duplicate.add(id);continue;}seen.add(id);
        result.push({id,label:id.startsWith(owner.name+' - ')?id.slice(owner.name.length+3):id,messageCount:item.message_count??item.chat_items,lastMes:item.last_mes,fileSize:item.file_size,
            ...(item.chat_metadata&&typeof item.chat_metadata==='object'&&!Array.isArray(item.chat_metadata)?{metadata:item.chat_metadata}:{})});
    }
    return result.map(r=>({...r,ambiguous:duplicate.has(r.id)}));
}
export function normalizeLibraryMarks(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
    return Object.fromEntries(Object.entries(raw).filter(([key,r])=>/^[a-f\d]{16}$/.test(key)&&r&&typeof r.stamp==='string'&&r.stamp.length<=300&&Number.isFinite(r.at)).sort((a,b)=>b[1].at-a[1].at).slice(0,2000).map(([key,r])=>[key,{stamp:r.stamp,at:r.at,completed:r.completed===true,archived:r.archived===true,openedAt:Math.max(0,Number(r.openedAt)||0)}]));
}
export function libraryMark(marks,owner,row){const mark=marks[libraryRecordKey(owner,row.id)];return mark&&mark.stamp===libraryRecordStamp(row)?{...mark,completed:mark.completed===true,archived:mark.archived===true,openedAt:Number(mark.openedAt)||0}:{completed:false,archived:false,openedAt:0,stale:!!mark};}
export function selectLibraryRows(rows,marks,owner,{query='',completed='all',archive='active',recent=false,now=Date.now()}={}){
    const needle=query.trim().toLocaleLowerCase();
    return rows.filter(row=>{
        const m=libraryMark(marks,owner,row);
        return (!needle||row.label.toLocaleLowerCase().includes(needle)||row.id.toLocaleLowerCase().includes(needle))&&(completed==='all'||(completed==='yes')===m.completed)&&(archive==='all'||(archive==='archived')===m.archived)&&(!recent||(m.openedAt>0&&m.openedAt>=now-7*86400000));
    }).sort((a,b)=>(libraryMark(marks,owner,b).openedAt||Date.parse(b.lastMes)||Number(b.lastMes)||0)-(libraryMark(marks,owner,a).openedAt||Date.parse(a.lastMes)||Number(a.lastMes)||0)||a.id.localeCompare(b.id));
}
export function splitLibraryChat(lines){
    if(!Array.isArray(lines)||!lines.length)throw Error('채팅이 삭제되었거나 읽을 수 없어요. 목록을 새로고침해 주세요.');
    const hasHeader=lines[0]&&typeof lines[0]==='object'&&!('mes' in lines[0])&&('chat_metadata' in lines[0]||'user_name' in lines[0]);
    const header=hasHeader?lines[0]:{},messages=(hasHeader?lines.slice(1):lines).filter(m=>m&&typeof m.mes==='string');
    if(!hasHeader&&!messages.length)throw Error('채팅 기록 형식을 확인하지 못했어요.');
    return {metadata:header.chat_metadata||{},messages};
}
const messageValue=m=>JSON.stringify([!!m.is_user,!!m.is_system,m.name||'',m.mes]);
export function compareChatBranches(left,right,{leftId='',rightId=''}={}){
    const a=left.messages,b=right.messages;let common=0;
    while(common<Math.min(a.length,b.length)&&messageValue(a[common])===messageValue(b[common]))common++;
    const declared=left.metadata?.main_chat===rightId||right.metadata?.main_chat===leftId;
    const siblings=!!left.metadata?.main_chat&&left.metadata.main_chat===right.metadata?.main_chat;
    const hints=[...collectBranchHints(leftId,a),...collectBranchHints(rightId,b)].filter(h=>(h.parentId===leftId&&h.childId===rightId)||(h.parentId===rightId&&h.childId===leftId));
    return {common,leftCount:a.length,rightCount:b.length,relationship:declared?'parent-child':siblings?'siblings':'unconfirmed',hints,
        rows:Array.from({length:Math.max(a.length,b.length)},(_,index)=>({index,left:a[index]||null,right:b[index]||null,same:!!a[index]&&!!b[index]&&messageValue(a[index])===messageValue(b[index])}))};
}
