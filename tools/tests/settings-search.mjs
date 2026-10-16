// 6.9.5 테마 설정 검색 — 치는 중(한글 조합 중 · 띄어쓰기 전 · 한 글자)에도 결과 · 설정 창의 모든 손잡이 이름이 검색에 걸리는지
//   node tools/tests/settings-search.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import(pathToFileURL(path.join(root, 'src/settings-search.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const titles = q => S.searchSettings(q).map(e => e.title);
const sleep = ms => new Promise(r => setTimeout(r, ms));

await test('자판 순서: 치는 중의 글자가 다 친 낱말의 앞부분 (겹모음 · 겹받침 · 받침이 다음 글자로 넘어감)', () => {
    assert.equal(S.keystrokes('확'), 'ㅎㅗㅏㄱ');
    for (const [typing, word] of [['호', '확장'], ['화', '확장'], ['확', '확장'], ['확ㅈ', '확장'], ['확자', '확장'], ['갑', '가방'], ['가바', '가방'], ['닭', '달걀'], ['의', '의자'], ['ㅇ', '의자']]) {
        assert.ok(S.keystrokes(word).startsWith(S.keystrokes(typing)), `${typing} → ${word}`);
    }
});

await test('치는 중에도 결과: 첫 음절 · 조합 중인 끝 글자 · 띄어쓰기 전 마지막 낱말', () => {
    for (const q of ['확', '호', '확ㅈ', '확자']) {
        const list = titles(q);
        assert.ok(list.length, q + ' → 결과 없음');
        assert.ok(list.slice(0, 3).some(t => t.includes('확')), `${q} → ${list.slice(0, 3).join(' | ')}`);
    }
    assert.equal(titles('확장 탭에 보')[0], '「확장 탭에 보이기」 줄');
    assert.equal(titles('확장 탭에 보이기')[0], '「확장 탭에 보이기」 줄');
    assert.equal(titles('한국어 화')[0], '한국어 화면 다듬기');
    assert.equal(titles('숨긴 메시지 흐')[0], '숨긴 메시지 흐리게');
    assert.equal(titles('다른 기기 변')[0], '다른 기기 변경 알림');
    assert.deepEqual(S.searchSettings('ㅏ'), [], '홀로 남은 모음은 아무것도 아님 (오류 없이)');
    assert.deepEqual(S.searchSettings('   '), []);
});

await test('다 친 낱말 · 초성 · 말하듯 쓴 문장은 예전 순위 그대로', () => {
    const top = q => titles(q)[0];
    assert.equal(S.searchSettings('QR 편집')[0]?.anchor, '퀵 리플라이');
    assert.equal(top('배경'), '가독성 확인 · 색 보정');
    assert.equal(top('배겨'), '마크다운 · 인용문 · 배경 진하기');
    assert.equal(top('ㅂㄱ'), '변경한 설정·항목별 복원');
    assert.equal(top('글씨가 작아'), '내 메시지 모양');
    assert.equal(top('에이드 섞기 방향'), '에이드 혼합하기 · 그라데이션');
    assert.equal(top('폰트 바꾸고 싶어'), '본문 글꼴과 크기');
    assert.equal(top('눈이 오게'), '날씨 효과');
    assert.equal(top('액자'), '에셋 장식 액자');
    assert.equal(top('초기화'), '설정 백업·복원');
});

// 설정 창(panel.js)이 그리는 손잡이: row(이름, toggle(키)) · slider(키, 이름) · stack(이름, seg(키))
const STR = "('[^']*'|`[^`]*`)";
const unq = t => t.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
const panel = read('src/panel.js');
const controls = [];
for (const [kind, re] of [['toggle', new RegExp('row\\(\\s*' + STR + '\\s*,\\s*toggle\\(\\s*' + STR, 'g')], ['slider', new RegExp('slider\\(\\s*' + STR + '\\s*,\\s*' + STR, 'g')], ['seg', new RegExp('stack\\(\\s*' + STR + '\\s*,\\s*seg\\(\\s*' + STR, 'g')]]) {
    for (const m of panel.matchAll(re)) controls.push(kind === 'slider' ? { kind, path: unq(m[1]), label: unq(m[2]) } : { kind, path: unq(m[2]), label: unq(m[1]) });
}
const PARTICLE = /(?:에서|으로|에게|하면|은|는|이|가|을|를|의|에|로|도|만)$/u;
const UNIT = new Set(['px', 'em', 'ms', 'x']);
function findable({ path: key, label }) {
    const words = S.searchNormalize(label).split(' ').filter(w => w && !UNIT.has(w)).map(w => (w.length > 2 ? w.replace(PARTICLE, '') : w));
    const need = words.filter(w => w.length > 1).length ? words.filter(w => w.length > 1) : words;
    const top = S.searchSettings(label).slice(0, 5);
    return top.some(e => e.path === key) || top.some(e => need.every(w => e.compact.includes(w)));
}

await test('설정 창의 모든 스위치 · 슬라이더 · 고르기 이름이 검색 위 5개에 걸린다 (새 손잡이를 넣고 검색 목록을 빼먹으면 여기서 멈춤)', () => {
    assert.ok(controls.length > 150, 'panel.js 손잡이를 못 읽음: ' + controls.length);
    const missing = controls.filter(c => c.label.trim() && !findable(c));
    assert.deepEqual(missing.map(c => `${c.kind} ${c.path} 「${c.label.trim()}」`), []);
});

await test('6.8.8 「확장 탭에 보이기」 줄 · 따로 찾던 줄은 그 손잡이로 바로 간다 (path 가 설정 창에 있음)', () => {
    const want = { headSwitchRows: ['chat', 'etc'], koUi: ['chat', 'etc'], syncWatch: ['chat', 'etc'], updateCheck: ['theme', 'update'], 'chat.hiddenFade': ['chat', 'screen'], 'chat.qrFind': ['chat', 'screen'], 'chat.weatherIllustrated': ['chat', 'screen'], 'chat.demSkin': ['prompt', 'deus'], 'chat.demInk': ['prompt', 'deus'] };
    for (const [key, [tab, sub]] of Object.entries(want)) {
        const entry = S.SEARCH_ENTRIES.find(e => e.path === key);
        assert.ok(entry, key);
        assert.deepEqual([entry.tab, entry.sub], [tab, sub], key);
        assert.ok(panel.includes(`toggle('${key}'`), 'panel.js 에 그 손잡이: ' + key);
    }
    for (const q of ['확장 탭', '확장 탭에 보이기', '확장 탭 줄 끄기', '제목 줄 스위치']) assert.ok(titles(q).slice(0, 3).includes('「확장 탭에 보이기」 줄'), q + ' → ' + titles(q).slice(0, 3).join(' | '));
});

await test('입력: 한글 조합 중에도 100ms 뒤 결과 · 조합이 끝나면 바로 · 조합 중 Enter · 화살표는 그대로 넘긴다', async () => {
    const listeners = {}, list = { hidden: true, innerHTML: '', replaceChildren() { this.innerHTML = ''; } }, clear = { hidden: true };
    const input = { value: '', isConnected: true, matches: sel => sel === '[data-settings-search]', closest: () => true, focus() {} };
    const fakeRoot = { addEventListener: (t, fn) => (listeners[t] = fn), querySelector: sel => (sel === '.bl-search-results' ? list : sel === '[data-settings-clear]' ? clear : sel === '[data-settings-search]' ? input : null), querySelectorAll: () => [] };
    S.bindSettingsSearch(fakeRoot, () => {});
    input.value = '확장 탭에 보';
    listeners.input({ target: input, isComposing: true });
    assert.equal(list.innerHTML, '', '바로는 안 그린다 (조합 중 입력마다 그리지 않게)');
    await sleep(60);
    input.value = '확장 탭에 보이';
    listeners.input({ target: input, isComposing: true });
    await sleep(60);
    assert.equal(list.innerHTML, '', '이어서 치면 기다리던 것을 미룬다');
    await sleep(80);
    assert.ok(list.innerHTML.includes('「확장 탭에 보이기」 줄') && !list.hidden, '조합 중에도 그린다');
    input.value = '한국어 화';
    listeners.compositionend({ target: input });
    assert.ok(list.innerHTML.includes('한국어 화면 다듬기'), '조합이 끝나면 바로');
    input.value = '숨긴 메시지';
    listeners.input({ target: input, isComposing: false });
    assert.ok(list.innerHTML.includes('숨긴 메시지 흐리게'), '조합이 아니면 바로');
    let prevented = false;
    listeners.keydown({ target: input, isComposing: true, key: 'Enter', preventDefault() { prevented = true; }, stopPropagation() {} });
    assert.equal(prevented, false, '조합 중 Enter 는 입력기에 맡긴다');
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/settings-search\.mjs \./);
});

console.log(`settings-search: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
