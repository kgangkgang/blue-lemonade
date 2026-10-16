// 6.9.5 처음 설정 안내 — 테마 설정이 없던 첫 실행에 한 번(settings.js FRESH_SETTINGS), 설정 창 › 테마 › 기타 설정에서 다시.
// 팔레트 → 글꼴 → 읽기 방식만 고른다. 새 설정 칸은 없다: 설정 창과 같은 칸을 같은 길(panel.js updateSettings — 되돌리기 기록 · 적용 · 저장 ·
// 기기별 배치)로 고친다. 읽기 방식은 완성된 스타일(styles.js PRESETS)을 applyStyleData 로 입히되 글꼴은 빼서 2단계에서 고른 글꼴을 지킨다(잠금도 지킴).
// 고르는 순간 바로 적용된다 — 뒤 화면이 바뀌는 것을 보며 고른다. 건너뛰기 · Esc 는 그 자리에서 끝(고른 것은 남는다).
import { getSettings, saveSettings, FONT_SET } from './settings.js';
import { PALETTES, PALETTE_FAMILIES, paletteFamily, paletteVariant, paletteColors, safeColor } from './palettes.js';
import { PRESETS, applyStyleData } from './styles.js';
import { findFont, previewStack, queuePreview, isPreviewReady, isPreviewBlank } from './fonts.js';
import { rememberAppearance } from './appearance-archive.js';
import { themeEnabled } from './usage-mode.js';

export const STEPS = [['palette', '팔레트', 'fa-palette'], ['font', '글꼴', 'fa-font'], ['reading', '읽기 방식', 'fa-book-open']];
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

// ───────── 창 ─────────
let open = null;
const modalOpen = () => { try { return !!document.querySelector('dialog:modal'); } catch { return !!document.querySelector('dialog[open]'); } };

/** 첫 실행: 테마가 켜져 있고 다른 창이 없을 때 연다 (다른 창이 열려 있으면 닫힐 때까지 1.5초마다 다시 본다 — 타이머만, 숨은 탭에서도) */
export function openFirstRunWhenFree() {
    let tries = 0;
    const attempt = () => {
        if (open || !themeEnabled(getSettings())) return;
        if (modalOpen() && ++tries < 400) { setTimeout(attempt, 1500); return; }
        openFirstRun({ auto: true }).catch(error => console.warn('[Blue Lemonade] 처음 설정 안내', error));
    };
    attempt();
}

export async function openFirstRun({ auto = false } = {}) {
    if (open?.isConnected) { open.querySelector('[data-fr="next"]')?.focus(); return; }
    const [{ showThemeModal }, panel] = await Promise.all([import('./modal.js'), import('./panel.js').catch(error => { console.warn('[Blue Lemonade] 처음 설정: 설정 창 모듈', error); return null; })]);
    if (open?.isConnected) return;
    if (auto) saveSettings();   // 첫 실행 표시는 테마 설정 칸이 생기는 것 — 저장해 두면 다음 새로고침엔 안 뜬다 (건너뛰어도)
    let step = 0, remembered = false;
    const back = document.activeElement;
    const change = mutate => {
        const run = st => { if (!remembered) { remembered = true; rememberAppearance(st, '처음 설정 전'); } mutate(st); };
        if (panel?.updateSettings) return panel.updateSettings(run);
        run(getSettings());
        try { globalThis.Salty?.applyAll?.(); } catch (error) { console.error('[Blue Lemonade] 처음 설정 적용', error); }
        saveSettings();
        return true;
    };

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-first-run';
    dialog.setAttribute('aria-labelledby', 'bl-fr-title');
    dialog.innerHTML = `<div class="bl-fr-sheet">
        <header class="bl-fr-head">
            <h2 id="bl-fr-title"><i class="fa-solid" aria-hidden="true"></i><span></span></h2>
            <ol class="bl-fr-dots" aria-hidden="true">${STEPS.map(() => '<li></li>').join('')}</ol>
            <button type="button" class="bl-fr-icon" data-fr="skip" aria-label="건너뛰기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div class="bl-fr-body" data-fr-body></div>
        <footer class="bl-fr-foot">
            <button type="button" class="bl-fr-icon" data-fr="back" aria-label="이전"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
            <button type="button" class="bl-fr-icon bl-fr-primary" data-fr="next" aria-label="다음"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </footer>
    </div>`;
    const body = dialog.querySelector('[data-fr-body]');

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
        const st = getSettings(), [id, label, icon] = STEPS[step];
        dialog.dataset.step = id;
        dialog.querySelector('#bl-fr-title i').className = `fa-solid ${icon}`;
        dialog.querySelector('#bl-fr-title span').textContent = label;
        dialog.querySelectorAll('.bl-fr-dots li').forEach((dot, i) => dot.classList.toggle('on', i === step));
        const last = step === STEPS.length - 1, next = dialog.querySelector('[data-fr="next"]');
        next.setAttribute('aria-label', last ? '완료' : '다음');
        next.querySelector('i').className = `fa-solid ${last ? 'fa-check' : 'fa-arrow-right'}`;
        dialog.querySelector('[data-fr="back"]').hidden = step === 0;
        const keep = body.scrollTop;
        body.innerHTML = id === 'palette' ? paletteStep(st) : id === 'font' ? fontStep(st) : readingStep(st);
        if (focus) { body.scrollTop = 0; (body.querySelector('[aria-pressed="true"]') || next).focus({ preventScroll: true }); }
        else body.scrollTop = keep;
    };
    const pick = (mutate, selector) => {
        change(mutate);
        render();
        body.querySelector(selector)?.focus({ preventScroll: true });
    };
    dialog.addEventListener('click', event => {
        event.stopPropagation();   // 확장 서랍 · 실리태번의 바깥 누름 처리로 새지 않게
        const el = event.target.closest('button');
        if (!el || !dialog.contains(el)) return;
        const { fr, frPalette, frMode, frFont, frReading } = el.dataset;
        if (fr === 'skip') return dialog.close();
        if (fr === 'back') { step = Math.max(0, step - 1); return render(true); }
        if (fr === 'next') { if (step === STEPS.length - 1) return dialog.close(); step++; return render(true); }
        if (frPalette) return pick(st => choosePalette(st, frPalette), `[data-fr-palette="${CSS.escape(frPalette)}"]`);
        if (frMode) return pick(st => chooseMode(st, frMode), `[data-fr-mode="${CSS.escape(frMode)}"]`);
        if (frFont) return pick(st => chooseFont(st, frFont), `[data-fr-font="${CSS.escape(frFont)}"]`);
        if (frReading) return pick(st => chooseReading(st, frReading), `[data-fr-reading="${CSS.escape(frReading)}"]`);
    });
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
        if (back?.isConnected) back.focus?.({ preventScroll: true });
    }, { once: true });
    document.body.append(dialog);
    open = dialog;
    render();
    showThemeModal(dialog);
    (body.querySelector('[aria-pressed="true"]') || dialog.querySelector('[data-fr="next"]')).focus({ preventScroll: true });
}
