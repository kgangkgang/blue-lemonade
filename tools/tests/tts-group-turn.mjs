// 8.2.7 그룹 채팅 TTS — 한 차례에 캐릭터들이 차례로 답할 때 다음 캐릭터의 생성 시작이 앞 캐릭터 읽기를 끊지 않는다 (진짜 onGenStarted 를 index.js 에서 잘라 가짜 환경에서)
//   ① 차례 안(GROUP_WRAPPER_STARTED 뒤에 나온 답)을 읽는 중 다음 캐릭터 생성(normal) → 끊지 않음
//   ② 새 차례(내가 보냄 · 차례 전 답) · 스와이프 · 다시 이어 쓰기 · 혼자 채팅 → 전처럼 끊음 · 조용한 생성은 손대지 않음
//   node tools/tests/tts-group-turn.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/tts/index.js'), 'utf8');
function cut(name) {
    const start = source.indexOf(`\nfunction ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
const line = (re) => { const m = re.exec(source); return m ? m[0] : ''; };
function fixture() {
    const chat = [], stops = [], handlers = {};
    const settings = { on_new: 'interrupt' };
    let cur = null;
    const env = {
        chat, runtimeEnabled: () => true, settings: () => settings, paint: { onGenStarted() {} },
        player: { stop: () => stops.push(cur), currentMesId: () => cur },
        msgOf: (id) => (Number.isInteger(id) && id >= 0 ? chat[id] : undefined),
        event_types: { GROUP_WRAPPER_STARTED: 'gws', GROUP_WRAPPER_FINISHED: 'gwf' },
        eventSource: { on: (t, f) => { handlers[t] = f; } }, Date, Number, clearTimeout,
    };
    const turn = [line(/let groupTurnFrom = [^;]+;/), line(/const inGroupTurn = [^\n]+/)].join('\n');
    const wires = [line(/ *if \(event_types\.GROUP_WRAPPER_STARTED\)[^\n]+/), line(/ *if \(event_types\.GROUP_WRAPPER_FINISHED\)[^\n]+/)].join('\n');
    const api = new Function('env', `with (env) { let genStartedAt = 0, streamTimer = 0, streamLast = 0, stream = null; ${turn.includes('groupTurnFrom') ? '' : 'let groupTurnFrom = -1;'}
        ${turn}\n${cut('onGenStarted')}\n${wires}\n return { onGenStarted }; }`)(env);
    const say = (name, is_user = false) => { chat.push({ name, is_user, mes: `${name} says hi.` }); return chat.length - 1; };
    return { chat, stops, handlers, settings, api, say, reading(id) { cur = id; } };
}
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
test('group: reading member A while member B starts generating in the same turn — not cut', () => {
    const f = fixture();
    f.say('Old'); f.handlers.gws?.({ type: undefined });
    f.say('You', true); const a = f.say('Mina');
    f.reading(a); f.api.onGenStarted('normal', {}, false);
    assert.deepEqual(f.stops, [], 'member A keeps reading until B arrives');
});
test('group: a new turn, a swipe or a continue still cuts; after the turn it cuts again', () => {
    const f = fixture();
    const old = f.say('Old'); f.reading(old);
    f.handlers.gws?.({ type: undefined });
    f.api.onGenStarted('normal', {}, false);
    assert.equal(f.stops.length, 1, 'reply from before this turn is cut (new turn)');
    const a = f.say('Mina'); f.reading(a);
    f.api.onGenStarted('swipe', {}, false); f.api.onGenStarted('continue', {}, false);
    assert.equal(f.stops.length, 3);
    f.handlers.gwf?.({}); f.api.onGenStarted('normal', {}, false);
    assert.equal(f.stops.length, 4, 'outside a group turn: as before');
});
test('solo chat and quiet generation unchanged', () => {
    const f = fixture();
    const a = f.say('Mina'); f.reading(a);
    f.api.onGenStarted('normal', {}, false); assert.equal(f.stops.length, 1);
    f.handlers.gws?.({ type: 'quiet' }); f.say('Nora'); f.reading(1);
    f.api.onGenStarted('normal', {}, false); assert.equal(f.stops.length, 2, 'quiet wrapper is not a turn');
    f.api.onGenStarted('quiet', {}, false); assert.equal(f.stops.length, 2);
});
console.log(`tts-group-turn: ${passed} passed, 0 failed`);
