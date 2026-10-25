import { prepareStyleProfiles,saveStyleProfile,removeStyleProfile,undoStyleProfile } from './style-profile-state.js';
import { styleProfileOverlaps } from '../style-profile.js';
import { showThemeModal } from '../../../modal.js';
import { termHooks,context,chatKey } from './state.js';
export function attachStyleProfiles(body,selection,closed){
 const box=document.createElement('details');box.className='llmt-term-memory';
 box.innerHTML='<summary>인물별 말투·호칭</summary><p>이 채팅의 다음 번역에만 적용해요. 같은 인물의 이름·별칭은 쉼표로 나눠 적어요. 켜진 용어집의 다국어 표기도 함께 찾아요. 화자나 상대가 불분명하면 말투를 추측해서 바꾸지 않도록 안내해요.</p><label>말하는 인물<input data-style-speaker maxlength="80" placeholder="예: 린, 린델, 에버린"></label><label>듣는 상대 (선택)<input data-style-listener maxlength="80" placeholder="상대가 정해진 대사에만"></label><label class="llmt-style-check"><input type="checkbox" data-style-mutual> 두 인물 모두에게 같은 말투</label><label>말투<select data-style-mode><option value="polite">존댓말</option><option value="casual">반말</option><option value="custom">직접 적기</option></select></label><label>호칭·말투 메모 (선택)<textarea data-style-note maxlength="300" rows="2" placeholder="예: 상대를 선배라고 부르기"></textarea></label><button type="button" data-style-save>이 채팅에 기억</button><button type="button" data-style-undo hidden>방금 변경 되돌리기</button><p data-style-status role="status"></p><div data-style-list></div>';
 body.append(box);let job=null,undo=null,busy=false;
 const status=text=>{if(box.isConnected)box.querySelector('[data-style-status]').textContent=text;};
 const render=()=>{
  const list=box.querySelector('[data-style-list]');list.replaceChildren();
  const priority=document.createElement('p');priority.textContent='적용 순서: 특정 상대에게 하는 말 → 두 사람의 상호 지침 → 인물의 일반 말투. 이름만 나온 서술이나 화자가 모호한 대사는 바꾸도록 지시하지 않아요.';list.append(priority);
  if(!job.entries.length){list.textContent='기억한 말투 지침이 없어요.';return;}
  for(const entry of job.entries){const row=document.createElement('p'),label=document.createElement('span'),remove=document.createElement('button');row.className='llmt-rule-row';label.textContent=entry.speaker+(entry.listener?(entry.mutual?' ↔ ':' → ')+entry.listener:'')+' · '+({polite:'존댓말',casual:'반말',custom:'직접 지침'}[entry.mode])+(entry.note?' · '+entry.note:'')+' ';remove.type='button';remove.textContent='지우기';remove.onclick=()=>act(()=>removeStyleProfile(job,entry.id));row.append(label,remove);list.append(row);}
  for(const overlap of styleProfileOverlaps(job.metadata)){const note=document.createElement('p'),label=e=>e.speaker+(e.listener?(e.mutual?' ↔ ':' → ')+e.listener:' (일반 말투)');const labels=overlap.ids.map(id=>label(job.entries.find(e=>e.id===id))),preferred=job.entries.find(e=>e.id===overlap.preferred);note.textContent=labels.join(' · ')+' — '+overlap.text+(preferred?' 우선: '+label(preferred):'');list.append(note);}
 };
 const act=async run=>{if(busy)return;busy=true;box.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);status('저장 확인 중…');try{const result=await run();if(closed()||!box.isConnected)return;job=result;undo=result;render();box.querySelector('[data-style-undo]').hidden=false;status(result.saved?.confirmed?'이 채팅의 번역 지침을 저장했어요.':'현재 지침은 바꿨어요. 서버 저장은 확인하지 못했으니 연결을 확인해 주세요.');}catch(e){status(e.message||'지침을 저장하지 못했어요.');}finally{busy=false;box.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=false);}};
 box.addEventListener('toggle',()=>{if(!box.open||busy)return;try{job=prepareStyleProfiles(selection,closed);render();}catch(e){status(e.message);}});
 box.querySelector('[data-style-save]').onclick=()=>act(()=>{job??=prepareStyleProfiles(selection,closed);return saveStyleProfile(job,{speaker:box.querySelector('[data-style-speaker]').value,listener:box.querySelector('[data-style-listener]').value,mutual:box.querySelector('[data-style-mutual]').checked,mode:box.querySelector('[data-style-mode]').value,note:box.querySelector('[data-style-note]').value});});
 box.querySelector('[data-style-undo]').onclick=()=>act(async()=>{const previous=undo;const result=await undoStyleProfile(previous);return result;});
 const glossary=document.createElement('details');glossary.dataset.glossaryPriority='';glossary.innerHTML='<summary>용어집 표기 우선순위·겹침 확인</summary><div></div>';box.append(glossary);
 glossary.addEventListener('toggle',()=>{if(!glossary.open)return;const target=glossary.querySelector('div');target.replaceChildren();if(!job||closed()||context().chatMetadata!==job.metadata||chatKey()!==job.chatKey){target.textContent='채팅이 바뀌었거나 아직 열리지 않았어요. 창을 다시 열어 주세요.';return;}const review=termHooks()?.priority?.();if(!review){target.textContent='용어집을 준비하지 못했어요. 창을 다시 열어 주세요.';return;}const intro=document.createElement('p');intro.textContent=(review.enabled?'':'용어집이 꺼져 있어 현재 번역에는 적용하지 않아요. ')+'이 채팅 → 현재 캐릭터·그룹 → 그룹 멤버 순서 → 전체. 표기가 하나라도 겹치면 먼저 나온 범위의 항목을 써요. 예외 설정은 오류가 아니에요.';target.append(intro);for(const row of review.rows){const item=document.createElement('p');item.textContent=`${row.scope}: ${row.src} → ${row.dst}`+(row.overlap?` · ${row.overlap.scope}의 ${row.overlap.src} → ${row.overlap.dst} 우선 (${row.overlap.same?'같은 표기':'범위별 예외'})`:' · 이 범위 항목 사용');target.append(item);}if(review.total>review.shown){const note=document.createElement('p');note.textContent=`${review.total}개 중 앞 ${review.shown}개를 표시해요.`;target.append(note);}});
}
let manager=null;
export function openStyleProfileManager(){
 const href=new URL('./style.css',import.meta.url).href;if(![...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.href===href)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
 manager?.close();const dialog=document.createElement('dialog');dialog.className='llmt-selection';dialog.setAttribute('aria-label','인물별 말투·호칭');
 dialog.innerHTML='<header><h3>인물별 말투·호칭</h3><button type="button" data-style-close aria-label="닫기">×</button></header><div class="llmt-selection-body"></div>';
 document.body.append(dialog);manager=dialog;let closed=false;attachStyleProfiles(dialog.querySelector('.llmt-selection-body'),null,()=>closed||!dialog.open);
 dialog.querySelector('[data-style-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{closed=true;dialog.remove();if(manager===dialog)manager=null;},{once:true});
 const fit=()=>{const view=window.visualViewport,height=view?.height||innerHeight;dialog.style.maxHeight=`${Math.max(120,height-24)}px`;dialog.style.top=`${(view?.offsetTop||0)+Math.max(12,(height-dialog.offsetHeight)/2)}px`;};
 const observer=new ResizeObserver(fit);observer.observe(dialog);window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
 dialog.addEventListener('close',()=>{observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit);},{once:true});
 showThemeModal(dialog);dialog.querySelector('details').open=true;fit();return dialog;
}
