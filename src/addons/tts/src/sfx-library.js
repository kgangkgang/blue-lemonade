// MultiCast TTS keyword library and matching algorithm adapted under the MIT License.
// Copyright (c) 2026 JINSIN2. Original author metadata: Cao Cao & Claude.
// Source: https://github.com/JINSIN2/MultiCast-TTS/tree/f48ebeef9b19d814bf8d4568af13613544007e63
// See ../LICENSE-MultiCast.txt, ../NOTICE.md and ../sfx/SOURCES.json.
// Blue Lemonade modifications: Korean labels/search, bounded imports, separate IndexedDB bytes.
import { settings, save } from './settings.js';
import { DAILY_SFX } from './sfx-daily.js';
import { normalizeSfxCredit, importedSfxCredit, customSfxAttribution, sfxSha256 } from './sfx-credits.js';

const UPSTREAM_LIBRARY = [
    // Unsupported bundled sounds must not match unrelated generic words. No paid fallback.
    { files: [], words: ['phone', 'cellphone', 'ringtone', 'alarm', 'dog', 'bark', 'clap', 'applause', 'heartbeat', 'siren', 'car', 'engine', 'horn', 'scream', 'laugh', 'music'] },
    { files: ['door_slam', 'door_slam_2'], words: ['slam', 'door bang', 'door banging'] },
    { files: ['door_creak', 'door_creak_2'], words: ['creak', 'squeak'] },
    { files: ['door_close'], words: ['door close', 'door closing', 'door shut', 'closing door', 'door click'] },
    { files: ['door_open', 'door_open_2'], words: ['door open', 'opening door', 'door swing', '~door'] },
    { files: ['knock', 'knock_2'], words: ['knock', 'rap on', 'tapping on door'] },
    { files: ['footsteps_wood'], words: ['wooden floor', 'floorboard', 'stairs', 'creaking floor'] },
    { files: ['footsteps_wet'], words: ['wet footsteps', 'puddle', 'splashing steps'] },
    { files: ['running'], words: ['running', 'run', 'sprint', 'rushing', 'hurried footsteps'] },
    { files: ['footsteps'], words: ['footstep', 'steps', 'walking', 'pacing', '~approach'] },
    { files: ['glass_break', 'glass_break_2'], words: ['shatter', 'glass break', 'breaking glass', 'window break', 'glass crash'] },
    { files: ['glass_clink'], words: ['clink', 'cheers', 'glasses', 'toast'] },
    { files: ['shotgun'], words: ['shotgun'] },
    { files: ['pistol'], words: ['pistol', 'handgun', 'revolver'] },
    { files: ['gunshot', 'gunshot_2', 'gunshot_3'], words: ['gunshot', 'gun', 'shot', 'gunfire', 'rifle', '~bang'] },
    { files: ['bullet_hit'], words: ['bullet hit', 'bullet impact', 'ricochet', 'bullet strike'] },
    { files: ['explosion'], words: ['explosion', 'explode', 'blast', 'boom', 'detonat'] },
    { files: ['thunder'], words: ['thunder', 'lightning', 'rumble'] },
    { files: ['gong'], words: ['gong'] },
    { files: ['bell', 'bell_2'], words: ['bell', 'chime', 'ring', 'ding'] },
    { files: ['unlock'], words: ['unlock', 'lock click', 'lock', 'latch'] },
    { files: ['key'], words: ['keys', 'key jingl', 'jingl'] },
    { files: ['paper'], words: ['paper', 'page', 'rustl', 'flipping', 'letter', 'book'] },
    { files: ['splash'], words: ['splash', 'water', 'plunge', 'dive'] },
    { files: ['switch'], words: ['switch', 'click', 'button'] },
    { files: ['dishes'], words: ['dishes', 'plates', 'cutlery', 'clatter'] },
    { files: ['pot'], words: ['pot', 'pan', 'kettle', 'cooking'] },
    { files: ['clang'], words: ['clang', 'clank', 'metal', 'sword clash', 'steel'] },
    { files: ['box_open'], words: ['box', 'lid', 'chest open', 'drawer', 'case open'] },
    { files: ['pickup'], words: ['pick up', 'picks up', 'grab', 'rummag'] },
    { files: ['drop'], words: ['drop', 'plop', 'falls to'] },
    { files: ['smash'], words: ['smash', 'wreck', 'crash'] },
    { files: ['impact', 'impact_2'], words: ['impact', 'collision', 'heavy hit', 'slammed into', 'crash into'] },
    { files: ['punch'], words: ['punch', 'slap', 'smack', 'hit', 'strike', 'kick', 'blow'] },
    { files: ['thud'], words: ['thud', 'thump', 'collapse', 'body fall', 'fall'] },
    { files: ['wood_crack'], words: ['crack', 'snap', 'branch', 'twig', 'splinter'] },
    { files: ['stones'], words: ['stone', 'rock', 'rubble', 'gravel', 'pebble'] },
    { files: ['wind'], words: ['wind', 'breeze', 'howl', 'gust'] },
    { files: ['whoosh'], words: ['whoosh', 'swish', 'swoosh', 'swing', 'swipe'] },
];

const KOREAN = {
    door_slam: ['문 세게 닫기', '문·이동', '문 쾅,문을 쾅,문 닫히,문이 닫히'],
    door_creak: ['문 삐걱임', '문·이동', '문 삐걱,문이 삐걱,삐걱거리'],
    door_close: ['문 닫기', '문·이동', '문 닫기,문 닫는,문을 닫'],
    door_open: ['문 열기', '문·이동', '문 열기,문 여는,문을 열,문이 열'],
    knock: ['노크', '문·이동', '노크,문 두드,문을 두드,똑똑'],
    footsteps_wood: ['나무 바닥 발소리', '문·이동', '나무 바닥,마룻바닥,계단 발소리'],
    footsteps_wet: ['젖은 발소리', '문·이동', '젖은 발소리,물웅덩이 발소리,철벅 발소리'],
    running: ['달리는 발소리', '문·이동', '달리는,달리기,뛰는 발소리,뜀박질'],
    footsteps: ['발소리', '문·이동', '발소리,걸음,걷는 소리,또각'],
    glass_break: ['유리 깨짐', '사물', '유리 깨,유리가 깨,창문 깨,창문이 깨,쨍그랑'],
    glass_clink: ['잔 부딪침', '사물', '건배,잔 부딪,잔을 부딪,잔이 부딪'],
    shotgun: ['산탄총', '전투', '산탄총,샷건'],
    pistol: ['권총', '전투', '권총,리볼버'],
    gunshot: ['총성', '전투', '총성,총소리,총을 쏘,총을 발사,소총'],
    bullet_hit: ['탄환 충돌', '전투', '탄환,총알 충돌,총알이 부딪,도탄'],
    explosion: ['폭발', '전투', '폭발,폭탄,굉음'],
    thunder: ['천둥', '자연', '천둥,우레,천둥소리'],
    gong: ['징', '사물', '징 소리,징을'],
    bell: ['종소리', '사물', '종소리,종 울,종이 울,종을 울,딸랑'],
    unlock: ['잠금장치', '사물', '잠금,잠금장치,자물쇠,빗장'],
    key: ['열쇠 소리', '사물', '열쇠,열쇠꾸러미'],
    paper: ['종이 넘기기', '사물', '종이,책장 넘,책장을 넘,편지 바스락,바스락'],
    splash: ['물 튀김', '자연', '물 튀,물을 튀,첨벙,풍덩,물속'],
    switch: ['스위치', '사물', '스위치,버튼 누,버튼을 누,딸깍'],
    dishes: ['접시·식기', '사물', '접시,식기,수저,그릇'],
    pot: ['냄비', '사물', '냄비,프라이팬,주전자'],
    clang: ['금속 부딪침', '전투', '금속,쇳소리,검 부딪,검이 부딪,철컥'],
    box_open: ['상자 열기', '사물', '상자,뚜껑,서랍,궤짝'],
    pickup: ['물건 집기', '사물', '물건 집,물건을 집,뒤적,집어 들'],
    drop: ['물건 떨어짐', '사물', '물건 떨어,물건이 떨어,물건을 떨어,툭 떨어'],
    smash: ['물건 부수기', '전투', '부수,박살,와장창'],
    impact: ['충돌', '전투', '충돌,부딪치,부딪히,들이받'],
    punch: ['타격', '전투', '주먹,타격,때리,발길질,발차기,찰싹'],
    thud: ['둔탁한 낙하', '전투', '쿵,둔탁,쓰러지,몸이 떨어'],
    wood_crack: ['나무 부러짐', '자연', '나무 부러,나무가 부러,가지 부러,가지가 부러,우지끈'],
    stones: ['돌·자갈', '자연', '돌 굴,돌이 굴,자갈,잔해,조약돌'],
    wind: ['바람', '자연', '바람,돌풍,산들바람'],
    whoosh: ['휘두르는 소리', '전투', '휘두르,휙,휘익,스치는 소리'],
};
const BUNDLED = UPSTREAM_LIBRARY.flatMap(group => group.files.map((id, i) => {
    const [name, category, ko] = KOREAN[group.files[0]];
    return Object.freeze({ id, name: name + (group.files.length > 1 ? ` ${i + 1}` : ''), category,
        words: Object.freeze([...group.words, ...ko.split(',')]), custom: false, loop: false });
})).concat(DAILY_SFX);
const BUNDLED_MAP = new Map(BUNDLED.map(row => [row.id, row]));
export const SFX_LIMITS = Object.freeze({ fileBytes: 16 * 1024 * 1024, totalBytes: 128 * 1024 * 1024,
    count: 64, packBytes: 180 * 1024 * 1024, words: 32 });
export const SFX_PACK_FORMAT = 'blue-lemonade-sfx-pack';
const CUSTOM_ID = /^custom:[a-zA-Z0-9-]{8,80}$/;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const record = obj => !!obj && typeof obj === 'object' && !Array.isArray(obj)
    && [Object.prototype, null].includes(Object.getPrototypeOf(obj));
const textValue = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function cleanWords(value) {
    const arr = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
    return [...new Set(arr.map(word => textValue(word, 64)).filter(Boolean))].slice(0, SFX_LIMITS.words);
}
function cleanMeta(value) {
    if (!record(value) || !CUSTOM_ID.test(value.id)) return null;
    const name = textValue(value.name, 80);
    const bytes = Number(value.bytes);
    if (!name || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes > SFX_LIMITS.fileBytes) return null;
    const credit = normalizeSfxCredit(value.credit);
    return { id: value.id, name, category: textValue(value.category, 32) || '내 효과음',
        words: cleanWords(value.words), custom: true, loop: value.loop === true, bytes,
        mime: textValue(value.mime, 64), ...(sfxSha256(value.sha256) ? { sha256: sfxSha256(value.sha256) } : {}), ...(credit ? { credit } : {}) };
}
function customRows() {
    const rows = settings().sfx?.custom;
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).map(cleanMeta).filter(row => {
        if (!row || seen.has(row.id)) return false;
        seen.add(row.id); return true;
    }).slice(0, SFX_LIMITS.count);
}
export function listSfx() { return [...BUNDLED, ...customRows()].map(row => ({ ...row, words: [...row.words] })); }
export function getSfx(id) {
    if (typeof id !== 'string') return null;
    const row = BUNDLED_MAP.get(id) || customRows().find(row => row.id === id);
    return row ? { ...row, words: [...row.words] } : null;
}
const preferenceListeners = new Set();
const preferenceRevisions = new Map();
export const sfxPreferenceRevision = id => preferenceRevisions.get(id) || 0;
export function isSfxEnabled(id) { return !!getSfx(id) && !settings().sfx?.disabled?.includes(id); }
export function onSfxPreferenceChange(listener) {
    preferenceListeners.add(listener);
    return () => preferenceListeners.delete(listener);
}
/** Playback preferences do not delete audio or prevent an explicit library preview. */
export function setSfxEnabled(id, enabled) {
    if (!getSfx(id)) return false;
    const s = settings();
    if (!record(s.sfx)) s.sfx = {};
    const disabled = new Set(Array.isArray(s.sfx.disabled) ? s.sfx.disabled : []);
    const on = enabled === true;
    if (on === !disabled.has(id)) return on;
    if (on) disabled.delete(id); else disabled.add(id);
    s.sfx.disabled = [...disabled];
    preferenceRevisions.set(id, sfxPreferenceRevision(id) + 1);
    save();
    for (const listener of preferenceListeners) { try { listener(id, on); } catch { /* one UI cannot block playback cancellation */ } }
    return on;
}
export function sfxAttribution(ids) {
    const rows = [...new Set(ids)].map(getSfx).filter(Boolean);
    if (!rows.length) return '';
    return 'Blue Lemonade TTS · 효과음 출처\n\n' + rows.map(row => {
        if (row.custom) return customSfxAttribution(row);
        if (row.credit) return `${row.name}\n${row.credit.author} · ${row.credit.license}\n${row.credit.source}\n${row.credit.licenseUrl}\n변경: 원본 일부 발췌·음량 조정·페이드·MP3 변환, 대본 설정에 따라 반복/길이 조절·믹싱\n`;
        return `${row.name}\nJINSIN2/MultiCast-TTS · 원본 저장소의 CC0 표기 (개별 녹음 최초 출처는 독립 검증하지 않음)\nhttps://github.com/JINSIN2/MultiCast-TTS/tree/f48ebeef9b19d814bf8d4568af13613544007e63\nhttps://creativecommons.org/publicdomain/zero/1.0/\n변경: 대본 설정에 따라 반복/길이 조절·믹싱\n`;
    }).join('\n');
}
function wordList(text) { return String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean); }
const EXTRA_WORDS = { daily_rain: ['비가 내린', '비가 내렸', '비 내린', '비 내렸', '비가 온', '비가 왔'] };
// Adapted from MultiCast's matchSfx: adjacent prefix matches, exact-match preference,
// weak keywords, unsupported-sound blockers and deterministic variant selection.
function matchLibrary(words, library) {
    let best = null, bestScore = 0;
    for (const entry of library) {
        for (const raw of entry.words) {
            const weak = raw.startsWith('~'), phrase = wordList(raw);
            if (!phrase.length) continue;
            let hit = false, exact = false;
            for (let i = 0; i + phrase.length <= words.length && !exact; i++) {
                if (phrase.every((part, j) => words[i + j].startsWith(part))) {
                    hit = true; exact = phrase.every((part, j) => words[i + j] === part);
                }
            }
            if (!hit) continue;
            if (!entry.files.length) return null;
            const score = phrase.length * (weak ? 0.5 : 1) + (exact ? 0.25 : 0);
            if (score > bestScore) { bestScore = score; best = entry; }
        }
    }
    if (!best) return null;
    let h = 0;
    for (const ch of words.join(' ')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const enabled = best.files.filter(isSfxEnabled);
    // Keep the winning category even when muted; never substitute an unrelated sound.
    return enabled.length ? getSfx(enabled[h % enabled.length]) : { muted: true };
}
export function matchSfx(text) {
    const words = wordList(text);
    if (!words.length) return null;
    const custom = customRows().map(row => ({ files: [row.id], words: [...row.words, row.name] }));
    const mine = matchLibrary(words, custom);
    if (mine) return mine.muted ? null : mine;
    const library = [...DAILY_SFX.map(row => ({ files: [row.id], words: [...row.words, row.name, ...(EXTRA_WORDS[row.id] || [])] })), ...UPSTREAM_LIBRARY.map(group => ({ files: group.files,
        words: group.files.length ? BUNDLED_MAP.get(group.files[0]).words : group.words }))];
    const result = matchLibrary(words, library);
    return result?.muted ? null : result;
}

// Kept separate from the disposable TTS voice cache: clearing/pruning it cannot delete uploads.
let dbPromise = null;
function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open('lemon-voice-sfx', 1); }
        catch { reject(new Error('이 브라우저에서는 효과음 파일을 저장할 수 없어요.')); return; }
        let finished = false;
        const finish = (db, err) => {
            if (finished) { db?.close(); return; }
            finished = true; clearTimeout(timer);
            if (err) reject(err); else resolve(db);
        };
        const timer = setTimeout(() => finish(null, new Error('효과음 저장소를 열지 못했어요. 다른 탭을 닫고 다시 시도해 주세요.')), 8000);
        request.onupgradeneeded = () => request.result.createObjectStore('files');
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); dbPromise = null; };
            finish(db);
        };
        request.onerror = () => finish(null, request.error || new Error('효과음 저장소를 열지 못했어요.'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
}
async function transaction(mode, act) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', mode);
        let result;
        const timer = setTimeout(() => { try { tx.abort(); } catch { /* already finished */ } }, 15000);
        tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
        tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(tx.error || new Error('효과음 파일을 저장하지 못했어요.')); };
        try { act(tx.objectStore('files'), value => { result = value; }); }
        catch (error) { clearTimeout(timer); try { tx.abort(); } catch { /* already finished */ } reject(error); }
    });
}
async function customBlob(id) {
    return transaction('readonly', (store, done) => { const req = store.get(id); req.onsuccess = () => done(req.result instanceof Blob ? req.result : null); });
}
export async function sfxBlob(id) {
    const meta = getSfx(id);
    if (!meta) return null;
    if (meta.custom) return customBlob(id);
    const response = await fetch(new URL(meta.assetPath || `../sfx/${id}.mp3`, import.meta.url));
    if (!response.ok) throw new Error('내장 효과음 파일을 불러오지 못했어요.');
    return response.blob();
}
function audioType(bytes) {
    const ascii = (at, word) => [...word].every((c, i) => bytes[at + i] === c.charCodeAt(0));
    if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'audio/wav';
    if (ascii(0, 'OggS')) return 'audio/ogg';
    if (ascii(0, 'fLaC')) return 'audio/flac';
    if (ascii(0, 'ID3')) return 'audio/mpeg';
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return (bytes[1] & 0x16) === 0x10 ? 'audio/aac' : 'audio/mpeg';
    if (ascii(4, 'ftyp') && ['M4A ', 'M4B ', 'isom', 'mp42', 'mp41'].some(brand => ascii(8, brand))) return 'audio/mp4';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'audio/webm';
    return '';
}
async function checkedAudio(file) {
    if (!(file instanceof Blob) || file.size < 12 || file.size > SFX_LIMITS.fileBytes) throw new Error('효과음은 파일마다 16MB 이하의 오디오 파일이어야 해요.');
    const mime = audioType(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
    if (!mime) throw new Error('지원하는 오디오 파일이 아니에요. MP3·WAV·OGG·FLAC·M4A·AAC·WebM을 넣어 주세요.');
    return new Blob([file], { type: mime });
}
let mutations = Promise.resolve();
function mutate(fn) { const task = mutations.then(fn); mutations = task.catch(() => {}); return task; }
async function commitRows(rows) {
    const s = settings();
    const before = s.sfx;
    const previous = record(before) ? before.custom : undefined;
    if (!record(s.sfx)) s.sfx = {};
    const originals = new Map((Array.isArray(previous) ? previous : []).filter(record).map(row => [row.id, row]));
    s.sfx.custom = rows.map(row => {
        const next = { ...originals.get(row.id), ...row }, credit = normalizeSfxCredit(row.credit);
        if (credit) next.credit = credit; else delete next.credit;
        return next;
    });
    try { await save(); }
    catch (error) { if (record(before)) { before.custom = previous; s.sfx = before; } else s.sfx = before; throw error; }
}
function checkCapacity(current, added) {
    if (current.length + added.length > SFX_LIMITS.count) throw new Error('내 효과음은 64개까지 저장할 수 있어요.');
    if ([...current, ...added].reduce((sum, row) => sum + row.bytes, 0) > SFX_LIMITS.totalBytes) throw new Error('내 효과음 전체 크기는 128MB까지 저장할 수 있어요.');
}
function newId() {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `custom:${id}`;
}
async function hashBlob(blob) {
    if (!globalThis.crypto?.subtle) return '';
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function addPrepared(prepared, current = customRows(), restored = []) {
    checkCapacity(current, prepared.map(x => x.meta));
    const writes = [...prepared, ...restored];
    await transaction('readwrite', store => { for (const item of writes) store.put(item.blob, item.meta.id); });
    try { await commitRows([...current, ...prepared.map(item => item.meta)]); }
    catch (error) { await transaction('readwrite', store => { for (const item of writes) store.delete(item.meta.id); }).catch(() => {}); throw error; }
}
export async function importSfx(file, options = {}) {
    const blob = await checkedAudio(file);
    const opt = record(options) ? options : {};
    const meta = { id: newId(), name: textValue(opt.name, 80) || textValue(file.name?.replace(/\.[^.]+$/, ''), 80) || '내 효과음',
        category: textValue(opt.category, 32) || '내 효과음', words: cleanWords(opt.words), loop: opt.loop === true,
        custom: true, bytes: blob.size, mime: blob.type, sha256: await hashBlob(blob) };
    const credit = importedSfxCredit({ credit: opt.credit }, null, meta.sha256);
    if (credit) meta.credit = credit;
    return mutate(async () => { await addPrepared([{ meta, blob }]); return { ...meta, words: [...meta.words] }; });
}
export function updateSfx(id, patch) {
    return mutate(async () => {
        const rows = customRows(), at = rows.findIndex(row => row.id === id);
        if (at < 0 || !record(patch)) throw new Error('수정할 내 효과음을 찾지 못했어요.');
        const meta = { ...rows[at] };
        if (own(patch, 'name')) { meta.name = textValue(patch.name, 80); if (!meta.name) throw new Error('효과음 이름을 입력해 주세요.'); }
        if (own(patch, 'words')) meta.words = cleanWords(patch.words);
        if (own(patch, 'loop')) meta.loop = patch.loop === true;
        if (own(patch, 'category')) meta.category = textValue(patch.category, 32) || '내 효과음';
        rows[at] = meta; await commitRows(rows); return { ...meta, words: [...meta.words] };
    });
}
export function removeSfx(id) {
    return mutate(async () => {
        const rows = customRows(), existing = rows.find(row => row.id === id);
        if (!existing) return false;
        const blob = await customBlob(id);
        await transaction('readwrite', store => store.delete(id));
        try { await commitRows(rows.filter(row => row.id !== id)); }
        catch (error) { if (blob) await transaction('readwrite', store => store.put(blob, id)).catch(() => {}); throw error; }
        return true;
    });
}
async function dataUrl(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let raw = '';
    for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${blob.type};base64,${btoa(raw)}`;
}
export function exportSfxPack() {
    return mutate(async () => {
        const sounds = [];
        for (const meta of customRows()) {
            const blob = await customBlob(meta.id);
            if (!blob) throw new Error(`「${meta.name}」 파일을 찾지 못했어요. 다시 추가한 뒤 내보내 주세요.`);
            sounds.push({ name: meta.name, category: meta.category, words: meta.words, loop: meta.loop,
                ...(meta.credit ? { credit: normalizeSfxCredit(meta.credit) } : {}), data: await dataUrl(blob) });
        }
        return new Blob([JSON.stringify({ format: SFX_PACK_FORMAT, version: 1, sounds })], { type: 'application/json' });
    });
}
function parsePack(text) {
    return JSON.parse(text, (key, value) => {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('허용하지 않는 키가 들어 있는 효과음 팩이에요.');
        return value;
    });
}
async function blobFromData(value) {
    if (typeof value !== 'string' || value.length > Math.ceil(SFX_LIMITS.fileBytes / 3) * 4 + 160) throw new Error('효과음 파일이 너무 커요.');
    const match = /^data:audio\/[a-z0-9.+-]+;base64,([a-zA-Z0-9+/]*={0,2})$/.exec(value);
    if (!match || match[1].length % 4 !== 0) throw new Error('효과음 팩의 오디오 데이터가 올바르지 않아요.');
    const raw = atob(match[1]);
    const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    return checkedAudio(new Blob([bytes]));
}
export async function importSfxPack(file) {
    if (!(file instanceof Blob) || file.size > SFX_LIMITS.packBytes) throw new Error('효과음 팩은 180MB 이하의 JSON 파일이어야 해요.');
    const pack = parsePack(await file.text());
    if (!record(pack) || ![SFX_PACK_FORMAT, 'multicast-tts-sfx-pack'].includes(pack.format) || pack.version !== 1
        || !Array.isArray(pack.sounds) || pack.sounds.length > SFX_LIMITS.count) throw new Error('지원하는 효과음 팩이 아니거나 64개 한도를 넘었어요.');
    const prepared = [], errors = [];
    let total = 0;
    for (let i = 0; i < pack.sounds.length; i++) {
        const item = pack.sounds[i];
        try {
            if (!record(item) || !textValue(item.name, 80)) throw new Error('효과음 이름이 없어요.');
            const blob = await blobFromData(item.data);
            total += blob.size;
            if (total > SFX_LIMITS.totalBytes) throw new Error('전체 128MB 한도를 넘었어요.');
            const sha256 = await hashBlob(blob), credit = importedSfxCredit(item, pack.credits, sha256);
            prepared.push({ blob, meta: { id: newId(), name: textValue(item.name, 80), category: textValue(item.category, 32) || '내 효과음',
                words: cleanWords(item.words), loop: item.loop === true, custom: true, bytes: blob.size, mime: blob.type, sha256, ...(credit ? { credit } : {}) } });
        } catch (error) { errors.push({ index: i, message: error.message }); }
    }
    return mutate(async () => {
        const existing = customRows();
        const seen = new Set(existing.filter(row => row.sha256).map(row => `${row.sha256}|${row.name}|${JSON.stringify(row.words)}|${row.loop}`));
        const unique = [], restored = [], restoreIds = new Set();
        let duplicates = 0, credited = 0;
        for (const item of prepared) {
            const key = `${item.meta.sha256}|${item.meta.name}|${JSON.stringify(item.meta.words)}|${item.meta.loop}`;
            const sameHash = item.meta.sha256 ? existing.filter(row => row.sha256 === item.meta.sha256) : [];
            const sameSound = sameHash.filter(row => row.name === item.meta.name);
            const exact = sameSound.filter(row => `${row.sha256}|${row.name}|${JSON.stringify(row.words)}|${row.loop}` === key);
            const prior = sameSound.length === 1 ? sameSound[0] : exact.length === 1 ? exact[0] : sameHash.length === 1 ? sameHash[0] : null;
            // Reimport can repair missing attribution, but never replaces user edits or prior credits.
            if (prior) {
                if ((sameSound.length === 1 || sameHash.length === 1) && item.meta.credit && !prior.credit) { prior.credit = normalizeSfxCredit(item.meta.credit); credited++; }
                // Synced settings do not include IndexedDB bytes. Restore only missing audio,
                // retaining the old id so saved scripts and disabled preferences keep working.
                if (!restoreIds.has(prior.id) && !await customBlob(prior.id)) { restored.push({ blob: item.blob, meta: prior }); restoreIds.add(prior.id); }
                duplicates++; continue;
            }
            if (item.meta.sha256 && seen.has(key)) { duplicates++; continue; }
            if (item.meta.sha256) seen.add(key);
            unique.push(item);
        }
        if (unique.length || restored.length) await addPrepared(unique, existing, restored);
        else if (credited) await commitRows(existing);
        return { added: unique.length, skipped: errors.length + duplicates, failed: errors.length, duplicates, credited, restored: restored.length, errors };
    });
}
