// 1.0.2 블루레몬에이드 제로 · 한국어 화면 잇기(src/ko-locale-bridge.js)
//   브라우저 언어가 'ko' 라 실리태번 언어 표가 빈 채일 때: 실리태번 공식 ko-kr.json 을 받아 숨은 칸으로 잇고(applyLocale 은 순정처럼 바로 돌아가요),
//   이미 그려진 data-i18n 요소 · 입력칸 안내 글을 다시 적어요. 'ko-kr'(표가 이미 참)이면 아무것도 안 받아요. 문장은 지어낸 것.
//   (ST_ROOT=<실리태번 폴더> 를 주면 진짜 public/locales/ko-kr.json 으로 한 번 더 — 없으면 건너뜀)
//   node tools/tests/ko-locale-bridge.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({ settings: { enabled: true } });
const bridge = await import(pathToFileURL(path.join(root, 'src/ko-locale-bridge.js')).href);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

/** 실리태번 i18n.js 의 translate · addLocaleData · applyLocale 흉내 */
function host(locale, table) {
    const stats = { parses: 0, addCalls: 0 };
    return {
        stats, table,
        getCurrentLocale: () => locale,
        translate: (text, key = null) => table?.[key || text] || text,
        addLocaleData(id, data) { stats.addCalls++; if (id !== locale) return; for (const [k, v] of Object.entries(data)) if (!Object.hasOwn(table, k)) table[k] = v; },
        applyLocale(html) { if (!table || Object.keys(table).length === 0) return html; stats.parses++; return html; },
    };
}
const KO = { Persona: '페르소나', Delete: '삭제', 'Creator\'s Notes': '제작자의 메모', 'Ext. Media': '외부 미디어', Search: '검색', 'Type a message, or /? for help': '메시지를 입력하세요', 'Not connected to API!': 'API 연결 안 됨', Blank: '' };
const page = () => {
    document.body.innerHTML = '<div id="send_form"><textarea id="send_textarea" data-i18n="[no_connection_text]Not connected to API!;[connected_text]Type a message, or /? for help" placeholder="Type a message, or /? for help" no_connection_text="Not connected to API!" connected_text="Type a message, or /? for help"></textarea>'
        + '<span id="a" data-i18n="Persona">Persona</span></div>'
        + '<div id="drawer"><h4 id="b" data-i18n="Creator\'s Notes">Creator\'s Notes</h4><div id="c" data-i18n="Ext. Media"><i class="fa-solid fa-link"></i>Ext. Media</div>'
        + '<input id="d" data-i18n="[placeholder]Search" placeholder="Search"><span id="e" data-i18n="Unknown key">Unknown key</span><span id="f" data-i18n="Blank">Blank</span></div>';
};
const $ = id => document.getElementById(id);

await test("'ko' · 빈 표: 공식 ko-kr.json 을 숨은 칸으로 잇고 그려진 글 · 입력칸 안내를 다시 적어요", async () => {
    page();
    const st = host('ko', {});
    const urls = [];
    const result = await bridge.startKoLocaleBridge(st, async url => { urls.push(url); return { ...KO }; });
    assert.equal(urls.length, 1); assert.match(urls[0], /locales\/ko-kr\.json$/);
    assert.equal(result.quiet, true);
    assert.equal(Object.keys(st.table).length, 0, '숨은 칸 — 목록에는 안 잡혀요');
    assert.equal(st.translate('Persona'), '페르소나');
    assert.equal(st.applyLocale('<b>x</b>'), '<b>x</b>'); assert.equal(st.stats.parses, 0, 'applyLocale 은 순정 ko 처럼 바로 돌아가요');
    assert.equal(st.stats.addCalls, 0);
    assert.equal($('a').textContent, '페르소나', '보이는 곳은 바로');
    assert.equal($('send_textarea').getAttribute('placeholder'), '메시지를 입력하세요', '입력칸 안내 글');
    assert.equal($('send_textarea').getAttribute('no_connection_text'), 'API 연결 안 됨');
    await dom.clock.advance(3000);
    assert.equal($('b').textContent, '제작자의 메모', '닫힌 서랍은 쉬는 틈에');
    assert.equal($('c').textContent, '외부 미디어'); assert.ok($('c').querySelector('i.fa-link'), '늦게 붙은 아이콘은 그대로');
    assert.equal($('d').getAttribute('placeholder'), '검색');
    assert.equal($('e').textContent, 'Unknown key', '표에 없는 키는 그대로');
    assert.equal($('f').textContent, '', '빈 글 값도 실리태번처럼 적어요');
    assert.equal(await bridge.startKoLocaleBridge(st, async () => { throw new Error('두 번 받으면 안 돼요'); }), null, '한 번만');
});

await test("'ko-kr'(실리태번이 이미 표를 받음) · 'en' 이면 아무것도 받지 않아요", async () => {
    let calls = 0;
    const load = async () => { calls++; return KO; };
    assert.equal(await bridge.startKoLocaleBridge(host('ko-kr', { ...KO }), load), null);
    assert.equal(await bridge.startKoLocaleBridge(host('en', {}), load), null);
    assert.equal(calls, 0);
    assert.equal(bridge.hasOfficialTable({ ...KO }), true); assert.equal(bridge.hasOfficialTable({ Foo: 'x' }), false);
});

await test('숨은 칸 · 공식 길 판단: 있는 키는 덮지 않고, 표가 이미 차 있으면(다른 확장이 먼저 더함) 공식 addLocaleData 로', async () => {
    const map = { Persona: '다른 확장 값' };
    assert.equal(bridge.addQuiet(map, KO), Object.keys(KO).length - 1);
    assert.equal(map.Persona, '다른 확장 값'); assert.equal(map.Delete, '삭제'); assert.deepEqual(Object.keys(map), ['Persona']);
    assert.equal(bridge.addQuiet(Object.freeze({}), KO), -1);
    // 새 모듈 인스턴스(started 표시가 따로)로 다시
    const fresh = await import(pathToFileURL(path.join(root, 'src/ko-locale-bridge.js')).href + '?again');
    page();
    const st = host('ko', { 'Other ext key': '다른 확장' });
    const result = await fresh.startKoLocaleBridge(st, async () => ({ ...KO }));
    assert.equal(result.quiet, false); assert.equal(st.stats.addCalls, 1);
    assert.equal(st.translate('Persona'), '페르소나'); assert.equal(st.table['Other ext key'], '다른 확장');
    assert.equal($('a').textContent, '페르소나');
});

await test('받기에 실패하면 화면은 그대로 · 다음에 다시 시도할 수 있어요', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/ko-locale-bridge.js')).href + '?fail');
    page();
    const st = host('ko', {});
    assert.equal(await fresh.startKoLocaleBridge(st, async () => null), null);
    assert.equal($('a').textContent, 'Persona');
    assert.ok(await fresh.startKoLocaleBridge(st, async () => ({ ...KO })), '다시 부르면 이어요');
});

const stRoot = process.env.ST_ROOT;
const real = stRoot && path.join(stRoot, 'public/locales/ko-kr.json');
await test('진짜 실리태번 ko-kr.json(ST_ROOT 가 있을 때만)', async () => {
    if (!real || !fs.existsSync(real)) { console.log('  (ST_ROOT 없음 — 건너뜀)'); return; }
    const data = JSON.parse(fs.readFileSync(real, 'utf8'));
    const fresh = await import(pathToFileURL(path.join(root, 'src/ko-locale-bridge.js')).href + '?real');
    page();
    const st = host('ko', {});
    const result = await fresh.startKoLocaleBridge(st, async () => data);
    assert.equal(result.quiet, true); assert.equal(result.added, Object.values(data).filter(v => typeof v === 'string').length, '글 값 전부');
    assert.equal(st.translate('Persona'), data.Persona); assert.notEqual(data.Persona, 'Persona');
    console.log(`  ko-kr.json 키 ${Object.keys(data).length}개 · ${fs.statSync(real).size} 바이트`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
