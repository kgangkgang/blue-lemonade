// Message-local performance scripts. Original chat text is never rewritten.
// The script editor is independently implemented; feature reference: JINSIN2/MultiCast-TTS (MIT).
import * as ST from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';

const KEY = 'lemon_voice_script';
const VERSION = 1;
const EMOTIONS = new Set(['', 'neutral', 'calm', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'whisper', 'shout']);
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (value, max, label) => {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`${label} 길이 또는 형식을 확인해 주세요.`);
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
};
const number = (v, fallback, min, max) => {
    if (v == null || v === '') return fallback;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error('숫자를 확인해 주세요.');
    return Math.min(max, Math.max(min, n));
};

/** Pure, allowlisted JSON validation shared by saved data, editor and player. */
export function normalizeRows(rows) {
    if (!Array.isArray(rows) || rows.length > 500) throw new Error('대본은 500줄까지 편집할 수 있어요.');
    let chars = 0;
    const ids = new Set();
    return rows.map((r, i) => {
        if (!object(r) || !['voice', 'sfx', 'pause'].includes(r.kind)) throw new Error('대본 줄의 종류를 확인해 주세요.');
        let id = string(r.id, 100, '줄 이름') || `row-${i + 1}`;
        if (!/^[a-zA-Z0-9_.:-]+$/.test(id)) id = `row-${i + 1}`;
        const original = id; let n = 1;
        while (ids.has(id)) id = `${original.slice(0, 90)}-${n++}`;
        ids.add(id);
        const text = string(r.text, 12000, '대사'); chars += text.length;
        if (chars > 200000) throw new Error('대본 전체는 20만 자까지 저장할 수 있어요.');
        const emotion = string(r.emotion, 30, '감정');
        return {
            id, kind: r.kind, text,
            speaker: string(r.speaker, 200, '화자'), voiceUid: string(r.voiceUid, 300, '목소리'),
            emotion: EMOTIONS.has(emotion) ? emotion : '',
            sourceIndex: Number.isSafeInteger(r.sourceIndex) && r.sourceIndex >= 0 ? r.sourceIndex : null,
            sfxId: string(r.sfxId, 200, '효과음'),
            mode: ['sequence', 'overlay', 'loop'].includes(r.mode) ? r.mode : 'sequence',
            repeats: r.kind === 'sfx' ? Math.round(number(r.repeats, 1, 1, 4)) : 1,
            durationMs: r.kind === 'sfx' ? Math.round(number(r.durationMs, 0, 0, 8000)) : 0,
            volume: number(r.volume, 1, 0, 1),
            gapMs: Math.round(number(r.gapMs, r.kind === 'pause' ? 500 : 0, 0, 10000)),
            enabled: r.enabled !== false,
        };
    });
}

/** No content or credentials are logged; both raw and rendered translations invalidate old edits. */
export function scriptFingerprint(mes) {
    const input = JSON.stringify([VERSION, mes?.swipe_id ?? 0, String(mes?.mes ?? ''),
        String(mes?.extra?.display_text ?? ''), String(mes?.extra?.original_text_hash ?? '')]);
    let a = 2166136261, b = 0x9747b28c;
    for (let i = 0; i < input.length; i++) { const c = input.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
    return `${input.length}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`;
}

export function scriptIdentity(mesId) {
    const id = Number(mesId), ctx = getContext();
    const list = ctx?.chat || ST.chat;
    if (!Number.isSafeInteger(id) || id < 0 || !Array.isArray(list) || !object(list[id]) || typeof list[id].mes !== 'string') throw new Error('편집할 메시지를 찾지 못했어요.');
    return { message: list[id], fingerprint: scriptFingerprint(list[id]), chat: list };
}

/** null means no valid override; [] is a deliberately empty saved script. */
export function resolveScript(mes, baseRows) {
    void baseRows;
    const record = mes?.extra?.[KEY];
    if (!object(record) || record.version !== VERSION || record.fingerprint !== scriptFingerprint(mes)) return null;
    try { return normalizeRows(record.rows); } catch { return null; }
}

function checked(mesId, expected) {
    const now = scriptIdentity(mesId);
    if (expected && (now.message !== expected.message || now.chat !== expected.chat || now.fingerprint !== expected.fingerprint)) throw new Error('채팅이나 원문·번역이 바뀌었어요. 창을 닫고 이 메시지의 대본을 다시 열어 주세요.');
    if (typeof document !== 'undefined' && document.body?.dataset?.generating === 'true') throw new Error('답장 생성이 끝난 뒤 저장해 주세요.');
    const ctx = getContext();
    if (typeof ctx?.saveChat !== 'function') throw new Error('이 채팅을 저장할 수 없어요.');
    return { ...now, ctx };
}

async function persist(mesId, next, expected) {
    const current = checked(mesId, expected), mes = current.message;
    if (!object(mes.extra)) mes.extra = {};
    const prior = mes.extra[KEY], had = Object.hasOwn(mes.extra, KEY);
    if (next === null) delete mes.extra[KEY]; else mes.extra[KEY] = next;
    try {
        if (typeof ST.syncMesToSwipe === 'function') ST.syncMesToSwipe(Number(mesId));
        await current.ctx.saveChat();
    } catch (error) {
        // Restore only this exact operation; never overwrite a later edit or another chat.
        if (scriptFingerprint(mes) === current.fingerprint && ((next === null && !Object.hasOwn(mes.extra, KEY)) || mes.extra[KEY] === next)) {
            if (had) mes.extra[KEY] = prior; else delete mes.extra[KEY];
            try { if ((getContext()?.chat || ST.chat) === current.chat && current.chat[Number(mesId)] === mes && typeof ST.syncMesToSwipe === 'function') ST.syncMesToSwipe(Number(mesId)); } catch { /* Keep in-memory recovery. */ }
        }
        throw new Error('대본 저장에 실패했어요. 편집 내용은 창에 남아 있어요.', { cause: error });
    }
}

export async function saveScript(mesId, rows, expected) {
    const normalized = normalizeRows(rows), current = checked(mesId, expected);
    await persist(mesId, { version: VERSION, fingerprint: current.fingerprint, savedAt: Date.now(), rows: normalized }, expected || current);
    return normalizeRows(normalized);
}

export async function clearScript(mesId, expected) { await persist(mesId, null, expected); }
