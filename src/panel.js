import { addonsEnabled, usageMode } from './usage-mode.js';
import { saveAddonsNow } from './addon-save.js';
import { readabilityReport, fixReadability } from './readability.js';
import { appearanceArchive, rememberAppearance, restoreAppearance } from './appearance-archive.js';
import { healthMarkup, bindHealth } from './install-health.js';
import { LOCK_GROUPS } from './setting-locks.js';
import { deviceKind } from './device-layouts.js';
import { bindComparison, comparisonView } from './appearance-compare.js';
import { listMenuButtons, PIN_LIMIT } from './mes-pins.js';
import {updateMarkup,bindThemeUpdate} from './theme-update.js';
import { bindAddonLayout } from './addon-layout.js';
import { typesetRoot } from './typography.js';
import { addonMarkup, bindAddons, syncRegexlinkFlag } from './addons.js';
import { wordToolsMarkup, bindWordTools } from './word-tools.js';
import { gradientControls, mixControls, gradientAction, bindGradientColors } from './gradient-ui.js';
import { bindEditor, openEditorCatalog, arrangeEditor, revealEditorTarget, selectEditorGroup } from './settings-editor.js';
import { SettingsHistory } from './settings-history.js';
import { bindTouchSliders } from './touch-sliders.js';
import { changedSettings, settingChanged, settingDefault, resetSetting, settingRoute } from './settings-differences.js';
import { SETTING_LABELS, SETTING_VALUES } from './settings-labels.js';
import { syncProfileClip } from './profile-clip.js';
import { refreshPreset, FRAME_PRESETS, FRAME_LIMIT, presetFrame, saveFrame, useFrame, deleteFrame } from './frame-library.js';
import { syncDecor } from './decor.js';
import { FRAME_RANGE } from './frames.js';
import { customLibrary, newCustomPalette, useCustomPalette, openCustomBuilder, customBuilder, bindCustomBuilder, setCustomMode, seedCustom, saveCustomPalette } from './custompalette.js';
// 설정 창. 확장 서랍과 ✦ 메뉴 팝업 두 곳에 같은 창을 띄울 수 있음.
// 위에서 대분류(탭) → 아래에서 소분류(칩)를 골라 한 번에 한 묶음만 보여 줌 (폰에서 창이 아래로 길어지지 않게)
import { getSettings, invalidateSettings, saveSettings, resetSettings, FONT_SET, FONT_SLOTS, IMAGE_RANGE, PROFILE_RANGE, TEXT_LIMIT, FADE_AMOUNT, isDataImage } from './settings.js';
import { PALETTES, PALETTE_FAMILIES, paletteFamily, paletteVariant, TOKEN_GROUPS, paletteColors, parseColor, sameColor, safeColor } from './palettes.js';
import { GROUPS, LANGS, SAMPLES, fontsFor, findFont, previewStack, queuePreview, isPreviewReady, isPreviewBlank, addGoogleFont, addCssFont, uploadFont, removeCustomFont } from './fonts.js';
import { applyAll, syncSamples } from './apply.js';
import { getIssues } from './checks.js';
import { applySillyTavernTheme, saveAsSillyTavernTheme, alreadyMatches } from './sttheme.js';
import { classifyAll } from './assets.js';
import { openNotice, currentVersion, hasUnseenNotice } from './notice.js';
import { customCssReport, buildDiagnosis } from './diagnose.js';
import { PRESETS, MAX_STYLES, captureStyle, applyStyleData, sameStyle, sharePayload, encodeStyle, decodeStyle, newStyleId, uniqueName, mergeFonts, currentKey, keyLabel } from './styles.js';
import { charStyleModule } from './features.js';
import { splashState, checkSplash, SPLASH_COMMAND, SPLASH_IMPORT } from './splash.js';
import { decodeAnyImage, imageWidth, imageHeight, IMAGE_ACCEPT } from './imagedecode.js';
import { bindSettingsSearch, searchMarkup, paintSettingsSearch } from './settings-search.js';
import { favoritesMarkup, bindFavorites } from './settings-favorites.js';
import { bindPreviewViews } from './preview-view.js';
import { PRESET_GROUPS, capturePreset, readPreset, applyPreset } from './preset-sharing.js';

// 브랜드 레몬 — ✦ 메뉴 · 확장 서랍 · 스플래시와 같은 속찬 레몬(폰트어썸 fa-lemon U+F094) 윤곽 그대로
export const MARK = '<svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true"><path transform="translate(0 448) scale(1 -1)" d="M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// 대분류 탭 · 소분류 칩 — id 는 저장돼 있으니(localStorage) 바꾸지 말 것
// 2.7.0: 글꼴 탭을 글자 탭에 합침 — 역할(본문 · 대사 · 메뉴 · 속마음 · 강조 · 코드)마다 한 화면에서 글꼴 · 크기 · 굵기 · 자간을 다 만짐
const TABS = [['theme', '테마'], ['text', '글자'], ['chat', '채팅'], ['image', '이미지'], ['prompt', '프롬프트'], ['extensions', '확장']];
const SUBS = {
    theme: [['palette', '색'], ['colors', '색 고치기'], ['styles', '스타일'], ['changes', '변경한 설정'], ['backup', '백업'], ['update', '업데이트'], ['etc', '기타 설정']],
    text: [['text', '본문'], ['dialogue', '대사'], ['ui', '메뉴'], ['em', '속마음'], ['strike', '취소선'], ['strong', '강조'], ['code', '코드'], ['para', '문단'], ['shadow', '그림자 · 외곽선']],
    chat: [['message', '메시지'], ['profile', '캐릭터 프로필'], ['user-profile', '내 프로필'], ['name', '캐릭터 이름·시간'], ['user-name', '내 이름·시간'], ['screen', '화면'], ['etc', '기타']],
    image: [['layout', '배치'], ['shape', '모양'], ['frame', '테두리'], ['size', '크기'], ['fade', '흐림']],
    prompt: [['deus', '데우스 엑스 마키나']],
    extensions: [['assets', '캐릭터 에셋'], ['words', '단어 치환'], ['capture', '채팅 캡처'], ['order', '확장 순서'], ['perf', '성능 보조'], ['models', '모델 관리'], ['bookmarks', '북마크'], ['notes', '메모'], ['translator', 'LLM 번역'], ['prompt','한글화 패널'], ['customstyle','커스텀 CSS 조절'], ['rewrite', '다시 쓰기'], ['direction', '전개 지시'], ],
};

const panels = new Set();
const stored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* 무시 */ } };

// 고른 탭·소분류는 서랍과 팝업이 같이 씀 (다시 그려도, 다시 열어도 그대로)
const ui = {
    previewKind: "photo",
    pic: 0, // 이미지 미리보기에서 고른 표본 번호 (PHOTOS)
    tab: stored('salty_tab', 'theme'),
    pvFold: stored('salty_pvfold', '0') === '1', // 붙어 있는 미리보기(예시)를 접어 둠 (2.4.4, 꺾쇠로 접기 · 펴기)
    subs: (() => {
        try {
            const v = JSON.parse(stored('salty_subs', '{}'));
            return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        } catch { return {}; }
    })(),
    picker: null,        // 열려 있는 글꼴 목록: { slot, lang }
    query: '',
    fontTag: 'all',      // 글꼴 목록 태그: 'all' | GROUPS 묶음
    styleMenu: '',       // 3.1.0 도구를 펼친 내 스타일 id
    styleUndo: null,     // 3.1.0 방금 입힌 스타일 전의 모습 (되돌리기, 이번 창에서만)
};

/** 그 탭에서 보고 있는 소분류 (저장된 값이 없거나 모르는 값이면 첫 칸) */
// 2.7.0 전 저장값 옮기기: 글꼴 탭(font) → 글자 탭, 없어진 소분류(크기 · 모양 → 본문, 형광펜 → 대사)
const OLD_SUBS = { size: 'text', shape: 'text', marker: 'dialogue' };
if (ui.tab === 'font') { ui.tab = 'text'; if (ui.subs.font && !ui.subs.text) ui.subs.text = ui.subs.font; }
function subOf(tab) {
    if(tab==='extensions') ui.subs.extensions=({modelswitch:'models',regexlink:'perf',conflicts:'perf',taste:'perf',requestview:'perf',retranslate:'perf'})[ui.subs.extensions]||ui.subs.extensions;
    if (tab === 'theme' && ui.subs.theme === 'custom') return 'custom';
    const list = SUBS[tab] || [];
    if (tab === 'text' && OLD_SUBS[ui.subs.text]) ui.subs.text = OLD_SUBS[ui.subs.text];
    return list.some(([id]) => id === ui.subs[tab]) ? ui.subs[tab] : list[0]?.[0];
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isSet = v => !!v && typeof v === 'object'; // 글꼴 칸이 언어별 묶음인지 ('same' 이 아닌지)
const history = new SettingsHistory();
window.addEventListener("bl:device-layout", () => history.clear());
let historyToast;
const historyLabels = new Map(Object.entries(SETTING_LABELS));
const historyOptions = new Map(Object.entries(SETTING_VALUES));
function labelHistoryControl(label, control) {
    const path = control.match(/data-(?:path|toggle)="([^"]+)"/)?.[1];
    if (path) historyLabels.set(path, label.replace(/<[^>]*>/g, ''));
}
function syncHistoryButtons() {
    for (const panel of panels) {
        const undo = panel.querySelector('[data-act="history-undo"]'), redo = panel.querySelector('[data-act="history-redo"]');
        // 5.3.7 바뀔 때만 쓴다 (슬라이더 틱마다 불림)
        const undoOff = !history.pending && !history.undoStack.length, redoOff = !!history.pending || !history.redoStack.length;
        if (undo && undo.disabled !== undoOff) undo.disabled = undoOff;
        if (redo && redo.disabled !== redoOff) redo.disabled = redoOff;
    }
}
function historyLabel(path) {
    if(path.startsWith('gradients.')) {
        if(historyLabels.has(path))return historyLabels.get(path);
        if(/^gradients\.(light|dark)/.test(path))return (path.startsWith('gradients.dark')?'나이트':'라이트')+' 에이드 혼합 · '+(path.endsWith('families')?'색 조합':path.endsWith('angle')?'방향':path.endsWith('blend')?'번짐':path.includes('weights')?'색 비중':'켜기/끄기');
        const key=path.split('.')[3],label=TOKEN_GROUPS.flatMap(([,list])=>list).find(([id])=>id===key)?.[1]||({name:'캐릭터 이름',userName:'내 이름',ui:'메뉴',code:'코드'})[key]||'색';
        return `그라데이션 · ${label}`;
    }
    const scope = { profile: '캐릭터 프로필', userProfile: '내 프로필', image: '에셋 이미지', type: '본문', dialogue: '대사', em: '속마음', strong: '강조', chat: '채팅' }[path.split('.')[0]];
    if (path.startsWith('colorOverrides.')) {
        const [, palette, token] = path.split('.');
        return `${PALETTES[palette]?.label || '테마'} · ${TOKEN_GROUPS.flatMap(([,list]) => list).find(([key]) => key === token)?.[1] || token}`;
    }
    return [scope, historyLabels.get(path) || path].filter(Boolean).join(' · ');
}
function historyValue(value, path) {
    if(/^gradients\.(light|dark)\.families$/.test(path)&&Array.isArray(value))return value.map(k=>PALETTE_FAMILIES[k]?.label||k).join(' + ');
    if(path.startsWith('gradients.')&&Array.isArray(value))return value.join(' : ');
    if (value == null) return '기본값';
    if (typeof value === 'boolean') return value ? '켜짐' : '꺼짐';
    if (path === 'palette') return PALETTES[value]?.label || String(value);
    if (path.startsWith('fonts.') && typeof value === 'string') return ({same:'본문과 같게',auto:'자동'})[value] || findFont(value)?.label || value;
    if (historyOptions.has(`${path}:${value}`)) return historyOptions.get(`${path}:${value}`);
    if (Array.isArray(value)) return `${value.length}개 항목`;
    if (typeof value === 'object') {
        if (path.endsWith('.decor')) return value.art ? FRAME_PRESETS.find(([id]) => id === value.presetId)?.[1] || '내 액자' : '없음';
        if (path.startsWith('fonts.')) return Object.entries(value).map(([lang,id]) => `${lang}: ${findFont(id)?.label || id}`).join(' · ');
        return '사용자 설정';
    }
    if (typeof value === 'string' && (/^(data:|https?:)/.test(value) || value.length > 100)) return '이미지·사용자 자료';
    return typeof value === 'number' ? `${numText(path, value)}${NUM[path]?.unit || ''}` : String(value);
}
function stepHistory(redo) {
    const changes = history.step(getSettings(), redo);
    if (!changes.length) { syncHistoryButtons(); return; }
    saveSoon(); applyAll(); refreshPanels(changes);
    const rows = changes.slice(0, 8).map(c => `<div>${esc(historyLabel(c.path))}: <b>${esc(historyValue(c.from, c.path))}</b> → <b>${esc(historyValue(c.to, c.path))}</b></div>`).join('');
    // Only replace this editor's history notice; errors and other extensions' notices stay.
    if (historyToast?.[0]?.isConnected) historyToast.stop(true, true).trigger('click').stop(true, true);
    historyToast = toastr.info(`<div class="bl-history-notice">${rows}${changes.length > 8 ? `<small>외 ${changes.length - 8}개 설정도 복원했어요.</small>` : ''}</div>`, redo ? '다시 실행했어요' : '되돌렸어요', { escapeHtml: false, closeButton: false, tapToDismiss: true, onclick: null, hideDuration: 0, timeOut: 6500, extendedTimeOut: 10000 });
}

function settingsChanges(s) {
    const changes = changedSettings(s);
    return `<p class="salty-note">기본값에서 바뀐 설정 ${changes.length}개예요. 저장한 액자·글꼴·스타일 보관함은 유지해요. 복원도 상단 화살표로 되돌릴 수 있어요.</p><div class="bl-changes-list">${changes.map(({path,before,value}) => `<article class="bl-setting-change"><b>${esc(historyLabel(path))}</b><small>기본 ${esc(historyValue(before,path))} → 현재 ${esc(historyValue(value,path))}</small><div><button type="button" class="salty-btn" data-act="setting-jump" data-setting="${esc(path)}">설정으로</button><button type="button" class="salty-btn" data-act="setting-reset" data-setting="${esc(path)}">기본값</button></div></article>`).join('') || '<p class="salty-note">모두 기본값을 사용하고 있어요.</p>'}</div>`;
}
function installSettingResets(root) {
    const settings = getSettings();
    for (const control of root.querySelectorAll('[data-range],[data-num],[data-path],[data-toggle],[data-color-path],[data-time-path],toolcool-color-picker[data-token]')) {
        const path = control.dataset.range || control.dataset.num || control.dataset.path || control.dataset.toggle || control.dataset.colorPath || control.dataset.timePath || `colorOverrides.${settings.palette}.${control.dataset.token}`;
        if (!settingDefault(settings, path).allowed) continue;
        const row = control.closest('.salty-sizeopt,.salty-slider,.salty-row,.salty-stack');
        const label = row?.querySelector(':scope > header > span,:scope > span,:scope > .salty-row > span');
        if (!label || [...label.querySelectorAll('[data-act="setting-reset"]')].some(b => b.dataset.setting === path)) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'bl-setting-reset'; button.dataset.act = 'setting-reset'; button.dataset.setting = path; button.textContent = '↺';
        button.title = `${historyLabel(path)} · 기본값으로`; button.setAttribute('aria-label', button.title);
        const note = label.querySelector(':scope > small');
        if (note) note.before(button); else label.append(button); // 설명 글 아래로 떨어지지 않게 이름 바로 옆
    }
    syncSettingResets();
}
function syncSettingResets() {
    const settings = getSettings();
    for (const panel of panels) for (const button of panel.querySelectorAll('.bl-setting-reset')) { const hide = !settingChanged(settings, button.dataset.setting); if (button.hidden !== hide) button.hidden = hide; }
}
function jumpToSetting(root, path) {
    if (!settingDefault(getSettings(),path).allowed) return;
    const route = settingRoute(path);
    root._catalogOpen = false; ui.tab = route.tab; ui.subs[route.tab] = route.sub; ui.picker = null;
    // Inspecting an override for another palette should not silently change the active theme.
    if (path.startsWith('colorOverrides.') && path.split('.')[1] !== getSettings().palette) {
        toastr.info('이 색은 다른 테마에 저장돼 있어요. 색 목록에서 해당 테마를 선택해 주세요.', '저장된 테마 색');
        ui.subs.theme = 'palette';
    }
    store('salty_tab',ui.tab); store('salty_subs',JSON.stringify(ui.subs)); refreshPanels();
    const controls = [...root.querySelectorAll('[data-range],[data-num],[data-path],[data-toggle],[data-color-path],[data-time-path],toolcool-color-picker[data-token]')];
    const found = controls.find(el => [el.dataset.range,el.dataset.num,el.dataset.path,el.dataset.toggle,el.dataset.colorPath,el.dataset.timePath].includes(path) || path.startsWith('colorOverrides.') && el.dataset.token === path.split('.')[2]);
    const anchor = path.includes('.decor') ? '장식 액자' : path.includes('.edgeShadow') ? '그림자' : path.includes('.edge') ? '테두리' : path.startsWith('shadow.') ? '글자 그림자' : path.startsWith('outline.') ? '글자 외곽선' : path.startsWith('chat.weather') ? '날씨' : null;
    const group = anchor ? [...root.querySelectorAll('[data-search-anchor]')].find(el => el.dataset.searchAnchor === anchor) : null;
    const target = found?.closest('.salty-slider,.salty-row,.salty-stack') || group || root.querySelector('.salty-sec');
    revealEditorTarget(root,target); target.classList.add('bl-search-target'); target.tabIndex = -1; target.focus({preventScroll:true});
    requestAnimationFrame(() => { if (target.isConnected && target !== root.querySelector('.salty-sec')) { const section = root.querySelector('.salty-sec'); section.scrollTop += target.getBoundingClientRect().top - section.getBoundingClientRect().top - 16; } });
    setTimeout(() => target.classList.remove('bl-search-target'),2200);
}

let saveTimer = null;
function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
}

/** '처음 설정으로' — 되돌릴 묶음을 고르는 창. 취소하면 null, 아니면 { look, addons, tools, library } */
async function askResetGroups() {
    const ctx = SillyTavern.getContext();
    const rows = [['look', '테마 모습', true], ['addons', '애드온 켬 · 설정', false], ['tools', '단어 치환 · 캡처', false], ['library', '프레임 · 팔레트 · 날씨 그림 · 모양', false]];
    const box = document.createElement('div');
    box.className = 'salty-reset-pick';
    box.innerHTML = `<p><b>처음 설정으로</b></p>${rows.map(([id, label, on]) => `<label><input type="checkbox" data-reset="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`).join('')}<p class="salty-note">내 글꼴 · 내 스타일은 남아요.</p>`;
    let ok;
    if (ctx.callGenericPopup && ctx.POPUP_TYPE) ok = await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: '되돌리기', cancelButton: '취소' }) === ctx.POPUP_RESULT?.AFFIRMATIVE;
    else ok = confirm('테마 설정을 처음 상태로 돌릴까요? (내 글꼴 목록은 남아요)');
    if (!ok) return null;
    const groups = Object.fromEntries(rows.map(([id]) => [id, !!box.querySelector(`[data-reset="${id}"]`)?.checked]));
    return Object.values(groups).some(Boolean) ? groups : null;
}

export function mountPanel(container, { popup = false, onFullscreen = null } = {}) {
    const root = document.createElement('div');
    root.className = popup ? 'salty-panel in-popup bl-editor' : 'salty-panel bl-editor';
    root._onFullscreen = onFullscreen;
    container.appendChild(root);
    panels.add(root);
    root._compareCleanup = bindComparison(root, getSettings(), () => { applyAll(); for (const panel of panels) syncWeatherPreview(panel, "chat.weather"); });
    bindTouchSliders(root);
    bind(root);
    bindEditor(root);
    const navigate = entry => {
        if (!SUBS[entry.tab]?.some(([sub])=>sub===entry.sub) && !(entry.tab==='theme'&&entry.sub==='custom')) return;
        root._catalogOpen = false;
        ui.tab = entry.tab; ui.subs[entry.tab] = entry.sub; ui.picker = null;
        store('salty_tab', ui.tab); store('salty_subs', JSON.stringify(ui.subs));
        refreshPanels();
        const path = entry.path ? root.querySelector(`[data-toggle="${entry.path}"], [data-path="${entry.path}"]`) : null;
        const label = entry.anchor ? [...root.querySelectorAll('[data-search-anchor]')].find(el => el.dataset.searchAnchor === entry.anchor) : null;
        const target = path?.closest('.salty-row, .salty-stack') || label || root.querySelector('.salty-sec');
        if (target) {
            revealEditorTarget(root, target);
            const box = root.querySelector('.salty-sec');
            target.classList.add('bl-search-target'); target.tabIndex = -1; target.focus({ preventScroll: true });
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (!target.isConnected) return;
                const offset = 16;
                if (box) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - offset;
                else window.scrollBy({ top: target.getBoundingClientRect().top - offset, behavior: 'instant' });
            }));
            setTimeout(() => target.classList.remove('bl-search-target'), 2200);
        }
    };
    bindSettingsSearch(root, navigate);
    bindFavorites(root, navigate, () => {
        for (const panel of panels) {
            const currentSub=subOf(ui.tab),title=SUBS[ui.tab]?.find(([id])=>id===currentSub)?.[1]||'직접 테마 만들기';
            panel.querySelector('.bl-favorites')?.replaceWith(document.createRange().createContextualFragment(favoritesMarkup({tab:ui.tab,sub:currentSub,title})));
            paintSettingsSearch(panel);
        }
    });
    render(root);
    return root;
}

export function setPanelFullscreen(root, enabled) {
    const dialog = root.closest('dialog');
    if (!dialog) return;
    root._fullscreen = !!enabled;
    dialog.classList.add('bl-settings-dialog');
    dialog.classList.toggle('bl-settings-fullscreen', root._fullscreen);
    const button = root.querySelector('[data-act="panel-fullscreen"]');
    if (button) { button.textContent = enabled ? '작은 창' : '전체 화면'; button.setAttribute('aria-pressed', String(root._fullscreen)); }
    root.dispatchEvent(new Event('bl:preview-resize'));
}

export function unmountPanel(root) {
    root._compareCleanup?.();
    for(const stage of Object.values(root._pv || {}))stage._blWeather?.destroy();
    root._captureCleanup?.(); root._captureCleanup=null;
    root._addonCleanup?.(); root._addonCleanup=null;
    root._scriptsCleanup?.(); root._scriptsCleanup=null;
    root._healthCleanup?.();
    root._updateCleanup?.(); root._updateCleanup=null;
    root._previewCleanup?.();
    for (const key of ['_fontIO', '_rowsRO']) { root[key]?.disconnect(); root[key] = null; }
    root.remove(); panels.delete(root); root._pv = {}; root._previewViews?.clear();
    const settings = getSettings(); syncDecor(settings); syncProfileClip(settings);
}

/** 5.1.2: 보이는 설정 창이 그 탭 · 소분류를 열어 두었는가 (index.js — 커스텀 CSS 를 치는 동안은 그 보고서가 보이는 화면에서만 다시 그린다) */
export function panelShows(tab, sub) {
    return ui.tab === tab && subOf(tab) === sub && [...panels].some(root => root.isConnected && (root.checkVisibility?.() ?? true));
}

/** 공지를 본 뒤: 설정 창 알약은 다시 그리고, 확장 서랍 머리의 버전 알약도 보통 모양으로 (3.0.0) */
export function noticeSeenChanged() {
    const unseen = hasUnseenNotice();
    document.querySelectorAll('#salty-drawer .bl-version').forEach(badge => badge.classList.toggle('is-new', unseen));
    refreshPanels();
}

export function refreshPanels(changes) {
    // Numeric-to-numeric edits do not add controls. Keep preview gestures, focus and scroll.
    // Unknown paths, nullable controls and the differences page need the full renderer.
    if (changes?.length && !(ui.tab === 'theme' && subOf(ui.tab) === 'changes') &&
        changes.every(c => Object.hasOwn(NUM, c.path) && isNum(c.from) && isNum(c.to))) {
        for (const root of panels) {
            if (!root.isConnected) { unmountPanel(root); continue; }
            for (const { path, to } of changes) {
                for (const input of root.querySelectorAll(`input[data-num="${path}"]`)) {
                    input.value = numText(path, to); input.dataset.def = to; fitNum(input);
                }
                for (const input of root.querySelectorAll(`input[data-range="${path}"]`)) {
                    input.value = to;
                    input.style.setProperty('--fill', fill(Number(input.value), Number(input.min), Number(input.max)));
                }
                syncWeatherPreview(root, path);
            }
        }
        if (changes.some(c => c.path === 'nightTint' || c.path === 'lightTint')) syncPaletteTints();
        syncHistoryButtons(); syncSettingResets();
        return;
    }
    for (const root of panels) {
        if (!root.isConnected) {
            unmountPanel(root);
            continue;
        }
        render(root);
    }
}

// 3.6.2: 날씨 값(투명도 · 크기 · 속도 · 각도)은 판을 다시 그리지 않고 바꾸니(슬라이드바 · 숫자 칸) 미리보기에 따로 알린다.
// 예전에는 다른 칸을 눌러 판이 다시 그려질 때까지 미리보기가 옛 값으로 내렸다 (사용자: "비 눈 트래커 미리보기에 파라미터 바로 반영 안 된다")
// 5.1.2: 슬라이더 틱마다가 아니라 프레임마다 한 번 (창마다) — 마지막 틱이 잡아 둔 프레임이 마지막 값으로 그린다
const weatherFrames = new WeakMap();
function syncWeatherPreview(root, path) {
    if (!String(path).startsWith('chat.weather')) return;
    const stage = root?._pv?.chat;
    if (!stage?.isConnected || weatherFrames.has(root)) return;
    weatherFrames.set(root, requestAnimationFrame(() => {
        weatherFrames.delete(root);
        if (!stage.isConnected) return;
        const s = comparisonView(getSettings());
        import('./weather.js').then(m => m.previewWeather(stage, s.enabled ? s.chat : { weather: 'off' })).catch(() => {});
    }));
}

// 5.1.2: 적용이 죽으면 저장하지 않고 방금 고친 것을 되돌린다 — 전에는 saveSoon 이 먼저라 망가진 설정이 저장돼 다음 시작부터 창이 안 열렸다
function safeApply() {
    const hadPending = !!history.pending; // 이번 틱의 변경이 있을 때만 되돌린다 — 없으면 앞서 확정한 항목을 뽑아 버리게 된다
    try { applyAll(); return true; }
    catch (error) {
        console.error('[Blue Lemonade] 설정 적용', error);
        if (hadPending && history.step(getSettings()).length) { history.redoStack.pop(); invalidateSettings(); try { applyAll(); } catch { /* 되돌려도 안 되면 그대로 — 저장은 안 한다 */ } }
        toastr.error(`적용하지 못해 되돌렸어요: ${error.message || error}`, 'Blue Lemonade');
        refreshPanels();
        return false;
    }
}
// 슬라이더 · 색 고르기 틱: applyAll(변수 계산 · SVG · 기능 12개)은 프레임마다 한 번 — 설정 값은 틱마다 바로 고쳐 두고 그리기만 모은다.
// 끌기가 끝나도 마지막 틱이 잡아 둔 프레임이 마지막 값으로 그린다 (놓치는 틱 없음). 보통 update 가 끼어들면 그 자리에서 바로 그린다
let applyFrame = 0;
function applySoon() {
    if (applyFrame) return;
    applyFrame = requestAnimationFrame(() => { applyFrame = 0; if (safeApply()) saveSoon(); });
}

function update(mutator, rerender = true, group = '') {
    const oldTint = `${getSettings().nightTint}/${getSettings().lightTint}`;
    history.run(getSettings(), mutator, group);
    invalidateSettings(); // 고친 값을 정리(범위 · 형식)한 채로 그린다
    if (group && !rerender) applySoon();
    else {
        if (applyFrame) { cancelAnimationFrame(applyFrame); applyFrame = 0; }
        if (!safeApply()) return;
        saveSoon();
    }
    if (rerender) refreshPanels();
    else if (oldTint !== `${getSettings().nightTint}/${getSettings().lightTint}`) {
        syncPaletteTints();
    }
    syncHistoryButtons();
    syncSettingResets();
}

function syncPaletteTints() {
    const s = getSettings(), mode = PALETTES[s.palette]?.mode;
    for (const panel of panels) for (const card of panel.querySelectorAll('.salty-pal[data-family]')) {
        const colors = paletteColors({ ...s, palette: paletteVariant(card.dataset.family, mode) });
        for (const key of ['bg', 'surface', 'raised']) card.style.setProperty(`--pal-${key}`, safeColor(colors[key]));
    }
}

// ───────── 조각들 ─────────
function seg(path, options, fallback, cls = '') {
    for (const [value, label] of options) historyOptions.set(`${path}:${value}`, label.replace(/<[^>]*>/g, ''));
    const value = getPath(getSettings(), path);
    const current = value === undefined || value === null ? fallback : value;
    return `<div class="salty-seg${cls ? ` ${cls}` : ''}">${options.map(([v, label]) =>
        `<button data-act="seg" data-path="${path}" data-value="${esc(v)}" class="${String(current) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

// 여러 개를 동시에 켜는 칩 줄 (seg 는 하나만 고르는 것) — 테두리를 그릴 면 고르기에 씀
function chips(items) {
    const s = getSettings();
    return `<div class="salty-seg">${items.map(([path, label]) =>
        `<button data-act="chip" data-path="${path}" class="${getPath(s, path) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
}

// ··· 메뉴 버튼 고르기 (4.1.3): 지금 실리태번 · 다른 확장이 메뉴에 넣어 둔 버튼을 그대로 보여 준다
function mesPinPicker(s) {
    const items = listMenuButtons();
    const pins = s.chat.mesPins || [];
    const gone = pins.filter(key => !items.some(item => item.key === key)).map(key => ({ key, icon: 'fa-solid fa-circle-question', title: key }));
    if (!items.length && !gone.length) return '<p class="salty-note">채팅을 열면 고를 수 있는 버튼이 나와요.</p>';
    return `<div class="salty-seg bl-mespins">${[...items, ...gone].map(item =>
        `<button data-act="mes-pin" data-key="${esc(item.key)}" class="${pins.includes(item.key) ? 'on' : ''}" aria-pressed="${pins.includes(item.key)}"><i class="${esc(item.icon)}" aria-hidden="true"></i><span>${esc(item.title)}</span></button>`).join('')}</div>
        <p class="salty-note">누른 버튼은 메뉴를 열지 않아도 이름 줄에 보여요. 최대 ${PIN_LIMIT}개.</p>`;
}

function toggle(path, checked) {
    return `<label class="salty-switch"><input type="checkbox" data-toggle="${path}" ${checked ? 'checked' : ''}><span></span></label>`;
}

// 3.5.1 새로고침 첫 화면: user.css 에 한 줄이 있으면 실리태번 뇌 로고 없이 처음부터 레몬 (splash.js)
function splashRow() {
    const state = splashState();
    if (state === null) checkSplash(refreshPanels);
    const note = state === 'on' ? '처음부터 레몬으로 떠요'
        : state === 'late' ? 'user.css 맨 위로 줄을 옮겨 주세요'
            : '실리태번 뇌 로고 없이 처음부터 레몬 — 명령을 한 번 실행';
    return row('새로고침 화면', state === 'on'
        ? '<span class="salty-splash-on"><i class="fa-solid fa-check" aria-hidden="true"></i></span>'
        : '<button class="salty-btn" data-act="splash-copy">명령 복사</button>', note);
}

// 3.5.4 퀵 리플라이 줄 미리보기: 내 QR 이름(보이는 세트 세 개, 열 개씩)으로, 없으면 예시 이름. 입력판 줄과 같은 규칙 · 휠 · 끌기 · 스냅
function qrSample(showFind = true) {
    const MAX = 24;
    const EXAMPLES = ['인사', '상황 정리', '다음 장면', '요약해 줘', '속마음', '시간 흐름', '비 오는 밤', '카페', '회상', '전화', '편지 쓰기', '잠들기 전', '산책', '싸움', '화해', '고백'];
    const settings = globalThis.quickReplyApi?.settings;
    const groups = [];
    let count = 0;
    // 내 QR: 보이는 세트 차례대로 모두 모아 24개까지 (세트 하나에 한두 개뿐이어도 넘길 거리가 되게)
    for (const link of settings ? [settings.config, settings.chatConfig, settings.charConfig].flatMap(c => c?.setList || []) : []) {
        if (count >= MAX || !link?.isVisible || !link.set) continue;
        const labels = (link.set.qrList || []).filter(q => !q.isHidden).map(q => q.label || '').filter(Boolean).slice(0, MAX - count);
        if (labels.length) { groups.push(labels); count += labels.length; }
    }
    // 모자라면 예시 이름으로 채움 — 줄이 넘쳐야 가로 · 세로 넘기기가 보임
    if (count < 16) groups.push(EXAMPLES.slice(0, 16 - count));
    // 3.7.1 입력창 모형을 같이 그린다 — '자리'(입력창 아래 · 위)가 미리보기에서 바로 보이게. 모형은 body.salty-qr-top 에 따라 순서가 바뀐다 (css/36-qr-place.css)
    const inputMock = '<div class="bl-qr-inputmock" aria-hidden="true"><span class="bl-qr-inputmock-box">메시지를 입력하세요…</span><span class="bl-qr-inputmock-btn"><i class="fa-solid fa-paper-plane"></i></span></div>';
    return `<div class="bl-qr-sample-wrap"><div class="bl-qr-sample" data-qr-sample tabindex="0" aria-label="퀵 리플라이 미리보기">${showFind ? '<span class="bl-qr-find-sample" aria-hidden="true"><i class="fa-solid fa-magnifying-glass"></i></span>' : ''}${groups.map(g => `<div class="qr--buttons" inert aria-hidden="true">${g.map(label => `<div class="qr--button"><div class="qr--button-label">${esc(label)}</div></div>`).join('')}</div>`).join('')}</div>${inputMock}</div>`;
}

function row(label, control, note = '') {
    labelHistoryControl(label, control);
    return `<div class="salty-row" data-search-anchor="${esc(label)}"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
}

// 고르기 버튼이 길 때: 라벨 위, 버튼 아래
function stack(label, control, note = '') {
    labelHistoryControl(label, control);
    return `<div class="salty-stack"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
}

// 묶음 제목 (+ 옆에 옅은 예시)
function cap(label, hint = '') {
    return `<div class="salty-label" data-search-anchor="${esc(label)}">${label}${hint ? ` <span class="salty-hint">${hint}</span>` : ''}</div>`;
}

// 라벨 속 *기울임* · **굵게**: 별표는 옅게 남기고 글자는 실제로 기울이거나 굵게 (먼저 이스케이프, 태그는 여기서만)
function mdLabel(text) {
    const mark = s => `<span class="salty-md-mark">${s}</span>`;
    return esc(text).replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, (_, b, i) => b
        ? `<b class="salty-md salty-md-b">${mark('**')}${b}${mark('**')}</b>`
        : `<em class="salty-md salty-md-i">${mark('*')}${i}${mark('*')}</em>`);
}

function color(token, label, note = '') {
    historyLabels.set(`colorOverrides.${getSettings().palette}.${token}`, `테마 색 · ${label.replace(/<[^>]*>/g, '')}`);
    const pal = paletteColors(getSettings());
    // 투명한 색은 스와치가 빈 칸처럼 보여서 뒤에 투명 격자를 깔아 줌 (CSS .clear)
    // 견본 크기는 CSS 변수로 (3.5.1 — PC 팝업에서는 이름 옆을 다 채우는 긴 막대, 33-panel-columns)
    const clear = parseColor(pal[token])[3] < 0.1 ? ' clear' : '';
    return `<div class="salty-row salty-color${clear}"><span>${mdLabel(label)}${note ? `<small>${note}</small>` : ''}</span><toolcool-color-picker data-token="${token}" color="${esc(pal[token])}" button-width="var(--bl-sw-w, 3rem)" button-height="var(--bl-sw-h, 1.5rem)" button-padding="var(--bl-sw-p, .25rem)"></toolcool-color-picker></div>${gradientControls(getSettings(),token,label,{slider,esc})}`;
}

const fill = (value, min, max) => `${((value - min) / (max - min)) * 100}%`;
// 슬라이드바가 실제로 서는 값: 칸(step)에 맞춰 반올림, 범위 안 (입력칸 14.5 → 슬라이드바 15). 채움도 이 값으로 → 채움 끝이 늘 손잡이 밑
function snap(value, min, max, step) {
    const v = Number.isFinite(Number(value)) ? Number(value) : (min + max) / 2;
    const n = Math.round(Number(((v - min) / step).toFixed(9)));
    return Math.min(max, Math.max(min, Number((min + n * step).toFixed(9))));
}

// 슬라이드바 + 숫자 입력칸: 슬라이드는 한 칸(step)씩, 입력칸은 소수점까지 (범위 밖이면 끝값으로)
const NUM = {
    'nightTint': { unit: '%' },
    'lightTint': { unit: '%' },
    'type.size': { unit: 'px' },
    'type.dialogueSize': { unit: 'px' },
    'type.uiSize': { unit: 'px' },
    'type.codeSize': { unit: 'px' },
    'type.lineHeight': {},
    'type.letterSpacing': { unit: 'em', scale: 100 }, // 설정에는 1/100 em 로 저장
    'type.weight': {},
    // 역할별 글자 값 (2.7.0)
    'dialogue.weight': {}, 'dialogue.letterSpacing': { unit: 'em', scale: 100 },
    'em.size': { unit: 'px' }, 'em.weight': {}, 'em.letterSpacing': { unit: 'em', scale: 100 },
    'strong.size': { unit: 'px' }, 'strong.weight': {}, 'strong.letterSpacing': { unit: 'em', scale: 100 },
    'code.weight': {}, 'code.letterSpacing': { unit: 'em', scale: 100 },
    'ui.weight': {}, 'ui.letterSpacing': { unit: 'em', scale: 100 },
    'chat.userSize': { unit: '%' }, 'chat.userInk': { unit: '%' }, 'chat.bgAlpha': { unit: '%' },
    'type.para': { unit: '줄' },
    'type.gutter': { unit: 'px' },
    'type.measure': { unit: 'px' },
    'dialogue.markerThick': { unit: '%' },
    'image.maxh': { pre: '화면의', unit: '%' },
    'image.height': { pre: '화면의', unit: '%' },
    'image.radius': { unit: 'px' },
    'image.edgeThick': { unit: 'px' },
    'image.edgeAlpha': { unit: '%' },
    'image.fadeY': { unit: '%' },
    'image.fadeX': { unit: '%' },
    'image.edgeGlow': { unit: 'px' },
    'image.angle': { unit: '도' },
    'image.cornerCut': { unit: '%' },
    'image.scratchAmount': { unit: '%' },
    'shadow.alpha': { unit: '%' },
    'chat.tone.light.s': { unit: '%' }, 'chat.tone.light.l': { unit: '%' }, 'chat.tone.dark.s': { unit: '%' }, 'chat.tone.dark.l': { unit: '%' }, 'chat.markerTone.light.s': { unit: '%' }, 'chat.markerTone.light.l': { unit: '%' }, 'chat.markerTone.dark.s': { unit: '%' }, 'chat.markerTone.dark.l': { unit: '%' },
    'shadow.angle': { unit: '도' },
    'shadow.distance': { unit: 'px' },
    'shadow.blur': { unit: 'px' },
    'chat.weatherAmount': { unit: '%' }, 'chat.weather2Amount': { unit: '%' }, 'chat.weatherOpacity': { unit: '%' }, 'chat.weatherSize': { unit: '%' }, 'chat.weatherSpeed': { unit: '%' }, 'chat.weatherAngle': { unit: '도' },
};
const numText = (path, v) => String(Number((Number(v) / (NUM[path]?.scale || 1)).toFixed(4)));
// 숫자칸 폭 = 값 글자 수 (3.3.0 — 자간 -0.0075 같은 긴 값이 잘리지 않게). CSS 가 1ch 단위로 폭을 잡는다
const numChars = text => Math.max(3, String(text).length);
const fitNum = (input) => input.style.setProperty('--num-ch', numChars(input.value));

/** 숫자 칸 · 슬라이드바 부품 (설정에 값이 아직 없으면 def) */
function sliderParts(path, min, max, step, def) {
    const raw = getPath(getSettings(), path);
    const value = isNum(raw) ? raw : (isNum(def) ? def : (min + max) / 2);
    const n = NUM[path] || {};
    return {
        num: `<span class="salty-num">${n.pre ? `<i>${n.pre}</i>` : ''}<input type="number" step="any" data-num="${path}" data-min="${min}" data-max="${max}" data-def="${value}" value="${numText(path, value)}" style="--num-ch:${numChars(numText(path, value))}"><i class="salty-unit">${n.unit || ''}</i></span>`,
        range: `<input type="range" data-range="${path}" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${fill(snap(value, min, max, step), min, max)}">`,
    };
}

function slider(path, label, min, max, step, def) {
    if (!['nightTint', 'lightTint'].includes(path)) historyLabels.set(path, label.replace(/<[^>]*>/g, ''));
    const { num, range } = sliderParts(path, min, max, step, def);
    const aria = esc(label.replace(/<[^>]*>/g, ''));
    return `<div class="salty-slider"><header><span>${label}</span>${num.replace('<input ', `<input aria-label="${aria}" `)}</header>${range.replace('<input ', `<input aria-label="${aria}" `)}</div>`;
}

// 대사 · 메뉴 글자 크기: '본문과 같게' · '기본'(따로 안 씀 = null) 아니면 직접
// 직접일 때 배치는 본문 크기와 같게 — 윗줄에 이름 · 고르기 · 숫자칸, 아랫줄에 슬라이드바 전체 폭
function sizeOpt(path, label, sameLabel, min, max) {
    const own = isNum(getPath(getSettings(), path));
    const choice = `<div class="salty-seg salty-mini">${[['same', sameLabel], ['own', '직접']].map(([id, text]) =>
        `<button data-act="size" data-path="${path}" data-value="${id}" data-min="${min}" data-max="${max}" class="${(id === 'own') === own ? 'on' : ''}">${text}</button>`).join('')}</div>`;
    if (!own) return `<div class="salty-sizeopt">${row(label, choice)}</div>`;
    const { num, range } = sliderParts(path, min, max, 1);
    return `<div class="salty-sizeopt">${row(label, `<span class="salty-sizeopt-ctl">${choice}${num}</span>`)}<div class="salty-slider salty-slider-wide">${range}</div></div>`;
}

/** 실리태번이 지금 쓰는 메뉴 글자 크기(px) — '기본'에서 '직접'으로 갈 때 시작값 */
function stUiSize() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:var(--mainFontSize, 15px)';
    document.body.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return Number.isFinite(px) ? Math.round(px * 2) / 2 : 15;
}

function sample() {
    return `<div class="salty-sample">
        <p>창밖으로 바닷바람이 스며들었다. 그는 식은 찻잔을 내려놓고 <strong>천천히</strong> 고개를 들었다.</p>
        <p><q>「……레몬 한 조각이면 충분해.」</q> <em>(정말 그걸로 될까.)</em></p>
        <p><code>【오후 4시 · 맑음】</code> 그는 잔을 <del>비우고</del> 다시 채워 내 쪽으로 밀어 놓았다.</p>
        <p class="salty-sample-more">Lemonade keeps the summer awake — 1234567890 · 夏の海 · 夏日海边</p>
    </div>`;
}

// 메뉴 글꼴 미리보기: 실제 메뉴 글꼴 · 메뉴 크기로 그린 줄 (이 창도 같은 글꼴이지만 크기까지 한눈에 보이게)
function uiSample() {
    return `<div class="salty-uisample">
        <p><b>설정</b> · 캐릭터 · 확장 · 되돌리기</p>
        <p>메뉴 · 단추 · 이 설정 창 글자에 쓰는 글꼴이에요.</p>
        <p>Settings · 1234567890 · 設定 · 设置</p>
    </div>`;
}

// ───────── 미리보기 ─────────
// 설정을 만지는 그 자리에서 결과가 보이게 — 실리태번 메시지 · 에셋 그림 DOM 을 그대로 흉내 낸 작은 무대.
// 모양은 style.css 가 댄다: #chat 규칙을 :is(#salty-nochat, .salty-preview) 로 복사한 자동 생성 블록(surfaces:preview)과
// 그 뒤 손으로 쓴 보정 블록. 그래서 여기서는 마크업만 만들고, 설정은 body 클래스 · --salty-* 변수로 저절로 따라온다.
// 클래스 · 속성 이름이 실제 채팅과 어긋나면 복사한 규칙이 하나도 안 먹으니 바꾸지 말 것

// 메타 세 칸은 늘 채워 넣는다 — 실리태번이 body.no-timer 류로 문서 전체에서 감추고
// 테마의 말풍선 위 여백도 같은 바디 클래스로 갈라지니, 실리태번 쪽 설정이 그대로 반영된다
const PREV_META = '<div class="mesIDDisplay">#42</div><div class="mes_timer">2.4s</div><div class="tokenCounterDisplay">318t</div>';
// 5.3.7 무대 칸은 inert — 실리태번이 .mes_button · details 에 tabindex 를 달아 Tab 이 가짜 버튼에 멈췄다
// ⋯ · 연필: 아이콘 설정(선 아이콘 · 기본)이 보이는 자리 (icons.js TARGETS 가 미리보기까지 노려야 바뀜)
const PREV_BTNS = '<div class="mes_buttons"><div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis"></div><div class="mes_button mes_edit fa-solid fa-pencil"></div></div>';

// 메시지 한 줄 — 실리태번 #message_template 을 줄인 것. is_user 는 속성이라야 테마가 내 메시지를 가려낸다
function prevMes(user, name, text) {
    return `<div class="mes" is_user="${user}">
        <div class="mesAvatarWrapper"><div class="avatar"></div>${PREV_META}</div>
        <div class="mes_block">
            <div class="ch_name flex-container justifySpaceBetween">
                <div class="flex-container flex1 alignitemscenter"><div class="flex-container alignItemsBaseline">
                    <span class="name_text">${name}</span><small class="timestamp">오늘 4:12pm</small>
                </div></div>${PREV_BTNS}
            </div>
            <div class="mes_text">${text}</div>
        </div></div>`;
}

// 채팅 무대: 상대 한 줄(폰에서 두 줄로 꺾이는 길이) + 내 한 줄.
// 본문에 「대사」 · 굵게 · 기울임 · 코드를 섞어 글꼴 · 형광펜 · 강조 · 코드 글꼴이 한눈에 보이게 함
function chatStage() {
    return `<div class="salty-preview" data-prev="chat" aria-hidden="true" inert>
        ${prevMes('false', '에이드', '<p>에이드의 배 위에서 <strong>나이트</strong>가 눈을 가늘게 떴다. <q>「아, 알았어. 안 움직일게.」</q> <em>이 인간 또 움직이네... 눌러버려야겠다...</em></p>')}
        ${prevMes('true', '나', '<p><q>「벌써 <code>4시</code>야.」</q> 나는 웃으며 게임기를 내려놓았다.</p>')}
    </div>`;
}

// 그림 무대: 에셋 확장 DOM 네 겹 그대로. .mes_text 가 있어야 테마의 에셋 규칙이 걸리고,
// .mes 가 있어야 '가로 꽉'의 음수 여백(좌우 --salty-gutter)이 되돌릴 여백을 갖는다. src 는 fillPreviews 가 꽂음
function imgStage(art) {
    return `<div class="salty-preview" data-prev="img" data-art="${art}" aria-hidden="true" inert>
        <div class="mes"><div class="mes_block"><div class="mes_text">
            <div class="custom-cac-wrap"><div class="custom-cac-frame"><div class="custom-cac-inner">
                <img class="custom-cac-img" alt="">
            </div></div></div>
        </div></div></div>
    </div>`;
}

// 정규식 카드 무대: 데우스 카드(상태창 · 떡밥 · 트래커)를 줄인 표본 + 모델이 색을 칠한 글자.
// 실리태번이 메시지 안 클래스 앞에 custom- 을 붙이므로 여기도 custom-dem-… 으로 쓴다 — 색 통일 · 이모티콘 규칙이 그 이름을 본다.
// 카드 속 모양(원래 색)은 style.css '정규식 카드 표본' 블록이 댄다
function regexStage() {
    // 3.2.0: 진짜 데우스 카드와 같은 마크업 — 카드는 details/summary, 트래커는 칸마다 __item. 그래야 데우스 카드 스킨 · 폰 접기 규칙이 표본에도 걸린다
    const head = (icon, title, tag) => `<summary><span class="custom-dem-card__icon">${icon}</span><span class="custom-dem-card__title">${title}</span>${tag ? `<span class="custom-dem-card__tag">${tag}</span>` : ''}<span class="custom-dem-card__caret">▸</span></summary>`;
    const step = (phase, phaseName, label, value) => `<div class="custom-dem-scene-plan__phase custom-dem-scene-plan__phase--${phase}"><span>${phaseName}</span></div><div class="custom-dem-scene-plan__step custom-dem-scene-plan__step--${phase}"><span class="custom-dem-scene-plan__label">${label}</span><span class="custom-dem-scene-plan__value">${value}</span></div>`;
    const item = (kind, icon, value, extra = '') => `<div class="custom-dem-track__item custom-dem-track__item--${kind}"><span class="custom-dem-track__icon">${icon}</span><span class="custom-dem-track__value">${value}</span>${extra}</div>`;
    return `<div class="salty-preview" data-prev="regex" aria-hidden="true" inert>
        ${prevMes('false', '에이드', `<div class="custom-dem-track">${item('time', '🕐', '오후 4:12')}${item('date', '🗓️', '3일째 · 목요일')}${item('location', '📍', '항구 → 등대 아래 찻집')}${item('weather', '⛅', '맑음', '<span class="custom-dem-track__temp">18°C</span>')}</div>
        <p class="bl-fx-line"><span class="custom-dem-expressive custom-dem-expressive--shout bl-fx-lead"><font color="#e64553" class="bl-ink-sample" style="--bl-ink:#e64553"><q>「거기 서!」</q></font></span> <span class="custom-dem-expressive custom-dem-expressive--trembling"><q>「…무, 무서워.」</q></span> <span class="custom-dem-expressive custom-dem-expressive--crying"><font color="#1e88c7" class="bl-ink-sample" style="--bl-ink:#1e88c7"><q>「가지 마…」</q></font></span> 감정 대사예요.</p>
        <details class="custom-dem-card custom-dem-scene-plan" open>${head('🗺️', '장면 계획', '흐름도')}<div class="custom-dem-scene-plan__body">${step('inputs', 'Inputs', '상황 맥락', '찻집 약속 직전, 에이드는 편지를 숨긴다.')}${step('constraints', 'Constraints', 'Character Realism', '들뜬 마음을 쉽게 드러내지 않는다.')}${step('plan', 'Plan', 'Prose Plan', '편지 이야기는 마지막 문단까지 아껴 둔다.')}</div></details>
        <details class="custom-dem-card custom-dem-status" open>${head('📊', 'Status', 'Live')}<div class="custom-dem-status__body"><div class="custom-dem-status-row"><strong class="custom-dem-status-row__name">에이드</strong><span class="custom-dem-status-row__field"><span class="custom-dem-status-row__label custom-dem-status-row__label--physical">몸</span><span>나른함</span></span><span class="custom-dem-status-row__field"><span class="custom-dem-status-row__label custom-dem-status-row__label--clothes">옷</span><span>하늘색 원피스</span></span><span class="custom-dem-status-row__field"><span class="custom-dem-status-row__label custom-dem-status-row__label--mental">마음</span><span>기대</span></span><span class="custom-dem-status-row__field"><span class="custom-dem-status-row__label custom-dem-status-row__label--relationship">관계</span><span class="custom-dem-status-row__score">72/100</span></span></div></div></details>
        <details class="custom-dem-card custom-dem-threads" open>${head('🧶', 'Story Threads', '')}<div class="custom-dem-threads__body"><div class="custom-dem-thread-row"><span class="custom-dem-thread-tag custom-dem-thread-tag--current">[Current]</span> 찻집의 약속</div><div class="custom-dem-thread-row"><span class="custom-dem-thread-tag custom-dem-thread-tag--unresolved">[Unresolved]</span> 사라진 등대지기</div><div class="custom-dem-thread-row"><span class="custom-dem-thread-tag custom-dem-thread-tag--seed">[Seed]</span> 바다 건너온 편지</div></div></details>
        <p><q>「오늘은 등대 아래 찻집에서.」</q> 에이드는 편지를 가방 깊숙이 밀어 넣었다.</p>
        <p class="bl-ink-line"><font color="#e64553" class="bl-ink-sample" style="--bl-ink:#e64553"><q>「편지는 내가 가져갈게.」</q></font> <font color="#1e88c7" class="bl-ink-sample" style="--bl-ink:#1e88c7"><q>「…괜찮겠어?」</q></font> 프롬프트가 칠한 대사예요.</p>`)}
    </div>`;
}

// 폰 화면 표본 (3.2.0, 채팅 › 화면 › 폰): 작은 폰 그림 — 몰입 읽기를 켜면 위 바 · 입력창이 비켜났다 돌아오는 것을 되풀이해 보여 주고,
// 한 손 버튼 줄을 켜면 입력창 위에 버튼 알약이 선다. 모양은 팔레트 변수만 (css/31-styles-panel.css)
function phoneMock(s) {
    const lines = widths => `<p>${widths.map(w => (w < 0 ? `<i class="q" style="width:${-w}%"></i>` : `<i style="width:${w}%"></i>`)).join('')}</p>`;
    const buttons = s.onehand?.on ? ['swipe', 'swipe', '', 'imp', 'cont', 'regen'].filter(key => !key || s.onehand[key] !== false).map(key => (key ? '<b></b>' : '<span></span>')).join('') : '';
    return `<div class="salty-phonemock${s.reader?.autoHide ? ' is-reader' : ''}${s.onehand?.on ? ' is-onehand' : ''}" aria-hidden="true" inert>
        <div class="pm-body"><div class="pm-scroll">${lines([96, 90, 62])}${lines([-84, -58])}${lines([94, 88, 91, 40])}${lines([-76])}${lines([92, 86, 70])}${lines([95, 60])}</div></div>
        <div class="pm-top"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="pm-form">${buttons ? `<div class="pm-onehand">${buttons}</div>` : ''}<div class="pm-input"><i></i><u></u></div></div>
    </div>`;
}

// 무대 자리 — 탭 맨 위에 붙어 있는 칸. 테마를 끄면 아예 안 그린다:
// 복사한 규칙이 전부 body.salty 를 요구해서 꺼진 상태에선 맨 글자만 남아 더 헷갈린다
// 미리보기 칸 껍데기: 아래 가운데 꺾쇠(접기 · 펴기, 2.4.4 — 사용자: "예시는 꺾쇠로 접었다 폈다"). 접힌 상태는 판 넷이 같이 기억.
// 무대는 fillPreviews 가 뒤에 꽂으니 꺾쇠 단추를 먼저 두고 CSS 로 아래에 붙인다
function prevBox(attrs, inner = '') {
    const folded = ui.pvFold;
    return `<div class="salty-prevbox${folded ? ' folded' : ''}"${attrs ? ` ${attrs}` : ''}>
        <button type="button" class="salty-pvfold" data-act="pvfold" aria-expanded="${!folded}" aria-label="${folded ? '예시 펼치기' : '예시 접기'}"><i aria-hidden="true"></i></button>${inner}</div>`;
}

function chatPreview() {
    return getSettings().enabled ? prevBox('data-pv="chat"') : '';
}

function regexPreview() {
    return getSettings().enabled ? prevBox('data-pv="regex"') : '';
}

// 3.4.0 채팅 › 기타 표본: 모델이 색을 칠한 글자만 (데우스 카드는 프롬프트 탭으로)
function colorPreview() {
    return getSettings().enabled ? prevBox('data-pv="color"') : '';
}

function colorStage() {
    return `<div class="salty-preview" data-prev="color" aria-hidden="true" inert>
        ${prevMes('false', '에이드', '<p><font color="#e64553">붉게 칠한 글자</font>와 <span style="color:#40a02b">초록으로 칠한 글자</span>, <q>「그리고 대사.」</q></p><p><span style="color:#7c6cf0">보라색 혼잣말</span>이 <font color="#df8e1d">노랗게</font> 끝났다.</p>')}
    </div>`;
}

function imagePreview(s, sub) {
    if (!s.enabled) return '';
    // 표본 선택은 그림 밖 도구 줄에 두어 효과를 가리지 않는다.
    return prevBox(`data-pv="img" data-sub="${sub}" data-fit="${s.image.fit}" data-kind="${ui.previewKind}"`, `
        <div class="bl-preview-tools">
            <div class="bl-preview-kinds">${[['photo', '일반 이미지'], ['cut', '투명 이미지']].map(([kind, label]) =>
                `<button type="button" data-act="pvkind" data-kind="${kind}" aria-pressed="${ui.previewKind === kind}">${label}</button>`).join('')}</div>
            <div class="bl-preview-samples" ${ui.previewKind === 'cut' ? 'hidden' : ''}>
                <button type="button" data-act="pvpic" data-step="-1" aria-label="이전 표본">‹</button>
                <span>${PHOTOS[ui.pic]}</span>
                <button type="button" data-act="pvpic" data-step="1" aria-label="다음 표본">›</button>
            </div>
        </div>`);
}

// Packaged illustrations preserve dark/light/color and transparent-cutout test cases.
const PHOTOS = ['게임', '레몬 먹으며 쉬기', '나이트 쓰다듬기', '나이트와 낮잠', '빗길 산책'];
const previewPhotos = ['ade-game', 'ade-lemon', 'ade-cat', 'ade-nap', 'ade-rain'].map(name => new URL(`./preview-art/${name}.webp`, import.meta.url).href);
function samplePhoto(index = ui.pic) {
    return previewPhotos[((index % PHOTOS.length) + PHOTOS.length) % PHOTOS.length];
}
function sampleCut() { return new URL('./preview-art/character.webp', import.meta.url).href; }

// 지금 채팅에 있는 아바타를 빌려 온다 (미리보기에 내 캐릭터가 나온다).
// 없으면 빈 div 그대로 두고 보정 CSS 가 팔레트색 동그라미로 칠한다 (모서리는 실리태번 설정이 정함)
function prevFaces(stage) {
    for (const mes of stage.querySelectorAll('.mes')) {
        const mine = mes.getAttribute('is_user') === 'true';
        const src = document.querySelector(`#chat .mes${mine ? '[is_user="true"]' : ':not([is_user="true"])'} .avatar img`)?.src;
        const box = mes.querySelector('.avatar');
        const had = box.querySelector('img');
        if (!src) {
            had?.remove();
            continue;
        }
        if (had) {
            if (had.src !== src) had.src = src; // 캐릭터를 바꾼 뒤 다시 그릴 때
            continue;
        }
        const img = document.createElement('img');
        img.alt = '';
        img.src = src;
        box.append(img);
    }
}

// 무대는 판마다 한 번만 만들어 자리에 다시 꽂는다. 다시 그릴 때마다 새로 만들면 <img> 가 다시 실리는 동안
// .salty-asset · --salty-imin 이 한 프레임 사라져 모양 · 흐림이 벗겨졌다 입혀진다 (고르기 단추를 톡톡 누를 때 깜빡임).
// 소분류 · 비율 유지/높이 맞춤은 마크업을 다시 만들지 않고 속성으로만 옮겨 담는다
function fillPreviews(root) {
    root._pv ??= {};
    for (const box of root.querySelectorAll('.salty-prevbox[data-pv]')) {
        const kinds = box.dataset.pv === 'regex' ? ['regex'] : box.dataset.pv === 'color' ? ['color'] : box.dataset.pv !== 'img' ? ['chat'] : [box.dataset.kind || 'photo'];
        for (const kind of kinds) {
            let stage = root._pv[kind];
            if (!stage) {
                const holder = document.createElement('div');
                holder.innerHTML = kind === 'chat' ? chatStage() : kind === 'regex' ? regexStage() : kind === 'color' ? colorStage() : imgStage(kind);
                stage = root._pv[kind] = holder.firstElementChild;
            }
            // 표본 고르기가 바뀌면 그림만 갈아 끼운다 (무대는 그대로 — 깜빡임 없음).
            // 같은 값을 넣으면 브라우저가 다시 불러오지 않는다
            const img = stage.querySelector('img.custom-cac-img');
            if (img) {
                const want = kind === 'cut' ? sampleCut() : samplePhoto();
                if (img.getAttribute('src') !== want) {
                    img.onload = () => { classifyAll(stage); syncDecor(getSettings()); syncProfileClip(getSettings()); };
                    img.src = want;
                }
            }
            if (box.dataset.sub) stage.dataset.sub = box.dataset.sub;
            if (box.dataset.fit) stage.dataset.fit = box.dataset.fit;
            box.append(stage);
            // .salty-asset · .salty-cutout · --salty-ar/iw/ih/imin 은 실제 채팅과 같은 코드가 붙인다.
            // 떨어졌다 다시 붙은 무대는 ResizeObserver 가 스스로 빠져 있으니 꽂을 때마다 한 번 더 부름
            if (kind === 'chat') {
                prevFaces(stage);
                const chatSettings = getSettings().chat;
                if ((chatSettings.weather && chatSettings.weather !== 'off' && getSettings().enabled) || stage._blWeather) import('./weather.js').then(m => m.previewWeather(stage, getSettings().enabled ? chatSettings : { weather: 'off' })).catch(() => {});
            }
            else if (kind !== 'regex' && kind !== 'color') classifyAll(stage);
            syncDecor(getSettings());
            syncProfileClip(getSettings());
        }
    }
}

// ───────── 글꼴 ─────────
const sizeBadge = f => f.size >= 1000 ? `${(f.size / 1000).toFixed(1)}MB` : (f.size ? `${f.size}KB` : '');

function fontRow(slot, lang, set) {
    const id = set[lang];
    const auto = lang !== 'ko' && (!id || id === 'auto');
    const font = auto ? null : findFont(id);
    if (font) queuePreview(font);
    const open = ui.picker?.slot === slot && ui.picker?.lang === lang;
    const label = LANGS.find(([l]) => l === lang)[1];
    const name = auto ? '<span class="auto">한국어 글꼴 따라감</span>' : (font ? esc(font.label) : '<span class="auto">없음</span>');
    return `<button class="salty-fontrow ${open ? 'open' : ''}" data-act="picker" data-slot="${slot}" data-lang="${lang}">
        <small>${label}</small><strong style="font-family:${font ? esc(previewStack(font, lang)) : 'inherit'}">${name}</strong></button>
        ${open ? fontList(slot, lang, set) : ''}`;
}

const BLANK_BADGE = '<em class="salty-blank">이 기기에서 안 그려짐</em>';
// 표본 줄은 글꼴을 다 받을 때까지 기기 글꼴로 그린다 (받는 몇 초 동안 줄이 비어 보이던 것). fonts.js settlePreview 가
// 받았다고(salty:font-ready) 알리면 data-font 에 적어 둔 진짜 묶음으로 바꾸고, 안 그려진다고(salty:font-blank) 알리면 표시를 붙인다.
// 다시 그릴 때는 fontItem 이 isPreviewReady · isPreviewBlank 로 같은 상태를 바로 그린다
const itemsFor = id => [...panels].flatMap(root => [...root.querySelectorAll(`.salty-fontitem[data-id="${CSS.escape(String(id))}"]`)]);
document.addEventListener('salty:font-ready', (e) => {
    for (const item of itemsFor(e.detail)) {
        const sample = item.querySelector('.salty-fontinfo small');
        if (sample?.dataset.font) sample.style.fontFamily = sample.dataset.font;
    }
});
document.addEventListener('salty:font-blank', (e) => {
    for (const item of itemsFor(e.detail)) {
        if (item.classList.contains('blank')) continue;
        item.classList.add('blank');
        item.querySelector('.salty-fontinfo b')?.insertAdjacentHTML('beforeend', BLANK_BADGE);
        const sample = item.querySelector('.salty-fontinfo small');
        if (sample) sample.style.fontFamily = 'inherit';
    }
});

function fontItem(f, lang, current) {
    const on = current === f.id;
    const blank = isPreviewBlank(f.id);
    const stack = esc(previewStack(f, f.lang || lang));
    const family = blank ? 'inherit' : (isPreviewReady(f.id) || f.group === 'custom' ? stack : 'inherit');
    return `<button class="salty-fontitem ${on ? 'on' : ''}${blank ? ' blank' : ''}" data-act="font" data-id="${esc(f.id)}" data-preview="${esc(f.id)}">
        <span class="salty-fontinfo"><b>${esc(f.label)}${f.native ? ` <i>${esc(f.native)}</i>` : ''}${f.size ? `<em>${sizeBadge(f)}</em>` : ''}${f.single ? '<em>굵기 하나</em>' : ''}${blank ? BLANK_BADGE : ''}</b>
        <small data-font="${stack}" style="font-family:${family}">${esc(SAMPLES[f.lang || lang] || SAMPLES.ko)}</small></span>
        ${on ? `<span class="salty-check-ic">${CHECK}</span>` : ''}
        ${f.group === 'custom' ? `<span class="salty-x" data-act="rmfont" data-id="${esc(f.id)}" title="목록에서 지우기">✕</span>` : ''}
    </button>`;
}

// 글꼴 목록을 열 때 처음 태그: 지금 글꼴의 묶음 (따라감이면 고딕)
function defaultTag(lang, id) {
    const group = (id && id !== 'auto' && findFont(id)?.group) || 'sans';
    return fontsFor(lang).some(f => f.group === group) ? group : 'all';
}

function fontList(slot, lang, set) {
    const current = set[lang];
    const fonts = fontsFor(lang);
    const present = GROUPS.map(([group, label]) => [group, label, fonts.filter(f => f.group === group)]).filter(([, list]) => list.length);
    if (ui.fontTag !== 'all' && !present.some(([group]) => group === ui.fontTag)) ui.fontTag = 'all'; // 내 글꼴을 다 지운 경우 등
    const groups = present.map(([group, label, list]) =>
        `<div class="salty-fontgroup" data-group="${group}"><h5>${label} <span>${list.length}</span></h5>${list.map(f => fontItem(f, lang, current)).join('')}</div>`).join('');
    const tags = [['all', '전체', present.reduce((n, [, list]) => n + list.length, 0)], ...present.map(([group, label, list]) => [group, label, list.length])]
        .map(([id, label, n]) => `<button data-act="fonttag" data-tag="${id}" class="${ui.fontTag === id ? 'on' : ''}">${label}<span>${n}</span></button>`).join('');
    const auto = lang !== 'ko'
        ? `<button class="salty-fontitem ${!current || current === 'auto' ? 'on' : ''}" data-act="font" data-id="auto">
            <span class="salty-fontinfo"><b>한국어 글꼴 따라감</b><small>따로 고르지 않고 한국어 글꼴에 든 ${LANGS.find(([l]) => l === lang)[1]} 글자를 씀</small></span>
            ${!current || current === 'auto' ? `<span class="salty-check-ic">${CHECK}</span>` : ''}</button>`
        : '';
    return `<div class="salty-fontlist" data-slot="${slot}" data-lang="${lang}">
        <div class="salty-fonthead">
            <div class="salty-fontsearch"><input type="search" placeholder="글꼴 이름 찾기" data-search="font" value="${esc(ui.query)}" autocomplete="off"></div>
            <div class="salty-fonttags">${tags}</div>
        </div>
        <div class="salty-fontscroll">${auto}${groups}
        <p class="salty-fontempty" hidden><span>그런 이름의 글꼴이 없어요</span><button data-act="fonttag" data-tag="all" hidden>전체<span></span></button></p></div>
        <div class="salty-fontadd">
            <button class="salty-btn" data-act="add-google">+ 구글 폰트</button>
            <button class="salty-btn" data-act="add-file">+ 글꼴 파일</button>
            <button class="salty-btn" data-act="add-css">+ CSS 링크</button>
            <input type="file" accept=".woff2,.woff,.ttf,.otf" hidden data-file="font">
        </div></div>`;
}

// 글꼴 칸 (역할 화면의 한 묶음): 언어별 글꼴 줄 — 본문 말고는 '본문 글꼴과 같게' 스위치가 먼저 (2.7.0 부터 글자 탭 안)
function fontBlock(s, slot) {
    if (!FONT_SLOTS.includes(slot)) slot = 'text';
    const own = slot === 'text' || isSet(s.fonts[slot]);
    const set = own ? s.fonts[slot] : null;
    const rows = own ? `<div class="salty-fontrows">${LANGS.map(([lang]) => fontRow(slot, lang, set)).join('')}</div>` : '';
    if (slot === 'text') {
        return `${rows}
            <div class="salty-group">
                ${stack('한자(漢字)는', seg('fonts.hanja', [['auto', '자동'], ['ko', '한국어'], ['ja', '일본어'], ['zh', '중국어']]), '자동: 중국어 → 일본어 → 한국어 글꼴 순으로 있는 것')}
            </div>
            <p class="salty-note">영어·일본어·중국어 글꼴을 따로 고르면 그 글자만 그 글꼴로 바뀌고, 나머지는 한국어 글꼴이 맡아요.</p>`;
    }
    return `<div class="salty-group">${row('본문 글꼴과 같게', toggle(`fonts.${slot}.same`, !own))}</div>
        ${rows}`;
}

// ───────── 테마 ─────────
function tabTheme(s, sub) {
    if(sub==='etc')return `<details class="bl-usage-mode"><summary>사용 모드: <strong>${({both:'테마 + 확장',theme:'테마만',extensions:'확장만'})[usageMode(s)]}</strong></summary><div class="bl-usage-mode-body"><label>사용 모드<select data-usage-mode aria-label="사용 모드">${[['both','테마 + 확장'],['theme','테마만'],['extensions','확장만']].map(([v,label])=>`<option value="${v}" ${usageMode(s)===v?'selected':''}>${label}</option>`).join('')}</select></label><p>선택한 모드만 실행해요. 기존 설정은 보관해요.</p><button type="button" class="salty-btn" data-usage-apply>저장하고 새로고침</button><span role="status" data-usage-status></span></div></details>`;
    if(sub==='update')return updateMarkup()+healthMarkup();
    if (sub === 'changes') return settingsChanges(s);
    if (sub === 'custom') return customBuilder(s);
    if (sub === 'backup') return tabBackup();
    if (sub === 'styles') return tabStyles(s);
    if (sub === 'colors') {
        const report=readabilityReport(s);
        const readability=`<div class="salty-group">${cap('가독성 확인')}${report.map(x=>row(x.label,`<span>${x.ratio.toFixed(1)} : 1 · ${x.ratio>=4.5?'양호':'대비 낮음'}</span>${x.fix?`<button class="salty-btn" data-act="readability-fix" data-key="${x.key}">색 보정</button>`:''}`,x.ratio<4.5&&!x.fix?'밝고 어두운 배경이 섞여 있어요. 배경색 차이를 먼저 줄여 주세요.':'')).join('')}<p class="salty-note">테마 배경·형광펜 색 기준이에요. 그라데이션은 여러 지점을 비교하며 사진·날씨·개별 메시지 색은 포함하지 않아요.</p></div>`;
        const colors = TOKEN_GROUPS.map(([label, list]) =>
            `${cap(label)}<div class="salty-group">${list.map(([key, name]) => color(key, name)).join('')}</div>`).join('');
        return `${chatPreview()}${readability}${colors}
            <div class="salty-btns"><button class="salty-btn" data-act="reset-colors">${esc(PALETTES[s.palette]?.label || '이 테마')} 색 처음으로</button></div>
            <p class="salty-note">색은 테마마다 따로 저장돼요.</p>`;
    }
    const mode = PALETTES[s.palette]?.mode || 'light';
    const selected = paletteFamily(s.palette);
    const renderCard = (family, data) => {
        const id = paletteVariant(family, mode), p = PALETTES[id];
        const c = paletteColors({ ...s, palette: id });
        const v = k => safeColor(c[k]);
        const label = family === 'custom' ? s.customName || data.label : data.label;
        return `<button type="button" class="salty-pal ${selected === family ? 'on' : ''}" data-act="palette" data-family="${family}" aria-pressed="${selected === family}"
            style="--pal-bg:${v('bg')};--pal-surface:${v('surface')};--pal-raised:${v('raised')};--pal-text:${v('text')};--pal-muted:${v('muted')};--pal-accent:${v('accent')};--pal-marker:${v('marker')};--pal-gold:${v('gold')};--pal-strong:${v('strong')};--pal-pop:${safeColor(c.pop || c.accent)};--pal-marker-ink:${c.markerInk ? safeColor(c.markerInk) : 'inherit'};--pal-mark-top:${c.markerInk ? '8%' : '55%'}">
            <span class="salty-pal-page"><span><b>${esc(data.sample)}</b><br><mark>「에이드」</mark></span><i></i></span>
            <b>${esc(label)}</b><small>${family === 'custom' ? '직접 설정' : esc(p.desc)}</small></button>`;
    };
    const cards = Object.entries(PALETTE_FAMILIES).filter(([family]) => family !== 'custom').map(([family, data]) => renderCard(family, data)).join('');
    const hasCustom = Boolean(s.customName || s.colorOverrides?.['custom-light'] || s.colorOverrides?.['custom-night']);
    const custom = hasCustom ? `<div class="salty-custom-card">${renderCard('custom', PALETTE_FAMILIES.custom)}<button type="button" class="salty-custom-edit" data-act="custom-open" aria-label="커스텀 에이드 편집"><i class="fa-solid fa-pen" aria-hidden="true"></i></button></div>`
        : '<button type="button" class="salty-pal salty-pal-create" data-act="custom-open"><span class="salty-create-icon" aria-hidden="true">+</span><b>커스텀 에이드 만들기</b><small>직접 설정</small></button>';
    const auto = !!s.auto?.on;
    const autoOptions = auto ? `<div class="salty-group salty-auto">
            ${stack('자동 기준', seg('auto.by', [['system', '기기 다크 모드'], ['time', '시간']]))}
            ${s.auto.by === 'time' ? `<div class="salty-row"><span>나이트 시작</span><input type="time" class="salty-time" data-time-path="auto.night" value="${esc(s.auto.night)}" aria-label="나이트 시작"></div><div class="salty-row"><span>화이트 시작</span><input type="time" class="salty-time" data-time-path="auto.day" value="${esc(s.auto.day)}" aria-label="화이트 시작"></div>` : ''}
        </div>` : '';
    return `${chatPreview()}${selected !== 'custom' ? `<div class="bl-palette-tint">${slider(mode === 'dark' ? 'nightTint' : 'lightTint', '배경 테마색 농도', mode === 'dark' ? 1 : .5, 20, .5)}<small>${mode === 'dark' ? '기본 1% · 차콜' : '기본 0.5% · 화이트'}부터 20%까지. 직접 고친 배경색은 유지해요.</small></div>` : ''}<div class="salty-palette-toolbar"><span>${auto ? '자동 · ' : ''}${mode === 'light' ? '화이트' : '나이트'}</span><div class="salty-mode-switch" role="group" aria-label="테마 밝기">${['light', 'dark'].map(kind => `<button type="button" data-act="palette-mode" data-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'} 모드" title="${kind === 'light' ? '화이트' : '나이트'}" aria-pressed="${!auto && mode === kind}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}<button type="button" data-act="palette-auto" aria-label="자동" title="자동" aria-pressed="${auto}"><i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i></button></div></div>${autoOptions}${mixControls(s,{slider,esc})}<div class="salty-palettes">${cards}${custom}</div>${customLibrary(s)}`;

}

// ───────── 스타일 (3.1.0) ─────────
function tabStyles(s) {
    const presets = PRESETS.map(p => `<button type="button" class="salty-preset" data-act="style-preset" data-id="${p.id}"><b>${esc(p.name)}</b>${styleSample(p.data(), s)}<small>${esc(p.desc)}</small></button>`).join('');
    const used = id => Object.values(s.charStyles).filter(x => x === id).length;
    const mine = s.styles.map((st) => {
        const on = s.activeStyle?.id === st.id;
        const open = ui.styleMenu === st.id;
        const meta = [on ? '지금 입힘' : '', used(st.id) ? `캐릭터 ${used(st.id)}` : ''].filter(Boolean).join(' · ');
        return `<div class="salty-style${on ? ' on' : ''}${open ? ' open' : ''}">
            <button type="button" class="salty-style-main" data-act="style-apply" data-id="${esc(st.id)}">${styleSwatch(st.data)}<b>${esc(st.name)}</b>${meta ? `<small>${meta}</small>` : ''}</button>
            <button type="button" class="salty-style-more" data-act="style-menu" data-id="${esc(st.id)}" aria-label="${esc(st.name)} 도구" aria-expanded="${open}"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
            ${open ? `<div class="salty-style-tools">
                <button class="salty-btn" data-act="style-overwrite" data-id="${esc(st.id)}">지금 모습으로</button>
                <button class="salty-btn" data-act="style-rename" data-id="${esc(st.id)}">이름</button>
                <button class="salty-btn" data-act="style-copy" data-id="${esc(st.id)}">코드 복사</button>
                <button class="salty-btn" data-act="style-file" data-id="${esc(st.id)}">파일</button>
                <button class="salty-btn salty-btn-danger" data-act="style-delete" data-id="${esc(st.id)}">지우기</button>
            </div>` : ''}
        </div>`;
    }).join('');
    const key = currentKey();
    const linked = key ? s.charStyles[key] || '' : '';
    const charBlock = key ? `${cap(esc(keyLabel(key)))}<div class="salty-group">
            ${s.styles.length
        ? stack('이 캐릭터 스타일', `<div class="salty-seg salty-wrap">${[['', '없음'], ...s.styles.map(st => [st.id, st.name])].map(([id, name]) =>
            `<button data-act="char-style" data-id="${id}" class="${linked === id ? 'on' : ''}">${esc(name)}</button>`).join('')}</div>`, linked ? '이 채팅을 열면 이 스타일로 바뀌어요. 여기서 바꾼 모습은 이 스타일에 저장돼요' : '')
        : '<p class="salty-note">스타일을 저장하면 캐릭터에 이어 둘 수 있어요.</p>'}
        </div>` : '';
    const others = Object.entries(s.charStyles).filter(([k]) => k !== key);
    const linkList = others.length ? `${cap('이어 둔 캐릭터')}<div class="salty-group">${others.map(([k, id]) =>
        row(esc(keyLabel(k)), `<span class="salty-btns"><span class="salty-hint">${esc(s.styles.find(x => x.id === id)?.name || '')}</span><button class="salty-btn" data-act="char-unlink" data-key="${esc(k)}">풀기</button></span>`)).join('')}</div>` : '';
    return `${chatPreview()}${cap('완성된 스타일', '글자 · 채팅 모양만 — 색은 그대로')}<div class="salty-presets">${presets}</div>
        ${ui.styleUndo ? '<div class="salty-btns salty-undo"><button class="salty-btn" data-act="style-undo">방금 입힌 것 되돌리기</button></div>' : ''}
        ${cap('내 스타일', s.styles.length ? `${s.styles.length}/${MAX_STYLES}` : '')}
        ${mine ? `<div class="salty-styles">${mine}</div>` : '<p class="salty-note">지금 모습(색 · 글꼴 · 글자 · 채팅 · 이미지)을 이름 붙여 두고 언제든 다시 입혀요.</p>'}
        <div class="salty-btns salty-style-add">
            <button class="salty-btn" data-act="style-save">+ 지금 모습 저장</button>
            <button class="salty-btn" data-act="style-import-code">코드로 가져오기</button>
            <button class="salty-btn" data-act="style-import-file">파일로 가져오기</button>
        </div>
        <input type="file" accept=".json,application/json,text/plain" hidden data-file="style">
        ${charBlock}${linkList}`;
}

/** 을 · 를 (받침 따라, 한글이 아니면 을(를)) */
const eulReul = (word) => {
    const code = String(word).trim().slice(-1).charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? '을' : '를';
    return ' 을(를)';
};

/** 완성된 스타일 카드 속 글자 표본 (3.2.0): 그 스타일의 본문 글꼴 · 크기 · 줄 간격 · 대사 표시로 한 줄 — 색은 지금 팔레트 */
function styleSample(data, s) {
    const type = { ...s.type, ...(data.type || {}) };
    const fontId = data.fonts?.text?.ko || s.fonts.text.ko;
    const font = findFont(fontId);
    if (font) queuePreview(font);
    const family = font ? previewStack(font, 'ko') : 'inherit';
    const dialogue = data.dialogue?.style || s.dialogue.style;
    const size = Math.min(16, Math.max(11, Math.round(Number(type.size) * 0.8)));
    const css = `font-family:${esc(family)};font-size:${size}px;line-height:${Number(type.lineHeight) || 1.6};letter-spacing:${(Number(type.letterSpacing) || 0) / 100}em;font-weight:${Number(type.weight) || 400};text-align:${type.align === 'left' ? 'left' : 'justify'}`;
    return `<span class="salty-preset-sample${type.indent ? ' is-indent' : ''}" style="${css}"><q class="m-${esc(dialogue)}">「레몬 한 조각.」</q> 그는 잔을 밀었다.</span>`;
}

/** 내 스타일 줄 앞 색 점 (3.2.0): 그 스타일의 바탕 · 글자 · 포인트 · 형광펜 */
function styleSwatch(data) {
    const id = PALETTES[data?.palette] ? data.palette : 'salt';
    const c = { ...PALETTES[id], ...(data?.colorOverrides?.[id] || {}) };
    return `<span class="salty-style-swatch" style="--sw-bg:${safeColor(c.bg)};--sw-text:${safeColor(c.text)};--sw-accent:${safeColor(c.accent)};--sw-marker:${safeColor(c.marker)}" aria-hidden="true"><i></i><i></i></span>`;
}

/** 스타일을 입히기 전 모습을 되돌리기용으로 남기고 입힌다 */
function wearStyle(data, label) {
    const before = captureStyle(getSettings());
    update(st => { if(!rememberAppearance(st,label+' 적용 전'))toastr.info('그림 데이터가 커서 복구함에 담지 못했어요. 전체 설정 파일로 보관해 주세요.'); applyStyleData(st, data); });
    if (sameStyle(before, captureStyle(getSettings()))) {
        toastr.info('이미 그 모습이에요', 'Blue Lemonade');
        return;
    }
    ui.styleUndo = before;
    refreshPanels();
    const active = getSettings().activeStyle;
    toastr.success(active ? `${label}${eulReul(label)} 입혔어요. 이 캐릭터 스타일에 저장돼요` : `${label}${eulReul(label)} 입혔어요`, 'Blue Lemonade');
}

/** 받은 스타일(코드 · 파일) → 내 스타일 목록에 넣기 */
function addReceivedStyle(received) {
    const s = getSettings();
    if (s.styles.length >= MAX_STYLES) throw new Error(`스타일은 ${MAX_STYLES}개까지예요. 안 쓰는 것을 지워 주세요`);
    let name = '';
    update((st) => {
        name = uniqueName(received.name, st.styles);
        st.styles.push({ id: newStyleId(), name, data: received.style });
        mergeFonts(st, received.fonts);
    });
    toastr.success(`${name}${eulReul(name)} 내 스타일에 넣었어요. 눌러서 입혀 보세요`, 'Blue Lemonade');
}

/** 클립보드에 넣기 — 못 넣으면(권한 · 오래된 브라우저) 골라 복사할 수 있게 창에 띄움 */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ctx = SillyTavern.getContext();
        const box = document.createElement('textarea');
        box.className = 'text_pole salty-code-box';
        box.value = text;
        box.readOnly = true;
        box.rows = 6;
        setTimeout(() => { box.focus(); box.select(); }, 100);
        await ctx.callGenericPopup(box, ctx.POPUP_TYPE.TEXT, '', { okButton: '닫기' });
        return false;
    }
}

function tabBackup() {
    const matched = alreadyMatches();
    const locks=getSettings().settingLocks;
    const archive=appearanceArchive(getSettings());
    const archiveMarkup=`<div class="salty-group">${cap('최근 꾸미기 복구함')}<p class="salty-note">스타일·프리셋 적용 전 모습을 최대 8개 기억해요. 복구는 잠금과 관계없이 그때 모습으로 돌아가요.</p>${archive.length?archive.map(x=>row(esc(x.label),`<button class="salty-btn" data-act="appearance-restore" data-id="${esc(x.id)}">복구</button>`,new Date(x.at).toLocaleString())).join(''):'<p class="salty-note">아직 보관한 모습이 없어요.</p>'}</div>`;
    return `${archiveMarkup}<div class="salty-group">${cap('스타일을 바꿔도 유지할 설정')}${LOCK_GROUPS.map(([id,label])=>row(label,toggle('settingLocks.'+id,locks[id]))).join('')}<p class="salty-note">스타일·공유 프리셋·캐릭터 연결에 적용돼요. 직접 조절과 전체 설정 파일 복원·초기화에는 적용하지 않아요.</p></div><div class="salty-group">
            ${row('실리태번 설정', `<button class="salty-btn" data-act="st-theme">${matched ? '다시 맞추기' : '맞추기'}</button>`,
        matched ? '지금 이 테마에 맞게 돼 있어요' : '흐림 · 그림자 · 말풍선 모양을 이 테마에 맞춰요')}
            ${row('프리셋 공유', '<span class="salty-btns"><button class="salty-btn" data-act="preset-export">공유하기</button><button class="salty-btn" data-act="preset-import">불러오기</button></span>', '형광펜 · 날씨처럼 묶음만 골라요')}
            ${row('전체 설정 파일', '<span class="salty-btns"><button class="salty-btn" data-act="export">내보내기</button><button class="salty-btn" data-act="import">가져오기</button></span>')}
            ${row('처음 설정으로', '<button class="salty-btn salty-btn-danger" data-act="reset">되돌리기</button>', '무엇을 되돌릴지 골라요')}
        </div>
        <input type="file" accept=".json" hidden data-file="settings"><input type="file" accept=".json" hidden data-file="preset">`;
}

async function askPresetGroups(incoming = null) {
    const ctx = SillyTavern.getContext(), box = document.createElement('div');
    const available = PRESET_GROUPS.filter(([id]) => !incoming || incoming.groups[id]);
    box.className = 'salty-reset-pick';
    box.innerHTML = `<p><b>${incoming ? '어떤 프리셋을 불러올까요?' : '어떤 프리셋을 공유할까요?'}</b></p>${available.map(([id,label])=>`<label><input type="checkbox" data-preset-group="${id}" ${incoming ? 'checked' : ''}><span>${label}</span></label>`).join('')}<p class="salty-note">${incoming ? '선택한 묶음만 바뀌어요.' : '개인 이미지와 저장한 라이브러리는 담지 않아요.'}</p>`;
    const ok = await ctx.callGenericPopup(box, ctx.POPUP_TYPE.CONFIRM, '', {okButton: incoming ? '불러오기' : '파일로 공유', cancelButton:'취소'});
    if (ok !== ctx.POPUP_RESULT?.AFFIRMATIVE) return null;
    const selected = [...box.querySelectorAll('input:checked')].map(input=>input.dataset.presetGroup);
    if (!selected.length) {toastr.info('묶음을 하나 이상 골라 주세요.', 'Blue Lemonade'); return null;}
    return selected;
}

// ───────── 글자 ─────────
function tabText(s, sub) {
    let body = '';
    if (sub === 'para') {
        body = `<div class="salty-group">${row('폰 · PC 배치 따로 기억', toggle('deviceLayouts.on', s.deviceLayouts.on), '글자 크기·간격·여백·프로필 배치를 기기별로 기억해요. 색과 글꼴은 함께 써요.')}<p class="salty-note">지금은 ${deviceKind() === 'mobile' ? '모바일' : 'PC'} 배치를 편집하고 있어요.</p></div><div class="salty-group">
                ${stack('정렬', seg('type.align', [['left', '왼쪽'], ['justify-word', '양쪽'], ['justify-break', '양쪽(끊어서)']], s.type.justify ? 'justify-word' : 'left'), '양쪽(끊어서): 낱말이 잘려도 빈틈 없이')}
                ${row('첫 줄 들여쓰기', toggle('type.indent', s.type.indent))}
            </div>
            <div class="salty-group">
                ${slider('type.para', '문단 사이', 0, 2, 0.01)}
                ${slider('type.gutter', '좌우 여백', 8, 40, 1)}
                ${slider('type.measure', 'PC에서 본문 최대 폭', 480, 1000, 1)}
            </div>`;
    } else if (sub === 'shadow') {
        // 글자 그림자 — 어디에(본문 · 대사 · 속마음 · 강조 · 코드) + 각도(0 = 오른쪽, 시계 방향) · 거리 · 퍼짐 · 색 · 투명도. 폰의 번짐 방지 규칙을 고른 대상에서만 푼다
        const sh = s.shadow;
        const ol = s.outline || { on: false, scope: 'all', color: '#000000', width: 1, alpha: 100 };
        body = `${cap('글자 그림자')}
            <div class="salty-group">
                ${row('그림자', toggle('shadow.on', sh.on), '글자 뒤에 그림자를 깔아요')}
                ${sh.on ? stack('어디에', chips([['shadow.targets.text', '본문'], ['shadow.targets.dialogue', '대사'], ['shadow.targets.em', '속마음'], ['shadow.targets.strong', '강조'], ['shadow.targets.code', '코드']]), '여러 개 골라도 돼요 · 본문은 글 전체') : ''}
                ${sh.on ? `<div class="salty-row"><span>색</span><input type="color" data-color-path="shadow.color" value="${esc(sh.color)}" aria-label="그림자 색"></div>` : ''}
                ${sh.on ? slider('shadow.alpha', '투명도', 0, 100, 1) : ''}
                ${sh.on ? slider('shadow.angle', '각도', 0, 360, 1) : ''}
                ${sh.on ? slider('shadow.distance', '거리', 0, 12, 0.5) : ''}
                ${sh.on ? slider('shadow.blur', '퍼짐', 0, 24, 0.5) : ''}
            </div>
            ${sh.on ? '<p class="salty-note">각도는 그림자가 지는 방향(0 = 오른쪽, 90 = 아래), 거리는 글자에서 얼마나 떨어질지예요. 폰에서 글자가 번져 보이면 퍼짐을 줄이거나 꺼 주세요.</p>' : ''}
            ${cap('글자 외곽선')}
            <div class="salty-group">
                ${row('외곽선', toggle('outline.on', ol.on), '메시지 글자 둘레에 테두리를 둘러 배경과 섞이지 않게')}
                ${ol.on ? `<div class="salty-row"><span>색</span><input type="color" data-color-path="outline.color" value="${esc(ol.color)}" aria-label="외곽선 색"></div>` : ''}
                ${ol.on ? slider('outline.width', '두께', 0.2, 3, 0.1) : ''}
                ${ol.on ? slider('outline.alpha', '진하기', 0, 100, 1) : ''}
            </div>
            ${ol.on ? '<p class="salty-note">메시지 본문 전체에 둘러요. 두께는 0.5 안팎이 자연스럽고, 크게 올리면 글자 속이 좁아 보여요. 데우스 대사 색상에만 두르려면 프롬프트 › 데우스 › 대사 색상 가독성 향상을 쓰세요.</p>' : ''}`;
    } else if (sub === 'dialogue') {
        // 대사: 표시 · 형광펜 모양 · 색 → 글자(크기 · 굵기 · 자간) → 글꼴. 2.7.0 부터 한 화면 (미리보기를 접을 수 있어 길어도 됨)
        const marker = s.dialogue.style === 'marker';
        const pen = marker || s.dialogue.style === 'full';
        body = `${cap('대사', '"…"')}
            <div class="salty-group">
                ${stack('표시', seg('dialogue.style', [['marker', '형광펜'], ['full', '전체 칠'], ['bold', '굵게'], ['tint', '색'], ['plain', '없음']]))}
                ${marker ? stack('형광펜 모양', seg('dialogue.markerShape', [['stroke', '펜 자국'], ['rectangle', '직사각형'], ['pill', '알약']], 'stroke')) : ''}
                ${marker && s.dialogue.markerShape === 'stroke' ? stack('형광펜 기울기', seg('dialogue.tilt', [['flat', '일직선'], ['slant', '대각선'], ['steep', '완전 대각선']])) : ''}
                ${marker ? stack('형광펜 위치', seg('dialogue.markerPos', [['center', '가운데'], ['bottom', '아래']], 'center'), '아래: 밑줄 긋듯 글자 아랫부분에') : ''}
                ${marker ? slider('dialogue.markerThick', '형광펜 굵기', ...TEXT_LIMIT.markerThick, 1, 54) : ''}
                ${pen ? color('marker', '형광펜 색') : ''}
                ${color('dialogue', '글자 색')}
            </div>
            ${roleType('대사', [sizeOpt('type.dialogueSize', '크기', '본문과 같게', ...TEXT_LIMIT.dialogueSize), slider('dialogue.weight', '굵기', 300, 800, 1), sizeOpt('dialogue.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('대사 글꼴')}${fontBlock(s, 'dialogue')}`;
    } else if (sub === 'ui') {
        body = `${gradientControls(s,'ui','메뉴 글자',{slider,esc})}${roleType('메뉴', [sizeOpt('type.uiSize', '크기', '기본', ...TEXT_LIMIT.uiSize), sizeOpt('ui.weight', '굵기', '기본', 300, 800), sizeOpt('ui.letterSpacing', '자간', '기본', ...TEXT_LIMIT.letterSpacing)], '메뉴 · 단추 · 설정창 글자')}
            ${cap('메뉴 글꼴')}${fontBlock(s, 'ui')}`;
    } else if (sub === 'em') {
        body = `${cap('속마음', mdLabel('*기울임*'))}
            <div class="salty-group">
                ${row('기울여 쓰기', toggle('em.italic', s.em.italic), '끄면 바로 세워서 색으로만 구분')}
                ${color('em', '글자 색')}
            </div>
            ${roleType('속마음', [sizeOpt('em.size', '크기', '본문과 같게', ...TEXT_LIMIT.roleSize), slider('em.weight', '굵기', 300, 700, 1), sizeOpt('em.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('속마음 글꼴')}${fontBlock(s, 'em')}`;
    } else if (sub === 'strike') {
        const st = s.strike || { line: true, own: false, color: '#ff7a7a', thickness: 2, fade: 55, italic: false };
        body = `${cap('취소선', mdLabel('~~취소선~~'))}
            <div class="salty-group">
                ${row('선 긋기', toggle('strike.line', st.line !== false), '끄면 선 없이 흐리게만')}
                ${st.line !== false ? row('선 색 따로 정하기', toggle('strike.own', st.own), '끄면 글자 색으로 그어요') : ''}
                ${st.line !== false && st.own ? `<div class="salty-row"><span>선 색</span><input type="color" data-color-path="strike.color" value="${esc(st.color)}" aria-label="취소선 색"></div>` : ''}
                ${st.line !== false ? slider('strike.thickness', '선 굵기', 1, 4, 0.5) : ''}
                ${row('기울이기', toggle('strike.italic', st.italic), '지워진 글자를 기울여 써요')}
                ${slider('strike.fade', '흐리기', 20, 100, 5)}
            </div>
            <p class="salty-note">흐리기는 지워진 글자를 얼마나 남길지예요. 100이면 그대로, 낮을수록 옅어져요. 선은 글자 가운데에 곧게 그어져 글꼴이 달라도 보여요.</p>`;
    } else if (sub === 'strong') {
        body = `${cap('강조', mdLabel('**굵게**'))}
            <div class="salty-group">
                ${color('strong', '글자 색')}${color('gold','강조 형광펜 색')}
            </div>
            ${roleType('강조', [sizeOpt('strong.size', '크기', '본문과 같게', ...TEXT_LIMIT.roleSize), slider('strong.weight', '굵기', 400, 900, 1), sizeOpt('strong.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('강조 글꼴')}${fontBlock(s, 'strong')}`;
    } else if (sub === 'code') {
        body = `${gradientControls(s,'code','코드 글자',{slider,esc})}
            ${roleType('코드', [sizeOpt('type.codeSize', '크기', '본문과 같게', ...TEXT_LIMIT.codeSize), sizeOpt('code.weight', '굵기', '본문과 같게', 300, 800), sizeOpt('code.letterSpacing', '자간', '본문과 같게', ...TEXT_LIMIT.letterSpacing)])}
            ${cap('코드 글꼴')}${fontBlock(s, 'code')}
            <p class="salty-note">기본은 도트 글꼴(Neo둥근모)이에요.</p>`;
    } else {
        // 본문: 크기 · 굵기 · 자간 · 줄 간격 → 글꼴 (예전 '크기' · '모양' 칸을 합침)
        body = `<div class="salty-group">${color('text','본문 글자 색')}</div>${roleType('본문', [slider('type.size', '크기', 12, 22, 1), slider('type.weight', '굵기', 300, 600, 1), slider('type.letterSpacing', '자간', -5, 8, 1), slider('type.lineHeight', '줄 간격', 1.4, 2.2, 0.01)])}
            ${cap('본문 글꼴')}${fontBlock(s, 'text')}`;
    }
    // 미리보기는 탭 맨 위에 붙어 있는 칸 안에 — 슬라이드바를 미는 동안 화면에 남게 (길면 꺾쇠로 접음). 메뉴 칸은 메뉴 글꼴 · 크기로 그린 미리보기
    return `${prevBox('', sub === 'ui' ? uiSample() : sample())}${body}`;
}

// 역할의 글자 값 묶음: 제목 + 크기 · 굵기 · 자간 (· 줄 간격) — 여섯 역할이 같은 모양이라 한눈에 견줄 수 있게
function roleType(label, controls, hint = '') {
    return `${cap(`${label} 글자`, hint)}<div class="salty-group salty-sizes">${controls.join('')}</div>`;
}

// ───────── 채팅 ─────────
const frameColor = (path, label, value) => `<div class="salty-row"><span>${label}</span><input type="color" data-color-path="${path}" value="${esc(value)}" aria-label="${label}"></div>`;
function decorControls(prefix, o) {
    const d = o.decor, settings = getSettings();
    const selected = settings.frameLibrary.find(item => item.id === d.libraryId);
    const thumb = (art, name) => `<img src="${esc(art)}" alt="" loading="lazy"><span>${esc(name)}</span>`;
    return `${cap('장식 액자', '테두리 그림을 그대로 얹고 안쪽에만 사진을 넣어요')}<div class="salty-group bl-decor-controls">
        <span class="bl-frame-label">기본 프리셋</span>
        <div class="bl-frame-library" role="group" aria-label="액자 프리셋">${FRAME_PRESETS.map(([id, name]) => `<button type="button" data-act="frame-preset" data-owner="${prefix}" data-id="${id}" aria-pressed="${d.on && d.presetId === id}">${thumb(presetFrame(id).art, name)}</button>`).join('')}</div>
        <div class="bl-frame-upload-row"><button type="button" class="salty-btn bl-decor-upload" data-act="frame-upload" data-owner="${prefix}">${d.art ? '다른 액자 고르기' : '액자 그림 고르기'}</button><input type="file" data-frame-file="${prefix}" accept="${IMAGE_ACCEPT}" hidden></div>
        ${d.art ? row('장식 액자 사용', toggle(`${prefix}.decor.on`, d.on), '끄면 보통 테두리 설정으로 돌아와요') : '<p class="salty-note">투명 PNG · 배경색 있는 그림 모두 가능해요. 안쪽 공간을 자동으로 찾고 직접 보정할 수 있어요.</p>'}
        ${d.art && d.on ? `${slider(`${prefix}.decor.opacity`, '액자 진하기 (%)', 0, 100, 1)}
            ${d.presetId ? frameColor(`${prefix}.decor.presetColor`, '액자 바탕색', d.presetColor) + frameColor(`${prefix}.decor.presetAccent`, '액자 포인트색', d.presetAccent) : ''}
            ${slider(`${prefix}.decor.frameWidth`, '액자 가로 비율 (%)', 50, 200, 1)}
            ${slider(`${prefix}.decor.frameHeight`, '액자 세로 비율 (%)', 50, 200, 1)}
            <p class="salty-note">색과 가로·세로를 따로 조절해요. 색 고르기를 닫거나 비율 조절을 마치면 프리셋 장식을 다시 그려요. 불러온 그림은 전체를 늘이거나 줄여요.</p>
            ${slider(`${prefix}.decor.radius`, '안쪽 사진 모서리 (px)', 0, 120, 1, o.radius)}
            ${stack('안쪽 사진', seg(`${prefix}.decor.fit`, [['cover', '가득 채우기'], ['contain', '전체 보이기']]))}
            ${slider(`${prefix}.decor.zoom`, '사진 확대 (%)', 100, 200, 1)}
            ${slider(`${prefix}.decor.x`, '사진 좌우 (%)', 0, 100, 1)}${slider(`${prefix}.decor.y`, '사진 위아래 (%)', 0, 100, 1)}
            <button class="salty-btn" data-act="frame-remove" data-owner="${prefix}">액자 지우기</button>` : ''}
        ${d.art ? `<div class="bl-frame-save-row"><input type="text" data-frame-name="${prefix}" aria-label="액자 이름" maxlength="40" placeholder="액자 이름" value="${esc(selected?.name || '')}"><button type="button" class="salty-btn" data-act="frame-save" data-owner="${prefix}">새 액자로 저장</button></div>` : ''}
        <span class="bl-frame-label">내 액자 ${settings.frameLibrary.length} / ${FRAME_LIMIT}</span>
        <p class="salty-note">불러온 액자는 보관함에 저장돼요. 프로필과 에셋에서 함께 골라 쓸 수 있어요.</p>
        ${settings.frameLibrary.length ? `<div class="bl-frame-library" role="group" aria-label="저장한 액자">${settings.frameLibrary.map(item => `<button type="button" data-act="frame-use" data-owner="${prefix}" data-id="${esc(item.id)}" aria-pressed="${d.libraryId === item.id}">${thumb(item.decor.art, item.name)}</button>`).join('')}</div>` : ''}
        ${selected ? `<div class="bl-frame-actions"><button type="button" class="salty-btn" data-act="frame-rename" data-owner="${prefix}" data-id="${esc(selected.id)}">이름 바꾸기</button><button type="button" class="salty-btn" data-act="frame-delete" data-id="${esc(selected.id)}">보관함에서 삭제</button></div>` : ''}
    </div>`;
}
function nameControls(s, prefix = 'profile') {
    const p = s[prefix];
    const range = (key, label, step = 1) => slider(`${prefix}.${key}`, label, ...PROFILE_RANGE[key], step);
    return `${chatPreview()}<p class="salty-note">${prefix === 'userProfile' ? '내 메시지' : '캐릭터 메시지'}의 상단 큰 프로필 이름과 시간·버튼 배치예요. 프로필 탭에서 큰 사진을 켜 주세요.</p>
    ${fontBlock(s, prefix === 'userProfile' ? 'userName' : 'name')}${cap('이름 글자')}<div class="salty-group">
        ${range('nameSize', '크기 (px)')}${range('nameWeight', '굵기', 50)}${range('nameSpacing', '자간 (1/100em)')}${range('nameHeight', '줄 높이', 0.1)}
        ${stack('정보 정렬', seg(`${prefix}.nameAlign`, [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']]), '이름·시간·버튼과 메시지 번호·생성 정보를 함께 맞춰요')}
        ${row('테마 글자색', toggle(`${prefix}.nameAuto`, p.nameAuto))}
        ${!p.nameAuto ? frameColor(`${prefix}.nameColor`, '이름 색', p.nameColor) : ''}${gradientControls(s,prefix==='profile'?'name':'userName','이름 글자',{slider,esc})}
        ${row('기울임', toggle(`${prefix}.nameItalic`, p.nameItalic))}${row('밑줄', toggle(`${prefix}.nameUnderline`, p.nameUnderline))}
        ${range('nameOutline', '외곽선 두께 (px)', 0.1)}${frameColor(`${prefix}.nameOutlineColor`, '외곽선 색', p.nameOutlineColor)}
        ${row('이름 그림자', toggle(`${prefix}.nameShadow`, p.nameShadow))}
        ${p.nameShadow ? range('nameShadowY', '그림자 거리 (px)') + range('nameShadowBlur', '그림자 번짐 (px)') + range('nameShadowAlpha', '그림자 진하기 (%)') : ''}
    </div>${cap('시간 · 메뉴 · 편집 버튼')}<div class="salty-group">
        ${stack('배치', seg(`${prefix}.headerLayout`, [['side', '이름 옆 두 줄'], ['below-one', '이름 아래 한 줄'], ['below-two', '이름 아래 두 줄']]))}
        ${range('headerGap', '줄 간격 (px)')}${range('metaSize', '시간 글자 크기 (px)')}${range('metaOpacity', '시간 진하기 (%)')}${range('buttonGap', '버튼 간격 (px)')}
    </div>`;
}
function frameControls(prefix, o) {
    const range = (key, label, step = 1) => slider(`${prefix}.${key}`, label, ...FRAME_RANGE[key], step);
    return `${decorControls(prefix, o)}${cap('테두리', '얇은 선에서 시작해 원하는 만큼 더해요')}<div class="salty-group">
        ${stack('모양', seg(`${prefix}.edge`, [['none', '없음'], ['line', '얇은 선'], ['inset', '안쪽 선'], ['glow', '은은한 빛'], ['prism', '이중선']]))}
        ${o.edge !== 'none' ? `
            ${row('자동 색', toggle(`${prefix}.edgeAuto`, o.edgeAuto), prefix === 'image' ? '그림과 테마에 어울리는 색을 써요' : '테마 포인트색을 따라가요')}
            ${!o.edgeAuto ? frameColor(`${prefix}.edgeColor`, '테두리 색', o.edgeColor) : ''}
            ${stack('선 종류', seg(`${prefix}.edgeStyle`, [['solid', '실선'], ['dashed', '파선'], ['dotted', '점선']]))}
            ${range('edgeThick', '두께', 0.25)}${range('edgeAlpha', '진하기')}
            ${stack('보일 면', chips(['Top', 'Bottom', 'Left', 'Right'].map((side, i) => [`${prefix}.edgeSide${side}`, ['위', '아래', '왼쪽', '오른쪽'][i]])))}
            ${o.edge === 'glow' ? range('edgeGlow', '빛 번짐') + range('edgeGlowAlpha', '빛 진하기') : ''}
            ${o.edge === 'prism' ? range('edgeSecondGap', '두 선 간격') + range('edgeSecondAlpha', '바깥선 진하기') : ''}
        ` : ''}
        ${range('edgeGap', '안쪽 여백')}
        ${prefix === 'image' ? '<p class="salty-note">가장자리 흐림은 선도 함께 부드럽게 녹여요. 빛과 이중선은 네 면을 모두 켜면 나타나요.</p>' : ''}
    </div>${cap('그림자')}<div class="salty-group">
        ${row('그림자', toggle(`${prefix}.edgeShadow`, o.edgeShadow), '테두리와 별도로 조절해요')}
        ${o.edgeShadow ? frameColor(`${prefix}.edgeShadowColor`, '그림자 색', o.edgeShadowColor)
            + range('edgeShadowAlpha', '진하기') + range('edgeShadowX', '좌우 거리') + range('edgeShadowY', '위아래 거리')
            + range('edgeShadowBlur', '번짐') + range('edgeShadowSpread', '확장') : ''}
    </div>`;
}
function profileControls(s, prefix = 'profile') {
    const p = s[prefix];
    const range = (key, label, step = 1) => slider(`${prefix}.${key}`, label, ...PROFILE_RANGE[key], step);
    return `${chatPreview()}<div class="salty-group">
        ${stack(prefix === 'userProfile' ? '내 프로필' : '캐릭터 프로필', seg(`${prefix}.mode`, [['none', '프로필 없음'], ['small', '작은 프로필'], ['banner', '상단 큰 프로필']]), prefix === 'userProfile' ? '내가 보낸 메시지의 사진만 바꿔요.' : '캐릭터 메시지마다 사진이 위에, 글이 아래에 놓여요')}
    ${prefix === 'userProfile' && p.mode === 'small' ? stack('작은 사진 위치', seg(`${prefix}.side`, [['auto', '자동'], ['left', '왼쪽'], ['right', '오른쪽']], 'auto'), '자동은 말풍선이면 오른쪽, 나머지 모양은 왼쪽이에요') : ''}
    ${prefix === 'userProfile' && p.mode === 'small' ? stack('번호 · 시간 줄 위치', seg(`${prefix}.metaSide`, [['auto', '사진 따라'], ['left', '왼쪽'], ['right', '오른쪽']], 'auto'), '메시지 위의 #번호 · 걸린 시간 · 토큰 줄이에요') : ''}
    </div>${p.mode === 'banner' ? `
    ${cap('사진 크기 · 위치')}<div class="salty-group">
        ${stack('사진 배치', seg(`${prefix}.layout`, [['column', '본문 폭'], ['bleed', '가로 꽉'], ['inset', '작게']]), '가로 꽉은 본문 좌우 여백까지 사진으로 채워요')}
        ${p.layout === 'bleed' ? '' : range('width', '너비 (%)')}
        ${stack('세로 크기', seg(`${prefix}.sizing`, [['pixels', '픽셀'], ['screen', '화면 비율'], ['ratio', '사진 비율']]))}
        ${p.sizing === 'pixels' ? range('height', '높이 (px)') : p.sizing === 'screen' ? range('screenHeight', '화면 높이 (%)') : ''}
        ${range('maxHeight', '최대 화면 높이 (%)')}
        ${range('visibleHeight', '세로로 남길 부분 (%)')}
        <p class="salty-note">100%면 전체를 사용해요. 줄이면 위아래를 잘라내며 ‘사진 위아래’로 남길 위치를 정해요. 장식 액자는 테두리 비율을 유지하고 안쪽 사진만 잘라요.</p>
        ${stack('사진 맞추기', seg(`${prefix}.fit`, [['cover', '가득 채우기'], ['contain', '전체 보이기']]))}
        ${range('positionX', '사진 좌우 (%)')}${range('positionY', '사진 위아래 (%)')}
        ${range('radius', '모서리 (px)')}${range('gap', '글과 간격 (px)')}
        ${row('원본 화질', toggle(`${prefix}.original`, p.original), '화면 가까이에 온 사진만 원본을 불러와요')}
    </div>${cap('흐림 · 투명도')}<div class="salty-group">
        ${range('fadeY', '위아래 가장자리 (%)')}${range('fadeX', '좌우 가장자리 (%)')}
        ${range('blur', '사진 흐림 (px)', 0.5)}${range('opacity', '사진 진하기 (%)')}
    </div>${frameControls(prefix, p)}` : ''}`;
}

function tabChat(s, sub) {
    if (sub === 'profile') return profileControls(s);
    if (sub === 'user-profile') return profileControls(s, 'userProfile');
    if (sub === 'user-name') return nameControls(s, 'userProfile');
    if (sub === 'name') return nameControls(s);
    if (sub === 'etc') {
        // 4.7.1: 커스텀 CSS 가 메시지 칸(.mes · #chat …)을 건드리면 여기서 바로 보인다 — 제보의 첫 의심 대상
        const css = customCssReport();
        const touch = css.chat.length ? `<p class="salty-note bl-css-touch"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> 커스텀 CSS ${css.chat.length}개 규칙이 메시지 칸을 건드려요 — 버튼 · 이름 줄이 이상하면 먼저 꺼 보세요<br><small>${css.chat.slice(0, 5).map(esc).join(' · ')}${css.chat.length > 5 ? ' …' : ''}</small></p>` : '';
        const customCss = `${cap('다른 CSS', css.lines ? `커스텀 CSS ${css.lines}줄 · ${css.rules}규칙` : '커스텀 CSS 없음')}<div class="salty-group">${touch}
            ${row('펼친 카드 아래에 접기 버튼',toggle('chat.triangleFold',s.chat.triangleFold??SillyTavern.getContext().extensionSettings?.blue_lemonade_scripts?.enabled?.fold??false),'채팅 카드 맨 아래에서 바로 접어요.')}
            ${row('커스텀 CSS 끄기', toggle('compat.muteCustomCss', !!s.compat?.muteCustomCss), '사용자 설정의 커스텀 CSS 를 테마가 켜진 동안 꺼요 · 지우지는 않아요')}
        </div>
        ${cap('진단', '제보할 때 붙여 넣는 한 덩어리')}<div class="salty-group">
            ${row('진단 복사', '<button class="salty-btn" data-act="diag-copy" aria-label="진단 복사"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>', '테마 · 실리태번 버전, 화면 폭, 표시 옵션, 커스텀 CSS, 켜진 확장')}
        </div>`;
        return `${customCss}`;
    }
    if (sub === 'screen') {
        const stFade = !!SillyTavern.getContext().powerUserSettings?.stream_fade_in; // 실리태번 쪽 페이드 인 (무거움) — 켜져 있으면 끄는 줄을 같이 보여 줌
        return `${chatPreview()}<div class="salty-group">
            ${stack('아이콘', seg('chat.icons', [['line', '선 아이콘'], ['default', '기본']]))}
            ${row('배경 이미지 비치기', toggle('chat.bgImage', s.chat.bgImage), '끄면 깨끗한 종이색 바탕')}
            ${s.chat.bgImage ? slider('chat.bgAlpha', '채팅 바탕 농도', 0, 100, 1, 82) : ''}
            ${s.chat.bgImage ? '<p class="salty-note">100이면 채팅 영역과 입력창 둘레를 테마 바탕색으로 완전히 덮어요. 내 메시지 면도 같은 농도를 따라가요.</p>' : ''}
            ${row('고르기 목록 팝업', toggle('chat.selectPop', s.chat.selectPop !== false), '모델 · 프리셋 같은 목록을 테마가 그린 팝업으로 (끄면 폰 기본 목록)')}
            ${row('색 고르기 팝업', toggle('chat.colorPop', s.chat.colorPop !== false), '실리태번 색 칸도 테마 색 고르기로')}
            ${row('큰 숫자는 쉼표로', toggle('chat.numComma', s.chat.numComma !== false), '숫자 칸의 30000 을 30,000 으로 보여 줘요 · 누르면 원래대로, 값은 그대로')}
            ${splashRow()}
            ${row('가벼운 페이드 인', toggle('chat.streamFade', !!s.chat.streamFade), '스트리밍 중 새 글자만 스며들게')}
            ${s.chat.streamFade && stFade ? row('실리태번 페이드 인', toggle('st.streamFadeIn', true), '끄면 빨라지고 위 옵션이 대신해요') : ''}
        </div>
        ${cap('메시지 버튼', '··· 메뉴 밖에 늘 보일 버튼')}<div class="salty-group">
            ${mesPinPicker(s)}
        </div>
        ${cap('퀵 리플라이')}<div class="salty-group">
            <div class="bl-inline-preview" data-pv="qr">${qrSample(s.chat.qrFind !== false)}</div>
            ${row('QR 검색 버튼', toggle('chat.qrFind', s.chat.qrFind !== false), '돋보기만 숨겨요. 빠른 답장 버튼은 그대로 사용할 수 있어요')}
            ${stack('자리', seg('chat.qrPlace', [['bottom', '입력창 아래'], ['top', '입력창 위']], 'bottom'), '입력창 옆에 아이콘이 많으면 위가 넓어요')}
            ${stack('넘기기', seg('chat.qrScroll', [['x', '가로 스크롤'], ['y', '세로 스크롤']]))}
            ${s.chat.qrScroll === 'y' ? slider('chat.qrRows', '보이는 줄', 1, 4, 1, 2) : ''}
        </div>
        ${cap('날씨')}<div class="salty-group">
            ${row('생성·편집 중 날씨 쉬기', toggle('chat.weatherAutoRest', s.chat.weatherAutoRest), '답을 받거나 글을 쓰는 동안 멈추고, 끝나면 이어져요.')}
            ${row('글 읽기 우선', toggle('chat.weatherReadability', s.chat.weatherReadability), '날씨를 조금 옅게 하고, 그림자를 따로 쓰지 않을 때 글자 그림자를 자동으로 보완해요.')}

            ${stack('채팅 뒤 효과', weatherSeg(s), weatherMode(s) === 'tracker' ? '트래커 날씨를 읽어 비 · 눈 · 안개 · 햇살 · 밤의 별을 보여요. 안개비 · 여우비처럼 둘이면 겹쳐요' : '')}
            ${weatherMode(s) === 'custom' ? weatherImageControls(s) : ''}
            ${['sun','star','firefly','shadow','breeze','lemon','petal'].includes(weatherMode(s)) ? row('그림 효과 사용',toggle('chat.weatherIllustrated',s.chat.weatherIllustrated).replace('<input','<input aria-label="그림 효과 사용"'),'기본은 작고 단순하게. 켜면 이전 그림체를 골라 쓸 수 있어요.') : ''}
            ${s.chat.weatherIllustrated && ['sun','star','firefly','shadow','breeze','lemon','petal'].includes(weatherMode(s)) ? stack('그림 스타일',seg('chat.weatherArtStyle',[['real','실사풍'],['anime','일러스트풍'],['cel','셀 애니풍']],'real'),'색과 움직임은 그대로, 그림의 느낌만 바꿔요. 날씨마다 기억해요.') : ''}
            ${['rain','snow'].includes(weatherMode(s)) ? slider('chat.weatherAmount', weatherMode(s)==='rain'?'비의 양':'눈의 양', 0, 200, 1, 100)+'<p class="salty-note">100%가 기본 양이에요. 숫자를 직접 입력해도 돼요.</p>' : !['off', 'tracker'].includes(weatherMode(s)) ? stack('세기', seg('chat.weatherLevel', [[1, '약하게'], [2, '보통'], [3, '강하게']])) : ''}
            ${weatherMode(s) === 'tracker' ? `<p class="salty-note">세기 · 색 · 모양은 그 날씨를 직접 골랐을 때 맞춰 둔 값을 그대로 써요. 비는 비대로, 눈은 눈대로요.</p>
            <button type="button" class="salty-btn bl-weather-skip-fold" data-act="weather-skip-fold" aria-expanded="${!!ui.weatherSkipOpen}">제외할 날씨${(s.chat.weatherTrackerSkip || []).length ? ` · ${s.chat.weatherTrackerSkip.length}` : ''} <i class="fa-solid fa-chevron-${ui.weatherSkipOpen ? 'up' : 'down'}"></i></button>
            ${ui.weatherSkipOpen ? `<div class="salty-seg bl-weather-choices bl-weather-skip">${[['rain', '비'], ['snow', '눈'], ['fog', '안개'], ['sun', '햇살'], ['star', '별'], ['rainbow', '무지개'], ['breeze', '흩날림']].map(([value, label]) => `<button data-act="weather-skip" data-value="${value}" class="${(s.chat.weatherTrackerSkip || []).includes(value) ? 'on' : ''}">${label}</button>`).join('')}</div><p class="salty-note">고른 날씨는 트래커에 나와도 화면에 그리지 않아요.</p>` : ''}` : ''}
            ${weatherMode(s) !== 'off' ? `${slider('chat.weatherBubble', '내 메시지 농도', 30, 100, 1, 70)}<p class="salty-note">날씨를 켠 동안 내 메시지 면(말풍선 · 카드 · 테이블)이 이만큼만 칠해져 그 뒤의 날씨가 비쳐요. 100이면 불투명해요.</p>` : ''}
            ${weatherMixing(s) && s.chat.weather2 && s.chat.weather2 !== 'off' ? ['rain','snow'].includes(s.chat.weather2) ? slider('chat.weather2Amount', s.chat.weather2==='rain'?'함께 내리는 비의 양':'함께 내리는 눈의 양',0,200,1,100) : stack('둘째 날씨 세기', seg('chat.weather2Level', [[1, '약하게'], [2, '보통'], [3, '강하게']], 2), '둘째 날씨의 세부 값은 그 날씨를 첫째로 골랐을 때 맞춰 둔 값을 써요') : ''}
        </div>
        ${!['off', 'tracker'].includes(weatherMode(s)) ? `<div class="salty-group">
            <p class="salty-note">지금 선택한 날씨에만 적용돼요. 날씨마다 값을 따로 기억해요.</p>
            ${stack('날씨 색',seg('chat.weatherColorMode',[['auto','기본 색'],['custom','직접 고르기'],['gradient','그라데이션']],'auto'),'날씨마다 따로 저장해요. 기본 색으로 돌아가면 원래 색을 사용해요.')}
            ${s.chat.weatherColorMode==='custom'?`<div class="salty-row"><span>입자 색</span><input type="color" data-color-path="chat.weatherColor" value="${esc(s.chat.weatherColor)}" aria-label="날씨 입자 색"></div><p class="salty-note">커스텀 그림은 투명한 부분을 유지하고 선택한 색으로 물들여요.</p>`:''}
            ${s.chat.weatherColorMode==='gradient'?`<div class="salty-row"><span>첫 색</span><input type="color" data-color-path="chat.weatherColor" value="${esc(s.chat.weatherColor)}" aria-label="날씨 첫 색"></div><div class="salty-row"><span>둘째 색</span><input type="color" data-color-path="chat.weatherColor2" value="${esc(s.chat.weatherColor2)}" aria-label="날씨 둘째 색"></div><p class="salty-note">비 · 눈은 위에서 아래로 물들고, 나머지는 입자마다 두 색 사이의 색을 띠어요.</p>`:''}
            ${weatherSpotPad(s)}
            ${s.chat.weather==='shadow'?`${stack('그림자 모양',seg('chat.weatherShadowStyle',[['palm','야자 잎'],['leaf','나뭇잎 가지']],'palm'))}${slider('chat.weatherShadowBlur','흐리기',0,100,1,35)}<p class="salty-note">세기는 가지 수, 속도 · 흔들림은 살랑임, 각도는 가지가 기운 정도, 회전은 느린 출렁임이에요.</p>`:''}
            ${s.chat.weather==='rainbow'?`<p class="salty-note">각도는 무지개의 자리, 크기는 띠의 굵기, 회전은 좌우로 흔들리는 빠르기예요. 세기를 강하게 하면 쌍무지개가 돼요.</p>`:''}
            ${s.chat.weather==='breeze'?`<p class="salty-note">각도는 바람 방향, 회전은 잎이 도는 빠르기예요.</p>`:''}
            ${s.chat.weather==='star'?`${stack('별 모양',seg('chat.weatherStarStyle',[['sky','반짝이는 별'],['milky','은하수']],'sky'))}<p class="salty-note">속도는 반짝이는 빠르기, 흔들림은 반짝임의 깊이, 각도는 하늘이 흐르는 방향(은하수는 띠가 누운 방향), 회전은 십자 빛이 도는 빠르기예요. 가끔 별똥별이 지나가요. 유성과 겹치면 잘 어울려요.</p>`:''}
            ${s.chat.weather==='firefly'?`<p class="salty-note">속도는 나는 빠르기, 흔들림은 헤매는 정도, 각도는 쏠리는 방향, 회전은 깜빡이는 빠르기예요.</p>`:''}
            ${s.chat.weatherIllustrated && ['sun','star','firefly','shadow','breeze','lemon','petal'].includes(weatherMode(s)) ? row('그림 외곽선',toggle('chat.weatherArtOutline',s.chat.weatherArtOutline)) : ''}
            ${s.chat.weather==='sun'?'<p class="salty-note">렌즈 플레어의 크기·속도·자리를 조절해요. 색도 직접 고를 수 있어요.</p>':''}
            ${s.chat.weather==='fog'?`${stack('안개 모양',seg('chat.weatherFogStyle',[['soft','부드러운 안개'],['anime','안개 띠'],['wisp','실안개']],'soft'))}${stack('안개 위치',seg('chat.weatherFogArea',[['all','전체'],['bottom','아래쪽'],['top','위쪽'],['both','위아래']],'all'))}${slider('chat.weatherFogStretch','길이',50,300,1,100)}${slider('chat.weatherFogEdge','가장자리 선명하게',0,100,1,30)}${slider('chat.weatherFogSwell','부풀기',0,300,1,100)}${slider('chat.weatherFogDepth','깊이감',0,200,1,100)}<p class="salty-note">각도는 흐르는 방향(왼쪽 · 오른쪽)만 정해요.</p>`:''}
            ${slider('chat.weatherOpacity', '투명도', 10, 100, 1, 100)}
            ${slider('chat.weatherSize', '크기', 40, 250, 1, 100)}
            ${slider('chat.weatherSpeed', '속도', 20, 250, 1, 100)}
            ${slider('chat.weatherAngle', '각도', -45, 45, 1, -9)}
            ${stack('움직임', seg('chat.weatherMotion', [['natural', '자연스럽게'], ['straight', '곧게'], ['flutter', '살랑살랑'], ['streak', '빠르게 쏟아지기']]))}
            ${slider('chat.weatherSway', '흔들림', 0, 300, 1, 100)}
            ${slider('chat.weatherSpin', '회전', 0, 300, 1, 100)}
            ${s.chat.weather==='meteor'?`${stack('유성우 도는 방향',seg('chat.weatherOrbitDirection',[['left','왼쪽으로 · 반시계'],['right','오른쪽으로 · 시계']]))}${slider('chat.weatherCurvature','유성우 곡률',0,100,1,65)}${slider('chat.weatherOrbitSize','유성우 원 크기',40,240,1,100)}<p class="salty-note">곡률 0은 직선, 100은 원형 궤도예요. 원이 작으면 유성이 많아지고, 크면 넓은 원을 따라 적게 보여요. 각도로 궤도의 방향을 기울여요. ‘곧게’ 움직임을 고르면 곡률보다 우선해 직선으로 내려요.</p>`:''}
        </div>` : ''}
        ${cap('폰')}<div class="salty-group">
            <div class="bl-inline-preview" data-pv="phone">${phoneMock(s)}</div>
            ${row('스크롤하면 바 숨기기', toggle('reader.autoHide', !!s.reader?.autoHide), '아래로 읽으면 숨고, 살짝 올리거나 누르면 나와요')}
            ${row('백그라운드에서도 계속 (실험)', toggle('bgWindow.on', !!s.bgWindow?.on), '답을 기다리는 동안 다른 앱을 봐도 생성 · 번역이 멈추지 않게 해요. 보내기 · 스와이프를 누를 때 켜지고 끝나면 꺼져요')}
            ${s.bgWindow?.on ? stack('버티는 방식', seg('bgWindow.mode', [['audio', '소리 없이 버티기'], ['pip', '작은 창 띄우기']], 'audio'), s.bgWindow?.mode === 'pip' ? '진행 상황이 보이는 작은 창(PIP)이 떠요. 가장 확실하지만 창이 화면에 남아요' : '창 없이 버텨요. 귀에 안 들리는 아주 작은 소리를 내서 브라우저가 탭을 재우지 못하게 해요. 폰에 따라 안 통할 수 있어요 — 그러면 작은 창 방식을 써 보세요') : ''}
            ${row('답이 오면 알려 주기', toggle('replyNotify.on', !!s.replyNotify?.on), '다른 앱을 보고 있을 때 답이 끝나면 알림 · 진동으로 알려요. 처음 켤 때 브라우저가 알림 허용을 물어요. 화면을 보고 있을 땐 알리지 않아요')}
            ${row('한 손 버튼 줄', toggle('onehand.on', !!s.onehand?.on), '입력창 위에 스와이프 · 사칭 · 이어 쓰기 · 다시 생성')}
            ${s.onehand?.on ? stack('버튼', chips([['onehand.swipe', '스와이프'], ['onehand.imp', '사칭'], ['onehand.cont', '이어 쓰기'], ['onehand.regen', '다시 생성']])) : ''}
        </div>`;
    }
    const hideAvatars = document.getElementById('hideChatAvatarsEnabled')?.checked ?? false;
    return `${chatPreview()}<div class="salty-group">
        ${stack('내 메시지', seg('chat.user', [['bubble', '말풍선'], ['card', '카드'], ['table', '테이블'], ['plain', '글자만']]))}
        ${stack('이름 줄', seg('chat.header', [['full', '이름+시간'], ['name', '이름만'], ['none', '숨김']]))}
        ${row('작은 아바타 숨기기', toggle('st.hideAvatars', hideAvatars), '숨기면 이미지가 화면 끝까지 넓어져요')}
    </div>
    ${cap('내 메시지 글자', '100 = 캐릭터 글과 같게')}<div class="salty-group salty-sizes">
        ${slider('chat.userSize', '크기', 60, 140, 1, 100)}
        ${slider('chat.userInk', '진하기', 30, 100, 1, 100)}
    </div>`;
}

/** 저장된 도형 목록 최대 (도형 하나가 설정에 수십 KB 로 들어가므로) */
const MASK_SLOTS = 12;
/** '바꾸기'를 누른 뒤 파일을 고르면 이 칸의 그림을 갈아 끼운다 */
let maskReplaceId = '';
function maskControls(s) {
    const { mask, maskId, masks } = s.image;
    const has = !!mask;
    const current = masks.find(item => item.id === maskId) || null;
    // 5.3.4: 그림은 base64 data URL 만, 그래도 escape — 가져온 값이 style 속성을 빠져나가 스크립트가 돌 수 있었다
    const thumb = (data, extra = '') => `<span class="salty-mask-thumb${extra}" style="--salty-img-mask:${isDataImage(data) ? `url(&quot;${esc(data)}&quot;)` : 'none'}" aria-hidden="true"><i></i></span>`;
    const library = masks.length ? `<div class="salty-mask-lib" role="listbox" aria-label="저장한 도형">${masks.map(item =>
        `<button type="button" class="salty-mask-item${item.id === maskId ? ' on' : ''}" data-act="mask-use" data-id="${esc(item.id)}" aria-pressed="${item.id === maskId}">${thumb(item.data)}<small>${esc(item.name)}</small></button>`).join('')}</div>` : '';
    return `${library}
        <div class="salty-mask-row">
            <div class="salty-mask-thumb" aria-hidden="true">${has ? '<i></i>' : ''}</div>
            <div class="salty-btns">
                <button class="salty-btn" data-act="mask-pick">${has ? '다른 이미지 고르기' : '이미지 고르기'}</button>
                ${has && !current ? `<button class="salty-btn" data-act="mask-save">저장</button>` : ''}
                ${current ? `<button class="salty-btn" data-act="mask-replace" data-id="${esc(current.id)}">바꾸기</button><button class="salty-btn salty-btn-danger" data-act="mask-delete" data-id="${esc(current.id)}">삭제</button>` : ''}
                ${has && !current ? '<button class="salty-btn" data-act="mask-clear">지우기</button>' : ''}
            </div>
        </div>
        <input type="file" accept="${IMAGE_ACCEPT}" hidden data-file="mask">
        ${has ? stack('맞추는 법', seg('image.maskFit', [['stretch', '늘리기'], ['contain', '맞추기']]), '늘리기: 도형을 그림 상자에 가득 · 맞추기: 도형 비율 그대로 가운데') : ''}
        <p class="salty-note">배경이 투명한 그림의 <b>불투명한 부분</b>만 그림이 보여요. 폰에서는 갤러리에서 바로 고를 수 있어요. 512px 로 줄여 설정에 저장돼요.${has && !current ? ' <b>저장</b>을 누르면 목록에 커스텀 1 · 2 … 로 남아 나중에 골라 쓸 수 있어요.' : ''}</p>`;
}

/** 지금 실제로 쓰이는 날씨 (3.4.0): 트래커 따라는 데우스 호환이 꺼져 있으면 끔으로 보인다 (값은 남음) */
function weatherMode(s) {
    const mode = s.chat.weather || 'off';
    return mode === 'tracker' && !s.deus?.on ? 'off' : mode;
}

/** 날씨 자리 (4.2.8): 화면을 줄인 네모 안에서 점을 끌어 옮긴다 — 나무 그림자는 가지마다, 무지개는 꼭대기, 햇살은 빛의 자리. 놓을 때 저장한다 */
const SPOT_DEFAULTS = { shadow: [[0, 0], [1, .02], [0, .86]], rainbow: [[.55, .1]], sun: [[.5, 0]] };
function weatherSpotPad(s) {
    const mode = weatherMode(s);
    if (!SPOT_DEFAULTS[mode] || (mode === 'sun' && !['holy', 'flare', 'shaft', 'anime'].includes(s.chat.weatherSunStyle))) return '';
    const count = mode === 'shadow' ? Math.max(1, Number(s.chat.weatherLevel) || 2) : 1, saved = s.chat.weatherSpots?.[mode] || [];
    const sheld = document.getElementById('sheld'), ratio = sheld?.clientWidth > 0 ? Math.max(1, Math.min(2.3, sheld.clientHeight / sheld.clientWidth)) : 1.9;
    const dots = SPOT_DEFAULTS[mode].slice(0, count).map(([dx, dy], i) => { const at = saved[i] || { x: dx, y: dy }; return `<button type="button" class="bl-spot${saved[i] ? ' on' : ''}" data-spot="${i}" style="left:${(at.x * 100).toFixed(1)}%;top:${(at.y * 100).toFixed(1)}%" aria-label="자리 ${i + 1}">${count > 1 ? i + 1 : ''}</button>`; }).join('');
    return stack('자리', `<div class="bl-spot-row"><div class="bl-spot-pad" data-spot-mode="${mode}" style="aspect-ratio:1/${ratio.toFixed(2)}">${dots}</div>
        <div class="bl-spot-side"><p class="salty-note">네모가 채팅 화면이에요. 점을 끌어 ${mode === 'shadow' ? '가지가 뻗어 나오는 자리' : mode === 'rainbow' ? '무지개 꼭대기' : '빛이 드는 자리'}를 옮겨요.</p>${saved.length ? '<button type="button" class="salty-btn" data-act="weather-spot-reset">자동 배치로</button>' : ''}<button type="button" class="salty-btn" data-act="weather-spot-place">채팅 화면에서 정하기</button></div></div>`);
}

/** 날씨 고르기 (4.2.8): 종류가 많아져 카테고리로 나눴다. '날씨 혼합하기'를 켜면 첫째 · 둘째 칸을 골라 가며 두 날씨를 겹친다 (에이드 혼합하기와 같은 식) */
const WEATHER_CATS = [
    ['sky', '기본', [['rain', '비'], ['snow', '눈'], ['fog', '안개']]],
    ['light', '빛', [['sun', '햇살'], ['rainbow', '무지개'], ['star', '별'], ['meteor', '유성']]],
    ['nature', '자연', [['petal', '꽃잎'], ['lemon', '레몬'], ['firefly', '반딧불이'], ['breeze', '흩날림'], ['shadow', '나무 그림자']]],
    ['etc', '그 밖', [['custom', '내 그림'], ['tracker', '트래커 따라']]],
];
const weatherLabel = value => WEATHER_CATS.flatMap(cat => cat[2]).find(item => item[0] === value)?.[1] || '없음';
const weatherMixing = s => !['off', 'tracker'].includes(weatherMode(s)) && (ui.weatherMix || (s.chat.weather2 && s.chat.weather2 !== 'off'));
function weatherSeg(s) {
    const first = weatherMode(s), mixing = weatherMixing(s), slot = mixing && ui.weatherSlot === 2 ? 2 : 1;
    const path = slot === 2 ? 'chat.weather2' : 'chat.weather', current = slot === 2 ? (s.chat.weather2 || 'off') : first;
    const allowed = ([value]) => (value !== 'tracker' || s.deus?.on) && (slot === 1 || (!['custom', 'tracker'].includes(value) && value !== first));
    const cats = WEATHER_CATS.map(([id, label, items]) => [id, label, items.filter(allowed)]).filter(cat => cat[2].length);
    const cat = cats.find(c => c[0] === ui.weatherCat) || cats.find(c => c[2].some(item => item[0] === current)) || cats[0];
    const button = (value, label) => `<button data-act="seg" data-path="${path}" data-value="${value}" class="${current === value ? 'on' : ''}">${label}</button>`;
    return `${mixing ? `<div class="salty-seg bl-weather-slots"><button data-act="weather-slot" data-slot="1" class="${slot === 1 ? 'on' : ''}">1 · ${weatherLabel(first)}</button><button data-act="weather-slot" data-slot="2" class="${slot === 2 ? 'on' : ''}">2 · ${weatherLabel(s.chat.weather2)}</button></div>` : ''}
        <div class="salty-seg bl-weather-cats">${button('off', slot === 2 ? '없음' : '끔')}${cats.map(([id, label]) => `<button data-act="weather-cat" data-cat="${id}" class="${cat[0] === id && current !== 'off' ? 'on' : cat[0] === id ? 'open' : ''}">${label}</button>`).join('')}</div>
        <div class="salty-seg bl-weather-choices">${cat[2].map(([value, label]) => button(value, label)).join('')}</div>
        ${!['off', 'tracker'].includes(first) ? `<button type="button" class="salty-btn bl-weather-mix" data-act="weather-mix">${mixing ? '혼합 끄기' : '날씨 혼합하기'}</button>` : ''}`;
}

// ───────── 프롬프트 (3.4.0) ─────────
// 프리셋마다 한 칸. 지금은 데우스 엑스 마키나 — 호환을 켜야 카드 표본 · 카드 설정 · 트래커 설정이 보이고 적용된다
function tabExtensions(s, sub) { if(!addonsEnabled(s))return '<p class="salty-note">현재 사용 모드에서는 내장 확장을 실행하지 않아요. 테마 → 기타 설정 → 사용 모드에서 테마 + 확장 또는 확장만을 고르면 저장한 설정으로 다시 사용할 수 있어요.</p>';  if(sub==='scripts')sub='prompt'; return addonMarkup(s,sub) + (['words','capture'].includes(sub) && s.addons[sub] ? wordToolsMarkup(s,sub) : ''); }

function tabPrompt(s) {
    const on = !!s.deus?.on;
    const ink = s.deus?.ink || {};
    const dio = ink.outline || { on: false, color: '#000000', width: 0.6, alpha: 100 };  // 데우스 대사 가독성: 외곽선
    const dis = ink.shadow || { on: false, color: '#000000', alpha: 60, angle: 135, distance: 1.5, blur: 2 }; // 그림자
    const fx = s.deus?.fx || { on: true, motion: 'normal', glow: true, flow: false, flowMode: 'text', force: false }; // 4.1.2 감정 대사 효과
    const head = `${cap('데우스 엑스 마키나')}<p class="bl-prompt-source">호환 대상 프롬프트 · <a href="https://www.reddit.com/r/SillyTavernAI/s/ldSEyIl3Gx" target="_blank" rel="noopener noreferrer">데우스 원문 보기 ↗</a></p><div class="salty-group">
            ${row('프롬프트 호환', toggle('deus.on', on), '이 프리셋의 트래커 · 장면 계획 · 상태 카드를 테마에 맞춰요')}
        </div>`;
    if (!on) return `${head}<p class="salty-note">데우스 엑스 마키나 프리셋을 쓸 때만 켜 주세요. 끄면 아래 설정이 모두 쉬어요 (고른 값은 남아요).</p>`;
    return `${regexPreview()}${head}
        ${cap('카드')}<div class="salty-group">
            ${row('카드 스킨', toggle('chat.demSkin', !!s.chat.demSkin), '트래커 · 장면 계획 같은 카드를 테마 모양으로')}
            ${s.chat.demSkin ? row('폰에서 접어 두기', toggle('chat.demFold', s.chat.demFold !== false), '트래커는 한 줄, 펼쳐져 오는 카드는 제목만 · 누르면 펼쳐요') : ''}
            ${row('카드 색 통일', toggle('chat.unifyRegex', s.chat.unifyRegex), '카드의 모듈별 색을 포인트색 하나로')}
            ${row('카드 이모티콘', toggle('chat.regexIcons', s.chat.regexIcons), '끄면 카드 제목 앞 그림 없이 글자만')}
        </div>
        ${cap('대사 색상')}<div class="salty-group">
            ${row('프롬프트 색 그대로', toggle('chat.demInk', !!s.chat.demInk), '프롬프트가 칠한 대사 색을 테마 대사색 · 형광펜보다 먼저')}
            ${s.chat.demInk ? stack('색을 어디에', seg('chat.demInkMode', [['text', '글자 색'], ['marker', '형광펜 색']], 'text'), '형광펜 색: 글자는 테마 색 그대로 두고 띠만 프롬프트 색으로') : ''}
        </div>
        ${s.chat.demInk && s.chat.demInkMode === 'marker' && !['marker', 'full'].includes(s.dialogue.style) ? '<p class="salty-note">지금 대사 표시가 “' + ({ bold: '굵게', tint: '색', plain: '없음' }[s.dialogue.style] || s.dialogue.style) + '” 라 칠할 띠가 없어요. 글자 › 대사 › 표시를 형광펜이나 전체 칠로 바꾸면 띠에 색이 들어가요.</p>' : ''}
        ${cap('색 통일', '메시지에 적힌 글자색')}<div class="salty-group">
            ${row('본문 색 지정', toggle('chat.unifyInline', s.chat.unifyInline), '메시지에 적힌 글자색을 무시하고 테마 글자색으로')}
            ${s.chat.unifyInline ? '' : row('색 톤 맞추기', toggle('chat.toneInline', s.chat.toneInline), '색은 그대로 두고 채도 · 밝기만 테마에 맞춤 — 글자 색이든 형광펜 색이든')}
        </div>
        ${!s.chat.unifyInline && s.chat.toneInline ? `${cap('톤 값', PALETTES[s.palette]?.mode === 'dark' ? '지금은 나이트 값이 보여요' : '지금은 화이트 값이 보여요')}<div class="salty-group">
            ${s.chat.demInk && s.chat.demInkMode === 'marker' ? `
            ${slider('chat.markerTone.light.s', '화이트 형광펜 채도', 0, 100, 1)}
            ${slider('chat.markerTone.light.l', '화이트 형광펜 밝기', 10, 95, 1)}
            ${slider('chat.markerTone.dark.s', '나이트 형광펜 채도', 0, 100, 1)}
            ${slider('chat.markerTone.dark.l', '나이트 형광펜 밝기', 10, 95, 1)}` : `
            ${slider('chat.tone.light.s', '화이트 채도', 0, 100, 1)}
            ${slider('chat.tone.light.l', '화이트 밝기', 10, 90, 1)}
            ${slider('chat.tone.dark.s', '나이트 채도', 0, 100, 1)}
            ${slider('chat.tone.dark.l', '나이트 밝기', 10, 90, 1)}`}
        </div>` : ''}
        ${cap('대사 색상 가독성 향상', '프롬프트가 칠한 글자에만')}<div class="salty-group">
            ${row('외곽선', toggle('deus.ink.outline.on', dio.on), '글자 둘레에 테두리 — 밝은 색이 밝은 배경에 묻힐 때')}
            ${dio.on ? `<div class="salty-row"><span>외곽선 색</span><input type="color" data-color-path="deus.ink.outline.color" value="${esc(dio.color)}" aria-label="외곽선 색"></div>` : ''}
            ${dio.on ? slider('deus.ink.outline.width', '외곽선 두께', 0.2, 3, 0.1) : ''}
            ${dio.on ? slider('deus.ink.outline.alpha', '외곽선 진하기', 0, 100, 1) : ''}
            ${row('그림자', toggle('deus.ink.shadow.on', dis.on), '글자 뒤에 그림자 — 배경 그림 위에서 읽기 좋아져요')}
            ${dis.on ? `<div class="salty-row"><span>그림자 색</span><input type="color" data-color-path="deus.ink.shadow.color" value="${esc(dis.color)}" aria-label="그림자 색"></div>` : ''}
            ${dis.on ? slider('deus.ink.shadow.alpha', '그림자 투명도', 0, 100, 1) : ''}
            ${dis.on ? slider('deus.ink.shadow.angle', '그림자 각도', 0, 360, 1) : ''}
            ${dis.on ? slider('deus.ink.shadow.distance', '그림자 거리', 0, 12, 0.5) : ''}
            ${dis.on ? slider('deus.ink.shadow.blur', '그림자 퍼짐', 0, 24, 0.5) : ''}
        </div>
        <p class="salty-note">둘 다 켜도 되고 하나만 켜도 돼요. 프롬프트가 색칠하지 않은 보통 글자는 그대로예요.</p>
        ${cap('감정 대사 효과', 'Expressive Dialogue')}<div class="salty-group">
            ${row('효과 살리기', toggle('deus.fx.on', fx.on), '외침 · 떨림 같은 감정 대사가 눈에 보이게 움직여요')}
            ${fx.on ? stack('움직임', seg('deus.fx.motion', [['soft', '약하게'], ['normal', '보통'], ['big', '크게']], 'normal'), '약하게 = 프리셋 원래 크기') : ''}
            ${fx.on ? row('빛', toggle('deus.fx.glow', fx.glow), '외침 · 화남 · 울음 대사가 제 색으로 은은하게 빛나요') : ''}
            ${fx.on ? row('색 흐름', toggle('deus.fx.flow', fx.flow), '그 대사만 대사색 · 형광펜 대신 흐르는 색 글자로') : ''}
            ${fx.on && fx.flow ? stack('색 흐름을 어디에', seg('deus.fx.flowMode', [['text', '글자'], ['marker', '형광펜']], 'text'), '형광펜: 글자는 대사색 그대로 두고 띠에 색이 흘러요 (대사 표시가 형광펜 · 전체 칠일 때)') : ''}
            ${fx.on ? row('기기 설정 무시', toggle('deus.fx.force', fx.force), '기기가 애니메이션 줄이기 · 절전이어도 움직여요') : ''}
        </div>
        ${fx.on && !fx.force && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '<p class="salty-note">지금 이 기기는 애니메이션 줄이기 상태라 효과가 멈춰 있어요. 보려면 기기 설정 무시를 켜 주세요.</p>' : ''}
        ${cap('트래커')}<div class="salty-group">
            ${row('트래커 날씨로 날씨 효과', toggle('deus.weather', s.chat.weather === 'tracker'), '트래커 날씨가 비 · 눈이면 채팅 뒤에 내려요 · 세기 · 크기는 채팅 › 화면 › 날씨')}
        </div>`;
}

/** 날씨 효과 내 그림 (3.3.1): 저장한 그림 목록 + 고르기 · 저장 · 바꾸기 · 삭제 — 이미지 탭 커스텀 도형과 같은 모양 */
const WEATHER_IMAGE_SLOTS = 12;
let weatherReplaceId = '';
function weatherImageControls(s) {
    const current = s.chat.weatherImage;
    const saved = s.weatherImages.find(item => item.id === s.chat.weatherImageId) || null;
    const thumb = data => isDataImage(data) ? `<span class="salty-weather-thumb" style="background-image:url(&quot;${esc(data)}&quot;)" aria-hidden="true"></span>` : '<span class="salty-weather-thumb" aria-hidden="true"></span>'; // 5.3.4: 도형 thumb 와 같은 검사
    const library = s.weatherImages.length ? `<div class="salty-mask-lib" role="listbox" aria-label="저장한 그림">${s.weatherImages.map(item =>
        `<button type="button" class="salty-mask-item${item.id === s.chat.weatherImageId ? ' on' : ''}" data-act="wimg-use" data-id="${esc(item.id)}" aria-pressed="${item.id === s.chat.weatherImageId}">${thumb(item.data)}<small>${esc(item.name)}</small></button>`).join('')}</div>` : '';
    return `${library}
        <div class="salty-mask-row">
            ${current ? thumb(current) : '<span class="salty-weather-thumb" aria-hidden="true"></span>'}
            <div class="salty-btns">
                <button class="salty-btn" data-act="wimg-pick">${current ? '다른 그림 고르기' : '그림 고르기'}</button>
                ${current && !saved ? '<button class="salty-btn" data-act="wimg-save">저장</button>' : ''}
                ${saved ? `<button class="salty-btn" data-act="wimg-replace" data-id="${esc(saved.id)}">바꾸기</button><button class="salty-btn salty-btn-danger" data-act="wimg-delete" data-id="${esc(saved.id)}">삭제</button>` : ''}
            </div>
        </div>
        <input type="file" accept="${IMAGE_ACCEPT}" hidden data-file="weather">
        <p class="salty-note">배경이 투명한 그림이 잘 어울려요 (꽃잎 · 하트 · 별 …). 128px 로 줄여 저장돼요.</p>`;
}

/** 고른 그림 → 긴 변 128px PNG data URL (투명도 유지) */
async function readWeatherImage(file) {
    // 3.5.2 확장자를 가리지 않음 (imagedecode.js — HEIC · TIFF · PSD · RAW …)
    const img = await openImage(file);
    const max = 128;
    const scale = Math.min(1, max / Math.max(imageWidth(img) || 1, imageHeight(img) || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((imageWidth(img) || 1) * scale));
    canvas.height = Math.max(1, Math.round((imageHeight(img) || 1) * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close?.();
    return canvas.toDataURL('image/png');
}

/** 아무 이미지 파일 → 그릴 것. 변환기를 받아야 하는 형식은 알림 한 줄 */
async function openImage(file) {
    try {
        return await decodeAnyImage(file, {
            onSlow: kind => toastr.info(kind === 'heic' ? 'HEIC 사진을 바꾸는 중…' : '이 형식은 변환기로 여는 중… (처음 한 번만 약 15MB 받아요)', '', { timeOut: 3000 }),
        });
    } catch (error) {
        console.warn('[Blue Lemonade] 이미지를 못 읽음', error);
        throw new Error('이미지를 읽지 못했어요');
    }
}

/** 새 칸 이름: 커스텀 1, 2 … (지운 번호는 안 다시 씀) */
function nextMaskName(masks) {
    const used = masks.map(item => Number((/^커스텀 (\d+)$/.exec(item.name) || [])[1]) || 0);
    return `커스텀 ${Math.max(0, ...used) + 1}`;
}
// 흐림 단계: 강함이면 네 가장자리가 바탕에 녹아듦
const FADES = [['off', '끔'], ['soft', '약함'], ['medium', '중간'], ['strong', '강함']];

const SHAPES = [
    ['rect', '네모', '<svg viewBox="0 0 44 30" fill="currentColor" aria-hidden="true"><rect x="5" y="6" width="34" height="18" rx="2.5"/></svg>'],
    // 2.2.1: 대각선 · 코너 컷 · 스크래치는 뺌 (사용자: "네모랑 커스텀만 두자") — CSS · 저장 키는 남아 있고 예전 값은 settings.js 가 네모로 돌림
    ['custom', '커스텀', '<svg viewBox="0 0 44 30" fill="currentColor" aria-hidden="true"><path d="M22 4l4.6 8.4 9.4 1.6-6.6 6.9 1.4 9.4L22 26l-8.8 4.3 1.4-9.4L8 14l9.4-1.6Z"/></svg>'], // 내가 고른 투명 PNG 의 모양
];

function shapePicker(current) {
    return `<div class="salty-shapes">${SHAPES.map(([value, label, svg]) =>
        `<button type="button" aria-pressed="${current === value}" data-act="seg" data-path="image.shape" data-value="${value}" class="${current === value ? 'on' : ''}">${svg}<span>${label}</span></button>`).join('')}</div>`;
}

/**
 * 고른 도형 이미지 → 설정에 넣을 PNG data URL. 긴 변 512px 로 줄여 설정 파일이 무거워지지 않게 (마스크는 알파만 쓰니 충분).
 * 투명한 곳이 하나도 없으면(JPG 등) 오려질 데가 없어 알려 준다.
 */
async function readMaskImage(file) {
    // 3.5.2 확장자를 가리지 않음 — 투명도가 있는 형식이면 무엇이든 (PNG · WebP · GIF · AVIF · HEIC · TIFF · PSD · TGA · QOI · SVG …)
    const img = await openImage(file);
    const max = 512;
    const scale = Math.min(1, max / Math.max(imageWidth(img) || 1, imageHeight(img) || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((imageWidth(img) || 1) * scale));
    canvas.height = Math.max(1, Math.round((imageHeight(img) || 1) * scale));
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close?.();
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear++;
    if (clear === 0) throw new Error('투명한 부분이 없는 그림이에요. 배경이 투명한 그림을 골라 주세요');
    return canvas.toDataURL('image/png');
}

function tabImage(s, sub) {
    const light = PALETTES[s.palette]?.mode === 'light';
    const { layout, shape, fit } = s.image;
    if (sub === 'frame') return `${imagePreview(s, sub)}${frameControls('image', s.image)}`;
    // 모서리는 둥근 모서리가 보일 때만: 네모 · 아치 아래쪽 (가로 꽉이면 화면 끝까지라 모서리가 없음)
    const rounds = layout !== 'bleed' && shape === 'rect';
    if (sub === 'shape') {
        // 테두리는 네모 · 아치에만 (대각선 · 스크래치는 잘린 모양이라 사각 테가 남음)
        // 자동 색은 테두리를 켰을 때만 보여 준다 — '없음'에서는 뽑을 색이 쓰일 데가 없다 (apply.js 도 그때만 salty-edge-auto 를 붙임)
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${shapePicker(shape)}</div>
            ${shape === 'custom' ? maskControls(s) : ''}
            ${row('투명 그림도 똑같이', toggle('image.cutoutSame', s.image.cutoutSame), s.image.cutoutSame ? '배경 없는 캐릭터 컷에도 모양 · 흐림 · 테두리가 그대로 걸려요' : '캐릭터 컷은 자르지 않고 아래만 살짝 흐려요')}
            ${rounds ? slider('image.radius', '모서리', 0, 80, 1) : ''}

        </div>`;
    }
    if (sub === 'size') {
        // 비율 유지 = 최대 높이(더 짧은 그림은 그대로) · 높이 맞춤 = 모든 그림을 이 높이로 (둘 다 화면 높이 %, 범위는 settings.js IMAGE_RANGE)
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.fit', [['ratio', '비율 유지'], ['fixed', '높이 맞춤']])}</div>
            ${fit === 'fixed' ? slider('image.height', '높이', ...IMAGE_RANGE.height, 1) : slider('image.maxh', '최대 높이', ...IMAGE_RANGE.maxh, 1)}
        </div>`;
    }
    if (sub === 'fade') {
        return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.fade', FADES)}</div>
            ${s.image.fade !== 'off' ? slider('image.fadeY', '위아래', ...IMAGE_RANGE.fadeY, 1) : ''}
            ${s.image.fade !== 'off' ? slider('image.fadeX', '옆', ...IMAGE_RANGE.fadeX, 1) : ''}
            ${row('흰 배경 지우기', toggle('image.blendWhite', s.image.blendWhite), light ? '흰 배경이 종이색에 녹아들어요' : '밝은 테마에서만 돼요')}
        </div>`;
    }
    return `${imagePreview(s, sub)}<div class="salty-group">
            <div class="salty-stack">${seg('image.layout', [['bleed', '가로 꽉'], ['column', '본문 폭'], ['inset', '작게']])}</div>
        </div>`;
}

// ───────── 그리기 ─────────
// 5.3.7 다시 그리기 전후로 키보드 초점을 지킨다 — innerHTML 을 갈면 초점이 body 로 떨어져, 설정 하나 바꿀 때마다 Tab 이 처음부터였다.
// 같은 data-* 를 가진 새 요소를 찾아(colorpick.js sameAnchor 와 같은 방식) 초점 · 글자 커서 · 가로 스크롤을 되돌린다
const FOCUS_VOLATILE = new Set(['def', 'min', 'max', 'armed']);
function focusSnapshot(root) {
    const el = document.activeElement;
    if (!el || el === root || !root.contains(el)) return null;
    const entries = Object.entries(el.dataset || {}).filter(([key]) => !FOCUS_VOLATILE.has(key));
    const attrs = entries.map(([key, value]) => `[data-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${CSS.escape(value)}"]`).join('');
    const label = el.getAttribute('aria-label');
    const selector = el.tagName.toLowerCase() + (attrs || (el.id ? `#${CSS.escape(el.id)}` : label ? `[aria-label="${CSS.escape(label)}"]` : ''));
    if (selector === el.tagName.toLowerCase()) return null;
    let index = 0;
    try { index = Math.max(0, [...root.querySelectorAll(selector)].indexOf(el)); } catch { return null; }
    let caret = null;
    try { if (typeof el.selectionStart === 'number') caret = [el.selectionStart, el.selectionEnd, el.selectionDirection]; } catch { /* number · color 칸은 커서가 없다 */ }
    return { selector, index, caret, scrollLeft: el.scrollLeft };
}
function restoreFocus(root, snap) {
    if (!snap || (document.activeElement && document.activeElement !== document.body && !root.contains(document.activeElement))) return;
    let el = null;
    try { const list = root.querySelectorAll(snap.selector); el = list[snap.index] || list[0]; } catch { return; }
    if (!el || el.disabled || el.closest('[hidden],[inert]')) return;
    el.focus({ preventScroll: true });
    if (snap.caret) try { el.setSelectionRange(...snap.caret); } catch { /* 형식이 바뀐 칸 */ }
    if (snap.scrollLeft) el.scrollLeft = snap.scrollLeft;
}

function render(root) {
    const focusSnap = focusSnapshot(root);
    root._stopComparison?.();
    root._captureCleanup?.(); root._captureCleanup=null;
    root._addonCleanup?.(); root._addonCleanup=null;
    root._scriptsCleanup?.(); root._scriptsCleanup=null;
    root._healthCleanup?.();
    root._updateCleanup?.(); root._updateCleanup=null;
    const oldSection = root.querySelector('.salty-sec');
    if (oldSection && root._editorRoute) root._editorScroll?.set(root._editorRoute, oldSection.scrollTop);
    root._addonScroll ??= new Map();
    if (oldSection && root._editorRoute) root._addonScroll.set(root._editorRoute, [oldSection.querySelector(".bl-addon-main")?.scrollTop || 0, oldSection.querySelector(".bl-addon-config")?.scrollTop || 0]);
    root._fontIO?.disconnect(); root._fontIO = null;
    const s = getSettings();
    const issues = getIssues();
    root._issues = issues;
    const body = { theme: tabTheme, text: tabText, chat: tabChat, image: tabImage, prompt: tabPrompt, extensions: tabExtensions };
    if (!body[ui.tab]) ui.tab = 'theme';
    const sub = subOf(ui.tab);
    let section;
    try {
        section = body[ui.tab](s, sub);
    } catch (error) {
        console.error('[Blue Lemonade] Settings section failed', error);
        section = `<p class="salty-note" role="alert">이 항목을 표시하지 못했어요. 다른 탭으로 이동할 수 있으며 저장된 설정은 유지됩니다.</p><button type="button" class="salty-btn" data-act="tab" data-tab="theme">테마 설정으로 돌아가기</button>`;
    }
    const subLabel = SUBS[ui.tab]?.find(([id]) => id === sub)?.[1] || '직접 테마 만들기';
    const catalog = TABS.map(([tab, title]) => `<div class="bl-editor-category"><h4>${title}</h4>${(SUBS[tab] || []).map(([id, label]) => `<button type="button" data-act="editor-route" data-tab="${tab}" data-sub="${id}" aria-current="${ui.tab === tab && sub === id ? 'page' : 'false'}">${label}</button>`).join('')}</div>`).join('');
    // 서랍은 실리태번 머리에 이미 'Blue Lemonade' 가 있어서 켜기 한 줄만 (팝업은 머리가 없으니 제목을 그림)
    const head = root.classList.contains('in-popup')
        ? `<div class="salty-head">
            <div class="salty-mark">${MARK}</div>
            <div><div class="salty-title">Blue Lemonade${currentVersion() ? ` <button type="button" class="salty-ver${hasUnseenNotice() ? ' is-new' : ''}" data-act="notice" aria-label="공지사항">v${currentVersion()}</button>` : ''} <button type="button" class="bl-copyright" data-bl-credits aria-label="출처·라이선스" title="출처·라이선스">ⓒ</button></div><div class="salty-sub">읽기 편한 테마</div></div>
            <label class="salty-switch" title="블루레몬에이드 사용"><input type="checkbox" data-toggle="enabled" ${s.enabled ? 'checked' : ''}><span></span></label>
        </div>`
        : `<div class="salty-head salty-head-slim"><span>블루레몬에이드 사용</span>${toggle('enabled', s.enabled)}</div>`;
    root.innerHTML = `
        <div class="salty-nav"><div class="bl-settings-toprow">
            <button type="button" class="bl-editor-choose" data-act="editor-catalog" aria-label="설정 선택" aria-haspopup="dialog" aria-expanded="${!!root._catalogOpen}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg><span>${subLabel}</span></button>
            <div class="bl-editor-actions"><button type="button" data-compare aria-label="누르는 동안 설정 열기 전 모습 보기" title="누르는 동안 설정 열기 전 모습" aria-pressed="false">비교</button><button type="button" data-act="history-undo" aria-label="되돌리기" title="되돌리기" ${!history.pending && !history.undoStack.length ? 'disabled' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h8a5 5 0 0 1 0 10"/></svg></button><button type="button" data-act="history-redo" aria-label="다시 실행" title="앞으로 가기 · 다시 실행" ${history.pending || !history.redoStack.length ? 'disabled' : ''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m13 4 4 4-4 4m4-4H9a5 5 0 0 0 0 10"/></svg></button><button type="button" class="bl-editor-search-button" data-act="editor-search" aria-label="설정 검색"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></button><button type="button" class="bl-settings-expand" data-act="panel-fullscreen" aria-pressed="${!!root._fullscreen}">${root._fullscreen ? '작은 창' : '전체 화면'}</button>${root.classList.contains('in-popup') ? '<button type="button" class="bl-settings-close" data-act="panel-close" aria-label="테마 설정 닫기" title="닫기">×</button>' : ''}</div>
        </div></div>
        <section class="salty-sec" data-tab="${ui.tab}" data-sub="${sub}">${section}</section>
        <div class="bl-editor-catalog" role="dialog" aria-modal="true" aria-label="설정 선택 목록" ${root._catalogOpen ? '' : 'hidden'}>
            <button type="button" class="bl-editor-scrim" data-act="editor-catalog-close" aria-label="설정 선택 닫기"></button>
            <div class="bl-editor-directory"><div class="bl-editor-directory-head"><b>설정 선택</b><button type="button" data-act="editor-catalog-close" aria-label="설정 선택 닫기">×</button></div>${searchMarkup(root._settingsQuery || '')}<div class="bl-editor-directory-list">${catalog}${head}${s.activeStyle ? '<p class="salty-note">캐릭터 스타일 적용 중</p>' : ''}<div class="salty-checks">${issues.map((issue, i) => `<div class="salty-check"><span>${issue.text}</span>${issue.fix ? `<button class="salty-btn" data-act="fix" data-i="${i}">${issue.fix}</button>` : ''}</div>`).join('')}</div></div></div>
        </div>`;
    arrangeEditor(root, `${ui.tab}/${sub}`, subLabel);
    root.querySelector('.bl-editor-directory-list').insertAdjacentHTML('afterbegin',favoritesMarkup({tab:ui.tab,sub,title:subLabel}));
    root.querySelector('[data-usage-apply]')?.addEventListener('click',async(event)=>{
        const button=event.currentTarget, status=root.querySelector('[data-usage-status]');
        button.disabled=true;status.textContent='설정을 저장하고 있어요…';
        const previous=s.usageMode;s.usageMode=root.querySelector('[data-usage-mode]').value;
        try{await saveAddonsNow();location.reload();}catch(error){s.usageMode=previous;status.textContent=error.message;button.disabled=false;}
    });
    bindCustomBuilder(root);
    paintSettingsSearch(root);
    fillPreviews(root); // 미리보기 무대 다시 꽂기 (만들지 않고 옮겨 담기만)
    for(const stage of Object.values(root._pv || {}))if(!stage.isConnected)stage._blWeather?.destroy();
    typesetRoot(root);
    bindAddons(root, refreshPanels);
    bindThemeUpdate(root);
    bindHealth(root,applyAll);
    bindWordTools(root, refreshPanels);
    bindAddonLayout(root);
    bindPreviewViews(root, `${ui.tab}/${ui.subs[ui.tab]}`);
    syncSamples(s); // 미리보기 문단 클래스 맞추기
    installSettingResets(root);
    // Preview sizing changes the available scroll height; restore after it is measured.
    root.querySelector('.salty-sec').scrollTop = root._editorScroll.get(root._editorRoute) || 0;
    const paneScroll = root._addonScroll.get(root._editorRoute) || [0, 0];
    [".bl-addon-main", ".bl-addon-config"].forEach((selector, i) => { const pane = root.querySelector(selector); if (pane) pane.scrollTop = paneScroll[i]; });
    restoreFocus(root, focusSnap);

    // 색 고르기: 처음 그릴 때 나는 change 는 무시하고, 사용자가 만진 뒤부터 저장
    bindGradientColors(root,getSettings,update);
    // 끌 때마다 나는 change 는 색 하나당 한 단계로 묶고, 칸을 새로 누르면 앞 단계를 닫는다 (되돌리기 기록이 안 넘치게)
    root.querySelectorAll('toolcool-color-picker[data-token]').forEach((picker) => {
        const arm = () => { picker._armed = true; history.flush(getSettings()); syncHistoryButtons(); };
        picker.addEventListener('pointerdown', arm);
        picker.addEventListener('keydown', arm);
        picker.addEventListener('change', (event) => {
            if (!picker._armed) return;
            const value = event.detail?.rgba || picker.color;
            if (!value) return;
            picker.closest('.salty-color')?.classList.toggle('clear', parseColor(value)[3] < 0.1);
            update((st) => {
                const token = picker.dataset.token;
                if (sameColor(value, paletteColors(st)[token])) return;
                st.colorOverrides[st.palette] = { ...(st.colorOverrides[st.palette] || {}), [token]: value };
            }, false, `color:${picker.dataset.token}`);
        });
    });

    // 글꼴 묶음 태그 줄: 밀면 끝 흐림, 고른 칩은 보이게 (팝업·접힌 서랍은 화면에 붙기 전에 그려지니 폭이 생길 때 다시)
    //   소분류 칩은 줄이 넘치면 다음 줄로 내려가니 여기 없음
    root._rowsRO?.disconnect();
    const fontTags = root.querySelectorAll('.salty-fonttags');
    root._rowsRO = fontTags.length ? new ResizeObserver(entries => entries.forEach(e => showTag(e.target))) : null;
    fontTags.forEach((chips) => {
        chips.addEventListener('scroll', () => fadeTags(chips), { passive: true });
        root._rowsRO.observe(chips);
    });

    // 글꼴 목록: 보이는 항목의 미리보기만 불러오기
    const list = root.querySelector('.salty-fontscroll');
    if (list) {
        const io = root._fontIO = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue;
                queuePreview(findFont(e.target.dataset.preview));
                io.unobserve(e.target);
            }
        }, { root: list, rootMargin: '120px 0px' });
        list.querySelectorAll('[data-preview]').forEach(el => io.observe(el));
        filterFonts(root);
    }
}

// 검색어 + 태그로 거르기. 태그 숫자는 검색어에 맞는 개수, 한 묶음만 볼 땐 묶음 제목 숨김
function filterFonts(root) {
    const list = root.querySelector('.salty-fontlist');
    if (!list) return;
    const q = ui.query.trim().toLowerCase();
    const one = ui.fontTag !== 'all';
    const counts = { all: 0 };
    let shown = 0;
    list.querySelectorAll('.salty-fontgroup').forEach((group) => {
        let n = 0;
        group.querySelectorAll('.salty-fontitem').forEach((item) => {
            const hit = !q || item.querySelector('b').textContent.toLowerCase().includes(q);
            item.hidden = !hit;
            if (hit) n++;
        });
        group.querySelector('h5 span').textContent = n;
        counts[group.dataset.group] = n;
        counts.all += n;
        group.hidden = !n || (one && group.dataset.group !== ui.fontTag);
        if (!group.hidden) shown += n;
    });
    list.classList.toggle('one', one);
    list.querySelectorAll('.salty-fonttags [data-act="fonttag"]').forEach((tag) => {
        const n = counts[tag.dataset.tag] || 0;
        tag.classList.toggle('on', tag.dataset.tag === ui.fontTag);
        tag.classList.toggle('none', !n);
        tag.lastElementChild.textContent = n;
    });
    // 빈 목록: 다른 묶음에만 맞으면 그렇다고 하고 전체로 가는 태그
    const empty = list.querySelector('.salty-fontempty');
    if (empty) {
        const elsewhere = !shown && counts.all > 0;
        empty.hidden = shown > 0;
        empty.firstElementChild.textContent = elsewhere ? '이 묶음엔 없어요' : '그런 이름의 글꼴이 없어요';
        empty.lastElementChild.hidden = !elsewhere;
        empty.lastElementChild.lastElementChild.textContent = counts.all;
    }
    const tags = list.querySelector('.salty-fonttags');
    if (tags) showTag(tags);
}

// 칩 줄 양 끝 흐림: 더 밀 수 있는 쪽만, 남은 거리만큼 (최대 FADE). 넘치지 않으면 흐림 자체를 끔
const FADE = 28;
function fadeTags(row) {
    const rest = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('over', row.scrollWidth > row.clientWidth + 1);
    row.style.setProperty('--salty-fade-l', `${Math.max(0, Math.min(FADE, row.scrollLeft))}px`);
    row.style.setProperty('--salty-fade-r', `${Math.max(0, Math.min(FADE, rest))}px`);
}

// 고른 칩이 줄 밖이나 흐린 끝에 있으면 보이게 (아직 폭이 0이면 건너뜀 → ResizeObserver 가 다시 부름)
function showTag(row) {
    if (!row.clientWidth) return;
    const on = row.querySelector('.on');
    if (on) row.scrollLeft = Math.min(Math.max(row.scrollLeft, on.offsetLeft + on.offsetWidth + FADE - row.clientWidth), on.offsetLeft - FADE);
    fadeTags(row);
}

// 글꼴 목록을 스크롤하는 칸. 목록은 이제 창과 같이 흐르므로(스크롤바 하나) 보통 바깥 칸이 나옴 —
// 예전처럼 안쪽에 스크롤이 생긴 경우(좁은 화면 등)에는 그 안쪽 칸을 그대로 씀
function fontBox(root) {
    const inner = root.querySelector('.salty-fontscroll');
    if (!inner) return null;
    if (inner.scrollHeight > inner.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(inner).overflowY)) return inner;
    return scrollBox(inner);
}

// 창을 담고 있는 스크롤 칸 (팝업 본문 · 확장 서랍)
function scrollBox(el) {
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
        if (box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY)) return box;
    }
    return null;
}

// 탭·칩을 누른 뒤: 새 묶음 첫 줄이 붙어 있는 탭 줄 바로 아래로 (위로만 끌어올림 — 이미 보이면 그대로)
function showSec(root) {
    const nav = root.querySelector('.salty-nav');
    const sec = root.querySelector('.salty-sec');
    const box = scrollBox(root);
    if (!nav || !sec || !box) return;
    const top = sec.getBoundingClientRect().top - box.getBoundingClientRect().top - nav.offsetHeight;
    if (top < 0) box.scrollTop += top;
}

// 태그·검색어만 바뀔 땐 다시 그리지 않고 열린 목록들만 거르기 (가로 스크롤·입력 중인 칸 그대로)
function syncFontLists() {
    for (const root of panels) {
        if (!root.isConnected) continue;
        const input = root.querySelector('input[data-search="font"]');
        if (input && input !== document.activeElement) input.value = ui.query;
        filterFonts(root);
        const box = fontBox(root);
        const inner = root.querySelector('.salty-fontscroll');
        if (box && box === inner) box.scrollTop = 0;
        else if (box) {
            // 바깥이 스크롤되는 경우 창 전체가 맨 위로 튀면 안 됨 → 목록 머리를 탭 줄 밑으로만
            const list = root.querySelector('.salty-fontlist');
            const navH = root.querySelector('.salty-nav')?.offsetHeight || 0;
            if (list) {
                const top = list.getBoundingClientRect().top - box.getBoundingClientRect().top - navH;
                if (top < 0) box.scrollTop += top;
            }
        }
    }
}

// 글꼴을 골라 창을 다시 그려도 목록 스크롤 자리는 그대로
function keepFontScroll(fn) {
    const tops = new Map([...panels].map(root => [root, [fontBox(root), fontBox(root)?.scrollTop || 0]]));
    fn();
    tops.forEach(([box, top]) => {
        if (box?.isConnected) box.scrollTop = top;
    });
}

// 고른 글꼴이 목록 가운데 보이게 (찾기를 풀어 목록이 다시 길어졌을 때)
function showPickedFont() {
    for (const root of panels) {
        const scroll = fontBox(root);
        const item = root.querySelector('.salty-fontitem.on');
        if (!item || !scroll?.clientHeight) continue;
        scroll.scrollTop += item.getBoundingClientRect().top - scroll.getBoundingClientRect().top - (scroll.clientHeight - item.offsetHeight) / 2;
    }
}

// ───────── 이벤트 ─────────
async function ask(message, value = '') {
    const ctx = SillyTavern.getContext();
    if (ctx.callGenericPopup && ctx.POPUP_TYPE) {
        const result = await ctx.callGenericPopup(message, ctx.POPUP_TYPE.INPUT, value);
        return typeof result === 'string' ? result : null;
    }
    return prompt(message, value);
}

function pickFont(font) {
    const { slot, lang } = ui.picker || { slot: 'text', lang: 'ko' };
    ui.fontTag = font.group || 'all'; // 새로 넣은 글꼴이 목록에 보이게
    ui.query = '';
    update((st) => {
        if (!isSet(st.fonts[slot])) st.fonts[slot] = { ...FONT_SET };
        st.fonts[slot][lang] = font.id;
    });
    toastr.success(`${font.label} 글꼴을 쓸게요`, 'Blue Lemonade');
}

function bind(root) {
    root.addEventListener('change', () => queueMicrotask(() => { history.flush(getSettings()); syncHistoryButtons(); }));
    root.addEventListener('click', async (event) => {
        const el = event.target.closest('[data-act]');
        if (!el || !root.contains(el)) return;
        event.preventDefault();
        event.stopPropagation();
        const { act } = el.dataset;
        try {
            switch (act) {
                case 'readability-fix':
                    update(st=>{rememberAppearance(st,'가독성 보정 전');fixReadability(st,el.dataset.key);});
                    break;
                case 'appearance-restore':
                    update(st=>restoreAppearance(st,el.dataset.id));
                    toastr.success('보관한 모습으로 복구했어요.', 'Blue Lemonade');
                    break;
                case 'setting-jump': jumpToSetting(root, el.dataset.setting); break;
                case 'setting-reset': {
                    const path = el.dataset.setting, settings = getSettings();
                    if (!settingChanged(settings,path)) break;
                    const before = historyValue(getPath(settings,path),path);
                    update(st => { resetSetting(st,path); if (/^(image|profile|userProfile)\.decor\./.test(path)) refreshPreset(st[path.split('.')[0]].decor); });
                    toastr.info(`${esc(historyLabel(path))}: ${esc(before)} → ${esc(historyValue(getPath(getSettings(),path),path))}`, '기본값으로 복원했어요', {escapeHtml:false});
                    break;
                }
                case 'history-undo': stepHistory(false); break;
                case 'history-redo': stepHistory(true); break;
                case 'editor-catalog': openEditorCatalog(root, true); break;
                case 'editor-search': openEditorCatalog(root, true, true); break;
                case 'editor-catalog-close': openEditorCatalog(root, false); break;
                case 'editor-group': selectEditorGroup(root, el.closest('.bl-editor-group'), true); break;
                case 'editor-route':
                    ui.tab = el.dataset.tab; ui.subs[ui.tab] = el.dataset.sub; ui.picker = null;
                    root._catalogOpen = false; store('salty_tab', ui.tab); store('salty_subs', JSON.stringify(ui.subs));
                    refreshPanels(); root.querySelector('.salty-sec').scrollTop = 0;
                    root.querySelector('[data-act="editor-catalog"]')?.focus({ preventScroll: true });
                    break;
                case 'panel-close':
                    root._onClose?.();
                    break;
                case 'panel-fullscreen':
                    if (root.classList.contains('in-popup')) setPanelFullscreen(root, !root._fullscreen);
                    else root._onFullscreen?.();
                    break;
                case 'notice': // 3.0.0 제목 옆 버전 알약 → 공지사항 (열면 본 것으로 적고 알약들을 보통 모양으로)
                    await openNotice(noticeSeenChanged);
                    break;
                case 'tab':
                    ui.tab = el.dataset.tab;
                    ui.picker = null;

                    store('salty_tab', ui.tab);
                    refreshPanels();
                    showSec(root);
                    break;
                case 'pvfold': // 미리보기(예시) 접기 · 펴기 — 서랍 · 팝업 · 탭 모두 같이
                    ui.pvFold = !ui.pvFold;
                    store('salty_pvfold', ui.pvFold ? '1' : '0');
                    refreshPanels();
                    break;
                case 'frame-preset':
                    update(st => { st[el.dataset.owner].decor = presetFrame(el.dataset.id); });
                    break;
                case 'frame-save':
                    update(st => saveFrame(st, el.dataset.owner, root.querySelector(`[data-frame-name="${el.dataset.owner}"]`)?.value));
                    break;
                case 'frame-use':
                    update(st => useFrame(st, el.dataset.owner, el.dataset.id));
                    break;
                case 'frame-rename': {
                    const name = root.querySelector(`[data-frame-name="${el.dataset.owner}"]`)?.value.trim();
                    if (name) update(st => { const item = st.frameLibrary.find(x => x.id === el.dataset.id); if (item) item.name = name.slice(0, 40); });
                    break;
                }
                case 'frame-delete':
                    update(st => deleteFrame(st, el.dataset.id));
                    break;
                case 'frame-upload':
                    root.querySelector(`[data-frame-file="${el.dataset.owner}"]`)?.click();
                    break;
                case 'frame-remove':
                    update(st => { st[el.dataset.owner].decor = { on: false, art: '', mask: '' }; });
                    break;
                case 'palette':
                    update(st => { st.palette = paletteVariant(el.dataset.family, PALETTES[st.palette]?.mode); });
                    break;
                case 'palette-mode':
                    // 해 · 달을 직접 누르면 자동은 끈다 (3.2.0)
                    update(st => { st.palette = paletteVariant(paletteFamily(st.palette), el.dataset.mode); if (st.auto) st.auto.on = false; });
                    break;
                case 'palette-auto':
                    update(st => { st.auto.on = !st.auto.on; });
                    break;
                case 'custom-keep':
                    update(st => { newCustomPalette(st, PALETTES[st.palette]?.mode); saveCustomPalette(st); });
                    break;
                case 'custom-use':
                    update(st => useCustomPalette(st,el.dataset.id));
                    break;
                case 'custom-delete':
                    update(st => { st.customPalettes=st.customPalettes.filter(item=>item.id!==el.dataset.id); if(st.activeCustomPalette===el.dataset.id)st.activeCustomPalette=''; });
                    break;
                case 'custom-library-edit':
                    update(st => useCustomPalette(st,el.dataset.id));
                    openCustomBuilder(getSettings(),PALETTES[getSettings().palette]?.mode);
                    ui.subs.theme='custom'; refreshPanels(); break;
                case 'custom-new':
                    newCustomPalette(getSettings(), PALETTES[getSettings().palette]?.mode);
                    ui.subs.theme='custom'; refreshPanels(); break;
                case 'custom-open':
                    openCustomBuilder(getSettings(), PALETTES[getSettings().palette]?.mode);
                    ui.subs.theme = 'custom';
                    ui.tab = 'theme';
                    store('salty_tab', ui.tab);
                    refreshPanels();
                    showSec(root);
                    break;
                case 'custom-mode':
                    setCustomMode(el.dataset.mode);
                    refreshPanels();
                    break;
                case 'custom-seed':
                    seedCustom(el.dataset.family);
                    refreshPanels();
                    break;
                case 'custom-save':
                    ui.subs.theme = 'palette';
                    update(saveCustomPalette);
                    break;
                case 'custom-back':
                    ui.subs.theme = 'palette';
                    refreshPanels();
                    break;
                case 'mix-toggle': case 'mix-family': case 'gradient-mode': case 'gradient-count':
                    update(st=>gradientAction(el.dataset.act,el,st));
                    break;
                case 'reset-colors':
                    update((st) => { delete st.colorOverrides[st.palette]; delete st.gradients.overrides[st.palette]; });
                    break;
                case 'seg': {
                    // 테두리와 흐림은 원리상 양립 불가: 흐림 마스크가 box-shadow(테두리)까지 지운다.
                    // 그래서 테두리를 고르면 흐림을 끄고, 흐림을 켜면 테두리를 없앤다 — 고른 것이 바로 보이게.
                    if (el.dataset.path === 'image.fade') {
                        // 단계는 빠른 고르기 · 슬라이더는 미세 조정 — 단계를 고르면 그 단계 값으로 슬라이더를 채운다
                        const [fy, fx] = FADE_AMOUNT[el.dataset.value] || FADE_AMOUNT.off;
                        update(st => {
                            setPath(st, 'image.fade', el.dataset.value);
                            if (el.dataset.value !== 'off') { st.image.fadeY = fy; st.image.fadeX = fx; }

                        });
                        break;
                    }
                    const { path, value } = el.dataset;
                    const current = getPath(getSettings(), path);
                    if (String(current) === value) break;
                    update(st => setPath(st, path, typeof current === 'number' ? Number(value) : value));
                    break;
                }
                case 'weather-spot-place': {
                    // 설정 창을 닫고 실제 채팅 화면 위에서 점을 끌게 한다. '완료'를 누르면 설정 창이 다시 열린다
                    const mode = weatherMode(getSettings()), count = mode === 'shadow' ? Math.max(1, Number(getSettings().chat.weatherLevel) || 2) : 1;
                    const weather = await import('./weather.js');
                    root.querySelector('[data-act="panel-close"]')?.click();
                    weather.placeWeatherSpots(mode, SPOT_DEFAULTS[mode].slice(0, count), () => window.Salty?.openPopup?.());
                    break;
                }
                case 'weather-spot-reset': { const mode = weatherMode(getSettings()); update((st) => { const spots = { ...(st.chat.weatherSpots || {}) }; delete spots[mode]; st.chat.weatherSpots = spots; }); break; }
                case 'weather-skip-fold': ui.weatherSkipOpen = !ui.weatherSkipOpen; refreshPanels(); break;
                case 'weather-skip': {
                    const mode = el.dataset.value;
                    update((st) => { const list = st.chat.weatherTrackerSkip || []; st.chat.weatherTrackerSkip = list.includes(mode) ? list.filter(item => item !== mode) : [...list, mode]; });
                    break;
                }
                case 'weather-cat': ui.weatherCat = el.dataset.cat; refreshPanels(); break;
                case 'weather-slot': ui.weatherSlot = el.dataset.slot === '2' ? 2 : 1; ui.weatherCat = ''; refreshPanels(); break;
                case 'weather-mix': {
                    // 켜면 둘째 칸으로 가서 바로 고르게 하고, 끄면 둘째 날씨를 없앤다
                    if (weatherMixing(getSettings())) { ui.weatherMix = false; ui.weatherSlot = 1; ui.weatherCat = ''; if (getSettings().chat.weather2 !== 'off') update(st => setPath(st, 'chat.weather2', 'off')); else refreshPanels(); }
                    else { ui.weatherMix = true; ui.weatherSlot = 2; ui.weatherCat = ''; refreshPanels(); }
                    break;
                }
                case 'pvkind': {
                    ui.previewKind = el.dataset.kind === 'cut' ? 'cut' : 'photo';
                    refreshPanels();
                    break;
                }
                case 'pvpic': {
                    // 표본 넘기기 — 설정이 아니라 보기 상태라 저장하지 않는다 (창을 닫으면 첫 장으로)
                    ui.pic = (ui.pic + Number(el.dataset.step) + PHOTOS.length) % PHOTOS.length;
                    refreshPanels();
                    break;
                }
                case 'mes-pin': {
                    const { key } = el.dataset;
                    update((st) => {
                        const pins = st.chat.mesPins || [];
                        if (pins.includes(key)) st.chat.mesPins = pins.filter(k => k !== key);
                        else if (pins.length >= PIN_LIMIT) toastr.warning(`버튼은 ${PIN_LIMIT}개까지 꺼내 둘 수 있어요.`, 'Blue Lemonade');
                        else st.chat.mesPins = [...pins, key];
                    });
                    break;
                }
                case 'chip': {
                    // 테두리를 그릴 면 켜고 끄기 — 마지막 한 면까지 끄는 것도 허용한다 (테두리 자체를 '없음'으로 두는 것과 같음)
                    const { path } = el.dataset;
                    update(st => setPath(st, path, !getPath(st, path)));
                    break;
                }
                case 'size': {
                    // '본문과 같게' · '기본' = 값 없음(null) · '직접' = 지금 크기부터
                    const { path, value } = el.dataset;
                    const current = getPath(getSettings(), path);
                    if (value === 'same') {
                        if (current !== null) update(st => setPath(st, path, null));
                        break;
                    }
                    if (isNum(current)) break;
                    const min = Number(el.dataset.min);
                    const max = Number(el.dataset.max);
                    // '직접' 의 출발값: 크기는 본문 크기(메뉴는 실리태번 배율), 자간은 본문 자간, 굵기는 보통(400)
                    const start = path.endsWith('letterSpacing') ? getSettings().type.letterSpacing
                        : path.endsWith('weight') ? 400
                            : path === 'type.uiSize' ? stUiSize() : getSettings().type.size;
                    const n = Number(start); // 본문 자간 0 도 그대로 출발값 (|| 로 쓰면 0 이 최소값이 됨)
                    update(st => setPath(st, path, Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))));
                    break;
                }
                case 'picker': {
                    const { slot, lang } = el.dataset;
                    ui.picker = ui.picker?.slot === slot && ui.picker?.lang === lang ? null : { slot, lang };
                    ui.query = '';
                    if (ui.picker) ui.fontTag = defaultTag(lang, getSettings().fonts[slot]?.[lang]);
                    refreshPanels();
                    break;
                }
                case 'fonttag':
                    ui.fontTag = el.dataset.tag;
                    syncFontLists();
                    break;
                case 'font': {
                    const { slot, lang } = ui.picker || { slot: 'text', lang: 'ko' };
                    const { id } = el.dataset;
                    const choose = () => update((st) => {
                        if (!isSet(st.fonts[slot])) st.fonts[slot] = { ...FONT_SET };
                        st.fonts[slot][lang] = id;
                    });
                    if (!ui.query.trim()) {
                        keepFontScroll(choose);
                        break;
                    }
                    // 찾기로 골랐으면 찾기를 풀고 고른 글꼴의 묶음으로 (안 풀면 다시 고를 때 목록에 방금 고른 글꼴만 남음)
                    ui.query = '';
                    ui.fontTag = defaultTag(lang, id);
                    choose();
                    showPickedFont();
                    break;
                }
                case 'rmfont':
                    if (!confirm('이 글꼴을 목록에서 지울까요?')) return;
                    await removeCustomFont(el.dataset.id);
                    applyAll();
                    refreshPanels();
                    break;
                case 'add-google': {
                    const name = await ask('구글 폰트 이름 (fonts.google.com 에 적힌 그대로)\n예: Gowun Batang, Nanum Gothic, Diphylleia');
                    if (!name) return;
                    pickFont(await addGoogleFont(name));
                    break;
                }
                case 'add-css': {
                    const url = await ask('글꼴 CSS 주소 (https://…)');
                    if (!url) return;
                    const family = await ask('그 CSS 안의 font-family 이름');
                    if (!family) return;
                    const added = await addCssFont(url, family);
                    pickFont(added);
                    if (added.cors === false) toastr.info('이 주소는 글꼴을 언어별로 나눌 수 없어요. 한국어 칸에서 고르면 모든 글자에 쓰여요.', 'Blue Lemonade');
                    break;
                }
                case 'add-file':
                    root.querySelector('input[data-file="font"]')?.click();
                    break;
                case 'mask-pick':
                    maskReplaceId = '';
                    root.querySelector('input[data-file="mask"]')?.click();
                    break;
                case 'mask-replace':
                    maskReplaceId = el.dataset.id;
                    root.querySelector('input[data-file="mask"]')?.click();
                    break;
                case 'mask-clear':
                    update(st => { st.image.mask = ''; st.image.maskId = ''; st.image.shape = 'rect'; });
                    break;
                case 'mask-save':
                    update(st => {
                        if (!st.image.mask) return;
                        if (st.image.masks.length >= MASK_SLOTS) { toastr.warning(`도형은 ${MASK_SLOTS}개까지 저장할 수 있어요. 안 쓰는 것을 지워 주세요.`, 'Blue Lemonade'); return; }
                        const item = { id: `m${Date.now().toString(36)}`, name: nextMaskName(st.image.masks), data: st.image.mask };
                        st.image.masks.push(item);
                        st.image.maskId = item.id;
                    });
                    break;
                case 'mask-use':
                    update(st => {
                        const item = st.image.masks.find(x => x.id === el.dataset.id);
                        if (!item) return;
                        st.image.mask = item.data;
                        st.image.maskId = item.id;
                        st.image.shape = 'custom';
                    });
                    break;
                case 'mask-delete': {
                    const item = getSettings().image.masks.find(x => x.id === el.dataset.id);
                    if (!item || !confirm(`${item.name}을(를) 지울까요?`)) return;
                    update(st => {
                        st.image.masks = st.image.masks.filter(x => x.id !== item.id);
                        if (st.image.maskId === item.id) { st.image.maskId = ''; st.image.mask = ''; }
                    });
                    break;
                }
                case 'fix':
                    await root._issues?.[Number(el.dataset.i)]?.run();
                    setTimeout(refreshPanels, 400);
                    break;
                case 'preset-export': {
                    const selected = await askPresetGroups(); if (!selected) break;
                    const payload = capturePreset(getSettings(), selected);
                    const a = document.createElement('a');a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
                    a.download = `blue-lemonade-preset-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
                    break;
                }
                case 'preset-import':
                    root.querySelector('input[data-file="preset"]')?.click();
                    break;
                case 'export': {
                    const blob = new Blob([JSON.stringify({ saltySettings: true, version: 2, settings: getSettings() }, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `blue-lemonade-settings-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    break;
                }
                case 'import':
                    root.querySelector('input[data-file="settings"]')?.click();
                    break;
                case 'st-theme': {
                    // 실리태번 쪽 값(흐림 · 그림자 · 말풍선 모양 · 글자 배율)을 이 테마에 맞추고, 같은 값을 테마 파일로도 남긴다
                    const changed = applySillyTavernTheme();
                    const name = `Blue Lemonade · ${PALETTES[getSettings().palette]?.label || '테마'}`;
                    try {
                        await saveAsSillyTavernTheme(name);
                        toastr.success(changed ? `${changed}개를 맞추고 "${name}" 테마로 저장했어요.` : `이미 맞춰져 있어요. "${name}" 테마로 저장했어요.`, 'Blue Lemonade');
                    } catch (error) {
                        toastr.warning(`설정은 맞췄지만 테마 파일로는 못 남겼어요: ${error.message}`, 'Blue Lemonade');
                    }
                    refreshPanels();
                    break;
                }
                case 'wimg-pick':
                    weatherReplaceId = '';
                    root.querySelector('input[data-file="weather"]')?.click();
                    break;
                case 'wimg-replace':
                    weatherReplaceId = el.dataset.id;
                    root.querySelector('input[data-file="weather"]')?.click();
                    break;
                case 'wimg-save':
                    update((st) => {
                        if (!st.chat.weatherImage) return;
                        if (st.weatherImages.length >= WEATHER_IMAGE_SLOTS) { toastr.warning(`그림은 ${WEATHER_IMAGE_SLOTS}개까지 저장할 수 있어요`, 'Blue Lemonade'); return; }
                        const used = st.weatherImages.map(item => Number((/^그림 (\d+)$/.exec(item.name) || [])[1]) || 0);
                        const item = { id: `w${Date.now().toString(36)}`, name: `그림 ${Math.max(0, ...used) + 1}`, data: st.chat.weatherImage };
                        st.weatherImages.push(item);
                        st.chat.weatherImageId = item.id;
                    });
                    break;
                case 'wimg-use':
                    update((st) => {
                        const item = st.weatherImages.find(x => x.id === el.dataset.id);
                        if (!item) return;
                        st.chat.weatherImage = item.data;
                        st.chat.weatherImageId = item.id;
                        st.chat.weather = 'custom';
                    });
                    break;
                case 'wimg-delete': {
                    const item = getSettings().weatherImages.find(x => x.id === el.dataset.id);
                    if (!item || !confirm(`${item.name}을(를) 지울까요?`)) return;
                    update((st) => {
                        st.weatherImages = st.weatherImages.filter(x => x.id !== item.id);
                        if (st.chat.weatherImageId === item.id) { st.chat.weatherImageId = ''; st.chat.weatherImage = ''; }
                    });
                    break;
                }
                case 'style-preset': {
                    const preset = PRESETS.find(x => x.id === el.dataset.id);
                    if (preset) wearStyle(preset.data(), preset.name);
                    break;
                }
                case 'style-apply': {
                    const style = getSettings().styles.find(x => x.id === el.dataset.id);
                    if (style) wearStyle(style.data, style.name);
                    break;
                }
                case 'style-undo':
                    if (!ui.styleUndo) break;
                    update(st => applyStyleData(st, ui.styleUndo));
                    ui.styleUndo = null;
                    refreshPanels();
                    break;
                case 'style-menu':
                    ui.styleMenu = ui.styleMenu === el.dataset.id ? '' : el.dataset.id;
                    refreshPanels();
                    break;
                case 'style-save': {
                    const s0 = getSettings();
                    if (s0.styles.length >= MAX_STYLES) { toastr.warning(`스타일은 ${MAX_STYLES}개까지예요. 안 쓰는 것을 지워 주세요`, 'Blue Lemonade'); break; }
                    const name = await ask('스타일 이름', uniqueName(`스타일 ${s0.styles.length + 1}`, s0.styles));
                    if (name === null || !String(name).trim()) break;
                    update(st => { st.styles.push({ id: newStyleId(), name: uniqueName(name, st.styles), data: captureStyle(st) }); });
                    break;
                }
                case 'style-overwrite':
                    update((st) => {
                        const style = st.styles.find(x => x.id === el.dataset.id);
                        if (style) style.data = captureStyle(st);
                    });
                    toastr.success('지금 모습으로 바꿔 저장했어요', 'Blue Lemonade');
                    break;
                case 'style-rename': {
                    const style = getSettings().styles.find(x => x.id === el.dataset.id);
                    if (!style) break;
                    const name = await ask('새 이름', style.name);
                    if (name === null || !String(name).trim()) break;
                    update((st) => { const target = st.styles.find(x => x.id === style.id); if (target) target.name = uniqueName(name, st.styles, style.id); });
                    break;
                }
                case 'diag-copy': {
                    const text = await buildDiagnosis();
                    if (await copyText(text)) toastr.success('진단을 복사했어요. 제보 글에 붙여 넣으면 돼요', 'Blue Lemonade');
                    else toastr.info(esc(text).replace(/\n/g, '<br>'), '진단 (직접 복사)', { escapeHtml: false, timeOut: 20000, extendedTimeOut: 20000 });
                    break;
                }
                case 'splash-copy': {
                    if (await copyText(SPLASH_COMMAND)) toastr.success(`Termux 에 붙여 넣고 실리태번을 다시 켜 주세요. PC 는 data/_css/user.css 맨 위에 ${SPLASH_IMPORT}`, 'Blue Lemonade', { timeOut: 9000 });
                    break;
                }
                case 'style-copy': {
                    const style = getSettings().styles.find(x => x.id === el.dataset.id);
                    if (!style) break;
                    const code = await encodeStyle(sharePayload(style.name, style.data));
                    if (await copyText(code)) toastr.success(`${style.name} 코드를 복사했어요 (${code.length.toLocaleString()}자)`, 'Blue Lemonade');
                    break;
                }
                case 'style-file': {
                    const style = getSettings().styles.find(x => x.id === el.dataset.id);
                    if (!style) break;
                    const blob = new Blob([JSON.stringify(sharePayload(style.name, style.data), null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `blue-lemonade-style-${style.name.replace(/[\\/:*?"<>|\s]+/g, '-')}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                    break;
                }
                case 'style-delete': {
                    const style = getSettings().styles.find(x => x.id === el.dataset.id);
                    if (!style || !confirm(`${style.name} 스타일을 지울까요?`)) return;
                    const linkedOrActive = Object.values(getSettings().charStyles).includes(style.id) || getSettings().activeStyle?.id === style.id;
                    if (linkedOrActive) (await charStyleModule())?.styleRemoved(style.id);
                    update((st) => { st.styles = st.styles.filter(x => x.id !== style.id); });
                    ui.styleMenu = '';
                    break;
                }
                case 'style-import-code': {
                    const code = await ask('스타일 코드를 붙여 넣어 주세요');
                    if (!code) break;
                    addReceivedStyle(await decodeStyle(code));
                    break;
                }
                case 'style-import-file':
                    root.querySelector('input[data-file="style"]')?.click();
                    break;
                case 'char-style': {
                    const key = currentKey();
                    if (!key) break;
                    const id = el.dataset.id;
                    update((st) => { if (id) st.charStyles[key] = id; else delete st.charStyles[key]; });
                    (await charStyleModule())?.syncChat();
                    refreshPanels();
                    break;
                }
                case 'char-unlink': {
                    const key = el.dataset.key;
                    update((st) => { delete st.charStyles[key]; });
                    (await charStyleModule())?.syncChat();
                    refreshPanels();
                    break;
                }
                case 'reset': {
                    // 4.7.0: 무엇을 되돌릴지 고른다 (전에는 애드온 · 단어 규칙 · 라이브러리까지 말없이 지웠다)
                    const groups = await askResetGroups();
                    if (!groups) return;
                    update(st => {
                        const fresh = resetSettings(groups);
                        for (const key of Object.keys(st)) delete st[key];
                        Object.assign(st, fresh); SillyTavern.getContext().extensionSettings.salty = st;
                    });
                    // 정규식 연동이 꺼졌으면 끄는 스위치처럼 원래 켜짐 상태로 되돌림
                    try { await syncRegexlinkFlag(); } catch (error) { console.warn('[Blue Lemonade] 정규식 연동 맞추기 실패', error); }
                    break;
                }
            }
        } catch (error) {
            toastr.error(error.message || String(error), 'Blue Lemonade');
        }
    });

    // 숫자 칸에서 Enter = 입력 확정 (팝업의 Enter 닫기로 넘어가지 않게)
    // 날씨 자리 점 끌기: 끄는 동안은 점만 움직이고, 놓을 때 저장한다 (저장하면 화면이 다시 그려져 끌던 점이 바뀌므로)
    root.addEventListener('pointerdown', (event) => {
        const dot = event.target.closest?.('.bl-spot'), pad = dot?.parentElement;
        if (!dot || !pad) return;
        event.preventDefault(); event.stopPropagation();
        try { dot.setPointerCapture(event.pointerId); } catch { /* 없어도 끌린다 */ }
        let at = null;
        const move = (e) => { const rect = pad.getBoundingClientRect(); at = { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) }; dot.style.left = `${at.x * 100}%`; dot.style.top = `${at.y * 100}%`; };
        const end = () => {
            dot.removeEventListener('pointermove', move); dot.removeEventListener('pointerup', end); dot.removeEventListener('pointercancel', end);
            if (!at) return;
            const mode = pad.dataset.spotMode, index = Number(dot.dataset.spot), spot = { x: Math.round(at.x * 1000) / 1000, y: Math.round(at.y * 1000) / 1000 };
            update((st) => { const spots = { ...(st.chat.weatherSpots || {}) }, list = [...(spots[mode] || [])]; const base = SPOT_DEFAULTS[mode]; for (let i = 0; i < index; i++) list[i] ??= { x: base[i][0], y: base[i][1] }; list[index] = spot; spots[mode] = list; st.chat.weatherSpots = spots; });
        };
        dot.addEventListener('pointermove', move); dot.addEventListener('pointerup', end); dot.addEventListener('pointercancel', end);
    });
    root.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || !event.target.matches('input[data-num]')) return;
        event.preventDefault();
        event.stopPropagation();
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
        event.target.blur();
    });

    root.addEventListener('input', (event) => {
        const search = event.target.closest('input[data-search="font"]');
        if (search) {
            if (!ui.query.trim() && search.value.trim()) ui.fontTag = 'all'; // 찾기 시작하면 모든 묶음에서
            ui.query = search.value;
            syncFontLists();
            return;
        }
        const time = event.target.closest('input[data-time-path]');
        if (time) {
            if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) update(st => setPath(st, time.dataset.timePath, time.value), false);
            return;
        }
        const picker = event.target.closest('input[data-color-path]');
        if (picker) {
            if (/^#[0-9a-f]{6}$/i.test(picker.value)) {
                update(st => setPath(st, picker.dataset.colorPath, picker.value), false, `color:${picker.dataset.colorPath}`); // 닫을 때 change 로 한 단계
                for(const panel of panels)syncWeatherPreview(panel,picker.dataset.colorPath);
            }
            return;
        }
        const range = event.target.closest('input[data-range]');
        if (!range) return;
        const path = range.dataset.range;
        const value = Number(range.value);
        range.style.setProperty('--fill', fill(value, Number(range.min), Number(range.max)));
        update(st => setPath(st, path, value), false, path);
        syncWeatherPreview(root, path);
        const num = root.querySelector(`input[data-num="${path}"]`);
        if (num && document.activeElement !== num) { num.value = numText(path, value); fitNum(num); }
    });

    root.addEventListener('change', async (event) => {
        const target = event.target;
        const designPath = target.dataset.range || target.dataset.colorPath;
        if (designPath && /^(image|profile|userProfile)\.decor\.(frameWidth|frameHeight|presetColor|presetAccent)$/.test(designPath)) {
            update(st => refreshPreset(st[designPath.split('.')[0]].decor), false);
            return;
        }
        if (target.matches('input[data-frame-file]') && target.files?.[0]) {
            const owner = target.dataset.frameFile;
            try {
                const { editFrame } = await import('./frame-editor.js');
                const result = await editFrame(target.files[0]);
                if (result) update(st => {
                    st[owner].decor = result;
                    try { saveFrame(st, owner, target.files[0].name.replace(/\.[^.]+$/, '')); }
                    catch (error) { toastr.warning(error.message, '액자 보관함'); }
                });
            } catch (error) { toastr.error(error.message, '장식 액자'); }
            target.value = '';
            return;
        }
        if (target.matches('input[data-num]')) {
            const path = target.dataset.num;
            const min = Number(target.dataset.min);
            const max = Number(target.dataset.max);
            const current = getPath(getSettings(), path);
            const base = isNum(current) ? current : Number(target.dataset.def);
            const typed = parseFloat(String(target.value).replace(',', '.'));
            let value = Number.isFinite(typed) ? typed * (NUM[path]?.scale || 1) : base;
            if (!Number.isFinite(value)) value = min;
            value = Number(Math.min(max, Math.max(min, value)).toFixed(4));
            target.value = numText(path, value);
            fitNum(target);
            const range = root.querySelector(`input[data-range="${path}"]`);
            if (range) {
                range.value = value;
                range.style.setProperty('--fill', fill(Number(range.value), min, max)); // 칸 사이 값이면 슬라이드바는 가까운 칸에 섬 → 그 자리까지 채움
            }
            if (value !== current) {
                update(st => {
                    setPath(st, path, value);
                    if (/^(image|profile|userProfile)\.decor\.(frameWidth|frameHeight)$/.test(path)) refreshPreset(st[path.split('.')[0]].decor);
                }, false);
                syncWeatherPreview(root, path);
            }
            return;
        }
        if (target.matches('input[data-toggle]')) {
            const path = target.dataset.toggle;
            if (path === 'replyNotify.on' && target.checked) {
                // 4.8.7 알림 허용은 누르는 순간(사용자 동작 안)에 물어야 폰 크롬이 제대로 띄운다 — 모듈은 그 뒤에 불러온다
                const ask = !('Notification' in window) ? Promise.resolve('unsupported')
                    : Notification.permission === 'default' ? Notification.requestPermission().catch(() => Notification.permission)
                        : Promise.resolve(Notification.permission);
                ask.then(state => import('./reply-notify.js').then(m => m.afterPermission(state))).then((ok) => {
                    if (ok) return;
                    update(st => { st.replyNotify.on = false; });
                    refreshPanels();
                }).catch(() => {});
            }
            if (path === 'st.streamFadeIn') {
                $('#stream_fade_in').prop('checked', target.checked).trigger('input');
                refreshPanels();
                return;
            }
            if (path === 'deus.weather') { // 3.4.0 프롬프트 › 트래커 날씨 — 끄면 날씨 효과 끔
                update(st => { st.chat.weather = target.checked ? 'tracker' : 'off'; });
                return;
            }
            if (path === 'st.hideAvatars') {
                $('#hideChatAvatarsEnabled').prop('checked', target.checked).trigger('input').trigger('change');
                return;
            }
            // 5.3.7 슬롯 목록은 FONT_SLOTS 에서 — userName 이 빠져 '내 이름' 스위치가 오류로 멈췄다
            const m = path.match(/^fonts\.([A-Za-z]+)\.same$/);
            if (m && m[1] !== 'text' && FONT_SLOTS.includes(m[1])) {
                ui.picker = null;
                update((st) => { st.fonts[m[1]] = target.checked ? 'same' : structuredClone(st.fonts.text); });
                return;
            }
            // 자동 색은 켜고 끌 때 테두리 설명(edgeHint) 문구가 바뀌니 창을 다시 그린다
            // 2.9.2: 본문 색 지정 → '글자색 톤 맞추기' 줄, 톤 맞추기 → 톤 값 슬라이더 넷, 투명 그림도 똑같이 → 설명 문구가 스위치에 따라
            // 보였다 안 보였다 하는데 다시 그리지 않아, 끈 뒤에도 슬라이더가 남아 있었다
            // 감정 대사 효과(움직임 · 빛 · 색 흐름) · 백그라운드 버티는 방식 줄도 스위치를 따라 보였다 안 보였다 한다
            update(st => setPath(st, path, target.checked), ['strike.line', 'strike.own', 'strike.italic', 'deviceLayouts.on', 'chat.weatherReadability', 'chat.weatherIllustrated', 'enabled', 'chat.qrFind', 'chat.bgImage', 'em.italic', 'image.edgeAuto', 'profile.edgeAuto', 'userProfile.edgeAuto', 'userProfile.nameAuto', 'userProfile.nameShadow', 'userProfile.decor.on', 'userProfile.edgeShadow', 'profile.nameAuto', 'profile.nameShadow', 'profile.decor.on', 'image.decor.on', 'image.edgeShadow', 'profile.edgeShadow', 'shadow.on', 'chat.unifyInline', 'chat.toneInline', 'image.cutoutSame', 'chat.streamFade', 'onehand.on', 'chat.demSkin', 'reader.autoHide', 'chat.demFold', 'deus.on', 'outline.on', 'chat.demInk', 'deus.ink.outline.on', 'deus.ink.shadow.on', 'deus.fx.on', 'deus.fx.flow', 'deus.fx.force', 'bgWindow.on'].includes(path));
            return;
        }
        if (target.matches('input[data-file="font"]') && target.files?.[0]) {
            try {
                toastr.info('글꼴 올리는 중…', 'Blue Lemonade');
                pickFont(await uploadFont(target.files[0]));
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="mask"]') && target.files?.[0]) {
            try {
                const mask = await readMaskImage(target.files[0]);
                const replace = maskReplaceId;
                maskReplaceId = '';
                update(st => {
                    st.image.mask = mask;
                    st.image.shape = 'custom';
                    const slot = replace ? st.image.masks.find(x => x.id === replace) : null;
                    if (slot) { slot.data = mask; st.image.maskId = slot.id; } // 바꾸기: 그 칸의 그림을 갈아 끼움
                    else st.image.maskId = ''; // 새로 고른 그림 — 저장을 누르기 전까지는 목록에 없음
                });
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="weather"]') && target.files?.[0]) {
            try {
                const data = await readWeatherImage(target.files[0]);
                const replace = weatherReplaceId;
                weatherReplaceId = '';
                update((st) => {
                    st.chat.weatherImage = data;
                    st.chat.weather = 'custom';
                    const slot = replace ? st.weatherImages.find(x => x.id === replace) : null;
                    if (slot) { slot.data = data; st.chat.weatherImageId = slot.id; } else st.chat.weatherImageId = '';
                });
            } catch (error) {
                toastr.error(error.message || String(error), 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="style"]') && target.files?.[0]) {
            try {
                addReceivedStyle(await decodeStyle(await target.files[0].text()));
            } catch (error) {
                toastr.error(error.message || String(error), 'Blue Lemonade');
            }
            target.value = '';
            return;
        }
        if (target.matches('input[data-file="preset"]') && target.files?.[0]) {
            try {
                if (target.files[0].size > 1024 * 1024) throw new Error('프리셋 파일이 너무 커요');
                const incoming = readPreset(JSON.parse(await target.files[0].text()));
                const selected = await askPresetGroups(incoming);
                if (selected) {update(st=>{if(!rememberAppearance(st,'프리셋 불러오기 전'))toastr.info('그림 데이터가 커서 복구함에 담지 못했어요.');applyPreset(st,incoming,selected);});toastr.success('선택한 프리셋을 불러왔어요','Blue Lemonade');}
            } catch (error) {toastr.error(error.message || String(error),'Blue Lemonade');}
            target.value='';return;
        }
        if (target.matches('input[data-file="settings"]') && target.files?.[0]) {
            try {
                const data = JSON.parse(await target.files[0].text());
                const incoming = data?.settings;
                if (!data?.saltySettings || !incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('이 테마의 설정 파일이 아니에요');
                const ext = SillyTavern.getContext().extensionSettings;
                const backup = ext.salty;
                try {
                    ext.salty = structuredClone(incoming);
                    for (const k of Object.keys(ext.salty)) if (ext.salty[k] === null) delete ext.salty[k];
                    getSettings();
                    applyAll();
                } catch (error) {
                    ext.salty = backup;
                    getSettings();
                    applyAll();
                    throw new Error('설정 파일 내용이 이상해서 되돌렸어요: ' + (error.message || error));
                }
                history.run(backup, st => { for (const key of Object.keys(st)) delete st[key]; Object.assign(st, ext.salty); ext.salty = st; });
                saveSettings();
                refreshPanels();
                try { await syncRegexlinkFlag(); } catch (error) { console.warn('[Blue Lemonade] 정규식 연동 맞추기 실패', error); }
                toastr.success('설정을 가져왔어요', 'Blue Lemonade');
            } catch (error) {
                toastr.error(error.message, 'Blue Lemonade');
            }
            target.value = '';
        }
    });
}
