// 10-31 똑똑한 설정 검색 — 말하듯 · 증상으로 쓴 문장 사전(src/settings-intents.js) · 오타 · 초성 · 띄어쓰기 · 결과 줄에서 바로 바꾸기 · 되돌리기 · 지연 로딩
//   node tools/tests/settings-intents.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const url = rel => pathToFileURL(path.join(root, rel)).href;
const S = await import(url('src/settings-search.js'));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

await test('지연 로딩: 사전을 받기 전에는 뜻 읽기가 없고, loadIntents 뒤에 붙어요 · settings-search.js 는 사전을 정적으로 싣지 않아요', async () => {
    const text = read('src/settings-search.js');
    assert.doesNotMatch(text, /^\s*import[^\n]*settings-intents/m, '정적 import 없음');
    assert.match(text, /import\('\.\/settings-intents\.js'\)/, '처음 쓸 때 동적 import');
    assert.match(text, /import\('\.\/settings-ai\.js'\)/, 'AI 모듈도 누를 때만');
    assert.deepEqual(S.searchResults('밤에 눈부셔').flatMap(r => r.quick), [], '받기 전: 사전이 붙이는 조작 없음');
    const I = await S.loadIntents();
    assert.equal(await S.loadIntents(), I, '한 번만 받아요');
    assert.ok(S.searchResults('밤에 눈부셔')[0].quick.length, '받은 뒤: 조작이 붙어요');
});
const I = await S.loadIntents();
const top = q => S.searchSettings(q)[0]?.title;
const top3 = q => S.searchSettings(q).slice(0, 3).map(e => e.title);

await test('사전의 갈 곳은 모두 검색 목록에 있는 제목 · 바로 바꿀 것은 모두 풀려요', () => {
    assert.ok(I.INTENTS.length >= 80, '사전 줄 수 ' + I.INTENTS.length);
    const missing = I.INTENTS.flatMap(i => i.go.filter(t => !S.entryByTitle(t)));
    assert.deepEqual(missing, []);
    const DEFAULTS = { type: { size: 16, weight: 400, lineHeight: 1.8, para: 0.9, letterSpacing: -1, gutter: 20 }, nightTint: 1, lightTint: 0.5, chat: { userSize: 100, bgAlpha: 82 } };
    const fake = p => { const v = p.split('.').reduce((o, k) => o?.[k], DEFAULTS); return v === undefined ? true : v; };
    for (const i of I.INTENTS) for (const q of i.quick) assert.ok(S.quickSpec(q.path, fake, q.only), `${i.go[0]} → ${q.path}`);
});

// 대표 문장 → 맨 위 설정 (사용자 지시 10-31: 「글씨가 작아」 → 글자 크기, 「밤에 눈부셔」 → 밤 모드 · 밝기, 「채팅이 느려」 → 성능 보조, 「말풍선 바꾸고 싶어」 → 메시지 모양)
const CASES = [
    ['글씨가 작아', '본문 글꼴과 크기'], ['글씨가 너무 작아요', '본문 글꼴과 크기'], ['글자 크게 해줘', '본문 글꼴과 크기'], ['노안이라 눈침침해', '본문 글꼴과 크기'],
    ['글자가 너무 커서 줄이고 싶어', '본문 글꼴과 크기'], ['메뉴 글씨가 작아', '메뉴 글자'], ['글씨 굵게', '본문 글꼴과 크기'], ['폰트 바꾸고 싶어', '본문 글꼴과 크기'],
    ['줄 간격이 너무 빽빽해', '문단·줄·글자 간격'], ['자간이 너무 붙어', '문단·줄·글자 간격'], ['양쪽 정렬', '문단·줄·글자 간격'],
    ['밤에 눈부셔', '테마 색과 밝기'], ['다크 모드로 바꿔줘', '테마 색과 밝기'], ['화면이 너무 어두워', '테마 색과 밝기'], ['배경이 너무 하얘', '테마 색과 밝기'], ['색깔 바꾸고 싶어', '테마 색과 밝기'],
    ['글씨가 안 보여', '글자색 대비 맞추기'], ['채팅이 느려', '성능 보조'], ['렉 걸려', '성능 보조'], ['타이핑할 때 버벅여', '입력 중 목록 갱신 미루기'],
    ['월드인포가 버벅여', '월드인포 긴 목록 가볍게'], ['다른 앱 보면 멈춰', '백그라운드에서도 계속'],
    ['말풍선 바꾸고 싶어', '내 메시지 모양'], ['메신저처럼 보이게', '내 메시지 모양'], ['내 메시지 너무 커', '내 메시지 모양'], ['이름 시간 숨기고 싶어', '내 메시지 모양'],
    ['배경 사진이 안 보여', '채팅 화면·아이콘'], ['눈이 오게', '날씨 효과'], ['비 오게 해줘', '날씨 효과'], ['벚꽃 날리게', '날씨 효과'], ['날씨 끄고 싶어', '날씨 효과'], ['날씨 그만', '날씨 효과'],
    ['빗소리 듣고 싶어', '장면 소리'], ['음악 틀어줘', '분위기 음악'], ['알림 받고 싶어', '답이 오면 알려 주기'],
    ['망했어 원래대로', '변경한 설정·항목별 복원'], ['초기화', '설정 백업·복원'], ['설정 다른 폰으로 옮기고 싶어', '설정 백업·복원'], ['캐릭터마다 다른 모양', '스타일 저장·공유'],
    ['채팅이 날아갔어', '빈 채팅 덮어쓰기 막기'], ['버튼 길게 누르면 뭐야', '단추 길게 누르면 설명 보기'],
    ['다른 테마랑 겹쳐 보여', '다른 CSS와 충돌'], ['형광펜 없애고 싶어', '대사·형광펜'], ['프사 랜덤으로', '프로필 여러 개'], ['추론 숨기고 싶어', '추론 요청을 끄면 지난 추론도 숨기기'],
    ['QR 위로 옮기고 싶어', '퀵 리플라이 · QR'], ['스샷 찍고 싶어', '채팅 캡처'], ['영어로 대답해', 'LLM 번역'], ['영어 메뉴가 어색해', '한국어 화면 다듬기'],
    ['읽어줘', 'TTS'], ['모델 바꾸고 싶어', '모델 전환'], ['토큰 얼마나 썼어', '토큰 수 누르면 내역'], ['숫자에 쉼표', '큰 숫자는 쉼표로'], ['제목이 너무 커', '마크다운 · 제목 크기'],
    ['말로 설정 바꾸고 싶어', 'AI 로 설정 바꾸기'],
];
await test(`대표 문장 ${CASES.length}개 → 맨 위가 그 설정`, () => {
    assert.ok(CASES.length >= 40);
    const wrong = CASES.filter(([q, want]) => top(q) !== want).map(([q, want]) => `${q} → ${top3(q).join(' | ')} (기대 ${want})`);
    assert.deepEqual(wrong, []);
});

await test('오타(자모 한두 글자) · 초성 · 띄어쓰기 없이', () => {
    for (const [q, want] of [
        ['글씨가 쟉아', '본문 글꼴과 크기'], ['말풍산 바꾸고 싶어', '내 메시지 모양'], ['배굥 사진 비치게', '채팅 화면·아이콘'], ['성능 보저', '성능 보조'], ['날씨 휴과', '날씨 효과'], ['쳇팅이 느려', '성능 보조'],
        ['ㄱㅆ ㅈㅇ', '본문 글꼴과 크기'], ['ㄴㅂㅅ', '테마 색과 밝기'], ['ㅁㅍㅅ', '내 메시지 모양'], ['ㅂㄱ', '변경한 설정·항목별 복원'],
        ['글씨가작아', '본문 글꼴과 크기'], ['말풍선바꾸고싶어', '내 메시지 모양'], ['줄간격빽빽해', '문단·줄·글자 간격'],
    ]) assert.equal(top(q), want, `${q} → ${top3(q).join(' | ')}`);
});

await test('예전 검색은 그대로: 다 친 제목 · 치는 중 · 한 낱말', () => {
    assert.equal(S.searchSettings('QR 편집')[0]?.anchor, '퀵 리플라이');
    assert.equal(top('배경'), '가독성 확인 · 색 보정');
    assert.equal(top('확장 탭에 보'), '「확장 탭에 보이기」 줄');
    assert.equal(top('숨긴 메시지 흐'), '숨긴 메시지 흐리게');
    assert.equal(top('테마 색'), '테마 색과 밝기');   // 1.0.0 후보: 9.0.2 에서 걷은 에이드 혼합(그라데이션) 줄은 검색에서도 뺐어요
    assert.deepEqual(S.searchSettings('ㅏ'), []);
});

await test('사전이 고른 첫 결과에 바로 바꿀 조작이 붙어요 (밤 → 화이트/나이트, 글씨 → 크기, 눈 → 눈/끔)', () => {
    const quick = q => S.searchResults(q)[0].quick.map(x => x.path + (x.only ? '=' + x.only.join(',') : ''));
    assert.deepEqual(quick('밤에 눈부셔'), ['palette=salt,night', 'nightTint']);
    assert.deepEqual(quick('글씨가 작아'), ['type.size']);
    assert.deepEqual(quick('눈이 오게'), ['chat.weather=snow,off']);
    assert.deepEqual(quick('채팅이 느려'), ['chat.chatLight']);
    assert.deepEqual(quick('말풍선 바꾸고 싶어'), ['chat.userSize']);   // 9.0.1 말풍선 · 카드 고르기는 걷었다 — 남은 손잡이(내 메시지 크기)
});

await test('결과 줄 조작의 숫자 범위 · 값은 설정 창 슬라이더 · 고르기와 같아요', () => {
    const panel = read('src/panel.js');
    for (const [p, q] of Object.entries(I.QUICK)) {
        if (q.num) {
            const m = panel.match(new RegExp(`slider\\(\\s*(?:'${p.replace('.', '\\.')}'|mode === 'dark' \\? 'nightTint' : 'lightTint')`, 'g'));
            assert.ok(m, `panel.js 슬라이더 ${p}`);
            if (p === 'nightTint' || p === 'lightTint') { assert.match(panel, /'배경 테마색 농도', mode === 'dark' \? 1 : \.5, 20, \.5\)/); continue; }
            const [, min, max] = panel.match(new RegExp(`slider\\('${p.replace('.', '\\.')}', '[^']*', (-?[\\d.]+), (-?[\\d.]+)`));
            assert.deepEqual([Number(min), Number(max)], [q.num[0], q.num[1]], p);
        } else if (p === 'palette') assert.deepEqual(q.options.map(([v]) => v), ['salt', 'night']);
        else for (const [v, label] of q.options) assert.ok(panel.includes(`['${v}', '${label}']`), `${p}: ${v}=${label}`);
    }
    assert.ok(!('enabled' in I.QUICK) && !S.quickAllowed('enabled') && !S.quickAllowed('replyNotify.on') && !S.quickAllowed('addons.tts'), '테마 끄기 · 알림 허용 · 확장 켬은 결과 줄에서 안 바꿔요');
});

// 가짜 설정 창: 결과 목록 · 지우기 단추만 있는 뿌리
function fakeRoot(state, writes) {
    const listeners = {}, list = { hidden: true, innerHTML: '', scrollTop: 0, replaceChildren() { this.innerHTML = ''; }, querySelector: () => null }, clear = { hidden: true };
    const input = { value: '', isConnected: true, matches: sel => sel === '[data-settings-search]', closest: () => true, focus() {} };
    const get = p => p.split('.').reduce((o, k) => o?.[k], state);
    const set = (p, v) => { const keys = p.split('.'), last = keys.pop(); keys.reduce((o, k) => o[k], state)[last] = v; };
    const root = { addEventListener: (t, fn) => (listeners[t] = fn), querySelector: sel => (sel === '.bl-search-results' ? list : sel === '[data-settings-clear]' ? clear : sel === '[data-settings-search]' ? input : null), querySelectorAll: () => [] };
    S.bindSettingsSearch(root, () => {}, { read: get, write: changes => { writes.push(changes); for (const [p, v] of changes) set(p, v); }, ai: () => state.searchAi });
    const el = (attrs) => { const node = { dataset: attrs.dataset || {}, checked: attrs.checked, closest: sel => (attrs.match.includes(sel) ? node : null) }; return node; };
    const click = attrs => listeners.click({ target: el(attrs), preventDefault() {}, stopPropagation() {} });
    const type = value => { input.value = value; listeners.input({ target: input, isComposing: false }); };
    return { root, list, listeners, click, type, el, get };
}

await test('결과 줄에서 바로: 숫자 한 칸 · 값 고르기 · 켬/끔 — 바꾸면 위 줄에 「되돌리기」, 누르면 원래 값', () => {
    const state = { type: { size: 16 }, palette: 'salt', auto: { on: true }, nightTint: 1, chat: { streamFade: false, userSize: 100 }, searchAi: { on: false } };
    const writes = [], f = fakeRoot(state, writes);
    f.type('글씨가 작아');
    assert.match(f.list.innerHTML, /data-search-set="type\.size" data-value="17"/, '+ 단추는 17');
    assert.match(f.list.innerHTML, /<output>16px<\/output>/);
    f.click({ match: ['[data-search-set]'], dataset: { searchSet: 'type.size', value: '17' } });
    assert.deepEqual(writes, [[['type.size', 17]]], '숫자로 한 번에 저장');
    assert.match(f.list.innerHTML, /본문 크기: 16px → 17px/);
    assert.match(f.list.innerHTML, /data-search-undo/);
    f.click({ match: ['[data-search-undo]'], dataset: {} });
    assert.deepEqual(writes.at(-1), [['type.size', 16]]);
    assert.equal(state.type.size, 16);
    assert.doesNotMatch(f.list.innerHTML, /data-search-undo/);
    f.type('밤에 눈부셔');
    assert.match(f.list.innerHTML, /data-search-set="palette" data-value="night"/);
    f.click({ match: ['[data-search-set]'], dataset: { searchSet: 'palette', value: 'night' } });
    assert.equal(state.palette, 'night');
    assert.match(f.list.innerHTML, /밝기: 화이트 → 나이트/);
    assert.equal(state.auto.on, false, '달 단추처럼 자동 전환을 꺼요');
    f.click({ match: ['[data-search-undo]'], dataset: {} });
    assert.equal(state.auto.on, true, '되돌리면 자동 전환도 돌아와요');
    f.type('가벼운 페이드 인');
    assert.match(f.list.innerHTML, /data-search-flip="chat\.streamFade"/, '켬/끔 항목은 줄 오른쪽 스위치');
    f.listeners.change({ target: f.el({ match: ['[data-search-flip]'], dataset: { searchFlip: 'chat.streamFade' }, checked: true }), stopPropagation() {} });
    assert.equal(state.chat.streamFade, true);
    f.click({ match: ['[data-search-set]'], dataset: { searchSet: 'enabled', value: 'false' } });
    assert.equal(writes.filter(w => w.some(([p]) => p === 'enabled')).length, 0, '목록 밖 경로는 안 바꿔요');
    const before = writes.length;
    f.type('다른 말');
    assert.doesNotMatch(f.list.innerHTML, /data-search-undo/, '검색어를 바꾸면 되돌리기 줄은 사라져요 (설정 창 머리의 되돌리기는 그대로)');
    assert.equal(writes.length, before);
});

await test('panel.js 연결: 같은 update(되돌리기 한 단계) · 채팅 › 기타 「AI 로 설정 바꾸기」 · 연결 고르기 · 토큰 수', () => {
    const panel = read('src/panel.js');
    assert.match(panel, /bindSettingsSearch\(root, navigate, \{\s*read: path => path === 'palette' \? paletteBrightness\(getSettings\(\)\.palette\) : getPath\(getSettings\(\), path\),\s*write: changes => update\(st => \{ for \(const \[path, value\] of changes\) \{ if \(path === 'palette'\) st\.palette = withBrightness\(st\.palette, value\); else setPath\(st, path, value\); \} \}\),/);
    assert.match(panel, /row\('AI 로 설정 바꾸기', toggle\('searchAi\.on', !!s\.searchAi\?\.on\)/);
    assert.match(panel, /data-search-ai-tokens/);
    assert.match(panel, /select\[data-search-ai-profile\]/);
    assert.match(read('css/44-settings-search.css'), /\.bl-search-results button:not\(\.bl-search-ctl\)/, '결과 줄 단추 모양이 조작 단추에 번지지 않게');
});

await test('시작 그래프 밖: 사전 · AI 모듈은 index.js 에서 정적으로 닿지 않아요', () => {
    const seen = new Set();
    const walk = rel => {
        if (seen.has(rel) || !fs.existsSync(path.join(root, rel))) return;
        seen.add(rel);
        const text = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
        for (const m of text.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
            const next = path.relative(root, path.resolve(path.dirname(path.join(root, rel)), m[1])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next);
        }
    };
    walk('index.js');
    for (const rel of ['src/settings-intents.js', 'src/settings-ai.js', 'src/settings-search.js']) assert.ok(!seen.has(rel), rel);
});

// 1.0.0 「꾹 누르니 진동 오고 기록 없음이 뜨는데 끄고 싶다 · 진동 검색해도 안 나옴」 → 진동 · 기록 없음 · 단어 검색으로 웹 검색 · 출처 표시가 맨 위, 답 알림은 그대로
await test('웹 검색 · 출처 표시: 진동 · 기록 없음 · 꾹 눌러 검색으로 찾히고, 「진동 알림」 · 「답 오면 진동」은 답 알림 그대로', () => {
    for (const q of ['진동', '진동 끄기', '꾹 누르면 진동', '단어 꾹 누르면 진동 와요', '기록 없음', '기록없음', '진동 기록 없음', '단어 검색', '꾹 눌러 검색']) {
        assert.equal(top(q), '웹 검색 · 출처 표시', `${q} → ${top3(q).join(' | ')}`);
    }
    for (const q of ['진동 알림', '답 오면 진동', '알림 받고 싶어']) assert.equal(top(q), '답이 오면 알려 주기', `${q} → ${top3(q).join(' | ')}`);
    assert.ok(S.searchSettings('진동').some(e => e.title === '답이 오면 알려 주기'), '진동 하나로는 답 알림도 같이 보여요');
    const row = S.entryByTitle('웹 검색 · 출처 표시');
    assert.ok(row, '검색 목록에 있어요');
    assert.match(read('src/panel.js'), /'웹 검색을 쓴 답에 지구 표시 · 답의 낱말을 꾹 누르면 진동과 함께 어디서 왔는지 한 줄'/, '설명에 진동이 있다는 말');
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/settings-intents\.mjs \./);
});

console.log(`settings-intents: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
