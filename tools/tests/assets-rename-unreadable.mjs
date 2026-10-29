// 캐릭터 에셋: 캐릭터 이름을 바꾸는 순간 그림 목록 읽기가 실패하면 (예측점검-애드온 1029)
//   예전엔 못 읽은 목록을 「그림 없음」으로 쳐서 설정 열쇠(프리셋 · 꺼 둔 그림 · 연결)만 새 이름으로 옮겼어요 — 그림은 옛 폴더에 남아 안 보였어요.
//   이제 못 읽으면 아무것도 옮기지 않고 알려요. 이름은 지어낸 것. 네트워크 없음.  node tools/tests/assets-rename-unreadable.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const src = path.join(root, 'src');
const js = code => `data:text/javascript,${encodeURIComponent(code)}`;
const ST = { 'script.js': js('export function getRequestHeaders() { return {}; }'), 'popup.js': js('export const POPUP_TYPE = { CONFIRM: 2 }; export const POPUP_RESULT = { AFFIRMATIVE: 1 }; export async function callGenericPopup() { return null; }') };
register(js(`let S = {}, ROOT = '';
export async function initialize(d) { S = d.st; ROOT = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.startsWith(ROOT)) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) {
            const target = new URL(spec, parent).href;
            if (!target.startsWith(ROOT)) return { url: S[base], shortCircuit: true };
        }
    }
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(src).href } });
const R = await import(pathToFileURL(path.join(src, 'addons/assets/rename.js')).href);

const store = () => ({ presets: { Corvin: [{ id: 'base', name: '' }, { id: 'p1', name: '겨울' }] }, disabled: { 'Corvin/겨울': ['b.png'] }, links: {} });
const files = new Map([['Corvin', ['a.png']], ['Corvin/겨울', ['b.png']]]);
const asset = (folder, file) => ({ folder, file, base: file.replace(/\.[^.]+$/, ''), url: `/fake/${folder}/${file}` });
const io = (broken) => ({
    fetchAssets: async key => { if (broken(key)) throw new Error('Internal Server Error'); return (files.get(key) || []).map(f => asset(key, f)); },
    uploadImage: async () => { throw new Error('올리면 안 돼요'); },
    deleteAsset: async () => { throw new Error('지우면 안 돼요'); },
    fetch: async () => { throw new Error('받으면 안 돼요'); },
    ask: async () => true,
});
const host = st => { const h = { saved: 0, toasts: [], settings: () => st, saveSettings() { h.saved++; }, reload: async () => {}, toast: (kind, text) => h.toasts.push([kind, text]) }; return h; };
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok', name); }
const realWarn = console.warn; console.warn = () => {};

await check('옛 폴더 목록을 하나도 못 읽으면 설정 열쇠를 옮기지 않고 알려요', async () => {
    const st = store(), h = host(st);
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', h, io(() => true)), 'failed');
    assert.ok(st.presets.Corvin && !st.presets['코르빈'], '프리셋 열쇠는 옛 이름 그대로');
    assert.deepEqual(st.disabled['Corvin/겨울'], ['b.png']);
    assert.equal(h.saved, 0);
    assert.equal(h.toasts[0]?.[0], 'error');
});
await check('프리셋 폴더 하나만 못 읽어도 아무것도 옮기지 않아요 (그 프리셋 열쇠만 새 이름으로 가서 그림이 고아가 되지 않게)', async () => {
    const st = store(), h = host(st);
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', h, io(key => key === 'Corvin/겨울')), 'failed');
    assert.ok(st.presets.Corvin && !st.presets['코르빈']);
    assert.deepEqual(st.disabled['Corvin/겨울'], ['b.png']);
});
await check('새 폴더 목록을 못 읽으면(비었는지 모름) 옮기지 않아요', async () => {
    const st = store(), h = host(st);
    assert.equal(await R.followCharacterRename('Corvin.png', '코르빈.png', h, io(key => key === '코르빈')), 'failed');
    assert.ok(st.presets.Corvin);
});
await check('정말 그림이 없으면(목록은 읽힘 · 비었음) 예전처럼 열쇠만 옮겨요', async () => {
    const st = { presets: { Empty: [{ id: 'base', name: '' }] } }, h = host(st);
    assert.equal(await R.followCharacterRename('Empty.png', '빈.png', h, io(() => false)), 'keys');
    assert.ok(st.presets['빈']);
});
console.warn = realWarn;
console.log(`assets rename unreadable: ${passed} passed`);
