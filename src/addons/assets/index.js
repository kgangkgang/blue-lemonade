// 캐릭터 에셋 — 캐릭터 그림(에셋)을 올려 두면 AI가 {{img::파일명}}으로 골라 쓰고, 채팅에 그림으로 나온다.
// 이전 '캐릭터 에셋 확장(character-assets)'을 새로 만든 확장. 그림은 같은 폴더(characters/<캐릭터>/)를 그대로 쓴다.
import { eventSource, event_types } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { MacrosParser } from '../../../../../../macros.js';
import { power_user } from '../../../../../../power-user.js';
import { initSettings, settings, saveSettings, VERSION, TITLE, currentFolder } from './state.js';
import { runtime, reload, expandedPrompt } from './store.js';
import { setupRenderer, schedulePass } from './render.js';
import { setupHold } from './hold.js';
import { toast, watchThemeVars, refreshThemeVars } from './ui.js';
import { badgeTextHit } from '../../badge-hit.js';

initSettings();

// 매크로: 프롬프트·카드·정규식 어디서든 쓴다. 이름은 이전 확장과 같아서 이미 넣어 둔 글이 그대로 통한다.
// 새 매크로 엔진이 켜져 있으면 새 등록 방식을, 아니면 예전 방식을 쓴다 (예전 방식은 경고를 찍지만 동작한다).
async function registerMacros() {
    let modern = null;
    if (power_user.experimental_macro_engine) {
        try {
            modern = (await import('../../../../../../macros/macro-system.js')).macros;
        } catch (error) {
            console.debug(`[${TITLE}] 새 매크로 엔진을 찾지 못해 예전 방식으로 등록해요.`, error);
        }
    }
    const register = (key, value, description) => {
        try {
            if (modern) modern.register(key, { category: 'extension', description, handler: () => value() });
            else MacrosParser.registerMacro(key, value, description);
        } catch (error) {
            console.error(`[${TITLE}] 매크로 등록 실패: ${key}`, error);
        }
    };
    register('img_inprompt', () => expandedPrompt(), '캐릭터 에셋: AI에게 주는 규칙 + 지금 캐릭터의 그림 목록');
    register('img_keywords_autogen', () => runtime.keywords, '캐릭터 에셋: 지금 캐릭터의 그림 이름 목록');
    register('img_keywords_grouped', () => runtime.keywords, '캐릭터 에셋: img_keywords_autogen과 같아요');
    register('img_keywords', () => runtime.keywords, '캐릭터 에셋: img_keywords_autogen과 같아요');
    register('charkey', () => currentFolder(), '캐릭터 에셋: 지금 캐릭터의 그림 폴더 이름');
}
registerMacros();

eventSource.on(event_types.CHAT_CHANGED, () => reload());

// 1.4.2: 이어서 쓰기는 마지막 메시지의 send_date 를 새로 찍고 다시 그린다 — 번호 묶음 그림이 시각으로 골라져서
// 이미 보이던 그림이 바뀌었다. 첫 시각을 extra.eh_seed 에 한 번만 남기고 render.js messageSeed 가 먼저 쓴다.
if (event_types.GENERATION_STARTED) eventSource.on(event_types.GENERATION_STARTED, (type, _options, dryRun) => {
    if (dryRun || !['continue', 'append', 'appendFinal'].includes(type)) return;
    if (!runtime.folder || !runtime.assets.length) return; // 그림이 없는 캐릭터의 채팅에는 씨앗을 남기지 않는다
    const chat = getContext().chat;
    const last = chat?.[chat.length - 1];
    if (!last?.extra || typeof last.extra !== 'object' || last.extra.eh_seed !== undefined) return;
    last.extra.eh_seed = last.send_date ?? String(chat.length - 1); // 지금 씨앗과 같은 값 (send_date ?? mesid)
});

// 메시지가 새로 그려지면 채팅을 다시 본다 (DOM 감시가 놓치는 경우의 보험)
for (const type of [
    event_types.CHARACTER_MESSAGE_RENDERED,
    event_types.USER_MESSAGE_RENDERED,
    event_types.MESSAGE_SWIPED,
    event_types.MESSAGE_UPDATED,
    event_types.MESSAGE_EDITED,
    event_types.MORE_MESSAGES_LOADED,
]) {
    if (type) eventSource.on(type, () => {
        schedulePass();
        // 다른 확장(번역·다시 쓰기 등)이 메시지를 뒤늦게 다시 그리면 우리가 바꿔 둔 그림이 지워진다.
        // DOM 감시가 그것까지 잡지만, 못 잡는 경우를 대비해 잠시 뒤 몇 번 더 확인한다.
        for (const delay of [400, 1200, 3000]) setTimeout(() => schedulePass(), delay);
    });
}

if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, () => refreshThemeVars());

// 1.4.1: 설정 칸(panel.js 66KB + 그것만 쓰는 viewer · shrink · image-format)은 확장 서랍이
// 처음 화면에 보일 때 읽는다. 접힌 목록에 보이는 건 머리줄뿐이라 그것만 먼저 만들어 둔다.
// 덤: hooks.onChanged(= renderAll)도 그때 걸려서, 창을 안 열면 채팅을 바꿔도 안 보이는 칸을 다시 그리지 않는다.
let panelPromise = null, ensurePanel = null, drawer = null;
function lazyPanel() {
    const container = document.getElementById('extensions_settings');
    if (!container) return;
    const stub = document.createElement('div');
    stub.className = 'eh-root';
    stub.dataset.ehStub = ''; // 머리줄만 있는 동안은 테마 색 계산(ui.js refreshThemeVars)에서 건너뛴다
    drawer = stub;
    stub.innerHTML = `<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header">`
        + `<b><i class="fa-solid fa-images"></i> ${TITLE} <button type="button" class="eh-version ext-version" aria-label="캐릭터 에셋 사용방법">v${VERSION}</button></b>`
        + `<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>`
        + `<div class="inline-drawer-content" style="display:none"></div></div>`;
    container.append(stub);
    stub.querySelector(".eh-version").onclick = async event => {
        if (!badgeTextHit(event)) return; // 5.3.7 글자 밖은 서랍 펴기로
        event.preventDefault(); event.stopPropagation();
        await ensurePanel?.();
        (await import("./panel.js")).showHelp();
    };

    const build = ensurePanel = () => {
        if (panelPromise) return panelPromise;
        observer.disconnect();
        document.removeEventListener('click', onClick, true);
        // 1.4.2: 폰에서 panel.js 가 비거나 잘려 오면 서랍이 빈 채로 말이 없었다. 같은 주소는 다시 읽어도 같은 결과라 알리기만 한다.
        panelPromise = import('./panel.js').then(mod => { delete stub.dataset.ehStub; return mod.buildPanel(stub); }).catch(error => {
            console.error(`[${TITLE}] 설정 화면 불러오기 실패`, error);
            const box = stub.querySelector('.inline-drawer-content');
            if (box) {
                const note = document.createElement('div');
                note.className = 'eh-body';
                note.textContent = '설정 화면을 불러오지 못했어요. 블루레몬에이드를 업데이트한 뒤 설치 점검을 실행해 주세요.';
                box.replaceChildren(note);
            }
            toast('error', '설정 화면을 불러오지 못했어요. 새로고침하거나 zip을 다시 풀어 주세요.');
        });
        return panelPromise;
    };
    // 들어오는 길이 여럿이라 셋 다 건다 — 확장 단추 · 머리줄 직접 누르기 · 그냥 화면에 보이기.
    // (보이기만으로는 부족하다: 탭이 숨어 있으면 IntersectionObserver 가 아예 안 돈다.)
    const onClick = (event) => {
        if (event.target.closest?.('#extensions-settings-button, .eh-root .inline-drawer-toggle')) build();
    };
    document.addEventListener('click', onClick, true);
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) build(); });
    observer.observe(stub);
}

export const ready = new Promise((resolve, reject) => jQuery(() => boot().then(resolve, reject)));
async function boot() {
    lazyPanel();
    watchThemeVars();
    setupRenderer();
    // 채팅 · 북마크 카드 · 메모에 나온 그림을 꾹 누르면(PC 는 오른쪽 클릭) 그 그림의 크게 보기 창을 연다
    setupHold();
    // 그림 목록 읽기(/api/sprites/get 여러 번)는 기다리지 않는다 — ready 를 붙잡으면 뒤 확장들이 다 늦어진다
    void reload().catch(error => console.error(`[${TITLE}] 그림 목록 읽기 실패`, error));

    // 처음 켤 때 이전 확장 설정을 가져왔으면 한 번 알려 준다.
    const store = settings();
    if (store.migratedFrom && !store.migrationNoticeShown) {
        store.migrationNoticeShown = true;
        saveSettings();
        const folders = Object.keys(store.disabled);
        const offCount = folders.reduce((sum, folder) => sum + store.disabled[folder].length, 0);
        const parts = ['규칙', '스위치'];
        if (offCount) parts.push(`꺼 둔 그림 ${offCount}장 (캐릭터 ${folders.length}명)`);
        toast('info', `이전 캐릭터 에셋 확장의 설정을 가져왔어요: ${parts.join(', ')}.`, { timeOut: 10000 });
    }

    // 폰 파일 앱은 압축을 풀 때 덮어쓰지 않고 'style (1).css'처럼 따로 저장해서 예전 파일이 남곤 한다.
    setTimeout(() => {
        const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--eh-css-version').trim().replace(/["']/g, '');
        if (cssVersion !== VERSION) {
            toastr.warning(`${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루레몬에이드를 업데이트한 뒤 설치 점검을 실행해 주세요.`, TITLE, { timeOut: 15000 });
        }
    }, 2000);

}


// One persistent settings drawer; returning it preserves controls and listeners.
let dialog = null;
export async function openPanel() {
    await ready;
    await ensurePanel?.();
    if (!drawer || dialog?.open) return;
    const previous = document.activeElement;
    const anchor = document.createComment('character assets settings');
    drawer.before(anchor);
    const content = drawer.querySelector('.inline-drawer-content');
    const display = content.style.display;
    content.style.display = 'block';
    dialog = document.createElement('dialog');
    dialog.className = 'bl-assets-dialog';
    dialog.setAttribute('aria-label', TITLE);
    dialog.innerHTML = '<header><b>캐릭터 에셋</b><button type="button" aria-label="캐릭터 에셋 닫기">×</button></header><div class="bl-assets-body"></div>';
    document.body.append(dialog);
    dialog.querySelector('.bl-assets-body').append(drawer);
    dialog.querySelector('header button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
        content.style.display = display;
        anchor.replaceWith(drawer);
        dialog.remove(); dialog = null;
        if (previous?.isConnected) previous.focus();
    }, {once:true});
    dialog.showModal();
}
export function mountInline(host) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'salty-btn'; button.textContent = '캐릭터 에셋 설정 열기';
    button.onclick = openPanel; host.replaceChildren(button);
    return () => host.replaceChildren();
}
