// 1.1.8 받는 틀 늘리기 — 한 꼴로 안 늘던 마트 심플 틀을 줄 갈래(vary) · 칸 묶음(units)으로 받아 그려요 (DOM 없는 부분)
//   node tools/tests/log-copy-simple-more.mjs <테마 루트>
//   견본: tools/tests/fixtures/mart-more-sample.json(마트 원래 판 그대로 9틀). 받던 357틀이 한 글자도 안 바뀐 것은 tools/mart/takeable-same.mjs 가 맞대요(앞 판 사본 필요 · CI 밖).
import fs from 'node:fs';
import { assert, root, load, suite } from './_t.mjs';
import path from 'node:path';

const t = suite('log-copy-simple-more');
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/mart-more-sample.json'), 'utf8')).items;
const { checkItem } = await load('src/mart-import.js');
const { checkFrame } = await load('src/log-copy-simple.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const { probeOf } = await load('src/log-copy-tune-set.js');
const { sanitizeTree } = await load('src/log-copy-sanitize.js');
const { parse, sanitizedBy } = await load('tools/tests/_simple-dom.mjs');
const sanitized = sanitizedBy(sanitizeTree);

const take = key => { const r = checkItem({ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: sample[key].name, html: sample[key].html, set: { blGeulkku: 2 } }); assert.ok(r.item, `${key}: ${r.reason}`); return r.item; };
const text = s => ({ t: 'text', text: s });
const band = s => ({ t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [text(s)] });
// 화자 셋 · 대사 뒤 지문(새 묶음) · 지문만 · 대사만 메시지
const model = { base: { color: '#dddddd', bg: '#111111' }, messages: [
    { name: '알파', nodes: [text('지문하나.'), { t: 'hr' }, band('「대사하나.」'), { t: 'hr' }, text('지문둘.'), { t: 'hr' }, band('「대사둘.」')] },
    { name: '베타', nodes: [band('「대사셋.」'), { t: 'hr' }, text('지문셋.')] },
    { name: '감마', nodes: [text('지문넷.')] },
] };
const ORDER = ['지문하나', '대사하나', '지문둘', '대사둘', '대사셋', '지문셋', '지문넷'];
const lookup = name => ({ 알파: '#e05a5a', 베타: '#33aa66' })[name] ?? null;
const draw = (item, o = {}) => renderLog(model, { simple: { id: item.id, frame: item.frame, set: item.set }, mode: 'dark', fields: { title: '제목' }, ...o });
const body = html => html.slice(html.indexOf('</style>')).replace(/<!-- ✎[^>]*-->/g, '');   // 고칠 자리 주석은 빼고 봐요
const count = (s, re) => (s.match(re) || []).length;

await t.test('받기: 견본 9틀이 줄 갈래 · 칸 묶음 등록 값으로 들어오고 등록 값 점검을 통과해요', () => {
    const kinds = Object.fromEntries(Object.keys(sample).map((k) => { const f = take(k).frame; assert.deepEqual(checkFrame(f), [], k); return [k, f.units ? 'units' : f.vary ? 'vary' : 'rows']; }));
    assert.deepEqual(kinds, { k1053: 'vary', k1079: 'vary', k1288: 'vary', k1170: 'rows', k1107: 'rows', k1060: 'vary', k1101: 'units', k1105: 'units', k1192: 'units' });
    const k1053 = take('k1053').frame;
    assert.deepEqual(k1053.vary.대사.forms, ['<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span>&#8288;<span class="gk-pf"></span></p>', '<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span>&#8288;<span class="gk-pf gk-p2"></span></p>']);
    assert.deepEqual(take('k1079').frame.vary.대사, { base: '<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>', accent: '<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span>&#8288;<span class="gk-hh"></span></p>', at: 'last' });
    assert.equal(take('k1288').frame.vary.대사.at, 'first');
    assert.equal(take('k1170').frame.rows.대사, '<p class="gk-dl gk-l{{화자}}"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>', '화자 글자 class 는 {{화자}} 로');
    const radio = take('k1107').frame;
    assert.doesNotMatch(body(radio.html), /<audio|gk-sv/); assert.match(radio.html, /^<div class="gk [^"]*\bgk-noaud"/, '소리 칸은 빼고 뿌리에 gk-noaud');
    assert.match(take('k1060').frame.rows.이름, /^<p class="gk-nm gk-t2 gk-n\{\{화자\}\}">/, '줄 머리 class 차례를 맞춰요');
    const discord = take('k1101').frame;
    assert.deepEqual(discord.colors0, { A: '#3aa7ff', B: '#ff5fa2' }, '띠 색이 없는 틀은 얼굴 동그라미 색으로');
    assert.equal(discord.main, 'A'); assert.equal(discord.second, 'B');
    assert.ok(discord.html.includes('\n{{로그}}\n{{로그:2}}\n'));
    assert.deepEqual(take('k1192').frame.nameFill, { A: '깡통' }, '로그 밖 주인 이름 칸');
    assert.equal(take('k1105').frame.colors0, undefined, '띠 색이 있는 칸 묶음 틀은 띠 색 그대로');
});

await t.test('그리기: 9틀 × 낮밤 × 이름 보임/숨김 — 글이 다 · 차례대로 · 자리표가 안 남고 · 소독기를 거쳐도 같아요', () => {
    for (const k of Object.keys(sample)) {
        const item = take(k);
        for (const mode of ['light', 'dark']) for (const names of [true, false]) for (const tuned of [false, true]) {
            const out = draw(item, { mode, names, lookup, ...(tuned ? { setMod, simple: { id: item.id, frame: item.frame, set: setMod.withMotion(setMod.withStyle({ blGeulkku: 2 }, setMod.LOOKS[1].id), 'l') } } : {}) });
            const where = `${k} ${mode} ${names} ${tuned}`;
            assert.doesNotMatch(out, /\{\{/, where);
            assert.equal(sanitized(out), parse(out).innerHTML, where);
            const plain = out.replace(/<[^>]*>/g, '');
            let at = -1;
            for (const w of ORDER) { const i = plain.indexOf(w); assert.ok(i > at, `${where}: ${w}`); at = i; }
            assert.equal(/알파|베타|감마/.test(plain), names, `${where}: 이름`);
        }
    }
});

await t.test('줄 갈래: 견본 차례대로 돌려 쓰기 · 끝 꾸밈은 한 줄에만(끝 줄 · 첫 줄) · 화자 글자 class 는 그 줄 화자로', () => {
    const paws = [...body(draw(take('k1053'))).matchAll(/<span class="gk-pf( gk-p2)?"><\/span>/g)].map(m => !!m[1]);
    assert.deepEqual(paws, [false, true, false], '대사 셋 — 발자국 p2 가 번갈아');
    const hearts = body(draw(take('k1079')));
    assert.equal(count(hearts, /gk-hh/g), 1); assert.match(hearts, /「대사셋\.」<\/span>&#8288;<span class="gk-hh">/, '하트는 끝 대사에만');
    const aid = body(draw(take('k1288')));
    assert.equal(count(aid, /class="gk-pf"/g), 1); assert.match(aid, /「대사하나\.」<\/span>&#8288;<span class="gk-pf">/, '반창고는 첫 대사에만');
    const flower = draw(take('k1170'), { lookup });
    const rowsOf = [...body(flower).matchAll(/<p class="gk-dl gk-l([A-Z])"><span class="gk-d gk-d([A-Z])">「(대사[^.]+)/g)].map(m => [m[1], m[2], m[3]]);
    assert.equal(rowsOf.length, 3); for (const [l, d] of rowsOf) assert.equal(l, d, '줄 바탕 class 글자 = 띠 글자');
    assert.notEqual(rowsOf[0][0], rowsOf[2][0], '알파 · 베타는 다른 글자');
    assert.match(flower, new RegExp(`\\.gk-l${rowsOf[2][0]}\\{background-color:`), '바꾼 화자 색의 줄 바탕 규칙');
});

await t.test('칸 묶음: 첫 묶음은 첫 칸 · 나머지는 둘째 칸 · 지문만 묶음은 대사 칸을 빼고 · 대사만 묶음은 지문 자리를 빼요', () => {
    const out = body(draw(take('k1101'), { lookup }));
    assert.equal(count(out, /class="gk-rv gk-r1"/g), 1); assert.equal(count(out, /class="gk-rv gk-r2"/g), 4, '묶음 다섯(알파 둘 · 베타 둘 · 감마 하나)');
    assert.equal(count(out, /class="gk-ms"/g), 3, '대사가 있는 묶음만 메시지 칸');
    assert.match(out, /<span class="gk-av gk-aB"><\/span>\n<p class="gk-nm gk-nB">베타<span class="gk-ts">/);
    assert.match(out, /<div class="gk-rv gk-r2"><div class="gk-ri">\n<p class="gk-nr">지문넷\.<\/p>\n<\/div><\/div>/, '지문만: 메시지 칸 없이');
    assert.match(out, /<div class="gk-rv gk-r2"><div class="gk-ri">\n<div class="gk-ms">\n<span class="gk-av gk-aB">/, '대사만: 지문 자리 없이');
    const hidden = body(draw(take('k1101'), { names: false }));
    assert.match(hidden, /<p class="gk-nm gk-nA"><span class="gk-ts">오늘 오후 9:41<\/span><\/p>/, '이름을 숨겨도 시각은 남아요');
    const skull = body(draw(take('k1105')));
    assert.doesNotMatch(skull.split('지문넷')[1] ?? '', /gk-nm/, '칸 높이 이름 줄은 지문만 묶음에서 빼요');
    assert.match(skull, /<div class="gk-fo"><div class="gk-fi">\n<p class="gk-nr">지문넷/);
});

await t.test('칸 묶음: 로그 밖 이름 칸 · 원래 색(띠 없는 틀) · 능력표 글', () => {
    assert.match(body(draw(take('k1192'))), /<p class="gk-nm gk-nA">알파<\/p>/, '주인 칸은 그 글자 화자 이름');
    assert.match(body(draw(take('k1192'), { names: false })), /<p class="gk-nm gk-nA">깡통<\/p>/, '이름을 숨기면 견본 이름');
    const plainColor = draw(take('k1101'));
    assert.doesNotMatch(plainColor, /\.gk-d[AB]\{background-color/, '색을 모르면 틀 그대로(띠를 새로 안 그어요)');
    assert.match(plainColor, /\.gk-k1101 \.gk-aA\{background-color:#3aa7ff\}/);
    // 검토 13: 지문만 판에 뺀 대사 칸의 「✎」 주석이 주인 없이 남지 않아요(다른 판 · 다른 틀은 그대로)
    for (const u of take('k1192').frame.units) {
        assert.doesNotMatch(u.nr, /<!--/, '지문만 판');
        assert.match(u.both, /<!-- ✎ 한 줄 평[^>]*-->\n<div class="gk-cm">/); assert.match(u.dl, /<!-- ✎ 한 줄 평[^>]*-->\n<div class="gk-cm">/);
    }
    assert.equal(take('k1192').frame.units[0].nr, '{{지문들}}');
    assert.equal(take('k1192').frame.units[1].nr, '<div class="gk-rv gk-r2"><div class="gk-ri">\n{{지문들}}\n</div></div>');
    const probe = probeOf(take('k1101').frame);
    assert.doesNotMatch(probe, /\{\{로그|\{\{지문들|\{\{대사들/); assert.match(probe, /class="gk-ms"/);
});

await t.test('못 받는 틀은 그대로 못 받아요 — 첫 까닭을 돌려줘요', () => {
    const html = sample.k1101.html.replace('<div class="gk-ms">', '<div class="gk-ms"><p class="gk-dl"><span class="gk-d gk-dA">「셋째 대사」</span></p>');
    const r = checkItem({ kind: 'geulkku-simple', v: 1, id: 'simple-k1101', key: 'k1101', name: 'x', html, set: { blGeulkku: 2 } });
    // 까닭 글은 1.2.0 「받는 길」(mart-import.js simpleWhy)에서 사람 말 + 「HTML 복사」 길로 바뀌었어요
    assert.match(r.reason ?? '', /^로그 칸이 여러 곳으로 나뉜 틀이라 한 곳에 채울 수 없어요 — 이 틀은 마트의 「HTML 복사」로 깡통 글쓰기에 바로 붙여 써요$/);
    assert.equal(r.item, undefined, '받지 않아요');
});

t.done();
