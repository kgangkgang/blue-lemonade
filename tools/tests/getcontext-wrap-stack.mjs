// 1.8.9 getContext 감싸개 겹(되풀이 막기) — 테마가 SillyTavern.getContext 한 자리를 세 군데서 감싸요:
//   기능 다리(src/ext-bridge.js) · 미트볼 영어 저장 바로 바꾸기(src/mb-auto-en.js) · 성능 보조의 채팅 바꾸기 막기(src/addons/perf/savededupe.js · 이름 saveDedupeGetContext).
//   1.8.1 ~ 1.8.5 는 mb-auto-en 의 감싸개가 안에서 전역 getContext(= 자기 자신)를 다시 불러 스택이 넘칠 때까지 되풀이했어요(채팅 열기 수십 초).
//   여기서는 세 겹을 「진짜 전역 자리」에 어느 차례로 걸어도 ① 바깥 한 번 = 맨 안쪽 한 번 ② 다시 맞춰도(sync · start) 겹이 늘지 않음
//   ③ 한 겹을 걷었다 다시 걸어도 되풀이 없음을 봐요. 브라우저 없음 · 가짜 실리태번.
//   node tools/tests/getcontext-wrap-stack.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const was = globalThis.SillyTavern;
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {} }) };   // 모듈을 불러올 때만 쓰는 빈 자리
const { createBridge } = await import(pathToFileURL(path.join(root, 'src/ext-bridge.js')).href);
const M = await import(pathToFileURL(path.join(root, 'src/mb-auto-en.js')).href);
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

const OWN = 'blue-lemonade', MB = 'meatballstats';
const THEME_ON = { enabled: true, usageMode: 'both', addons: { translator: true } };
const makeDoc = () => ({ body: { getAttribute: k => (k === 'data-bl-mb-auto-en' ? 'on' : null) } });

/** 가짜 실리태번을 전역 자리에 놓고(감싸개들의 기본 문맥 ctx() 가 바로 이 자리를 불러요) 맨 안쪽 호출 수를 세요 */
function world() {
    const count = { inner: 0 };
    class Popup { static show = { confirm: async () => 0 }; }
    class Service { static async sendRequest() { return { content: 'PROFILE' }; } }
    const extensionSettings = { statussim: { enabled: true, ssGenLang: 'ko' }, 'llm-translator-custom': { glossary_entries: [{ id: 'g1', scope: 'global', src: 'Loren', dst: '로렌' }] } };
    const generateRaw = async function generateRaw() { return 'MAIN'; };
    const st = { getContext: function getContext() {
        count.inner++;
        return { extensionSettings, generateRaw, ConnectionManagerRequestService: Service, Popup, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 }, extensionPrompts: {}, chat: [], chatMetadata: {}, characters: [],
            eventSource: { on() {}, makeLast() {}, removeListener() {} }, event_types: {}, getExtensionManifest: () => ({ display_name: '미트볼 상태창 (Meatball Stats)' }), setExtensionPrompt() {}, saveSettingsDebounced() {} };
    } };
    globalThis.SillyTavern = st;
    const layers = {
        bridge() { const b = createBridge({ host: () => globalThis.SillyTavern, own: OWN, stack: () => `Error\n    at aiGenerate (http://127.0.0.1:8000/scripts/extensions/third-party/${MB}/src/x.js:1:1)`, theme: () => THEME_ON, now: () => 1000, textarea: () => '', asyncFrames: true, birth: () => ({ stack: '' }), direct: async () => 'DIRECT', toast() {} }); assert.equal(b.sync(), true, '기능 다리가 걸려요'); return b; },
        autoen() { assert.equal(M.startMbAutoEn({ host: () => globalThis.SillyTavern, doc: makeDoc(), notify() {}, skipNote() {}, force: true }), true, '영어 저장 바로 바꾸기가 걸려요'); return null; },
        // 성능 보조의 감싸개 꼴: 이름이 saveDedupeGetContext · 안쪽 함수를 한 번 부르고 문맥에 함수 몇 개를 꽂아요
        dedupe() { const holder = globalThis.SillyTavern; if (holder.getContext.name === 'saveDedupeGetContext') return null; const original = holder.getContext; holder.getContext = function saveDedupeGetContext(...args) { const c = original.apply(this, args); if (c) c.openCharacterChat = async () => {}; return c; }; return null; },
    };
    return { st, count, layers };
}
const ORDERS = [['bridge', 'autoen', 'dedupe'], ['bridge', 'dedupe', 'autoen'], ['autoen', 'bridge', 'dedupe'], ['autoen', 'dedupe', 'bridge'], ['dedupe', 'bridge', 'autoen'], ['dedupe', 'autoen', 'bridge']];

try {
    await ok('세 겹을 어느 차례로 걸어도 바깥 한 번 = 맨 안쪽 한 번', async () => {
        for (const order of ORDERS) {
            const w = world(); for (const name of order) w.layers[name]();
            w.count.inner = 0;
            const c = w.st.getContext();
            assert.equal(w.count.inner, 1, `${order.join(' → ')}: 맨 안쪽 getContext 를 ${w.count.inner}번 불렀어요`);
            assert.equal(typeof c.generateRaw, 'function'); assert.equal(typeof c.openCharacterChat, 'function', '안쪽 겹이 꽂은 것도 그대로 와요');
            for (let i = 0; i < 200; i++) w.st.getContext();
            assert.equal(w.count.inner, 201, `${order.join(' → ')}: 200번 더 부르면 안쪽도 200번`);
        }
    });
    await ok('문맥에 얹은 것을 쓸 때(요청 · 물음 창)도 되풀이 없이 끝나요', async () => {
        for (const order of ORDERS) {
            const w = world(); for (const name of order) w.layers[name]();
            const c = w.st.getContext(); w.count.inner = 0;
            await c.generateRaw({ systemPrompt: 'S', prompt: 'Loren walked.', responseLength: 100 });
            await c.Popup.show.confirm('다른 제목', '다른 글');
            assert.ok(w.count.inner <= 8, `${order.join(' → ')}: 요청 한 번 · 창 한 번에 안쪽 getContext ${w.count.inner}번(되풀이면 수천 번)`);
        }
    });
    await ok('다시 맞춰도(sync · start) 겹이 늘지 않아요', async () => {
        for (const order of ORDERS) {
            const w = world(); const made = {}; for (const name of order) made[name] = w.layers[name]();
            const top = w.st.getContext;
            for (let i = 0; i < 5; i++) { made.bridge.sync(); M.startMbAutoEn({ host: () => globalThis.SillyTavern, doc: makeDoc(), notify() {}, skipNote() {} }); w.layers.dedupe(); }
            assert.equal(w.st.getContext, top, `${order.join(' → ')}: 맨 바깥 함수가 그대로`);
            w.count.inner = 0; w.st.getContext(); assert.equal(w.count.inner, 1);
        }
    });
} finally { globalThis.SillyTavern = was; }
console.log(`getcontext-wrap-stack: ${n} ok`);
