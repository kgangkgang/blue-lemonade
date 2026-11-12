// 검사마다 리그 계정 설정 되돌리기(fast-lane, 2026-10-27) — check.mjs `--reset-account`
//   문제(8.0.5 check-all-805 progress.log): 검사 전후 「지문 바뀜 … → 되돌림」 은 페이지 메모리만 되돌렸어요. role-audit-large 처럼 uiSize 22 · 갈무리 글꼴을
//   settings.json 에 저장하는 검사 뒤에는, 다음 검사가 페이지를 새로 읽을 때 그 저장값을 다시 읽어 큰 글씨 상태로 돌았어요(btn-ink 「제외할 날씨」 순서 오염).
//   리그를 여러 대로 나누면 검사 순서가 리그마다 달라져 이 오염이 결과를 흔들어요.
//   → 리그가 준비됐을 때 settings.json 의 「지문 칸」(테마 글자 크기 · 팔레트 · UI/본문 글꼴)만 보관했다가, 검사 앞에서 저장값이 달라져 있으면
//     페이지를 비우고(about:blank) 그 칸만 처음 값으로 고쳐 쓰고 다시 읽어 지문을 대조해요. 같으면 아무것도 안 해요(시간 0).
//   (10-27 실측) 처음엔 settings.json 파일 전체를 되돌렸더니 「한글화 패널 사용방법」 같은 처음 한 번 안내의 「봤음」 표시까지 지워져
//     groups 가 안내 머리줄을 재 45건 오탐 → 파일 전체가 아니라 지문 칸만 되돌려요(다른 칸 · 채팅은 그대로).
//   리그 밖(사용자 실제 ST)은 다루지 않아요.
import fs from 'node:fs';
import path from 'node:path';

const REAL_ST = /\/downloads\/sillytavern\//i;
/** 되돌릴 칸(lib/rig-fingerprint.mjs KEYS 의 uiSize · palette · fontUi · fontText 가 저장되는 곳) */
export const KEY_PATHS = [['extension_settings', 'salty', 'type', 'uiSize'], ['extension_settings', 'salty', 'palette'], ['extension_settings', 'salty', 'fonts', 'ui'], ['extension_settings', 'salty', 'fonts', 'text']];
// (자동화 3차 10-27 실측 W/outputs/automation-3/leak-probe) 지문 칸 밖에서 검사 사이에 샌 상태 — 뒤 검사 결과를 바꿀 수 있는 것만 같이 되돌려요:
//   perf-gate 가 남긴 disabledExtensions(확장 꺼짐) · 고정물(데우스 · 과일)이 켠 blue_lemonade_scripts(한글화 스크립트 켬끔) · tavern_helper · help/role-audit 가 지운 페르소나 설명 ·
//   groups/role-audit-large 가 비운 기본 페르소나 · fruit-live-preview 의 고른 종류(fruitTypography) · 펼친 안내(esetham.guideOpen) · 보이스 탭.
//   새로 생긴 칸(확장 기본값 채움)과 「처음 안내 봤음」 표시는 되돌리지 않아요(10-27 groups 45건 오탐).
export const RESTORE_PATHS = [...KEY_PATHS,
    ['extension_settings', 'disabledExtensions'], ['extension_settings', 'blue_lemonade_scripts'], ['extension_settings', 'tavern_helper'],
    ['power_user', 'persona_description'], ['power_user', 'default_persona'],
    ['extension_settings', 'salty', 'fruitTypography'], ['extension_settings', 'esetham', 'guideOpen'], ['extension_settings', 'lemon_voice', 'ui', 'tab']];
/** 사용자 조건으로 맞춰 두는 칸(리그가 준비될 때 한 번): 사용자는 한글화 패널 처음 안내를 이미 봤어요 — 안 봤음 상태면 groups 가 안내 머리줄을 재(45건) 검사 순서에 따라 결과가 갈려요 */
export const SEED_VALUES = [{ path: ['extension_settings', 'prompt-panel', 'blIntroSeen110'], value: true }];
const getIn = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
const safePath=p=>{if(!Array.isArray(p)||!p.length||p.some(k=>typeof k!=='string'||['__proto__','prototype','constructor'].includes(k)))throw Error('복원 경로가 올바르지 않아요');return p;};
const setIn = (o, p, v) => { safePath(p);let x = o; for (const k of p.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } if (v === undefined) delete x[p.at(-1)]; else x[p.at(-1)] = v; };
const indentOf = text => { const m = /\n([ \t]+)"/.exec(text); return m ? (m[1].includes('\t') ? '\t' : m[1].length) : 4; };

/** 계정 폴더(…/rigs/<이름>/data/default-user)의 settings.json 지문 칸 보관. 리그 폴더 밖 · 실제 ST 는 거부 */
export function snapshotAccount(userDir, { keys = RESTORE_PATHS } = {}) {
    keys.forEach(safePath);
    const p = String(userDir).replace(/\\/g, '/');
    if (REAL_ST.test(p + '/')) throw new Error('실제 SillyTavern 계정은 다루지 않아요: ' + userDir);
    if (!/\/rigs\/[^/]+\/data\/default-user\/?$/i.test(p)) throw new Error('리그 계정 폴더(rigs/<이름>/data/default-user)만 보관해요: ' + userDir);
    const file = path.join(userDir, 'settings.json'); const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { dir: userDir, file, at: new Date().toISOString(), keys, values: keys.map(k => JSON.stringify(getIn(j, k) ?? null)), files: [file] };
}
/** 저장값이 처음과 다른 칸 이름(예: 'salty.type.uiSize') */
export function changedFiles(snap) {
    let j; try { j = JSON.parse(fs.readFileSync(snap.file, 'utf8')); } catch { return ['settings.json(못 읽음)']; }
    return snap.keys.filter((k, i) => JSON.stringify(getIn(j, k) ?? null) !== snap.values[i]).map(k => k.slice(1).join('.'));
}
/** 지문 칸만 처음 값으로 고쳐 써요(나머지 칸은 지금 파일 그대로). 고친 칸 수 */
export function restoreFiles(snap) {
    const text = fs.readFileSync(snap.file, 'utf8'); const j = JSON.parse(text); let n = 0;
    snap.keys.forEach((k, i) => { if (JSON.stringify(getIn(j, k) ?? null) !== snap.values[i]) { const v = JSON.parse(snap.values[i]); setIn(j, k, v === null ? undefined : v); n++; } });
    if (n) fs.writeFileSync(snap.file, JSON.stringify(j, null, indentOf(text)));
    return n;
}
/** 검사 앞에서: 바뀌었으면 페이지 비움 → 지문 칸만 되돌림 → 다시 읽기 → 지문 대조.
 *  io = { send(method, params), goto(), ready(): Promise<bool>, fingerprint(): Promise<obj>, sleep(ms) } (시험에서 가짜로 바꿔 끼워요)
 *  돌려줌 { changed:[칸], restored:n, ok, left:[지문 칸] } */
export async function resetAccount(snap, io, { baseFp = null, fpKeys = ['uiSize', 'palette', 'fontUi', 'fontText', 'firstRun'] } = {}) {
    const changed = changedFiles(snap);
    if (!changed.length) return { changed, restored: 0, ok: true, left: [] };
    try { await io.send('Page.navigate', { url: 'about:blank' }); } catch { }
    await io.sleep(1200);                                 // 떠나는 페이지의 늦은 저장(1초 디바운스)까지 기다렸다가
    const again = changedFiles(snap);
    const restored = restoreFiles(snap);
    await io.goto();
    const up = await io.ready();
    let left = [];
    if (baseFp) { let fp = null; try { fp = await io.fingerprint(); } catch { } left = fp ? fpKeys.filter(k => JSON.stringify(fp[k]) !== JSON.stringify(baseFp[k])) : ['지문 못 읽음']; }
    return { changed: [...new Set([...changed, ...again])], restored, ok: !!up && !left.length, left };
}

// ---------------------------------------------------------------- (자동화 3차 10-27) 지문 칸 밖 상태가 검사 사이에 새는지 점검
/** 지금 settings.json 의 extension_settings · power_user(없으면 {}) */
export function readState(snap) { try { const j = JSON.parse(fs.readFileSync(snap.file, 'utf8')); return { extension_settings: j.extension_settings || {}, power_user: j.power_user || {} }; } catch { return null; } }
const VOLATILE = /(^|\.)(time|timestamp|last\w*|updated\w*|at|ts|count|counter|cache\w*|recent\w*|history|log|usage\w*|stats?)$/i;
/** 두 상태의 다른 경로(깊이 maxDepth 까지, 배열은 통째로) — 시각 · 횟수 · 캐시처럼 늘 바뀌는 칸은 뺌 */
export function stateDiff(a, b, { maxDepth = 4, prefix = '', out = [] } = {}) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
        const p = prefix ? `${prefix}.${k}` : k; const x = a?.[k], y = b?.[k];
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
        if (VOLATILE.test(k)) continue;
        const obj = v => v && typeof v === 'object' && !Array.isArray(v);
        if (obj(x) && obj(y) && p.split('.').length < maxDepth) stateDiff(x, y, { maxDepth, prefix: p, out });
        else out.push({ path: p, before: JSON.stringify(x ?? null).slice(0, 60), after: JSON.stringify(y ?? null).slice(0, 60) });
    }
    return out;
}
/** 지문 칸(되돌리는 칸)은 빼고 남은 「샌 상태」 */
export function leaksOf(diff, keys = RESTORE_PATHS) { const restored = keys.map(k => k.join('.')); return diff.filter(d => !restored.some(r => d.path === r || d.path.startsWith(r + '.') || r.startsWith(d.path + '.'))); }

/** 사용자 조건 칸 채우기(없을 때만). 돌려줌 채운 칸 수 — 채웠으면 보관(snap)도 다시 해요 */
export function seedFile(file, seeds = SEED_VALUES) {
    const text = fs.readFileSync(file, 'utf8'); const j = JSON.parse(text); let n = 0;
    for (const s of seeds) if (getIn(j, s.path) === undefined) { setIn(j, s.path, s.value); n++; }
    if (n) fs.writeFileSync(file, JSON.stringify(j, null, indentOf(text)));
    return n;
}

// ---------------------------------------------------------------- (자동화 4차 10-27) 리그 시작 지문을 「사용자 조건」에 맞추기
//   사고(10-27 tvs-1): 앞선 사진 스크립트가 UI 글자 22 · 글꼴 galmurimono11 로 바꿔 둔 리그에서 check.mjs 가 돌았어요. --reset-account 는 「리그가 준비됐을 때의 지문」을
//   기준으로 되돌리는데 그 처음 지문이 이미 22 라 되돌려도 22 였고, role-audit 가 번역 창 글자 단추 18.7(=22×.85) 을 「다수 13과 다름」으로 새 실패 2건 잡았어요(새 리그에선 0).
//   → 기준은 「처음 본 지문」이 아니라 rig.mjs 가 심는 사용자 프로필 스냅샷(uiSize 15.5 · freesentation · ridibatang · night) 이에요. 검사 시작 때 다르면 그 칸만 맞추고 다시 읽어 확인해요.
export const USER_SNAPSHOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../outputs/user-settings-snapshot/settings-ui-20261023.json');
/** 사용자 조건(지문 칸 값) — 스냅샷 파일의 extension_settings.salty 에서. { paths:[[경로, 값]], fp:{uiSize,palette,fontUi,fontText} } */
export function userCondition(file = USER_SNAPSHOT) {
    const snap = JSON.parse(fs.readFileSync(file, 'utf8')); const s = snap.extension_settings?.salty; if (!s) throw new Error('스냅샷에 extension_settings.salty 가 없어요: ' + file);
    const paths = KEY_PATHS.map(p => [p, getIn({ extension_settings: { salty: s } }, p)]).filter(([, v]) => v !== undefined);
    return { file, paths, fp: { uiSize: s.type?.uiSize ?? null, palette: s.palette ?? null, fontUi: s.fonts?.ui?.ko ?? null, fontText: s.fonts?.text?.ko ?? null } };
}
const label = p => p.slice(1).join('.').replace('salty.type.uiSize', 'uiSize').replace('salty.palette', 'palette').replace('salty.fonts.ui', 'fontUi').replace('salty.fonts.text', 'fontText');
/** 지금 settings.json 과 사용자 조건의 차이 [{key, before, after}] */
export function conditionDiff(file, cond) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8')); const out = [];
    for (const [p, v] of cond.paths) { const cur = getIn(j, p); if (JSON.stringify(cur ?? null) !== JSON.stringify(v ?? null)) out.push({ key: label(p), before: typeof cur === 'object' && cur ? (cur.ko ?? JSON.stringify(cur)) : cur ?? null, after: typeof v === 'object' && v ? (v.ko ?? JSON.stringify(v)) : v }); }
    return out;
}
/** 사용자 조건 칸을 파일에 써요(그 칸만). 고친 칸 수 */
export function applyCondition(file, cond) {
    const text = fs.readFileSync(file, 'utf8'); const j = JSON.parse(text); let n = 0;
    for (const [p, v] of cond.paths) if (JSON.stringify(getIn(j, p) ?? null) !== JSON.stringify(v ?? null)) { setIn(j, p, structuredClone(v)); n++; }
    if (n) fs.writeFileSync(file, JSON.stringify(j, null, indentOf(text)));
    return n;
}
/** 검사 시작 때: 다르면 about:blank → 칸 맞춤 → 다시 읽기 → 지문이 조건과 같은지. 돌려줌 { changed:[{key,before,after}], applied, ok, left:[지문 칸] } */
export async function alignAccount(file, cond, io, { fpKeys = ['uiSize', 'palette', 'fontUi', 'fontText'] } = {}) {
    const changed = conditionDiff(file, cond);
    if (!changed.length) return { changed, applied: 0, ok: true, left: [] };
    try { await io.send('Page.navigate', { url: 'about:blank' }); } catch { }
    await io.sleep(1200);
    const applied = applyCondition(file, cond);
    await io.goto(); const up = await io.ready();
    let left = []; let fp = null; try { fp = await io.fingerprint(); } catch { }
    left = fp ? fpKeys.filter(k => cond.fp[k] != null && JSON.stringify(fp[k]) !== JSON.stringify(cond.fp[k])) : ['지문 못 읽음'];
    return { changed, applied, ok: !!up && !left.length, left, fp };
}
