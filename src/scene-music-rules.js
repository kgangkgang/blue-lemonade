// 분위기 음악 규칙 (7.0.1, 장면 소리 안): 최근 답 1~2개 → 분위기 하나, 너무 자주 안 바뀌게 유지 시간, TTS 가 말할 때 낮추기(덕킹), 날씨 소리와 합 음량 상한.
// 순수 모듈 — DOM · WebAudio 없음 (시험: tools/tests/scene-music.mjs). 실제 소리는 scene-music.js, 설정 화면은 scene-sound-ui.js.
// AI 호출 없이 낱말 · 문장부호 · 감정 대사 태그(<crying> 같은 데우스 태그)만 센다 — 판정은 가볍고, 틀려도 유지 시간이 막아 준다.

export const MOODS = Object.freeze(['daily', 'tense', 'battle', 'romance', 'sad', 'mystic', 'festive']);
export const MOOD_LABELS = Object.freeze({ daily: '일상', tense: '긴장', battle: '전투', romance: '로맨스', sad: '슬픔', mystic: '신비', festive: '축제' });

/** 담긴 곡 (src/scene-music/<id>.mp3 · 출처 src/scene-music/SOURCES.json). 분위기마다 1~2곡 — 같은 분위기로 다시 들어오면 다음 곡 */
export const TRACKS = Object.freeze({
    daily: Object.freeze(['daily_town', 'daily_lofi']),
    tense: Object.freeze(['tense_pressure']),
    battle: Object.freeze(['battle_pursuit']),
    romance: Object.freeze(['romance_next']),
    sad: Object.freeze(['sad_hope']),
    mystic: Object.freeze(['mystic_shrine']),
    festive: Object.freeze(['festive_feast']),
});
export const TRACK_IDS = Object.freeze(Object.values(TRACKS).flat());

/** 설정 기본값 (sceneSound.music) — 기본 꺼짐. volume %, mood 'auto' = 답을 읽어 고름 · 분위기 이름 = 그 분위기로 고정, files = 분위기마다 내 곡 */
export const MUSIC_DEFAULTS = Object.freeze({ on: false, volume: 30, mood: 'auto', files: Object.freeze({}) });

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/** 내 곡 경로: 장면 소리 내 파일과 같은 사용자 파일 영역 */
const FILE_URL = /^\/?user\/files\/[A-Za-z0-9_.-]+\.(mp3|ogg|oga|wav|m4a|aac|webm|flac|opus)$/i;

export function tidyMusic(raw) {
    const src = isObj(raw) ? raw : {};
    const n = Number(src.volume);
    const files = {};
    if (isObj(src.files)) for (const mood of MOODS) {
        const url = src.files[mood];
        if (typeof url === 'string' && FILE_URL.test(url.trim())) files[mood] = '/' + url.trim().replace(/^\/+/, '');
    }
    return {
        on: src.on === true,
        volume: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : MUSIC_DEFAULTS.volume,
        mood: MOODS.includes(src.mood) ? src.mood : 'auto',
        files,
    };
}

// ───────── 판정 ─────────
// 낱말 표: [정규식, 무게]. 한국어는 어간 조각(「울먹」 「흐느」), 영어는 낱말 경계. 한 낱말은 답 하나에서 두 번까지만 센다(같은 말 반복에 휘둘리지 않게).
// 헷갈리는 짧은 글자는 붙는 말까지 적는다 — 「검은」(색) · 「총명」 · 「피곤」에 안 걸리게 「검을」 「총구」 「피가」.
const W = (source, weight = 1) => [new RegExp(source, 'giu'), weight];
export const MOOD_WORDS = Object.freeze({
    battle: [
        W('칼(?:을|이|날|끝|자루)|검(?:을|이|으로|날|격)|도끼|창(?:끝|날)|휘둘|베(?:었|어|는|고)|내리치|찔(?:렀|러|러서)|주먹(?:을|이|으로)|발차기', 1.5),
        W('공격|반격|싸움|싸우|전투|격투|교전|돌진|맞부딪|일격|기습|방패|무기를|총(?:을|구|알|성)|사격|방아쇠|폭발|화염|피(?:가 튀|투성이|범벅)', 1.5),
        W('비명|쓰러(?:졌|뜨)|막아(?:냈|섰)|피(?:했|하며)|부딪쳤|밀려났|날아갔', 1),
        W('\\b(?:sword|blade|axe|spear|slash(?:ed|es)?|stab(?:bed)?|punch(?:ed|es)?|kick(?:ed)?|attack(?:s|ed)?|fight(?:s|ing)?|battle|combat|strike|struck|parr(?:y|ied)|dodg(?:e|ed)|gun(?:fire|shot)?|bullets?|explosion|enemy|enemies)\\b', 1.5),
        W('戦い|戦闘|攻撃|剣|斬', 1.5),
    ],
    tense: [
        W('긴장|숨(?:을 죽|죽|이 막)|식은땀|소름|섬뜩|불안|공포|두려(?:움|웠|운)|겁(?:에|이 나)|위험|위협|경계(?:하|를)|의심|수상(?:한|하)|낌새|기척', 1.5),
        W('발소리|그림자|어둠 속|도망|쫓(?:아|기|겨)|추격|숨어|들키|떨리(?:는|며)|심장이 (?:쿵|철렁|내려앉)|침묵이 흘|정적', 1),
        W('\\b(?:tense|tension|danger(?:ous)?|threat(?:en(?:ed|ing)?)?|fear|afraid|nervous|dread|sneak(?:ed|ing)?|hid(?:e|ing)|chase[ds]?|footsteps|shadows?|suspicious|panic(?:ked)?|creep(?:y|ing)?|uneasy)\\b', 1.5),
        W('緊張|危険|恐怖|不安', 1.5),
    ],
    romance: [
        W('사랑(?:해|하|스러)|좋아해|키스|입맞|입술(?:을|이|에)|안아(?:줘|주|들)|포옹|끌어안|품(?:에|으로|안)|손(?:을 잡|깍지)|볼(?:이|을) (?:붉|발그)|얼굴이 (?:붉|빨개)|설레|두근|고백|데이트|애틋|다정(?:하|히)|귓가|속삭', 1.5),
        W('눈을 맞추|눈이 마주|미소(?:를|가)|쓰다듬|기대(?:어|며|왔)|머리칼을|숨결', 0.75),
        W('\\b(?:love[sd]?|loving|kiss(?:ed|es|ing)?|lips|hug(?:ged|s)?|embrac(?:e|ed)|blush(?:ed|es|ing)?|confess(?:ed|ion)?|date|tender(?:ly)?|caress(?:ed)?|cuddl(?:e|ed)|whisper(?:ed|s)?|darling|sweetheart)\\b', 1.5),
        W('恋|愛して|キス|抱きしめ', 1.5),
    ],
    sad: [
        W('눈물|울(?:었|어|음|먹|고 있|기 시작)|흐느|오열|슬픔|슬퍼|슬프|그리워|그리움|이별|작별|죽음|장례|무덤|외로(?:워|움|운)|쓸쓸|상실|후회|미안해|떠나(?:지|갔|버)', 1.5),
        W('한숨|고개를 떨|어깨가 떨|목이 메|가슴이 (?:아프|미어)|빈자리', 1),
        W('\\b(?:tears?|cr(?:y|ied|ying)|sob(?:bed|bing|s)?|grief|griev(?:e|ing)|sorrow|mourn(?:ed|ing)?|funeral|grave|goodbye|farewell|lonely|loneliness|regret|miss(?:ed)? you)\\b', 1.5),
        W('涙|泣|悲し|寂し', 1.5),
    ],
    mystic: [
        W('마법|마력|주문(?:을 외|이 울)|신비|기묘|환상|정령|요정|룬|결계|의식(?:을 치|이 시작)|고대|유적|신전|제단|예언|수정구|차원|영혼|유령|별빛|달빛|꿈(?:속|결)|문양이 빛|빛나는 (?:문|눈|돌)', 1.5),
        W('\\b(?:magic(?:al)?|spell|runes?|ancient|ritual|myst(?:ic|ical|ery|erious)|spirits?|ghosts?|prophecy|arcane|ethereal|enchant(?:ed|ment)?|altar|shrine|relic)\\b', 1.5),
        W('魔法|魔力|神秘|精霊|呪文', 1.5),
    ],
    festive: [
        W('축제|잔치|파티|축하|건배|춤(?:을|추)|노래(?:를 부르|가 울려)|불꽃놀이|폭죽|생일|결혼식|연회|왁자|떠들썩|환호|노점|장터|흥겨', 1.5),
        W('\\b(?:festival|party|celebrat(?:e|ed|ion)|cheers|toast(?:ed)?|danc(?:e|ed|ing)|fireworks|birthday|feast|banquet|carnival|parade)\\b', 1.5),
        W('祭り|パーティー|乾杯|お祝い', 1.5),
    ],
    daily: [
        W('아침|점심|저녁(?:을|밥)|밥(?:을|은|이)|커피|차를 (?:마시|따르)|산책|학교|수업|출근|퇴근|소파|휴대폰|핸드폰|장을 보|요리|설거지|빨래|카페|편의점|하품|낮잠|집에 (?:돌아|와|가)', 1),
        W('\\b(?:breakfast|lunch|dinner|coffee|tea|stroll|school|class(?:room)?|office|sofa|couch|phone|cook(?:ed|ing)?|cafe|groceries|yawn(?:ed)?|nap)\\b', 1),
    ],
});
/** 데우스 감정 대사 태그(<crying> 등, dem-expressive.js 와 같은 이름) → 분위기 무게. 태그 하나에 한 번 */
export const TAG_MOODS = Object.freeze({
    shout: { battle: 1, tense: 0.5 }, angry: { battle: 1.5, tense: 0.5 },
    anxious: { tense: 1.5 }, trembling: { tense: 1, sad: 0.5 },
    crying: { sad: 2 }, hurt: { sad: 1.5 },
    whispering: { romance: 0.75, mystic: 0.25 }, quiet: { romance: 0.5, sad: 0.25 },
    excited: { festive: 1 }, intoxicated: { festive: 1 },
});
const TAG_FIND = new RegExp(`<(${Object.keys(TAG_MOODS).join('|')})\\b`, 'gi');

/** 판정에 쓸 글: 코드 블록 · HTML 태그 · 링크를 빼고(감정 태그는 따로 센다) 공백을 줄인다 */
export function cleanText(raw) {
    return String(raw || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]{0,300}>/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 답 하나의 분위기 점수 { mood: 점수 } */
export function scoreText(raw) {
    const scores = Object.fromEntries(MOODS.map(m => [m, 0]));
    const source = String(raw || '');
    const text = cleanText(source);
    for (const mood of MOODS) for (const [re, weight] of MOOD_WORDS[mood]) {
        const seen = new Map();
        re.lastIndex = 0;
        for (const match of text.matchAll(re)) {
            const key = match[0].toLowerCase();
            const count = (seen.get(key) || 0) + 1;
            seen.set(key, count);
            if (count <= 2) scores[mood] += weight;
        }
    }
    const tags = new Set([...source.matchAll(TAG_FIND)].map(m => m[1].toLowerCase()));
    for (const tag of tags) for (const [mood, weight] of Object.entries(TAG_MOODS[tag])) scores[mood] += weight;
    // 문장부호: 느낌표가 잦으면(글 100자에 1.2개 넘게) 격한 장면 · 「?!」 는 놀람 · 말줄임이 잦으면 가라앉은 장면. 조금만 더한다
    const len = Math.max(1, text.length);
    const bang = (text.match(/[!！]/g) || []).length, startle = (text.match(/[?？][!！]|[!！][?？]/g) || []).length;
    const trail = (text.match(/…|\.{3,}/g) || []).length;
    if (bang / len * 100 > 1.2) { scores.battle += 0.75; scores.tense += 0.5; scores.festive += 0.5; }
    if (startle) scores.tense += Math.min(2, startle) * 0.5;
    if (trail / len * 100 > 0.8) { scores.sad += 0.5; scores.romance += 0.25; }
    for (const mood of MOODS) scores[mood] = Math.round(scores[mood] * 100) / 100;
    return scores;
}

/** 판정 기준: 가장 높은 분위기가 MIN 이상이고 둘째보다 MARGIN 배 넘게 높아야 「뚜렷함」. 아니면 null (지금 곡 유지) */
export const DETECT = Object.freeze({ min: 2, margin: 1.25, recentWeight: 1, olderWeight: 0.5 });
/** texts: 새 것부터 (최근 답 1~2개). → { mood, score, scores } | { mood: null, … } */
export function detectMood(texts) {
    const list = (Array.isArray(texts) ? texts : [texts]).filter(t => typeof t === 'string' && t.trim()).slice(0, 2);
    const scores = Object.fromEntries(MOODS.map(m => [m, 0]));
    list.forEach((text, i) => {
        const w = i === 0 ? DETECT.recentWeight : DETECT.olderWeight;
        const one = scoreText(text);
        for (const mood of MOODS) scores[mood] += one[mood] * w;
    });
    const ranked = MOODS.map(m => [m, Math.round(scores[m] * 100) / 100]).sort((a, b) => b[1] - a[1]);
    const [[top, best], [, second]] = ranked;
    const clear = best >= DETECT.min && best > second * DETECT.margin;
    return { mood: clear ? top : null, score: best, scores: Object.fromEntries(ranked) };
}

// ───────── 유지 시간 ─────────
/** 곡이 바뀐 뒤 HOLD 동안은 그대로. 그 뒤에도 새 분위기가 답 두 개 잇달아 나오거나(같은 분위기 두 번) 점수가 STRONG 이상이어야 바뀐다.
 *  전투 · 긴장은 갑자기 오므로 점수가 URGENT 이상이면 URGENT_HOLD 만 지나도 바로. 채팅이 바뀌면 유지 시간 없이 새로 */
export const HOLD = Object.freeze({ ms: 75_000, urgentMs: 20_000, strong: 4, urgent: 4.5, urgentMoods: Object.freeze(['battle', 'tense']) });
export const FADE = Object.freeze({ in: 3, swap: 4, out: 2.5, hide: 0.8 });

/** state = { mood, since, pending: { mood, count } }, detection = detectMood 결과, opts = { now, fixed, reset }
 *  → 새 state ({ mood, since, pending, changed, reason }) */
export function nextMood(state, detection, { now = 0, fixed = 'auto', reset = false } = {}) {
    const cur = state && MOODS.includes(state.mood) ? state : { mood: null, since: 0, pending: null };
    const keep = (reason, pending = null) => ({ mood: cur.mood, since: cur.since, pending, changed: false, reason });
    const go = (mood, reason) => ({ mood, since: now, pending: null, changed: mood !== cur.mood, reason });
    if (MOODS.includes(fixed)) return cur.mood === fixed ? keep('fixed') : go(fixed, 'fixed');
    const want = detection?.mood ?? null, score = Number(detection?.score) || 0;
    if (reset || !cur.mood) return go(want || 'daily', reset ? 'chat' : 'start');
    if (!want) return keep('unclear');
    if (want === cur.mood) return keep('same');
    const elapsed = now - cur.since;
    const pending = cur.pending?.mood === want ? { mood: want, count: cur.pending.count + 1 } : { mood: want, count: 1 };
    if (HOLD.urgentMoods.includes(want) && score >= HOLD.urgent && elapsed >= HOLD.urgentMs) return go(want, 'urgent');
    if (elapsed < HOLD.ms) return keep('hold', pending);
    if (pending.count >= 2 || score >= HOLD.strong) return go(want, pending.count >= 2 ? 'twice' : 'strong');
    return keep('pending', pending);
}

/** 분위기에 들어갈 때 고를 곡: 내 곡이 있으면 그것, 없으면 담긴 곡을 차례로 (turn = 그 분위기에 들어간 횟수) */
export function pickTrack(mood, files = {}, turn = 0) {
    if (!MOODS.includes(mood)) return null;
    if (files[mood]) return { id: `file:${mood}`, url: files[mood], file: true };
    const list = TRACKS[mood];
    const id = list[Math.abs(Math.trunc(turn)) % list.length];
    return { id, url: `scene-music/${id}.mp3`, file: false };
}

// ───────── 크기 · 덕킹 · 상한 ─────────
/** 음악 슬라이더 % → 게인 (장면 소리 masterGain 과 같은 굽힘) × 음악 다듬기. 담긴 곡은 평균 -20 dB 로 맞춰 합성 빗소리(약 -27 dB)보다 크므로 0.6 배 */
export const MUSIC_TRIM = 0.6;
export function musicGain(volume) {
    const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
    return Math.round(Math.pow(v, 1.5) * MUSIC_TRIM * 1000) / 1000;
}
/** 날씨 소리 + 음악 합 상한 (게인 합). 넘으면 둘을 같은 비율로 줄인다 — 한쪽만 줄이면 섞인 느낌이 바뀐다.
 *  1 = 날씨 소리 혼자 100% 일 때의 크기 — 음악을 켜도 그보다 커지지 않는다 (음악을 꺼 두면 날씨 소리는 예전 그대로) */
export const MIX_CAP = 1;
export function capMix(ambient, music, cap = MIX_CAP) {
    const a = Math.max(0, Number(ambient) || 0), m = Math.max(0, Number(music) || 0);
    const sum = a + m;
    if (sum <= cap || sum === 0) return { ambient: a, music: m, scale: 1 };
    const scale = cap / sum;
    return { ambient: Math.round(a * scale * 1000) / 1000, music: Math.round(m * scale * 1000) / 1000, scale: Math.round(scale * 1000) / 1000 };
}
/** TTS 가 말하는 동안 음악을 이만큼(배율)으로: 0.3 ≈ -10 dB. 말이 시작되면 attack 초 안에 내려가고, 끝나면 hold 초 기다렸다 release 초 동안 돌아온다 */
export const DUCK = Object.freeze({ level: 0.3, attack: 0.25, hold: 0.7, release: 1.2 });
export function duckLevel(speaking) { return speaking ? DUCK.level : 1; }

/** 지금 말하는 소리가 있나 — 문서 안 audio · video 중 재생 중이고 들리는 것(반복 · 음소거 · 거의 0 크기 제외). els 는 { paused, ended, muted, volume, loop } 모양 */
export function anySpeaking(els) {
    for (const el of els || []) {
        if (!el || el.paused || el.ended || el.muted || el.loop) continue;
        if (!(Number(el.volume) > 0.02)) continue;
        return true;
    }
    return false;
}

/** 디코드된 곡의 앞뒤 무음(mp3 인코더 여백)을 건너뛴 반복 구간 { start, end } (초). 60ms 넘는 무음은 곡의 일부로 본다 */
export function loopBounds(samples, rate, { threshold = 1e-4, maxPad = 0.06 } = {}) {
    const n = samples?.length || 0;
    if (!n || !(rate > 0)) return { start: 0, end: n / (rate || 1) };
    const limit = Math.min(n, Math.round(maxPad * rate));
    let a = 0, b = n;
    while (a < limit && Math.abs(samples[a]) < threshold) a++;
    while (n - b < limit && b > a && Math.abs(samples[b - 1]) < threshold) b--;
    if (a >= limit) a = 0;
    if (n - b >= limit) b = n;
    return { start: a / rate, end: b / rate };
}
