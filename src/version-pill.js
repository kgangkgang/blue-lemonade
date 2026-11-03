// 판 알약 · ⓒ 단추 (1.0.0 바탕 — 9.0.0 정리에서 걷었던 것을 되살려요).
//   확장 서랍 머리 · 설정 창 제목: [Blue Lemonade] 8 [판 알약] 8 [ⓒ]. 알약을 누르면 공지사항(notice.js), 새 판이 있으면(노란 빛 has-update) 업데이트 창(update-check.js),
//   ⓒ 는 출처 · 라이선스 창(credits.js). 안 본 공지가 있으면 알약이 은은히 빛나요(is-new) — 판 비교는 (계열, 판) 짝(version-series.js).
//   시작 그래프 밖: index.js 3층(BOOT_IDLE · 유휴)이 이 모듈을 받아 startVersionPill 을 불러요. 설정 창(panel.js)은 제목을 그릴 때 titleBadgesHtml 을 써요.
//   공지 · 업데이트 · 출처 모듈은 누를 때 받고, 새 판 확인은 이 모듈이 붙고 8초 뒤에 받아요(6시간 안에 확인했으면 저장된 값 — 네트워크 없음).
import { loadVersion, currentVersion, hasUnseenNotice } from './notice.js';
import { badgeTextHit } from './badge-hit.js';

// 5.5.3 ⓒ 버튼 아이콘: 글자 ⓒ(U+24D2)는 글꼴(Segoe UI · Roboto · Noto)마다 잉크가 em 상자 아래쪽에 앉아 이름 · 버전 알약보다 낮아 보였다.
// 원과 c 가 viewBox 가운데(12,12)를 기준으로 위아래 대칭인 SVG → 글꼴과 상관없이 상자 가운데 = 잉크 가운데
export const COPYRIGHT_ICON = '<svg class="bl-copyright-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M14.7 8.78A4.2 4.2 0 1 0 14.7 15.22"/></svg>';
const COPYRIGHT_BUTTON = `<button type="button" class="bl-copyright" data-bl-credits aria-label="출처·라이선스">${COPYRIGHT_ICON}</button>`;

let update = { update: false, latest: '' };
const pillLabel = () => update.update ? `업데이트 v${update.latest}` : '공지사항';

// 5.3.7 서랍 머리의 알약: 알약 글자 위를 누른 것만 알약으로 친다 — 애드온 서랍 머리 알약(사용방법)과 같은 함수(src/badge-hit.js)
export { badgeTextHit };

/** 설정 창 제목 꼬리: 판 알약 + ⓒ (판을 아직 못 읽었으면 ⓒ 만 그리고, 읽으면 설정 창을 다시 그려요) */
export function titleBadgesHtml() {
    startVersionPill();   // 3층보다 설정 창이 먼저 열려도 알약 · ⓒ 누름을 받게
    const v = currentVersion();
    if (!v) void loadVersion().then(x => { if (x) globalThis.Salty?.refreshPanels?.(); });
    const pill = v ? `<button type="button" class="salty-ver${hasUnseenNotice() ? ' is-new' : ''}${update.update ? ' has-update' : ''}" data-bl-notice aria-label="${pillLabel()}">v${v}</button> ` : '';
    return ` ${pill}${COPYRIGHT_BUTTON}`;
}

/** 알약 모양을 지금 상태로 (next: 새 판 확인 결과 { update, latest } — update-check.js 가 넘겨요) */
export function paintPills(next) {
    if (next) update = { update: !!next.update, latest: String(next.latest || '') };
    const unseen = hasUnseenNotice();
    for (const badge of document.querySelectorAll('#salty-drawer .bl-version, .salty-panel .salty-ver')) {
        badge.classList.toggle('is-new', unseen);
        badge.classList.toggle('has-update', update.update);
        badge.setAttribute('aria-label', pillLabel());
    }
}

function mountDrawerBadges() {
    const head = document.querySelector('#salty-drawer > .inline-drawer-header > b');
    if (!head || head.querySelector('.bl-version')) return;
    const pill = document.createElement('span');
    pill.className = 'bl-version ext-version';
    pill.hidden = true;
    pill.dataset.blNotice = '';
    pill.setAttribute('role', 'button');
    pill.tabIndex = 0;
    head.append(' ', pill, ' ');
    head.insertAdjacentHTML('beforeend', COPYRIGHT_BUTTON);
    void loadVersion().then(v => { if (!v) return; pill.textContent = `v${v}`; pill.hidden = false; paintPills(); });
}

async function openFromPill() {
    try {
        if (update.update) { const m = await import('./update-check.js'); if (await m.openUpdate()) return; }
        const { openNotice } = await import('./notice.js');
        await openNotice(() => paintPills());
    } catch (error) { console.error('[Blue Lemonade] 공지사항', error); }
}
function stop(event) { event.preventDefault(); event.stopPropagation(); }
// 문서 단위 capture — 서랍 머리의 토글(index.js capture)보다 먼저 받아, 알약 · ⓒ 누름이 서랍을 펴지 않게
function onClick(event) {
    const target = event.target;
    if (target?.closest?.('[data-bl-credits]')) { stop(event); import('./credits.js').then(m => m.openCredits()).catch(error => console.error('[Blue Lemonade] 출처 창', error)); return; }
    const pill = target?.closest?.('[data-bl-notice]');
    if (!pill || pill.hidden || !badgeTextHit(event, pill)) return;
    stop(event);
    void openFromPill();
}
function onKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const pill = event.target?.closest?.('[data-bl-notice]');
    if (!pill || pill.tagName === 'BUTTON') return;   // 단추는 브라우저가 click 으로 바꿔 줘요
    stop(event);
    void openFromPill();
}

let started = false;
export function startVersionPill() {
    if (started) return;
    started = true;
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    mountDrawerBadges();
    setTimeout(() => globalThis.Salty?.refreshPanels?.(), 0);   // 먼저 열린 설정 창이 있으면 알약을 붙여 다시 그려요 (그리는 중에 불려도 다음 차례에)
    setTimeout(() => { import('./update-check.js').then(m => m.startUpdateCheck()).catch(error => console.warn('[Blue Lemonade] 업데이트 확인', error)); }, 8000);
}
