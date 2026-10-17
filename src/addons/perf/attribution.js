export const LOG_BRIDGE=Symbol.for('st.request-log.v1');
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const safe=s=>String(s??'').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,90);
// 6.9.8 begin 의 label: 다른 확장이 요청을 용도별로 나눠 보이게 붙이는 짧은 글(40자) — 요청 로그 · 용도별 표에서 purposeLabel 대신 보인다. 공개 코드엔 일반 이름만
// 1.5.1 붙이는 길 두 가지 (요청 로그가 꺼져 있거나 옛 테마면 그냥 버려진다):
//   ① fetch(url, { …, requestLog: { label, caller?, purpose? } }) — 요청을 직접 보내는 확장. purpose 는 몰라도 된다(용도는 전처럼 추정하고 이름표만 붙음)
//   ② globalThis[Symbol.for('st.request-log.v1')]?.begin({ caller, purpose, label, user }) → 끝낼 때 부르는 함수 — 실리태번 생성 함수를 거치는 확장(user = 보낼 글 한 조각)
//   요청 머리(header)는 쓰지 않는다 — 다른 주소로 바로 보내는 요청에 붙으면 CORS 사전 요청이 생겨 막힐 수 있다
const label=s=>clean(s).slice(0,40);
export const PURPOSES={
 'chat.generate':'채팅 응답','chat.swipe':'채팅 스와이프','chat.regenerate':'채팅 재생성','chat.continue':'채팅 이어쓰기','chat.impersonate':'유저 대신 쓰기','chat.quiet':'채팅 보조 생성',
 'translation.chat':'채팅 번역','translation.glossary':'번역 용어집','translation.bookmark':'북마크 번역','translation.tts':'TTS 번역',
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
 if(/\/api\/backends\/.*\/generate$|\/api\/(novelai\/generate|horde\/generate-text)$|\/(chat\/completions|completions|responses|messages)$|:(streamGenerateContent|generateContent)$/.test(path))return 'text';
 return '';
}
export function createAttribution() {
 const active=new Set();
 function begin({caller,purpose,system,user,label:tag}) {
  if(active.size>=64)return ()=>{};
  const row={caller:safe(caller),purpose:safe(purpose),system:clean(system),user:clean(user),label:label(tag)};
  active.add(row);return ()=>active.delete(row);
 }
 function resolve({explicit,caller,type,kind,body}) {
  const tag=label(explicit?.label);
  if(explicit?.purpose&&PURPOSES[explicit.purpose])return {caller:safe(explicit.caller)||caller,purpose:explicit.purpose,attribution:'explicit',...(tag?{label:tag}:{})};
  const found=infer({caller:explicit&&tag?safe(explicit.caller)||caller:caller,type,kind,body});
  return tag?{...found,label:tag}:found;   // 1.5.1 이름표만 붙인 요청: 용도는 추정한 그대로, 이름표가 begin 쪽 글보다 앞선다
 }
 function infer({caller,type,kind,body}) {
  // 맞춰 볼 줄이 없으면 프롬프트 전체 정리(수백 KB)를 건너뛴다
  const rows=[...active].filter(r=>r.user);
  if(rows.length){
   const content=[...(Array.isArray(body.messages)?body.messages:[]).map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)),body.prompt,...(body.contents||[]).flatMap(c=>(c.parts||[]).map(p=>p.text)),...(body.systemInstruction?.parts||[]).map(p=>p.text)].filter(Boolean).map(clean).join(' ');
   const matches=rows.filter(r=>content.includes(r.user)&&(!r.system||content.includes(r.system)));
   const keys=new Set(matches.map(r=>r.caller+'|'+r.purpose));
   const tags=new Set(matches.map(r=>r.label));   // 1.5.1 용도가 같아도 이름표가 서로 다르면 이름표는 뺀다
   if(keys.size===1)return {caller:matches[0].caller,purpose:matches[0].purpose,attribution:'matched',...(tags.size===1&&matches[0].label?{label:matches[0].label}:{})};
   if(keys.size>1)return {caller,purpose:'unknown',attribution:'ambiguous'};
  }
  if(kind!=='text')return {caller,purpose:kind||'other',attribution:'endpoint'};
  const byCaller={'llm-translator-custom':'translation.chat','llm-translator':'translation.chat','chat-bookmarks':'translation.bookmark','ban-word-rewrite':'rewrite','story-direction':'direction',memory:'summary',caption:'image.caption'};
  const purpose=caller==='chat'?({'swipe':'chat.swipe','regenerate':'chat.regenerate','continue':'chat.continue','impersonate':'chat.impersonate','quiet':'chat.quiet'}[type]||'chat.generate'):byCaller[caller]||'unknown';
  return {caller,purpose,attribution:purpose==='unknown'?'unknown':'caller'};
 }
 return {begin,resolve,get size(){return active.size;}};
}
