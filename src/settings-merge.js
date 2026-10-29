// 7.0.1 다른 기기의 옛 설정 저장에 덮이지 않게 — 공용 합치기 (메모 · 번역 용어집이 쓴다).
//
// 실리태번 saveSettings 는 extension_settings 를 통째로 보내고 서버(src/endpoints/settings.js /save)는 그대로 덮어쓴다.
// 그래서 폰에서 메모를 더한 뒤 PC 에 오래 열어 둔 탭이 아무 설정이나 저장하면, PC 가 모르는 폰 메모가 서버에서 사라졌다.
// 실리태번 저장 흐름은 건드리지 않는다. 대신 탭이 오래 숨었다가 다시 보일 때만 /api/settings/get 을 한 번 읽어,
// 이 탭이 모르는 새 항목 · 더 늦은 updated 를 다음 저장 전에 메모리 값에 id 기준으로 합친다.
//
//   registerSettingsMerge(name, fn)   fn(serverExtensionSettings) → { pulled, removed, needSave } | null  (메모 · 용어집이 하나씩)
//   startSettingsMerge({ save })      한 번만 — 숨김 → 보임(MIN_HIDDEN_MS 넘게 숨었을 때)에 등록한 것을 모두 부른다. 서버는 한 번만 읽는다
//   mergeById({ local, remote, localGone, remoteGone, now }) — 순수 합치기 (시험: tools/tests/settings-merge.mjs)
//
// 지운 항목은 「지운 기록」(gone: { id: 지운 시각 ms })으로 남겨 다른 기기에서 되살아나지 않게 한다. 기록은 짧게(GONE_KEEP_MS) · 많아야 GONE_CAP 개.
// 규칙: 지운 시각 ≥ 그 항목의 updated 면 지운 것. 지운 뒤에 고치거나 되살린(updated 를 올린) 항목은 살아 있고 그 기록은 걷는다.
export const MIN_HIDDEN_MS = 60 * 1000;
export const GONE_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
export const GONE_CAP = 500;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const stampOf = item => { const n = Number(item?.updated); return Number.isFinite(n) && n > 0 ? n : 0; };

/** 지운 기록 정리: 숫자 시각만, 오래된 것 · 넘치는 것(오래된 쪽부터)을 버린다. 새 객체 */
export function tidyGone(gone, now = Date.now(), keepMs = GONE_KEEP_MS, cap = GONE_CAP) {
    const rows = [];
    if (isObj(gone)) for (const [id, at] of Object.entries(gone)) {
        const n = Number(at);
        if (id && Number.isFinite(n) && n > 0 && now - n <= keepMs) rows.push([id, n]);
    }
    rows.sort((a, b) => b[1] - a[1]);
    return Object.fromEntries(rows.slice(0, cap));
}
/** 두 기록 합치기 (같은 id 는 늦은 시각) */
export function unionGone(a, b, now = Date.now()) {
    const out = { ...tidyGone(a, now) };
    for (const [id, at] of Object.entries(tidyGone(b, now))) if (!(out[id] >= at)) out[id] = at;
    return tidyGone(out, now);
}

/**
 * id 기준 합치기. local(배열)을 **제자리에서** 고친다(화면이 잡고 있는 배열 · 객체를 그대로 둔다).
 *   remote 에만 있고 지운 기록에 안 걸린 것 → 더함 (자리: remote 차례에서 바로 앞 이웃 뒤, 없으면 맨 앞)
 *   둘 다 있는 것 → updated 가 늦은 쪽 (같으면 local). remote 가 늦으면 local 객체에 remote 값을 덮는다
 *   지운 기록(양쪽 합침)의 시각 ≥ 고른 쪽 updated → local 에서 뺀다
 *   local 에만 있고 지운 기록에 안 걸린 것 → 그대로 두고 needSave (서버가 잃은 것을 다음 저장이 되돌린다)
 * accept(item) 이 거짓인 remote 항목은 무시한다(모양이 깨진 것). clone(item) 은 remote 항목을 local 에 넣을 모양으로.
 * 돌려줌: { pulled: 더하거나 새로 받은 수, removed: 뺀 수, needSave, gone: 합친 지운 기록, changed }
 */
// 7.0.2 stamp(item) — 「어느 쪽이 늦은가」를 볼 시각 (기본 updated). 메모는 귀속 · 폴더를 바꾼 시각(metaUpdated)도 함께 본다
export function mergeById({ local, remote, localGone = {}, remoteGone = {}, now = Date.now(), accept = item => isObj(item) && item.id != null, clone = item => ({ ...item }), stamp = null }) {
    const stampOf = item => { const n = Number(typeof stamp === 'function' ? stamp(item) : item?.updated); return Number.isFinite(n) && n > 0 ? n : 0; };
    if (!Array.isArray(local)) throw new TypeError('local 은 배열');
    const gone = unionGone(localGone, remoteGone, now);
    const remoteList = (Array.isArray(remote) ? remote : []).filter(accept);
    const remoteById = new Map(remoteList.map(item => [String(item.id), item]));
    const localIds = new Set(local.map(item => String(item?.id)));
    let pulled = 0, removed = 0, needSave = false;
    // ① 둘 다 있는 것: 늦은 쪽
    for (const item of local) {
        const other = remoteById.get(String(item?.id));
        if (!other) continue;
        if (stampOf(other) > stampOf(item)) {
            const next = clone(other);
            for (const key of Object.keys(item)) if (!(key in next)) delete item[key];
            Object.assign(item, next);
            pulled++;
        } else if (stampOf(item) > stampOf(other)) needSave = true;
    }
    // ② remote 에만 있는 것: 지운 기록에 안 걸리면 더한다
    for (let i = 0; i < remoteList.length; i++) {
        const item = remoteList[i], id = String(item.id);
        if (localIds.has(id)) continue;
        if (gone[id] >= stampOf(item)) continue;
        let at = 0;
        for (let j = i - 1; j >= 0; j--) {
            const k = local.findIndex(x => String(x?.id) === String(remoteList[j].id));
            if (k >= 0) { at = k + 1; break; }
        }
        local.splice(at, 0, clone(item));
        localIds.add(id);
        pulled++;
    }
    // ③ 지운 기록에 걸린 것은 뺀다 (지운 뒤에 고친 것은 살리고 기록을 걷는다)
    for (let i = local.length - 1; i >= 0; i--) {
        const id = String(local[i]?.id);
        if (!(id in gone)) continue;
        if (gone[id] >= stampOf(local[i])) { local.splice(i, 1); removed++; }   // 다른 기기가 지운 것 (이 탭이 지운 것은 이미 local 에 없다)
        else delete gone[id];
    }
    // ④ local 에만 있는 것 (서버가 모름) → 다음 저장이 되돌리게
    for (const item of local) if (!remoteById.has(String(item?.id))) { needSave = true; break; }
    // 지운 기록이 서버와 다르면 저장
    const remoteTidy = tidyGone(remoteGone, now);
    if (Object.keys(gone).some(id => remoteTidy[id] !== gone[id])) needSave = true;
    return { pulled, removed, needSave, gone, changed: pulled > 0 || removed > 0 };
}

/** 지운 기록에 하나 더 (제자리). 같은 객체를 돌려준다 */
export function markGone(gone, id, now = Date.now()) {
    if (!isObj(gone) || id == null) return gone;
    gone[String(id)] = now;
    const tidy = tidyGone(gone, now);
    for (const key of Object.keys(gone)) if (!(key in tidy)) delete gone[key];
    return gone;
}

/** /api/settings/get 의 settings(JSON 글)에서 extension_settings 만 꺼낸다. 못 읽으면 null */
export function serverExtensionSettings(body) {
    try {
        const raw = typeof body?.settings === 'string' ? JSON.parse(body.settings) : body?.settings;
        return isObj(raw?.extension_settings) ? raw.extension_settings : null;
    } catch { return null; }
}

// ───────── 숨김 → 보임 ─────────
const consumers = new Map();
const begins = new Map();   // 이름 → 서버 읽기를 시작할 때 부를 것 (settings-sync.js 가 그 순간의 base 를 잡아 둠)
let host = {
    doc: () => globalThis.document,
    now: () => Date.now(),
    fetch: (...args) => globalThis.fetch(...args),
    headers: () => globalThis.SillyTavern?.getContext?.()?.getRequestHeaders?.() || { 'Content-Type': 'application/json' },
};
let started = false, hiddenAt = 0, running = null, saveFn = null, lastRun = null;

/** 합칠 것 등록 (이름이 같으면 바꿔 끼운다). 해제 함수를 돌려준다. begin: 서버 읽기를 시작할 때 (읽는 사이 바뀌는 기준값을 잡아 두게) */
export function registerSettingsMerge(name, fn, { begin } = {}) {
    if (typeof fn !== 'function') return () => {};
    consumers.set(String(name), fn);
    if (typeof begin === 'function') begins.set(String(name), begin); else begins.delete(String(name));
    return () => { if (consumers.get(String(name)) === fn) { consumers.delete(String(name)); begins.delete(String(name)); } };
}

/** 지금 한 번: 서버 설정을 읽어 등록한 것마다 합친다. 저장이 필요하면 save() 한 번 */
export function mergeFromServer(reason = 'manual') {
    if (running) return running;
    running = (async () => {
        const result = { reason, at: host.now(), ok: false, consumers: {} };
        try {
            if (!consumers.size) return result;
            for (const [name, begin] of begins) { try { begin(); } catch (error) { console.warn('[Blue Lemonade] 설정 합치기 시작', name, error); } }
            const res = await host.fetch('/api/settings/get', { method: 'POST', headers: host.headers(), body: '{}', cache: 'no-store' });
            if (!res?.ok) { result.error = `HTTP ${res?.status}`; return result; }
            const ext = serverExtensionSettings(await res.json());
            if (!ext) { result.error = 'no extension_settings'; return result; }
            let needSave = false;
            for (const [name, fn] of consumers) {
                try {
                    const out = fn(ext) || null;
                    result.consumers[name] = out;
                    if (out?.needSave) needSave = true;
                } catch (error) { result.consumers[name] = { error: String(error?.message || error) }; console.warn('[Blue Lemonade] 설정 합치기', name, error); }
            }
            if (needSave) { try { (saveFn || (() => {}))(); } catch (error) { console.warn('[Blue Lemonade] 설정 합치기 저장', error); } }
            result.ok = true; result.saved = needSave;
            return result;
        } catch (error) { result.error = String(error?.message || error); return result; }
        finally { lastRun = result; }
    })().finally(() => { running = null; });
    return running;
}

function onVisibility() {
    const doc = host.doc();
    if (doc?.hidden) { hiddenAt = host.now(); return; }
    if (hiddenAt && host.now() - hiddenAt >= MIN_HIDDEN_MS) mergeFromServer('visible');
    hiddenAt = 0;
}
function onPageShow(event) { if (event?.persisted) mergeFromServer('pageshow'); }   // 뒤로 가기 캐시에서 돌아온 탭

/** 한 번만 건다 (메모 · 번역 중 먼저 켜진 쪽). save = 실리태번 saveSettingsDebounced */
export function startSettingsMerge({ save } = {}) {
    if (typeof save === 'function') saveFn = save;
    if (started) return;
    const doc = host.doc();
    if (!doc?.addEventListener) return;
    started = true;
    if (doc.hidden) hiddenAt = host.now();
    doc.addEventListener('visibilitychange', onVisibility);
    globalThis.addEventListener?.('pageshow', onPageShow);
}

/** 시험 · 측정용 */
export const _forTest = {
    setHost(partial) { host = { ...host, ...partial }; },
    reset() { const doc = host.doc(); doc?.removeEventListener?.('visibilitychange', onVisibility); globalThis.removeEventListener?.('pageshow', onPageShow); consumers.clear(); begins.clear(); started = false; hiddenAt = 0; running = null; saveFn = null; lastRun = null; },
    lastRun: () => lastRun,
    consumers: () => [...consumers.keys()],
};
