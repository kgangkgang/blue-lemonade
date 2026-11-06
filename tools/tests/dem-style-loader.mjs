import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDemStyleLoader, parseDemStyleData } from '../../src/dem-style-loader.js';
import { demStyleKey, demStylesEnabled } from '../../src/theme-sheet.js';
const require = createRequire(import.meta.url), { compileDemSheets } = require('../css-dem-slots.cjs');
const source = 'body.salty.salty-dem-skin .x{margin:var(--gap);content:"*/ $&"}';
const build = compileDemSheets(source, source + '\nbody.salty.salty-dem-ink q{color:inherit}');
const response = text => ({ ok: true, text: async () => text });
function sheet(label = 'boot', key = build.key) {
    const id = Object.keys(build.slots).find(id => id.startsWith(label + '-'));
    const group = { cssRules: [{ selectorText: `#bl-dem-slot-${id}` }], media: { mediaText: 'not all' },
        insertRule(text, at) { this.cssRules.splice(at, 0, { cssText: text }); }, deleteRule(at) { this.cssRules.splice(at, 1); } };
    return { group, disabled: false, cssRules: [{ selectorText: ':root', style: { getPropertyValue: name => name === '--bl-dem-style-key' ? `"${key}"` : '' } }, group] };
}
function harness(fetcher, extra = {}) {
    let on = true; const calls = [];
    const api = createDemStyleLoader({ fetch: (url, options) => { calls.push(url); return fetcher(url, options); },
        dataUrl: 'https://fixture.invalid/data.gen.js', fallbackUrl: 'https://fixture.invalid/fallback.css', enabled: () => on, timeoutMs: 25, ...extra });
    return { api, calls, off: () => { on = false; }, on: () => { on = true; } };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`통과 ${passed}: ${name}`); }
await test('두 데이터 포장은 같은 원문이며 코드로 실행하지 않아요', () => {
    assert.deepEqual(parseDemStyleData(build.data, build.key), build.slots);
    assert.deepEqual(parseDemStyleData(build.fallback, build.key), build.slots);
    assert.equal((build.fallback.match(/\*\//g) || []).length, 1, 'CSS 주석을 중간에서 닫지 않아요');
    assert.throws(() => parseDemStyleData(build.data + 'globalThis.broken = true;', build.key));
    assert.throws(() => parseDemStyleData(build.data, '0'.repeat(16)), /판/);
});
await test('첫 장과 전체 장의 같은 규칙은 한 번만 보관해요', () => {
    const same = compileDemSheets(source, source), decoded = parseDemStyleData(same.data, same.key);
    assert.equal(same.count, 2); assert.equal(same.stats.blocks, 1);
    const values = Object.values(decoded); assert.equal(values[0].rules, values[1].rules);
});
await test('분리 전 시트·꺼진 기능은 파일을 받지 않아요', async () => {
    const h = harness(() => { throw Error('받으면 안 돼요'); }), target = sheet(); h.off();
    assert.equal(await h.api.prepare([target]), true); assert.equal(h.calls.length, 0);
    h.on(); assert.equal(await h.api.prepare([{ cssRules: [] }]), true); assert.equal(h.calls.length, 0);
    assert.equal(demStyleKey(target), build.key);
});
await test('겹친 호출과 전체 시트 교체는 받기를 공유하며 원래 시트 상태를 보존해요', async () => {
    let release; const h = harness(() => new Promise(resolve => { release = resolve; }));
    const a = sheet(), b = sheet('full'); a.disabled = true;
    const first = h.api.prepare([a]), second = h.api.prepare([a, b]);
    await Promise.resolve(); await Promise.resolve(); release(response(build.data));
    assert.deepEqual(await Promise.all([first, second]), [true, true]); assert.equal(h.calls.length, 1);
    assert.equal(a.group.cssRules.length, 2); assert.equal(b.group.cssRules.length, 3); assert.equal(a.disabled, true);
    h.off(); await h.api.prepare([a, b]); assert.equal(a.group.media.mediaText, 'not all');
    h.on(); await h.api.prepare([a, b]); assert.equal(h.calls.length, 1); assert.equal(a.group.cssRules.length, 2);
});
await test('받는 사이 끄면 늦게 온 응답으로 다시 켜지 않아요', async () => {
    let release; const h = harness(() => new Promise(resolve => { release = resolve; })), target = sheet();
    const task = h.api.prepare([target]); await Promise.resolve(); await Promise.resolve(); h.off(); release(response(build.data));
    assert.equal(await task, true); assert.equal(target.group.media.mediaText, 'not all'); assert.equal(target.group.cssRules.length, 1);
    h.on(); await h.api.prepare([target]); assert.equal(h.calls.length, 1); assert.equal(target.group.media.mediaText, 'all');
});
for (const mode of ['HTTP', '문법', '판', '규칙 없음']) await test(`${mode} 오류는 대체 파일의 원문으로 복구해요`, async () => {
    const h = harness(url => {
        if (url.includes('fallback')) return response(build.fallback);
        if (mode === 'HTTP') return { ok: false, status: 404 };
        if (mode === '문법') return response('잘못된 파일');
        if (mode === '판') return response(build.data.replace(build.key, '0'.repeat(16)));
        return response(`/* bl-dem-payload */\nexport default ${JSON.stringify({ version: 1, key: build.key, blocks: {}, slots: {} })};\n`);
    }), target = sheet();
    assert.equal(await h.api.prepare([target]), true); assert.equal(h.calls.length, 2); assert.equal(target.group.cssRules.length, 2);
});
await test('무응답도 제한 시간 뒤 대체 파일로 넘어가요', async () => {
    let aborted = false;
    const h = harness((url, options) => {
        if (url.includes('fallback')) return response(build.fallback);
        options.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {});
    }, { timeoutMs: 5 });
    assert.equal(await h.api.prepare([sheet()]), true); assert.equal(aborted, true); assert.equal(h.calls.length, 2);
});
await test('두 경로 모두 실패해도 일부 삽입이 없고 다음 호출로 재시도해요', async () => {
    let broken = true; const h = harness(() => { if (broken) throw Error('시험 실패'); return response(build.data); });
    const target = sheet(); await assert.rejects(h.api.prepare([target]), /시험 실패/);
    assert.equal(target.group.cssRules.length, 1); assert.equal(target.group.media.mediaText, 'not all');
    broken = false; assert.equal(await h.api.prepare([target]), true);
});
await test('시트 교체가 취소되면 늦은 응답을 그 시트에 넣지 않아요', async () => {
    let release; const h = harness(() => new Promise(resolve => { release = resolve; }));
    const target = sheet(), controller = new AbortController();
    const task = h.api.prepare([target], { signal: controller.signal }); await Promise.resolve(); await Promise.resolve();
    controller.abort(); release(response(build.data)); assert.equal(await task, false); assert.equal(target.group.cssRules.length, 1);
    const next = sheet('full'); await h.api.prepare([next]); assert.equal(h.calls.length, 1);
});
await test('몸체의 실제 테마·데우스 표식으로 켬을 판단해요', () => {
    for (const [flags, want] of [[['salty'], false], [['salty-dem-skin'], false], [['salty', 'salty-dem-skin'], true], [['salty', 'salty-demfx-flow'], true], [['salty', 'salty-unify-regex'], true]]) {
        const set = new Set(flags); set.contains = value => set.has(value);
        assert.equal(demStylesEnabled({ body: { classList: set } }), want);
    }
});
console.log(`데우스 꾸밈 적재 시험 ${passed}개를 통과했어요.`);
