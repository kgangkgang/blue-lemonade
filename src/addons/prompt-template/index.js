// 프롬프트 템플릿 — zonde306/ST-Prompt-Template (AGPL-3.0) 원본 ZIP 을 실리태번 extensions/third-party/ST-Prompt-Template 에 설치 · 업데이트 · 삭제하는 테마 쪽 도구.
// 출처 · 커밋 · 수정 없음 고지: NOTICE.md, 담긴 파일 목록 · 해시: SOURCE.json, ZIP 다시 만들기: tools/prompt-template-bundle.mjs.
// 원본은 손대지 않는다. 원본 번들이 제 폴더 이름(third-party/ST-Prompt-Template — 설정 HTML · 워커 경로)과 실리태번 모듈의 상대 깊이
// (../../../../../script.js)를 고정해 두어 테마 폴더 안에서는 실행할 수 없고, 꼭 그 이름의 폴더에 깔려야 한다 → ZIP 설치 도우미(server-plugin) 길을 그대로 쓴다.
// 실리태번 확장 관리의 git 업데이트와 부딪히지 않게: git 으로 깐 폴더(.git 있음)는 덮지도 지우지도 않고 안내만 한다. 이 애드온은 ZIP 설치본만 다룬다.
// 화면: 상태 한 줄 + 아이콘 단추 셋(설치 · 업데이트 / 실리태번 설정 열기 / 삭제). 글 최소 · 툴팁 없음 · aria-label 만.
// 설정 블록 한국어 표 · 머리글 판 알약은 host.js (애드온을 켜지 않아도 테마 index.js 가 부른다).
import { getSettings } from '../../settings.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { leaveSettingsDialog } from '../../settings-dialog.js';

export const VERSION = '1.0.0';
export const FOLDER = 'ST-Prompt-Template';
export const BUNDLED = '1.17.9';   // 담긴 원본 판 (SOURCE.json 의 version — 시험이 같은지 본다)
export const COMMIT = 'd6f520d149aba146305b0b781ddd691d449c28d2';   // 담긴 원본 커밋 (SOURCE.json 의 commit)
export const UPSTREAM = 'https://github.com/zonde306/ST-Prompt-Template';
export const ZIP_SHA256 = '0414ba3e1a12e100ab8d51d5d07af2b663fac2745ebd1ffa8fc9cd9c80216f56';   // 담긴 ZIP (SOURCE.json 의 zipSha256) — 폰에서 덜 받힌 파일을 서버로 보내지 않게 확인
const KEY = `third-party/${FOLDER}`;
const HELPER = '/api/plugins/blue-lemonade-zip';
const ZIP = new URL(`./${FOLDER}.zip`, import.meta.url);
const MANIFEST = `/scripts/extensions/${KEY}/manifest.json`;
const PANEL = 'prompt_template_settings';   // 원본 settings.html 의 맨 위 id

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const context = () => globalThis.SillyTavern?.getContext?.() ?? null;
const headers = () => { try { return context()?.getRequestHeaders?.() ?? {}; } catch { return {}; } };
const hasDocument = () => typeof document !== 'undefined' && typeof document.getElementById === 'function';

/** 화면이 읽는 상태 — helper: null 모름 · true · false(도우미 없음) · 'denied'(관리자 아님) / installed: null 모름 · false 없음 · { version, display_name }
 *  git: 실리태번 확장 관리(git)로 깐 폴더 / active: 지금 이 페이지에 실려 있음 / disabled: 확장 관리에서 끔 / done: '' | 'installed' | 'removed' (새로고침 대기) */
export const state = { helper: null, installed: null, git: false, active: false, disabled: false, busy: false, message: '', done: '', error: '' };

/** 'a.b.c' 숫자 비교 → -1 · 0 · 1 (빈 자리는 0) */
export function compareVersions(a, b) {
    const parse = v => String(v ?? '').split('.').map(n => parseInt(n, 10) || 0);
    const pa = parse(a), pb = parse(b);
    for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}

/** 상태 한 줄 (순수 — 시험용) */
export function statusText(s = state) {
    if (s.error) return s.error;
    if (s.busy) return s.message || '확인 중…';
    if (s.done === 'installed') return `${BUNDLED} 설치했어요 · 새로고침하면 켜져요`;
    if (s.done === 'removed') return '지웠어요 · 새로고침하면 사라져요 · 백업은 ZIP 설치 창에';
    if (s.installed === null) return '설치 상태를 확인하는 중…';
    const helper = s.helper === false ? ' · 서버 도우미 필요' : s.helper === 'denied' ? ' · 서버 관리자 계정에서만' : '';
    if (!s.installed) return `설치 안 됨 · 담긴 판 ${BUNDLED}${helper}`;
    const v = s.installed.version;
    if (s.git) return `${v} 설치됨 · git 설치본 — 업데이트 · 삭제는 실리태번 확장 관리에서`;
    const where = s.disabled ? ' · 확장 관리에서 꺼짐' : s.active ? '' : ' · 새로고침 대기';
    const cmp = compareVersions(v, BUNDLED);
    if (cmp < 0) return `${v} 설치됨 → ${BUNDLED} 업데이트 가능${helper}${where}`;
    if (cmp > 0) return `${v} 설치됨 · 담긴 판(${BUNDLED})보다 새 판${where}`;
    return `${v} 설치됨 · 담긴 판과 같음${where}`;
}

/** 단추 셋 (순수 — 시험용): [{ act, icon, label, disabled, primary }] */
export function actions(s = state) {
    const cmp = s.installed ? compareVersions(s.installed.version, BUNDLED) : -1;
    const first = s.done ? { act: 'reload', icon: 'fa-rotate-right', label: '새로고침해서 적용', disabled: s.busy, primary: true }
        : s.helper === false ? { act: 'install', icon: 'fa-download', label: '서버 도우미 준비 (ZIP 설치 창)', disabled: s.busy, primary: false }
        : { act: 'install', icon: 'fa-download', label: !s.installed ? '설치' : cmp < 0 ? '업데이트' : cmp > 0 ? '담긴 판으로 바꾸기' : '다시 설치', disabled: s.busy || s.installed === null || s.git || s.helper !== true, primary: !s.installed || cmp < 0 };
    return [
        first,
        { act: 'open', icon: 'fa-gear', label: '실리태번 확장 설정 열기', disabled: s.busy || !s.installed || !s.active, primary: false },
        { act: 'remove', icon: 'fa-trash', label: '삭제 (백업 남김)', disabled: s.busy || !s.installed || s.git || !!s.done || s.helper !== true, primary: false },
    ];
}

async function request(route, body, file) {
    const h = { ...headers(), 'X-BL-Zip': '1' };
    if (file) h['Content-Type'] = 'application/zip';
    let response;
    try { response = await fetch(HELPER + route, { method: file || body ? 'POST' : 'GET', headers: h, body: file || (body ? JSON.stringify(body) : undefined) }); }
    catch { throw Error('서버 연결이 끊겼어요. 다시 연결한 뒤 확인해 주세요.'); }
    let data; try { data = await response.json(); } catch { data = null; }
    if (!response.ok) { const e = Error(data?.error || (response.status === 404 ? '서버 도우미를 먼저 준비해 주세요.' : `서버 요청을 마치지 못했어요 (${response.status}).`)); e.status = response.status; throw e; }
    return data;
}

/** ZIP 설치 도우미가 있는지 — 없으면 설치 단추가 ZIP 설치 창(준비 안내)을 연다 */
export async function checkHelper() {
    try { await request('/status'); state.helper = true; }
    catch (e) { state.helper = e.status === 403 ? 'denied' : false; }
    return state.helper;
}

/** 실리태번 확장 관리(git)로 깐 폴더인지 — 실리태번 자체 /version 길 (git 저장소가 아니면 currentCommitHash 가 빈 값으로 바로 온다) */
async function isGit() {
    try {
        const r = await fetch('/api/extensions/version', { method: 'POST', headers: headers(), body: JSON.stringify({ extensionName: FOLDER, global: false }) });
        if (!r.ok) return false;
        const data = await r.json();
        return !!data?.currentCommitHash;
    } catch { return false; }
}

/** 설치 상태 다시 읽기: manifest.json 이 있나 · 판 · git 설치본인가 · 지금 실려 있나 */
export async function refresh({ probeGit = true } = {}) {
    state.error = '';
    try {
        const r = await fetch(MANIFEST, { cache: 'no-store' });
        if (r.status === 404) { state.installed = false; state.git = false; }
        else if (r.ok) { const m = await r.json(); state.installed = { version: String(m?.version || '?'), display_name: String(m?.display_name || '') }; }
        else throw Error(`설치 상태를 읽지 못했어요 (${r.status}).`);
    } catch (e) { state.installed = null; state.error = e.message; }
    state.active = hasDocument() && !!document.getElementById(PANEL);
    state.disabled = !!context()?.extensionSettings?.disabledExtensions?.includes?.(KEY);
    if (state.installed && probeGit) state.git = await isGit();
    if (state.helper === null) await checkHelper();
    renderAll();
    return state;
}

async function work(task) {
    state.busy = true; state.error = ''; renderAll();
    try { return await task(); }
    catch (e) { state.error = e.message || String(e); return false; }
    finally { state.busy = false; state.message = ''; renderAll(); }
}
const repoOf = m => { try { const u = new URL(m?.homePage || ''); return u.hostname.toLowerCase() === 'github.com' ? u.pathname.replace(/\.git$|\/$/g, '').toLowerCase() : ''; } catch { return ''; } };

/** 담긴 ZIP 을 도우미로 보내 ST-Prompt-Template 폴더에 설치 · 업데이트 (ZIP 설치 창과 같은 /inspect → /preview → /install) */
export async function install() {
    if (state.busy) return false;
    if (state.helper !== true) { await openZipPanel(); return false; }
    if (state.git) return false;
    return work(async () => {
        state.message = '담긴 ZIP 을 읽는 중…'; renderAll();
        const r = await fetch(ZIP, { cache: 'no-store' });
        if (!r.ok) throw Error(`담긴 ZIP 을 읽지 못했어요 (${r.status}).`);
        const zip = await r.blob();
        const digest = globalThis.crypto?.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await zip.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('') : ZIP_SHA256;
        if (digest !== ZIP_SHA256) throw Error('담긴 ZIP 이 손상됐어요. 테마를 다시 설치해 주세요.');
        state.message = '서버에 보내는 중…'; renderAll();
        const plan = await request(`/inspect?name=${encodeURIComponent(FOLDER + '.zip')}`, null, zip);
        const other = (plan.installed || []).find(m => m.folder !== FOLDER && ((repoOf(m) && repoOf(m) === repoOf(plan.manifest)) || m.display_name === plan.manifest?.display_name));
        if (other) throw Error(`같은 확장이 다른 폴더(${other.folder})에 있어요. 실리태번 확장 관리에서 그 폴더를 지운 뒤 다시 눌러 주세요.`);
        state.message = '설치 내용을 확인하는 중…'; renderAll();
        await request('/preview', { token: plan.token, folder: FOLDER });
        state.message = '설치하는 중…'; renderAll();
        const result = await request('/install', { token: plan.token });
        state.done = 'installed'; state.installed = { version: BUNDLED, display_name: String(plan.manifest?.display_name || '') }; state.active = false;
        return result;
    });
}

async function confirmRemove(plan) {
    const ctx = context();
    if (!ctx?.callGenericPopup) return hasDocument() && typeof confirm === 'function' ? confirm(`${FOLDER} v${plan.manifest?.version || '?'} 을 백업하고 지울까요?`) : false;
    const result = await ctx.callGenericPopup(`<h3>${esc(FOLDER)} 삭제</h3><p style="text-align:left;line-height:1.8">v${esc(plan.manifest?.version || '?')} · 파일 ${esc(plan.files)}개를 백업해 두고 지워요. 새로고침하면 확장이 사라지고, 백업은 ZIP 설치 창에서 되살릴 수 있어요.</p>`, ctx.POPUP_TYPE?.CONFIRM ?? 2, '', { okButton: '백업하고 삭제', cancelButton: '취소' });
    return result === (ctx.POPUP_RESULT?.AFFIRMATIVE ?? 1);
}

/** 설치본 삭제 (ZIP 설치 창과 같은 /remove-preview → 확인 → /remove · 폴더 전체를 백업에 옮긴다) */
export async function remove({ confirm = confirmRemove } = {}) {
    if (state.busy || !state.installed || state.git || state.helper !== true || state.done) return false;
    return work(async () => {
        state.message = '삭제할 내용을 확인하는 중…'; renderAll();
        const plan = await request('/remove-preview', { folder: FOLDER });
        if (!await confirm(plan)) return false;
        state.message = '백업하고 지우는 중…'; renderAll();
        const result = await request('/remove', { token: plan.token });
        state.done = 'removed'; state.installed = false; state.active = false;
        return result;
    });
}

/** 실리태번 확장 창(위 막대의 블록 아이콘)을 열고 프롬프트 템플릿 서랍을 펼쳐 그 자리로 */
export async function openSettings(from) {
    if (!hasDocument()) return false;
    leaveSettingsDialog(from);
    const toggle = document.querySelector('#extensions-settings-button .drawer-toggle'), block = document.getElementById('rm_extensions_block');
    const isOpen = () => !!block && block.classList.contains('openDrawer');
    if (toggle && block && !isOpen()) toggle.click();
    for (let i = 0; i < 20 && block && !isOpen(); i++) await wait(100);
    const panel = document.getElementById(PANEL);
    if (!panel) return false;
    const drawer = panel.querySelector('.inline-drawer'), content = drawer?.querySelector('.inline-drawer-content');
    if (content && getComputedStyle(content).display === 'none') drawer.querySelector('.inline-drawer-toggle')?.click();
    await wait(350);
    panel.scrollIntoView({ block: 'start' });
    return true;
}

/** 도우미가 없을 때: ZIP 설치 창(준비 안내가 있다)을 연다 — 그 애드온이 꺼져 있으면 스타일만 한 번 붙인다 */
async function openZipPanel() {
    if (!hasDocument()) return;
    try {
        if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href.includes('/addons/zipinstall/style.css'))) {
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('../zipinstall/style.css', import.meta.url).href; document.head.append(link);
        }
        (await import('../zipinstall/index.js')).openPanel();
    } catch (e) { state.error = 'ZIP 설치 창을 열지 못했어요. 블루레몬에이드 → 확장 → ZIP 설치에서 서버 도우미를 준비해 주세요.'; renderAll(); console.warn('[Blue Lemonade] 프롬프트 템플릿', e); }
}

// ── 화면
const views = new Set();
let dialog = null;
function markup() {
    const buttons = actions().map(b => `<button type="button" class="blpt-btn ${b.primary ? 'blpt-primary' : ''}" data-pt-act="${b.act}" aria-label="${esc(b.label)}" ${b.disabled ? 'disabled' : ''}><i class="fa-solid ${b.icon}" aria-hidden="true"></i></button>`).join('');
    return `<p class="blpt-status" role="status" aria-live="polite">${esc(statusText())}</p><div class="blpt-actions">${buttons}</div>`;
}
function render(root) {
    root.innerHTML = markup(); root.setAttribute('aria-busy', String(state.busy));
    for (const button of root.querySelectorAll('[data-pt-act]')) button.addEventListener('click', () => act(button.dataset.ptAct, button));
}
function renderAll() { for (const root of views) { if (!root.isConnected) { views.delete(root); continue; } render(root); } }
async function act(name, button) {
    if (state.busy) return;
    if (name === 'install') await install();
    else if (name === 'remove') await remove();
    else if (name === 'open') await openSettings(button);
    else if (name === 'reload') location.reload();
}
export function mountInline(host) {
    const root = document.createElement('div'); root.className = 'blpt'; host.append(root); views.add(root); render(root);
    if (!state.busy) refresh().catch(() => {});
    return () => { views.delete(root); root.remove(); };
}
export function openPanel() {
    if (dialog?.open) { dialog.focus(); return; }
    const previous = document.activeElement;
    dialog = document.createElement('dialog'); dialog.className = 'blpt-dialog'; dialog.setAttribute('aria-label', '프롬프트 템플릿');
    dialog.innerHTML = '<header><i class="fa-solid fa-code" aria-hidden="true"></i><strong>프롬프트 템플릿</strong><button type="button" aria-label="닫기">✕</button></header><div data-content></div>';
    document.body.append(dialog); const cleanup = mountInline(dialog.querySelector('[data-content]'));
    dialog.querySelector('header button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { cleanup(); dialog.remove(); dialog = null; if (previous?.isConnected) previous.focus(); }, { once: true });
    dialog.showModal();
}

if (hasDocument()) {
    verifyAddonCss({ folder: 'prompt-template', name: '--blpt-css-version', version: VERSION, title: '프롬프트 템플릿', selector: '.blpt' });
}
