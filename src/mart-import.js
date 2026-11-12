// 1.0.1 마트에서 가져오기 — 액자 마트 · 글꾸 마트(GitHub Pages /mart/)에서 「복사」 · 「파일 받기」한 JSON 을 읽어 보관함 · 내 글꾸에 넣어요.
// 받는 것은 코드가 아니라 데이터예요: { "bl-mart": 1, "items": [ frame | frame-preset | geulkku ] }. 아무것도 실행하지 않고 규칙에 맞는 것만 넣어요.
//   frame        { id, name, decor: { art, mask, ratio } } — art · mask 는 data:image/png;base64 만(decor.js tidyDecor 와 같은 400만 자 상한) · 그림 확인은 부르는 쪽(checkImage)
//   frame-preset { id, name, presetId, presetColor, presetAccent, presetLabel?, frameWidth?, frameHeight? } — 그림은 테마가 그려요(frame-presets.js drawPreset · 부르는 쪽 draw)
//   geulkku      { id, label, emoji, template, colors, messages, tail } — 틈 템플릿 검사는 log-copy-template.js checkTemplate(태그 · 속성 · 스타일 · 길이 · 네 자리)
//   geulkku-simple { id, key, name, emoji, html, set } — 1.1.4 「테마로 담기」(심플 틀 + 조절 값 blGeulkku 2) · 아래 checkSimple
// DOM 없는 순수 함수(node 시험 tools/tests/mart-import.mjs). 화면은 mart-import-ui.js. 시작 그래프 밖.
import { PAGES } from './repo.js';
import { FRAME_PRESETS, PRESET_LABELS, tidyPresetLabel, retirePreset } from './frame-presets.js';
import { checkTemplate, tidyTemplateColors, TEMPLATE_MESSAGES, tidyType } from './log-copy-template.js';
import { frameFromHtml } from './log-copy-simple-frame.js';   // 1.1.4 「테마로 담기」 심플 틀 → 등록 값

export const MART_URL = `${PAGES}/mart`;
export const MART_TEXT_MAX = 40 * 1024 * 1024;   // 붙여 넣은 글 · 파일 하나 (그림 액자 여러 개 꾸러미까지)
export const MART_ITEMS_MAX = 60;
export const FRAME_LIMIT = 30, FRAME_BYTES = 12 * 1024 * 1024;   // frame-library.js 와 같은 값(시험이 맞춰 봐요)
export const ART_MAX = 4000000;                                   // decor.js tidyDecor 와 같은 값
export const CUSTOM_MAX = 20, CUSTOM_ID = /^[a-z0-9-]{1,24}$/i;   // log-copy-sheet.js · settings.js tidyLogCopy 와 같은 값
const FRAME_ID = /^[a-z\d-]{1,80}$/i;
const PNG = /^data:image\/png;base64,[a-z\d+/=]+$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const text = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max) : '');
const nameOf = item => text(item?.name || item?.label, 40) || text(item?.id, 40) || '이름 없음';

/** 한 항목 검사 → { item } | { reason } */
export function checkItem(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { reason: '항목 모양이 아니에요' };
    const kind = raw.kind;
    if (kind === 'frame') {
        if (!FRAME_ID.test(raw.id ?? '')) return { reason: '액자 id 가 틀려요' };
        const d = raw.decor;
        if (!d || typeof d !== 'object') return { reason: '액자 그림이 없어요' };
        for (const key of ['art', 'mask']) {
            if (typeof d[key] !== 'string' || !PNG.test(d[key])) return { reason: '그림은 PNG(data:image/png) 만 받아요' };
            if (d[key].length > ART_MAX) return { reason: '그림 한 장이 너무 커요(약 3MB 까지)' };
        }
        const ratio = Number(d.ratio);
        if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 10) return { reason: '가로세로 비율이 틀려요' };
        return { item: { kind, id: raw.id, name: nameOf(raw), decor: { art: d.art, mask: d.mask, ratio } } };
    }
    if (kind === 'frame-preset') {
        if (!FRAME_ID.test(raw.id ?? '')) return { reason: '액자 id 가 틀려요' };
        raw = { ...raw }; retirePreset(raw);   // 1.0.2 걷은 기본 프리셋 6종(옛 꾸러미) → 가장 가까운 심플 액자 · 그 액자의 기본 색 (설정 정리와 같은 규칙)
        if (!FRAME_PRESETS.some(([id]) => id === raw.presetId)) return { reason: '이 테마에 없는 프리셋 액자예요(테마를 새 판으로 올려 주세요)' };
        if (!HEX.test(raw.presetColor ?? '') || !HEX.test(raw.presetAccent ?? '')) return { reason: '액자 색이 틀려요' };
        const item = { kind, id: raw.id, name: nameOf(raw), presetId: raw.presetId, presetColor: raw.presetColor.toLowerCase(), presetAccent: raw.presetAccent.toLowerCase() };
        if (Object.hasOwn(PRESET_LABELS, raw.presetId)) item.presetLabel = typeof raw.presetLabel === 'string' ? tidyPresetLabel(raw.presetLabel) : PRESET_LABELS[raw.presetId];
        for (const key of ['frameWidth', 'frameHeight']) { const n = Number(raw[key] ?? 100); item[key] = Number.isFinite(n) ? Math.max(50, Math.min(200, Math.round(n))) : 100; }
        return { item };
    }
    if (kind === 'geulkku') {
        if (!CUSTOM_ID.test(raw.id ?? '')) return { reason: '글꾸 id 가 틀려요' };
        const checked = checkTemplate(raw.template);
        if (!checked.ok) return { reason: checked.reason };
        const { colors, missing } = tidyTemplateColors(raw.colors);
        if (missing.length) return { reason: `색 묶음이 모자라요(${missing.slice(0, 3).join(' · ')})` };
        return { item: { kind, id: raw.id, name: text(raw.label || raw.name, 40) || '마트 글꾸', emoji: text(raw.emoji, 8), template: checked.html, colors,
            messages: TEMPLATE_MESSAGES.includes(raw.messages) ? raw.messages : 'box', tail: text(raw.tail, 60), ...(tidyType(raw.type) ? { type: tidyType(raw.type) } : {}) } };
    }
    if (kind === 'geulkku-simple') return checkSimple(raw);
    return { reason: '모르는 종류예요' };
}

// 1.1.4 「테마로 담기」 — 글꾸 마트 심플 틀(class + <style> 하나 · 틀 원래 판) + 담는 순간의 조절 값(blGeulkku 2)
//   { kind: 'geulkku-simple', v: 1, id, key, name, emoji?, own?, html, set } — 꼴: W 문서 「테마로-담기-꼴.md」 1절.
//   html 은 등록 값(log-copy-simple-frame.js frameFromHtml — 자리표 · 줄 꼴)으로 바꿔 넣어요. 그릴 때 다시 바꾸지 않아요(받을 때 한 번).
//   set 은 꼴 번호 · 크기만 봐요 — 칸마다 다듬기는 그릴 때 마트 readSet(사본 src/geulkku-mart/)이 해요(모르는 키 · 범위 밖 값은 버려요).
export const SIMPLE_HTML_MAX = 60000;     // 틀 하나(마트 자료 5 ~ 48KB) — 설정 정리(tidyLogCopy)의 내 글꾸 html 상한과 같아요
export const SIMPLE_SET_MAX = 16 * 1024;  // 조절 값 JSON(고친 글까지 넣어도 몇 KB)
const SIMPLE_KEY = /^(?:k|q)\d{1,5}$/;
// 받지 않는 것: 스크립트 · 바깥 문서 · 입력 칸 · 그림 요소(svg 는 테마 복사 글이 지워요) · on… 속성 · javascript: · 바깥 주소 url(…)(data: 만) · @import
const SIMPLE_BAD = [
    [/<\/?(?:script|iframe|frame|object|embed|link|meta|base|form|input|textarea|select|button|video|source|track|svg|math|template|portal|img)\b/i, '틀 안에 받지 않는 요소가 있어요'],
    [/\son[a-z]+\s*=/i, '틀 안에 동작 속성(on…)이 있어요'],
    [/javascript:|vbscript:/i, '틀 안에 스크립트 주소가 있어요'],
    [/url\(\s*(?!['"]?data:image\/)/i, '틀 안에 바깥 주소 그림이 있어요(data: 그림만 받아요)'],
    [/@import|expression\s*\(|behavior\s*:/i, '틀 안에 받지 않는 스타일 규칙이 있어요'],
];
function checkSimple(raw) {
    if (raw.v !== undefined && raw.v !== 1) return { reason: '이 테마보다 새 꼴이에요(테마를 새 판으로 올려 주세요)' };
    if (!CUSTOM_ID.test(raw.id ?? '')) return { reason: '글꾸 id 가 틀려요' };
    if (!SIMPLE_KEY.test(raw.key ?? '')) return { reason: '틀 열쇠가 틀려요' };
    const html = raw.html;
    if (typeof html !== 'string' || !html.trim()) return { reason: '틀 HTML 이 없어요' };
    if (html.length > SIMPLE_HTML_MAX) return { reason: '틀이 너무 커요(60KB 까지)' };
    if (!/^\s*<div class="gk [^"]*"[^>]*>\s*<style>/.test(html) || (html.match(/<style\b/gi) ?? []).length !== 1) return { reason: '심플 글꾸 꼴이 아니에요(class + <style> 하나)' };
    // 소리 카드(<audio>)는 테마 복사 글에서 못 살아요 — 그 줄은 등록 값으로 바꿀 때 빼요(frameFromHtml). 다른 자리의 audio 는 아래 등록 값 검사가 걸러요
    const plain = html.replace(/<div class="gk-sd">.*<\/div>/g, '');
    for (const [re, reason] of SIMPLE_BAD) if (re.test(plain)) return { reason };
    let frame;
    try { frame = frameFromHtml(html, { id: raw.id, label: nameOf(raw), emoji: text(raw.emoji, 8) }); }
    catch (error) { return { reason: `이 틀은 아직 테마 로그 복사가 받지 못해요 — ${error.message}(마트 「HTML 복사」로 써요)` }; }
    if (frame.key !== raw.key) return { reason: '틀 열쇠가 HTML 과 달라요' };
    let set = { blGeulkku: 2 };
    if (raw.set && typeof raw.set === 'object' && !Array.isArray(raw.set) && raw.set.blGeulkku === 2) {
        let size = Infinity;
        try { size = JSON.stringify(raw.set).length; } catch { /* 돌고 도는 값 */ }
        if (size <= SIMPLE_SET_MAX) set = JSON.parse(JSON.stringify(raw.set));
    }
    return { item: { kind: 'geulkku-simple', id: raw.id, name: frame.label, emoji: text(raw.emoji, 8), frame, set } };
}

/** 붙여 넣은 글 · 파일 → { items, skipped: [{ name, reason }], error } (꾸러미 안 같은 id 는 처음 것만) */
export function readMart(input) {
    const out = { items: [], skipped: [], error: '' };
    const raw = typeof input === 'string' ? input.trim() : '';
    if (!raw) { out.error = '붙여 넣은 글이 없어요'; return out; }
    if (raw.length > MART_TEXT_MAX) { out.error = '글이 너무 커요(40MB 까지)'; return out; }
    let data;
    try { data = JSON.parse(raw); } catch { out.error = '마트에서 복사한 글이 아니에요(JSON 을 읽지 못했어요)'; return out; }
    if (!data || typeof data !== 'object' || data['bl-mart'] !== 1 || !Array.isArray(data.items)) { out.error = '마트에서 복사한 글이 아니에요(bl-mart 표시가 없어요)'; return out; }
    if (!data.items.length) { out.error = '들어 있는 항목이 없어요'; return out; }
    const seen = new Set();
    data.items.forEach((raw, i) => {
        if (i >= MART_ITEMS_MAX) { if (i === MART_ITEMS_MAX) out.skipped.push({ name: `${data.items.length - MART_ITEMS_MAX}개 더`, reason: `한 번에 ${MART_ITEMS_MAX}개까지예요` }); return; }
        const { item, reason } = checkItem(raw);
        if (!item) { out.skipped.push({ name: nameOf(raw), reason }); return; }
        const key = `${isGeulkku(item) ? 'g' : 'f'}:${item.id}`;
        if (seen.has(key)) { out.skipped.push({ name: item.name, reason: '꾸러미에 두 번 들어 있어요' }); return; }
        seen.add(key);
        out.items.push(item);
    });
    return out;
}

/** 내 글꾸로 가는 종류(옛 틈 템플릿 · 1.1.4 심플) */
export const isGeulkku = item => item?.kind === 'geulkku' || item?.kind === 'geulkku-simple';

/** 이미 있는 것(덮어쓸지 물어볼 것) — taken: 기본 글꾸 id(PRESETS)처럼 아예 못 쓰는 id */
export function findDupes(settings, items) {
    const frames = new Set((settings.frameLibrary ?? []).map(x => x.id));
    const customs = new Set((settings.logCopy?.custom ?? []).map(x => x.id));
    return items.filter(item => (isGeulkku(item) ? customs : frames).has(item.id));
}

const frameBytes = item => item.decor.art.length + item.decor.mask.length;

/**
 * 받은 항목을 넣어요 (settings 를 그 자리에서 고침)
 * @param {object} settings 테마 설정
 * @param {object[]} items readMart().items (부르는 쪽이 그림 확인을 마친 것)
 * @param {{ replace?: Set<string>, draw?: (item) => object, taken?: Set<string> }} options replace: 덮어쓸 id · draw: 프리셋 액자 그림(drawPreset) · taken: 쓸 수 없는 글꾸 id
 * @returns {{ frames: string[], geulkku: string[], replaced: string[], skipped: { name: string, reason: string }[] }}
 */
export function addMartItems(settings, items, { replace = new Set(), draw = null, taken = new Set() } = {}) {
    const result = { frames: [], geulkku: [], simple: [], replaced: [], skipped: [] };
    if (!Array.isArray(settings.frameLibrary)) settings.frameLibrary = [];
    const lc = settings.logCopy ?? (settings.logCopy = {});
    if (!Array.isArray(lc.custom)) lc.custom = [];
    for (const item of items) {
        const skip = reason => result.skipped.push({ name: item.name, reason });
        if (isGeulkku(item)) {
            if (taken.has(item.id)) { skip('기본 글꾸와 이름(id)이 같아요'); continue; }
            const at = lc.custom.findIndex(c => c.id === item.id);
            if (at >= 0 && !replace.has(item.id)) { skip('이미 있어서 건너뛰었어요'); continue; }
            if (at < 0 && lc.custom.length >= CUSTOM_MAX) { skip(`내 글꾸는 ${CUSTOM_MAX}개까지예요`); continue; }
            // 1.1.4 심플 글꾸: 등록 값 + 조절 값(html 칸은 비워요 — 옛 「직접 붙인 HTML」 글꾸와 갈라요)
            const entry = item.kind === 'geulkku-simple' ? { id: item.id, name: item.name, html: '', emoji: item.emoji, frame: item.frame, set: item.set, slot: null } : { id: item.id, name: item.name, html: '', template: item.template, colors: item.colors, messages: item.messages, tail: item.tail, emoji: item.emoji, ...(item.type ? { type: item.type } : {}), slot: null };
            if (at >= 0) { lc.custom[at] = entry; result.replaced.push(item.name); } else lc.custom.push(entry);
            result.geulkku.push(item.id);
            if (item.kind === 'geulkku-simple') result.simple.push(item.id);
            continue;
        }
        let entry;
        if (item.kind === 'frame') entry = { id: item.id, name: item.name, decor: { on: true, art: item.decor.art, mask: item.decor.mask, ratio: item.decor.ratio } };
        else {
            if (typeof draw !== 'function') { skip('프리셋 액자를 그릴 수 없어요'); continue; }
            let drawn;
            try { drawn = draw(item); } catch (error) { skip(error?.message || '프리셋 액자를 그리지 못했어요'); continue; }
            if (!drawn?.art || !drawn?.mask) { skip('프리셋 액자를 그리지 못했어요'); continue; }
            const decor = { ...drawn, on: true, presetId: item.presetId, presetColor: item.presetColor, presetAccent: item.presetAccent, frameWidth: item.frameWidth, frameHeight: item.frameHeight };
            if (item.presetLabel !== undefined) decor.presetLabel = item.presetLabel; else delete decor.presetLabel;
            entry = { id: item.id, name: item.name, decor };
        }
        const at = settings.frameLibrary.findIndex(x => x.id === item.id);
        if (at >= 0 && !replace.has(item.id)) { skip('이미 있어서 건너뛰었어요'); continue; }
        if (at < 0 && settings.frameLibrary.length >= FRAME_LIMIT) { skip(`보관함은 ${FRAME_LIMIT}개까지예요`); continue; }
        const used = settings.frameLibrary.reduce((n, x, i) => (i === at ? n : n + (x.decor?.art?.length ?? 0) + (x.decor?.mask?.length ?? 0)), 0);
        if (used + frameBytes(entry) > FRAME_BYTES) { skip('보관함 용량(12MB)이 모자라요 — 쓰지 않는 액자를 지워 주세요'); continue; }
        if (at >= 0) { settings.frameLibrary[at] = entry; result.replaced.push(item.name); } else settings.frameLibrary.push(entry);
        result.frames.push(item.id);
    }
    return result;
}

/** 결과 한 줄 요약 (몇 개 · 거른 것 · 이유) */
export function summary({ frames = [], geulkku = [], simple = [], replaced = [], skipped = [] } = {}, before = []) {
    const parts = [];
    if (frames.length) parts.push(`액자 ${frames.length}개`);
    if (geulkku.length > simple.length) parts.push(`글꾸 ${geulkku.length - simple.length}개`);
    if (simple.length) parts.push(`심플 글꾸 ${simple.length}개`);   // 1.1.4 「테마로 담기」
    const head = parts.length ? `${parts.join(' · ')}를 넣었어요${replaced.length ? `(덮어쓴 것 ${replaced.length}개)` : ''}` : '넣은 것이 없어요';
    const all = [...before, ...skipped];
    return { head, lines: all.map(s => `${s.name} — ${s.reason}`) };
}

/** <style> 안 CSS 주석은 소독기가 늘 걷어요(모양은 그대로) — 견줄 때 빼요. 주석 하나 때문에 멀쩡한 틀을 「못 받는 틀」로 거절하던 것(1.1.4 화면 확인 · 마트 5틀) */
export const dropCssComments = html => String(html ?? '').replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (all, open, css, close) => open + css.replace(/\/\*[\s\S]*?\*\//g, '') + close);
