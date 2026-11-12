// 1.1.7 옛 내장 글꾸 48종을 테마에서 뺀 뒤 — 저장된 모양 id 읽기(지우지 않고 읽기만) · 마트 새 판으로 이어 쓰기 · 기본 틀로 조용히
//   node tools/tests/log-copy-retired.mjs .
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';

const { test, done } = suite('log-copy-retired');
const { retiredShape, readShape, RETIRED_FALLBACK } = await load('src/log-copy-retired.js');
const { PRESETS, CATEGORIES } = await load('src/log-copy-presets.js');
const { addMartItems } = await load('src/mart-import.js');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// 옛 내장 48종(옛 생성물과 같은 차례): 심플 30(마트 시안 자료의 concept-sp-*) · 반응 4 · 장면 8 · 연말 6
const SIAN = JSON.parse(read('tools/mart/geulkku-sian.json')).frames.filter(f => f.id.startsWith('concept-sp-'));
const { REACT_FRAMES } = await load('tools/mart/react-geulkku.mjs');
const { SCENE_FRAMES } = await load('tools/mart/scene-geulkku.mjs');
const { XMAS_FRAMES } = await load('tools/mart/xmas-geulkku.mjs');
const OLD = [...SIAN, ...REACT_FRAMES, ...SCENE_FRAMES, ...XMAS_FRAMES];

await test('이름표: 옛 내장 48종 모두 · 이름은 옛 칩 이름 · 마트 새 판 id 꼴 · 테마 틀 id 와 안 겹쳐요', () => {
    assert.equal(OLD.length, 48);
    for (const f of OLD) {
        const row = retiredShape(f.id);
        assert.ok(row, `${f.id}: 이름표`);
        assert.ok(row.name && row.name.length <= 12, `${f.id}: 이름`);
        assert.ok(row.mart === null || /^simple-[kq]\d{2,4}$/.test(row.mart), `${f.id}: 마트 id ${row.mart}`);
        assert.ok(!PRESETS.some(p => p.id === f.id), `${f.id}: 테마 틀에 없음`);
    }
    for (const f of [...REACT_FRAMES, ...SCENE_FRAMES, ...XMAS_FRAMES]) assert.equal(retiredShape(f.id).name, f.label);
    for (const p of PRESETS) assert.equal(retiredShape(p.id), null, `${p.id}: 기본 틀은 이름표에 없어요`);
    assert.equal(retiredShape('concept-pepero')?.id, 'concept-sp-pepero', '1.0.1 시험판 옛 id 도');
    assert.ok(PRESETS.some(p => p.id === RETIRED_FALLBACK), '기본 틀이 테마에 있어요');
    assert.equal(RETIRED_FALLBACK, 'kkangtong', '설정 기본값(settings.js)과 같은 깡통 로그');
    assert.match(read('src/settings.js'), /v\.shape === undefined \? 'kkangtong'/);
});

await test('안내하는 마트 새 판은 모두 테마가 실제로 받는 틀이에요(마트 자료에 테마 받기 검사를 돌린 목록 fixtures/mart-takeable.json 과 대조)', () => {
    const take = JSON.parse(read('tools/tests/fixtures/mart-takeable.json'));
    assert.equal(take.ok.length, 399, `마트 ${take.site} 받는 틀 수`);   // 1.2.0 공개 마트 417틀 중 399(줄 갈래 · 칸 묶음 392 + 11-12 새 판 일곱 k1374 ~ k1380 · 못 받는 18틀은 테마에 남은 기본 글꾸)
    const ok = new Set(take.ok);
    const told = OLD.map(f => retiredShape(f.id)).filter(r => r.mart);
    assert.equal(told.length, 48, '안내 48종 전부(새 판이 없던 일곱 — 추석 · 화이트데이 · 발렌타인 · 메뉴판 · 실험 노트 · 사랑 재판 · 스노우볼 — 도 마트 새 판 k1374 ~ k1380 으로 이어요)');
    for (const [id, mart] of [['concept-sp-chuseok', 'simple-k1374'], ['concept-sp-white', 'simple-k1375'], ['concept-sp-valentine', 'simple-k1376'], ['concept-sp-menu', 'simple-k1377'], ['concept-sp-lab', 'simple-k1378'], ['c-scene-sp-1', 'simple-k1379'], ['c-xmas-sp-1', 'simple-k1380']]) assert.equal(readShape(id, []).tell, mart, id);
    for (const r of told) assert.ok(ok.has(r.mart), `${r.id} → ${r.mart}: ${take.no[r.mart] || '마트에 없음'}`);
    for (const [id, mart] of [['concept-sp-radio', 'simple-k1107'], ['concept-sp-cinema', 'simple-k1174'], ['concept-sp-spring', 'simple-k1087']]) assert.deepEqual([readShape(id, []).shape, readShape(id, []).tell], ['kkangtong', mart], `${id}: 기본 틀 + 마트 새 판 안내`);
});

await test('읽기: 마트 새 판을 받아 뒀으면 그 글꾸로 · 아니면 기본 틀 + 받는 곳 안내 · 새 판이 없으면 조용히 · 다른 id 는 그대로', () => {
    assert.deepEqual(readShape('card', []), { shape: 'card', retired: null, tell: null });
    assert.deepEqual(readShape('c1abc', [{ id: 'c1abc' }]), { shape: 'c1abc', retired: null, tell: null }, '내 글꾸 그대로');
    const pepero = readShape('concept-sp-pepero', []);
    assert.equal(pepero.shape, 'kkangtong');
    assert.equal(pepero.tell, 'simple-k1317');
    assert.equal(pepero.retired.name, '빼빼로데이');
    const kept = readShape('concept-sp-pepero', [{ id: 'x' }, { id: 'simple-k1317', frame: {}, set: {} }]);
    assert.deepEqual([kept.shape, kept.tell], ['simple-k1317', null], '받아 둔 새 판으로 이어서 · 안내 없음');
    assert.deepEqual(readShape('concept-pepero', [{ id: 'concept-pepero', template: '<div></div>' }]), { shape: 'concept-pepero', retired: null, tell: null }, '같은 id 의 내 글꾸가 먼저');
    const radio = readShape('concept-sp-radio', []);   // 라디오 — 1.1.8 부터 소리 칸을 뺀 판(k1107)으로 받아요 · 1.2.0: 새 판이 없는 옛 글꾸는 이제 없어요(48종 전부 이어요)
    assert.deepEqual([radio.shape, radio.tell], ['kkangtong', 'simple-k1107'], '기본 틀 + 마트 새 판 안내');
    const court = readShape('c-scene-sp-1', []);   // 사랑 재판 — 11-12 마트 새 판 k1379
    assert.deepEqual([court.shape, court.tell], ['kkangtong', 'simple-k1379'], '새 판 일곱도 안내');
});

await test('이어 쓰기: 마트에서 「테마로 담기」로 받은 새 판(simple-k1317)은 id 그대로 내 글꾸에 들어가요(기본 틀 id 와 안 겹침)', () => {
    const settings = { logCopy: { custom: [] }, frameLibrary: [] };
    const item = { kind: 'geulkku-simple', id: 'simple-k1317', name: '빼빼로데이', emoji: '🥢', frame: { key: 'k1317', html: '<div class="gk"></div>' }, set: {} };
    const out = addMartItems(settings, [item], { taken: new Set(PRESETS.map(p => p.id)) });
    assert.deepEqual(out.geulkku, ['simple-k1317']);
    assert.equal(readShape('concept-sp-pepero', settings.logCopy.custom).shape, 'simple-k1317');
});

await test('시트: 저장 값은 안 바꾸고 읽기만 · 옛 「옮겨 저장」 길 없음 · 분류도 읽은 틀에 맞춰요 · 안내는 마트 #id 로', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /const read = readSaved\(s, pk\.mod \? pk\.mod\.pickIds\(pk\.picks, s\.custom\)\.map\(id => \(\{ id \}\)\) : \[\]\);/);   // 1.1.8 복사 뒤에도 옛 id 기억(retiredFrom) · 내 글꾸 + 보이는 추천 글꾸 — 모양 · 즐겨찾기 · 최근은 그대로
    assert.match(sheet, /if \(read\.retired\) \{ state\.shape = read\.shape; state\.category = catOf\(read\.shape\); \}/);   // 1.1.8 추천 글꾸면 「블루레몬 추천」 분류
    assert.match(sheet, /mart\/geulkku\/\?view#\$\{encodeURIComponent\(retired\.tell\)\}/);   // 1.1.8 9초 알림 대신 시트 안 띠
    assert.ok(!/toldRetired|timeOut: 9000/.test(sheet), '옛 9초 알림 없음');
    const at = sheet.indexOf('const read = readSaved(');
    assert.ok(!/s\.shape = |s\.fav = |s\.recent = /.test(sheet.slice(sheet.indexOf('const s = store();'), at)), '열 때 저장 값을 다시 쓰지 않아요');
    assert.ok(!/OWN_COLORS|ownColors|movedShape/.test(sheet));
    assert.deepEqual(CATEGORIES.map(c => c.id), ['basic', 'talk', 'paper', 'gallery', 'mine']);
    assert.ok(!fs.existsSync(path.join(root, 'src/log-copy-builtin.gen.js')));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-retired\.mjs \./, '공개 CI 에 이 시험');
});

done();
