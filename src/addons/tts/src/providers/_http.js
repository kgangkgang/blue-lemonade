// 엔진 공용 HTTP 도우미 — 밖으로 내놓는 건 이 여섯뿐
//
//   fetchJson(url, opts) → JSON
//       opts = { method = 'GET', headers = {}, body, signal, timeout = 60000 }
//       body 가 객체면 JSON 문자열로 보내고 Content-Type 을 붙인다 (문자열·Blob·FormData 는 그대로)
//       응답이 !ok 면 koError 를 던진다. 본문이 비어 있으면 null
//   fetchBlob(url, opts) → { blob, mime }
//       같은 opts. !ok 이거나 본문이 JSON/텍스트(오류 응답)면 koError. mime 은 content-type 앞부분 (없으면 '')
//   timedFetch(url, init, read, { signal, timeout = 120000, netMsg }) → read(r) 의 결과
//       fetch 를 직접 쓰는 엔진용. 시간 제한과 본문 읽기(read)까지 한 signal 로 묶는다
//       호출자 중단 → 그대로 · 시간 초과 → koError(408, 다시 시도) · 연결·CORS 실패 → code 'network', retry (netMsg 문구)
//       read 가 던진 엔진 오류는 손대지 않는다
//   koError(status, body) → Error
//       HTTP 상태 → 짧은 한국어 + 업체 메시지 조각(≤120자). e.status, e.code(=status), e.retry(408/429/5xx), e.fatal(401/402/403), e.lv=true
//       status 0 = 네트워크·CORS 실패. 응답 본문은 오류 객체에 담지 않는다 (키·글이 섞여 나갈 수 있음)
//   safeMsg(text, max = 120) → 토스트·기록에 넣어도 되는 조각
//       태그 제거, 키처럼 보이는 것(Bearer 뒤 · sk-/xi-/key-/token- · 영숫자 32자 이상) ***, 공백 정리, max 자
//   withAbort(signal, ms) → { signal, done }
//       호출자 signal 과 시간 제한을 합친 signal. 다 쓰면 done() 으로 타이머·리스너 정리
//
// 호출자가 signal 로 멈추면 그 AbortError 를 그대로 던진다 (플레이어는 조용히 넘김).
// 키·주소는 오류 메시지에 넣지 않는다. 업체 메시지 조각에서 키처럼 보이는 것도 지운다.
import { scrub } from '../log.js';
import { assertRuntime, runtimeEnabled, stoppedError, trackController } from '../runtime.js';

const STATUS_MSG = {
    400: '요청 형식 오류',
    401: '인증 실패. API 키를 확인',
    402: '잔액·크레딧 부족',
    403: '권한 없음 (키·요금제 확인)',
    404: '주소가 없어요 (주소·모델 확인)',
    408: '시간 초과',
    413: '글이 너무 길어요',
    415: '요청 형식을 받지 않아요',
    422: '입력값 오류',
    429: '요청이 너무 잦아요. 잠시 뒤 다시',
};
// 키·잔액·권한 문제: 다음 작업도 다 실패하니 재생기가 줄을 멈춘다
const FATAL = new Set([401, 402, 403]);

/** 업체 메시지를 토스트에 넣어도 되는 조각으로 (태그 제거 → 키처럼 보이는 것 가림 → 공백 정리 → max 자) */
export function safeMsg(text, max = 120) {
    const s = String(text ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\b(?:sk|xi|key|token)[-_][\w.-]{6,}/gi, '***');
    return scrub(s).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** 업체 응답에서 사람이 읽을 조각만 */
function vendorMsg(body) {
    if (!body) return '';
    let m = '';
    if (typeof body === 'string') m = body;
    else if (typeof body === 'object') {
        const e = body.error;
        const raw = (e && (typeof e === 'string' ? e : (e.message || e.msg))) || body.message || body.detail || body.msg
            || (body.base_resp && body.base_resp.status_msg) || '';
        m = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : '');
    }
    return safeMsg(m, 120);
}

export function koError(status, body) {
    const n = Number(status) || 0;
    let msg;
    if (n === 0) msg = '연결 실패 (네트워크·CORS)';
    else if (STATUS_MSG[n]) msg = STATUS_MSG[n];
    else if (n >= 500) msg = `서버 오류 (${n})`;
    else if (n >= 200 && n < 300) msg = '오디오가 아닌 응답';
    else msg = `오류 (${n})`;
    const v = vendorMsg(body);
    const e = new Error(v ? `${msg} · ${v}` : msg);
    e.status = n;
    e.code = n;
    e.retry = n === 408 || n === 429 || n >= 500;
    if (FATAL.has(n)) e.fatal = true;
    e.lv = true;
    return e;
}

export function withAbort(signal, ms = 0) {
    assertRuntime();
    const ac = new AbortController();
    const releaseRuntime = trackController(ac);
    const onAbort = () => ac.abort(signal ? signal.reason : undefined);
    if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = ms > 0 ? setTimeout(() => ac.abort(new DOMException('시간 초과', 'TimeoutError')), ms) : 0;
    return {
        signal: ac.signal,
        done() {
            releaseRuntime();
            if (timer) clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onAbort);
        },
    };
}

/** fetch 를 직접 쓰는 엔진용: 시간 제한 + 본문 읽기(read)까지 한 signal 로 */
export async function timedFetch(url, init, read, { signal, timeout = 120000, netMsg } = {}) {
    const ab = withAbort(signal, timeout);
    try {
        const r = await fetch(url, { ...(init || {}), signal: ab.signal });
        return await read(r);
    } catch (e) {
        if (!runtimeEnabled()) throw stoppedError();
        if (signal && signal.aborted) throw e;                          // 호출자가 멈춤 → 그대로
        if (ab.signal.aborted) throw koError(408, null);                // 시간 제한 → 다시 시도
        if (e instanceof TypeError || (e && e.name === 'AbortError')) { // 연결·CORS 실패
            const err = new Error(netMsg || '연결 실패 (네트워크·CORS)');
            err.status = 0; err.code = 'network'; err.retry = true; err.lv = true;
            throw err;
        }
        throw e;                                                        // read 가 던진 엔진 오류
    } finally {
        ab.done();
    }
}

const parse = (text) => { try { return JSON.parse(text); } catch { return undefined; } };
const hasHeader = (h, name) => Object.keys(h).some(k => k.toLowerCase() === name);

/** fetch + 본문 읽기 (read) 를 한 signal 로 묶고, 실패를 koError 로 바꾼다 */
async function request(url, opts, read) {
    const { method = 'GET', headers = {}, body, signal, timeout = 60000 } = opts || {};
    const ab = withAbort(signal, timeout);
    const init = { method, headers: { ...headers }, signal: ab.signal };
    if (body !== undefined && body !== null) {
        if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof ArrayBuffer) init.body = body;
        else {
            init.body = JSON.stringify(body);
            if (!hasHeader(init.headers, 'content-type')) init.headers['Content-Type'] = 'application/json';
        }
    }
    try {
        const r = await fetch(url, init);
        return await read(r);
    } catch (e) {
        if (!runtimeEnabled()) throw stoppedError();
        if (e && e.lv) throw e;                         // 이미 koError
        if (signal && signal.aborted) throw e;          // 호출자가 멈춤 → 그대로
        if (ab.signal.aborted) throw koError(408, null); // 시간 제한
        throw koError(0, e && e.message);
    } finally {
        ab.done();
    }
}

async function readJson(r) {
    const text = await r.text();
    const j = parse(text);
    if (!r.ok) throw koError(r.status, j !== undefined ? j : text);
    if (j === undefined) {
        if (!text.trim()) return null;
        const e = new Error('응답이 JSON 이 아니에요');
        e.status = r.status; e.code = r.status; e.retry = false; e.lv = true;
        throw e;
    }
    return j;
}

async function readBlob(r) {
    const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!r.ok || ct.includes('json') || ct === 'text/html' || ct === 'text/plain') {
        const text = await r.text();
        const j = parse(text);
        throw koError(r.status, j !== undefined ? j : text);
    }
    const blob = await r.blob();
    if (!blob.size) throw koError(r.status, '빈 오디오');
    return { blob, mime: ct || blob.type || '' };
}

export const fetchJson = (url, opts) => request(url, opts, readJson);
export const fetchBlob = (url, opts) => request(url, opts, readBlob);
