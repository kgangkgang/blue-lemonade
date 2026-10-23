// 테마 6.9.0 실리태번 한국어 화면 다듬기 — src/ko-ui.js · src/ko-ui-data.js
//   node tools/tests/ko-ui.mjs <테마 루트>
// 실리태번 · 브라우저 없이 돌린다: 가짜 언어 표 · 가짜 요소로 실리태번 i18n.js 와 같은 규칙을 흉내 낸다. 문장은 모두 지어낸 것.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const ui = await import(pathToFileURL(path.join(root, 'src/ko-ui.js')).href);
const { ADD, FIX, TOASTS } = await import(pathToFileURL(path.join(root, 'src/ko-ui-data.js')).href);

let passed = 0;
const pending = [];
const test = (name, fn) => {
    const run = async () => { await fn(); passed++; console.log(`ok - ${name}`); };
    pending.push(run);
};

// ── 실리태번 i18n.js 흉내: localeData 는 모듈 안에 숨은 평범한 객체, translate 는 표에 없으면 원문
function fakeLocale(initial) {
    const localeData = { ...initial };
    const translate = (text, key = null) => localeData?.[key || text] || text;
    const addLocaleData = (id, data) => { if (id !== 'ko-kr') return; for (const [k, v] of Object.entries(data)) if (!Object.hasOwn(localeData, k)) localeData[k] = v; };
    return { localeData, translate, addLocaleData };
}

// ── 아주 작은 가짜 요소 (getAttribute · setAttribute · textContent · 자식 노드)
class El {
    constructor(attrs = {}, text = '', children = []) {
        this.nodeType = 1;
        this.attrs = { ...attrs };
        this.childNodes = [...(text ? [{ nodeType: 3, nodeValue: text }] : []), ...children];
    }
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    get childElementCount() { return this.childNodes.filter(n => n.nodeType === 1).length; }
    get textContent() { return this.childNodes.map(n => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join(''); }
    set textContent(value) { this.childNodes = [{ nodeType: 3, nodeValue: value }]; }
    all() { return this.childNodes.filter(n => n.nodeType === 1).flatMap(n => [n, ...n.all()]); }
    querySelectorAll(sel) { assert.equal(sel, '[data-i18n]'); return this.all().filter(n => n.getAttribute('data-i18n') !== null); }
}

test('표: 더할 키와 고칠 키가 겹치지 않고, 값은 모두 글자', () => {
    assert.ok(Object.keys(ADD).length > 1500, '더할 키가 너무 적어요');
    assert.ok(Object.keys(FIX).length > 500, '고칠 키가 너무 적어요');
    for (const key of Object.keys(ADD)) assert.ok(!Object.hasOwn(FIX, key), `겹침: ${key}`);
    for (const [key, value] of [...Object.entries(ADD), ...Object.entries(FIX)]) assert.equal(typeof value, 'string', key);
});

test('표: 자리표시 ${n} 은 원문과 같게 (빼도 되는 건 정해 둔 한 줄뿐)', () => {
    const marks = s => [...s.matchAll(/\$\{\d+\}/g)].map(m => m[0]).sort().join(',');
    const allowed = new Set(['Unlinked existing persona${0}: ${1}']);
    for (const [key, value] of [...Object.entries(ADD), ...Object.entries(FIX)]) {
        if (allowed.has(key)) continue;
        assert.equal(marks(value), marks(key), `자리표시 다름: ${key}`);
    }
    for (const key of TOASTS) assert.ok(Object.hasOwn(ADD, key) && /\$\{\d+\}/.test(key), key);
});

test('표: 깨진 글 없음 — HTML 엔티티 · 기계 번역 흔적 · 빈 값은 data-i18n 글 칸 몇 개만', () => {
    const values = [...Object.values(ADD), ...Object.values(FIX)];
    for (const value of values) assert.ok(!/&#\d+;|&nbsp;/.test(value), value);
    // 기존 번역에서 고친 대표 오역이 다시 들어오지 않게
    for (const bad of ['가장 좋아하는', '와이프 모드', '신속한 후처리', '채팅 완성 근원', '세대당', '대표적 페널티', '비스듬한', '고용 단계', '미치광이', '분류기 무료', '오픈데이터뱅크', '스포일러 무료', '닫다']) {
        assert.ok(!values.some(v => v.includes(bad)), `오역이 남음: ${bad}`);
    }
    assert.equal(FIX['Favorite'], '즐겨찾기');
    assert.equal(FIX['Impersonate'], '사칭');   // 6.9.2 RP 용어는 그대로
    assert.equal(FIX['User Prefix'], '사용자 메시지 접두사'); // 원래 접두사 · 접미사가 뒤바뀌어 있었다
    assert.equal(ADD['Show more messages'], '이전 메시지 더 보기');
    const empty = [...Object.entries(ADD), ...Object.entries(FIX)].filter(([, v]) => v === '').map(([k]) => k);
    assert.ok(empty.length <= 6, `빈 값이 많아요: ${empty.join(' | ')}`);
});

test('언어 표 찾기: translate 가 읽는 바로 그 표를 잡고, Object.prototype 에는 흔적을 남기지 않는다', () => {
    const { localeData, translate } = fakeLocale({ Delete: '삭제', Persona: '페르소나', Favorite: '가장 좋아하는' });
    const map = ui.findLocaleMap(translate);
    assert.equal(map, localeData);
    assert.deepEqual(Object.getOwnPropertyNames(Object.prototype).filter(n => n.includes('bl-ko')), []);
    map.Favorite = '즐겨찾기';
    assert.equal(translate('Favorite'), '즐겨찾기');
});

test('언어 표 찾기: 표 모양이 다르면(프로토타입 없음 · 다른 표) null — 덮어쓰기만 건너뛴다', () => {
    const bare = Object.assign(Object.create(null), { Delete: '삭제', Persona: '페르소나' });
    assert.equal(ui.findLocaleMap(text => bare[text] || text), null);
    assert.equal(ui.findLocaleMap(text => text), null);
    const other = {};
    assert.equal(ui.findLocaleMap(text => other[text] || text), null); // 늘 있는 키가 없는 엉뚱한 표
    assert.equal(ui.findLocaleMap(() => { throw new Error('x'); }), null);
});

test('다시 적기: 글 칸 · [속성] 칸 · 여러 키(;) — 실리태번 translateElement 와 같은 규칙', () => {
    const a = new El({ 'data-i18n': 'Favorite' }, '가장 좋아하는');
    const b = new El({ 'data-i18n': '[title]Show Gallery', title: 'Show Gallery' });
    const c = new El({ 'data-i18n': 'or;or_welcome' }, 'or');
    const d = new El({ 'data-i18n': 'Untouched key' }, 'Keep me');
    const box = new El({}, '', [a, b, c, d]);
    const table = { Favorite: '즐겨찾기', 'Show Gallery': '갤러리 보기', or: '또는', or_welcome: '또는!' };
    const changed = ui.retranslate(box, new Set(Object.keys(table)), k => table[k]);
    assert.equal(a.textContent, '즐겨찾기');
    assert.equal(b.getAttribute('title'), '갤러리 보기');
    assert.equal(c.textContent, '또는!');
    assert.equal(d.textContent, 'Keep me');
    assert.equal(changed, 3, '여러 키는 이기는 키 하나만 한 번 적는다');
    assert.equal(ui.retranslate(box, new Set(Object.keys(table)), k => table[k]), 0, '두 번째는 바꿀 게 없다');
});

test('다시 적기: 같은 칸에서 뒤의 키가 실리태번 표의 키면 그 번역을 지킨다', () => {
    const el = new El({ 'data-i18n': 'Ours;Theirs' }, '그들 번역');
    const keys = new Set(['Ours']);
    assert.equal(ui.retranslateElement(el, keys, () => '우리 번역', k => k === 'Theirs'), 0);
    assert.equal(el.textContent, '그들 번역');
    const el2 = new El({ 'data-i18n': 'Theirs;Ours' }, '그들 번역');
    assert.equal(ui.retranslateElement(el2, keys, () => '우리 번역', k => k === 'Theirs'), 1);
    assert.equal(el2.textContent, '우리 번역');
});

test('다시 적기: 나중에 붙은 아이콘 · 단추(자식 요소)는 지우지 않고 글 조각만 바꾼다', () => {
    const icon = new El({ class: 'fa-solid' });
    const label = new El({ 'data-i18n': 'Toggle Panels' }, 'Toggle Panels ', [icon]);
    ui.retranslateElement(label, new Set(['Toggle Panels']), () => '패널 열고 닫기');
    assert.equal(label.childNodes[0].nodeValue, '패널 열고 닫기');
    assert.equal(label.childNodes[1], icon);
});

test('알림 글: 같은 키 · 자리표시 틀 · 표에 없는 글 · 글이 아닌 값', () => {
    const { translate } = fakeLocale({ 'Copied!': '복사했어요!', 'Uploaded ${0} image(s) for ${1}': '${1}에 이미지 ${0}개를 올렸어요', 'Error: ${0}': '오류: ${0}' });
    let compiled = 0;
    let cache = null;
    const templates = () => (cache ??= (compiled++, ui.compileTemplates(['Uploaded ${0} image(s) for ${1}', 'Error: ${0}'], translate)));
    assert.equal(ui.localizeToastText('Copied!', translate, templates), '복사했어요!');
    assert.equal(compiled, 0, '같은 키면 틀을 만들지도 않는다');
    assert.equal(ui.localizeToastText('Uploaded 3 image(s) for Mina', translate, templates), 'Mina에 이미지 3개를 올렸어요');
    assert.equal(ui.localizeToastText('Error: Rex left the room', translate, templates), '오류: Rex left the room');
    assert.equal(ui.localizeToastText('Something only Rex would say', translate, templates), 'Something only Rex would say');
    assert.equal(compiled, 1, '틀은 한 번만 만든다');
    assert.equal(ui.localizeToastText('가', translate, templates), '가');
    const node = { nodeType: 1 };
    assert.equal(ui.localizeToastText(node, translate, templates), node);
    assert.equal(ui.localizeToastText(undefined, translate, templates), undefined);
    assert.equal(ui.localizeToastText('x'.repeat(500), translate, templates), 'x'.repeat(500), '긴 글은 찾지 않는다');
});

test('알림 감싸기: 네 종류를 한 번만, 제목 · 옵션은 그대로 넘긴다', () => {
    const calls = [];
    const toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, function (m, t, o) { calls.push([kind, m, t, o]); return kind; }]));
    const localize = s => (s === 'Copied!' ? '복사했어요!' : s);
    assert.equal(ui.wrapToasts(toastr, localize), true);
    assert.equal(ui.wrapToasts(toastr, localize), false, '두 번 감싸지 않는다');
    const options = { timeOut: 5 };
    assert.equal(toastr.success('Copied!', 'Mina', options), 'success');
    assert.deepEqual(calls.at(-1), ['success', '복사했어요!', 'Mina', options]);
    assert.equal(ui.wrapToasts(undefined, localize), false);
});

test('시작: 브라우저 언어가 ko 인 폰도 한국어로 본다 (isKoreanLocale)', () => {
    assert.equal(ui.isKoreanLocale('ko'), true); assert.equal(ui.isKoreanLocale('ko-kr'), true); assert.equal(ui.isKoreanLocale('ko_KR'), true);
    assert.equal(ui.isKoreanLocale('en'), false); assert.equal(ui.isKoreanLocale('kok'), false); assert.equal(ui.isKoreanLocale(undefined), false);
});

test('시작: ko-kr 이 아니면 아무것도 안 한다', () => {
    const ctx = { getCurrentLocale: () => 'en', addLocaleData() { throw new Error('불리면 안 돼요'); } };
    assert.equal(ui.startKoreanUi(ctx), null);
    assert.equal(ui.startKoreanUi({ getCurrentLocale: () => 'ko-kr' }), null, '언어 표 함수가 없으면 건너뛴다');
});

test('시작: 공식 addLocaleData 로 더하고, 있는 키는 표에서 고치고, 그려진 요소는 쉬는 틈에 다시 적는다', async () => {
    const { localeData, translate, addLocaleData } = fakeLocale({ Delete: '삭제', Persona: '페르소나', Favorite: '가장 좋아하는', Impersonate: '사칭' });
    const els = [new El({ 'data-i18n': 'Favorite' }, '가장 좋아하는'), new El({ 'data-i18n': '[title]Rename current preset', title: 'Rename current preset' })];
    const showMore = new El({ id: 'show_more_messages' }, 'Show more messages');
    const handlers = {};
    globalThis.document = {
        querySelectorAll: sel => (sel === '[data-i18n]' ? els : []),
        getElementById: id => (id === 'show_more_messages' ? showMore : null),
    };
    globalThis.window = { toastr: Object.fromEntries(['info', 'success', 'warning', 'error'].map(k => [k, (m) => m])) };
    const ctx = {
        getCurrentLocale: () => 'ko-kr', translate, addLocaleData,
        eventSource: { on: (type, fn) => { handlers[type] = fn; }, once: () => {} },
        event_types: { CHAT_CHANGED: 'chat_id_changed', APP_READY: 'app_ready' },
    };
    const result = ui.startKoreanUi(ctx);
    assert.ok(result && result.add === Object.keys(ADD).length && result.fix === Object.keys(FIX).length);
    assert.equal(localeData['Rename current preset'], ADD['Rename current preset'], '없던 키는 addLocaleData 로');
    assert.equal(translate('Favorite'), '즐겨찾기', '있던 키는 표에서 덮어씀');
    assert.equal(showMore.textContent, '이전 메시지 더 보기');
    showMore.textContent = 'Show more messages';
    handlers.chat_id_changed();
    assert.equal(showMore.textContent, '이전 메시지 더 보기', '채팅이 바뀌면 다시 한 번');
    assert.equal(window.toastr.info('Copied!'), '복사했어요!');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(els[0].textContent, '즐겨찾기');
    assert.equal(els[1].getAttribute('title'), '현재 프리셋 이름 바꾸기');
    assert.equal(ui.koUiState().done, true);
    assert.equal(ui.startKoreanUi(ctx), null, '두 번 시작하지 않는다');
});

test('가벼움: 이 파일엔 감시자 · 반복 타이머 없음(더 보기 단추 감시는 show-more-watch.js 가 #chat 자식만), ko-kr 일 때만 불러온다 (다른 언어는 파일도 안 받음)', () => {
    const code = read('src/ko-ui.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 주석은 빼고 본다
    assert.ok(!/MutationObserver|setInterval|ResizeObserver|IntersectionObserver/.test(code));
    assert.ok(!/addEventListener\(['"](scroll|wheel|touchmove|pointermove)/.test(code));
    const index = read('index.js');
    assert.match(index, /\/\^ko\(\?:\[-_\]\|\$\)\/i\.test\(String\(SillyTavern\.getContext\(\)\.getCurrentLocale\?\.\(\) \?\? ''\)\)\) import\('\.\/src\/ko-ui\.js'\)/, '한국어(ko · ko-kr)일 때만 파일을 받는다');
    assert.ok(!/^import .*ko-ui/m.test(index), '처음부터 불러오지 않는다');
    const bytes = fs.statSync(path.join(root, 'src/ko-ui-data.js')).size;
    assert.ok(bytes < 280_000, `표가 너무 커요: ${bytes}B`);
});

for (const run of pending) await run();
// 6.9.0 설정 창에 끄는 줄 · 설정값 정리
{
    const fs = await import('node:fs');
    const panelSrc = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
    assert.match(panelSrc, /toggle\('koUi', s\.koUi !== false\)/, '설정 창에 끄는 줄');
    assert.match(fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8'), /s\.koUi = s\.koUi !== false;/);
    console.log('PASS 6.9.0 설정 창 끄는 줄');
}
console.log(`\n${passed + 1} passed`);
