// 작은 설명 창 (6.1.5) — 월드인포 ? · 한글화 패널 작업 줄 ? 가 같이 쓴다. help = { title, body: [문단], list: [[이름, 설명]], rec: 추천 }
import { showThemeModal } from './modal.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function helpSheetHtml(help) {
    const body = (help.body || []).map(p => `<p>${esc(p)}</p>`).join('');
    const list = help.list?.length ? `<dl class="bl-wi-help-list">${help.list.map(([term, text]) => `<dt>${esc(term)}</dt><dd>${esc(text)}</dd>`).join('')}</dl>` : '';
    const rec = help.rec ? `<p class="bl-wi-help-rec"><b>추천</b>${esc(help.rec)}</p>` : '';
    return `<h3>${esc(help.title)}</h3>${body}${list}${rec}<div class="bl-wi-help-actions"><button type="button" class="salty-btn">닫기</button></div>`;
}

export function openHelpSheet(help) {
    if (!help) return null;
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-wi-help-dialog';
    dialog.innerHTML = helpSheetHtml(help);
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('.bl-wi-help-actions button').addEventListener('click', () => dialog.close());
    // 바깥(뒷배경)을 눌렀을 때만 닫기 — 창 안 여백을 눌러도 target 이 dialog 라 자리로 가른다
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    showThemeModal(dialog);
    return dialog;
}
