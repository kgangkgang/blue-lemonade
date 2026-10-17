// 1.1.2: 여러 ZIP · 확장 여러 개를 묶은 ZIP 을 확장 하나씩 나눠 서버 도우미(1.1.0, 사용자마다 확인 표 하나)에 차례로 보낸다.
// 압축은 풀지 않는다. 묶음 ZIP 의 항목 바이트를 그대로 옮겨 확장마다 작은 ZIP 을 새로 엮는다.
const u16 = (b, o) => b[o] | b[o + 1] << 8;
const u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const utf8 = new TextDecoder();
const key = s => String(s || '').toLowerCase().normalize('NFC');
// 경로 구분만 보면 되므로 UTF-8 표시가 없는 이름은 바이트를 글자 하나씩으로 읽는다.
const nameOf = (b, flags) => (flags & 0x800 ? utf8.decode(b) : String.fromCharCode(...b)).replaceAll('\\', '/');
function entries(bytes) {
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (u32(bytes, i) === 0x06054b50) { end = i; break; }
    if (end < 0) return null;
    const count = u16(bytes, end + 10), size = u32(bytes, end + 12), start = u32(bytes, end + 16);
    if (u16(bytes, end + 4) || u16(bytes, end + 6) || count === 0xffff || start === 0xffffffff || start + size > end) return null;
    const list = [];
    for (let i = 0, o = start; i < count; i++) {
        if (o + 46 > end || u32(bytes, o) !== 0x02014b50) return null;
        const n = u16(bytes, o + 28), x = u16(bytes, o + 30), c = u16(bytes, o + 32), csize = u32(bytes, o + 20), local = u32(bytes, o + 42);
        if (csize === 0xffffffff || u32(bytes, o + 24) === 0xffffffff || local === 0xffffffff || o + 46 + n + x + c > end) return null;
        if (local + 30 > start || u32(bytes, local) !== 0x04034b50) return null;
        const data = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
        if (data + csize > start) return null;
        list.push({ head: bytes.subarray(o, o + 46), raw: bytes.subarray(o + 46, o + 46 + n), extra: bytes.subarray(o + 46 + n, o + 46 + n + x), data: bytes.subarray(data, data + csize), name: nameOf(bytes.subarray(o + 46, o + 46 + n), u16(bytes, o + 8)) });
        o += 46 + n + x + c;
    }
    return list;
}
function build(list) {
    const local = [], central = []; let offset = 0, size = 0;
    for (const e of list) {
        const h = new Uint8Array(30 + e.raw.length), v = new DataView(h.buffer);
        v.setUint32(0, 0x04034b50, true); h.set(e.head.subarray(6, 30), 4);
        v.setUint16(6, u16(e.head, 8) & ~8, true); v.setUint16(28, 0, true); h.set(e.raw, 30);
        const c = new Uint8Array(46 + e.raw.length + e.extra.length), w = new DataView(c.buffer);
        c.set(e.head); w.setUint16(8, u16(e.head, 8) & ~8, true); w.setUint16(32, 0, true); w.setUint32(42, offset, true); c.set(e.raw, 46); c.set(e.extra, 46 + e.raw.length);
        local.push(h, e.data); central.push(c); offset += h.length + e.data.length; size += c.length;
    }
    const tail = new Uint8Array(22), t = new DataView(tail.buffer);
    t.setUint32(0, 0x06054b50, true); t.setUint16(8, list.length, true); t.setUint16(10, list.length, true); t.setUint32(12, size, true); t.setUint32(16, offset, true);
    const out = new Uint8Array(offset + size + 22); let at = 0;
    for (const part of [...local, ...central, tail]) { out.set(part, at); at += part.length; }
    return out;
}
// manifest.json 이 가장 바깥에 두 개 이상이면 확장마다 나눈다. 하나뿐이거나 읽지 못하면 null — 원래 파일을 그대로 보낸다.
export function splitZip(bytes) {
    const list = entries(bytes); if (!list) return null;
    const manifests = list.map(e => e.name).filter(n => /(^|\/)manifest\.json$/.test(n)).map(n => n.slice(0, -13));
    const outer = [...new Set(manifests)].filter(p => !manifests.some(q => q !== p && p.startsWith(q)));
    if (outer.length < 2) return null;
    return outer.map(prefix => ({ root: prefix.split('/').filter(Boolean).at(-1), bytes: build(list.filter(e => e.name.startsWith(prefix))) }));
}
export const isZip = file => /\.zip$/i.test(file?.name || '');
export const tooBig = file => Number(file?.size) > 64 * 1024 ** 2;
// 고른 파일들 → 확장 하나씩. 잘못 고른 파일은 error 를 단 채 목록에 남긴다.
export async function gather(files) {
    const items = [];
    for (const file of files) {
        if (!isZip(file)) { items.push({ source: file.name, name: file.name, error: '.zip 파일이 아니에요.' }); continue; }
        if (tooBig(file)) { items.push({ source: file.name, name: file.name, error: 'ZIP은 64MB까지 넣을 수 있어요.' }); continue; }
        let parts = null;
        try { parts = splitZip(new Uint8Array(await file.arrayBuffer())); } catch { parts = null; }
        if (!parts) items.push({ source: file.name, name: file.name, blob: file });
        else for (const p of parts) items.push({ source: file.name, name: `${p.root}.zip`, blob: new Blob([p.bytes], { type: 'application/zip' }) });
    }
    return items;
}
const upload = (item, request) => request(`/inspect?name=${encodeURIComponent(item.name)}`, null, item.blob);
// 미리보기: 도우미는 사용자마다 확인 표를 하나만 쥐므로 표는 버리고 내용만 남긴다. 설치 때 다시 받는다.
export async function check(item, request) {
    if (!item.blob) return;
    item.preview = null; item.error = ''; item.folder = '';
    try {
        const p = await upload(item, request);
        item.plan = { manifest: p.manifest, count: p.count, bytes: p.bytes, suggested: p.suggested, matches: p.matches || [] };
        const folder = item.choice === '@new' ? p.suggested : item.choice || (p.matches?.length === 1 ? p.matches[0].folder : !p.matches?.length ? p.suggested : '');
        if (!folder) return;
        item.folder = folder;
        item.preview = await request('/preview', { token: p.token, folder });
    } catch (e) { item.error = e.message; item.preview = null; }
}
export function duplicates(items) {
    const seen = new Map(), twice = new Set();
    for (const item of items) if (item.folder) { const k = key(item.folder); if (seen.has(k)) twice.add(k); else seen.set(k, item.folder); }
    return [...twice].map(k => seen.get(k));
}
export const ready = items => items.filter(i => i.preview && !i.error && !i.result);
export const blocked = items => !ready(items).length || duplicates(items).length > 0 || items.some(i => i.blob && !i.error && !i.preview);
const same = (a, b) => ['folder', 'files', 'replaced', 'kept', 'backupBytes'].every(k => a?.[k] === b?.[k]) && a?.incoming?.version === b?.incoming?.version && (a?.current?.version ?? null) === (b?.current?.version ?? null);
// 모두 설치: 차례로 다시 확인 → 같으면 설치. 하나가 실패해도 다음으로 간다.
export async function installAll(items, request, step = () => {}) {
    if (blocked(items)) return { ok: [], failed: [] };
    const todo = ready(items), ok = [], failed = [];
    for (const [index, item] of todo.entries()) {
        step(index, todo.length, item);
        try {
            const p = await upload(item, request);
            const preview = await request('/preview', { token: p.token, folder: item.folder });
            if (!same(preview, item.preview)) throw Error('확인한 뒤 확장 파일이 바뀌었어요. 다시 골라 주세요.');
            item.result = await request('/install', { token: p.token }); ok.push(item);
        } catch (e) { item.error = e.message; failed.push(item); }
    }
    for (const item of items) if (!item.blob || (item.error && !failed.includes(item))) failed.push(item);
    step(todo.length, todo.length, null);
    return { ok, failed };
}
