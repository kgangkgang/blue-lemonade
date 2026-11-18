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
    const spawned = [], calls = [];
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
            el.innerHTML = `<div class="ss-mpop-b"><small><b>${x.who}</b> · 속마음</small><p class="ss-mpop-t">${x.text}</p></div>`;
            box.append(el);
            spawned.push({ who: x.who, text: x.text, at: Date.now() });
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
    return { core, tr, cfg: { numOf: s => ({ sec: Number(s.mindNum?.sec) || 6 }) }, state, chat, spawned, calls, settings };
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

console.log(`mb-mind-tr: ${passed} 통과`);
