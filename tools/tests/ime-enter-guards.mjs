// 8.2.7 폰 예측점검(hunt-mobile) · 한글 IME: 맥 크롬은 한글을 조합하는 중에 Enter 를 누르면 keydown 이 두 번 와요(처음 isComposing:true · 다음 false).
// 글 칸의 Enter 처리가 isComposing 을 안 보면 ① 조합 중에 저장 · 칸 비우기를 해 마지막 음절이 빈칸에 다시 남거나 ② 두 번 돌아요.
// (안드로이드 Gboard · 삼성 키보드는 조합을 먼저 끝내고 Enter 를 보내 isComposing:false 한 번이라 그대로예요. keyCode 229 는 삼성 키보드가
//  Enter 를 229 로 보내는지 확인하지 못해 보지 않아요 — 폰에서 Enter 가 안 먹는 일이 없게.)
// 고친 곳(각 칸 Enter 처리가 조합 중이면 아무것도 안 해요):
//   번역 › 용어집 원문 · 번역 칸(추가하고 비움) · 프롬프트 번역 고르기 콤보(이름으로 칸을 다시 씀) · 메모 · 쪽지 제목(본문으로 넘김 — 두 번째 Enter 가 본문에 빈 줄)
//   테마 고르기 목록 찾기(고른 뒤 select 로 초점 → 두 번째 Enter 가 목록을 다시 엶) · QR 찾기(첫 QR 실행) · 채팅 지도 찾기(다음 일치 — 하나 건너뜀)
//   요청 기록 › 가격 직접 지정(저장하고 비움)
//   node tools/tests/ime-enter-guards.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const sites = [
    ['src/addons/translator/index.js', /if \(event\.key === 'Enter' && !event\.isComposing\) \{ event\.preventDefault\(\); submit\(\); \}/, 1, '용어집 원문 · 번역 칸'],
    ['src/addons/prompt/index.js', /else if \(e\.key === 'Enter' && !e\.isComposing\) \{[^\n]*\n\s*if \(comboOpen && matches\.length\) \{\s*e\.preventDefault\(\);\s*pick\(/, 1, '프롬프트 번역 고르기 콤보'],
    ['src/addons/notes/index.js', /title\.addEventListener\('keydown', e => \{ if \(e\.key === 'Enter' && !e\.isComposing\) \{ e\.preventDefault\(\); field\.show\(true\); body\.focus\(\); \} \}\);/g, 2, '메모 카드 · 쪽지 제목'],
    ['src/selects.js', /\} else if \(e\.key === 'Enter' && e\.target === input && !e\.isComposing\) \{[^\n]*\n\s*e\.preventDefault\(\);\s*items\[0\]\?\.click\(\);/, 1, '고르기 목록 찾기'],
    ['src/qrfind.js', /\} else if \(e\.key === 'Enter' && e\.target === input && !e\.isComposing\) \{[^\n]*\n\s*e\.preventDefault\(\);\s*list\[0\]\?\.click\(\);/, 1, 'QR 찾기'],
    ['src/chat-graph.js', /if \(event\.key !== 'Enter' \|\| event\.isComposing\) return;[^\n]*\n\s*const matches = \[\.\.\.nodesBox\.querySelectorAll\('\.is-match'\)\]/, 1, '채팅 지도 찾기'],
    ['src/addons/perf/panel.js', /if \(event\.key === 'Enter' && !event\.isComposing\) \{ event\.preventDefault\(\); onPriceAdd\(\); \}/, 1, '가격 직접 지정'],
];
for (const [file, re, count, label] of sites) {
    test(`${label} (${file}): 조합 중 Enter 는 건너뛰어요 (고치기 전: 확인 없음)`, () => {
        const src = read(file);
        const found = re.global ? [...src.matchAll(re)].length : (re.test(src) ? 1 : 0);
        assert.equal(found, count);
    });
}
// 흉내: 맥 크롬 한글 Enter 의 keydown 두 번 → 동작은 한 번(조합이 끝난 뒤)
test('흉내: 조합 중 keydown(isComposing) + 끝난 뒤 keydown 이 오면 저장은 한 번, 조합이 끝난 값으로', () => {
    let value = '홍길도', saved = [];
    const handler = event => { if (event.key === 'Enter' && !event.isComposing) { saved.push(value); value = ''; } };
    handler({ key: 'Enter', isComposing: true }); value = '홍길동';   // 조합 확정
    handler({ key: 'Enter', isComposing: false });
    assert.deepEqual(saved, ['홍길동']);
    assert.equal(value, '');
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/ime-enter-guards.mjs .'), 'release-check.yml 에 등록');
console.log(`한글 조합 중 Enter: ${pass}개 통과했어요.`);
