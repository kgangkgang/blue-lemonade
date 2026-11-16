// TTS 목소리 탭(src/addons/tts/src/ui.js afterEdit) — 「기본 · 나 · 내레이터」 줄의 목소리를 바꾸면 그 줄을 다시 그려요.
//   줄 옆의 감정 세기 칸 · 목소리 설정 단추는 그릴 때의 목소리(uid)를 쥐고 있어요. 1.5.8 까지는 다시 그리지 않아,
//   목소리 A 를 B 로 바꾼 뒤 감정 세기를 고르면 A 가 고쳐지고 설정 단추는 A 의 편집 창을 열었어요(캐릭터 줄은 원래 다시 그려요).
//   진짜 afterEdit 을 잘라 가짜 환경에서 돌려요.
//   node tools/tests/tts-voice-row-redraw.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/tts/src/ui.js'), 'utf8');
const start = source.indexOf('\nfunction afterEdit(path, el) {');
assert.ok(start >= 0, 'afterEdit 을 찾아요');
let depth = 0, end = -1;
for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) { end = i + 1; break; } }
const body = source.slice(start + 1, end);
function fixture(settings) {
    const calls = { renderMap: 0, renderReadCard: [], saved: 0 };
    const env = {
        settings: () => settings, SYNC_TEXT_FIELDS: ['pron_dict', 'mute_words'], USER_AUTO: '__auto__', isObj: v => !!v && typeof v === 'object' && !Array.isArray(v),
        getContext: () => ({ name1: 'Me' }), voices: { personaKnown: () => true }, player: { stop() {}, applyPlayback() {}, refreshHighlight() {}, askPersonaVoice: async () => {} },
        syncPath() {}, renderMap: () => { calls.renderMap++; }, save: () => { calls.saved++; }, toast() {}, applyReadPreset() {}, renderReadCard: name => calls.renderReadCard.push(name),
        cache: { prune: async () => {}, stats: async () => ({ count: 0, bytes: 0 }) }, q: () => null, fmtNum: String, READ_CARDS: { when: [0, 0, []] }, visibleChanged: () => true,
        Date, Promise, String, Array,
    };
    const afterEdit = new Function('env', `with (env) { ${body}\n return afterEdit; }`)(env);
    const el = { closest: () => ({ dataset: { lvCard: 'map' } }) };
    return { calls, run: p => afterEdit(p, el) };
}
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

for (const p of ['default_voice', 'user_voice', 'narrator_voice']) {
    test(`${p} 를 바꾸면 목소리 줄을 다시 그려요`, () => {
        const f = fixture({ default_voice: 'v2', user_voice: 'v2', narrator_voice: 'v2', routes: {} });
        f.run(p);
        assert.equal(f.calls.renderMap, 1, '고치기 전: 0 — 줄 옆 도구가 옛 목소리를 가리킨 채 남음');
    });
}
test('「나」를 자동으로 골라도 다시 그려요(도구가 사라져야 해요) · 「내 대사」 읽기 바꿈은 전처럼', () => {
    const s = { user_voice: '__auto__', routes: { user_dialogue: 'skip' } };
    const f = fixture(s);
    f.run('user_voice');
    assert.equal(f.calls.renderMap, 1);
    assert.equal(s.routes.user_dialogue, 'user'); assert.equal(f.calls.saved, 1);
});
test('다른 칸은 목소리 줄을 다시 그리지 않아요', () => {
    const f = fixture({ routes: {} });
    for (const p of ['playback_rate', 'highlight', 'enabled', 'read_preset']) f.run(p);
    assert.equal(f.calls.renderMap, 0);
});
console.log(`tts-voice-row-redraw: ${passed} passed`);
