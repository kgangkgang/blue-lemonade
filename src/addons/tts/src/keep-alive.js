// TTS 1.9.9 (7.0.2) 백그라운드 재생 — 폰에서 다른 앱으로 가면 읽기가 멈추던 것.
// 대사는 이미 <audio> 하나로 나지만, 줄이 끝날 때마다 그 요소를 비우고(src 지움) 줄 사이 쉼은 40ms 타이머로 기다렸다.
// 숨은 페이지에서 소리가 끊기면 브라우저가 타이머를 1초(5분 뒤엔 1분)로 묶고, 안드로이드는 미디어가 멈춘 페이지를 잠재우거나 다음 play() 를 막는다.
// 그래서 **숨었을 때만**: 줄과 줄 사이 · 다음 줄 합성을 기다리는 동안 같은 <audio> 에 무음을 이어 틀어(미디어가 계속 「재생 중」) 페이지를 깨워 두고,
// 쉼은 타이머 대신 그 길이의 무음 파일이 끝나는 'ended' 로 기다린다. 화면이 보일 때는 예전과 똑같이 돈다.
// 테마 뒷일 다리(after-work)에도 'tts' 로 알려 소리 없이 버티기(백그라운드 창)가 같이 붙잡게 한다 (다리 상한 5분은 꼬리표를 번갈아 새로 잡아 넘는다).
//
//   silentWav(ms)                         무음 WAV (8 kHz 16비트 모노) Uint8Array
//   createKeepAlive({ audio, hidden, url, bridge, now })
//     .hold()          숨었으면 무음 반복을 튼다 → true (보이면 아무것도 안 함 → false)
//     .release()       무음을 끈다 (요소를 비움)
//     .prepare()       진짜 대사를 틀기 직전 (반복 끔 · 무음 표시 지움 — src 는 부르는 쪽이 바꾼다)
//     .wait(ms, ir)    숨었으면 ms 길이 무음이 끝날 때까지('ended') → true | 끊김 false. 보이면 null (부르는 쪽이 예전 타이머로)
//     .linger(ms)      큐가 끝났을 때 잠깐 더 무음 → 끝나면 끔 (이어 듣기가 다음 줄을 넣을 틈)
//     .begin() · .end()  뒷일 다리 (읽는 동안 하나만 · 4분마다 꼬리표를 새로)
export const RATE = 8000;
export const HOLD_MS = 1000;
export const RENEW_MS = 4 * 60 * 1000;

export function silentWav(ms, rate = RATE) {
    const frames = Math.max(1, Math.round(rate * Math.max(0, Number(ms) || 0) / 1000));
    const data = frames * 2, buf = new Uint8Array(44 + data), v = new DataView(buf.buffer);
    const text = (at, s) => { for (let i = 0; i < s.length; i++) buf[at + i] = s.charCodeAt(i); };
    text(0, 'RIFF'); v.setUint32(4, 36 + data, true); text(8, 'WAVE'); text(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, data, true);
    return buf;
}

const defaultUrl = (bytes) => URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
const defaultHidden = () => !!globalThis.document?.hidden;
const defaultBridge = () => globalThis[Symbol.for('blue-lemonade.after-work')];

export function createKeepAlive({ audio, hidden = defaultHidden, url = defaultUrl, bridge = defaultBridge, now = () => Date.now() } = {}) {
    const urls = new Map();   // ms(50ms 단위) → blob URL (한 번 만들어 계속 씀)
    const urlFor = (ms) => { const k = Math.max(50, Math.round((Number(ms) || 0) / 50) * 50); if (!urls.has(k)) urls.set(k, url(silentWav(k))); return urls.get(k); };
    let holding = false, work = null, token = 0;   // work = { tag, at, end } · token: prepare/release 마다 올라 늦게 끝난 linger 를 무시
    const el = () => (typeof audio === 'function' ? audio() : audio);
    const play = (a) => { try { const p = a.play(); if (p && typeof p.catch === 'function') p.catch(() => { /* 막히면 다음 줄 play 가 다시 */ }); } catch { /* 없음 */ } };
    const api = {
        get holding() { return holding; },
        hidden: () => { try { return !!hidden(); } catch { return false; } },
        hold() {
            const a = el();
            if (!a || !api.hidden()) return false;
            a.loop = true;
            a.src = urlFor(HOLD_MS);
            a.dataset && (a.dataset.lvHold = '1');
            holding = true;
            play(a);
            return true;
        },
        release() {
            const a = el();
            token++;
            if (!holding || !a) return;
            holding = false;
            a.loop = false;
            if (a.dataset) delete a.dataset.lvHold;
            try { if (!a.paused) a.pause(); a.removeAttribute('src'); a.load(); } catch { /* 없음 */ }
        },
        prepare() {
            const a = el();
            token++;
            holding = false;
            if (!a) return;
            a.loop = false;
            if (a.dataset) delete a.dataset.lvHold;
        },
        wait(ms, ir) {
            const a = el();
            if (!a || !api.hidden()) return null;
            const left = Math.max(0, Number(ms) || 0);
            if (!left) return Promise.resolve(!ir?.fired);
            return new Promise((resolve) => {
                let finished = false;
                const done = (ok) => {
                    if (finished) return;
                    finished = true;
                    a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr);
                    if (ok) api.hold();   // 다음 줄을 받는 동안에도 계속
                    resolve(ok);
                };
                const onEnd = () => done(true), onErr = () => done(!ir?.fired);
                a.addEventListener('ended', onEnd); a.addEventListener('error', onErr);
                ir?.promise?.then(() => done(false));
                holding = true;
                a.loop = false;
                a.src = urlFor(left);
                play(a);
            });
        },
        /** 큐가 끝났을 때(숨었으면): ms 동안 무음을 더 틀고 끝나면('ended') 끈다 — 이어 듣기가 그사이 다음 줄을 넣으면 그 줄이 갈아 끼운다. 숨지 않았거나 잡고 있지 않으면 false */
        linger(ms = 3000) {
            const a = el();
            if (!a || !holding || !api.hidden()) return false;
            const mine = ++token;
            const onEnd = () => { a.removeEventListener('ended', onEnd); if (token === mine) api.release(); };
            a.addEventListener('ended', onEnd);
            a.loop = false;
            a.src = urlFor(ms);
            play(a);
            return true;
        },
        begin() {
            const b = bridge?.();
            if (!b || typeof b.begin !== 'function') return;
            if (work && now() - work.at < RENEW_MS) return;
            const tag = work?.tag === 'tts' ? 'tts:renew' : 'tts';
            const old = work;
            try { work = { tag, at: now(), end: b.begin(tag) }; } catch { work = old; return; }
            if (old) { try { (old.end || (() => b.end(old.tag)))(); } catch { /* 이미 */ } }   // 새 것을 잡은 뒤 옛 것을 놓아 「바쁨」이 끊기지 않게
        },
        end() {
            const old = work;
            work = null;
            if (!old) return;
            try { (old.end || (() => bridge?.()?.end?.(old.tag)))(); } catch { /* 이미 */ }
        },
        get working() { return work ? work.tag : null; },
    };
    return api;
}
