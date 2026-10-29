// 8.2.7 브라우저 언어가 'ko' 인 사용자의 번역 비용 — src/ko-ui.js addQuietLocaleData
//   node tools/tests/ko-locale-quiet.mjs <테마 루트>
//   (ST_ROOT=<실리태번 폴더> 를 주면 진짜 public/scripts/i18n.js 를 읽어 같은 시험을 한 번 더 돌려요 — 없으면 흉내만)
// 실리태번은 lang.json 에 없는 언어('ko')면 언어 표를 빈 객체로 두고, applyLocale 은 표가 비면 바로 돌아가요.
// 테마가 공식 addLocaleData 로 표를 채우면 그때부터 템플릿을 그릴 때마다 DOMParser 문서를 만들어요 → 숨은 칸으로 넣어 그 비용을 순정과 같게.
// 보이는 결과(translate · 새로 붙는 data-i18n 요소 번역)는 그대로여야 해요. 문장은 모두 지어낸 것.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const uiUrl = pathToFileURL(path.join(root, 'src/ko-ui.js')).href;
const ui = await import(uiUrl);
const { ADD } = await import(pathToFileURL(path.join(root, 'src/ko-ui-data.js')).href);

// ── 아주 작은 가짜 요소 (실리태번 translateElement 가 쓰는 것만)
class El {
    constructor(attrs = {}, text = '') { this.nodeType = 1; this.attrs = { ...attrs }; this.textContent = text; }
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    querySelectorAll() { return []; }
}

/** 실리태번 i18n.js 흉내 — applyLocale · translate · addLocaleData · translateElement 를 줄 단위로 따라 했어요 */
function mimicI18n(localeFile, initial) {
    const localeData = initial;
    const stats = { parses: 0 };
    const translate = (text, key = null) => { const k = key || text; return localeData?.[k] || text; };
    const addLocaleData = (id, data) => {
        if (!localeData || id !== localeFile) return;
        for (const [k, v] of Object.entries(data)) if (!Object.hasOwn(localeData, k)) localeData[k] = v;
    };
    const translateElement = (el) => {
        for (const key of el.getAttribute('data-i18n').split(';')) {
            const m = key.match(/\[(\S+)\](.+)/);
            if (m) { const v = localeData?.[m[2]]; if (v || v === '') el.setAttribute(m[1], v); } else { const v = localeData?.[key]; if (v || v === '') el.textContent = v; }
        }
    };
    const applyLocale = (html) => {
        if (!localeData || Object.keys(localeData).length === 0) return html;
        stats.parses++; // 진짜는 여기서 new DOMParser().parseFromString + $(문서).find('[data-i18n]')
        return html;
    };
    return { name: '흉내', stats, translate, addLocaleData, applyLocale, getCurrentLocale: () => localeFile, observe: el => translateElement(el) };
}

/** 진짜 i18n.js — import 줄을 빼고 export 를 벗겨 vm 에서 돌려요. DOMParser 는 부른 횟수만 세요 */
function realI18n(stRoot, localeFile, initial) {
    const file = path.join(stRoot, 'public/scripts/i18n.js');
    let src = fs.readFileSync(file, 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export (?=(async )?function|const|let|var)/gm, '');
    assert.match(src, /Object\.keys\(localeData\)\.length === 0/, '진짜 applyLocale 에 빈 표 검사가 있어야 해요(없으면 이 고침은 효과만 없어요)');
    src += '\n;({ translate, addLocaleData, applyLocale, getCurrentLocale, set: (d) => { localeData = d; } });';
    const stats = { parses: 0 };
    let observerCallback = null;
    const fakeDoc = { body: { innerHTML: '' } };
    const $ = (x) => ({ find: () => ({ each() {} }), get: () => x });
    const sandbox = {
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        navigator: { language: localeFile },
        console: { log() {}, warn() {}, debug() {}, trace() {} },
        Document: class {}, Node: { ELEMENT_NODE: 1 }, Element: El,
        DOMParser: class { parseFromString(html) { stats.parses++; fakeDoc.body.innerHTML = html; return fakeDoc; } },
        MutationObserver: class { constructor(cb) { observerCallback = cb; } observe() {} },
        $, toastr: {}, document: {},
    };
    const api = vm.runInNewContext(src, sandbox, { filename: file });
    // vm 안의 Object.prototype 은 다른 세계라 테마의 표 찾기(PROBE)가 닿지 않아요 → 표는 이 세계 객체로 넣어요(브라우저에선 한 세계)
    api.set(initial);
    // 진짜 감시자 콜백(문서에 새로 붙은 노드의 data-i18n 을 번역)을 그대로 불러요
    const observe = el => observerCallback([{ addedNodes: [el], attributeName: null, target: el }]);
    return { name: '진짜 i18n.js', stats, translate: api.translate, addLocaleData: api.addLocaleData, applyLocale: api.applyLocale, getCurrentLocale: api.getCurrentLocale, observe };
}

const plain = Object.keys(ADD).filter(k => ADD[k] && !/\$\{/.test(k));
const sampleKey = plain[0];
const sampleAttr = plain[1];

let passed = 0;
async function startFresh(i18n) {
    const mod = await import(`${uiUrl}?t=${Math.random()}`); // started 를 매번 새로
    globalThis.document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
    globalThis.window = { toastr: undefined };
    const ctx = { getCurrentLocale: i18n.getCurrentLocale, translate: i18n.translate, addLocaleData: i18n.addLocaleData, eventSource: { on() {}, once() {} }, event_types: {} };
    return mod.startKoreanUi(ctx);
}

async function suite(make) {
    // ① 'ko' — 실리태번 표가 빈 객체
    {
        const i18n = make('ko', {});
        const result = await startFresh(i18n);
        assert.ok(result, `${i18n.name}: 'ko' 에서도 시작해요`);
        assert.equal(i18n.translate(sampleKey), ADD[sampleKey], `${i18n.name}: translate 는 더한 번역을 돌려줘요`);
        const el = new El({ 'data-i18n': sampleKey }, sampleKey);
        const el2 = new El({ 'data-i18n': `[title]${sampleAttr}`, title: sampleAttr });
        i18n.observe(el); i18n.observe(el2);
        assert.equal(el.textContent, ADD[sampleKey], `${i18n.name}: 새로 붙는 data-i18n 글은 실리태번 감시자가 번역해요`);
        assert.equal(el2.getAttribute('title'), ADD[sampleAttr], `${i18n.name}: [속성] 칸도`);
        const html = `<div data-i18n="${sampleKey}">${sampleKey}</div>`;
        assert.equal(i18n.applyLocale(html), html);
        assert.equal(i18n.stats.parses, 0, `${i18n.name}: 'ko' 는 템플릿마다 DOMParser 를 만들지 않아요(순정 'ko' 와 같게)`);
        assert.equal(result.quiet, true);
        // 다른 확장이 나중에 공식 길로 더해도: 우리 키는 안 덮이고(공식과 같은 규칙) 그 확장 키는 들어가요
        i18n.addLocaleData('ko', { [sampleKey]: '다른 확장 값', 'Made-up extension label': '지어낸 확장 이름표' });
        assert.equal(i18n.translate(sampleKey), ADD[sampleKey]);
        assert.equal(i18n.translate('Made-up extension label'), '지어낸 확장 이름표');
        i18n.applyLocale(html);
        assert.equal(i18n.stats.parses, 1, `${i18n.name}: 다른 확장이 표를 채우면 그 뒤로는 순정과 같이 번역해요(그 확장 몫)`);
        console.log(`ok - ${i18n.name}: 'ko' 는 숨은 칸 — 번역 그대로 · 템플릿 번역 비용 없음`); passed++;
    }
    // ② 'ko-kr' — 실리태번 표가 이미 차 있으면 공식 길 그대로(순정도 같은 비용)
    {
        const i18n = make('ko-kr', { Delete: '삭제', Persona: '페르소나' });
        const result = await startFresh(i18n);
        assert.equal(result.quiet, false);
        assert.equal(i18n.translate(sampleKey), ADD[sampleKey]);
        i18n.applyLocale('<div data-i18n="Delete">Delete</div>');
        assert.equal(i18n.stats.parses, 1, `${i18n.name}: ko-kr 은 순정처럼 템플릿을 번역해요`);
        console.log(`ok - ${i18n.name}: 'ko-kr' 은 공식 addLocaleData 그대로`); passed++;
    }
    // ③ 다른 확장이 테마보다 먼저 'ko' 표에 더했으면: 이미 순정 값을 내는 중이니 공식 길
    {
        const i18n = make('ko', {});
        i18n.addLocaleData('ko', { 'Made-up early label': '먼저 온 이름표' });
        const result = await startFresh(i18n);
        assert.equal(result.quiet, false);
        assert.equal(i18n.translate(sampleKey), ADD[sampleKey]);
        assert.equal(i18n.translate('Made-up early label'), '먼저 온 이름표');
        console.log(`ok - ${i18n.name}: 먼저 채운 확장이 있으면 공식 길`); passed++;
    }
}

await suite(mimicI18n);
if (process.env.ST_ROOT) await suite((locale, initial) => realI18n(process.env.ST_ROOT, locale, initial));
else console.log('skip - ST_ROOT 가 없어 진짜 i18n.js 시험은 건너뛰어요');

// ④ 표를 못 찾거나 숨은 칸이 안 먹히면 되돌리고 공식 길(false)
{
    assert.equal(typeof ui.addQuietLocaleData, 'function', '숨은 칸 넣기 함수가 있어야 해요');
    assert.equal(ui.addQuietLocaleData(null, ADD, t => t), false);
    assert.equal(ui.addQuietLocaleData(Object.create(null), ADD, t => t), false, '프로토타입 없는 표는 건드리지 않아요');
    assert.equal(ui.addQuietLocaleData(Object.freeze({}), ADD, t => t), false, '얼린 표');
    assert.equal(ui.addQuietLocaleData({ x: '1' }, ADD, t => t), false, '이미 찬 표');
    const copy = {};
    assert.equal(ui.addQuietLocaleData(copy, ADD, text => text), false, '다른 표를 읽는 translate 는 확인에서 걸려요');
    assert.equal(Object.getOwnPropertyNames(copy).length, 0, '안 맞으면 넣은 칸을 다 되돌려요');
    const map = {};
    assert.equal(ui.addQuietLocaleData(map, { A: '가', B: '' }, k => map[k] || k), true);
    assert.deepEqual(Object.keys(map), []);
    assert.equal(map.A, '가'); assert.equal(map.B, '');
    assert.ok(Object.hasOwn(map, 'B'), '빈 값도 칸은 있어요(실리태번은 data-i18n 글 칸을 비워요)');
    assert.deepEqual(Object.getOwnPropertyNames(Object.prototype).filter(n => n.includes('bl-ko')), [], 'Object.prototype 에 흔적 없음');
    console.log('ok - 못 찾거나 안 먹히면 되돌리고 공식 길'); passed++;
}

// ⑤ 원문: 시작이 숨은 칸을 먼저 쓰고 실패할 때만 공식 addLocaleData
{
    const code = fs.readFileSync(path.join(root, 'src/ko-ui.js'), 'utf8');
    assert.match(code, /const quiet = addQuietLocaleData\(probeLocaleMap\(translate\), ADD, translate\);\s*if \(!quiet\) addLocaleData\(locale, ADD\);/);
    console.log('ok - 시작 순서'); passed++;
}
console.log(`\n${passed} passed`);
