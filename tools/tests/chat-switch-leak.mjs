// 장시간 메모리 · 누수 상한 시험 (예측점검 · 10-30) — 테마 index.js 를 가짜 브라우저(leak-dom.mjs · leak-loader.mjs)에서 그대로 띄우고
//   채팅 바꾸기 20번 · 답 스트리밍 20번 · 테마 설정 창 열고 닫기 20번 · 설정 바꾸기 20번 · 스와이프/고치기/지우기 20번 · 테마 끄고 켜기 · 앱 전환 · 창 크기 20번 ·
//   공지사항 · 출처 창 10번 · 이전 메시지 더 보기 20번 · (애드온 전부 켠 설정에서) 애드온 창 14개를 10번씩 열고 닫은 뒤
//   ① 실리태번 eventSource · window · document 리스너 수 ② 살아 있는 관찰자(MutationObserver 등록 · ResizeObserver · IntersectionObserver 대상) ③ setInterval
//   이 두 번째 회차 뒤와 같은지, ④ 옛 채팅 메시지 · 지운 메시지 · 닫은 창 DOM 이 쓰레기 수거 뒤 살아남지 않는지(WeakRef — 붙잡는 Map · 클로저가 있으면 남는다) 를 봐요.
//   설정 세 벌(기본 · 애드온 전부 · 켜야 쓰는 기능)을 따로 띄워요. 원인 찾기: LEAK_TRACE=1(남은 관찰 대상과 만든 자리) · LEAK_VERBOSE=1(테마 로그) · LEAK_SNAPSHOT=<파일>(힙 스냅숏)
//   node tools/tests/chat-switch-leak.mjs <테마 루트> [--config <이름>]   (쓰레기 수거를 부르려고 --expose-gc 로 스스로 한 번 더 떠요)
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const self = fileURLToPath(import.meta.url);
const configArg = process.argv.indexOf('--config');
const CONFIGS = {
    // 기본 설정 (새로 깐 사람)
    defaults: { enabled: true },
    // 애드온 전부 켬 (테마 안 확장 18개)
    addons: { enabled: true, addons: Object.fromEntries(['zipinstall', 'tts', 'direction', 'assets', 'order', 'perf', 'models', 'modelswitch', 'regexlink', 'rewrite', 'bookmarks', 'notes', 'translator', 'prompt', 'customstyle', 'mermaid', 'prompt-template', 'conflicts'].map(id => [id, true])) },
    // 켜야 쓰는 기능 (몰입 읽기 · 한 손 · 자동 화이트/나이트 · 답 알림 · 새 답 첫 줄 · 데우스 스킨 · 감정 대사 · 코드 색 끄기)
    features: { enabled: true, reader: { autoHide: true }, onehand: { on: true }, auto: { on: true }, replyNotify: { on: true }, deus: { on: true, fx: { on: true } }, chat: { replyTop: true, demSkin: true, codePlain: true, mesPins: ['mes_edit'] } },
};

if (configArg < 0 && typeof globalThis.gc !== 'function') {
    // 설정마다 따로 띄운다 (한 프로세스에 index.js 는 한 번만 뜬다)
    let failed = 0;
    for (const name of Object.keys(CONFIGS)) {
        const run = spawnSync(process.execPath, ['--expose-gc', self, root, '--config', name], { encoding: 'utf8', timeout: 240000 });
        process.stdout.write(run.stdout || '');
        if (run.status !== 0) { failed++; process.stderr.write(run.stderr || (run.status === null ? `config ${name}: 시간 안에 끝나지 않음\n` : '')); }
    }
    console.log(failed ? `\n${failed} config(s) failed` : '\nall configs passed');
    process.exit(failed ? 1 : 0);
}

const configName = configArg >= 0 ? process.argv[configArg + 1] : 'defaults';
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const { ctx, eventSource, chat: chatEl } = dom.installBrowser({ settings: structuredClone(CONFIGS[configName]) });
dom.installHost(ctx);
const { register } = await import('node:module');
register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
const say = (...args) => process.stdout.write(args.join(' ') + '\n');
const quiet = (...args) => { if (process.env.LEAK_VERBOSE) say('[log]', ...args.map(a => a?.stack ? a.stack.split('\n').slice(0, 3).join(' | ') : a)); };
console.warn = quiet; console.error = quiet; console.info = quiet; console.debug = quiet; console.log = quiet;   // 테마 · 애드온이 찍는 줄은 LEAK_VERBOSE=1 일 때만
process.on('unhandledRejection', quiet);

const T = ctx.event_types;
const settle = ms => dom.clock.advance(ms);
// 실리태번 callGenericPopup 흉내 — 한 벌만 (시험 쪽 클로저가 닫은 창을 붙잡지 않게, 닫으면 손잡이도 버린다)
const popups = [];
let closeOpenPopup = null;
ctx.callGenericPopup = content => new Promise(resolve => {
    const dlg = document.createElement('dialog'); dlg.className = 'popup'; dlg.append(content); document.body.append(dlg); dlg.showModal();
    dlg._leakMark = ['LEAK', 'POPUP', popups.length].join(''); popups.push(new WeakRef(dlg));
    // 실리태번 popup.js #hide: 애니메이션 뒤 dlg.close() → (onClose) → dlg.remove()
    closeOpenPopup = () => { closeOpenPopup = null; dlg.close(); dlg.remove(); resolve(null); };
});
await import(pathToFileURL(path.join(root, 'index.js')).href);
await settle(1000);
await eventSource.emit(T.APP_READY);
await settle(12000);   // 시작 뒤 4 · 6 · 8초에 받는 모듈까지

let passed = 0, failedCount = 0;
async function test(name, fn) { try { await fn(); passed++; say(`PASS [${configName}] ${name}`); } catch (e) { failedCount++; say(`FAIL [${configName}] ${name}\n${e.stack || e}`); } }

const refs = [];
let chatNo = 0;
async function openChat(count = 12) {
    const n = ++chatNo;
    ctx.chat.length = 0;
    chatEl.replaceChildren();   // 실리태번 clearChat
    ctx.chatId = `chat-${n}`;
    for (let i = 0; i < count; i++) {
        const user = i % 2 === 1;
        ctx.chat.push({ name: user ? 'You' : 'Char', is_user: user, is_system: false, mes: `메시지 ${i} 「대사」 *행동*`, extra: {}, swipes: [`메시지 ${i}`], swipe_id: 0, send_date: '2026-10-30' });
        const el = dom.messageElement(i, { user });
        chatEl.append(el);
        refs.push({ n, ref: new WeakRef(el) });
    }
    await eventSource.emit(T.CHAT_CHANGED, ctx.chatId);
    for (let i = 0; i < count; i++) await eventSource.emit(i % 2 ? T.USER_MESSAGE_RENDERED : T.CHARACTER_MESSAGE_RENDERED, i);
    await settle(4000);
}
async function streamReply() {
    const i = ctx.chat.length;
    ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: '', extra: {}, swipes: [''], swipe_id: 0 });
    const el = dom.messageElement(i);
    chatEl.append(el);
    refs.push({ n: chatNo, ref: new WeakRef(el) });
    document.body.dataset.generating = 'true';
    await eventSource.emit(T.GENERATION_STARTED, 'normal');
    const text = el.querySelector('.mes_text');
    for (let k = 1; k <= 6; k++) { text.innerHTML = `<p>${'글자 '.repeat(k * 4)}「대사 ${k}」</p>`; ctx.chat[i].mes = text.textContent; await eventSource.emit(T.STREAM_TOKEN_RECEIVED, text.textContent); await settle(50); }
    delete document.body.dataset.generating;
    await eventSource.emit(T.MESSAGE_RECEIVED, i, 'normal');
    await eventSource.emit(T.CHARACTER_MESSAGE_RENDERED, i, 'normal');
    await eventSource.emit(T.GENERATION_ENDED, i);
    await settle(3000);
}
const snapshot = () => { globalThis.gc(); const l = dom.listenerCounts(eventSource), o = dom.observerCounts(); return { eventSource: l.eventSource, window: l.window, document: l.document, intervals: l.intervals, mo: o.mo, moDetached: o.moDetached, roOn: o.ro.on, roOff: o.ro.off, ioOn: o.io.on, ioOff: o.io.off }; };
async function aliveOld(keepChat) {
    for (let i = 0; i < 6; i++) { await settle(3000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    const alive = {};
    for (const { n, ref } of refs) if (n < keepChat && ref.deref()) alive[n] = (alive[n] || 0) + 1;
    return alive;
}
const same = (a, b, what) => {
    const grew = Object.keys(b).filter(k => b[k] > a[k]);
    if (grew.length && process.env.LEAK_TRACE) { const seen = new Map(); for (const d of dom.detachedObserved()) { const k = `${d.kind} ${d.target} ← ${d.origin}`; seen.set(k, (seen.get(k) || 0) + 1); } for (const [k, n] of seen) say(`  [trace] ${n}× ${k}`); }
    assert.deepEqual(grew, [], `${what}: ${grew.map(k => `${k} ${a[k]} → ${b[k]}`).join(' · ')}`);
};

await test('채팅을 20번 바꿔도 리스너 · 관찰자 · 타이머가 늘지 않고, 옛 채팅 메시지 DOM 이 남지 않아요', async () => {
    await openChat(); await openChat();
    const base = snapshot();
    for (let i = 0; i < 18; i++) await openChat();
    same(base, snapshot(), '20번 바꾼 뒤');
    const alive = await aliveOld(chatNo);
    assert.deepEqual(alive, {}, `쓰레기 수거 뒤에도 남은 옛 메시지 (채팅 번호 → 개수): ${JSON.stringify(alive)}`);
});

await test('답 스트리밍 20번 뒤에도 리스너 · 관찰자가 늘지 않아요', async () => {
    await streamReply(); await streamReply();
    const base = snapshot();
    for (let i = 0; i < 18; i++) await streamReply();
    same(base, snapshot(), '스트리밍 20번 뒤');
    await openChat();
    const alive = await aliveOld(chatNo);
    assert.deepEqual(alive, {}, `채팅을 바꾼 뒤 남은 옛 메시지: ${JSON.stringify(alive)}`);
});

await test('테마 설정 창을 20번 열고 닫아도 리스너 · 관찰자가 늘지 않고, 닫은 창 DOM 이 남지 않아요', async () => {
    const open = async () => {
        const done = globalThis.Salty.openPopup();
        await settle(1500);
        closeOpenPopup?.();
        await done;
        await settle(1500);
    };
    await open(); await open();
    const base = snapshot();
    for (let i = 0; i < 18; i++) await open();
    for (let i = 0; i < 4; i++) { await settle(3000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    if (process.env.LEAK_SNAPSHOT) (await import('node:v8')).writeHeapSnapshot(process.env.LEAK_SNAPSHOT);
    const kept = popups.filter(ref => ref.deref()).length;
    if (process.env.LEAK_TRACE) say('  [trace] 남은 창 번호', popups.map((ref, i) => ref.deref() ? i : -1).filter(i => i >= 0), JSON.stringify(dom.detachedObserved().map(d => d.kind + ' ' + d.target + ' ← ' + d.origin.slice(0, 160))));
    const after = snapshot();
    assert.equal(kept, 0, `닫은 설정 창 ${popups.length}개 중 ${kept}개가 쓰레기 수거 뒤에도 남았어요 (${JSON.stringify(after)})`);
    same(base, after, '설정 창 20번 뒤');
});

await test('설정을 20번 바꿔(applyAll) 적용해도 리스너 · 관찰자가 늘지 않아요', async () => {
    const s = ctx.extensionSettings.salty;
    const flip = async i => { s.chat ??= {}; s.chat.numComma = i % 2 === 0; s.squareButtons = i % 2 === 0; globalThis.Salty.applyAll(); await eventSource.emit(T.SETTINGS_UPDATED); await settle(1500); };
    await flip(0); await flip(1);
    const base = snapshot();
    for (let i = 2; i < 20; i++) await flip(i);
    same(base, snapshot(), '설정 20번 뒤');
});

await test('메시지 스와이프 · 고치기 · 지우기 20번 뒤에도 리스너 · 관찰자가 늘지 않고, 지운 메시지 DOM 이 남지 않아요', async () => {
    await openChat(20);
    const removed = [];
    const round = async k => {
        const mes = chatEl.querySelectorAll('.mes').at(-1);
        const id = ctx.chat.length - 1;
        mes.setAttribute('mesid', String(id));   // 실리태번은 지운 뒤 번호를 다시 매긴다
        // 스와이프: 실리태번은 .mes_text 를 다시 채운다
        mes.querySelector('.mes_text').innerHTML = `<p>스와이프 ${k} 「다른 대사」</p>`; ctx.chat[id].mes = `스와이프 ${k}`;
        await eventSource.emit(T.MESSAGE_SWIPED, id); await eventSource.emit(T.CHARACTER_MESSAGE_RENDERED, id); await settle(600);
        // 고치기
        mes.querySelector('.mes_text').innerHTML = `<p>고친 글 ${k}</p>`; await eventSource.emit(T.MESSAGE_EDITED, id); await eventSource.emit(T.MESSAGE_UPDATED, id); await settle(600);
        // 지우기 (맨 위 메시지 하나)
        const first = chatEl.querySelector('.mes'); removed.push(new WeakRef(first)); first.remove(); ctx.chat.shift();
        await eventSource.emit(T.MESSAGE_DELETED, ctx.chat.length); await settle(1200);
    };
    await round(0); await round(1);
    const base = snapshot();
    for (let k = 2; k < 20; k++) await round(k);
    for (let i = 0; i < 4; i++) { await settle(3000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    const kept = removed.filter(ref => ref.deref()).length;
    assert.equal(kept, 0, `지운 메시지 ${removed.length}개 중 ${kept}개가 남았어요`);
    same(base, snapshot(), '스와이프 · 고치기 · 지우기 20번 뒤');
});

await test('테마 끄고 켜기 · 앱 전환 · 창 크기 바꾸기를 20번씩 해도 리스너 · 관찰자 · 타이머가 늘지 않아요', async () => {
    const s = ctx.extensionSettings.salty;
    const round = async k => {
        s.enabled = false; globalThis.Salty.applyAll(); await eventSource.emit(T.SETTINGS_UPDATED); await settle(800);
        s.enabled = true; globalThis.Salty.applyAll(); await eventSource.emit(T.SETTINGS_UPDATED); await settle(800);
        document._hiddenTab = true; document.dispatchEvent(new Event('visibilitychange')); await settle(70000);   // 1분 넘게 숨었다 돌아옴
        document._hiddenTab = false; document.dispatchEvent(new Event('visibilitychange')); await settle(1500);
        globalThis.innerWidth = k % 2 ? 390 : 1280; globalThis.dispatchEvent(new Event('resize')); await settle(800);
    };
    await round(0); await round(1);
    const base = snapshot();
    for (let k = 2; k < 20; k++) await round(k);
    same(base, snapshot(), '끄고 켜기 · 앱 전환 · 크기 20번 뒤');
});

// 창 열고 닫기 10번 — 새로 body 에 붙은 것을 닫기 단추(없으면 dialog.close)로 닫고, 스스로 떨어진 것만 센다
const CLOSERS = '[data-close], .popup-button-close, .bl-modal-close, .bl-addon-close, button[aria-label$="닫기"], [title="닫기"], .close-button, .xclose';
async function cycleWindows(name, openFn, { mustOpen = true } = {}) {
    const shown = [];
    let opened = 0;
    const once = async () => {
        const before = new Set(document.body.children), popupsBefore = popups.length;
        Promise.resolve().then(openFn).catch(quiet);   // 창이 닫힐 때까지 기다리는 것도 있어서 기다리지 않고 시간을 보낸다
        await settle(1500);
        const added = document.body.children.filter(n => !before.has(n));
        opened += added.length + (popups.length - popupsBefore);
        for (const el of added) {
            const close = el.querySelector(CLOSERS); if (close) { close.click(); await settle(400); }
            if (el.isConnected && el.localName === 'dialog') { el.close(); await settle(400); if (el.isConnected) el.remove(); }
            // 닫아도 문서에 남는 div 는 다시 쓰는 틀(북마크 #cg-panel · 다시 쓰기 holder 같은 것) — 세지 않고 그대로 둔다
            if (!el.isConnected) shown.push(new WeakRef(el));
        }
        closeOpenPopup?.();
        await settle(1500);
    };
    await once(); await once();
    const base = snapshot();
    for (let i = 0; i < 8; i++) await once();
    for (let i = 0; i < 4; i++) { await settle(3000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    const kept = shown.filter(ref => ref.deref()).length;
    if (process.env.LEAK_TRACE) say('  [trace] 남은 창', name, shown.map((ref, i) => { const el = ref.deref(); return el ? `${i}:${el.localName}#${el.id}.${el.className}` : null; }).filter(Boolean));
    const after = snapshot();
    if (mustOpen) assert.ok(opened >= 10, `창이 열리지 않았어요 (${opened})`);
    assert.equal(kept, 0, `닫은 창 ${shown.length}개 중 ${kept}개가 남았어요 (${JSON.stringify(after)})`);
    same(base, after, `${name} 10번 뒤`);
}
const srcUrl = rel => pathToFileURL(path.join(root, 'src', rel)).href;
await test('공지사항 · 출처 창을 10번씩 열고 닫아도 늘지 않고 남지 않아요', async () => {
    const notice = await import(srcUrl('notice.js')), credits = await import(srcUrl('credits.js'));
    await cycleWindows('공지사항', () => notice.openNotice(() => {}));
    await cycleWindows('출처', () => credits.openCredits());
});
await test('이전 메시지 더 보기 20번 뒤 채팅을 바꾸면 그 메시지들도 남지 않아요', async () => {
    await openChat(10);
    const more = async () => {
        const start = ctx.chat.length;
        for (let i = 0; i < 10; i++) { const el = dom.messageElement(start + i); chatEl.prepend(el); refs.push({ n: chatNo, ref: new WeakRef(el) }); ctx.chat.unshift({ name: 'Char', is_user: false, is_system: false, mes: `옛 메시지 ${i}`, extra: {}, swipes: [''], swipe_id: 0 }); }
        await eventSource.emit(T.MORE_MESSAGES_LOADED); await settle(1200);
    };
    await more(); await more();
    const base = snapshot();
    for (let i = 0; i < 18; i++) await more();
    same(base, snapshot(), '더 보기 20번 뒤');
    await openChat();
    const alive = await aliveOld(chatNo);
    assert.deepEqual(alive, {}, `채팅을 바꾼 뒤 남은 옛 메시지: ${JSON.stringify(alive)}`);
});

await test('캐릭터 · 페르소나 · 월드인포 · 프롬프트 목록을 20번 다시 그려도 늘지 않고 옛 목록 DOM 이 남지 않아요', async () => {
    const old = [];
    const block = (cls, i) => { const b = document.createElement('div'); b.className = cls; b.innerHTML = `<div class="avatar"><img loading="lazy" src="/thumbnail?type=avatar&amp;file=c${i}.png" alt=""></div><span class="ch_name">캐릭터 ${i}</span>`; return b; };
    const redraw = async k => {
        const chars = document.getElementById('rm_print_characters_block'), users = document.getElementById('user_avatar_block');
        const wiList = document.getElementById('world_popup_entries_list'), pmList = document.getElementById('completion_prompt_manager_list');
        const next = (n, make) => Array.from({ length: n }, (_, i) => { const e = make(i); old.push(new WeakRef(e)); return e; });
        chars.replaceChildren(...next(40, i => block('character_select entity_block', i)));
        users.replaceChildren(...next(10, i => block('avatar-container', i)));
        wiList.replaceChildren(...next(90, i => { const e = document.createElement('div'); e.className = 'world_entry'; e.setAttribute('uid', String(i)); e.innerHTML = `<div class="inline-drawer wide100p"><div class="inline-drawer-header"><span class="world_entry_form_control">항목 ${i}</span></div><div class="inline-drawer-content" style="display:none"></div></div>`; return e; }));
        pmList.replaceChildren(...next(20, i => { const e = document.createElement('li'); e.className = 'completion_prompt_manager_prompt'; e.setAttribute('data-pm-identifier', `p${i}`); e.innerHTML = `<span class="completion_prompt_manager_prompt_name"><span title="프롬프트 ${i}">프롬프트 ${i}</span></span><span class="prompt_manager_prompt_controls"><span class="prompt-manager-toggle-action fa-solid fa-toggle-on"></span></span>`; return e; }));
        await eventSource.emit(T.CHARACTER_PAGE_LOADED); await eventSource.emit(T.WORLDINFO_UPDATED, 'book', {}); await eventSource.emit(T.SETTINGS_UPDATED);
        await settle(1500);
    };
    await redraw(0); await redraw(1);
    const base = snapshot();
    for (let k = 2; k < 20; k++) await redraw(k);
    for (let i = 0; i < 4; i++) { await settle(3000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    const lastRound = 40 + 10 + 90 + 20;
    const kept = old.slice(0, -lastRound).filter(ref => ref.deref()).length;
    assert.equal(kept, 0, `옛 목록 블록 ${old.length - lastRound}개 중 ${kept}개가 남았어요 (${JSON.stringify(snapshot())})`);
    same(base, snapshot(), '목록 20번 뒤');
});

await test('입력칸에 200번 치고 지워도 리스너 · 관찰자 · 타이머가 늘지 않아요', async () => {
    const box = document.getElementById('send_textarea');
    const type = async k => { for (const text of ['/', '/검색 따옴표', `글 ${k}`, '']) { box.value = text; box.dispatchEvent(new Event('input', { bubbles: true })); box.dispatchEvent(new Event('keyup', { bubbles: true })); await settle(60); } };
    await type(0); await type(1);
    const base = snapshot();
    for (let k = 2; k < 50; k++) await type(k);
    await settle(3000);
    same(base, snapshot(), '200번 친 뒤');
});

await test('테마 고르기 목록(select)을 20번 열고 닫아도 늘지 않고 닫은 목록 DOM 이 남지 않아요', async () => {
    const host = document.getElementById('extensions_settings');
    const sel = document.createElement('select'); sel.innerHTML = '<option value="a">가</option><option value="b">나</option><option value="c">다</option>';
    host.append(sel);
    const layers = [];
    const cycle = async () => {
        const before = new Set(document.body.children);
        sel.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true, cancelable: true }), { pointerType: 'mouse', button: 0 }));
        await settle(300);
        for (const el of document.body.children.filter(n => !before.has(n))) layers.push(new WeakRef(el));
        document.dispatchEvent(Object.assign(new Event('keydown', { bubbles: true, cancelable: true }), { key: 'Escape' }));
        await settle(700);
    };
    await cycle(); await cycle();
    const base = snapshot();
    for (let i = 0; i < 18; i++) await cycle();
    for (let i = 0; i < 3; i++) { await settle(2000); globalThis.gc(); await new Promise(r => setImmediate(r)); }
    assert.ok(layers.length >= 20, `목록이 열리지 않았어요 (${layers.length})`);
    const kept = layers.filter(ref => ref.deref()?.isConnected === false).length;
    assert.equal(kept, 0, `닫은 목록 층 ${layers.length}개 중 ${kept}개가 떨어진 채 남았어요`);
    same(base, snapshot(), '고르기 목록 20번 뒤');
    sel.remove();
});

// 애드온 창 (애드온을 켠 설정에서만)
const ADDON_PANELS = [['tts', 'tts/index.js'], ['direction', 'direction/index.js'], ['assets', 'assets/index.js'], ['prompt', 'prompt/index.js'], ['mermaid', 'mermaid/index.js'], ['prompt-template', 'prompt-template/index.js'],
    ['customstyle', 'customstyle/index.js'], ['translator', 'translator/bridge.js'], ['modelswitch', 'modelswitch/index.js'], ['regexlink', 'regexlink/index.js'], ['rewrite', 'rewrite/index.js'], ['bookmarks', 'bookmarks/index.js'], ['zipinstall', 'zipinstall/index.js'], ['notes', 'notes/index.js']];
for (const [id, file] of configName === 'addons' ? ADDON_PANELS : []) {
    await test(`애드온 창(${id})을 10번 열고 닫아도 리스너 · 관찰자가 늘지 않고, 닫은 창 DOM 이 남지 않아요`, async () => {
        const mod = await import(srcUrl('addons/' + file));
        // 서랍 · 다시 쓰는 틀에 여는 애드온(프롬프트 · 번역 · 북마크)은 body 에 새 창이 안 붙는다 — 그때는 리스너 · 관찰자 수만 본다
        await cycleWindows(id, () => mod.openPanel(), { mustOpen: false });
    });
}

say(`[${configName}] ${passed} passed, ${failedCount} failed · 마지막 상태 ${JSON.stringify(snapshot())} · 잡힌 오류 ${dom.errors.length}`);
process.exit(failedCount ? 1 : 0);
