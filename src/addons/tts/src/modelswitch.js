// TTS — 모델 전환(Blue Lemonade 애드온)에 대사 분석을 스스로 등록 (1.2.3)
//
// 모델 전환의 등록 길: globalThis[Symbol.for('st.model-switch.v1')].register({ id, name, read, apply, sources, settingsKey, path })
// settingsKey · path 를 주면 모델 전환의 자동 찾기가 같은 자리(lemon_voice.analysis)를 두 번 보이지 않는다.
// 모델 전환이 늦게 뜨면(테마가 뒤에 불러짐 · 나중에 켬): APP_READY · 등록 알림(bl:model-switch-targets) · 몇 번의 시간차 시도.
//
// 밖으로: init() · register() · unregister() · target() · read() · apply({ source, model, url })
//
// 1.2.5 읽을 모델(MiniMax '목소리를 만든 모델')과의 관계: 여기 등록하는 건 대사 분석 LLM 하나뿐이고, TTS 합성 모델(providers.minimax.model =
// '고른 모델')은 모델 전환의 대상이 아니다 — 모델 전환의 자동 찾기도 음성 모델(speech-… · 경로의 tts/voice)은 채팅 모델이 아니라며 뺀다
// (blue-lemonade src/addons/modelswitch/discover.js NOT_CHAT_MODEL). 그래서 모드와 상관없이 모델 전환이 TTS 목소리 모델을 바꾸는 일은 없고,
// 모델 전환 쪽에 표시할 것도 없다. 나중에 합성 모델을 등록하게 되면 apply 는 '고른 모델'만 바꾸고, 만든 모델 모드에선 만든 모델을 아는
// 복제 목소리가 그대로 만든 모델로 읽힌다 (고른 모델은 만든 모델을 모르는 목소리의 대체) — 그땐 대상 이름에 그 뜻을 적을 것
import { eventSource, event_types } from '../../../../../../../../script.js';
import { settings, save, KEY } from './settings.js';
import * as stapi from './stapi.js';
import { log } from './log.js';
import { runtimeEnabled } from './runtime.js';

const SYM = Symbol.for('st.model-switch.v1');
const ID = 'tts-analysis';
const RETRY_MS = [1000, 3000, 8000, 20000, 60000];
let joined = null;       // 등록한 레지스트리 (다른 것으로 바뀌면 다시 등록)
let timers = [];
let started = false;
let busy = false;       // 등록 중 — 레지스트리가 register 안에서 바로 'bl:model-switch-targets' 를 보내 우리 듣개가 다시 부르는 것을 막음

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
function cfg() {
    const s = settings();
    if (!isObj(s.analysis)) s.analysis = {};
    return s.analysis;
}

/** 지금 대사 분석이 쓰는 연결 — 실리태번 API 중 선택이면 { source, model, url }, 아니면 { follow } */
export function read() {
    const a = cfg();
    if (a.engine === 'st') return { follow: '지금 연결' };
    if (a.engine !== 'provider') return { follow: 'OpenAI 호환 주소' };
    const source = String(a.provider || '');
    let model = '';
    try { model = stapi.modelOf(a, source); } catch { model = isObj(a.provider_models) ? String(a.provider_models[source] || '') : ''; }
    return { source, model, url: source === 'custom' ? String(a.custom_url || '') : '' };
}

/** 모델 전환이 고른 공급자 · 모델로 바꾼다 (엔진은 실리태번 API 중 선택). 열린 분석 카드는 ui.js 가 다시 그린다 */
export function apply({ source, model, url } = {}) {
    const src = stapi.source(source);
    if (!src) return false;
    const a = cfg();
    a.engine = 'provider';
    a.provider = src.id;
    const pm = isObj(a.provider_models) && !Object.isFrozen(a.provider_models) ? a.provider_models : { ...(isObj(a.provider_models) ? a.provider_models : {}) };
    pm[src.id] = String(model ?? '').trim();
    a.provider_models = pm;
    if (src.id === 'custom' && url && String(url).trim()) a.custom_url = stapi.normUrl(url);
    save();
    try { document.dispatchEvent(new CustomEvent('tts:analysis', { detail: { source: src.id } })); } catch { /* 화면이 없음 (테스트) */ }
    return true;
}

/** 레지스트리에 넘기는 대상 */
export function target() {
    return {
        id: ID,
        name: 'TTS 대사 분석',
        sources: stapi.SOURCES.map(s => s.id),
        settingsKey: KEY,
        path: 'analysis',
        read,
        apply,
    };
}

/** 레지스트리가 있으면 등록 (이미 했으면 그대로) → 등록돼 있나 */
export function register() {
    if (!runtimeEnabled()) return false;
    let reg = null;
    try { reg = globalThis[SYM]; } catch { reg = null; }
    if (!reg || typeof reg.register !== 'function') return false;
    if (joined === reg) return true;
    if (busy) return false;
    busy = true;
    try {
        if (reg.register(target()) !== false) joined = reg;
    } catch (e) { log('err', `모델 전환 등록 실패: ${e.message}`); }
    finally { busy = false; }
    if (joined === reg) stopTimers();
    return joined === reg;
}

/** 등록 빼기 (레지스트리가 unregister 를 가질 때만) */
export function unregister() {
    const reg = joined;
    joined = null;
    stopTimers();
    try { if (reg && typeof reg.unregister === 'function') reg.unregister(ID); } catch { /* 모델 전환이 이미 없음 */ }
}

function stopTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
}

/** 시작: 지금 한 번 · APP_READY · 등록 알림 · 시간차 몇 번 */
export function init() {
    if (started) { register(); return; }
    started = true;
    if (register()) return;
    try { if (event_types && event_types.APP_READY) eventSource.on(event_types.APP_READY, () => register()); } catch { /* 이벤트가 없음 */ }
    try { window.addEventListener('bl:model-switch-targets', () => { if (!joined || joined !== globalThis[SYM]) register(); }); } catch { /* 창이 없음 */ }
    timers = RETRY_MS.map(ms => setTimeout(() => register(), ms));
}

export const _resetForTest = () => { joined = null; started = false; busy = false; stopTimers(); };
