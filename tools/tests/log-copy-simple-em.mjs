// 로그 복사 받은 심플 글꾸: 굵게 · 기울임 · 취소선을 마트 견본과 같은 <strong> · <em> · <s> 로 그려요(11-12 칸 점검)
//   마트 세밀 「강조 · 속마음 · 취소선」 규칙(geulkku-mart/look.js)이 strong · em · s 를 겨눠서, 전처럼 <b> · <i> 로 그리면(취소선은 빠짐)
//   그 갈래 칸(색 · 크기 · 굵기 · 자간 · 형광펜 · 선 굵기 …)을 눌러도 규칙만 붙고 글자는 그대로였어요.
//   node tools/tests/log-copy-simple-em.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { readMart } = await load('src/mart-import.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const ui = await load('src/log-copy-tune-ui.js');
const { capsRow } = await load('src/geulkku-mart/caps-table.js');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/geulkku-set-mart.json'), 'utf8'));
const it = readMart(JSON.stringify(fixture.packs['simple-k1'])).items[0];
// 실리태번 캡처 꼴: 굵게 = font-weight · 기울임 = font-style · 취소선 = text-decoration(지문 문단 안)
const el = (style, text) => ({ t: 'el', block: false, style, children: [{ t: 'text', text }] });
const model = { messages: [{ name: 'Seraphina', nodes: [{ t: 'el', block: true, children: [
    { t: 'text', text: '여기는 ' }, el({ 'font-weight': '700' }, '안전'), { t: 'text', text: '해요. ' },
    el({ 'font-style': 'italic' }, '그녀가 미소 지었다.'), { t: 'text', text: ' ' }, el({ 'text-decoration': 'line-through' }, '조금'),
] }] }] };
const draw = set => renderLog(model, { simple: { frame: it.frame, set }, setMod, caps: capsRow(it.frame.key), mode: 'dark', fields: { title: '제목' }, lemonLink: true });
const body = html => html.slice(html.lastIndexOf('</style>'));

await test('그리기: 굵게 · 기울임 · 취소선 = <strong> · <em> · <s>(<b> · <i> 없음)', () => {
    const b = body(draw(it.set));
    assert.match(b, /<strong>안전<\/strong>/);
    assert.match(b, /<em>그녀가 미소 지었다\.<\/em>/);
    assert.match(b, /<s>조금<\/s>/);
    assert.doesNotMatch(b, /<b>|<i>/);
});

await test('세밀 「강조 · 속마음 · 취소선」 칸: 마트 규칙이 실제로 그린 글자 태그를 겨눠요', () => {
    const cases = [
        ['look|strong.weight|800', /strong\{[^}]*font-weight:800/, 'strong'],
        ['look|strong.color|"#ff0000"', /strong\{[^}]*color:#ff0000/, 'strong'],
        ['look|em.color|"#00aa00"', /em\{[^}]*color:#00aa00/, 'em'],
        ['look|em.size|20', /em\{[^}]*font-size:20px/, 'em'],
    ];
    for (const [act, rule, tag] of cases) {
        const html = draw(ui.fineAct(it.set, it.frame.key, act, 'dark'));
        assert.match(html, rule, `${act}: 규칙`);
        assert.match(body(html), new RegExp(`<${tag}>`), `${act}: 규칙이 겨누는 <${tag}> 가 글에 있어요`);
    }
});

console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
