import {createComparison,COMPARISON_MODES,applyComparison,undoComparison} from './comparison.js';
export function attachComparison(body,selection,closed){
 const box=document.createElement('details');box.className='llmt-comparison llmt-term-memory';box.innerHTML='<summary>문단 번역 후보 비교</summary><p>동일한 원문 문단을 세 가지 방식으로 옮겨요. 직접 시작할 때만 요청해요. 기본 원문 대조 1회 + 후보마다 1회, 총 4회이며 오류 재시도·번역 보정으로 늘 수 있어요.</p><button type="button" data-compare-start>후보 3개 만들기</button><button type="button" data-compare-cancel hidden>그만 만들기</button><p data-compare-status role="status"></p><div data-compare-results></div><button type="button" data-compare-undo hidden>적용 되돌리기</button>';
 body.append(box);const $=s=>box.querySelector(s),status=s=>{if(!closed())$('[data-compare-status]').textContent=s;};let controller=null,applied=false,undo=null;
 $('[data-compare-start]').disabled=!selection;
 const update=state=>{
  if(closed()||!box.isConnected)return;const rows=state.candidates;
  const counts='원문 대조 '+state.counts.alignment+'회 · '+COMPARISON_MODES.map(m=>m.label+' '+state.counts[m.id]+'회').join(' · ');
  status((state.busy?(state.stage==='alignment'?'원문 대조 중…':COMPARISON_MODES.find(m=>m.id===state.stage)?.label+' 후보 만드는 중…'):'후보를 확인한 뒤 직접 적용하세요.')+' 요청 시도: '+counts+' (과금 확정 횟수는 아니에요)');
  for(const row of rows){if(box.querySelector('[data-candidate="'+row.id+'"]'))continue;const card=document.createElement('section');card.dataset.candidate=row.id;const heading=document.createElement('h4'),text=document.createElement('textarea'),apply=document.createElement('button');heading.textContent=row.label+' · 요청 시도 '+row.calls+'회';text.value=row.result;text.rows=6;text.readOnly=true;apply.type='button';apply.textContent='이 후보 적용';apply.dataset.compareApply=row.id;apply.onclick=async()=>{if(controller.busy||applied)return;apply.disabled=true;try{undo=await applyComparison(controller.job,row.result);if(closed())return;applied=true;box.querySelectorAll('[data-compare-apply]').forEach(b=>b.disabled=true);$('[data-compare-undo]').hidden=false;status((undo.saved?.confirmed?'선택한 문단에 적용했어요.':'현재 문단에 적용했지만 서버 저장은 확인하지 못했어요. 연결을 확인해 주세요.')+(undo.refreshFailed?' 화면을 다시 그리지 못했어요. 채팅을 다시 열어 확인해 주세요.':''));}catch(e){status(e.message);apply.disabled=false;}};card.append(heading,text,apply);$('[data-compare-results]').append(card);}
  box.querySelectorAll('[data-compare-apply]').forEach(b=>b.disabled=state.busy||applied);
 };
 $('[data-compare-start]').onclick=async()=>{
  if(controller)return;$('[data-compare-start]').disabled=true;$('[data-compare-cancel]').hidden=false;controller=createComparison(selection,{closed,update});
  try{await controller.generate();}catch(e){status(e.message);}finally{if(!closed())$('[data-compare-cancel]').hidden=true;}
 };
 $('[data-compare-cancel]').onclick=()=>{controller?.cancel();status('멈추는 중이에요. 이미 보낸 요청은 과금될 수 있어요.');};
 $('[data-compare-undo]').onclick=async()=>{const button=$('[data-compare-undo]');button.disabled=true;try{const saved=await undoComparison(undo);if(closed())return;button.hidden=true;status((saved?.confirmed?'기존 번역으로 되돌렸어요.':'현재 번역은 되돌렸지만 서버 저장은 확인하지 못했어요.')+(saved?.refreshFailed?' 화면을 다시 그리지 못했어요. 채팅을 다시 열어 확인해 주세요.':''));}catch(e){status(e.message);button.disabled=false;}};
}
