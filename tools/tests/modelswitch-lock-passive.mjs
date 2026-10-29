// 8.2.7 폰 예측점검(hunt-mobile): 모델 전환 잠금(src/addons/modelswitch/lock.js)은 잠글 칸이 하나라도 있으면 window 에 touchstart · touchend 를
// passive:false 로 걸었어요. 터치에서는 preventDefault 를 안 하는데도(전파만 끊음) window 의 막을 수 있는 touchstart 는 화면 어디를 대든
// 크롬이 스크롤을 시작하기 전에 메인 스레드 처리를 기다리게 해요 — 답 생성 중처럼 바쁠 때 채팅 스크롤이 늦게 따라와요.
// 고친 뒤: 터치는 passive, 마우스 · 포인터 · click 은 지금처럼 막을 수 있게(passive:false).
//   node tools/tests/modelswitch-lock-passive.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const registered = [];
class Element { constructor(match) { this.match = match; } closest(sel) { return this.match(sel) ? this : null; } blur() {} }
globalThis.Element = Element;
globalThis.window = { addEventListener(type, fn, options) { registered.push({ type, fn, options }); } };
globalThis.document = { body: { classList: { toggle() {} } } };
const { setLocks } = await import(pathToFileURL(path.join(root, 'src/addons/modelswitch/lock.js')));
let opened = 0;
setLocks(['translator'], () => { opened++; });
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const of = type => registered.find(r => r.type === type);
const passive = r => typeof r.options === 'object' && r.options.passive === true;
test('터치 리스너는 passive 예요 (고치기 전: passive:false 로 화면 전체 스크롤 시작을 붙잡음)', () => {
    for (const type of ['touchstart', 'touchend']) { assert.ok(of(type), type); assert.equal(passive(of(type)), true, type); assert.equal(of(type).options.capture, true); }
});
test('마우스 · 포인터 · click 은 그대로 막을 수 있어요 (OS 목록 · 테마 목록이 안 열리게)', () => {
    for (const type of ['pointerdown', 'mousedown', 'click']) { assert.ok(of(type), type); assert.equal(passive(of(type)), false, type); }
});
test('잠긴 칸: 터치는 전파만 끊고 기본 동작(click 생기기)은 둬요 · click 은 막고 모델 전환 창을 열어요', () => {
    const control = new Element(sel => sel.includes('#llm_model'));
    const event = type => ({ type, target: control, prevented: 0, stopped: 0, preventDefault() { this.prevented++; }, stopImmediatePropagation() { this.stopped++; } });
    const touch = event('touchstart'); of('touchstart').fn(touch);
    assert.deepEqual([touch.prevented, touch.stopped], [0, 1]);
    const click = event('click'); of('click').fn(click);
    assert.deepEqual([click.prevented, click.stopped, opened], [1, 1, 1]);
    const free = { type: 'touchstart', target: new Element(() => false), preventDefault() { throw new Error('막으면 안 돼요'); }, stopImmediatePropagation() { throw new Error('끊으면 안 돼요'); } };
    of('touchstart').fn(free);
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/modelswitch-lock-passive.mjs .'), 'release-check.yml 에 등록');
console.log(`모델 전환 잠금 터치 passive: ${pass}개 통과했어요.`);
