// TTS 설정 창: 탭 · 카드 · 스키마 기반 입력칸(data-lv-path) · 목소리 편집 팝업
import { getContext } from '../../../../../../../extensions.js';
import { POPUP_TYPE, POPUP_RESULT, callGenericPopup } from '../../../../../../../popup.js';
import { settings, save, VERSION, DEFAULTS, ANALYSIS_DEFAULTS, READ_PRESETS, maskKey, exportable, applyReadPreset, applyBodyFilters, providerConfig, toVoice, PREGEN_MODES, fillKnownVoices, migrateVoicesV8, fillKnownFacts, hasDb, USER_AUTO } from './settings.js';
import * as player from './player.js';
import * as voices from './voices.js';
import * as speakers from './speakers.js';
import { listProviders, getProvider } from './providers/index.js';
import * as cache from './cache.js';
import * as analysis from './analysis.js';
import * as stapi from './stapi.js';
import * as translation from './translation.js';
import { entries as logEntries, timeStr, onLog, log } from './log.js';
import { paidEngines, paidOnly, pregenPaid } from './paid.js';   // 5.6.4 돈이 드는 엔진 (pregen.js 와 같은 판단)
import { balanceParts, balanceLow, BALANCE_TTL } from './balance.js';   // 1.3.5 엔진 카드 잔액 줄
import * as ttsModels from './providers/_models.js';   // 1.3.7 엔진 모델 목록 (늘 최신 — localStorage 12시간)
import { koModelLabel } from './model-names.js';         // 1.3.7 모델 이름 한국어

const TEST_LINE = { ko: '안녕, 잘 부탁해.', ja: 'こんにちは、よろしくね。', en: 'Hi there, nice to meet you.', zh: '你好，请多关照。' };
const TAB_IDS = ['read', 'voices', 'engine', 'data'];   // 탭 버튼은 settings.html 에 고정
const PRESET_LABEL = {
    dialogue: '대화문만',
    dialogue_narrator: '대화문 + 서술(내레이터)',
    no_action: '*행동* 빼고 전부',
    all: '전부',
    custom: '직접 설정',
};
const ROUTE_OPTS = [
    { value: 'character', label: '캐릭터 목소리' },
    { value: 'narrator', label: '내레이터' },
    { value: 'skip', label: '읽지 않음' },
];

// ---------- 읽기 탭 스키마 (Field 모양은 엔진 모듈과 같다; desc·disabled 는 (settings) => 값 인 함수도 된다)
const isCustom = (s) => s.read_preset === 'custom';
const aEngine = (s) => (s.analysis || {}).engine;
const isCompat = (s) => aEngine(s) !== 'st' && aEngine(s) !== 'provider';          // 모르는 값은 compat (analysis.js 와 같음)
const isProvider = (s) => aEngine(s) === 'provider';
const isCustomProvider = (s) => isProvider(s) && (s.analysis || {}).provider === 'custom';
const hasModelPick = (s) => aEngine(s) !== 'st';
// 대사 분석 엔진: 실리태번 현재 연결 / 실리태번 API 중 선택 (LLM 번역기처럼 공급자·모델을 고름) / OpenAI 호환 (따로 적은 주소·키)
const ENGINE_OPTS = [
    { value: 'st', label: '실리태번 현재 연결' },
    { value: 'provider', label: '실리태번 API 중 선택' },
    { value: 'compat', label: 'OpenAI 호환 (직접 주소·키)' },
];
/** 공급자 목록: 실리태번에 키가 없으면 이름 뒤에 · 키 없음 (본체 리버스 프록시를 따라가면 키 없이도 되니 뺌) */
function providerOptions() {
    return stapi.SOURCES.map(p => ({ value: p.id, label: p.name + (stapi.keyState(p.id) === 'no' && !stapi.hasInheritedProxy(p.id) ? ' · 키 없음' : '') }));
}
/** 번역기 상태 (translation.translatorInfo → { name, incoming, outgoing, label }) → 설정 화면에 보일 한 줄 */
function translatorLabel() {
    try {
        const r = typeof translation.translatorInfo === 'function' ? translation.translatorInfo() : null;
        if (!r || typeof r !== 'object' || !r.name) return '번역기 없음';
        return String(r.label || r.name);
    } catch { return '번역기 없음'; }
}
/**
 * 5.6.3 돈이 드는 엔진(이름 목록) — 등록한 목소리의 엔진 중 무료(브라우저 내장 · Google 번역)와 내 PC · 집 안 주소의 OpenAI 호환 서버를 뺀 것.
 * 사용자 제보: 미리 만들기(대사+속마음)가 답장 · 스와이프마다 모든 줄을 만들어 10월 첫 엿새에 MiniMax 크레딧을 다 씀 — 미리 만든 글의 12 %만 들음.
 * 5.6.4 판단은 paid.js 로 옮김 (pregen.js 도 같이 씀): MiniMax 는 공식 서버일 때만 유료 (집 PC 로컬 게이트웨이 = 무료). 유료 엔진은 기본으로 미리 만들지 않는다
 */
export { paidEngines };
/** 미리 만들기 옆 '!' 를 눌렀을 때의 안내 — 유료 엔진이 없으면 '' (단추도 없음). 5.6.4 '유료 엔진도 미리 만들기' 를 켠 때만 닳는다는 경고 */
function pregenWarn(s) {
    const paid = paidEngines(s);
    if (!paid.length) return '';
    if (!pregenPaid(s)) return `${paid.join(' · ')} 같은 유료 엔진은 미리 만들지 않아요 — 누른 줄만 만들어 크레딧을 아껴요.`;
    let msg = `답장 · 스와이프마다 모든 줄을 미리 만들어 ${paid.join(' · ')} 크레딧이 빨리 닳아요.`;
    const u = s.usage || {};
    const pre = Number(u.pre_chars) || 0, used = Number(u.pre_used_chars) || 0;
    if (pre >= 1000) msg += ` 이번 달 미리 만든 ${pre.toLocaleString('ko-KR')}자 중 ${Math.round(used / pre * 100)} %만 들었어요.`;
    return msg + ' 아끼려면 끔 또는 대사.';
}
/** 미리 만들기 아래 한 줄: 쉬는 까닭 (대사 클릭 · 자동 읽기가 꺼짐 / 5.6.4 목소리가 모두 유료 엔진) */
function pregenDesc(s) {
    if (s.pregen === 'off') return '';
    if (s.click_play === false && !s.auto_play) return '대사 클릭·자동 읽기가 꺼져 쉬어요';
    if (!pregenPaid(s) && paidOnly(s)) return '유료 엔진이라 쉬어요';
    return '';
}
/** 5.6.4 '유료 엔진도 미리 만들기' 스위치: 유료 엔진이 있고 미리 만들기가 켜져 있을 때만 */
const showPregenPaid = (s) => s.pregen !== 'off' && paidEngines(s).length > 0;
/** 새 답장이 번역을 기다리게 되나 — 재생기와 같은 판단(translation.translationExpected)을 새 답장 모양으로 물어본다.
 *  true 면 스트리밍 읽기는 꺼진다 ('켬' 인데 번역기가 없으면 재생기도 안 기다리니 여기서도 false) */
function waitEffective(s) {
    if ((s || settings()).wait_translation === 'off') return false;
    try { return !!translation.translationExpected({ mes: '', is_user: false, is_system: false, extra: {} }); }
    catch { return false; }
}
/** 언제 카드가 그려질 때의 번역기 상태 — 달라졌으면(번역기 자동 번역을 켜고 끔) 카드를 다시 그린다 */
let whenSig = '';
// 5.6.4 유료 판단(MiniMax 서버 주소 · 목소리 엔진)이 바뀌면 '!' 안내 · 스위치 · 쉬는 줄이 달라진다 → 서명에 넣음
const whenSignature = () => { const s = settings(); return `${waitEffective(s)}|${translatorLabel()}|${paidEngines(s).join(',')}|${paidOnly(s)}|${pregenPaid(s)}`; };
function refreshWhenCard() {
    if (root && whenSignature() !== whenSig) renderReadCard('when');
}
const READ_CARDS = {
    parts: ['fa-quote-left', '읽을 부분', [
        { key: 'read_preset', label: '방식', type: 'select', options: () => [...Object.keys(READ_PRESETS), 'custom'].map(k => ({ value: k, label: PRESET_LABEL[k] || k })) },
        { key: 'routes.dialogue', label: '대화문', type: 'select', options: ROUTE_OPTS, show: isCustom },
        { key: 'routes.narration', label: '서술', type: 'select', options: ROUTE_OPTS, show: isCustom },
        { key: 'routes.action', label: '*행동*', type: 'select', options: ROUTE_OPTS, show: isCustom },
        { key: 'routes.thought', label: '속마음', type: 'select', options: ROUTE_OPTS, show: isCustom },
        { key: 'routes.user_dialogue', label: '내 대사', type: 'select', options: [{ value: 'user', label: '내 목소리' }, { value: 'skip', label: '읽지 않음' }], show: isCustom },
        { key: 'no_dialogue_fallback', label: '대화문이 없는 답장', type: 'select', options: [{ value: 'narration', label: '서술 읽기' }, { value: 'skip', label: '읽지 않음' }] },
    ]],
    text: ['fa-font', '본문과 제외할 내용', [
        { key: 'text_source', label: '읽을 글', type: 'select', options: [{ value: 'display', label: '번역문 (있으면)' }, { value: 'original', label: '원문' }] },
        { key: 'max_chars', label: '한 번에 최대 글자', type: 'number', min: 0, max: 50000, step: 100, default: 3000, desc: '0 = 제한 없음' },
        { key: 'emotion_from_tags', label: '대사 태그로 감정', type: 'toggle', desc: '감정 힌트를 살려 읽어요' },
        { key: 'skip_codeblocks', label: '코드 블록 건너뜀', type: 'toggle' },
        { key: 'skip_tags', label: '건너뛸 태그 (내용 포함)', type: 'text', wide: true, desc: '예: status → <status> 안의 글까지 제외해요. 쉼표로 구분해요. 속마음은 읽을 부분 → 직접 설정에서 골라요.' },
        { key: 'pron_dict', label: '발음 사전', type: 'textarea', rows: 3, placeholder: '원래말=읽을말', desc: '읽을 때만 바꿔요 · 한 줄에 하나' },
        { key: 'strip_regex', label: '추가로 지울 글 (정규식)', type: 'textarea', rows: 3, placeholder: '필요할 때만 입력하세요', desc: '일치한 부분만 읽기에서 빼요 · 한 줄에 하나. 태그 자체는 자동 정리하므로 보통 비워 둬요. 태그를 지우는 규칙은 내용 제외·감정 힌트를 방해할 수 있어요. 저장된 채팅은 바꾸지 않아요.' },
    ]],
    click: ['fa-hand-pointer', '대사 클릭', [
        { key: 'click_play', label: '클릭한 대사 읽기', type: 'toggle', desc: '대사·속마음을 누르면 그 줄만 읽어요' },
    ]],
    analysis: ['fa-wand-magic-sparkles', '대사 분석 (감정 · 원어 읽기)', [
        { key: 'analysis.enabled', label: '사용', type: 'toggle' },
        { key: 'analysis.engine', label: '엔진', type: 'select', options: ENGINE_OPTS },
        { key: 'analysis.provider', label: '공급자', type: 'select', options: providerOptions, show: isProvider },
        { key: 'analysis.custom_url', label: '주소', type: 'text', placeholder: '비우면 실리태번 Custom 주소', desc: '실리태번 Custom 키가 이 주소로 가요', show: isCustomProvider },
        { key: 'analysis.base', label: '주소', type: 'text', placeholder: 'https://api.openai.com/v1', show: isCompat },
        { key: 'analysis.key', label: 'API 키', type: 'keyrow', show: isCompat },
        { key: 'analysis.model_pick', label: '모델', type: 'html', html: modelPickHtml, show: hasModelPick },
        { key: 'analysis.emotion', label: '감정 붙이기', type: 'toggle' },
        { key: 'emotion_strength', label: '감정 세기', type: 'select', options: [{ value: 'weak', label: '약하게' }, { value: 'normal', label: '보통' }, { value: 'strong', label: '강하게' }],
            help: '약하게는 감정을 빼고 읽어요 (ElevenLabs 는 안정감 1 로 가장 차분하게 · v3 · v4 는 느낌표를 순하게 바꾸고, 말투를 안 고른 목소리엔 덤덤하게를 붙여요). 강하게는 MiniMax 2.8 이 웃음 · 한숨 같은 소리를 넣고, ElevenLabs 는 감정이 붙은 줄의 안정감을 0.3 낮춰 더 크게 연기해요 (v3 는 0 · 0.5 · 1 로 맞춰 0.5 면 0).' },   // 1.3.8
        { key: 'thought_emotion', label: '속마음', type: 'select', options: [{ value: 'whisper', label: '속삭임' }, { value: 'auto', label: '일반' }] },
        { key: 'analysis.translate', label: '원어로 번역해서 읽기', type: 'toggle' },
        { key: 'analysis.speaker', label: '화자 찾기', type: 'toggle', desc: '색 · 이름표가 없는 대사는 누구 말인지 맥락으로 물어 그 캐릭터 목소리로' },
        { key: 'analysis.when', label: '언제', type: 'select', options: [{ value: 'auto', label: '자동' }, { value: 'manual', label: '수동' }] },
    ], analysisExtra, analysisNote],
    when: ['fa-clock', '언제', [
        { key: 'auto_play', label: '새 답장 자동 읽기', type: 'toggle' },
        { key: 'narrate_user', label: '내 메시지도', type: 'toggle' },
        { key: 'pregen', label: '미리 만들기', type: 'select', options: [{ value: 'off', label: '끔' }, { value: 'dialogue', label: '대사' }, { value: 'all', label: '대사+속마음' }], desc: pregenDesc, warn: pregenWarn },
        { key: 'pregen_paid', label: '유료 엔진도 미리 만들기', type: 'toggle', show: showPregenPaid },   // 5.6.4
        { key: 'wait_translation', label: '번역 기다리기', type: 'select', options: [{ value: 'auto', label: '자동' }, { value: 'on', label: '켬' }, { value: 'off', label: '끔' }], desc: () => translatorLabel() },
        { key: 'translation_timeout', label: '최대 대기 초', type: 'number', min: 5, max: 600, step: 5, default: 90, show: (s) => s.wait_translation !== 'off' },
        { key: 'stream_read', label: '답장이 오는 동안 읽기', type: 'toggle', disabled: waitEffective, desc: (s) => (waitEffective(s) ? '번역을 기다리는 동안엔 꺼져요' : '') },
        { key: 'swipe_read', label: '스와이프하면 읽기', type: 'toggle' },
        { key: 'on_new', label: '읽는 중 새 답장', type: 'select', options: [{ value: 'interrupt', label: '끊고 읽기' }, { value: 'queue', label: '이어서 읽기' }] },
    ]],
    play: ['fa-sliders', '재생', [
        { key: 'playback_rate', label: '배속', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, unit: '×' },
        { key: 'master_volume', label: '볼륨', type: 'range', min: 0, max: 1, step: 0.05, default: 1, fmt: (v) => `${Math.round(Number(v) * 100)}%` },
        { key: 'normalize', label: '음량 고르게', type: 'toggle' },
        { key: 'target_lufs', label: '목표 음량', type: 'range', min: -24, max: -10, step: 1, default: -16, unit: ' LUFS', show: (s) => !!s.normalize },
        { key: 'dethump', label: '쉼 자리 쿵 소리 줄이기', type: 'toggle' },
        { key: 'gap_ms', label: '대사 사이 쉼', type: 'range', min: 0, max: 1000, step: 50, default: 250, unit: ' ms' },
        { key: 'prefetch', label: '다음 줄 준비', type: 'range', min: 0, max: 3, step: 1, default: 2, unit: '개' },
        { key: 'highlight', label: '읽는 대사 강조', type: 'toggle' },
        { key: 'highlight_style', label: '재생 표시', type: 'select', options: [{ value: 'color', label: '색깔만' }, { value: 'both', label: '색깔 + 밑줄' }, { value: 'underline', label: '밑줄만' }], show: (s) => !!s.highlight },
        { key: 'mini_player', label: '재생 막대', type: 'toggle' },
    ]],
};
const CACHE_FIELDS = [
    { key: 'cache_limit', label: '최대 개수', type: 'number', min: 10, max: 5000, step: 10, default: 1000 },
    { key: 'cache_mb', label: '최대 MB', type: 'number', min: 10, max: 2000, step: 10, default: 200 },
];

// ---------- 상태
let root = null;                 // .lv-body
const FIELDS = new Map();        // data-lv-path → Field (숫자 범위·표시 형식용)
const state = { search: '', testLine: '', amodelManual: '', textAdvancedOpen: null };   // amodelManual = 「직접 입력」을 고른 모델 목록 키
const MANUAL = '__lv_manual__';  // 모델 목록의 「직접 입력…」 값
const modelFetches = new Map();  // 모델 목록 키 → 받아 오는 중인 약속
const autoTried = new Set();     // 저절로 받아 본 모델 목록 키 (세션마다 한 번)
let logTimer = 0;

// ---------- 잡동사니
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const q = (sel, el = root || document) => (el ? el.querySelector(sel) : null);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);   // 가져온 JSON 이 프로토타입을 건드리지 못하게
const ENDPOINT_KEYS = new Set(['host', 'host_custom', 'base', 'base_url', 'url', 'endpoint', 'region']);   // 키가 따라가는 주소 항목
const ANALYSIS_ENUMS = { engine: ['compat', 'st', 'provider'], when: ['auto', 'manual'], provider: stapi.SOURCES.map(p => p.id) };   // 설정 가져오기: 대사 분석의 고르는 값
const fmtNum = (n) => Number(n || 0).toLocaleString('ko-KR');
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : 'transparent');
function toast(msg, kind = 'info') {
    if (window.toastr) toastr[kind](msg, 'TTS', { closeButton: false, timeOut: kind === 'error' ? 5000 : 2500 });
}
/** 요술봉 메뉴 설정이 바뀌었다고 알린다 → index.js 가 #lv_wand · #lv_wand_stop 을 넣거나 뺀다 (detail.on: 기본은 켬) */
function dispatchWand() {
    try { document.dispatchEvent(new CustomEvent('tts:wand', { detail: { on: settings().wand_menu !== false } })); }
    catch { /* CustomEvent 가 없으면 다음 시작 때 반영 */ }
}
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
async function confirm(msg) {
    const r = await callGenericPopup(msg, POPUP_TYPE.CONFIRM, '', { okButton: '네', cancelButton: '아니요' });
    return r === POPUP_RESULT.AFFIRMATIVE;
}
function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, val) {
    const ks = path.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
        if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
        o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
}
function providers() {
    try { return (listProviders() || []).map(p => (typeof p === 'string' ? getProvider(p) : p)).filter(Boolean); }
    catch { return []; }
}
const keyField = (p) => (p.fields || []).find(f => f.type === 'password') || (p.needsKey ? { key: 'key', label: 'API 키', type: 'password' } : null);
/** 저장된 키 표시: 짧은 키는 앞뒤를 보여 주면 통째로 드러나니 *** 로 */
const shownKey = (k) => (String(k || '').length >= 12 ? maskKey(k) : '***');
/** 쓸 준비가 됐나: 키가 꼭 필요한 엔진만 키를 본다 (OpenAI 호환처럼 키가 선택인 엔진은 늘 준비됨) */
function hasKey(p) {
    if (!p.needsKey) return true;
    const kf = keyField(p);
    return !kf || !!providerConfig(p.id, p.defaults)[kf.key];
}
/** 내 컴퓨터·내 네트워크 주소인가 (http:// 라도 키가 밖으로 새지 않는 곳) */
function isLocalHost(host) {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
    return !h || h === 'localhost' || h === '::1' || /\.(local|localhost|test)$/.test(h)
        || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0$)/.test(h);
}
/** http:// 로 바깥 서버에 가는 주소인가 (키가 암호화 없이 간다) */
function cleartextRemote(u) {
    u = String(u || '').trim();
    if (!/^http:\/\//i.test(u)) return false;
    let host = '';
    try { host = new URL(u).hostname; } catch { host = ''; }
    return !isLocalHost(host);
}
const cleartextWarned = new Set();   // 엔진 id — 세션마다 한 번만 알림
/** 키가 저장된 엔진의 주소가 http:// 바깥 서버면 키가 암호화 없이 간다 → 한 번 알림 */
function warnCleartext(p) {
    if (!p || cleartextWarned.has(p.id)) return;
    const kf = keyField(p);
    const cfg = providerConfig(p.id, p.defaults);
    if (!kf || !cfg[kf.key]) return;
    for (const k of ENDPOINT_KEYS) {
        if (!cleartextRemote(cfg[k])) continue;
        cleartextWarned.add(p.id);
        toast(`${p.name} 주소가 http:// 라 키가 암호화 없이 가요`, 'warning');
        return;
    }
}
/** 대사 분석 설정 객체 (settings.js 가 기본값을 채우지만, 없어도 화면이 죽지 않게) */
function analysisCfg() {
    const s = settings();
    if (!isObj(s.analysis)) s.analysis = {};
    return s.analysis;
}
function warnAnalysisCleartext() {
    const a = analysisCfg();
    if (cleartextWarned.has('analysis') || !a.key || !cleartextRemote(a.base)) return;
    cleartextWarned.add('analysis');
    toast('대사 분석 주소가 http:// 라 키가 암호화 없이 가요', 'warning');
}
function curProvider() {
    const s = settings();
    const list = providers();
    return list.find(p => p.id === s.ui.provider_tab) || list[0] || null;
}
/** 이 채팅의 캐릭터 이름들 (그룹이면 모두) */
function chatNames() {
    const ctx = getContext();
    const out = [];
    if (ctx.groupId) {
        const g = (ctx.groups || []).find(x => x.id == ctx.groupId);
        for (const avatar of (g && g.members) || []) {
            const c = (ctx.characters || []).find(x => x.avatar === avatar);
            if (c && c.name) out.push(c.name);
        }
    } else {
        const c = ctx.characters && ctx.characters[ctx.characterId];
        const n = (c && c.name) || ctx.name2;
        if (n) out.push(n);
    }
    return [...new Set(out)];
}

// ---------- 스키마 → 입력칸 (data-lv-path 로 설정에 묶인다)
/** 선택지 목록. 엔진은 (cfg, voice) 를 받아 목소리별 목록을 줄 수 있다 (Azure 말투 = 그 목소리의 StyleList) */
function optionsOf(f, cfg, voice) {
    const o = typeof f.options === 'function' ? f.options(cfg, voice) : f.options;
    return Array.isArray(o) ? o : [];
}
function fmtRange(f, v) {
    if (typeof f.fmt === 'function') return f.fmt(v);
    const n = Number(v) || 0;
    const step = Number(f.step) || 1;
    const dec = step >= 1 ? 0 : Math.min(3, (String(step).split('.')[1] || '').length);
    return `${n.toFixed(dec)}${f.unit || ''}`;
}
function numAttrs(f) {
    return ['min', 'max', 'step'].filter(k => f[k] !== undefined).map(k => ` ${k}="${esc(f[k])}"`).join('');
}
/** select 의 <option> 들. 저장값이 목록에 없으면(가져온 설정·다른 모델명) 빈 칸 대신 그 값을 그대로 보여 준다 */
function optionsHtml(f, value, cfg, voice) {
    const list = optionsOf(f, cfg, voice);
    const cur = String(value ?? '');
    const extra = cur && !list.some(o => String(o.value) === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '';
    return extra + list.map(o => `<option value="${esc(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}
const descOf = (f) => (typeof f.desc === 'function' ? f.desc(settings()) : f.desc);
const isOff = (f) => (typeof f.disabled === 'function' ? !!f.disabled(settings()) : !!f.disabled);
// ---------- 1.3.8 '?' 도움말: 항목에 help 가 있으면 이름 바로 뒤 작은 ? — 누르면 아래에 한두 줄 (말풍선 없음 · '!' 와 같은 펼침).
//   도움말이 있는 칸은 겉을 label 이 아닌 div 로 (펼친 글을 눌러도 선택칸이 열리지 않게) · 고르는 칸엔 aria-label 로 이름
const helpOf = (f) => (f && f.help ? String(typeof f.help === 'function' ? f.help(settings()) : f.help) : '');
const helpBtn = (f) => (helpOf(f) ? '<button type="button" class="lv-help-btn" data-lv-act="help" aria-label="도움말" aria-expanded="false"><i class="fa-solid fa-circle-question" aria-hidden="true"></i></button>' : '');
const helpNote = (f) => { const h = helpOf(f); return h ? `<span class="lv-help-note" hidden>${esc(h)}</span>` : ''; };
/** ? 를 눌렀을 때: 같은 칸(data-lv-help)의 도움말 글을 펴고 접는다 (설정 창 · 목소리 편집 팝업 같이) */
function toggleHelp(b) {
    const note = (b.closest('[data-lv-help]') || b.closest('.lv-card'))?.querySelector('.lv-help-note');   // 1.4.0 카드 제목 옆 ? 는 그 카드의 첫 설명
    if (!note) return;
    note.hidden = !note.hidden;
    b.setAttribute('aria-expanded', String(!note.hidden));
}
// ---------- 1.3.8 'tags' 항목 (여러 개 고르기 — ElevenLabs 말투): 한국어 이름 칩 (aria-pressed). 값 = 고른 value 배열 (4개까지)
const TAG_MAX = 4;
const tagList = (v) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map(x => x.trim()).filter(Boolean) : []);
function tagChipsHtml(f, value, { path = '', disabled = false, cfg = null, voice = null } = {}) {
    const on = new Set(tagList(value));
    const chips = optionsOf(f, cfg, voice).map(o => `<button type="button" class="lv-tag-chip" data-lv-act="tag" data-tag="${esc(o.value)}"${path ? ` data-path="${esc(path)}"` : ''} aria-pressed="${on.has(String(o.value)) ? 'true' : 'false'}"${disabled ? ' disabled' : ''}>${esc(o.label)}</button>`).join('');
    return `<div class="lv-tag-chips${path ? '' : ' lv-param-in'}" role="group" aria-label="${esc(f.label)}"${disabled ? ' aria-disabled="true"' : ''}>${chips}</div>`;
}
/** Field 하나 → HTML. path 는 settings() 안의 점 경로, cfg 는 엔진 설정(엔진 탭일 때) */
function control(f, path, value, cfg = null) {
    FIELDS.set(path, f);
    const attr = `data-lv-path="${esc(path)}"`;
    const d = descOf(f);
    const desc = d ? `<span class="lv-desc">${esc(d)}</span>` : '';
    // 주소·모델 ID·자유 입력은 길어질 수 있어 전체 폭, 짧은 수치·선택·스위치는 두 칸을 쓴다.
    const wide = f.wide || ['textarea', 'text', 'tags'].includes(f.type) || /(?:^|\.)(?:host|model|model_from|provider|engine)$/.test(path) ? ' lv-wide' : '';
    const help = helpBtn(f), hnote = helpNote(f);
    const box = hnote ? 'div' : 'label';                                   // 1.3.8 도움말이 있으면 겉은 div
    const hattr = hnote ? ' data-lv-help' : '';                             // 겉 div 의 표시 (칸 이름은 고르는 칸의 aria-label)
    const named = hnote ? `${attr} aria-label="${esc(f.label)}"` : attr;
    const label = hnote ? `<span class="lv-label lv-label-warn">${esc(f.label)}${help}</span>` : `<span class="lv-label">${esc(f.label)}</span>`;
    switch (f.type) {
        case 'toggle': {
            const off = isOff(f);
            // 설명이 있으면 lv-has-desc: 설명을 이름 아래 제 줄로 내린다 (좁은 두 칸 격자에서 이름 옆에 끼어 여러 줄로 부서지지 않게)
            const tg = `<label class="checkbox_label lv-toggle${desc ? ' lv-has-desc' : ''}${off ? ' lv-off' : ''}"><input type="checkbox" ${attr}${value ? ' checked' : ''}${off ? ' disabled' : ''}><span>${esc(f.label)}</span>${help}${desc}</label>`;
            return hnote ? `<div class="lv-togglebox" data-lv-help>${tg}${hnote}</div>` : tg;
        }
        case 'tags':
            // 1.3.8 말투 칩 (엔진 기본값 — 목소리 편집에서 목소리마다 따로). 자리 표시는 data-lv-slot (visibleChanged 가 셈)
            return `<div class="lv-field lv-wide lv-tagsrow" data-lv-slot="${esc(path)}"${hnote ? ' data-lv-help' : ''}>${hnote ? label : `<span class="lv-label">${esc(f.label)}</span>`}${tagChipsHtml(f, value, { path, cfg })}${desc}${hnote}</div>`;
        case 'keyrow':
            // 대사 분석 키 줄: 값은 data-lv-path 로 묶지 않는다 (키를 화면에 두지 않으려고). 자리 표시는 data-lv-slot (visibleChanged 가 센다)
            return `<div class="lv-field lv-wide lv-keyrow" data-lv-slot="${esc(path)}">${label}<div class="lv-key"><input type="password" class="text_pole" id="lv_akey_input" placeholder="${esc(f.placeholder || 'API 키')}" autocomplete="off"><button type="button" class="menu_button" data-lv-act="akey-save">저장</button><button type="button" class="menu_button" data-lv-act="akey-test">연결 확인</button></div>`
                + `<div class="lv-key-state"><span>${value ? `저장됨 ${esc(shownKey(value))}` : '키 없음'}</span>${value ? '<button type="button" class="lv-x" data-lv-act="akey-clear" aria-label="키 지우기"><i class="fa-solid fa-xmark"></i></button>' : ''}</div><div class="lv-test-result" id="lv_atest_result"></div></div>`;
        case 'select': {
            // 5.6.3 warn: 이름 옆 '!' — 누르면 아래에 안내 한 줄 (말풍선 대신 펼침)
            const w = typeof f.warn === 'function' ? f.warn(settings()) : '';
            const head = w ? `<span class="lv-label lv-label-warn">${esc(f.label)}<button type="button" class="lv-warn-btn" data-lv-act="warn" aria-label="크레딧 주의" aria-expanded="false"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i></button>${help}</span>` : label;
            const note = w ? `<span class="lv-warn-note" hidden>${esc(w)}</span>` : '';
            // 1.3.7 엔진 모델: 목록을 받아 오는 엔진이면 옆에 ↻ (모든 엔진이 같은 길 — 엔진은 listModels 만 주면 됨)
            const mp = listingProvider(path);
            if (mp) return `<div class="lv-field lv-wide lv-modelrow"${hnote ? ' data-lv-help' : ''}>${head}<div class="lv-model"><select class="text_pole" ${named}>${optionsHtml(f, value, cfg)}</select>${engineModelsBtn(mp)}</div>${desc}${note}${hnote}</div>`;
            return `<${box} class="lv-field${wide}"${hattr}>${head}<select class="text_pole" ${named}>${optionsHtml(f, value, cfg)}</select>${desc}${note}${hnote}</${box}>`;
        }
        case 'range':
            if (hnote) return `<div class="lv-field lv-range${wide}"${hattr}><span class="lv-label"><span class="lv-name">${esc(f.label)}${help}</span><output>${esc(fmtRange(f, value))}</output></span><input type="range" ${named}${numAttrs(f)} value="${esc(value)}">${desc}${hnote}</div>`;
            return `<label class="lv-field lv-range${wide}"><span class="lv-label">${esc(f.label)}<output>${esc(fmtRange(f, value))}</output></span><input type="range" ${attr}${numAttrs(f)} value="${esc(value)}">${desc}</label>`;
        case 'number':
            return `<${box} class="lv-field${wide}"${hattr}>${label}<input type="number" class="text_pole" ${named}${numAttrs(f)} value="${esc(value)}">${desc}${hnote}</${box}>`;
        case 'textarea':
            return `<${box} class="lv-field${wide}"${hattr}>${label}<textarea class="text_pole" ${named} rows="${Number(f.rows) || 3}" placeholder="${esc(f.placeholder || '')}">${esc(value)}</textarea>${desc}${hnote}</${box}>`;
        case 'password':
            return '';   // 키는 lv-key 줄에서 따로 (값을 화면에 두지 않는다)
        case 'html':
            return typeof f.html === 'function' ? f.html(path) : '';   // 대사 분석 모델 고르기 (자리 표시는 data-lv-slot)
        default:
            return `<${box} class="lv-field${wide}"${hattr}>${label}<input type="text" class="text_pole" ${named} value="${esc(value)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">${desc}${hnote}</${box}>`;
    }
}
/** 지금 보여야 할 항목 (키 칸은 따로, show 조건은 엔진 설정 또는 전체 설정으로 판정) */
function visibleFields(list, cfg = null) {
    const s = settings();
    return list.filter(f => f.type !== 'password' && (!f.show || f.show(cfg || s)));
}
function fieldsHtml(list, base = '', cfg = null) {
    const s = settings();
    return visibleFields(list, cfg)
        .map(f => control(f, base + f.key, (cfg ? cfg[f.key] : getPath(s, f.key)) ?? f.default ?? '', cfg))
        .join('');
}
/** 카드에 그려진 항목과 지금 보여야 할 항목이 다른가 (같으면 다시 그리지 않는다 — 손가락 밑 슬라이더·입력 중인 키를 지키려고) */
function visibleChanged(cardName, list, base = '', cfg = null) {
    const cardEl = q(`[data-lv-card="${cardName}"]`);
    if (!cardEl) return false;
    const want = visibleFields(list, cfg).map(f => base + f.key);
    const now = [...cardEl.querySelectorAll('[data-lv-path], [data-lv-slot]')].map(e => e.dataset.lvPath || e.dataset.lvSlot);
    return now.length !== want.length || now.some((p, i) => p !== want[i]);
}
function card(name, icon, title, inner, cls = '', note = '', help = null) {
    const n = note ? `<span class="lv-card-note">${esc(note)}</span>` : '';
    // 1.4.0 카드 제목 옆 ? — 누르면 제목 밑에 설명 (항목 ? 와 같은 펼침 · 줄마다 <br>)
    const lines = Array.isArray(help) ? help.filter(Boolean) : [];
    const hb = lines.length ? '<button type="button" class="lv-help-btn" data-lv-act="help" aria-label="도움말" aria-expanded="false"><i class="fa-solid fa-circle-question" aria-hidden="true"></i></button>' : '';
    const hn = lines.length ? `<div class="lv-help-note lv-card-help" hidden>${lines.map(esc).join('<br>')}</div>` : '';
    return `<section class="lv-card${cls ? ' ' + cls : ''}" data-lv-card="${esc(name)}"><div class="lv-card-head"><i class="fa-solid ${esc(icon)}"></i><span>${esc(title)}</span>${hb}${n}</div>${hn}${inner}</section>`;
}
/** 1.4.0 줄 옆 감정 세기 칸 설명 (캐릭터별 목소리 · 대화 색 ? 가 같이 씀) */
const STRENGTH_HELP = [
    '목소리 옆 칸은 그 캐릭터만의 감정 세기예요 (그 캐릭터가 실제로 읽는 목소리에 저장).',
    '· 전체: 「읽기」 탭의 감정 세기를 따라요.',
    '· 약: 감정을 빼고 차분하게 — ElevenLabs v3 · v4 는 덤덤하게 + 느낌표를 순하게 바꿔 읽어요.',
    '· 보통: 대사 분석이 찾은 감정(화남 · 슬픔 …)을 그대로 붙여 읽어요.',
    '· 강: 감정이 붙은 줄을 더 크게 연기해요 (MiniMax 는 웃음 · 한숨 소리도).',
    '옆의 조절 단추는 그 목소리 편집(말투 · 안정감 등)을 열어요.',
];
const MAP_HELP = [
    '캐릭터 이름마다 읽을 목소리를 정해요. 「엔진」을 고르면 이름이 같은 그 엔진의 목소리로 읽어요.',
    '「기본」은 목소리를 못 찾은 화자, 「나」는 내 대사, 「내레이터」는 서술이에요.',
    ...STRENGTH_HELP,
];
const COLORS_HELP = [
    '대사 색으로 누가 말하는지 알아내요 (색은 채팅 글에서 배워요 — 데우스 프리셋이 아니어도 대사에 색이 있으면 돼요). 색마다 캐릭터 이름을 적고 목소리를 골라요.',
    ...STRENGTH_HELP,
    '자물쇠는 이 색의 이름을 고정해요 (다시 배워도 안 바뀌게). 숫자는 이 채팅에서 그 색을 본 횟수예요.',
    '같은 사람이 다른 색으로도 나오면 줄을 따로 만들지 않고 그 사람 점의 오른쪽 아래에 그 색을 작은 점으로 보여요. 이름이 없는 새 색은 흐린 추천 이름과 ✓ 단추가 보여요 — ✓ 를 누르면 그 이름으로 정해요. 진짜 동명이인이면 두 색에 같은 이름을 직접 적으면 두 줄로 나와요.',
    '대사에 색이 없는 채팅은 「이름: 「…」」 같은 이름표와 대사 분석(화자 찾기)으로 누가 말하는지 찾아요.',
    '「이 채팅의 캐릭터」는 색이 없어도 최근 메시지에 나온 캐릭터(이름표 · 화자 찾기 · 목소리를 정해 둔 이름)예요. 여기서 바로 목소리 · 감정 세기를 정해요.',
];
/** 입력칸 값 → 설정에 넣을 값 (숫자·불 변환, 범위 자르기) */
function coerce(f, el) {
    if (el.type === 'checkbox') return !!el.checked;
    if (el.type === 'range' || el.type === 'number') {
        let n = Number(el.value);
        if (!Number.isFinite(n)) n = Number(f && f.default) || 0;
        if (f && f.min !== undefined) n = Math.max(Number(f.min), n);
        if (f && f.max !== undefined) n = Math.min(Number(f.max), n);
        return n;
    }
    if (el.tagName === 'SELECT') {
        const hit = f ? optionsOf(f).find(o => String(o.value) === el.value) : null;
        return hit && typeof hit.value === 'number' ? hit.value : el.value;
    }
    if (el.tagName === 'TEXTAREA') return el.value;
    return el.value.trim();
}
function setControl(el, v) {
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.value !== String(v ?? '')) el.value = String(v ?? '');
    if (el.type === 'range') {
        const out = el.closest('.lv-range')?.querySelector('output');
        const f = FIELDS.get(el.dataset.lvPath);
        if (out && f) out.textContent = fmtRange(f, v);
    }
}
/** 같은 경로에 묶인 다른 입력칸도 맞춘다 (위쪽 [자동 읽기] ↔ 언제 카드) */
function syncPath(path, from) {
    if (!root) return;
    const v = getPath(settings(), path);
    for (const el of root.querySelectorAll(`[data-lv-path="${CSS.escape(path)}"]`)) if (el !== from) setControl(el, v);
}
function syncAll() {
    for (const el of root.querySelectorAll('[data-lv-path]')) setControl(el, getPath(settings(), el.dataset.lvPath));
}
function write(path, val, from) {
    setPath(settings(), path, val);
    save();
    syncPath(path, from);
}

// ---------- 하나로 모은 input / change 처리
function onEdit(e, live) {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.id === 'lv_search') { if (live) { state.search = el.value; renderVoiceRows(); } return; }
    if (el.id === 'lv_test_line') { state.testLine = el.value; return; }
    if (el.id === 'lv_import_file') { if (!live) importFile(el); return; }
    if (el.id === 'lv_engine_pick') { if (!live) { settings().ui.provider_tab = el.value; save(); renderEngine(); } return; }
    if (el.id === 'lv_akey_input') return;   // 분석 키는 [저장] 으로만
    if (el.id === 'lv_amodel') { if (!live) pickModel(el.value); return; }
    if (el.id === 'lv_amodel_manual') { if (!live) { setModel(el.value.trim()); el.value = currentModel(); } return; }   // 미뤄 둔 모델 줄은 blur 때 (renderModelSlot)
    if (el.id === 'lv_prefer_provider') { if (!live) setPreferProvider(el.value); return; }   // 1.3.7 엔진 자동 맞춤
    if (el.id === 'lv_extras') { if (!live) { settings().extras = el.value === 'off' ? 'off' : 'auto'; save(); renderMap(); } return; }   // 1.3.7 엑스트라 목소리
    if (el.dataset.lvExtra !== undefined) { if (!live) onExtraPin(el); return; }
    if (el.dataset.lvMap !== undefined) { if (!live) onMapChange(el); return; }
    if (el.dataset.lvColorName !== undefined) { if (!live) onColorName(el); return; }
    if (el.dataset.lvColorVoice !== undefined) { if (!live) onColorVoice(el); return; }
    if (el.dataset.lvStrength !== undefined) { if (!live) onStrength(el); return; }   // 1.4.0 줄 옆 감정 세기
    const path = el.dataset.lvPath;
    if (!path) return;
    const f = FIELDS.get(path);
    if (el.type === 'range') {
        // 슬라이더는 움직일 때 바로 저장, 손을 떼면(change) 뒤처리만
        if (live) {
            write(path, coerce(f, el), el);
            if (path === 'playback_rate' || path === 'master_volume') { try { player.applyPlayback(); } catch { /* 재생기 없음 */ } }   // 읽는 중에도 바로
        } else afterEdit(path, el);
        const out = el.closest('.lv-range')?.querySelector('output');
        if (out && f) out.textContent = fmtRange(f, getPath(settings(), path));
        return;
    }
    if (live) return;   // 글 입력은 change 때만
    write(path, coerce(f, el), el);
    if (el.type === 'number' || el.type === 'text') setControl(el, getPath(settings(), path));   // 범위를 벗어난 숫자·앞뒤 공백은 저장된 값으로 되돌려 보여 준다
    afterEdit(path, el);
}
/** 값이 바뀐 뒤 따라 바뀌어야 하는 부분만 다시 그린다 (보이는 항목이 달라질 때만 카드를 새로 그린다) */
function afterEdit(path, el) {
    const s = settings();
    // 1.3.8 「나」 자동을 골랐는데 「내 대사」가 읽지 않음이면 (직접 설정) AI 답장 속 내 대사가 안 읽혀 자동이 아무 일도 안 한다 → 읽게 바꾸고 한 줄 알림
    if (path === 'user_voice' && s.user_voice === USER_AUTO) {
        // 5.7.3 성별을 아직 모르면 바로 물어 정한다 (분석을 기다리지 않게) · 「내 대사」가 읽지 않음이면 읽게
        const skip = isObj(s.routes) && s.routes.user_dialogue === 'skip';
        let name = '';
        try { name = String(getContext()?.name1 || '').trim(); } catch { name = ''; }
        if (!voices.personaKnown(name)) void player.askPersonaVoice({ quiet: true }).then(() => { syncPath('routes.user_dialogue'); renderMap(); });
        if (skip) {
            s.routes.user_dialogue = 'user';
            save();
            syncPath('routes.user_dialogue');
            toast('「내 대사」도 읽게 바꿨어요', 'info');
        }
        return;
    }
    if (path === 'read_preset') { applyReadPreset(s.read_preset); save(); }
    if (path === 'enabled' && !s.enabled) player.stop();
    if (path === 'highlight' || path === 'highlight_style') player.refreshHighlight();
    if (path === 'wand_menu') { dispatchWand(); return; }                  // index.js 가 요술봉 메뉴 두 줄을 넣고 뺀다
    if (path === 'wait_translation') { renderReadCard('when'); return; }   // 스트리밍 읽기의 켜짐·꺼짐과 대기 초 칸이 따라 바뀐다
    if (path === 'click_play' || path === 'auto_play' || path === 'pregen' || path === 'pregen_paid') renderReadCard('when');   // 1.2.4 미리 만들기가 쉬는지 한 줄 · 5.6.4 '!' 안내 · 스위치
    if (path === 'analysis.engine' || path === 'analysis.provider' || path === 'analysis.custom_url' || path === 'analysis.base') {
        if (path === 'analysis.base') warnAnalysisCleartext();
        if (path === 'analysis.custom_url') warnCustomCleartext();
        state.amodelManual = '';
        showTestResult('', '', 'lv_atest_result');   // 앞 엔진·공급자의 연결 확인 결과는 들고 가지 않는다
        // 엔진·공급자는 보이는 칸이 바뀌어 카드째로, 주소는 모델 줄만 (blur 에 오는 change — 다른 칸의 입력·막 누른 버튼을 지키려고)
        if (path === 'analysis.engine' || path === 'analysis.provider') renderReadCard('analysis');
        else { renderModelSlot(); updateAnalysisNote(); }
        autoFetchModels();
        return;
    }
    if (path.startsWith('providers.')) {
        const p = curProvider();
        if (p && visibleChanged('engine', [...(p.fields || []), ...(p.params || [])], `providers.${p.id}.`, providerConfig(p.id, p.defaults))) rerenderEngineCard(p);
        // 1.3.7 모델에서 직접 입력을 고르면 바로 이름 칸으로
        if (p && path === `providers.${p.id}.model` && el.value === ttsModels.CUSTOM) q(`[data-lv-path="${CSS.escape(`providers.${p.id}.model_custom`)}"]`)?.focus();
        if (p && ENDPOINT_KEYS.has(path.split('.').pop())) warnCleartext(p);   // 주소를 http:// 바깥 서버로 바꿨을 때
        refreshWhenCard();   // 5.6.4 MiniMax 서버 · OpenAI 호환 주소가 유료 판단을 바꿨으면 언제 카드('!' · 스위치 · 쉬는 줄)를 (달라졌을 때만)
        return;
    }
    if (path === 'cache_limit' || path === 'cache_mb') {
        // 한도를 낮추면 바로 정리하고 숫자를 새로 센다
        Promise.resolve(cache.prune()).then(() => cache.stats()).then(({ count, bytes }) => {
            const stat = q('#lv_cache_stat');
            if (stat) stat.textContent = `${fmtNum(count)}개 · ${(bytes / 1048576).toFixed(1)} MB`;
        }).catch(() => { /* 캐시를 못 열면 그대로 */ });
        return;
    }
    const cardEl = el.closest('[data-lv-card]');
    const name = cardEl && cardEl.dataset.lvCard;
    if (name && READ_CARDS[name] && visibleChanged(name, READ_CARDS[name][2])) renderReadCard(name);
}
/**
 * 1.3.8 캐릭터 목소리 고르기 (캐릭터별 목소리 · 대화 색 · 엑스트라 줄이 같이 씀). 「엔진」을 골라 둔 채:
 *   다른 엔진 목소리를 고름 → 그 캐릭터는 그 목소리로 고정 (prefer_keep — 사용자: "벨포드는 미니맥스로 듣기")
 *   「엔진」 엔진의 짝을 다시 고름 → 고정만 풂 (연결표는 원래 목소리 — 「엔진」을 되돌리면 그 목소리)
 * 「엔진」이 없거나 쓸 수 없으면 1.3.7 처럼 연결표만 (고정 표시는 지움)
 */
function setCharVoice(name, uid) {
    const s = settings();
    if (!name) return;
    if (!isObj(s.prefer_keep)) s.prefer_keep = {};
    if (!uid) { delete s.char_map[name]; delete s.prefer_keep[name]; return; }
    const v = voices.findVoice(uid);
    const pref = s.prefer_provider;
    const prefOn = !!pref && voices.engineUsable(pref);
    // 1.3.8 쓸 수 있는 목소리만 고정 (키 없는 엔진 · 계정에 없는 목소리로 고정하면 그 캐릭터가 '키를 먼저 저장해요' 로 조용해짐)
    if (prefOn && v && v.provider !== pref && !v.gone && voices.engineUsable(v.provider)) { s.char_map[name] = uid; s.prefer_keep[name] = true; return; }
    const base = voices.findVoice(s.char_map[name]);
    if (prefOn && v && base && base.uid !== uid && voices.twinOf(base, pref, name)?.uid === uid) { delete s.prefer_keep[name]; return; }
    s.char_map[name] = uid;
    delete s.prefer_keep[name];
}
/** 1.3.8 고정 풀기 (칩) — 다시 「엔진」을 따른다 */
function unpinChar(name) {
    const s = settings();
    if (!name || !isObj(s.prefer_keep)) return;
    const k = String(name).trim().toLowerCase().replace(/\s+/g, '');
    for (const key of Object.keys(s.prefer_keep)) if (key === name || key.trim().toLowerCase().replace(/\s+/g, '') === k) delete s.prefer_keep[key];
    save();
    renderMap();
    renderColors();
}
function onMapChange(el) {
    const name = el.dataset.lvMap;
    if (!name) return;
    setCharVoice(name, el.value);
    save();
    renderMap();
    renderColors();
}
/** 1.3.7 엑스트라 줄에서 목소리를 고르면 그 이름을 캐릭터 목소리로 고정 (엑스트라 표에서는 뺌) */
function onExtraPin(el) {
    const name = el.dataset.lvExtra;
    if (!name || !el.value) return;
    setCharVoice(name, el.value);
    voices.forgetExtra(name);
    save();
    renderMap();
    renderColors();
}
function onColorName(el) {
    const color = el.dataset.lvColorName;
    const name = el.value.trim();
    // 손으로 적은 이름은 고정 (학습이 덮어쓰지 않게); 비우면 이름·고정 해제
    try { speakers.setColor(color, name || null, !!name); }
    catch (err) { toast(err.message, 'error'); }
    renderColors();
}
/** 1.4.0 줄 옆 감정 세기: 그 목소리에만 (비우면 전체 설정) — 같은 목소리가 보이는 곳(캐릭터별 목소리 · 대화 색 · 목소리 목록 칩)을 다시 그림 */
function onStrength(el) {
    const v = voices.findVoice(el.dataset.lvStrength);
    if (!v) return;
    if (['weak', 'normal', 'strong'].includes(el.value)) v.strength = el.value; else delete v.strength;
    save();
    renderMap();
    renderColors();
    try { renderVoiceRows(); } catch { /* 목소리 탭이 아직 없음 */ }
}
function onColorVoice(el) {
    const color = el.dataset.lvColorVoice;
    const row = colorRows().find(r => r.color === color);
    if (!row || !row.name) return;
    setCharVoice(row.name, el.value);   // 1.3.8 다른 엔진 목소리면 고정
    save();
    renderMap();
    renderColors();
}

// ---------- 버튼 (data-lv-act)
const ACTIONS = {
    tab: (b) => showTab(b.dataset.tab),
    stop: () => player.stop(),
    'body-filters': async () => {
        if (!(await confirm('본문 필터 기본값을 적용할까요? 상태창·계획·미디어 태그 안의 내용과 코드 블록을 제외하고, 추가 정규식을 비워 대사 감정 힌트를 살려요. 발음 사전·읽을 부분·속마음·목소리·분석 연결은 유지해요.'))) return;
        applyBodyFilters(); save(); renderReadCard('text');
        toast('본문 필터 기본값을 적용했어요', 'success');
    },
    'map-remove': (b) => { const s = settings(); delete s.char_map[b.dataset.name]; if (isObj(s.prefer_keep)) delete s.prefer_keep[b.dataset.name]; save(); renderMap(); renderColors(); },
    'color-accept': (b) => {   // 1.4.1 새 색에 추천 이름을 받음 (잠금 — 다시 배워도 그대로)
        const name = String(b.dataset.name || '').trim();
        if (!name) return;
        speakers.setColor(b.dataset.color, name, true);
        renderColors();
        renderMap();
    },
    'color-lock': (b) => {
        const row = colorRows().find(r => r.color === b.dataset.color);
        if (!row) return;
        speakers.setColor(row.color, row.name || null, !row.locked);
        renderColors();
    },
    palette: async () => {
        const pal = await speakers.importPalette();
        const n = Object.keys(pal || {}).length;
        toast(n ? `${n}가지 색을 불러왔어요` : '프리셋·카드에 색 목록이 없어요', n ? 'success' : 'warning');
        renderColors();
    },
    relearn: () => {
        // 고정(팔레트·직접 정한) 색은 두고, 채팅 전체를 처음부터 다시 배운다
        const n = speakers.relearnChat();
        renderColors();
        toast(n ? `${fmtNum(n)}개 답장에서 다시 배웠어요` : '배울 답장이 없어요');
    },
    'colors-clear': async () => {
        if (!(await confirm('이 채팅의 대화 색을 모두 지울까요?'))) return;
        speakers.resetLearning(false);   // 고정 색까지 모두; 카드에 기억한 이름은 남는다
        renderColors();
        toast('대화 색을 지웠어요 · 프리셋 색은 「프리셋에서 불러오기」로 다시 넣어요');   // speakers 가 palette_at 을 지키므로 팔레트는 저절로 돌아오지 않는다
    },
    test: (b) => testVoice(b),
    edit: (b) => openVoiceEditor(b.dataset.uid),
    del: (b) => deleteVoice(b.dataset.uid),
    pull: () => pullFromAccount(),
    paste: () => pasteList(),
    add: () => addVoice(),
    'add-mix': () => openVoiceEditor(null, { provider: 'minimax', mix: true }),
    'key-save': () => keySave(),
    'key-clear': () => keyClear(),
    'key-test': () => keyTest(),
    'akey-save': () => akeySave(),
    'akey-clear': () => akeyClear(),
    'akey-test': () => akeyTest(),
    amodels: () => refreshModels(),
    'analysis-clear': async () => {
        if (!(await confirm('이 채팅의 대사 분석을 모두 지울까요? 다시 들을 때 새로 분석해요'))) return;
        analysis.clearAnalysis('chat');
        toast('이 채팅의 분석을 비웠어요', 'success');
    },
    'engine-pull': () => { const p = curProvider(); if (p) return pullVoices(p); },
    'engine-models': () => { const p = curProvider(); if (p) return refreshEngineModels(p, { quiet: false }); },   // 1.3.7 ↻ 모델 목록
    'extra-forget': (b) => { if (voices.forgetExtra(b.dataset.name || '')) renderMap(); },   // 1.3.7 엑스트라 한 명 빼기 (다음 분석에서 다시 고름)
    'gone-clear': async () => {   // 1.3.7 계정에 없는 목소리 지우기 (연결된 것은 남김)
        const n = voices.hiddenCounts().gone;
        if (!n || !(await confirm(`계정에 없는 목소리 ${n}개를 목록에서 지울까요? 캐릭터에 연결된 것은 남겨요.`))) return;
        const k = voices.removeGone();
        renderVoices();
        toast(`${k}개 지웠어요`, 'success');
    },
    balance: () => { const p = curProvider(); if (p) return loadBalance(p, 'force'); },
    warn: (b) => {
        const note = b.closest('.lv-field')?.querySelector('.lv-warn-note');
        if (!note) return;
        note.hidden = !note.hidden;
        b.setAttribute('aria-expanded', String(!note.hidden));
    },
    help: (b) => toggleHelp(b),   // 1.3.8 '?' 도움말
    tag: (b) => {                 // 1.3.8 엔진 카드의 말투 칩 (목소리 편집 팝업의 칩은 bindEditor 가)
        const path = b.dataset.path;
        if (!path) return;
        const t = String(b.dataset.tag || '');
        const cur = tagList(getPath(settings(), path));
        if (!cur.includes(t) && cur.length >= TAG_MAX) { toast(`말투는 ${TAG_MAX}개까지 골라요`, 'warning'); return; }
        const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
        write(path, next.length ? next : undefined);
        b.setAttribute('aria-pressed', String(next.includes(t)));
    },
    unpin: (b) => { unpinChar(b.dataset.name || ''); },   // 1.3.8 캐릭터 엔진 고정 풀기
    'cache-clear': async () => { await cache.clear(); toast('캐시를 비웠어요', 'success'); renderData(); },
    export: () => exportSettings(),
    import: () => q('#lv_import_file')?.click(),
};
function onClick(e) {
    const b = e.target.closest('[data-lv-act]');
    if (!b || !root.contains(b)) return;
    const fn = ACTIONS[b.dataset.lvAct];
    if (!fn) return;
    e.preventDefault();
    const fail = (err) => {
        toast((err && err.message) || '실패', 'error');
        log('err', `설정 화면: ${(err && err.message) || err}`);
    };
    let r;
    try { r = fn(b, e); } catch (err) { fail(err); return; }
    if (r && typeof r.then === 'function') r.catch(fail);   // 비동기 동작은 실패만 받는다
}

// ---------- 탭
function showTab(id) {
    if (!TAB_IDS.includes(id)) id = 'read';
    const s = settings();
    if (s.ui.tab !== id) { s.ui.tab = id; save(); }
    for (const b of root.querySelectorAll('.lv-tab')) {
        const on = b.dataset.tab === id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const p of root.querySelectorAll('.lv-pane')) p.hidden = p.dataset.pane !== id;
    if (id === 'read') refreshWhenCard();   // 번역기 쪽 자동 번역을 켜고 껐을 수 있음
    if (id === 'data') renderData();
    if (id === 'voices' && !ensureFresh()) renderColors();   // 채팅이 바뀌었을 수 있음 (바뀐 채팅을 아직 안 그렸으면 캐릭터별 목소리까지)
    if (id === 'voices') syncIfShown();             // 1.3.7 계정 맞춤 (6시간에 한 번) — 1.3.8 보일 때만 (페이지를 열 때 닫힌 서랍에선 요청 없음)
    if (id === 'engine') { autoEngineModels(); balanceIfShown(); }   // 1.3.7 모델 목록 (12시간에 한 번 · 보일 때만) · 1.3.8 잔액도 보일 때만
    if (id === 'voices' || id === 'engine') flushPendingOffer();     // 1.3.8 닫힌 서랍에서 미뤄 둔 「바꿀까요」
}

// ---------- 읽기 탭
/** 대사 분석 카드의 격자 아래: (실리태번 연결 · 실리태번 API 면 연결 확인 — OpenAI 호환은 키 줄에) · 설명 한 줄 · 이 채팅 분석 비우기 */
function analysisExtra(s) {
    const st = !isCompat(s)
        ? '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="akey-test">연결 확인</button></div><div class="lv-test-result" id="lv_atest_result"></div>'
        : '';
    return st + '<span class="lv-desc">분석 결과를 채팅에 저장해 다시 써요. 글·주변 문맥·분석 설정이 달라지면 새로 분석해요.</span>'
        + '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="analysis-clear">이 채팅 분석 비우기</button></div>';
}
function readCardHtml(name) {
    const [icon, title, fields, extra, note] = READ_CARDS[name];
    if (name === 'when') whenSig = whenSignature();
    let content = `<div class="lv-grid">${fieldsHtml(fields)}</div>`;
    if (name === 'text') {
        const advanced = new Set(['pron_dict', 'strip_regex']);
        const s = settings();
        const open = state.textAdvancedOpen ?? !!(s.pron_dict || s.strip_regex);
        content = `<div class="lv-grid">${fieldsHtml(fields.filter(f => !advanced.has(f.key)))}</div>`
            + '<span class="lv-desc">별도 태그가 없는 글도 그대로 읽어요. &lt;prose&gt; 같은 본문 태그는 안쪽 글을 살려요.</span>'
            + '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="body-filters">본문 필터 기본값</button></div>'
            + '<span class="lv-desc">기존 필터를 바꾸기 전에 적용 내용을 보여 줘요.</span>'
            + `<details class="lv-advanced" data-lv-detail="text"${open ? ' open' : ''}><summary>고급: 발음 사전 · 정규식</summary><div class="lv-grid">${fieldsHtml(fields.filter(f => advanced.has(f.key)))}</div></details>`;
    }
    return card(name, icon, title, `${content}${typeof extra === 'function' ? extra(settings()) : ''}`, '', typeof note === 'function' ? note(settings()) : '');
}
function renderRead() {
    const pane = q('#lv_pane_read');
    if (pane) pane.innerHTML = Object.keys(READ_CARDS).map(readCardHtml).join('');
}
/** 카드 하나만 다시 그린다 — 아직 저장 안 한 분석 키 입력과 연결 확인 결과는 그대로 둔다 */
function renderReadCard(name) {
    const old = q(`[data-lv-card="${name}"]`);
    if (!old) return;
    const typed = old.querySelector('#lv_akey_input')?.value || '';
    const res = old.querySelector('#lv_atest_result');
    const resText = res ? res.textContent : '', resCls = res ? res.className : '';
    old.outerHTML = readCardHtml(name);
    const keyIn = q('#lv_akey_input');
    if (keyIn && typed) keyIn.value = typed;
    const res2 = q('#lv_atest_result');
    if (res2 && resText) { res2.textContent = resText; res2.className = resCls; }
}
// ---------- 대사 분석 모델 고르기 (실리태번 API 중 선택 · OpenAI 호환)
/** 카드 머리의 한 줄: 쓰는 모델 (실리태번 현재 연결은 지금 고른 채팅 완성 모델) */
function analysisNote(s) {
    const a = (s && s.analysis) || {};
    try {
        if (a.engine === 'provider') return stapi.modelOf(a);
        if (a.engine === 'st') {
            const ctx = getContext();
            return ctx && ctx.mainApi === 'openai' && typeof ctx.getChatCompletionModel === 'function' ? String(ctx.getChatCompletionModel() || '') : '';
        }
    } catch { return ''; }
    return String(a.model || '');
}
function updateAnalysisNote() {
    const head = q('[data-lv-card="analysis"] .lv-card-head');
    if (!head) return;
    const t = analysisNote(settings());
    let el = head.querySelector('.lv-card-note');
    if (!t) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('span'); el.className = 'lv-card-note'; head.append(el); }
    el.textContent = t;
}
/** 지금 쓰는 모델 (provider = 공급자별 기억 → 실리태번에서 고른 것, 없으면 '' · compat = 적은 것) */
function currentModel() {
    const a = analysisCfg();
    return a.engine === 'provider' ? stapi.modelOf(a) : String(a.model || '');
}
function modelView() {
    const a = analysisCfg();
    const key = stapi.listKey(a);
    const list = stapi.modelList(a);
    const canFetch = a.engine === 'provider' ? !!(stapi.source(a.provider) || {}).status : true;
    return { key, list, cur: currentModel(), canFetch, manual: !list.length || state.amodelManual === key };
}
/** 모델 줄: [목록 ▾ … 직접 입력…][↻] — 목록이 비었거나 직접 입력을 고르면 이름 칸 */
function modelPickHtml(path) {
    const v = modelView();
    const busy = modelFetches.has(v.key);
    const btn = v.canFetch
        ? `<button type="button" class="lv-icon" data-lv-act="amodels" aria-label="모델 목록 새로고침"${busy ? ' disabled aria-busy="true"' : ''}><i class="fa-solid fa-rotate${busy ? ' fa-spin' : ''}"></i></button>`
        : '';
    const input = v.manual ? `<input type="text" class="text_pole" id="lv_amodel_manual" value="${esc(v.cur)}" placeholder="모델 이름" aria-label="모델 이름" autocomplete="off">` : '';
    let sel = '';
    if (v.list.length) {
        const extra = v.manual ? ''
            : !v.cur ? '<option value="" selected disabled>모델 선택</option>'
                : !v.list.includes(v.cur) ? `<option value="${esc(v.cur)}" selected>${esc(v.cur)}</option>` : '';
        const opts = v.list.map(m => `<option value="${esc(m)}"${!v.manual && m === v.cur ? ' selected' : ''}>${esc(m)}</option>`).join('');
        sel = `<select class="text_pole" id="lv_amodel" aria-label="모델">${extra}${opts}<option value="${MANUAL}"${v.manual ? ' selected' : ''}>직접 입력…</option></select>`;
    }
    const row = sel ? `<div class="lv-model">${sel}${btn}</div>${input}` : `<div class="lv-model">${input}${btn}</div>`;
    return `<div class="lv-field lv-wide lv-modelrow" data-lv-slot="${esc(path)}"><span class="lv-label">모델</span>${row}</div>`;
}
function setModel(v) {
    const a = analysisCfg();
    if (a.engine === 'provider') {
        if (!isObj(a.provider_models)) a.provider_models = {};
        if (v) a.provider_models[a.provider] = v; else delete a.provider_models[a.provider];
    } else a.model = v;
    save();
    updateAnalysisNote();
    showTestResult('', '', 'lv_atest_result');   // 앞 모델의 연결 확인 결과는 지운다
}
function pickModel(v) {
    const key = stapi.listKey(analysisCfg());
    if (v === MANUAL) {
        state.amodelManual = key;
        renderModelSlot({ force: true });
        const input = q('#lv_amodel_manual');
        if (input) input.focus();
        return;
    }
    const wasManual = state.amodelManual === key;
    state.amodelManual = '';
    setModel(v);
    if (wasManual) renderModelSlot({ force: true });
}
/** ↻: 실리태번 서버의 /status (provider) 또는 {주소}/models (compat) 로 목록을 받아 캐시에 넣고 모델 줄을 다시 그린다 */
async function refreshModels({ silent = false } = {}) {
    const a = analysisCfg();
    const key = stapi.listKey(a);
    let job = modelFetches.get(key);
    if (!job) {
        job = (a.engine === 'provider' ? stapi.fetchProviderModels(a) : stapi.fetchCompatModels(a)).finally(() => modelFetches.delete(key));
        modelFetches.set(key, job);
        setFetchBusy(true);   // 도는 아이콘 (버튼만 — 입력 중인 칸은 그대로)
    }
    try {
        const ids = await job;
        if (!silent) toast(ids.length ? `모델 ${fmtNum(ids.length)}개` : '빈 목록이에요', ids.length ? 'success' : 'warning');
    } catch (e) {
        // 토스트엔 상태만 (' · ' 뒤의 업체·중계 서버 글은 싣지 않음) — 기록엔 가린 조각까지
        const m = String((e && e.message) || '실패');
        if (!silent) toast(`모델 목록 · ${m.split(' · ')[0] || '실패'}`, 'error');
        log('err', `모델 목록 실패: ${m.slice(0, 80)}`);
    } finally {
        if (stapi.listKey(analysisCfg()) === key) renderModelSlot();
        else setFetchBusy(false);
    }
}
/** ↻ 버튼의 도는 표시만 바꾼다 */
function setFetchBusy(on) {
    const b = q('[data-lv-card="analysis"] [data-lv-act="amodels"]');
    if (!b) return;
    b.disabled = !!on;
    if (on) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
    b.querySelector('i')?.classList.toggle('fa-spin', !!on);
}
/**
 * 모델 줄만 다시 그린다 (카드의 다른 칸은 그대로). 화면에 이미 있는 목록 · 이름 칸 · ↻ 는 같은 요소를 두고 새 상태만 옮긴다
 * — 막 누르는 중인 탭, 포커스, 적던 글을 지키려고. 새로 생기는 것만 넣고 없어지는 것만 뺀다.
 * 모델 이름 칸에 적는 중이면(목록이 도착했을 때 등) 그 칸을 떠날 때(blur) 그린다. force = 사용자가 목록에서 고름 (바로)
 */
function renderModelSlot({ force = false } = {}) {
    const slot = q('[data-lv-slot="analysis.model_pick"]');
    if (!slot) return;
    const typing = q('#lv_amodel_manual', slot);
    if (!force && typing && document.activeElement === typing) {
        setFetchBusy(modelFetches.has(modelView().key));
        if (!typing.dataset.lvLater) {
            typing.dataset.lvLater = '1';
            typing.addEventListener('blur', () => { delete typing.dataset.lvLater; setTimeout(renderModelSlot, 0); }, { once: true });
        }
        return;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = modelPickHtml('analysis.model_pick');
    const nu = tmp.firstElementChild;
    const row = slot.querySelector('.lv-model'), nuRow = nu && nu.querySelector('.lv-model');
    if (!row || !nuRow) { if (nu) slot.replaceWith(nu); updateAnalysisNote(); return; }
    // 새 모양의 요소마다: 같은 것이 화면에 있으면 그것을 쓰고 상태만 옮김
    const keep = (fresh) => {
        const old = fresh.id ? slot.querySelector(`#${fresh.id}`) : fresh.dataset.lvAct ? slot.querySelector(`[data-lv-act="${fresh.dataset.lvAct}"]`) : null;
        if (!old || old.tagName !== fresh.tagName) return fresh;
        if (old.tagName === 'SELECT') old.innerHTML = fresh.innerHTML;                         // 고른 항목은 selected 로 따라옴
        else if (old.tagName === 'INPUT') { if (document.activeElement !== old) old.value = fresh.value; }
        else {
            old.disabled = fresh.disabled;
            if (fresh.hasAttribute('aria-busy')) old.setAttribute('aria-busy', 'true'); else old.removeAttribute('aria-busy');
            old.innerHTML = fresh.innerHTML;
        }
        return old;
    };
    const after = [];
    for (let n = nuRow.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
    const inRow = [...nuRow.children].map(keep);
    const below = after.map(keep);
    // 순서대로 놓기 (이미 제자리인 요소는 옮기지 않음 — 옮기면 포커스를 잃는다) · 남는 것 빼기
    const place = (parent, nodes, start) => {
        let cur = start;
        for (const n of nodes) {
            if (cur !== n) parent.insertBefore(n, cur);
            cur = n.nextElementSibling;
        }
        while (cur) { const next = cur.nextElementSibling; cur.remove(); cur = next; }
    };
    place(row, inRow, row.firstElementChild);
    place(slot, below, row.nextElementSibling);
    updateAnalysisNote();
}
/** 실리태번 API 중 선택에서 목록이 없거나 하루가 지났으면 조용히 받는다 (공급자를 고를 때 · 설정을 열 때 — 같은 목록은 세션에 한 번).
 *  키가 없다고 알려진 공급자, 새로 적은 Custom 주소(오타 난 주소로 키가 가지 않게), Azure(/status 가 진짜 채팅 요청)는 건너뜀 — ↻ 로만 (stapi.needsAutoList) */
function autoFetchModels() {
    if (!root) return;
    const a = analysisCfg();
    if (a.engine !== 'provider') return;
    const src = stapi.source(a.provider);
    const key = stapi.listKey(a);
    const tryKey = `${key}@${stapi.cachedAt(key)}`;
    if (!src || autoTried.has(tryKey) || modelFetches.has(key)) return;
    if (!stapi.needsAutoList(a)) return;   // 5.7.1: 목록이 없거나 하루가 지났을 때만 (키 없음 · 새로 적은 Custom 주소 · Azure · 실패 뒤 기다림은 needsAutoList 가 거름)
    autoTried.add(tryKey);
    refreshModels({ silent: true });
}
function warnCustomCleartext() {
    const a = analysisCfg();
    if (cleartextWarned.has('analysis-custom') || !isCustomProvider(settings()) || !cleartextRemote(a.custom_url)) return;
    cleartextWarned.add('analysis-custom');
    toast('Custom 주소가 http:// 라 키가 암호화 없이 가요', 'warning');
}

// ---------- 대사 분석 키 · 연결 확인 (analysis.testEngine)
async function akeyTest() {
    showTestResult('확인 중…', '', 'lv_atest_result');
    try {
        // testEngine 은 실패도 글로 돌려준다 ('실패 · …', '주소와 키를 먼저 …') — '됐어요' 로 시작할 때만 성공 색
        const msg = String(await analysis.testEngine(analysisCfg()) || '');
        showTestResult(msg || '실패', /^됐어요/.test(msg) ? 'ok' : 'bad', 'lv_atest_result');
    } catch (e) {
        showTestResult((e && e.message) || '실패', 'bad', 'lv_atest_result');
        log('err', `대사 분석 연결 확인 실패: ${(e && e.message) || e}`);
    }
}
async function akeySave() {
    const input = q('#lv_akey_input');
    if (!input) return;
    const v = input.value.trim();
    if (!v) { toast('키를 붙여넣어요', 'warning'); return; }
    analysisCfg().key = v;
    input.value = '';
    save();
    renderReadCard('analysis');
    warnAnalysisCleartext();
    await akeyTest();   // 저장하면 바로 확인
}
async function akeyClear() {
    if (!analysisCfg().key) return;
    if (!(await confirm('대사 분석 키를 지울까요?'))) return;
    analysisCfg().key = '';
    save();
    renderReadCard('analysis');
}

// ---------- 목소리 탭
/**
 * 목소리 고르기 <option> 들 — 한글 이름만 (엔진·id 는 편집 팝업에서).
 * 1.3.8 auto = 「나」 줄의 '자동' (페르소나도 엑스트라 목소리로) · twins = 이 캐릭터의 같은 사람 목소리를 엔진마다 ('벨포드 · MiniMax') —
 *   「엔진」으로 고른 엔진 밖의 목소리도 고를 수 있게 (고르면 그 캐릭터만 그 엔진으로 고정)
 */
function voiceOptions(sel, { auto = false, twins = [] } = {}) {
    const all = voices.shownVoices();   // 1.3.7 연결된 계정 · 고른 엔진의 목소리만
    const groups = new Map();
    for (const v of all) { const g = v.group || '기타'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
    let h = '<option value="">(없음)</option>';
    if (auto) h += `<option value="${USER_AUTO}"${sel === USER_AUTO ? ' selected' : ''}>자동</option>`;
    const twinIds = new Set(twins.map(v => v.uid));
    if (twins.length) h += '<optgroup label="엔진별">' + twins.map(v => `<option value="${esc(v.uid)}"${v.uid === sel ? ' selected' : ''}>${esc(`${v.name} · ${providerName(v.provider)}`)}</option>`).join('') + '</optgroup>';
    if (sel && sel !== USER_AUTO && !twinIds.has(sel) && !all.some(v => v.uid === sel)) {
        const hv = voices.findVoice(sel);
        const why = !hv ? '없는 목소리' : hv.gone ? '계정에 없음' : !voices.engineUsable(hv.provider) ? '키 없음' : providerName(hv.provider);
        h += `<option value="${esc(sel)}" selected>${esc(hv ? hv.name : sel)} (${esc(why)})</option>`;
    }
    const mark = twinIds.has(sel) ? '' : sel;   // 같은 목소리가 위 엔진별에 있으면 그쪽만 고른 표시
    for (const [g, arr] of groups) {
        h += `<optgroup label="${esc(g)}">` + arr.map(v => `<option value="${esc(v.uid)}"${v.uid === mark ? ' selected' : ''}>${esc(v.name)}</option>`).join('') + '</optgroup>';
    }
    return h;
}
/** 1.3.8 이 캐릭터의 같은 사람 목소리 (연결표 목소리 + 쓸 수 있는 다른 엔진마다 짝 — previewPrefer · voiceFor 와 같은 판단). 엔진이 둘 이상일 때만 */
function charTwins(name, uid) {
    const base = uid ? voices.findVoice(uid) : null;
    if (!name || !base) return [];
    // 1.3.8 리뷰 p06: 연결표 목소리라도 키가 없는 엔진 · 계정에 없는 목소리는 고르게 하지 않는다 (고르면 그 캐릭터가 조용해짐 — 아래 일반 목록이 '(키 없음)' 으로 보여 줌)
    const out = !base.gone && voices.engineUsable(base.provider) ? [base] : [];
    const engines = [...new Set(voices.allVoices().map(v => v.provider))].filter(id => id !== base.provider && voices.engineUsable(id) && getProvider(id));
    for (const id of engines) {
        const t = voices.twinOf(base, id, name);
        if (t && !out.includes(t)) out.push(t);
    }
    return out.length > 1 ? out : [];
}
/** 1.3.8 고정 칩: 「엔진」을 골랐는데 이 캐릭터는 연결표 목소리(다른 엔진) 그대로 — 누르면 풂 */
function pinChip(name, uid) {
    const s = settings();
    if (!name || !s.prefer_provider || !voices.isPinned(name)) return '';
    const v = voices.findVoice(uid);
    return `<button type="button" class="lv-pin-chip" data-lv-act="unpin" data-name="${esc(name)}" aria-label="고정 풀기">${esc(v ? `${providerName(v.provider)} 고정` : '고정')}</button>`;
}
/**
 * 1.4.0 줄 옆 도구 (캐릭터별 목소리 · 대화 색): 감정 세기(그 목소리만 — 비우면 전체) + 목소리 설정 열기.
 * 사용자: "대화 색 화면에서도 바로 바꿀 수 있으면 · 감정 세기는 밖에 꺼내 두면". uid = 그 줄이 실제로 읽는 목소리 (엔진 자동 맞춤이면 짝)
 */
const STRENGTH_SHORT = [['', '전체'], ['weak', '약'], ['normal', '보통'], ['strong', '강']];
function voiceToolsHtml(uid) {
    const v = uid && uid !== USER_AUTO ? voices.findVoice(uid) : null;
    if (!v) return '';
    const cur = v.strength || '';
    const opts = STRENGTH_SHORT.map(([val, lab]) => `<option value="${val}"${val === cur ? ' selected' : ''}>${lab}</option>`).join('');
    return `<select class="text_pole lv-strength" data-lv-strength="${esc(v.uid)}" aria-label="감정 세기">${opts}</select><button type="button" class="lv-icon" data-lv-act="edit" data-uid="${esc(v.uid)}" aria-label="목소리 설정"><i class="fa-solid fa-sliders"></i></button>`;
}
function mapRow(label, uid, attrs, charName = label, { auto = false } = {}) {
    // 1.3.7 엔진 자동 맞춤으로 다른 목소리가 읽으면 그 목소리를 이름 밑에 (고른 목소리는 그대로 보여 둔다 — 자동 맞춤을 끄면 다시 그것)
    const v = uid && uid !== USER_AUTO ? voices.findVoice(uid) : null;
    const eff = v ? voices.preferVoice(v, charName) : null;   // 고르기 칸엔 실제로 읽는 목소리 (연결표는 그대로 — 「엔진」을 되돌리면 원래 목소리 · 1.3.8 고정이면 연결표 목소리)
    const opts = voiceOptions(eff ? eff.uid : uid, { auto, twins: charName ? charTwins(charName, uid) : [] });
    const chip = pinChip(charName, uid);
    const tools = voiceToolsHtml(eff ? eff.uid : uid);
    // 1.4.0 도구가 있는 줄도 <div> (label 안에 고르기가 둘이면 이름을 눌렀을 때 엉뚱한 칸이 잡힘)
    if (tools) return `<div class="lv-row"><span class="lv-row-label">${esc(label)}${chip}</span><span class="lv-color-voicebox"><select class="text_pole" ${attrs} aria-label="${esc(label)} 목소리">${opts}</select>${tools}</span></div>`;
    // 1.3.8 리뷰(rig): 고정 칩이 <label> 안에 있으면 칩이 라벨의 대상이 돼 이름을 눌러도 고정이 풀렸다 → 칩이 있는 줄은 <div> + select 에 이름표
    if (chip) return `<div class="lv-row"><span class="lv-row-label">${esc(label)}${chip}</span><select class="text_pole" ${attrs} aria-label="${esc(label)} 목소리">${opts}</select></div>`;
    return `<label class="lv-row"><span class="lv-row-label">${esc(label)}</span><select class="text_pole" ${attrs}>${opts}</select></label>`;
}
const providerName = (id) => getProvider(id)?.name || id;
/** 목소리가 있는 엔진들 (엔진 자동 맞춤 고르기) */
const voiceEngines = () => [...new Set(voices.allVoices().filter(v => !v.gone && voices.engineUsable(v.provider)).map(v => v.provider).filter(id => getProvider(id)))];   // 5.7.2 쓸 수 있는 목소리가 있는 엔진만
function preferRowHtml(s) {
    const engines = voiceEngines();
    if (engines.length < 2 && !s.prefer_provider) return '';
    const opts = [['', '지정한 그대로'], ...engines.map(id => [id, providerName(id)])];
    if (s.prefer_provider && !engines.includes(s.prefer_provider)) opts.push([s.prefer_provider, `${providerName(s.prefer_provider)} (목소리 없음)`]);
    const sel = `<select class="text_pole" id="lv_prefer_provider" aria-label="캐릭터 목소리 엔진">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === (s.prefer_provider || '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<label class="lv-row lv-prefer"><span class="lv-row-label">엔진<small class="lv-row-via">같은 이름 목소리로 자동</small></span>${sel}</label>`;
}
/**
 * 1.3.7 엑스트라 목소리: 고르기(자동 · 기본 목소리) + 지금까지 나온 엑스트라 (최근 30명 — 접힘).
 * 줄마다 자동으로 고른 목소리를 보여 주고, 다른 목소리를 고르면 그 이름의 캐릭터 목소리로 고정 · ✕ 는 표에서 빼기
 */
function extrasHtml(s) {
    const off = s.extras === 'off';
    const sel = `<select class="text_pole" id="lv_extras" aria-label="엑스트라 목소리"><option value="auto"${off ? '' : ' selected'}>자동</option><option value="off"${off ? ' selected' : ''}>기본 목소리</option></select>`;
    let h = `<label class="lv-row lv-prefer"><span class="lv-row-label">엑스트라<small class="lv-row-via">목소리 안 정한 화자</small></span>${sel}</label>`;
    const entries = Object.entries(s.extra_map || {}).sort((a, b) => (Number(b[1]?.t) || 0) - (Number(a[1]?.t) || 0));
    if (off || !entries.length) return h;
    const rows = entries.slice(0, 30).map(([name, e]) => {
        let v = null;
        try { v = voices.extraFor(name); } catch { v = null; }
        const g = e && e.g === 'f' ? '여' : e && e.g === 'm' ? '남' : '';
        const auto = `자동 · ${v ? v.name : '기본 목소리'}`;
        const opts = voiceOptions('').replace('<option value="">(없음)</option>', `<option value="" selected>${esc(auto)}</option>`);
        return `<div class="lv-row lv-extra"><span class="lv-row-label">${esc(name)}${g ? `<small class="lv-row-via">${g}</small>` : ''}</span><select class="text_pole" data-lv-extra="${esc(name)}" aria-label="${esc(name)} 목소리">${opts}</select><button type="button" class="lv-x" data-lv-act="extra-forget" data-name="${esc(name)}" aria-label="빼기"><i class="fa-solid fa-xmark"></i></button></div>`;
    });
    return h + `<details class="lv-extras"><summary>엑스트라 ${fmtNum(entries.length)}명</summary><div class="lv-rows">${rows.join('')}</div></details>`;
}
/** 엔진 자동 맞춤 바꾸기 → 바뀐 캐릭터 수를 알려 준다 */
function setPreferProvider(id, { quiet = false } = {}) {
    const s = settings();
    s.prefer_provider = String(id || '');
    save();
    renderVoices();   // 목록도 (보이는 엔진이 바뀜)
    if (quiet) return;
    if (!s.prefer_provider) { toast('캐릭터마다 지정한 목소리로 읽어요', 'success'); return; }
    const names = Object.keys(s.char_map);
    const { moved, kept } = voices.previewPrefer(s.prefer_provider, names);
    const pinned = names.filter(n => voices.isPinned(n)).length;   // 1.3.8 고정한 캐릭터는 그대로
    toast(`${providerName(s.prefer_provider)}: ${moved.length}명 바뀜${kept.length ? ` · ${kept.length}명은 같은 이름 목소리가 없어 그대로` : ''}${pinned ? ` · ${pinned}명 고정` : ''}`, 'success');
}
/**
 * 엔진 목소리를 불러온 뒤: 지금 쓰는 엔진과 다르고, 이름이 맞는 캐릭터가 있으면 그 엔진으로 바꿀지 한 번 묻는다.
 * 1.3.8 같은 엔진은 한 번에 하나 (맞춤 · 불러오기가 겹쳐도 팝업 하나) · 아니요 한 이름들은 기억 (새 이름이 없으면 다시 안 물음) ·
 *   auto(계정 맞춤)는 설정 창이 안 보이면(페이지를 열 때 · 닫힌 서랍) 미뤘다가 목소리 · 엔진 탭이 보일 때 · 고정한 캐릭터는 셈에서 뺌
 */
const offering = new Map();   // 엔진 id → 묻는 중인 약속
function offerPrefer(p, opts = {}) {
    if (!p) return Promise.resolve();
    if (offering.has(p.id)) return offering.get(p.id);
    const job = offerPreferNow(p, opts).finally(() => offering.delete(p.id));
    offering.set(p.id, job);
    return job;
}
async function offerPreferNow(p, { auto = false } = {}) {
    const s = settings();
    const pend = () => (Array.isArray(s.prefer_pending) ? s.prefer_pending : []);
    const clearPending = () => { if (pend().includes(p.id)) { s.prefer_pending = pend().filter(x => x !== p.id); save(); } };
    if (s.prefer_provider === p.id || !voices.engineUsable(p.id)) { clearPending(); return; }
    const { moved, kept } = voices.previewPrefer(p.id, Object.keys(s.char_map));
    const changed = moved.filter(n => voices.findVoice(s.char_map[n])?.provider !== p.id);
    if (!changed.length) { clearPending(); return; }
    if (!isObjLike(s.prefer_declined)) s.prefer_declined = {};
    const declined = Array.isArray(s.prefer_declined[p.id]) ? s.prefer_declined[p.id] : [];
    if (declined.length && changed.every(n => declined.includes(n))) { clearPending(); return; }
    if (auto && !settingsShown()) { if (!pend().includes(p.id)) { s.prefer_pending = [...pend(), p.id].slice(-12); save(); } return; }   // 1.3.8 리뷰 p11: 엔진마다 (한 칸이면 뒤엣것이 앞엣것을 지웠다)
    clearPending();
    const list = changed.slice(0, 8).join(', ') + (changed.length > 8 ? ` 외 ${changed.length - 8}명` : '');
    const keptText = kept.length ? ` 맞는 이름이 없는 캐릭터(${kept.slice(0, 3).join(', ')}${kept.length > 3 ? ` 외 ${kept.length - 3}명` : ''})는 그대로예요.` : '';
    if (!(await confirm(`${p.name} 목소리 중 캐릭터와 이름이 맞는 게 ${changed.length}명 있어요 (${list}). 이 캐릭터들을 ${p.name} 목소리로 바꿀까요?${keptText} 목소리 탭의 「엔진」에서 언제든 되돌릴 수 있어요.`))) {
        s.prefer_declined[p.id] = [...new Set([...declined, ...changed])].slice(-300);
        save();
        return;
    }
    delete s.prefer_declined[p.id];
    setPreferProvider(p.id);
}
/** 1.3.8 미뤄 둔 「바꿀까요」 (설정 창이 보이면) — 엔진마다 차례로 (하나에 답해야 다음) */
let flushing = null;
function flushPendingOffer() {
    if (flushing || !settingsShown()) return flushing;
    const s = settings();
    if (!Array.isArray(s.prefer_pending) || !s.prefer_pending.length) return null;
    flushing = (async () => {
        try {
            for (const id of [...s.prefer_pending]) {
                if (!settingsShown()) break;                      // 서랍을 닫으면 나머지는 다음에
                const p = getProvider(id);
                if (p) await offerPrefer(p);
                else { s.prefer_pending = s.prefer_pending.filter(x => x !== id); save(); }
            }
        } finally { flushing = null; }
    })();
    return flushing;
}
/** 5.7.2+ 알약 · 목록에 보일 이름: 엔진 자동 맞춤이면 실제로 읽는 목소리 (Lucifer → 루시퍼 (Lucifer), 진우 쿠키 아님) */
const effName = (uid, n) => { const v = voices.findVoice(uid); return (v ? voices.preferVoice(v, n) : null)?.name || uid; };
function mapCardHtml() {
    const s = settings();
    const names = chatNames();
    // 5.7.2 휴대폰에서 '아래 … 불러와요' 바로 아래엔 대화 색 카드의 「프리셋에서 불러오기」가 먼저 보였다 → 단추를 여기에
    if (!voices.allVoices().length) return card('map', 'fa-users', '캐릭터별 목소리', '<p class="lv-empty">아직 목소리가 없어요</p><div class="lv-actions"><button type="button" class="menu_button" data-lv-act="pull">목소리 불러오기</button></div>');
    const rows = names.map(n => mapRow(n, s.char_map[n] || '', `data-lv-map="${esc(n)}"`));
    rows.push(mapRow('기본', s.default_voice, 'data-lv-path="default_voice"', ''));
    rows.push(mapRow('나', s.user_voice, 'data-lv-path="user_voice"', '', { auto: true }));   // 1.3.8 「나」 자동
    rows.push(mapRow('내레이터', s.narrator_voice, 'data-lv-path="narrator_voice"', ''));
    const prefer = preferRowHtml(s);
    if (prefer) rows.unshift(prefer);
    rows.push(extrasHtml(s));
    const pills = Object.entries(s.char_map)
        .filter(([n]) => !names.includes(n))
        .map(([n, uid]) => `<span class="lv-pill"><span>${esc(n)} → ${esc(effName(uid, n))}</span>${pinChip(n, uid)}<button type="button" class="lv-x" data-lv-act="map-remove" data-name="${esc(n)}" aria-label="빼기"><i class="fa-solid fa-xmark"></i></button></span>`)
        .join('');
    return card('map', 'fa-users', '캐릭터별 목소리', `<div class="lv-rows">${rows.join('')}</div>${pills ? `<div class="lv-pills">${pills}</div>` : ''}`, '', '', MAP_HELP);
}
function colorRows() {
    try { return speakers.colorTable() || []; } catch { return []; }
}
function topVote(r) {
    const v = r && r.votes && typeof r.votes === 'object' ? Object.entries(r.votes).sort((a, b) => b[1] - a[1])[0] : null;
    return v ? v[0] : '';
}
/** 1.3.7 고르기 칸에 보일 값: 엔진 자동 맞춤이면 실제로 읽는 목소리 */
function effUid(uid, name) { const v = uid ? voices.findVoice(uid) : null; const e = v ? voices.preferVoice(v, name) : null; return e ? e.uid : uid; }
function colorRowHtml(r, s, alts = []) {
    const name = r.name || '';
    const uid = name ? (s.char_map[name] || '') : '';
    const cnt = r.count ?? (r.votes ? Object.values(r.votes).reduce((a, b) => a + (Number(b) || 0), 0) : 0);
    const hint = topVote(r) || (r.near && r.near.name) || '이름';   // 이름이 비면 가장 많은 표 → 가까운 색의 이름을 제안
    // 1.4.1 같은 사람이 다른 색으로도 나오면(AI 가 그때그때 다른 색) 줄은 하나 — 점은 원래 색 그대로, 오른쪽 아래에 다른 색 작은 점
    //   (처음엔 점을 반으로 나눠 칠했는데, 원래 색이 배경과 비슷하면(드림주 짙은 회색) 반쪽만 보여 잘린 것 같았다 — 사용자 10-08)
    const badge = alts.length ? `<span class="lv-swatch-alt" style="background:${safeColor(alts[0])}"></span>` : '';
    // 1.4.1 이름 없는 새 색: 추천 이름을 ✓ 로 바로 받기 (흐린 글씨는 추천일 뿐이라 헷갈렸다)
    const accept = !name && hint && hint !== '이름' ? `<button type="button" class="lv-pin-chip lv-accept-chip" data-lv-act="color-accept" data-color="${esc(r.color)}" data-name="${esc(hint)}" aria-label="${esc(hint)} 으로 정하기"><i class="fa-solid fa-check" aria-hidden="true"></i> ${esc(hint)}</button>` : '';
    return `<div class="lv-color${name ? '' : ' lv-color-new'}" data-color="${esc(r.color)}">
<span class="lv-swatch" style="background:${safeColor(r.color)}">${badge}</span>
<input type="text" class="text_pole lv-color-name" data-lv-color-name="${esc(r.color)}" value="${esc(name)}" placeholder="${esc(hint)}" autocomplete="off">
<span class="lv-color-voicebox">${accept}<select class="text_pole lv-color-voice" data-lv-color-voice="${esc(r.color)}"${name ? '' : ' disabled'}>${voiceOptions(effUid(uid, name), { twins: charTwins(name, uid) })}</select>${pinChip(name, uid)}${name ? voiceToolsHtml(effUid(uid, name)) : ''}</span>
<button type="button" class="lv-icon${r.locked ? ' lv-on' : ''}" data-lv-act="color-lock" data-color="${esc(r.color)}" aria-label="고정" aria-pressed="${r.locked ? 'true' : 'false'}"><i class="fa-solid ${r.locked ? 'fa-lock' : 'fa-lock-open'}"></i></button>
<span class="lv-count">${esc(cnt)}</span></div>`;
}
// ---------- 1.4.0 이 채팅의 캐릭터 (대화 색이 없어도): 사용자 — "대화 색 프롬프트를 안 쓰는 사람도 캐릭터를 구별해 바로바로 목소리를 줄 수 있게"
// 최근 메시지에서 모은다: 대사 분석이 고른 화자(화자 찾기 · 단역 people) · 「이름: 「…」」 이름표 · 아는 이름(연결표 · 내 목소리 이름 · 다른 이름)이 글에 나옴.
// 같은 목소리로 이어지는 이름(Seraph · 세라프)은 한 줄 · 대화 색 줄 · 캐릭터별 목소리 줄에 이미 있는 사람과 나(페르소나)는 뺀다
const SPEAKER_SCAN = 60, SPEAKER_ROWS = 12;
const PREFIX_RE = /(?:^|\n)[ \t]*([^\s:：「『"“\[\]()<>*#|]{1,20})[ \t]*[:：][ \t]*[「『"“]/g;
const foldName = (t) => String(t || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
function chatSpeakers(s, taken) {
    const ctx = getContext() || {};
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const score = new Map();
    const add = (n, w) => { const name = String(n || '').trim(); if (!name || name.length > 30) return; score.set(name, (score.get(name) || 0) + w); };
    const known = new Map();   // 접은 이름 → 보여 줄 이름 (연결표 이름이 먼저)
    for (const n of Object.keys(s.char_map || {})) known.set(foldName(n), n);
    // 목소리 이름 · 다른 이름은 3글자 이상만 — 「이상」 같은 두 글자 목소리 이름이 흔한 낱말(그 이상은)에 걸렸다 (10-08 실제 채팅)
    for (const v of s.voices || []) {
        if (v.gone || v.stock || (v.mix || []).length) continue;
        for (const n of [String(v.name || '').split(/[(（]/)[0].trim(), ...(v.aliases || [])]) { const k = foldName(n); if (k && k.replace(/\s/g, '').length >= 3 && !known.has(k)) known.set(k, n); }
    }
    // 낱말의 시작에서만 (앞 글자가 한글 · 영문 · 숫자가 아니어야): 「미카엘」은 「대천사미카엘」 속에서 세지 않는다 · 일본어는 띄어쓰기가 없어 가나 · 한자 뒤여도 셈
    const LETTER = /[\p{Script=Hangul}A-Za-z0-9]/u;
    const startsWord = (ft, k) => { for (let i = ft.indexOf(k); i >= 0; i = ft.indexOf(k, i + 1)) if (i === 0 || !LETTER.test(ft[i - 1])) return true; return false; };
    for (const m of chat.slice(-SPEAKER_SCAN)) {
        if (!m || m.is_system || m.is_user) continue;
        const a = m.extra && m.extra.lemon_voice && m.extra.lemon_voice.analysis;
        if (a && typeof a === 'object') {
            for (const g of Array.isArray(a.segs) ? a.segs : []) if (g && g.speaker) add(g.speaker, 3);
            for (const n of Object.keys(a.people && typeof a.people === 'object' ? a.people : {})) add(n, 2);
        }
        const text = `${m.extra && typeof m.extra.display_text === 'string' ? m.extra.display_text : ''}\n${String(m.mes || '')}`;
        for (const mm of text.matchAll(PREFIX_RE)) add(mm[1], 3);
        const ft = foldName(text);
        for (const [k, n] of known) if (k.length >= 2 && startsWord(ft, k)) add(n, 1);
    }
    // 같은 사람 묶기: 연결표 · 이름으로 이어지는 목소리(엔진 자동 맞춤이면 실제로 읽는 목소리)가 같으면 한 줄
    const voiceKey = (n) => { const uid = (s.char_map || {})[n] || voices.voiceByName(n)?.uid || ''; return uid ? `v:${effUid(uid, n)}` : `n:${foldName(n)}`; };
    const persona = foldName(ctx.name1);
    const groups = new Map();
    for (const [n, w] of score) {
        const f = foldName(n);
        if (!f || f === persona || taken.names.has(f)) continue;
        const key = voiceKey(n);
        if (taken.keys.has(key)) continue;
        const g = groups.get(key) || { names: [], w: 0 };
        g.names.push(n); g.w += w; groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.w - a.w).slice(0, SPEAKER_ROWS).map(g => {
        const label = g.names.find(n => Object.prototype.hasOwnProperty.call(s.char_map || {}, n)) || g.names.sort((a, b) => (score.get(b) || 0) - (score.get(a) || 0))[0];
        return label;
    });
}
function chatSpeakersHtml(s, colorRowsList) {
    const taken = { names: new Set(), keys: new Set() };
    const keyOf = (n) => { const uid = (s.char_map || {})[n] || voices.voiceByName(n)?.uid || ''; return uid ? `v:${effUid(uid, n)}` : `n:${foldName(n)}`; };
    for (const n of [...colorRowsList.map(r => r.name).filter(Boolean), ...chatNames()]) { taken.names.add(foldName(n)); taken.keys.add(keyOf(n)); }
    const names = chatSpeakers(s, taken);
    if (!names.length) return '';
    const rows = names.map(n => mapRow(n, (s.char_map || {})[n] || voices.voiceByName(n)?.uid || '', `data-lv-map="${esc(n)}"`, n));
    return `<div class="lv-sub"><span>이 채팅의 캐릭터</span></div><div class="lv-rows">${rows.join('')}</div>`;
}
function colorsCardHtml() {
    const s = settings();
    const rows = colorRows();
    const speakersPart = chatSpeakersHtml(s, rows);   // 1.4.0
    // 1.4.1 사용자: "동명이인일 때만 두 명이면 좋겠다 · 드림주나 우리엘은 동명이인이 아니잖아" — 이름 없는 새 색인데 추천 이름이
    //   이미 있는 사람이면 따로 줄을 만들지 않고 그 사람 줄의 점에 함께 칠한다. 이름을 직접 같게 적은 두 색(진짜 동명이인)은 두 줄 그대로.
    //   추천도 없이 한 번만 본 색은 숨김 (읽기는 그대로 — 이름 없는 색의 대사는 화자 찾기 · 보낸 이 이름으로)
    const owner = new Map();
    for (const r of rows) if (r.name && !owner.has(foldName(r.name))) owner.set(foldName(r.name), r);
    const alts = new Map();
    const shown = [];
    for (const r of rows) {
        if (r.name) { shown.push(r); continue; }
        const sug = topVote(r) || (r.near && r.near.name) || '';
        const o = sug ? owner.get(foldName(sug)) : null;
        if (o) { if (!alts.has(o.color)) alts.set(o.color, []); alts.get(o.color).push(r.color); continue; }
        if (!sug && (Number(r.count) || 0) <= 1) continue;
        shown.push(r);
    }
    const body = (shown.length
        ? `<div class="lv-colors">${shown.map(r => colorRowHtml(r, s, alts.get(r.color) || [])).join('')}</div>`
        : (speakersPart ? '' : '<p class="lv-empty">아직 배운 색이 없어요</p>')) + speakersPart;
    const btns = '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="palette">프리셋에서 불러오기</button><button type="button" class="menu_button" data-lv-act="relearn">다시 배우기</button><button type="button" class="menu_button" data-lv-act="colors-clear">비우기</button></div>';
    return card('colors', 'fa-palette', '대화 색 (이 채팅)', body + btns, '', '', COLORS_HELP);
}
/** 1.3.8 목록 줄의 말투 칩: 그 목소리에 고른 말투(한국어 이름) — 엔진이 말투 이름을 줄 때만 */
function tagChipText(v) {
    let p = null;
    try { p = getProvider(v.provider); } catch { p = null; }
    const pv = v.params && v.params.voice_tags;
    if (!p || typeof p.tagLabels !== 'function' || !Array.isArray(pv) || !pv.length) return '';
    // 1.3.8 리뷰 p09: 그 목소리가 실제로 쓰는 모델(목소리 모델 포함)이 말투를 안 받으면 칩도 없음 (요청 · 키와 같은 판단 — paramsFor 의 when)
    const f = (p.params || []).find(x => x.key === 'voice_tags');
    try { if (f && typeof f.when === 'function' && !f.when(player.voiceCfg(p, v))) return ''; } catch { return ''; }
    try { return p.tagLabels(pv).join(' · '); } catch { return ''; }
}
/** 목록 한 줄: 한글 이름만 (언어·엔진·id 는 편집 팝업과 ▶ 들어보기에서) · 1.3.7 목소리 모델 · 1.3.8 말투 이름표 */
const STRENGTH_KO = { weak: '약하게', normal: '보통', strong: '강하게' };   // 1.4.0 목소리 줄의 감정 세기 칩
function voiceRowHtml(v) {
    const tags = tagChipText(v);
    return `<div class="lv-voice" data-uid="${esc(v.uid)}">
<button type="button" class="lv-icon" data-lv-act="test" data-uid="${esc(v.uid)}" aria-label="들어보기"><i class="fa-solid fa-play"></i></button>
<div class="lv-voice-name"><b>${esc(v.name)}</b>${v.use_model ? `<span class="lv-chip lv-model-chip">${esc(koModelLabel(v.provider, v.use_model))}</span>` : ''}${tags ? `<span class="lv-chip lv-model-chip lv-tag-sum">${esc(tags)}</span>` : ''}${v.strength ? `<span class="lv-chip lv-model-chip">감정 ${esc(STRENGTH_KO[v.strength] || '')}</span>` : ''}</div>
<button type="button" class="lv-icon" data-lv-act="edit" data-uid="${esc(v.uid)}" aria-label="편집"><i class="fa-solid fa-pen"></i></button>
<button type="button" class="lv-icon" data-lv-act="del" data-uid="${esc(v.uid)}" aria-label="삭제"><i class="fa-solid fa-xmark"></i></button></div>`;
}
function voiceRowsHtml() {
    const all = voices.shownVoices();   // 1.3.7
    const kw = state.search.trim().toLowerCase();
    const hit = (v) => !kw || [v.name, v.voiceId, v.group, ...(v.aliases || [])].some(x => String(x || '').toLowerCase().includes(kw));
    const list = all.filter(hit);
    if (!list.length) return '<p class="lv-empty">맞는 목소리가 없어요</p>';
    const groups = new Map();
    for (const v of list) { const g = v.group || '기타'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
    let h = '';
    for (const [g, arr] of groups) h += `<div class="lv-grp"><span>${esc(g)}</span><span class="lv-count">${arr.length}</span></div>` + arr.map(voiceRowHtml).join('');
    return h;
}
function renderVoiceRows() {
    const box = q('.lv-voices');
    if (box) box.innerHTML = voiceRowsHtml();
}
/** 1.3.7 숨긴 목소리 한 줄: 계정에 없음(지우기) · 키 없는 엔진 · 「엔진」으로 가린 다른 엔진 */
function hiddenLineHtml() {
    const h = voices.hiddenCounts();
    const parts = [];
    if (h.gone) parts.push(`계정에 없음 ${fmtNum(h.gone)}`);
    if (h.nokey) parts.push(`키 없는 엔진 ${fmtNum(h.nokey)}`);
    if (h.engine) parts.push(`다른 엔진 ${fmtNum(h.engine)}`);
    if (!parts.length) return '';
    const clear = h.gone ? ' <button type="button" class="lv-link" data-lv-act="gone-clear">계정에 없는 것 지우기</button>' : '';
    return `<span class="lv-desc lv-hidden-line">숨긴 목소리: ${parts.join(' · ')}${clear}</span>`;
}
function listCardHtml() {
    const all = voices.shownVoices();
    const body = all.length
        ? `<div class="lv-tools"><input type="search" class="text_pole" id="lv_search" placeholder="찾기" value="${esc(state.search)}" autocomplete="off"><input type="text" class="text_pole" id="lv_test_line" placeholder="들어볼 문장 (비우면 기본 문장)" value="${esc(state.testLine)}" autocomplete="off"></div><span class="lv-desc lv-test-info" id="lv_test_info"></span><div class="lv-voices">${voiceRowsHtml()}</div>`
        : '<p class="lv-empty">아직 목소리가 없어요</p>';
    // 5.7.2 '저절로 들어와요' 는 계정 맞춤이 도는 엔진(키 · 공식 서버)이 있을 때만
    const auto = providers().some(p => accountTrusted(p) && hasKey(p) && typeof p.listVoices === 'function');
    const hint = hiddenLineHtml() + `<span class="lv-desc">계정에서 불러오거나 목소리 ID를 직접 등록해요. MiniMax 목록은 JSON으로 가져올 수 있어요.${auto ? ' 계정에 새로 만든 목소리는 저절로 들어와요.' : ''}</span>`;
    let mixable = false;
    try { mixable = !!getProvider('minimax')?.caps?.mix && all.some(v => v.provider === 'minimax' && !(v.mix || []).length); } catch { mixable = false; }
    const btns = `<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="pull">계정에서 불러오기</button><button type="button" class="menu_button" data-lv-act="paste">목록 붙여넣기</button><button type="button" class="menu_button" data-lv-act="add">직접 추가</button>${mixable ? '<button type="button" class="menu_button" data-lv-act="add-mix">섞은 목소리</button>' : ''}</div>`;
    return card('list', 'fa-microphone-lines', all.length ? `목소리 목록 ${all.length}` : '목소리 목록', body + hint + btns);
}
function replaceCard(name, html) {
    const old = q(`[data-lv-card="${name}"]`);
    if (old) old.outerHTML = html;
}
export function renderVoices() {
    const pane = q('#lv_pane_voices');
    if (!pane) return;
    chatDirty = false;
    pane.innerHTML = mapCardHtml() + colorsCardHtml() + listCardHtml();
}
function renderMap() { replaceCard('map', mapCardHtml()); }
export function renderColors() { replaceCard('colors', colorsCardHtml()); }
// 5.6.4 채팅을 바꿀 때 목소리 탭이 안 보이면 다시 그리지 않고 표시만 해 둔다 (서랍이 닫힌 채로 채팅마다 151~433 ms@4x 를 썼다).
// 보이게 되면 그린다: 서랍 펼치기 · 팝업(openPanel) · 설정 창 안(mountInline) · 목소리 탭 · 그 밖의 길(확장 창 열기 등)은 ResizeObserver.
let chatDirty = false;
/** 목소리 탭이 지금 화면에 있는가 — 닫힌 것이 확실하면 스타일 계산 없이 false */
function paneShown(sel) {
    const pane = q(sel);
    if (!pane || !pane.isConnected || pane.closest('[hidden]')) return false;   // 다른 탭 · 꺼진 설정 · 보관함(#bl-tts-holder)
    const drawer = pane.closest('.drawer-content');
    if (drawer && !drawer.classList.contains('openDrawer')) return false;     // 실리태번 확장 창이 닫힘
    return pane.getClientRects().length > 0;
}
const voicesShown = () => paneShown('#lv_pane_voices');
/** 1.3.8 엔진 탭 · 설정 창(목소리 · 엔진 탭)이 지금 보이는가 — 페이지를 열 때 닫힌 서랍에서 팝업 · 요청을 내지 않게 */
const engineShown = () => paneShown('#lv_pane_engine');
const settingsShown = () => voicesShown() || engineShown();
export function refreshChat() {
    if (!root) return;
    if (!voicesShown()) { chatDirty = true; return; }
    chatDirty = false;
    renderMap();
    renderColors();
}
/** 채팅이 바뀐 뒤 아직 안 그린 캐릭터별 목소리 · 대화 색 카드를 그린다 (목소리 탭이 다른 탭에 가려 있으면 탭을 열 때). 그렸으면 true */
export function ensureFresh() {
    if (!root || !chatDirty) return false;
    const pane = q('#lv_pane_voices');
    if (!pane || pane.hidden) return false;
    chatDirty = false;
    renderMap();
    renderColors();
    return true;
}

// ---------- 목소리: 들어보기 · 삭제 · 불러오기 · 붙여넣기 · 직접 추가
const LANG_LABEL = { ko: '한국어', ja: '일본어', en: '영어', zh: '중국어' };
let testSeq = 0;   // 가장 최근 들어보기 — 앞의 것이 끝나며 뒤의 것 표시를 지우지 않게
/** 들어보기 줄 아래 한 줄: 엔진 · voiceId · 원어 (목록엔 한글 이름만 보이니 들어볼 때만) */
function setTestInfo(text) {
    const el = q('#lv_test_info');
    if (el) el.textContent = text;
}
async function testVoice(btn) {
    const v = voices.findVoice(btn.dataset.uid);
    if (!v) return;
    if (btn.classList.contains('lv-on')) { player.stop(); btn.classList.remove('lv-on'); setTestInfo(''); return; }
    for (const b of root.querySelectorAll('.lv-voice .lv-on')) b.classList.remove('lv-on');
    btn.classList.add('lv-on');
    const seq = ++testSeq;
    let pname = v.provider;
    try { pname = getProvider(v.provider)?.name || v.provider; } catch { /* 없는 엔진이면 id 그대로 */ }
    setTestInfo(`${pname} · ${v.voiceId} · ${LANG_LABEL[v.lang] || '자동'}`);
    const line = state.testLine.trim() || TEST_LINE[v.lang] || TEST_LINE.ko;
    try { await player.speakText(line, v.uid); }
    catch (e) { toast(e.message, 'error'); }
    finally {
        btn.classList.remove('lv-on');
        if (seq === testSeq) setTestInfo('');
    }
}
async function deleteVoice(uid) {
    const v = voices.findVoice(uid);
    if (!v) return;
    if (!(await confirm(`「${v.name}」 목소리를 목록에서 뺄까요?`))) return;
    voices.removeVoice(uid);
    save();
    renderVoices();
}
/** 엔진 고르기 팝업 → provider | null */
async function pickProvider(list, title, label = (p) => p.name) {
    if (list.length === 1) return list[0];
    const el = document.createElement('div');
    el.className = 'lv-editor';
    el.innerHTML = `<div class="lv-ed-head"><i class="fa-solid fa-plug"></i><span>${esc(title)}</span></div><select class="text_pole" name="pid" aria-label="엔진">${list.map(p => `<option value="${esc(p.id)}">${esc(label(p))}</option>`).join('')}</select>`;
    const r = await callGenericPopup(el, POPUP_TYPE.CONFIRM, '', { okButton: '다음', cancelButton: '취소' });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return null;
    const pid = el.querySelector('[name="pid"]').value;
    return list.find(p => p.id === pid) || null;
}
/** 5.7.2 묶음의 처음 켜짐: 내 목소리 · 50개 이하이면서 쓰는 언어(한국어 + 목록에 있는 목소리의 원어)이거나 언어를 모르는 묶음 (1.3.7 은 50개 이하면 모두 켜 Azure 657개 중 595개가 들어왔다) */
function groupOn(g, n, m) {
    if (m && m.own) return true;
    if (n > 50) return false;
    const langs = new Set(m ? m.langs : []);
    const loc = /^([a-z]{2,3})(?:-[A-Za-z0-9]{2,4})+$/.exec(String(g || ''));   // Azure 묶음 = 지역 이름 (fr-FR · zh-CN …)
    if (loc) langs.add(loc[1].toLowerCase());
    if (!langs.size) return true;
    const want = new Set(['ko', ...voices.allVoices().map(v => v.lang).filter(Boolean)]);
    return [...langs].some(l => want.has(l));
}
/** 큰 목록(시스템 목소리 수백 개)은 묶음을 골라 받는다 → Set | null */
async function pickGroups(p, groups, meta = new Map()) {
    const el = document.createElement('div');
    el.className = 'lv-editor';
    const rows = [...groups.entries()].map(([g, n]) => `<label class="checkbox_label lv-toggle"><input type="checkbox" value="${esc(g)}"${groupOn(g, n, meta.get(g)) ? ' checked' : ''}><span>${esc(g)}</span><span class="lv-count">${n}</span></label>`).join('');
    el.innerHTML = `<div class="lv-ed-head"><i class="fa-solid fa-download"></i><span>${esc(p.name)} 목소리 묶음</span></div><div class="lv-picks">${rows}</div>`;
    const r = await callGenericPopup(el, POPUP_TYPE.CONFIRM, '', { okButton: '불러오기', cancelButton: '취소' });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return null;
    return new Set([...el.querySelectorAll('input:checked')].map(i => i.value));
}
/**
 * 목소리 불러오기. auto = 1.3.8 연결 확인 뒤 저절로 (처음 쓰는 엔진만) — 사용자가 지운 목소리(account_removed)는 빼고 그 표시도 풀지 않는다
 * (지운 표시는 사용자가 직접 「불러오기」로 고를 때만 풂)
 */
async function pullVoices(p, { auto = false } = {}) {
    const cfg = providerConfig(p.id, p.defaults);
    if (!hasKey(p)) { toast(`${p.name} 키를 먼저 저장해요 (엔진 탭)`, 'warning'); return; }
    let list;
    try { list = await p.listVoices(cfg); }
    catch (e) { toast(e.message, 'error'); log('err', `${p.name} 목록 불러오기 실패: ${e.message}`); return; }
    const full = list;   // 계정 맞춤에는 거르기 전 목록 그대로
    if (auto && Array.isArray(list)) { const rm = new Set(voices.removedIds(p.id)); if (rm.size) list = list.filter(v => !rm.has(String(v.voiceId))); }
    if (!Array.isArray(list) || !list.length) { toast('불러온 목소리가 없어요', 'warning'); return; }
    // 5.7.2 한 묶음뿐인 큰 목록(내 목소리가 없는 MiniMax = 시스템 목소리 전부)은 언어로 나눠 고르게 · 묶음마다 내 목소리 · 언어 (처음 켜짐)
    const split = list.length > 30 && new Set(list.map(v => v.group || '기타')).size === 1;
    const keyOf = (v) => `${v.group || '기타'}${split ? ` · ${LANG_LABEL[v.lang] || '기타 언어'}` : ''}`;
    const groups = new Map(), meta = new Map();
    for (const v of list) {
        const g = keyOf(v);
        groups.set(g, (groups.get(g) || 0) + 1);
        const m = meta.get(g) || { own: false, langs: new Set() };
        if (v.own) m.own = true;
        if (v.lang) m.langs.add(v.lang);
        meta.set(g, m);
    }
    let pick = list;
    if (groups.size > 1 && list.length > 30) {
        const chosen = await pickGroups(p, groups, meta);
        if (!chosen) return;
        pick = list.filter(v => chosen.has(keyOf(v)));
    }
    if (!pick.length) return;
    const s = settings();
    const before = s.voices.length;
    const had = new Set(s.voices.filter(v => v.provider === p.id).map(v => String(v.voiceId)));
    // 1.3.8 내 목소리(own)가 아닌 줄 = 엔진의 기본 · 시스템 목소리 (stock): 캐릭터 이름만으로는 짝이 되지 않음 (voices.twinOf).
    //   upsertVoices 가 예전에 지웠던 목소리 표시(account_removed)도 푼다 — 사용자가 직접 골라 넣음
    const added = Number((voices.upsertVoices(pick.map(v => (v.own === true ? v : { ...v, stock: true })), p.id) || {}).added) || 0;
    // 1.3.8 새로 들어온 내 목소리도 다른 엔진의 같은 사람에게서 원어 · 묶음을 (계정 맞춤과 같게 — 맞춤이 먼저 넣으면 여기선 이미 있음)
    voices.inheritNew(p.id, pick.filter(v => v.own === true && !had.has(String(v.voiceId))).map(v => String(v.voiceId)));
    // 1.3.8 리뷰 p13: 계정 맞춤이 없는 엔진(OpenAI · Azure · Gemini …)은 1.3.7 에 불러온 기본 목소리에도 stock 표시를 (새 줄만 표시해 「nova」가 캐릭터 Nova 의 짝으로 남았다)
    if (!p.caps?.account) {
        const stockIds = new Set(list.filter(v => v.own !== true).map(v => String(v.voiceId)));
        for (const v of s.voices) if (v.provider === p.id && !v.stock && !(v.mix || []).length && stockIds.has(String(v.voiceId))) v.stock = true;
    }
    const def = voices.seedDefault(before, p.id);   // 5.7.2 처음 들어온 목소리면 기본 목소리도 (안 정한 화자가 조용하지 않게)
    save();
    // 1.3.7 계정에 없는 목소리 숨김 — MiniMax 직접 입력 서버는 빼고 (accountTrusted). 불러오기 목록이 거른 것이면(Typecast: 고른 모델) 계정 목록을 따로 받아서
    if (accountTrusted(p)) {
        if (typeof p.listFiltered === 'function' && p.listFiltered(cfg)) await autoSyncAccounts({ force: true, only: p.id });
        else { voices.syncAccount(p.id, full); s.account_sync[p.id] = Date.now(); syncFailAt.delete(p.id); }
    }
    renderVoices();
    toast(`${p.name}: ${added ? `${added}개 불러왔어요` : '새 목소리가 없어요'}${def ? ` · 기본 목소리 ${def.name}` : ''}`, 'success');
    await offerPrefer(p);   // 1.3.7 이름이 맞는 캐릭터가 있으면 이 엔진으로 바꿀지
}
// ---------- 1.3.7 계정 맞춤: 목소리 탭이 보일 때 엔진마다 6시간에 한 번 (키가 있는 엔진) — 실패는 조용히 (기록만)
// 5.7.2: 키를 저장 · 연결 확인하면 그 엔진은 바로 맞춘다. 목소리가 아직 하나도 없는 엔진도 (키만 넣고 목소리는 안 들어오던 것 — 사용자 제보)
//        새 내 목소리가 들어왔고 이름이 맞는 캐릭터가 있으면 그 엔진으로 바꿀지 한 번 묻는다 (offerPrefer)
// 1.3.8: 엔진마다 따로 · 함께 (꺼진 MiniMax 직접 입력 서버의 30초 시간 초과가 ElevenLabs 맞춤을 붙잡지 않게) ·
//        실패한 엔진은 10분 쉼 (메모리만 — 설정 파일은 폰과 같이 쓰니 다른 기기의 맞춤을 막지 않게) · 페이지를 열 때(서랍이 닫힘)는 하지 않음
const ACCOUNT_EVERY = 6 * 60 * 60 * 1000;
const SYNC_RETRY = 10 * 60 * 1000;
const syncing = new Map();     // 엔진 id → 진행 중인 맞춤 (약속)
const syncFailAt = new Map();  // 엔진 id → 마지막 실패 시각
const syncErr = new Map();     // 5.7.2 엔진 id → 마지막 계정 맞춤 실패 글 (연결 확인 줄에 — 기록에만 남으면 '연결됨' 인데 목소리가 안 들어오는 까닭을 모름)
const syncLine = (p, r) => `${p.name}: ${[r.added ? `새 목소리 ${r.added}개` : '', r.gone ? `계정에 없는 ${r.gone}개 숨김` : '', r.back ? `${r.back}개 다시 보임` : ''].filter(Boolean).join(' · ')}`;
/** 5.7.2 계정 맞춤을 믿을 수 있는 설정인가 — MiniMax 직접 입력 서버(집 PC 게이트웨이 · 중계)는 그 서버의 목소리만 알려 줘 나머지를 '계정에 없음'으로 숨긴다 */
function accountTrusted(p) {
    if (!p || !p.caps?.account) return false;
    try { return typeof p.accountOk !== 'function' || p.accountOk(providerConfig(p.id, p.defaults)) !== false; } catch { return false; }
}
/** 엔진 하나 계정 맞춤 → { added, gone, back, def? } | null (받지 못함 — 기록만) */
async function syncOne(p) {
    syncErr.delete(p.id);
    let list;
    try { list = await p.listVoices(providerConfig(p.id, p.defaults), { account: true }); }
    catch (e) {
        const m = (e && e.message) || String(e);
        syncErr.set(p.id, m);
        syncFailAt.set(p.id, Date.now());
        log('err', `${p.name} 계정 맞춤 실패: ${m}`);
        return null;
    }
    if (!Array.isArray(list) || !list.length) return null;   // 빈 목록은 믿지 않는다 (다 숨기지 않게)
    syncFailAt.delete(p.id);
    const s = settings();
    if (!isObjLike(s.account_sync)) s.account_sync = {};
    const before = s.voices.length;
    const r = voices.syncAccount(p.id, list);
    s.account_sync[p.id] = Date.now();
    if (r.added) r.def = voices.seedDefault(before, p.id);   // 5.7.2 처음 들어온 목소리면 기본 목소리도
    return r;
}
/** 엔진의 맞춤 하나 (이미 도는 중이면 그것에 붙음) */
function syncEngine(p) {
    let job = syncing.get(p.id);
    if (!job) {
        job = syncOne(p).finally(() => { if (syncing.get(p.id) === job) syncing.delete(p.id); });
        syncing.set(p.id, job);
    }
    return job;
}
async function autoSyncAccounts({ force = false, only = '' } = {}) {
    const s = settings();
    if (!isObjLike(s.account_sync)) s.account_sync = {};
    const now = Date.now();
    const due = [];
    let cleared = 0;
    for (const p of providers()) {
        if (only && p.id !== only) continue;
        if (!p.caps?.account || typeof p.listVoices !== 'function' || !hasKey(p)) continue;
        if (!accountTrusted(p)) { cleared += voices.clearGone(p.id); continue; }   // 5.7.2 직접 입력 서버 목록으로 숨겼던 목소리를 되돌림
        if (!force) {
            if (syncing.has(p.id)) continue;                                    // 다른 쪽이 맞추는 중 (그쪽이 알림)
            const at = Number(s.account_sync[p.id]) || 0;
            if (now - at >= 0 && now - at < ACCOUNT_EVERY) continue;
            const f = syncFailAt.get(p.id) || 0;
            if (now - f >= 0 && now - f < SYNC_RETRY) continue;
        }
        due.push(p);
    }
    const results = await Promise.all(due.map(async (p) => {
        // 강제(키 저장 · 연결 확인): 도는 중인 맞춤은 옛 키였을 수 있다 → 끝난 뒤 새로
        if (force && syncing.has(p.id)) { try { await syncing.get(p.id); } catch { /* 그쪽 실패는 그쪽에서 */ } }
        try { return [p, await syncEngine(p)]; } catch { return [p, null]; }
    }));
    const msgs = [], offers = [];
    let changed = false;
    for (const [p, r] of results) {
        if (!r) continue;
        changed = true;
        if (r.added || r.gone || r.back) msgs.push(syncLine(p, r) + (r.def ? ` · 기본 목소리 ${r.def.name}` : ''));
        if (r.added) offers.push(p);
    }
    if (changed || cleared) save();
    if (msgs.length || cleared) { renderVoices(); if (msgs.length) toast(msgs.join('\n'), 'success'); }
    for (const p of offers) await offerPrefer(p, { auto: true });   // 새 목소리가 들어온 엔진: 이름이 맞는 캐릭터를 그 엔진으로 바꿀지 (맞는 게 없으면 안 물음 · 설정 창이 안 보이면 미룸)
}
/** 1.3.8 목소리 탭이 보이면 계정 맞춤 (6시간 · 실패 뒤 10분) — 페이지를 열 때 닫힌 서랍에서는 하지 않음 (요청 없음) */
function syncIfShown() { if (voicesShown()) void autoSyncAccounts(); }
const isObjLike = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
async function pullFromAccount() {
    // 5.7.2 키가 필요한 엔진도 보여 준다: 키 저장됨 → 키 없이 되는 엔진 → 키 없음 (1.3.7 은 키가 없으면 무료 셋만 · 맨 앞 'OpenAI 호환'이 골라져 있었다)
    const all = providers().filter(p => p.caps && p.caps.list && typeof p.listVoices === 'function');
    if (!all.length) { toast('쓸 수 있는 엔진이 없어요', 'warning'); return; }
    const tab = settings().ui.provider_tab;
    const rank = (p) => (p.needsKey && hasKey(p) ? 0 : p.id === tab ? 1 : !p.needsKey ? 2 : 3);   // 키 저장됨 → 엔진 탭에서 고른 엔진 → 키 없이 되는 엔진 → 키 없음
    const list = all.slice().sort((a, b) => rank(a) - rank(b));
    const p = await pickProvider(list, '어느 엔진에서 불러올까요', (x) => x.name + (x.needsKey && !hasKey(x) ? ' · 키 없음' : ''));
    if (!p) return;
    if (!hasKey(p)) {   // 키가 없는 엔진: 그 엔진의 키 칸으로
        settings().ui.provider_tab = p.id; save(); renderEngine(); showTab('engine');
        q('#lv_key_input')?.focus();
        toast(`${p.name} 키를 넣고 저장하면 목소리를 불러와요`, 'info');
        return;
    }
    await pullVoices(p);
}
async function pasteList() {
    const raw = await callGenericPopup('MiniMax 목소리 목록 JSON을 붙여넣으세요. 예: [{"voiceId":"my_voice_id","name":"안내","lang":"ko","group":"내 목소리"}]', POPUP_TYPE.INPUT, '', { rows: 6, okButton: '가져오기' });
    if (!raw || typeof raw !== 'string') return;
    try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) throw new Error('목록 형식이 아니에요');
        const r = voices.importStudioList(arr) || {};
        save();
        renderVoices();
        const added = Number(r.added) || 0, updated = Number(r.updated) || 0;
        toast(added || updated ? `${added}개 추가 · ${updated}개 갱신` : '바뀐 목소리가 없어요', 'success');
    } catch (e) { toast(e.message || '가져오기 실패', 'error'); }
}
async function addVoice() {
    const list = providers();
    if (!list.length) { toast('쓸 수 있는 엔진이 없어요', 'warning'); return; }
    const p = await pickProvider(list, '어느 엔진의 목소리인가요');
    if (p) await openVoiceEditor(null, { provider: p.id });
}

// ---------- 목소리 편집 팝업
const EDF = new Map();   // 편집 중인 엔진 조절 항목 key → Field
function edField(label, ctl, wide = false, desc = '') {
    return `<label class="lv-field${wide ? ' lv-wide' : ''}"><span class="lv-label">${esc(label)}</span>${ctl}${desc ? `<span class="lv-desc">${esc(desc)}</span>` : ''}</label>`;
}
function edControl(f, val, disabled, cfg, voice) {
    const dis = disabled ? ' disabled' : '';
    switch (f.type) {
        case 'tags':
            return tagChipsHtml(f, val, { disabled, cfg, voice });   // 1.3.8 말투 칩 (lv-param-in)
        case 'toggle':
            return `<label class="checkbox_label lv-toggle"><input type="checkbox" class="lv-param-in"${val ? ' checked' : ''}${dis}><span>켬</span></label>`;
        case 'select':
            return `<select class="text_pole lv-param-in"${dis}>${optionsHtml(f, val, cfg, voice)}</select>`;
        case 'range':
            return `<span class="lv-range-in"><input type="range" class="lv-param-in"${numAttrs(f)} value="${esc(val)}"${dis}><output>${esc(fmtRange(f, val))}</output></span>`;
        case 'number':
            return `<input type="number" class="text_pole lv-param-in"${numAttrs(f)} value="${esc(val)}"${dis}>`;
        case 'textarea':
            return `<textarea class="text_pole lv-param-in" rows="2"${dis}>${esc(val ?? '')}</textarea>`;
        default:
            return `<input type="text" class="text_pole lv-param-in" value="${esc(val ?? '')}"${dis} autocomplete="off">`;
    }
}
/** 편집 팝업의 조절 항목 하나. voice 를 넘겨 엔진이 목소리별 선택지를 줄 수 있게 (Azure 말투) */
function edParam(f, params, cfg, voice) {
    EDF.set(f.key, f);
    const has = Object.prototype.hasOwnProperty.call(params, f.key);
    const val = has ? params[f.key] : (cfg[f.key] ?? f.default);
    const help = helpBtn(f);   // 1.3.8 '?' 도움말 (이 팝업의 클릭은 bindEditor 가)
    const name = help ? `<span class="lv-name">${esc(f.label)}${help}</span>` : esc(f.label);
    return `<div class="lv-field lv-param${f.type === 'textarea' || f.type === 'tags' ? ' lv-wide' : ''}" data-key="${esc(f.key)}"${help ? ' data-lv-help' : ''}><span class="lv-label">${name}<label class="lv-def"><input type="checkbox" class="lv-def-chk"${has ? '' : ' checked'}><span>기본값</span></label></span>${edControl(f, val, !has, cfg, voice)}${helpNote(f)}</div>`;
}
function mixRowHtml(m, opts) {
    return `<div class="lv-mix-row"><select class="text_pole lv-mix-voice"><option value="">목소리</option>${opts.map(o => `<option value="${esc(o.voiceId)}"${o.voiceId === m.voiceId ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select><input type="number" class="text_pole lv-mix-w" min="1" max="100" step="1" value="${esc(m.weight)}"><button type="button" class="lv-icon lv-mix-del" aria-label="빼기"><i class="fa-solid fa-xmark"></i></button></div>`;
}
const mixCandidates = () => voices.allVoices().filter(x => x.provider === 'minimax' && !(x.mix || []).length);
function mixHtml(v) {
    const opts = mixCandidates();
    const rows = (v.mix.length ? v.mix : [{ voiceId: '', weight: 50 }, { voiceId: '', weight: 50 }]).map(m => mixRowHtml(m, opts)).join('');
    return `<div class="lv-sub"><span>섞기</span><span class="lv-desc">2–4개 · 비중 1–100</span></div><div class="lv-mix">${rows}</div><div class="lv-actions"><button type="button" class="menu_button lv-mix-add">추가</button></div>`;
}
const fmtDb = (v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)} dB`;
/** 1.3.7 목소리마다 모델: 엔진 설정대로 · 엔진의 모델 목록 (늘 최신 · 한국어 이름) · 직접 입력. 모델 칸이 없는 엔진은 없음 */
function modelFieldHtml(v, p, cfg) {
    const f = (p.fields || []).find(x => x.key === 'model' && x.type === 'select');
    if (!f) return '';
    let list = [];
    try { list = optionsOf(f, { ...cfg, model: v.use_model || cfg.model }, v) || []; } catch { list = []; }
    list = list.filter(o => String(o.value) !== ttsModels.CUSTOM);
    const cur = String(v.use_model || '');
    const inList = !cur || list.some(o => String(o.value) === cur);
    const engineLabel = (() => { const m = String(cfg.model === ttsModels.CUSTOM ? cfg.model_custom || '' : cfg.model || ''); return m ? `엔진 설정대로 (${koModelLabel(p.id, m)})` : '엔진 설정대로'; })();
    const opts = [`<option value=""${cur ? '' : ' selected'}>${esc(engineLabel)}</option>`,
        ...list.map(o => `<option value="${esc(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${esc(o.label)}</option>`),
        `<option value="${ttsModels.CUSTOM}"${inList ? '' : ' selected'}>직접 입력</option>`];
    return `<label class="lv-field"><span class="lv-label">모델</span><select class="text_pole" name="use_model">${opts.join('')}</select><input type="text" class="text_pole lv-model-custom" name="use_model_custom" value="${esc(inList ? '' : cur)}" placeholder="모델 이름"${inList ? ' hidden' : ''} autocomplete="off"></label>`;
}
function editorHtml(v, p, o) {
    EDF.clear();
    const cfg = providerConfig(p.id, p.defaults);
    const opt = (pairs, cur) => pairs.map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${l}</option>`).join('');
    const groups = [...new Set(voices.allVoices().map(x => x.group).filter(Boolean))];
    let h = `<div class="lv-ed-head"><i class="fa-solid fa-microphone-lines"></i><span>${o.isNew ? '새 목소리' : '목소리 편집'}</span><span class="lv-chip">${esc(p.name)}</span></div><div class="lv-grid">`;
    h += edField('이름', `<input type="text" class="text_pole" name="name" value="${esc(v.name)}" autocomplete="off">`);
    h += edField('그룹', `<input type="text" class="text_pole" name="group" value="${esc(v.group)}" list="lv_ed_groups" autocomplete="off"><datalist id="lv_ed_groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>`);
    h += edField('다른 이름', `<input type="text" class="text_pole" name="aliases" value="${esc(v.aliases.join(', '))}" placeholder="쉼표로 구분" autocomplete="off">`);
    h += edField('원어', `<select class="text_pole" name="lang">${opt([['', '자동'], ['ko', '한국어'], ['ja', '일본어'], ['en', '영어'], ['zh', '중국어']], v.lang)}</select>`, false, '원어로 번역해서 읽기를 켜면 이 언어로 읽어요');
    if (!o.isMix) h += edField('voiceId', `<input type="text" class="text_pole" name="voiceId" value="${esc(v.voiceId)}"${o.isNew ? '' : ' readonly'} autocomplete="off">`);
    h += edField('원문 / 번역문', `<select class="text_pole" name="prefer_source">${opt([['auto', '설정대로'], ['display', '번역문'], ['original', '원문']], v.prefer_source)}</select>`);
    h += `<label class="lv-field lv-range"><span class="lv-label">음량 보정<output>${fmtDb(v.gainDb)}</output></span><input type="range" name="gainDb" min="-12" max="18" step="0.5" value="${esc(v.gainDb)}"></label>`;
    h += modelFieldHtml(v, p, cfg);
    h += edField('엑스트라', `<select class="text_pole" name="extra">${opt([['', '안 씀'], ['m', '남'], ['f', '여']], v.extra || '')}</select>`);
    h += edField('감정 세기', `<select class="text_pole" name="strength">${opt([['', '전체 설정대로'], ['weak', '약하게'], ['normal', '보통'], ['strong', '강하게']], v.strength || '')}</select>`);   // 1.4.0
    h += '</div>';
    const merged = { ...cfg, ...v.params, ...(v.use_model ? { model: v.use_model } : {}) };   // 1.3.7 이 목소리의 모델로 조절 항목을 고름
    const params = (p.params || []).filter(f => f.voice && (!f.show || f.show(merged)));
    if (params.length) h += `<div class="lv-sub"><span>조절</span><span class="lv-desc">기본값을 끄면 이 목소리만 다르게</span></div><div class="lv-grid">${params.map(f => edParam(f, v.params, cfg, v)).join('')}</div>`;
    if (p.caps && p.caps.instructions) h += `<label class="lv-field lv-wide"><span class="lv-label">말투 지시</span><textarea class="text_pole" name="instructions" rows="3">${esc(v.instructions)}</textarea></label>`;
    if (o.isMix) h += mixHtml(v);
    return h;
}
function bindEditor(el) {
    el.addEventListener('input', (e) => {
        const t = e.target;
        if (t.type !== 'range') return;
        const out = t.closest('.lv-range, .lv-range-in')?.querySelector('output');
        if (!out) return;
        if (t.name === 'gainDb') out.textContent = fmtDb(t.value);
        else { const f = EDF.get(t.closest('.lv-param')?.dataset.key); if (f) out.textContent = fmtRange(f, t.value); }
    });
    el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.name === 'use_model') {   // 1.3.7 직접 입력을 고르면 이름 칸
            const box = t.parentElement?.querySelector('.lv-model-custom');
            if (box) { box.hidden = t.value !== ttsModels.CUSTOM; if (!box.hidden) box.focus(); }
            return;
        }
        if (!t.classList.contains('lv-def-chk')) return;
        const inp = t.closest('.lv-param')?.querySelector('.lv-param-in');
        if (!inp) return;
        if (inp.classList.contains('lv-tag-chips')) {   // 1.3.8 말투 칩: 묶음 표시 + 칩마다
            if (t.checked) inp.setAttribute('aria-disabled', 'true'); else inp.removeAttribute('aria-disabled');
            for (const c of inp.querySelectorAll('.lv-tag-chip')) c.disabled = t.checked;
            return;
        }
        inp.disabled = t.checked;
    });
    el.addEventListener('click', (e) => {
        const hb = e.target.closest('.lv-help-btn');                  // 1.3.8 '?' 도움말 (팝업은 설정 창 밖이라 여기서)
        if (hb) { e.preventDefault(); toggleHelp(hb); return; }
        const chip = e.target.closest('.lv-tag-chip');                // 1.3.8 말투 칩
        if (chip) {
            e.preventDefault();
            const box = chip.closest('.lv-tag-chips');
            if (!box || box.getAttribute('aria-disabled') === 'true' || chip.disabled) return;
            const on = chip.getAttribute('aria-pressed') === 'true';
            if (!on && box.querySelectorAll('.lv-tag-chip[aria-pressed="true"]').length >= TAG_MAX) { toast(`말투는 ${TAG_MAX}개까지 골라요`, 'warning'); return; }
            chip.setAttribute('aria-pressed', String(!on));
            return;
        }
        const del = e.target.closest('.lv-mix-del');
        if (del) { del.closest('.lv-mix-row')?.remove(); return; }
        if (e.target.closest('.lv-mix-add')) {
            const box = el.querySelector('.lv-mix');
            if (box && box.children.length < 4) box.insertAdjacentHTML('beforeend', mixRowHtml({ voiceId: '', weight: 50 }, mixCandidates()));
        }
    });
}
function readMix(el) {
    return [...el.querySelectorAll('.lv-mix-row')]
        .map(r => ({ voiceId: r.querySelector('.lv-mix-voice').value, weight: clamp(Math.round(Number(r.querySelector('.lv-mix-w').value) || 50), 1, 100) }))
        .filter(m => m.voiceId)
        .slice(0, 4);
}
function validateEditor(el, o) {
    const val = (n) => (el.querySelector(`[name="${n}"]`)?.value || '').trim();
    if (o.isMix) {
        const mix = readMix(el);
        if (new Set(mix.map(m => m.voiceId)).size < 2) return '섞을 목소리를 두 개 이상 골라요';
        return null;
    }
    if (o.isNew && !val('voiceId')) return 'voiceId를 넣어요';
    if (!val('name') && !val('voiceId')) return '이름을 넣어요';
    return null;
}
function readEditor(el, v, p, o) {
    const val = (n) => el.querySelector(`[name="${n}"]`)?.value ?? '';
    const out = { ...v };
    out.name = val('name').trim();
    out.group = val('group').trim() || '기타';
    out.aliases = val('aliases').split(/[,、]/).map(x => x.trim()).filter(Boolean);
    out.lang = val('lang');
    out.prefer_source = val('prefer_source') || 'auto';
    { const st = val('strength'); if (['weak', 'normal', 'strong'].includes(st)) out.strength = st; else delete out.strength; }   // 1.4.0 이 목소리만 감정 세기
    out.gainDb = clamp(Number(val('gainDb')) || 0, -12, 18);
    if (!o.isMix) out.voiceId = o.isNew ? val('voiceId').trim() : v.voiceId;
    // 1.3.8 리뷰 p10: 저장된 값에서 시작해 그려진 칸만 바꾼다 — 지금 모델이 숨긴 칸(말투 · 속도 …)의 값은 그대로 (모델을 바꿨다 되돌려도 남게)
    const params = { ...(isObj(v.params) ? v.params : {}) };
    for (const box of el.querySelectorAll('.lv-param')) {
        const f = EDF.get(box.dataset.key);
        const chk = box.querySelector('.lv-def-chk');
        const inp = box.querySelector('.lv-param-in');
        if (!f || !inp) continue;
        if (chk && chk.checked) { delete params[f.key]; continue; }
        if (f.type === 'tags') { params[f.key] = [...inp.querySelectorAll('.lv-tag-chip[aria-pressed="true"]')].map(c => c.dataset.tag).filter(Boolean); continue; }   // 1.3.8 [] = 이 목소리는 말투 없음
        params[f.key] = coerce(f, inp);
    }
    out.params = params;
    // 1.3.7 이 목소리만 쓰는 모델 ('' = 엔진 설정대로 — 칸을 지움) · 엑스트라로도 쓰기
    const um = val('use_model');
    const model = um === ttsModels.CUSTOM ? val('use_model_custom').trim() : um;
    if (model) out.use_model = model; else delete out.use_model;
    const ex = val('extra');
    if (ex === 'm' || ex === 'f') out.extra = ex; else delete out.extra;
    if (p.caps && p.caps.instructions) out.instructions = val('instructions');
    if (o.isMix) {
        out.mix = readMix(el);
        if (o.isNew) out.voiceId = 'mix-' + hash(out.mix.map(m => `${m.voiceId}:${m.weight}`).sort().join('|'));
    }
    if (!out.name) out.name = o.isMix ? '섞은 목소리' : out.voiceId;
    if (!o.isNew && out.name !== v.name) out.name_custom = true;   // 1.4.0 직접 바꾼 이름은 계정 맞춤이 덮지 않음
    return out;
}
/** 목소리 편집 (uid 없으면 새로 만들기: opts.provider, opts.mix) */
export async function openVoiceEditor(uid, opts = {}) {
    const s = settings();
    const cur = uid ? voices.findVoice(uid) : null;
    if (uid && !cur) return;
    const pid = cur ? cur.provider : (opts.provider || s.ui.provider_tab || 'minimax');
    let p = null;
    try { p = getProvider(pid); } catch { p = null; }
    if (!p) { toast(`엔진을 못 찾았어요: ${pid}`, 'error'); return; }
    const v = cur
        ? toVoice(JSON.parse(JSON.stringify(cur)), pid)
        : toVoice({ voiceId: '', name: '', group: opts.mix ? '섞음' : '직접 추가', lang: '' }, pid);
    const o = { isNew: !cur, isMix: !!(p.caps && p.caps.mix && (v.mix.length || opts.mix)) };
    const el = document.createElement('div');
    el.className = 'lv-editor';
    el.innerHTML = editorHtml(v, p, o);
    bindEditor(el);
    const r = await callGenericPopup(el, POPUP_TYPE.CONFIRM, '', {
        okButton: '저장', cancelButton: '취소', wide: true, allowVerticalScrolling: true,
        onClosing: (popup) => {
            if (popup.result !== POPUP_RESULT.AFFIRMATIVE) return true;
            const err = validateEditor(el, o);
            if (err) { toast(err, 'warning'); return false; }
            return true;
        },
    });
    if (r !== POPUP_RESULT.AFFIRMATIVE) return;
    const raw = readEditor(el, v, p, o);
    if (o.isNew) delete raw.uid;     // 새 목소리: uid 는 엔진:voiceId 로 다시 만든다
    const out = toVoice(raw, pid);
    if (!o.isNew) out.uid = v.uid;   // 편집은 uid 를 지킨다 (char_map 연결 유지)
    const arr = s.voices;
    const i = arr.findIndex(x => x.uid === out.uid);
    // 1.2.5 목록 보정 · 만든 모델은 편집 칸이 아님: 같은 목소리를 새로 추가해 덮어써도 있던 값을 지키고, 빈 칸은 이름표로
    const prev = i >= 0 ? arr[i] : null;
    if (prev && !hasDb(out.autoGainDb) && hasDb(prev.autoGainDb)) out.autoGainDb = prev.autoGainDb;
    if (prev && !out.model && prev.model) out.model = prev.model;
    fillKnownFacts(out);
    if (i >= 0) arr[i] = out; else arr.push(out);
    save();
    renderVoices();
    toast(o.isNew ? `${out.name} 추가` : `${out.name} 저장`, 'success');
}

// ---------- 엔진 탭
function engineCardHtml(p) {
    const cfg = providerConfig(p.id, p.defaults);
    const kf = keyField(p);
    let head = '';
    if (kf) {
        const has = !!cfg[kf.key];
        head = `<div class="lv-key"><input type="password" class="text_pole" id="lv_key_input" placeholder="${esc(kf.label || 'API 키')}" autocomplete="off"><button type="button" class="menu_button" data-lv-act="key-save">저장</button><button type="button" class="menu_button" data-lv-act="key-test">연결 확인</button></div>`
            + `<div class="lv-key-state"><span>${has ? `저장됨 ${esc(shownKey(cfg[kf.key]))}` : '키 없음'}</span>${has ? '<button type="button" class="lv-x" data-lv-act="key-clear" aria-label="키 지우기"><i class="fa-solid fa-xmark"></i></button>' : ''}</div>`
            + balanceSlotHtml(p, cfg);
    } else {
        head = '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="key-test">연결 확인</button></div>';
    }
    head += '<div class="lv-test-result" id="lv_test_result"></div>';
    const base = `providers.${p.id}.`;
    const fields = fieldsHtml(p.fields || [], base, cfg);
    const params = fieldsHtml(p.params || [], base, cfg);
    const fh = fields ? `<div class="lv-grid">${fields}</div>` : '';
    const ph = params ? `<div class="lv-sub"><span>조절</span></div><div class="lv-grid">${params}</div>` : '';
    const pull = p.caps && p.caps.list ? '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="engine-pull">목소리 불러오기</button></div>' : '';
    const note = p.direct === false ? '<span class="lv-desc">실리태번 서버를 거쳐 요청해요</span>' : '';
    return card('engine', 'fa-plug', p.name, head + fh + ph + pull + note);
}
export function renderEngine() {
    const pane = q('#lv_pane_engine');
    if (!pane) return;
    const s = settings();
    const list = providers();
    if (!list.length) { pane.innerHTML = card('engine', 'fa-plug', '엔진', '<p class="lv-empty">쓸 수 있는 엔진이 없어요</p>'); return; }
    if (!list.some(p => p.id === s.ui.provider_tab)) { s.ui.provider_tab = list[0].id; save(); }
    const pid = s.ui.provider_tab;
    // 드롭다운 하나 (번역기의 모델 목록처럼): 이름 뒤에 키 상태 — 키 있음 · 키가 꼭 필요한데 없음 · 키 없이 되는 엔진은 아무것도
    const suffix = (p) => {
        const kf = keyField(p);
        if (kf && providerConfig(p.id, p.defaults)[kf.key]) return ' · 키 저장됨';
        return p.needsKey ? ' · 키 없음' : '';
    };
    const opts = list.map(p => `<option value="${esc(p.id)}"${p.id === pid ? ' selected' : ''}>${esc(p.name + suffix(p))}</option>`).join('');
    pane.innerHTML = `<select class="text_pole lv-engine-pick" id="lv_engine_pick" aria-label="엔진">${opts}</select>` + engineCardHtml(list.find(p => p.id === pid));
    balanceIfShown();   // 1.3.8 보일 때만 (페이지를 열 때 그리는 것은 서랍이 닫혀 있어 건너뜀 — 펼치면 ResizeObserver 가)
    autoEngineModels();   // 1.3.7 보이는 카드일 때만 (페이지를 열 때 그리는 것은 서랍이 닫혀 있어 건너뜀)
}
// ---------- 1.3.7 엔진 모델 목록 — 늘 최신. 엔진이 listModels 를 주면: 카드가 보일 때 12시간이 지났으면 조용히 받아 옴 ·
//   ↻ · 연결 확인 · 키 저장은 바로. 받은 목록은 providers/_models.js 가 localStorage 에 (settings.json 아님).
//   실패는 조용히 (예전 목록 그대로 · 기록만), 자동은 엔진마다 10분에 한 번까지. 고른 모델은 절대 바꾸지 않는다 (목록에 없으면 그대로 보임)
const MODEL_PATH = /^providers\.([\w-]+)\.model$/;
const MODEL_RETRY = 10 * 60 * 1000;
const modelBusy = new Set();      // 받아 오는 중인 엔진 id (↻ 도는 표시)
const modelAuto = new Map();      // `${엔진}|${scope}` → 마지막 자동 시도 시각
const modelScopeOf = (p, cfg) => (typeof p.modelScope === 'function' ? String(p.modelScope(cfg || {}) || '') : '');
/** 목록을 받아 올 수 있나: listModels 가 있고 (키가 있거나 키 없이 되는 목록) */
const canListModels = (p) => !!p && typeof p.listModels === 'function' && (p.modelsPublic === true || (p.needsKey ? hasKey(p) : false));
/** data-lv-path 가 엔진의 model 칸이고 그 엔진이 목록을 받아 올 수 있으면 그 엔진 */
function listingProvider(path) {
    const m = MODEL_PATH.exec(String(path || ''));
    const p = m ? getProvider(m[1]) : null;
    return canListModels(p) ? p : null;
}
function engineModelsBtn(p) {
    const busy = modelBusy.has(p.id);
    return `<button type="button" class="lv-icon" data-lv-act="engine-models" aria-label="모델 목록 새로고침"${busy ? ' disabled aria-busy="true"' : ''}><i class="fa-solid fa-rotate${busy ? ' fa-spin' : ''}"></i></button>`;
}
function setEngineModelsBusy(p) {
    if (curProvider() !== p) return;
    const b = q('[data-lv-card="engine"] [data-lv-act="engine-models"]');
    if (!b) return;
    const on = modelBusy.has(p.id);
    b.disabled = on;
    if (on) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
    b.querySelector('i')?.classList.toggle('fa-spin', on);
}
/** el 안의 입력칸에 포커스가 있으면 el 을 떠날 때 fn (손가락 밑 · 적는 중인 칸을 다시 그려 포커스를 뺏지 않게) */
function whenLeft(el, fn) {
    const inside = () => { const a = document.activeElement; return !!a && el.contains(a) && typeof a.matches === 'function' && a.matches('input, select, textarea'); };
    if (!inside()) { fn(); return; }
    if (el.dataset.lvLater) return;
    el.dataset.lvLater = '1';
    const on = () => setTimeout(() => {
        if (inside()) return;   // el 안에서 옮겨 감 — 더 기다림
        el.removeEventListener('focusout', on);
        delete el.dataset.lvLater;
        if (el.isConnected) fn();
    }, 0);
    el.addEventListener('focusout', on);
}
/** 받은 목록을 화면에: 보이는 항목이 달라졌으면(받은 목록의 모델 정보) 카드째, 아니면 모델 select 의 선택지만 */
function paintEngineModels(p) {
    setEngineModelsBusy(p);
    if (curProvider() !== p) return;
    const cardEl = q('[data-lv-card="engine"]');
    if (!cardEl) return;
    const cfg = providerConfig(p.id, p.defaults);
    if (visibleChanged('engine', [...(p.fields || []), ...(p.params || [])], `providers.${p.id}.`, cfg)) {
        whenLeft(cardEl, () => { if (curProvider() === p) rerenderEngineCard(p); });
        return;
    }
    const path = `providers.${p.id}.model`;
    const sel = cardEl.querySelector(`select[data-lv-path="${CSS.escape(path)}"]`);
    const f = FIELDS.get(path);
    if (!sel || !f) return;
    whenLeft(sel, () => {
        const c = providerConfig(p.id, p.defaults);
        sel.innerHTML = optionsHtml(f, c[f.key] ?? f.default ?? '', c);
    });
}
/** 목록 받기 (엔진의 listModels 가 같은 요청을 하나로 묶고 캐시에 넣음). quiet = 자동 · 연결 확인 (토스트 없음) */
async function refreshEngineModels(p, { quiet = true } = {}) {
    if (!p || typeof p.listModels !== 'function') return null;
    if (!canListModels(p)) { if (!quiet) toast(`${p.name} 키를 먼저 저장해요`, 'warning'); return null; }
    modelBusy.add(p.id);
    setEngineModelsBusy(p);
    const tag = keyTag(p);   // 1.3.8 그 사이 키를 바꾸면 옛 키의 결과는 알리지도 기록하지도 않음 (틀린 키 → 맞는 키: 'API 키가 맞지 않아요' 가 두 번 남았다)
    try {
        const list = await p.listModels(providerConfig(p.id, p.defaults));
        const n = Array.isArray(list) ? list.length : 0;
        if (!quiet && keyTag(p) === tag) toast(n ? `모델 ${fmtNum(n)}개` : '빈 목록이에요', n ? 'success' : 'warning');
        return list;
    } catch (e) {
        if (keyTag(p) !== tag) return null;
        // 토스트엔 상태만 (' · ' 뒤의 업체 글은 싣지 않음) — 기록엔 가린 조각까지
        const m = String((e && e.message) || '실패');
        if (!quiet) toast(`모델 목록 · ${m.split(' · ')[0] || '실패'}`, 'error');
        log('err', `${p.name} 모델 목록 실패: ${m.slice(0, 80)}`);
        return null;
    } finally {
        modelBusy.delete(p.id);
        paintEngineModels(p);
    }
}
/**
 * 엔진 카드가 보일 때(서랍을 열 때 · 엔진 탭 · 엔진을 바꿀 때) 목록이 12시간 지났으면 조용히 받는다. 페이지를 열 때는 안 함 (서랍이 닫혀 있음).
 * 주소가 바뀌는 엔진(OpenAI)은 기본 주소이거나 전에 받은 주소일 때만 — 새로 적은 주소(오타)로 키가 저절로 가지 않게 (↻ · 연결 확인으로는 됨)
 */
function autoModelsDue(p, now = Date.now()) {
    if (!canListModels(p)) return false;
    const scope = modelScopeOf(p, providerConfig(p.id, p.defaults));
    if (!ttsModels.isStale(p.id, scope)) return false;
    if (typeof p.modelScope === 'function' && scope !== modelScopeOf(p, {}) && !ttsModels.cachedModels(p.id, scope)) return false;
    const at = modelAuto.get(`${p.id}|${scope}`) || 0;
    return !(now - at >= 0 && now - at < MODEL_RETRY);
}
function autoEngineModels() {
    const pane = q('#lv_pane_engine');
    if (!pane || pane.hidden || !pane.offsetParent) return;   // 닫힌 서랍 · 숨은 탭 (페이지를 열 때 그리는 것 포함)
    const p = curProvider();
    if (!autoModelsDue(p)) return;
    modelAuto.set(`${p.id}|${modelScopeOf(p, providerConfig(p.id, p.defaults))}`, Date.now());
    void refreshEngineModels(p);
}
// ---------- 1.3.5 엔진 잔액 줄: 엔진이 balance() 를 주고 키가 저장돼 있을 때만. 10분 캐시(카드를 오가도 다시 안 물음), ↻ · 저장 · 연결 확인은 바로
const balanceCache = new Map();   // provider id → { at, result | error }
const balanceInflight = new Map();   // provider id → 진행 중인 약속 (저장 → 카드 그리기 → 연결 확인이 잇달아 불러도 한 번만 묻는다)
let balanceSeq = 0;
function balanceSlotHtml(p, cfg) {
    const kf = keyField(p);
    if (!p || typeof p.balance !== 'function' || !kf || !cfg[kf.key]) return '';
    return '<div class="lv-balance" id="lv_balance" hidden><span class="lv-balance-text" id="lv_balance_text"></span><button type="button" class="lv-x" data-lv-act="balance" aria-label="잔액 다시 확인"><i class="fa-solid fa-rotate"></i></button></div>';
}
function paintBalance(entry) {
    const box = q('#lv_balance'), text = q('#lv_balance_text');
    if (!box || !text) return;
    box.classList.remove('low', 'bad');
    if (!entry || entry.loading) { box.hidden = false; text.textContent = '잔액 확인 중…'; return; }
    if (entry.error) { box.hidden = false; box.classList.add('bad'); text.textContent = `잔액 확인 실패 · ${entry.error}`; return; }
    const r = entry.result;
    if (!r) { box.hidden = true; return; }
    const parts = balanceParts(r);
    text.replaceChildren(document.createTextNode(parts.main));
    if (parts.tail) {
        const a = document.createElement('a');
        a.className = 'lv-balance-link'; a.href = parts.tail.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = parts.tail.text;
        text.append(document.createTextNode(parts.tail.before), a, document.createTextNode(parts.tail.after));
    }
    box.classList.toggle('low', balanceLow(r));
    box.hidden = false;
}
/** 5.7.2+ 지금 저장된 키의 표 (키 그대로는 담지 않음) — 잔액 캐시 · 진행 중 확인 · 연결 확인 결과가 이 키의 것인지 */
const keyTag = (p) => { const kf = keyField(p); return kf ? hash(String(providerConfig(p.id, p.defaults)[kf.key] || '')) : ''; };
/** mode: 'cache' = 10분 안이면 캐시 · 'fresh' = 5초 안이면 캐시(저장 → 연결 확인처럼 잇달아 부를 때) · 'force' = 늘 다시 (↻) */
async function loadBalance(p, mode = 'cache') {
    if (!p || typeof p.balance !== 'function' || !q('#lv_balance')) return;
    const tag = keyTag(p);
    const hit = balanceCache.get(p.id);
    const maxAge = mode === 'force' ? 0 : mode === 'fresh' ? 5000 : BALANCE_TTL;
    if (maxAge && hit && hit.tag === tag && Date.now() - hit.at < maxAge) { paintBalance(hit); return; }
    paintBalance({ loading: true });
    const seq = ++balanceSeq;
    const fk = `${p.id}|${tag}`;   // 키를 바꿔 다시 저장하면 옛 키로 가던 확인에 붙지 않는다
    let job = balanceInflight.get(fk);
    if (!job) {
        job = (async () => {
            try { return { tag, at: Date.now(), result: await p.balance(providerConfig(p.id, p.defaults)) }; }
            catch (e) { const err = (e && e.message) || '실패'; if (keyTag(p) === tag) log('err', `${p.name} 잔액 확인 실패: ${err}`); return { tag, at: Date.now(), error: err }; }
        })();
        balanceInflight.set(fk, job);
        job.finally(() => { if (balanceInflight.get(fk) === job) balanceInflight.delete(fk); });
    }
    const entry = await job;
    if (entry.tag !== keyTag(p)) return;                  // 그 사이 키가 바뀜 — 새 키의 확인이 그린다
    balanceCache.set(p.id, entry);
    if (seq !== balanceSeq) return;                       // 그 사이 다른 확인이 시작됨 — 그쪽이 그린다
    if (curProvider()?.id === p.id) paintBalance(entry);
}
/** 1.3.8 엔진 탭이 보일 때만 잔액 줄 (10분 캐시라 펼칠 때마다 묻지 않음) */
function balanceIfShown() { if (engineShown()) { const p = curProvider(); if (p) void loadBalance(p); } }
/** 엔진 카드만 다시 그린다 — 아직 저장 안 한 키 입력과 연결 확인 결과는 그대로 둔다 */
function rerenderEngineCard(p) {
    const typed = q('#lv_key_input')?.value || '';
    const res = q('#lv_test_result');
    const resText = res ? res.textContent : '', resCls = res ? res.className : '';
    replaceCard('engine', engineCardHtml(p));
    const keyIn = q('#lv_key_input');
    if (keyIn && typed) keyIn.value = typed;
    const res2 = q('#lv_test_result');
    if (res2 && resText) { res2.textContent = resText; res2.className = resCls; }
    if (engineShown()) void loadBalance(p);   // 1.3.8 보일 때만 (닫힌 서랍에서 모델 목록이 와 카드를 다시 그려도 잔액은 안 물음)
}
function showTestResult(text, cls, id = 'lv_test_result') {
    const out = q(`#${id}`);
    if (!out) return;
    out.textContent = text;
    out.className = `lv-test-result${cls ? ' ' + cls : ''}`;
}
/**
 * 5.7.2 키가 맞은 뒤: 계정 맞춤(내 목소리 · 캐릭터를 바꿀지 묻기) → 그래도 이 엔진 목소리가 하나도 없으면 목록을 바로 불러온다
 * (내 목소리가 없는 계정 · 계정 맞춤이 없는 엔진은 키만 넣고 끝나 '목소리를 먼저 정해요' 만 보였다). 계정 맞춤이 실패하면 연결 확인 줄에
 */
async function afterKeyOk(p, msg, stale = () => false) {
    const had = voices.allVoices().some(v => v.provider === p.id);
    // 1.3.8 리뷰 p02: 이 엔진 목소리를 지운 적이 있으면(account_removed) 저절로 불러오지 않는다 — 처음 쓰는 엔진만 (지운 목소리가 연결 확인마다 되살아났다)
    const used = had || voices.removedIds(p.id).length > 0;
    try {
        if (accountTrusted(p)) {
            await autoSyncAccounts({ force: true, only: p.id });
            if (stale()) return;                                  // 그 사이 키를 바꿈 · 다시 확인 — 새 확인이 그린다
            const err = syncErr.get(p.id);
            if (err) { if (curProvider() === p) showTestResult(`${msg} · 목소리 목록을 못 받았어요: ${String(err).split(' · ')[0]}`, 'bad'); return; }
        }
        if (stale()) return;
        if (!used && p.caps?.list && typeof p.listVoices === 'function' && !voices.allVoices().some(v => v.provider === p.id)) await pullVoices(p, { auto: true });
    } catch (e) { log('err', `${p.name} 목소리 불러오기 실패: ${(e && e.message) || e}`); }
}
const keyTestSeq = new Map();   // 1.3.8 엔진 id → 연결 확인 번호 (다른 엔진의 확인이 이 엔진의 뒤처리를 끊지 않게)
let afterKeyJob = null;   // 시험용: 마지막 afterKeyOk (연결 확인 버튼은 기다리지 않음)
async function keyTest() {
    const p = curProvider();
    if (!p) return;
    const my = (keyTestSeq.get(p.id) || 0) + 1, tag = keyTag(p);
    keyTestSeq.set(p.id, my);
    // 1.3.8 리뷰 p07: 그 사이 다시 확인 · 키를 바꿈 = 모두 그만. 다른 엔진 카드로 넘어감 = 결과 줄만 안 그림 (목소리 불러오기 · 계정 맞춤은 그대로 —
    //   느린 폰에서 확인 중에 엔진을 바꾸면 맞는 키인데 목소리가 안 들어왔다)
    const cancelled = () => keyTestSeq.get(p.id) !== my || keyTag(p) !== tag;
    const shown = () => curProvider() === p;
    showTestResult('확인 중…', '');
    // 1.3.7 연결 확인(키 저장도 여기로) = 모델 목록도 새로 — 조용히 (결과 줄은 연결 확인 것), 받으면 모델 select 만 다시
    if (canListModels(p)) void refreshEngineModels(p);
    try {
        const msg = typeof p.test === 'function' ? await p.test(providerConfig(p.id, p.defaults)) : '연결됨';
        if (cancelled()) return;                              // 늦게 온 옛 결과는 버림 (새 확인이 그린다)
        if (shown()) showTestResult(msg || '연결됨', 'ok');
        afterKeyJob = afterKeyOk(p, msg || '연결됨', cancelled);   // 5.7.2 계정의 내 목소리 → 이 엔진 목소리가 하나도 없으면 바로 불러오기 · 실패는 이 줄에
    } catch (e) {
        if (cancelled()) return;                              // 옛 키의 늦은 실패: 맞는 키로 이미 다시 확인함 — 덮지도 기록하지도 않음
        if (shown()) showTestResult(e.message || '실패', 'bad');
        log('err', `${p.name} 연결 확인 실패: ${e.message}`);
    }
    void loadBalance(p, 'fresh');   // 1.3.5 키를 확인했으면 잔액도 새로 (방금 물었으면 그대로)
}
async function keySave() {
    const p = curProvider();
    const kf = p && keyField(p);
    const input = q('#lv_key_input');
    if (!p || !kf || !input) return;
    const v = input.value.trim();
    if (!v) { toast('키를 붙여넣어요', 'warning'); return; }
    providerConfig(p.id, p.defaults)[kf.key] = v;
    input.value = '';
    balanceCache.delete(p.id);   // 5.7.2+ 옛 키의 잔액은 버림 (keyClear 와 같게)
    save();
    renderEngine();
    warnCleartext(p);
    await keyTest();   // 저장하면 바로 확인
}
async function keyClear() {
    const p = curProvider();
    const kf = p && keyField(p);
    if (!p || !kf) return;
    if (!(await confirm(`${p.name} 키를 지울까요?`))) return;
    delete providerConfig(p.id, p.defaults)[kf.key];
    balanceCache.delete(p.id);
    save();
    renderEngine();
}

// ---------- 데이터 탭
function logCardHtml() {
    const logs = logEntries().slice(0, 20);
    const body = logs.length
        ? `<div class="lv-log">${logs.map(e => `<div class="lv-log-row lv-log-${esc(e.kind)}"><time>${esc(timeStr(e.t))}</time><span>${esc(e.msg)}</span></div>`).join('')}</div>`
        : '<p class="lv-empty">기록이 없어요</p>';
    return card('log', 'fa-list', '최근 기록', body);
}
export function renderData() {
    const pane = q('#lv_pane_data');
    if (!pane) return;
    const s = settings();
    const month = new Date().toISOString().slice(0, 7);
    const u = s.usage && s.usage.month === month ? s.usage : { chars: 0, requests: 0 };
    const pre = Number(u.pre_chars) || 0, heard = Number(u.pre_used_chars) || 0;
    // 1.2.5 모델별 글자 (실제로 요청한 모델) — 두 모델 이상 썼고, 이번 달 글자가 모두 모델별로 잡혔을 때만 한 줄 (목소리를 만든 모델로 읽으면 섞임).
    // 1.2.5 전 요청 · 다른 엔진은 모델이 없어 합이 위 줄과 안 맞는다 → 그런 달은 숨김 (올린 달은 다음 달부터)
    const byModel = isObj(u.models) ? Object.entries(u.models).filter(([, n]) => Number(n) > 0) : [];
    const modelSum = byModel.reduce((a, [, n]) => a + Number(n), 0);
    const modelLine = byModel.length > 1 && modelSum === Number(u.chars) ? `<p class="lv-line">${byModel.map(([m, n]) => `${esc(koModelLabel('', m))} ${fmtNum(n)}자`).join(' · ')}</p>` : '';
    let au = { calls: 0, in_tokens: 0, out_tokens: 0 };
    try { const x = typeof analysis.usage === 'function' ? analysis.usage() : null; if (x && x.month === month) au = x; } catch { /* 분석 모듈이 없어도 데이터 탭은 그린다 */ }
    pane.innerHTML =
        card('cache', 'fa-box-archive', '캐시', `<div class="lv-line"><span id="lv_cache_stat">세는 중…</span><button type="button" class="menu_button" data-lv-act="cache-clear">비우기</button></div><div class="lv-grid">${fieldsHtml(CACHE_FIELDS)}</div>`)
        + card('usage', 'fa-chart-simple', '사용량', `<p class="lv-line">이번 달 ${fmtNum(u.chars)}자 · ${fmtNum(u.requests)}번</p><p class="lv-line">미리 ${fmtNum(pre)}자 · 들은 것 ${fmtNum(heard)}자</p>${modelLine}`)
        + card('ausage', 'fa-wand-magic-sparkles', '분석 사용량', `<p class="lv-line">이번 달 ${fmtNum(au.calls)}번 · 입력 ${fmtNum(au.in_tokens)} · 출력 ${fmtNum(au.out_tokens)} 토큰</p>`)
        + card('settings', 'fa-file-export', '설정', '<div class="lv-actions"><button type="button" class="menu_button" data-lv-act="export">내보내기</button><button type="button" class="menu_button" data-lv-act="import">가져오기</button><input type="file" id="lv_import_file" accept="application/json,.json" hidden></div><span class="lv-desc">API 키는 빼고 저장돼요</span>')
        + logCardHtml();
    cache.stats().then(({ count, bytes }) => {
        const el = q('#lv_cache_stat');
        if (el) el.textContent = `${fmtNum(count)}개 · ${(bytes / 1048576).toFixed(1)} MB`;
    }).catch(() => { const el = q('#lv_cache_stat'); if (el) el.textContent = '캐시를 못 열었어요'; });
}
function scheduleLogRefresh() {
    if (logTimer || !root) return;
    logTimer = setTimeout(() => {
        logTimer = 0;
        const pane = q('#lv_pane_data');
        if (pane && !pane.hidden) replaceCard('log', logCardHtml());
    }, 400);
}
function exportSettings() {
    const text = JSON.stringify(exportable(), null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'tts-settings.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
/** 가져온 설정을 덧씌운다 — 키는 파일에서 받지 않고, 키가 저장된 엔진의 주소는 바꾸지 않으며(키가 딴 서버로 가지 않게), 사용량은 건드리지 않는다.
 *  아는 키(DEFAULTS·등록된 엔진)만, 모양이 맞는 값만 받는다 */
function importSettings(obj) {
    const s = settings();
    const held = [];   // 주소를 그대로 둔 엔진 이름
    const fileVer = Number(obj.version) || 0;   // 1.2.5: 옛 파일(8 미만)의 목소리 음량 보정은 옮겨서 받는다 (목록 값이 gainDb 에 든 채로 두 번 맞추지 않게)
    for (const [k, v] of Object.entries(obj)) {
        if (BAD_KEYS.has(k) || k === 'usage' || k === 'analysis_usage' || k === 'version') continue;
        if (k === 'providers') {
            if (!isObj(v)) continue;
            for (const [pid, cfg] of Object.entries(v)) {
                const p = getProvider(pid);   // 등록된 엔진만
                if (!p || !isObj(cfg)) continue;
                const cur = providerConfig(pid, p.defaults);
                let kept = false;
                for (const [ck, cv] of Object.entries(cfg)) {
                    if (BAD_KEYS.has(ck) || ck === 'key' || ck === 'apiKey') continue;
                    if (cur.key && ENDPOINT_KEYS.has(ck) && cv !== cur[ck]) { kept = true; continue; }
                    cur[ck] = cv;
                }
                if (kept) held.push(p.name);
            }
            continue;
        }
        if (k === 'analysis') {
            // 대사 분석: 키는 파일에서 받지 않고, 키가 저장돼 있으면 주소도 그대로 (키가 딴 서버로 가지 않게); 사용량은 건드리지 않는다
            // 아는 항목(ANALYSIS_DEFAULTS)만, 기본값과 같은 모양(글·수·켬끔)만, 고르는 값은 목록 안의 것만
            if (!isObj(v)) continue;
            const cur = analysisCfg();
            let kept = false;
            for (const [ck, cv] of Object.entries(v)) {
                if (BAD_KEYS.has(ck) || ck === 'key' || !hasOwn(ANALYSIS_DEFAULTS, ck)) continue;
                if (ck === 'model_lists') continue;   // 캐시는 받지 않는다
                if (ck === 'provider_models') {
                    // 공급자별 모델: 아는 공급자의 글 값만
                    if (!isObj(cv)) continue;
                    const pm = isObj(cur.provider_models) ? cur.provider_models : {};
                    for (const [pk, pv] of Object.entries(cv)) if (!BAD_KEYS.has(pk) && stapi.source(pk) && typeof pv === 'string') pm[pk] = pv.trim().slice(0, 200);
                    cur.provider_models = pm;
                    continue;
                }
                if (ck === 'custom_url') {
                    // Custom 주소엔 실리태번의 Custom 키가 따라간다 → 파일이 새 주소를 넣지 못하게 (비우는 것 = 실리태번 주소로 돌아감 · 받음)
                    if (typeof cv !== 'string') continue;
                    const nv = cv.trim();
                    if (nv && nv !== String(cur.custom_url || '').trim()) { kept = true; continue; }
                    cur.custom_url = nv;
                    continue;
                }
                if (typeof cv !== typeof ANALYSIS_DEFAULTS[ck] || (typeof cv === 'number' && !Number.isFinite(cv))) continue;
                if (hasOwn(ANALYSIS_ENUMS, ck) && !ANALYSIS_ENUMS[ck].includes(cv)) continue;
                if (cur.key && ck === 'base' && cv !== cur.base) { kept = true; continue; }
                cur[ck] = cv;
            }
            if (kept) held.push('대사 분석');
            continue;
        }
        if (!hasOwn(DEFAULTS, k)) continue;
        if (k === 'pregen' && !PREGEN_MODES.includes(v)) continue;   // 고르는 값은 목록 안의 것만
        const d = DEFAULTS[k];
        if (isObj(d) ? !isObj(v) : Array.isArray(d) ? !Array.isArray(v) : typeof v !== typeof d) continue;   // 모양이 다르면 버린다
        s[k] = v;
    }
    if (fileVer < 8 && Array.isArray(obj.voices)) migrateVoicesV8(s.voices, { normalize: s.normalize !== false });   // 음량 고르기는 가져온 뒤의 값 (파일 값이 먼저 들어옴)
    s.voices = s.voices.filter(v => v && (v.uid || v.voiceId)).map(v => toVoice(v, v.provider));
    fillKnownVoices(s.voices);   // 1.2.3 가져온 목록의 id 이름도 한글로 (이름을 고친 목소리는 그대로) · 1.2.5 빈 목록 보정 · 만든 모델도
    for (const [kk, vv] of Object.entries(DEFAULTS.ui)) if (s.ui[kk] === undefined) s.ui[kk] = vv;
    save();
    if (held.length) toast(`키가 저장된 엔진의 주소는 그대로 뒀어요: ${held.join(', ')}`, 'warning');
}
async function importFile(input) {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    try {
        const obj = JSON.parse(await f.text());
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('설정 파일이 아니에요');
        importSettings(obj);
        renderAll();
        dispatchWand();   // 가져온 파일이 요술봉 메뉴를 켜고 껐을 수 있음
        toast('설정을 가져왔어요', 'success');
    } catch (e) { toast(e.message || '가져오기 실패', 'error'); }
}
/** 5.6.4 시험용 (tools/tests/tts-pregen-paid.mjs): 미리 만들기 안내 · 쉬는 줄 · 스위치 표시 · 언제 카드 칸 · 설정 가져오기 */
export const _forTest = {
    pregenWarn, pregenDesc, showPregenPaid, importSettings, whenFields: () => READ_CARDS.when[2], readFields: (name) => (READ_CARDS[name] || [])[2] || [],
    // 1.3.7 엔진 모델 목록 (tools/tests/tts-models.mjs)
    control, canListModels, listingProvider, autoModelsDue, autoEngineModels, refreshEngineModels, keyTest,
    // 1.3.8 (tools/tests/tts-onboarding.mjs): 계정 맞춤 · 바꿀까요 · 불러오기 · 도움말 · 말투 칩 · 「나」 자동 · 엔진 고정
    autoSyncAccounts, offerPrefer, flushPendingOffer, pullVoices, afterKeyJob: () => afterKeyJob, toggleHelp, tagChipsHtml, edParam, voiceRowHtml,
    voiceOptions, mapCardHtml, colorsCardHtml, setCharVoice, unpinChar, keySave, loadBalance, balanceCache: () => balanceCache,
};

// ---------- 시작
/** 1.3.8 설정 창이 보이게 됨 (서랍 펼침): 보이는 탭에 맞춰 계정 맞춤 · 잔액 · 미뤄 둔 「바꿀까요」 */
function onShown() {
    syncIfShown();
    balanceIfShown();
    flushPendingOffer();
}
function renderAll() {
    renderRead();
    renderVoices();
    renderEngine();
    renderData();
    syncAll();
    showTab(settings().ui.tab);
}
function setPlaying(on) {
    const b = q('#lv_stop');
    if (b) b.classList.toggle('lv-on', !!on);
}
export function init() {
    root = document.querySelector('#lv_settings .lv-body');
    if (!root) return;
    for (const el of document.querySelectorAll('#lv_settings .lv-version')) el.textContent = `v${VERSION}`;
    root.addEventListener('input', (e) => onEdit(e, true));
    root.addEventListener('change', (e) => onEdit(e, false));
    root.addEventListener('click', onClick);
    root.addEventListener('toggle', (e) => {
        if (e.target.matches('[data-lv-detail="text"]')) state.textAdvancedOpen = e.target.open;
    }, true);
    renderAll();
    // 서랍을 열 때 번역기 상태 줄을 맞춘다 (번역기 쪽 설정은 알림이 없다 — 달라졌을 때만 언제 카드를 다시 그림)
    // 실리태번 API 중 선택이면 분석 카드도 다시 (키 상태 · 본체 화면의 모델 목록이 그 사이 바뀌었을 수 있음) · 비어 있으면 목록을 한 번 받아 봄
    document.querySelector('#lv_settings .inline-drawer-toggle')?.addEventListener('click', () => {
        ensureFresh();   // 5.6.4 닫혀 있는 동안 바뀐 채팅 (펼쳐지기 전에)
        setTimeout(() => {
            refreshWhenCard();
            if (isProvider(settings())) renderReadCard('analysis'); else updateAnalysisNote();
            autoFetchModels();
        }, 0);
        setTimeout(onShown, 600);   // 1.3.8 계정 맞춤 · 잔액 · 미뤄 둔 「바꿀까요」 (펼침이 끝난 뒤 — 접는 중이면 숨어 있어 건너뜀)
        // 1.3.7 엔진 탭이 열린 채 서랍을 펼치면 모델 목록 (펼침이 끝난 뒤 — 접는 중이면 그때는 숨어 있어 건너뜀). ResizeObserver 와 겹쳐도 한 번만
        setTimeout(autoEngineModels, 600);
    });
    // 5.6.4 클릭이 우리 쪽에 오지 않는 길: 서랍이 펼쳐진 채 실리태번 확장 창을 다시 열 때 (창의 class 가 openDrawer 로 바뀜),
    // 그 밖에 목소리 탭의 크기가 0 → 보임으로 바뀔 때 (ResizeObserver — 그리기 전에 불린다. 숨은 탭에선 안 불려서 class 감시를 따로 둔다)
    const extBlock = document.getElementById('rm_extensions_block');
    if (extBlock && typeof MutationObserver === 'function') {
        new MutationObserver(() => { if (chatDirty && voicesShown()) ensureFresh(); if (settingsShown()) onShown(); })
            .observe(extBlock, { attributes: true, attributeFilter: ['class'] });
    }
    // 1.3.7 엔진 탭이 0 → 보임 (서랍을 펼침 · 확장 창을 엶 · 탭을 바꿈): 모델 목록이 오래됐으면 조용히 받아 봄 (닫힌 채 그릴 땐 크기 0 이라 안 함)
    const enginePane = q('#lv_pane_engine');
    if (enginePane && typeof ResizeObserver === 'function') {
        new ResizeObserver((list) => {
            if (list.some(e => e.contentRect.width > 0 || e.contentRect.height > 0)) { autoEngineModels(); balanceIfShown(); flushPendingOffer(); }
        }).observe(enginePane);
    }
    const voicesPane = q('#lv_pane_voices');
    if (voicesPane && typeof ResizeObserver === 'function') {
        new ResizeObserver((list) => {
            if (!list.some(e => e.contentRect.width > 0 || e.contentRect.height > 0)) return;
            if (chatDirty) ensureFresh();
            syncIfShown();          // 1.3.8 서랍을 펼쳐 목소리 탭이 보이게 됨 → 계정 맞춤 (6시간)
            flushPendingOffer();
        }).observe(voicesPane);
    }
    onLog(scheduleLogRefresh);
    // 1.3.7 엑스트라가 새로 생기거나 목소리를 고르면 캐릭터별 목소리 카드를 (보일 때 · 안 보이면 다음에 열 때) 다시 — 그리는 중에 불려도 한 번 미뤄서
    let extrasQueued = false;
    voices.onExtrasChange(() => { if (extrasQueued) return; extrasQueued = true; setTimeout(() => { extrasQueued = false; refreshChat(); }, 0); });
    // 재생기가 상태를 알려 주면 정지 버튼 불빛을 맞춘다 (없어도 동작)
    document.addEventListener('lemon-voice:state', (e) => setPlaying(!!(e.detail && e.detail.playing)));
    // 1.2.3 모델 전환(Blue Lemonade)이 대사 분석 공급자 · 모델을 바꾸면 카드를 다시 그린다 (modelswitch.js 가 보냄)
    document.addEventListener('tts:analysis', () => {
        state.amodelManual = '';
        // 서랍이 닫혀 있으면 목록 받기는 건너뜀 (열 때 다시 해 봄)
        try { showTestResult('', '', 'lv_atest_result'); renderReadCard('analysis'); if (root && root.offsetParent) autoFetchModels(); }
        catch (e) { log('err', `분석 카드 다시 그리기 실패: ${e.message}`); }
    });
    try { setPlaying(player.isPlaying()); } catch { /* 재생기가 아직 없으면 넘어감 */ }
}
