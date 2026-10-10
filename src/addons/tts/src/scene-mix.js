// Message sound staging / mixdown adapted from MultiCast-TTS (MIT).
// https://github.com/JINSIN2/MultiCast-TTS/tree/f48ebeef9b19d814bf8d4568af13613544007e63
// Copyright (c) 2026 JINSIN2. See ../LICENSE-MultiCast.txt and ../NOTICE.md.
// Blue Lemonade: shared timing, bounded rendering, playback rate and stereo WAV.
const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clamp = (v, a, b, fallback) => Math.max(a, Math.min(b, finite(v, fallback)));
export function sceneTimeline(clips, { rate = 1, gapMs = 250, master = 1, sfxVolume = 0.45 } = {}) {
    rate = clamp(rate, 0.5, 2, 1);
    let cursor = 0, end = 0;
    const events = [], loops = [];
    for (const clip of clips) {
        if (clip.kind === 'pause') { cursor += clamp(clip.gapMs, 0, 10000, 500) / 1000; end = Math.max(end, cursor); continue; }
        if (!clip.buffer) continue;
        const seconds = clip.buffer.duration / rate;
        const event = { ...clip, start: cursor, duration: seconds, rate, gain: clamp(clip.volume, 0, 1, 1) * clamp(master, 0, 1, 1) * (clip.kind === 'sfx' ? clamp(sfxVolume, 0, 1, 0.45) : 1) };
        const looping = clip.kind === 'sfx' && clip.mode === 'loop';
        if (looping) {
            event.gain *= 0.3;
            if (clip.sfxId && loops.some(e => e.sfxId === clip.sfxId)) continue;
            if (loops.length >= 3) { const old = loops.shift(); old.duration = Math.max(0, cursor - old.start); old.loop = true; old.stopped = true; }
            loops.push(event);
        } else {
            end = Math.max(end, cursor + seconds);
            if (clip.kind !== 'sfx' || clip.mode !== 'overlay') cursor += seconds + clamp(clip.gapMs, 0, 10000, gapMs) / 1000;
        }
        events.push(event);
    }
    // Last line's trailing breath is not added to the exported file.
    const duration = Math.max(end, loops.length && !end ? 5 : 0);
    for (const loop of loops) { loop.duration = Math.max(0, duration - loop.start); loop.loop = true; }
    if (duration > 600) throw new Error('한 번에 10분까지 저장할 수 있어요. 대본을 나눠 주세요.');
    return { events: events.filter(e => e.duration > 0), duration };
}
function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels), frames = buffer.length;
    const view = new DataView(new ArrayBuffer(44 + frames * channels * 2));
    const word = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
    word(0, 'RIFF'); view.setUint32(4, 36 + frames * channels * 2, true); word(8, 'WAVE');
    word(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, frames * channels * 2, true);
    const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    let peak = 1;
    for (const channel of data) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    let at = 44;
    for (let i = 0; i < frames; i++) for (const channel of data) { const x = Math.max(-1, Math.min(1, channel[i] / peak)); view.setInt16(at, x * (x < 0 ? 32768 : 32767), true); at += 2; }
    return new Blob([view], { type: 'audio/wav' });
}
export async function mixScene(clips, options = {}) {
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!OAC) throw new Error('이 브라우저에서는 소리 합치기를 지원하지 않아요.');
    const decoder = new OAC(2, 1, 44100), decoded = [];
    let decodedSeconds = 0;
    for (const clip of clips) {
        if (!clip.blob) { decoded.push(clip); continue; }
        const buffer = await decoder.decodeAudioData(await clip.blob.arrayBuffer());
        decodedSeconds += buffer.duration;
        if (decodedSeconds > 1200) throw new Error('음원이 너무 길어요. 대본을 나눠 저장해 주세요.');
        decoded.push({ ...clip, buffer });
    }
    const timeline = sceneTimeline(decoded, options);
    if (!timeline.duration) throw new Error('저장할 소리가 없어요.');
    const ctx = new OAC(2, Math.ceil(timeline.duration * 44100), 44100);
    for (const event of timeline.events) {
        const src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = event.buffer; src.playbackRate.value = event.rate; src.loop = !!event.loop;
        gain.gain.setValueAtTime(event.gain, event.start);
        if (event.loop) {
            const fade = Math.min(0.15, event.duration / 2);
            gain.gain.setValueAtTime(0, event.start); gain.gain.linearRampToValueAtTime(event.gain, event.start + fade);
            gain.gain.setValueAtTime(event.gain, event.start + event.duration - fade); gain.gain.linearRampToValueAtTime(0, event.start + event.duration);
        }
        src.connect(gain); gain.connect(ctx.destination); src.start(event.start); src.stop(event.start + event.duration);
    }
    return encodeWav(await ctx.startRendering());
}
