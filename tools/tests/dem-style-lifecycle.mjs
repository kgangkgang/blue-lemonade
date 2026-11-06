// 실제 전체 시트 로더와 데우스 적재기를 함께 돌려요. DOM·CSSOM·받기만 모형이고 브라우저는 열지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadFullCss } from '../../src/split-css.js';
import { syncThemeSheet, prepareDemThemeSheet } from '../../src/theme-sheet.js';
const require = createRequire(import.meta.url), lib = require('../css-lib.cjs'), { compileDemSheets } = require('../css-dem-slots.cjs');
const mainUrl = new URL('../../style.css', import.meta.url).href;
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
const timers = new Map(); let timerId = 0, serial = 0;
globalThis.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
globalThis.clearTimeout = id => timers.delete(id);
function cssSheet(text, ownerNode) {
    const convert = node => {
        if (node.type === 'rule') return { selectorText: node.selector, style: { getPropertyValue: key => node.decls.find(d => d.lname === key)?.value || '' } };
        const rule = { cssRules: (node.children || []).filter(n => n.type !== 'comment').map(convert) };
        if (node.name === 'media') rule.media = { mediaText: node.prelude.replace(/^@media\s*/, '') };
        rule.insertRule = (text, at) => { const parsed = lib.parse(text); assert.deepEqual(parsed.problems, []); rule.cssRules.splice(at, 0, convert(parsed.children.find(n => n.type !== 'comment'))); };
        rule.deleteRule = at => rule.cssRules.splice(at, 1);
        return rule;
    };
    return { ownerNode, disabled: false, cssRules: lib.parse(text).children.filter(n => n.type !== 'comment').map(convert) };
}
function fixture() {
    const input = `body.salty.salty-dem-skin .card{--fixture:${++serial};padding:var(--gap)}`;
    const payload = compileDemSheets(input, input + '\n.panel{color:blue}');
    const mark = `:root{--bl-css-split:1;--bl-dem-style-key:"${payload.key}"}\n`;
    const boot = mark + payload.boot + '\n#salty-lazy-panel-start {}\n.tail{color:red}';
    const fullText = mark + payload.full + '\n#salty-lazy-panel-start {}\n.tail{color:red}';
    const nodes = [], requests = [], classes = new Set(); classes.contains = value => classes.has(value);
    let on = true, prepared = 0;
    class Element {
        constructor(tag = 'style') { this.tagName = tag.toUpperCase(); this.dataset = {}; this.media = 'all'; this.id = ''; this.events = new Map(); }
        get isConnected() { return nodes.includes(this); }
        after(node) { node.remove(); nodes.splice(nodes.indexOf(this) + 1, 0, node); }
        remove() { const at = nodes.indexOf(this); if (at >= 0) nodes.splice(at, 1); }
        addEventListener(name, fn) { this.events.set(name, fn); }
        fire(name) { this.events.get(name)?.(); }
        set textContent(text) { this.text = text; this.sheet = cssSheet(text, this); }
        get textContent() { return this.text || ''; }
    }
    const main = new Element('link'); main.href = mainUrl; main.textContent = boot; nodes.push(main);
    globalThis.document = { body: { classList: classes }, getElementById: id => nodes.find(n => n.id === id) || null,
        querySelectorAll: () => nodes.filter(n => n.tagName === 'LINK'), createElement: tag => new Element(tag) };
    const setOn = value => { on = value; classes.clear(); if (value) { classes.add('salty'); classes.add('salty-dem-skin'); } };
    setOn(true);
    const defaultFetch = async url => {
        requests.push(String(url));
        if (String(url).includes('style-lazy.gen.css')) return { ok: true, text: async () => fullText };
        return { ok: true, text: async () => String(url).includes('fallback') ? payload.fallback : payload.data };
    };
    globalThis.fetch = defaultFetch;
    return { payload, boot, fullText, main, nodes, requests, defaultFetch, setOn,
        run: () => loadFullCss(main.sheet, () => { prepared++; }, () => on),
        prepared: () => prepared, full: () => document.getElementById('salty-lazy-css'), ext: () => document.getElementById('salty-ext-css') };
}
const slots = sheet => sheet.cssRules.filter(rule => rule.media && rule.cssRules[0]?.selectorText?.startsWith('#bl-dem-slot-'));
const settle = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => realSet(resolve, 1)); } throw Error('시험 상태가 준비되지 않았어요'); }
let passed = 0;
async function test(name, run) { timers.clear(); await run(); await settle(); await settle(); assert.equal(timers.size, 0, '남은 타이머가 없어요'); passed++; console.log(`통과 ${passed}: ${name}`); }
try {
    await test('실제 초기 적용 경로는 데우스를 쓰거나 테마를 끌 때 시트 관리자를 준비해요', () => {
        const line = fs.readFileSync(new URL('../../src/apply.js', import.meta.url), 'utf8').split(/\r?\n/).find(line => line.includes("lateSync('themeSheet'"));
        assert.ok(line);
        const apply = new Function('s', 'lateSync', line);
        for (const [s, expected] of [[{ enabled: true }, false], [{ enabled: false }, true], [{ enabled: true, deus: { on: true } }, true], [{ enabled: true, deus: { fx: { flow: true } } }, true]]) {
            let observed; apply(s, (_name, _load, needed) => { observed = needed; }); assert.equal(observed, expected);
        }
    });
    await test('처음 적용은 body 표식 변경 뒤 준비하고 겹친 호출은 한 번 받아요', async () => {
        const f = fixture(); f.setOn(false); syncThemeSheet(true); syncThemeSheet(true); f.setOn(true);
        await until(() => slots(f.main.sheet)[0].media.mediaText === 'all');
        assert.equal(f.requests.length, 1); assert.equal(f.main.sheet.disabled, false);
    });
    await test('첫 CSS를 아직 받는 중이어도 로딩이 끝나면 이어서 준비해요', async () => {
        const f = fixture(); f.main.sheet = null; syncThemeSheet(true); syncThemeSheet(true);
        assert.equal(f.requests.length, 0); assert.equal(f.main.events.size, 1);
        f.main.textContent = f.boot; f.main.fire('load');
        await until(() => slots(f.main.sheet)[0].media.mediaText === 'all'); assert.equal(f.requests.length, 1);
    });
    await test('전체 장을 받았어도 데우스 내용 전에는 첫 시트를 끄지 않아요', async () => {
        const f = fixture(); let release;
        globalThis.fetch = url => String(url).includes('style-lazy') ? f.defaultFetch(url) : new Promise(resolve => { release = resolve; });
        const task = f.run(); await until(() => release);
        assert.equal(f.main.sheet.disabled, false); assert.equal(f.full().media, 'not all'); assert.equal(f.prepared(), 0);
        release({ ok: true, text: async () => f.payload.data }); assert.equal(await task, true);
        assert.equal(f.main.sheet.disabled, true); assert.equal(f.full().media, 'all');
        assert.equal(slots(f.full().sheet)[0].media.mediaText, 'all');
        f.setOn(false); syncThemeSheet(false); const ext = f.ext(); ext.sheet = cssSheet('.ext{}', ext); ext.fire('load');
        await settle(); assert.equal(f.full().sheet.disabled, true);
        f.setOn(true); syncThemeSheet(true); await settle(); assert.equal(f.full().sheet.disabled, false);
    });
    await test('전체 장을 기다리다 테마를 끄면 분리 규칙이 다시 켜지지 않아요', async () => {
        const f = fixture(); let release;
        globalThis.fetch = url => String(url).includes('style-lazy') ? f.defaultFetch(url) : new Promise(resolve => { release = resolve; });
        const task = f.run(); await until(() => release); f.setOn(false);
        release({ ok: true, text: async () => f.payload.data }); assert.equal(await task, true);
        assert.equal(slots(f.full().sheet)[0].media.mediaText, 'not all');
        const ext = f.ext(); ext.sheet = cssSheet('.ext{}', ext); ext.fire('load'); assert.equal(f.full().sheet.disabled, true);
    });
    await test('새 전체 장의 두 데이터 파일이 모두 실패하면 준비된 첫 시트를 유지해요', async () => {
        const f = fixture(); assert.equal(await prepareDemThemeSheet(f.main.sheet), true);
        const oldSheet = f.main.sheet, newer = fixture();
        // 같은 문서의 첫 시트는 앞 판의 준비된 시트이고 전체 파일만 새 판인 상황이에요.
        newer.main.sheet = oldSheet; oldSheet.ownerNode = newer.main;
        globalThis.fetch = url => String(url).includes('style-lazy') ? newer.defaultFetch(url) : Promise.reject(Error('시험 받기 실패'));
        assert.equal(await newer.run(), false); assert.equal(newer.full(), null);
        assert.equal(oldSheet.disabled, false); assert.equal(slots(oldSheet)[0].media.mediaText, 'all');
    });
} finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
console.log(`데우스·전체 시트 연결 시험 ${passed}개를 통과했어요.`);
