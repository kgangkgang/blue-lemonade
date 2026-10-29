// 8.2.4 ~ 8.2.6 에 새로 생긴 켬/끔(채팅 안 동작 값)이 옛 설정 · 깨진 값 · 가져온 파일 · 초기화 · 스타일 · 선택 공유 프리셋 · 「변경한 설정」을
// 거쳐도 뜻대로 남는지. 새 키를 더할 때 이 표에 한 줄 더하면 같은 길을 다 시험해요.
//   node tools/tests/settings-new-keys.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const styles = await import(pathToFileURL(path.join(root, 'src/styles.js')).href);
const presets = await import(pathToFileURL(path.join(root, 'src/preset-sharing.js')).href);
const D = await import(pathToFileURL(path.join(root, 'src/settings-differences.js')).href);
const { SETTING_LABELS } = await import(pathToFileURL(path.join(root, 'src/settings-labels.js')).href);
const Search = await import(pathToFileURL(path.join(root, 'src/settings-search.js')).href);

// 키 → 기본값 (예전 설정에 없으면 이 값)
const KEYS = { lazyAvatars: true, searchIme: true, codePlain: false, worldInfoLight: true, chatLight: true, personaDefer: true };

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const load = value => { ctx.extensionSettings = { salty: structuredClone(value) }; S.invalidateSettings(); return S.getSettings(); };
const base = () => { const s = structuredClone(S.DEFAULTS); s.profile.modeVersion = 1; return s; };

await test('기본값 표 그대로', () => { for (const [k, v] of Object.entries(KEYS)) assert.equal(S.DEFAULTS.chat[k], v, k); });

await test('옛 설정(키 없음 · 7.x 판 모양)에서 올라오면 기본값', () => {
    const old = base(); for (const k of Object.keys(KEYS)) delete old.chat[k];
    old.version = 2;
    const s = load(old);
    for (const [k, v] of Object.entries(KEYS)) assert.equal(s.chat[k], v, k);
});

await test('깨진 값(null · 숫자 · 글자 · 객체)은 기본값, 가져온 파일의 "true" · "false" 글자는 그 뜻대로', () => {
    for (const bad of [null, 0, 1, 'x', {}, []]) {
        const old = base(); for (const k of Object.keys(KEYS)) old.chat[k] = bad;
        const s = load(old);
        for (const [k, v] of Object.entries(KEYS)) assert.equal(s.chat[k], v, `${k}=${JSON.stringify(bad)}`);
    }
    for (const word of ['true', 'false']) {
        const old = base(); for (const k of Object.keys(KEYS)) old.chat[k] = word;
        const s = load(old);
        for (const k of Object.keys(KEYS)) assert.equal(s.chat[k], word === 'true', `${k}=${word}`);
    }
});

await test('끈 값은 저장 · 불러오기를 되풀이해도 그대로 (기본값으로 돌아가지 않음)', () => {
    const old = base(); for (const [k, v] of Object.entries(KEYS)) old.chat[k] = !v;
    let s = load(old);
    for (let i = 0; i < 3; i++) s = load(JSON.parse(JSON.stringify(s)));
    for (const [k, v] of Object.entries(KEYS)) assert.equal(s.chat[k], !v, k);
});

await test('테마 모습 초기화 · 스타일 입히기 · 선택 공유 프리셋은 이 동작 값을 건드리지 않아요', () => {
    const old = base(); for (const [k, v] of Object.entries(KEYS)) old.chat[k] = !v;
    load(old);
    const next = S.resetSettings({ look: true });
    for (const [k, v] of Object.entries(KEYS)) assert.equal(next.chat[k], !v, 'reset ' + k);
    const s = S.getSettings();
    const style = styles.captureStyle(s);
    for (const k of Object.keys(KEYS)) assert.equal(k in style.chat, false, '스타일에 담기지 않음 ' + k);
    const foreign = structuredClone(style); for (const [k, v] of Object.entries(KEYS)) foreign.chat[k] = v;
    styles.applyStyleData(s, foreign);
    for (const [k, v] of Object.entries(KEYS)) assert.equal(s.chat[k], !v, '스타일이 덮지 않음 ' + k);
    const preset = presets.capturePreset(s, presets.PRESET_GROUPS.map(([id]) => id));
    const flat = JSON.stringify(preset);
    for (const k of Object.keys(KEYS)) assert.equal(flat.includes(`chat.${k}`), false, '프리셋에 담기지 않음 ' + k);
});

await test('「변경한 설정」: 바꾼 값이 이름과 함께 오르고 ↺ 로 기본값에 돌아가요', () => {
    const old = base(); for (const [k, v] of Object.entries(KEYS)) old.chat[k] = !v;
    const s = load(old);
    const list = D.changedSettings(s).map(c => c.path);
    for (const [k, v] of Object.entries(KEYS)) {
        const p = `chat.${k}`;
        assert.ok(list.includes(p), p);
        assert.ok(SETTING_LABELS[p], '이름 ' + p);
        assert.equal(D.resetSetting(s, p), true);
        assert.equal(s.chat[k], v);
    }
});

await test('설정 검색에 걸리고 그 손잡이 화면으로 가요', () => {
    for (const k of Object.keys(KEYS)) {
        const p = `chat.${k}`, hit = Search.searchSettings(SETTING_LABELS[p]).slice(0, 5);
        const r = D.settingRoute(p);
        assert.ok(hit.some(e => e.path === p || (e.tab === r.tab && e.sub === r.sub)), `${p} 「${SETTING_LABELS[p]}」 → ${hit.map(e => e.title).join(' | ')}`);
    }
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/settings-new-keys\.mjs \./);
});

console.log(`settings-new-keys: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
