// 1.7.8 미트볼 「칩 점검 ⚠」 이 답마다 뜨던 것(11-18 사용자 「이 칩 점검은 뭐 어쩌란 거임? 자꾸 채팅마다 뜨는데」)
//   그 확장의 변화 줄 키 event 는 「날짜 | 제목 | 설명」 꼴의 새 약속(일정)이에요. 본편 AI 가 그 키를 「방금 있었던 일」 일지로 날짜 없이 적으면
//   그 확장이 못 읽은 줄(⚠ 1)로 셈해 칩 줄 끝에 ⚠ 칩이 답마다 붙었어요(사용자 채팅 43답 중 29답).
//   ① 일지 꼴 event 줄 가려내기 ② 그 줄만 못 읽은 답이면 ⚠ 칩에 표식(시트가 숨김) — 다른 진짜 못 읽은 줄이 있으면 그대로
//   ③ 칩 점검 창의 넘어간 줄은 저장된 글 그대로(화면만 번역이 이름만 바꿔 끼워 반쯤 섞인 글이 되지 않게) ④ 시트 · 문 · CI
//   node tools/tests/mb-diary.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
let n = 0; const bad = []; const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { bad.push(name); console.log('실패', name, '—', e.message.split('\n')[0]); } };
let D = null; try { D = await import(pathToFileURL(path.join(root, 'src/mb-diary.js')).href); } catch (e) { console.log('모듈 없음', e.code || e.message); }
const need = () => assert.ok(D, 'src/mb-diary.js');

// 지어낸 줄(사용자 글 아님)
const DIARY = 'event: Rescued a stray kitten in the rear garden and named her Mocha';
const PLAN = 'event: 3월 14일 | 축제 | 같이 가기로 함';

await ok('① 일지 꼴 event 줄: 날짜 · 제목 칸(「|」) 없는 글 · 지우기(「-이름」) 아님 · 한국어 키 「일정」 도', () => {
    need();
    assert.equal(D.diaryLine(DIARY), true);
    assert.equal(D.diaryLine('일정: 길고양이를 구해 주고 이름을 지어 줌'), true);
    assert.equal(D.diaryLine('Event : Saved the whole festival day'), true, '대소문자 · 띄어쓰기');
    assert.equal(D.diaryLine('event: 3월 14일'), false, '날짜만 적고 끊긴 약속(진짜 못 읽은 줄)');
    assert.equal(D.diaryLine('event: tomorrow at the harbor gate'), false, '날짜 말로 시작'); assert.equal(D.diaryLine('event: 짧은 일'), false, '짧은 글');
    assert.equal(D.diaryLine(PLAN), false, '약속 꼴은 진짜 못 읽은 줄일 수 있어요(날짜를 못 읽음)');
    assert.equal(D.diaryLine('event: -축제'), false, '지우기 꼴');
    assert.equal(D.diaryLine('event:'), false); assert.equal(D.diaryLine('cash: +10'), false); assert.equal(D.diaryLine('mood: good'), false);
});
await ok('② ⚠ 를 숨길 답: 진짜 못 읽은 줄이 일지 event 줄뿐일 때만', () => {
    need();
    assert.equal(D.quietMiss({ miss: [DIARY] }), true);
    assert.equal(D.quietMiss({ miss: [DIARY, DIARY.replace('kitten', 'puppy')] }), true, '둘이어도');
    assert.equal(D.quietMiss({ miss: [DIARY, 'mood: good'], missKey: ['mood: good'] }), true, '모르는 꾸밈 키는 그 확장도 ⚠ 에 안 셈');
    assert.equal(D.quietMiss({ miss: [DIARY, 'cash: lots'] }), false, '다른 진짜 못 읽은 줄이 있으면 그대로');
    assert.equal(D.quietMiss({ miss: [DIARY, 'hunger: -10'], missKey: ['hunger: -10'] }), false, '모르는 키라도 숫자 변화면 그 확장이 ⚠ 로 셈해요 — 그대로');
    assert.equal(D.quietMiss({ miss: [PLAN] }), false);
    assert.equal(D.quietMiss({}), false); assert.equal(D.quietMiss(null), false);
});
// 작은 가짜 DOM(필요한 것만)
const el = (attrs = {}, text = '') => { const a = { ...attrs }; return { textContent: text, getAttribute: k => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = String(v); }, removeAttribute: k => { delete a[k]; }, hasAttribute: k => k in a, _a: a }; };
await ok('② 칩 표식: ⚠ 칩(data-ss-pip)만 · 답 번호로 그 답 기록을 보고 · 바뀌면 표식도 따라감', () => {
    need();
    const warn = el({ 'data-ss-pip': '2' }, '⚠ 1'), lens = el({ 'data-ss-pip': '5' }, ' 칩 없음?'), other = el({ 'data-ss-pip': '3' }, '⚠ 2');
    const root = { querySelectorAll: sel => (/data-ss-pip/.test(sel) ? [warn, lens, other] : []) };
    const snaps = new Map([[2, { miss: [DIARY] }], [3, { miss: [DIARY, 'cash: lots'] }], [5, { miss: [DIARY] }]]);
    assert.equal(D.markChips(root, i => snaps.get(i)), 1);
    assert.equal(warn.getAttribute(D.ATTR), '1'); assert.equal(lens.hasAttribute(D.ATTR), false, '🔍 「칩 없음?」 은 안 건드려요'); assert.equal(other.hasAttribute(D.ATTR), false);
    snaps.set(2, { miss: [DIARY, 'cash: lots'] }); D.markChips(root, i => snaps.get(i));
    assert.equal(warn.hasAttribute(D.ATTR), false, '진짜 못 읽은 줄이 생기면 다시 보임');
});
await ok('③ 칩 점검 창: 넘어간 줄 칸을 저장된 글 그대로(.ss-notr — 그 확장 화면 번역이 다시 안 바꿈) · 앞 설명은 그대로', () => {
    need();
    const head = '변화 9개는 반영됐어요 (구내식당).\n아래 줄은 키를 모르거나 값 모양이 달라서 넘어갔어요. 맞는 변화면 「직접 고치기」로 적어 주세요.';
    const shown = `${head}\n\nevent: Rescued a stray 고양이 in the rear garden and named her Mocha`;
    const t = D.rawTail(shown, ['event: Rescued a stray kitten in the rear garden and named her Mocha']);
    assert.deepEqual(t, { head: `${head}\n\n`, tail: 'event: Rescued a stray kitten in the rear garden and named her Mocha' });
    assert.equal(D.rawTail('설명만', ['x']), null, '줄 칸이 없으면 안 건드려요');
    assert.equal(D.rawTail(shown, []), null);
    assert.equal(D.pipIndex('퀵리플라이 · 슬래시: /ss-pip (마지막 답) · /ss-pip 12 · /ss-pip 12 fix (자동으로 고치기)'), 12);
    assert.equal(D.pipIndex('없음'), null);
});
await ok('④ 시트: 표식 붙은 ⚠ 칩만 숨김 · 「답 아래 변동 칩 모양」(chips) 문 · 원작 그대로 보기면 안 걸림 · CI · 미트볼 문에서 받음', () => {
    const src = read('src/ext-status.css'); need();
    const at = src.indexOf(`.ss-mchip.pip[${D.ATTR}]`); assert.ok(at > 0, '숨김 규칙');
    const marks = [...src.matchAll(/\/\*\s*@mb\s+([a-z|]+)\s*\*\//g)].filter(m => m.index < at); assert.equal(marks.at(-1)[1], 'chips');
    const line = src.slice(src.lastIndexOf('\n', at), src.indexOf('\n', at));
    assert.match(line, /body\.salty:not\(\[data-bl-ext-raw\]\)/); assert.match(line, /display: none/);
    assert.ok(read('src/ext-status.gen.css').includes(`.ss-mchip.pip[${D.ATTR}]`), '생성 시트');
    assert.match(read('index.js'), /import\('\.\/src\/mb-diary\.js'\)\.then\(m => m\.startMbDiary\(\)\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/mb-diary\.mjs \./);
});

if (bad.length) { console.error(`mb-diary: ${bad.length}개 실패`); process.exit(1); }
console.log(`mb-diary: ${n}개 통과`);
