// Blue Lemonade effect playback. Library/provenance: sfx-library.js and ../NOTICE.md.
import { getSfx, sfxBlob, isSfxEnabled, sfxPreferenceRevision } from './sfx-library.js';

const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;

/** Independent controller per queue/preview. stopAll cancels even pending file loads.
 * play resolves once playback starts (or is ready while paused): { id, done, stop }.
 * done always resolves with ended/stopped/error; a stopped pending play resolves null.
 * Loop volume is multiplied by 0.3, with at most three loops in this controller.
 */
export function createSfxController() {
    const active = new Set();
    let epoch = 0, paused = false, volume = 1, rate = 1, rateRevision = 0;
    function applyVolume(item) {
        item.audio.volume = clamp(item.volume * volume * (item.loop ? 0.3 : 1), 0, 1, 1);
    }
    function finish(item, reason = 'stopped') {
        if (item.closed) return;
        item.closed = true;
        clearTimeout(item.timer);
        active.delete(item);
        item.audio.onended = item.audio.onerror = item.audio.onplaying = null;
        item.audio.pause();
        item.audio.removeAttribute('src');
        try { item.audio.load(); } catch { /* media object already disposed */ }
        URL.revokeObjectURL(item.url);
        item.resolve(reason);
    }
    function suspendTimer(item) {
        clearTimeout(item.timer);
        if (item.startedAt) item.remaining = Math.max(0, item.remaining - (Date.now() - item.startedAt));
        item.startedAt = 0;
    }
    function startTimer(item) {
        if (!item.timed || item.closed || paused || item.startedAt) return;
        item.startedAt = Date.now();
        item.timer = setTimeout(() => finish(item, 'ended'), item.remaining);
    }
    async function play(id, options = {}) {
        const meta = getSfx(id);
        if (!meta || !isSfxEnabled(id)) return null;
        const token = epoch;
        const preference = sfxPreferenceRevision(id);
        const cancelled = () => token !== epoch || !isSfxEnabled(id) || preference !== sfxPreferenceRevision(id);
        const requestedRateRevision = rateRevision;
        const loop = options.loop === undefined ? meta.loop === true : options.loop === true;
        const durationMs = loop ? 0 : clamp(options.durationMs, 0, 8000, 0);
        const repeats = durationMs || loop ? 1 : Math.round(clamp(options.repeats, 1, 4, 1));
        if (loop) {
            const running = [...active].find(item => item.id === id && item.loop);
            if (running) return running.handle;
        }
        const blob = await sfxBlob(id);
        if (cancelled() || !blob) return null;
        // Deduplicate two loop loads which completed out of order.
        if (loop) {
            const running = [...active].find(item => item.id === id && item.loop);
            if (running) return running.handle;
            const loops = [...active].filter(item => item.loop);
            if (loops.length >= 3) finish(loops[0]);
        }
        if (active.size >= 12) finish([...active][0]);
        const url = URL.createObjectURL(blob);
        let audio;
        try { audio = new Audio(url); }
        catch (error) { URL.revokeObjectURL(url); throw error; }
        let resolve;
        const done = new Promise(r => { resolve = r; });
        const item = { id, url, audio, done, resolve, loop, closed: false, repeats,
            timed: durationMs > 0, remaining: durationMs, timer: null, startedAt: 0,
            volume: clamp(options.volume, 0, 1, 1), handle: null, stopBeforeSeg: Number.isSafeInteger(options.stopBeforeSeg) ? options.stopBeforeSeg : null };
        item.handle = Object.freeze({ id, done, stop: () => finish(item) });
        audio.loop = loop || durationMs > 0;
        audio.playbackRate = requestedRateRevision === rateRevision ? clamp(options.rate, 0.25, 4, rate) : rate;
        audio.preload = 'auto';
        audio.onended = () => {
            if (cancelled() || item.closed) { finish(item); return; }
            if (--item.repeats <= 0) { finish(item, 'ended'); return; }
            audio.currentTime = 0;
            if (!paused) audio.play().catch(() => finish(item, 'error'));
        };
        audio.onerror = () => finish(item, 'error');
        audio.onplaying = () => {
            if (paused || cancelled() || item.closed) audio.pause();
            else startTimer(item);
        };
        applyVolume(item);
        active.add(item);
        if (!paused) {
            try { await audio.play(); }
            catch (error) {
                const stopped = cancelled() || item.closed;
                if (paused && !stopped && error?.name === 'AbortError') return item.handle;
                finish(item, 'error');
                if (stopped) return null;
                throw error;
            }
        }
        if (cancelled() || item.closed) { finish(item); return null; }
        if (paused) audio.pause();
        return item.handle;
    }
    function pause() {
        paused = true;
        for (const item of active) { suspendTimer(item); item.audio.pause(); }
    }
    async function resume() {
        paused = false;
        const token = epoch;
        await Promise.all([...active].map(async item => {
            if (!isSfxEnabled(item.id)) { finish(item); return; }
            if (item.closed || token !== epoch) return;
            try {
                await item.audio.play();
                if (paused || token !== epoch || item.closed) item.audio.pause();
            } catch (error) {
                if (!(paused && error?.name === 'AbortError')) finish(item, 'error');
            }
        }));
    }
    function stopAll() {
        epoch++;
        paused = false;
        for (const item of [...active]) finish(item);
    }
    /** 1.5.9 이어지는 반복이 멈추는 대사: 그 대사(원문 조각 번호)에 닿으면 stopBeforeSeg 이하인 소리를 끈다 */
    function stopBefore(seg) {
        for (const item of [...active]) if (item.stopBeforeSeg != null && seg >= item.stopBeforeSeg) finish(item);
    }
    function stopDisabled() {
        for (const item of [...active]) if (!isSfxEnabled(item.id)) finish(item);
    }
    function setVolume(value) {
        volume = clamp(value, 0, 1, 1);
        for (const item of active) applyVolume(item);
    }
    function setRate(value) {
        rate = clamp(value, 0.25, 4, 1);
        rateRevision++;
        for (const item of active) item.audio.playbackRate = rate;
    }
    return Object.freeze({ play, pause, resume, stopAll, stopBefore, stopDisabled, setVolume, setRate });
}
