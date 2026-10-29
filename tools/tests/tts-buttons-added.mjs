// 8.2.7 TTS 읽기 · 소리 대본 단추: #chat 감시자가 불릴 때마다 채팅 전체를 다시 훑던 것을, 새로 붙은 메시지만 보게 (perf-addons).
//   붙는 DOM 은 예전과 같아야 해요(읽기 · 대본 · 원래 단추 순서, 시스템 메시지 건너뜀, 이미 있는 단추는 그대로).
//   node tools/tests/tts-buttons-added.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { documentLite, parseHtml } from './leak-dom.mjs';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/tts/index.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const start = src.indexOf('function addButtonsTo(el) {');
const end = src.indexOf('function onPlayClick(el) {', start);
check('감시자는 새로 붙은 메시지만 봐요', () => {
    assert.ok(start > 0 && end > start, 'addButtonsTo · addButtonsFor 가 없어요(감시자가 채팅 전체를 훑어요)');
    assert.match(src, /new MutationObserver\(addButtonsFor\)\.observe\(chatEl, \{ childList: true \}\)/);
    assert.doesNotMatch(src, /new MutationObserver\(\(\) => addButtons\(\)\)/);
});

// 예전 구현(그대로 옮김)
function oldAddButtons(chatRoot, chat) {
    for (const el of chatRoot.querySelectorAll('.mes')) {
        const mes = chat[Number(el.getAttribute('mesid'))];
        if (mes && mes.is_system) continue;
        const box = el.querySelector('.extraMesButtons');
        if (!box) continue;
        if (!el.querySelector('.lv_script')) { const edit = documentLite.createElement('div'); edit.className = 'mes_button lv_script fa-solid fa-file-audio interactable'; edit.tabIndex = 0; edit.setAttribute('role', 'button'); edit.setAttribute('aria-label', '소리 대본 편집'); box.prepend(edit); }
        if (el.querySelector('.lv_play')) continue;
        const btn = documentLite.createElement('div'); btn.className = 'mes_button lv_play fa-solid fa-volume-high interactable'; btn.tabIndex = 0; btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', '읽기'); box.prepend(btn);
    }
}
const mesHtml = (id, inner = '') => `<div class="mes" mesid="${id}"><div class="extraMesButtons">${inner}<div class="mes_button mes_edit"></div></div><div class="mes_text">지어낸 글</div></div>`;
const chatHtml = () => `<div id="chat">${mesHtml(0)}${mesHtml(1, '<div class="mes_button lv_play fa-solid fa-volume-high interactable" tabindex="0" role="button" aria-label="읽기"></div>')}${mesHtml(2, '<div class="mes_button lv_script fa-solid fa-file-audio interactable" tabindex="0" role="button" aria-label="소리 대본 편집"></div>')}${mesHtml(3)}<div class="mes" mesid="4"><div class="mes_text"></div></div></div>`;
const chat = [{ mes: 'a' }, { mes: 'b' }, { mes: 'c' }, { mes: 'd', is_system: true }, { mes: 'e' }];

let api = null;
if (start > 0 && end > start) {
    const factory = new Function('document', 'runtimeEnabled', 'msgOf', `${src.slice(start, end)}\nreturn { addButtonsTo, addButtons: typeof addButtons === 'function' ? addButtons : null, addButtonsFor };`);
    api = chatRoot => factory({ querySelectorAll: sel => chatRoot.querySelectorAll(sel.replace(/^#chat\s+/, '')), createElement: t => documentLite.createElement(t) }, () => true, id => chat[id]);
}

check('붙는 DOM 이 예전과 같아요 (둘 다 없음 · 읽기만 있음 · 대본만 있음 · 시스템 · 단추 칸 없음)', () => {
    assert.ok(api);
    const a = parseHtml(chatHtml())[0], b = parseHtml(chatHtml())[0];
    api(a).addButtons();
    oldAddButtons(b, chat);
    assert.equal(a.outerHTML, b.outerHTML);
    // 두 번 불러도 그대로
    api(a).addButtons();
    assert.equal(a.outerHTML, b.outerHTML);
});

check('감시자 기록의 새 메시지에만 붙이고, 이미 있던 메시지는 다시 보지 않아요', () => {
    assert.ok(api);
    const a = parseHtml(chatHtml())[0];
    const { addButtonsFor } = api(a);
    const fresh = parseHtml(mesHtml(5))[0];
    const wrap = parseHtml(`<div class="wrapper">${mesHtml(6)}</div>`)[0];
    a.append(fresh, wrap);
    let looked = 0; for (const el of a.querySelectorAll('.mes')) { const q = el.querySelector.bind(el); el.querySelector = s => { looked++; return q(s); }; }
    addButtonsFor([{ addedNodes: [fresh, wrap, documentLite.createTextNode?.('x') ?? { nodeType: 3 }] }]);
    const lookedInCallback = looked;
    assert.ok(fresh.querySelector('.lv_play') && fresh.querySelector('.lv_script'));
    assert.ok(wrap.querySelector('.lv_play'));
    assert.equal(a.querySelector('[mesid="0"] .lv_play'), null, '이미 있던 메시지는 감시자 콜백에서 다시 훑지 않아요');
    assert.ok(lookedInCallback <= 6, `새 메시지 두 개만 봤어야 해요(querySelector ${lookedInCallback}번)`);
    const order = [...fresh.querySelector('.extraMesButtons').children].map(el => el.className.split(' ')[1]);
    assert.deepEqual(order, ['lv_play', 'lv_script', 'mes_edit']);
});

console.log(`tts-buttons-added: ${passed}개 통과`);
