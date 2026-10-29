// TTS 「프리셋에서 불러오기」는 지금 채팅에 맞는 인물 표만 — src/addons/tts/src/speakers.js importPalette · castScope.
//   프리셋은 `{{setvar::bl_cast_<이름>::- 인물 / 다른 이름: "#색" …}}` 표를 여러 개 두고 `{{getvar::bl_cast_{{char}}}}` 로 지금 카드 이름과 같은 표 하나만 써요.
//   전엔 켜진 프롬프트의 표를 전부 읽어 다른 세계 인물 색까지 잠갔어요. 이제 프리셋과 같은 규칙(카드 이름 = 표 이름, 글자 그대로)으로 고르고,
//   그룹은 멤버 표를 합치고, 맞는 표가 없으면 표는 넣지 않고(카드 · 다른 프롬프트의 색 줄은 그대로) 「전부 불러오기」(all) 를 따로 고를 수 있어요.
//   실리태번 모듈은 data: 스텁(tts-user-macro.mjs 와 같은 방식). 지어낸 인물 · 색만 써요. 네트워크 없음.
//   node tools/tests/tts-cast-scope.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsCastScopeTest = { ext: {}, ctx: null };
const G = 'const T = globalThis.__ttsCastScopeTest;\n';
const ST = {
    'script.js': js(G + `export const chat = []; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? "")]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').includes('/addons/tts/')) { const base = spec.split('/').pop(); if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true }; }
    return next(spec, ctx);
}`), { data: { st: ST } });
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
const { settings } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
settings();

// 실제 프리셋 모양: 표 여러 개가 한 프롬프트에 이어 붙고, 이름이 비슷한 표(별빛관 · 별빛관학원)가 같은 인물을 겹쳐 가져요
const HEAD = '- Fixed colors for this cast — always use exactly these:\n';
const table = (name, rows) => `{{setvar::bl_cast_${name}::${HEAD}${rows.map(r => `  - ${r}`).join('\n')}\n  - {{user}}: "#424C59"}}`;
const PROMPT = '{{// 대화 색}}{{trim}}\n'
    + table('별빛관', ['로아 / Roa / 로아님: "#e63946"', '세린 / Serin: "#f0d878"'])
    + table('별빛관학원', ['로아 / Roa: "#e63946"', '하루 / Haru: "#3aa7ff"'])
    + table('R&B', ['도윤 / Doyun: "#4cb4ff"', '이든 / Eden: "#ff5c8a"'])
    + table('Kai Moon', ['Kai Moon / 카이: "#5ac8ff"'])
    + '{{trim}}\n<dialogue_colors>\n- 대사는 색으로 감싸요\n{{getvar::bl_cast_{{char}}}}\n</dialogue_colors>';
const OTHER = '사용자 프롬프트\n- 나레이터 / 해설: "#00aa00"';   // 표가 아닌 색 줄 — 언제나 읽어요 (예전 그대로)
const ccs = { prompts: [{ identifier: 'dc', content: PROMPT, enabled: false }, { identifier: 'mine', content: OTHER, enabled: true }],
    prompt_order: [{ character_id: 100001, order: [{ identifier: 'dc', enabled: true }, { identifier: 'mine', enabled: true }] }] };
const CARDS = [
    { avatar: 'a.png', name: '별빛관', description: '' },
    { avatar: 'b.png', name: '별빛관학원', description: '' },
    { avatar: 'c.png', name: 'R&B', description: '' },
    { avatar: 'd.png', name: '산책', description: '카드 팔레트\n- 미오: #aa55ff' },
    { avatar: 'e.png', name: 'Kai Moon', description: '' },
];
const solo = (i) => ({ chat: [], chatMetadata: {}, name1: '하람', name2: CARDS[i].name, characterId: i, groupId: null, groups: [], chatCompletionSettings: ccs, characters: CARDS });
const group = (avatars) => ({ chat: [], chatMetadata: {}, name1: '하람', name2: '', characterId: undefined, groupId: 'g1', groups: [{ id: 'g1', members: avatars }], chatCompletionSettings: ccs, characters: CARDS });
const use = (c) => { T.ctx = c; SP._setContextForTest(() => T.ctx, () => {}); };
const names = (pal) => Object.values(pal).flat();
const locked = () => SP.colorTable().filter(r => r.locked).map(r => r.name).sort();

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('한 카드 채팅은 카드 이름과 같은 표만 — 비슷한 이름(별빛관학원)의 인물은 안 섞여요', () => {
    use(solo(0));
    const pal = SP.importPalette({ deferSave: true });
    assert.deepEqual(pal['#e63946'], ['로아', 'Roa', '로아님']);
    assert.deepEqual(pal['#f0d878'], ['세린', 'Serin']);
    assert.ok(!names(pal).includes('하루'), '별빛관학원 표의 하루가 섞이면 안 돼요');
    assert.ok(!names(pal).includes('도윤') && !names(pal).includes('Kai Moon'), '다른 세계 표가 섞이면 안 돼요');
    assert.deepEqual(pal['#00aa00'], ['나레이터', '해설'], '표가 아닌 프롬프트 색 줄은 그대로 읽어요');
    assert.deepEqual(locked(), ['{{user}}', '나레이터', '로아', '세린']);
});

t('반대쪽 카드(별빛관학원)도 자기 표만', () => {
    use(solo(1));
    const pal = SP.importPalette({ deferSave: true });
    assert.deepEqual(pal['#e63946'], ['로아', 'Roa']);
    assert.deepEqual(pal['#3aa7ff'], ['하루', 'Haru']);
    assert.equal(pal['#f0d878'], undefined, '별빛관 표의 세린이 섞이면 안 돼요');
});

t('기호 · 띄어쓰기가 든 표 이름(R&B · Kai Moon)도 글자 그대로 맞춰요', () => {
    use(solo(2));
    assert.deepEqual(SP.castScope(), { tables: ['별빛관', '별빛관학원', 'R&B', 'Kai Moon'], hit: ['R&B'] });
    const pal = SP.importPalette({ deferSave: true });
    assert.deepEqual(pal['#4cb4ff'], ['도윤', 'Doyun']);
    assert.ok(!names(pal).includes('로아'));
    use(solo(4));
    assert.deepEqual(SP.castScope().hit, ['Kai Moon']);
    assert.deepEqual(SP.importPalette({ deferSave: true })['#5ac8ff'], ['Kai Moon', '카이']);
});

t('맞는 표가 없는 채팅은 표를 넣지 않아요 — 카드 · 다른 프롬프트 색 줄만 (전엔 표 전부)', () => {
    use(solo(3));
    assert.deepEqual(SP.castScope().hit, []);
    const pal = SP.importPalette({ deferSave: true });
    assert.deepEqual(Object.keys(pal).sort(), ['#00aa00', '#aa55ff']);
    assert.deepEqual(locked(), ['나레이터', '미오']);
});

t('「전부 불러오기」(all) 를 고르면 예전처럼 표 전부', () => {
    use(solo(3));
    const pal = SP.importPalette({ deferSave: true, all: true });
    for (const who of ['로아', '세린', '하루', '도윤', 'Kai Moon', '미오', '나레이터']) assert.ok(names(pal).includes(who), who);
});

t('그룹 채팅은 멤버들 표를 합쳐요 (멤버 아닌 표는 빼요)', () => {
    use(group(['a.png', 'c.png']));
    assert.deepEqual(SP.castScope().hit, ['별빛관', 'R&B']);
    const pal = SP.importPalette({ deferSave: true });
    for (const who of ['로아', '세린', '도윤', '이든']) assert.ok(names(pal).includes(who), who);
    assert.ok(!names(pal).includes('하루') && !names(pal).includes('Kai Moon'));
});

t('그룹 멤버 표가 같은 인물을 겹쳐 가져도 이름이 한 번만 (별빛관 + 별빛관학원)', () => {
    use(group(['a.png', 'b.png']));
    const pal = SP.importPalette({ deferSave: true });
    assert.deepEqual(pal['#e63946'], ['로아', 'Roa', '로아님']);
    assert.ok(names(pal).includes('하루') && names(pal).includes('세린'));
});

t('직접 정한 연결(char_map) 이름은 그대로 — 다른 이름으로 맞으면 그 이름으로 잠가요 (예전 규칙)', () => {
    settings().char_map = { Roa: 'v1' };
    use(solo(0));
    SP.importPalette({ deferSave: true });
    assert.equal(SP.colorTable().find(r => r.color === '#e63946').name, 'Roa');
    settings().char_map = {};
});

t('표가 하나도 없는 프리셋은 castScope 가 비어요 (안내 창을 띄우지 않게)', () => {
    use({ ...solo(3), chatCompletionSettings: { prompts: [{ identifier: 'mine', content: OTHER }] } });
    assert.deepEqual(SP.castScope(), { tables: [], hit: [] });
    assert.deepEqual(Object.keys(SP.importPalette({ deferSave: true })).sort(), ['#00aa00', '#aa55ff']);
});

console.log(`tts-cast-scope: ${n}개 통과`);
