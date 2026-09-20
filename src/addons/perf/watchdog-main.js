// 끊김 감시 (Stream Watchdog)
// 중계 서버가 답을 보내다 끊으면 실리태번 서버는 그걸 브라우저에 알리지 않아, 화면이 '생성 중'으로 멈춘 채 남는다
// (멈춤을 눌러야 풀림). 답이 시작된 뒤 정한 시간 동안 조각이 하나도 안 오면 연결이 끊긴 것으로 보고 스트림을 끝낸다.
// [1.1.1] 받은 글이 있으면 스트림을 끝으로 닫아 멈춤 단추와 같은 끝 처리를 탄다 — 받은 글이 다 남고, 스와이프 · 이어쓰기도
// 다시 쓰기 · 번역 · 장기 기억 · 저장을 거치고, 다시 쓰기는 사용자 멈춤이 아니니 끊긴 씬 플랜을 리롤한다.
import { pane } from './hub.js';
import * as extensions from '../../../../../../extensions.js';
import * as script from '../../../../../../../script.js';
import { isStreamRequest, watchRequest, clampIdle, clampFirst, STALL_NAME } from './watchdog.js';

const MODULE = 'stream_watchdog';
const FOLDER = 'blue-lemonade'; // 2.0.0 성능 보조로 합침
const VERSION = '1.1.1';
const TITLE = '끊김 감시';

const DEFAULTS = Object.freeze({ enabled: true, idleSeconds: 20, firstSeconds: 0 }); // firstSeconds: 첫 글자까지 최대 대기 (1.1.0, 0 = 끔)

function settings() {
    return extensions.extension_settings[MODULE];
}

function initSettings() {
    const all = extensions.extension_settings;
    const existing = all[MODULE];
    const s = existing && typeof existing === 'object' ? { ...DEFAULTS, ...existing } : { ...DEFAULTS };
    s.enabled = s.enabled !== false;
    s.idleSeconds = clampIdle(s.idleSeconds, DEFAULTS.idleSeconds);
    s.firstSeconds = clampFirst(s.firstSeconds, DEFAULTS.firstSeconds);
    all[MODULE] = s;
}

const stats = { watched: 0, stalled: 0 };

const env = {
    now: () => performance.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
    isHidden: () => document.visibilityState === 'hidden',
    onStall: ({ idleMs, first }) => {
        stats.stalled++;
        refreshStats();
        const seconds = Math.round(idleMs / 1000);
        const text = first ? `답이 ${seconds}초 동안 시작되지 않아 끊었어요` : `답이 ${seconds}초 동안 멈춰서 끊었어요`;
        console.warn(`[${TITLE}] ${text}`);
        if (typeof toastr !== 'undefined') toastr.warning(text, TITLE);
    },
};

function install() {
    const nativeFetch = window.fetch;
    window.fetch = function streamWatchdogFetch(input, init) {
        try {
            if (settings().enabled && isStreamRequest(input, init, location.origin)) {
                const idleMs = clampIdle(settings().idleSeconds) * 1000;
                const firstMs = clampFirst(settings().firstSeconds) * 1000;
                // 끊을 때 원래 요청도 같이 끊는다 — 요청 로그처럼 응답을 복사해 읽는 쪽까지 함께 끝나게.
                // 사용자의 멈춤(원래 신호)은 그대로 이어 준다
                const cut = new AbortController();
                const outer = init.signal;
                if (outer?.aborted) cut.abort(outer.reason);
                else outer?.addEventListener('abort', () => cut.abort(outer.reason), { once: true });
                stats.watched++;
                // [1.1.1] 받은 글이 있으면 끊을 때 스트림을 끝으로 닫는다 — 끊었다는 표시는 응답의 streamWatchdog (요청 로그가 읽는다)
                return watchRequest(nativeFetch.call(this, input, { ...init, signal: cut.signal }), { idleMs, firstMs, abort: error => cut.abort(error), env });
            }
        } catch (error) {
            console.warn(`[${TITLE}] 요청을 살피지 못했어요`, error);
        }
        return nativeFetch.call(this, input, init);
    };
}

// ── 설정 서랍 ───────────────────────────────────────────────

let drawer = null;

function refreshStats() {
    const el = drawer?.querySelector('.sw-stats');
    if (!el) return;
    el.textContent = stats.stalled ? `이번 세션: 끊음 ${stats.stalled}번` : '';
    el.hidden = !stats.stalled;
}

function buildDrawer() {
    const container = pane('watchdog'); // 2.0.0 톱니바퀴 설정 창의 탭 (hub.js)
    if (!container || drawer) return;
    drawer = document.createElement('div');
    drawer.id = 'stream_watchdog_settings';
    drawer.className = 'sw-settings';
    drawer.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-heart-pulse"></i> ${TITLE} <span class="sw-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="sw-body">
                    <p class="sw-hint"><b>스트리밍 응답에만 적용됩니다.</b> 비스트리밍 응답의 대기 시간은 감시하지 않습니다.</p>
                    <label class="checkbox_label sw-check" for="sw_enabled"><input type="checkbox" id="sw_enabled"><span>답이 멈추면 끊고 풀기</span></label>
                    <label class="sw-row" for="sw_idle"><span>기다릴 시간</span><span class="sw-num"><input type="number" id="sw_idle" class="text_pole" min="10" max="300" step="1" inputmode="numeric"><i>초</i></span></label>
                    <small class="sw-hint">답이 시작된 뒤 이 시간 동안 글자가 하나도 안 오면 끊어요. 받은 글은 남아요.</small>
                    <label class="sw-row" for="sw_first"><span>첫 글자 최대 대기</span><span class="sw-num"><input type="number" id="sw_first" class="text_pole" min="0" max="1800" step="1" inputmode="numeric"><i>초</i></span></label>
                    <small class="sw-hint">0 = 끔. 보낸 뒤 이 시간이 지나도 답이 시작되지 않으면 끊어요. 긴 프롬프트는 첫 글자까지 1분 가까이 걸리기도 해요.</small>
                    <small class="sw-hint sw-stats" hidden></small>
                </div>
            </div>
        </div>`;
    container.append(drawer);

    const enabled = drawer.querySelector('#sw_enabled');
    enabled.checked = settings().enabled;
    enabled.addEventListener('change', () => {
        settings().enabled = enabled.checked;
        script.saveSettingsDebounced?.();
    });

    const idle = drawer.querySelector('#sw_idle');
    idle.value = String(settings().idleSeconds);
    idle.addEventListener('change', () => {
        // 설정 창에서는 10초부터 (더 짧으면 생각이 긴 모델의 쉼을 끊음). 시험용 3초는 설정 파일로만
        const value = Math.max(10, clampIdle(idle.value, settings().idleSeconds));
        settings().idleSeconds = value;
        idle.value = String(value);
        script.saveSettingsDebounced?.();
    });
    const first = drawer.querySelector('#sw_first');
    first.value = String(settings().firstSeconds);
    first.addEventListener('change', () => {
        // 켤 때는 30초부터 (첫 글자가 늦는 긴 프롬프트를 끊지 않게). 0 = 끔
        const raw = clampFirst(first.value, settings().firstSeconds);
        const value = raw === 0 ? 0 : Math.max(30, raw);
        settings().firstSeconds = value;
        first.value = String(value);
        script.saveSettingsDebounced?.();
    });
    refreshStats();
}

function checkFilesMatch() {
    const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--sw-css-version').trim().replace(/["']/g, '');
    if (cssVersion === VERSION || typeof toastr === 'undefined') return;
    toastr.warning(`${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루 레몬에이드 업데이트 파일을 확인하고 새로고침해 주세요.`, TITLE, { timeOut: 15000 });
}

initSettings();
install();
window.StreamWatchdog = { stats, settings, STALL_NAME };

jQuery(() => {
    buildDrawer();
    setTimeout(checkFilesMatch, 3000);
});
