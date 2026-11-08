// 1.0.1 마트에서 가져오기 — 받은 JSON(코드 없음 · 데이터만) 검사 · 살균 · 중복 · 상한 · 잘못된 JSON 거절 · 틈 템플릿 렌더 (DOM 없는 부분)
//   node tools/tests/mart-import.mjs <테마 루트>
// 그림 디코드 확인 · 창(mart-import-ui.js)은 브라우저가 필요해 리그에서 봐요(사이트 「복사」 → 테마 「마트에서 가져오기」).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { checkTemplate, fillTemplate, tidyTemplateColors, TEMPLATE_ROLES, TEMPLATE_MAX } = await load('src/log-copy-template.js');
const { readMart, checkItem, findDupes, addMartItems, summary, FRAME_LIMIT, FRAME_BYTES, ART_MAX, CUSTOM_MAX, MART_URL } = await load('src/mart-import.js');
const { renderLog, PRESETS, presetsIn, CATEGORIES } = await load('src/log-copy-presets.js');

const T = '<div style="padding:8px;background-color:#111111">{{head}}<div style="border-radius:12px">{{body}}</div>{{info}}<span aria-hidden="true" style="position:absolute;left:0">★</span><p>{{tail}}</p></div>';
const colors = Object.fromEntries(TEMPLATE_ROLES.map(k => [k, '#223344']));
Object.assign(colors, { bg: '#101010', panel: '#fbf4e4', panel2: '#f3e6cc', text: '#3b2a1c', dialogue: '#8c2f1b', thought: '#4f5f22', emphasis: '#9a4a14', name: '#6b3a1c', muted: '#6e5440', face: '#efe0c2', faceText: '#3b2a1c', faceMuted: '#5e4632', mark: '#ecd9b3', chip: '#e3d2b0', chipText: '#3b2a1c', accent: '#8a5a32', onAccent: '#fff8ec' });
const geulkku = (more = {}) => ({ kind: 'geulkku', id: 'halloween-coffin', label: '관', emoji: '⚰️', template: T, colors, messages: 'box', tail: '쉿', ...more });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const frame = (more = {}) => ({ kind: 'frame', id: 'mart-test', name: '시험 액자', decor: { art: PNG, mask: PNG, ratio: 0.75 }, ...more });
const pack = (...items) => JSON.stringify({ 'bl-mart': 1, items });

await test('틈 템플릿 살균: 허용 태그 · style 만 · 나쁜 스타일 · 길이 · 네 자리 한 번씩 — 어긋나면 통째로 거절', () => {
    assert.equal(checkTemplate(T).ok, true);
    const bad = {
        '<img src=x>': /태그|</, '<a href="x">{{head}}{{body}}{{info}}{{tail}}</a>': /태그예요\(a\)/, '<script>x</script>': /태그예요\(script\)/, '<style>p{}</style>': /태그예요\(style\)/,
        '<div class="x">{{head}}{{body}}{{info}}{{tail}}</div>': /속성이에요\(class\)/, '<div id="x">{{head}}{{body}}{{info}}{{tail}}</div>': /속성이에요\(id\)/,
        '<div onclick="x">{{head}}{{body}}{{info}}{{tail}}</div>': /속성이에요\(onclick\)/, '<div aria-hidden="false">{{head}}{{body}}{{info}}{{tail}}</div>': /속성/,
        '<div style="background:url(x.png)">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/, '<div style="background:URL (x)">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/,
        '<div style="width:expression(alert(1))">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/, '<div style="position:fixed;inset:0">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/,
        '<div style="behavior:url(x)">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/, '<div style="background:u\\72l(x)">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/,
        '<div style="background:&#117;rl(x)">{{head}}{{body}}{{info}}{{tail}}</div>': /스타일/, '<div style="{{head}}">{{body}}{{info}}{{tail}}</div>': /속성 안/,
        '<div>{{head}}{{body}}{{info}}</div>': /\{\{tail\}\}/, '<div>{{head}}{{head}}{{body}}{{info}}{{tail}}</div>': /\{\{head\}\}/, '<div>{{head}}{{body}}{{info}}{{tail}}{{x}}</div>': /모르는 자리/,
        '<div>{{head}}{{body}}{{info}}{{tail}}': /닫지 않은/, '<div>{{head}}{{body}}{{info}}{{tail}}</span>': /어긋/, '<!-- x --><div>{{head}}{{body}}{{info}}{{tail}}</div>': /주석/,
        "<div style='x'>{{head}}{{body}}{{info}}{{tail}}</div>": /</, '<div>a < b{{head}}{{body}}{{info}}{{tail}}</div>': /</, '': /비어/,
    };
    for (const [html, reason] of Object.entries(bad)) { const r = checkTemplate(html); assert.equal(r.ok, false, html); assert.match(r.reason, reason, `${html} → ${r.reason}`); }
    assert.equal(checkTemplate(`<div>{{head}}{{body}}{{info}}{{tail}}${'x'.repeat(TEMPLATE_MAX)}</div>`).ok, false, '64KB 넘음');
    assert.equal(checkTemplate(`${'<div>'.repeat(70)}{{head}}{{body}}{{info}}{{tail}}${'</div>'.repeat(70)}`).ok, false, '깊이 64 넘음');
    assert.equal(checkTemplate('<div style="clip-path:polygon(0 0)"><b>{{head}}</b><br><em>{{body}}</em><strong>{{info}}</strong><i>{{tail}}</i><br/></div>').ok, true, '허용 태그 · 스스로 닫는 br');
    assert.equal(checkTemplate('<div style="font-family:curl">{{head}}{{body}}{{info}}{{tail}}</div>').ok, true, 'curl 같은 낱말은 url( 이 아니에요');
    assert.equal(fillTemplate(T, { head: 'H$&', body: 'B', info: '', tail: 'T' }).includes('H$&'), true, '부품 글의 $ 는 그대로');
});

await test('그림 부품(1.0.1 · 11-04): url(\'data:image/svg+xml,…\') 만 허용 — 스크립트 · on…= · href · xlink · foreignObject · 바깥 url( 이 든 svg 와 다른 주소는 거절', async () => {
    const { svgDoc, svgUrl } = await load('src/log-copy-concept-kit.js');
    const { safeSvgData } = await load('src/log-copy-template.js');
    const S = '{{head}}{{body}}{{info}}{{tail}}';
    const tpl = style => `<div style="${style}">${S}</div>`;
    const pic = inner => svgUrl(svgDoc(10, 10, inner));
    const good = pic('<defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/></radialGradient></defs><circle cx="5" cy="5" r="4" fill="url(#g)"/>');
    assert.match(good, /^url\('data:image\/svg\+xml,%3Csvg xmlns=%22http:\/\/www\.w3\.org\/2000\/svg%22/, '퍼센트 인코딩 · 작은따옴표');
    assert.ok(!/[<>"#;{}()]/.test(good.slice(good.indexOf(',') + 1, -2)), '인코딩 글에 < > " # ; { } ( ) 없음');
    assert.equal(checkTemplate(tpl(`background:${good} center/100% 100% no-repeat`)).ok, true, '그림 부품 허용');
    assert.equal(checkTemplate(tpl(`-webkit-mask:${good} center/contain no-repeat;background:linear-gradient(#fff,#000)`)).ok, true, '가림(mask)도 같은 꼴');
    for (const inner of ['<script>alert(1)</script>', '<rect onload="x"/>', '<a href="x"><rect/></a>', '<image xlink:href="http://x/a.png"/>', '<use href="#a"/>', '<foreignObject><div>x</div></foreignObject>', '<rect fill="url(http://x/a)"/>', '<style>@import "x"</style>', '<!DOCTYPE svg><rect/>']) {
        const r = checkTemplate(tpl(`background:${pic(inner)}`));
        assert.equal(r.ok, false, inner); assert.match(r.reason, /그림\(svg\)/, inner);
    }
    for (const style of ["background:url('data:image/png;base64,AAAA')", "background:url('http://x/a.svg')", "background:url('https://x/a.svg')", 'background:url(data:image/svg+xml,%3Csvg%3E)', "background:url('javascript:alert(1)')", "background:url('data:image/svg+xml,%3Cdiv%3E%3C/div%3E')"]) assert.equal(checkTemplate(tpl(style)).ok, false, style);
    assert.equal(safeSvgData('%E0%A4%A'), false, '깨진 인코딩');
    assert.equal(safeSvgData(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(2000)}</svg>`)), false, '8KB 넘는 그림');
});

await test('readMart: 잘못된 JSON · 표시 없음 · 빈 꾸러미 거절 · 항목마다 이유 · 같은 id 두 번 · 상한', () => {
    assert.match(readMart('').error, /없어요/);
    assert.match(readMart('{bad').error, /JSON/);
    assert.match(readMart('{"items":[]}').error, /bl-mart/);
    assert.match(readMart('{"bl-mart":2,"items":[1]}').error, /bl-mart/);
    assert.match(readMart('{"bl-mart":1,"items":[]}').error, /없어요/);
    assert.match(readMart('<div>내 글꾸</div>').error, /JSON/, 'HTML 은 마트 글이 아니에요');
    const r = readMart(pack(geulkku(), geulkku(), frame(), { kind: 'script', id: 'x' }, frame({ id: 'bad id!' }), frame({ id: 'f2', decor: { art: 'data:image/svg+xml;base64,AAAA', mask: PNG, ratio: 1 } }),
        frame({ id: 'f3', decor: { art: 'https://example.com/a.png', mask: PNG, ratio: 1 } }), frame({ id: 'f4', decor: { art: PNG, mask: PNG, ratio: 99 } }), geulkku({ id: 'g2', template: '<img src=x onerror=alert(1)>' }),
        geulkku({ id: 'g3', colors: { bg: '#000000' } }), geulkku({ id: 'g4', colors: { ...colors, text: 'red; background:url(x)' } })));
    assert.deepEqual(r.items.map(x => `${x.kind}:${x.id}`), ['geulkku:halloween-coffin', 'frame:mart-test']);
    const reasons = r.skipped.map(s => s.reason).join('\n');
    for (const why of [/두 번/, /모르는 종류/, /id 가 틀려요/, /PNG/, /비율/, /태그/, /색 묶음이 모자라요/]) assert.match(reasons, why);
    assert.equal(r.skipped.length, 9);
    const many = readMart(pack(...Array.from({ length: 70 }, (_, i) => frame({ id: `m${i}` }))));
    assert.equal(many.items.length, 60); assert.match(many.skipped[0].reason, /60개까지/);
    assert.equal(checkItem(frame({ decor: { art: 'data:image/png;base64,' + 'A'.repeat(ART_MAX), mask: PNG, ratio: 1 } })).reason.includes('너무 커요'), true);
    const g = readMart(pack(geulkku({ label: '<b>관</b>', tail: '<script>', messages: 'evil' }))).items[0];
    assert.ok(!/[<>]/.test(g.name + g.tail), '이름 · 꼬리의 꺾쇠는 걷어요'); assert.equal(g.messages, 'box');
});

await test('프리셋 액자: 이 테마에 있는 프리셋 · 색 #rrggbb · 글자 12자 · 비율 50~200', () => {
    const ok = checkItem({ kind: 'frame-preset', id: 'simple-chip-pink', name: '라벨 칩', presetId: 'chip', presetColor: '#1B1E24', presetAccent: '#ff8fab', presetLabel: '아주아주긴라벨글자입니다요', frameWidth: 999, frameHeight: 'x' }).item;
    assert.equal(ok.presetColor, '#1b1e24'); assert.equal(ok.presetLabel.length, 12); assert.equal(ok.frameWidth, 200); assert.equal(ok.frameHeight, 100);
    assert.match(checkItem({ kind: 'frame-preset', id: 'x', presetId: 'nope', presetColor: '#000000', presetAccent: '#000000' }).reason, /없는 프리셋/);
    assert.match(checkItem({ kind: 'frame-preset', id: 'x', presetId: 'line', presetColor: 'red', presetAccent: '#000000' }).reason, /색/);
    assert.equal(checkItem({ kind: 'frame-preset', id: 'x', presetId: 'line', presetColor: '#000000', presetAccent: '#000000' }).item.presetLabel, undefined, '칩 없는 프리셋은 글자 없음');
});

await test('넣기: 중복은 덮어쓸 때만 · 보관함 30개 · 12MB · 내 글꾸 20개 · 기본 글꾸 id 금지 · 결과 요약', () => {
    const s = { frameLibrary: [{ id: 'mart-test', name: '옛것', decor: { art: PNG, mask: PNG } }], logCopy: { custom: [{ id: 'halloween-coffin', name: '옛 관', html: '<div></div>', slot: null }] } };
    const items = readMart(pack(geulkku(), frame(), frame({ id: 'new-one' }), { kind: 'frame-preset', id: 'simple-line', name: '얇은 선', presetId: 'line', presetColor: '#2a3140', presetAccent: '#86b5d5' })).items;
    assert.deepEqual(findDupes(s, items).map(x => x.id), ['halloween-coffin', 'mart-test']);
    const drawn = [];
    let r = addMartItems(s, items, { draw: item => { drawn.push(item.presetId); return { art: PNG, mask: PNG, ratio: 0.75, presetVersion: 6 }; } });
    assert.deepEqual(r.frames, ['new-one', 'simple-line']); assert.deepEqual(r.geulkku, []); assert.equal(r.skipped.length, 2); assert.match(r.skipped[0].reason, /이미 있어서/);
    assert.deepEqual(drawn, ['line']);
    const preset = s.frameLibrary.find(x => x.id === 'simple-line').decor;
    assert.equal(preset.presetId, 'line'); assert.equal(preset.on, true); assert.equal(preset.presetAccent, '#86b5d5');
    r = addMartItems(s, items.slice(0, 2), { replace: new Set(['halloween-coffin', 'mart-test']) });
    assert.deepEqual(r.replaced, ['관', '시험 액자']);
    const mine = s.logCopy.custom[0];
    assert.equal(mine.template, T); assert.equal(mine.emoji, '⚰️'); assert.equal(mine.html, ''); assert.equal(mine.name, '관');
    assert.equal(s.frameLibrary.find(x => x.id === 'mart-test').name, '시험 액자');
    assert.match(summary(r).head, /액자 1개 · 글꾸 1개를 넣었어요\(덮어쓴 것 2개\)/);
    // 상한
    const full = { frameLibrary: Array.from({ length: FRAME_LIMIT }, (_, i) => ({ id: `f${i}`, decor: { art: PNG, mask: PNG } })), logCopy: { custom: Array.from({ length: CUSTOM_MAX }, (_, i) => ({ id: `c${i}` })) } };
    r = addMartItems(full, readMart(pack(frame({ id: 'z1' }), geulkku({ id: 'z2' }))).items);
    assert.deepEqual(r.skipped.map(x => x.reason), [`보관함은 ${FRAME_LIMIT}개까지예요`, `내 글꾸는 ${CUSTOM_MAX}개까지예요`]);
    const big = 'data:image/png;base64,' + 'A'.repeat(3_500_000);
    const heavy = { frameLibrary: [1, 2, 3].map(i => ({ id: `h${i}`, decor: { art: big, mask: PNG } })) };
    r = addMartItems(heavy, [{ kind: 'frame', id: 'h4', name: '큰 것', decor: { art: big, mask: PNG, ratio: 1 } }]);
    assert.match(r.skipped[0].reason, /12MB/);
    r = addMartItems({}, readMart(pack(geulkku({ id: 'card' }))).items, { taken: new Set(PRESETS.map(p => p.id)) });
    assert.match(r.skipped[0].reason, /기본 글꾸/);
    assert.match(summary({ skipped: [{ name: 'a', reason: 'b' }] }).lines[0], /a — b/);
});

await test('상한 · 주소가 테마의 다른 곳과 같아요(frame-library · decor · log-copy-sheet · settings · repo)', () => {
    assert.match(read('src/frame-library.js'), new RegExp(`FRAME_LIMIT = ${FRAME_LIMIT};`));
    assert.match(read('src/frame-library.js'), /BYTE_LIMIT = 12 \* 1024 \* 1024/); assert.equal(FRAME_BYTES, 12 * 1024 * 1024);
    assert.match(read('src/decor.js'), new RegExp(`d\\[key\\]\\.length > ${ART_MAX}`));
    assert.match(read('src/log-copy-sheet.js'), new RegExp(`CUSTOM_MAX = ${CUSTOM_MAX};`));
    assert.match(read('src/settings.js'), /c\.template\.length <= 65536/);
    assert.equal(MART_URL, 'https://kgangkgang.github.io/blue-lemonade/mart');
});

await test('렌더: 내 글꾸 template 은 받은 색 묶음으로 네 자리에 부품을 끼워요 · 인라인만 · 할로윈은 기본 목록에서 빠졌어요', () => {
    const font = { color: 'rgb(219, 226, 235)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '26px' };
    const model = { chatName: 'S', base: { bg: 'rgb(20, 31, 46)', ...font }, messages: [{ name: 'Seraphina', nameStyle: {}, font, nodes: [{ t: 'el', block: true, tag: 'div', kind: 'p', style: font, children: [{ t: 'text', text: '어서 와요' }] }] }] };
    const item = readMart(pack(geulkku())).items[0];
    const html = renderLog(model, { template: item, ui: { family: 'sans-serif', tracking: 'normal' }, fields: { title: '제목', mark: 'LOG', info: '정보', tail: '' } });
    assert.ok(html.includes('어서 와요') && html.includes('제목') && html.includes('정보') && html.includes('쉿'), '본문 · 제목 · 추가 정보 · 꼬리');
    assert.ok(html.includes('#fbf4e4') || html.includes('rgb(251, 244, 228)'), '메시지 칸은 받은 panel 색');
    assert.ok(!/\{\{|<script|\sclass=|\son[a-z]+=/.test(html), '자리 표시 · 실행 · class 없음');
    assert.equal(renderLog(model, { shape: 'plain', template: { colors } }).includes('어서 와요'), true, 'template 글이 없으면 보통 길');
    assert.ok(!PRESETS.some(p => /^halloween/.test(p.id)) && !CATEGORIES.some(c => c.id === 'halloween'), '할로윈 13종은 테마 기본에서 빠짐(1.0.1 2단계)');
    assert.deepEqual(presetsIn('mine', [{ id: 'halloween-coffin', template: T }]), ['halloween-coffin'], '받은 할로윈은 「내 글꾸」에');
    assert.ok(!fs.existsSync(path.join(root, 'src/log-copy-mart-halloween.js')), '할로윈 원본은 tools/mart 로 — 테마에 안 실려요');
    const { colors: tidy, missing } = tidyTemplateColors({ ...colors, deco1: 'nope' });
    assert.deepEqual(missing, []); assert.match(tidy.deco1, /^#[0-9a-f]{6}$/);
});

await test('설정 정리: 마트 글꾸(template)는 html 없이도 남고 · 너무 큰 템플릿은 걸러요 · 설정 키는 그대로', async () => {
    const src = read('src/settings.js');
    assert.match(src, /typeof c\.template === 'string' \? c\.template\.length <= 65536 : typeof c\.html === 'string' && c\.html\.length <= 60000/);
    assert.match(src, /template: c\.template, colors: isObj\(c\.colors\) \? c\.colors : \{\}, messages: str\(c\.messages, 12\) \|\| 'box', tail: str\(c\.tail, 60\), emoji: str\(c\.emoji, 8\)/);
    const keys = JSON.parse(read('tools/tests/settings-keys-1000.json')).keys;
    assert.ok(keys.includes('logCopy.custom') && keys.includes('frameLibrary') && !keys.some(k => /mart/i.test(k)), '새 설정 키 없음(보관함 · 내 글꾸 그대로)');
});

await test('화면: 보관함 · 내 글꾸 두 곳의 「마트에서 가져오기」 · 새 창 마트 · 붙여넣기 · 파일 · 덮어쓰기 묻기 · 결과 요약', () => {
    const panel = read('src/panel.js'), sheet = read('src/log-copy-sheet.js'), ui = read('src/mart-import-ui.js');
    assert.match(panel, /data-act="mart-import"/); assert.match(panel, /case 'mart-import':[\s\S]{0,200}import\('\.\/mart-import-ui\.js'\)/, '설정 창은 누를 때 받아요');
    assert.match(sheet, /data-lc="mart"/); assert.match(sheet, /if \(\/\^\\\{\[\\s\\S\]\*"bl-mart"\/\.test\(raw\)\) \{ openMart\(raw\); return; \}/, '붙여넣기 칸에 마트 글을 넣어도 알아서');
    assert.match(sheet, /if \(mine && !mine\.template\) html = mine\.html;/); assert.match(sheet, /template: (?:inkTemplate\(\) \?\? )?mine(?:, names: !s3\.namesOff)? \}\)/);   // 1.0.7 이름 줄 칩
    assert.match(ui, /target="_blank" rel="noopener noreferrer"/); assert.match(ui, /accept="\.json,application\/json"/);
    assert.match(ui, /덮어쓸까요\?/); assert.match(ui, /decodes\(item\.decor\.art\)/); assert.match(ui, /summary\(result/);
    assert.ok(!/\beval\(|new Function|innerHTML = [^`]*item\./.test(ui), '받은 글을 실행 · HTML 로 꽂지 않아요');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
