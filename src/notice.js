// 공지사항 (3.0.0) — 테마 설정 창 · 확장 서랍 제목 옆 버전 알약을 누르면 업데이트에서 달라진 것을 팝업으로 보여 준다.
// 아직 안 본 버전이면 알약이 포인트색으로 은은히 빛나고(is-new), 한 번 열어 보면 보통 버전 알약으로 돌아간다.
// 본 버전은 설정(noticeSeen)에 적는다 — 새로고침해도 유지되고, 다음 업데이트에서 다시 빛난다.
//
// 본문 표는 src/notice-data.js 에 있다 — 팝업을 열 때만 읽는다(4.5.0, 부팅 JS 에서 뺌).
// 1.0.0 바탕: 9.0.0 정리에서 걷었던 것을 되살리며 시작 그래프 밖으로 — 이 모듈은 판 알약(version-pill.js, 3층 유휴)이 받는다.
//   판 비교는 (계열, 판) 짝(src/version-series.js): 1.0.0(계열 2)은 저장값 「8.2.4」(계열 1)보다 새 판이에요. 저장은 releaseString(계열 2 부터 「s2:1.0.0」).
import { getSettings, saveSettings } from './settings.js';
import { noticeActions, openNoticeAction } from './notice-actions.js';
import { compareRelease, releaseString } from './version-series.js';


let version = '', release = '';
let loading = null;

/** 실리태번이 시작할 때 읽어 둔 이 확장의 manifest (getExtensionManifest 가 없는 옛 판 · 못 찾으면 null) */
function knownManifest() {
    try {
        const folder = decodeURIComponent(new URL('..', import.meta.url).pathname.split('/').filter(Boolean).at(-1) || '');
        const manifest = globalThis.SillyTavern?.getContext?.()?.getExtensionManifest?.(folder);
        return manifest?.version ? manifest : null;
    } catch { return null; }
}

/** manifest.json 의 버전 (한 번만 읽는다). 7.7.4: 실리태번이 이미 읽어 둔 manifest 가 있으면 그 판 — 시작할 때 같은 파일을 한 번 더 받지 않는다 */
export function loadVersion() {
    const read = () => {
        const known = knownManifest();
        if (known) return Promise.resolve(known);
        return fetch(new URL('../manifest.json', import.meta.url), { cache: 'no-store' })
            .then(res => { if (!res.ok) throw new Error('manifest unavailable'); return res.json(); });
    };
    loading ??= read()
        .then((manifest) => { version = String(manifest?.version || ''); release = releaseString(manifest) || version; return version; })
        .catch(() => { loading = null; return ''; });
    return loading;
}

/** 화면에 적는 판 글자('1.0.0') */
export function currentVersion() {
    return version;
}
/** 계열까지 붙은 판('8.2.5' · 's2:1.0.0') — 비교 · 저장용 */
export function currentRelease() {
    return release;
}

/** 아직 안 본 업데이트가 있나 (지금 판이 본 판보다 새것 — (계열, 판) 짝 비교) */
export function hasUnseenNotice() {
    if (!release) return false;
    const seen = getSettings().noticeSeen;
    return !seen || compareRelease(release, seen) > 0;
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 같은 날 나온 버전은 한 장으로 묶는다 (하루에 여러 번 올라간 날 — '오늘 바뀐 것'을 한 번에 읽게). 버전 표시는 'v4.1.5 ~ v4.2.3'
function groupByDate(list) {
    const groups = [];
    for (const notice of list) {
        const last = groups.at(-1);
        if (last && last.date === notice.date) { last.first = notice.version; last.items.push(...notice.items); last.actions.push(...(notice.actions||[])); last.count++; }
        else groups.push({ date: notice.date, version: notice.version, first: notice.version, items: [...notice.items], actions:[...(notice.actions||[])], count: 1 });
    }
    return groups.map(g => ({ date: g.date, items: g.items, actions:noticeActions(g.actions), version: g.count > 1 ? `${g.first} ~ v${g.version}` : g.version, note: g.count > 1 ? ` · 업데이트 ${g.count}번` : '' }));
}

async function noticeHtml() {
    const { NOTICES } = await import('./notice-data.js');
    const rows = groupByDate(NOTICES).map((notice, i) => `
        <div class="salty-notice-item${i === 0 ? ' open' : ''}">
            <button type="button" class="salty-notice-toggle" aria-expanded="${i === 0}">
                <span class="salty-notice-ver">v${escapeHtml(notice.version)}</span>
                <span class="salty-notice-date">${escapeHtml(notice.date.replaceAll('-', '.'))}${escapeHtml(notice.note)}</span>
                <i aria-hidden="true"></i>
            </button>
            <ul>${notice.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            <div class="bl-notice-actions">${notice.actions.map(({id,label})=>`<button type="button" class="salty-btn" data-notice-action="${id}">${label}</button>`).join('')}</div>
        </div>`).join('');
    return `<div class="salty-notice">
        <div class="salty-notice-head"><b>공지사항</b><span>Blue Lemonade</span></div>
        ${rows}
    </div>`;
}

/**
 * 공지사항 창. 여는 순간 지금 버전을 본 것으로 적고 onSeen 을 부른다 (알약들을 보통 모양으로 돌리게).
 * 7.8.0: 실리태번 팝업(callGenericPopup) 대신 테마 자체 <dialog class="bl-notice-dialog"> — 폰에 깔린 실리태번 판에 따라
 * 「취소」가 끼고 「닫기」가 빨갛게 칠해지던 것(7.7.8 · 7.7.9)이 판과 상관없이 생길 수 없게. 단추는 「닫기」 하나.
 * @param {() => void} [onSeen]
 */
let openDlg = null;
export async function openNotice(onSeen) {
    await loadVersion();
    const html = await noticeHtml();
    const s = getSettings();
    if (release && s.noticeSeen !== release) {
        s.noticeSeen = release;
        saveSettings();
    }
    onSeen?.();
    try { openDlg?.close(); } catch {}
    const dlg = document.createElement('dialog');
    dlg.className = 'bl-notice-dialog';
    dlg.setAttribute('aria-label', '공지사항');
    dlg.innerHTML = `<div class="bl-notice-body">${html}</div><footer class="bl-notice-foot"><button type="button" class="bl-notice-close" data-notice-close>닫기</button></footer>`;
    let pending = '';
    dlg.addEventListener('click', (event) => {
        if (event.target === dlg || event.target.closest('[data-notice-close]')) { dlg.close(); return; } // 바깥(배경) · 닫기
        const action = event.target.closest('[data-notice-action]')?.dataset.noticeAction;
        if (action && !pending) { pending = action; dlg.close(); return; }
        const toggle = event.target.closest('.salty-notice-toggle');
        if (!toggle) return;
        const item = toggle.parentElement;
        const open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    const closed = new Promise(resolve => dlg.addEventListener('close', () => { dlg.remove(); if (openDlg === dlg) openDlg = null; resolve(); }, { once: true }));
    document.body.append(dlg);
    openDlg = dlg;
    dlg.showModal();
    dlg.querySelector('.bl-notice-body')?.scrollTo?.(0, 0);
    await closed;
    if (pending) try { await openNoticeAction(pending); } catch (error) { globalThis.toastr?.error(error.message || '기능을 열지 못했어요.', 'Blue Lemonade'); }
}
