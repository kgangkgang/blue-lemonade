// 공지사항 (3.0.0) — 테마 설정 창 · 확장 서랍 제목 옆 버전 알약을 누르면 업데이트에서 달라진 것을 팝업으로 보여 준다.
// 아직 안 본 버전이면 알약이 포인트색으로 은은히 빛나고(is-new), 한 번 열어 보면 보통 버전 알약으로 돌아간다.
// 본 버전은 설정(noticeSeen)에 적는다 — 새로고침해도 유지되고, 다음 업데이트에서 다시 빛난다.
//
// 목록은 사용자에게 보이는 변화만 짧게 (개발 메모 · 측정 수치는 README 에). 새 버전을 낼 때 맨 위에 한 칸 추가.
// 주의: <details> 는 쓰지 않는다 — 사용자의 ▲ 접기 TH 스크립트가 열린 details 마다 접기 단추를 붙인다.
import { getSettings, saveSettings } from './settings.js';

export const NOTICES = [
    {
        version: '3.0.2', date: '2026-09-17', items: [
            '폰에서도 채팅/메시지 처리 칸이 빈틈 없이 두 열이에요. 슬라이더 두 개가 나란히 서고, 고르기 값이 잘리지 않게 이름 아래로 내렸어요.',
            '설정 창 제목 옆 버전 알약을 작게 줄였어요.',
        ],
    },
    {
        version: '3.0.1', date: '2026-09-17', items: [
            'PC · 태블릿 폭에서 사용자 설정의 채팅/메시지 처리 칸을 두 열로 나눴어요. 스위치와 슬라이더가 나란히 놓여 덜 휑해요.',
        ],
    },
    {
        version: '3.0.0', date: '2026-09-17', items: [
            '버전 알약을 누르면 이 공지사항이 떠요. 새 업데이트가 있으면 알약이 빛나요.',
            '테마 속 CSS 를 새로 짰어요. 화면은 그대로이고, 앞으로 고칠 때 설정 창 · 월드인포 같은 곳이 깨지는 일이 없게 했어요.',
            '테마 파일이 가벼워졌어요 (730KB → 553KB).',
        ],
    },
    {
        version: '2.9.5', date: '2026-09-17', items: [
            '채팅 › 화면 › 가벼운 페이드 인: 스트리밍 중 새 글자만 부드럽게 나타나요. 실리태번 페이드 인보다 훨씬 가벼워요.',
        ],
    },
    {
        version: '2.9.4', date: '2026-09-17', items: [
            '폰에서 서랍 여닫기가 두 배 넘게 빨라졌어요.',
            '글자를 칠 때와 답변이 스트리밍될 때 덜 버벅여요.',
        ],
    },
    {
        version: '2.9.3', date: '2026-09-16', items: [
            '데우스 카드 안 글자가 낱말 중간에서 끊기거나 양쪽 정렬로 벌어지던 것을 고쳤어요.',
        ],
    },
    {
        version: '2.9.2', date: '2026-09-16', items: [
            '데우스 트래커가 영어일 때 날짜가 글자마다 줄바꿈되던 것을 고쳤어요.',
            '고르기 목록 바깥을 누르면 뒤에 있던 단추가 눌리던 것을 고쳤어요.',
            '서랍이 열려 있을 때와 답변이 끝날 때 무겁던 것을 줄였어요.',
            '실리태번 설정 맞추기가 새로고침 없이 바로 적용돼요.',
        ],
    },
    {
        version: '2.9.1', date: '2026-09-16', items: [
            '폰에서 월드인포 편집 칸(스캔 깊이 · 자동화 ID)이 깨지던 것을 고쳤어요.',
        ],
    },
];

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

function noticeHtml() {
    const rows = NOTICES.map((notice, i) => `
        <div class="salty-notice-item${i === 0 ? ' open' : ''}">
            <button type="button" class="salty-notice-toggle" aria-expanded="${i === 0}">
                <span class="salty-notice-ver">v${escapeHtml(notice.version)}</span>
                <span class="salty-notice-date">${escapeHtml(notice.date.replaceAll('-', '.'))}</span>
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
    wrap.innerHTML = noticeHtml();
    wrap.addEventListener('click', (event) => {
        const toggle = event.target.closest('.salty-notice-toggle');
        if (!toggle) return;
        const item = toggle.parentElement;
        const open = !item.classList.contains('open');
        item.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.TEXT, '', { allowVerticalScrolling: true, okButton: '닫기' });
}
