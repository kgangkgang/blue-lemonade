// 로딩 시간 (Load Timer)
// 실리태번은 확장을 loading_order 순서로 하나씩(<script type="module"> 태그를 붙이고 load를 기다린 뒤 다음) 불러온다.
// 테마 내장판은 활성화된 뒤에 붙는 확장 script 태그의 시작과 load 시각을 재서
// 확장별 "받아서 실행하기까지" 걸린 시간을 구한다. 앱 준비(APP_READY)와 첫 채팅이 그려진 시각도 같이 적는다.
// 폰에서 잠깐 켜 두고 숫자를 보는 용도라, 설정은 없고 켜질 때마다 결과 창이 한 번 뜬다. 마법봉 메뉴 → 로딩 시간 으로 다시 볼 수 있다.
import { pane } from './hub.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';

const TITLE = '로딩 시간';
const MODULE = 'load_timer';
/** manifest.json 과 같아야 한다 (build-zip.ps1 이 확인한다) */
const VERSION = '1.0.6';

// [1.0.3] 재는 건 늘 하고, 켤 때·채팅 열 때 토스트만 켜고 끈다 (표는 마법봉 메뉴에서 언제든)
function settings() {
    if (!extension_settings[MODULE] || typeof extension_settings[MODULE] !== 'object') extension_settings[MODULE] = {};
    const store = extension_settings[MODULE];
    if (typeof store.toasts !== 'boolean') store.toasts = true;
    return store;
}
const phaseStart = performance.now();
/** @type {{name:string, start:number, end:number|null, error:boolean, loadedAt:number|null, after:number}[]} */
const rows = [];
/** 확장 script 요소 → 그 줄 */
const rowOf = new WeakMap();
const marks = { appInitialized: null, appReady: null, chatChanged: null, chatPainted: null, chatMessages: 0, chatMeasured: false };
let shown = false;

// 리소스 타이밍 버퍼 기본값(250개)은 확장 15개가 부르는 파일 수를 넘길 수 있다
try {
    performance.setResourceTimingBufferSize(2000);
} catch {
    /* 무시 */
}

function extensionNameOf(src) {
    const match = /\/scripts\/extensions\/(third-party\/)?([^/]+)\//.exec(src);
    return match ? match[2] : null;
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLScriptElement) || node.type !== 'module') continue;
            const name = extensionNameOf(node.src || '');
            if (!name) continue;
            const row = { name, start: performance.now(), end: null, error: false, loadedAt: null, after: 0 };
            rows.push(row);
            rowOf.set(node, row);
            // [1.0.6] 여기(대상 단계)의 load 는 실리태번의 script.onload 와 그 뒤 마이크로태스크가 다 돈 다음에 온다.
            // 먼저 받은 시각(아래 capture)과의 차이 = 실리태번이 이어서 한 일 → 이 확장 시간에서 뺀다.
            const onTarget = (error) => {
                if (row.loadedAt === null) settle(row, error); // capture 를 못 받은 경우 (예전 방식 그대로)
                else row.after = performance.now() - row.loadedAt;
            };
            node.addEventListener('load', () => onTarget(false));
            node.addEventListener('error', () => onTarget(true));
        }
    }
});
observer.observe(document.body, { childList: true });

// [1.0.5] 끝은 load 바로 뒤가 아니라 그다음 타이머 차례에 찍는다. 확장 대부분은 jQuery(() => …) 안에서 초기화하는데,
// 그 콜백은 load 뒤 setTimeout 으로 돌아서, 예전에는 그 초기화 시간이 다음 확장 줄에 찍혔다 (400ms 초기화가 옆 확장 몫으로).
function settle(row, error) {
    setTimeout(() => { row.end = performance.now(); row.error = error; });
}

// [1.0.6] load · error 는 거품이 없지만 document 의 capture 단계에서는 실리태번의 script.onload 보다 먼저 받는다.
// 실리태번은 onload 에서 곧장(마이크로태스크로) 다음 일을 이어 간다 — 마지막 확장 뒤에는 슬래시 명령 · 프리셋 관리자 초기화 같은
// 앱 준비 작업이 그 load 안에서 돌아서, 예전에는 그 시간(PC 에서 100ms 넘게)이 통째로 마지막 확장(확장 순서, loading_order 200) 몫으로 찍혔다.
// 끝을 재는 타이머도 여기서 건다 — 실리태번이 이어서 건 타이머보다 앞서 돈다.
function onCaptured(event) {
    const row = rowOf.get(event.target);
    if (!row || row.loadedAt !== null) return;
    row.loadedAt = performance.now();
    settle(row, event.type === 'error');
}
document.addEventListener('load', onCaptured, true);
document.addEventListener('error', onCaptured, true);

eventSource.on(event_types.APP_INITIALIZED, () => { marks.appInitialized = performance.now(); });
eventSource.on(event_types.APP_READY, () => {
    marks.appReady = performance.now();
    observer.disconnect();
    // 확장은 앱 준비 전에 다 불러온다. 채팅 그림 · iframe 의 load 마다 불리지 않게 뗀다
    document.removeEventListener('load', onCaptured, true);
    document.removeEventListener('error', onCaptured, true);
    // 마지막 채팅은 앱 준비 뒤에 열리기도 한다. 채팅이 그려지면 바로, 아니면 앱 준비 8초 뒤에 보여 준다
    setTimeout(showOnce, 8000);
});
// 채팅을 열 때마다 잰다. 시작점은 캐릭터를 누른 순간(있으면), 없으면 CHAT_CHANGED. 끝은 메시지가 그려진 다음 프레임.
// 실리태번은 켜질 때 마지막 채팅을 자동으로 열지 않으니, 폰에서는 캐릭터를 직접 열 때 나오는 토스트가 "채팅 열기 시간"이다.
// [1.0.5] 누름에는 무엇을 여는지도 적어 두고, 그 채팅이 열렸을 때만 시작점으로 쓴다. 예전에는 채팅을 바꾸지 않는 누름
// (캐릭터 이름 탭, 이미 열린 캐릭터)도 30초 동안 남아서, 그 뒤에 닫거나 다른 길로 연 채팅에 몇 초짜리 숫자가 붙었다.
// 첫 화면의 최근 채팅(.recentChat)도 누름으로 친다 — 빠져 있어서 그 길로 열면 받아 와서 그리는 시간이 통째로 빠졌다.
let lastTap = null;
document.addEventListener('click', (event) => {
    const target = event.target.closest?.('.character_select, .group_select, .select_chat_block, .recentChat');
    if (!target) return;
    const file = (target.getAttribute('file_name') || target.getAttribute('data-file') || '').replace(/\.jsonl$/, '') || null;
    // 그룹 칸은 data-grid 에 id 가 있다 (실리태번도 data-chid 를 먼저 보고 없으면 data-grid 를 본다)
    const isGroup = target.classList.contains('group_select');
    const tap = {
        at: performance.now(),
        file,
        chid: isGroup ? null : target.getAttribute('data-chid'),
        group: isGroup ? (target.getAttribute('data-chid') || target.getAttribute('data-grid')) : null,
    };
    // 지금 열린 채팅을 다시 누르면 실리태번은 아무것도 열지 않는다
    if (!tapOpened(tap, getContext().chatId)) lastTap = tap;
}, true);

/** 이 채팅이 그 누름이 열려던 채팅인가 */
function tapOpened(tap, chatId) {
    if (tap.file) return String(chatId) === tap.file;
    const context = getContext();
    if (tap.group) return String(context.groupId) === tap.group;
    return tap.chid !== null && !context.groupId && String(context.characterId) === tap.chid;
}

eventSource.on(event_types.CHAT_CHANGED, (chatId) => {
    const changed = performance.now();
    const pending = lastTap !== null && changed - lastTap.at < 30000 ? lastTap : null;
    // 누른 채팅으로 가는 중간 단계(최근 채팅은 캐릭터의 마지막 채팅을 먼저 연다)는 재지 않고 목표 채팅을 기다린다
    if (pending && !tapOpened(pending, chatId)) return;
    const tapped = pending ? pending.at : null;
    lastTap = null;
    let done = false;
    /**
     * [1.0.4] measured=false 는 "재지 못했다"는 뜻이다. 예전에는 이럴 때도 0밀리초나 딱 10초를 잰 값처럼 적었다 —
     * 화면이 꺼져 있으면 그릴 기회 자체가 없으니 그 시간은 측정이 아니다.
     */
    const finish = (measured) => {
        if (done) return;
        done = true;
        const now = performance.now();
        const count = document.querySelectorAll('#chat .mes').length;
        const first = marks.chatChanged === null;
        marks.chatChanged = tapped ?? changed;
        marks.chatPainted = measured ? now : null;
        marks.chatMessages = count;
        marks.chatMeasured = measured;
        if (first && !shown) {
            setTimeout(showOnce, 800);
        } else if (chatId && settings().toasts && typeof toastr !== 'undefined') {
            // [1.0.5] 채팅을 닫을 때(chatId 없음)도 CHAT_CHANGED 가 와서 "채팅 열림" 토스트가 떴다
            toastr.info(measured
                ? `채팅 열림 → 그려짐 ${seconds(now - marks.chatChanged)} · 메시지 ${count}개`
                : `채팅을 열었어요 · 메시지 ${count}개 (화면이 꺼져 있어 시간은 못 쟀어요)`, TITLE, { timeOut: 3000, extendedTimeOut: 500 });
        }
    };
    // 두 프레임 뒤 = 메시지 DOM이 그려지고 첫 페인트가 끝난 시점.
    // 화면이 꺼져 있거나 탭이 뒤에 있으면 프레임이 오지 않는다 — 그때는 숫자를 지어내지 않고 "못 쟀다"로 남긴다.
    if (document.hidden) {
        setTimeout(() => finish(false), 0);
        return;
    }
    // 그리는 도중에 화면이 꺼지면 그 뒤의 프레임은 잠금이 풀린 시각이라 잰 값이 아니다
    let wentHidden = false;
    const onHide = () => { if (document.hidden) wentHidden = true; };
    document.addEventListener('visibilitychange', onHide);
    const stop = () => document.removeEventListener('visibilitychange', onHide);
    requestAnimationFrame(() => requestAnimationFrame(() => { finish(!wentHidden); stop(); }));
    setTimeout(() => { finish(false); stop(); }, 10000);
});

function seconds(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
    return ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function kilobytes(bytes) {
    // 크로미움은 메모리 캐시에서 읽은 파일의 크기를 0으로 준다
    if (!bytes) return '캐시';
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

/** 확장별로 받은 파일 수와 크기 (transferSize 0 = 캐시에서 읽음) */
function resourceStats() {
    const stats = new Map();
    for (const entry of performance.getEntriesByType('resource')) {
        const name = extensionNameOf(entry.name);
        if (!name) continue;
        const stat = stats.get(name) ?? { files: 0, decoded: 0, transferred: 0, cached: 0 };
        stat.files += 1;
        stat.decoded += entry.decodedBodySize || 0;
        stat.transferred += entry.transferSize || 0;
        if (!entry.transferSize) stat.cached += 1;
        stats.set(name, stat);
    }
    return stats;
}

/**
 * 한 확장의 시간. 다음 확장의 태그는 앞 확장의 초기화가 돌기 전에 붙는다 — 겹친 시간은 앞 확장 몫이니 앞 줄이 끝난 뒤부터 센다.
 * [1.0.6] 그 안에서 실리태번이 load 에 이어서 한 일(row.after)은 뺀다.
 */
function rowMs(row, previousEnd) {
    if (row.end === null) return null;
    const from = Math.max(row.start, previousEnd);
    let ms = row.end - from;
    if (row.loadedAt !== null && row.after > 0) {
        const overlap = Math.min(row.end, row.loadedAt + row.after) - Math.max(from, row.loadedAt);
        if (overlap > 0) ms -= overlap;
    }
    return Math.max(0, ms);
}

function collect() {
    const navigation = performance.getEntriesByType('navigation')[0];
    const stats = resourceStats();
    const list = rows.map((row, i) => ({
        ...row,
        ms: rowMs(row, rows[i - 1]?.end ?? 0),
        stat: stats.get(row.name) ?? { files: 0, decoded: 0, transferred: 0, cached: 0 },
    })).sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
    const phaseEnd = list.reduce((max, row) => Math.max(max, row.end ?? 0), phaseStart);
    return {
        navigation: navigation ? { responseEnd: navigation.responseEnd, domContentLoaded: navigation.domContentLoadedEventEnd } : null,
        phaseStart,
        phaseEnd,
        extensionsTotal: list.reduce((sum, row) => sum + (row.ms ?? 0), 0),
        list,
        marks: { ...marks },
        userAgent: navigator.userAgent,
    };
}

function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
}

function render(data) {
    const { marks, list } = data;
    const summary = [
        ['서버 응답 끝', data.navigation ? seconds(data.navigation.responseEnd) : '—'],
        ['확장 불러오기 시작', seconds(data.phaseStart)],
        ['확장 불러오기 끝', seconds(data.phaseEnd), `확장 ${list.length}개 · 합 ${seconds(data.extensionsTotal)}`],
        ['앱 준비 (APP_READY)', seconds(marks.appReady)],
        ['채팅 그려짐', seconds(marks.chatPainted), marks.chatChanged === null
            ? '채팅이 열리지 않았어요'
            : (marks.chatMeasured
                ? `메시지 ${marks.chatMessages}개 · 열림 → 그려짐 ${seconds(marks.chatPainted - marks.chatChanged)}`
                : `메시지 ${marks.chatMessages}개 · 화면이 꺼져 있어 시간은 못 쟀어요`)],
    ].map(([label, value, note]) => `<div class="lt-sum"><span>${esc(label)}</span><b>${esc(value)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`).join('');

    const max = Math.max(1, ...list.map(row => row.ms ?? 0));
    const table = list.map(row => `
        <tr class="${row.error ? 'is-error' : ''}">
            <td class="lt-name">${esc(row.name)}${row.error ? ' <small>(실패)</small>' : ''}</td>
            <td class="lt-ms"><i style="width:${Math.round(((row.ms ?? 0) / max) * 100)}%"></i><span>${seconds(row.ms)}</span></td>
            <td>${kilobytes(row.stat.decoded)}</td>
            <td>${row.stat.files}${row.stat.cached ? `<small> · 캐시 ${row.stat.cached}</small>` : ''}</td>
        </tr>`).join('');

    return `
        <div class="lt-root">
            <div class="lt-summary">${summary}</div>
            <div class="lt-table-wrap"><table class="lt-table">
                <thead><tr><th>확장</th><th>불러오기</th><th>파일 크기</th><th>파일</th></tr></thead>
                <tbody>${table || '<tr><td colspan="4">이 확장 뒤에 불러온 확장이 없어요.</td></tr>'}</tbody>
            </table></div>
            <small class="lt-note">시각은 페이지를 연 순간이 0이에요. 테마보다 먼저 시작한 확장은 실행 시간을 재지 못해 표에서 빠져요. "불러오기"는 script 태그를 붙인 뒤 실행이 끝날 때까지라, 그 확장이 import하는 파일과 초기화 코드가 모두 들어가요. 파일 크기는 압축을 푼 크기예요.</small>
            <div class="lt-actions"><button type="button" class="menu_button lt-copy"><i class="fa-regular fa-copy"></i> 글로 복사</button></div>
        </div>`;
}

function asText(data) {
    const lines = [
        `[${TITLE}] ${new Date().toLocaleString('ko-KR')}`,
        `서버 응답 끝 ${seconds(data.navigation?.responseEnd)} · 확장 ${seconds(data.phaseStart)}→${seconds(data.phaseEnd)} (합 ${seconds(data.extensionsTotal)}) · 앱 준비 ${seconds(data.marks.appReady)} · 채팅 ${data.marks.chatMessages}개 ${data.marks.chatMeasured ? `열림 뒤 ${seconds(data.marks.chatPainted - data.marks.chatChanged)}` : '(시간 못 잼)'}`,
        ...data.list.map(row => `${row.name}\t${seconds(row.ms)}\t${kilobytes(row.stat.decoded)}\t${row.stat.files}개${row.error ? '\t실패' : ''}`),
        data.userAgent,
    ];
    return lines.join('\n');
}

async function showReport() {
    // [1.0.4] 이 창이 보여 주는 값은 이 창에 묶어 둔다. 예전에는 모듈 변수 하나를 함께 써서,
    // 표를 두 개 띄우면 먼저 연 창의 "글로 복사"가 나중 창의 숫자를 복사했다.
    const data = collect();
    const root = document.createElement('div');
    root.innerHTML = render(data);
    root.querySelector('.lt-copy')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(asText(data));
            toastr.success('복사했어요.', TITLE);
        } catch {
            toastr.warning('복사하지 못했어요.', TITLE);
        }
    });
    await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true });
}

// [1.0.1] 켤 때는 한 줄 토스트만. 표는 마법봉 메뉴 → 로딩 시간 에서 연다.
function showOnce() {
    if (shown) return;
    shown = true;
    const data = collect();
    const chat = data.marks.chatMeasured ? ` · 채팅 ${seconds(data.marks.chatPainted - data.marks.chatChanged)}` : '';
    if (settings().toasts && typeof toastr !== 'undefined') {
        toastr.info(`앱 준비 ${seconds(data.marks.appReady)} · 확장 ${data.list.length}개 ${seconds(data.extensionsTotal)}${chat} — 표는 마법봉 메뉴에서`, TITLE, { timeOut: 3000, extendedTimeOut: 500 });
    }
}

function mountWandButton() {
    if (document.getElementById('lt-wand-button')) return;
    const container = document.getElementById('data_bank_wand_container') ?? document.getElementById('extensionsMenu');
    if (!container) return;
    const item = document.createElement('div');
    item.id = 'lt-wand-button';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.innerHTML = `<div class="fa-solid fa-stopwatch extensionsMenuExtensionButton"></div><span>${TITLE}</span>`;
    item.addEventListener('click', () => showReport().catch(() => {}));
    container.append(item);
}

// [1.0.3] 설정 서랍: 토스트 켬/끔 + 표 열기
function buildDrawer() {
    const container = pane('timer'); // 2.0.0 톱니바퀴 설정 창의 탭 (hub.js)
    if (!container || document.getElementById('load_timer_settings')) return;
    const drawer = document.createElement('div');
    drawer.id = 'load_timer_settings';
    drawer.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-stopwatch"></i> ${TITLE} <span class="lt-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="lt-drawer">
                    <label class="checkbox_label" for="lt_toasts"><input type="checkbox" id="lt_toasts"><span>켤 때·채팅 열 때 시간 토스트</span></label>
                    <div class="menu_button menu_button_icon lt-open"><i class="fa-solid fa-table-list"></i><span>표 보기</span></div>
                    <small class="lt-note">토스트를 꺼도 재는 건 계속해요. 표는 여기나 마법봉 메뉴에서 열어요.</small>
                </div>
            </div>
        </div>`;
    container.append(drawer);
    const checkbox = drawer.querySelector('#lt_toasts');
    checkbox.checked = settings().toasts;
    checkbox.addEventListener('change', () => {
        settings().toasts = checkbox.checked;
        saveSettingsDebounced();
    });
    drawer.querySelector('.lt-open').addEventListener('click', () => showReport().catch(() => {}));
}

jQuery(() => {
    settings();
    buildDrawer();
    mountWandButton();
    for (const delay of [1000, 4000]) setTimeout(mountWandButton, delay);
});
