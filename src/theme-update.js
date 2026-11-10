// 1.0.1 되살림: 테마 › 업데이트 화면의 「테마 업데이트」 상자 (8.2.5 src/theme-update.js — 1.0.0 극한 최적화 때 빠졌어요)
//   테마 · 내장 애드온 판을 한눈에(켠 것 먼저, 끈 것은 점선 칸) + 「업데이트 확인 / 업데이트」 · 「새로고침」 단추.
//   시작 그래프 밖: 설정 창이 업데이트 화면을 그릴 때만 panel.js bindUpdateSlot 이 이 모듈을 받아요(애드온 판은 그때 파일 앞 4KB 만 읽어요).
//   업데이트: GitHub 최신 판 확인(update-check.js checkForUpdate) → 새 판이면 판 알약과 같은 업데이트 창(openUpdate — Git 설치는
//     실리태번 확장 업데이트 길 · ZIP 설치는 GitHub 링크 설치로 바꾸기)을 열어요.
//   새로고침: 판 목록을 다시 읽어요(설치된 manifest · 애드온 파일을 캐시 없이). 설치 파일이 실행 중인 판과 다르면 「새로고침해서 적용」 단추.
import { loadVersion, currentVersion } from './notice.js';
import { getSettings } from './settings.js';

const state = { busy: false, message: '', disk: '' };
const views = new Set();

export function updateMarkup() {
    return '<section class="bl-theme-update" aria-label="테마 업데이트">'
        + '<h3><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> 테마 업데이트</h3>'
        + `<p>지금 실행 중인 판 <b data-theme-running>${currentVersion() ? `v${currentVersion()}` : '확인 중'}</b></p>`
        + '<dl class="bl-health-versions bl-installed-versions" data-installed-versions aria-label="설치된 판" aria-busy="true"></dl>'
        + '<p class="salty-note bl-installed-note">점선 칸은 꺼 둔 애드온이에요. ZIP 으로 깔았으면 업데이트할 때 GitHub 링크 설치로 바꿔요(설정 · 대화는 그대로예요).</p>'
        + '<div class="bl-script-actions">'
        + '<button type="button" class="salty-btn" data-theme-update>업데이트 확인</button>'
        + '<button type="button" class="salty-btn" data-theme-refresh>새로고침</button>'
        + '<button type="button" class="salty-btn" data-theme-apply hidden>새로고침해서 적용</button>'
        + '</div>'
        + '<p class="salty-note" data-theme-update-status role="status" aria-live="polite"></p>'
        + '</section>';
}

/** 판 목록 칸: 테마 먼저, 켠 애드온, 끈 애드온 순. disk 가 실행 판과 다르면 테마 칸에 설치된 판을 같이 적어요 */
export function versionCells(running, disk, addons) {
    const list = Array.isArray(addons) ? addons : [];
    const theme = { label: 'Blue Lemonade', version: running, on: true, note: disk && running && disk !== running ? `설치 v${disk}` : '' };
    return [theme, ...list.filter(a => a.on), ...list.filter(a => !a.on)];
}

/** 업데이트 단추 글자 · 상태 문장 (hasUpdate · latest 는 update-check.js 결과) */
export function updateButtonLabel(has, latest) { return has && latest ? `v${latest} 로 업데이트` : '업데이트 확인'; }

async function readDisk() {
    try {
        const r = await fetch(new URL('../manifest.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!r.ok) return '';
        return String((await r.json())?.version || '');
    } catch { return ''; }
}

function paintCells(box, cells) {
    const list = box.querySelector('[data-installed-versions]');
    if (!list?.isConnected) return;
    list.replaceChildren(...cells.map(({ label, version, on, note }) => {
        const cell = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        cell.className = on ? '' : 'is-off';
        dt.textContent = label;
        dd.textContent = (version ? `v${version}` : '확인 못 함') + (note ? ` · ${note}` : '');
        if (!on) dd.setAttribute('aria-label', `${dd.textContent} 꺼짐`);
        cell.append(dt, dd);
        return cell;
    }));
    list.setAttribute('aria-busy', 'false');
}

let reading = null;
/** 판 목록 다시 읽기 (fresh: 애드온 판 기억을 비우고 파일을 다시 받아요) */
export function readVersions(fresh = false) {
    reading ??= (async () => {
        await loadVersion();
        const [{ addonVersions, versionFlags }, disk] = await Promise.all([import('./addon-versions.js'), readDisk()]);
        const addons = await addonVersions(versionFlags(getSettings()), { fresh }).catch(() => []);
        state.disk = disk;
        return versionCells(currentVersion(), disk, addons);
    })().finally(() => { reading = null; });
    return reading;
}

async function refresh(fresh) {
    const cells = await readVersions(fresh).catch(() => null);
    for (const box of views) { if (!box.isConnected) { views.delete(box); continue; } if (cells) paintCells(box, cells); }
    paint();
    return cells;
}

async function paint() {
    const U = await import('./update-check.js').catch(() => null);
    const has = !!U?.hasUpdate(), latest = U?.latestVersion() || '';
    const stale = !!state.disk && !!currentVersion() && state.disk !== currentVersion();
    for (const box of views) {
        if (!box.isConnected) { views.delete(box); continue; }
        const update = box.querySelector('[data-theme-update]'), again = box.querySelector('[data-theme-refresh]'), apply = box.querySelector('[data-theme-apply]');
        update.textContent = state.busy ? '확인 중…' : updateButtonLabel(has, latest);
        update.classList.toggle('primary', has);
        update.disabled = state.busy; again.disabled = state.busy;
        apply.hidden = !stale;
        const running = box.querySelector('[data-theme-running]');
        if (running && currentVersion()) running.textContent = `v${currentVersion()}`;
        box.querySelector('[data-theme-update-status]').textContent = state.message
            || (stale ? `설치된 파일은 v${state.disk} 예요. 새로고침해서 적용하면 새 판이 돌아요.` : has ? `GitHub 에 새 판 v${latest} 이 있어요.` : '');
    }
}

async function onUpdate() {
    if (state.busy) return;
    const U = await import('./update-check.js');
    if (U.hasUpdate()) { void U.openUpdate({ start: true }); return; }
    state.busy = true; state.message = 'GitHub 에서 새 판을 확인하는 중…'; void paint();
    try {
        await U.checkForUpdate({ force: true });
        if (U.hasUpdate()) { state.message = ''; void U.openUpdate(); }   // 못 물었어도 지난번에 받아 둔 새 판이 있으면 그대로
        else if (U.checkFailed?.()) state.message = 'GitHub 에 연결하지 못했어요. 연결을 확인하고 다시 눌러 주세요.';
        else state.message = `지금이 최신 판이에요 (v${currentVersion()}).`;
    } catch { state.message = '새 판을 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.'; }
    finally { state.busy = false; void paint(); }
}

async function onRefresh() {
    if (state.busy) return;
    state.busy = true; state.message = '판 목록을 다시 읽는 중…'; void paint();
    for (const box of views) box.querySelector('[data-installed-versions]')?.setAttribute('aria-busy', 'true');
    try { const cells = await refresh(true); state.message = cells ? '판 목록을 다시 읽었어요.' : '판 목록을 읽지 못했어요. 다시 눌러 주세요.'; }
    finally { state.busy = false; void paint(); }
}

/** 설정 창이 업데이트 화면을 그릴 때 (panel.js bindUpdateSlot) */
export function bindThemeUpdate(root) {
    const box = root.querySelector('.bl-theme-update');
    if (!box) return;
    views.add(box);
    root._updateCleanup = () => views.delete(box);
    box.querySelector('[data-theme-update]').onclick = () => void onUpdate();
    box.querySelector('[data-theme-refresh]').onclick = () => void onRefresh();
    box.querySelector('[data-theme-apply]').onclick = () => location.reload();
    void refresh(false);
}
