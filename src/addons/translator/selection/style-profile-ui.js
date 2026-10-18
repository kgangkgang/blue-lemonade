import { prepareStyleProfiles,saveStyleProfile,removeStyleProfile,undoStyleProfile } from './style-profile-state.js';
export function attachStyleProfiles(body,selection,closed){
 const box=document.createElement('details');box.className='llmt-term-memory';
 box.innerHTML='<summary>인물별 말투·호칭</summary><p>이 채팅의 다음 번역에만 적용해요. 원문에 적히는 이름을 쓰세요. 화자나 상대가 불분명하면 말투를 추측해서 바꾸지 않도록 안내해요.</p><label>말하는 인물<input data-style-speaker maxlength="80" placeholder="원문 이름"></label><label>듣는 상대 (선택)<input data-style-listener maxlength="80" placeholder="상대가 정해진 대사에만"></label><label><input type="checkbox" data-style-mutual> 두 인물 모두에게 같은 말투</label><label>말투<select data-style-mode><option value="polite">존댓말</option><option value="casual">반말</option><option value="custom">직접 적기</option></select></label><label>호칭·말투 메모 (선택)<textarea data-style-note maxlength="300" rows="2" placeholder="예: 상대를 선배라고 부르기"></textarea></label><button type="button" data-style-save>이 채팅에 기억</button><button type="button" data-style-undo hidden>방금 변경 되돌리기</button><p data-style-status role="status"></p><div data-style-list></div>';
 body.append(box);let job=null,undo=null,busy=false;
 const status=text=>{if(box.isConnected)box.querySelector('[data-style-status]').textContent=text;};
 const render=()=>{
  const list=box.querySelector('[data-style-list]');list.replaceChildren();
  if(!job.entries.length){list.textContent='기억한 말투 지침이 없어요.';return;}
  for(const entry of job.entries){const row=document.createElement('p'),label=document.createElement('span'),remove=document.createElement('button');label.textContent=entry.speaker+(entry.listener?(entry.mutual?' ↔ ':' → ')+entry.listener:'')+' · '+({polite:'존댓말',casual:'반말',custom:'직접 지침'}[entry.mode])+(entry.note?' · '+entry.note:'')+' ';remove.type='button';remove.textContent='지우기';remove.onclick=()=>act(()=>removeStyleProfile(job,entry.id));row.append(label,remove);list.append(row);}
 };
 const act=async run=>{if(busy)return;busy=true;box.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);status('저장 확인 중…');try{const result=await run();if(closed()||!box.isConnected)return;job=result;undo=result;render();box.querySelector('[data-style-undo]').hidden=false;status(result.saved?.confirmed?'이 채팅의 번역 지침을 저장했어요.':'현재 지침은 바꿨어요. 서버 저장은 확인하지 못했으니 연결을 확인해 주세요.');}catch(e){status(e.message||'지침을 저장하지 못했어요.');}finally{busy=false;box.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=false);}};
 box.addEventListener('toggle',()=>{if(!box.open||busy)return;try{job=prepareStyleProfiles(selection,closed);render();}catch(e){status(e.message);}});
 box.querySelector('[data-style-save]').onclick=()=>act(()=>{job??=prepareStyleProfiles(selection,closed);return saveStyleProfile(job,{speaker:box.querySelector('[data-style-speaker]').value,listener:box.querySelector('[data-style-listener]').value,mutual:box.querySelector('[data-style-mutual]').checked,mode:box.querySelector('[data-style-mode]').value,note:box.querySelector('[data-style-note]').value});});
 box.querySelector('[data-style-undo]').onclick=()=>act(async()=>{const previous=undo;const result=await undoStyleProfile(previous);return result;});
}
