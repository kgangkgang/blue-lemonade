// 모델 전환 6.2.9 「검열되면 다른 모델로」 공용 — 번역 · 다시 쓰기 · 캐릭터 에셋 「다른 모델이 고르기」 · 한글화 패널 (+ 스스로 등록하는 확장)
// 사용자 10-13: 「TTS만 (검열되면) 뜨고 나머지는 안뜨는데? 나머지도 다 검열되면 떠야할거같음」 — 6.1.8 TTS 대사 분석과 같은 방식으로 모두에.
// 9-22 에 번역의 「차단되면 자동으로 다른 모델」은 거절된 적이 있다 → 기본 꺼짐: 사용자가 모델 전환에서 「<이름> (검열되면)」을 켜고
// 공급자 · 모델을 골라야만, 본 요청이 내용 차단으로 막혔을 때 그 모델로 딱 한 번 더 보낸다 (몰래 바꾸는 것 없음).
// 차단 판정은 TTS 의 규칙 하나를 그대로 쓴다 (tts/src/block-fallback.js — 429 · 401 · 네트워크 · 시간 초과는 차단이 아니다).
// 설정 = 그 확장 설정의 fallback { enabled, provider(실리태번 chat_completion_source), model }.
// 실리태번을 import 하지 않는 순수 모듈 — node 로 시험한다 (tools/tests/modelswitch-fallback.mjs).
import { maybeBlocked, fallbackTarget as pickTarget, sameTarget } from '../tts/src/block-fallback.js';

export { maybeBlocked, sameTarget };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const msgOf = (e) => String(e?.message || e || '').replace(/^Error:\s*/, '').trim();

/** 설정 객체의 fallback 칸 → 다시 보낼 곳 { provider, model } | null (켜져 있고 공급자 · 모델을 골랐을 때만) */
export function fallbackOf(settings) {
    return pickTarget(isObj(settings) ? settings.fallback : null);
}

/**
 * 본 요청을 돌리고, 내용 차단으로 막히면(throw) 다시 보낼 곳으로 딱 한 번 더.
 *  call(): 본 요청 · send(target): 다른 모델로 같은 요청 · target: fallbackOf(설정) · failed: 본 모델 { provider, model, url } (같으면 다시 보내지 않는다)
 *  isBlocked(error): 차단 판정 (기본 = TTS 와 같은 규칙) · onUsed(target): 다른 모델로 해냈을 때
 * 다시 보낼 곳이 없거나 · 차단이 아닌 실패(연결 · 429 · 키 · 시간)면 원래 오류 그대로. 다른 모델도 실패하면 짧은 오류 (cause = 그 오류, fallback = 다시 보낸 곳)
 */
export async function withFallback(call, { target = null, failed = null, send = null, isBlocked = maybeBlocked, onUsed = null } = {}) {
    try {
        return await call();
    } catch (error) {
        // Custom 다시 보낼 곳은 그 확장의 Custom 주소(= 본 요청과 같은 중계)로 간다 — 주소 없이 견주면 같은 중계 · 같은 모델도 다른 곳으로 보였다
        const compare = target && target.provider === 'custom' && !target.url && failed?.provider === 'custom' && failed.url ? { ...target, url: failed.url } : target;
        if (!target || typeof send !== 'function' || error?.name === 'AbortError' || !isBlocked(error) || sameTarget(failed, compare)) throw error;
        let reply;
        try {
            reply = await send(target);
        } catch (again) {
            if (again?.name === 'AbortError') throw again;
            throw Object.assign(new Error(`내용 차단 · 다른 모델(${target.model})도 실패: ${msgOf(again).slice(0, 80)}`),
                { cause: again, blocked: true, refused: error?.refused === true, fallback: { ...target, blocked: isBlocked(again) } });
        }
        try { onUsed?.(target); } catch { /* 알림 실패는 결과와 무관 */ }
        return reply;
    }
}

/**
 * 모델 전환에 올릴 「(검열되면)」 대상 — 스스로 등록하는 확장용 (테마 내장 애드온은 modelswitch/targets.js 가 같은 모양으로 만든다).
 *  holder(): fallback 칸을 가진 설정 객체 · main(): 본 대상의 read() 결과 (같은 모델로는 바꾸지 않는다) · customUrl(holder): Custom 일 때 쓸 주소
 */
export function fallbackTarget({ id, name, sources = null, settingsKey, path = 'fallback', holder, main = () => null, customUrl = () => '', save = () => {}, open = null }) {
    return {
        id: `${id}`, name: `${name} (검열되면)`, sources, settingsKey, path, defaultOff: true,
        ...(typeof open === 'function' ? { open } : {}),
        active() { return !!fallbackOf(holder()); },
        read() {
            const s = holder();
            if (!isObj(s)) return null;
            const fb = isObj(s.fallback) ? s.fallback : {};
            const source = String(fb.provider || '');
            if (!source) return { follow: '안 씀' };
            return { source, model: String(fb.model || ''), url: source === 'custom' ? String(customUrl(s) || '') : '' };
        },
        apply({ source, model } = {}) {
            const s = holder();
            if (!isObj(s) || !source) return false;
            const want = String(model ?? '').trim();
            let now = null;
            try { now = main(); } catch { now = null; }
            if (now && !now.follow && now.source === source && String(now.model || '') === want) return false;   // 본 모델과 같으면 다시 보낼 곳이 없어진다
            const fb = isObj(s.fallback) && !Object.isFrozen(s.fallback) ? s.fallback : { enabled: true, ...(isObj(s.fallback) ? s.fallback : {}) };
            fb.enabled = fb.enabled !== false;
            fb.provider = String(source);
            fb.model = want;
            s.fallback = fb;
            try { save(); } catch { /* 저장은 부르는 쪽 */ }
            return true;
        },
    };
}

/**
 * 6.3.0 모델 전환 대상 목록 정렬: id 가 「<본 id>-fallback」 인 대상은 늘 본 대상 바로 다음 줄에 (아는 확장 · 스스로 등록한 확장 · 자동 모두).
 * 스스로 등록한 확장은 등록 Map 이 본 대상의 자리를 지키고 새 id 만 뒤에 붙어 「(검열되면)」 줄이 다른 확장 뒤로 떨어져 보였다.
 * 본 대상이 목록에 없으면 그 자리 그대로. 순수 함수 (시험: modelswitch-fallback.mjs)
 * 6.4.5 본 대상 찾기: id 가 먼저, 없으면 아는 대상의 folder 를 별칭으로 — 아는 대상의 id 와 그 확장이 스스로 등록한
 * 「<폴더>-fallback」(등록 Map 에서는 'ext:<폴더>-fallback')이 달라 「(검열되면)」 줄이 다른 확장 뒤로 떨어져 있었다. id 는 그대로 둔다 (켜 둔 값이 그 id 에 있다).
 */
export function pairFallbacks(list) {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    const isFallback = t => String(t.id).endsWith('-fallback');
    const byId = new Map(), byFolder = new Map();
    for (const t of items) {
        if (!byId.has(String(t.id))) byId.set(String(t.id), t);
        // 별칭은 아는 대상만 (스스로 등록한 · 자동 대상 · 「(검열되면)」 대상의 folder 는 보지 않는다)
        if (typeof t.folder === 'string' && t.folder && !t.external && !t.auto && !isFallback(t) && !byFolder.has(t.folder)) byFolder.set(t.folder, t);
    }
    const mainOf = t => {
        if (!isFallback(t)) return null;
        const main = String(t.id).slice(0, -'-fallback'.length);
        const bare = main.startsWith('ext:') ? main.slice(4) : main;   // 스스로 등록한 대상은 id 앞에 'ext:' 가 붙는다
        const found = byId.get(main) || byId.get(bare) || byFolder.get(bare);   // 별칭이 다른 대상의 id 와 겹치면 id 가 먼저
        return found && found !== t ? found : null;
    };
    const fallbackOfMain = new Map();
    for (const t of items) { const main = mainOf(t); if (main && !fallbackOfMain.has(main)) fallbackOfMain.set(main, t); }
    const paired = new Set(fallbackOfMain.values());
    const out = [], seen = new Set();
    const put = t => {   // 본 대상 바로 다음 줄에 그 「(검열되면)」 대상
        if (seen.has(t)) return;
        seen.add(t);
        out.push(t);
        const fb = fallbackOfMain.get(t);
        if (fb) put(fb);
    };
    for (const t of items) if (!paired.has(t)) put(t);
    for (const t of items) put(t);   // 안전망: 어떤 모양의 목록에서도 빠지는 대상이 없게
    return out;
}

/** 사설 확장 · 다른 확장이 같은 규칙을 쓰는 길 (CONTRACT: blue-lemonade-audit/block-fallback-20261013/CONTRACT.md) */
export const API = Object.freeze({ version: 2, isBlock: maybeBlocked, withFallback, fallbackOf, fallbackTarget, sameTarget });
try {
    const key = Symbol.for('blue-lemonade.model-switch-fallback');
    if (!globalThis[key]) globalThis[key] = API;
} catch { /* 전역이 없음 */ }
