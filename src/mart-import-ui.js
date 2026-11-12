// 1.0.1 「마트에서 가져오기」 창 — 설정 › 장식 액자 › 보관함 · 로그 복사 › 내 글꾸 두 곳에서 열어요.
// 새 창으로 마트 열기 · 붙여넣기 칸 · 파일 고르기(.bl-mart.json) → 검사(mart-import.js) → 그림 한 번 디코드 → 이미 있으면 「덮어쓸까요?」 → 넣고 결과 요약(몇 개 · 거른 것 · 이유).
// 코드 실행 없음 — JSON 데이터만 읽어요. 시작 그래프 밖(단추를 누를 때 받아요).
import { readMart, findDupes, addMartItems, summary, isGeulkku, dropCssComments, MART_URL, MART_TEXT_MAX } from './mart-import.js';
import { drawPreset } from './frame-presets.js';
import { showThemeModal } from './modal.js';
import { ask } from './ask.js';
import { getSettings } from './settings.js';
import { imageWidth, imageHeight } from './imagedecode.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** 그림으로 한 번 디코드해 크기 확인 (8 ~ 8192px) */
const decodes = src => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { const w = imageWidth(img), h = imageHeight(img); resolve(w >= 8 && h >= 8 && w <= 8192 && h <= 8192); };
    img.onerror = () => resolve(false);
    img.src = src;
});

/** 1.1.4 심플 글꾸: 테마 소독기(log-copy-sanitize.js)를 지나도 같은 틀인가 — 복사 글에서 무엇이 걷힐 틀은 받지 않아요 */
async function sanitizedSame(html) {
    const { sanitizeHtml } = await import('./log-copy-sanitize.js');
    const plain = new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html').body.innerHTML;
    return sanitizeHtml(html, { keepPreviewMarks: true }) === dropCssComments(plain);
}

/**
 * @param {{ kind?: 'frames'|'geulkku', text?: string, apply: (mutator: (settings: object) => void) => void, done?: (result: object) => void }} options
 *   apply: 설정을 고치고 저장하는 쪽(설정 창은 update · 로그 복사 시트는 saveSettings) · text: 바로 가져올 글(시트 붙여넣기 칸에서 온 것)
 */
export function openMartImport({ kind = 'frames', text = '', apply, done } = {}) {
    ensureStyle();
    const geulkku = kind === 'geulkku';
    const where = geulkku ? '글꾸 마트' : '액자 마트';
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-mart';
    dialog.setAttribute('aria-labelledby', 'bl-mart-title');
    dialog.innerHTML = `<header class="bl-mart-head"><h3 id="bl-mart-title"><i class="fa-solid fa-store" aria-hidden="true"></i><span>마트에서 가져오기</span></h3><button type="button" class="bl-mart-x" data-mart="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <p class="bl-mart-note">${where}에서 <b>${geulkku ? '복사 · 테마로 담기' : '복사'}</b>한 글을 붙여 넣거나 받은 파일(.bl-mart.json)을 골라요. 코드는 받지 않고 모양 데이터만 읽어요. ${geulkku ? '글꾸는 「내 글꾸」로' : '액자는 보관함으로'} 들어가요.</p>
        <a class="salty-btn bl-mart-open" href="${esc(`${MART_URL}/${geulkku ? 'geulkku' : 'frames'}/`)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span>${where} 열기</span></a>
        <textarea rows="6" placeholder="{&quot;bl-mart&quot;: 1, … } 를 붙여 넣어요" aria-label="마트에서 복사한 글" spellcheck="false" data-mart-text></textarea>
        <div class="bl-mart-row"><button type="button" class="salty-btn" data-mart="file"><i class="fa-solid fa-file-import" aria-hidden="true"></i><span>파일 고르기</span></button><button type="button" class="salty-btn bl-tool-primary" data-mart="go">가져오기</button></div>
        <input type="file" accept=".json,application/json" hidden data-mart-file>
        <div class="bl-mart-result" role="status" aria-live="polite" data-mart-result hidden></div>`;
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const box = $('[data-mart-text]');
    let busy = false;
    const show = (head, lines = []) => {
        const out = $('[data-mart-result]');
        out.hidden = false;
        out.innerHTML = `<b>${esc(head)}</b>${lines.length ? `<ul>${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}`;
    };
    const run = async (raw) => {
        if (busy) return;
        busy = true;
        $('[data-mart="go"]').disabled = true;
        try {
            const read = readMart(raw);
            if (read.error) { show(read.error); return; }
            show(read.items.some(item => item.kind === 'frame') ? '그림을 확인하는 중이에요…' : '확인하는 중이에요…');
            const items = [], bad = [];
            for (const item of read.items) {
                if (item.kind === 'frame' && !((await decodes(item.decor.art)) && (await decodes(item.decor.mask)))) { bad.push({ name: item.name, reason: '그림을 읽지 못했어요' }); continue; }
                if (item.kind === 'geulkku-simple' && !(await sanitizedSame(item.frame.html))) { bad.push({ name: item.name, reason: '테마 복사 글에서 걷힐 것이 든 틀이에요' }); continue; }
                items.push(item);
            }
            const dupes = findDupes(getSettings(), items);
            let replace = new Set();
            if (dupes.length && await ask(`이미 있어요: ${dupes.map(item => item.name).join(', ')}\n덮어쓸까요?`, { ok: '덮어쓰기', cancel: '건너뛰기', title: '마트에서 가져오기' })) replace = new Set(dupes.map(item => item.id));
            const taken = items.some(isGeulkku) ? new Set((await import('./log-copy-presets.js')).PRESETS.map(p => p.id)) : new Set();
            let result = { frames: [], geulkku: [], simple: [], replaced: [], skipped: [] };
            apply((settings) => { result = addMartItems(settings, items, { replace, taken, draw: item => drawPreset(item.presetId, item) }); });
            const { head, lines } = summary(result, [...read.skipped, ...bad]);
            show(head, lines);
            if (result.frames.length || result.geulkku.length) { box.value = ''; done?.(result); }
        } catch (error) {
            show(`가져오지 못했어요 — ${error?.message || error}`);
        } finally {
            busy = false;
            $('[data-mart="go"]').disabled = false;
        }
    };
    dialog.addEventListener('click', (event) => {
        const act = event.target.closest('[data-mart]')?.dataset.mart;
        if (act === 'close') dialog.close();
        else if (act === 'file') $('[data-mart-file]').click();
        else if (act === 'go') run(box.value);
    });
    $('[data-mart-file]').addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (file.size > MART_TEXT_MAX) { show('파일이 너무 커요(40MB 까지)'); return; }
        // 1.1.0 읽기가 막히면(지워진 파일 · 권한) 처리 안 된 거절로 조용히 끝났어요 — 결과 칸에 알려요
        let raw;
        try { raw = await file.text(); } catch (error) { show(`파일을 읽지 못했어요 — ${error?.message || error}`); return; }
        run(raw);
    });
    dialog.addEventListener('close', () => dialog.remove());
    showThemeModal(dialog);
    if (text) { box.value = text.length < 200000 ? text : ''; run(text); }
    else box.focus();
    return dialog;
}

const STYLE = `
.bl-mart { width:min(520px, calc(100vw - 24px)); box-sizing:border-box; }
.bl-mart-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.bl-mart-head h3 { display:flex; align-items:center; gap:8px; margin:0; font-size:var(--bl-ui-h-sub, 16px); font-weight:var(--bl-ui-strong, 650); }   /* 공용 제목 토큰(16/650) — 88 의 h3 규칙은 dialog > header > h3 를 빼서 여기서 맞춰요 */
.bl-mart .salty-btn { min-height:var(--bl-ui-ctl, 36px); padding:calc(6px + var(--bl-text-nudge, 0px)) 10px calc(6px - var(--bl-text-nudge, 0px)); border-radius:var(--bl-ui-radius, 8px); font-size:var(--bl-ui-btn-fs, 14px); font-weight:400; line-height:1.4; }   /* 공용 글자 단추(88 토큰 · 설정 창 .salty-btn 과 같은 꼴 36) — 51 의 위아래 8 · 줄높이 1.45 로 38~39 가 되던 것. 닫기 ✕ 는 88 · 75 의 공용 창 목록(dialog.bl-mart) */
.bl-mart .bl-mart-note { margin:8px 0; font-size:13px; line-height:1.6; color:var(--salty-muted); }
.bl-mart .bl-mart-open { box-sizing:border-box; width:100%; margin:0 0 8px; text-decoration:none; color:var(--salty-text); }
.bl-mart textarea { box-sizing:border-box; width:100%; min-height:120px; padding:8px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:12px/1.5 ui-monospace, Consolas, monospace; resize:vertical; }
.bl-mart textarea:focus { outline:1px solid var(--salty-accent); }
.bl-mart-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
.bl-mart-result { margin-top:10px; padding:10px 12px; border-radius:8px; background:var(--salty-raised); font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.bl-mart-result[hidden] { display:none; }
.bl-mart-result ul { margin:4px 0 0; padding-left:18px; color:var(--salty-muted); }
`;
function ensureStyle() {
    if (document.getElementById('bl-mart-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-mart-style';
    style.textContent = STYLE;
    document.head.append(style);
}
