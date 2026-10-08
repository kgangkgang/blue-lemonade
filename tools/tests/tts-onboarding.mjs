// TTS 1.3.8 (테마 5.7.2) — 키를 넣고 첫 대사가 읽히기까지 · 2026-10-08 사용자 제보(ElevenLabs 키를 넣었는데 목소리가 안 들어오고
//   MiniMax 직접 입력 서버(집 PC — 꺼짐)로 가서 「인증 실패」) 검증에서 나온 고침 · 새 기능(도움말 · 말투 칩 · 「나」 자동 · 엔진 고정)의 화면 길
//   node tools/tests/tts-onboarding.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 진짜 ui.js · voices.js · player.js · settings.js · 엔진 모듈에 실리태번 스텁 · 작은 가짜 DOM · 가짜 엔진 서버(fetch). 네트워크 없음 · 키는 모두 가짜.
// 1.3.7 트리(공개 저장소의 지금 판)에는 없는 길이라 그 트리에서는 건너뛴다 (ui._forTest.autoSyncAccounts 가 없으면).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

// ---------- 공유 상태
const T = globalThis.__ttsOnboard = {
    ext: {},
    ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Seraph', characters: [{ name: 'Seraph', avatar: 'seraph.png' }], characterId: 0, groups: [] },
    toasts: [], popups: [], calls: [], scen: {}, answer: null, pending: 0, hidden: false,
};
const G = 'const T = globalThis.__ttsOnboard;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(G + `export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup(content) {
    const text = typeof content === 'string' ? content : String(content && content._html || '');
    T.popups.push(text);
    if (T.hold) await T.hold;
    return T.answer ? T.answer(text) : 1;
}`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

// ---------- 시계 (계정 맞춤 6시간 · 토스트 4초 · 실패 뒤 10분)
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const advance = (ms) => { skew += ms; };

// ---------- localStorage
const LS = new Map();
globalThis.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k), clear: () => LS.clear() };

// ---------- 작은 가짜 DOM (ui.js 가 그린 카드 HTML 을 기록)
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&');
const DOM = { cards: {}, text: {} };
const CARD_RE = /<section class="lv-card[^"]*" data-lv-card="([^"]+)">([\s\S]*?)<\/section>/g;
function noteCards(html) { for (const m of String(html).matchAll(CARD_RE)) DOM.cards[m[1]] = m[0]; }
const PANES = new Set(['#lv_pane_read', '#lv_pane_voices', '#lv_pane_engine', '#lv_pane_data']);
function el(sel, { parse = false } = {}) {
    const cls = new Set();
    const e = {
        sel, _html: '', _text: '', className: '', hidden: false, value: '', disabled: false, dataset: {}, isConnected: true, children: [],
        get innerHTML() { return this._html; },
        set innerHTML(v) { this._html = String(v); noteCards(this._html); },
        get outerHTML() { return this._html; },
        set outerHTML(v) { this._html = String(v); noteCards(this._html); },
        get textContent() { return this._text; },
        set textContent(v) { this._text = String(v); DOM.text[sel] = this._text; },
        classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => { if (on ?? !cls.has(c)) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) },
        setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, getAttribute: () => null,
        querySelector(q) {
            if (!parse) return null;
            if (q === '[name="pid"]') { const m = /name="pid"[^>]*>([\s\S]*?)<\/select>/.exec(this._html); const o = m && /<option value="([^"]*)"/.exec(m[1]); return { value: T.pickPid || (o ? unesc(o[1]) : '') }; }
            this._sub ||= new Map();   // 재생 막대 등: 안쪽 요소도 가짜로 (기록만)
            if (!this._sub.has(q)) this._sub.set(q, el(`${sel} ${q}`, { parse: true }));
            return this._sub.get(q);
        },
        querySelectorAll(q) {
            if (parse && q === 'input:checked') return [...this._html.matchAll(/<input type="checkbox" value="([^"]*)"( checked)?>/g)].filter(m => m[2]).map(m => ({ value: unesc(m[1]) }));
            return [];
        },
        closest: () => null, contains: () => true, focus() {}, scrollIntoView() {}, remove() {}, appendChild() {}, style: { setProperty() {} }, offsetHeight: 44,
        get offsetParent() { return PANES.has(sel) && T.hidden ? null : {}; },
        getBoundingClientRect: () => ({ top: 800, height: 40, left: 0, width: 400 }),
        _on: {}, addEventListener(t, f) { (this._on[t] ||= new Set()).add(f); }, removeEventListener(t, f) { this._on[t]?.delete(f); },
        paused: true, src: '', play() { if (T.playErr) return Promise.reject(T.playErr); this.paused = false; setTimeout(() => { this.paused = true; for (const f of this._on.ended || []) f(); }, 5); return Promise.resolve(); }, pause() { this.paused = true; }, load() {},
        // 설정 창이 보이는가 (T.hidden = 페이지를 열 때처럼 서랍이 닫힘)
        getClientRects: () => (PANES.has(sel) && T.hidden ? [] : [{}]),
        append(...n) { this.textContent = this._text + n.map(x => x.textContent || '').join(''); }, replaceChildren(...n) { this.textContent = n.map(x => x.textContent || '').join(''); },
    };
    return e;
}
const fixed = new Map();
const fixedEl = (sel) => { if (!fixed.has(sel)) fixed.set(sel, el(sel)); return fixed.get(sel); };
const KNOWN = new Set([...PANES, '#lv_test_result', '#lv_balance', '#lv_balance_text', '#lv_key_input', '#lv_atest_result', '#lv_cache_stat', '#lv_test_info', '#lv_stop']);
const handlers = {};
const rootEl = Object.assign(el('#lv_settings .lv-body'), { addEventListener(type, fn) { (handlers[type] ||= []).push(fn); }, querySelector: (q) => docQuery(q), querySelectorAll: () => [] });
function docQuery(q) {
    if (q === '#lv_settings .lv-body') return rootEl;
    if (KNOWN.has(q)) return fixedEl(q);
    const m = /^\[data-lv-card="([^"]+)"\]$/.exec(q);
    if (m) { const e = el(q); e.outerHTML = DOM.cards[m[1]] || ''; Object.defineProperty(e, 'outerHTML', { set(v) { DOM.cards[m[1]] = String(v); }, get() { return DOM.cards[m[1]]; } }); return e; }
    return null;
}
globalThis.document = {
    querySelector: docQuery, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    createElement: (t) => el(`<${t}>`, { parse: true }), createTextNode: (t) => ({ textContent: String(t) }), activeElement: null, body: { append() {}, appendChild() {} }, visibilityState: 'visible',
};
globalThis.CSS = { escape: (s) => String(s) };
const rec = (kind) => (msg) => T.toasts.push({ kind, msg: String(msg) });
globalThis.toastr = { success: rec('success'), warning: rec('warning'), error: rec('error'), info: rec('info') };
class Utter { constructor(t) { this.text = t; } }
const BROWSER_VOICES = [{ voiceURI: 'Google 한국의', name: 'Google 한국의', lang: 'ko-KR' }, { voiceURI: 'Google 日本語', name: 'Google 日本語', lang: 'ja-JP' }];
globalThis.window = {
    toastr: globalThis.toastr, addEventListener() {}, removeEventListener() {}, innerHeight: 900,
    speechSynthesis: { getVoices: () => BROWSER_VOICES, addEventListener() {}, removeEventListener() {}, speak(u) { T.calls.push({ url: 'speechSynthesis.speak', method: 'SPEAK' }); setTimeout(() => u.onend && u.onend(), 5); }, cancel() {}, resume() {}, paused: false, speaking: false },
    SpeechSynthesisUtterance: Utter,
};
globalThis.SpeechSynthesisUtterance = Utter;
globalThis.HTMLElement = class {};

// ---------- 가짜 엔진 서버
const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const AUDIO = () => new Response(new Uint8Array([0xff, 0xf3, 0x44, 0xc4, 1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
const WAV_B64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
const netErr = () => { throw new TypeError('Failed to fetch'); };
const later = (ms, fn) => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, ms));
const EL_CLONED = ['세라프', '릴', '가브리엘', '벨포드', '루시퍼 (Lucifer)'];
const EL_PREMADE = [['Rachel', 'female', 'young'], ['Drew', 'male', 'middle aged'], ['Sarah', 'female', 'young'], ['George', 'male', 'middle aged'], ['Alice', 'female', 'young']];
function elVoices(own, names = EL_CLONED) {
    const v = EL_PREMADE.map(([name, gender, age], i) => ({ voice_id: `el_pre_${i}`, name, category: 'premade', labels: { gender, age }, verified_languages: [] }));
    if (own) names.forEach((name, i) => v.push({ voice_id: `el_clone_${i}`, name, category: 'cloned', labels: {}, verified_languages: [] }));
    return { voices: v };
}
const MM_SYSTEM = ['Korean_SweetGirl', 'Korean_CalmLady', 'Korean_CheerfulBoyfriend', 'Japanese_GentleButler', 'Japanese_KindLady', 'English_Graceful_Lady',
    ...Array.from({ length: 40 }, (_, i) => `English_Voice${i}`), ...Array.from({ length: 30 }, (_, i) => `Korean_Voice${i}`)].map(id => ({ voice_id: id, voice_name: id.split('_').slice(1).join(' ') }));
function azVoices() {
    const out = [];
    const locs = [['en-US', 62], ['zh-CN', 34], ['ko-KR', 9], ['ja-JP', 8], ['fr-FR', 16], ...Array.from({ length: 40 }, (_, i) => [`x${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}-Z${i}`, 3])];
    for (const [loc, n] of locs) for (let k = 0; k < n; k++) out.push({ ShortName: `${loc}-Voice${k}Neural`, LocalName: `V${k}`, DisplayName: `Voice${k}`, Locale: loc, Gender: k % 2 ? 'Male' : 'Female', StyleList: [] });
    return out;
}
function tcVoices(own) {
    const v = Array.from({ length: 40 }, (_, i) => ({ voice_id: `tc_${i}`, voice_name: { kor: `성우${i}`, eng: `Actor${i}` }, gender: i % 2 ? 'male' : 'female', age: 'young_adult', voice_type: 'premium', models: [{ version: 'ssfm-v30' }] }));
    if (own) v.push({ voice_id: 'tc_custom_1', voice_name: '세라프', gender: 'female', age: 'young_adult', voice_type: 'custom', models: [{ version: 'ssfm-v30' }] });
    return v;
}
function caVoices(own) {
    const d = Array.from({ length: 50 }, (_, i) => ({ id: `ca_${i}`, name: `Public ${i}`, language: ['en', 'ko', 'ja'][i % 3], is_owner: false, gender: i % 2 ? 'masculine' : 'feminine' }));
    if (own) d.push({ id: 'ca_own_1', name: '세라프', language: 'ja', is_owner: true, gender: 'feminine' });
    return { data: d, has_more: false };
}
const GATEWAY = 'http://192.0.2.10:8880';   // 문서용 주소 (집 PC 게이트웨이 자리)
function route(c, scen) {
    const u = c.url;
    if (u.startsWith('https://api.elevenlabs.io')) {
        const key = c.headers['xi-api-key'] || '';
        if (u.includes('/v1/user/subscription')) {
            if (/^bad/.test(key)) return later(300, () => J({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }, 401));
            if (scen.subDelay) return later(scen.subDelay, () => J({ character_count: 356, character_limit: 130000, next_character_count_reset_unix: 1760000000, tier: 'creator' }));   // 느린 폰
            return J({ character_count: 356, character_limit: 130000, next_character_count_reset_unix: 1760000000, tier: 'creator' });
        }
        if (u.includes('/v1/voices')) {
            if (scen.elPerm) return J({ detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission voices_read to execute this operation.' } }, 401);
            return J(elVoices(!!scen.own, scen.elNames));
        }
        if (u.includes('/v1/models') && scen.elModelsBad && /^bad/.test(key)) return later(300, () => J({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }, 401));
        if (u.includes('/v1/models')) return J([{ model_id: 'eleven_v4', name: 'Eleven v4', can_do_text_to_speech: true, languages: [{ language_id: 'ko' }, { language_id: 'ja' }] }]);
        if (u.includes('/v1/text-to-speech/')) return AUDIO();
    }
    if (/\/v1\/(get_voice|t2a_v2)$/.test(u)) {
        const custom = !/minimax/.test(u);
        if (custom) {
            if (scen.mmHost === 'down') return netErr();
            if (scen.mmHost === 'auth') return J({ base_resp: { status_code: 1004, status_msg: 'unauthorised (local token)' } });
            if (scen.mmHost === 'home') return J({ base_resp: { status_code: 1004, status_msg: 'unauthorised (not home network)' } });
            if (scen.mmHost === '408') return J({ error: 'timeout' }, 408);
            if (u.endsWith('/get_voice')) return J({ voice_cloning: (scen.gateway || []).map(id => ({ voice_id: id })), system_voice: [], voice_generation: [], base_resp: { status_code: 0 } });
        } else {
            if (scen.mmOfficial === 'down') return netErr();
            if (scen.mmOfficial === 'slow' && u.endsWith('/get_voice')) return later(2500, () => J({ voice_cloning: [], voice_generation: [], system_voice: MM_SYSTEM, base_resp: { status_code: 0 } }));
            if (scen.mmOfficial === 'auth') return J({ base_resp: { status_code: 1004, status_msg: 'invalid api key' } });
        }
        if (u.endsWith('/get_voice')) {
            const b = JSON.parse(c.body || '{}');
            const clones = scen.own ? [{ voice_id: 'my_clone_seraph' }, { voice_id: 'my_clone_lil' }] : [];
            if (b.voice_type === 'voice_cloning') return J({ voice_cloning: clones, base_resp: { status_code: 0 } });
            return J({ voice_cloning: clones, voice_generation: [], system_voice: MM_SYSTEM, base_resp: { status_code: 0 } });
        }
        return J({ data: { audio: 'fff344c4', status: 2 }, extra_info: { usage_characters: 5 }, base_resp: { status_code: 0 } });
    }
    if (u.startsWith('https://api.openai.com/v1')) {
        if (u.endsWith('/models')) return J({ data: [{ id: 'gpt-4o-mini-tts', created: 3 }, { id: 'tts-1', created: 1 }] });
        if (u.endsWith('/audio/speech')) return AUDIO();
    }
    if (u.startsWith('http://127.0.0.1:8880/v1')) {
        if (scen.compat === 'down') return netErr();
        if (u.endsWith('/models')) return J({ data: [{ id: 'kokoro' }] });
        if (u.endsWith('/audio/voices')) return J({ voices: ['af_bella', 'am_adam'] });
        if (u.endsWith('/audio/speech')) return AUDIO();
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta')) {
        if (u.includes(':generateContent')) return J({ candidates: [{ content: { parts: [{ inlineData: { data: WAV_B64, mimeType: 'audio/wav' } }] } }] });
        if (u.includes('/voices')) return J({ error: { code: 404, status: 'NOT_FOUND', message: 'not found' } }, 404);
        if (u.includes('/models?')) return J({ models: [{ name: 'models/gemini-3.8-flash-tts', displayName: 'Gemini 3.8 Flash TTS', supportedGenerationMethods: ['generateContent'] }] });
        if (u.includes('/models/')) return J({ name: 'models/gemini-3.8-flash-tts' });
    }
    if (/\.tts\.speech\.microsoft\.com\//.test(u)) {
        if (u.endsWith('/voices/list')) return J(azVoices());
        if (u.endsWith('/cognitiveservices/v1')) return AUDIO();
    }
    if (u.startsWith('https://api.typecast.ai')) {
        if (u.includes('/v1/users/me/subscription')) return J({ plan: 'free', credits: { used_credits: 0, plan_credits: 30000 } });
        if (u.includes('/v3/voices')) return J(tcVoices(!!scen.own));
        if (u.includes('/v1/text-to-speech')) return AUDIO();
    }
    if (u.startsWith('https://api.cartesia.ai')) {
        if (/\/voices\?limit=1(&|$)/.test(u)) return J({ data: caVoices(!!scen.own).data.slice(0, 1), has_more: true, next_page: 'x' });
        if (u.includes('/voices?')) return J(caVoices(!!scen.own));
        if (u.includes('/usage/credits')) return J({ data: [{ credits: 12 }] });
        if (u.includes('/tts/bytes')) return AUDIO();
    }
    if (u === '/api/google/list-voices') return J({ ko: 'Korean', ja: 'Japanese' });
    if (u === '/api/google/generate-voice') return AUDIO();
    throw new Error(`가짜 서버에 없는 요청: ${c.method} ${u}`);
}
globalThis.fetch = async (url, init = {}) => {
    const c = { url: String(url), method: init.method || 'GET', headers: { ...(init.headers || {}) }, body: init.body, at: realNow() };
    T.calls.push(c);
    T.pending++;
    try {
        if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        return await route(c, T.scen);
    } finally { T.pending--; c.done = realNow(); }
};

// ---------- 모듈
const S = await import(mod('settings.js'));
const V = await import(mod('voices.js'));
const PR = await import(mod('providers/index.js'));
const M = await import(mod('providers/_models.js'));
const player = await import(mod('player.js'));
const ui = await import(mod('ui.js'));
const F = ui._forTest || {};
if (typeof F.autoSyncAccounts !== 'function') {
    console.log('tts-onboarding: 1.3.8 이전 트리 — 건너뜀\n\ntts-onboarding: 0 passed, 0 failed');
    process.exit(0);
}
ui.init();
player.init();
process.on('unhandledRejection', (e) => { T.unhandled = (T.unhandled || 0) + 1; if (T.unhandled < 4) console.error('[unhandled]', String(e?.stack || e).split('\n').slice(0, 3).join(' | ')); });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function settle(max = 8000) {
    const t0 = realNow();
    let quiet = 0;
    while (realNow() - t0 < max) {
        await sleep(20);
        quiet = T.pending ? 0 : quiet + 1;
        if (quiet >= 6) return true;
    }
    return false;
}
/** data-lv-act 단추를 ui.js 의 클릭 처리로 */
async function click(act, data = {}) {
    const attrs = {};
    const b = { dataset: { lvAct: act, ...data }, setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null, attrs };
    for (const fn of handlers.click || []) fn({ target: { closest: () => b }, preventDefault() {} });
    await settle();
    return b;
}
/** select · 입력칸을 ui.js 의 change 처리로 */
async function change(props) {
    const target = Object.assign(Object.create(HTMLElement.prototype), { dataset: {}, type: '', tagName: 'SELECT', value: '', closest: () => null }, props);
    for (const fn of handlers.change || []) fn({ target });
    await settle();
}
function reset(lv = null) {
    try { player.stop(); } catch { /* 쉼 */ }
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    if (lv) T.ext.lemon_voice = JSON.parse(JSON.stringify(lv));
    S.settings().mini_player = false;
    LS.clear();
    try { M.clearModels(); } catch { /* 옛 판 */ }
    T.toasts.length = 0; T.popups.length = 0; T.calls.length = 0; T.answer = null; T.pickPid = ''; T.scen = {}; T.hidden = false; T.hold = null;
    advance(7 * 3600e3);   // 앞 시험의 계정 맞춤 · 잔액 · 토스트 · 실패 쉼 시간을 지나서
    DOM.cards = {}; DOM.text = {};
    return S.settings();
}
const voicesOf = (pid) => S.settings().voices.filter(v => v.provider === pid);
const SYNTH = /t2a_v2|text-to-speech|audio\/speech|:generateContent|cognitiveservices\/v1$|tts\/bytes|generate-voice|speechSynthesis/;
async function saveKey(id, scen = {}, key = 'fake-test-key-0123456789abcdef0123456789abcdef') {
    T.scen = { ...T.scen, ...scen };
    const p = PR.getProvider(id);
    S.settings().ui.provider_tab = id;
    if (p.needsKey) S.providerConfig(id, p.defaults).key = key;
    ui.renderEngine();
    await F.keyTest();
    await settle(12000);
    const job = F.afterKeyJob();
    if (job) await job;
    await settle(4000);
    return DOM.text['#lv_test_result'] || '';
}
/** 한 메시지를 「읽기」로 → { synth: [요청 주소], toasts } */
async function read(mes) {
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ is_user: false, is_system: false, extra: {}, swipe_id: 0, ...mes });
    T.ctx.name2 = mes.name;
    const c0 = T.calls.length, t0 = T.toasts.length;
    advance(10000);
    player.speakMessage(0, { force: true, noWait: true });
    await settle(5000);
    for (let i = 0; i < 200 && player.isPlaying(); i++) await sleep(25);   // 큐 끝까지 (줄 사이 쉼 포함)
    await sleep(80);
    const synth = T.calls.slice(c0).filter(c => SYNTH.test(c.url)).map(c => c.url.replace(/\?.*$/, ''));
    const toasts = T.toasts.slice(t0).map(t => `${t.kind}: ${t.msg}`);
    try { player.stop(); } catch { /* 쉼 */ }
    return { synth, toasts };
}
const host = (u) => (u || '').replace(/^(https?:\/\/[^/]+|speechSynthesis).*$/, '$1');

// ---------- 휴대폰 설정을 닮은 가짜 사용자 (진짜 이름 · 키 · 주소 없음): MiniMax 직접 입력 서버 · 캐릭터 6명 · ElevenLabs 키 없음
const mv = (id, name, lang = 'ja', group = '천지합동청') => ({ uid: `minimax:${id}`, provider: 'minimax', voiceId: id, name, lang, group, aliases: [], params: {}, mix: [], gainDb: 0, autoGainDb: null, model: '', instructions: '', prefer_source: 'auto' });
const USER = {
    version: 8, enabled: true, auto_play: false, pregen: 'off', read_preset: 'dialogue',
    routes: { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' },
    voices: [mv('cj_seraph01', '세라프'), mv('cj_lil01', '릴'), mv('cj_gabriel01', '가브리엘'), mv('cj_belford01', '벨포드'), mv('crk_jinu01', '진우 쿠키', 'ko', '쿠키런: 킹덤'), mv('gi_ayato01', '카미사토 아야토', 'ja', '원신'),
        mv('limbus_a01', '뤼엔', 'ko', '림버스'), mv('limbus_b01', '루치오', 'ko', '림버스')],
    char_map: { Seraph: 'minimax:cj_seraph01', Lil: 'minimax:cj_lil01', Gabriel: 'minimax:cj_gabriel01', Belford: 'minimax:cj_belford01', Lucifer: 'minimax:crk_jinu01', Noel: 'minimax:gi_ayato01' },
    default_voice: '', user_voice: '', narrator_voice: '', prefer_provider: '',
    providers: { minimax: { key: 'fake-gateway-token', host: 'custom', host_custom: GATEWAY, model: 'speech-2.8-hd' } },
    ui: { tab: 'voices', provider_tab: 'minimax' },
    analysis: { enabled: false },
};
const GATEWAY_IDS = ['cj_seraph01', 'cj_lil01', 'cj_gabriel01', 'cj_belford01', 'crk_jinu01', 'gi_ayato01'];

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e.stack || e.message).split('\n').slice(0, 4).join('\n       ')}`); }
}

// ================= 1. 처음 설치 · 키 저장 (matrix G1–G11)
for (const [id, h] of [['elevenlabs', 'https://api.elevenlabs.io'], ['minimax', 'https://api.minimax.io'], ['openai', 'https://api.openai.com'], ['gemini', 'https://generativelanguage.googleapis.com'], ['typecast', 'https://api.typecast.ai'], ['cartesia', 'https://api.cartesia.ai'], ['browser', 'speechSynthesis']]) {
    await test(`처음 설치 · ${id}: 키를 저장(연결 확인)하면 목소리가 들어오고 기본 목소리도 정해져 첫 대사가 읽힘`, async () => {
        reset();
        T.answer = () => 1;
        await saveKey(id, { own: false });
        assert.ok(voicesOf(id).length > 0, `${id} 목소리 없음`);
        assert.ok(S.settings().default_voice, '기본 목소리');
        const r = await read({ name: 'Seraph', mes: '"안녕, 잘 부탁해."' });
        assert.equal(host(r.synth[0]), h, JSON.stringify(r.toasts));
    });
}
await test('처음 설치 · ElevenLabs 복제 목소리: 캐릭터 Lucifer 가 연결 없이도 「루시퍼 (Lucifer)」 · 엔진 기본 목소리는 stock 표시', async () => {
    reset();
    await saveKey('elevenlabs', { own: true });
    assert.equal(V.voiceFor('Lucifer')?.name, '루시퍼 (Lucifer)');
});
await test('Azure 불러오기: 묶음 고르기의 처음 켜짐은 쓰는 언어(한국어)만 — 수백 개를 한꺼번에 넣지 않음', async () => {
    reset();
    T.answer = () => 1;
    await saveKey('azure');
    const n = voicesOf('azure').length;
    assert.ok(n > 0 && n <= 20, `${n}개`);
    assert.ok(voicesOf('azure').every(v => v.stock === true), '계정 목소리가 아닌 줄은 stock');
});
await test('MiniMax 직접 입력(집 PC 게이트웨이 · 켜짐 · 6개만 앎): 목소리 탭을 열어도 나머지를 「계정에 없음」로 숨기지 않고 5.7.1 이 숨긴 표시도 되돌림', async () => {
    const s = reset(USER);
    s.voices.find(v => v.voiceId === 'limbus_a01').gone = true;   // 5.7.1 이 게이트웨이 목록로 숨긴 것
    T.scen = { gateway: GATEWAY_IDS };
    await click('tab', { tab: 'voices' });
    assert.equal(V.hiddenCounts().gone, 0);
    assert.ok(!T.calls.some(c => c.url.startsWith(GATEWAY)), '직접 입력 서버엔 계정 맞춤을 묻지 않음');
});
await test('ElevenLabs 키에 목소리 읽기 권한이 없음: 연결 확인 줄이 까닭을 말함 (연결됨만 보이지 않음)', async () => {
    reset();
    const line = await saveKey('elevenlabs', { own: true, elPerm: true });
    assert.match(line, /권한/, line);
    assert.match(line, /목소리 읽기/);
});
await test('「엔진」=ElevenLabs 인데 그 짝이 계정에서 지워짐: 지운 목소리로 읽지 않음', async () => {
    reset(USER);
    T.answer = () => 1;
    await saveKey('elevenlabs', { own: true, mmHost: 'down' });
    const el = voicesOf('elevenlabs').find(v => v.name === '세라프');
    V.syncAccount('elevenlabs', voicesOf('elevenlabs').filter(v => v !== el).map(v => ({ voiceId: v.voiceId, own: true })));
    assert.ok(el.gone);
    assert.notEqual(V.voiceFor('Seraph')?.uid, el.uid);
});
await test('「엔진」 엔진의 키를 지움: 캐릭터는 자기 목소리로 (모두 키 오류로 멈추지 않음)', async () => {
    reset(USER);
    T.answer = () => 1;
    await saveKey('elevenlabs', { own: true, mmHost: 'down' });
    assert.equal(S.settings().prefer_provider, 'elevenlabs');
    S.providerConfig('elevenlabs', {}).key = '';
    assert.equal(V.voiceFor('Seraph')?.provider, 'minimax');
});
await test('OpenAI 호환 (휴대폰에서 127.0.0.1 닿지 않음): 불러오기가 연결 실패를 말함', async () => {
    reset();
    T.scen = { compat: 'down' };
    S.settings().ui.provider_tab = 'openai_compat';
    ui.renderEngine();
    await click('engine-pull');
    assert.match(T.toasts.map(t => t.msg).join(' | '), /연결/);
});
await test('Typecast 계정의 내 목소리(custom)가 키와 함께 들어옴', async () => {
    reset();
    await saveKey('typecast', { own: true });
    assert.ok(voicesOf('typecast').some(v => v.voiceId === 'tc_custom_1'));
});
await test('키 없이 「계정에서 불러오기」: 키가 필요한 엔진도 「키 없음」로 보이고 엔진 탭에서 고른 엔진이 먼저', async () => {
    reset();
    let picker = '';
    T.answer = (t) => { if (/<select/.test(t)) picker = t; return 1; };
    await click('pull');
    assert.match(picker, /^[\s\S]*?<option value="minimax">MiniMax · 키 없음/);
});
await test('사용자 상황: ElevenLabs 키 저장 → 바꿀까요 → 네 → Seraph 는 ElevenLabs · 짝이 없는 Noel 은 MiniMax', async () => {
    reset(USER);
    T.answer = () => 1;
    await saveKey('elevenlabs', { own: true, mmHost: 'down' });
    assert.equal(V.voiceFor('Seraph')?.provider, 'elevenlabs');
    assert.equal(V.voiceFor('Noel')?.provider, 'minimax');
    assert.equal(T.popups.filter(t => /바꿀까요/.test(t)).length, 1);
});

// ================= 2. 검증에서 나온 고침
async function userOnEl(scen = {}) {
    reset(USER);
    T.answer = () => 1;
    await saveKey('elevenlabs', { own: true, mmHost: 'down', ...scen });
    assert.equal(S.settings().prefer_provider, 'elevenlabs');
}
await test('한 엔진의 키 · 연결 실패가 메시지 전체를 멈추지 않음: MiniMax(게이트웨이 1004) 줄만 건너뛰고 ElevenLabs 줄은 읽음', async () => {
    await userOnEl();
    T.scen.mmHost = 'auth';
    const r = await read({ name: 'Narrator', mes: 'Noel: 「추워.」\nSeraph: 「그래.」\nNoel: 「응.」\nLil: 「네.」' });
    const mm = r.synth.filter(u => u.startsWith(GATEWAY));
    const el = r.synth.filter(u => u.startsWith('https://api.elevenlabs.io'));
    if (mm.length) {   // Noel 줄이 먼저 나오면 한 번 실패하고 그 엔진만 멈춤 (실패 전에 '다음 줄 준비'로 먼저 보낸 것 하나까지)
        assert.ok(mm.length <= 2, `MiniMax 는 실패한 줄 + 미리 보낸 줄까지만 (${mm.length})`);
        assert.equal(r.toasts.filter(t => t.startsWith('error')).length, 1, r.toasts.join(' | '));
        assert.match(r.toasts.join(' | '), /직접 입력 서버가 막았어요/);
    }
    assert.ok(el.length >= 1, `ElevenLabs 줄을 읽음 · ${JSON.stringify(r)}`);
});
await test('직접 입력 서버 메시지: 꺼짐 · 응답 없음(다시 시도 안 함) · 집 밖 막힘 · 공식 서버의 짧은 키 · 옛 설정의 임의 주소도 직접 입력로', async () => {
    const mm = PR.getProvider('minimax');
    const cfg = { key: 'fake-gateway-token', host: 'custom', host_custom: GATEWAY, model: 'speech-2.8-hd' };
    const err = async (scen, c = cfg) => { T.scen = scen; try { await mm.listVoices(c); return null; } catch (e) { return e; } };
    let e = await err({ mmHost: 'down' });
    assert.match(e.message, /연결하지 못했어요/); assert.equal(e.dead, true); assert.equal(e.retry, false);
    e = await err({ mmHost: '408' });
    assert.match(e.message, /응답하지 않아요/); assert.equal(e.retry, false, '꺼진 서버를 두 번 더 기다리지 않음'); assert.equal(e.dead, true);
    e = await err({ mmHost: 'home' });
    assert.match(e.message, /이 네트워크를 막아요/);
    e = await err({ mmHost: 'auth' });
    assert.match(e.message, /토큰이 틀렸거나 집 밖/);
    e = await err({ mmHost: 'down' }, { ...cfg, host: GATEWAY, host_custom: '' });
    assert.match(e.message, /직접 입력 서버/, '옛 설정에 남은 임의 주소');
    e = await err({ mmOfficial: 'auth' }, { key: 'short-token', host: 'https://api.minimax.io' });
    assert.match(e.message, /MiniMax 키가 아니에요/);
    e = await err({ mmOfficial: 'auth' }, { key: 'x'.repeat(60), host: 'https://api.minimax.io' });
    assert.equal(e.message, '인증 실패. API 키를 확인');
    assert.notEqual(e.dead, true);
});
await test('「바꿀까요」: 설정 창이 안 보이면(페이지를 열 때 · 닫힌 서랍) 묻지 않고 미뤘다가 목소리 탭이 보일 때 · 같은 엔진은 한 번에 하나', async () => {
    reset(USER);
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    T.scen = { own: true, mmHost: 'down' };
    T.hidden = true;
    T.answer = () => 1;
    await F.autoSyncAccounts({ force: true });
    await settle();
    assert.equal(T.popups.length, 0, '닫힌 서랍에선 팝업 없음');
    assert.deepEqual(S.settings().prefer_pending, ['elevenlabs']);
    T.hidden = false;
    let release;
    T.hold = new Promise(r => { release = r; });
    const a = F.offerPrefer(PR.getProvider('elevenlabs')), b = F.offerPrefer(PR.getProvider('elevenlabs'));
    F.flushPendingOffer();
    await sleep(30);
    release(); T.hold = null;
    await Promise.all([a, b]);
    assert.equal(T.popups.length, 1, '겹쳐 불러도 팝업 하나');
    assert.deepEqual(S.settings().prefer_pending, []);
    assert.equal(S.settings().prefer_provider, 'elevenlabs');
});
await test('「바꿀까요」에 아니요: 같은 이름들이면 다시 안 물음 · 새 캐릭터가 맞으면 다시 물음 · 페이지를 열 때는 계정 맞춤 요청도 없음', async () => {
    reset(USER);
    T.answer = () => 0;
    await saveKey('elevenlabs', { own: true, mmHost: 'down' });
    assert.equal(T.popups.length, 1);
    assert.equal(S.settings().prefer_provider, '');
    assert.ok(S.settings().prefer_declined.elevenlabs.includes('Seraph'));
    T.popups.length = 0;
    await F.offerPrefer(PR.getProvider('elevenlabs'), { auto: true });
    assert.equal(T.popups.length, 0, '아니요 한 이름뿐');
    S.settings().char_map.Uzziel = 'minimax:limbus_b01';
    S.settings().voices.push({ ...mv('el_uz', '우지엘 (Uzziel)'), uid: 'elevenlabs:el_uz', provider: 'elevenlabs', voiceId: 'el_uz' });
    await F.offerPrefer(PR.getProvider('elevenlabs'), { auto: true });
    assert.equal(T.popups.length, 1, '새 이름(Uzziel)이 있으면 다시');
    T.hidden = true;
    const n0 = T.calls.length;
    advance(7 * 3600e3);
    await click('tab', { tab: 'voices' });
    assert.equal(T.calls.length, n0, '닫힌 서랍에서 목소리 탭을 그려도 요청 없음');
    T.hidden = false;
});
await test('목록에서 지운 ElevenLabs 목소리는 다음 계정 맞춤에서 다시 안 들어옴', async () => {
    await userOnEl();
    const lil = voicesOf('elevenlabs').find(v => v.name === '릴');
    V.removeVoice(lil.uid);
    T.popups.length = 0; T.toasts.length = 0;
    await F.autoSyncAccounts({ force: true, only: 'elevenlabs' });
    assert.ok(!voicesOf('elevenlabs').some(v => v.name === '릴'));
    assert.equal(T.popups.length, 0);
});
await test('「목소리 불러오기」로 들어온 내 목소리도 다른 엔진의 같은 사람에게서 원어 · 묶음을 이어받음 (계정 맞춤 전에 눌러도)', async () => {
    reset(USER);
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    T.scen = { own: true, mmHost: 'down' };
    T.answer = () => 0;
    await F.pullVoices(PR.getProvider('elevenlabs'));
    const ser = voicesOf('elevenlabs').find(v => v.name === '세라프');
    assert.equal(ser.lang, 'ja');
    assert.equal(ser.group, '천지합동청');
    assert.ok(voicesOf('elevenlabs').filter(v => v.stock).length >= 1, '기본 목소리는 stock');
});
await test('계정 맞춤은 엔진마다 따로: 느린 MiniMax(공식) 맞춤 중에 ElevenLabs 연결 확인 → ElevenLabs 목록을 기다리지 않고 받음', async () => {
    const s = reset(USER);
    s.providers.minimax = { key: 'x'.repeat(60), host: 'https://api.minimax.io', model: 'speech-2.8-hd' };
    T.scen = { own: true, mmOfficial: 'slow' };
    const mmJob = F.autoSyncAccounts();
    await sleep(50);
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    S.settings().ui.provider_tab = 'elevenlabs';
    T.answer = () => 0;
    const t0 = realNow();
    await F.autoSyncAccounts({ force: true, only: 'elevenlabs' });
    const elVoicesCall = T.calls.find(c => c.url.startsWith('https://api.elevenlabs.io/v1/voices'));
    const mmCall = T.calls.find(c => c.url.endsWith('/v1/get_voice'));
    assert.ok(elVoicesCall && mmCall);
    assert.ok(realNow() - t0 < 2000, `ElevenLabs 맞춤이 ${realNow() - t0} ms 기다림`);
    assert.ok(!mmCall.done || elVoicesCall.at < mmCall.done, 'MiniMax 가 끝나기 전에 ElevenLabs 목록');
    await mmJob;
});
await test('실패한 계정 맞춤은 10분 쉼 (목소리 탭을 열 때마다 꺼진 서버를 묻지 않음 · 메모리에만)', async () => {
    const s = reset(USER);
    s.providers.minimax = { key: 'x'.repeat(60), host: 'https://api.minimax.io', model: 'speech-2.8-hd' };
    T.scen = { mmOfficial: 'down' };
    const count = () => T.calls.filter(c => c.url.endsWith('/v1/get_voice')).length;
    await F.autoSyncAccounts();
    assert.equal(count(), 1);
    advance(60e3);
    await F.autoSyncAccounts();
    assert.equal(count(), 1, '10분 안에는 다시 안 물음');
    assert.deepEqual(s.account_sync, {}, '설정 파일엔 안 적음 (다른 기기의 맞춤을 막지 않게)');
    advance(11 * 60e3);
    await F.autoSyncAccounts();
    assert.equal(count(), 2);
});
await test('키를 바꿔 다시 저장: 옛 키의 늦은 실패가 새 키의 「연결됨」을 덮지 않음 · 잔액 캐시도 키마다', async () => {
    reset();
    T.answer = () => 0;
    const p = PR.getProvider('elevenlabs');
    S.settings().ui.provider_tab = 'elevenlabs';
    S.providerConfig('elevenlabs', p.defaults).key = 'bad-key-0000000000000000000000';
    ui.renderEngine();
    const first = F.keyTest();
    await sleep(30);
    S.providerConfig('elevenlabs', p.defaults).key = 'good-key-000000000000000000000';
    await F.keyTest();
    await first;
    await settle();
    assert.match(DOM.text['#lv_test_result'] || '', /^연결됨/, DOM.text['#lv_test_result']);
    assert.ok(!T.toasts.some(t => /맞지 않아요/.test(t.msg)));
});
await test('페이지를 열 때(엔진 탭이 안 보임) 잔액을 묻지 않음 · 보이면 물음', async () => {
    reset();
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    S.settings().ui.provider_tab = 'elevenlabs';
    T.hidden = true;
    ui.renderEngine();
    await settle();
    assert.equal(T.calls.filter(c => c.url.includes('/v1/user/subscription')).length, 0);
    T.hidden = false;
    await click('tab', { tab: 'engine' });
    assert.equal(T.calls.filter(c => c.url.includes('/v1/user/subscription')).length, 1);
});
await test('목록 카드: 「계정에 새로 만든 목소리는 저절로 들어와요」는 계정 맞춤이 도는 엔진이 있을 때만', async () => {
    reset(USER);   // MiniMax 직접 입력 서버만 → 계정 맞춤 없음
    ui.renderVoices();
    assert.doesNotMatch(DOM.cards.list || '', /저절로 들어와요/);
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    ui.renderVoices();
    assert.match(DOM.cards.list || '', /저절로 들어와요/);
});

// ================= 3. 새 기능
await test("'?' 도움말: 도움말이 있는 칸은 이름 뒤 ? (aria-expanded) + 숨은 글 · 겉은 div (글을 눌러도 선택칸이 안 열림) · 없는 칸은 1.3.7 그대로", () => {
    reset();
    const el = PR.getProvider('elevenlabs');
    const cfg = S.providerConfig('elevenlabs', el.defaults);
    const stab = el.params.find(f => f.key === 'stability');
    const h = F.control(stab, 'providers.elevenlabs.stability', 0.5, cfg);
    assert.match(h, /^<div class="lv-field lv-range[^"]*" data-lv-help>/);
    assert.match(h, /class="lv-help-btn" data-lv-act="help" aria-label="도움말" aria-expanded="false"/);
    assert.match(h, /<span class="lv-help-note" hidden>보통 0\.5 에서/);
    assert.match(h, /aria-label="안정감"/, '고르는 칸에 이름');
    const seedNo = F.control({ key: 'x', label: '아무거나', type: 'select', options: [{ value: 'a', label: 'A' }] }, 'providers.elevenlabs.x', 'a', cfg);
    assert.match(seedNo, /^<label class="lv-field"><span class="lv-label">아무거나<\/span><select class="text_pole" data-lv-path/);
    assert.doesNotMatch(seedNo, /lv-help/);
    const tg = F.control({ key: 't', label: '켬', type: 'toggle', help: '설명' }, 't', true);
    assert.match(tg, /^<div class="lv-togglebox" data-lv-help><label class="checkbox_label lv-toggle">/);
    const ed = F.edParam(stab, {}, cfg, { params: {} });
    assert.match(ed, /data-lv-help/);
    assert.match(ed, /lv-help-btn/);
    const note = { hidden: true };
    const attrs = {};
    const btn = { closest: (q) => (q === '[data-lv-help]' ? { querySelector: () => note } : null), setAttribute: (k, v) => { attrs[k] = v; } };
    F.toggleHelp(btn);
    assert.equal(note.hidden, false);
    assert.equal(attrs['aria-expanded'], 'true');
    F.toggleHelp(btn);
    assert.equal(note.hidden, true);
    const strength = F.whenFields ? null : null;
    void strength;
});
await test('감정 세기 칸의 ? 에 ElevenLabs 에서 하는 일', () => {
    reset();
    const f = F.readFields('analysis').find(x => x.key === 'emotion_strength');
    const html = F.control(f, 'emotion_strength', 'normal');
    assert.match(html, /lv-help-btn/);
    assert.match(html, /ElevenLabs 는 안정감 1/);
    assert.match(html, /안정감을 0\.3 낮춰/);
});
await test('말투 칩 (엔진 카드): 한국어 이름만 · 누르면 엔진 기본 말투에 넣고 빼기 · 4개까지 · v3 · v4 모델에서만 보임', async () => {
    reset();
    const p = PR.getProvider('elevenlabs');
    const cfg = S.providerConfig('elevenlabs', p.defaults);
    cfg.key = 'fake-el-key-0123456789abcdef';
    cfg.model = 'eleven_v4';
    S.settings().ui.provider_tab = 'elevenlabs';
    ui.renderEngine();
    const card = DOM.cards.engine || '';
    assert.match(card, /data-lv-slot="providers\.elevenlabs\.voice_tags"/);
    assert.match(card, /<button type="button" class="lv-tag-chip" data-lv-act="tag" data-tag="tired" data-path="providers\.elevenlabs\.voice_tags" aria-pressed="false">피곤하게<\/button>/);
    assert.doesNotMatch(card.replace(/data-tag="[a-z]+"/g, ''), />\[?(tired|whispers|sarcastic)\]?</, '영어 태그는 화면에 없음');
    let b = await click('tag', { path: 'providers.elevenlabs.voice_tags', tag: 'tired' });
    assert.deepEqual(cfg.voice_tags, ['tired']);
    assert.equal(b.attrs['aria-pressed'], 'true');
    for (const t of ['distant', 'softly', 'quietly']) await click('tag', { path: 'providers.elevenlabs.voice_tags', tag: t });
    T.toasts.length = 0;
    await click('tag', { path: 'providers.elevenlabs.voice_tags', tag: 'nervous' });
    assert.equal(cfg.voice_tags.length, 4);
    assert.match(T.toasts.map(t => t.msg).join(), /4개까지/);
    for (const t of ['tired', 'distant', 'softly', 'quietly']) b = await click('tag', { path: 'providers.elevenlabs.voice_tags', tag: t });
    assert.equal(cfg.voice_tags, undefined, '다 끄면 칸을 지움 (요청 · 키가 안 고른 것과 같게)');
    cfg.model = 'eleven_multilingual_v2';
    ui.renderEngine();
    assert.doesNotMatch(DOM.cards.engine || '', /lv-tag-chip/);
});
await test('말투 칩 (목소리 편집 · 목록 줄): 기본값을 끄면 이 목소리만 · 목록 줄에 한국어 말투 이름표', () => {
    reset();
    const p = PR.getProvider('elevenlabs');
    const cfg = S.providerConfig('elevenlabs', p.defaults);
    cfg.model = 'eleven_v4';
    const f = p.params.find(x => x.key === 'voice_tags');
    const off = F.edParam(f, {}, cfg, { params: {} });
    assert.match(off, /class="lv-tag-chips lv-param-in"[^>]*aria-disabled="true"/, '기본값이면 칩은 꺼짐');
    const on = F.edParam(f, { voice_tags: ['tired'] }, cfg, { params: { voice_tags: ['tired'] } });
    assert.match(on, /data-tag="tired"[^>]*aria-pressed="true"/);
    const row = F.voiceRowHtml({ uid: 'elevenlabs:x', provider: 'elevenlabs', voiceId: 'x', name: '비서', params: { voice_tags: ['tired', 'distant'] } });
    assert.match(row, /<span class="lv-chip lv-model-chip lv-tag-sum">피곤하게 · 무심하게<\/span>/);
    assert.doesNotMatch(F.voiceRowHtml({ uid: 'minimax:y', provider: 'minimax', voiceId: 'y', name: '다른', params: {} }), /lv-tag-sum/);
});
await test('「나」 자동: 나 줄에 「자동」 · 고르면 @auto 로 저장 · 페르소나는 엑스트라(없으면 기본) 목소리로 읽힘', async () => {
    const s = reset(USER);
    s.default_voice = 'minimax:cj_lil01';
    ui.renderVoices();
    assert.match(DOM.cards.map || '', /data-lv-path="user_voice"><option value="">\(없음\)<\/option><option value="@auto">자동<\/option>/);
    await change({ dataset: { lvPath: 'user_voice' }, value: '@auto' });
    assert.equal(s.user_voice, '@auto');
    ui.renderVoices();
    assert.match(DOM.cards.map || '', /<option value="@auto" selected>자동<\/option>/);
    assert.equal(V.voiceFor('User', { isUser: true })?.uid, 'minimax:cj_lil01', '엑스트라가 아직 없으면 기본 목소리');
    s.extra_map = { User: { g: 'f', a: 'a', l: 'ja', t: 1, v: { minimax: 'limbus_a01' } } };
    assert.equal(V.voiceFor('User', { isUser: true })?.uid, 'minimax:limbus_a01');
    await change({ dataset: { lvPath: 'user_voice' }, value: '' });
    assert.equal(V.voiceFor('User', { isUser: true }), null, '(없음) = 1.3.7 처럼 읽지 않음');
});
await test('엔진 고정: 「엔진」=ElevenLabs 에서도 캐릭터 고르기에 「엔진별」(세라프 · MiniMax / 세라프 · ElevenLabs) · MiniMax 를 고르면 그 캐릭터만 고정 + 칩 · 칩을 누르면 풂', async () => {
    await userOnEl();
    const s = S.settings();
    ui.renderVoices();
    const map = DOM.cards.map || '';
    assert.match(map, /<optgroup label="엔진별"><option value="minimax:cj_seraph01">세라프 · MiniMax<\/option><option value="elevenlabs:el_clone_0" selected>세라프 · ElevenLabs<\/option><\/optgroup>/);
    await change({ dataset: { lvMap: 'Seraph' }, value: 'minimax:cj_seraph01' });
    assert.equal(s.prefer_keep.Seraph, true);
    assert.equal(s.char_map.Seraph, 'minimax:cj_seraph01');
    assert.equal(V.voiceFor('Seraph')?.provider, 'minimax');
    assert.equal(V.voiceFor('Lil')?.provider, 'elevenlabs', '다른 캐릭터는 「엔진」대로');
    ui.renderVoices();
    assert.match(DOM.cards.map || '', /<button type="button" class="lv-pin-chip" data-lv-act="unpin" data-name="Seraph" aria-label="고정 풀기">MiniMax 고정<\/button>/);
    assert.match(DOM.cards.map || '', /<option value="minimax:cj_seraph01" selected>세라프 · MiniMax/);
    await click('unpin', { name: 'Seraph' });
    assert.ok(!s.prefer_keep.Seraph);
    assert.equal(V.voiceFor('Seraph')?.provider, 'elevenlabs');
});
await test('엔진 고정: 「엔진」 엔진의 짝을 다시 고르면 풀리고 연결표는 원래 목소리 · 대화 색 줄도 같이 · 「바꿀까요」 셈에서 빠짐', async () => {
    await userOnEl();
    const s = S.settings();
    s.prefer_keep = { Belford: true };
    const elBel = voicesOf('elevenlabs').find(v => v.name === '벨포드');
    F.setCharVoice('Belford', elBel.uid);
    assert.ok(!s.prefer_keep.Belford);
    assert.equal(s.char_map.Belford, 'minimax:cj_belford01', '연결표는 원래 (MiniMax) 목소리 — 「엔진」을 되돌리면 그것');
    F.setCharVoice('Belford', 'minimax:cj_belford01');
    assert.equal(s.prefer_keep.Belford, true);
    const { moved } = V.previewPrefer('elevenlabs', Object.keys(s.char_map));
    assert.ok(!moved.includes('Belford'));
    s.prefer_provider = '';
    F.setCharVoice('Belford', 'minimax:cj_lil01');
    assert.ok(!s.prefer_keep.Belford, '「엔진」이 없으면 고정 표시 없이 연결표만');
    assert.equal(s.char_map.Belford, 'minimax:cj_lil01');
});
await test('엔진 고정 + 그 엔진이 안 됨: 고정한 캐릭터 줄만 건너뛰고 세션에 한 번 이름을 말함 · 다른 캐릭터 줄은 읽음', async () => {
    await userOnEl();
    const s = S.settings();
    s.prefer_keep = { Seraph: true };
    T.scen.mmHost = 'down';
    const r = await read({ name: 'Narrator', mes: 'Seraph: 「하나.」\nLil: 「둘.」\nSeraph: 「셋.」\nGabriel: 「넷.」' });
    assert.ok(r.synth.filter(u => u.startsWith(GATEWAY)).length <= 2, `MiniMax 는 실패한 줄 + 미리 보낸 줄까지만 (${r.synth.join(', ')})`);
    assert.equal(r.toasts.filter(t => t.startsWith('error')).length, 1, r.toasts.join(' | '));
    assert.ok(r.synth.filter(u => u.startsWith('https://api.elevenlabs.io')).length >= 2, r.synth.join(', '));
    assert.ok(r.toasts.some(t => /Seraph: MiniMax로 고정돼 있어 건너뛰어요/.test(t)), r.toasts.join(' | '));
});
await test('죽은 엔진 안내: 꺼진 직접 입력 서버 줄에 같은 사람이 다른 엔진에 있으면 「엔진」에서 바꿀 수 있다고 한 마디', async () => {
    reset(USER);
    S.providerConfig('elevenlabs', {}).key = 'fake-el-key-0123456789abcdef';
    T.scen = { own: true, mmHost: 'down' };
    T.answer = () => 0;
    await F.pullVoices(PR.getProvider('elevenlabs'));
    const r = await read({ name: 'Seraph', mes: '"안녕."' });
    assert.match(r.toasts.join(' | '), /「엔진」에서 ElevenLabs로 바꿀 수 있어요/);
});

// ================= 4. 1.3.8 리뷰 고침 (blue-lemonade-audit/tts-138-review · tts-138-journey 의 재현을 옮김)
const LOG = await import(mod('log.js'));
/** 스트리밍 읽기: chunks 를 하나씩 붙여 보내고 큐가 빌 때까지 → { mm, el, toasts } */
async function streamRead(chunks, { mesName = 'Narrator' } = {}) {
    const s = S.settings();
    s.auto_play = true; s.stream_read = true; s.wait_translation = 'off';
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ is_user: false, is_system: false, extra: {}, swipe_id: 0, name: mesName, mes: '' });
    T.ctx.name2 = mesName;
    const c0 = T.calls.length, t0 = T.toasts.length;
    let text = '';
    for (const c of chunks) {
        text += c;
        player.onStreamProgress(0, text);
        await settle(3000);
        for (let i = 0; i < 300 && player.isPlaying(); i++) await sleep(20);
    }
    T.ctx.chat[0].mes = text;
    player.onStreamEnd(0);
    await settle(3000);
    for (let i = 0; i < 300 && player.isPlaying(); i++) await sleep(20);
    const synth = T.calls.slice(c0).filter(c => /t2a_v2|text-to-speech/.test(c.url)).map(c => c.url);
    return { mm: synth.filter(u => u.startsWith(GATEWAY)).length, el: synth.filter(u => u.startsWith('https://api.elevenlabs.io')).length, toasts: T.toasts.slice(t0).map(t => `${t.kind}: ${t.msg}`) };
}
await test('스트리밍 읽기: 첫 조각의 MiniMax 줄이 키 오류(게이트웨이 1004)여도 뒤 조각의 ElevenLabs 줄은 읽음 (리뷰 p01)', async () => {
    await userOnEl();
    T.scen.mmHost = 'auth';
    const r = await streamRead(['Noel: 「추워.」\n', 'Seraph: 「그래.」\nLil: 「네.」\n']);
    assert.equal(r.mm, 1, r.toasts.join(' | '));
    assert.equal(r.el, 2, `ElevenLabs 두 줄 · ${r.toasts.join(' | ')}`);
    assert.match(r.toasts.join(' | '), /직접 입력 서버가 막았어요/);
});
await test('스트리밍 읽기: 꺼진 직접 입력 서버는 이 답장 동안 다시 묻지 않음 (조각마다 기다리지 않음) · 끝나면 표를 비움 · 손로 다시 읽으면 다시 시도 (리뷰 p12)', async () => {
    await userOnEl();
    T.scen.mmHost = 'down';
    const r = await streamRead(['Noel: 「하나.」\n', 'Seraph: 「둘.」\n', 'Noel: 「셋.」\n', 'Lil: 「넷.」\n', 'Noel: 「다섯.」\n', 'Gabriel: 「여섯.」\n']);
    assert.equal(r.mm, 1, `Noel 세 줄 중 처음 한 번만 (${r.mm})`);
    assert.equal(r.el, 3);
    assert.equal(player._forTest.streamDead(), null, '스트리밍이 끝나고 큐가 다 끝나면 비움');
    const again = await read({ name: 'Narrator', mes: 'Noel: 「하나.」\nSeraph: 「둘.」' });
    assert.equal(again.synth.filter(u => u.startsWith(GATEWAY)).length, 1, '새로 읽으면 그 엔진도 한 번 다시 시도');
});
await test('지운 목소리: 연결 확인을 다시 해도 저절로 다시 들어오지 않고 지운 표시도 그대로 · 직접 「불러오기」는 넣음 (리뷰 p02)', async () => {
    reset(USER);
    T.answer = () => 0;
    await saveKey('elevenlabs', { own: true });
    assert.equal(voicesOf('elevenlabs').length, 5);
    for (const v of voicesOf('elevenlabs')) V.removeVoice(v.uid);
    const s = S.settings();
    assert.equal(s.account_removed.elevenlabs.length, 5);
    await saveKey('elevenlabs', { own: true });
    assert.equal(voicesOf('elevenlabs').length, 0, voicesOf('elevenlabs').map(v => v.name).join(', '));
    assert.equal(s.account_removed.elevenlabs.length, 5);
    await F.pullVoices(PR.getProvider('elevenlabs'));
    assert.equal(voicesOf('elevenlabs').length, 10, '사용자가 직접 불러오면 다 들어옴');
    assert.equal(s.account_removed.elevenlabs, undefined, '직접 불러오면 지운 표시를 풂');
});
await test('연결 확인 중에 엔진 고르기를 바꿔도 맞는 키면 목소리가 들어옴 (결과 줄만 안 그림 · 리뷰 p07)', async () => {
    reset();
    T.answer = () => 1;
    T.scen = { own: false, subDelay: 300 };
    const s = S.settings();
    s.ui.provider_tab = 'elevenlabs';
    S.providerConfig('elevenlabs', PR.getProvider('elevenlabs').defaults).key = 'fake-test-key-0123456789abcdef0123456789abcdef';
    ui.renderEngine();
    const job = F.keyTest();
    await sleep(40);
    s.ui.provider_tab = 'minimax';
    DOM.text['#lv_test_result'] = '';
    await job;
    const after = F.afterKeyJob();
    if (after) await after;
    await settle();
    assert.equal(voicesOf('elevenlabs').length, 5, '계정의 기본 목소리 5개');
    assert.ok(s.default_voice.startsWith('elevenlabs:'), s.default_voice);
    assert.doesNotMatch(DOM.text['#lv_test_result'] || '', /연결됨/, '다른 엔진 카드에는 결과를 안 그림');
});
await test('「엔진별」: 키 없는 엔진 · 계정에 없는 목소리는 고르게 하지 않고, 골라도 그 엔진로 고정하지 않음 (리뷰 p06)', async () => {
    await userOnEl();
    const s = S.settings();
    delete s.providers.minimax.key;
    ui.renderVoices();
    assert.doesNotMatch(DOM.cards.map || '', /세라프 · MiniMax/, '키 없는 MiniMax 는 엔진별에 없음');
    F.setCharVoice('Seraph', 'minimax:cj_seraph01');
    assert.ok(!s.prefer_keep?.Seraph, '키 없는 엔진로 고정 안 함');
    assert.equal(V.voiceFor('Seraph')?.provider, 'elevenlabs');
    s.providers.minimax.key = 'fake-gateway-token';
    s.char_map.Seraph = 'minimax:cj_seraph01';
    V.findVoice('minimax:cj_lil01').gone = true;
    ui.renderVoices();
    assert.match(DOM.cards.map || '', /세라프 · MiniMax/, '키를 다시 넣으면 엔진별에 다시');
    assert.doesNotMatch(DOM.cards.map || '', /릴 · MiniMax/, '계정에 없는(gone) 목소리는 엔진별에 없음');
});
await test('고정 칩이 있는 캐릭터 줄은 <div> (이름을 눌러도 칩이 눌리지 않음) · select 에 이름표 · 칩 없는 줄은 1.3.7 그대로 <label> (리뷰 rig)', async () => {
    await userOnEl();
    await change({ dataset: { lvMap: 'Seraph' }, value: 'minimax:cj_seraph01' });
    ui.renderVoices();
    const map = DOM.cards.map || '';
    // 1.4.0 목소리 칸은 감정 세기 · 설정 단추와 함께 lv-color-voicebox 안 (줄은 그대로 <div> · select 이름표)
    assert.match(map, /<div class="lv-row"><span class="lv-row-label">Seraph<button type="button" class="lv-pin-chip"[^>]*>MiniMax 고정<\/button><\/span>(?:<span class="lv-color-voicebox">)?<select class="text_pole" data-lv-map="Seraph" aria-label="Seraph 목소리">/);
    if (map.includes('data-lv-strength')) assert.ok(/class="lv-help-note lv-card-help" hidden>[^<]*캐릭터 이름마다/.test(map) && map.includes('· 보통: 대사 분석이 찾은 감정'), '1.4.0 카드 제목 옆 ? 설명 (감정 세기 칸 뜻)');
    if (map.includes('data-lv-strength')) assert.match(map, /data-lv-map="Seraph"[\s\S]*?<\/select><select class="text_pole lv-strength" data-lv-strength="minimax:cj_seraph01"[\s\S]*?data-lv-act="edit" data-uid="minimax:cj_seraph01"/, '고정한 캐릭터는 고정 엔진 목소리에 감정 세기 · 설정');
    for (const m of map.matchAll(/<label class="lv-row">([\s\S]*?)<\/label>/g)) assert.doesNotMatch(m[1], /lv-pin-chip/, '칩은 label 안에 없음');
    assert.match(map, /<label class="lv-row"><span class="lv-row-label">기본<\/span><select class="text_pole" data-lv-path="default_voice">/);
});
await test('「엔진」을 「지정한 그대로」로: 고정은 쉬고 (고정 안내 대신 「엔진」 안내) 다시 켜면 고정이 살아남 (리뷰 p03)', async () => {
    await userOnEl();
    const s = S.settings();
    F.setCharVoice('Seraph', 'minimax:cj_seraph01');
    assert.equal(V.isPinned('Seraph'), true);
    await change({ id: 'lv_prefer_provider', value: '' });
    assert.equal(s.prefer_provider, '');
    assert.equal(V.isPinned('Seraph'), false);
    T.scen.mmHost = 'down';
    const r = await read({ name: 'Seraph', mes: '"안녕."' });
    assert.ok(!r.toasts.some(t => /고정돼 있어/.test(t)), r.toasts.join(' | '));
    assert.match(r.toasts.join(' | '), /「엔진」에서 ElevenLabs로 바꿀 수 있어요/);
    await change({ id: 'lv_prefer_provider', value: 'elevenlabs' });
    assert.equal(V.isPinned('Seraph'), true, '「엔진」을 다시 켜면 고정도');
    assert.equal(V.voiceFor('Seraph')?.provider, 'minimax');
});
await test('미뤄 둔 「바꿀까요」는 엔진마다: ElevenLabs · Typecast 둘 다 물음 · 옛 글 하나(개발판) 설정도 받음 (리뷰 p11)', async () => {
    reset(USER);
    const s = S.settings();
    S.providerConfig('elevenlabs', PR.getProvider('elevenlabs').defaults).key = 'fake-el-key-0123456789abcdef';
    S.providerConfig('typecast', PR.getProvider('typecast').defaults).key = 'fake-tc-key-0123456789abcdef';
    T.scen = { own: true };
    T.answer = () => 0;
    T.hidden = true;
    await F.autoSyncAccounts({ force: true });
    await settle();
    assert.equal(T.popups.length, 0);
    assert.deepEqual([...s.prefer_pending].sort(), ['elevenlabs', 'typecast']);
    T.hidden = false;
    await F.flushPendingOffer();
    await settle();
    const asked = T.popups.filter(t => /바꿀까요/.test(t)).map(t => /^(\S+) 목소리 중/.exec(t)?.[1]).sort();
    assert.deepEqual(asked, ['ElevenLabs', 'Typecast']);
    assert.deepEqual(s.prefer_pending, []);
    const old = reset({ ...USER, prefer_pending: 'elevenlabs' });
    assert.deepEqual(old.prefer_pending, ['elevenlabs'], '옛 글 하나 → 목록');
});
await test('목소리 편집: 지금 모델이 숨긴 말투 칸의 값은 저장해도 지우지 않음 · 그려진 칸의 「기본값」은 지움 (리뷰 p10)', async () => {
    const attr = (tag, a) => { const m = new RegExp(`\\s${a}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
    const shim = () => {
        const e = { _html: '', className: '', addEventListener() {}, set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; } };
        e.querySelector = (q) => {
            const n = /^\[name="([^"]+)"\]$/.exec(q);
            if (!n) return null;
            const sel = new RegExp(`<select[^>]*name="${n[1]}"[^>]*>([\\s\\S]*?)</select>`).exec(e._html);
            if (sel) { const opt = /<option value="([^"]*)" selected/.exec(sel[1]) || /<option value="([^"]*)"/.exec(sel[1]); return { value: opt ? unesc(opt[1]) : '' }; }
            const inp = new RegExp(`<input[^>]*name="${n[1]}"[^>]*>`).exec(e._html);
            return inp ? { value: unesc(attr(inp[0], 'value') ?? '') } : null;
        };
        e.querySelectorAll = (q) => {
            if (q !== '.lv-param') return [];
            return [...e._html.matchAll(/<div class="lv-field lv-param[^"]*" data-key="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="lv-field lv-param|<\/div><div class="lv-sub"|$)/g)].map(([, key, body]) => ({
                dataset: { key },
                querySelector: (q2) => (q2 === '.lv-def-chk' ? { checked: !!T.defAll || /class="lv-def-chk" checked/.test(body) } : q2 === '.lv-param-in' ? {
                    value: '', type: '', checked: false,
                    querySelectorAll: () => [...body.matchAll(/<button type="button" class="lv-tag-chip"[^>]*data-tag="([^"]*)"[^>]*aria-pressed="true"/g)].map(m => ({ dataset: { tag: m[1] } })),
                } : null),
            }));
        };
        return e;
    };
    const realCreate = globalThis.document.createElement;
    globalThis.document.createElement = (t) => (t === 'div' ? shim() : realCreate(t));
    try {
        const ev = { uid: 'elevenlabs:el_bel', provider: 'elevenlabs', voiceId: 'el_bel', name: '벨포드', lang: 'ko', group: '복제', aliases: [], params: { voice_tags: ['tired'], seed: 7 }, mix: [], gainDb: 0, autoGainDb: null, model: '', instructions: '', prefer_source: 'auto' };
        const s = reset({ version: 8, enabled: true, voices: [ev], char_map: { Belford: ev.uid }, providers: { elevenlabs: { key: 'fake-el-key', model: 'eleven_v4' } }, analysis: { enabled: false } });
        T.answer = () => 1;
        await ui.openVoiceEditor(ev.uid);
        assert.deepEqual(V.findVoice(ev.uid).params.voice_tags, ['tired']);
        s.providers.elevenlabs.model = 'eleven_flash_v2_5';
        await ui.openVoiceEditor(ev.uid);
        assert.doesNotMatch(T.popups.at(-1) || '', /data-key="voice_tags"/, '플래시 v2.5 에선 말투 칸이 숨음');
        assert.deepEqual(V.findVoice(ev.uid).params.voice_tags, ['tired'], '숨은 칸의 값은 그대로');
        s.providers.elevenlabs.model = 'eleven_v4';
        T.defAll = true;   // 모든 칸 「기본값」 → 그려진 칸의 값은 지움
        await ui.openVoiceEditor(ev.uid);
        assert.equal(V.findVoice(ev.uid).params.voice_tags, undefined);
        assert.equal(V.findVoice(ev.uid).params.seed, undefined);
    } finally { globalThis.document.createElement = realCreate; T.defAll = false; }
});
await test('목록 줄 말투 칩: 그 목소리의 모델(목소리 모델 포함)이 말투를 안 받으면 안 보임 — 요청과 같은 판단 (리뷰 p09)', () => {
    reset();
    S.providerConfig('elevenlabs', PR.getProvider('elevenlabs').defaults).model = 'eleven_v4';
    const base = { uid: 'elevenlabs:b', provider: 'elevenlabs', voiceId: 'b', name: '비서', params: { voice_tags: ['tired'] } };
    assert.match(F.voiceRowHtml(base), /lv-tag-sum">피곤하게</);
    assert.doesNotMatch(F.voiceRowHtml({ ...base, use_model: 'eleven_multilingual_v2' }), /lv-tag-sum/);
    S.providerConfig('elevenlabs', {}).model = 'eleven_flash_v2_5';
    assert.doesNotMatch(F.voiceRowHtml(base), /lv-tag-sum/);
    assert.match(F.voiceRowHtml({ ...base, use_model: 'eleven_v3' }), /lv-tag-sum">피곤하게</);
});
await test('1.3.7 에 불러온 OpenAI 기본 목소리 nova: stock 표시가 없어도 캐릭터 Nova 의 짝이 아님 · 다시 불러오면 stock 표시 (리뷰 p13)', async () => {
    const legacyNova = { uid: 'openai:nova', provider: 'openai', voiceId: 'nova', name: 'nova', lang: '', group: '기본', aliases: [], params: {}, mix: [], gainDb: 0, autoGainDb: null, model: '', instructions: '', prefer_source: 'auto' };
    reset({ version: 8, enabled: true, voices: [mv('cj_nova01', '노바'), legacyNova], char_map: { Nova: 'minimax:cj_nova01' }, prefer_provider: 'openai',
        providers: { minimax: { key: 'fake-mm-key-0123456789abcdef0123456789abcdef0123' }, openai: { key: 'fake-oa-key' } }, analysis: { enabled: false } });
    assert.equal(V.voiceFor('Nova')?.uid, 'minimax:cj_nova01');
    T.answer = () => 0;
    await F.pullVoices(PR.getProvider('openai'));
    assert.equal(V.findVoice('openai:nova').stock, true);
    assert.equal(V.voiceFor('Nova')?.uid, 'minimax:cj_nova01');
});
await test('「나」 자동 + 「내 대사」 읽지 않음(직접 설정): 자동을 고르면 「내 대사」를 읽게 바꾸고 한 줄 알림 (리뷰 rig)', async () => {
    const s = reset({ ...USER, read_preset: 'custom', routes: { ...USER.routes, user_dialogue: 'skip' } });
    await change({ dataset: { lvPath: 'user_voice' }, value: '@auto' });
    assert.equal(s.user_voice, '@auto');
    assert.equal(s.routes.user_dialogue, 'user');
    assert.ok(T.toasts.some(t => t.msg === '「내 대사」도 읽게 바꿨어요'), JSON.stringify(T.toasts));
    T.toasts.length = 0;
    await change({ dataset: { lvPath: 'user_voice' }, value: 'minimax:cj_seraph01' });
    assert.equal(T.toasts.length, 0, '다른 목소리를 고를 땐 알림 없음');
});
await test('ElevenLabs v3: 원음 유사도 · 화자 강화 칸은 숨음 (v3 에는 없음) · 요청 본문은 1.3.7 그대로 · v4 는 보임 (리뷰 rig)', async () => {
    reset();
    const s = S.settings();
    const p = PR.getProvider('elevenlabs');
    S.providerConfig('elevenlabs', p.defaults).key = 'fake-el-key-0123456789abcdef';
    s.ui.provider_tab = 'elevenlabs';
    s.providers.elevenlabs.model = 'eleven_v3';
    ui.renderEngine();
    assert.doesNotMatch(DOM.cards.engine || '', /providers\.elevenlabs\.similarity_boost|providers\.elevenlabs\.use_speaker_boost/);
    assert.match(DOM.cards.engine || '', /providers\.elevenlabs\.stability/);
    const c0 = T.calls.length;
    await p.synth({ text: '안녕', voice: { voiceId: 'v1' }, cfg: S.providerConfig('elevenlabs', p.defaults), params: {} });
    const body = JSON.parse(T.calls.slice(c0).find(c => c.url.includes('/v1/text-to-speech/')).body);
    assert.deepEqual(body.voice_settings, { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }, '요청은 그대로');
    s.providers.elevenlabs.model = 'eleven_v4';
    ui.renderEngine();
    assert.match(DOM.cards.engine || '', /providers\.elevenlabs\.similarity_boost/);
    assert.match(DOM.cards.engine || '', /providers\.elevenlabs\.use_speaker_boost/);
});
await test('재생 실패(브라우저 NotSupportedError)는 한국어로 · 영어 원문은 기록에만 (리뷰 rig)', async () => {
    reset(USER);
    S.settings().providers.minimax = { key: 'fake-mm-key-0123456789abcdef0123456789abcdef0123', host: 'https://api.minimax.io', model: 'speech-2.8-hd' };
    const e = new Error('Failed to load because no supported source was found.');
    e.name = 'NotSupportedError';
    T.playErr = e;
    LOG.clearLog();
    try {
        const r = await read({ name: 'Seraph', mes: '"안녕."' });
        assert.ok(r.toasts.some(t => /소리를 재생할 수 없어요/.test(t)), r.toasts.join(' | '));
        assert.ok(!r.toasts.some(t => /Failed to load/.test(t)), r.toasts.join(' | '));
        assert.ok(LOG.entries().some(x => /Failed to load/.test(x.msg)), '원문은 기록에');
    } finally { T.playErr = null; }
});
await test('모델 목록: 틀린 키를 저장하고 바로 맞는 키로 바꾸면 옛 키의 실패를 기록하지 않음 (리뷰 rig)', async () => {
    reset();
    T.answer = () => 0;
    T.scen = { elModelsBad: true };
    const p = PR.getProvider('elevenlabs');
    S.settings().ui.provider_tab = 'elevenlabs';
    LOG.clearLog();
    S.providerConfig('elevenlabs', p.defaults).key = 'bad-key-0000000000000000000000';
    ui.renderEngine();
    const first = F.keyTest();
    await sleep(30);
    S.providerConfig('elevenlabs', p.defaults).key = 'good-key-000000000000000000000';
    await F.keyTest();
    await first;
    await settle();
    const bad = LOG.entries().filter(x => /모델 목록 실패/.test(x.msg));
    assert.equal(bad.length, 0, JSON.stringify(bad));
    assert.match(DOM.text['#lv_test_result'] || '', /^연결됨/);
});

await test('1.4.0 이 채팅의 캐릭터 (대화 색 없이): 이름표 · 화자 찾기 · 단역이 줄로 · 카드 캐릭터와 같은 목소리(세라프 = Seraph)는 빼고 · 고르면 연결표에', async () => {
    await userOnEl();
    const s = S.settings();
    const keep = T.ctx.chat.slice();
    T.ctx.chatMetadata.lemon_voice = { colors: {} };
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ name: 'Seraph', is_user: false, is_system: false, swipe_id: 0, extra: {}, mes: '세라프: 「안녕.」\n벨포드: 「네, 서류는 여기.」' });
    T.ctx.chat.push({ name: 'Seraph', is_user: false, is_system: false, swipe_id: 0, mes: '「어서 오세요.」', extra: { lemon_voice: { analysis: { segs: [{ i: 0, speaker: '카페 사장' }], people: { '카페 사장': { g: 'm', a: 'a' } } } } } });
    T.ctx.chat.push({ name: 'User', is_user: true, is_system: false, swipe_id: 0, extra: {}, mes: '나: 「응.」' });
    ui.renderVoices();
    const col = DOM.cards.colors || '';
    assert.match(col, /이 채팅의 캐릭터/);
    assert.match(col, /data-lv-map="벨포드"/, '이름표로 찾은 캐릭터');
    assert.match(col, /data-lv-map="카페 사장"/, '화자 찾기 · 단역');
    assert.doesNotMatch(col, /data-lv-map="세라프"/, '카드 캐릭터(Seraph)와 같은 목소리는 캐릭터별 목소리에 이미 있음');
    assert.doesNotMatch(col, /data-lv-map="나"/, '내 메시지는 보지 않음');
    assert.doesNotMatch(col, /아직 배운 색이 없어요/, '줄이 있으면 빈 안내 대신');
    await change({ dataset: { lvMap: '카페 사장' }, value: 'minimax:cj_seraph01' });
    assert.equal(s.char_map['카페 사장'], 'minimax:cj_seraph01', '고르면 연결표에');
    delete s.char_map['카페 사장'];
    T.ctx.chat.length = 0; T.ctx.chat.push(...keep);
    delete T.ctx.chatMetadata.lemon_voice;
});

console.log(`\ntts-onboarding: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
