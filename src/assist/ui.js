import { LABELS, esc } from './core.js';
import { enabled } from './state.js';
import { diagnose } from './diagnostics.js';
let dialog = null;
function frame(id) {
    const box = document.createElement('dialog'); box.className = 'bl-assist'; box.dataset.tool = id;
    box.innerHTML = `<header><h3>${LABELS[id]}</h3><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-assist-body"></div><p class="bl-assist-status" role="status" aria-live="polite"></p>`;
    document.body.append(box); box.querySelector('[data-close]').onclick = () => box.close();
    box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
    box.showModal(); dialog = box; return box;
}
export function closeTools() { dialog?.close(); }
function status(box, message) { if (box.isConnected) box.querySelector('[role=status]').textContent = message; }
async function action(box, button, fn, busy = '처리 중…') {
    button.disabled = true; status(box, busy);
    try { await fn(); if (box.isConnected) status(box, ''); }
    catch (e) { status(box, e.message || '작업을 마치지 못했어요.'); }
    finally { button.disabled = false; }
}
export async function openTool(id) {
    if (!enabled(id)) { globalThis.toastr?.info('설정 → 확장에서 기능을 켜 주세요.'); return; }
    dialog?.close(); const box = frame(id), body = box.querySelector('.bl-assist-body');
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
    }
}
