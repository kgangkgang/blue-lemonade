export const LOG_BRIDGE=Symbol.for('st.request-log.v1');
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const safe=s=>String(s??'').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,90);
export const PURPOSES={
 'chat.generate':'채팅 응답','chat.swipe':'채팅 스와이프','chat.regenerate':'채팅 재생성','chat.continue':'채팅 이어쓰기','chat.impersonate':'유저 대신 쓰기','chat.quiet':'채팅 보조 생성',
 'translation.chat':'채팅 번역','translation.glossary':'번역 용어집','translation.bookmark':'북마크 번역',
 'memory.translate':'장기기억 카드 번역','memory.translate-packet':'AI 기억 미리보기 번역','memory.record':'장기기억 생성','memory.summary':'장기기억 턴 요약','memory.arc':'장기기억 연대기','memory.regroup':'장기기억 요약 재분류','memory.curate':'장기기억 정리','memory.supervisor':'장기기억 장면 연출','memory.packet':'장기기억 주입문 작성','memory.ask':'사서에게 질문','memory.edit':'장기기억 수정 대화','memory.clock':'서사 시계','memory.test':'장기기억 연결 검사','memory.other':'장기기억 기타',
 'memory.embedding':'장기기억 임베딩','embedding':'임베딩','image.generate':'이미지 생성','image.caption':'이미지 설명','audio.speech':'음성 생성','audio.transcribe':'음성 인식','rewrite':'다시 쓰기','summary':'대화 요약','direction':'전개 지시','other':'기타 API','unknown':'용도 분류 불가'
};
export const purposeLabel=value=>PURPOSES[value]||'기타 API';
export function requestKind(path) {
 if(/\/embeddings\/?$|\/api\/vector\/(query|query-multi|insert)$/.test(path))return 'embedding';
 if(/\/audio\/(transcriptions|translations)|\/api\/speech-recognition\//.test(path))return 'audio.transcribe';
 if(/\/audio\/speech|\/api\/tts\//.test(path)&&!/voices|models|speakers|status/.test(path))return 'audio.speech';
 if(/\/images\/(generations|edits)|\/api\/sd\/.*generate|\/api\/.*\/generate-image/.test(path))return 'image.generate';
 if(/\/api\/.*\/caption/.test(path))return 'image.caption';
 if(/\/api\/backends\/.*\/generate$|\/(chat\/completions|completions|responses|messages)$|:(streamGenerateContent|generateContent)$/.test(path))return 'text';
 return '';
}
export function createAttribution() {
 const active=new Set();
 function begin({caller,purpose,system,user}) {
  if(active.size>=64)return ()=>{};
  const row={caller:safe(caller),purpose:safe(purpose),system:clean(system),user:clean(user)};
  active.add(row);return ()=>active.delete(row);
 }
 function resolve({explicit,caller,type,kind,body}) {
  if(explicit?.purpose&&PURPOSES[explicit.purpose])return {caller:safe(explicit.caller)||caller,purpose:explicit.purpose,attribution:'explicit'};
  const content=[...(Array.isArray(body.messages)?body.messages:[]).map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)),body.prompt,...(body.contents||[]).flatMap(c=>(c.parts||[]).map(p=>p.text)),...(body.systemInstruction?.parts||[]).map(p=>p.text)].filter(Boolean).map(clean).join(' ');
  const matches=[...active].filter(r=>r.user&&content.includes(r.user)&&(!r.system||content.includes(r.system)));
  const keys=new Set(matches.map(r=>r.caller+'|'+r.purpose));
  if(keys.size===1)return {caller:matches[0].caller,purpose:matches[0].purpose,attribution:'matched'};
  if(keys.size>1)return {caller,purpose:'unknown',attribution:'ambiguous'};
  if(kind!=='text')return {caller,purpose:kind||'other',attribution:'endpoint'};
  const byCaller={'llm-translator-custom':'translation.chat','llm-translator':'translation.chat','chat-bookmarks':'translation.bookmark','ban-word-rewrite':'rewrite','story-direction':'direction',memory:'summary',caption:'image.caption'};
  const purpose=caller==='chat'?({'swipe':'chat.swipe','regenerate':'chat.regenerate','continue':'chat.continue','impersonate':'chat.impersonate','quiet':'chat.quiet'}[type]||'chat.generate'):byCaller[caller]||'unknown';
  return {caller,purpose,attribution:purpose==='unknown'?'unknown':'caller'};
 }
 return {begin,resolve,get size(){return active.size;}};
}
