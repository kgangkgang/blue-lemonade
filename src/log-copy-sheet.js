// 로그 복사 시트 — 고른 글 도구 줄의 「로그 복사」를 누르면 뜨는 작은 창 하나. 화면은 넷이 전부예요:
//   ① 모양 칩 한 줄(즐겨찾기 · 최근 먼저, 맨 끝 「+ 내 글꾸」) ② 색 칩 한 줄(에이드 팔레트 · 밤/낮, 기본 = 지금 팔레트)
//   ③ 도구 칩 셋 — 「이름 숨김」 · 「바꾸기」(켜면 바로 아래 줄이 펼쳐져요) · 「숨기기」(미리보기에서 고른 글을 눌러야 보이는 글로 — log-copy-spoiler.js) ④ 미리보기 — 그 자리에서 눌러 고쳐요(글자 · 제목 · 모델 · 프롬프트, Ctrl+B · I) ⑤ 「복사」(+ 작은 「마크다운」)
// 모양 칩 위에 분류 칩 줄(기본 · 대화 · 종이 · 할로윈 · 갤러리 · 내 글꾸 — 설정창 화면 칩과 같은 .salty-seg.bl-screen-chips) — 그 분류의 모양만 보여요.
// 이름 숨김 · 바꾸기 목록은 채팅 캡처와 같은 저장 칸(captureTools.redact · names · mask · maskStyles · replace · replaceRules) — 한 번 정하면 두 기능이 함께 따라가요.
// 색 칩으로 지금과 다른 에이드를 고르면 틀뿐 아니라 로그 글의 역할 색(본문 · 대사 · 형광펜 · 속마음 · 강조 · 면 · 선)도 그 팔레트 값으로 다시 계산해요 — 직접 고른 고정 색은 그대로.
// 「복사」는 클립보드에 text/html(서식)과 text/plain(그 HTML 코드 글자)을 같이 넣어요 — HTML 칸에 붙이면 코드, 보통 편집기에 붙이면 서식.
// 미리보기는 스크립트를 못 돌리는 sandbox iframe(테마 화면과 분리) · 복사 전에 다시 소독(log-copy-sanitize.js).
// 마지막 모양 · 색 · 즐겨찾기 · 내 글꾸는 테마 설정 logCopy 에 남아요(모델 · 프롬프트 · 제목은 열 때마다 새로 채움). 시작 그래프 밖.
import { getSettings, saveSettings } from './settings.js';
import { showThemeModal } from './modal.js';
import { PALETTES, PALETTE_FAMILIES, isPaletteId, ensurePalettes, paletteColors, paletteFamily, paletteVariant, safeColor, onColor } from './palettes.js';
import { PRESETS, CATEGORIES, HALLOWEEN_COLORS, presetsIn, categoryOf, renderLog, logMarkdown, dateLabel } from './log-copy-presets.js';
import { logHtml } from './log-copy-render.js';
import { sanitizeHtml, sanitizeTree, slotPath, fromPath, guessSlot, imagesFromCode } from './log-copy-sanitize.js';
import { applyFade, revealTab } from './tab-scroll.js';
import { transformLog, recolorLog } from './log-copy-words.js';   // 이름 숨김 · 단어 바꾸기 (채팅 캡처 「로그 공유 · 이름 가림」 설정을 같이 써요) · 고른 에이드로 역할 색 다시 계산
import { withNameAliases } from './name-aliases.js';
import { wrapSpoiler, unwrapSpoiler, spoilerAt, ensureStyle as ensureSpoilerStyle, previewModel } from './log-copy-spoiler.js';   // 숨긴 글 · 미리보기에서 고친 글로 마크다운
import { TOKEN_KEYS } from './palettes.js';   // 가로 칩 줄: 넘치는 쪽 가장자리 흐림 · 고른 칩 보이기 (탭 줄과 같은 부품)

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const HOLD_MS = 520;
const CUSTOM_MAX = 20;
const CUSTOM_BYTES = 60000;

/** 테마 설정 logCopy (settings.js 가 모양을 정리해요) */
const store = () => getSettings().logCopy;

/** 지금 연결의 모델 이름 · 프롬프트 프리셋 이름 (실리태번 공개 API, 없으면 빈 칸) */
export function connectionNames(ctx = globalThis.SillyTavern?.getContext?.()) {
    let model = '', prompt = '';
    try { if (ctx?.mainApi === 'openai' && typeof ctx.getChatCompletionModel === 'function') model = String(ctx.getChatCompletionModel() || ''); } catch { /* 판마다 다름 */ }
    if (!model && typeof ctx?.onlineStatus === 'string' && !/^no_connection$/i.test(ctx.onlineStatus)) model = ctx.onlineStatus;
    try { prompt = String(ctx?.getPresetManager?.()?.getSelectedPresetName?.() || ''); } catch { /* 없음 */ }
    return { model: model.trim(), prompt: prompt.trim() };
}

/** 테마 화면 글꼴 · 자간 (설정창과 같은 값 — 자간은 em 으로 옮겨 글자 크기마다 같은 비율) */
export function uiFont() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-family:var(--salty-font-ui, inherit);font-size:20px;letter-spacing:var(--bl-settings-tracking, normal)';
    probe.textContent = '가';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const spacing = Number.parseFloat(style.letterSpacing);
    const out = { family: style.fontFamily.replace(/"/g, "'"), tracking: Number.isFinite(spacing) && spacing ? `${Math.round((spacing / 20) * 1000) / 1000}em` : 'normal' };
    probe.remove();
    if (!/(serif|sans-serif|monospace|system-ui)\s*$/i.test(out.family)) out.family += ', sans-serif';
    return out;
}

/** 팔레트 id 의 실제 색 (켜지 않고 값만 계산) */
/** 팔레트 id 의 역할 색 전부 (TOKEN_KEYS + pop) — 로그 글 역할 색 다시 계산용 */
export function tokensOf(id) {
    const p = paletteColors({ ...getSettings(), palette: id });
    const out = {};
    for (const key of [...TOKEN_KEYS, 'pop']) if (p[key]) out[key] = safeColor(p[key]);
    return out;
}

export function colorsOf(id) {
    const p = paletteColors({ ...getSettings(), palette: id });
    const v = key => safeColor(p[key] ?? p.text);
    return { bg: v('bg'), surface: v('surface'), raised: v('raised'), text: v('text'), muted: v('muted'), faint: v('faint'), accent: v('accent'), pop: safeColor(p.pop || p.accent), line: v('line'), marker: v('marker'), onAccent: onColor(p.accent) };
}

const nowPalette = () => getSettings().palette || 'salt';
/** 모양이 쓸 팔레트 — 할로윈처럼 dark 표시가 있는 틀은 고른 에이드의 밤 판 */
const paletteFor = (shape, id) => (PRESETS.find(p => p.id === shape)?.dark ? paletteVariant(paletteFamily(id), 'dark') : id);
/** 전용 색 틀(할로윈 — 사용자 결정 「할로윈만 할로윈색」)의 색 묶음, 아니면 null */
const ownColors = (shape) => { const k = HALLOWEEN_COLORS[PRESETS.find(p => p.id === shape)?.own]; return k ? { ...k, raised: k.panel2 } : null; };
const modeOf = id => PALETTES[id]?.mode || (/night|^black$/.test(id) ? 'dark' : 'light');

function chipOrder(s) {
    const ids = PRESETS.map(p => p.id);
    const fav = ids.filter(id => s.fav.includes(id));
    const recent = s.recent.filter(id => ids.includes(id) && !fav.includes(id));
    return [...fav, ...recent, ...ids.filter(id => !fav.includes(id) && !recent.includes(id))];
}

// ── 시트 ─────────────────────────────────────────────────────

let open = null;

/** @param {object} model captureLog() 결과 */
export async function openLogSheet(model) {
    if (!model?.messages?.length) { toastr.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 }); return; }
    open?.close();
    ensureStyle();
    await ensurePalettes();
    const s = store();
    const names = connectionNames();
    const first = model.messages.find(m => m.time)?.time ?? Date.now();
    const state = {
        shape: s.shape,
        palette: isPaletteId(s.palette) && modeOf(s.palette) === modeOf(nowPalette()) ? s.palette : nowPalette(),
        fields: { title: model.chatName, mark: 'LOG', model: names.model, prompt: names.prompt, date: dateLabel(first), from: model.userName, tail: '', info: '', page: '1', subtitle: model.chatName ? `${model.chatName}의 기록` : '' },
        category: CATEGORIES.some(c => c.id === s.category) ? s.category : 'basic',   // 분류 칩 — 처음은 「기본」, 마지막에 고른 것을 기억
        images: [],   // 갤러리: 붙여 넣은 이미지 코드 · 주소 (이번 시트에만)
        picking: false,
        picked: false,   // 이번에 색 칩을 직접 눌렀나 — 누른 것만 기억해요(안 누르면 다음에도 지금 팔레트)
        armed: null,   // 길게 눌러 지울 준비가 된 내 글꾸 id
        order: chipOrder(s),
    };
    if (!PRESETS.some(p => p.id === state.shape) && !s.custom.some(c => c.id === state.shape)) state.shape = 'card';
    const ui = uiFont();

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-lc';
    dialog.setAttribute('aria-labelledby', 'bl-lc-title');
    dialog.innerHTML = `<header class="bl-lc-head"><h3 id="bl-lc-title"><i class="fa-solid fa-copy" aria-hidden="true"></i><span>로그 복사</span><small>메시지 ${model.messages.length}개</small></h3><button type="button" class="salty-btn bl-lc-icon" data-lc="close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
        <div class="bl-lc-scroll">
            <div class="salty-seg bl-screen-chips bl-lc-cats" role="group" aria-label="분류" data-lc-cats></div>
            <div class="bl-lc-chips bl-chip-row" role="radiogroup" aria-label="모양" data-lc-shapes></div>
            <div class="bl-lc-gallery" data-lc-gallery hidden><textarea rows="3" placeholder="이미지 코드(&lt;img …&gt;)나 이미지 주소를 붙여 넣어요" aria-label="갤러리 사진 코드" data-lc-images></textarea><span class="bl-lc-note" data-lc-images-count></span></div>
            <div class="bl-lc-colors" data-lc-colors><div class="bl-lc-mode" role="group" aria-label="밝기">${['light', 'dark'].map(kind => `<button type="button" data-lc-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div><div class="bl-lc-pals bl-chip-row" role="radiogroup" aria-label="색" data-lc-pals></div></div>
            <div class="bl-lc-tools bl-chip-row" role="group" aria-label="이름 숨김 · 바꾸기"><button type="button" class="bl-lc-chip" data-lc="hide" aria-pressed="false"><i class="fa-solid fa-user-secret" aria-hidden="true"></i><span>이름 숨김</span></button><button type="button" class="bl-lc-chip" data-lc="words" aria-pressed="false"><i class="fa-solid fa-right-left" aria-hidden="true"></i><span>바꾸기</span><small data-lc-words-count></small></button><button type="button" class="bl-lc-chip" data-lc="spoiler" disabled title="미리보기에서 글을 고르면 눌러요"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i><span>숨기기</span></button></div>
            <div class="bl-lc-names" data-lc-names hidden><div class="bl-lc-name-list" data-lc-name-list></div><div class="bl-lc-row2"><input type="text" maxlength="40" placeholder="더 가릴 이름" aria-label="더 가릴 이름" data-lc-name-input><button type="button" class="salty-btn bl-lc-icon" data-lc="name-add" aria-label="가릴 이름 더하기"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></div></div>
            <div class="bl-lc-words" data-lc-words hidden><div data-lc-rules></div><button type="button" class="salty-btn bl-lc-add-rule" data-lc="rule-add"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>줄 더하기</span></button></div>
            <div class="bl-lc-pick" data-lc-pick hidden><span>로그 넣을 곳을 눌러요</span><button type="button" class="salty-btn" data-lc="auto">자동으로</button></div>
            <div class="bl-lc-stage" data-lc-stage><iframe sandbox="allow-same-origin" title="미리보기 — 글자를 눌러 바로 고쳐요" data-lc-frame></iframe></div>
            <div class="bl-lc-paste" data-lc-paste hidden><textarea rows="8" placeholder="공유받은 글꾸 HTML 을 붙여 넣어요" aria-label="글꾸 HTML"></textarea><div class="bl-lc-row"><button type="button" class="salty-btn" data-lc="paste-cancel">취소</button><button type="button" class="salty-btn bl-tool-primary" data-lc="paste-save">저장</button></div></div>
        </div>
        <footer class="bl-lc-foot"><button type="button" class="salty-btn" data-lc="md" title="틀 · 색 없이 글만 마크다운으로">글만 복사</button><button type="button" class="salty-btn bl-tool-primary" data-lc="copy" title="보이는 모양 그대로(틀 · 색 · 글꼴) HTML 로"><i class="fa-solid fa-copy" aria-hidden="true"></i> HTML 복사</button></footer>`;
    document.body.append(dialog);
    const $ = selector => dialog.querySelector(selector);
    const frame = $('[data-lc-frame]');
    const custom = () => store().custom.find(c => c.id === state.shape) ?? null;

    // 이름 숨김 · 바꾸기 — 채팅 캡처 설정 그대로
    const tools = () => getSettings().captureTools;
    const hideList = () => withNameAliases([model.chatName, ...model.messages.map(m => m.name), model.userName, ...tools().names].filter(Boolean));
    const view = () => {
        const ct = tools();
        const out = transformLog(model, { rules: ct.replace ? ct.replaceRules : [], hide: ct.redact ? { names: hideList(), mask: ct.mask, style: ct.maskStyles?.[ct.mask], word: ct.maskWord } : null });
        const target = custom() || ownColors(state.shape) ? null : paletteFor(state.shape, state.palette);
        if (target && target !== nowPalette()) out.model = recolorLog(out.model, tokensOf(nowPalette()), tokensOf(target));
        return out;
    };
    const drawTools = () => {
        const ct = tools();
        $('[data-lc="hide"]').setAttribute('aria-pressed', String(ct.redact));
        $('[data-lc="words"]').setAttribute('aria-pressed', String(ct.replace));
        const rules = ct.replaceRules.filter(r => r.from.trim()).length;
        $('[data-lc-words-count]').textContent = rules ? String(rules) : '';
        $('[data-lc-names]').hidden = !ct.redact;
        $('[data-lc-words]').hidden = !ct.replace;
        $('[data-lc-name-list]').innerHTML = (ct.mask === 'auto' ? `<span class="bl-lc-note bl-lc-maskword-row"><input type="text" class="bl-lc-maskword" maxlength="12" value="${esc(ct.maskWord || '○○')}" aria-label="가릴 글자" title="본문 속 이름을 이 글자로 가려요" data-lc-maskword>으로 가려요</span>` : `<span class="bl-lc-note">${esc(ct.mask === 'mosaic' ? '▒▒' : '색 칸')}으로 가려요</span>`) + ct.names.map((name, i) => `<button type="button" class="bl-lc-chip bl-lc-name" data-lc-name-remove="${i}" aria-label="${esc(name)} 빼기"><span>${esc(name)}</span><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`).join('');
        const box = $('[data-lc-rules]');
        if (box.querySelector('input:focus')) return;   // 치는 중에는 줄을 다시 그리지 않아요
        const rows = ct.replaceRules.length ? ct.replaceRules : [{ from: '', to: '' }];
        box.innerHTML = rows.map((rule, i) => `<div class="bl-lc-rule" data-rule="${i}"><input type="text" maxlength="100" placeholder="찾을 말" aria-label="찾을 말 ${i + 1}" data-rule-from value="${esc(rule.from)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><input type="text" maxlength="100" placeholder="바꿀 말" aria-label="바꿀 말 ${i + 1}" data-rule-to value="${esc(rule.to)}"><button type="button" class="salty-btn bl-lc-icon" data-lc-rule-remove="${i}" aria-label="${i + 1}번 줄 지우기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>`).join('');
    };
    let ruleTimer = 0;
    const readRules = () => {
        const ct = tools();
        const rows = [...dialog.querySelectorAll('.bl-lc-rule')].map(row => ({ from: row.querySelector('[data-rule-from]').value.slice(0, 100), to: row.querySelector('[data-rule-to]').value.slice(0, 100) }));
        ct.replaceRules = rows.filter(r => r.from || r.to).slice(0, 50);
        saveSettings();
    };

    // ① 모양 칩
    const drawShapes = () => {
        const s2 = store();
        const shown = new Set(presetsIn(state.category, s2.custom));
        $('[data-lc-cats]').innerHTML = CATEGORIES.map(c => `<button type="button" class="${state.category === c.id ? 'on' : ''}" aria-pressed="${state.category === c.id}" data-cat="${c.id}">${esc(c.label)}</button>`).join('');
        const presetChips = state.order.filter(id => shown.has(id)).map((id) => {
            const p = PRESETS.find(x => x.id === id);
            const on = state.shape === id;
            const mark = p.emoji ? `<span class="bl-lc-emoji" aria-hidden="true">${p.emoji}</span>` : `<i class="fa-solid ${p.icon}" aria-hidden="true"></i>`;
            return `<button type="button" class="bl-lc-chip" role="radio" aria-checked="${on}" data-shape="${id}">${mark}<span>${esc(p.label)}</span>${s2.fav.includes(id) ? '<i class="fa-solid fa-star bl-lc-fav" aria-label="즐겨찾기"></i>' : ''}</button>`;
        }).join('');
        const customChips = s2.custom.filter(c => shown.has(c.id)).map((c) => {
            const on = state.shape === c.id, armed = state.armed === c.id;
            return `<button type="button" class="bl-lc-chip${armed ? ' is-armed' : ''}" role="radio" aria-checked="${on}" data-shape="${esc(c.id)}"><i class="fa-solid ${armed ? 'fa-trash' : 'fa-shapes'}" aria-hidden="true"></i><span>${armed ? '지우기' : esc(c.name)}</span></button>`;
        }).join('');
        $('[data-lc-shapes]').innerHTML = presetChips + customChips + '<button type="button" class="bl-lc-chip bl-lc-add" data-lc="paste"><i class="fa-solid fa-plus" aria-hidden="true"></i><span>내 글꾸</span></button>';
        const strip = $('[data-lc-shapes]'), cats = $('[data-lc-cats]');
        requestAnimationFrame(() => { revealTab(strip, strip.querySelector('[aria-checked="true"]')); applyFade(strip); revealTab(cats, cats.querySelector('.on')); applyFade(cats); });
        const preset = PRESETS.find(x => x.id === state.shape);
        $('[data-lc-gallery]').hidden = !preset?.images;
        $('[data-lc-images-count]').textContent = preset?.images ? `사진 ${(model.images?.length ?? 0) + state.images.length}장` : '';
    };
    // ② 색 칩 — 테마 「색」 화면의 에이드 카드(.salty-pal) 그대로, 작게
    const drawColors = () => {
        const mode = modeOf(state.palette);
        const plain = !!custom() || !!ownColors(state.shape);   // 내 글꾸 · 전용 색 틀(할로윈)은 에이드 색 칩이 없어요
        $('[data-lc-colors]').hidden = plain;
        if (plain) return;
        for (const button of dialog.querySelectorAll('[data-lc-mode]')) button.setAttribute('aria-pressed', String(button.dataset.lcMode === mode));
        const settings = getSettings();
        const families = Object.entries(PALETTE_FAMILIES).filter(([family]) => family !== 'custom' || settings.customName || settings.colorOverrides?.['custom-light'] || settings.colorOverrides?.['custom-night']);
        const selected = paletteFamily(state.palette);
        $('[data-lc-pals]').innerHTML = families.map(([family, data]) => {
            const id = paletteVariant(family, mode), c = colorsOf(id);
            const label = family === 'custom' ? settings.customName || data.label : data.label;
            return `<button type="button" class="salty-pal ${selected === family ? 'on' : ''}" role="radio" aria-checked="${selected === family}" data-palette="${esc(id)}" style="--pal-bg:${c.bg};--pal-surface:${c.surface};--pal-text:${c.text};--pal-muted:${c.muted};--pal-accent:${c.accent};--pal-marker:${c.marker};--pal-pop:${c.pop}"><span class="salty-pal-page"><span><b>${esc(data.sample || label)}</b></span><i></i></span><b>${esc(label)}</b></button>`;
        }).join('');
        const pals = $('[data-lc-pals]');
        revealTab(pals, pals.querySelector('.on'));
        applyFade(pals);
    };

    // ③ 미리보기 (눌러서 고침)
    const pageBg = () => (ownColors(state.shape)?.bg ?? (custom() || (state.shape === 'plain' && state.palette === nowPalette()) ? getComputedStyle(dialog).backgroundColor : colorsOf(paletteFor(state.shape, state.palette)).bg));
    const draw = () => {
        const mine = custom();
        let html;
        const shown = view();
        const fields = shown.rewriteFields(state.fields);
        if (mine) html = mine.html;
        else html = renderLog(shown.model, { shape: state.shape, colors: state.shape === 'plain' ? null : colorsOf(paletteFor(state.shape, state.palette)), ui, fields, images: shown.rewriteImages(state.images), screen: tokensOf(nowPalette()) });
        $('[data-lc-pick]').hidden = !(mine && (state.picking || !mine.slot));
        frame.onload = () => {
            const doc = frame.contentDocument;
            if (!doc) return;
            if (mine) {
                const slot = state.picking ? null : (Array.isArray(mine.slot) && fromPath(doc.body, mine.slot)) || guessSlot(doc.body);
                if (slot) { slot.innerHTML = logHtml(shown.model, { frameless: false }); slot.setAttribute('data-bl-slot', ''); }
                if (state.picking) {
                    doc.body.style.cursor = 'crosshair';
                    doc.addEventListener('click', (event) => {
                        event.preventDefault();
                        const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
                        if (!target || target === doc.body) return;
                        const live = custom();   // 설정을 다시 읽으면 새 객체 — 지금 것에 적는다
                        if (live) live.slot = slotPath(target, doc.body);
                        state.picking = false;
                        saveSettings();
                        draw();
                    }, { once: true });
                    return;
                }
            }
            ensureSpoilerStyle(doc);
            const syncSpoiler = () => {
                const sel = doc.getSelection();
                const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
                const inside = range ? spoilerAt(range) : null;
                state.spoilerRange = range && (inside || !range.collapsed) ? range.cloneRange() : null;
                const chip = $('[data-lc="spoiler"]');
                chip.disabled = !state.spoilerRange;
                chip.setAttribute('aria-pressed', String(!!inside));
                chip.querySelector('span').textContent = inside ? '풀기' : '숨기기';
            };
            doc.addEventListener('selectionchange', syncSpoiler);
            syncSpoiler();
            doc.designMode = 'on';
            try { doc.execCommand('styleWithCSS', false, true); } catch { /* 옛 브라우저 */ }
            doc.addEventListener('input', () => {
                for (const element of doc.querySelectorAll('[data-f]')) state.fields[element.getAttribute('data-f')] = element.textContent;
            });
            doc.addEventListener('keydown', (event) => {   // 미리보기 안 Esc 도 창 닫기
                if (event.key === 'Escape') dialog.close();
            });
        };
        frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}</style></head><body style="margin:0;padding:12px;background-color:${esc(pageBg())};-webkit-text-size-adjust:100%;overflow-wrap:anywhere">${html}</body></html>`;
    };

    /** 미리보기에 보이는 그대로(고친 것 포함) — 소독하고 고치기 표시를 걷은 HTML */
    const result = () => {
        const doc = frame.contentDocument;
        if (!doc?.body) return '';
        // 글자색 굳히기: 미리보기에서 고친 글 · 숨긴 글 · 내 글꾸까지, color 가 인라인으로 없는 요소에 지금 보이는 글자색을 적어요
        // (붙인 곳의 바탕 · 글자색 · <style> 이 무엇이든 안 보이는 글자 0 — 사용자 규칙)
        const win = frame.contentWindow;
        for (const el of doc.body.querySelectorAll('*')) {
            if (el.matches('style, script, br, img, col, colgroup')) continue;
            if (!el.style.color) el.style.color = win.getComputedStyle(el).color;
        }
        const body = doc.body.cloneNode(true);
        sanitizeTree(body);
        return body.innerHTML.trim();
    };

    const remember = () => {
        const s2 = store();
        s2.shape = state.shape;
        if (state.picked) s2.palette = state.palette;
        s2.category = state.category;
        if (PRESETS.some(p => p.id === state.shape)) s2.recent = [state.shape, ...s2.recent.filter(id => id !== state.shape)].slice(0, 5);
        saveSettings();
    };

    const showPaste = (on) => {
        $('[data-lc-paste]').hidden = !on;
        $('[data-lc-stage]').hidden = on;
        $('.bl-lc-foot').hidden = on;
        if (on) $('[data-lc-paste] textarea').focus();
    };

    // 길게 누르기: 프리셋 칩 = 즐겨찾기 별, 내 글꾸 칩 = 지우기 준비
    let hold = 0, held = false;
    $('[data-lc-shapes]').addEventListener('pointerdown', (event) => {
        const chip = event.target.closest('[data-shape]');
        held = false;
        clearTimeout(hold);
        if (!chip) return;
        hold = setTimeout(() => {
            held = true;
            const id = chip.dataset.shape, s2 = store();
            if (PRESETS.some(p => p.id === id)) {
                s2.fav = s2.fav.includes(id) ? s2.fav.filter(x => x !== id) : [...s2.fav, id];
                saveSettings();
                toastr.info(s2.fav.includes(id) ? '즐겨찾기에 넣었어요' : '즐겨찾기에서 뺐어요', '', { timeOut: 1200 });
            } else state.armed = state.armed === id ? null : id;
            drawShapes();
        }, HOLD_MS);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) $('[data-lc-shapes]').addEventListener(type, () => clearTimeout(hold));
    $('[data-lc-shapes]').addEventListener('contextmenu', event => event.preventDefault());

    dialog.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target || !dialog.contains(target)) return;
        if (target.dataset.shape) {
            if (held) { held = false; return; }
            const id = target.dataset.shape;
            if (state.armed === id) {
                const s2 = store();
                s2.custom = s2.custom.filter(c => c.id !== id);
                if (state.shape === id) state.shape = 'card';
                state.armed = null;
                saveSettings();
            } else {
                state.armed = null;
                state.shape = id;
                state.picking = false;
                state.category = categoryOf(id);
            }
            drawShapes(); drawColors(); draw();
            return;
        }
        if (target.dataset.cat) {
            state.category = target.dataset.cat;
            const s2 = store(); s2.category = state.category; saveSettings();
            drawShapes();
            return;
        }
        if (target.dataset.palette) { state.palette = target.dataset.palette; state.picked = true; drawColors(); draw(); return; }
        if (target.dataset.lcMode) { state.palette = paletteVariant(paletteFamily(state.palette), target.dataset.lcMode); state.picked = true; drawColors(); draw(); return; }
        switch (target.dataset.lc) {
            case 'close': dialog.close(); break;
            case 'auto': { const mine = custom(); if (mine) { mine.slot = 'auto'; state.picking = false; saveSettings(); draw(); } break; }   // 'auto' = 고르지 않고 guessSlot 으로
            case 'paste': showPaste(true); break;
            case 'paste-cancel': showPaste(false); break;
            case 'paste-save': {
                const raw = $('[data-lc-paste] textarea').value.trim();
                if (!raw) return;
                const html = sanitizeHtml(raw);
                if (!html.trim()) { toastr.warning('글꾸로 쓸 HTML 이 없어요.', '', { timeOut: 2000 }); return; }
                if (html.length > CUSTOM_BYTES) { toastr.warning(`글꾸가 너무 커요 (${Math.round(CUSTOM_BYTES / 1000)}KB 까지)`, '', { timeOut: 2500 }); return; }
                const s2 = store();
                if (s2.custom.length >= CUSTOM_MAX) { toastr.warning(`내 글꾸는 ${CUSTOM_MAX}개까지예요 — 길게 눌러 지워요`, '', { timeOut: 2500 }); return; }
                const used = new Set(s2.custom.map(c => c.name));
                let n = s2.custom.length + 1;
                while (used.has(`내 글꾸 ${n}`)) n++;
                const item = { id: `c${Date.now().toString(36)}`, name: `내 글꾸 ${n}`, html, slot: null };
                s2.custom = [...s2.custom, item];
                saveSettings();
                $('[data-lc-paste] textarea').value = '';
                state.shape = item.id;
                state.picking = true;
                showPaste(false);
                drawShapes(); drawColors(); draw();
                break;
            }
            case 'md': {
                const fromPreview = frame.contentDocument ? previewModel(frame.contentDocument) : null;   // 미리보기에서 고친 글 · 숨긴 글까지
                const ok = await writeClipboard(null, logMarkdown(fromPreview ?? view().model));
                toast(ok, '글만 마크다운으로 복사했어요');
                if (ok) { remember(); dialog.close(); }
                break;
            }
            case 'copy': {
                const html = result();
                if (!html) return;
                const ok = await writeClipboard(html, html);
                toast(ok, 'HTML 로 복사했어요 — 글 쓰기 창에 붙여 넣으면 모양 그대로예요');
                if (ok) { remember(); dialog.close(); }
                break;
            }
            case 'spoiler': {
                const doc = frame.contentDocument, range = state.spoilerRange;
                if (!doc || !range) break;
                const inside = spoilerAt(range);
                if (inside) unwrapSpoiler(inside);
                else wrapSpoiler(doc, range, ownColors(state.shape) ?? colorsOf(paletteFor(state.shape, state.palette)), ui);
                ensureSpoilerStyle(doc);
                doc.getSelection()?.removeAllRanges();
                state.spoilerRange = null;
                target.disabled = true; target.setAttribute('aria-pressed', 'false'); target.querySelector('span').textContent = '숨기기';
                break;
            }
            case 'hide': { const ct = tools(); ct.redact = !ct.redact; saveSettings(); drawTools(); draw(); break; }
            case 'words': { const ct = tools(); ct.replace = !ct.replace; saveSettings(); drawTools(); draw(); if (ct.replace) $('[data-lc-rules] input')?.focus(); break; }
            case 'rule-add': { readRules(); const ct = tools(); if (ct.replaceRules.length < 50) { ct.replaceRules = [...ct.replaceRules, { from: '', to: '' }]; saveSettings(); } drawTools(); [...dialog.querySelectorAll('[data-rule-from]')].pop()?.focus(); break; }
            case 'name-add': {
                const input = $('[data-lc-name-input]'), name = input.value.trim();
                const ct = tools();
                if (name && !ct.names.includes(name) && ct.names.length < 40) { ct.names = [...ct.names, name]; saveSettings(); }
                input.value = ''; drawTools(); draw(); break;
            }
            default:
                if (target.dataset.lcRuleRemove !== undefined) { const i = Number(target.dataset.lcRuleRemove); const ct = tools(); ct.replaceRules = ct.replaceRules.filter((_, n) => n !== i); saveSettings(); drawTools(); draw(); }
                else if (target.dataset.lcNameRemove !== undefined) { const i = Number(target.dataset.lcNameRemove); const ct = tools(); ct.names = ct.names.filter((_, n) => n !== i); saveSettings(); drawTools(); draw(); }
                break;
        }
    });
    let imageTimer = 0;
    dialog.addEventListener('input', (event) => {
        if (event.target.matches?.('[data-lc-images]')) {
            clearTimeout(imageTimer);
            imageTimer = setTimeout(() => { state.images = imagesFromCode(event.target.value); drawShapes(); draw(); }, 300);
            return;
        }
        if (event.target.matches?.('[data-lc-maskword]')) {   // 11-03: 가림 글자(기본 ○○)를 직접 정해요 — 치는 동안 칸은 다시 그리지 않고 미리보기만
            const ct = tools(); ct.maskWord = event.target.value.trim().slice(0, 12) || '○○'; saveSettings();
            clearTimeout(ruleTimer); ruleTimer = setTimeout(draw, 300); return;
        }
        if (!event.target.closest?.('.bl-lc-rule')) return;
        clearTimeout(ruleTimer);
        ruleTimer = setTimeout(() => { readRules(); $('[data-lc-words-count]').textContent = String(tools().replaceRules.filter(r => r.from.trim()).length || ''); draw(); }, 300);
    });
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches?.('[data-lc-name-input]')) { event.preventDefault(); $('[data-lc="name-add"]').click(); }
    });
    dialog.addEventListener('close', () => { clearTimeout(ruleTimer); if (open === dialog) open = null; dialog.remove(); }, { once: true });
    open = dialog;
    drawShapes();
    drawColors();
    drawTools();
    draw();
    showThemeModal(dialog);
    for (const strip of dialog.querySelectorAll('.bl-chip-row')) strip.addEventListener('scroll', () => applyFade(strip), { passive: true });
    requestAnimationFrame(() => {
        const shapes = $('[data-lc-shapes]');
        revealTab(shapes, shapes.querySelector('[aria-checked="true"]'));
        for (const strip of dialog.querySelectorAll('.bl-chip-row')) applyFade(strip);
    });
}

function toast(ok, message) {
    if (ok) toastr.success(message, '', { timeOut: 1600 });
    else toastr.error('클립보드에 넣지 못했어요. 다시 눌러 주세요.', '로그 복사');
}

/** 클립보드: text/html(있으면) + text/plain. 안전한 주소가 아니어서 Clipboard API 가 없으면 copy 사건으로 */
export async function writeClipboard(html, text) {
    try {
        if (globalThis.isSecureContext && navigator.clipboard) {
            if (html && navigator.clipboard.write && globalThis.ClipboardItem) {
                await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
                return true;
            }
            if (!html && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
        }
    } catch (error) { console.warn('[로그 복사] Clipboard API', error); }
    let ok = false;
    const onCopy = (event) => {
        event.clipboardData?.setData('text/plain', text);
        if (html) event.clipboardData?.setData('text/html', html);
        event.preventDefault();
        ok = !!event.clipboardData;
    };
    document.addEventListener('copy', onCopy, true);
    try { document.execCommand('copy'); } catch { /* 막힘 */ } finally { document.removeEventListener('copy', onCopy, true); }
    return ok;
}

// 시트 모양 — 철칙 크기표(칩 34/32 · 글자 단추 36/34 · 아이콘 단추 34 · 큰 주요 단추 40/44 · 모서리 8/12) · 평평(면 + 1px 선) · 스크롤바 숨김.
// 색은 테마 변수만. 에이드 카드는 테마 「색」 화면의 .salty-pal 을 그대로 쓰고 크기만 줄여요.
const STYLE = `
.bl-tool-dialog.bl-lc { width:min(560px, calc(100vw - 24px)); padding:0; overflow:hidden; display:flex; flex-direction:column; max-height:calc(100dvh - 24px); }
.bl-lc-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 8px 8px 16px; border-bottom:1px solid var(--salty-line); }
.bl-lc-head h3 { display:flex; align-items:center; gap:8px; margin:0; min-width:0; font-size:16px; font-weight:650; line-height:1.4; white-space:nowrap; overflow:hidden; }
.bl-lc-head h3 i { flex:none; margin:0; color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-head h3 small { min-width:0; margin:0; overflow:hidden; text-overflow:ellipsis; color:var(--salty-muted); font-size:13px; font-weight:400; }
.bl-lc .bl-lc-icon { position:relative; flex:none; width:34px; min-width:34px; height:34px; min-height:34px; padding:0; gap:0; border:0; background:transparent; }
.bl-lc .bl-lc-icon::before { content:''; position:absolute; inset:-5px; }
.bl-lc-scroll { display:grid; grid-auto-rows:max-content; gap:8px; padding:12px 0; overflow-y:auto; min-height:0; scrollbar-width:none; }   /* 11-03: 줄 높이는 내용 크기로 — auto 줄이면 창이 꽉 찼을 때 overflow:hidden 인 미리보기 줄이 남은 자리로 줄어들어(최소 높이 0) iframe 만 잘리고 넘치는 내용이 없어져 스크롤이 안 됐어요(사용자 제보) */
.bl-lc-scroll::-webkit-scrollbar, .bl-lc-chips::-webkit-scrollbar, .bl-lc-pals::-webkit-scrollbar { display:none; }
.bl-lc .salty-seg.bl-lc-cats { display:flex; flex-wrap:nowrap; margin:0 16px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
.bl-lc .salty-seg.bl-lc-cats::-webkit-scrollbar { display:none; }
.bl-lc .salty-seg.bl-lc-cats > button { flex:1 0 auto; min-width:max-content; min-height:var(--bl-ui-chip, 34px); white-space:nowrap; font:inherit; font-size:13px; letter-spacing:inherit; cursor:pointer; }
.bl-lc-gallery[hidden] { display:none; }
.bl-lc-gallery { display:grid; gap:4px; margin:0 16px; }
.bl-lc-gallery textarea { box-sizing:border-box; width:100%; min-height:72px; padding:8px 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font-family:var(--salty-font-code, monospace); font-size:13px; scrollbar-width:none; resize:vertical; }
.bl-lc-gallery textarea:focus { outline:1px solid var(--salty-accent); }
.bl-lc-chips, .bl-lc-pals { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; padding:5px 16px; scroll-padding:0 16px; }
.bl-lc-chip { position:relative; flex:none; box-sizing:border-box; display:inline-flex; align-items:center; gap:4px; min-height:var(--bl-ui-chip, 34px); margin:0; padding:0 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-surface); color:var(--salty-text); font:inherit; font-size:13px; line-height:1.2; letter-spacing:inherit; white-space:nowrap; box-shadow:none; cursor:pointer; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
.bl-lc-chip > i { font-size:12px; color:var(--salty-muted); }
.bl-lc-chip > .bl-lc-emoji { font-size:14px; line-height:1; }
.bl-lc-chip:is([aria-checked="true"], [aria-pressed="true"]) { background:var(--salty-accent-10, var(--salty-raised)); font-weight:650; }
.bl-lc-chip[aria-pressed="true"] > i:first-child { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip small { font-size:12px; color:var(--salty-muted); }
.bl-lc-chip:disabled { opacity:.5; cursor:default; }
.bl-lc-chip[aria-checked="true"] > i:first-child { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip .bl-lc-fav { font-size:10px; color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-chip.is-armed { border-color:var(--salty-danger, currentColor); color:var(--salty-danger, inherit); }
.bl-lc-chip.is-armed > i { color:inherit; }
.bl-lc-chip:focus-visible, .bl-lc .salty-pal:focus-visible { outline:1px solid var(--salty-accent); outline-offset:1px; }
.bl-lc-colors { display:flex; align-items:center; gap:0; padding-left:16px; min-width:0; }
.bl-lc-colors[hidden], .bl-lc-pick[hidden], .bl-lc-paste[hidden], .bl-lc-stage[hidden], .bl-lc-foot[hidden] { display:none; }
.bl-lc-colors .bl-lc-pals { flex:1; min-width:0; padding-left:8px; }
.bl-lc-mode { display:flex; flex:none; gap:4px; padding:4px; border-radius:12px; background:var(--salty-fill-shade, var(--salty-shade)); }
.bl-lc-mode button { display:grid; place-items:center; width:34px; height:34px; margin:0; padding:0; border:0; border-radius:8px; background:transparent; color:var(--salty-muted); font-size:14px; cursor:pointer; }
.bl-lc-mode button[aria-pressed="true"] { background:var(--salty-fill-surface, var(--salty-surface)); color:var(--salty-accent); }
.bl-lc .bl-lc-pals .salty-pal { flex:none; width:96px; gap:4px; padding:4px 4px 6px; margin:4px 0; cursor:pointer; }
.bl-lc .bl-lc-pals .salty-pal.on { box-shadow:0 0 0 2px var(--salty-bg), 0 0 0 4px var(--salty-accent); }
.bl-lc .bl-lc-pals .salty-pal-page { padding:6px 8px; font-size:12px; }
.bl-lc .bl-lc-pals .salty-pal-page i { margin-top:6px; }
.bl-lc .bl-lc-pals .salty-pal > b { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bl-lc-pick { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 16px; padding:0 0 0 12px; border:1px solid var(--salty-accent); border-radius:8px; color:var(--salty-text); font-size:13px; }
.bl-lc-pick .salty-btn { min-height:34px; border:0; border-left:1px solid var(--salty-line); border-radius:0 8px 8px 0; }
.bl-lc-stage { margin:0 16px; border:1px solid var(--salty-line); border-radius:12px; overflow:hidden; background:var(--salty-bg); }
.bl-lc-stage iframe { display:block; width:100%; height:min(52dvh, 460px); border:0; background:transparent; }
.bl-lc-paste { display:grid; gap:8px; margin:0 16px; }
.bl-lc-paste textarea { box-sizing:border-box; width:100%; min-height:200px; padding:8px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font-family:var(--salty-font-code, monospace); font-size:13px; scrollbar-width:none; }
.bl-lc-paste textarea:focus { outline:1px solid var(--salty-accent); }
.bl-lc-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.bl-lc-tools { display:flex; gap:8px; padding:5px 16px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
.bl-lc-names[hidden], .bl-lc-words[hidden] { display:none; }
.bl-lc-names, .bl-lc-words { display:grid; gap:8px; margin:0 16px; }
.bl-lc-name-list { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
.bl-lc-note { color:var(--salty-muted); font-size:13px; }
.bl-lc-name > i { font-size:11px; }
.bl-lc-row2 { display:flex; gap:8px; align-items:center; }
.bl-lc-rule { display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr) auto; gap:8px; align-items:center; margin-bottom:8px; }
.bl-lc-rule > i { font-size:12px; color:var(--salty-muted); }
.bl-lc-names input, .bl-lc-rule input { box-sizing:border-box; width:100%; min-width:0; min-height:36px; padding:0 10px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:inherit; font-size:14px; letter-spacing:inherit; box-shadow:none; }
.bl-lc-names input:focus, .bl-lc-rule input:focus { outline:1px solid var(--salty-accent); }
.bl-lc-maskword-row { display:inline-flex; align-items:center; gap:4px; }
.bl-lc-names input.bl-lc-maskword { width:6em; min-height:30px; padding:0 8px; text-align:center; font-size:13px; }
.bl-lc .bl-lc-add-rule { justify-self:start; min-height:36px; }
@media (min-width: 769px) and (pointer: fine) { .bl-lc-names input, .bl-lc-rule input, .bl-lc .bl-lc-add-rule { min-height:34px; } }
.bl-lc-foot { display:grid; grid-template-columns:auto 1fr; gap:8px; padding:12px 16px 16px; border-top:1px solid var(--salty-line); }
.bl-lc-foot .salty-btn { min-height:40px; }
.bl-lc-foot .bl-tool-primary { border-color:var(--salty-accent); background:var(--salty-accent); color:var(--salty-on-accent, #fff); font-weight:650; }   /* 화면당 하나 큰 주요 단추 = 포인트 면 (볼록 · 그림자 없음) */
@media (min-width: 769px) and (pointer: fine) { .bl-lc-chip { min-height:32px; } .bl-lc-foot .salty-btn { min-height:44px; } }
@media (pointer: coarse) { .bl-lc .salty-seg.bl-lc-cats > button { position:relative; } .bl-lc-chip::before, .bl-lc-mode button::before, .bl-lc .salty-seg.bl-lc-cats > button::before { content:''; position:absolute; left:50%; top:50%; width:max(100%, 44px); height:max(100%, 44px); transform:translate(-50%, -50%); } .bl-lc-mode button { position:relative; } }   /* 누르는 칸 44 (철칙 §1 투명 ::before) */
`;
function ensureStyle() {
    if (document.getElementById('bl-lc-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-lc-style';
    style.textContent = STYLE;
    document.head.append(style);
}
