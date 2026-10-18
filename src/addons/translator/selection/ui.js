import { showThemeModal } from '../../../modal.js';
import { LABELS, esc } from './core.js';
import { enabled, termHooks } from './state.js';
import { prepareTranslation, applyTranslation } from './translation.js';
import { prepareTermMemory, applyTermMemory, undoTermMemory, prepareTermList, removeTermRule } from './term-memory.js';
import { attachStyleProfiles } from './style-profile-ui.js';
let selected = null, dialog = null;
export function setSelection(value) { selected = value; }
export function clearSelection() { selected = null; }
const textBlock = (label, text) => `<details><summary>${esc(label)}</summary><pre>${esc(text)}</pre></details>`;
function frame(id) {
    const box = document.createElement('dialog'); box.className = 'llmt-selection'; box.dataset.tool = id;
    box.setAttribute('aria-label', LABELS[id]);
    box.innerHTML = `<header><span class="llmt-selection-title"><i class="fa-solid fa-language" aria-hidden="true"></i><h3>${LABELS[id]}</h3></span><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="llmt-selection-body"></div><p class="llmt-selection-status" role="status" aria-live="polite"></p>`;
    document.body.append(box); box.querySelector('[data-close]').onclick = () => box.close();
    const fit = () => {
        const view = window.visualViewport, height = view?.height || innerHeight;
        box.style.maxHeight = `${Math.max(120, height - 24)}px`;
        box.style.top = `${(view?.offsetTop || 0) + Math.max(12, (height - box.offsetHeight) / 2)}px`;
    };
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    const observer = new ResizeObserver(fit); observer.observe(box);
    box.addEventListener('close', () => {
        window.removeEventListener('resize', fit);
        window.visualViewport?.removeEventListener('resize', fit);
        window.visualViewport?.removeEventListener('scroll', fit);
        observer.disconnect(); box.remove(); if (dialog === box) dialog = null;
    });
    showThemeModal(box); fit(); dialog = box; return box;
}
export function closeTools() { dialog?.close(); selected = null; }
function status(box, message) { if (box.isConnected) box.querySelector('.llmt-selection-status').textContent = message; }
async function action(box, button, fn, busy = '처리 중…') {
    button.disabled = true; status(box, busy);
    try { await fn(); if (box.isConnected) status(box, ''); }
    catch (e) { status(box, e.message || '작업을 마치지 못했어요.'); }
    finally { button.disabled = false; }
}
export async function openTool(id) {
    if (!enabled(id)) { globalThis.toastr?.info('번역 설정 → 번역 동작에서 선택 부분 재번역을 켜 주세요.'); return; }
    const snapshot = selected; dialog?.close(); const box = frame(id), body = box.querySelector('.llmt-selection-body');
    let closed = false;
    box.addEventListener('close', () => { closed = true; }, { once: true });
    if (id === 'retranslate') {
        body.innerHTML = '<p>선택한 문단을 원문으로 다시 번역해요. 확인한 뒤 교체하세요.</p>' + (snapshot ? textBlock('선택한 번역문', snapshot.text) : '<p>창을 닫고 채팅 본문에서 문장이나 문단을 선택한 뒤, 나타나는 언어 버튼을 눌러 주세요.</p>') + '<button data-translate data-primary><i class="fa-solid fa-language" aria-hidden="true"></i> 다시 번역</button><div data-preview></div>';
        const button = body.querySelector('[data-translate]'); button.disabled = !snapshot;
        attachStyleProfiles(body,snapshot,()=>closed||!box.open);
        const terms = document.createElement('details'); terms.className = 'llmt-term-memory';
        terms.innerHTML = '<summary>다음에도 이 표기로</summary><p>이 채팅에서만 기억해요. 원문 표기 한 가지와 원하는 표기를 확인해 주세요. 이름·호칭도 말하는 사람에 따라 달라진다면 원문을 더 구체적으로 적어 주세요.</p><button data-term-open>선택한 표기 고치기</button><div data-term-form></div>';
        body.append(terms); terms.querySelector('[data-term-open]').disabled = !snapshot;
        if(termHooks()?.enabled?.()===false){const note=document.createElement('p');note.textContent='용어집이 꺼져 있어요. 현재 글은 고칠 수 있지만, 기억한 표기는 용어집을 켠 뒤부터 다음 번역에 적용돼요.';terms.prepend(note);}
        const manage=document.createElement('details');manage.innerHTML='<summary>이 채팅에 기억한 표기</summary><div data-term-list></div>';terms.append(manage);
        let listJob=null;
        const renderList=()=>{
            const list=manage.querySelector('[data-term-list]');list.replaceChildren();
            if(!listJob.entries.length){list.textContent='기억한 표기가 없어요.';return;}
            for(const entry of listJob.entries){
                const row=document.createElement('p'),label=document.createElement('span'),remove=document.createElement('button');
                label.textContent=`${entry.src} → ${entry.dst} `;remove.type='button';remove.textContent='지우기';remove.setAttribute('aria-label',`${entry.src} 기억 지우기`);
                remove.onclick=()=>action(box,remove,async()=>{listJob=await removeTermRule(listJob,entry.id);if(closed)return;renderList();if(!listJob.saved?.confirmed){const note=document.createElement('p');note.textContent='현재 목록에서 지웠지만 서버 저장은 확인하지 못했어요. 연결을 확인해 주세요.';list.append(note);}});
                row.append(label,remove);list.append(row);
            }
        };
        manage.addEventListener('toggle',()=>{if(!manage.open)return;try{listJob=prepareTermList(snapshot,()=>closed||!box.open);renderList();}catch(e){manage.querySelector('[data-term-list]').textContent=e.message;}});
        terms.querySelector('[data-term-open]').onclick = event => action(box,event.currentTarget,async()=>{
            const job = await prepareTermMemory(snapshot,()=>closed || !box.open);
            if (closed || !box.isConnected) return;
            const form = terms.querySelector('[data-term-form]');
            form.innerHTML = textBlock('이 답변의 원문 확인',job.source) + '<p>' + (job.suggested ? '기존 용어집의 짝을 가져왔어요. 이 문맥에서도 맞는지 확인하세요.' : '대응 원문을 자동으로 확정하지 않았어요. 위 원문에서 해당 표기를 직접 적어 주세요.') + '</p><label>원문 표기<input data-term-src maxlength="100"></label><label>새 표기<input data-term-dst maxlength="100"></label><div class="llmt-selection-actions"><button data-term-save data-primary>고치고 이 채팅에 기억</button><button data-term-undo disabled>되돌리기</button></div><p data-term-result role="status"></p>';
            form.querySelector('[data-term-src]').value = job.suggested;
            form.querySelector('[data-term-dst]').value = snapshot.text;
            let undo = null;
            form.querySelector('[data-term-save]').onclick = event => action(box,event.currentTarget,async()=>{
                const src = form.querySelector('[data-term-src]').value, dst = form.querySelector('[data-term-dst]').value;
                undo = await applyTermMemory(job,src,dst);
                if(closed || !box.isConnected) return;
                form.querySelector('[data-term-save]').hidden = true;
                form.querySelectorAll('input').forEach(input=>input.disabled=true);
                form.querySelector('[data-term-undo]').disabled=false;
                button.disabled=true;
                form.querySelector('[data-term-result]').textContent=undo.saved?.confirmed ? '선택한 한 곳을 고쳤고, 이 채팅의 다음 번역에 사용할 표기로 기억했어요.' : '현재 화면과 기억할 표기는 바꿨어요. 서버 저장은 확인하지 못했으니 연결을 확인해 주세요. 아래에서 되돌릴 수 있어요.';
            });
            form.querySelector('[data-term-undo]').onclick = event => action(box,event.currentTarget,async()=>{
                const saved = await undoTermMemory(undo);
                if(closed || !box.isConnected) return;
                form.querySelector('[data-term-result]').textContent=saved?.confirmed ? '번역문과 기억한 표기를 함께 되돌렸어요.' : '현재 번역문과 기억한 표기는 되돌렸어요. 서버 저장은 확인하지 못했으니 연결을 확인해 주세요.';
                form.querySelector('[data-term-undo]').hidden=true;
            });
        },'번역 기록 확인 중…');
        button.onclick = () => action(box, button, async () => {
            const job = await prepareTranslation(snapshot, () => closed || !box.open); if (!box.isConnected) return;
            const preview = body.querySelector('[data-preview]');
            preview.innerHTML = textBlock('교체할 기존 문단', job.translated.slice(job.span.start,job.span.end)) + textBlock('대응 원문 확인 (AI 대조)', job.original) + `<label>새 번역<textarea data-new rows="7">${esc(job.result)}</textarea></label><div class="llmt-selection-actions"><button data-apply data-primary><i class="fa-solid fa-check" aria-hidden="true"></i> 이 부분 교체</button><button data-undo disabled><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> 되돌리기</button></div>`;
            let undo = null;
            preview.querySelector('[data-apply]').onclick = event => action(box, event.currentTarget, async () => {
                job.result = preview.querySelector('[data-new]').value;
                undo = await applyTranslation(job);
                preview.querySelector('[data-apply]').hidden = true; preview.querySelector('[data-new]').disabled = true;
                preview.querySelector('[data-undo]').disabled = false; button.disabled = true;
                globalThis.toastr?.success('선택한 부분을 바꿨어요.');
            });
            preview.querySelector('[data-undo]').onclick = event => action(box, event.currentTarget, async () => {
                await applyTranslation(undo); preview.replaceChildren(); button.disabled = true;
                globalThis.toastr?.success('기존 번역으로 되돌렸어요.');
            });
        }, '원문을 대조하고 재번역하는 중… (모델 호출 2회)');
    }
}
