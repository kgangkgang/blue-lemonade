// 7.0.1 분위기 음악 (src/scene-music-rules.js · scene-music.js · scene-sound.js 연결 · scene-sound-ui.js · src/scene-music/)
// 규칙: 분위기 판정 표 · 유지 시간 · 덕킹 · 합 음량 상한 · 설정 정리 · 반복 구간 / 런타임: 가짜 소리판으로 노드 그래프 · 크로스페이드 · 덕킹 · 숨은 탭 · 내 곡 / 설정 조각 / 출처 · 라이선스 · 게시 목록
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const load = file => import(pathToFileURL(path.join(root, file)));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

const R = await load('src/scene-music-rules.js');
const { detectMood, scoreText, nextMood, pickTrack, tidyMusic, musicGain, capMix, duckLevel, anySpeaking, loopBounds, MOODS, TRACKS, TRACK_IDS, HOLD, DUCK, FADE, MIX_CAP } = R;

// ───────── 판정 표 ─────────
const TABLE = [
    ['battle', '그는 칼을 뽑아 휘둘렀다. 칼날이 맞부딪치며 불꽃이 튀었다! 적이 돌진해 왔다!'],
    ['battle', 'She drew her sword and lunged at the enemy. The battle had begun!'],
    ['tense', '복도 끝에서 발소리가 들렸다. 그녀는 숨을 죽이고 그림자 속에 숨어 있었다. 식은땀이 흘렀다.'],
    ['tense', 'Footsteps echoed in the dark hallway. She held her breath, afraid, hiding in the shadows.'],
    ['romance', '그가 조용히 손을 잡았다. 볼이 붉어진 그녀가 고개를 숙이자, 그는 귓가에 속삭였다. "사랑해."'],
    ['romance', 'He pulled her into a gentle hug and kissed her lips. She blushed.'],
    ['sad', '<crying>「가지 마…」</crying> 눈물이 뺨을 타고 흘렀다. 이별은 생각보다 아팠다…'],
    ['sad', 'Tears ran down her face as she whispered goodbye at the funeral.'],
    ['mystic', '고대 신전의 제단 위, 룬 문양이 빛나기 시작했다. 정령의 목소리가 울렸다.'],
    ['mystic', 'The ancient runes on the altar began to glow as the ritual started. Magic hummed in the air.'],
    ['festive', '광장은 축제로 왁자지껄했다. 사람들은 건배를 외치며 춤을 추었고, 불꽃놀이가 하늘을 수놓았다!'],
    ['festive', 'The festival was in full swing — people danced, raised a toast and watched the fireworks.'],
    ['daily', '아침 햇살이 들어오는 부엌에서 커피를 내렸다. 오늘은 수업이 없어 산책이나 갈까 했다.'],
    ['daily', 'She made coffee and breakfast, then curled up on the sofa with her phone.'],
];
await t('판정 표: 분위기마다 한국어 · 영어 예문 둘이 그 분위기로 (AI 호출 없음 · 낱말 · 문장부호 · 감정 태그)', () => {
    for (const [want, text] of TABLE) { const d = detectMood([text]); assert.equal(d.mood, want, `${want}: ${text} → ${JSON.stringify(d.scores)}`); }
    assert.deepEqual([...new Set(TABLE.map(([m]) => m))].sort(), [...MOODS].sort(), '7개 분위기 모두 표에');
});
await t('판정: 헷갈리는 짧은 글자에 안 걸린다 (검은 · 총명 · 피곤) · 뚜렷하지 않으면 null · 빈 글 · 코드 블록 · HTML 은 빼고 센다', () => {
    for (const text of ['그는 검은 코트를 입고 창밖을 보았다.', '그녀는 총명한 눈으로 피곤한 듯 웃었다.', '', '   ']) assert.equal(detectMood([text]).mood, null, text);
    assert.equal(detectMood([]).mood, null); assert.equal(detectMood(null).mood, null);
    assert.equal(detectMood(['```\n칼을 휘둘렀다 칼을 휘둘렀다 공격 공격\n```']).mood, null, '코드 블록 안 글은 세지 않음');
    assert.equal(scoreText('<div class="battle attack">평범한 하루</div>').battle, 0, '태그 속성은 세지 않음');
    const mixed = detectMood(['그는 칼을 휘둘렀다. 그녀는 눈물을 흘리며 흐느꼈다.']);
    assert.equal(mixed.mood, null, '두 분위기가 비슷하면 고르지 않음 (지금 곡 유지)');
});
await t('판정: 같은 낱말 반복은 두 번까지 · 최근 답 1 + 그 전 답 0.5 · 감정 태그 · 느낌표 · 「?!」 · 말줄임', () => {
    assert.equal(scoreText('공격 공격 공격 공격 공격').battle, 3, '1.5 × 2');
    const both = detectMood(['그는 칼을 휘둘렀다. 적이 돌진했다!', '고대 신전의 룬 문양이 빛났다. 정령이 나타났다.']);
    assert.equal(both.mood, 'battle', '새 답이 우선'); assert.ok(both.scores.mystic > 0, '그 전 답도 반만 더함');
    assert.ok(scoreText('<anxious>「누, 누구야?!」</anxious>').tense >= 2, 'anxious 태그 + ?!');
    assert.equal(scoreText('<crying>「…」</crying>').sad >= 2, true);
    const bangs = scoreText('가자! 빨리! 지금! 어서!'); assert.ok(bangs.battle > 0 && bangs.tense > 0, '느낌표가 잦으면 격한 장면 쪽');
    assert.ok(scoreText('그래…… 그랬구나…… 응……').sad > 0, '말줄임이 잦으면 가라앉은 쪽');
});

// ───────── 유지 시간 ─────────
await t('유지 시간: 처음 · 채팅이 바뀌면 바로, 75초 안에는 그대로, 그 뒤엔 같은 분위기 두 번 또는 강한 점수, 전투 · 긴장은 20초', () => {
    const D = (mood, score = 3) => ({ mood, score });
    let s = nextMood(null, D(null), { now: 0 }); assert.equal(s.mood, 'daily'); assert.equal(s.reason, 'start');
    s = nextMood(s, D('romance', 3), { now: 10_000 }); assert.equal(s.mood, 'daily'); assert.equal(s.reason, 'hold'); assert.deepEqual(s.pending, { mood: 'romance', count: 1 });
    s = nextMood(s, D('romance', 3), { now: 60_000 }); assert.equal(s.mood, 'daily', '두 번이어도 75초 안이면 그대로'); assert.equal(s.pending.count, 2);
    s = nextMood(s, D('romance', 3), { now: 76_000 }); assert.equal(s.mood, 'romance'); assert.equal(s.reason, 'twice'); assert.equal(s.since, 76_000); assert.equal(s.changed, true);
    s = nextMood(s, D('sad', 3), { now: 160_000 }); assert.equal(s.mood, 'romance', '75초 지났어도 한 번은 기다림'); assert.equal(s.reason, 'pending');
    s = nextMood(s, D('mystic', 3), { now: 170_000 }); assert.deepEqual(s.pending, { mood: 'mystic', count: 1 }, '다른 분위기가 끼면 처음부터');
    s = nextMood(s, D('festive', 4), { now: 175_000 }); assert.equal(s.mood, 'festive'); assert.equal(s.reason, 'strong');
    s = nextMood(s, D('battle', 6), { now: 185_000 }); assert.equal(s.mood, 'festive', '전투도 20초는 기다림');
    s = nextMood(s, D('battle', 6), { now: 196_000 }); assert.equal(s.mood, 'battle'); assert.equal(s.reason, 'urgent');
    s = nextMood(s, D('sad', 8), { now: 200_000 }); assert.equal(s.mood, 'battle', '슬픔은 강해도 75초');
    s = nextMood(s, D(null, 1), { now: 400_000 }); assert.equal(s.mood, 'battle'); assert.equal(s.reason, 'unclear');
    s = nextMood(s, D('sad', 2), { now: 410_000, reset: true }); assert.equal(s.mood, 'sad'); assert.equal(s.reason, 'chat');
    s = nextMood(s, D(null), { now: 420_000, reset: true }); assert.equal(s.mood, 'daily', '새 채팅에 뚜렷한 분위기가 없으면 일상');
    s = nextMood(s, D('battle', 9), { now: 421_000, fixed: 'mystic' }); assert.equal(s.mood, 'mystic'); assert.equal(s.reason, 'fixed');
    s = nextMood(s, D('battle', 9), { now: 500_000, fixed: 'mystic' }); assert.equal(s.mood, 'mystic'); assert.equal(s.changed, false);
    assert.equal(HOLD.ms, 75_000); assert.equal(HOLD.urgentMs, 20_000);
    assert.ok(FADE.swap >= 3 && FADE.swap <= 5, '바뀔 때 3~5초 크로스페이드');
});

// ───────── 곡 · 크기 · 덕킹 · 상한 ─────────
await t('곡 고르기: 분위기마다 1~2곡, 같은 분위기에 다시 들어오면 다음 곡, 내 곡이 있으면 그것', () => {
    for (const mood of MOODS) assert.ok(TRACKS[mood].length >= 1 && TRACKS[mood].length <= 2, mood);
    assert.equal(TRACK_IDS.length, 8);
    assert.deepEqual(pickTrack('daily', {}, 0), { id: 'daily_town', url: 'scene-music/daily_town.mp3', file: false });
    assert.equal(pickTrack('daily', {}, 1).id, 'daily_lofi'); assert.equal(pickTrack('daily', {}, 2).id, 'daily_town');
    assert.deepEqual(pickTrack('sad', { sad: '/user/files/bl-scene-music-sad-1.mp3' }, 0), { id: 'file:sad', url: '/user/files/bl-scene-music-sad-1.mp3', file: true });
    assert.equal(pickTrack('nope'), null);
});
await t('tidyMusic: 기본 꺼짐 · 크기 0~100 · 모르는 분위기는 자동 · 내 곡 경로 거르기', () => {
    assert.deepEqual(tidyMusic(undefined), { on: false, volume: 30, mood: 'auto', files: {} });
    assert.deepEqual(tidyMusic({ on: 'yes', volume: '300', mood: 'horror', files: { sad: 'user/files/a.mp3', battle: 'https://x/y.mp3', joy: '/user/files/b.mp3', mystic: '/user/files/../c.ogg' } }),
        { on: false, volume: 100, mood: 'auto', files: { sad: '/user/files/a.mp3' } });
    assert.equal(tidyMusic({ on: true, mood: 'battle', volume: 12.4 }).mood, 'battle');
});
await t('크기 · 합 상한: 음악은 담긴 곡이 더 커서 0.6 배, 날씨 + 음악 게인 합이 1 을 넘으면 둘을 같은 비율로', () => {
    assert.equal(musicGain(100), 0.6); assert.equal(musicGain(0), 0); assert.equal(musicGain(30), 0.099);
    assert.deepEqual(capMix(0.253, 0.099), { ambient: 0.253, music: 0.099, scale: 1 }, '기본값은 상한 아래');
    const loud = capMix(1, 0.6); assert.equal(MIX_CAP, 1); assert.equal(loud.ambient + loud.music, 1); assert.equal(loud.ambient / loud.music, 1 / 0.6);
    assert.deepEqual(capMix(0, 0), { ambient: 0, music: 0, scale: 1 });
});
await t('덕킹: 말하는 동안 0.3 배(약 -10 dB), 반복 · 음소거 · 아주 작은 소리 · 멈춘 소리는 말로 안 본다', () => {
    assert.equal(duckLevel(true), 0.3); assert.equal(duckLevel(false), 1); assert.equal(DUCK.level, 0.3);
    assert.ok(DUCK.attack < 0.5 && DUCK.hold > 0 && DUCK.release >= 1);
    const el = (o = {}) => ({ paused: false, ended: false, muted: false, loop: false, volume: 1, ...o });
    assert.equal(anySpeaking([el()]), true);
    for (const quiet of [el({ paused: true }), el({ ended: true }), el({ muted: true }), el({ loop: true }), el({ volume: 0.01 })]) assert.equal(anySpeaking([quiet]), false, JSON.stringify(quiet));
    assert.equal(anySpeaking([]), false); assert.equal(anySpeaking(null), false);
});
await t('반복 구간: mp3 인코더가 붙인 앞뒤 무음(60ms 안)만 건너뛴다', () => {
    const rate = 1000, data = new Float32Array(2000).fill(0.2);
    data.fill(0, 0, 25); data.fill(0, 1990);
    assert.deepEqual(loopBounds(data, rate), { start: 0.025, end: 1.99 });
    const long = new Float32Array(2000).fill(0.2); long.fill(0, 0, 500);
    assert.deepEqual(loopBounds(long, rate), { start: 0, end: 2 }, '긴 무음은 곡의 일부');
    assert.deepEqual(loopBounds(new Float32Array(0), rate), { start: 0, end: 0 });
});

// ───────── 가짜 소리판 ─────────
class Param {
    constructor(value) { this.value = value; this.log = []; }
    setValueAtTime(v, at) { this.log.push(['set', v, at]); this.value = v; return this; }
    linearRampToValueAtTime(v, at) { this.log.push(['lin', v, at]); this.value = v; return this; }
    exponentialRampToValueAtTime(v, at) { this.log.push(['exp', v, at]); this.value = v; return this; }
    cancelScheduledValues(at) { this.log.push(['cancel', at]); return this; }
}
class Node {
    constructor(ctx, type) { this.ctx = ctx; this.context = ctx; this.type = type; this.outputs = new Set(); this.started = null; this.stopped = null; ctx.nodes.push(this); }
    connect(dest) { this.outputs.add(dest); return dest; }
    disconnect() { this.outputs.clear(); this.disconnected = true; }
    start(at = 0, offset = 0) { this.started = { at, offset }; }
    stop(at = 0) { this.stopped = at; }
}
const decoded = [];
class FakeContext {
    constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended'; this.nodes = []; this.destination = new Node(this, 'destination'); this.nodes.length = 0; }
    createGain() { const node = new Node(this, 'gain'); node.gain = new Param(1); return node; }
    createBiquadFilter() { const node = new Node(this, 'biquad'); node.frequency = new Param(350); node.Q = new Param(1); return node; }
    createOscillator() { const node = new Node(this, 'osc'); node.frequency = new Param(440); return node; }
    createBufferSource() { const node = new Node(this, 'source'); node.playbackRate = new Param(1); node.loop = false; node.buffer = null; node.loopStart = 0; node.loopEnd = 0; return node; }
    createBuffer(channels, length, rate) { const data = new Float32Array(length); return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data }; }
    async decodeAudioData(bytes) {
        const rate = 48000, data = new Float32Array(rate * 2).fill(0.1); data.fill(0, 0, 1200);   // 앞 25ms 무음 (인코더 여백 흉내)
        const buffer = { sampleRate: rate, length: data.length, duration: 2, bytes: bytes.byteLength, getChannelData: () => data };
        decoded.push(buffer); return buffer;
    }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
}
const timers = []; let clock = 1_000_000, timerSeq = 0;
const fetched = [];
let media = [];
const doc = Object.assign(new EventTarget(), { hidden: false, querySelectorAll: sel => sel === 'audio, video' ? media : sel === '[data-bl-music-now]' ? marks : [] });
const marks = [{ textContent: '', dataset: {} }];
const stEvents = {};
const st = { chat: [], chatId: 'chat-a' };
const fakeHost = {
    AudioContext: () => FakeContext,
    doc: () => doc, now: () => clock, random: () => 0.5,
    fetch: async url => { fetched.push(String(url)); return { ok: !/missing/.test(url), status: 404, arrayBuffer: async () => new ArrayBuffer(32) }; },
    setTimeout: (fn, ms) => { const id = ++timerSeq; timers.push({ id, fn, due: clock + ms }); return id; },
    clearTimeout: id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
    weather: async () => ({ weatherState: () => ({ current: null }) }),
    context: () => ({ chat: st.chat, getCurrentChatId: () => st.chatId, eventSource: { on: (name, fn) => (stEvents[name] ??= []).push(fn) }, event_types: { CHARACTER_MESSAGE_RENDERED: 'cmr', CHAT_CHANGED: 'cc', MESSAGE_SWIPED: 'sw' } }),
};
const runFakeTimers = (upTo = clock) => { for (const timer of timers.splice(0).sort((a, b) => a.due - b.due)) { if (timer.due <= upTo) timer.fn(); else timers.push(timer); } };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };
const reply = (text, extra = {}) => ({ is_user: false, mes: text, ...extra });
const say = async (text, advance = 1000) => { st.chat.push({ is_user: true, mes: '…' }, reply(text)); clock += advance; for (const fn of stEvents.cmr || []) fn(); clock += 900; runFakeTimers(); await settle(); };

const ss = await load('src/scene-sound.js');
const { syncSceneSound, sceneSoundState, AMBIENT, _forTest } = ss;
_forTest.setHost(fakeHost);
const music = () => _forTest.musicApi();
const mstate = () => sceneSoundState().music;
const SS = (musicCfg, extra = {}) => ({ on: true, volume: 40, ...extra, music: { on: true, volume: 30, ...musicCfg } });
const NO_WEATHER = { weather: 'off', weather2: 'off' };

await t('끈 채로는 음악 모듈을 불러오지 않는다 · 날씨 소리 크기는 예전 그대로 (상한 없음)', async () => {
    await syncSceneSound(true, { on: true, volume: 100 }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(music(), null); assert.equal(sceneSoundState().master, 1); assert.equal(sceneSoundState().music, null);
    await syncSceneSound(true, { on: true, volume: 100 }, NO_WEATHER, false); await settle();
    clock += 3000; runFakeTimers();
});
await t('켜기: 날씨 없이도 첫 답의 분위기 곡 → 곡 · 곡 게인 · 덕킹 게인 · 음악 버스 · 출력, 반복 구간은 앞 무음을 건너뜀, 3초 페이드 인', async () => {
    st.chat = [reply('그는 칼을 뽑아 휘둘렀다. 칼날이 맞부딪치며 불꽃이 튀었다! 적이 돌진해 왔다!')];
    await syncSceneSound(true, SS({}), NO_WEATHER, false); await settle();
    const m = mstate();
    assert.equal(m.enabled, true); assert.equal(m.mood, 'battle'); assert.equal(m.track, 'battle_pursuit');
    assert.ok(fetched.at(-1).replaceAll('\\', '/').endsWith('src/scene-music/battle_pursuit.mp3'), fetched.at(-1));
    const { bus, duck } = music()._forTest.nodes();
    const ctx = _forTest.context();
    const src = ctx.nodes.filter(x => x.type === 'source').at(-1);
    assert.equal(src.loop, true); assert.equal(src.loopStart, 0.025); assert.equal(src.loopEnd, 2); assert.deepEqual(src.started, { at: 0, offset: 0.025 });
    const voiceGain = [...src.outputs][0];
    assert.ok(voiceGain.outputs.has(duck) && duck.outputs.has(bus) && bus.outputs.has(ctx.destination), '곡 → 곡 게인 → 덕킹 → 버스 → 출력');
    assert.deepEqual(voiceGain.gain.log.at(-1), ['lin', 1, 3]);
    assert.equal(bus.gain.value, 0.099, '음악 크기 30% → 0.099'); assert.equal(duck.gain.value, 1);
    assert.equal(sceneSoundState().master, 0.253, '합 0.352 < 1 → 날씨 소리 그대로');
    assert.equal(ctx.state, 'running');
    assert.deepEqual(globalThis[AMBIENT].music(), { mood: 'battle', label: '전투', since: clock, track: 'battle_pursuit', file: false, ducked: false, fixed: false });
    assert.equal(marks[0].textContent, '전투', '설정 창의 「지금」 표시');
});
await t('유지 시간 (런타임): 20초 안 로맨스는 그대로 → 75초 뒤 두 번째 로맨스에서 4초 크로스페이드', async () => {
    const ctx = _forTest.context(); ctx.currentTime = 10;
    await say('그가 조용히 손을 잡았다. 볼이 붉어진 그녀가 고개를 숙이자, 그는 귓가에 속삭였다. "사랑해."', 5000);
    assert.equal(mstate().mood, 'battle'); assert.deepEqual(mstate().pending, { mood: 'romance', count: 1 });
    clock += 75_000;
    await say('그는 그녀를 꼭 끌어안았다. 두근거리는 심장 소리가 들렸다. "좋아해."');
    const m = mstate();
    assert.equal(m.mood, 'romance'); assert.equal(m.track, 'romance_next');
    assert.deepEqual(m.outgoing.map(o => o.mood), ['battle']);
    const sources = ctx.nodes.filter(x => x.type === 'source');
    const old = sources.at(-2), neu = sources.at(-1);
    assert.equal(old.stopped, 10 + 4 + 0.05, '나가는 곡은 4초 페이드 뒤 멈춤');
    assert.deepEqual([...old.outputs][0].gain.log.at(-1), ['lin', 0, 14]); assert.deepEqual([...neu.outputs][0].gain.log.at(-1), ['lin', 1, 14]);
    clock += 5000; runFakeTimers(); assert.deepEqual(mstate().outgoing, []);
});
await t('전투는 20초만 지나면 바로 · 채팅이 바뀌면 유지 시간 없이 그 채팅의 분위기', async () => {
    clock += 21_000;
    await say('적이 기습했다! 그는 검을 휘둘러 공격을 막아냈다! 총성이 울리고 폭발이 일어났다!');
    assert.equal(mstate().mood, 'battle');
    st.chat = [reply('<crying>「가지 마…」</crying> 눈물이 뺨을 타고 흘렀다. 이별은 생각보다 아팠다…')]; st.chatId = 'chat-b';
    clock += 2000; for (const fn of stEvents.cc) fn(); clock += 900; runFakeTimers(); await settle();
    assert.equal(mstate().mood, 'sad'); assert.equal(mstate().track, 'sad_hope');
    clock += 5000; runFakeTimers();
});
await t('덕킹: TTS 대사(문서 안 audio)가 재생되면 0.25초 안에 0.3 으로, 멈추면 0.7초 기다렸다 1.2초 동안 돌아온다 · 반복 오디오는 무시', async () => {
    const ctx = _forTest.context(); ctx.currentTime = 100;
    const { duck } = music()._forTest.nodes();
    media = [{ paused: false, ended: false, muted: false, loop: true, volume: 1 }];
    doc.dispatchEvent(new Event('play')); assert.equal(duck.gain.value, 1, '반복(배경) 오디오는 말이 아님');
    const voice = { paused: false, ended: false, muted: false, loop: false, volume: 0.9 }; media.push(voice);
    doc.dispatchEvent(new Event('playing'));
    assert.deepEqual(duck.gain.log.at(-1), ['lin', 0.3, 100.25]); assert.equal(mstate().ducked, true); assert.equal(globalThis[AMBIENT].music().ducked, true);
    voice.paused = true; doc.dispatchEvent(new Event('pause'));
    assert.equal(duck.gain.value, 0.3, '문장 사이 틈에는 바로 안 올림');
    clock += 300; voice.paused = false; doc.dispatchEvent(new Event('play')); clock += 500; runFakeTimers();
    assert.equal(duck.gain.value, 0.3, '0.7초 안에 다음 문장이 오면 그대로');
    voice.ended = true; doc.dispatchEvent(new Event('ended')); clock += 700; runFakeTimers();
    assert.deepEqual(duck.gain.log.at(-1), ['lin', 1, 101.2]); assert.equal(mstate().ducked, false);
    voice.ended = false; voice.paused = false; document_lemon(); assert.equal(mstate().ducked, true, 'TTS 상태 알림(lemon-voice:state)도 다시 보게 한다');
    voice.paused = true; document_lemon(); clock += 800; runFakeTimers(); media = [];
    function document_lemon() { doc.dispatchEvent(new CustomEvent('lemon-voice:state', { detail: { playing: !voice.paused } })); }
});
await t('합 음량 상한: 날씨 100% + 음악 100% → 둘을 같은 비율로 (1 : 0.6 → 0.625 : 0.375), 음악을 끄면 날씨는 다시 1', async () => {
    await syncSceneSound(true, SS({ volume: 100 }, { volume: 100 }), { weather: 'rain', weather2: 'off' }, true); await settle();
    const { bus } = music()._forTest.nodes();
    assert.equal(sceneSoundState().master, 0.625); assert.equal(bus.gain.value, 0.375);
    assert.ok(sceneSoundState().master + bus.gain.value <= 1 + 1e-9);
    await syncSceneSound(true, { on: true, volume: 100, music: { on: false, volume: 100 } }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(sceneSoundState().master, 1); assert.equal(mstate().enabled, false); assert.equal(globalThis[AMBIENT].music(), null);
    assert.deepEqual(mstate().outgoing.map(o => o.mood), ['sad'], '끄면 2.5초 페이드아웃');
    clock += 3000; runFakeTimers();
});
await t('분위기 고정: 고르면 바로 그 분위기 · 답이 와도 안 바뀜 · 「고정」 표시, 자동으로 돌리면 지금 답으로 다시', async () => {
    await syncSceneSound(true, SS({ mood: 'mystic' }), NO_WEATHER, false); await settle();
    assert.equal(mstate().mood, 'mystic'); assert.equal(mstate().track, 'mystic_shrine'); assert.equal(marks[0].textContent, '신비 · 고정');
    clock += 200_000; await say('광장은 축제로 왁자지껄했다. 사람들은 건배를 외치며 춤을 추었고, 불꽃놀이가 하늘을 수놓았다!');
    assert.equal(mstate().mood, 'mystic');
    await syncSceneSound(true, SS({ mood: 'auto' }), NO_WEATHER, false); await settle();
    assert.equal(mstate().mood, 'festive'); assert.equal(globalThis[AMBIENT].music().fixed, false);
    clock += 5000; runFakeTimers();
});
await t('내 곡: 그 분위기는 내 파일로 · 못 읽으면 담긴 곡으로 · 빼면 담긴 곡으로 크로스페이드', async () => {
    await syncSceneSound(true, SS({ mood: 'auto', files: { festive: '/user/files/bl-scene-music-festive-1.mp3' } }), NO_WEATHER, false); await settle();
    assert.equal(mstate().track, 'file:festive'); assert.equal(fetched.at(-1), '/user/files/bl-scene-music-festive-1.mp3');
    await syncSceneSound(true, SS({ files: { festive: '/user/files/missing.mp3' } }), NO_WEATHER, false); await settle();
    assert.equal(mstate().track, 'festive_feast', '못 읽으면 담긴 곡');
    await syncSceneSound(true, SS({ files: {} }), NO_WEATHER, false); await settle();
    assert.equal(mstate().mood, 'festive');
    clock += 5000; runFakeTimers();
});
await t('숨은 탭: 「화면 밖에서도」 켬(기본)이면 계속 · 끄면 0.8초 페이드아웃 뒤 쉬고, 돌아오면 같은 분위기로 이어진다 · 소리판도 잠든다', async () => {
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(mstate().resting, false); assert.ok(mstate().track);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    await syncSceneSound(true, SS({}, { background: false }), NO_WEATHER, false); await settle();
    const ctx = _forTest.context(); ctx.currentTime = 300;
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(mstate().resting, true); assert.equal(mstate().track, null); assert.equal(globalThis[AMBIENT].music(), null);
    assert.ok(ctx.nodes.some(x => x.type === 'source' && Math.abs(x.stopped - 300.85) < 1e-9), '0.8초 + 0.05');
    clock += 1000; runFakeTimers(); assert.equal(ctx.state, 'suspended', '다 걷히면 소리판도 잠든다');
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(mstate().resting, false); assert.equal(mstate().mood, 'festive'); assert.ok(mstate().track); assert.equal(ctx.state, 'running');
});
await t('장면 소리를 끄면 음악도 페이드아웃 · 다리 비움', async () => {
    await syncSceneSound(false, SS({}), NO_WEATHER, false); await settle();
    assert.equal(mstate().enabled, false); assert.equal(globalThis[AMBIENT].music(), null); assert.equal(marks[0].textContent, '');
});

// ───────── 7.0.1 버그 사냥 2차 (장면 소리 3건) ─────────
await t('비 세 단계: 빗소리가 TTS 의 가랑비 · 비 · 장대비 효과음을 모두 대신 · TTS 의 이어지는 비 · 바람 · 물 효과음은 빠짐없이 표에', async () => {
    const rules = await load('src/scene-sound-rules.js');
    for (const id of ['daily_rain_light', 'daily_rain', 'daily_rain_heavy']) assert.equal(rules.coversSfx(['rain'], id), true, id);
    const sustained = [...read('src/addons/tts/src/analysis.js').match(/const SUSTAINED_SFX = new Set\(\[([^\]]*)\]/)[1].matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
    const ambientLike = sustained.filter(id => /^(?:daily_rain|daily_stream|wind$|thunder$)/.test(id));
    assert.ok(ambientLike.length >= 5, ambientLike.join(','));
    for (const id of ambientLike) assert.ok(rules.coversSfx(['rain', 'thunder', 'wind', 'water'], id), `TTS ${id} 를 장면 소리가 대신 못 함`);
});
await t('숨은 탭(화면 밖에서도 켬): 빗소리는 이어지지만 천둥은 「들리는 종류」에서 빠져 TTS 천둥 효과음이 난다 · 돌아오면 다시 · 구독자에게 알림', async () => {
    await syncSceneSound(true, { on: true, volume: 40, thunder: true, background: true }, { weather: 'rain', weather2: 'off' }, true); await settle();
    const bridge = globalThis[AMBIENT];
    assert.deepEqual([...bridge.kinds], ['rain', 'thunder']); assert.equal(bridge.covers('thunder'), true);
    const seen = []; const off = bridge.onChange(e => seen.push([...e.kinds]));
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.deepEqual([...bridge.kinds], ['rain']); assert.equal(bridge.covers('thunder'), false); assert.equal(bridge.covers('daily_rain_heavy'), true);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(bridge.covers('thunder'), true);
    assert.deepEqual(seen, [['rain'], ['rain', 'thunder']]);
    off();
    await syncSceneSound(true, { on: true, volume: 40 }, NO_WEATHER, false); await settle(); clock += 3000; runFakeTimers();
});
await t('내 파일 × : 확인 창(붉은 「빼기」) 뒤에만 빼고, ↶ 를 누르면 경로를 되돌리고 서버 파일은 안 지움 · 안 누르면 알림이 닫힌 뒤에 지움', async () => {
    const ui = await load('src/scene-sound-ui.js');
    const calls = [], later = [];
    let st = { sceneSound: { files: { rain: '/user/files/r.mp3' } } };
    const update = fn => fn(st);
    const base = { name: '비', url: '/user/files/r.mp3', update, unset: s => delete s.sceneSound.files.rain, restore: s => { s.sceneSound.files.rain = '/user/files/r.mp3'; },
        del: url => calls.push(['del', url]), later: (fn, ms) => later.push([fn, ms]) };
    let asked = null;
    assert.equal(await ui.removeSceneFile({ ...base, confirm: async (msg, opt) => { asked = [msg, opt]; return false; } }), false);
    assert.equal(st.sceneSound.files.rain, '/user/files/r.mp3', '취소하면 그대로'); assert.deepEqual(calls, []);
    assert.match(asked[0], /비 내 파일을 뺄까요\?\n올린 파일도 지워져요/); assert.deepEqual(asked[1], { ok: '빼기', danger: true });
    let hidden = null, undoFn = null;
    const toast = { info: (text, title, opt) => { hidden = opt.onHidden; return { text }; } };
    const undo = (note, fn) => { undoFn = fn; return {}; };
    assert.equal(await ui.removeSceneFile({ ...base, confirm: async () => true, toast, undo }), true);
    assert.equal(st.sceneSound.files.rain, undefined, '확인하면 뺌'); assert.deepEqual(calls, [], '서버 파일은 아직');
    undoFn(); hidden(); for (const [fn] of later.splice(0)) fn();
    assert.equal(st.sceneSound.files.rain, '/user/files/r.mp3', '↶ 로 되돌림'); assert.deepEqual(calls, [], '↶ 뒤에는 안 지움');
    assert.equal(await ui.removeSceneFile({ ...base, confirm: async () => true, toast, undo }), true);
    hidden(); for (const [fn] of later.splice(0)) fn();
    assert.deepEqual(calls, [['del', '/user/files/r.mp3']], '알림이 닫힌 뒤 한 번 지움');
    assert.equal(await ui.removeSceneFile({ ...base, confirm: async () => true, toast: null, undo }), true);
    assert.equal(calls.length, 2, '알림을 못 띄우면 바로 지움');
    const src = read('src/scene-sound-ui.js');
    assert.equal((src.match(/await removeSceneFile\(/g) || []).length, 2, '장면 소리 × · 분위기 음악 × 둘 다');
    assert.ok(!/await deleteSceneFile\(old\);\s*return;/.test(src), '확인 없이 바로 지우는 길이 없다');
    assert.ok(/RESET_KEEP = \[[^\]]*'sceneSound'\]/.test(read('src/settings.js')), '처음 설정으로(모습)도 내 파일 경로는 남김');
});
await t('지운 내 파일 경로가 되살아나면(설정 ↶) 파일마다 한 번 알린다 — 소리는 합성 · 담긴 곡으로', async () => {
    const toasts = []; globalThis.toastr = { warning: text => toasts.push(text) };
    await syncSceneSound(true, { on: true, volume: 40, files: { water: '/user/files/missing-w.mp3' } }, { weather: 'water', weather2: 'off' }, true); await settle();
    await syncSceneSound(true, { on: true, volume: 40, files: { water: '/user/files/missing-w.mp3' }, music: { on: true, mood: 'sad', files: { sad: '/user/files/missing-s.mp3' } } }, { weather: 'water', weather2: 'off' }, true); await settle();
    assert.equal(sceneSoundState().kind, 'water'); assert.equal(sceneSoundState().file, '');
    assert.equal(mstate().track, 'sad_hope');
    assert.deepEqual(toasts, ['내 소리 파일을 찾지 못해 합성 소리로 들려요', '내 곡을 찾지 못해 담긴 곡으로 들려요']);
    delete globalThis.toastr;
    await syncSceneSound(true, { on: true, volume: 40, music: { on: false } }, NO_WEATHER, false); await settle(); clock += 3000; runFakeTimers();
});

// ───────── 설정 조각 ─────────
const ui = await load('src/scene-sound-ui.js');
await t('설정 조각: 장면 소리 안 「분위기 음악」 스위치(기본 끔) → 켜면 음악 크기 · 분위기(자동 + 7) · 지금 표시 · 내 곡(접힘, 분위기마다 고르기 · 빼기)', () => {
    const calls = [];
    const h = { row: (l, c, note = '') => (calls.push(['row', l]), `<div class="salty-row"><span>${l}<small>${note}</small></span>${c}</div>`), stack: (l, c, note = '') => (calls.push(['stack', l]), `<div class="salty-stack"><span>${l}<small>${note}</small></span>${c}</div>`), slider: (p, l) => (calls.push(['slider', p]), `<div class="salty-slider" data-range="${p}">${l}</div>`), toggle: (p, on) => `<input data-toggle="${p}" ${on ? 'checked' : ''}>` };
    const soundOff = ui.sceneSoundMarkup({ sceneSound: { on: false, music: { on: true } } }, h);
    assert.ok(!soundOff.includes('sceneSound.music.on'), '장면 소리를 끄면 음악 줄도 없음');
    const off = ui.sceneSoundMarkup({ sceneSound: { on: true } }, h);
    assert.ok(off.includes('data-toggle="sceneSound.music.on" >') && !off.includes('sceneSound.music.volume') && !off.includes('bl-sm-moods'));
    calls.length = 0;
    const on = ui.sceneSoundMarkup({ sceneSound: { on: true, music: { on: true, mood: 'sad', files: { battle: '/user/files/bl-scene-music-battle-1700000000000.mp3' } } } }, h);
    assert.deepEqual(calls.filter(c => c[0] === 'slider').map(c => c[1]), ['sceneSound.volume', 'sceneSound.music.volume']);
    assert.equal((on.match(/data-path="sceneSound\.music\.mood"/g) || []).length, 8);
    assert.ok(/data-value="sad" aria-pressed="true" class="on">슬픔</.test(on) && /data-value="auto" aria-pressed="false"/.test(on));
    assert.ok(on.includes('data-bl-music-now') && on.includes('지금'));
    assert.equal((on.match(/data-ss-act="music-pick"/g) || []).length, 7); assert.equal((on.match(/data-ss-act="music-clear"/g) || []).length, 1);
    assert.ok(on.includes('data-md-fold="scene-music-files"') && on.includes('내 파일.mp3') && on.includes('>담긴 곡<'));
    assert.ok(!/title="/.test(on), 'hover 툴팁 없음'); assert.ok(/aria-label="전투 내 곡 고르기"/.test(on));
});
await t('설정 저장: settings.js 기본값 · 정리(tidySceneSound)에 music 이 들어가고 기존 열쇠는 그대로', async () => {
    const rules = await load('src/scene-sound-rules.js');
    assert.deepEqual(rules.tidySceneSound({ on: true, volume: 55, music: { on: true, volume: 70, mood: 'romance' } }),
        { on: true, volume: 55, thunder: true, background: true, files: {}, music: { on: true, volume: 70, mood: 'romance', files: {} } });
    assert.ok(/sceneSound: \{ on: false, volume: 40, thunder: true, background: true, files: \{\}, music: \{ on: false, volume: 30, mood: 'auto', files: \{\} \} \}/.test(read('src/settings.js')));
    assert.ok(read('src/settings-search.js').includes('분위기 음악'), '설정 검색');
});

// ───────── 출처 · 라이선스 · 게시 목록 ─────────
await t('출처: SOURCES.json 8곡 — OpenGameArt CC0 · 원본 URL · 작가 · 가공 내역 · 크기 · SHA256 이 실제 파일과 같고 곡당 1.2MB 아래', () => {
    const catalog = JSON.parse(read('src/scene-music/SOURCES.json'));
    assert.equal(catalog.version, 1); assert.equal(catalog.collection, 'Blue Lemonade scene music');
    assert.deepEqual(catalog.files.map(f => f.id).sort(), [...TRACK_IDS].sort());
    for (const f of catalog.files) {
        assert.equal(f.license, 'CC0-1.0'); assert.equal(f.licenseUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
        assert.match(f.source, /^https:\/\/opengameart\.org\/content\/[a-z0-9-]+$/); assert.equal(f.licenseEvidence, f.source);
        assert.match(f.downloadUrl, /^https:\/\/opengameart\.org\/sites\/default\/files\//);
        assert.ok(f.author && f.title && f.name && MOODS.includes(f.mood) && TRACKS[f.mood].includes(f.id), f.id);
        assert.equal(f.path, `scene-music/${f.id}.mp3`); assert.match(f.retrieved, /^\d{4}-\d{2}-\d{2}$/);
        const bytes = fs.readFileSync(path.join(root, 'src', f.path));
        assert.equal(bytes.length, f.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256);
        assert.ok(f.bytes < 1.2 * 1024 * 1024, `${f.id} ${f.bytes}`);
        assert.ok(bytes[0] === 0xff || bytes.subarray(0, 3).toString() === 'ID3', 'mp3');
        const m = f.modifications; assert.ok(m.excerptSeconds > 30 && m.excerptStart + m.excerptSeconds <= f.sourceDuration + 0.1 && /MP3/.test(m.encoding) && Number.isFinite(m.gainDb));
        assert.match(f.sourceSha256, /^[a-f0-9]{64}$/);
    }
    assert.ok(read('src/scene-music/LICENSE-CC0.txt').includes('CC0 1.0 Universal'));
});
await t('게시 목록: release_gate.py SCENE_MUSIC · build-integrity.mjs · THIRD-PARTY-NOTICES 가 같은 8곡 · CI 등록', () => {
    const catalog = JSON.parse(read('src/scene-music/SOURCES.json'));
    const gate = read('tools/release_gate.py');
    for (const f of catalog.files) {
        assert.ok(gate.includes(`'${f.id}': ('${f.mood}', '${f.source.split('/').pop()}', '${f.author}',`), `gate ${f.id}`);
        assert.ok(gate.includes(`'${f.sha256}'`) && gate.includes(`'${f.sourceSha256}'`), `gate sha ${f.id}`);
    }
    assert.ok(/validate_scene_music\(files\)/.test(gate) && /SCENE_MUSIC_RESOURCES = \('SOURCES\.json', 'LICENSE-CC0\.txt'\)/.test(gate));
    const integrity = read('tools/build-integrity.mjs');
    assert.ok(integrity.includes(`const musicIds='${catalog.files.map(f => f.id).join(' ')}'`), 'integrity 고정 목록 · 순서');
    const info = read('src/build-info.js');
    for (const f of catalog.files) assert.ok(info.includes(`"src/scene-music/${f.id}.mp3"`), `build-info ${f.id}`);
    const notices = read('THIRD-PARTY-NOTICES.md');
    assert.ok(notices.includes('src/scene-music/SOURCES.json') && notices.includes('src/scene-music/LICENSE-CC0.txt'));
    for (const f of catalog.files) assert.ok(notices.includes(f.source), `notice ${f.id}`);
    const ci = read('.github/workflows/release-check.yml');
    assert.ok(ci.includes('node tools/tests/scene-music.mjs .'));
});
await t('공개 범위: 새 파일에 개인 이름 · 금지 글자가 없다', () => {
    const banned = new RegExp(String.fromCharCode(0xAC24));
    for (const file of ['src/scene-music-rules.js', 'src/scene-music.js', 'src/scene-music/SOURCES.json', 'tools/tests/scene-music.mjs']) assert.ok(!banned.test(read(file)), file);
});

console.log(`scene-music: ${n} PASS`);
