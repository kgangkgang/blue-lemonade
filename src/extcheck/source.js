// 1.0.3 확장 충돌 검사 — 파일 읽기. 검사 창을 열 때만 받아요(index.js).
//   설치된 확장: 이 실리태번 서버(같은 출처)의 /scripts/extensions/<이름>/ 에서 manifest 의 js · css 와 거기서 부르는 상대 경로 파일만 읽어요. 쓰지 않아요.
//   블루레몬에이드 자신: JS 는 미리 뽑아 둔 신호표(self.gen.js — 묶음 8MB 를 다 받지 않게), CSS 는 style.css 그대로.
//   링크: 사용자가 「받아서 검사」를 누를 때만 api.github.com(저장소 기본 가지 1번) · raw.githubusercontent.com(파일) — 받은 코드는 실행하지 않아요.
import { profileOf, referencedFiles } from './core.js';
import { SELF_ROWS } from './self.gen.js';

export const LIMITS = Object.freeze({ files: 40, bytes: 2.5 * 1024 * 1024, file: 1.2 * 1024 * 1024, link: 3 * 1024 * 1024 });
const EXT_ROOT = new URL('../../../../', import.meta.url);          // /scripts/extensions/
const THEME_ROOT = new URL('../../', import.meta.url);              // 이 테마 폴더
/** 이 테마의 실리태번 이름('third-party/<폴더>') */
export const OWN = (() => { const m = /\/scripts\/extensions\/(third-party\/[^/]+)\//.exec(THEME_ROOT.pathname); return m ? decodeURIComponent(m[1]) : ''; })();
const pathUrl = (base, path) => new URL(String(path).split('/').map(encodeURIComponent).join('/'), base).href;

async function readText(url, max, signal) {
    const res = await fetch(url, { signal, credentials: 'same-origin' });
    if (!res.ok) return { text: null, status: res.status };
    const len = Number(res.headers.get('content-length') || 0);
    if (len && len > max) return { text: null, big: true };
    const text = await res.text();
    return text.length > max ? { text: null, big: true } : { text };
}
/** manifest 의 js · css 에서 시작해 부르는 파일을 따라가요(폴더 안만 · 상한) */
export async function collect(entry, get, { files = LIMITS.files, bytes = LIMITS.bytes } = {}) {
    const queue = [...new Set(entry.filter(Boolean).map(p => String(p).replace(/^\.?\//, '')))], seen = new Set(queue), out = [];
    let used = 0, skipped = 0, missing = 0;
    while (queue.length && out.length < files) {
        const path = queue.shift();
        let got;
        try { got = await get(path); } catch (error) { if (error?.name === 'AbortError') throw error; got = { text: null }; }
        if (got.big) { skipped++; continue; }
        if (got.text == null) { missing++; continue; }
        if (used + got.text.length > bytes) { skipped++; continue; }
        used += got.text.length;
        out.push({ path, text: got.text });
        if (/\.m?js$/i.test(path)) for (const next of referencedFiles(got.text, path)) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    return { files: out, used, skipped: skipped + queue.length, missing };
}
function selfSignals() {
    return SELF_ROWS.map(([k, key, file, line, addon, how, chained]) => ({ k, key, file, line, addon, how: how || undefined, chained: !!chained }));
}
async function host() { return await import('../../../../../extensions.js'); }
/** 실리태번 판(CLIENT_VERSION 의 가운데 칸) — 모르면 '' */
export async function clientVersion() {
    try { const v = String((await import('../../../../../../script.js')).CLIENT_VERSION || '').split(':')[1]; if (v && v !== 'UNKNOWN') return v; } catch { /* 아래 */ }
    try { const v = globalThis.BlueLemonadeHost?.pkgVersion || (await fetch('/version').then(r => r.ok ? r.json() : null))?.pkgVersion; if (v) return String(v); } catch { /* 모름 */ }
    return '';
}
/** 실리태번 사건 값 → 이름 표 ('chat_id_changed' → 'CHAT_CHANGED') */
export function eventNameMap() {
    try { const t = globalThis.SillyTavern?.getContext?.()?.eventTypes ?? {}; return Object.fromEntries(Object.entries(t).map(([k, v]) => [String(v), k])); } catch { return {}; }
}

/**
 * 설치된 확장 전부(켜진 것 · 꺼진 것) → { profiles, names, disabled, texts, stats }
 *   texts: 폴더 → (경로 → 글) — AI 검토 조각 · 줄 보기용(창이 닫히면 버려요)
 */
export async function readInstalled({ signal, onProgress = () => {} } = {}) {
    const ext = await host();
    const names = [...(ext.extensionNames || [])].map(String), disabled = [...(ext.extension_settings?.disabledExtensions || [])].map(String);
    const third = names.filter(n => n.startsWith('third-party/'));
    const eventNames = eventNameMap(), texts = new Map(), profiles = [];
    const stats = { extensions: third.length, files: 0, skipped: 0, bytes: 0 };
    let done = 0;
    const one = async name => {
        const folder = name.slice(12), base = new URL(`${name.split('/').map(encodeURIComponent).join('/')}/`, EXT_ROOT);
        let manifest = null;
        try { manifest = ext.getExtensionManifest?.(name) ?? null; } catch { manifest = null; }
        if (!manifest) { try { manifest = JSON.parse((await readText(pathUrl(base, 'manifest.json'), 200000, signal)).text || 'null'); } catch (error) { if (error?.name === 'AbortError') throw error; } }
        manifest = manifest && typeof manifest === 'object' ? manifest : {};
        const self = name === OWN;
        const get = path => readText(pathUrl(base, path), LIMITS.file, signal);
        // 자신: JS 는 신호표, CSS 는 style.css(+ 애드온 한 장)
        const entry = self ? [manifest.css || 'style.css', 'src/addons/style-addons.css'] : [manifest.js, manifest.css];
        const got = await collect(entry, get);
        stats.files += got.files.length; stats.skipped += got.skipped; stats.bytes += got.used;
        texts.set(folder, new Map(got.files.map(f => [f.path, f.text])));
        profiles.push(profileOf({ folder, manifest, files: got.files, enabled: !disabled.includes(name), self, signals: self ? selfSignals() : null, eventNames, name: self ? `블루레몬에이드 (이 테마)` : '' }));
        onProgress(++done, third.length, folder);
    };
    const pool = [...third];
    await Promise.all(Array.from({ length: Math.min(4, pool.length) }, async () => { while (pool.length) await one(pool.shift()); }));
    profiles.sort((a, b) => a.folder.localeCompare(b.folder));
    return { profiles, names, disabled, texts, stats };
}
/** AI 조각 · 줄 보기용 파일 글 — 테마 자신의 원본(src/…)은 그때 한 번 받아요 */
export async function sourceText(texts, side, signal) {
    const map = texts.get(side.folder);
    if (map?.has(side.file)) return map.get(side.file);
    if (!side.self || !/^(?:src\/|index\.js$)/.test(side.file)) return '';
    try { const got = await readText(pathUrl(THEME_ROOT, side.file), LIMITS.file, signal); if (got.text != null) { (map || texts.set(side.folder, new Map()).get(side.folder)).set(side.file, got.text); return got.text; } } catch (error) { if (error?.name === 'AbortError') throw error; }
    return '';
}

/** 링크 검사가 받을 곳 (누르기 전에 보여 줘요) */
export function linkPlan(parsed) {
    return [
        parsed.branch ? null : { host: 'api.github.com', what: `저장소 ${parsed.owner}/${parsed.repo} 의 기본 가지 이름 1번` },
        { host: 'raw.githubusercontent.com', what: `manifest.json · 확장 JS · CSS · HTML (최대 ${LIMITS.files}개 · ${Math.round(LIMITS.link / 1024 / 1024)}MB)` },
    ].filter(Boolean);
}
/** GitHub 저장소 → 설치 전 프로필 (받은 코드는 글로만 읽어요) */
export async function readGithub(parsed, { signal, eventNames = eventNameMap() } = {}) {
    const opts = { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' };
    let branch = parsed.branch;
    if (!branch) {
        const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`, { ...opts, headers: { Accept: 'application/vnd.github+json' } });
        if (res.status === 404) throw new Error('저장소를 찾지 못했어요. 주소를 확인해 주세요(비공개 저장소는 못 읽어요).');
        if (res.status === 403) throw new Error('GitHub 가 잠시 요청을 막았어요(요청 한도). 조금 뒤 다시 해 주세요.');
        if (!res.ok) throw new Error(`GitHub 에서 저장소 정보를 받지 못했어요(${res.status}).`);
        branch = String((await res.json())?.default_branch || 'main');
    }
    const base = `https://raw.githubusercontent.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/${branch.split('/').map(encodeURIComponent).join('/')}/`;
    const get = async path => {
        const res = await fetch(pathUrl(base, path), opts);
        if (!res.ok) return { text: null };
        const text = await res.text();
        return text.length > LIMITS.file ? { text: null, big: true } : { text };
    };
    const head = await get('manifest.json');
    if (head.text == null) throw new Error(`${parsed.repo} 저장소 맨 위에 manifest.json 이 없어요. 실리태번 확장 저장소가 맞는지 확인해 주세요.`);
    let manifest;
    try { manifest = JSON.parse(head.text); } catch { throw new Error('manifest.json 을 읽지 못했어요(JSON 이 아니에요).'); }
    if (!manifest || typeof manifest !== 'object') throw new Error('manifest.json 이 비어 있어요.');
    const got = await collect([manifest.js, manifest.css], get, { bytes: LIMITS.link });
    const folder = `링크:${parsed.repo}`;
    return {
        profile: profileOf({ folder, base: parsed.repo, manifest: { ...manifest, homePage: manifest.homePage || `https://github.com/${parsed.owner}/${parsed.repo}` }, files: got.files, name: `${manifest.display_name || parsed.repo} (링크)`, eventNames }),
        texts: new Map(got.files.map(f => [f.path, f.text])), folder, branch, stats: { files: got.files.length, skipped: got.skipped, bytes: got.used },
    };
}
