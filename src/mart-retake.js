// 1.2.0 다시 받기 창(점검 1112 「테마 마」) — 이미 있는 글꾸 · 액자를 다시 받을 때 무엇을 할지 물어요. mart-import-ui.js 가 불러요(시작 그래프 밖).
//   테마에서 바꾼 조절 값(스타일 · 색 · 움직임 …)이 덮어쓰기로 사라지는 글꾸가 있으면 셋 중에 골라요: 덮어쓰기 · 조절 값 지키고 틀만 새로 · 그만두기.
//   그런 글꾸가 없으면 예전처럼 「덮어쓰기 · 건너뛰기」 둘(ask.js) — 글에 「틀이 같아요 / 마트 판이 바뀌었어요」를 덧붙여요.
//   그만두기 · 건너뛰기 · Esc = 이미 있는 것은 그대로 두고 새것만 받아요(예전 「건너뛰기」와 같아요) — 새것이 같이 든 꾸러미면 단추 글도 「이미 있는 것은 그대로」.
import { ask } from './ask.js';
import { showThemeModal } from './modal.js';
import { isGeulkku } from './mart-import.js';
import { retakeOf, oldOf } from './log-copy-mine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** 이미 있는 것마다 견준 결과 — 글꾸만(액자는 견줄 것 없음) */
export function retakeRows(settings, dupes) {
    return dupes.map((item) => {
        const old = isGeulkku(item) ? oldOf(settings?.logCopy, item) : null;   // 내 글꾸 · 추천 판에서 바꾼 조절 값
        return { item, ...(old ? retakeOf(old, item) : { frame: 'same', tuned: false, keepable: false }) };
    });
}

/** 줄 글 — 「이름 — 틀이 같아요 · 테마에서 바꾼 조절 값이 있어요」 */
export function rowText({ item, frame, tuned }) {
    const bits = [isGeulkku(item) ? (frame === 'new' ? '마트 판이 바뀌었어요' : '틀은 같아요') : ''];
    if (tuned) bits.push('테마에서 바꾼 조절 값이 있어요');
    return `${item.name}${bits.filter(Boolean).length ? ` — ${bits.filter(Boolean).join(' · ')}` : ''}`;
}

/**
 * @param {object} settings 지금 테마 설정
 * @param {object[]} dupes findDupes() 결과
 * @param {boolean} more 꾸러미에 새것도 같이 들었나(그만두기를 눌러도 새것은 들어가요)
 * @returns {Promise<{ replace: Set<string>, keep: Set<string> }>} replace: 덮어쓸 id · keep: 덮어쓰되 조절 값은 지킬 id
 */
export async function askRetake(settings, dupes, more = false) {
    const none = { replace: new Set(), keep: new Set() };
    if (!dupes.length) return none;
    const rows = retakeRows(settings, dupes);
    const all = new Set(dupes.map(item => item.id));
    if (!rows.some(r => r.tuned)) {
        const yes = await ask(`이미 있어요:\n${rows.map(r => `· ${rowText(r)}`).join('\n')}\n덮어쓸까요?`, { ok: '덮어쓰기', cancel: '건너뛰기', title: '마트에서 가져오기' });
        return yes ? { replace: all, keep: new Set() } : none;
    }
    const pick = await choose(rows, more);
    if (pick === 'replace') return { replace: all, keep: new Set() };
    if (pick === 'keep') return { replace: all, keep: new Set(rows.filter(r => r.tuned).map(r => r.item.id)) };   // 안 고친 글꾸는 마트 조절 값을 그대로 받아요
    return none;
}

/** 세 갈래 창 — 'replace' | 'keep' | 'cancel' */
function choose(rows, more) {
    ensureStyle();
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'bl-tool-dialog bl-retake';
        dialog.setAttribute('aria-labelledby', 'bl-retake-title');
        dialog.innerHTML = `<h3 id="bl-retake-title">이미 받은 글꾸예요</h3>
            <p class="bl-retake-note">덮어쓰면 테마에서 바꾼 조절 값(스타일 · 색 · 움직임 · 글 크기 · 세밀)이 마트에서 담은 값으로 바뀌어요.</p>
            <ul class="bl-retake-list">${rows.map(r => `<li>${esc(rowText(r))}</li>`).join('')}</ul>
            <div class="bl-retake-row"><button type="button" class="salty-btn bl-tool-primary" data-retake="keep">조절 값 지키고 틀만 새로</button><button type="button" class="salty-btn" data-retake="replace">덮어쓰기</button><button type="button" class="salty-btn" data-retake="cancel">${more ? '이미 있는 것은 그대로' : '그만두기'}</button></div>`;
        document.body.append(dialog);
        let answer = 'cancel';
        dialog.addEventListener('click', (event) => {
            const act = event.target.closest?.('[data-retake]')?.dataset.retake;
            if (!act) return;
            answer = act;
            dialog.close();
        });
        dialog.addEventListener('close', () => { dialog.remove(); resolve(answer); }, { once: true });
        showThemeModal(dialog);
        dialog.querySelector('[data-retake="keep"]')?.focus();
    });
}

const STYLE = `
.bl-retake { width:min(440px, calc(100vw - 24px)); box-sizing:border-box; }
.bl-retake h3 { margin:0 0 8px; font-size:var(--bl-ui-h-sub, 16px); font-weight:var(--bl-ui-strong, 650); }
.bl-retake-note { margin:0 0 8px; color:var(--salty-muted); font-size:13px; line-height:1.6; }
.bl-retake-list { margin:0 0 12px; padding-left:18px; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.bl-retake-row { display:grid; gap:8px; }
.bl-retake .salty-btn { min-height:var(--bl-ui-ctl, 40px); font-size:14px; }
.bl-retake .bl-tool-primary { border-color:var(--salty-accent); background:var(--salty-accent); color:var(--salty-on-accent, #fff); font-weight:650; }
`;
function ensureStyle() {
    if (document.getElementById('bl-retake-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-retake-style';
    style.textContent = STYLE;
    document.head.append(style);
}
