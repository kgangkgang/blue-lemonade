// 남의 확장 기능 다리 (1.2.x) — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 가 맞춤 조각 src/ext-compat.js 와 같은 문에서 불러요 · 없으면 파일도 안 받아요).
//   ① 번역 용어집 → 그 확장의 AI 요청: 요청 글에 실제로 나온 이름만 [Glossary] 줄로 시스템 글 끝에 붙여요(번역기와 같은 항목 · 같은 차례).
//      본편 요청에는 그 확장이 「답 끝 상태 줄」을 시킨 턴에만, 최근 메시지에 나온 이름 줄을 따로 한 칸 넣어요(확장 주입 MAIN_PROMPT_KEY).
//   ② 모델 직접 고르기: 사용자가 고른 회사 · 모델이 있으면, 그 확장이 메인 연결로 보내려던 요청을 실리태번 서버의 채팅 완성 창구로 보내요.
//      키는 다루지 않아요 — 실리태번이 저장해 둔 키를 서버가 붙여요. 지금 연결 · 프리셋 · 연결 프로필은 건드리지 않아요.
//      그 확장 칸에서 연결 프로필을 골라 둔 기능은 그 확장의 선택이 먼저예요(우리 모델로 돌리지 않아요).
//   끼어드는 자리는 하나: SillyTavern.getContext() 가 돌려주는 객체의 generateRaw · ConnectionManagerRequestService.sendRequest.
//      · 부른 쪽이 그 확장(호출 스택의 폴더 + 설치 정보)일 때만 손대고, 나머지는 받은 그대로 넘겨요. 그 확장의 파일 · 설정 · 채팅 자료는 읽기만 해요.
//      · 실리태번의 공용 함수 자체는 바꾸지 않아요(getContext 가 매번 새로 만드는 객체에만 꽂아요). 어디서든 어긋나면 원래 함수를 그대로 불러요.
//      · 쓰는 것이 없어지면(용어집 끔 · 모델 안 고름) 감싸개를 걷어요 — 그 위에 다른 감싸개가 얹혀 있으면 쉬기만 해요.
//   감시자 · 타이머 없음: 문서 누름 받기 하나(설정 칸 그리기) + 본편 용어집을 켰을 때 「생성 직전」 사건 하나.
//   설정: extension_settings[BRIDGE_KEY] (칸을 바꿀 때만 생겨요) · 화면: src/ext-bridge-ui.js · 판단: src/ext-bridge-core.js · 시험: tools/tests/ext-bridge-*.mjs
import { getSettings } from './settings.js';
import { addonsEnabled } from './usage-mode.js';
import * as Core from './ext-bridge-core.js';

const MARK = Symbol.for('blue-lemonade.ext-bridge.v1');
const LOG = Symbol.for('st.request-log.v1');   // 요청 로그 이름표(성능 보조 애드온 · 없으면 버려져요)
const OWN = (() => { try { return decodeURIComponent(/\/scripts\/extensions\/third-party\/([^/?#]+)\//.exec(import.meta.url)?.[1] || ''); } catch { return ''; } })();
const SEEN_MS = 10 * 60 * 1000;
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const reasonOf = error => String(error?.cause?.message || error?.message || error || '').replace(/\s+/g, ' ').trim().slice(0, 160);

/** 지금 호출 스택 글(비동기 프레임까지 넉넉히) */
function captureStack() {
    const keep = Error.stackTraceLimit;
    try { if (typeof keep === 'number' && keep < 40) Error.stackTraceLimit = 40; return String(new Error().stack || ''); }
    finally { try { if (typeof keep === 'number') Error.stackTraceLimit = keep; } catch { /* 그대로 */ } }
}

/** 고른 회사 · 모델로 보내요 → 답 글. 멈춤 단추(GENERATION_STOPPED)와 응답 길이에 맞춘 기다림을 걸어요. 기다리다 끊은 요청은 billed 표시(서버가 아직 처리 중일 수 있어요) */
async function sendDirect({ ctx, pick, system, prompt, maxTokens }) {
    const service = ctx?.ChatCompletionService;
    if (typeof service?.processRequest !== 'function') throw new Error('이 실리태번 판에는 직접 보내는 창구가 없어요.');
    const { buildDirectPayload } = await import('./settings-ai-connection.js');
    const messages = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
    let payload;
    try { payload = buildDirectPayload(messages, Core.directConfig(pick), ctx.chatCompletionSettings || {}, maxTokens); }
    catch (error) { throw new Error(/설정 도우미/.test(error?.message) ? '고른 회사나 모델을 쓸 수 없어요. 「모델 직접 고르기」에서 다시 골라 주세요.' : reasonOf(error)); }
    const controller = new AbortController();
    const types = ctx.event_types || ctx.eventTypes || {};
    let stopped = false, late = false;
    const stop = () => { stopped = true; controller.abort(); };
    if (types.GENERATION_STOPPED) ctx.eventSource?.on?.(types.GENERATION_STOPPED, stop);
    const limit = Core.timeoutFor(payload.max_completion_tokens ?? payload.max_tokens);
    const timer = setTimeout(() => { late = true; controller.abort(); }, limit);
    let release = null;
    try { release = globalThis[LOG]?.begin?.({ caller: 'status-ext', purpose: 'other', label: '상태창 확장 AI', user: prompt.slice(0, 200) }); } catch { release = null; }
    try {
        const out = await service.processRequest(payload, {}, true, controller.signal);
        return typeof out === 'string' ? out : String(out?.content ?? '');
    } catch (error) {
        if (stopped) throw Object.assign(new Error('멈췄어요.'), { stopped: true });
        if (late) throw Object.assign(new Error(`${Math.round(limit / 1000)}초 안에 답이 오지 않았어요.`), { billed: true });
        throw error;
    } finally {
        clearTimeout(timer);
        if (types.GENERATION_STOPPED) ctx.eventSource?.removeListener?.(types.GENERATION_STOPPED, stop);
        try { release?.(); } catch { /* 이름표만 */ }
    }
}

/**
 * 다리 하나를 만들어요. 시험은 host(가짜 SillyTavern) · stack(가짜 스택) · direct(가짜 보내기) · theme(가짜 테마 설정)을 넣어요.
 * 돌려주는 것: sync(설정에 맞춰 걸기) · config · update · status · clearMain — 화면(src/ext-bridge-ui.js)이 써요.
 */
export function createBridge({ host = () => globalThis.SillyTavern, stack = captureStack, own = OWN, theme = getSettings, direct = sendDirect, toast = null, now = Date.now, textarea = () => globalThis.document?.getElementById?.('send_textarea')?.value } = {}) {
    const state = { on: false, inner: null, outer: null, mainBound: false, mainSet: false, toastAt: -Infinity, folders: new Map(), seen: new Map(), raws: new WeakMap(), services: new WeakMap(), last: { ext: null, main: null, model: null } };
    const ctx = () => host()?.getContext?.();
    const themeSettings = () => { try { return theme() || {}; } catch { return {}; } };
    const featuresOn = () => addonsEnabled(themeSettings());
    const translatorOn = () => themeSettings().addons?.translator === true;
    const config = () => { try { return Core.readBridge(ctx()?.extensionSettings?.[Core.BRIDGE_KEY]); } catch { return Core.readBridge(null); } };
    const target = c => (isObj(c?.extensionSettings?.[Core.TARGET.module]) ? c.extensionSettings[Core.TARGET.module] : {});
    const entriesOf = c => Core.activeEntries(c?.extensionSettings?.[Core.GLOSSARY_SETTINGS_KEY], c);
    const warn = message => {
        if (now() - state.toastAt < 60000) return;
        state.toastAt = now();
        try { (toast || ((text, title) => globalThis.toastr?.warning?.(text, title)))(message, 'Blue Lemonade'); } catch { /* 알림만 */ }
    };

    /** 그 폴더가 이어 주는 확장인가 — 실리태번이 읽은 설치 정보(manifest)로 한 번만 가려요 */
    function isTarget(folder) {
        if (state.folders.has(folder)) return state.folders.get(folder);
        let hit = false;
        try {
            const read = ctx()?.getExtensionManifest;
            const manifest = typeof read === 'function' ? read(folder) : null;
            hit = manifest ? Core.TARGET.match.test([manifest.display_name, manifest.homePage, manifest.author].join(' ')) : typeof read !== 'function' && Core.TARGET.match.test(folder);
        } catch { hit = false; }
        state.folders.set(folder, hit);
        return hit;
    }
    /**
     * 지금 부른 쪽이 그 확장이면 { folder, slot, fn }, 아니면 null.
     * prompt 를 주면 알아본 기능을 그 본문에 잠깐(10분 · 32개) 적어 두고, 스택으로 못 알아본 같은 본문의 요청(await 뒤 「다시 받기」)에 그 기능을 써요.
     */
    function inspect(prompt) {
        const frames = Core.parseFrames(stack());
        const folder = Core.findTarget(frames, own, isTarget);
        if (!folder) return null;
        let found = Core.slotOf(frames, folder);
        if (typeof prompt === 'string' && prompt) {
            const key = Core.promptKey(prompt);
            const seen = state.seen.get(key);
            if (found.slot) {
                state.seen.delete(key);
                state.seen.set(key, { ...found, at: now() });
                if (state.seen.size > 32) state.seen.delete(state.seen.keys().next().value);
            } else if (seen && now() - seen.at < SEEN_MS) found = { slot: seen.slot, fn: seen.fn };
        }
        return { folder, ...found };
    }

    /** 확장 AI 요청에 붙일 용어집 블록('' = 안 붙임) */
    function extGlossary(c, cfg, call, text) {
        if (!cfg.glossary || !translatorOn()) return '';
        const settings = target(c);
        const kind = Core.glossaryKind({ mode: settings.ssGenLang, slot: call.slot, fn: call.fn, trLang: settings.trLang });
        if (!kind) return '';
        const { block, lines } = Core.extBlock(entriesOf(c), text, { kind, skip: kind === 'tr' ? Core.ruleSources(settings.trRules) : null });
        if (block) state.last.ext = { at: now(), slot: call.slot, kind, lines };
        return block;
    }

    /** 그 확장이 메인 연결로 보내려던 요청 — 용어집을 붙이고, 고른 모델이 있으면 그쪽으로 보내요 */
    async function run(original, self, args, call) {
        const input = args[0];
        const c = ctx();
        const cfg = config();
        let system = typeof input.systemPrompt === 'string' ? input.systemPrompt : '';
        let next = args;
        try {
            const block = extGlossary(c, cfg, call, `${system}\n${input.prompt}`);
            if (block) { system = Core.appendBlock(system, block); next = [{ ...input, systemPrompt: system }, ...args.slice(1)]; }
        } catch { /* 용어집을 못 만들면 받은 글 그대로 */ }
        let pick = null;
        // 그 확장 칸에 연결 프로필이 골라져 있으면 이 요청은 「그 프로필이 안 돼서 메인으로」 온 것 — 사용자가 고른 대로 메인에 둬요
        try { pick = Core.targetHasProfile(target(c), call.slot) ? null : Core.pickFor(cfg, call.slot); } catch { pick = null; }
        if (!pick || input.api || input.jsonSchema || input.prefill) return original.apply(self, next);
        const label = `${pick.provider} · ${Core.modelOf(pick)}`;
        const record = (ok, note = '') => { state.last.model = { at: now(), slot: call.slot, used: pick.slot, label, ok, note }; };
        const maxTokens = Number(input.responseLength) > 0 ? Number(input.responseLength) : Number(c?.chatCompletionSettings?.openai_max_tokens) > 0 ? Number(c.chatCompletionSettings.openai_max_tokens) : 2000;
        let text = '', failure = null;
        try { text = String(await direct({ ctx: c, pick, system, prompt: input.prompt, maxTokens }) ?? ''); }
        catch (error) {
            if (error?.stopped) { record(false, '멈춤'); throw error; }
            // 기다리다 끊음 · 524: 서버가 아직 처리 중일 수 있어요 — 메인으로 다시 보내면 두 번 청구될 수 있어 여기서 끝내요
            if (error?.billed || Core.billedMaybe(reasonOf(error))) { record(false, reasonOf(error)); throw new Error(`블루레몬에이드 직접 연결(${label}): ${reasonOf(error)} 두 번 청구되지 않게 메인 연결로 다시 보내지 않았어요.`); }
            failure = error;
        }
        if (text.trim()) { record(true); return text; }
        const note = failure ? reasonOf(failure) : '빈 답';
        record(false, note);
        // 그 밖의 실패 · 빈 답: 그 확장의 「실패하면 메인 연결로 다시 보내기」 설정을 그대로 따라요
        if (target(c).aiFallbackMain === false) throw new Error(failure ? `블루레몬에이드 직접 연결(${label}) 요청 실패: ${note}` : `블루레몬에이드 직접 연결(${label})이 빈 답을 보냈어요.`);
        if (failure) warn(`${Core.TARGET.name}: 고른 모델(${label})로 보내지 못해 메인 연결로 보냈어요. ${note}`);
        return original.apply(self, next);
    }

    const live = () => state.on && featuresOn();
    function wrapRaw(original) {
        let proxy = state.raws.get(original);
        if (proxy) return proxy;
        proxy = function blBridgeGenerateRaw(...args) {
            let call = null;
            try { if (live() && isObj(args[0]) && typeof args[0].prompt === 'string') call = inspect(args[0].prompt); } catch { call = null; }
            return call ? run(original, this, args, call) : original.apply(this, args);
        };
        proxy[MARK] = true;
        state.raws.set(original, proxy);
        return proxy;
    }
    /** 연결 프로필 길: 프로필은 그 확장이 고른 그대로, 용어집만 붙여요. 원래 클래스는 그대로 두고 그 위에 얹은 객체를 돌려줘요 */
    function wrapService(original) {
        let facade = state.services.get(original);
        if (facade) return facade;
        facade = Object.create(original);
        Object.defineProperty(facade, 'sendRequest', { configurable: true, writable: true, value: function blBridgeSendRequest(...args) {
            let next = args;
            try {
                const cfg = live() ? config() : null;
                const call = cfg?.glossary ? inspect() : null;
                if (call) {
                    const block = extGlossary(ctx(), cfg, call, Core.promptText(args[1]));
                    if (block) { next = [...args]; next[1] = Core.blockIntoPrompt(args[1], block); }
                }
            } catch { next = args; }
            return original.sendRequest.apply(original, next);
        } });
        Object.defineProperty(facade, MARK, { value: true });
        state.services.set(original, facade);
        return facade;
    }
    function dress(c) {
        const raw = c.generateRaw;
        if (typeof raw === 'function' && !raw[MARK]) c.generateRaw = wrapRaw(raw);
        const service = c.ConnectionManagerRequestService;
        if (service && typeof service.sendRequest === 'function' && !service[MARK]) c.ConnectionManagerRequestService = wrapService(service);
    }
    /** getContext 를 한 번만 감싸요 — 성능 보조 애드온의 감싸개와 겹쳐도 되게 이름은 안쪽 함수 것을 그대로 둬요(그쪽이 이름으로 「이미 감쌌나」를 봐요) */
    function installHook() {
        const holder = host();
        if (state.outer) return true;   // 이미 걸려 있어요(맨 바깥이든, 다른 감싸개 아래든)
        if (!holder || typeof holder.getContext !== 'function') return false;
        const inner = holder.getContext;
        const outer = function (...args) {
            const c = inner.apply(this, args);
            if (c && state.on) { try { dress(c); } catch { /* 받은 그대로(문맥 객체가 얼어 있는 판 등) */ } }
            return c;
        };
        try { Object.defineProperty(outer, 'name', { value: inner.name, configurable: true }); } catch { /* 이름 없이 */ }
        outer[MARK] = true;
        holder.getContext = outer;
        state.inner = inner; state.outer = outer;
        return true;
    }
    /** 쓰는 것이 없어지면 걷어요 — 우리 감싸개가 맨 바깥일 때만 원래 함수로 되돌리고, 다른 감싸개가 위에 있으면 그대로 두고 쉬어요 */
    function removeHook() {
        const holder = host();
        if (state.outer && holder && holder.getContext === state.outer) { holder.getContext = state.inner; state.inner = state.outer = null; }
    }

    // ── 본편 요청: 답 끝 상태 줄에 쓸 이름 ─────────────────
    function setMain(c, value, base) {
        if (typeof c?.setExtensionPrompt !== 'function') return;
        c.setExtensionPrompt(Core.MAIN_PROMPT_KEY, value, base?.position ?? 1, base?.depth ?? 1, false, base?.role ?? 0);
        state.mainSet = !!value;
    }
    function onBeforeMain(_type, _options, dryRun) {
        if (dryRun) return;
        try {
            const c = ctx();
            const base = c?.extensionPrompts?.[Core.TARGET.stateKey];
            let value = '', lines = [];
            const settings = target(c);
            // 그 확장이 이번 턴에 「답 끝 상태 줄」을 시켰을 때만(일시정지 · OOC · 사칭이면 그 글이 없어요) · 한국어로 바로 적는 설정일 때만
            if (featuresOn() && config().glossaryMain && translatorOn() && settings.ssGenLang !== 'en' && settings.ssGenLang !== 'enview' && typeof base?.value === 'string' && base.value.includes(Core.TARGET.tag)) {
                const chat = Array.isArray(c.chat) ? c.chat.slice(-Core.MAIN_RECENT) : [];
                const recent = [...chat.map(message => (typeof message?.mes === 'string' ? message.mes : '')), String(textarea() ?? '')].join('\n');
                const shown = [Core.TARGET.stateKey, ...Core.TARGET.sideKeys].map(key => String(c.extensionPrompts?.[key]?.value ?? '')).join('\n');
                ({ block: value, lines } = Core.mainBlock(entriesOf(c), recent, shown));
            }
            if (value || state.mainSet) setMain(c, value, base);
            if (value) state.last.main = { at: now(), lines };
        } catch { /* 본편 요청은 받은 그대로 */ }
    }
    function listenMain() {
        if (state.mainBound) return;
        const c = ctx();
        const name = (c?.event_types || c?.eventTypes)?.GENERATION_AFTER_COMMANDS;
        if (!name || typeof c.eventSource?.on !== 'function') return;
        state.mainBound = true;
        c.eventSource.on(name, onBeforeMain);
        try { c.eventSource.makeLast?.(name, onBeforeMain); } catch { /* 차례는 등록한 대로 */ }   // 그 확장이 이번 턴 상태 글을 정한 뒤에 읽어요
    }
    function clearMain() { if (state.mainSet) { try { setMain(ctx(), '', ctx()?.extensionPrompts?.[Core.TARGET.stateKey]); } catch { /* 다음 생성 때 */ } } }

    /** 설정에 맞춰 걸어요 — 쓰는 것이 없으면 아무것도 걸지 않고, 걸려 있던 것은 걷어요 */
    function sync() {
        const cfg = config();
        const features = featuresOn();
        state.on = features && (cfg.glossary || Core.anyModel(cfg));
        if (state.on) installHook(); else removeHook();
        if (features && cfg.glossaryMain) listenMain(); else clearMain();
        return state.on;
    }
    /** 설정을 바꿔 저장해요(이 열쇠는 처음 바꿀 때 생겨요) */
    function update(mutate) {
        const c = ctx();
        const store = c?.extensionSettings;
        if (!isObj(store)) return config();
        const next = config();
        mutate(next);
        const tidy = Core.readBridge({ [Core.TARGET.id]: next });
        const root = isObj(store[Core.BRIDGE_KEY]) ? store[Core.BRIDGE_KEY] : (store[Core.BRIDGE_KEY] = { v: 1 });
        root[Core.TARGET.id] = { glossary: tidy.glossary, glossaryMain: tidy.glossaryMain, models: Object.fromEntries(Object.entries(tidy.models).filter(([, slot]) => slot.provider)) };
        c.saveSettingsDebounced?.();
        sync();
        return tidy;
    }
    /** 화면에 보일 지금 상태 — owner: 그 확장 칸에 연결 프로필이 골라져 있어 그쪽이 먼저인 칸 */
    function status() {
        const c = ctx();
        const settings = target(c);
        const translator = c?.extensionSettings?.[Core.GLOSSARY_SETTINGS_KEY];
        let count = 0;
        try { count = entriesOf(c).length; } catch { count = 0; }
        const owner = Object.fromEntries(Core.SLOTS.map(([id]) => [id, Core.targetHasProfile(settings, id)]));
        return { features: featuresOn(), addon: translatorOn(), enabled: isObj(translator) ? translator.glossary_enabled !== false : true, count, mode: settings.ssGenLang || 'ko', engine: settings.trEngine || 'llm', trLang: settings.trLang || '', fallback: settings.aiFallbackMain !== false, owner, last: state.last };
    }
    return { sync, config, update, status, clearMain, listenMain, inspect, _state: state };
}

let bridge = null;
let started = false;
let ui = null;
const BLOCK = '[data-bl-bridge]';
/** 그 확장의 설정 칸이 있으면 화면 모듈을 받아 우리 칸을 그려요(이미 있으면 안내 줄 · 목록만 다시) */
function ensureUi(doc) {
    const content = doc.querySelector?.(`${Core.TARGET.root} .inline-drawer-content`);
    if (!content || !bridge) return;
    (ui ||= import('./ext-bridge-ui.js')).then(module => module.mountBridgeUi(doc, bridge)).catch(error => { ui = null; console.warn('[Blue Lemonade] 확장 기능 다리 화면', error); });
}

/** 여러 번 불러도 돼요 — 누름 받기는 한 번, 걸기와 칸 찾기는 부를 때마다 */
export function startExtBridge(doc = globalThis.document) {
    if (!doc?.addEventListener || typeof globalThis.SillyTavern?.getContext !== 'function') return null;
    bridge ||= createBridge();
    if (!started) {
        started = true;
        // 그 확장의 설정 칸 · 확장 서랍 단추를 누를 때 우리 칸이 있는지 다시 봐요(그 확장이 칸을 다시 그렸을 수 있어요) — 문서 단위 누름 하나 · 잡는 단계 · 막지 않아요
        doc.addEventListener('click', event => {
            const target = event.target;
            if (!target?.closest) return;
            if (target.closest(BLOCK)) return;
            if (target.closest(Core.TARGET.root) || target.closest('.drawer-toggle')?.parentElement?.id === 'extensions-settings-button') ensureUi(doc);
        }, true);
        // 본편 용어집은 그 확장이 사건을 다 건 뒤에 걸어야 차례가 맞아요 — 앱이 준비된 다음 한 박자 뒤에
        const late = () => setTimeout(() => { try { bridge.sync(); } catch (error) { console.warn('[Blue Lemonade] 확장 기능 다리', error); } }, 0);
        try {
            const { eventSource, event_types } = globalThis.SillyTavern.getContext();
            if (doc.getElementById('loader') && event_types?.APP_READY) eventSource.once(event_types.APP_READY, late); else late();
        } catch { late(); }
        return bridge;
    }
    try { bridge.sync(); } catch (error) { console.warn('[Blue Lemonade] 확장 기능 다리', error); }
    if (doc.querySelector?.(Core.TARGET.root)?.getClientRects?.().length) ensureUi(doc);
    return bridge;
}
