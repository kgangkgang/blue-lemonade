// 7.9.9 프로필 여러 개 — 서버 저장 (실리태번 기본 그림 API: /api/images/upload · list · folders · delete)
//   사진은 계정의 user/images/bl-avatar-<해시>/ 에 들어가고, 설정에는 경로만 적는다. 카드 PNG 는 건드리지 않는다.
//   실리태번 모듈을 import 하지 않는다 (getContext 로만) — 시험에서 fetch · ctx 를 가짜로 넣을 수 있게.
import { imageFormat } from '../addons/assets/image-format.js';
import { folderOf, isFolder, MAX_FILES } from './pick.js';

export const LONG_EDGE = 1024;      // 올리기 전 긴 변 (프로필 배너도 이 크기면 충분)
export const RAW_LIMIT = 4 * 1024 * 1024;   // 줄이지 않는 파일(움직이는 GIF) 상한
const QUALITY = .9;

const headers = (ctx = globalThis.SillyTavern?.getContext?.()) => ({ ...(ctx?.getRequestHeaders?.() || { 'Content-Type': 'application/json' }) });
function describe(status) {
    if (status === 403) return '권한 오류예요. 페이지를 새로고침한 뒤 다시 해 보세요.';
    if (status === 413) return '파일이 너무 커요.';
    if (status === 400) return '서버가 이 형식을 받지 않았어요.';
    return `서버 오류 (${status})`;
}
async function post(url, body, { fetcher = globalThis.fetch, ctx } = {}) {
    const response = await fetcher(url, { method: 'POST', headers: headers(ctx), body: JSON.stringify(body), cache: 'no-cache' });
    if (!response.ok) throw new Error(describe(response.status));
    return response;
}

let webpOk = null;
export function canWebp() {
    if (webpOk !== null) return webpOk;
    try { webpOk = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch { webpOk = false; }
    return webpOk;
}
async function decode(blob) {
    try { return await createImageBitmap(blob); }
    catch {
        const url = URL.createObjectURL(blob), img = new Image();
        try {
            await new Promise((resolve, reject) => { const t = setTimeout(() => reject(Error('timeout')), 15000); img.onload = () => { clearTimeout(t); resolve(); }; img.onerror = () => { clearTimeout(t); reject(Error('decode')); }; img.src = url; });
            return img;
        } finally { URL.revokeObjectURL(url); }
    }
}
/** 파일 → { base64, format } (긴 변 LONG_EDGE 로 줄이고 WebP · 안 되면 PNG. 움직이는 GIF 는 그대로) */
export async function prepareImage(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = imageFormat(bytes);
    if (!format.supported && !/^image\//.test(file.type || '')) throw new Error(`그림 파일이 아니에요: ${file.name}`);
    if (format.animated) {
        if (bytes.length > RAW_LIMIT) throw new Error('움직이는 그림은 4MB 까지만 올릴 수 있어요.');
        return { base64: toBase64(bytes), format: format.type === 'webp' ? 'webp' : 'gif' };
    }
    const bitmap = await decode(file);
    const w = bitmap.naturalWidth || bitmap.width, h = bitmap.naturalHeight || bitmap.height;
    if (!w || !h) throw new Error(`그림을 읽지 못했어요: ${file.name}`);
    const scale = Math.min(1, LONG_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    try {
        canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const type = canWebp() ? 'image/webp' : 'image/png';
        const blob = await new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
        if (!blob) throw new Error('그림을 변환하지 못했어요.');
        return { base64: toBase64(new Uint8Array(await blob.arrayBuffer())), format: blob.type === 'image/webp' ? 'webp' : 'png' };
    } finally { bitmap.close?.(); canvas.width = canvas.height = 0; }
}
export function toBase64(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(out);
}
const stamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 한 장 올리기 → 서버 경로 'user/images/bl-avatar-…/….webp' */
export async function uploadAvatarImage(avatar, file, io = {}) {
    const { base64, format } = await (io.prepare || prepareImage)(file);
    const response = await post('/api/images/upload', { image: base64, format, ch_name: folderOf(avatar), filename: stamp() }, io);
    const data = await response.json();
    const path = String(data?.path ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!/^user\/images\//.test(path)) throw new Error('서버가 저장 위치를 알려 주지 않았어요.');
    return path;
}
export async function deleteImage(path, io = {}) {
    const fetcher = io.fetcher || globalThis.fetch;
    const response = await fetcher('/api/images/delete', { method: 'POST', headers: headers(io.ctx), body: JSON.stringify({ path }), cache: 'no-cache' });
    if (!response.ok && response.status !== 404) throw new Error(describe(response.status));   // 이미 없는 파일은 지운 것으로 친다
    return response.ok;
}
export async function listFolder(folder, io = {}) {
    const response = await post('/api/images/list', { folder }, io);
    const list = await response.json();
    return (Array.isArray(list) ? list : []).map(x => String(x?.name ?? x ?? '')).filter(Boolean);
}
export async function listFolders(io = {}) {
    const response = await post('/api/images/folders', {}, io);
    const list = await response.json();
    return (Array.isArray(list) ? list : []).map(String).filter(isFolder);
}

/**
 * 정리 계획 — ① 지금 없는 캐릭터의 항목 ② 어느 항목에도 안 적힌 bl-avatar-* 폴더의 파일 (실리태번 API 엔 폴더 삭제가 없어 빈 폴더는 남는다)
 * @param {object} chars multiAvatar.chars
 * @param {string[]} avatars 지금 있는 캐릭터 아바타 파일명들
 */
export async function cleanupPlan(chars, avatars, io = {}) {
    const alive = new Set(avatars);
    const gone = Object.keys(chars).filter(a => !alive.has(a));
    const referenced = new Set(Object.values(chars).flatMap(r => r.files || []));
    const keepFolders = new Set([...avatars.map(folderOf), ...[...referenced].map(p => p.split('/')[2])]);
    const orphanFiles = [];
    for (const folder of await listFolders(io)) {
        if (keepFolders.has(folder)) {
            // 쓰는 폴더라도 항목에 없는 파일(올리다 끊긴 것 · 예전 항목)은 정리 대상
            for (const name of await listFolder(folder, io)) { const p = `user/images/${folder}/${name}`; if (!referenced.has(p)) orphanFiles.push(p); }
            continue;
        }
        for (const name of await listFolder(folder, io)) orphanFiles.push(`user/images/${folder}/${name}`);
    }
    const goneFiles = gone.flatMap(a => chars[a].files || []);
    return { gone, goneFiles, orphanFiles, total: goneFiles.length + orphanFiles.length };
}
export { MAX_FILES };
