// 6.9.5 처음 설정 안내 — 테마 설정이 없던 첫 실행에 한 번(settings.js FRESH_SETTINGS), 설정 창 › 테마 › 기타 설정에서 다시.
// 팔레트 → 글꼴 → 읽기 방식만 고른다. 새 설정 칸은 없다: 설정 창과 같은 칸을 같은 길(panel.js updateSettings — 되돌리기 기록 · 적용 · 저장 ·
// 기기별 배치)로 고친다. 읽기 방식은 완성된 스타일(styles.js PRESETS)을 applyStyleData 로 입히되 글꼴은 빼서 2단계에서 고른 글꼴을 지킨다(잠금도 지킴).
// 고르는 순간 바로 적용된다 — 뒤 화면이 바뀌는 것을 보며 고른다. 건너뛰기 · Esc 는 그 자리에서 끝(고른 것은 남는다).
// 7.2.6 「쓰던 테마가 있어요」: 다른 CSS(실리태번 커스텀 CSS — diagnose.js otherCssReport)가 켜져 있으면 맨 앞에 한 장 더 묻는다 (오늘 제보의 대부분이 이것).
//   「블루레몬에이드 테마로 쓰기」 = 다른 CSS 끄기(compat.muteCustomCss) + 「테마 + 확장」 · 「쓰던 테마 유지」 = 「확장만」(CSS 그대로, 저장하고 새로고침).
//   어느 쪽이든 「블루레몬에이드 사용」은 켠다. 답한 CSS 묶음의 지문을 compat.cssAsked 에 적어 다시 묻지 않는다.
//   이미 쓰던 사람도 테마 + 확장 + 다른 CSS 켜짐이면 같은 장을 한 번만(openCssPromptWhenFree) — 「그대로 두기」가 하나 더 있다.
import { getSettings, saveSettings, FONT_SET } from './settings.js';
import { PALETTES, PALETTE_FAMILIES, paletteFamily, paletteVariant, paletteColors, safeColor } from './palettes.js';
import { PRESETS, applyStyleData } from './styles.js';
import { findFont, previewStack, queuePreview, isPreviewReady, isPreviewBlank } from './fonts.js';
import { rememberAppearance } from './appearance-archive.js';
import { themeEnabled, usageMode } from './usage-mode.js';
import { otherCssReport, otherCssFingerprint } from './diagnose.js';

export const STEPS = [['palette', '팔레트', 'fa-palette'], ['font', '글꼴', 'fa-font'], ['reading', '읽기 방식', 'fa-book-open']];
export const CSS_STEP = ['css', '쓰던 테마가 있어요', 'fa-layer-group'];
// 카탈로그의 한국어 글꼴 가운데 결이 다른 여섯 (고딕 둘 · 명조 둘 · 둥근 고딕 · 손글씨). 더 많은 글꼴은 설정 창 › 글자
export const FONT_CHOICES = ['pretendard', 'suit', 'ridibatang', 'maruburi', 'gowun-dodum', 'nanum-pen-script'];
const SAMPLE = '바닷바람이 창을 두드렸다.';   // fonts.js SAMPLES.ko 의 앞 문장 — 구글 글꼴 미리보기 조각에 든 글자만
const isSet = v => !!v && typeof v === 'object';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────── 고르기 (설정 객체만 바꾸는 순수 함수 — 시험: tools/tests/first-run.mjs) ─────────
export const paletteMode = st => PALETTES[st.palette]?.mode === 'dark' ? 'dark' : 'light';
/** 설정 창 팔레트 카드와 같다: 지금 밝기의 그 에이드 */
export function choosePalette(st, family) {
    if (!PALETTE_FAMILIES[family] || family === 'custom') return;
    st.palette = paletteVariant(family, paletteMode(st));
}
/** 설정 창 해 · 달과 같다: 직접 고르면 자동 화이트/나이트는 끈다 */
export function chooseMode(st, mode) {
    st.palette = paletteVariant(paletteFamily(st.palette), mode === 'dark' ? 'dark' : 'light');
    if (st.auto) st.auto.on = false;
}
/** 설정 창 글꼴 고르기(본문 · 한국어 칸)와 같다 */
export function chooseFont(st, id) {
    if (!FONT_CHOICES.includes(id) && !findFont(id)) return;
    if (!isSet(st.fonts.text)) st.fonts.text = { ...FONT_SET };
    st.fonts.text.ko = id;
}
/** 읽기 방식 = 완성된 스타일에서 글꼴만 뺀 것 */
export function readingData(id) {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset) return null;
    const data = preset.data();
    delete data.fonts;
    return data;
}
export function chooseReading(st, id) {
    const data = readingData(id);
    if (data) applyStyleData(st, data);
}
/** 지금 설정이 그 읽기 방식인가 — 스타일이 든 칸 하나하나가 같으면 */
function sameLeaves(have, want) {
    if (isSet(want) && !Array.isArray(want)) return isSet(have) && Object.entries(want).every(([k, v]) => sameLeaves(have[k], v));
    return JSON.stringify(have) === JSON.stringify(want);
}
export function currentReading(st) {
    return PRESETS.find(p => sameLeaves(st, readingData(p.id)))?.id || '';
}

// ───────── 7.2.6 쓰던 테마 (순수 함수 — 시험: tools/tests/first-run-css.mjs) ─────────
/** 「쓰던 테마가 있어요」를 물을 때: 스위치 켬 · 「테마 + 확장」 · 다른 CSS 가 켜져 있고 · 그 묶음(지문)에 아직 답하지 않았을 때 */
export function cssPromptNeeded(st, report, fingerprint) {
    if (!st || st.enabled === false || usageMode(st) !== 'both') return false;
    if (!report || !(report.on > 0) || !fingerprint) return false;
    return (st.compat?.cssAsked || '') !== fingerprint;
}
const compatOf = st => (isSet(st.compat) ? st.compat : (st.compat = { muteCustomCss: false, preserveExtensionColors: false, extensionColorsOff: [], cssAsked: '' }));
/** 블루레몬에이드 테마로 쓰기: 다른 CSS 를 끄고(설정 창 채팅 › 기타 › 「커스텀 CSS 끄기」와 같은 칸) 「테마 + 확장」 · 스위치 켬 */
export function chooseCssKeepTheme(st, fingerprint) {
    st.enabled = true; st.usageMode = 'both';
    compatOf(st).muteCustomCss = true; compatOf(st).cssAsked = String(fingerprint || '');
}
/** 쓰던 테마 유지: 「확장만」 · 스위치 켬 · CSS 는 그대로 (새로고침해야 모드가 바뀐다 — 설정 창의 「저장하고 새로고침」과 같다) */
export function chooseCssKeepOther(st, fingerprint) {
    st.enabled = true; st.usageMode = 'extensions';
    compatOf(st).cssAsked = String(fingerprint || '');
}
/** 그대로 두기: 아무것도 바꾸지 않고 이 묶음은 다시 묻지 않는다 */
export function chooseCssLeave(st, fingerprint) {
    compatOf(st).cssAsked = String(fingerprint || '');
}

// ───────── 창 ─────────
let open = null;
const modalOpen = () => { try { return !!document.querySelector('dialog:modal'); } catch { return !!document.querySelector('dialog[open]'); } };

/** 첫 실행: 테마가 켜져 있고 다른 창이 없을 때 연다 (다른 창이 열려 있으면 닫힐 때까지 1.5초마다 다시 본다 — 타이머만, 숨은 탭에서도) */
export function openFirstRunWhenFree() {
    let tries = 0;
    const attempt = () => {
        if (open || !themeEnabled(getSettings())) return;
        // 6.9.6 10분이 지나도 다른 창이 열려 있으면 이번엔 띄우지 않는다 (그 창 위에 겹치지 않게 — 설정 창 › 기타 설정에서 열 수 있다)
        if (modalOpen()) { if (++tries < 400) setTimeout(attempt, 1500); return; }
        openFirstRun({ auto: true }).catch(error => console.warn('[Blue Lemonade] 처음 설정 안내', error));
    };
    attempt();
}
/** 7.2.6 이미 쓰던 사람: 조건이 맞으면(cssPromptNeeded) 「쓰던 테마가 있어요」 한 장만 — 다른 창이 닫힌 뒤 */
export function openCssPromptWhenFree() {
    let tries = 0;
    const attempt = () => {
        if (open) return;
        let needed = false;
        try { needed = cssPromptNeeded(getSettings(), otherCssReport(getSettings()), otherCssFingerprint()); } catch { needed = false; }
        if (!needed) return;
        if (modalOpen()) { if (++tries < 400) setTimeout(attempt, 1500); return; }
        openFirstRun({ cssOnly: true }).catch(error => console.warn('[Blue Lemonade] 쓰던 테마 안내', error));
    };
    attempt();
}

export async function openFirstRun({ auto = false, cssOnly = false } = {}) {
    if (open?.isConnected) { open.querySelector('[data-fr="next"]')?.focus(); return; }
    const [{ showThemeModal }, panel] = await Promise.all([import('./modal.js'), import('./panel.js').catch(error => { console.warn('[Blue Lemonade] 처음 설정: 설정 창 모듈', error); return null; })]);
    if (open?.isConnected) return;
    if (auto) saveSettings();   // 첫 실행 표시는 테마 설정 칸이 생기는 것 — 저장해 두면 다음 새로고침엔 안 뜨고 (건너뛰어도) 다른 CSS 가 있으면 7.2.6 의 「쓰던 테마」 장만 한 번 더 묻는다
    // 7.2.6 다른 CSS 가 켜져 있으면 맨 앞에 「쓰던 테마가 있어요」 (cssOnly 면 그 장만)
    let cssReport = null, cssFingerprint = '';
    try { cssReport = otherCssReport(getSettings()); cssFingerprint = otherCssFingerprint(); } catch { cssReport = null; }
    const askCss = cssOnly || (!!cssReport && cssReport.on > 0 && cssFingerprint && (getSettings().compat?.cssAsked || '') !== cssFingerprint);
    if (cssOnly && !askCss) return;
    const steps = cssOnly ? [CSS_STEP] : askCss ? [CSS_STEP, ...STEPS] : STEPS;
    let step = 0, remembered = false, cssAnswered = !askCss;
    const back = document.activeElement, fromPanel = back?.dataset?.act === 'first-run';
    const change = mutate => {
        const run = st => { if (!remembered) { remembered = true; rememberAppearance(st, '처음 설정 전'); } mutate(st); };
        if (panel?.updateSettings) return panel.updateSettings(run);
        run(getSettings());
        try { globalThis.Salty?.applyAll?.(); } catch (error) { console.error('[Blue Lemonade] 처음 설정 적용', error); }
        saveSettings();
        return true;
    };
    // 쓰던 테마 답은 모습(팔레트 · 글꼴)이 아니라 쓰는 방식이라 되돌리기 기록 없이 바로 저장한다 (설정 창의 사용 모드 · 커스텀 CSS 끄기 스위치와 같은 칸)
    const decide = mutate => {
        mutate(getSettings());
        try { globalThis.Salty?.applyAll?.(); } catch (error) { console.error('[Blue Lemonade] 쓰던 테마 적용', error); }
        saveSettings();
        try { panel?.refreshPanels?.(); } catch { /* 설정 창이 없음 */ }
    };
    const say = (text, kind = 'success') => { try { globalThis.toastr?.[kind]?.(text, 'Blue Lemonade', { timeOut: 7000 }); } catch { /* 알림 없음 */ } };
    // 「확장만」은 새로고침해야 바뀐다 — 설정 창의 「저장하고 새로고침」과 같은 길 (저장을 확인한 뒤 새로고침)
    const saveAndReload = async () => {
        try {
            const [{ syncRegexlinkFlag }, { saveAddonsNow }] = await Promise.all([import('./addons.js'), import('./addon-save.js')]);
            await syncRegexlinkFlag(); await saveAddonsNow();
            location.reload();
        } catch (error) {
            console.warn('[Blue Lemonade] 쓰던 테마 유지 저장', error);
            say(`저장하지 못했어요: ${error?.message || error}`, 'error');
        }
    };

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-first-run';
    dialog.setAttribute('aria-labelledby', 'bl-fr-title');
    dialog.innerHTML = `<div class="bl-fr-sheet">
        <header class="bl-fr-head">
            <h2 id="bl-fr-title"><i class="fa-solid" aria-hidden="true"></i><span></span></h2>
            <ol class="bl-fr-dots" aria-hidden="true">${steps.map(() => '<li></li>').join('')}</ol>
            <button type="button" class="bl-fr-icon" data-fr="skip" aria-label="건너뛰기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div class="bl-fr-body" data-fr-body></div>
        <footer class="bl-fr-foot">
            <button type="button" class="bl-fr-icon" data-fr="back" aria-label="이전"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
            <button type="button" class="bl-fr-icon bl-fr-primary" data-fr="next" aria-label="다음"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </footer>
    </div>`;
    if (steps.length === 1) dialog.querySelector('.bl-fr-dots').hidden = true;
    const body = dialog.querySelector('[data-fr-body]');

    const cssStep = () => {
        const report = cssReport || { items: [], on: 0 };
        const items = report.items.filter(x => x.on);
        const list = items.length ? `<ul class="bl-fr-css-list">${items.map(x => `<li><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></li>`).join('')}</ul>` : '';
        const choice = (id, title, note, primary = false) => `<button type="button" class="bl-fr-choice${primary ? ' is-primary' : ''}" data-fr-css="${id}"><b>${title}</b><span>${note}</span></button>`;
        return `<div class="bl-fr-css">
            <p class="bl-fr-css-lead">다른 테마 CSS ${report.on}개가 켜져 있어요. 블루레몬에이드 테마와 같이 켜면 글자가 깨지거나 겹쳐요.</p>${list}
            <div class="bl-fr-css-choices">
                ${choice('theme', '블루레몬에이드 테마로 쓰기', '다른 CSS 를 끄고 「테마 + 확장」으로 써요. 끈 CSS 는 지우지 않아요 — 설정 창 채팅 › 기타 › 다른 CSS 에서 되돌릴 수 있어요.', true)}
                ${choice('other', '쓰던 테마 유지', 'CSS 는 그대로 두고 「확장만」으로 저장한 뒤 새로고침해요. 번역 · TTS 같은 내장 확장만 써요.')}
                ${cssOnly ? choice('leave', '그대로 두기', '지금처럼 둬요. 이 CSS 묶음은 다시 묻지 않아요 — 글자가 깨지면 설정 창 › 자주 묻는 질문에서 고칠 수 있어요.') : ''}
            </div></div>`;
    };
    const paletteStep = st => {
        const mode = paletteMode(st), on = paletteFamily(st.palette);
        const cards = Object.entries(PALETTE_FAMILIES).filter(([family]) => family !== 'custom').map(([family, data]) => {
            const c = paletteColors({ ...st, palette: paletteVariant(family, mode) }), v = k => safeColor(c[k]);
            return `<button type="button" class="bl-fr-card bl-fr-pal" data-fr-palette="${esc(family)}" aria-pressed="${on === family}" style="--p-bg:${v('bg')};--p-text:${v('text')};--p-accent:${v('accent')};--p-marker:${v('marker')};--p-line:${v('line')}">
                <span class="bl-fr-page" aria-hidden="true"><i></i><mark></mark><i></i><b></b></span><span class="bl-fr-name">${esc(data.label)}</span></button>`;
        }).join('');
        const modes = [['light', '화이트', 'fa-sun'], ['dark', '나이트', 'fa-moon']].map(([id, label, icon]) =>
            `<button type="button" class="bl-fr-icon" data-fr-mode="${id}" aria-pressed="${mode === id}" aria-label="${label}"><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`).join('');
        return `<div class="bl-fr-modes" role="group" aria-label="밝기">${modes}</div><div class="bl-fr-grid bl-fr-palettes">${cards}</div>`;
    };
    const fontStep = st => {
        const on = isSet(st.fonts.text) ? st.fonts.text.ko : '';
        return `<div class="bl-fr-grid bl-fr-fonts">${FONT_CHOICES.map(id => findFont(id)).filter(Boolean).map(font => {
            queuePreview(font);
            const stack = previewStack(font, 'ko'), ready = isPreviewReady(font.id) && !isPreviewBlank(font.id);
            return `<button type="button" class="bl-fr-card bl-fr-font" data-fr-font="${esc(font.id)}" aria-pressed="${on === font.id}">
                <span class="bl-fr-sample" data-font="${esc(stack)}" style="font-family:${ready ? esc(stack) : 'inherit'}">${SAMPLE}</span><span class="bl-fr-name">${esc(font.label)}</span></button>`;
        }).join('')}</div>`;
    };
    const readingStep = st => {
        const on = currentReading(st), font = findFont(isSet(st.fonts.text) ? st.fonts.text.ko : '');
        const family = font && isPreviewReady(font.id) && !isPreviewBlank(font.id) ? esc(previewStack(font, 'ko')) : 'inherit';
        return `<div class="bl-fr-grid bl-fr-readings">${PRESETS.map(preset => {
            const data = readingData(preset.id), type = { ...st.type, ...(data.type || {}) };
            const style = data.dialogue?.style || st.dialogue.style, bubble = (data.chat?.char || 'plain') === 'bubble';
            const size = Math.min(1.15, Math.max(.85, (Number(type.size) || 16) / 16));
            const css = `font-family:${family};font-size:${size}em;line-height:${Number(type.lineHeight) || 1.7};letter-spacing:${(Number(type.letterSpacing) || 0) / 100}em;font-weight:${Number(type.weight) || 400};text-align:${type.align === 'left' ? 'left' : 'justify'}`;
            return `<button type="button" class="bl-fr-card bl-fr-read" data-fr-reading="${esc(preset.id)}" aria-pressed="${on === preset.id}">
                <span class="bl-fr-read-sample${bubble ? ' is-bubble' : ''}${type.indent ? ' is-indent' : ''}" style="${css}"><q class="is-${esc(style)}">${SAMPLE}</q> 소금 한 꼬집이면 충분해.</span><span class="bl-fr-name">${esc(preset.name)}</span></button>`;
        }).join('')}</div>`;
    };
    const render = (focus = false) => {
        const st = getSettings(), [id, label, icon] = steps[step];
        dialog.dataset.step = id;
        dialog.querySelector('#bl-fr-title i').className = `fa-solid ${icon}`;
        dialog.querySelector('#bl-fr-title span').textContent = label;
        dialog.querySelectorAll('.bl-fr-dots li').forEach((dot, i) => dot.classList.toggle('on', i === step));
        const last = step === steps.length - 1, next = dialog.querySelector('[data-fr="next"]'), isCss = id === 'css';
        next.setAttribute('aria-label', last ? '완료' : '다음');
        next.querySelector('i').className = `fa-solid ${last ? 'fa-check' : 'fa-arrow-right'}`;
        next.hidden = isCss;   // 쓰던 테마 장은 본문의 단추로 답한다
        dialog.querySelector('[data-fr="back"]').hidden = step === 0 || (step === 1 && steps[0][0] === 'css');   // 답한 장으로는 돌아가지 않는다
        dialog.querySelector('.bl-fr-foot').hidden = isCss;
        const keep = body.scrollTop;
        // 6.9.6 다시 그려도 키보드 초점은 같은 카드에 (글꼴을 다 받아 읽기 방식 화면을 다시 그릴 때 초점이 사라졌다)
        const had = !focus && body.contains(document.activeElement) ? [...document.activeElement.attributes].find(a => a.name.startsWith('data-fr-')) : null;
        body.innerHTML = id === 'css' ? cssStep() : id === 'palette' ? paletteStep(st) : id === 'font' ? fontStep(st) : readingStep(st);
        if (focus) { body.scrollTop = 0; (body.querySelector('[aria-pressed="true"]') || body.querySelector('.bl-fr-choice') || next).focus({ preventScroll: true }); }
        else {
            body.scrollTop = keep;
            if (had) body.querySelector(`[${had.name}="${CSS.escape(had.value)}"]`)?.focus({ preventScroll: true });
        }
    };
    const pick = (mutate, selector) => {
        change(mutate);
        render();
        body.querySelector(selector)?.focus({ preventScroll: true });
    };
    const answerCss = async which => {
        if (cssAnswered) return;
        cssAnswered = true;
        for (const el of body.querySelectorAll('.bl-fr-choice')) el.disabled = true;
        if (which === 'theme') {
            decide(st => chooseCssKeepTheme(st, cssFingerprint));
            say('다른 CSS 를 끄고 블루레몬에이드 테마로 써요. 되돌리려면 설정 창 채팅 › 기타 › 다른 CSS 에서 「커스텀 CSS 끄기」를 끄면 돼요.');
            if (step === steps.length - 1) return dialog.close();
            step++; return render(true);
        }
        if (which === 'other') {
            decide(st => chooseCssKeepOther(st, cssFingerprint));
            say('쓰던 테마를 그대로 두고 「확장만」으로 저장했어요. 새로고침할게요.', 'info');
            dialog.close();
            return saveAndReload();
        }
        decide(st => chooseCssLeave(st, cssFingerprint));
        dialog.close();
    };
    dialog.addEventListener('click', event => {
        event.stopPropagation();   // 확장 서랍 · 실리태번의 바깥 누름 처리로 새지 않게
        const el = event.target.closest('button');
        if (!el || !dialog.contains(el)) return;
        const { fr, frPalette, frMode, frFont, frReading, frCss } = el.dataset;
        if (frCss) { void answerCss(frCss); return; }
        if (fr === 'skip') return dialog.close();
        if (fr === 'back') { step = Math.max(0, step - 1); return render(true); }
        if (fr === 'next') { if (step === steps.length - 1) return dialog.close(); step++; return render(true); }
        if (frPalette) return pick(st => choosePalette(st, frPalette), `[data-fr-palette="${CSS.escape(frPalette)}"]`);
        if (frMode) return pick(st => chooseMode(st, frMode), `[data-fr-mode="${CSS.escape(frMode)}"]`);
        if (frFont) return pick(st => chooseFont(st, frFont), `[data-fr-font="${CSS.escape(frFont)}"]`);
        if (frReading) return pick(st => chooseReading(st, frReading), `[data-fr-reading="${CSS.escape(frReading)}"]`);
    });
    // 6.9.6 누름 · 키도 문서로 올려 보내지 않는다 — 실리태번은 html 의 touchstart · mousedown 으로 열린 서랍을 닫고(mes-fold.js 와 같은 막기),
    //   문서 keydown 으로 ← → 넘기기 · 새 답 만들기 · Esc 서랍 닫기를 한다(이 창은 실리태번 Popup 이 아니라 못 알아본다). Esc 로 이 창 닫기는 브라우저 기본 동작이라 그대로
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup']) dialog.addEventListener(type, event => event.stopPropagation());
    // 표본 글자는 글꼴을 다 받은 뒤에 바꾼다 (받는 동안 비어 보이지 않게 — 설정 창 글꼴 목록과 같은 방식)
    const fontReady = event => {
        for (const sample of body.querySelectorAll('[data-fr-font] .bl-fr-sample')) {
            if (sample.closest('[data-fr-font]').dataset.frFont === event.detail && !isPreviewBlank(event.detail)) sample.style.fontFamily = sample.dataset.font;
        }
        if (dialog.dataset.step === 'reading' && event.detail === getSettings().fonts.text?.ko) render();
    };
    document.addEventListener('salty:font-ready', fontReady);
    dialog.addEventListener('close', () => {
        document.removeEventListener('salty:font-ready', fontReady);
        dialog.remove();
        if (open === dialog) open = null;
        // 7.2.6 이미 쓰던 사람의 「쓰던 테마」 장을 답 없이 닫으면(X · Esc) 「그대로 두기」로 친다 — 한 번만 묻는다
        if (cssOnly && !cssAnswered) { cssAnswered = true; try { decide(st => chooseCssLeave(st, cssFingerprint)); } catch (error) { console.warn('[Blue Lemonade] 쓰던 테마 안내 저장', error); } }
        // 6.9.6 설정 창에서 열었으면 고르는 동안 설정 창이 다시 그려져 그 단추가 새로 생긴다 — 새 단추로 돌아간다
        const to = back?.isConnected ? back : fromPanel ? document.querySelector('[data-act="first-run"]') : null;
        to?.focus?.({ preventScroll: true });
    }, { once: true });
    document.body.append(dialog);
    open = dialog;
    render();
    showThemeModal(dialog);
    (body.querySelector('[aria-pressed="true"]') || body.querySelector('.bl-fr-choice') || dialog.querySelector('[data-fr="next"]')).focus({ preventScroll: true });
}
