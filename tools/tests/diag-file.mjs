// 6.7.0 진단 파일 · 최근 오류 · 애드온 판 — src/diag-file.js · src/diag-errors.js · src/addon-versions.js
//   node tools/tests/diag-file.mjs <테마 루트>
// 진단 파일에 키 · 주소 · 설정 값 · 다른 메시지가 들어가지 않는지, 번역 검사 결과가 번역기 판정과 같은지 본다. 글은 지어낸 것만.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const mod = (p) => pathToFileURL(path.join(root, p)).href;
globalThis.location = { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000' };
const ctx = { extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {} };
globalThis.SillyTavern = { getContext: () => ctx };

const E = await import(mod('src/diag-errors.js'));
const D = await import(mod('src/diag-file.js'));
const V = await import(mod('src/addon-versions.js'));
const seg = await import(mod('src/addons/translator/translation-segments.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('scrub: 다른 서버 주소 · 키 · 토큰은 가리고, 같은 서버 경로는 물음표 앞까지만', () => {
    const key = 'AIza' + 'Sy0123456789abcdefghijKLMNOP';
    const out = E.scrub(`실패 https://generativelanguage.googleapis.com/v1beta/models/x:generate?key=${key} · http://127.0.0.1:8000/scripts/extensions/third-party/blue-lemonade/src/a.js?v=3 · Bearer sk-abcdefghijklmnop1234 · api_key=supersecret99 · ${'a1'.repeat(20)}`);
    assert.ok(!out.includes('googleapis'), out);
    assert.ok(!out.includes(key) && !out.includes('sk-abcdefghijklmnop1234') && !out.includes('supersecret99'), out);
    assert.ok(out.includes('/scripts/extensions/third-party/blue-lemonade/src/a.js') && !out.includes('v=3'), out);
    assert.ok(!out.includes('a1'.repeat(20)), out);
    assert.ok(E.scrub('x'.repeat(1000)).length <= 400);
    // 경로 · 긴 낱말은 그대로 (글자만 · 숫자 없는 덩어리)
    assert.equal(E.scrub('scripts/extensions/third-party/blue-lemonade/src/addons/translator/index'), 'scripts/extensions/third-party/blue-lemonade/src/addons/translator/index');
});

// 6.7.5 (회귀검사 6.7.4): 진단 복사 글은 공개 댓글에 붙는다 — 메일 · 사용자 이름 경로 · JSON 꼴 키가 남았고, 「Missing key …」 같은 평범한 글은 가려졌다
await test('scrub: 메일 · 사용자 이름이 든 경로 · JSON 키 값은 가리고, 평범한 낱말은 그대로', () => {
    const out = E.scrub('a.b+c@example.com 계정 · C:\\Users\\Someone\\Downloads\\x.log · /home/someone/st/x · /Users/someone/x · {"apiKey":"abc12345","url":"x"} · key: hunter2secret');
    assert.ok(!/example\.com|Someone|someone|abc12345|hunter2secret/.test(out), out);
    assert.ok(out.includes('<메일>') && out.includes('C:\\Users\\<이름>\\Downloads') && out.includes('/home/<이름>/st') && out.includes('"apiKey":"<가림>"'), out);
    assert.equal(E.scrub('Missing key translation_settings in config'), 'Missing key translation_settings in config');
    assert.equal(E.scrub('token count 12345 over limit'), 'token count 12345 over limit');
});

await test('isMine: 블루레몬에이드 표시 · 이 설치 경로가 든 것만 남긴다', () => {
    assert.ok(E.isMine(['[Blue Lemonade] 설정 창을 불러오지 못했어요']));
    assert.ok(E.isMine(['[LLM Translator] 번역 점검을 불러오지 못했어요:', '[object]']) && E.isMine(['[TTS] 재생 실패']), '내장 애드온 이름표 (6.7.5)');
    assert.ok(!E.isMine(['문장 속 [LLM Translator] 언급']), '이름표는 맨 앞만');
    assert.ok(E.isMine(['TypeError: x', `at f (${new URL('../src/panel.js', mod('src/diag-errors.js')).pathname}:1:2)`]));
    assert.ok(!E.isMine(['[다른 확장] 실패', 'at g (/scripts/extensions/third-party/other/index.js:1:1)']));
});

await test('startErrorLog: 우리 오류만 20개까지 · 원래 console 은 그대로 부른다 · 큰 객체는 글로 풀지 않는다', () => {
    const seen = [];
    const keep = { error: console.error, warn: console.warn };
    console.error = (...a) => seen.push(a); console.warn = (...a) => seen.push(a);
    globalThis.window = { addEventListener() {} };
    try {
        E.startErrorLog();
        for (let i = 0; i < 25; i++) console.error(`[Blue Lemonade] 실패 ${i}`, { huge: 'x'.repeat(100000) });
        console.warn('[다른 확장] 경고');
        console.error(new Error('[Blue Lemonade] 던짐'));
    } finally { Object.assign(console, keep); delete globalThis.window; }
    assert.equal(seen.length, 27, '원래 console 도 모두 불림');
    const list = E.recentErrors();
    assert.equal(list.length, 20);
    assert.ok(list.every(e => !e.text.includes('xxxx')), '객체 내용 없음');
    assert.ok(list.at(-1).text.includes('던짐'));
    assert.ok(!list.some(e => e.text.includes('다른 확장')));
});

await test('enabledPaths: 켜진 스위치 경로만 · 글자 · 숫자 · 색 값은 없다', () => {
    const paths = D.enabledPaths({ enabled: true, palette: 'night', customName: '내 팔레트', chat: { qrFind: true, size: 15, color: '#ff0000', deep: { a: { b: { c: { d: true } } } } }, off: false, list: [true] });
    assert.deepEqual(paths, ['enabled', 'chat.qrFind']);
});

const SRC = '<content>\n「안녕, 리나.」 그녀가 웃었다.\n\n<!-- 점검: 장면 확인 -->\n\n「오늘은 비가 와.」 렉스가 창밖을 보았다.\n</content>';
await test('messageReport: 번역기 판정(주석 깨짐 · 끊김 · 괄호)과 길이 · 추론은 길이만', () => {
    const broken = '<content>\n「안녕, 리나.」 그녀가 웃었다.\n\n<!-- 점검: 장면';
    const msg = { mes: SRC, is_user: false, swipes: ['a', 'b'], extra: { display_text: broken, reasoning: '생각 '.repeat(50), stream_cut: true } };
    const r = D.messageReport(msg, 7, seg);
    assert.equal(r.index, 7);
    assert.equal(r.lengths.reasoning, 150);
    assert.equal(r.checks.openComment, true);
    assert.equal(r.checks.brokenComments, seg.brokenComments(SRC, broken));
    assert.equal(r.checks.looksCutShort, seg.looksCutShort(SRC, broken));
    assert.deepEqual(r.checks.brackets['「'], [2, 1]);
    assert.equal(r.checks.streamCut, true);
    assert.equal(r.original, SRC);
    assert.ok(!JSON.stringify(r).includes('생각 생각'), '추론 글은 없음');
    if (typeof seg.restoreDialogueBrackets === 'function') assert.equal(typeof r.checks.bracketsMissing, 'boolean');
    const bare = D.messageReport(msg, 7, seg, { withText: false });
    assert.ok(!('original' in bare) && !('translation' in bare));
    const none = D.messageReport({ mes: '짧은 답', extra: {} }, 0, seg);
    assert.equal(none.checks.hasTranslation, false);
    assert.equal(none.checks.openComment, null);
});

await test('buildDiagnosisFile: 정해진 칸만 · 다른 메시지 · 키가 섞이지 않는다', () => {
    const file = D.buildDiagnosisFile({ versions: { blueLemonade: '6.6.9' }, features: { switchesOn: ['enabled'] }, errors: [], environment: {}, message: null, now: new Date('2026-10-15T00:00:00Z') });
    assert.deepEqual(Object.keys(file), ['kind', 'schema', 'createdAt', 'versions', 'environment', 'features', 'errors', 'message']);
    assert.equal(file.kind, 'blue-lemonade-diagnosis');
    const src = fs.readFileSync(path.join(root, 'src/diag-file.js'), 'utf8');
    for (const banned of ['secrets', 'api_key', 'oai_settings', 'chat_metadata', 'getRequestHeaders', 'name2', '.name']) assert.ok(!src.includes(banned), `diag-file.js 에 ${banned} 없음`);
});

await test('애드온 판: 모든 내장 애드온 폴더가 표에 있고, 파일 앞 4KB 에서 판을 찾는다', async () => {
    const dir = path.join(root, 'src/addons');
    const folders = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && fs.readdirSync(path.join(dir, d.name)).some(f => /\.(js|json)$/.test(f))).map(d => d.name);
    const missing = folders.filter(id => !V.ADDON_VERSION_FILES[id]);
    assert.deepEqual(missing, [], `표에 없는 애드온: ${missing.join(', ')}`);
    for (const [id, [label, file]] of Object.entries(V.ADDON_VERSION_FILES)) {
        assert.ok(label && folders.includes(id), id);
        const head = fs.readFileSync(path.join(dir, file)).subarray(0, 4096).toString('utf8');
        assert.match(V.versionIn(head, file), /^\d+\.\d+\.\d+$/, `${file} 앞 4KB 에 판 없음`);
    }
    assert.equal(V.versionIn(fs.readFileSync(path.join(dir, 'translator/manifest.json'), 'utf8'), 'x.json'), JSON.parse(fs.readFileSync(path.join(dir, 'translator/manifest.json'), 'utf8')).version);
    const asked = [];
    const list = await V.addonVersions({ tts: true }, { base: pathToFileURL(dir + '/'), fetcher: async (url, init) => { asked.push(init.headers.Range); const text = fs.readFileSync(new URL(url)).toString('utf8'); return new Response(text); } });
    assert.equal(list.length, Object.keys(V.ADDON_VERSION_FILES).length);
    assert.ok(list.every(a => /^\d+\.\d+\.\d+$/.test(a.version)), JSON.stringify(list.filter(a => !a.version)));
    assert.ok(list.find(a => a.id === 'tts').on && !list.find(a => a.id === 'translator').on);
    assert.ok(asked.every(r => r === 'bytes=0-4095'), '앞부분만 요청');
});

// 6.7.5 (회귀검사 6.7.4 화면): 진단 창 메시지 번호는 세로 2줄 파라미터 · 설치된 판의 꺼진 칸은 글자를 흐리게 하지 않는다(대비 나이트 3.5 · 라이트 2.5 였다)
await test('화면 규칙: 메시지 번호 세로 2줄 · 꺼진 애드온 칸은 점선 테두리', () => {
    const css = fs.readFileSync(path.join(root, 'css/70-sync-update-diag.css'), 'utf8');
    assert.match(css, /\.bl-diag-file \.bl-diag-pick \{ flex-direction: column; align-items: stretch;/);
    assert.match(css, /\.bl-diag-file input\[type="number"\] \{ width: 100%;/);
    assert.ok(!/div\.is-off \{[^}]*opacity/.test(css), '꺼진 칸에 opacity 없음');
    assert.match(css, /div\.is-off \{[^}]*border: 1px dashed/);
    assert.ok(fs.readFileSync(path.join(root, 'src/theme-update.js'), 'utf8').includes('점선 칸은 꺼 둔 애드온이에요.'));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
