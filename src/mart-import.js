// 1.0.1 마트에서 가져오기 — 액자 마트 · 글꾸 마트(GitHub Pages /mart/)에서 「복사」 · 「파일 받기」한 JSON 을 읽어 보관함 · 내 글꾸에 넣어요.
// 받는 것은 코드가 아니라 데이터예요: { "bl-mart": 1, "items": [ frame | frame-preset | geulkku ] }. 아무것도 실행하지 않고 규칙에 맞는 것만 넣어요.
//   frame        { id, name, decor: { art, mask, ratio } } — art · mask 는 data:image/png;base64 만(decor.js tidyDecor 와 같은 400만 자 상한) · 그림 확인은 부르는 쪽(checkImage)
//   frame-preset { id, name, presetId, presetColor, presetAccent, presetLabel?, frameWidth?, frameHeight? } — 그림은 테마가 그려요(frame-presets.js drawPreset · 부르는 쪽 draw)
//   geulkku      { id, label, emoji, template, colors, messages, tail } — 틈 템플릿 검사는 log-copy-template.js checkTemplate(태그 · 속성 · 스타일 · 길이 · 네 자리)
// DOM 없는 순수 함수(node 시험 tools/tests/mart-import.mjs). 화면은 mart-import-ui.js. 시작 그래프 밖.
import { PAGES } from './repo.js';
import { FRAME_PRESETS, PRESET_LABELS, tidyPresetLabel, retirePreset } from './frame-presets.js';
import { checkTemplate, tidyTemplateColors, TEMPLATE_MESSAGES, tidyType } from './log-copy-template.js';

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
    return { reason: '모르는 종류예요' };
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
        const key = `${item.kind === 'geulkku' ? 'g' : 'f'}:${item.id}`;
        if (seen.has(key)) { out.skipped.push({ name: item.name, reason: '꾸러미에 두 번 들어 있어요' }); return; }
        seen.add(key);
        out.items.push(item);
    });
    return out;
}

/** 이미 있는 것(덮어쓸지 물어볼 것) — taken: 기본 글꾸 id(PRESETS)처럼 아예 못 쓰는 id */
export function findDupes(settings, items) {
    const frames = new Set((settings.frameLibrary ?? []).map(x => x.id));
    const customs = new Set((settings.logCopy?.custom ?? []).map(x => x.id));
    return items.filter(item => (item.kind === 'geulkku' ? customs : frames).has(item.id));
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
    const result = { frames: [], geulkku: [], replaced: [], skipped: [] };
    if (!Array.isArray(settings.frameLibrary)) settings.frameLibrary = [];
    const lc = settings.logCopy ?? (settings.logCopy = {});
    if (!Array.isArray(lc.custom)) lc.custom = [];
    for (const item of items) {
        const skip = reason => result.skipped.push({ name: item.name, reason });
        if (item.kind === 'geulkku') {
            if (taken.has(item.id)) { skip('기본 글꾸와 이름(id)이 같아요'); continue; }
            const at = lc.custom.findIndex(c => c.id === item.id);
            if (at >= 0 && !replace.has(item.id)) { skip('이미 있어서 건너뛰었어요'); continue; }
            if (at < 0 && lc.custom.length >= CUSTOM_MAX) { skip(`내 글꾸는 ${CUSTOM_MAX}개까지예요`); continue; }
            const entry = { id: item.id, name: item.name, html: '', template: item.template, colors: item.colors, messages: item.messages, tail: item.tail, emoji: item.emoji, ...(item.type ? { type: item.type } : {}), slot: null };
            if (at >= 0) { lc.custom[at] = entry; result.replaced.push(item.name); } else lc.custom.push(entry);
            result.geulkku.push(item.id);
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
export function summary({ frames = [], geulkku = [], replaced = [], skipped = [] } = {}, before = []) {
    const parts = [];
    if (frames.length) parts.push(`액자 ${frames.length}개`);
    if (geulkku.length) parts.push(`글꾸 ${geulkku.length}개`);
    const head = parts.length ? `${parts.join(' · ')}를 넣었어요${replaced.length ? `(덮어쓴 것 ${replaced.length}개)` : ''}` : '넣은 것이 없어요';
    const all = [...before, ...skipped];
    return { head, lines: all.map(s => `${s.name} — ${s.reason}`) };
}
