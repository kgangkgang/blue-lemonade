// 불러온 파일 · 모델 출력 · 이름에서 온 글이 화면에서 코드로 실행되거나, 남의 파일을 지우게 되지 않는지 (8.2.7 예측 점검 · 보안)
// 실행: node tools/tests/security-untrusted-text.mjs [사본 경로]
// 표준 무해 검사 글(<img src=x onerror=…>)만 써요. 「실행」되면 시험 안의 표식(hits)만 바뀌어요.
// 가짜 DOM: innerHTML 에 들어간 글을 브라우저처럼 태그 · 속성으로 나눠, on… 속성이 생기면 그 값을 시험 상자 안에서 돌려요(깨진 그림의 onerror 와 같은 뜻).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[e.toLowerCase()]);
/** 브라우저의 HTML 나누기를 흉내: 글자 자리의 < + 영문자만 태그, 따옴표 속성 안의 < 는 글자. 태그마다 { name, attrs } */
export function parseTags(html) {
    const tags = [], s = String(html);
    let i = 0;
    while ((i = s.indexOf('<', i)) >= 0) {
        const m = /^<([a-zA-Z][\w-]*)/.exec(s.slice(i, i + 64));
        if (!m) { i++; continue; }
        let j = i + m[0].length; const attrs = {};
        while (j < s.length) {
            while (/\s/.test(s[j])) j++;
            if (s[j] === '>') { j++; break; }
            if (s.startsWith('/>', j)) { j += 2; break; }
            if (s[j] === '/') { j++; continue; }
            let k = j; while (k < s.length && !/[\s=>/]/.test(s[k])) k++;
            const name = s.slice(j, k).toLowerCase(); j = k;
            while (/\s/.test(s[j])) j++;
            let value = '';
            if (s[j] === '=') {
                j++; while (/\s/.test(s[j])) j++;
                if (s[j] === '"' || s[j] === "'") { const q = s[j], end = s.indexOf(q, j + 1); value = s.slice(j + 1, end < 0 ? s.length : end); j = end < 0 ? s.length : end + 1; }
                else { let e = j; while (e < s.length && !/[\s>]/.test(s[e])) e++; value = s.slice(j, e); j = e; }
            }
            if (name && !(name in attrs)) attrs[name] = decode(value);
        }
        tags.push({ name: m[1].toLowerCase(), attrs });
        i = j;
    }
    return tags;
}
/** 가짜 innerHTML: 태그를 만들고, on… 속성은 상자 안에서 돌린다. 만든 태그 목록을 돌려준다 */
function fakeInnerHTML(html, box) {
    const tags = parseTags(html);
    for (const tag of tags) for (const [name, code] of Object.entries(tag.attrs)) if (name.startsWith('on')) vm.runInContext(code, box);
    return tags;
}
const PROBE = '<img src=x onerror="mark()">';
const ATTR_PROBE = 'x" onfocus="mark()" autofocus="';

/** 원본에서 이름으로 함수 · 상수 한 덩어리를 잘라 온다 (중괄호 짝) */
function slice(source, startText) {
    const start = source.indexOf(startText);
    assert.ok(start >= 0, `원본에서 못 찾음: ${startText}`);
    const first = source.slice(start, source.indexOf('\n', start)).trimEnd();
    if (!first.endsWith('{')) return first;   // 한 줄짜리 (const esc = … ;)
    let depth = 0, i = start + first.length - 1;   // 첫 줄 끝의 { 부터 (매개변수의 { } 는 건너뛰게)
    for (; i < source.length; i++) { if (source[i] === '{') depth++; else if (source[i] === '}' && --depth === 0) break; }
    return source.slice(start, i + 1);
}

// ───────── 1. TTS 확인 창 (실리태번 callGenericPopup 은 글을 정화 없이 innerHTML 로 넣어요) ─────────
await t('TTS 확인 창: 캐릭터 · 목소리 이름 글이 태그로 실행되지 않고 글자로 보여요', async () => {
    const src = read('src/addons/tts/src/ui.js');
    const box = vm.createContext({ hits: 0, shown: [] });
    box.mark = () => { box.hits++; };
    box.callGenericPopup = async (content) => { box.shown.push(content); fakeInnerHTML(content, box); return 1; };
    box.POPUP_TYPE = { CONFIRM: 2 }; box.POPUP_RESULT = { AFFIRMATIVE: 1 };
    vm.runInContext(`${slice(src, 'const esc = (v)')}\n${slice(src, 'async function confirm(msg)')}\nthis.confirm = confirm;`, box);
    // 목소리 이름(외부 목록 · 붙여넣은 JSON)과 캐릭터 이름(모델 출력에서 배운 화자)이 들어가는 두 문장 모양 그대로
    assert.equal(await box.confirm(`「${PROBE}」 목소리를 목록에서 뺄까요?`), true, '확인 결과는 그대로');
    assert.equal(await box.confirm(`OpenAI 목소리 중 캐릭터와 이름이 맞는 게 1명 있어요 (${PROBE}, 하늘).`), true);
    assert.equal(box.hits, 0, '검사 글의 onerror 가 실행됐어요');
    for (const shown of box.shown) assert.ok(!parseTags(shown).some(tag => tag.name === 'img'), `그림 태그가 생겼어요: ${shown}`);
    assert.match(box.shown[0], /「&lt;img src=x onerror=&quot;mark\(\)&quot;&gt;」 목소리를 목록에서 뺄까요\?/, '보이는 글은 원래 글자 그대로');
    // 보통 문장은 모양이 같아요 (이스케이프할 글자가 없으면 그대로)
    await box.confirm('이 채팅의 대화 색을 모두 지울까요?');
    assert.equal(box.shown.at(-1), '이 채팅의 대화 색을 모두 지울까요?');
});
await t('TTS 내 목소리 묻기: 페르소나 이름이 태그로 실행되지 않아요 (실리태번은 페르소나 이름을 거르지 않아요)', async () => {
    const src = read('src/addons/tts/src/player.js');
    const box = vm.createContext({ hits: 0, shown: [], name1: PROBE });
    box.mark = () => { box.hits++; };
    box.callGenericPopup = async (content) => { box.shown.push(content); fakeInnerHTML(content, box); return 0; };
    Object.assign(box, {
        POPUP_TYPE: { TEXT: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 }, USER_AUTO: '@auto',
        settings: () => ({ user_voice: '', extras: 'on' }), getContext: () => ({ name1: box.name1 }),
        toastOnce() {}, personaKnown: () => false, ensureStock: async () => {}, extraEngine: () => 'x', setPersonaAuto() {},
    });
    vm.runInContext(`${slice(src, 'const escHtml = (v)')}\nlet askingPersona = null;\n${slice(src, 'export function askPersonaVoice').replace(/^export /, '')}\nthis.ask = askPersonaVoice;`, box);
    assert.equal(await box.ask(), false, '취소면 false 그대로');
    assert.equal(box.hits, 0, '페르소나 이름의 onerror 가 실행됐어요');
    assert.ok(!parseTags(box.shown[0]).some(tag => tag.name === 'img'), `그림 태그가 생겼어요: ${box.shown[0]}`);
    box.name1 = '레몬';
    await box.ask();
    assert.equal(box.shown.at(-1), '레몬(나) 대사도 자동 목소리로 읽을까요?', '보통 이름은 모양이 같아요');
});

// ───────── 2. 남의 파일 지우기 (실리태번 /api/files/delete 는 user/files 안이면 무엇이든 지워요) ─────────
await t('내 글꼴 「목록에서 지우기」: 받은 스타일 · 가져온 설정의 글꼴 항목이 가리킨 다른 파일은 지우지 않아요', async () => {
    const posts = [];
    const ext = { salty: { customFonts: [
        { id: 'f-1', label: '받은 글꼴', family: "'Salty f1'", group: 'custom', file: '/user/files/notes.txt', shared: true },
        { id: 'f-2', label: '내 글꼴', family: "'Salty f2'", group: 'custom', file: '/user/files/salty-font-1700000000000.woff2' },
        { id: 'f-3', label: '가져온 설정 글꼴', family: "'Salty f3'", group: 'custom', file: '/user/files/backup.png' },
        { id: 'f-4', label: '받은 같은 이름', family: "'Salty f4'", group: 'custom', file: '/user/files/salty-font-1700000000001.woff2', shared: true },
    ] } };
    const saved = { SillyTavern: globalThis.SillyTavern, fetch: globalThis.fetch, localStorage: globalThis.localStorage, document: globalThis.document };
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext, saveSettingsDebounced() {}, getRequestHeaders: () => ({}) }) };
    globalThis.fetch = async (url, init) => { posts.push([url, JSON.parse(init.body)]); return { ok: true }; };
    globalThis.localStorage = { getItem: () => null, setItem() {} };
    globalThis.document = { fonts: { add() {}, delete() {} }, createElement: () => ({ getContext: () => null }) };
    try {
        const fonts = await import(pathToFileURL(path.join(root, 'src/fonts.js')).href);
        assert.equal(fonts.allFonts().filter(f => f.group === 'custom' && !f.unusable).length, 4, '네 항목 모두 목록에 보이는 글꼴(검사를 통과)이에요');
        for (const id of ['f-1', 'f-2', 'f-3', 'f-4']) await fonts.removeCustomFont(id);
        assert.deepEqual(ext.salty.customFonts, [], '목록에서는 넷 다 빠져요');
        assert.deepEqual(posts, [['/api/files/delete', { path: 'user/files/salty-font-1700000000000.woff2' }]], '서버 파일은 이 테마가 올린 내 글꼴 하나만 지워요');
    } finally { Object.assign(globalThis, saved); }
});

await t('장면 소리 · 분위기 음악 파일 바꾸기 · 빼기: 가져온 설정이 가리킨 다른 소리 파일은 지우지 않아요', async () => {
    const ui = await import(pathToFileURL(path.join(root, 'src/scene-sound-ui.js')).href);
    const posts = [];
    const io = { fetch: async (url, init) => { posts.push([url, JSON.parse(init.body)]); return { ok: true }; }, headers: () => ({}) };
    // 가져온 설정의 files 칸은 user/files 안 소리 확장자면 무엇이든 통과해요 (scene-sound-rules.js FILE_URL) — 그 값이 그대로 지우기로 가요
    for (const url of ['/user/files/voice-memo.mp3', 'user/files/other-extension-bgm.ogg', '/user/files/bl-scene-rain-x.mp3', '/user/files/bl-scene-rain-1.mp3.png']) await ui.deleteSceneFile(url, io);
    assert.deepEqual(posts, [], '이 테마가 올린 이름이 아니면 지우지 않아요');
    await ui.deleteSceneFile('/user/files/bl-scene-rain-1700000000000.mp3', io);
    await ui.deleteSceneFile('/user/files/bl-scene-music-sad-1700000000001.ogg', io);
    assert.deepEqual(posts, [['/api/files/delete', { path: 'user/files/bl-scene-rain-1700000000000.mp3' }], ['/api/files/delete', { path: 'user/files/bl-scene-music-sad-1700000000001.ogg' }]], '이 테마가 올린 파일은 그대로 지워요');
});

// ───────── 3. 공유 설정으로 키가 새는 길 ─────────
await t('번역기 백업 가져오기: 프록시 · 커스텀 주소가 든 프리셋은 먼저 묻고, 기본으로 주소를 빼요 (실리태번 프리셋 가져오기와 같게)', async () => {
    const src = read('src/addons/translator/index.js');
    const data = await import(pathToFileURL(path.join(root, 'src/addons/translator/preset-data.js')).href);
    const method = slice(src, 'async importFromJson(file) {');
    const file = { text: async () => JSON.stringify({ version: 1, customPrompts: [], presets: [
        { id: 'p1', name: '받은 프리셋', settings: { llm_provider: 'custom', custom_url: 'https://relay.example.invalid/v1', use_reverse_proxy: true, reverse_proxy_url: 'https://proxy.example.invalid', llm_model: 'm' } },
        { id: 'p2', name: '주소 없는 프리셋', settings: { llm_provider: 'openai', llm_model: 'gpt' } },
    ] }) };
    const run = async (answers) => {
        const box = vm.createContext({
            asked: [], extensionSettings: {}, promptManager: null, saveSettingsDebounced() {}, toastr: { info() {}, error() {}, success() {} },
            POPUP_TYPE: { CONFIRM: 2 }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null },
            defaultSettings: { llm_provider: 'openai', llm_model: '', custom_url: '', use_reverse_proxy: false, reverse_proxy_url: '', reverse_proxy_password: '' },
            ...data, structuredClone,
        });
        box.callGenericPopup = async (text, type, value, options) => { box.asked.push({ text, options }); return answers.shift(); };
        vm.runInContext(`this.owner = { presets: [], updatePresetDropdown() {}, ${method} };`, box);
        await box.owner.importFromJson(file);
        return box;
    };
    // 주소 빼기(첫 단추) → 개수 확인(예)
    let box = await run([1, true]);
    assert.equal(box.asked.length, 2, '주소 확인 창이 먼저 떠요');
    assert.match(box.asked[0].text, /custom_url, use_reverse_proxy, reverse_proxy_url/);
    assert.equal(box.asked[0].options.okButton, '주소 빼고 가져오기');
    const kept = box.extensionSettings.presets;
    assert.equal(kept.length, 2, '프리셋은 다 가져와요');
    for (const field of ['custom_url', 'use_reverse_proxy', 'reverse_proxy_url']) assert.ok(!(field in kept[0].settings), `${field} 가 남았어요`);
    assert.equal(kept[0].settings.llm_model, 'm', '주소 말고 다른 설정은 그대로');
    // 그대로 가져오기(둘째 단추) → 사용자가 고른 대로 남겨요
    box = await run([0, true]);
    assert.equal(box.extensionSettings.presets[0].settings.custom_url, 'https://relay.example.invalid/v1');
    // 취소 · Esc → 아무것도 안 바뀜
    box = await run([null]);
    assert.equal(box.asked.length, 1); assert.equal(box.extensionSettings.presets, undefined);
    // 주소 없는 파일은 예전처럼 개수 확인 하나만
    assert.deepEqual(data.presetEndpointFields([{ id: 'x', name: 'x', settings: { llm_provider: 'openai' } }]), []);
});

console.log(`security-untrusted-text: ${n} passed`);
