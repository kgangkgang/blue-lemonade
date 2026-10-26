// 7.9.9 실리태번 기본 「번역」 확장이 같이 켜져 있을 때 (src/addons/translator/builtin-translate.js): 상태 판정 · 안내 문구(해요체) · MESSAGE_UPDATED 뒤 되살리기 계획.
// 실리태번 1.16 · 1.19 의 translateMessageEdit 과 같은 순서의 가짜 이벤트 버스로 「기본 확장이 먼저 지우고 → 테마가 되살린다」 흐름도 돈다.
//   node tools/tests/translator-builtin-translate.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const B = await import(pathToFileURL(path.join(root, 'src/addons/translator/builtin-translate.js')).href);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS ' + name); };

const HASH = 'h1';
const translated = (over = {}) => ({ name: '인물', is_user: false, mes: 'Hello there.', extra: { display_text: '안녕하세요.', original_text_hash: HASH, ...over } });

t('state: disabledExtensions 에 translate 가 있으면 꺼짐 · 없거나 목록이 없으면 켜짐 · auto_mode 는 글자 그대로(없으면 none)', () => {
    assert.equal(B.builtinTranslateState({ disabledExtensions: ['translate'] }).enabled, false);
    assert.equal(B.builtinTranslateState({ disabledExtensions: [] }).enabled, true);
    assert.equal(B.builtinTranslateState({}).enabled, true);
    assert.equal(B.builtinTranslateState(undefined).autoMode, 'none');
    assert.equal(B.builtinTranslateState({ translate: { auto_mode: 'responses' } }).autoMode, 'responses');
});
t('state.autoFor: 답은 responses · both, 내 글은 inputs · both 에서만 자동 번역 — 꺼져 있으면 늘 거짓', () => {
    const s = mode => B.builtinTranslateState({ disabledExtensions: [], translate: { auto_mode: mode } });
    assert.equal(s('responses').autoFor({ is_user: false }), true);
    assert.equal(s('responses').autoFor({ is_user: true }), false);
    assert.equal(s('inputs').autoFor({ is_user: true }), true);
    assert.equal(s('both').autoFor({ is_user: false }), true);
    assert.equal(s('none').autoFor({ is_user: false }), false);
    assert.equal(B.builtinTranslateState({ disabledExtensions: ['translate'], translate: { auto_mode: 'both' } }).autoFor({ is_user: false }), false);
});
t('notice: 꺼져 있으면 null · 켜져 있으면 해요체 안내 + 끄는 길 · 자동 모드면 「덮어써서」 · 되살렸으면 그 말도', () => {
    assert.equal(B.builtinTranslateNotice(B.builtinTranslateState({ disabledExtensions: ['translate'] })), null);
    const plain = B.builtinTranslateNotice(B.builtinTranslateState({ disabledExtensions: [] }));
    assert.match(plain, /기본 「번역」 확장이 켜져 있어요/); assert.match(plain, /지워서/); assert.match(plain, /꺼 주세요/); assert.match(plain, /누르면 바로 끄고 새로 고쳐요/);
    assert.doesNotMatch(plain, /되살렸어요/);
    assert.ok(/요\.$/.test(plain.trim()), '해요체로 끝난다');
    assert.doesNotMatch(plain, /\b(?!LLM\b)[A-Za-z]{3,}\b/, '영어 문장 없음(용어 LLM 만)');
    const auto = B.builtinTranslateNotice(B.builtinTranslateState({ disabledExtensions: [], translate: { auto_mode: 'responses' } }), { rescued: true });
    assert.match(auto, /기계 번역으로 덮어써서/); assert.match(auto, /지워진 번역문은 되살렸어요/);
});
const on = B.builtinTranslateState({ disabledExtensions: [] });
const auto = B.builtinTranslateState({ disabledExtensions: [], translate: { auto_mode: 'responses' } });
const off = B.builtinTranslateState({ disabledExtensions: ['translate'] });
t('rescue: 기본 확장이 지운 번역문(display_text 없음) · 원문 그대로(해시 같음) · 아는 번역 있음 → 되살린다', () => {
    const m = translated(); delete m.extra.display_text;
    assert.deepEqual(B.rescuePlan({ state: on, message: m, currentHash: HASH, known: '안녕하세요.' }), { display: '안녕하세요.', why: 'deleted' });
});
t('rescue: 꺼져 있으면 · 아는 번역이 없으면 · 시스템 글이면 · 원문이 바뀌었으면(해시 다름) · 해시 자체가 없으면 손대지 않는다', () => {
    const gone = () => { const m = translated(); delete m.extra.display_text; return m; };
    assert.equal(B.rescuePlan({ state: off, message: gone(), currentHash: HASH, known: '안녕하세요.' }), null);
    assert.equal(B.rescuePlan({ state: on, message: gone(), currentHash: HASH, known: null }), null);
    assert.equal(B.rescuePlan({ state: on, message: { ...gone(), is_system: true }, currentHash: HASH, known: '안녕하세요.' }), null);
    assert.equal(B.rescuePlan({ state: on, message: gone(), currentHash: 'h2', known: '안녕하세요.' }), null, '고친 원문은 보통의 편집 처리(다시 번역)로');
    const noHash = gone(); delete noHash.extra.original_text_hash;
    assert.equal(B.rescuePlan({ state: on, message: noHash, currentHash: HASH, known: '안녕하세요.' }), null, '테마가 붙인 번역이 아니었다');
});
t('rescue: 원문 보기 중(original_translation_backup)이면 사용자가 고른 상태 — 손대지 않는다', () => {
    const m = translated({ display_text: undefined, original_translation_backup: '안녕하세요.' }); delete m.extra.display_text;
    assert.equal(B.rescuePlan({ state: on, message: m, currentHash: HASH, known: '안녕하세요.' }), null);
});
t('rescue: 자동 모드의 기본 확장이 제 번역으로 덮어썼으면(번역문이 아는 것과 다름) 되살린다 · 자동 모드가 아니면(none) 다른 번역문은 그대로', () => {
    const m = translated({ display_text: 'Google 번역문' });
    assert.deepEqual(B.rescuePlan({ state: auto, message: m, currentHash: HASH, known: '안녕하세요.' }), { display: '안녕하세요.', why: 'overwritten' });
    assert.equal(B.rescuePlan({ state: on, message: m, currentHash: HASH, known: '안녕하세요.' }), null, 'none 모드는 지우기만 한다 — 다른 번역문은 사용자가 고친 것일 수 있다');
    assert.equal(B.rescuePlan({ state: auto, message: translated(), currentHash: HASH, known: '안녕하세요.' }), null, '같으면 할 일 없음');
});
t('rescue: 사용자가 손으로 고친 번역문(translation_edited = 지금 해시)은 자동 모드라도 덮지 않는다', () => {
    const m = translated({ display_text: '손으로 고친 번역', translation_edited: HASH });
    assert.equal(B.rescuePlan({ state: auto, message: m, currentHash: HASH, known: '안녕하세요.' }), null);
});

// ── 실리태번과 같은 순서의 이벤트 버스: 기본 확장(먼저 등록) → 테마(나중) ──
await (async () => {
    const listeners = []; const emit = async id => { for (const fn of listeners) await fn(id); };
    const settings = { disabledExtensions: [], translate: { auto_mode: 'none' } };
    const chat = [translated()]; let drawn = 0, saved = 0;
    // 실리태번 translate/index.js translateMessageEdit (auto_mode none): 번역문이 있으면 지우고 다시 그린다
    listeners.push(async id => { const m = chat[id]; if (m.is_system || (settings.translate.auto_mode === 'none' && m.extra?.display_text)) { delete m.extra.display_text; drawn++; saved++; } });
    // 테마 handleMessageEdit 의 앞부분: 되살리기
    const known = new Map([[chat[0], '안녕하세요.']]);
    listeners.push(async id => {
        const m = chat[id]; const state = B.builtinTranslateState(settings);
        const plan = B.rescuePlan({ state, message: m, currentHash: HASH, known: known.get(m) ?? null });
        if (plan) { m.extra.display_text = plan.display; drawn++; saved++; }
    });
    await emit(0);
    t('버스: 기본 확장이 먼저 지운 뒤 테마가 되살려 번역문이 남는다 (다시 그림 2 · 저장 2)', () => { assert.equal(chat[0].extra.display_text, '안녕하세요.'); assert.equal(drawn, 2); assert.equal(saved, 2); });
    settings.disabledExtensions.push('translate'); drawn = 0;
    delete chat[0].extra.display_text;   // 꺼진 뒤에는 (다른 이유로) 지워진 번역문을 되살리지 않는다 — 그 길은 보통의 편집 처리
    await emit(0);
    t('버스: 기본 확장을 끄면 테마는 끼어들지 않는다', () => { assert.equal(chat[0].extra.display_text, undefined); assert.equal(drawn, 0); });
})();
console.log(`translator-builtin-translate: ${n} passed`);
