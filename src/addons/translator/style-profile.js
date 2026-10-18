// User-authored translation preferences, scoped to the current chat.
import { glossaryFold, glossaryOccursIn } from './glossary-match.js';
export const STYLE_PROFILE_KEY = 'llmt_style_profiles_v1';
export const STYLE_PROFILE_LIMIT = 40;
const nameOK = value => typeof value === 'string' && value.trim() && value.length <= 80 && !/[\r\n<>\u0000-\u001f]/.test(value);
const modes = new Set(['polite','casual','custom']);
export function styleProfiles(metadata) {
    return (Array.isArray(metadata?.[STYLE_PROFILE_KEY]) ? metadata[STYLE_PROFILE_KEY] : []).slice(0,STYLE_PROFILE_LIMIT)
        .filter(e=>e && nameOK(e.speaker) && (!e.listener || nameOK(e.listener)) && modes.has(e.mode) && typeof e.note==='string' && e.note.length<=300)
        .map(e=>({id:String(e.id),speaker:e.speaker,listener:e.listener||'',mutual:!!e.mutual&&!!e.listener,mode:e.mode,note:e.note}));
}
export function styleProfileSignature(metadata) { return styleProfiles(metadata).map(({speaker,listener,mutual,mode,note})=>[speaker,listener,mutual,mode,note]); }
export function styleProfileOverlaps(metadata) {
    const entries=styleProfiles(metadata),out=[];
    const directions=e=>e.listener?(e.mutual?[[e.speaker,e.listener],[e.listener,e.speaker]]:[[e.speaker,e.listener]]):[[e.speaker,'']];
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
        const a=entries[i],b=entries[j];
        if(!directions(a).some(([s,t])=>directions(b).some(([u,v])=>glossaryFold(s)===glossaryFold(u)&&(!t||!v||glossaryFold(t)===glossaryFold(v)))))continue;
        const rank=e=>!e.listener?0:e.mutual?1:2,ra=rank(a),rb=rank(b);
        out.push({ids:[a.id,b.id],kind:ra===rb?'same-condition':'override',preferred:ra===rb?null:ra>rb?a.id:b.id,
            text:ra===rb?'같은 조건의 지침이 겹쳐요. 원하는 지침 한 개만 남겨 주세요.':'더 구체적인 지침을 먼저 써요. 정상적인 예외 설정일 수 있어요.'});
    }
    return out;
}
export function planStyleProfile(metadata, value) {
    const speaker=String(value.speaker??'').trim(),listener=String(value.listener??'').trim(),note=String(value.note??'').trim(),mode=value.mode;
    if(!nameOK(speaker)||listener&&!nameOK(listener)||listener&&glossaryFold(listener)===glossaryFold(speaker)) throw Error('서로 구분되는 원문 인물 표기를 80자 안으로 적어 주세요.');
    if(!modes.has(mode)||note.length>300||/[<>\u0000-\u0008]/.test(note)||mode==='custom'&&!note) throw Error('말투를 고르고, 직접 지침은 300자 안으로 적어 주세요.');
    const mutual=!!value.mutual&&!!listener;
    const pair=[glossaryFold(speaker),glossaryFold(listener)];if(mutual)pair.sort();
    const id=JSON.stringify([...pair,mutual]);
    const entries=styleProfiles(metadata).filter(e=>e.id!==id);
    if(entries.length>=STYLE_PROFILE_LIMIT)throw Error('이 채팅의 지침은 40개까지 기억해요. 필요 없는 지침을 먼저 지워 주세요.');
    return [...entries,{id,speaker,listener,mutual,mode,note}];
}
export function styleProfileBlock(metadata, source) {
    const plain=glossaryFold(String(source??'').replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>/g,' '));
    const hits=styleProfiles(metadata).filter(e=>glossaryOccursIn(plain,e.speaker)&&(!e.listener||glossaryOccursIn(plain,e.listener)));
    if(!hits.length)return '';
    const rows=hits.map(e=>({speaker:e.speaker,...(e.listener?{listener:e.listener,direction:e.mutual?'both directions':'speaker to listener only'}:{}),register:e.mode==='polite'?'존댓말':e.mode==='casual'?'반말':'custom',...(e.note?{translationPreference:e.note}:{})}));
    return '[Character speech preferences]\nApply these user preferences only to translated speech whose speaker is explicit in the original; pair rules also require an explicit addressee. Name occurrence alone does not identify a speaker. A matching speaker-to-listener rule takes precedence over that speaker\'s general rule; a directional rule takes precedence over a mutual rule for the same pair. Do not guess attribution; preserve ambiguous speech, quoted third-party speech, narration, facts and relationships. These are translation preferences, not new story facts.\n'+JSON.stringify(rows);
}
