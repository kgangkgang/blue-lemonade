// 캐릭터 에셋 1.7.3 「이 채팅의 에셋 그림 떼기」 (지금 채팅에 쓰인 에셋 그림을 떼고, 그 자리에 그림 확장이 그림을 넣을 수 있게).
//   지금 채팅의 메시지에서 에셋 그림 — 답장 뒤 고른 자리(<span class="bl-asset-slot" data-asset-slot="ID"></span> + extra.bl_asset_slots[ID])와
//   본문 모델이 쓴 {{img::이름}} — 을 떼고, 그 자리에 아무것도 그리지 않는 위치 표시 goneMarkup(ID)를 남긴다
//   (자리는 같은 ID, {{img::}} 는 그 글 안 차례대로 img-1 · img-2 …). 글 · 모든 스와이프 · 저장된 번역문(display_text)을 같이 바꾸고 자리 기록은 지운다.
//   그림 파일(에셋 목록)은 건드리지 않는다. 되돌리기는 뗀 메시지들의 바뀐 칸을 바이트 그대로 — 그 사이 바뀐 메시지는 건너뛴다.
//   1.7.6 뗀 선택은 지우지 않고 extra.bl_asset_gone_slots(GONE_KEY)에 숨겨 둔다 — 자리는 그 기록, {{img::}} 는 { tag: 원문 }.
//   「그림 확장 그림을 에셋으로」(from-pictures.js)가 같은 자리를 모델 없이 되살린다.
//   실리태번 · DOM 없음 (tools/tests/assets-strip-chat.mjs)
import { goneMarkup, RECORD_KEY, GONE_KEY } from './slots.js';

const SLOT = /<span class="bl-asset-slot" data-asset-slot="([\w-]+)"><\/span>/g;
const TAG = /\{\{img::\s*[^{}]+?\s*\}\}/gi;   // render.js TAG_PATTERN 과 같은 꼴
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const copy = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** 글 하나에서 그림을 떼고 표시를 남긴다 → { text, count, tags: [{ id: 'img-n', tag: 원문 }] } */
export function stripText(text) {
    let count = 0, n = 0;
    const tags = [];
    const out = String(text ?? '')
        .replace(SLOT, (_, id) => { count++; return goneMarkup(id); })
        .replace(TAG, tag => { count++; const id = `img-${++n}`; tags.push({ id, tag }); return goneMarkup(id); });
    return { text: out, count, tags };
}

/** 메시지의 글 칸들 [경로, 읽기, 쓰기] — 지금 글 · 스와이프마다 · 저장된 번역문 */
function textFields(message) {
    const fields = [['mes', () => message.mes, v => { message.mes = v; }]];
    if (Array.isArray(message.swipes)) message.swipes.forEach((_, i) => fields.push([`swipes.${i}`, () => message.swipes[i], v => { message.swipes[i] = v; }]));
    if (isObj(message.extra) && typeof message.extra.display_text === 'string') fields.push(['extra.display_text', () => message.extra.display_text, v => { message.extra.display_text = v; }]);
    if (Array.isArray(message.swipe_info)) message.swipe_info.forEach((info, i) => {
        if (isObj(info?.extra) && typeof info.extra.display_text === 'string') fields.push([`swipe_info.${i}.extra.display_text`, () => info.extra.display_text, v => { info.extra.display_text = v; }]);
    });
    return fields.filter(([, read]) => typeof read() === 'string');
}
/** 자리 기록을 담는 extra 들 [경로, extra] */
function recordHolders(message) {
    const holders = [];
    if (isObj(message.extra)) holders.push(['extra', message.extra]);
    if (Array.isArray(message.swipe_info)) message.swipe_info.forEach((info, i) => { if (isObj(info?.extra)) holders.push([`swipe_info.${i}.extra`, info.extra]); });
    return holders;
}
/** 1.7.6 글 칸의 {{img::}} 원문을 숨겨 둘 extra 경로 — 지금 글은 extra(+ 지금 스와이프 거울), 다른 스와이프는 그 swipe_info. 번역문은 따로 두지 않는다 (같은 번호의 원문) */
function tagHolderPaths(message, path) {
    const current = Number(message.swipe_id) || 0;
    if (path === 'mes') return ['extra', `swipe_info.${current}.extra`];
    const m = /^swipes\.(\d+)$/.exec(path);
    return m && Number(m[1]) !== current ? [`swipe_info.${m[1]}.extra`] : [];
}

/** 보이는 그림 수 — 지금 글 + 다른 스와이프 (지금 스와이프의 사본은 한 번만) */
function pictureCount(message) {
    let count = stripText(message.mes).count;
    const current = Number(message.swipe_id) || 0;
    if (Array.isArray(message.swipes)) message.swipes.forEach((text, i) => { if (i !== current) count += stripText(text).count; });
    return count;
}

/** 확인 창용: 뗄 그림 수 · 메시지 수 (아무것도 바꾸지 않음) */
export function countStrip(chat) {
    let pictures = 0, messages = 0;
    for (const message of Array.isArray(chat) ? chat : []) {
        if (!isObj(message)) continue;
        const count = pictureCount(message);
        const records = recordHolders(message).some(([, extra]) => isObj(extra[RECORD_KEY]) && Object.keys(extra[RECORD_KEY]).length);
        if (count || records) { pictures += count; messages++; }
    }
    return { pictures, messages };
}

/**
 * 떼기 (chat 을 바꾼다). 되돌리기 기록을 돌려준다 — { pictures, messages, items: [{ index, before, after, records }] }
 *   before/after = 바뀐 글 칸의 경로 → 값, records = 기록 칸의 경로 → { value: 옛 값(복사), order: 그 extra 의 키 순서 }
 */
export function stripChat(chat) {
    const record = { pictures: 0, messages: 0, items: [] };
    (Array.isArray(chat) ? chat : []).forEach((message, index) => {
        if (!isObj(message)) return;
        const count = pictureCount(message);
        const before = {}, after = {}, records = {}, gone = {};
        // 1.7.6 숨겨 둘 칸 — 처음 건드릴 때 옛 값을 적어 두고(되돌리기) 뗀 것을 더한다
        const keep = (path, extra, entries) => {
            if (!isObj(extra) || !Object.keys(entries).length) return;
            if (!(path in gone)) gone[path] = { had: Object.prototype.hasOwnProperty.call(extra, GONE_KEY), value: copy(extra[GONE_KEY]) };
            extra[GONE_KEY] = { ...(isObj(extra[GONE_KEY]) ? extra[GONE_KEY] : {}), ...copy(entries) };
        };
        const tagsByHolder = {};
        for (const [path, read, write] of textFields(message)) {
            const old = read(), stripped = stripText(old), next = stripped.text;
            if (next === old) continue;
            before[path] = old; after[path] = next; write(next);
            for (const holder of tagHolderPaths(message, path)) for (const { id, tag } of stripped.tags) (tagsByHolder[holder] ??= {})[id] ??= { tag };
        }
        for (const [path, extra] of recordHolders(message)) {
            if (!isObj(extra[RECORD_KEY]) || !Object.keys(extra[RECORD_KEY]).length) continue;   // 빈 기록은 그대로 (뗄 그림이 없다)
            records[path] = { value: copy(extra[RECORD_KEY]), order: Object.keys(extra) };   // 되돌릴 때 같은 자리에 (저장 파일의 키 순서까지)
            keep(path, extra, extra[RECORD_KEY]);
            delete extra[RECORD_KEY];
        }
        for (const [path, entries] of Object.entries(tagsByHolder)) keep(path, holderAt(message, path), entries);
        if (!Object.keys(before).length && !Object.keys(records).length) return;
        record.items.push({ index, before, after, records, gone });
        record.pictures += count; record.messages++;
    });
    return record;
}

/** obj[key] = value 를 order 의 자리에 (다른 키의 순서는 그대로, order 에 없던 새 키는 뒤에) */
function putAt(obj, key, value, order) {
    const now = { ...obj };
    for (const k of Object.keys(obj)) delete obj[k];
    for (const k of order) { if (k === key) obj[k] = value; else if (Object.prototype.hasOwnProperty.call(now, k)) obj[k] = now[k]; }
    for (const k of Object.keys(now)) if (!Object.prototype.hasOwnProperty.call(obj, k)) obj[k] = now[k];
}

const fieldAt = (message, path) => textFields(message).find(([p]) => p === path);
const holderAt = (message, path) => recordHolders(message).find(([p]) => p === path)?.[1];

/** 되돌리기 → { restored, skipped, indexes }. 뗀 뒤 글이 바뀐 메시지(편집 · 다시 뽑기 · 번역)는 그대로 둔다 */
export function undoStrip(chat, record) {
    const out = { restored: 0, skipped: 0, indexes: [] };
    for (const item of record?.items ?? []) {
        const message = chat?.[item.index];
        const same = isObj(message) && Object.entries(item.after).every(([path, value]) => fieldAt(message, path)?.[1]() === value)
            && Object.keys(item.records).every(path => { const extra = holderAt(message, path); return extra && !Object.prototype.hasOwnProperty.call(extra, RECORD_KEY); });
        if (!same) { out.skipped++; continue; }
        for (const [path, value] of Object.entries(item.before)) fieldAt(message, path)[2](value);
        for (const [path, { value, order }] of Object.entries(item.records)) putAt(holderAt(message, path), RECORD_KEY, copy(value), order);
        for (const [path, { had, value }] of Object.entries(item.gone ?? {})) {   // 1.7.6 숨겨 둔 칸도 뗀 앞으로
            const extra = holderAt(message, path);
            if (!extra) continue;
            if (had) extra[GONE_KEY] = copy(value); else delete extra[GONE_KEY];
        }
        out.restored++; out.indexes.push(item.index);
    }
    return out;
}
