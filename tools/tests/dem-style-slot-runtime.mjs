import assert from 'node:assert/strict';
import { createDemStyleSlots } from '../../src/dem-style-slots.js';
const id = n => `theme-${n}-0123456789abcdef`;
function slot(n) {
    return { cssRules: [{ selectorText: `#bl-dem-slot-${id(n)}` }], media: { mediaText: 'not all' },
        insertRule(text, at) { if (text === '깨진 규칙') throw Error('시험 구문 오류'); this.cssRules.splice(at, 0, { cssText: text }); },
        deleteRule(at) { this.cssRules.splice(at, 1); } };
}
const payload = { [id(0)]: { rules: ['.x{color:red}', '.y{color:blue}'] }, [id(1)]: { rules: ['.z{color:green}'] } };
let passed = 0;
function test(name, run) { run(); passed++; console.log(`통과 ${passed}: ${name}`); }
test('원래 시트와 중첩 조건 안의 칸에만 넣고 켬·끔을 반복해도 중복되지 않아요', () => {
    const a = slot(0), b = slot(1), before = { cssText: '.before{}' }, after = { cssText: '.after{}' };
    const sheet = { cssRules: [before, a, { cssRules: [b] }, after] }, api = createDemStyleSlots();
    assert.deepEqual(api.needed([sheet]), [id(0), id(1)]);
    assert.equal(api.apply([sheet, sheet], true, payload), 2);
    assert.equal(a.cssRules.length, 3); assert.equal(b.cssRules.length, 2);
    assert.equal(sheet.cssRules[0], before); assert.equal(sheet.cssRules.at(-1), after);
    assert.equal(a.media.mediaText, 'all'); assert.deepEqual(api.needed([sheet]), []);
    api.apply([sheet], false); assert.equal(a.media.mediaText, 'not all');
    api.apply([sheet], true); assert.equal(a.media.mediaText, 'all'); assert.equal(a.cssRules.length, 3);
});
test('오래된 내용이면 일부만 적용하지 않고 시작 전에 멈춰요', () => {
    const a = slot(0), b = slot(1), api = createDemStyleSlots(), sheet = { cssRules: [a, b] };
    assert.throws(() => api.apply([sheet], true, { [id(0)]: payload[id(0)] }), /어긋/);
    assert.equal(a.cssRules.length, 1); assert.equal(a.media.mediaText, 'not all');
});
test('두 번째 칸 삽입 실패도 앞의 삽입을 되돌리고 다음 시도는 가능해요', () => {
    const a = slot(0), b = slot(1), api = createDemStyleSlots(), sheet = { cssRules: [a, b] };
    assert.throws(() => api.apply([sheet], true, { ...payload, [id(1)]: { rules: ['깨진 규칙'] } }), /구문/);
    assert.equal(a.cssRules.length, 1); assert.equal(b.cssRules.length, 1); assert.equal(a.media.mediaText, 'not all');
    api.apply([sheet], true, payload); assert.equal(a.cssRules.length, 3);
});
test('뒤에 전체 시트로 교체되면 새 시트에도 같은 내용을 넣어요', () => {
    const api = createDemStyleSlots(), a = slot(0), first = { cssRules: [a] };
    api.apply([first], true, payload);
    const b = slot(0), full = { cssRules: [b] }; assert.deepEqual(api.needed([full]), [id(0)]);
    api.apply([full], true, payload); assert.equal(b.cssRules.length, 3); assert.equal(a.cssRules.length, 3);
});
test('분리 칸이 없는 기존 시트는 바꾸지 않아요', () => {
    const api = createDemStyleSlots(), sheet = { cssRules: [{ cssText: '.keep{color:red}' }] };
    assert.deepEqual(api.needed([sheet]), []); assert.equal(api.apply([sheet], true), 0);
});
console.log(`데우스 시트 복원 준비 시험 ${passed}개를 통과했어요.`);
