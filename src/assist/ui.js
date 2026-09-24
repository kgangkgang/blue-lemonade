import { LABELS, esc } from './core.js';
import { enabled } from './state.js';
import { diagnose } from './diagnostics.js';
import { prepareTranslation, applyTranslation } from './translation.js';
let selected = null, dialog = null;
export function setSelection(value) { selected = value; }
export function clearSelection() { selected = null; }
const textBlock = (label, text) => `<details><summary>${esc(label)}</summary><pre>${esc(text)}</pre></details>`;
function frame(id) {
    const box = document.createElement('dialog'); box.className = 'bl-assist'; box.dataset.tool = id;
    box.innerHTML = `<header><h3>${LABELS[id]}</h3><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-assist-body"></div><p class="bl-assist-status" role="status" aria-live="polite"></p>`;
    document.body.append(box); box.querySelector('[data-close]').onclick = () => box.close();
    box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
    box.showModal(); dialog = box; return box;
}
export function closeTools() { dialog?.close(); selected = null; }
function status(box, message) { if (box.isConnected) box.querySelector('[role=status]').textContent = message; }
async function action(box, button, fn, busy = '처리 중…') {
    button.disabled = true; status(box, busy);
    try { await fn(); if (box.isConnected) status(box, ''); }
    catch (e) { status(box, e.message || '작업을 마치지 못했어요.'); }
    finally { button.disabled = false; }
}
export async function openTool(id) {
    if (!enabled(id)) { globalThis.toastr?.info('설정 → 확장에서 기능을 켜 주세요.'); return; }
    const snapshot = selected; dialog?.close(); const box = frame(id), body = box.querySelector('.bl-assist-body');
    if (id === 'conflicts') {
        body.innerHTML = '<p>알려진 중복 실행·설치 버전·화면 간섭을 살펴봐요.</p><div class="bl-assist-actions"><button data-check>검사</button><button data-copy disabled>진단 복사</button></div><div data-result></div>';
        let report = '';
        const run = () => action(box, body.querySelector('[data-check]'), async () => {
            const result = await diagnose(); if (!box.isConnected) return;
            report = result.report;
            body.querySelector('[data-result]').innerHTML = result.rows.map(r => `<article><b>${esc(r.level)}</b><p>${esc(r.text)}</p></article>`).join('');
            body.querySelector('[data-copy]').disabled = false;
        }, '점검 중…');
        body.querySelector('[data-check]').onclick = run;
        body.querySelector('[data-copy]').onclick = event => action(box, event.currentTarget, async () => { await navigator.clipboard.writeText(report); globalThis.toastr?.success('진단을 복사했어요.'); });
        await run();
    } else if (id === 'retranslate') {
        body.innerHTML = '<p>선택한 글이 들어 있는 문단을 원문에서 찾아 현재 번역 모델로 재번역해요. 확인 후 해당 문단만 교체해요.</p>' + (snapshot ? textBlock('선택한 번역문', snapshot.text) : '<p>창을 닫고 채팅 본문에서 문장이나 문단을 선택한 뒤, 나타나는 언어 버튼을 눌러 주세요.</p>') + '<button data-translate>다시 번역</button><div data-preview></div>';
        const button = body.querySelector('[data-translate]'); button.disabled = !snapshot;
        button.onclick = () => action(box, button, async () => {
            const job = await prepareTranslation(snapshot); if (!box.isConnected) return;
            const preview = body.querySelector('[data-preview]');
            preview.innerHTML = textBlock('교체할 기존 문단', job.translated.slice(job.span.start,job.span.end)) + textBlock('대응 원문 확인 (AI 대조)', job.original) + `<label>새 번역<textarea data-new rows="7">${esc(job.result)}</textarea></label><div class="bl-assist-actions"><button data-apply>이 부분 교체</button><button data-undo disabled>되돌리기</button></div>`;
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
