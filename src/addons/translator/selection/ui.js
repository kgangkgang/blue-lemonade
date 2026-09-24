import { LABELS, esc } from './core.js';
import { enabled } from './state.js';
import { prepareTranslation, applyTranslation } from './translation.js';
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
    box.showModal(); fit(); dialog = box; return box;
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
    if (!enabled(id)) { globalThis.toastr?.info('번역 설정 → 번역 동작에서 선택 부분 재번역을 켜 주세요.'); return; }
    const snapshot = selected; dialog?.close(); const box = frame(id), body = box.querySelector('.llmt-selection-body');
    if (id === 'retranslate') {
        body.innerHTML = '<p>선택한 문단을 원문으로 다시 번역해요. 확인한 뒤 교체하세요.</p>' + (snapshot ? textBlock('선택한 번역문', snapshot.text) : '<p>창을 닫고 채팅 본문에서 문장이나 문단을 선택한 뒤, 나타나는 언어 버튼을 눌러 주세요.</p>') + '<button data-translate data-primary><i class="fa-solid fa-language" aria-hidden="true"></i> 다시 번역</button><div data-preview></div>';
        const button = body.querySelector('[data-translate]'); button.disabled = !snapshot;
        button.onclick = () => action(box, button, async () => {
            const job = await prepareTranslation(snapshot); if (!box.isConnected) return;
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
