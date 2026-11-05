// 5.7.0 새 버전 알림 · 업데이트 창 (실리태번 헬퍼처럼 업데이트가 있으면 확장 목록에서 바로 보이게 —
//   버전 알약을 노랗게 빛나게 하고, 누르면 '새 버전이 나왔어요 · 업데이트할까요?' 와 바뀐 내역)
// 1.0.0 바탕: 9.0.0 정리에서 걷었던 것을 되살려요. 시작 그래프 밖 — 판 알약(version-pill.js)이 부팅 8초 뒤에 받아요.
//   판 비교는 (계열, 판) 짝(src/version-series.js): 원격 manifest 의 bl_series 를 같이 읽어 「s2:1.0.0」 꼴로 들고,
//   1.0.0(계열 2) 이 8.2.5(계열 1) 보다 새 판이에요. 공지(release-notes.json) 항목도 series 칸(없으면 계열 1)으로 견줘요.
//   설정 창 맨 위 한 줄은 되살리지 않았어요. 「테마 › 업데이트」 상자는 1.0.1 에 되살렸어요(src/theme-update.js — 이 모듈의 checkForUpdate · openUpdate 를 써요).
//
// 확인: 6시간에 한 번 GitHub 의 manifest.json(365 B)만 받아 버전을 비교한다 (설정 updateCheck — 기본 켬; 끄면 업데이트 탭의 버튼을 누를 때만).
//   결과는 이 브라우저의 localStorage(bl_update_check)에 — 새로고침 · 탭 전환마다 다시 묻지 않는다. 못 받으면 조용히 (다음 기회에).
//   raw.githubusercontent 가 막히면 GitHub Pages 의 release-notes.json 맨 위 버전으로.
// 알약: 새 버전이 있으면 확장 서랍 머리 · 설정 창 제목의 버전 알약에 has-update (css/20-panel.css 노란 빛, 공지 빛 is-new 보다 먼저).
// 누르면: 업데이트 창 — 지금 → 새 버전, 그 사이 버전들의 공지 (release-notes.json 은 창을 열 때만 받음 · 152 KB).
// 업데이트:
//   Git 으로 깐 곳 → 실리태번 업데이트 (/api/extensions/update — 확장 관리의 업데이트 단추와 같음)
//     7.8.5 그게 실패하면 (저장소 기록이 다시 쓰여 받아 오기가 막힌 경우 등) 아래 ZIP 길로 새로 받아 깐다.
//     7.8.8 기록이 다시 쓰인 뒤 얕은 설치는 서버의 첫 git fetch 가 새 기록 전체를 받느라 몇 분 걸린다 → /version · /update 를 15분까지 기다리고
//           기다린 시간을 보여 준다. /update 가 끊기거나 시간이 넘어도(던짐) 500 과 같이 새로 받아 깔기로 넘어간다.
//   ZIP 으로 깐 곳 (.git 없음 — 폰 · Syncthing 사본 · 손으로 푼 ZIP) → GitHub 링크 설치로 바꾼다:
//     지금 폴더를 전역으로 옮겨 백업 (/move) → GitHub 에서 설치 (/install) → 백업 지움 (/delete global).
//     설치가 안 되면 백업을 제자리로 되돌린다. 설정 · 대화 · 그림은 설치 폴더 밖(settings.json · chats · user)이라 그대로.
//     옮기기는 관리자만 (실리태번 단독 사용자는 관리자) — 아니거나 공용(전역)으로 깐 ZIP 이면 ZIP 받기 링크.
//   끝나면 '새로고침' 단추 (새 파일은 새로고침해야 돈다).
import { loadVersion, currentVersion, currentRelease } from './notice.js';
import { getSettings } from './settings.js';
import { compareRelease, parseRelease, releaseString } from './version-series.js';
import { paintPills } from './version-pill.js';
import { REPO, RAW, PAGES } from './repo.js';
export { REPO };

const MANIFEST = `${RAW}/manifest.json`;
const NOTES = `${PAGES}/release-notes.json`;
const RELEASES = `${REPO}/releases/latest`;   // 여기서 업데이트를 못 할 때 ZIP 을 받는 곳 (예전 소개 사이트 자리)
const STORE = 'bl_update_check';
export const EVERY = 6 * 60 * 60 * 1000;
export const SLOW_GIT_MS = 15 * 60 * 1000;   // 7.8.8 /version · /update 기다림 — 기록이 바뀐 뒤 첫 git fetch 는 새 기록 전체를 받아 몇 분 걸림

let latest = '';   // 계열까지 붙은 판('8.2.5' · 's2:1.0.0')
let checking = null;

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** 화면에 적는 새 판 글자('1.0.0') */
export const latestVersion = () => parseRelease(latest)?.version || '';
/** 지금 판보다 새 판이 GitHub 에 있나 ((계열, 판) 짝 비교) */
export function hasUpdate() {
    const now = currentRelease();
    return !!latest && !!now && compareRelease(latest, now) > 0;
}
/** 공지 · release-notes 항목 → 비교용 판 (series 칸이 없으면 계열 1) */
export const noteRelease = n => releaseString({ version: String(n?.version ?? ''), series: n?.series });

function readStore() {
    try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
function writeStore(value) {
    try { localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* 사생활 모드 · 막힌 저장소 */ }
}

function setLatest(v) {
    latest = releaseString(String(v || ''));
    paintPills({ update: hasUpdate(), latest: latestVersion() });   // 확장 서랍 머리 · 설정 창 제목의 판 알약 (설정 창은 다시 그릴 때도 같은 값)
}

/** GitHub 의 최신 버전 (manifest → 막히면 Pages 공지 맨 위). 못 받으면 던진다 */
export async function fetchLatest(fetcher = fetch, now = Date.now()) {
    const t = Math.floor(now / EVERY);   // 6시간 묶음마다 다른 주소 — 중간 캐시가 옛 manifest 를 주지 않게
    try {
        const r = await fetcher(`${MANIFEST}?t=${t}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (r.ok) { const v = releaseString(await r.json()); if (v) return v; }   // bl_series 칸까지 (없으면 계열 1)
    } catch { /* 아래 Pages 로 */ }
    const r = await fetcher(`${NOTES}?t=${t}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const v = Array.isArray(j) ? noteRelease(j[0]) : '';
    if (!v) throw new Error('버전 없음');
    return v;
}

let failed = false;
/** 1.0.1 마지막으로 GitHub 에 물은 것이 실패했나 (테마 › 업데이트 상자의 「업데이트 확인」 문장 — theme-update.js) */
export const checkFailed = () => failed;
/** 새 버전 확인 (6시간에 한 번 · force 면 바로). 결과 버전 문자열(없으면 '') */
export function checkForUpdate({ force = false } = {}) {
    if (checking) return checking;
    checking = (async () => {
        if (!force && getSettings().updateCheck === false) return latest;
        if (!(await loadVersion())) return '';
        const cached = readStore();
        const age = cached ? Date.now() - Number(cached.at) : Infinity;
        if (!force && cached && age >= 0 && age < EVERY) { setLatest(cached.latest); return latest; }
        try {
            const v = await fetchLatest();
            failed = false;
            writeStore({ at: Date.now(), latest: v });
            setLatest(v);
        } catch { failed = true; writeStore({ at: Date.now() - EVERY + 30 * 60 * 1000, latest: cached?.latest || '' }); setLatest(cached?.latest || ''); }   // 7.2.4 실패 뒤 30분은 다시 묻지 않는다 — 전엔 탭이 보일 때마다 15s+20s 요청 둘을 또 보냈다 (api-audit)
        return latest;
    })().finally(() => { checking = null; });
    return checking;
}
/** 자동 확인을 끄면 빛도 끈다 (다시 켜면 바로 확인) */
export function clearUpdate() { setLatest(''); }

let started = false;
/** index.js 가 부팅 뒤 한 번 부른다: 지금 한 번 + 탭으로 돌아올 때마다 (6시간 안이면 저장된 값) */
export function startUpdateCheck() {
    if (started) return;
    started = true;
    void checkForUpdate();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkForUpdate(); });
}

/** 공지 목록에서 from 보다 새롭고 to 까지인 판 (새것 먼저) — from · to 는 계열까지 붙은 판 */
export function notesBetween(notes, from, to) {
    return (Array.isArray(notes) ? notes : [])
        .filter(n => n && noteRelease(n) && Array.isArray(n.items) && compareRelease(noteRelease(n), from) > 0 && compareRelease(noteRelease(n), to) <= 0)
        .sort((a, b) => compareRelease(noteRelease(b), noteRelease(a)));
}
export function notesHtml(list) {
    return list.map((n, i) => `
        <div class="salty-notice-item${i === 0 ? ' open' : ''}">
            <button type="button" class="salty-notice-toggle" aria-expanded="${i === 0}">
                <span class="salty-notice-ver">v${esc(n.version)}</span>
                <span class="salty-notice-date">${esc(String(n.date || '').replaceAll('-', '.'))}</span>
                <i aria-hidden="true"></i>
            </button>
            <ul>${n.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        </div>`).join('');
}

/** 이 테마가 깔린 자리(확장 폴더 이름 · 공용 여부) — 예전 theme-update.js 에 있던 것 */
export function installationFrom(url,types){
    const parts=new URL(url).pathname.split('/').map(decodeURIComponent),index=parts.indexOf('third-party');
    const name=index>=0?parts[index+1]:null;
    if(!name||/[\\/]/.test(name)||name==='.'||name==='..')throw Error('설치 경로를 확인하지 못했어요. 확장 관리 또는 ZIP 다운로드를 이용해 주세요.');
    const type=types[`third-party/${name}`];
    if(!['global','local'].includes(type))throw Error('설치 유형을 확인하지 못했어요. 새로고침 후 다시 확인해 주세요.');
    return {extensionName:name,global:type==='global'};
}

/**
 * 업데이트 한 번 (창 밖에서도 부를 수 있게 — 검사용으로 fetcher 를 바꿔 끼운다).
 * inst = { extensionName, global } (theme-update.installationFrom) · headers = 실리태번 요청 머리 (CSRF)
 * @returns {Promise<'done'|'done-backup'|'zip'>} done-backup = 새 버전은 깔렸는데 백업을 못 지움 · zip = 여기서는 못 함 (ZIP 받기)
 * 실패하면 한국어 Error 를 던진다 (무엇이 어떻게 남았는지 적어서)
 */
export async function runUpdate({ inst, headers = {}, fetcher = fetch, repo = REPO, status = () => {}, waitMs = SLOW_GIT_MS, tickMs = 5000 }) {
    const post = (path, body, timeout = 60000) => fetcher(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
    const name = inst?.extensionName;
    if (!name) throw new Error('설치 폴더를 확인하지 못했어요. 새로고침한 뒤 다시 해 주세요.');
    // 7.8.8 /version · /update 는 서버에서 git fetch 를 돌린다. 저장소 기록이 다시 쓰인 뒤 얕은 설치(--depth 1)는 이 fetch 가
    //   새 기록 전체(수백 MB)를 한 번 받느라 몇 분 걸린다 — 60초에 끊으면 재설치로 못 넘어가고, 다시 누르면 처음부터 또 받는다.
    //   그래서 기다림을 길게 두고(기본 15분) 몇 초마다 기다린 시간을 보여 준다.
    const patient = async (path, body, label) => {
        const t0 = Date.now();
        const timer = setInterval(() => { const ms = Date.now() - t0, sec = Math.round(ms / 1000); if (ms >= Math.min(10000, tickMs * 2)) status(`${label} (${sec}초) — 저장소 기록이 바뀐 뒤 처음 한 번은 몇 분 걸릴 수 있어요. 창을 닫지 말고 기다려 주세요.`); }, tickMs);
        try { return await post(path, body, waitMs); } finally { clearInterval(timer); }
    };
    status('설치 방식을 확인하는 중…');
    let r;
    try { r = await patient('/api/extensions/version', inst, 'GitHub 에서 받아 오는 중…'); }
    catch (error) {
        if (error?.name === 'TimeoutError') throw new Error('서버가 아직 GitHub 에서 받아 오는 중일 수 있어요. 몇 분 뒤 다시 눌러 주세요 (아무것도 안 바뀌었어요).');
        throw new Error('서버에 연결하지 못했어요. 실리태번이 켜져 있는지 확인하고 다시 해 주세요 (아무것도 안 바뀌었어요).');
    }
    if (!r.ok) throw new Error('설치 정보를 못 읽었어요. 다른 확인이 아직 받아 오는 중이면 몇 분 뒤, 아니면 새로고침한 뒤 다시 해 주세요.');
    const info = await r.json();
    if (info?.remoteUrl) {
        status('업데이트하는 중…');
        let ok = false;
        try {
            r = await patient('/api/extensions/update', inst, '업데이트하는 중…');
            if (r.status === 403) throw new Error('업데이트 권한이 없어요. 공용 설치라면 관리자 계정에서 업데이트해 주세요.');
            ok = r.ok;
        } catch (error) {
            if (/권한이 없어요/.test(error?.message || '')) throw error;
            ok = false;   // 7.8.8 연결이 끊기거나 시간이 넘어도(던짐) 500 과 같이 새로 받아 깔기로 — 폴더가 아직 쓰이는 중이면 옮기기가 실패해 그대로 멈춘다(아무것도 안 바뀜)
        }
        if (ok) return 'done';
        // 7.8.5 받아 오기(git pull)가 막히면 — 저장소 기록이 다시 쓰였거나 폴더 안 파일이 손으로 바뀐 경우 — 아래 ZIP 설치와 같은 길로 새로 받아 깐다
        //   (백업 → GitHub 설치 → 백업 지움 · 못 받으면 백업을 되돌림). 공용(전역) 설치는 백업 자리가 없어 그대로 실패 안내.
        if (inst.global) throw new Error('업데이트가 실패했어요. 연결 상태를 확인하고 다시 해 주세요.');
        status('업데이트가 안 돼서 GitHub 에서 새로 받아요…');
    }
    if (inst.global) return 'zip';   // 공용(전역) ZIP 설치는 백업을 둘 자리가 없다
    status('GitHub 링크 설치로 바꾸는 중… 지금 폴더를 백업해요');
    const fromGit = !!info?.remoteUrl;   // 여기까지 왔으면 Git 설치인데 받아 오기가 실패한 경우
    r = await post('/api/extensions/move', { extensionName: name, source: 'local', destination: 'global' });
    if (r.status === 409 && fromGit) {
        // 7.8.8 실리태번의 옮기기는 「복사 → 원본 지우기」라, 서버가 아직 그 폴더에서 받아 오는 중이면 지우기만 실패하고 전역에 복사본이 남는다
        //   (예전 판은 그 뒤로 「예전 백업 폴더가 남아 있어」에서 계속 멈춤). Git 설치의 복구 길에서는 그 복사본이 우리가 남긴 백업이니 지우고 한 번 더.
        status('지난번에 남은 백업을 지우고 다시 백업해요…');
        await post('/api/extensions/delete', { extensionName: name, global: true }).catch(() => null);
        r = await post('/api/extensions/move', { extensionName: name, source: 'local', destination: 'global' });
    }
    if (r.status === 403) return 'zip';
    if (!r.ok && fromGit && r.status !== 409) throw new Error('서버가 아직 GitHub 에서 받아 오는 중이라 폴더를 옮기지 못했어요. 몇 분 뒤 다시 눌러 주세요.');
    if (r.status === 409) throw new Error('예전 백업 폴더가 남아 있어 멈췄어요 (아무것도 안 바뀌었어요). 확장 관리에서 공용으로 깔린 Blue Lemonade 를 지운 뒤 다시 해 주세요.');
    if (!r.ok) throw new Error('지금 폴더를 백업하지 못해 멈췄어요 (아무것도 안 바뀌었어요).');
    status('GitHub 에서 새 버전을 받는 중… (1분쯤 걸릴 수 있어요)');
    let installed = false;
    try { r = await post('/api/extensions/install', { url: repo, global: false }, 300000); installed = r.ok; } catch { installed = false; }
    if (!installed) {
        status('받지 못해서 원래대로 돌리는 중…');
        const moveBack = () => post('/api/extensions/move', { extensionName: name, source: 'global', destination: 'local' }).catch(() => null);
        let back = await moveBack();
        if (back?.status === 409) {   // 설치가 같은 이름의 폴더를 반쯤 만들었으면 지우고 다시
            await post('/api/extensions/delete', { extensionName: name, global: false }).catch(() => null);
            back = await moveBack();
        }
        if (back?.ok) throw new Error('GitHub 에서 받지 못해 원래대로 돌려 놨어요. 연결 상태를 확인하고 다시 해 주세요.');
        throw new Error(`GitHub 에서 받지도 되돌리지도 못했어요. 새로고침하기 전에 확장 관리 › 확장 설치에 ${repo} 를 넣어 주세요 (설정은 그대로예요).`);
    }
    status('백업을 지우는 중…');
    const del = await post('/api/extensions/delete', { extensionName: name, global: true }).catch(() => null);
    return del?.ok ? 'done' : 'done-backup';
}

/** 버전 알약을 눌렀을 때 (새 버전이 있을 때만): '새 버전이 나왔어요 · 업데이트할까요?' + 바뀐 내역 */
export async function openUpdate({ start = false } = {}) {   // 6.6.9 start: 설정 창 한 줄의 업데이트 단추 — 창을 열자마자 업데이트를 시작
    await loadVersion();
    if (!hasUpdate()) return false;
    const ctx = SillyTavern.getContext();
    const now = currentVersion(), next = latestVersion(), from = currentRelease(), to = latest;
    const wrap = document.createElement('div');
    wrap.className = 'salty-notice bl-update';
    wrap.innerHTML = `
        <div class="salty-notice-head"><b>새 버전이 나왔어요</b><span>Blue Lemonade</span></div>
        <p class="bl-update-ask">업데이트할까요? <span class="bl-update-vers">v${esc(now)} → <b>v${esc(next)}</b></span></p>
        <p class="bl-update-status" role="status" aria-live="polite" hidden></p>
        <div class="bl-update-notes"><p class="salty-note">바뀐 내역을 불러오는 중…</p></div>`;
    wrap.addEventListener('click', (event) => {
        const toggle = event.target.closest('.salty-notice-toggle');
        if (!toggle) return;
        const item = toggle.parentElement;
        const open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    const statusEl = wrap.querySelector('.bl-update-status');
    const status = (text, kind = '') => { statusEl.textContent = text; statusEl.hidden = !text; statusEl.className = `bl-update-status${kind ? ` is-${kind}` : ''}`; };
    void (async () => {
        const box = wrap.querySelector('.bl-update-notes');
        try {
            const r = await fetch(`${NOTES}?t=${Math.floor(Date.now() / 600000)}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
            if (!r.ok) throw new Error(String(r.status));
            const list = notesBetween(await r.json(), from, to);
            if (!list.length) throw new Error('empty');
            box.innerHTML = notesHtml(list);
        } catch {
            box.innerHTML = `<p class="salty-note">바뀐 내역을 못 불러왔어요. <a href="${RELEASES}" target="_blank" rel="noopener noreferrer">GitHub 릴리스</a>에서 볼 수 있어요.</p>`;
        }
    })();
    let stage = 'ask', popup = null;
    const buttons = () => {
        if (!popup?.okButton) return;
        popup.okButton.textContent = stage === 'done' ? '새로고침' : stage === 'zip' ? 'ZIP 받기' : '업데이트';
        // 실리태번 팝업 단추는 div — disabled 속성이면 .menu_button[disabled] 로 흐려진다 (누름은 onClosing 이 막음)
        for (const b of [popup.okButton, popup.cancelButton]) { if (!b) continue; b.toggleAttribute('disabled', stage === 'busy'); b.setAttribute('aria-disabled', String(stage === 'busy')); }
        if (popup.cancelButton) popup.cancelButton.textContent = stage === 'done' ? '닫기' : '나중에';
    };
    const go = async () => {
        stage = 'busy'; buttons();
        try {
            const host = await import('../../../../extensions.js');
            const inst = installationFrom(import.meta.url, host.extensionTypes);
            const result = await runUpdate({ inst, headers: ctx.getRequestHeaders(), status: (text) => status(text) });
            if (result === 'zip') {
                stage = 'zip';
                status('이 설치는 여기서 바로 업데이트할 수 없어요 (공용 설치이거나 관리자 계정이 아니에요). ZIP 받기로 새 ZIP 을 받아 덮어써 주세요.', 'warn');
            } else {
                stage = 'done';
                status(result === 'done-backup'
                    ? '업데이트했어요. 새로고침하면 새 버전이 돌아요. 다만 백업을 못 지웠어요 — 새로고침 뒤 확장 관리에서 공용으로 깔린 Blue Lemonade 를 지워 주세요.'
                    : '업데이트했어요. 새로고침하면 새 버전이 돌아요.', 'ok');
            }
        } catch (error) {
            stage = 'ask';
            status(error?.name === 'TimeoutError' ? '서버 응답을 기다리다 시간이 지났어요. 잠시 뒤 다시 확인해 주세요.' : (error?.message || '업데이트가 실패했어요.'), 'bad');
        }
        buttons();
    };
    await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.CONFIRM, '', {
        okButton: '업데이트', cancelButton: '나중에', allowVerticalScrolling: true,
        onOpen: (p) => { popup = p; p?.dlg?.classList.add('bl-roomy-dialog'); buttons(); if (start) void go(); },
        onClosing: (p) => {
            if (stage === 'busy') return false;                       // 업데이트 중에는 닫지 않는다
            if (p.result !== ctx.POPUP_RESULT.AFFIRMATIVE) return true;
            if (stage === 'done') { location.reload(); return false; }
            if (stage === 'zip') { window.open(RELEASES, '_blank', 'noopener,noreferrer'); return true; }
            void go();
            return false;
        },
    });
    return true;
}
