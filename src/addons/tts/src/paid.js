// TTS — 돈이 드는 엔진 판단 (5.6.4): 설정 창(ui.js — 미리 만들기 '!' · 스위치 · 언제 카드)과 미리 만들기(pregen.js — 유료 엔진 줄은 만들지 않음)가 같이 쓴다.
// 5.6.3 사용자 제보: 미리 만들기(대사+속마음)가 답장 · 스와이프마다 모든 줄을 만들어 10월 첫 엿새에 MiniMax 크레딧의 96 %를 썼는데 들은 건 12 %.
//   → 5.6.4 유료 엔진은 미리 만들지 않는다 (설정 pregen_paid = '유료 엔진도 미리 만들기' 를 켠 사람만). 누른 줄 · 자동 읽기 · 내려받기는 그대로.
//
// 무료로 보는 것 (나머지는 모두 유료 — 모르는 엔진도, 아끼는 쪽으로):
//   browser · gtranslate                      브라우저 내장 · Google 번역
//   openai_compat 이 내 PC · 집 안 주소         LOCAL_HOST (주소를 비우면 엔진 기본 127.0.0.1)
//   minimax 가 MiniMax 공식 서버가 아닌 곳      서버 '직접 입력' 의 집 PC 로컬 TTS 게이트웨이 (공인 IP 라 LOCAL_HOST 로는 못 가림) · 집 안 서버.
//                                             공식 = minimax.js 서버 목록(api.minimax.io · api-uw.minimax.io · api.minimaxi.com)과
//                                             이름이 minimax.io · minimaxi.com · minimax.chat · minimaxi.chat 로 끝나는 주소.
//                                             주소는 minimax.js hostOf 로 푼다 (요청이 실제로 가는 곳): '직접 입력' 인데 비었으면 api.minimax.io → 유료.
//                                             읽을 수 없는 주소(빈칸 섞인 글 등)도 유료 — 공식이 아니라고 장담할 수 없고, 어차피 요청이 실패한다
// 엔진 설정은 읽기만 한다 (providerConfig 처럼 빈 칸을 만들지 않음).
// 남는 위험: MiniMax 공식 서버로 넘겨 주는 자기 프록시(다른 도메인)는 무료로 보인다 — 그런 주소면 스위치로 직접 정한다.
import { settings } from './settings.js';
import { getProvider } from './providers/index.js';
import { hostOf as minimaxHost, OFFICIAL_DOMAINS } from './providers/minimax.js';

const FREE_ENGINES = new Set(['browser', 'gtranslate']);
export const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|\[?::1\]?$|[^.]+$)|\.(local|lan|home\.arpa|ts\.net)$/i;
const COMPAT_BASE = 'http://127.0.0.1:8880/v1';   // openai_compat.js DEFAULT_BASE (주소를 비우면 이리로)
export const MINIMAX_DOMAINS = OFFICIAL_DOMAINS;   // 1.3.5 목록은 minimax.js 한 곳에 (잔액 줄도 같은 목록)

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** 주소 → 호스트 이름 (소문자 · 끝 점 뺌). 읽을 수 없으면 null */
function hostnameOf(url) {
    try { return new URL(String(url || '')).hostname.toLowerCase().replace(/\.$/, '') || null; } catch { return null; }
}
/** 내 PC · 집 안 · 이름만 있는 주소인가 (OpenAI 호환 서버) */
export function isLocalBase(url) {
    try { return LOCAL_HOST.test(new URL(String(url || '')).hostname); } catch { return false; }
}
/** MiniMax 설정이 공식(돈이 드는) 서버로 가나 — hostOf 와 같은 규칙으로 서버 · 직접 입력 주소를 푼다 */
export function isMinimaxOfficial(cfg) {
    let h = null;
    try { h = hostnameOf(minimaxHost(isObj(cfg) ? cfg : {})); } catch { h = null; }
    if (!h) return true;
    return MINIMAX_DOMAINS.some(d => h === d || h.endsWith(`.${d}`));
}
/** 저장된 엔진 설정 (없으면 빈 것 — 새로 만들지 않음) */
function cfgOf(id, s = settings()) {
    const p = s && s.providers;
    return isObj(p) && isObj(p[id]) ? p[id] : {};
}
/** 이 엔진으로 소리를 만들면 돈이 드나. cfg 를 안 주면 지금 설정 */
export function isPaidProvider(id, cfg) {
    if (FREE_ENGINES.has(id)) return false;
    const c = isObj(cfg) ? cfg : cfgOf(id);
    if (id === 'openai_compat') return !isLocalBase(String(c.base || '').trim() || COMPAT_BASE);
    if (id === 'minimax') return isMinimaxOfficial(c);
    return true;
}
/** 등록한 목소리의 엔진 id (등록부에 있는 것만, 목소리 차례) */
function voiceEngines(s) {
    const ids = new Set((Array.isArray(s && s.voices) ? s.voices : []).map(v => v && v.provider).filter(Boolean));
    return [...ids].filter(id => !!getProvider(id));
}
/** 등록한 목소리의 엔진 가운데 돈이 드는 것 (이름 목록) */
export function paidEngines(s = settings()) {
    return voiceEngines(s).filter(id => isPaidProvider(id, cfgOf(id, s))).map(id => getProvider(id).name || id);
}
/** 목소리가 있고 그 엔진이 모두 유료인가 (미리 만들기가 통째로 쉬는지 — 섞여 있으면 무료 엔진 줄은 만든다) */
export function paidOnly(s = settings()) {
    const ids = voiceEngines(s);
    return ids.length > 0 && ids.every(id => isPaidProvider(id, cfgOf(id, s)));
}
/** 유료 엔진도 미리 만드나 (설정 pregen_paid — 기본 꺼짐) */
export const pregenPaid = (s = settings()) => !!s && s.pregen_paid === true;
