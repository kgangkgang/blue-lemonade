// 성능 보조 · 저장 공간 창 (성능 보조 화면 「저장 공간 보기」 · 요술봉 「저장 공간」 · 독 다리 항목에서 열 때만 불러온다)
//   2026-10-31 따로 깔던 런처 확장에 있던 창을 성능 보조 안으로 옮겼어요. 다리(st.storage-report.v1) · 주인 판별 계약은 그대로예요.
// 열 때 바로: 브라우저 전체(navigator.storage.estimate) · localStorage 주인별 · IndexedDB 목록 · 다리에 올린 확장의 몫.
// 누를 때만: 「서버 재기」(실리태번 공개 API — 그림 폴더 · 채팅 목록 · 파일 HEAD) · 「자세히 재기」(IndexedDB 를 읽기 전용으로 훑기).
// 이 창은 아무것도 직접 지우지 않는다: 그 확장이 저장 공간 다리(st.storage-report.v1)에 정리를 올렸을 때만, 확인 창을 거쳐 그 확장의 정리를 부른다.
import * as EXT from '../../../../../../../extensions.js';
import { allOwners, ownerLabel, dbInfo, groupLocalStorage, parseSize, formatBytes, valueSize, normalizeItems, STORAGE_BRIDGE } from './core.js';
import { openPanel, confirmBox, esc, holdToOpen, toast, ensureStyle } from './panel.js';

const ctx = () => EXT.getContext();
const headers = () => { try { return ctx().getRequestHeaders?.() || { 'Content-Type': 'application/json' }; } catch { return { 'Content-Type': 'application/json' }; } };
const DOCK = Symbol.for('blue-lemonade.dock');   // 런처 다리(따로 깐 확장) — 있으면 그 항목의 「열기」 단추
// 주인 → 정리하는 곳 안내 (그 확장이 정리 창구를 아직 안 열었을 때). 다른 확장 묶음은 같은 id 의 독 항목이 있으면 「열기」 단추를 달아요
const WHERE_TO_CLEAN = {
    'blue-lemonade': '블루 레몬에이드 › 목소리 「캐시 비우기」 · 번역 설정 「캐시 지우기」로 정리해요.',
    sillytavern: '실리태번 · 다른 확장이 쓰는 몫이에요. 각 확장 설정에서 정리해요.',
};
const OTHER_CLEAN = '그 확장 설정에서 정리해요.';
// 서버 user/files 에서 주인을 아는 파일 (HEAD 로 크기만)
const KNOWN_FILES = [
    ['blue-lemonade', /^(prompt-panel-cache|blue-lemonade)/],
];

const state = { quick: null, server: null, idb: {}, providers: {}, busy: '' };

async function quickScan() {
    const out = { estimate: null, ls: {}, dbs: [] };
    try { const e = await navigator.storage?.estimate?.(); if (e) out.estimate = { usage: e.usage ?? null, quota: e.quota ?? null, details: e.usageDetails || null }; } catch { /* 모름 */ }
    try { const entries = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); entries.push([k, localStorage.getItem(k)]); } out.ls = groupLocalStorage(entries); } catch { out.ls = {}; }
    try { out.dbs = ((await indexedDB.databases?.()) || []).map(d => ({ name: d.name, ...dbInfo(d.name) })).filter(d => d.name); } catch { out.dbs = []; }
    return out;
}

/** IndexedDB 하나를 읽기 전용으로 훑어 크기 — 4초 · 2만 줄이 넘으면 거기까지(partial) */
function idbSize(name, { budgetMs = 4000, maxRows = 20000 } = {}) {
    return new Promise(resolve => {
        let settled = false, db = null, tx = null, bytes = 0, rows = 0;
        const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { db?.close(); } catch { /* 이미 닫힘 */ }
            resolve(value);
        };
        // 커서 응답이 아예 오지 않거나 DB 열기가 멎어도 제한 시간 뒤에는 화면을 돌려준다.
        const timer = setTimeout(() => {
            finish({ bytes: db ? bytes : null, rows, partial: true, error: '시간 제한' });
            try { tx?.abort(); } catch { /* 이미 끝남 */ }
        }, Math.max(0, budgetMs));
        let req; try { req = indexedDB.open(name); } catch { finish({ bytes: null, rows: 0, partial: false, error: '열 수 없음' }); return; }
        req.onupgradeneeded = () => { try { req.transaction?.abort(); } catch { /* 없던 데이터베이스는 만들지 않는다 */ } };
        req.onerror = () => finish({ bytes: null, rows: 0, partial: false, error: '열 수 없음' });
        req.onblocked = () => finish({ bytes: null, rows: 0, partial: false, error: '다른 창이 쓰는 중' });
        req.onsuccess = () => {
            const opened = req.result;
            if (settled) { opened.close(); return; }
            db = opened; db.onversionchange = () => db.close();
            const stores = [...db.objectStoreNames];
            if (!stores.length) { db.close(); finish({ bytes: 0, rows: 0, partial: false }); return; }
            let partial = false; const t0 = Date.now();
            try { tx = db.transaction(stores, 'readonly'); } catch { db.close(); finish({ bytes: null, rows: 0, partial: false, error: '읽을 수 없음' }); return; }
            const next = i => {
                if (i >= stores.length) return;
                const cur = tx.objectStore(stores[i]).openCursor();
                cur.onsuccess = () => {
                    if (settled) return;
                    const c = cur.result;
                    if (!c) { next(i + 1); return; }
                    bytes += valueSize(c.value) + valueSize(c.key); rows++;
                    if (rows >= maxRows || Date.now() - t0 > budgetMs) { partial = true; try { tx.abort(); } catch { /* 끝 */ } return; }
                    c.continue();
                };
            };
            const done = () => { db.close(); finish({ bytes, rows, partial }); };
            tx.oncomplete = done; tx.onabort = tx.onerror = () => { partial = true; done(); };
            next(0);
        };
    });
}

async function postJson(url, body) {
    const r = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
}
async function mapLimit(items, limit, task) {
    let i = 0; const run = async () => { while (i < items.length) { const n = i++; await task(items[n], n); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
async function headSize(path) {
    try { const r = await fetch(path, { method: 'HEAD', cache: 'no-store' }); const raw = r.headers.get('content-length'); const n = raw === null || !raw.trim() ? NaN : Number(raw); return r.ok && Number.isFinite(n) && n >= 0 ? n : null; } catch { return null; }
}
/** 서버 재기: 그림 폴더 · 채팅 · 알려진 사용자 파일 — 실리태번 공개 API 만, 읽기만 */
async function serverScan(progress) {
    const out = { images: { count: 0, bytes: 0, folders: 0 }, chats: { count: 0, bytes: 0, characters: 0 }, files: {}, errors: [] };
    // 그림
    let folders = [];
    try { folders = await postJson('/api/images/folders', {}); } catch (e) { out.errors.push('그림 폴더 목록'); }
    const images = [];
    for (const folder of Array.isArray(folders) ? folders : []) {
        try {
            const names = await postJson('/api/images/list', { folder });
            if (Array.isArray(names) && names.length) out.images.folders++;
            for (const file of Array.isArray(names) ? names : []) images.push(`/user/images/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`);
        } catch { out.errors.push(`그림 폴더 하나`); }
    }
    let done = 0;
    await mapLimit(images, 4, async path => {
        const n = await headSize(path);
        out.images.count++; out.images.bytes += n || 0;
        if (++done % 10 === 0) progress?.(`그림 크기 재는 중 ${done.toLocaleString('ko-KR')}/${images.length.toLocaleString('ko-KR')}`);
    });
    // 채팅 (캐릭터마다)
    const chars = (ctx().characters || []).filter(c => c?.avatar);
    for (const [i, c] of chars.entries()) {
        progress?.(`채팅 재는 중 ${(i + 1).toLocaleString('ko-KR')}/${chars.length.toLocaleString('ko-KR')}`);
        try {
            const list = await postJson('/api/characters/chats', { avatar_url: c.avatar, metadata: true });
            if (!Array.isArray(list)) continue;
            out.chats.characters++;
            for (const item of list) { out.chats.count++; out.chats.bytes += parseSize(item?.file_size); }
        } catch { out.errors.push('채팅 목록 하나'); }
    }
    // 알려진 사용자 파일 (이름을 아는 것만 HEAD — 목록 API 가 없어서)
    const names = ['prompt-panel-cache-index.json'];
    await mapLimit(names, 4, async f => {
        const n = await headSize(`/user/files/${f}`); if (n === null) return;
        const owner = KNOWN_FILES.find(([, re]) => re.test(f))?.[0] || 'sillytavern';
        (out.files[owner] ??= { count: 0, bytes: 0 }); out.files[owner].count++; out.files[owner].bytes += n;
    });
    return out;
}

async function measureProviders(arg = undefined) {
    const bridge = globalThis[STORAGE_BRIDGE], out = {};
    for (const p of bridge?.list?.() || []) {
        try { out[p.id] = { owner: p.owner, label: p.label, items: normalizeItems(await (arg === undefined ? p.measure() : p.measure(arg))), clean: p.clean }; }
        catch (e) { out[p.id] = { owner: p.owner, label: p.label, items: [], clean: p.clean, error: e?.message || String(e) }; }
    }
    return out;
}

// ── 줄 모으기 ──
function rowsFor(owner) {
    const q = state.quick, s = state.server, rows = [];
    const provided = Object.values(state.providers).filter(p => p.owner === owner);
    if (provided.length) {
        // 창구가 있으면 그 줄만 — 같은 것을 두 번 세지 않게 이 창이 재는 줄은 뺀다
        for (const p of provided) for (const it of p.items) rows.push({ ...it, from: p.label });
        return rows;
    }
    const ls = q?.ls?.[owner];
    if (ls) rows.push({ label: '브라우저 설정 조각(localStorage)', where: 'browser', bytes: ls.bytes, count: ls.count });
    for (const d of (q?.dbs || []).filter(d => d.owner === owner)) {
        const m = state.idb[d.name];
        rows.push({ label: d.label, where: 'browser', bytes: m ? m.bytes : null, count: m ? m.rows : null, note: m?.partial ? '일부만 잼 — 실제는 더 커요' : m?.error || (m ? '' : '「자세히 재기」로 크기'), db: d.name, approx: !!m?.partial });
    }
    if (owner === 'sillytavern') {
        rows.push({ label: '채팅 폴더', where: 'server', bytes: s ? s.chats.bytes : null, count: s ? s.chats.count : null, note: s ? `${Number(s.chats.characters || 0).toLocaleString('ko-KR')}개 캐릭터 · 그룹 채팅은 빼고` : '「서버 재기」로 크기' });
        if (s?.images.count) rows.push({ label: '그림 폴더', where: 'server', bytes: s.images.bytes, count: s.images.count, note: `${Number(s.images.folders || 0).toLocaleString('ko-KR')}개 폴더 · 확장이 만든 그림도 들어 있어요` });
    }
    const f = s?.files?.[owner];
    if (f) rows.push({ label: '서버 자료 파일', where: 'server', bytes: f.bytes, count: f.count });
    return rows;
}
const sum = rows => rows.filter(r => !r.extra).reduce((n, r) => n + (Number(r.bytes) || 0), 0);   // 1.1.6: 겹치는 합계 줄(extra)은 빼고

// 1.2.3: 재는 동안 창을 닫고 다시 열었으면 지금 열린 창에 그린다 (닫힌 창에만 그려 새 창이 비활성으로 남던 것)
const livePanel = panel => document.getElementById('bl-perf-storage')?._blsPanel || panel;
function render(panel) {
    panel = livePanel(panel);
    const q = state.quick, e = q?.estimate;
    const pct = e?.usage != null && e?.quota ? Math.min(100, (e.usage / e.quota) * 100) : null;
    // 큰 것부터 (실리태번 · 기타는 맨 끝)
    const groups = allOwners().map((o, i) => ({ o, i, rows: rowsFor(o.id) })).filter(g => g.rows.length)
        .sort((a, b) => (a.o.id === 'sillytavern') - (b.o.id === 'sillytavern') || sum(b.rows) - sum(a.rows) || a.i - b.i);
    const bridge = globalThis[STORAGE_BRIDGE];
    panel.body.innerHTML = `<section class="bls-card bls-summary" aria-label="이 기기 브라우저">
        <div class="bls-row bls-between"><strong>이 기기 브라우저</strong><span class="bls-num">${e ? `${formatBytes(e.usage)} / ${formatBytes(e.quota)}` : '알 수 없어요'}</span></div>
        ${pct === null ? '' : `<div class="bls-bar" role="img" aria-label="사용 ${pct.toFixed(1)}%"><span style="width:${Math.max(1, pct).toFixed(1)}%"></span></div>`}
        <p class="bls-note">브라우저가 이 사이트에 준 칸이에요. 서버(실리태번 폴더)에 있는 그림 · 채팅은 따로예요.</p>
        <div class="bls-row bls-wrap">
          <button type="button" class="bls-btn bls-primary" data-act="server" ${state.busy ? 'disabled' : ''}>${state.server ? '서버 다시 재기' : '서버 재기'}</button>
          <button type="button" class="bls-btn" data-act="idb" ${state.busy ? 'disabled' : ''}>자세히 재기</button>
        </div>
        <p class="bls-status" role="status" aria-live="polite">${esc(state.busy || (state.server ? '서버까지 쟀어요.' : '그림 · 채팅 크기는 「서버 재기」를 눌러야 재요.'))}</p>
      </section>
      ${groups.map(({ o, rows }) => {
        const prov = Object.values(state.providers).filter(p => p.owner === o.id);
        const cleans = prov.flatMap(p => (p.clean || []).map(c => ({ ...c, provider: p.label, pid: Object.keys(state.providers).find(k => state.providers[k] === p) })));
        const entry = !WHERE_TO_CLEAN[o.id] && globalThis[DOCK]?.list?.().find(x => x.id === o.id);
        return `<section class="bls-card" aria-label="${esc(o.label)}">
          <div class="bls-row bls-between"><h3>${esc(o.label)}</h3><span class="bls-num">${formatBytes(sum(rows))}${rows.some(r => r.bytes === null) ? ' +' : ''}</span></div>
          <ul class="bls-list">${rows.map(r => `<li><div class="bls-item-main"><span>${esc(r.label)}</span><small>${r.where === 'server' ? '서버' : '이 기기'}${r.count != null ? ` · ${r.count.toLocaleString()}개` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</small></div><span class="bls-num">${r.approx ? '약 ' : ''}${formatBytes(r.bytes)}</span></li>`).join('')}</ul>
          <div class="bls-row bls-wrap">${cleans.map(c => `<button type="button" class="bls-btn" data-act="clean" data-pid="${esc(c.pid)}" data-cid="${esc(c.id)}">${esc(c.label)}</button>`).join('')}${entry ? `<button type="button" class="bls-btn" data-act="open" data-entry="${esc(entry.id)}">${esc(entry.label)} 열기</button>` : ''}</div>
          ${cleans.length ? '' : `<p class="bls-note">${esc(WHERE_TO_CLEAN[o.id] || OTHER_CLEAN)}</p>`}
        </section>`;
      }).join('')}
      <p class="bls-note bls-foot">이 창은 아무것도 직접 지우지 않아요. 지우기는 그 확장의 정리 기능으로, 지울 것과 크기를 보여 준 뒤에만 해요.${bridge ? '' : ''}</p>`;
}

let quickRefreshJob = null;
async function refreshQuick(panel) {
    if (!quickRefreshJob) {
        const job = (async () => {
            const quick = await quickScan();
            const providers = await measureProviders();
            state.quick = quick;
            state.providers = providers;
        })().finally(() => { if (quickRefreshJob === job) quickRefreshJob = null; });
        quickRefreshJob = job;
    }
    await quickRefreshJob;
    if (panel.dialog.isConnected) render(panel);
}

export async function openStorage() {
    await ensureStyle();
    const panel = openPanel({ id: 'bl-perf-storage', title: '저장 공간', subtitle: '이 기기 · 서버에서 확장들이 쓰는 자리' });
    if (!panel) return;
    if (panel._blsStorageJob) return panel._blsStorageJob;
    if (!panel._blsStorageBound) {
        panel._blsStorageBound = true;
        panel.body.innerHTML = '<p class="bls-status" role="status">재는 중…</p>';
        // 숨은 점검 도구 — 이 창 제목을 1초 길게 누르기 (README 에만 적는다)
        holdToOpen(panel.dialog.querySelector('h2'), () => { void import('./status.js').then(m => m.openStatus()); });
        panel.dialog.addEventListener('click', async e => {
            const b = e.target.closest('[data-act]'); if (!b || state.busy) return;
            const act = b.dataset.act;
            if (act === 'open') { const entry = globalThis[DOCK]?.list?.().find(x => x.id === b.dataset.entry); panel.close(); try { await entry?.open(); } catch (err) { toast('warning', err?.message || String(err), entry?.label || '저장 공간'); } return; }
            if (act === 'server') {
                state.busy = '서버 재는 중…'; render(panel);
                // 1.1.7: 창구에 「깊게 재기」를 먼저 부탁 — 창구가 있는 확장은 제 몫을 스스로 다시 잰다
                try { state.providers = await measureProviders({ deep: true }); } catch { /* 아래 */ }
                try { state.server = await serverScan(msg => { state.busy = msg; const s = livePanel(panel).body.querySelector('.bls-status'); if (s) s.textContent = msg; }); }
                catch (err) { toast('warning', err?.message || String(err), '저장 공간'); }
                state.busy = ''; render(panel); return;
            }
            if (act === 'idb') {
                // 1.1.8: 창구가 있는 확장의 데이터베이스는 그 창구가 이미 재므로 다시 훑지 않는다
                for (const d of state.quick?.dbs || []) {
                    if (Object.values(state.providers).some(p => p.owner === d.owner)) continue;
                    state.busy = `자세히 재는 중 · ${d.label}`; render(panel); state.idb[d.name] = await idbSize(d.name);
                }
                state.busy = ''; render(panel); return;
            }
            if (act === 'clean') {
                const p = state.providers[b.dataset.pid], c = p?.clean?.find(x => x.id === b.dataset.cid); if (!c) return;
                let d; try { d = await c.describe(); } catch (err) { toast('warning', err?.message || String(err), p.label); return; }
                if (!d || !(Number(d.count) > 0 || Number(d.bytes) > 0)) { toast('info', '지울 것이 없어요.', `${p.label} · ${c.label}`); return; }
                const yes = await confirmBox({ title: `${p.label} · ${c.label}`, lines: [`지울 것: ${Number(d.count || 0).toLocaleString()}개 · ${formatBytes(d.bytes)}`, d.note || '', '지운 것은 되돌릴 수 없어요.'].filter(Boolean) });
                if (!yes) return;
                state.busy = `${c.label} 하는 중…`; render(panel);
                try { const r = await c.run(); toast('success', `${Number(r?.count || 0).toLocaleString()}개 · ${formatBytes(r?.bytes)} 정리했어요`, p.label); }
                catch (err) { toast('error', err?.message || String(err), p.label); }
                state.busy = ''; await refreshQuick(panel);
            }
        });
    }
    const job = (async () => {
        await refreshQuick(panel);
        return panel;
    })().finally(() => { if (panel._blsStorageJob === job) panel._blsStorageJob = null; });
    panel._blsStorageJob = job;
    return job;
}
export { quickScan, idbSize, serverScan };
