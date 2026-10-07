// TTS 1.3.5 엔진 잔액 줄 — src/addons/tts/src/balance.js (순수 함수) 검사
//   node tools/tests/tts-balance.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const { balanceParts, balanceText, balanceLow, money, resetText, monthChars, BALANCE_TTL } = await import(pathToFileURL(path.join(root, 'balance.js')).href);

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 5).join('\n       ')); }
}
const NOW = Date.UTC(2026, 9, 7, 12);   // 2026-10-07 12:00Z — 초기화 날짜 글이 날짜에 묶이지 않게 고정

test('money: 달러는 소수 둘째 자리 · 글자는 천 단위 + 자 · 크레딧은 숫자만', () => {
    assert.equal(money(74.5, '$'), '$74.50');
    assert.equal(money(100, '$'), '$100.00');
    assert.equal(money(0.005, '$'), '$0.01');
    assert.equal(money(377000, '자'), '377,000자');
    assert.equal(money(42700, ''), '42,700');
    assert.equal(money(NaN, '자'), '');
    assert.equal(money('12', '자'), '');
});

test('resetText: 월 일 · 1년 넘게 남으면 연도 · 없으면 빈 글', () => {
    assert.equal(resetText(Date.UTC(2026, 9, 15, 15), NOW), '10월 16일 초기화'.replace('16', String(new Date(Date.UTC(2026, 9, 15, 15)).getDate())));
    assert.equal(resetText(Date.UTC(2028, 0, 2, 12), NOW).startsWith('2028년 '), true);
    assert.equal(resetText(0, NOW), '');
    assert.equal(resetText(null, NOW), '');
});

test('ElevenLabs 모양: 남은 글자 / 전체 · 초기화 · 요금제', () => {
    const r = { label: '남은 글자', left: 377000, total: 500000, unit: '자', reset: Date.UTC(2026, 9, 15, 12), note: 'creator' };
    const t = balanceText(r, NOW);
    assert.match(t, /^남은 글자 377,000자 \/ 500,000자 · 10월 1[56]일 초기화 · creator$/);
    assert.equal(balanceLow(r), false);
});

test('Typecast 모양: 남은 크레딧 / 전체 · 요금제', () => {
    assert.equal(balanceText({ label: '남은 크레딧', left: 42700, total: 200000, unit: '', note: 'lite' }, NOW), '남은 크레딧 42,700 / 200,000 · lite');
});

test('OpenRouter 모양: 한도가 있으면 남은 $ / 한도 · 매달 초기화, 없으면 쓴 $ + 한도 없음', () => {
    assert.equal(balanceText({ label: '남은 크레딧', left: 74.5, total: 100, unit: '$', note: '매달 초기화' }, NOW), '남은 크레딧 $74.50 / $100.00 · 매달 초기화');
    assert.equal(balanceText({ label: '쓴 크레딧', used: 25.754, unit: '$', note: '한도 없음 · 이번 달 $3.20' }, NOW), '쓴 크레딧 $25.75 · 한도 없음 · 이번 달 $3.20');
});

test('MiniMax 모양: 이번 달 쓴 글자 + 결제 페이지 링크 조각', () => {
    const r = { label: '이번 달 쓴 글자', used: 193816, unit: '자', url: 'https://platform.minimax.io/user-center/payment/balance', urlText: 'MiniMax 결제 페이지' };
    const p = balanceParts(r, NOW);
    assert.equal(p.main, '이번 달 쓴 글자 193,816자');
    assert.deepEqual(p.tail, { before: ' · 잔액은 ', text: 'MiniMax 결제 페이지', after: '에서', url: r.url });
    assert.equal(balanceText(r, NOW), '이번 달 쓴 글자 193,816자 · 잔액은 MiniMax 결제 페이지에서');
    assert.equal(balanceLow(r), false);   // 남은 양을 모르면 주의색 없음
});

test('balanceLow: 0 이거나 10 % 아래만 · 전체를 모르면 0 일 때만', () => {
    assert.equal(balanceLow({ left: 0, total: 100 }), true);
    assert.equal(balanceLow({ left: 9.9, total: 100 }), true);
    assert.equal(balanceLow({ left: 10, total: 100 }), false);
    assert.equal(balanceLow({ left: 5 }), false);
    assert.equal(balanceLow({ left: 0 }), true);
    assert.equal(balanceLow({ used: 0 }), false);
    assert.equal(balanceLow(null), false);
});

test('이상한 값: 음수는 0 으로 · 글자 숫자는 무시 · 빈 것은 빈 줄', () => {
    assert.equal(balanceText({ label: '남은 글자', left: -5, total: 100, unit: '자' }, NOW), '남은 글자 0자 / 100자');
    assert.equal(balanceText({ label: '남은 글자', left: '12', unit: '자' }, NOW), '남은 글자');
    assert.equal(balanceText(null, NOW), '');
    assert.equal(balanceText({}, NOW), '');
});

test('monthChars: 이번 달만 · 모델 거르기 · 달이 지나면 0', () => {
    const month = new Date().toISOString().slice(0, 7);
    const u = { month, chars: 1000, models: { 'speech-2.8-turbo': 600, 'speech-2.6-hd': 100, 'gpt-4o-mini-tts': 300 } };
    assert.equal(monthChars(u), 1000);
    assert.equal(monthChars(u, (m) => /^speech-/.test(m)), 700);
    assert.equal(monthChars({ month: '2000-01', chars: 1000, models: { 'speech-2.8-turbo': 600 } }, (m) => /^speech-/.test(m)), 0);
    assert.equal(monthChars({ month, chars: 50 }, (m) => /^speech-/.test(m)), 0);
    assert.equal(monthChars(null), 0);
});

test('BALANCE_TTL 은 10분', () => assert.equal(BALANCE_TTL, 600000));

console.log(`\ntts-balance: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
