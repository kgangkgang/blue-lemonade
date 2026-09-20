// 커스텀 에이드 작업대. 미리보기만 바꾸다가 '완성 · 적용'에서 두 모드의 레시피를 저장한다.
import { PALETTES, paletteFamily, paletteVariant, parseColor, safeColor, onColor } from './palettes.js';

const KEYS = [['bg', '바탕'], ['surface', '패널'], ['text', '글자'], ['accent', '포인트']];
const hex = value => '#' + parseColor(value).slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
    const x = parseColor(a), y = parseColor(b);
    return hex(`rgb(${x.slice(0, 3).map((n, i) => Math.round(n * t + y[i] * (1 - t))).join(',')})`);
};
const alpha = (color, a) => `rgba(${parseColor(color).slice(0, 3).join(',')},${a})`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let draft;

export function makeCustomPalette(colors, mode) {
    const { bg, surface, text, accent } = Object.fromEntries(KEYS.map(([key]) => [key, hex(colors[key])]));
    const dark = mode === 'dark';
    return {
        bg, surface, text, accent, pop: accent, brand: accent,
        raised: mix(accent, surface, dark ? 0.13 : 0.09),
        dialogue: text, strong: dark ? accent : text,
        em: mix(text, bg, 0.70), muted: mix(text, surface, 0.72), faint: mix(text, surface, 0.54),
        marker: alpha(accent, dark ? 0.25 : 0.18), gold: alpha(accent, dark ? 0 : 0.18),
        line: alpha(text, 0.08), shadow: alpha(dark ? '#000000' : text, dark ? 0.72 : 0.14),
    };
}

function recipe(palette) {
    return Object.fromEntries(KEYS.map(([key]) => [key, hex(palette[key])]));
}

export function openCustomBuilder(settings, mode) {
    const source = paletteFamily(settings.palette);
    const saved = settings.customName || settings.colorOverrides?.['custom-light'] || settings.colorOverrides?.['custom-night'];
    draft = { id: settings.activeCustomPalette || '', name: settings.customName || '나만의 에이드', mode: mode === 'dark' ? 'dark' : 'light' };
    for (const kind of ['light', 'dark']) {
        const id = paletteVariant(saved ? 'custom' : source, kind);
        draft[kind] = recipe({ ...PALETTES[id], ...(settings.colorOverrides?.[id] || {}) });
    }
}

export function setCustomMode(mode) { if (draft) draft.mode = mode === 'dark' ? 'dark' : 'light'; }
export function seedCustom(family) { if (draft) draft[draft.mode] = recipe(PALETTES[paletteVariant(family, draft.mode)]); }
export function saveCustomPalette(settings) {
    if (!draft) return;
    const library=settings.customPalettes;
    const index=library.findIndex(item=>item.id===draft.id);
    if(index<0 && library.length>=24)throw Error('에이드는 24개까지 저장할 수 있어요.');
    settings.customName = draft.name.trim().slice(0, 24) || '나만의 에이드';
    for (const mode of ['light', 'dark']) settings.colorOverrides[paletteVariant('custom', mode)] = makeCustomPalette(draft[mode], mode);
    settings.palette = paletteVariant('custom', draft.mode);
    const entry={id:draft.id||crypto.randomUUID(),name:settings.customName,light:structuredClone(settings.colorOverrides['custom-light']),dark:structuredClone(settings.colorOverrides['custom-night'])};
    if(index<0)library.push(entry);else library[index]=entry;
    draft.id=entry.id;settings.activeCustomPalette=entry.id;
}

export function newCustomPalette(settings, mode) { openCustomBuilder(settings,mode);draft.id='';draft.name='새 에이드';for(const kind of ['light','dark']) {const id=paletteVariant(paletteFamily(settings.palette),kind);draft[kind]=recipe({...PALETTES[id],...(settings.colorOverrides?.[id]||{})});} }
export function useCustomPalette(settings,id) {
    const entry=settings.customPalettes.find(item=>item.id===id);if(!entry)return;
    settings.customName=entry.name;settings.activeCustomPalette=id;
    settings.colorOverrides['custom-light']=structuredClone(entry.light);
    settings.colorOverrides['custom-night']=structuredClone(entry.dark);
    settings.palette=paletteVariant('custom',PALETTES[settings.palette]?.mode||'light');
}
export function customLibrary(settings) {
    return `<div class="salty-group"><h4>내 에이드 보관함</h4><p class="salty-note">화이트·나이트 색을 한 쌍으로 24개까지 저장해요. 불러온 뒤 색 고치기에서 조금씩 바꿀 수 있어요.</p><div class="bl-palette-library">${settings.customPalettes.map(item=>`<article><b>${esc(item.name)}</b><button type="button" class="salty-btn" data-act="custom-use" data-id="${esc(item.id)}">불러오기</button><button type="button" class="salty-btn" data-act="custom-library-edit" data-id="${esc(item.id)}">편집</button><button type="button" class="salty-btn" data-act="custom-delete" data-id="${esc(item.id)}">삭제</button></article>`).join('')}</div><div class="salty-btns bl-palette-actions"><button type="button" class="salty-btn" data-act="custom-new">새 에이드 만들기</button><button type="button" class="salty-btn" data-act="custom-keep">현재 에이드 색 저장</button></div></div>`;
}

function previewStyle(palette) {
    return [...Object.entries(palette).map(([key, value]) => `--draft-${key}:${safeColor(value)}`), `--draft-on:${onColor(palette.accent)}`].join(';');
}

function contrast(text, bg) {
    const light = color => parseColor(color).slice(0, 3).map(c => {
        const n = c / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = light(text), b = light(bg);
    return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(1);
}

export function customBuilder(settings) {
    if (!draft) openCustomBuilder(settings, PALETTES[settings.palette]?.mode);
    const mode = draft.mode, colors = draft[mode], palette = makeCustomPalette(colors, mode);
    return `<div class="salty-custom-builder">
        <div class="salty-palette-toolbar"><button type="button" class="salty-custom-back" data-act="custom-back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> 에이드 목록</button>
            <div class="salty-mode-switch" role="group" aria-label="커스텀 미리보기 밝기">${['light', 'dark'].map(kind => `<button type="button" data-act="custom-mode" data-mode="${kind}" aria-label="${kind === 'light' ? '화이트' : '나이트'} 미리보기" aria-pressed="${mode === kind}"><i class="fa-regular fa-${kind === 'light' ? 'sun' : 'moon'}" aria-hidden="true"></i></button>`).join('')}</div>
        </div>
        <div class="salty-custom-preview" style="${previewStyle(palette)}" aria-label="커스텀 에이드 미리보기">
            <div class="salty-draft-top"><i class="fa-solid fa-lemon" aria-hidden="true"></i><b data-draft-name>${esc(draft.name)}</b><span>${mode === 'light' ? 'WHITE' : 'NIGHT'}</span></div>
            <div class="salty-draft-chat"><small>오늘의 한 장면</small><p>잔에 담긴 빛이 은은하게 번진다.</p><p><mark>“이 색, 마음에 들어?”</mark></p><div class="salty-draft-reply">응, <b>이 느낌</b>이 좋아.</div></div>
            <div class="salty-draft-menu"><span>메뉴와 선택한 항목</span><i class="salty-draft-toggle" aria-hidden="true"></i></div>
            <div class="salty-draft-input"><span>메시지를 입력하세요</span><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></div>
        </div>
        <div class="salty-custom-recipe">
            <label class="salty-custom-name">에이드 이름<input type="text" data-custom-name maxlength="24" value="${esc(draft.name)}" placeholder="나만의 에이드" autocomplete="off"></label>
            <div class="salty-custom-seeds" role="group" aria-label="색 레시피 불러오기">${[['blue', '블루'], ['lemon', '레몬 블루'], ['black', '블랙'], ['melon', '멜론'], ['grapefruit', '자몽'], ['peach', '피치']].map(([family, label]) => `<button type="button" data-act="custom-seed" data-family="${family}" style="--seed:${safeColor(PALETTES[paletteVariant(family, mode)].accent)}"><i aria-hidden="true"></i>${label}</button>`).join('')}</div>
            <div class="salty-custom-colors">${KEYS.map(([key, label]) => `<div class="salty-custom-color"><label>${label}<input type="color" data-custom-color="${key}" value="${colors[key]}" aria-label="${label} 색"></label><input type="text" data-custom-hex="${key}" value="${colors[key].toUpperCase()}" maxlength="7" pattern="#[0-9A-Fa-f]{6}" aria-label="${label} 색상 코드" spellcheck="false" autocomplete="off"></div>`).join('')}</div>
            <div class="salty-custom-foot"><small data-draft-contrast>글자 대비 ${contrast(palette.text, palette.bg)}:1</small><small>화이트·나이트 각각 저장</small></div>
            <button type="button" class="salty-btn salty-custom-save" data-act="custom-save">완성 · 적용 <i class="fa-solid fa-check" aria-hidden="true"></i></button>
        </div></div>`;
}

export function bindCustomBuilder(root) {
    const builder = root.querySelector('.salty-custom-builder');
    if (!builder || !draft) return;
    const sync = () => {
        const palette = makeCustomPalette(draft[draft.mode], draft.mode);
        builder.querySelector('.salty-custom-preview').style.cssText = previewStyle(palette);
        builder.querySelector('[data-draft-name]').textContent = draft.name || '나만의 에이드';
        builder.querySelector('[data-draft-contrast]').textContent = `글자 대비 ${contrast(palette.text, palette.bg)}:1`;
        builder.querySelector('[data-act="custom-save"]').disabled = [...builder.querySelectorAll('[data-custom-hex]')].some(input => !input.validity.valid);
    };
    builder.addEventListener('input', event => {
        const input = event.target;
        if (input.matches('[data-custom-name]')) { draft.name = input.value; sync(); return; }
        const key = input.dataset.customColor || input.dataset.customHex;
        if (!KEYS.some(([id]) => id === key)) return;
        if (!/^#[0-9a-f]{6}$/i.test(input.value)) { input.setAttribute('aria-invalid', 'true'); sync(); return; }
        input.removeAttribute('aria-invalid');
        draft[draft.mode][key] = input.value;
        const picker = builder.querySelector(`[data-custom-color="${key}"]`);
        const code = builder.querySelector(`[data-custom-hex="${key}"]`);
        picker.value = input.value; code.value = input.value.toUpperCase(); code.removeAttribute('aria-invalid');
        sync();
    });
    builder.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); event.stopPropagation(); }
    });
}
