import { LABELS, esc } from './core.js';
import { enabled } from './state.js';
import { diagnose } from './diagnostics.js';
let dialog = null;
function frame(id) {
    const box = document.createElement('dialog'); box.className = 'bl-assist'; box.dataset.tool = id;
    box.setAttribute('aria-label', LABELS[id]);
    box.innerHTML = `<header><span class="bl-assist-title"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i><h3>${LABELS[id]}</h3></span><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-assist-body"></div><p class="bl-assist-status" role="status" aria-live="polite"></p>`;
    document.body.append(box); box.querySelector('[data-close]').onclick = () => box.close();
    box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
    box.showModal(); dialog = box; return box;
}
export function closeTools() { dialog?.close(); }
// http:// 로 연 폰(LAN 접속)에는 clipboard API 가 없다(보안 컨텍스트 전용) — 옛 복사 명령으로 대신한다.
// 글 칸은 이 창(box) 안에 붙인다: showModal 창이 떠 있으면 창 밖(body)은 inert 라 고를 수 없어서, 성공 알림만 뜨고 복사는 안 됐다 (실리태번 copyText 도 열린 dialog 에 붙인다)
async function copyInside(box, text) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* 아래 옛 방식 */ }
    const back = document.activeElement, area = document.createElement('textarea');
    area.value = text; area.readOnly = true; area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    box.append(area); area.select(); area.setSelectionRange(0, area.value.length); // iOS 는 readOnly 칸에서 select() 만으로 안 골라질 때가 있다
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove(); back?.focus?.({ preventScroll: true });
    if (!ok) throw Error('복사하지 못했어요.');
}
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
        body.innerHTML = '<p class="bl-assist-intro">중복 실행과 설치 상태, 화면 간섭을 확인해요.</p><div class="bl-assist-actions"><button data-check data-primary><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> 다시 검사</button><button data-copy disabled><i class="fa-regular fa-copy" aria-hidden="true"></i> 결과 복사</button></div><div data-result></div><small class="bl-assist-footnote">현재 확인 가능한 항목만 점검해요.</small>';
        let report = '';
        const run = () => action(box, body.querySelector('[data-check]'), async () => {
            const result = await diagnose(); if (!box.isConnected) return;
            report = result.report;
            body.querySelector('[data-result]').innerHTML = result.rows.map(r => `<article data-state="${r.code === 'none' ? 'clear' : 'notice'}"><i class="fa-solid fa-${r.code === 'none' ? 'check' : 'circle-exclamation'}" aria-hidden="true"></i><div><b>${esc(r.level)}</b><p>${esc(r.text)}</p></div></article>`).join('');
            body.querySelector('[data-copy]').disabled = false;
        }, '점검 중…');
        body.querySelector('[data-check]').onclick = run;
        body.querySelector('[data-copy]').onclick = event => action(box, event.currentTarget, async () => { await copyInside(box, report); globalThis.toastr?.success('진단을 복사했어요.'); });
        await run();
    }
}
