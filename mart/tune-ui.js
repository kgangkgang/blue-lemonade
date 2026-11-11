// 11-11 글꾸 마트 크게 보기 창의 「조절」 칸 — 블루레몬에이드 테마 「글자」 탭의 축소판(사용자 「블루레몬축소판을 글꾸마트에넣는다고생각해」).
//   묶음 칩: 색 · 본문 · 대사 · 문단 · 그림자 · 외곽선(테마 글자 탭 순서에서 깡통 글에 살아남는 것만) — 칸 이름 · 범위 · 단계는 look.js LOOK_FIELDS(테마와 같은 키).
//   「색」: 색 칩(깡통 · 깡캐 · 소품 · 제목 · 본문 · 대사) · 밤/낮 · 소품 기본 색/캐릭터 색. 바꾼 칸에만 ↺(그 칸만 「틀 그대로」).
//   「글 고치기」: 켠 동안 미리보기의 글자를 바로 고쳐 써요. 「내 프리셋」(틀과 따로 — 색 + 글 모양) · 「내 글꾸」(틀 + 고쳐 쓴 글까지).
//   값: 틀마다 = tune.js · 글 모양(모든 틀) = look.js · 깡통 · 깡캐 · 밤낮 = tone-state.js. 고친 것은 카드 미리보기 · 「HTML 복사」에 같은 길(toneOut)로 들어가요.
import { toneState, setTone } from './tone-state.js?v=20261111i';
import { speakerPair, hasPropTone, hasOwnTone } from './simple-frames.js?v=20261111i';
import { TUNE_ROLES, EDIT_CLASSES, tuneOf, setTune, editables, mineList, saveMine, forgetMine } from './tune.js?v=20261111i';
import { LOOK_FIELDS, LOOK_TABS, FONT_STACKS, lookNow, lookValue, setLook, setLookValue, presetList, presetLast, markPreset, savePreset, renamePreset, forgetPreset, exportPreset, importPreset, codeBytes } from './look.js?v=20261111i';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HEX = /^#[0-9a-f]{6}$/i;
const NEUTRAL = '#8b8e96';
const hexOf = (rgb) => { const m = String(rgb || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/); return m ? '#' + m.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('') : null; };
const clone = t => JSON.parse(JSON.stringify(t || {}));
let editing = false;   // 「글 고치기」 켬 — 켜 둔 동안만 미리보기 글자를 고쳐 쓸 수 있어요(꺼져 있으면 소품 누르기 그대로)
let tab = 'color';     // 펼친 묶음

// ── 가로로 미는 칩 줄(.mart-hscroll) — 테마 설정 창의 칩 줄(panel.js fadeTags · showTag)과 같은 식 ──
const FADE = 28;
/** 넘치는 쪽만, 남은 거리만큼 흐려요(넘치지 않으면 흐림 없음) */
export function fadeRow(row) {
    const rest = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('over', row.scrollWidth > row.clientWidth + 1);
    row.style.setProperty('--fade-l', `${Math.max(0, Math.min(FADE, row.scrollLeft))}px`);
    row.style.setProperty('--fade-r', `${Math.max(0, Math.min(FADE, rest))}px`);
}
/** 고른 칩이 줄 밖이나 흐린 끝에 있으면 보이게 옮겨요 */
export function showOn(row) {
    if (!row.clientWidth) return;
    const on = row.querySelector('[aria-pressed="true"], [aria-current="true"]');
    if (on) { const left = on.offsetLeft - row.offsetLeft; row.scrollLeft = Math.min(Math.max(row.scrollLeft, left + on.offsetWidth + FADE - row.clientWidth), Math.max(0, left - FADE)); }
    fadeRow(row);
}
/** 그 안의 칩 줄 전부: 흐림을 맞추고(show 면 고른 칩도 보이게) */
export function tidyRows(root, show = false) { for (const row of root?.querySelectorAll('.mart-hscroll') || []) (show ? showOn : fadeRow)(row); }

/** 그 틀에 보일 색 칩 목록 — [{ key, label, title }] (틀에 있는 것만 · 틀이 못 받는 칸은 안 보여요) */
function chipsOf(item) {
    const html = item.preview || '';
    const out = [{ key: 'k', label: '깡통', title: '깡통(첫째 화자) 색 — 목록 위 「깡통」 칸과 같은 값이에요' }, { key: 'k2', label: '깡캐', title: '깡캐(둘째 화자) 색 — 목록 위 「깡캐」 칸과 같은 값이에요' }];
    if (hasPropTone(html)) out.push({ key: 'prop', label: '소품', title: '소품 색 — 안 고르면 깡통 색을 따라가요' });
    for (const r of TUNE_ROLES) if (new RegExp(`class="(?:[^"]*\\s)?${r.cls}(?:\\s[^"]*)?"`).test(html)) out.push({ key: r.role, label: r.label, title: `${r.label} 글자색 — 밤 · 낮 판마다 따로 기억해요` });
    return out;
}
/** 색 칩의 지금 값 — { 칸: { value(보일 색), changed } } · previewRoot: 크게 보기 미리보기(글자색 원래 값을 화면에서 읽어요) */
function valuesOf(item, previewRoot) {
    const t = tuneOf(item.id), pair = speakerPair(item.preview || ''), mode = toneState.mode;
    const k = toneState.on ? (toneState.k || NEUTRAL) : (pair.main || NEUTRAL);
    const out = { k: { value: k, changed: toneState.on }, k2: { value: toneState.k2 || pair.other || NEUTRAL, changed: !!toneState.k2 }, prop: { value: t?.prop || k, changed: !!t?.prop } };
    for (const r of TUNE_ROLES) {
        const own = t?.inks?.[mode]?.[r.role];
        const el = previewRoot?.querySelector(`.gk ${r.sel}`);
        out[r.role] = { value: own || (el && hexOf(getComputedStyle(el).color)) || NEUTRAL, changed: !!own };
    }
    return out;
}
/** 숫자칸에 보일 글자(자간은 테마처럼 em 으로) · 값이 없으면 빈칸(자리 글자 「틀」 = 틀 그대로) */
const numText = (f, v) => (v == null ? '' : String(f.scale ? Number((v / f.scale).toFixed(2)) : Number(Number(v).toFixed(2))));
const fillOf = (f, v) => `${Number((((v ?? f.def) - f.min) / (f.max - f.min) * 100).toFixed(1))}%`;
const whenOk = (f) => !f.when || (f.when === 'marker' ? lookValue('dialogue.style') === 'marker' : f.when === 'shadow' ? lookValue('shadow.on') === true : lookValue('outline.on') === true);
const undoBtn = (attr, key, label) => `<button type="button" class="mart-tune-undo" ${attr}="${key}" title="${esc(label)} · 틀 그대로" aria-label="${esc(label)} · 틀 그대로" hidden>↺</button>`;

/** 글 모양 한 칸 */
function fieldHtml(f) {
    const p = esc(f.path), lab = `<span class="mart-look-label">${esc(f.label)}</span>`;
    const when = f.when ? ` data-when="${f.when}"` : '';
    if (f.kind === 'range') return `<div class="mart-param${f.wide ? ' is-wide' : ''}"><header><span class="mart-param-name">${esc(f.label)}</span>${undoBtn('data-look-reset', p, f.label)}<span class="mart-num"><input type="number" step="any" inputmode="decimal" data-look-num="${p}" placeholder="틀" aria-label="${esc(f.label)} 숫자"><i class="mart-unit">${esc(f.unit || '')}</i></span></header><input type="range" data-look="${p}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.def}" style="--fill:${fillOf(f, null)}" aria-label="${esc(f.label)}"></div>`;
    if (f.kind === 'pick') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}"><button type="button" class="chip" data-look-pick="${p}" data-v="null" aria-pressed="true">틀 그대로</button>${f.options.map(([id, l]) => `<button type="button" class="chip" data-look-pick="${p}" data-v="${esc(JSON.stringify(id))}" aria-pressed="false">${esc(l)}</button>`).join('')}</span></div>`;
    if (f.kind === 'font') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}"><button type="button" class="chip" data-look-pick="${p}" data-v="null" aria-pressed="true">틀 그대로</button>${FONT_STACKS.map(s => `<button type="button" class="chip" data-look-pick="${p}" data-v="${esc(JSON.stringify(s.id))}" aria-pressed="false">${esc(s.label)}</button>`).join('')}</span></div><p class="mart-tune-hint">깡통 글에서는 기기 글꼴만 먹어요 · 읽는 사람 기기에 없는 글꼴은 기본 글꼴로 보여요</p>`;
    if (f.kind === 'toggle') return `<div class="mart-look-row"${when}>${lab}<button type="button" class="chip" data-look-toggle="${p}" aria-pressed="false">켬</button></div>`;
    if (f.kind === 'targets') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}">${f.options.map(([id, l]) => `<button type="button" class="chip" data-look-target="${id}" aria-pressed="false">${esc(l)}</button>`).join('')}</span></div>`;
    if (f.kind === 'color') return `<div class="mart-look-row"${when}>${lab}<label class="mart-ink" title="${esc(f.label)} 바꾸기"><input type="color" data-look-color="${p}" value="${f.def}" aria-label="${esc(f.label)}"><span class="mart-ink-dot" style="background-color:${f.def}" aria-hidden="true"></span>${esc(f.label)}</label></div>`;
    return '';
}
function tabBody(item) {
    if (tab === 'color') {
        const chips = chipsOf(item).map(c => `<span class="mart-tune-chip"><label class="mart-ink" title="${esc(c.title)}"><input type="color" data-tune="${c.key}" value="${NEUTRAL}" aria-label="${esc(c.label)} 색"><span class="mart-ink-dot" aria-hidden="true"></span>${esc(c.label)}</label>${undoBtn('data-tune-reset', c.key, c.label)}</span>`).join('');
        return `<div class="mart-inks mart-tune-colors mart-hscroll" role="group" aria-label="색 — 눌러서 바꿔요">${chips}</div>
            <div class="mart-tune-line mart-hscroll"><span class="mart-seg" role="group" aria-label="밤낮"><button type="button" class="chip" data-tune-mode="dark" aria-pressed="false">밤</button><button type="button" class="chip" data-tune-mode="light" aria-pressed="false">낮</button></span>${hasOwnTone(item.preview) ? '<span class="mart-seg mart-tune-own" role="group" aria-label="소품 색"><button type="button" class="chip" data-tune-own="1" aria-pressed="true">소품 기본 색</button><button type="button" class="chip" data-tune-own="0" aria-pressed="false">소품 캐릭터 색</button></span>' : ''}</div>`;
    }
    const fields = LOOK_FIELDS.filter(f => f.tab === tab && whenOk(f)), html = [];
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.kind !== 'range') { html.push(fieldHtml(f)); continue; }
        let j = i; while (j < fields.length && fields[j].kind === 'range') j++;   // 이어진 슬라이더 칸 한 묶음(i ~ j-1)
        for (let k = i; k < j; k++) html.push(fieldHtml({ ...fields[k], wide: (j - i) % 2 === 1 && k === j - 1 }));
        i = j - 1;
    }
    return `<div class="mart-look">${html.join('')}</div>`;
}

/** 조절 칸(미리보기 위) — 묶음 칩 + 펼친 묶음의 칸 + 글 고치기 · 전부 처음으로 */
export function tuneHtml(item) {
    if (!item?.simple || !item.preview) return '';
    return `<section class="mart-tune" aria-label="조절"><div class="mart-tune-tabs mart-seg mart-hscroll" role="group" aria-label="조절 묶음">${LOOK_TABS.map(([id, l]) => `<button type="button" class="chip" data-tune-tab="${id}" aria-pressed="${id === tab}">${esc(l)}</button>`).join('')}</div>
        <div class="mart-tune-body">${tabBody(item)}</div>
        <div class="mart-tune-line"><button type="button" class="chip mart-tune-edit" data-tune-edit aria-pressed="false">글 고치기</button><button type="button" class="chip mart-tune-all" data-tune-reset="all" hidden>전부 처음으로</button></div>
        <p class="mart-tune-hint" data-edit-hint hidden>미리보기의 글자를 눌러 바로 고쳐 써요 · 고치는 동안은 소품이 안 눌려요</p></section>`;
}
const dotOf = p => (p.tone.on && p.tone.k ? p.tone.k : NEUTRAL);
const presetsHtml = () => {
    const list = presetList(), last = presetLast();
    if (!list.length) return '<p class="mart-tune-empty">아직 없어요 · 지금 색과 글 모양을 이름 붙여 기억해 두면 어느 틀에든 한 번에 입혀요</p>';
    return `<ul class="mart-tune-mine mart-hscroll">${list.map(x => `<li${x.id === last ? ' class="is-here"' : ''}><button type="button" class="mart-tune-load" data-preset-load="${esc(x.id)}" title="이 프리셋 입히기"${x.id === last ? ' aria-current="true"' : ''}><i class="mart-ink-dot" style="background:${esc(dotOf(x))}" aria-hidden="true"></i><b>${esc(x.name)}</b><span>${x.look ? '색 · 글 모양' : '색'}</span></button><button type="button" class="mart-cast-x" data-preset-rename="${esc(x.id)}" aria-label="${esc(x.name)} 이름 바꾸기" title="이름 바꾸기">✎︎</button><button type="button" class="mart-cast-x" data-preset-forget="${esc(x.id)}" aria-label="${esc(x.name)} 지우기" title="지우기">×</button></li>`).join('')}</ul>`;
};
const mineHtml = (item) => {
    const list = mineList();
    if (!list.length) return '<p class="mart-tune-empty">아직 없어요 · 틀과 고쳐 쓴 글까지 통째로 기억해요</p>';
    return `<ul class="mart-tune-mine mart-hscroll">${list.map(x => `<li${x.frame === item.id ? ' class="is-here"' : ''}><button type="button" class="mart-tune-load" data-mine-load="${esc(x.id)}" title="불러오기"><i class="mart-ink-dot" style="background:${esc(dotOf(x))}" aria-hidden="true"></i><b>${esc(x.name)}</b><span>${esc(x.frameName || x.frame)}</span></button><button type="button" class="mart-cast-x" data-mine-forget="${esc(x.id)}" aria-label="${esc(x.name)} 지우기" title="지우기">×</button></li>`).join('')}</ul>`;
};
/** 「내 프리셋」 · 「내 글꾸」 칸(미리보기 아래) */
export function mineBoxHtml(item) {
    if (!item?.simple || !item.preview) return '';
    return `<section class="mart-tune-save" aria-label="내 프리셋"><h3 class="mart-tune-h">내 프리셋 <small>색 + 글 모양 · 어느 틀에든</small></h3>
        <form class="mart-tune-form" data-form="preset"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="프리셋 이름" aria-label="프리셋 이름" required></label><button type="submit" class="btn">프리셋 저장</button></form>
        <div class="mart-preset-list">${presetsHtml()}</div>
        <div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-preset-reset>기본으로</button><button type="button" class="chip" data-preset-export>내보내기</button><button type="button" class="chip" data-preset-io aria-expanded="false">가져오기</button></div>
        <div class="mart-preset-io" hidden><textarea class="field" rows="2" placeholder="프리셋 글자(BLM1.…)나 블루레몬 테마 스타일 코드(BLS1.…) · 프리셋 파일 내용을 붙여 넣어요" aria-label="프리셋 글자 붙여 넣기"></textarea><button type="button" class="btn" data-preset-import>가져와서 입히기</button></div>
        <h3 class="mart-tune-h">내 글꾸 <small>이 틀 + 고쳐 쓴 글까지</small></h3>
        <form class="mart-tune-form" data-form="mine"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="내 글꾸 이름" aria-label="내 글꾸 이름" required></label><button type="submit" class="btn">내 글꾸에 저장</button></form>
        <div class="mart-tune-list">${mineHtml(item)}</div></section>`;
}
/** 조절 칸을 지금 값으로 맞춰요 — 칸을 새로 그리지 않아요(색 고르기 창 · 끌고 있는 슬라이더가 안 날아가게) */
export function syncTune(sheet, item) {
    const box = sheet?.querySelector('.mart-tune'); if (!box || !item) return;
    const root = sheet.querySelector('.mart-sheet-preview'), v = valuesOf(item, root), t = tuneOf(item.id);
    for (const b of box.querySelectorAll('[data-tune-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tuneTab === tab));
    for (const input of box.querySelectorAll('input[data-tune]')) {
        const cur = v[input.dataset.tune]; if (!cur) continue;
        if (document.activeElement !== input && !input.dataset.busy) input.value = cur.value;
        const dot = input.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = input.dataset.busy ? input.value : cur.value;
        const undo = input.closest('.mart-tune-chip')?.querySelector('[data-tune-reset]'); if (undo) undo.hidden = !cur.changed;
    }
    for (const b of box.querySelectorAll('[data-tune-mode]')) b.setAttribute('aria-pressed', String(b.dataset.tuneMode === toneState.mode));
    for (const b of box.querySelectorAll('[data-tune-own]')) b.setAttribute('aria-pressed', String((b.dataset.tuneOwn === '0') === (t?.own === false)));
    // 글 모양 칸
    for (const f of LOOK_FIELDS) {
        const cur = lookValue(f.path);
        if (f.kind === 'range') {
            const input = box.querySelector(`input[data-look="${f.path}"]`); if (!input) continue;
            if (document.activeElement !== input) input.value = String(cur ?? f.def);
            input.style.setProperty('--fill', fillOf(f, document.activeElement === input ? Number(input.value) : cur));
            const n = box.querySelector(`input[data-look-num="${f.path}"]`); if (n && document.activeElement !== n) n.value = numText(f, cur);
            const undo = box.querySelector(`[data-look-reset="${f.path}"]`); if (undo) undo.hidden = cur == null;
        } else if (f.kind === 'pick' || f.kind === 'font') {
            for (const b of box.querySelectorAll(`[data-look-pick="${f.path}"]`)) b.setAttribute('aria-pressed', String(JSON.parse(b.dataset.v) === cur));
        } else if (f.kind === 'toggle') {
            const b = box.querySelector(`[data-look-toggle="${f.path}"]`); if (b) { b.setAttribute('aria-pressed', String(cur === true)); b.textContent = cur === true ? '켬' : '끔'; }
        } else if (f.kind === 'targets') {
            const tg = cur || (lookValue('shadow.on') ? { dialogue: true } : {});
            for (const b of box.querySelectorAll('[data-look-target]')) b.setAttribute('aria-pressed', String(tg[b.dataset.lookTarget] === true));
        } else if (f.kind === 'color') {
            const input = box.querySelector(`input[data-look-color="${f.path}"]`); if (!input) continue;
            if (document.activeElement !== input && !input.dataset.busy) input.value = cur || f.def;
            const dot = input.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = input.value;
        }
    }
    box.querySelector('[data-tune-edit]')?.setAttribute('aria-pressed', String(editing));
    const hint = box.querySelector('[data-edit-hint]'); if (hint) hint.hidden = !editing;
    const all = box.querySelector('[data-tune-reset="all"]'); if (all) all.hidden = !(t || toneState.on || toneState.k2 || lookNow());
    const laid = box.clientWidth > 0;   // 창이 뜨기 전(폭 0)에는 건너뛰고, 뜬 뒤 다시 맞춰요
    tidyRows(box, laid && box.dataset.shown !== tab); if (laid) box.dataset.shown = tab;   // 묶음을 바꾼 직후에만 고른 칩을 보이게(그 뒤에는 미는 대로 둬요)
}
export const syncMine = (sheet, item) => {
    if (!sheet || !item) return;
    const body = sheet.querySelector('.mart-tune-body'); if (body && tab !== 'color' && !body.contains(document.activeElement)) { body.innerHTML = tabBody(item); syncTune(sheet, item); }
    const list = sheet.querySelector('.mart-tune-list'); if (list) list.innerHTML = mineHtml(item);
    const pl = sheet.querySelector('.mart-preset-list'); if (pl) pl.innerHTML = presetsHtml();
    tidyRows(sheet.querySelector('.mart-tune-save'), true);
};

/** 미리보기의 글 자리를 고쳐 쓸 수 있게(「글 고치기」가 켜져 있을 때만) — 자리 번호는 tune.js editables 와 같은 차례 */
export function armEdit(previewRoot, item) {
    if (!previewRoot || !item?.simple) return;
    const root = previewRoot.querySelector('.gk'); if (!root) return;
    let i = 0;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walk.nextNode(); el; el = walk.nextNode()) {
        if (el.childElementCount || ['STYLE', 'SCRIPT', 'AUDIO'].includes(el.tagName) || [...el.childNodes].some(n => n.nodeType === 8)) continue;
        let prev = el.previousSibling; while (prev && prev.nodeType === 3 && !prev.data.trim()) prev = prev.previousSibling;
        const marked = prev?.nodeType === 8 && /^\s*✎/.test(prev.data);
        if (!marked && !EDIT_CLASSES.some(c => el.classList.contains(c))) continue;
        el.dataset.blEd = String(i++);
        if (editing) { el.setAttribute('contenteditable', 'plaintext-only'); if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); }
        else { el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); }
    }
    previewRoot.classList.toggle('is-editing', editing);
}

/** 압축된 테마 스타일 코드(BLS1. — deflate-raw)를 풀어 JSON 글자로 */
async function inflate(text) {
    const stream = new Blob([codeBytes(text)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
}
/** 지금 색 + 글 모양(프리셋에 담을 것) */
const capture = (item) => { const t = tuneOf(item.id) || {}; return { tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, none: toneState.none }, colors: { inks: t.inks, prop: t.prop, own: t.own }, look: lookNow() }; };
/** 프리셋을 지금 틀에 입혀요 — 고쳐 쓴 글은 그대로 · 그 틀이 못 받는 값(없는 소품 색 등)은 아무 일도 안 해요 */
function applyPreset(item, p) {
    const texts = tuneOf(item.id)?.texts;
    setTune(item.id, { ...p.colors, ...(texts ? { texts } : {}) });
    setLook(p.look);
    setTone(p.tone.on ? { on: true, k: p.tone.k, name: p.tone.name, k2: p.tone.k2, name2: p.tone.name2 } : { on: false, k2: p.tone.k2, name2: p.tone.name2 });
    markPreset(p.id);
}

/** 크게 보기 창에 한 번만 걸어요 — current(): 지금 열린 카드 상태({ item }) · openItem(id): 그 틀의 크게 보기를 열어요 · say: 알림 */
export function wireTune(sheet, { current, openItem, say = () => {} }) {
    let timer = 0, lookTimer = 0;
    const applyColor = (item, key, hex) => {
        if (!HEX.test(hex)) return;
        if (key === 'k') setTone({ on: true, k: hex, name: '' });
        else if (key === 'k2') setTone({ k2: hex, name2: '' });
        else { const t = clone(tuneOf(item.id)); if (key === 'prop') t.prop = hex; else ((t.inks ??= {})[toneState.mode] ??= {})[key] = hex; setTune(item.id, t); }
    };
    const redraw = (item) => { const body = sheet.querySelector('.mart-tune-body'); if (body) body.innerHTML = tabBody(item); const box = sheet.querySelector('.mart-tune'); if (box) delete box.dataset.shown; syncTune(sheet, item); };
    // 칩 줄을 밀면 흐림을 다시 맞춰요(scroll 은 위로 안 올라와서 잡는 단계에서) · 창 크기가 바뀌어도
    sheet.addEventListener('scroll', (e) => { if (e.target.classList?.contains('mart-hscroll')) fadeRow(e.target); }, true);
    addEventListener('resize', () => { if (sheet.open) tidyRows(sheet); });
    sheet.addEventListener('input', (e) => {
        const t = e.target, item = current()?.item; if (!item) return;
        if (t.matches?.('input[data-tune]')) {
            t.dataset.busy = '1';
            const dot = t.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = t.value;
            clearTimeout(timer); timer = setTimeout(() => applyColor(item, t.dataset.tune, t.value), 150);
            return;
        }
        if (t.matches?.('input[data-look]')) {   // 슬라이더: 숫자는 바로 · 다시 칠하기는 0.12초 묶음
            const f = LOOK_FIELDS.find(x => x.path === t.dataset.look), n = sheet.querySelector(`input[data-look-num="${t.dataset.look}"]`);
            if (f) { t.style.setProperty('--fill', fillOf(f, Number(t.value))); if (n) n.value = numText(f, Number(t.value)); }
            clearTimeout(lookTimer); lookTimer = setTimeout(() => setLookValue(t.dataset.look, Number(t.value)), 120);
            return;
        }
        if (t.matches?.('input[data-look-color]')) {
            t.dataset.busy = '1';
            const dot = t.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = t.value;
            clearTimeout(lookTimer); lookTimer = setTimeout(() => setLookValue(t.dataset.lookColor, t.value), 150);
            return;
        }
        const ed = t.closest?.('.mart-sheet-preview [data-bl-ed]');
        if (ed && editing) {   // 글 고치기: 원래 글과 같아지면 그 자리 값은 지워요
            const cur = clone(tuneOf(item.id)), texts = cur.texts ??= {}, i = ed.dataset.blEd;
            const base = current().editBase ??= editables(item.preview).map(x => x.text);
            const now = ed.textContent.replace(/[\r\n]+/g, ' ');
            if (esc(now).replace(/&quot;/g, '"').replace(/&#39;/g, "'") === base[i]) delete texts[i]; else texts[i] = now;
            setTune(item.id, cur, { textOnly: true });
        }
    });
    sheet.addEventListener('change', (e) => {
        const t = e.target, item = current()?.item; if (!item) return;
        if (t.matches?.('input[data-tune]')) { delete t.dataset.busy; clearTimeout(timer); applyColor(item, t.dataset.tune, t.value); }
        else if (t.matches?.('input[data-look]')) { clearTimeout(lookTimer); setLookValue(t.dataset.look, Number(t.value)); }
        else if (t.matches?.('input[data-look-num]')) {   // 숫자칸: 비우면 틀 그대로 · 범위 밖은 범위 안으로(look.js 가 다듬어요)
            const f = LOOK_FIELDS.find(x => x.path === t.dataset.lookNum), raw = t.value.trim();
            setLookValue(f.path, raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw) * (f.scale || 1));
            syncTune(sheet, item);
        }
        else if (t.matches?.('input[data-look-color]')) { delete t.dataset.busy; clearTimeout(lookTimer); setLookValue(t.dataset.lookColor, t.value); }
    });
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest?.('.mart-sheet-preview [data-bl-ed]')) e.preventDefault(); });
    // 고치는 동안 글자를 눌러도 소품(summary)이 열리고 닫히지 않게
    sheet.addEventListener('click', (e) => { if (editing && e.target.closest?.('.mart-sheet-preview [data-bl-ed]') && e.target.closest('summary')) e.preventDefault(); }, true);
    sheet.addEventListener('click', async (e) => {
        const item = current()?.item; if (!item) return;
        const q = sel => e.target.closest?.(sel);
        let b;
        if ((b = q('[data-tune-tab]'))) { tab = b.dataset.tuneTab; redraw(item); return; }
        if ((b = q('[data-tune-mode]'))) { setTone({ mode: b.dataset.tuneMode }); return; }
        if ((b = q('[data-tune-own]'))) { const t = clone(tuneOf(item.id)); if (b.dataset.tuneOwn === '0') t.own = false; else delete t.own; setTune(item.id, t); return; }
        if (q('[data-tune-edit]')) { editing = !editing; armEdit(sheet.querySelector('.mart-sheet-preview'), item); syncTune(sheet, item); return; }
        if ((b = q('[data-look-reset]'))) { setLookValue(b.dataset.lookReset, null); return; }
        if ((b = q('[data-look-pick]'))) { setLookValue(b.dataset.lookPick, JSON.parse(b.dataset.v)); redraw(item); return; }
        if ((b = q('[data-look-toggle]'))) { setLookValue(b.dataset.lookToggle, lookValue(b.dataset.lookToggle) === true ? null : true); redraw(item); return; }
        if ((b = q('[data-look-target]'))) { const cur = { ...(lookValue('shadow.targets') || { dialogue: true }) }; if (cur[b.dataset.lookTarget]) delete cur[b.dataset.lookTarget]; else cur[b.dataset.lookTarget] = true; setLookValue('shadow.targets', Object.keys(cur).length ? cur : null); return; }
        if ((b = q('[data-tune-reset]'))) {
            const key = b.dataset.tuneReset;
            if (key === 'all') { setTune(item.id, null); setLook(null); setTone({ on: false, k2: null }); markPreset(''); syncMine(sheet, item); return; }
            if (key === 'k') { setTone({ on: false }); return; }
            if (key === 'k2') { setTone({ k2: null }); return; }
            const t = clone(tuneOf(item.id));
            if (key === 'prop') delete t.prop; else if (t.inks?.[toneState.mode]) delete t.inks[toneState.mode][key];
            setTune(item.id, t); return;
        }
        // ── 내 프리셋 ──
        if ((b = q('[data-preset-load]'))) { const p = presetList().find(x => x.id === b.dataset.presetLoad); if (!p) return; applyPreset(item, p); syncMine(sheet, item); say(`프리셋 「${p.name}」을 입혔어요`, 2400); return; }
        if ((b = q('[data-preset-rename]'))) { const p = presetList().find(x => x.id === b.dataset.presetRename), f = sheet.querySelector('[data-form="preset"]'); if (!p || !f) return; f.dataset.rename = p.id; f.name.value = p.name; f.querySelector('button').textContent = '이름 바꾸기'; f.name.focus(); f.name.select(); return; }
        if ((b = q('[data-preset-forget]'))) { forgetPreset(b.dataset.presetForget); syncMine(sheet, item); return; }
        if (q('[data-preset-reset]')) { const texts = tuneOf(item.id)?.texts; setTune(item.id, texts ? { texts } : null); setLook(null); setTone({ on: false, k2: null }); markPreset(''); syncMine(sheet, item); say('색과 글 모양을 기본으로 돌렸어요', 2400); return; }
        if ((b = q('[data-preset-io]'))) { const io = sheet.querySelector('.mart-preset-io'); io.hidden = !io.hidden; b.setAttribute('aria-expanded', String(!io.hidden)); if (!io.hidden) io.querySelector('textarea').focus(); return; }
        if (q('[data-preset-export]')) {
            const last = presetList().find(x => x.id === presetLast());
            const code = exportPreset({ name: last?.name || '내 프리셋', ...capture(item) });
            const io = sheet.querySelector('.mart-preset-io'); io.hidden = false; sheet.querySelector('[data-preset-io]')?.setAttribute('aria-expanded', 'true');
            const ta = io.querySelector('textarea'); ta.value = code; ta.focus(); ta.select();
            try { await navigator.clipboard.writeText(code); say('프리셋 글자를 복사했어요 · 다른 기기의 「가져오기」에 붙여 넣어요', 3200); } catch { say('아래 칸의 글자를 복사해 가요', 3200); }
            return;
        }
        if (q('[data-preset-import]')) {
            const ta = sheet.querySelector('.mart-preset-io textarea'), text = ta.value.trim();
            let got = null;
            try { got = /^BLS1\./.test(text) ? importPreset(text, { json: await inflate(text) }) : importPreset(text); } catch { got = null; }
            if (!got) { say('읽을 수 없는 글자예요 · 프리셋 글자나 테마 스타일 코드를 통째로 붙여 넣어 주세요', 3600); return; }
            const row = savePreset(got.preset); if (!row) return;
            applyPreset(item, row); ta.value = ''; syncMine(sheet, item);
            say(got.from === 'theme' ? `테마 스타일에서 글 모양을 가져와 「${row.name}」로 기억하고 입혔어요(글꼴 · 색은 빼고요)` : `프리셋 「${row.name}」을 가져와 입혔어요`, 3600);
            return;
        }
        // ── 내 글꾸 ──
        if ((b = q('[data-mine-load]'))) {
            const x = mineList().find(v => v.id === b.dataset.mineLoad); if (!x) return;
            setTune(x.frame, x.tune);
            setTone(x.tone.on ? { on: true, k: x.tone.k, name: x.tone.name, k2: x.tone.k2, name2: x.tone.name2, mode: x.tone.mode } : { on: false, k2: x.tone.k2, name2: x.tone.name2, mode: x.tone.mode });
            if (x.look !== undefined) setLook(x.look);
            if (x.frame !== item.id) openItem(x.frame);
            say(`「${x.name}」을 불러왔어요`, 2400);
            return;
        }
        if ((b = q('[data-mine-forget]'))) { forgetMine(b.dataset.mineForget); syncMine(sheet, item); }
    });
    sheet.addEventListener('submit', (e) => {
        const f = e.target.closest?.('.mart-tune-form'); if (!f) return;
        e.preventDefault();
        const item = current()?.item; if (!item) return;
        if (f.dataset.form === 'preset') {
            if (f.dataset.rename) {
                const ok = renamePreset(f.dataset.rename, f.name.value);
                delete f.dataset.rename; f.querySelector('button').textContent = '프리셋 저장';
                if (!ok) { say('그 이름은 못 써요(비었거나 이미 있어요)', 2600); return; }
                f.name.value = ''; syncMine(sheet, item); return;
            }
            const row = savePreset({ name: f.name.value, ...capture(item) });
            if (!row) { say('이름을 넣어 주세요', 2400); return; }
            f.name.value = ''; syncMine(sheet, item);
            say(`프리셋 「${row.name}」을 기억했어요 · 어느 틀에서든 눌러 입혀요`, 3000);
            return;
        }
        const row = saveMine({ frame: item.id, frameName: item.name || item.label, name: f.name.value, tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, mode: toneState.mode, none: toneState.none }, tune: tuneOf(item.id), look: lookNow() });
        if (!row) { say('이름을 넣어 주세요', 2400); return; }
        f.name.value = ''; syncMine(sheet, item);
        say(`「${row.name}」을 내 글꾸에 기억했어요 · 이 브라우저에 남아요`, 3000);
    });
}
