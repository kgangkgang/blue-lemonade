// 1.7.8 디자인 관문 남은 줄(1.7.5 ~ 1.7.7 에서 물려 내려온 줄) — 고친 규칙이 다시 빠지지 않게 원본 글만 봐요(DOM 없음 · 화소 값은 리그 관문이 재요).
//  · 채팅 맨 아래 ‹ 1/3 › : 선 꺾쇠 그림 19 → 20(짝수 — 줄 자리와 상관없이 숫자와 0.13px)
//  · 고급 서식 접힘 머리(summary)의 ? : 공용 올림을 걷고 줄 가운데
//  · 미트볼 띠 퀘스트 칸 「두루마리 + 숫자」: 같은 기준선(칸 자리마다 반 화소씩 갈리던 것)
//  · 미트볼 큰 창(폰) ✕ 띠: 띠가 누름을 받아요 — 띠 밑으로 굴러 올라간 카드가 안 보이는 채로 눌리지 않게
//  · 음성 읽기 설정 창 칸 이름 → 칸 간격 6 → 8(테마 간격 눈금)
//   node tools/tests/gate-debt-178.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

test('넘김 꺾쇠: 선 아이콘 그림 20(짝수 — 34 칸 가운데에서 위 끝이 정수 7px) · 칸 34 · 옮김(transform) 없음', () => {
    const css = strip(read('css/05-chat.css'));
    assert.match(css, /body\.salty\.salty-icons-line #chat \.mes :is\(\.swipe_left, \.swipe_right\) \{\s*font-size: 20px !important;\s*\}/, '그림 20');
    assert.match(css, /body\.salty #chat \.mes :is\(\.swipe_left, \.swipe_right\) \{[^}]*width: 34px !important;[^}]*height: 34px !important;/, '칸 34 그대로');
    assert.ok((34 - 20) / 2 === 7, '짝수 그림이면 위 끝이 정수');
    assert.doesNotMatch(css, /swipe_right\)::before \{[^}]*transform/, '그림 옮김 없음(줄 자리마다 반 화소씩 갈렸어요)');
});
test('고급 서식 접힘 머리 ? : 줄 가운데(올림 0) · 글 줄 속 작은 글자 ? 는 그대로', () => {
    const css = strip(read('css/56-control-consistency.css'));
    assert.ok(css.includes('html body.salty #AdvancedFormatting summary > :is(.fa-circle-info, .fa-info-circle, .fa-circle-question, .fa-question-circle) { --bl-help-y: 0em; }'));
    assert.ok(css.includes('html body.salty #AdvancedFormatting small > :is(.fa-circle-info, .fa-info-circle, .fa-circle-question, .fa-question-circle) { --bl-help-y: -0.14em; }'), '작은 글자 줄은 −0.14em 그대로');
});
test('미트볼 큰 창(폰) ✕ 띠: 누름을 받아요(pointer-events: none 없음) · 모양은 그대로', () => {
    const css = strip(read('src/ext-status.css'));
    const rule = css.split('}').find(r => /large_dialogue_popup \.popup-content:is\(\[data-bl-fade-y="top"\], \[data-bl-fade-y="both"\]\)::before \{/.test(r));
    assert.ok(rule, '띠 규칙');
    assert.doesNotMatch(rule, /pointer-events/, '띠가 누름을 통과시키지 않아요');
    for (const p of ['position: sticky', 'top: 0', 'z-index: 1', 'height: var(--bl-ui-icon, 34px)', 'margin-bottom: calc(-1 * var(--bl-ui-icon, 34px))', 'background: var(--bl-fill-card, var(--bl-card))']) assert.ok(rule.includes(p), p);
    assert.match(css, /dialog\.popup\.ss-dlg\.large_dialogue_popup > \.popup-button-close \{[^}]*z-index: 2 !important;/, '✕ 는 띠 위(z 2)라 그대로 눌려요');
});
test('미트볼 띠 퀘스트 칸: 두루마리 · 숫자를 같은 기준선에 · 옮김(transform) 없음 · 원작 그대로 보기에서는 안 걸림 · 다른 칸은 그대로', () => {
    const css = strip(read('src/ext-status.css'));
    assert.ok(css.includes('body.salty:not([data-bl-ext-raw]) #ss-hud .ss-tg > .ss-t > .c > .ci > :is(i.fa-scroll, i.fa-scroll + span) { align-self: baseline; }'));
    assert.doesNotMatch(css, /i\.fa-scroll[^{]*\{[^}]*transform/, '두루마리 그림 옮김 없음');
});
test('음성 읽기 설정 칸 이름 → 칸 사이 8(간격 눈금) · 옛 6 없음', () => {
    const css = strip(read('src/addons/tts/style.css'));
    assert.ok(css.includes('#lv_settings .lv-field { gap:8px; }'));
    assert.doesNotMatch(css, /#lv_settings \.lv-field \{ gap:6px; \}/);
});
test('CI 등록', () => assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/gate-debt-178.mjs .')));
console.log(`gate-debt-178: ${pass} passed`);
