// 최적화 3차: src/icon-text.js 의 휴지통 감싼 요소 표식(data-bl-trash-wrap)이 css/17-semantic.css 의 옛 :has 갈래와 같은 요소를 고르는지 — jsdom 으로 봐요.
//   node tools/tests/trash-wrap-marks.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// 옛 규칙(빌드가 #chat 을 넓힌 꼴): body.salty :where(:not(:is(#chat, .bl-chat-like) .mes_text *)):has(> :is(i, span):only-child:is(.fa-trash, .fa-trash-can, .fa-trash-alt, .fa-skull))
//   주어가 * 인 :has 라 크롬이 메시지 글 밖 모든 요소에 「:has 영향」 표식을 남겼어요 — 같은 조건을 JS 가 재서 속성으로 달아요.
// ① 무작위 나무 300개: 한 번 훑은 표식 = 옛 선택자가 고르는 요소 ② 그 뒤 무작위로 바꾸며(붙이기 · 떼기 · 옮기기 · 아이콘 class) 감시가 부르는 손잡이만 불러도 끝까지 같음
// ③ :only-child 처럼 글자 · 주석은 세지 않음 ④ 원본 CSS 에 옛 갈래가 없고 새 선택자의 특이도가 옛것과 같음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const { trashWrap, checkTrashWrap, touchTrashWrap, scanTrashWraps } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log(`  통과  ${name}`); };

const OLD = 'body.salty :where(:not(:is(#chat, .bl-chat-like) .mes_text *)):has(> :is(i, span):only-child:is(.fa-trash, .fa-trash-can, .fa-trash-alt, .fa-skull))';
const ATTR = 'data-bl-trash-wrap';
let seed = 20261116;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = list => list[Math.floor(rnd() * list.length)];
const TAGS = ['div', 'div', 'span', 'i', 'button', 'a', 'p', 'label'];
const CLASSES = ['', '', '', 'fa-trash', 'fa-trash-can', 'fa-trash-alt', 'fa-skull', 'fa-solid', 'menu_button', 'mes_text', 'mes_button', 'bl-chat-like', 'x'];

function makeDoc() {
    const dom = new JSDOM('<!doctype html><html><body class="salty"><div id="top"></div><div id="sheld"><div id="chat"></div></div><dialog class="popup"><div class="popup-controls"></div></dialog></body></html>');
    return dom.window.document;
}
function grow(doc, parent, depth) {
    const n = Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
        const el = doc.createElement(pick(TAGS));
        const a = pick(CLASSES), b = rnd() < 0.3 ? pick(CLASSES) : '';
        const cls = [a, b].filter(Boolean).join(' '); if (cls) el.className = cls;
        if (rnd() < 0.3) parent.append(doc.createTextNode(' 글자 '));
        if (rnd() < 0.1) parent.append(doc.createComment('주석'));
        parent.append(el);
        if (depth < 5 && rnd() < 0.7) grow(doc, el, depth + 1);
    }
}
function build(doc) {
    const chat = doc.getElementById('chat');
    for (let m = 0; m < 3; m++) {
        const mes = doc.createElement('div'); mes.className = 'mes';
        const bar = doc.createElement('div'); bar.className = 'mes_buttons';
        const text = doc.createElement('div'); text.className = 'mes_text';
        mes.append(bar, text); chat.append(mes);
        grow(doc, bar, 2); grow(doc, text, 2);
    }
    grow(doc, doc.getElementById('top'), 0);
    grow(doc, doc.querySelector('.popup-controls'), 2);
    grow(doc, chat, 3);   // 채팅 칸의 메시지 밖(환영 화면 꼴)
}
const ids = (doc, list) => { const all = [...doc.querySelectorAll('*')]; return [...list].map(el => all.indexOf(el)).sort((a, b) => a - b).join(','); };
const same = (doc, note) => assert.equal(ids(doc, doc.querySelectorAll('[' + ATTR + ']')), ids(doc, doc.querySelectorAll(OLD)), note);

test('jsdom 이 옛 선택자(:has · :only-child)를 알아요', () => {
    const doc = makeDoc();
    doc.getElementById('top').innerHTML = '<div id="a"><i class="fa-trash"></i> 지우기</div><div id="b"><i class="fa-trash"></i><b></b></div><div id="c"><span class="fa-skull"></span><!-- 주석 --></div><div id="d"><b class="fa-trash"></b></div>';
    assert.deepEqual([...doc.querySelectorAll(OLD)].map(el => el.id), ['a', 'c']);
});
test(':only-child 처럼 글자 · 주석은 세지 않고, 아이콘은 <i> · <span> 의 네 class 만', () => {
    const doc = makeDoc(); const top = doc.getElementById('top');
    top.innerHTML = '<div id="a"><i class="fa-solid fa-trash-can"></i> 글자</div><div id="b"><i class="fa-trash"></i><i class="fa-trash"></i></div><div id="c"><b class="fa-trash"></b></div><div id="d"><span class="fa-trash-alt"></span><!-- x --></div><div id="e"><i class="fa-trashes"></i></div><div id="f"></div>';
    assert.deepEqual([...top.children].map(el => trashWrap(el)), [true, false, false, true, false, false]);
});
test('채팅 글(:is(#chat, .bl-chat-like) .mes_text) 안에는 달지 않고, 그 밖의 .mes_text 안에는 달아요', () => {
    const doc = makeDoc();
    doc.getElementById('chat').innerHTML = '<div class="mes"><div class="mes_buttons"><div id="in-bar"><i class="fa-trash"></i></div></div><div class="mes_text"><p id="in-text"><i class="fa-skull"></i></p></div></div>';
    doc.getElementById('top').innerHTML = '<div class="mes_text"><p id="plain-text"><i class="fa-skull"></i></p></div><div class="bl-chat-like"><div class="mes_text"><p id="like-text"><i class="fa-skull"></i></p></div></div>';
    scanTrashWraps(doc.body);
    assert.deepEqual([...doc.querySelectorAll('[' + ATTR + ']')].map(el => el.id).sort(), ['in-bar', 'plain-text']);
    same(doc, '옛 선택자와 같음');
});
test('무작위 나무 300개 — 한 번 훑은 표식이 옛 선택자와 같아요(미리 붙은 헛표식도 걷어요)', () => {
    let marked = 0;
    for (let t = 0; t < 300; t++) {
        const doc = makeDoc(); build(doc);
        for (const el of doc.querySelectorAll('div, span')) if (rnd() < 0.03) el.setAttribute(ATTR, '');   // 복제 · 옛 판이 남긴 헛표식
        scanTrashWraps(doc.body);
        same(doc, `나무 ${t}`);
        marked += doc.querySelectorAll('[' + ATTR + ']').length;
    }
    assert.ok(marked > 100, `표식이 달린 요소가 충분해요(${marked})`);
    console.log(`        표식 ${marked}개`);
});
test('무작위로 바꾸며 감시가 부르는 손잡이만 불러도 끝까지 같아요(붙이기 · 떼기 · 옮기기 · 아이콘 class)', () => {
    let steps = 0;
    for (let t = 0; t < 60; t++) {
        const doc = makeDoc(); build(doc); scanTrashWraps(doc.body);
        for (let k = 0; k < 40; k++) {
            const all = [...doc.body.querySelectorAll('*')].filter(el => el.id !== 'chat' && el.id !== 'sheld');
            const el = pick(all); const kind = rnd();
            if (kind < 0.3) {   // 붙이기 — 감시: 부모(기록 대상) 손대기 + 붙은 뿌리 훑기
                const add = doc.createElement(pick(['i', 'span', 'div'])); const c = pick(CLASSES); if (c) add.className = c;
                if (rnd() < 0.4) { const inner = doc.createElement('i'); inner.className = pick(['fa-trash', 'fa-skull', 'x']); add.append(inner); }
                el.append(add); touchTrashWrap(el); scanTrashWraps(add);
            } else if (kind < 0.55) {   // 떼기 — 감시: 부모 손대기
                const p = el.parentElement; if (!p || p === doc.body) continue;
                el.remove(); touchTrashWrap(p);
            } else if (kind < 0.75) {   // 옮기기 — 옛 부모 · 새 부모 손대기 + 옮긴 뿌리 훑기
                const to = pick(all); const from = el.parentElement;
                if (!from || to === el || el.contains(to)) continue;
                to.append(el); touchTrashWrap(from); touchTrashWrap(to); scanTrashWraps(el);
            } else {   // class 바뀜 — 감시: 그 요소 손대기(아이콘이면 부모를 봐요)
                el.className = pick(CLASSES); touchTrashWrap(el);
                // .mes_text · .bl-chat-like 가 생기고 없어지면 그 아래 판정이 바뀌어요 — 실제로는 채팅 틀의 class 라 실행 중에 안 바뀌어요. 시험에서는 그 가지를 다시 훑어요
                scanTrashWraps(el);
            }
            steps++;
            same(doc, `나무 ${t} · ${k}번째`);
        }
    }
    console.log(`        바꿈 ${steps}번`);
});
test('checkTrashWrap 은 같은 값이면 쓰지 않아요', () => {
    const doc = makeDoc(); const top = doc.getElementById('top');
    top.innerHTML = '<div id="a"><i class="fa-trash"></i></div>';
    const a = doc.getElementById('a'); let writes = 0;
    const set = a.setAttribute.bind(a); a.setAttribute = (...args) => { writes++; return set(...args); };
    checkTrashWrap(a); checkTrashWrap(a); checkTrashWrap(a);
    assert.equal(writes, 1); assert.ok(a.hasAttribute(ATTR));
});
test('원본 CSS 에 옛 :has 갈래가 없고, 새 선택자의 특이도가 옛것과 같아요', () => {
    const lib = createRequire(import.meta.url)(path.join(root, 'tools/css-lib.cjs'));
    const css = fs.readFileSync(path.join(root, 'css/17-semantic.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/:has\(> :is\(i, span\):only-child/.test(css), '옛 갈래가 남아 있어요');
    const tail = ':where(:not(#chat .mes_text *, .salty-panel, .salty-panel *, #nonQRFormItems *, #toast-container *, .popup-controls *))';
    const oldSel = 'body.salty :is(.fa-trash, .fa-trash-can, .fa-trash-alt, .fa-skull, :where(:not(#chat .mes_text *)):has(> :is(i, span):only-child:is(.fa-trash, .fa-trash-can, .fa-trash-alt, .fa-skull)))' + tail;
    const newSel = 'body.salty :is(.fa-trash, .fa-trash-can, .fa-trash-alt, .fa-skull, [data-bl-trash-wrap][data-bl-trash-wrap]:is(bl-s, *))' + tail;
    assert.ok(css.includes(newSel), '새 선택자가 css/17-semantic.css 에 있어요');
    assert.deepEqual(lib.spec(newSel), lib.spec(oldSel));
});
console.log(`trash-wrap-marks: ${pass}개 통과`);
