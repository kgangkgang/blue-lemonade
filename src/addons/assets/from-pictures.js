// 캐릭터 에셋 1.7.6 「이 채팅의 그림 확장 그림을 에셋으로」 — 1.7.3 「에셋 그림 떼기」의 반대 방향.
//   그림 확장이 글 사이에 남긴 그림 자리(<span class="autopic-image-slot" data-autopic-slot="ID">…</span>)를 캐릭터 에셋 자리로 바꾼다.
//   · 그 자리가 예전 에셋 자리였고(그림 확장이 알려 준 assetWas) 떼어 둔 선택(extra.bl_asset_gone_slots)이 남아 있으면 → 같은 자리 · 같은 선택 그대로 (모델 없음)
//     {{img::}} 를 뗀 자리면 그 원문 태그 그대로
//   · 아니면 → 그 위치에 새 에셋 자리 + 「고르는 중」 기록 — 패널이 답장 뒤 고르기와 같은 길(after-reply.js pickSlots)로 고른다 (연결한 모델 호출)
//   · 그리는 중인 자리 · 고를 수 없는 자리(「다른 모델이 고르기」 꺼짐 · 폴더 없음)는 그림 그대로 둔다
//   지금 보이는 스와이프의 글(mes · 그 스와이프 사본 · 저장된 번역문)만 바꾼다. 그림 확장의 그림 기록과 그림 파일은 이 파일이 건드리지 않는다 —
//   그림 확장이 「바꿨어요」 알림(PICTURE_EVENTS.replaced)을 듣고 제 기록을 숨겨 두면, 다시 「에셋 떼기」 → 「에셋 있던 자리에 그림 그리기」에서 같은 그림이 돌아온다.
//   그림 확장과는 글 표식(클래스 이름)과 문서 이벤트로만 이어진다. 실리태번 · DOM 없음 (tools/tests/assets-from-pictures.mjs)
import { slotMarkup, slotIds, newSlotId, writeRecords, swipeOf, RECORD_KEY, GONE_KEY } from './slots.js';

/** 그림 확장의 그림 자리 — 저장되는 모양 그대로 (안 글자는 무엇이든) */
export const PICTURE_SLOT_SOURCE = '<span class="autopic-image-slot" data-autopic-slot="([\\w-]+)">[^<]*</span>';
const pictureRe = () => new RegExp(PICTURE_SLOT_SOURCE, 'g');
export const pictureIds = text => [...String(text ?? '').matchAll(pictureRe())].map(match => match[1]);
const TAG = /^\{\{img::\s*[^{}]+?\s*\}\}$/i;   // strip-chat.js 가 숨겨 둔 원문 태그

/**
 * 그림 확장과 주고받는 문서 이벤트 (document.dispatchEvent — 동기, detail 을 고쳐 답한다)
 *   query    { chat, items: [{ index, id }] } → 그림 확장이 supported = true, 자리마다 assetWas(예전 에셋 자리 id · 없으면 '') · busy(그리는 중) · blocked(지금 못 바꾸는 까닭)
 *   replaced { chat, items: [{ index, id, assetId }] } → 바뀐 그림 자리의 기록을 지우지 말고 숨겨 둔다 (assetId = 다시 뗄 때 남을 표식 id)
 *   restored { chat, items: [{ index, id }] } → 되돌리기로 글에 돌아온 그림 자리의 숨긴 기록을 되살린다
 *   open     { handled } → 그림 확장 쪽 단추가 이 기능을 부른다 (테마가 handled = true)
 *   hello    → 그림 확장이 켜졌다 (단추를 다시 본다)
 *   changed  { chat } → 테마가 에셋 그림을 떼거나 되돌렸다 (그림 확장이 「에셋 있던 자리」 수를 다시 센다 — 실리태번 이벤트가 없다)
 */
export const PICTURE_EVENTS = Object.freeze({
    query: 'bl-asset-pictures:query',
    replaced: 'bl-asset-pictures:replaced',
    restored: 'bl-asset-pictures:restored',
    open: 'bl-asset-pictures:open',
    hello: 'bl-asset-pictures:hello',
    changed: 'bl-asset-pictures:changed',
});

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const copy = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 지금 스와이프의 extra 들 [경로, extra] — extra 와 그 스와이프의 swipe_info 거울 */
function holdersNow(message) {
    const out = [];
    if (isObj(message.extra)) out.push(['extra', message.extra]);
    const swipe = swipeOf(message), info = Array.isArray(message.swipe_info) ? message.swipe_info[swipe] : null;
    if (isObj(info?.extra) && info.extra !== message.extra) out.push([`swipe_info.${swipe}.extra`, info.extra]);
    return out;
}
/** 지금 스와이프의 글 칸 [경로, 읽기, 쓰기] — mes · 그 스와이프 사본 · 저장된 번역문 */
function fieldsNow(message) {
    const swipe = swipeOf(message);
    const fields = [['mes', () => message.mes, v => { message.mes = v; }]];
    if (Array.isArray(message.swipes) && typeof message.swipes[swipe] === 'string') fields.push([`swipes.${swipe}`, () => message.swipes[swipe], v => { message.swipes[swipe] = v; }]);
    for (const [path, extra] of holdersNow(message)) if (typeof extra.display_text === 'string') fields.push([`${path}.display_text`, () => extra.display_text, v => { extra.display_text = v; }]);
    return fields.filter(([, read]) => typeof read() === 'string');
}

/** 떼어 둔 선택 (그 자리 id) — 기록이거나 { tag }. 없으면 null */
export function keptPick(message, was) {
    if (!was) return null;
    for (const [, extra] of holdersNow(message)) {
        const value = isObj(extra[GONE_KEY]) ? extra[GONE_KEY][was] : null;
        if (isObj(value)) return copy(value);
    }
    return null;
}
/** 되살릴 수 있는 기록인가 — 고른 그림이 있거나 사용자가 정한 자리 (고르던 중 · 실패한 기록은 새로 고른다) */
const usable = record => isObj(record) && (typeof record.name === 'string' && (record.name !== '' || record.manual === true));

/**
 * 계획 (채팅을 바꾸지 않음). answer(index, id) = 그림 확장의 답 { assetWas, busy }, canPick(message, index) = 새로 고를 수 있나.
 * @returns {{ messages: { index: number, items: { id: string, kind: 'slot'|'tag'|'pick'|'busy'|'keep', assetId?: string, tag?: string, record?: object }[] }[],
 *             counts: { pictures: number, restore: number, pick: number, busy: number, keep: number, messages: number, calls: number } }}
 */
export function planFromPictures(chat, { answer = () => ({}), canPick = () => false } = {}) {
    const counts = { pictures: 0, restore: 0, pick: 0, busy: 0, keep: 0, messages: 0, calls: 0 };
    const messages = [];
    (Array.isArray(chat) ? chat : []).forEach((message, index) => {
        if (!isObj(message) || typeof message.mes !== 'string' || !message.mes.includes('autopic-image-slot')) return;
        const ids = pictureIds(message.mes);
        if (!ids.length) return;
        const taken = new Set(slotIds(message.mes));
        const items = [];
        let pickable = null;
        for (const id of ids) {
            counts.pictures++;
            const reply = answer(index, id) || {};
            if (reply.busy) { counts.busy++; items.push({ id, kind: 'busy' }); continue; }
            const was = typeof reply.assetWas === 'string' && /^[\w-]+$/.test(reply.assetWas) ? reply.assetWas : '';
            const kept = keptPick(message, was);
            if (kept && typeof kept.tag === 'string' && TAG.test(kept.tag.trim())) { counts.restore++; items.push({ id, kind: 'tag', assetId: was, tag: kept.tag }); continue; }
            if (kept && usable(kept) && !taken.has(was)) {
                const { tag: _tag, ...record } = kept;
                taken.add(was);
                counts.restore++; items.push({ id, kind: 'slot', assetId: was, record: { ...record, pending: false } });
                continue;
            }
            if (pickable === null) pickable = !!canPick(message, index);
            if (!pickable) { counts.keep++; items.push({ id, kind: 'keep' }); continue; }
            counts.pick++; items.push({ id, kind: 'pick' });
        }
        if (!items.some(item => item.kind === 'slot' || item.kind === 'tag' || item.kind === 'pick')) { messages.push({ index, items }); return; }
        counts.messages++;
        if (items.some(item => item.kind === 'pick')) counts.calls++;
        messages.push({ index, items });
    });
    return { messages, counts };
}

/** obj[key] = value 를 order 의 자리에 (strip-chat.js putAt 과 같음) */
function putAt(obj, key, value, order) {
    const now = { ...obj };
    for (const k of Object.keys(obj)) delete obj[k];
    for (const k of order) { if (k === key) obj[k] = value; else if (own(now, k)) obj[k] = now[k]; }
    for (const k of Object.keys(now)) if (!own(obj, k)) obj[k] = now[k];
}

/**
 * 바꾸기 (chat 을 바꾼다) → 되돌리기 기록 { restored, picked, messages, items, pairs, picks }
 *   items = [{ index, before, after, keys }] (keys = extra 경로 → { order, record: { had, value }, gone: { had, value } })
 *   pairs = [{ index, id: 그림 자리, assetId }] — 그림 확장에게 알릴 것, picks = [{ index, swipe, ids }] — 새로 고를 자리 (글 순서)
 */
export function applyFromPictures(chat, plan, makeId = newSlotId) {
    const out = { restored: 0, picked: 0, messages: 0, items: [], pairs: [], picks: [] };
    for (const { index, items } of plan?.messages ?? []) {
        const message = chat?.[index];
        if (!isObj(message) || typeof message.mes !== 'string') continue;
        const swipe = swipeOf(message);
        const swap = new Map();
        for (const item of items) {
            if (item.kind === 'tag') swap.set(item.id, { kind: 'tag', text: item.tag, assetId: item.assetId });
            else if (item.kind === 'slot') swap.set(item.id, { kind: 'slot', text: slotMarkup(item.assetId), assetId: item.assetId, record: item.record });
            else if (item.kind === 'pick') { const assetId = makeId(); swap.set(item.id, { kind: 'pick', text: slotMarkup(assetId), assetId }); }
        }
        if (!swap.size || !pictureIds(message.mes).some(id => swap.has(id))) continue;   // 그 사이 글이 바뀌었다
        if (!isObj(message.extra)) message.extra = {};
        const keys = {};
        for (const [path, extra] of holdersNow(message)) keys[path] = {
            order: Object.keys(extra),
            record: { had: own(extra, RECORD_KEY), value: copy(extra[RECORD_KEY]) },
            gone: { had: own(extra, GONE_KEY), value: copy(extra[GONE_KEY]) },
        };
        const replace = text => text.replace(pictureRe(), (raw, id) => (swap.has(id) ? swap.get(id).text : raw));
        const before = {}, after = {};
        for (const [path, read, write] of fieldsNow(message)) {
            const old = read(), next = replace(old);
            if (next === old) continue;
            before[path] = old; after[path] = next; write(next);
        }
        const records = {};
        for (const value of swap.values()) {
            if (value.kind === 'slot') records[value.assetId] = value.record;
            else if (value.kind === 'pick') records[value.assetId] = { name: '', pending: true };
        }
        if (Object.keys(records).length) writeRecords(message, swipe, records);
        // 되살린 선택은 숨긴 칸에서 뺀다 (다시 떼면 다시 숨는다)
        for (const [, extra] of holdersNow(message)) {
            const kept = extra[GONE_KEY];
            if (!isObj(kept)) continue;
            for (const value of swap.values()) if (value.kind !== 'pick') delete kept[value.assetId];
            if (!Object.keys(kept).length) delete extra[GONE_KEY];
        }
        out.items.push({ index, before, after, keys });
        out.messages++;
        for (const [id, value] of swap) { out.pairs.push({ index, id, assetId: value.assetId }); if (value.kind === 'pick') out.picked++; else out.restored++; }
        const pickIds = new Set([...swap.values()].filter(value => value.kind === 'pick').map(value => value.assetId));
        if (pickIds.size) out.picks.push({ index, swipe, ids: slotIds(message.mes).filter(id => pickIds.has(id)) });
    }
    return out;
}

const holderAt = (message, path) => holdersNow(message).find(([p]) => p === path)?.[1];
const fieldAt = (message, path) => fieldsNow(message).find(([p]) => p === path);

/** 되돌리기 → { restored, skipped, indexes, pictures: [{ index, id }] }. 바꾼 뒤 글이 바뀐 메시지(편집 · 다시 뽑기 · 번역 · 스와이프)는 그대로 둔다 */
export function undoFromPictures(chat, record) {
    const out = { restored: 0, skipped: 0, indexes: [], pictures: [] };
    for (const item of record?.items ?? []) {
        const message = chat?.[item.index];
        const same = isObj(message) && Object.entries(item.after).every(([path, value]) => fieldAt(message, path)?.[1]() === value)
            && Object.keys(item.keys).every(path => !!holderAt(message, path));
        if (!same) { out.skipped++; continue; }
        for (const [path, value] of Object.entries(item.before)) fieldAt(message, path)[2](value);
        for (const [path, { order, record: rec, gone }] of Object.entries(item.keys)) {
            const extra = holderAt(message, path);
            for (const [key, { had, value }] of [[RECORD_KEY, rec], [GONE_KEY, gone]]) {
                if (had) putAt(extra, key, copy(value), order); else delete extra[key];
            }
        }
        out.restored++; out.indexes.push(item.index);
        for (const id of pictureIds(message.mes)) if (record.pairs?.some(pair => pair.index === item.index && pair.id === id)) out.pictures.push({ index: item.index, id });
    }
    return out;
}
