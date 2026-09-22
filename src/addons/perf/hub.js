// 성능 보조 2.0.0 — 설정 톱니바퀴 (hub.js)
//
// 끊김 감시 · 로딩 시간 · 성능 보조 · 요청 로그 · 저장 정리를 한 확장으로 합쳤다 (사용자: "카테고리가 성능 보조 라인이잖아? 하나로 합쳐").
// 예전엔 확장 서랍에 설정 칸이 다섯 줄이었다. 이제 확장 서랍 맨 위 버튼 줄(확장 순서 옆)의 톱니바퀴 하나를 누르면 뜨는 창의 탭으로 모았다.
// 각 기능은 자기 설정 칸을 예전처럼 만들되 pane(탭)에 넣는다. 창을 닫아도 칸은 문서 안 숨은 자리에 남겨 둬서
// 기능 쪽 코드가 자기 칸을 찾거나 고쳐 그리는 방식은 그대로다.
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { getSettings, saveSettings } from '../../settings.js';

export const SUITE_TITLE = '설정';
export const SUITE_VERSION = '2.1.0';
const BUTTON_ID = 'pa-hub-open';
const TAB_KEY = 'pa_hub_tab';

// 가나다순 (사용자가 부른 차례)
export const TABS = [
    { id: 'watchdog', title: '끊김 감시', icon: 'fa-heart-pulse' },
    { id: 'timer', title: '로딩 시간', icon: 'fa-stopwatch' },
    { id: 'perf', title: '성능 보조', icon: 'fa-gauge-high' },
    { id: 'log', title: '요청 로그', icon: 'fa-receipt' },
    { id: 'dedupe', title: '저장 정리', icon: 'fa-floppy-disk' },
];

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));

// 창이 닫혀 있는 동안 칸을 두는 숨은 자리
const holder = document.createElement('div');
holder.id = 'pa-hub-holder';
holder.hidden = true;
document.body.append(holder);

const root = document.createElement('div');
root.className = 'pa-hub';
root.innerHTML = `
    <h3 class="pa-hub-title"><i class="fa-solid fa-gear"></i> ${SUITE_TITLE} <span class="pa-hub-version ext-version">v${SUITE_VERSION}</span></h3>
    <div class="pa-hub-tabs" role="tablist">
        ${TABS.map(tab => `<button type="button" class="pa-hub-tab" role="tab" data-tab="${tab.id}" aria-selected="false"><i class="fa-solid ${tab.icon}"></i><span>${esc(tab.title)}</span></button>`).join('')}
    </div>
    <div class="pa-hub-panes">
        ${TABS.map(tab => `<div class="pa-hub-pane" role="tabpanel" data-tab="${tab.id}" hidden><label class="checkbox_label pa-hub-load"><input type="checkbox" data-load="${tab.id}"><span>이 도구 불러오기</span></label><div class="pa-hub-note" hidden></div></div>`).join('')}
    </div>`;
holder.append(root);

function savedTab() {
    try {
        const id = localStorage.getItem(TAB_KEY);
        return TABS.some(tab => tab.id === id) ? id : TABS[0].id;
    } catch {
        return TABS[0].id;
    }
}

function showTab(id) {
    for (const button of root.querySelectorAll('.pa-hub-tab')) {
        const on = button.dataset.tab === id;
        button.classList.toggle('active', on);
        button.setAttribute('aria-selected', String(on));
    }
    for (const pane of root.querySelectorAll('.pa-hub-pane')) pane.hidden = pane.dataset.tab !== id;
    try { localStorage.setItem(TAB_KEY, id); } catch { /* 저장 못 해도 이번엔 보임 */ }
}

root.querySelector('.pa-hub-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('.pa-hub-tab');
    if (button) showTab(button.dataset.tab);
});

/** 기능이 설정 칸을 넣을 자리 */
export function pane(id) {
    return root.querySelector(`.pa-hub-pane[data-tab="${id}"]`);
}

function note(id, html) {
    const box = pane(id)?.querySelector('.pa-hub-note');
    if (!box) return;
    box.innerHTML = html;
    box.hidden = false;
}

/** 옛 따로 확장이 아직 켜져 있어 이 기능을 쉬게 했을 때 */
export function markLegacy(id, folder) {
    const title = TABS.find(tab => tab.id === id)?.title ?? id;
    note(id, `<i class="fa-solid fa-circle-info"></i> 예전 <b>${esc(title)}</b> 확장(<code>${esc(folder)}</code>)이 아직 켜져 있어서 여기서는 쉬어요. 확장 관리에서 지우고 새로고침하면 이 탭으로 합쳐져요.`);
}

/** 사용자가 이 도구를 꺼 두어 아예 안 읽었을 때 */
export function markOff(id) {
    const title = TABS.find(tab => tab.id === id)?.title ?? id;
    note(id, `<i class="fa-solid fa-circle-info"></i> <b>${esc(title)}</b>을(를) 꺼 두어서 불러오지 않았어요. 위 '이 도구 불러오기'를 켜고 새로고침하면 다시 써요.`);
}

// 4.5.5: 도구마다 '불러오기' 스위치. 끄면 다음 새로고침부터 그 파일을 아예 안 읽는다
// (perfMenu 는 마법봉 메뉴에 보일지, 이것은 파일을 읽을지 — 다른 설정이다).
function syncLoadSwitches() {
    const on = getSettings().addonUI?.perfLoad ?? {};
    for (const box of root.querySelectorAll('[data-load]')) box.checked = on[box.dataset.load] !== false;
}
root.addEventListener('change', (event) => {
    const box = event.target.closest('[data-load]');
    if (!box) return;
    const s = getSettings();
    s.addonUI.perfLoad[box.dataset.load] = box.checked;
    saveSettings();
    const title = TABS.find(tab => tab.id === box.dataset.load)?.title ?? box.dataset.load;
    globalThis.toastr?.info(`${title}: 새로고침하면 적용돼요.`, 'Blue Lemonade');
});

/** 기능을 불러오다 실패했을 때 */
export function markBroken(id, error) {
    note(id, `<i class="fa-solid fa-triangle-exclamation"></i> 이 기능을 켜지 못했어요: ${esc(error?.message ?? error)}`);
}

// 4.5.3: 탭 내용은 허브가 처음 보일 때 만든다. 요청 로그의 설정 칸(panel.js 52KB)이
// 시작할 때 조건 없이 읽히고 있었는데, 허브를 안 열면 한 번도 보이지 않는 화면이다.
// 도구는 여기에 만드는 함수를 맡겨 두고, 허브가 열릴 때(팝업 · 설정 창 안 둘 다) 한 번만 불린다.
const builders = new Map();
const built = new Set();
export function onFirstShow(id, build) {
    if (built.has(id)) { build(); return; }   // 이미 한 번 보였으면 그 자리에서
    builders.set(id, build);
}
function runBuilders() {
    for (const [id, build] of builders) {
        builders.delete(id); built.add(id);
        try { build(); } catch (error) { console.error('[Blue Lemonade]', error); }
    }
}

let open = false;
async function openHub(tab) {
    runBuilders();
    syncLoadSwitches();
    if(inlineHost?.isConnected&&inlineHost.offsetParent){showTab(TABS.some(t=>t.id===tab)?tab:savedTab());root.scrollIntoView({block:'nearest'});return;}
    if (open) return;
    open = true;
    showTab(TABS.some(t=>t.id===tab)?tab:savedTab());
    try {
        await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') });
    } finally {
        (inlineHost?.isConnected?inlineHost:holder).replaceChildren(root); // 닫힌 창과 같이 사라지지 않게 숨은 자리로
        open = false;
    }
}

/** 확장 서랍 맨 위 버튼 줄, 확장 설치 단추 뒤에 톱니바퀴. 확장 순서(나중에 불러옴)도 같은 자리 바로 뒤에 붙어서 [확장 순서][설정] 차례가 된다 */
export function mountGear() {
    if (document.getElementById(BUTTON_ID)) return true;
    const anchor = document.getElementById('po-open') ?? document.getElementById('third_party_extension_button');
    if (!anchor?.parentElement) return false;
    const button = document.createElement('div');
    button.id = BUTTON_ID;
    button.className = 'menu_button pa-hub-open';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', SUITE_TITLE); // 마우스를 올렸을 때 뜨는 설명은 안 넣는다
    button.innerHTML = '<i class="fa-solid fa-gear"></i>';
    button.addEventListener('click', () => { openHub().catch(error => console.error('[성능 보조] 설정 창', error)); });
    button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openHub().catch(error => console.error('[성능 보조] 설정 창', error));
    });
    anchor.insertAdjacentElement('afterend', button);
    return true;
}

export { openHub };

let inlineHost=null;
export function mountInline(host) {
    runBuilders();
    syncLoadSwitches();
    showTab(savedTab());
    inlineHost=host;if(open)host.textContent='열린 설정창을 닫으면 여기에 표시돼요.';else host.replaceChildren(root);root.classList.add('bl-embedded-settings');
    const content=root.querySelector('.inline-drawer-content');if(content)content.style.display='block';
    return ()=>{if(inlineHost!==host)return;inlineHost=null;root.classList.remove('bl-embedded-settings');if(!open)holder.append(root);};
}
