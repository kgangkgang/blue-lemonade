// 1.8.2 미트볼 2.10 「속마음」 번역(src/mb-mind-tr.js) — 가짜 확장(말풍선 띄우기 · 번역기 하나 · 지연 넣은 흉내)으로 돌려 봐요. 원작 코드는 싣지 않아요(가짜는 이 시험이 지은 것).
//   node tools/tests/mb-mind-tr.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   ① 언어 가르기 ② 번역을 기다렸다가 번역본으로 처음부터(사라지는 셈도 그때부터) ③ 모음에 있으면 바로 ④ 늦으면 원문 → 그 자리에서 바꿔 끼움
//   ⑤ 꺼짐 · 내 언어 · 채팅 열 때 · 가려진 것은 원작 그대로 ⑥ 탭 글 · 번역 단추 ⑦ 2.9.x(말풍선 없음)는 아무것도 안 함 ⑧ 그 확장 자료는 부른 뒤 그대로
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const M = await import(pathToFileURL(path.join(root, 'src/mb-mind-tr.js')).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const JP1 = '……相変わらずお節介な人だ(￣へ￣)', KO1 = '……여전히 오지랖 넓은 사람이야(￣へ￣)';
const JP2 = '頼むから二人とも早く帰ってくれ', KO2 = '제발 둘 다 빨리 돌아가 줘';
const JPW = 'また始まったよ', KOW = '또 시작이네';
const DICT = new Map([[JP1, KO1], [JP2, KO2], [JPW, KOW]]);

function memStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; }
/** 가짜 확장: 그 확장처럼 「띄운 열쇠」를 기억하고 새 것만 띄워요(채팅이 바뀌면 그때 있던 것은 안 띄움) */
function fakeMb({ doc, delay = 50, set = {}, hasPop = true, fail = new Set() } = {}) {
    const state = { turn: 3, data: { rel: { user: [{ name: '아린', mind: { text: JP1, turn: 3 }, mindLog: [{ text: JP2, turn: 1 }] }, { name: '도윤', mind: { text: '이미 한국어야', turn: 3 } }] }, profile: { list: [] } }, watch: [] };
    const chat = { id: 'c1' };
    const settings = { ssGenLang: 'enview', trAuto: 'st', trEngine: 'st', trCode: 'ko', mindNum: { sec: 1 }, ...set };
    const spawned = [], calls = [], waits = [];
    let popChat = null; const seen = new Set();
    const app = { current: { state } };
    if (hasPop) app.mindPop = () => {
        const s = app.current.state, items = [];
        for (const r of s.data.rel.user) if (r.mind?.text && r.mind.turn === s.turn) items.push({ who: r.name, text: r.mind.text, key: `m|${s.turn}|${r.name}|${r.mind.text}` });
        for (const w of s.watch) if (w.turn === s.turn) items.push({ who: w.who, text: w.text, key: `w|${s.turn}|${w.who}|${w.text}` });
        if (chat.id !== popChat) { popChat = chat.id; seen.clear(); for (const x of items) seen.add(x.key); return; }
        for (const x of items) {
            if (seen.has(x.key)) continue;
            seen.add(x.key);
            let box = doc.getElementById('ss-mind-pops');
            if (!box) { box = doc.createElement('div'); box.id = 'ss-mind-pops'; box.className = 'ss-root ss-scope'; doc.body.append(box); }
            const el = doc.createElement('div');
            el.className = 'ss-mpop c-cast';
            el.innerHTML = `<div class="ss-mpop-b"><small><b>${tr.trString ? tr.trString(x.who) : x.who}</b> · 속마음</small><p class="ss-mpop-t">${x.text}</p></div>`;   // 화면만 번역이면 이름도 사전으로
            box.append(el);
            (x.text === M.WAIT_TEXT ? waits : spawned).push({ who: x.who, text: x.text, at: Date.now() });   // 버그 사냥 6 대기 표시 말풍선은 따로 세요
        }
    };
    const tr = {
        async trText(text) {
            calls.push(text);
            await sleep(delay);
            return String(text).split('\n').map(l => (fail.has(l) ? l : DICT.get(l) ?? l)).join('\n');
        },
    };
    const core = { app, settings: () => settings, modOn: () => true, mindCovered: r => !!r.covered };
    return { core, tr, cfg: { numOf: s => ({ sec: Number(s.mindNum?.sec) || 6 }) }, state, chat, spawned, calls, settings, waits };
}
function env({ off = '' } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const doc = dom.window.document;
    if (off) doc.documentElement.setAttribute('data-bl-mb-off', off);
    return { dom, doc };
}
function make(opts = {}) {
    const { doc } = env(opts);
    const mb = fakeMb({ doc, ...opts });
    const toasts = [];
    const storage = opts.storage ?? memStorage();
    const mind = M.createMindTr(mb, { doc, storage, wait: opts.wait ?? 400, chatId: () => mb.chat.id, toast: { success: m => toasts.push(['ok', m]), info: m => toasts.push(['info', m]) } });
    assert.equal(mind.wrap(), opts.hasPop !== false);
    mb.core.app.mindPop?.();   // 채팅 열기: 그때 있던 것은 안 띄움
    return { doc, mb, mind, toasts, storage };
}
/** 새 턴: 새 속마음이 들어와요 */
function newTurn(mb, text = JP2, who = '아린') {
    mb.state.turn++;
    const r = mb.state.data.rel.user.find(x => x.name === who);
    r.mind = { text, turn: mb.state.turn };
    mb.core.app.mindPop();
}

await test('① 언어 가르기: 한국어 · 카모지만 · 그 밖 언어는 손대지 않음', () => {
    assert.equal(M.langOf({ trCode: 'ko' }), 'ko'); assert.equal(M.langOf({ trCode: 'en-US' }), 'en'); assert.equal(M.langOf({ trLang: '日本語' }), 'ja'); assert.equal(M.langOf({}), 'ko');
    assert.equal(M.needsTr(JP1, 'ko'), true); assert.equal(M.needsTr('He is lying again', 'ko'), true);
    assert.equal(M.needsTr('이미 한국어야 (¬_¬)', 'ko'), false); assert.equal(M.needsTr('(´-ω-)', 'ko'), false); assert.equal(M.needsTr('', 'ko'), false);
    assert.equal(M.needsTr(JP1, 'ja'), false); assert.equal(M.needsTr('hello there', 'en'), false); assert.equal(M.needsTr(JP1, 'en'), true); assert.equal(M.needsTr(JP1, 'es'), false);
    assert.equal(M.looksDone(KO1, JP1, 'ko'), true); assert.equal(M.looksDone(JP1, JP1, 'ko'), false); assert.equal(M.looksDone('still english', 'still english', 'ko'), false);
});

await test('② 기다렸다가 번역본으로 처음부터 — 원문은 한 번도 안 뜸 · 그 확장 자료는 그대로', async () => {
    const { mb } = make({ delay: 120 });
    const t0 = Date.now();
    newTurn(mb);
    assert.equal(mb.spawned.length, 0, '번역 전에는 안 띄움');
    assert.equal(mb.state.data.rel.user[0].mind.text, JP2, '자료 글 그대로');
    assert.equal(mb.state.data.rel.user[0].mind.turn, mb.state.turn, '자료 턴 그대로');
    await sleep(400);
    assert.equal(mb.spawned.length, 1);
    assert.equal(mb.spawned[0].text, KO2, '번역본으로 처음부터');
    const at = mb.spawned[0].at - t0;
    assert.ok(at >= 120 && at < 400, `번역이 온 때 띄움 ${at}ms`);
    mb.core.app.mindPop(); mb.core.app.mindPop();
    assert.equal(mb.spawned.length, 1, '다시 그려도 한 번만');
    assert.equal(mb.state.data.rel.user[0].mind.text, JP2);
    console.log(`        시각: 번역기 120ms → 번역본 뜸 ${at}ms`);
});

await test('③ 번역 모음에 있으면 기다리지 않고 바로 번역본 · 번역기 안 부름', async () => {
    const storage = memStorage();
    { const { mb } = make({ storage, delay: 10 }); newTurn(mb); await sleep(150); assert.equal(mb.spawned[0].text, KO2); }
    await sleep(350);   // 모음 저장(0.3초 묶음)
    const { mb } = make({ storage, delay: 10 });
    const t0 = Date.now();
    newTurn(mb);
    assert.equal(mb.spawned.length, 1, '바로');
    assert.equal(mb.spawned[0].text, KO2);
    assert.ok(mb.spawned[0].at - t0 < 30);
    assert.equal(mb.calls.length, 0, '번역기 0회');
});

await test('④ 번역이 늦으면 원문으로 띄우고, 번역이 오면 그 말풍선을 번역본으로 바꿔 끼움(새로 안 띄움)', async () => {
    const { mb, doc } = make({ delay: 700, wait: 250 });
    const t0 = Date.now();
    newTurn(mb);
    await sleep(380);
    assert.equal(mb.spawned.length, 1);
    assert.equal(mb.spawned[0].text, JP2, '기다린 뒤 원문');
    const rawAt = mb.spawned[0].at - t0;
    assert.ok(rawAt >= 250 && rawAt < 380, `원문 뜸 ${rawAt}ms`);
    await sleep(500);
    const bubble = doc.querySelector('#ss-mind-pops .ss-mpop');
    assert.ok(bubble?.hasAttribute('data-bl-mind-tr'), '바꿔 끼움');
    assert.equal(bubble.querySelector('.ss-mpop-t').textContent, KO2);
    assert.equal(doc.querySelectorAll('#ss-mind-pops .ss-mpop').length, 1, '말풍선 하나');
    mb.core.app.mindPop();
    assert.equal(mb.spawned.length, 1, '원문 열쇠 그대로라 다시 안 뜸');
    // 사라지는 시간: 바꿔 끼운 때부터 1초 + 글자 × 30ms
    await sleep(1000 + [...KO2].length * 30 + 600);
    assert.equal(doc.querySelectorAll('#ss-mind-pops .ss-mpop').length, 0, '바꾼 때부터 세서 사라짐');
    console.log(`        시각: 기다림 250ms → 원문 ${rawAt}ms · 번역기 700ms → 바꿔 끼움`);
});

await test('⑤ 원작 그대로: 스위치 끔 · 자동 번역 꺼짐 · 번역 안 쓰는 저장 언어 · 내 언어 · 채팅 열 때 · 가려진 속마음', async () => {
    for (const opts of [{ off: 'mindtr' }, { set: { trAuto: 'off' } }, { set: { ssGenLang: 'ko' } }, { set: { trEngine: 'llm' } }]) {
        const { mb } = make(opts);
        newTurn(mb);
        assert.equal(mb.spawned.length, 1, JSON.stringify(opts));
        assert.equal(mb.spawned[0].text, JP2);
        await sleep(80);
        assert.equal(mb.calls.length, 0, `번역기 0회 ${JSON.stringify(opts)}`);
    }
    { const { mb } = make({ set: { trEngine: 'llm', trAuto: 'always' }, delay: 20 }); newTurn(mb); assert.equal(mb.spawned.length, 0); await sleep(300); assert.equal(mb.spawned[0]?.text, KO2, '번역 모델 + 항상'); }
    { const { mb } = make(); newTurn(mb, '그만 좀 해 (¬_¬)'); assert.equal(mb.spawned[0].text, '그만 좀 해 (¬_¬)'); await sleep(80); assert.equal(mb.calls.length, 0, '내 언어'); }
    { const { mb } = make(); await sleep(80); assert.equal(mb.spawned.length, 0, '채팅 열 때 있던 것'); assert.equal(mb.calls.length, 0); }
    { const { mb } = make(); mb.state.data.rel.user[0].covered = true; newTurn(mb); assert.equal(mb.spawned.length, 1, '가려진 것은 그대로'); }
});

await test('⑥ 관전자 한마디 · 두 사람 한 번에(번역기 1회 · 줄 수 맞을 때)', async () => {
    const { mb } = make({ delay: 60 });
    mb.state.turn++;
    mb.state.data.rel.user[0].mind = { text: JP1, turn: mb.state.turn };
    mb.state.data.rel.user[1].mind = { text: JP2, turn: mb.state.turn };
    mb.state.watch.push({ who: '열성팬', text: JPW, turn: mb.state.turn });
    mb.core.app.mindPop();
    assert.equal(mb.spawned.length, 0);
    assert.equal(mb.state.watch[0].turn, mb.state.turn, '관전자 턴 그대로');
    await sleep(300);
    assert.deepEqual(mb.spawned.map(x => x.text).sort(), [KO1, KO2, KOW].sort());
    assert.equal(mb.calls.length, 1, '한 번에');
});

await test('⑦ 탭 글: 그려질 때 신호로 번역본 · 원문은 title · 스위치를 끄면 원문으로', async () => {
    const { mb, mind, doc } = make({ delay: 30 });
    doc.body.insertAdjacentHTML('beforeend', `<div class="ss-root ss-scope"><div class="ss-card ss-mindc"><div class="ss-mind-bubble"><p class="ss-mind big">${JP1}</p></div><ul class="ss-mind-log"><li><span>${JP2}</span><small>2턴 전</small></li></ul></div><ul class="ss-wt-feed"><li><span class="ss-wt-ic"></span><div><b>열성팬</b><p>${JPW}</p></div></li></ul></div>`);
    for (const el of doc.querySelectorAll(M.SEL)) mind.onAnim({ animationName: M.ANIM, target: el });
    await sleep(200);
    const big = doc.querySelector('.ss-mind.big');
    assert.equal(big.textContent, KO1); assert.equal(big.title, `원문: ${JP1}`);
    assert.equal(doc.querySelector('.ss-mind-log span').textContent, KO2);
    assert.equal(doc.querySelector('.ss-wt-feed p').textContent, KOW);
    assert.equal(mb.calls.length, 1, '세 글 한 번에');
    mind.onSwitch('mindtr', true);
    assert.equal(big.textContent, JP1); assert.equal(big.hasAttribute(M.SRC_ATTR), false);
    mind.onSwitch('mindtr', false);
    assert.equal(big.textContent, KO1, '다시 켜면 모음에서 바로');
});

await test('⑧ 번역 단추: 자동이 꺼져 있어도 지금 · 지난 속마음 · 관전석을 옮김 · 실패한 것도 한 번 더 · 알림', async () => {
    const { mb, mind, doc, toasts } = make({ set: { trAuto: 'off' }, delay: 20 });
    mb.state.watch.push({ who: '열성팬', text: JPW, turn: 1 });
    doc.body.insertAdjacentHTML('beforeend', `<div class="ss-scope"><div class="ss-mindc"><p class="ss-mind big">${JP1}</p></div><button data-act="trsheet">번역</button></div>`);
    mind.onAnim({ animationName: M.ANIM, target: doc.querySelector('.ss-mind.big') });
    await sleep(60);
    assert.equal(mb.calls.length, 0, '자동 꺼짐 — 그려질 때는 안 보냄');
    mind.onClick({ target: doc.querySelector('[data-act="trsheet"]') });
    await sleep(200);
    assert.equal(doc.querySelector('.ss-mind.big').textContent, KO1);
    assert.equal(toasts.at(-1)?.[0], 'ok'); assert.match(toasts.at(-1)[1], /속마음 3개/);
    assert.equal(mind.store.get('ko', JPW), KOW); assert.equal(mind.store.get('ko', JP2), KO2, '지난 속마음');
    // 실패 → 다음 누름에 다시
    const f = make({ set: { trAuto: 'off' }, delay: 10, fail: new Set([JP1]) });
    f.doc.body.insertAdjacentHTML('beforeend', '<button data-act="trsheet">번역</button>');
    f.mind.onClick({ target: f.doc.querySelector('button') }); await sleep(120);
    assert.equal(f.mind.store.has('ko', JP1), false);
    const n = f.mb.calls.length;
    f.mind.onClick({ target: f.doc.querySelector('button') }); await sleep(120);
    assert.ok(f.mb.calls.length > n, '실패한 것도 다시');
    assert.equal(f.toasts.at(-1)[0], 'info');
});

await test('⑨ 미트볼 2.9.x(말풍선 없음): 감싸지 않고 아무것도 안 함', async () => {
    const { mb } = make({ hasPop: false });
    assert.equal(typeof mb.core.app.mindPop, 'undefined');
    const src = (await import('node:fs')).readFileSync(path.join(root, 'src/mb-mind-tr.js'), 'utf8');
    assert.match(src, /typeof core\.app\?\.mindPop !== 'function'\) return null/, '시작 때 말풍선이 없으면 신호 받기도 안 걸어요');
});

await test('⑩ 스위치 표 · 시트 묶음 · 다리 시작', async () => {
    const fs = await import('node:fs');
    const SW = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
    assert.equal(SW.switchOf('mindtr')?.kind, 'data'); assert.equal(SW.switchOf('mindpop')?.kind, 'screen');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /\/\* @mb mindpop \*\/[\s\S]*#ss-mind-pops\.ss-root \{ background: transparent;/);
    const sig = fs.readFileSync(path.join(root, 'src/mb-mind-tr.css'), 'utf8');
    assert.match(sig, new RegExp(`@keyframes ${M.ANIM} `));
    assert.match(sig, /:where\(:root:not\(\[data-bl-mb-off~="mindtr"\]\)\) > body\.salty \.ss-scope :is\(/, '스위치 문');
    for (const s of ['.ss-mindc .ss-mind.big', '.ss-mind-log li > span', '.ss-wt-feed li > div > p', '.ss-mind-bub > em']) assert.ok(sig.includes(s) && M.SEL.includes(s), s);
    assert.match(fs.readFileSync(path.join(root, 'src/ext-bridge.js'), 'utf8'), /mb-mind-tr\.js'\)\.then\(module => module\.startMindTr\(doc\)\)/);
});

// 1.8.2 미트볼 2.10 새 기능 맞춤(관전자 이름 · HUD 칸 · 관전석 이름)
const JPN = '通りすがりの猫', KON = '지나가던 고양이';
DICT.set(JPN, KON);
await test('⑪ 관전자 이름(주변인 · 실시간 채팅 — AI 가 이야기 언어로 지음)도 같은 묶음으로 옮겨 처음부터 번역 이름 · 한 번만 띄움 · 자료 그대로', async () => {
    const { mb } = make({ delay: 60 });
    mb.state.turn++;
    mb.state.watch.push({ who: JPN, text: JPW, turn: mb.state.turn });
    mb.core.app.mindPop();
    assert.equal(mb.spawned.length, 0);
    await sleep(300);
    assert.equal(mb.spawned.length, 1);
    assert.equal(mb.spawned[0].who, KON, '번역 이름'); assert.equal(mb.spawned[0].text, KOW);
    assert.equal(mb.calls.length, 1, '글과 이름 한 번에');
    assert.equal(mb.state.watch[0].who, JPN, '자료 이름 그대로');
    mb.core.app.mindPop(); mb.core.app.mindPop();
    assert.equal(mb.spawned.length, 1, '다시 그려도 한 번만');
    // 글이 이미 내 언어면 이름 때문에 기다리지 않아요 — 원문 이름으로 바로 · 다음 턴부터 모음의 이름
    const b = make({ delay: 40 });
    b.mb.state.turn++; b.mb.state.watch.push({ who: JPN, text: '또 저러네', turn: b.mb.state.turn }); b.mb.core.app.mindPop();
    assert.equal(b.mb.spawned.length, 1); assert.equal(b.mb.spawned[0].who, JPN, '이름만으로는 안 기다림');
    await sleep(320);
    b.mb.core.app.mindPop(); assert.equal(b.mb.spawned.length, 1, '이름이 나중에 와도 다시 안 띄움');
    b.mb.state.turn++; b.mb.state.watch.push({ who: JPN, text: '아 진짜', turn: b.mb.state.turn }); b.mb.core.app.mindPop();
    assert.equal(b.mb.spawned.at(-1).who, KON, '다음 턴은 모음의 이름');
    // 내 언어 이름(열성팬)은 손대지 않아요
    const c = make({ delay: 20 }); c.mb.state.turn++; c.mb.state.watch.push({ who: '열성팬', text: JPW, turn: c.mb.state.turn }); c.mb.core.app.mindPop(); await sleep(320);
    assert.equal(c.mb.spawned[0].who, '열성팬'); assert.deepEqual(c.mb.calls, [JPW]);
});
await test('⑫ 늦은 번역: 원문으로 뜬 말풍선을 바꿔 끼울 때 관전자 이름도 같이(원문은 title)', async () => {
    const { mb, doc } = make({ delay: 500, wait: 200 });
    mb.state.turn++; mb.state.watch.push({ who: JPN, text: JPW, turn: mb.state.turn }); mb.core.app.mindPop();
    await sleep(320);
    assert.equal(mb.spawned[0].who, JPN, '원문으로 뜸');
    await sleep(450);
    const b = doc.querySelector('#ss-mind-pops .ss-mpop[data-bl-mind-tr] .ss-mpop-b small b');
    assert.equal(b?.textContent, KON); assert.equal(b.title, `원문: ${JPN}`);
    assert.equal(doc.querySelector('#ss-mind-pops .ss-mpop-t').textContent, KOW);
});
await test('⑬ 관전석 이름 · HUD · 미니바 속마음 칸 글: 신호로 번역본 · 번역 단추가 관전자 이름도 옮김', async () => {
    const { mb, mind, doc, toasts } = make({ set: { trAuto: 'off' }, delay: 20 });
    for (const s of ['.ss-wt-feed li > div > b', '.ss-t.t-mind .p > .m']) assert.ok(M.SEL.includes(s), s);
    const sig = (await import('node:fs')).readFileSync(path.join(root, 'src/mb-mind-tr.css'), 'utf8');
    for (const s of ['.ss-wt-feed li > div > b', '.ss-t.t-mind .p > .m']) assert.ok(sig.includes(s), `신호 시트 ${s}`);
    mb.state.watch.push({ who: JPN, text: JPW, turn: 1 });
    doc.body.insertAdjacentHTML('beforeend', `<div class="ss-scope"><ul class="ss-wt-feed"><li><div><b>${JPN}</b><p>${JPW}</p></div></li></ul><span class="ss-t t-mind"><span class="c"><span class="ci"><span class="p"><span class="ss-tf"></span><span class="m">${JP1}</span></span></span></span></span><button data-act="trsheet">번역</button></div>`);
    mind.onClick({ target: doc.querySelector('[data-act="trsheet"]') });
    await sleep(200);
    for (const el of doc.querySelectorAll(M.SEL)) mind.onAnim({ animationName: M.ANIM, target: el });
    assert.equal(doc.querySelector('.ss-wt-feed b').textContent, KON);
    assert.equal(doc.querySelector('.ss-wt-feed b').title, `원문: ${JPN}`);
    assert.equal(doc.querySelector('.t-mind .m').textContent, KO1);
    assert.match(toasts.at(-1)[1], /속마음 \d+개/);
});
await test('⑭ 화면 맞춤 시트: 욕구 딱지 묶음 뒤 판 · 밤 말풍선 면 · 이름 색 · 세포 그림 크기 · ✏ 누를 자리 36 · 세포 카드 위에서부터', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    const mp = css.slice(css.indexOf('/* @mb mindpop */'), css.indexOf('/* @mb palette */', css.indexOf('/* @mb mindpop */')));
    assert.match(mp, /#ss-mdl-pops\.ss-root \{ background: transparent;/);
    assert.match(mp, /#ss-mind-pops :is\(\.c-fan, \.c-cell, \.c-cellsul, \.c-cellwoo\) \{ background: var\(--ss-bg\); color: var\(--ss-ink\); \}/);
    assert.match(mp, /#ss-mind-pops \.c-chat \{ background: var\(--ss-bg\);/);
    assert.match(mp, /\.ss-mpop:not\(\.c-writer, \.c-celljijeok\) \.ss-mpop-b small b \{ color: var\(--ss-ink\);/);
    assert.match(mp, /\.ss-mpop-ic \.ss-cellsvg \{ width: 1\.3em; height: 1\.3em; \}/);
    assert.match(css, /\/\* @mb touch \*\/[\s\S]*:is\(\.ss-wt-ed, \.ss-tone-ed\) \{ display: inline-grid; place-items: center; width: 36px; height: 36px;/);
    assert.match(css, /\/\* @mb layout \*\/[\s\S]*\.ss-cells-g > \.ss-cell \{ align-content: start; \}[\s\S]*\.ss-cells-g > \.ss-cell > b \{ padding-right: 28px; \}/);
    assert.match(css, /\/\* @mb palette \*\/[\s\S]*\.ss-wt-feed li > div > b \{ color: var\(--ss-ink\); \}/);
    const gen = fs.readFileSync(path.join(root, 'src/ext-status.gen.css'), 'utf8');
    assert.ok(gen.includes(':where(:root:not([data-bl-mb-off~="mindpop"])) > body.salty:not([data-bl-ext-raw]) #ss-mdl-pops.ss-root'), '생성물에 스위치 문');
});
await test('⑮ (버그 사냥 6) 늦은 번역은 그 글의 말풍선에만 — 원문 말풍선이 사라진 뒤 같은 사람의 새 말풍선(스와이프 · 다음 턴)을 옛 번역으로 덮지 않음', async () => {
    const { mb, doc } = make({ delay: 600, wait: 150 });
    newTurn(mb);                         // JP2 — 번역기가 늦어 원문으로 뜸
    await sleep(250);
    assert.equal(mb.spawned[0].text, JP2, '원문으로 뜸');
    doc.querySelector('#ss-mind-pops .ss-mpop').remove();   // 사라짐(시간 지남 · 눌러 닫음)
    const r = mb.state.data.rel.user[0]; r.mind = { text: '다시 굴린 답의 속마음', turn: mb.state.turn }; mb.core.app.mindPop();   // 스와이프: 같은 턴 · 같은 사람 · 새 글(내 언어)
    assert.equal(mb.spawned.at(-1).text, '다시 굴린 답의 속마음');
    await sleep(600);                    // JP2 번역이 이제 옴
    const ts = [...doc.querySelectorAll('#ss-mind-pops .ss-mpop-t')].map(x => x.textContent);
    assert.deepEqual(ts, ['다시 굴린 답의 속마음'], '새 말풍선 글 그대로: ' + ts.join(' / '));
    // 원문 말풍선이 아직 떠 있으면 그것은 바꿔 끼워요(예전 그대로)
    const b = make({ delay: 500, wait: 150 });
    newTurn(b.mb); await sleep(250);
    b.mb.state.data.rel.user[0].mind = { text: '또 다른 글', turn: b.mb.state.turn }; b.mb.core.app.mindPop();
    await sleep(500);
    const tb = [...b.doc.querySelectorAll('#ss-mind-pops .ss-mpop-t')].map(x => x.textContent);
    assert.deepEqual(tb, [KO2, '또 다른 글'], tb.join(' / '));
});
await test('⑯ (버그 사냥 6) 말풍선 묶음은 위 띠(#ss-hud) 아래 — 띠가 커지면 내려가고 작아지면 그 확장 자리로 · 위 모서리도 띠 아래 · 아래 모서리 · 스위치 끔은 그대로', async () => {
    const { dom, doc } = env();
    const win = dom.window;
    let hb = 140;
    const hud = doc.createElement('div'); hud.id = 'ss-hud'; doc.body.append(hud);
    hud.getBoundingClientRect = () => ({ top: 46, bottom: hb, left: 10, right: 400, width: 390, height: hb - 46 });
    const box = doc.createElement('div'); box.id = 'ss-mind-pops'; doc.body.append(box);
    box.getBoundingClientRect = () => ({ top: parseFloat(box.style.top) || 0, bottom: (parseFloat(box.style.top) || 0) + 60, left: 240, right: 394, width: 154, height: 60 });
    Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true });
    let on = true;
    const P = M.createPopPlacer(doc, { on: () => on });
    box.setAttribute('style', 'top: 148px; right: 18px;'); box.dataset.at = 'hud';   // 그 확장이 띠 아래에 잡은 자리
    assert.equal(P.watch(), false, '띠 아래면 그대로');
    hb = 200; assert.equal(P.place(), true); assert.equal(box.style.top, '208px', '띠가 커지면 내려가요');
    hb = 140; P.place(); assert.equal(box.style.top, '148px', '작아지면 그 확장이 잡은 자리로');
    box.setAttribute('style', 'top: 64px; right: 12px;'); box.dataset.at = 'free';   // 위 오른쪽 모서리(고정 64px)
    P.watch(); assert.equal(box.style.top, '148px', '위 모서리도 띠 아래(말풍선 움직임 시작에 다시 봐요)');
    box.setAttribute('style', 'bottom: 90px; right: 12px;'); P.watch(); assert.equal(box.style.top, '', '아래 모서리는 그대로');
    on = false; box.setAttribute('style', 'top: 64px; right: 12px;'); P.watch(); assert.equal(box.style.top, '64px', '스위치 끔은 그대로');
    on = true; hud.remove(); P.watch(); assert.equal(box.style.top, '64px', '띠가 없으면 그대로');
    P.stop();
    const src = (await import('node:fs')).readFileSync(path.join(root, 'src/mb-mind-tr.js'), 'utf8');
    assert.match(src, /createPopPlacer\(doc, \{ on: \(\) => mbFit\('mindpop', doc\) \}\)/);
    assert.match(src, /afterPop: \(\) => placer\.watch\(\) \}/);
    assert.match(src, /addEventListener\('animationstart', e => \{ if \(isPopStart\(e\)\) placer\.watch\(\); \}, true\)/);
    assert.ok(!/new win\.MutationObserver/.test(src), '따로 DOM 감시자 없음(관찰자 상한)');
});
await test('⑱ (1.8.7) 생각 꼬리까지 띠 아래 · 띠를 새로 만들어도 따라감 · 움직임 줄이기 신호', async () => {
    const { dom, doc } = env();
    const win = dom.window;
    Object.defineProperty(win, 'innerHeight', { value: 832, configurable: true });
    const mkHud = (bottom) => { const h = doc.createElement('div'); h.id = 'ss-hud'; doc.body.prepend(h); h.getBoundingClientRect = () => ({ top: 46, bottom, left: 10, right: 374, width: 364, height: bottom - 46 }); return h; };
    let hud = mkHud(82);
    const box = doc.createElement('div'); box.id = 'ss-mind-pops'; doc.body.append(box);
    box.getBoundingClientRect = () => ({ top: parseFloat(box.style.top) || 0, bottom: (parseFloat(box.style.top) || 0) + 60, left: 232, right: 366, width: 134, height: 60 });
    const p = doc.createElement('div'); p.className = 'ss-mpop c-cast'; box.append(p);
    const b = doc.createElement('div'); b.className = 'ss-mpop-b'; p.append(b);
    // 꼬리: ::after top −24px(그 확장 css/mind.css) · 맞춤 시트 여백이 없으면 offsetTop 0
    let padTop = 0;
    Object.defineProperty(p, 'offsetParent', { get: () => box, configurable: true });
    Object.defineProperty(p, 'offsetTop', { get: () => padTop, configurable: true });
    const realGCS = win.getComputedStyle.bind(win);
    win.getComputedStyle = (el, ps) => (el === p && ps === '::after') ? { position: 'absolute', content: '""', display: 'block', top: '-24px' } : (el === p && ps === '::before') ? { position: 'absolute', content: '""', display: 'block', top: '-14px' } : realGCS(el, ps);
    const P = M.createPopPlacer(doc, { on: () => true });
    box.setAttribute('style', 'top: 90px; right: 18px;');   // 그 확장 자리(띠 아래 끝 82 + 8)
    assert.equal(P.watch(), true, '시트 여백이 없으면 꼬리 길이만큼 내려요');
    assert.equal(box.style.top, '110px', '82 + 24 + 4');
    padTop = 20; box.setAttribute('style', 'top: 90px; right: 18px;');
    assert.equal(P.watch(), false, '맞춤 시트 여백(20)이 있으면 그 확장 자리 그대로(첫 장면부터 튀지 않음)');
    // 띠를 지웠다 새로 만든 뒤 더 커지면 — 새 띠를 기준으로(1.8.6 은 지운 띠를 계속 봤어요)
    hud.remove(); hud = mkHud(142);
    assert.equal(P.place(), true); assert.equal(box.style.top, '150px', '새 띠 아래');
    // 새 말풍선 알림: 맞춤 시트 신호(말풍선 글 칸 · 움직임 줄이기에서도) · 그 확장 움직임 · 다른 곳 신호는 아님
    assert.equal(M.isPopStart({ animationName: M.POP_SIGNAL, target: b }), true);
    assert.equal(M.isPopStart({ animationName: M.POP_ANIM, target: p }), true);
    const other = doc.createElement('div'); other.className = 'ss-mpop-b'; doc.body.append(other);
    assert.equal(M.isPopStart({ animationName: M.POP_SIGNAL, target: other }), false, '띠 신호(ss-pulse)와 가려요');
    assert.equal(M.isPopStart({ animationName: 'ss-boing', target: p }), false);
    P.stop();
    const css = (await import('node:fs')).readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(css.includes('#ss-mind-pops.ss-root:has(> .ss-mpop.c-cast:first-child) { padding-top: 20px; }'), '꼬리 여백');
    assert.ok(css.includes('#ss-mind-pops > .ss-mpop > .ss-mpop-b { animation: ss-pulse .001s 1 !important; }'), '움직임 줄이기에서도 도는 신호');
});
await test('⑰ (버그 사냥 6) 원문을 한 번도 안 그려요 — 말풍선은 대기 표시 → 번역본 · 탭 글도 대기 표시 → 번역본 · 실패 · 시간 넘음일 때만 원문', async () => {
    const { mb, doc, mind } = make({ delay: 300, wait: 2000 });
    mb.tr.trString = s => (s === '아린' ? 'Arin' : s);   // 말풍선 머리 이름이 번역 이름이어도 대기 표시를 걷어요
    const seen = new Set(); let stop = false;
    (async () => { while (!stop) { for (const el of doc.querySelectorAll('#ss-mind-pops .ss-mpop-t, [data-bl-mind-src]')) seen.add(el.textContent); await sleep(10); } })();
    newTurn(mb);
    assert.equal(mb.waits.length, 1, '대기 표시 말풍선'); assert.equal(mb.spawned.length, 0);
    doc.body.insertAdjacentHTML('beforeend', `<div class="ss-scope"><div class="ss-mindc"><p class="ss-mind big">${JP2}</p></div></div>`);
    const tab = doc.querySelector('.ss-mind.big');
    mind.onAnim({ animationName: M.ANIM, target: tab });
    assert.equal(tab.textContent, M.WAIT_TEXT, '탭 글도 대기 표시'); assert.equal(tab.getAttribute(M.SRC_ATTR), JP2);
    await sleep(500);
    assert.equal(mb.spawned.at(-1).text, KO2); assert.equal(tab.textContent, KO2);
    assert.equal(doc.querySelectorAll('#ss-mind-pops .ss-mpop').length, 1, '대기 표시 말풍선은 걷힘');
    stop = true; await sleep(20);
    assert.ok(![...seen].some(t => t.includes(JP2)), '원문이 화면에 한 번도 없어요: ' + [...seen].join(' / '));
    // 번역 실패 → 원문
    const f = make({ delay: 50, wait: 2000, fail: new Set([JP1]) });
    f.doc.body.insertAdjacentHTML('beforeend', `<div class="ss-scope"><div class="ss-mindc"><p class="ss-mind big">${JP1}</p></div></div>`);
    const t1 = f.doc.querySelector('.ss-mind.big'); f.mind.onAnim({ animationName: M.ANIM, target: t1 });
    assert.equal(t1.textContent, M.WAIT_TEXT); await sleep(300);
    assert.equal(t1.textContent, JP1, '실패하면 원문'); assert.equal(t1.hasAttribute(M.WAIT_ATTR), false);
    // 시간 넘음 → 원문
    const s = make({ delay: 900, wait: 200 });
    s.doc.body.insertAdjacentHTML('beforeend', `<div class="ss-scope"><div class="ss-mindc"><p class="ss-mind big">${JPW}</p></div></div>`);
    const t2 = s.doc.querySelector('.ss-mind.big'); s.mind.onAnim({ animationName: M.ANIM, target: t2 });
    await sleep(350); assert.equal(t2.textContent, JPW, '시간이 넘으면 원문');
    await sleep(800); assert.equal(t2.textContent, KOW, '늦게 오면 번역본으로');
});

await test('⑲ (1.9.1) 지난 속마음 줄: 점자 빈칸으로 받은 번역을 보통 빈칸 글에서도 다시 씀(요청 0) · 접힌 목록은 부탁 안 함 · 펼치면 없는 줄만 한 묶음 · 올 때까지 대기 표시 · 실패한 줄은 펼칠 때 한 번 더', async () => {
    const B = '⠀';
    const JPB = `猫なのに仕事はできる${B}(´ε｀${B})`, JPS = '猫なのに仕事はできる (´ε｀ )', KOB = '고양이인데 일은 잘해 (´ε｀ )';
    const JP3 = '明日は早く帰りたい', KO3 = '내일은 일찍 가고 싶어', JP4 = '傘を忘れた', KO4 = '우산을 두고 왔어';
    DICT.set(JPB, KOB); DICT.set(JP3, KO3); DICT.set(JP4, KO4);
    assert.equal(M.storeKey(JPB), M.storeKey(JPS), '열쇠는 점자 빈칸 · 보통 빈칸을 같게');
    // 옛 판이 글자 그대로 적어 둔 모음(점자 빈칸 글)도 읽어요
    const storage = memStorage(); storage.setItem(M.STORE, JSON.stringify({ v: 1, ko: [[JPB, KOB]] }));
    const { mb, mind, doc } = make({ delay: 30, storage });
    assert.equal(mind.store.get('ko', JPS), KOB);
    const logHtml = lines => `<div class="ss-root ss-scope"><div class="ss-card ss-mindc"><details class="ss-more"><summary>지난 속마음</summary><ul class="ss-mind-log">${lines.map(t => `<li><span>${t}</span><small>1턴 전</small></li>`).join('')}</ul></details></div></div>`;
    doc.body.insertAdjacentHTML('beforeend', logHtml([JPS, JP3, JP4]));
    const det = doc.querySelector('details.ss-more'), [s1, s2, s3] = det.querySelectorAll('span');
    // 접힌 채 신호가 와도: 모음에 있는 줄만 번역본 · 나머지는 부탁하지 않고 「본 표식」 없이(시트가 투명하게 둬요)
    for (const el of [s1, s2, s3]) mind.onAnim({ animationName: M.ANIM, target: el });
    await sleep(200);
    assert.equal(s1.textContent, KOB, '받아 둔 번역을 다시 씀'); assert.equal(s1.title, `원문: ${JPS}`);
    assert.equal(mb.calls.length, 0, '접힌 동안 요청 0');
    assert.equal(s2.textContent, JP3); assert.equal(s2.hasAttribute(M.SEEN_ATTR), false, '접힌 줄은 투명 그대로');
    // 펼침: 없는 두 줄을 한 번에 · 올 때까지 대기 표시
    det.open = true; mind.onToggle({ target: det });
    assert.equal(s2.textContent, M.WAIT_TEXT); assert.equal(s3.textContent, M.WAIT_TEXT); assert.ok(s2.hasAttribute(M.SEEN_ATTR));
    await sleep(300);
    assert.equal(s2.textContent, KO3); assert.equal(s3.textContent, KO4);
    assert.deepEqual(mb.calls, [`${JP3}\n${JP4}`], '한 묶음 한 번');
    det.open = false; det.open = true; mind.onToggle({ target: det });
    await sleep(200); assert.equal(mb.calls.length, 1, '다시 펼쳐도 요청 0');
    // 실패한 줄: 그 접속 내내 원문이던 것을 펼칠 때 한 번 더 부탁
    const fail = new Set([JP3]);
    const f = make({ delay: 20, fail });
    f.doc.body.insertAdjacentHTML('beforeend', logHtml([JP3]));
    const fd = f.doc.querySelector('details.ss-more'), fs1 = fd.querySelector('span');
    fd.open = true; f.mind.onToggle({ target: fd });
    await sleep(250); assert.equal(fs1.textContent, JP3, '실패하면 원문');
    fail.delete(JP3); fd.open = false; fd.open = true; f.mind.onToggle({ target: fd });
    assert.equal(fs1.textContent, M.WAIT_TEXT);
    await sleep(250); assert.equal(fs1.textContent, KO3, '펼칠 때 다시 부탁해 번역본');
});

console.log(`mb-mind-tr: ${passed} 통과`);
