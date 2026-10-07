// TTS 1.3.7 모델 이름 한국어로: 엔진이 주는 영어 id · 이름 → 짧은 한국어 이름.
// 아는 id 만 적은 표가 아니라 낱말 규칙이라, 아직 안 나온 모델(eleven_v5_turbo · speech-3.0-hd …)도 한국어로 나온다.
// 모르는 낱말은 그대로 둔다 (이름이 틀리게 바뀌는 것보다 영어 한 낱말이 낫다). 고른 값(id)은 바꾸지 않고 보이는 이름만.

const WORDS = {
    hd: '고음질', turbo: '빠름', flash: '플래시', mini: '미니', pro: '프로', lite: '라이트', max: '맥스',
    preview: '미리보기', alpha: '시험판', beta: '베타', exp: '시험판', experimental: '시험판', latest: '최신',
    multilingual: '다국어', monolingual: '영어', english: '영어', conversational: '대화', expressive: '표현', audio: '오디오', realtime: '실시간',
    tts: '', speech: '스피치', sonic: '소닉', ssfm: 'SSFM', eleven: '일레븐', gemini: '제미나이',
    voice: '보이스', mai: 'MAI', voxtral: '복스트랄', large: '라지', small: '스몰', medium: '미디엄', nano: '나노',
};
// OpenRouter 처럼 '회사/모델' 꼴이면 회사도 한국어로 앞에
const VENDORS = {
    google: '구글', openai: '오픈AI', microsoft: '마이크로소프트', minimax: '미니맥스', mistralai: '미스트랄', 'fish-audio': '피시 오디오',
    elevenlabs: '일레븐랩스', 'x-ai': 'xAI', anthropic: '앤트로픽', 'bytedance-seed': '바이트댄스', bytedance: '바이트댄스', cartesia: '카르테시아',
    hume: '흄', 'hume-ai': '흄', qwen: '큐원', alibaba: '알리바바', deepseek: '딥시크', meta: '메타', 'meta-llama': '메타', nvidia: '엔비디아',
};

/** 낱말 하나 → 한국어 (버전 · 숫자는 그대로) */
function word(t) {
    const w = t.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(WORDS, w)) return WORDS[w];
    if (/^v\d+(\.\d+)?$/i.test(t)) return t.toLowerCase();
    if (/^\d+(\.\d+)*$/.test(t)) return t;
    if (/^gpt$/i.test(t)) return 'GPT';
    if (/^\d+o$/i.test(t)) return t.toLowerCase();
    return t;
}
const join = (parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/** ElevenLabs: eleven_v4_turbo → 일레븐 v4 빠름 · eleven_flash_v2_5 → 일레븐 플래시 v2.5 · eleven_multilingual_v2 → 일레븐 다국어 v2 */
function eleven(id) {
    const body = id.replace(/^eleven_/i, '').replace(/_v(\d+)_(\d+)\b/gi, '_v$1.$2');
    return join(['일레븐', ...body.split('_').map(word)]);
}
/** MiniMax: speech-2.8-hd → 스피치 2.8 고음질 · speech-02-turbo → 스피치 02 빠름 */
function minimax(id) {
    const m = /^speech-([\d.]+)-?(.*)$/i.exec(id);
    if (!m) return null;
    return join(['스피치', m[1], ...String(m[2] || '').split(/[-_]/).map(word)]);
}
/** Typecast: ssfm-v30 → 타입캐스트 v3.0 (두 자리 버전은 점을 넣는다) */
function typecast(id) {
    const m = /^ssfm-v(\d)(\d)?(.*)$/i.exec(id);
    if (!m) return null;
    return join(['타입캐스트', `v${m[1]}${m[2] !== undefined ? `.${m[2]}` : ''}`, ...String(m[3] || '').split(/[-_]/).map(word)]);
}
/** 그 밖: 낱말마다 (gpt-4o-mini-tts → GPT 4o 미니 · gemini-2.5-flash-preview-tts → 제미나이 2.5 플래시 미리보기) */
function generic(id) {
    const parts = String(id).split('/');
    if (parts.length > 1) {
        const vendor = parts[0].toLowerCase();
        const rest = parts.slice(1).join('/');
        const inner = /^eleven_/i.test(rest) ? eleven(rest) : /^speech-\d/i.test(rest) ? minimax(rest) : generic(rest);
        return join([VENDORS[vendor] || parts[0], '·', inner]);
    }
    const tail = String(id).replace(/^tts-(\d+)/i, 'TTS-$1').replace(/^gpt-(\d[\w.]*)/i, 'GPT-$1');
    return join(tail.split(/(?<!^(?:TTS|GPT))[-_\s]/).map(word));
}

/**
 * 보이는 이름. providerId = 엔진 id, id = 모델 id, apiName = 엔진이 준 이름(있으면 — 규칙이 못 바꾼 것만 이걸로).
 * 바꾼 결과가 비면(예: 'tts') id 그대로.
 */
export function koModelLabel(providerId, id, apiName = '') {
    const raw = String(id || '').trim();
    if (!raw) return '';
    let out = null;
    try {
        if (providerId === 'elevenlabs' || /^eleven_/i.test(raw)) out = eleven(raw);
        else if (providerId === 'minimax' || /^speech-\d/i.test(raw)) out = minimax(raw);
        else if (providerId === 'typecast' || /^ssfm-v\d/i.test(raw)) out = typecast(raw);
        if (!out) out = generic(raw);
    } catch { out = null; }
    if (!out || out === raw) {
        const n = String(apiName || '').trim();
        if (n && n !== raw) return n;
    }
    return out || raw;
}
