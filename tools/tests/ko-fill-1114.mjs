// 11-14 한글화 빈곳 채우기 — 실리태번 1.19 · 설치한 남의 확장 화면을 정적으로 훑어 아직 영어이던 글(모델 목록 아이콘 title · 프롬프트 관리자 아이콘 ·
//   페르소나 바꾸기 창 · 템플릿 고름 알림 · 같은 이름 덮어쓰기 창 · 월드 인포 키워드 title · 슬래시 인자 오류 · 벡터 통계 · LALib 알림 등)을 글자 사전에 더했어요.
//   다듬기 도구가 중괄호 엔티티(&lcub; · &rcub;)를 못 풀어 「없음」으로 빼던 placeholder 열쇠 2개도 되살렸어요. 실리태번 폴더 없이 도는 시험이에요.
// node tools/tests/ko-fill-1114.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { decode, normalize } = await load('tools/ko-dict-prune.mjs');
const { buildKorean, readPrune } = await load('tools/build-korean-dict.mjs');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

test('다듬기: 중괄호 엔티티를 풀어 화면 글과 맞대요', () => {
    assert.equal(normalize(decode('Use &lcub;&lcub;labels&rcub;&rcub; special macro.')), 'Use {{labels}} special macro.');
});

const { dictionary } = buildKorean(fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8'), readPrune());
const exact = new Map(dictionary.exact);
const html = new Map(dictionary.htmlExact);
const res = dictionary.PATTERNS.map(p => ({ re: new RegExp(p.re), ko: p.ko }));
const tr = text => {
    const key = normalize(text);
    if (exact.has(key)) return exact.get(key);
    if (html.has(key)) return html.get(key);
    for (const { re, ko } of res) { const m = re.exec(key); if (m && !m.slice(1).some(v => !v || !v.trim())) return ko.replace(/\$([1-9])/g, (w, i) => m[Number(i)] ?? w); }
    return null;
};

test('사전: 새로 채운 글이 실제로 옮겨져요(열쇠 · HTML 열쇠 · 패턴)', () => {
    const want = {
        'This model supports vision': '이미지를 볼 수 있는 모델이에요',
        'Line: 3 Column: 14': '줄: 3 열: 14',
        'Preset save cancelled. A preset with the same name already exists:': '같은 이름의 preset 이(가) 이미 있어서 취소했어요(Preset save):',
        'Keep': '유지',
        'Create character': '캐릭터 만들기',
        'Use {{labels}} special macro.': null,   // 되살린 열쇠 — 값은 원래 번역 그대로
        'Enable <b>Request token probabilities</b> in the User Settings menu to use this feature.': '이 기능을 쓰려면 사용자 설정에서 <b>토큰 확률 요청</b>을 켜세요.',
        'has failed to revert the failed right swipe on message #12.': '메시지 #12 의 실패한 right 스와이프를 되돌리지 못했어요.',
        'Do you want to open the link to chub.ai in a new tab?': 'chub.ai 링크를 새 탭에서 열까요?',
        'You have a connected persona for the current chat (Alice). Do you want to stick to the current persona (Bob) , or switch to Alice instead?': '이 채팅에 연결된 페르소나(Alice)가 있어요. 지금 페르소나(Bob)를 유지할까요, 아니면 Alice (으)로 바꿀까요?',
        'Used as a key 3 times in this lorebook': '이 로어북에서 키워드로 3번 쓰였어요',
        'Used as a key 1 time in this lorebook': '이 로어북에서 키워드로 1번 쓰였어요',
        'Argument "list" must be an array of strings': '인자 "list" 은 문자열 배열이어야 해요.',
        '8192 tokens': '8192 토큰',
        'Total hashes:': '전체 해시:',
        'Event listener attached to 4 elements.': '요소 4개에 이벤트 리스너를 붙였어요.',
        'Using var= or globalvar= in /split is deprecated, please update your script to use the unnamed argument instead.': '/split 의 var= or globalvar= 은 곧 없어질 방식이에요. 스크립트를 고쳐 주세요(대신: the unnamed argument).',
        'Extension foo enabled.': 'foo 확장을 켰어요.',   // 11-12 채우기(옮김)도 그대로 살아 있어요
    };
    for (const [en, ko] of Object.entries(want)) {
        const got = tr(en);
        assert.ok(got && got !== normalize(en), `옮겨지지 않음: ${en}`);
        if (ko !== null) assert.equal(got, ko, en);
    }
});

// ── 1.4.6 검토 K1 · K2: 미트볼 상태창은 통째로 건너뛰고, 흔한 한 낱말 열쇠 · 넓은 패턴은 실리태번 칸 안에서만
const source = fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8');
const skipBlock = source.slice(source.indexOf('  const SKIP = ['), source.indexOf("].join(',');"));
const narrowCode = source.slice(source.indexOf('  const NARROW = new Map();'), source.indexOf('  const textChanges'));
const { NARROW, narrowed } = new Function('normalize', `${narrowCode}\nreturn { NARROW, narrowed };`)(normalize);
// 작은 가짜 요소: 단순 선택자(#id · .class · [속성])를 쉼표로 이은 것만 봐요 — NARROW 의 선택자가 그 꼴이에요
const el = (spec, parent = null) => {
    const [tag, ...rest] = spec.split(/(?=[#.[])/);
    const id = rest.find(s => s[0] === '#')?.slice(1) || '', classes = rest.filter(s => s[0] === '.').map(s => s.slice(1)), attrs = rest.filter(s => s[0] === '[').map(s => s.slice(1, -1));
    const me = { parent, matches: one => one[0] === '#' ? one.slice(1) === id : one[0] === '.' ? classes.includes(one.slice(1)) : one[0] === '[' ? attrs.includes(one.slice(1, -1)) : one === tag };
    me.closest = sel => { const list = sel.split(',').map(s => s.trim()); for (let e = me; e; e = e.parent) if (list.some(e.matches)) return e; return null; };
    return me;
};

test('K1: 미트볼 상태창 뿌리(칸 · 메신저 말풍선 · 창)를 한글화가 건너뛰어요', () => {
    for (const sel of ['.ss-scope', '.ss-root', '.ss-panel', '.ss-phone', '.ss-dlg', '.ss-mbubble']) assert.ok(skipBlock.includes(`'${sel}'`), sel);
});

test('K1: 흔한 한 낱말 열쇠는 실리태번 원래 칸에서만 바꾸고, 남의 확장 칸의 같은 낱말은 그대로예요', () => {
    const words = ['Empty', 'Ready', 'Keep', 'Show', 'Value', 'Offline', 'Unlimited', 'Library', 'Popular', 'Mutual', 'Icon', 'Label', 'Labels', 'Speed', 'Language',
        'Steps', 'Affects', 'Resume', 'Minimize', 'Maximize', 'Website', 'Documentation', 'Password', 'Installed', 'Arguments', 'Returns', 'Aliases', 'find', 'replace'];
    for (const w of words) assert.ok(NARROW.has(w), `좁히지 않은 열쇠: ${w}`);
    for (const key of NARROW.keys()) assert.ok(exact.has(key), `사전에 없는 좁힌 열쇠: ${key}`);
    const other = el('div.some-extension-panel');
    assert.equal(narrowed('Empty', el('span', other)), true, '남의 확장 칸의 「Empty」는 그대로');
    assert.equal(narrowed('Ready', el('span', el('div', other))), true);
    assert.equal(narrowed('Empty', el('input', el('div.regex_editor'))), false, '정규식 편집기의 「Empty」는 옮겨요');
    assert.equal(narrowed('Ready', el('span', el('div', el('div#tts_settings')))), false, 'TTS 설정 칸의 「Ready」는 옮겨요');
    assert.equal(narrowed('Keep', el('div.popup-button-ok', el('div.popup-controls'))), false);
    assert.equal(narrowed('Keep', el('span', other)), true);
    assert.equal(narrowed('Delete', el('span', other)), false, '좁히지 않은 열쇠는 그대로 어디서든');
});

test('K2: 「N characters selected」 · 「… Click to edit」 패턴은 실리태번 칸에서만', () => {
    const other = el('div.other-ext');
    assert.equal(narrowed('3 characters selected', el('span', other)), true);
    assert.equal(narrowed('3 characters selected', el('span#bulkSelectedCount')), false);
    assert.equal(narrowed('alpha Click to edit', el('span', other)), true);
    assert.equal(narrowed('alpha Click to edit', el('span.item', el('div', el('div.world_entry')))), false);
    assert.equal(narrowed('alpha Click to edit', el('span.item', el('li.select2-results__option'))), false);
});

console.log(`ko-fill-1114: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
