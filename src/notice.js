// 공지사항 (3.0.0) — 테마 설정 창 · 확장 서랍 제목 옆 버전 알약을 누르면 업데이트에서 달라진 것을 팝업으로 보여 준다.
// 아직 안 본 버전이면 알약이 포인트색으로 은은히 빛나고(is-new), 한 번 열어 보면 보통 버전 알약으로 돌아간다.
// 본 버전은 설정(noticeSeen)에 적는다 — 새로고침해도 유지되고, 다음 업데이트에서 다시 빛난다.
//
// 본문 표는 src/notice-data.js 에 있다 — 팝업을 열 때만 읽는다(4.5.0, 부팅 JS 에서 뺌).
import { getSettings, saveSettings } from './settings.js';


let version = '';
let loading = null;

/** manifest.json 의 버전 (한 번만 읽는다) */
export function loadVersion() {
    loading ??= fetch(new URL('../manifest.json', import.meta.url))
        .then(res => res.json())
        .then((manifest) => { version = String(manifest?.version || ''); return version; })
        .catch(() => '');
    return loading;
}

export function currentVersion() {
    return version;
}

/** 'a.b.c' 비교: a > b 면 양수 */
function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return d;
    }
    return 0;
}

/** 아직 안 본 업데이트가 있나 (지금 버전이 본 버전보다 새것) */
export function hasUnseenNotice() {
    if (!version) return false;
    const seen = getSettings().noticeSeen;
    return !seen || compareVersions(version, seen) > 0;
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 같은 날 나온 버전은 한 장으로 묶는다 (하루에 여러 번 올라간 날 — '오늘 바뀐 것'을 한 번에 읽게). 버전 표시는 'v4.1.5 ~ v4.2.3'
function groupByDate(list) {
    const groups = [];
    for (const notice of list) {
        const last = groups.at(-1);
        if (last && last.date === notice.date) { last.first = notice.version; last.items.push(...notice.items); last.count++; }
        else groups.push({ date: notice.date, version: notice.version, first: notice.version, items: [...notice.items], count: 1 });
    }
    return groups.map(g => ({ date: g.date, items: g.items, version: g.count > 1 ? `${g.first} ~ v${g.version}` : g.version, note: g.count > 1 ? ` · 업데이트 ${g.count}번` : '' }));
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
        </div>`).join('');
    return `<div class="salty-notice">
        <div class="salty-notice-head"><b>공지사항</b><span>Blue Lemonade</span></div>
        ${rows}
    </div>`;
}

/**
 * 공지사항 팝업. 여는 순간 지금 버전을 본 것으로 적고 onSeen 을 부른다 (알약들을 보통 모양으로 돌리게).
 * @param {() => void} [onSeen]
 */
export async function openNotice(onSeen) {
    await loadVersion();
    const s = getSettings();
    if (version && s.noticeSeen !== version) {
        s.noticeSeen = version;
        saveSettings();
    }
    onSeen?.();
    const ctx = SillyTavern.getContext();
    const wrap = document.createElement('div');
    wrap.innerHTML = await noticeHtml();
    wrap.addEventListener('click', (event) => {
        const toggle = event.target.closest('.salty-notice-toggle');
        if (!toggle) return;
        const item = toggle.parentElement;
        const open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.TEXT, '', { allowVerticalScrolling: true, okButton: '닫기', onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') });
}
