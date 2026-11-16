// 최적화 3차: 번역 단추 여섯 개를 실리태번 메시지 틀(#message_template)에 넣어 둔 뒤에도, 새 메시지의 단추 줄이 예전(메시지가 붙을 때 그 메시지에 끼움)과 같은지 — jsdom.
//   node tools/tests/translator-message-template.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// 견주는 법: 「예전」 = 단추 없는 틀을 복제 → 감시 콜백 자리에서 여섯 개를 메뉴 맨 앞에. 「지금」 = 단추 든 틀을 복제 → 같은 자리에서 settleTemplated. 두 메시지의 HTML 이 글자까지 같아야 해요.
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

const { ensureTemplateButtons, markSettled, settleTemplated, pendingTail, TEMPLATED } = await import(pathToFileURL(path.join(root, 'src/addons/translator/template-buttons.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log(`  통과  ${name}`); };

const TEMPLATE = `<div id="message_template"><div class="mes" mesid=""><div class="mes_block"><div class="ch_name"><div class="mes_buttons">
<div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis"></div><div class="extraMesButtons"><div class="mes_button mes_translate fa-solid fa-language"></div><div class="mes_button mes_copy fa-solid fa-copy"></div></div>
<div class="mes_button mes_bookmark fa-solid fa-flag"></div><div class="mes_button mes_edit fa-solid fa-pencil"></div></div></div><div class="mes_text"></div></div></div></div><div id="chat"></div>`;
const BUTTONS = [
    ['mes_legacy_translate fa-solid fa-brain', 'LLM 번역 (기존)'], ['mes_llm_translate fa-solid fa-right-left', 'LLM 번역/전환'], ['mes_toggle_original fa-solid fa-magnifying-glass', '원문/번역 전환'],
    ['mes_edit_translation fa-solid fa-pen-to-square', '번역문 수정'], ['mes_paragraph_correction fa-solid fa-wrench', '문단 수 교정'], ['mes_delete_translation fa-solid fa-trash', '번역문 삭제'],
];
function world(hidden = []) {
    const doc = new JSDOM(`<!doctype html><html><body>${TEMPLATE}</body></html>`).window.document;
    // 본체 · 껍데기의 translateButtonsFragment 와 같은 조각(숨김 설정은 style="display: none;")
    const fragment = () => { const f = doc.createDocumentFragment(); for (const [classes, title] of BUTTONS) { const b = doc.createElement('div'); b.className = `mes_button ${classes} interactable`; b.setAttribute('title', title); b.setAttribute('data-i18n', `[title]${title}`); b.setAttribute('tabindex', '0'); if (hidden.includes(classes.split(' ')[0])) b.setAttribute('style', 'display: none;'); f.append(b); } return f; };
    const clone = () => { const mes = doc.querySelector('#message_template .mes').cloneNode(true); doc.getElementById('chat').append(mes); return mes; };
    return { doc, fragment, clone };
}
const names = mes => [...mes.querySelector('.extraMesButtons').children].map(el => el.className.split(' ')[1]);
const SIX = BUTTONS.map(([classes]) => classes.split(' ')[0]);

test('틀에 여섯 개를 메뉴 맨 앞에 한 번만 넣어요', () => {
    const { doc, fragment } = world();
    assert.equal(ensureTemplateButtons(fragment, doc), true);
    assert.equal(ensureTemplateButtons(fragment, doc), false);
    assert.deepEqual(names(doc.querySelector('#message_template .mes')), [...SIX, 'mes_translate', 'mes_copy']);
    assert.equal(ensureTemplateButtons(fragment, new JSDOM('<body></body>').window.document), false, '틀이 없으면 아무 일도 없어요');
    assert.equal(ensureTemplateButtons(fragment, null), false);
});
test('새 메시지의 HTML 이 예전(붙을 때 끼움)과 글자까지 같아요 — 숨김 설정 포함', () => {
    for (const hidden of [[], ['mes_legacy_translate', 'mes_delete_translation']]) {
        const old = world(hidden); const a = old.clone(); a.querySelector('.extraMesButtons').prepend(old.fragment());
        const now = world(hidden); ensureTemplateButtons(now.fragment, now.doc); const b = now.clone();
        assert.equal(settleTemplated(b), true);
        assert.equal(b.outerHTML, a.outerHTML);
    }
});
test('다른 확장이 뒤늦게 틀 맨 앞에 제 단추를 넣어도, 새 메시지에서는 여섯 개가 예전처럼 맨 앞이에요', () => {
    const add = doc => { const x = doc.createElement('div'); x.className = 'mes_button other_ext fa-solid'; doc.querySelector('#message_template .extraMesButtons').prepend(x); };
    const old = world(); add(old.doc); const a = old.clone(); a.querySelector('.extraMesButtons').prepend(old.fragment());
    const now = world(); ensureTemplateButtons(now.fragment, now.doc); add(now.doc); const b = now.clone();
    assert.deepEqual(names(b).slice(0, 2), ['other_ext', 'mes_legacy_translate'], '틀에서는 그 단추가 앞');
    assert.equal(settleTemplated(b), true);
    assert.equal(b.outerHTML, a.outerHTML);
    assert.deepEqual(names(b), [...SIX, 'other_ext', 'mes_translate', 'mes_copy']);
});
test('먼저 돈 다른 감시(읽기 단추)가 메뉴 앞에 끼운 뒤여도 예전과 같은 차례예요', () => {
    const lv = (doc, mes) => { const p = doc.createElement('div'); p.className = 'mes_button lv_play fa-solid'; mes.querySelector('.extraMesButtons').prepend(p); };
    const old = world(); const a = old.clone(); lv(old.doc, a); a.querySelector('.extraMesButtons').prepend(old.fragment());
    const now = world(); ensureTemplateButtons(now.fragment, now.doc); const b = now.clone(); lv(now.doc, b);
    settleTemplated(b);
    assert.equal(b.outerHTML, a.outerHTML);
    // 번역 쪽이 먼저 돌고 읽기 단추가 나중에 끼우는 차례도
    const old2 = world(); const c = old2.clone(); c.querySelector('.extraMesButtons').prepend(old2.fragment()); lv(old2.doc, c);
    const now2 = world(); ensureTemplateButtons(now2.fragment, now2.doc); const d = now2.clone(); settleTemplated(d); lv(now2.doc, d);
    assert.equal(d.outerHTML, c.outerHTML);
});
test('읽기 단추 쪽이 pendingTail 로 물어 여섯 개 뒤에 끼우면 옮기는 일 없이 예전 끝 차례예요 · 번역 쪽이 먼저 돈 뒤면 예전처럼 맨 앞', () => {
    const lvNode = doc => { const p = doc.createElement('div'); p.className = 'mes_button lv_play fa-solid'; return p; };
    // 읽기 쪽이 먼저(지금 구성): 예전 = 맨 앞에 끼움 → 번역 쪽이 여섯 개를 그 앞에
    const old = world(); const a = old.clone(); a.querySelector('.extraMesButtons').prepend(lvNode(old.doc)); a.querySelector('.extraMesButtons').prepend(old.fragment());
    const now = world(); ensureTemplateButtons(now.fragment, now.doc); const b = now.clone();
    const tail = pendingTail(b); assert.ok(tail?.classList.contains('mes_delete_translation'));
    assert.equal(globalThis[TEMPLATED].pendingTail(b), tail, '전역 다리로도 같은 답');
    tail.after(lvNode(now.doc));
    let moved = 0; const extra = b.querySelector('.extraMesButtons'); const prepend = extra.prepend.bind(extra); extra.prepend = (...n) => { moved += n.length; return prepend(...n); };
    assert.equal(settleTemplated(b), true); assert.equal(moved, 0, '옮긴 단추 없음');
    assert.equal(b.outerHTML, a.outerHTML);
    // 번역 쪽이 먼저: 자리 확인이 끝난 메시지는 null → 읽기 쪽이 예전처럼 맨 앞에
    const now2 = world(); ensureTemplateButtons(now2.fragment, now2.doc); const c = now2.clone(); settleTemplated(c);
    assert.equal(pendingTail(c), null);
    // 번역 단추가 없는 메시지 · 여섯 개가 맨 앞이 아닌 메시지도 null
    const plain = world(); assert.equal(pendingTail(plain.clone()), null);
    const now3 = world(); ensureTemplateButtons(now3.fragment, now3.doc); const d = now3.clone(); d.querySelector('.extraMesButtons').prepend(lvNode(now3.doc)); assert.equal(pendingTail(d), null);
    assert.equal(pendingTail(null), null);
    const tts = fs.readFileSync(path.join(root, 'src/addons/tts/index.js'), 'utf8');
    assert.ok(tts.includes("Symbol.for('blue-lemonade.translator.templated')") && tts.includes('if (tail) tail.after(...nodes); else box.prepend(...nodes);'));
});
test('한 번 본 메시지 · 직접 끼운 메시지 · 단추를 꺼내 둔 메시지는 다시 옮기지 않아요', () => {
    const { doc, fragment, clone } = world(); ensureTemplateButtons(fragment, doc);
    const a = clone(); assert.equal(settleTemplated(a), true); assert.equal(settleTemplated(a), false);
    // 꺼내 둔(핀) 뒤 다시 붙은 메시지: 여섯 개가 메뉴에 다 없으니 그대로
    const b = clone(); const bar = b.querySelector('.mes_buttons'); bar.insertBefore(b.querySelector('.mes_toggle_original'), bar.firstChild);
    const before = b.outerHTML; assert.equal(settleTemplated(b), false); assert.equal(b.outerHTML, before);
    // 직접 끼운 메시지(틀을 안 거침)
    const plain = new JSDOM(`<body>${TEMPLATE}</body>`).window.document; const c = plain.querySelector('#message_template .mes').cloneNode(true);
    c.querySelector('.extraMesButtons').prepend(fragment()); markSettled(c); assert.equal(settleTemplated(c), false);
    assert.equal(settleTemplated(null), false);
});
test('껍데기 · 본체가 같은 길을 써요(틀 넣기 · 감시 콜백 · 핀 고르기 목록의 틀 단추 빼기)', () => {
    const shell = fs.readFileSync(path.join(root, 'src/addons/translator/shell.js'), 'utf8'), index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    for (const src of [shell, index]) {
        assert.ok(src.includes("from './template-buttons.js'"));
        assert.ok(src.includes('ensureTemplateButtons(translateButtonsFragment);'));
        assert.ok(src.includes('if (createTranslateButtons(node)) markSettled(node);'));
    }
    assert.ok(index.includes("else if (settleTemplated(node) && typeof checkView !== 'undefined') checkView.paintFromCache(node.getAttribute('mesid'));"), '본체는 틀에서 온 새 메시지에도 번역 점검 표시를 한 번 칠해요');
    assert.ok(shell.includes('else settleTemplated(node);'));
    const pins = fs.readFileSync(path.join(root, 'src/mes-pins.js'), 'utf8');
    for (const name of SIX) assert.ok(pins.includes(`'${name}'`), `mes-pins TEMPLATED_ADDON ${name}`);
    assert.ok(pins.includes('.filter(el => !TEMPLATED_ADDON.has(basePinKey(el)))'));
});
console.log(`translator-message-template: ${pass}개 통과`);
