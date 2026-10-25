// User-authored translation preferences, scoped to the current chat.
import { glossaryFold } from './glossary-match.js';
export const STYLE_PROFILE_KEY = 'llmt_style_profiles_v1';
export const STYLE_PROFILE_LIMIT = 40;
const styleFold=value=>glossaryFold(String(value??'').normalize('NFKC'));
const nameOK = value => typeof value === 'string' && value.trim() && value.length <= 80 && !/[\r\n<>\u0000-\u001f]/.test(value);
// 쉼표로 함께 적은 표기는 한 인물의 별칭이에요. 저장된 문자열은 그대로 보존해요.
export function styleProfileNames(value) {
    const names=String(value??'').split(/[,，、]/).map(v=>v.trim()).filter(Boolean),seen=new Set();
    return names.filter(name=>{const key=styleFold(name);if(seen.has(key))return false;seen.add(key);return true;});
}
const samePerson=(a,b)=>styleProfileNames(a).some(x=>styleProfileNames(b).some(y=>styleFold(x)===styleFold(y)));
const nameKey=value=>styleProfileNames(value).map(styleFold).sort().join(',');
function nameOwners(groups) {
    const owners=new Map();
    for(const group of groups)for(const name of group){const key=styleFold(name);if(!owners.has(key))owners.set(key,[]);owners.get(key).push(group);}
    return owners;
}
function resolvedNames(value, glossaryOwners) {
    const explicit=styleProfileNames(value);
    const result=[...explicit];
    for(const name of explicit){
        const owners=glossaryOwners.get(styleFold(name))||[];
        // 같은 표기가 서로 다른 항목에 있으면 다른 인물까지 묶지 않아요.
        if(owners.length===1)result.push(...owners[0]);
    }
    return styleProfileNames(result.join(','));
}
// 한국어 조사는 허용하되 더 긴 이름·낱말의 일부는 화자 이름으로 보지 않아요.
function nameOccursIn(plain, name) {
    const probe=styleFold(name);if(!probe)return false;
    const latin=ch=>!!ch&&/[\p{Script=Latin}\p{Number}]/u.test(ch),hangul=ch=>!!ch&&/[가-힣]/.test(ch),kana=ch=>!!ch&&/[ァ-ヺー]/.test(ch),han=ch=>!!ch&&/\p{Script=Han}/u.test(ch);
    for(let start=0;;){
        const at=plain.indexOf(probe,start);if(at<0)return false;
        const before=plain[at-1]||'',after=plain[at+probe.length]||'',first=probe[0],last=probe.at(-1);
        let valid=!(latin(first)&&latin(before))&&!(latin(last)&&latin(after))&&!(hangul(first)&&hangul(before))&&!(kana(first)&&kana(before))&&!(kana(last)&&kana(after))&&!(han(first)&&han(before))&&!(han(last)&&han(after));
        if(valid&&hangul(last)&&hangul(after)){
            const suffix=plain.slice(at+probe.length).match(/^[가-힣]+/)[0];
            valid=/^(?:(?:에게|한테|께서|께|으로|로|이라고|라고|이라며|라며|이라는|라는|이란|란|이야|야|입니다|이었다|였다)|[이가은는을를의와과도만아야])(?:[이가은는을를의와과도만아야]){0,2}$/.test(suffix);
        }
        if(valid)return true;start=at+1;
    }
}
function ambiguousNames(groups) {
    const ambiguous=new Set();
    for(const [name,owners] of nameOwners(groups)){
        if(owners.length<2)continue;
        const sets=owners.map(group=>new Set(group.map(styleFold)));
        for(let i=0;i<sets.length&&!ambiguous.has(name);i++)for(let j=i+1;j<sets.length;j++){
            const a=sets[i],b=sets[j];
            if(![...a].every(v=>b.has(v))&&![...b].every(v=>a.has(v))){ambiguous.add(name);break;}
        }
    }
    return ambiguous;
}
const modes = new Set(['polite','casual','custom']);
export function styleProfiles(metadata) {
    return (Array.isArray(metadata?.[STYLE_PROFILE_KEY]) ? metadata[STYLE_PROFILE_KEY] : []).slice(0,STYLE_PROFILE_LIMIT)
        .filter(e=>e && nameOK(e.speaker) && styleProfileNames(e.speaker).length && (!e.listener || nameOK(e.listener)&&styleProfileNames(e.listener).length) && modes.has(e.mode) && typeof e.note==='string' && e.note.length<=300)
        .map(e=>({id:String(e.id),speaker:e.speaker,listener:e.listener||'',mutual:!!e.mutual&&!!e.listener,mode:e.mode,note:e.note}));
}
export function styleProfileSignature(metadata) { return styleProfiles(metadata).map(({speaker,listener,mutual,mode,note})=>[speaker,listener,mutual,mode,note]); }
export function styleProfileOverlaps(metadata) {
    const entries=styleProfiles(metadata),out=[];
    const directions=e=>e.listener?(e.mutual?[[e.speaker,e.listener],[e.listener,e.speaker]]:[[e.speaker,e.listener]]):[[e.speaker,'']];
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
        const a=entries[i],b=entries[j];
        if(!directions(a).some(([s,t])=>directions(b).some(([u,v])=>samePerson(s,u)&&(!t||!v||samePerson(t,v)))))continue;
        const rank=e=>!e.listener?0:e.mutual?1:2,ra=rank(a),rb=rank(b);
        out.push({ids:[a.id,b.id],kind:ra===rb?'same-condition':'override',preferred:ra===rb?null:ra>rb?a.id:b.id,
            text:ra===rb?'같은 조건의 지침이 겹쳐요. 원하는 지침 한 개만 남겨 주세요.':'더 구체적인 지침을 먼저 써요. 정상적인 예외 설정일 수 있어요.'});
    }
    return out;
}
export function planStyleProfile(metadata, value) {
    const speaker=String(value.speaker??'').trim(),listener=String(value.listener??'').trim(),note=String(value.note??'').trim(),mode=value.mode;
    if(!nameOK(speaker)||!styleProfileNames(speaker).length||listener&&(!nameOK(listener)||!styleProfileNames(listener).length)||listener&&samePerson(listener,speaker)) throw Error('서로 다른 인물의 이름을 80자 안으로 적어 주세요. 같은 인물의 별칭은 쉼표로 나눠요.');
    if(!modes.has(mode)||note.length>300||/[<>\u0000-\u0008]/.test(note)||mode==='custom'&&!note) throw Error('말투를 고르고, 직접 지침은 300자 안으로 적어 주세요.');
    const mutual=!!value.mutual&&!!listener;
    const pair=[nameKey(speaker),nameKey(listener)];if(mutual)pair.sort();
    const id=JSON.stringify([...pair,mutual]);
    const entries=styleProfiles(metadata).filter(e=>{const oldPair=[nameKey(e.speaker),nameKey(e.listener)];if(e.mutual)oldPair.sort();return JSON.stringify([...oldPair,e.mutual])!==id;});
    if(entries.length>=STYLE_PROFILE_LIMIT)throw Error('이 채팅의 지침은 40개까지 기억해요. 필요 없는 지침을 먼저 지워 주세요.');
    return [...entries,{id,speaker,listener,mutual,mode,note}];
}
export function styleProfileBlock(metadata, source, { entries=[] } = {}) {
    const plain=styleFold(String(source??'').replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>/g,' '));
    const glossaryGroups=(entries||[]).filter(e=>e?.src&&e?.dst).map(e=>styleProfileNames(e.src+','+e.dst)),glossaryOwners=nameOwners(glossaryGroups);
    const profiles=styleProfiles(metadata).map(e=>({...e,speakerNames:resolvedNames(e.speaker,glossaryOwners),listenerNames:resolvedNames(e.listener,glossaryOwners)}));
    const ambiguous=ambiguousNames([...profiles.flatMap(e=>[e.speakerNames,e.listenerNames]),...glossaryGroups]);
    const hits=profiles.map(e=>({...e,speakerNames:e.speakerNames.filter(n=>!ambiguous.has(styleFold(n))),listenerNames:e.listenerNames.filter(n=>!ambiguous.has(styleFold(n)))})).filter(e=>e.speakerNames.some(name=>nameOccursIn(plain,name))&&(!e.listener||e.listenerNames.some(name=>nameOccursIn(plain,name))));
    if(!hits.length)return '';
    const rows=hits.map(e=>({speaker:e.speakerNames[0],speakerAliases:e.speakerNames,...(e.listener?{listener:e.listenerNames[0],listenerAliases:e.listenerNames,direction:e.mutual?'both directions':'speaker to listener only'}:{}),register:e.mode==='polite'?'존댓말':e.mode==='casual'?'반말':'custom',...(e.note?{translationPreference:e.note}:{})}));
    return '[Character speech preferences]\nEach alias list names one and the same person, not separate people. Apply these user preferences only to translated speech whose speaker is explicit in the original; pair rules also require an explicit addressee. Name occurrence alone does not identify a speaker. A matching speaker-to-listener rule takes precedence over that speaker\'s general rule; a directional rule takes precedence over a mutual rule for the same pair. Do not guess attribution; preserve ambiguous speech, quoted third-party speech, narration, facts and relationships. These are translation preferences, not new story facts.\n'+JSON.stringify(rows);
}
