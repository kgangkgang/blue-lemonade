// 8.2.7 번역 단추 여섯 개: 메시지마다 jQuery 로 하나씩 짓고 여섯 번 붙인 뒤 가시성을 다시 맞추던 일을, 숨김 설정마다 한 번 만든 틀 복제 + 한 번 붙이기로 (perf-addons).
//   붙는 DOM 은 예전과 같아야 해요(순서 · 클래스 · title · data-i18n · tabindex · 숨김 style). 감시자는 새 메시지에 가시성 맞추기를 다시 돌리지 않아요.
//   node tools/tests/translator-buttons-template.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { documentLite, parseHtml } from './leak-dom.mjs';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const start = src.indexOf('const TRANSLATE_BUTTONS = [');
const end = src.indexOf('// 기존 메시지에 아이콘 추가', start);
check('번역 단추는 한 번 만든 틀을 복제해 붙여요', () => {
    assert.ok(start > 0 && end > start, 'TRANSLATE_BUTTONS 틀 · createTranslateButtons 가 없어요(예전처럼 메시지마다 jQuery 로 지어요)');
    assert.match(src.slice(start, end), /cloneNode\(true\)/);
    assert.doesNotMatch(src.slice(start, end), /\$\('<div>'\)/);
});

// 예전 구현이 남기던 DOM(같은 순서로 직접 지음): 휴지통 · 렌치 · 연필 · 돋보기 · ⇄ · 뇌 순서로 앞에 붙여 최종 순서는 뇌 · ⇄ · 돋보기 · 연필 · 렌치 · 휴지통
const OLD = [
    ['mes_button mes_legacy_translate fa-solid fa-brain interactable', 'LLM 번역 (기존)', 'hide_legacy_translate_button'],
    ['mes_button mes_llm_translate fa-solid fa-right-left interactable', 'LLM 번역/전환', 'hide_new_translate_button'],
    ['mes_button mes_toggle_original fa-solid fa-magnifying-glass interactable', '원문/번역 전환', 'hide_toggle_button'],
    ['mes_button mes_edit_translation fa-solid fa-pen-to-square interactable', '번역문 수정', 'hide_edit_button'],
    ['mes_button mes_paragraph_correction fa-solid fa-wrench interactable', '문단 수 교정', 'hide_paragraph_button'],
    ['mes_button mes_delete_translation fa-solid fa-trash interactable', '번역문 삭제', 'hide_delete_button'],
];
function oldButtons(box, settings) {
    const made = OLD.map(([cls, title, hide]) => { const el = documentLite.createElement('div'); el.className = cls; el.setAttribute('title', title); el.setAttribute('data-i18n', `[title]${title}`); el.setAttribute('tabindex', '0'); if (settings[hide]) el.setAttribute('style', 'display: none;'); return el; });
    for (const el of made.slice().reverse()) box.prepend(el);
}
const message = id => parseHtml(`<div class="mes" mesid="${id}"><div class="ch_name"><div class="mes_buttons"><div class="extraMesButtons"><div class="mes_button mes_edit fa-solid fa-pencil"></div></div></div></div><div class="mes_text">지어낸 글이에요.</div></div>`)[0];

let make = null;
if (start > 0 && end > start) {
    const settings = {};
    const factory = new Function('document', 'extensionSettings', `${src.slice(start, end)}\nreturn { createTranslateButtons, settings: extensionSettings };`);
    make = (s) => { Object.keys(settings).forEach(k => delete settings[k]); Object.assign(settings, s); return factory(documentLite, settings); };
}

for (const [label, settings] of [['숨김 없음', {}], ['일부 숨김', { hide_legacy_translate_button: true, hide_delete_button: true }], ['모두 숨김', Object.fromEntries(OLD.map(([, , h]) => [h, true]))]]) {
    check(`붙는 DOM 이 예전과 같아요 — ${label}`, () => {
        assert.ok(make, '새 구현이 없어요');
        const { createTranslateButtons } = make(settings);
        const a = message(3), b = message(3);
        oldButtons(b.querySelector('.extraMesButtons'), settings);
        const box = a.querySelector('.extraMesButtons'); let calls = 0; const prepend = box.prepend.bind(box); box.prepend = (...n) => { calls++; return prepend(...n); };
        assert.equal(createTranslateButtons(a), true);
        assert.equal(a.outerHTML, b.outerHTML);
        assert.equal(calls, 1, '메시지마다 한 번에 붙여요(감시자들이 받는 변경 기록 하나)');
        // 이미 있으면 그대로(두 번 붙이지 않음)
        assert.equal(createTranslateButtons(a), false);
        assert.equal(a.outerHTML, b.outerHTML);
    });
}

check('숨김 설정이 바뀌면 다음 메시지부터 새 틀로 붙여요', () => {
    assert.ok(make);
    const settings = {};
    const factory = new Function('document', 'extensionSettings', `${src.slice(start, end)}\nreturn createTranslateButtons;`);
    const create = factory(documentLite, settings);
    const a = message(1); create(a);
    settings.hide_toggle_button = true;
    const c = message(2); create(c);
    const d = message(2); oldButtons(d.querySelector('.extraMesButtons'), settings);
    assert.equal(c.outerHTML, d.outerHTML);
    assert.equal(a.querySelector('.mes_toggle_original').getAttribute('style'), null);
});

check('jQuery 로 감싼 메시지 · 단추 칸이 없는 메시지도 받아요', () => {
    assert.ok(make);
    const { createTranslateButtons } = make({});
    const a = message(4);
    assert.equal(createTranslateButtons({ jquery: '3.7.1', 0: a, length: 1 }), true);
    assert.ok(a.querySelector('.mes_llm_translate'));
    const bare = parseHtml('<div class="mes" mesid="5"><div class="mes_text"></div></div>')[0];
    assert.equal(createTranslateButtons(bare), false);
});

check('새 메시지 감시자는 가시성 맞추기를 메시지마다 다시 돌리지 않아요', () => {
    const at = src.indexOf('window.llmTranslatorObserver = new MutationObserver(');
    assert.ok(at > 0);
    const body = src.slice(at, src.indexOf('window.llmTranslatorObserver.observe(', at));
    assert.doesNotMatch(body, /updateButtonVisibility\(/);
    assert.match(body, /createTranslateButtons\(node\)/);
});

console.log(`translator-buttons-template: ${passed}개 통과`);
