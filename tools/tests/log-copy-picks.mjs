// 1.1.8 「블루레몬 추천」 기본 글꾸 — 사용자가 고른 마트 심플 틀 32판(칩 22 · 시리즈 묶음 여섯)이 마트에서 받은 글꾸와 한 글자도 같게 그려지는지 (DOM 없는 부분)
//   node tools/tests/log-copy-picks.mjs <테마 루트>
//   견본: tools/tests/fixtures/mart-picks-sample.json(마트 원래 판) · 자료: src/log-copy-picks.gen.js(node tools/mart/picks-gen.mjs 로 떠요)
import fs from 'node:fs';
import path from 'node:path';
import { assert, root, load, suite } from './_t.mjs';

const t = suite('log-copy-picks');
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/mart-picks-sample.json'), 'utf8'));
const { genText, PICKS } = await load('tools/mart/picks-gen.mjs');
const picksMod = await load('src/log-copy-picks.js');
const { loadPicks, pickChips, pickIds, pickEntry, choosePick, PICKS_GROUPS, PICK_CATEGORY } = picksMod;
const { checkItem, readMart, addMartItems } = await load('src/mart-import.js');
const { renderLog } = await load('src/log-copy-presets.js');
const setMod = await load('src/log-copy-simple-set.js');
const caps = await load('src/geulkku-mart/caps-table.js');
const { checkFrame } = await load('src/log-copy-simple.js');
const { sanitizeTree } = await load('src/log-copy-sanitize.js');
const { parse, sanitizedBy } = await load('tools/tests/_simple-dom.mjs');
const { readShape } = await load('src/log-copy-retired.js');
const sanitized = sanitizedBy(sanitizeTree);
const capRow = caps.capsRow ?? caps.default?.capsRow;
const picks = await loadPicks();

// 사용자 목록(11-12) → 마트 id. 시리즈는 다 넣어요(「시리즈는 다 넣어」 · 「주전자도 걍 넣어」) — 고양이 셋 · 플라밍고 둘 · 기타 셋 · 분노 셋 · 속보 둘 · 카메라 셋
const WANT = {
    낫표: ['k1'], 견출지: ['k2'], 바인더: ['k3'], 티백: ['k5'], 성냥: ['k7'], 블라인드: ['k8'], 모래시계: ['k10'], '실 전화': ['k11'], 형광펜: ['k13'],
    고양이: ['k1002', 'k1003', 'k1001'], '택배 상자': ['k1014'], 우체국: ['k1022'], 삐삐: ['k1028'], '비주얼노벨 선택지': ['k1103'], '세이브 슬롯': ['k1116'],
    플라밍고: ['k1149', 'k1339'], 기타: ['k1163', 'k1342', 'k1343'], 분노: ['k1162', 'k1338', 'k1337'], 묘비: ['k1180'], '속보 방송': ['k1218', 'k1216'], '즉석 카메라': ['k1222', 'k1055', 'k1056'], '업적 달성 알림': ['k1234'],
};

const text = s => ({ t: 'text', text: s });
const band = s => ({ t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [text(s)] });
const LOGS = [
    { base: { color: '#dddddd', bg: '#111111' }, messages: [
        { name: '깡통', nodes: [text('창밖을 보았다.'), { t: 'br' }, band('「비가 그쳤네.」')] },
        { name: '나', nodes: [text('「응, 나가 볼까?」')] },
    ] },
    { base: { color: '#dddddd', bg: '#111111' }, messages: [{ name: '솔로', nodes: [text('혼자 걷는 길.'), { t: 'br' }, { t: 'br' }, band('「조용하네.」'), text(' 그렇게 말했다.')] }] },
    { base: { color: '#dddddd', bg: '#111111' }, messages: [
        { name: '깡통', nodes: [text('첫 문단.'), { t: 'hr' }, band('「첫 대사.」'), { t: 'hr' }, text('둘째 지문 '), band('「섞인 대사」'), text(' 끝.')] },
        { name: '깡캐', nodes: [band('「둘째 사람.」'), { t: 'hr' }, text('그리고 지문.')] },
        { name: '셋째', nodes: [text('셋째 사람 지문.'), { t: 'hr' }, band('「셋째 대사.」')] },
    ] },
];
const lookup = name => ({ 깡통: '#e05a5a', 깡캐: '#3c9b5f', 셋째: '#8a63d2' })[name] ?? null;
const SETS = () => {
    const s0 = { blGeulkku: 2 }, looks = setMod.LOOKS.map(x => x.id);
    return [s0, setMod.withSize(setMod.withMotion(setMod.withStyle(s0, looks[1]), 'l'), 2), { ...setMod.withMotion(s0, '0'), themeCast: { main: '#2266cc', other: 'orig' } }];
};
// 시트가 그리는 그대로(log-copy-sheet.js draw — 받은 심플 글꾸 갈래)
const sheetDraw = (mine, model, o) => renderLog(model, { simple: mine, setMod, caps: capRow(mine.frame.key), mode: o.mode, lookup, fields: { title: o.titleOff ? '' : '비 그친 뒤' }, names: o.names, lemonLink: o.lemon });

// 받은 길: 마트 「테마로 담기」 꾸러미 → readMart → addMartItems → 내 글꾸 칸(설정에 들어간 꼴 그대로)
const receive = (key, set = { blGeulkku: 2 }) => {
    const raw = sample.items[key];
    const pack = JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, ...(raw.emoji ? { emoji: raw.emoji } : {}), html: raw.html, set }] });
    const read = readMart(pack);
    assert.equal(read.items.length, 1, `${key}: ${read.skipped.map(x => x.reason).join(' · ')}`);
    const settings = { logCopy: { custom: [] } };
    addMartItems(settings, read.items);
    return JSON.parse(JSON.stringify(settings.logCopy.custom[0]));   // 설정에 저장 · 다시 읽은 꼴
};

await t.test('목록: 사용자가 고른 22칩 · 32판이 마트 id 그대로 · 시리즈(고양이 · 플라밍고 · 기타 · 분노 · 속보 · 카메라)는 꺾쇠 판', async () => {
    assert.equal(picks.length, 32);
    assert.deepEqual(Object.fromEntries(PICKS_GROUPS.map(g => [g.name, g.ids.map(id => id.replace('simple-', ''))])), WANT);
    assert.deepEqual(picks.map(p => p.id), PICKS_GROUPS.flatMap(g => g.ids), '풀어 낸 차례 = 칩 차례');
    assert.ok(picks.some(p => p.id === 'simple-k1337'), '분노 · 부들부들 주전자도 넣어요(사용자 「주전자도 걍 넣어」)');
    assert.deepEqual(PICKS_GROUPS.find(g => g.id === 'p-guitar').labels, ['기타', '줄 하나 딩', '일렉 기타']);
    assert.deepEqual(PICKS_GROUPS.find(g => g.id === 'p-anger').labels, ['분노', '핏줄 표시', '주전자']);
    assert.equal(PICK_CATEGORY.label, '블루레몬 추천');
    for (const g of PICKS) for (const [key] of g[2]) assert.ok(sample.items[key], key);
});

await t.test('자료: 생성물이 견본 · 지금 받기 검사와 한 글자도 같아요(받기 검사가 바뀌면 node tools/mart/picks-gen.mjs)', () => {
    assert.equal(fs.readFileSync(path.join(root, 'src/log-copy-picks.gen.js'), 'utf8'), genText(sample));
});

await t.test('등록 값: 추천 글꾸 = 마트에서 받은 글꾸(id · 이름 · 이모지 · frame 이 같고 등록 값 점검 통과)', () => {
    for (const p of picks) {
        const key = p.id.replace('simple-', ''), got = receive(key);
        assert.equal(got.id, p.id); assert.equal(got.name, p.name); assert.equal(got.emoji, p.emoji);
        assert.equal(JSON.stringify(got.frame), JSON.stringify(p.frame), `${key} frame`);
        assert.deepEqual(checkFrame(p.frame), [], key);
    }
});

await t.test('그리기: 32판 × 로그 3 × 낮밤 × 이름 보임/숨김 × 조절 값 3 — 받은 길로 그린 것과 바이트가 같아요 · 자리표 없음 · 소독기를 거쳐도 같음', () => {
    let n = 0;
    for (const p of picks) {
        const key = p.id.replace('simple-', '');
        for (const set of SETS()) {
            const mine = receive(key, set);
            const store = () => ({ custom: [], pickSet: { [p.id]: set } });
            const built = pickEntry(picks, [], p.id, store);
            assert.deepEqual(built.set, mine.set);
            for (const [li, model] of LOGS.entries()) for (const mode of ['light', 'dark']) for (const names of [true, false]) {
                const o = { mode, names, lemon: li === 1, titleOff: li === 2 };
                const a = sheetDraw(mine, model, o), b = sheetDraw(built, model, o);
                const where = `${key} 로그${li} ${mode} 이름${names} ${JSON.stringify(set).slice(0, 40)}`;
                assert.ok(a.length > 200, where);
                assert.equal(b, a, where);
                assert.doesNotMatch(b, /\{\{/, where);
                n++;
            }
            const one = sheetDraw(built, LOGS[2], { mode: 'dark', names: true });
            assert.equal(sanitized(one), parse(one).innerHTML, `${key} 소독`);
            const plain = one.replace(/<[^>]*>/g, '');
            for (const w of ['첫 문단', '둘째 사람', '셋째 대사']) assert.ok(plain.includes(w), `${key}: ${w}`);
        }
    }
    assert.equal(n, picks.length * 3 * 3 * 2 * 2);
});

await t.test('이름 숨김: 이름을 숨기면 화자 이름이 글에 안 남아요(이름 줄 있는 판)', () => {
    for (const p of picks) {
        const entry = pickEntry(picks, [], p.id, () => ({ custom: [] }));
        const off = sheetDraw(entry, LOGS[2], { mode: 'light', names: false }).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '');
        assert.ok(!/깡캐/.test(off), `${p.id}: 숨긴 이름이 보여요`);   // 「셋째」는 본문에도 있어서 「깡캐」로 봐요
    }
});

await t.test('겹치지 않기: 마트에서 같은 틀을 받아 둔 사람은 받은 글꾸(조절 값 포함)가 이기고 추천 줄에서 빠져요', () => {
    const tuned = setMod.withStyle({ blGeulkku: 2 }, setMod.LOOKS[2].id);
    const mine = { ...receive('k1342', tuned), name: '기타 · 줄 하나 딩' };
    const customs = [mine];
    assert.ok(!pickIds(picks, customs).includes('simple-k1342'));
    assert.equal(pickIds(picks, customs).length, picks.length - 1);
    assert.equal(pickEntry(picks, customs, 'simple-k1342', () => ({ custom: customs })), null, '추천 쪽은 null — 시트 custom() 은 내 글꾸를 먼저 찾아요');
    const guitar = pickChips(picks, customs, {}).find(g => g.group === 'p-guitar');
    assert.deepEqual(guitar.ids, ['simple-k1163', 'simple-k1343']); assert.deepEqual(guitar.labels, ['기타', '일렉 기타']);
    // 시트 custom() 과 같은 순서: 내 글꾸 → 추천
    const sheetCustom = id => customs.find(c => c.id === id) ?? pickEntry(picks, customs, id, () => ({ custom: customs }));
    assert.equal(sheetCustom('simple-k1342'), mine);
    assert.deepEqual(sheetCustom('simple-k1342').set, tuned, '받은 쪽 조절 값');
    // 혼자 남은 판 · 다 받으면 묶음째 빠져요
    const both = [receive('k1162'), receive('k1338'), receive('k1337')];
    assert.ok(!pickChips(picks, both).some(g => g.group === 'p-anger'));
    const one = pickChips(picks, both.slice(0, 2)).find(g => g.group === 'p-anger');
    assert.deepEqual(one.ids, ['simple-k1337']);
    // 옛 내장 글꾸(1.1.7 에서 뺀 「택배 상자」 · 「속보 방송」)를 고른 채였으면 추천 판으로 이어 그려요(마트 안내 없이)
    for (const [old, now] of [['concept-sp-parcel', 'simple-k1014'], ['c-scene-sp-2', 'simple-k1218']]) {
        const r = readShape(old, pickIds(picks, []).map(id => ({ id })));
        assert.equal(r.shape, now); assert.equal(r.tell, null);
    }
});

await t.test('판 고르기: 같은 이름 판은 칩 하나 + 꺾쇠 · 고른 판을 기억 · 모르는 값은 첫 판 · 하나뿐인 칩은 꺾쇠 없음', () => {
    const s = { custom: [], pickVar: {} }, store = () => s;
    let chips = pickChips(picks, s.custom, s.pickVar);
    assert.equal(chips.length, 22);
    assert.deepEqual(chips.filter(g => g.ids.length > 1).map(g => [g.name, g.ids.length]), [['고양이', 3], ['플라밍고', 2], ['기타', 3], ['분노', 3], ['속보 방송', 2], ['즉석 카메라', 3]]);
    assert.equal(chips.find(g => g.group === 'p-guitar').current, 'simple-k1163', '처음은 첫 판');
    assert.ok(choosePick(store, 'simple-k1343'));
    assert.deepEqual(s.pickVar, { 'p-guitar': 'simple-k1343' });
    chips = pickChips(picks, s.custom, s.pickVar);
    assert.equal(chips.find(g => g.group === 'p-guitar').current, 'simple-k1343', '고른 판을 기억');
    assert.ok(choosePick(store, 'simple-k1338'));
    assert.equal(pickChips(picks, s.custom, s.pickVar).find(g => g.group === 'p-anger').current, 'simple-k1338');
    assert.equal(choosePick(store, 'card'), false, '추천 아닌 id 는 안 적어요');
    assert.equal(pickChips(picks, [], { 'p-guitar': 'simple-k1162' }).find(g => g.group === 'p-guitar').current, 'simple-k1163', '다른 묶음 판 · 모르는 값은 첫 판');
    // 판마다 따로 그려지고, 고른 판은 그 마트 틀 그대로
    const draws = ['simple-k1163', 'simple-k1342', 'simple-k1343'].map(id => sheetDraw(pickEntry(picks, [], id, store), LOGS[0], { mode: 'dark', names: true }));
    assert.equal(new Set(draws).size, 3);
    for (const [i, id] of ['simple-k1163', 'simple-k1342', 'simple-k1343'].entries()) assert.equal(draws[i], sheetDraw(receive(id.replace('simple-', '')), LOGS[0], { mode: 'dark', names: true }), id);
});

await t.test('조절 값: 추천 글꾸 set 은 logCopy.pickSet[id] 에 · 안 고친 판은 같은 기본 객체 · 설정 정리가 꼴만 지켜요', async () => {
    const s = { custom: [] }, store = () => s;
    const e = pickEntry(picks, [], 'simple-k1', store);
    assert.equal(e.set, e.set, '기본 값은 같은 객체(조절 화면의 「안 바뀜」 비교)');
    assert.deepEqual(e.set, { blGeulkku: 2 });
    const next = setMod.withMotion(e.set, 'l');
    e.set = next;
    assert.equal(s.pickSet['simple-k1'], next);
    assert.equal(pickEntry(picks, [], 'simple-k1', store).set, next, '다시 열어도 그 값');
    assert.equal(pickEntry(picks, [], 'nope', store), null);
    const src = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
    assert.ok(src.includes("...(isObj(v.pickSet) ? { pickSet: map(v.pickSet, isObj, 40) } : {}), ...(isObj(v.pickVar) ? { pickVar: map(v.pickVar, id, 20) } : {})"), 'tidyLogCopy 가 두 칸을 남겨요(없으면 안 만들어요 — 옛 설정 그대로)');
    assert.match(src, /basicInfo: 'off', basicHeight: '' \},   \/\/ 로그 복사/, '기본값에는 안 넣어요');
});

await t.test('늦게 받기: 추천 자료는 로그 복사 창을 열 때 import() 로만 — 다른 곳이 정적으로 부르지 않아요', () => {
    const files = fs.readdirSync(path.join(root, 'src'), { recursive: true }).map(String).filter(f => f.endsWith('.js'));
    const users = files.filter(f => /log-copy-picks(?:\.gen)?\.js/.test(fs.readFileSync(path.join(root, 'src', f), 'utf8').replace(/\/\/[^\n]*/g, '')));
    assert.deepEqual(users.map(f => f.split(path.sep).join('/')).filter(f => f !== 'build-info.js').sort(), ['log-copy-picks.js', 'log-copy-sheet.js'], '부르는 곳은 시트(import()) 하나 · 자료는 추천 모듈만');
    const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
    assert.match(sheet, /await import\('\.\/log-copy-picks\.js'\)/);
    assert.doesNotMatch(sheet, /^import [^\n]*log-copy-picks/m, '시트가 정적으로 부르면 시트 조각에 섞여요');
    // dist 가 있으면: 추천 자료 조각은 시작 묶음 밖(perf-budget-static ④ 와 같은 걷기)
    const dist = path.join(root, 'dist');
    if (!fs.existsSync(path.join(dist, 'index.js'))) return;
    const z = (fs.readFileSync(path.join(root, 'src/log-copy-picks.gen.js'), 'utf8').match(/PICKS_Z = "([^"]{40})/) || [])[1];
    const chunk = fs.readdirSync(dist).filter(f => f.endsWith('.js') && fs.readFileSync(path.join(dist, f), 'utf8').includes(z));
    assert.equal(chunk.length, 1, `추천 자료 조각은 하나: ${chunk.join(' · ') || '없음(build-bundle 다시)'}`);
    const seen = new Set();
    const walk = (file) => { if (seen.has(file)) return; seen.add(file); for (const m of fs.readFileSync(path.join(dist, file), 'utf8').matchAll(/(?:^|;|\})\s*import(?:[^"'()]*?from\s*)?["'](\.\/[^"']+)["']/g)) walk(m[1].slice(2)); };
    walk('index.js');
    assert.ok(!seen.has(chunk[0]), '추천 자료 조각이 시작 묶음에 들었어요');
});

await t.test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/log-copy-picks.mjs .'));
});

t.done();
