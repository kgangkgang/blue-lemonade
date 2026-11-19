// TTS 색 ↔ 인물 표 섞임 — src/addons/tts/src/speakers.js learnUnits (버그 사냥 8).
//   속마음 표시(<true_thoughts character="…">)가 두 사람의 대사 사이에 놓이면 앞 묶음 · 뒤 묶음 둘 다에 3점씩 내서, 잠긴(팔레트) 색 표에 다른 인물 이름이 쌓였어요
//   (앞 사람 색에 뒷사람 이름). 「앞 서술의 마지막 이름」 1점도 남의 색에 쌓였어요. 정해 둔 색과 어긋나는 표는 이제 내지 않아요:
//   ① 그 색이 다른 사람으로 잠김 ② 그 이름이 다른 색에 잠김. 잠금이 없는 색 · 이름은 예전 그대로 배워요. 원문은 점자 빈칸(U+2800) 띄어쓰기 꼴로도 봐요.
//   실리태번 모듈은 data: 스텁(tts-shared-color.mjs 와 같은 방식). 지어낸 인물 · 색만 쓴다. 네트워크 없음.
//   node tools/tests/tts-vote-locked.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsVoteLockedTest = { ext: {}, ctx: null };
const G = 'const T = globalThis.__ttsVoteLockedTest;\n';
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
const TX = await import(pathToFileURL(path.join(root, 'text.js')).href);
const { settings } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const s0 = settings();
const B = '\u2800';
const say = (color, text) => `<span${B}style="color:${color}">「${text}」</span>`;
const think = (who, text) => `<true_thoughts${B}character="${who}">${text}</true_thoughts>`;
// 로완(#b090e0) 대사 → 하람(나) 속마음 → 하람(#404858) 대사 → 서술(로완 이름) → 하람 대사 → 새 인물 도빈 속마음 → 도빈(#a08060 · 팔레트에 없음) 대사
const MES = [
    `Across${B}the${B}divider,${B}Rowan${B}said${B}nothing${B}for${B}a${B}beat.`, '',
    say('#b090e0', '照合ですか'), '',
    think('하람', '想定内です'), '',
    say('#404858', 'はい、確認します'), '',
    `Rowan${B}sighed${B}and${B}closed${B}the${B}folder.`, '',
    say('#404858', 'では、参りましょう'), '',
    think('도빈', '誰だろう'), '',
    say('#a08060', 'いらっしゃい'),
].join('\n');
const opts = () => ({ skipTags: new Set(String(s0.skip_tags || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)), skipCode: !!s0.skip_codeblocks,
    stripRegex: TX.parseRegexLines(s0.strip_regex), userName: '하람', charName: '로완', knownNames: SP.knownNames(), routes: s0.routes, final: true });
const fresh = (description) => {
    T.ctx = { chat: [], chatMetadata: {}, name1: '하람', name2: '로완', characterId: 0, groupId: null, groups: [], chatCompletionSettings: {},
        characters: [{ avatar: 'rowan.png', name: '로완', description }] };
    SP._setContextForTest(() => T.ctx, () => {});
    SP.importPalette({ deferSave: true });
    const mes = { name: '로완', mes: MES };
    T.ctx.chat.push(mes);
    SP.learnFromMessage(mes, TX.segmentMessage(MES, opts()), { deferSave: true });
    return T.ctx.chatMetadata.lemon_voice;
};

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('조각: 점자 빈칸 원문에서도 색 대사 넷 · 속마음 표시 둘이 나온다', () => {
    const segs = TX.segmentMessage(MES, opts());
    assert.equal(segs.filter(x => x.kind === 'dialogue' && x.color).length, 4);
    assert.deepEqual(segs.filter(x => x.kind === 'thought' && x.speakerHint).map(x => x.speakerHint), ['하람', '도빈']);
});
t('잠긴 색: 로완 색에 사이에 낀 내 속마음 표가 안 섞인다 (전엔 하람 3)', () => {
    const st = fresh('팔레트\n- 로완/Rowan: #b090e0\n- {{user}}: #404858');
    assert.deepEqual(st.colors['#b090e0'].votes, { 로완: 1 });   // 앞 서술의 제 이름 1점만
    assert.deepEqual(st.colors['#b090e0'].tvotes, {});
    assert.equal(st.colors['#b090e0'].count, 1);
    assert.equal(st.colors['#b090e0'].name, '로완');
});
t('잠긴 내 색({{user}}): 내 속마음 표만 남고 서술의 남 이름(로완) · 새 인물(도빈) 표는 안 섞인다', () => {
    const st = fresh('팔레트\n- 로완/Rowan: #b090e0\n- {{user}}: #404858');
    assert.deepEqual(st.colors['#404858'].votes, { 하람: 3 });
    assert.deepEqual(st.colors['#404858'].tvotes, { 하람: 3 });
    assert.equal(st.colors['#404858'].count, 2);
    assert.equal(st.userColor, '#404858');
});
t('잠금 없는 새 색은 예전 그대로 배운다 (도빈 속마음 3 → 이름이 붙는다)', () => {
    const st = fresh('팔레트\n- 로완/Rowan: #b090e0\n- {{user}}: #404858');
    assert.deepEqual(st.colors['#a08060'].votes, { 도빈: 3 });
    assert.equal(st.colors['#a08060'].name, '도빈');
    assert.equal(st.colors['#a08060'].locked, false);
});
t('팔레트가 없는 채팅은 예전 그대로 (사이에 낀 속마음은 앞 · 뒤 묶음 둘 다에 3점)', () => {
    const st = fresh('');
    assert.equal(st.colors['#b090e0'].votes['하람'], 3);
    assert.equal(st.colors['#404858'].votes['하람'], 3);
});
t('글이 바뀌면(스와이프) 낸 표만 걷는다 — 음수 · 남은 표 없음', () => {
    const st = fresh('팔레트\n- 로완/Rowan: #b090e0\n- {{user}}: #404858');
    const mes = T.ctx.chat[0];
    mes.mes = say('#b090e0', '別の返事');
    SP.learnFromMessage(mes, TX.segmentMessage(mes.mes, opts()), { deferSave: true });
    assert.deepEqual(st.colors['#404858'].votes, {});
    assert.equal(st.colors['#404858'].count, 0);
    assert.equal(st.colors['#b090e0'].count, 1);
    assert.equal(st.colors['#a08060'], undefined);
});
t('옛 판이 낸 섞인 표 기록도 탈 없이 걷힌다 (저장된 learned 되돌리기)', () => {
    const st = fresh('팔레트\n- 로완/Rowan: #b090e0\n- {{user}}: #404858');
    st.colors['#b090e0'].votes['하람'] = 3; st.colors['#b090e0'].tvotes['하람'] = 3;
    st.learned[0].v.push(['#b090e0', '하람', 3, 1]);
    const mes = T.ctx.chat[0];
    mes.mes = say('#b090e0', '別の返事');
    SP.learnFromMessage(mes, TX.segmentMessage(mes.mes, opts()), { deferSave: true });
    assert.deepEqual(st.colors['#b090e0'].votes, {});
    assert.deepEqual(st.colors['#b090e0'].tvotes, {});
});

console.log(`tts-vote-locked: ${n} passed, 0 failed`);
