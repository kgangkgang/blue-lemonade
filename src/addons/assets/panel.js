// 캐릭터 에셋 — 확장 설정 서랍 안의 화면: 캐릭터 상태, 사용법, 그림 격자(올리기·찾기·선택), 설정
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { getThumbnailUrl } from '../../../../../../../script.js';
import { getContext } from '../../../../../../extensions.js';
import { settings, saveSettings, VERSION, TITLE, THUMB_SIZES, DEFAULT_PROMPT, isGroupChat, disabledSet, setDisabled, folderOf } from './state.js';
import { runtime, hooks, reload, recompute, groupsOf, sourceByKey, expandedPrompt } from './store.js';
import { isAllowedName, isZipName, uploadImage, uploadZip, deleteAsset, baseOf, sameBaseSiblings, fetchAssets } from './assets.js';
import { escapeHtml, toast, confirmDialog, inputDialog, pickDialog, copyText, applyThemeVars } from './ui.js';
import { BASE_ID, addPreset, checkRename, removePreset, movePreset, findPreset, presetLabel, presetsOf, linksOf, addLink, removeLink } from './presets.js';
import { openViewer } from './viewer.js';
import { redrawNow } from './render.js';
import { canShrink, estimateFolders, shrinkFolders, skipSummary } from './shrink.js';

const SIZE_LABELS = { s: '작게', m: '보통', l: '크게' };

const mbText = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`);

/**
 * [1.3.0] 그림 가볍게 만들기. 먼저 몇 장을 재서 얼마나 줄지 보여 주고, 승낙하면 한 장씩 WebP 로 바꾼다.
 * 올리기가 같은 이름의 옛 파일을 지우므로 교체까지 한 번에 끝난다.
 * 1.3.1: 이 캐릭터의 폴더 전부(원본 + 내 프리셋)를 함께 바꾼다. 한 폴더만 바꾸면 프리셋끼리 같은 이름이
 *        .png/.webp 로 갈라져 우선순위가 깨진다. 불러온 남의 폴더는 건드리지 않는다. 올리기·지우기와 겹치지 않게 막는다.
 */
async function runShrink() {
    if (notReady()) return;
    if (!runtime.folder) return toast('warning', isGroupChat() ? '그룹 채팅에서는 바꿀 수 없어요.' : '캐릭터를 먼저 열어 주세요.');
    if (!canShrink()) return toast('error', '이 브라우저는 WebP 로 저장하지 못해요.');
    const owner = runtime.folder;
    const folders = runtime.sources.filter(source => source.own).map(source => source.key);
    if (!folders.length) folders.push(owner);

    let ran = false;
    setBusy(true);
    try {
        const measuring = toast('info', '얼마나 줄어들지 재는 중…', { timeOut: 0, extendedTimeOut: 0 });
        let estimate;
        try {
            estimate = await estimateFolders(folders,({done,total})=>measuring?.find?.('.toast-message')?.text(`실제 변환 크기 확인 중 ${done}/${total}…`));
        } catch (error) {
            return toast('error', `재지 못했어요: ${error.message}`);
        } finally {
            toastr.clear(measuring);
        }
        if (!estimate.count) return toast('info', `이미지 ${estimate.total}장 확인: ${skipSummary(estimate.reasons)||'검사할 이미지가 없어요.'}`, {timeOut:15000});
        const saved = Math.max(0, estimate.bytes - estimate.estimated);
        // 남은 PNG 가 전부 '바꿔도 별로 안 줄어드는' 그림이면 매번 0KB 확인 창을 띄우지 않는다

        const where = folders.length > 1 ? ` (프리셋 포함 폴더 ${folders.length}개)` : '';
        const ok = await confirmDialog(
            `이 캐릭터의 이미지 ${estimate.count}장${where}을 WebP 로 바꿀까요?\n\n`
            + `지금 ${mbText(estimate.bytes)} → 대략 ${mbText(estimate.estimated)} (약 ${mbText(saved)} 줄어요)\n\n`
            + '그림 이름은 그대로라 예전 채팅에서도 똑같이 나와요. 꺼 둔 그림은 꺼진 채로 남아요.\n'
            + '작은 JPG도 검사하고, 실제로 더 작아진 정지 이미지만 바꿔요. 움직이는 그림은 보존해요.\n'
            + (skipSummary(estimate.reasons)?`그대로 둘 파일: ${skipSummary(estimate.reasons)}\n`:'')
            + '바뀐 그림의 원본 파일은 사라지니, 원본이 필요하면 먼저 내려받아 두세요.',
            { ok: '바꾸기', cancel: '그만두기' });
        if (!ok) return;
        if (runtime.folder !== owner) return toast('warning', '그 사이 캐릭터가 바뀌어서 그만뒀어요.');

        let cancelled = false;
        const progress = toast('info', '준비하는 중… (누르면 멈춰요)', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
        const message = () => progress?.find?.('.toast-message');
        progress?.on?.('click', () => {
            cancelled = true;
            message()?.text('지금 그림까지만 바꾸고 멈추는 중…');
        });
        let result;
        ran = true;
        try {
            result = await shrinkFolders(folders, ({ done, total, name, saved: got }) => {
                if (!cancelled) message()?.text(`그림 줄이는 중 ${done}/${total} · ${mbText(got)} 아낌 — ${name.slice(0, 24)} (누르면 멈춰요)`);
            }, { cancelled: () => cancelled });
        } catch (error) {
            return toast('error', `줄이지 못했어요: ${error.message}`);
        } finally {
            toastr.clear(progress);
        }

        const parts = [`${result.changed}장을 바꿔 ${mbText(result.before - result.after)} 아꼈어요`];
        if (result.skipped) parts.push(skipSummary(result.reasons));
        if (result.failed) parts.push(`${result.failed}장 실패`);
        if (result.cancelled) parts.push('중간에 멈췄어요');
        toast(result.failed ? 'warning' : 'success', parts.join(' · '), { timeOut: 10000 });
    } finally {
        setBusy(false);
        if (ran) await reload();
    }
}

let root = null;
const refs = {};
let selecting = false;
const selected = new Set();
let query = '';
let busy = false;
let promptTimer = null;
let lastFolder = null;
/** 격자에 보이는 폴더 키 ('캐릭터' = 원본, '캐릭터/프리셋', 불러온 것은 '다른캐릭터/프리셋') */
let activeKey = '';

function activeSource() {
    return sourceByKey(activeKey) ?? sourceByKey(runtime.folder) ?? null;
}

/** 지금 보는 폴더의 묶음 목록 */
function currentGroups() {
    return groupsOf(activeSource()?.key ?? '');
}

/** 올리기·지우기·옮기기가 되는 폴더인지 (불러온 남의 폴더는 보기만) */
function ownActive() {
    const source = activeSource();
    return source?.own ? source : null;
}

// ── 화면 뼈대 ─────────────────────────────────────────────────

function template() {
    const store = settings();
    return `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-images"></i> ${TITLE} <span class="eh-version ext-version">v${VERSION}</span></b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
        <div class="eh-body">

            <div class="eh-hero">
                <img class="eh-hero-avatar" alt="" hidden>
                <div class="eh-hero-text">
                    <b class="eh-hero-name"></b>
                    <small class="eh-hero-meta"></small>
                </div>
                <button type="button" class="eh-icon-btn" data-act="shrink" title="그림 가볍게 만들기" aria-label="그림 가볍게 만들기"><i class="fa-solid fa-compress"></i></button>
                <button type="button" class="eh-icon-btn" data-act="refresh" title="다시 불러오기" aria-label="다시 불러오기"><i class="fa-solid fa-arrows-rotate"></i></button>
                <button type="button" class="eh-icon-btn" data-act="redraw" title="채팅 다시 그리기" aria-label="채팅 다시 그리기"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
            </div>

            <section class="eh-card">
                <details class="eh-guide" ${store.guideOpen ? 'open' : ''}>
                    <summary><i class="fa-solid fa-book-open"></i><span>사용법</span><small>세 단계면 끝나요</small></summary>
                    <ol class="eh-steps">
                        <li>
                            <b>그림 올리기</b>
                            <p>아래 <b>이미지</b>·<b>ZIP</b> 버튼을 누르거나 그림을 격자에 끌어다 놓아요. 파일 이름이 곧 키워드예요. <code>Name_smile.png</code> → <code>Name_smile</code></p>
                        </li>
                        <li>
                            <b>프롬프트에 한 줄</b>
                            <p>프리셋·캐릭터 카드·작가 노트 어디든 <code>{{img_inprompt}}</code>를 넣으면, 아래 설정의 규칙과 지금 캐릭터의 그림 목록이 AI에게 전달돼요. 그림이 없거나 모두 꺼진 캐릭터(그룹 채팅 포함)에서는 아무것도 넣지 않아요. <button type="button" class="eh-chip" data-copy="{{img_inprompt}}"><i class="fa-solid fa-copy"></i>복사</button></p>
                        </li>
                        <li>
                            <b>프리셋 (선택)</b>
                            <p>격자 위의 <b>프리셋</b> 줄에서 폴더를 나눠요. 같은 이름의 그림을 <b>원본</b>과 <b>새 그림</b>에 따로 두고 켜고 끄면, 같은 태그로 둘을 번갈아 볼 수 있어요 (켜진 것 중 위의 폴더가 이겨요). NSFW처럼 따로 두고 싶은 그림도 폴더 하나로 껐다 켰다 해요. 같은 캐릭터의 다른 카드에서는 <b>불러오기</b>로 원래 카드의 폴더를 그대로 써요 — 그림은 한 군데에만 두고, 카드마다 켜고 끄기만 따로예요.</p>
                        </li>
                        <li>
                            <b>채팅에 그림</b>
                            <p>AI가 <code>{{img::Name_smile.png}}</code>라고 쓰면 그 자리에 그림이 나와요. 격자의 그림을 누르면 크게 보고, 끄기·이름 바꾸기·지우기를 할 수 있어요. <b>꺼진 그림</b>은 파일은 남지만 AI에게 알려 주지 않아요.</p>
                        </li>
                    </ol>
                    <div class="eh-macros">
                        <div><code>{{img_inprompt}}</code><span>규칙 + 그림 목록. 보통 이것만 넣으면 돼요.</span></div>
                        <div><code>{{img_keywords_autogen}}</code><span>그림 목록만. 규칙을 직접 쓸 때 써요.</span></div>
                        <div><code>{{charkey}}</code><span>캐릭터 폴더 이름. 정규식에서 <code>/characters/{{charkey}}/…</code>로 써요.</span></div>
                    </div>
                    <p class="eh-guide-note"><i class="fa-solid fa-circle-info"></i> 그림 파일은 <code>characters/캐릭터 이름/</code> 폴더에 그대로 있어요. 이전 캐릭터 에셋 확장으로 올린 그림도 그대로 보여요.</p>
                </details>
            </section>

            <section class="eh-card eh-card--assets">
                <div class="eh-presets">
                    <div class="eh-preset-chips" role="tablist" aria-label="프리셋"></div>
                    <div class="eh-preset-ctl" hidden></div>
                </div>
                <div class="eh-toolbar">
                    <button type="button" class="eh-btn eh-btn--primary" data-act="upload" title="PNG, JPG, WebP, GIF, BMP, AVIF 여러 장"><i class="fa-solid fa-plus"></i><span>이미지</span></button>
                    <button type="button" class="eh-btn" data-act="upload-zip" title="ZIP 안의 그림을 한꺼번에 (같은 이름은 덮어써요)"><i class="fa-solid fa-file-zipper"></i><span>ZIP</span></button>
                    <button type="button" class="eh-btn" data-act="select" aria-pressed="false" title="여러 장을 골라 한꺼번에 켜기·끄기·지우기"><i class="fa-solid fa-check-double"></i><span>선택</span></button>
                    <div class="eh-segmented" data-setting="thumbSize" role="radiogroup" aria-label="그림 크기">
                        ${THUMB_SIZES.map(size => `<button type="button" role="radio" data-value="${size}" aria-checked="${size === store.thumbSize}" class="${size === store.thumbSize ? 'is-active' : ''}" title="${SIZE_LABELS[size]}">${size.toUpperCase()}</button>`).join('')}
                    </div>
                </div>
                <label class="eh-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" placeholder="이름으로 찾기" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
                    <button type="button" class="eh-search-clear" data-act="search-clear" hidden aria-label="지우기"><i class="fa-solid fa-xmark"></i></button>
                </label>
                <div class="eh-grid-wrap">
                    <div class="eh-grid" data-size="${store.thumbSize}"></div>
                    <div class="eh-empty" hidden></div>
                    <div class="eh-drop-hint" aria-hidden="true"><i class="fa-solid fa-cloud-arrow-up"></i><span>여기에 놓으면 올라가요</span></div>
                </div>
                <div class="eh-selectbar" hidden>
                    <b class="eh-select-count"></b>
                    <div class="eh-selectbar-actions">
                        <button type="button" class="eh-btn eh-btn--small" data-act="select-all"><i class="fa-solid fa-list-check"></i><span class="eh-select-all-label">전체 선택</span></button>
                        <button type="button" class="eh-btn eh-btn--small" data-act="bulk-on"><i class="fa-solid fa-eye"></i><span>켜기</span></button>
                        <button type="button" class="eh-btn eh-btn--small" data-act="bulk-off"><i class="fa-solid fa-eye-slash"></i><span>끄기</span></button>
                        <button type="button" class="eh-btn eh-btn--small" data-act="bulk-move" title="고른 그림을 다른 프리셋 폴더로 옮겨요"><i class="fa-solid fa-folder-open"></i><span>옮기기</span></button>
                        <button type="button" class="eh-btn eh-btn--small eh-btn--danger" data-act="bulk-delete"><i class="fa-solid fa-trash"></i><span>지우기</span></button>
                        <button type="button" class="eh-btn eh-btn--small" data-act="select-done"><i class="fa-solid fa-xmark"></i><span>끝</span></button>
                    </div>
                </div>
                <input type="file" class="eh-file-input" data-input="images" multiple accept="image/*,.heic,.heif,.jxl,.tif,.tiff" hidden>
                <input type="file" class="eh-file-input" data-input="zip" accept=".zip,application/zip,application/x-zip-compressed" hidden>
            </section>

            <section class="eh-card">
                <h3 class="eh-card-title"><i class="fa-solid fa-sliders"></i>설정</h3>
                <div class="eh-setting">
                    <div class="eh-setting-text">
                        <b>채팅에 그림 표시</b>
                        <small>AI가 쓴 <code>{{img::…}}</code>를 그림으로 바꿔요. 정규식이 이미 그림을 그리고 있다면 꺼도 돼요. 정규식이 그린 그림의 이름·확장자 맞추기와 번호 묶음 고르기는 이 스위치와 상관없이 늘 돼요.</small>
                    </div>
                    <button type="button" class="eh-switch" role="switch" data-setting="renderEnabled" aria-checked="${store.renderEnabled}" aria-label="채팅에 그림 표시"><span></span></button>
                </div>
                <div class="eh-setting">
                    <div class="eh-setting-text">
                        <b>번호 묶음</b>
                        <small><code>Name_smile.png</code>, <code>Name_smile-1.png</code>처럼 번호만 다른 파일을 키워드 하나로 묶어요. AI에게는 하나만 알려 주고, 채팅에는 그중 하나를 골라 보여 줘요.</small>
                    </div>
                    <button type="button" class="eh-switch" role="switch" data-setting="randomGroups" aria-checked="${store.randomGroups}" aria-label="번호 묶음"><span></span></button>
                </div>
                <div class="eh-setting">
                    <div class="eh-setting-text">
                        <b>같은 그림은 한 번만</b>
                        <small>답변 하나 안에서 같은 그림을 두 번 부르면 두 번째부터는 그리지 않아요. 다음 답변에서는 다시 나와요. 번호 묶음이 있는 그림은 다른 버전이 나올 수 있으니 그대로 둬요.</small>
                    </div>
                    <button type="button" class="eh-switch" role="switch" data-setting="onceOnly" aria-checked="${store.onceOnly}" aria-label="같은 그림은 한 번만"><span></span></button>
                </div>
                <div class="eh-prompt">
                    <div class="eh-setting-text">
                        <b>AI에게 주는 규칙</b>
                        <small><code>{{img_inprompt}}</code> 자리에 들어가는 글이에요. 글 속의 <code>{{img_keywords_autogen}}</code>에 지금 캐릭터의 그림 이름이 채워져요.</small>
                    </div>
                    <textarea class="eh-textarea" rows="7" spellcheck="false"></textarea>
                    <div class="eh-actions">
                        <button type="button" class="eh-btn eh-btn--small" data-act="prompt-reset"><i class="fa-solid fa-rotate-left"></i><span>기본값</span></button>
                        <button type="button" class="eh-btn eh-btn--small" data-act="prompt-copy" title="그림 이름까지 채운 글을 복사해요"><i class="fa-solid fa-copy"></i><span>완성본 복사</span></button>
                    </div>
                </div>
            </section>

            <p class="eh-version-foot">${TITLE} ${VERSION}</p>
        </div>
        </div>
    </div>`;
}

export function buildPanel(stub) {
    const container = document.getElementById('extensions_settings');
    if (!container || root) return;
    if (stub && stub.isConnected) {
        // 1.4.1: 시작할 때 index.js 가 머리줄만 있는 자리를 만들어 둔다. 머리줄 요소는 그대로 두고
        // 속만 채운다 — 통째로 갈아끼우면 실리태번이 방금 그 머리줄에 건 펼치기가 버려진 자리에 남는다.
        const parsed = document.createElement('div');
        parsed.innerHTML = template();
        root = stub;
        root.id = 'char_assets_settings';
        root.className = 'eh-root';
        applyThemeVars(root);
        root.querySelector('.inline-drawer-content').replaceChildren(...parsed.querySelector('.inline-drawer-content').childNodes);
    } else {
        root = document.createElement('div');
        root.id = 'char_assets_settings';
        root.className = 'eh-root';
        applyThemeVars(root);
        root.innerHTML = template();
        container.append(root);
    }

    refs.avatar = root.querySelector('.eh-hero-avatar');
    refs.name = root.querySelector('.eh-hero-name');
    refs.meta = root.querySelector('.eh-hero-meta');
    refs.grid = root.querySelector('.eh-grid');
    refs.gridWrap = root.querySelector('.eh-grid-wrap');
    refs.empty = root.querySelector('.eh-empty');
    refs.search = root.querySelector('.eh-search input');
    refs.searchClear = root.querySelector('.eh-search-clear');
    refs.selectBtn = root.querySelector('[data-act="select"]');
    refs.selectBar = root.querySelector('.eh-selectbar');
    refs.selectCount = root.querySelector('.eh-select-count');
    refs.selectAllLabel = root.querySelector('.eh-select-all-label');
    refs.presetChips = root.querySelector('.eh-preset-chips');
    refs.presetCtl = root.querySelector('.eh-preset-ctl');
    refs.prompt = root.querySelector('.eh-textarea');
    refs.inputImages = root.querySelector('[data-input="images"]');
    refs.inputZip = root.querySelector('[data-input="zip"]');
    refs.prompt.value = settings().prompt;

    bind();
    hooks.onChanged = () => renderAll();
    renderAll();
}

// ── 그리기 ────────────────────────────────────────────────────

function renderAll() {
    if (runtime.folder !== lastFolder) {
        // 캐릭터가 바뀌면 선택 모드와 고른 것을 비우고 원본 폴더부터 보여 준다 (묶음 이름은 폴더마다 다르다)
        lastFolder = runtime.folder;
        selecting = false;
        selected.clear();
        activeKey = runtime.folder;
    }
    // 보던 프리셋이 지워졌으면 원본으로 (읽는 중에는 목록이 아직 옛것이라 판단하지 않는다 — 방금 만든 프리셋을 잃는다)
    if (!runtime.loading && !sourceByKey(activeKey)) activeKey = runtime.folder;
    renderHero();
    renderPresets();
    renderGrid();
}

// ── 프리셋 줄 ─────────────────────────────────────────────────

function renderPresets() {
    const sources = runtime.sources;
    if (!runtime.folder || (!sources.length && runtime.loading)) {
        refs.presetChips.innerHTML = '';
        refs.presetCtl.hidden = true;
        return;
    }
    const chips = sources.map((source) => {
        const classes = ['eh-pchip'];
        if (source.key === activeKey) classes.push('is-active');
        if (!source.preset.enabled) classes.push('is-off');
        if (!source.own) classes.push('is-linked');
        const label = source.own ? source.label : `${source.owner} · ${source.label}`;
        const title = source.own
            ? `${source.label} · 그림 ${source.assets.length}장${source.preset.enabled ? '' : ' · 꺼짐'}`
            : `${source.owner}의 '${source.label}' 폴더를 불러왔어요 · 그림 ${source.assets.length}장${source.preset.enabled ? '' : ' · 꺼짐'} (올리기는 그 캐릭터에서)`;
        return `<button type="button" class="${classes.join(' ')}" role="tab" aria-selected="${source.key === activeKey}" data-preset="${escapeHtml(source.key)}" title="${escapeHtml(title)}">
            <i class="fa-solid ${source.own ? (source.preset.name ? 'fa-folder' : 'fa-house') : 'fa-link'}"></i><span>${escapeHtml(label)}</span><small>${source.assets.length}</small>
        </button>`;
    });
    chips.push('<button type="button" class="eh-pchip eh-pchip--add" data-act="preset-add" title="새 프리셋 폴더"><i class="fa-solid fa-plus"></i><span>프리셋</span></button>');
    chips.push('<button type="button" class="eh-pchip eh-pchip--add" data-act="link-add" title="다른 캐릭터의 폴더를 이 카드에서도 쓰기 (같은 캐릭터의 다른 카드일 때)"><i class="fa-solid fa-link"></i><span>불러오기</span></button>');
    refs.presetChips.innerHTML = chips.join('');

    const source = activeSource();
    if (!source || sources.length <= 1 && source.own && !source.preset.name) {
        // 원본 하나뿐이면 조작 줄은 숨긴다 (프리셋을 만들면 나타난다)
        refs.presetCtl.hidden = true;
        return;
    }
    refs.presetCtl.hidden = false;
    if (!source.own) {
        refs.presetCtl.innerHTML = `
        <label class="eh-preset-switch"><span>켜짐</span><button type="button" class="eh-switch eh-switch--small" role="switch" data-pset="enabled" aria-checked="${source.preset.enabled}" aria-label="불러온 폴더 켜짐"><span></span></button></label>
        <small class="eh-preset-note"><i class="fa-solid fa-link"></i> ${escapeHtml(source.owner)}의 폴더예요. 그림을 올리거나 지우는 건 그 캐릭터에서 해요.</small>
        <span class="eh-preset-spacer"></span>
        <button type="button" class="eh-icon-btn eh-icon-btn--danger" data-act="link-remove" title="이 카드에서 빼요 (그림은 그대로 남아요)"><i class="fa-solid fa-link-slash"></i></button>`;
        return;
    }
    const isBase = source.preset.id === BASE_ID;
    const at = sources.findIndex(item => item.key === source.key);
    const ownCount = sources.filter(item => item.own).length;
    refs.presetCtl.innerHTML = `
        <label class="eh-preset-switch"><span>켜짐</span><button type="button" class="eh-switch eh-switch--small" role="switch" data-pset="enabled" aria-checked="${source.preset.enabled}" aria-label="프리셋 켜짐"><span></span></button></label>
        <span class="eh-preset-spacer"></span>
        <button type="button" class="eh-icon-btn" data-act="preset-up" title="위로 (위에 있는 폴더가 같은 이름의 그림에서 이겨요)" ${at <= 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
        <button type="button" class="eh-icon-btn" data-act="preset-down" title="아래로" ${at >= ownCount - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
        ${isBase ? '' : '<button type="button" class="eh-icon-btn eh-icon-btn--danger" data-act="preset-delete" title="프리셋과 안의 그림을 모두 지워요"><i class="fa-solid fa-trash"></i></button>'}`;
}

/** 켜짐 스위치. 내 프리셋이면 프리셋 값을, 불러온 폴더면 이 카드의 링크 값을 바꾼다 (주인 쪽은 그대로). */
function setPresetEnabled(value) {
    const source = activeSource();
    if (!source) return;
    if (source.own) {
        const preset = findPreset(settings(), runtime.folder, source.preset.id);
        if (!preset) return;
        preset.enabled = value;
    } else {
        const link = linksOf(settings(), runtime.folder).find(item => item.owner === source.owner && item.presetId === source.preset.id);
        if (!link) return;
        link.enabled = value;
    }
    saveSettings();
    recompute();
    toast('success', `'${source.label}' 폴더를 ${value ? '켰어요.' : '껐어요. AI 목록에서 빠지고, 같은 이름은 다른 폴더 그림이 나와요.'}`);
}

/** 다른 캐릭터의 폴더(원본 또는 프리셋)를 이 카드에서도 쓰기: 캐릭터 고르기 → 폴더 고르기 */
async function linkAddFlow() {
    if (notReady() || !runtime.folder) return;
    const store = settings();
    const linked = linksOf(store, runtime.folder);
    const context = getContext();
    const owners = (context.characters ?? [])
        .map(character => ({ folder: folderOf(character), name: character?.name || '' }))
        .filter(item => item.folder && item.folder !== runtime.folder)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (!owners.length) {
        toast('info', '불러올 다른 캐릭터가 없어요.');
        return;
    }
    const owner = await pickDialog('어느 캐릭터의 그림 폴더를 이 카드에서도 쓸까요?\n(같은 캐릭터의 다른 카드일 때 써요. 그림은 그 캐릭터에 그대로 두고 여기서 읽기만 해요.)',
        owners.map(item => ({ value: item.folder, label: item.name === item.folder ? item.name : `${item.name} (${item.folder})` })), { ok: '다음' });
    if (owner === null) return;
    // 그 캐릭터의 폴더 목록 (설정을 만들지 않도록 살짝만 본다)
    const known = Array.isArray(store.presets[owner]) ? presetsOf(store, owner) : [{ id: BASE_ID, name: '', enabled: true }];
    const choices = known.filter(preset => !linked.some(item => item.owner === owner && item.presetId === preset.id));
    if (!choices.length) {
        toast('info', '그 캐릭터의 폴더는 이미 다 불러왔어요.');
        return;
    }
    let picked = choices;
    if (choices.length > 1) {
        const options = [{ value: '*', label: `모든 폴더 (${choices.map(presetLabel).join(', ')})` }, ...choices.map(preset => ({ value: preset.id, label: presetLabel(preset) }))];
        const presetId = await pickDialog(`'${owner}'의 어느 폴더를 쓸까요?`, options, { ok: '불러오기', value: '*' });
        if (presetId === null) return;
        if (presetId !== '*') picked = choices.filter(preset => preset.id === presetId);
    }
    for (const preset of picked) addLink(store, runtime.folder, owner, preset.id);
    saveSettings();
    const first = picked[0];
    activeKey = first.name ? `${owner}/${first.name}` : owner;
    await reload();
    toast('success', picked.length > 1
        ? `'${owner}'의 폴더 ${picked.length}개를 불러왔어요. 이 카드에서 켜고 끄기는 따로예요.`
        : `'${owner}'의 '${presetLabel(first)}' 폴더를 불러왔어요. 이 카드에서 켜고 끄기는 따로예요.`);
}

function linkRemoveFlow() {
    const source = activeSource();
    if (!source || source.own) return;
    if (!removeLink(settings(), runtime.folder, source.owner, source.preset.id)) return;
    saveSettings();
    activeKey = runtime.folder;
    recompute();
    toast('success', `'${source.owner}'의 '${source.label}' 폴더를 이 카드에서 뺐어요. 그림은 그대로 있어요.`);
}

async function addPresetFlow() {
    if (notReady() || !runtime.folder) return;
    const name = await inputDialog('새 프리셋 폴더 이름\n(예: 새 그림, NSFW)', '', { ok: '만들기' });
    if (name === null) return;
    let preset;
    try {
        preset = addPreset(settings(), runtime.folder, name);
    } catch (error) {
        toast('warning', error.message);
        return;
    }
    saveSettings();
    activeKey = `${runtime.folder}/${preset.name}`;
    await reload();
    toast('success', `'${preset.name}' 프리셋을 만들었어요. 이제 올리는 그림은 여기로 들어가요.`);
}

/**
 * 1.4.0: 프리셋 이름 바꾸기 (칩을 꾹 누르면). 서버에 폴더 이름 바꾸기가 없어서 새 폴더에 전부 올린 다음에야 옛 파일을 지운다.
 * 하나라도 못 올리면 올린 것을 치우고 그만둔다 — 어느 때에도 그림이 한 군데에는 온전히 남는다.
 */
async function renamePresetFlow(key) {
    if (notReady() || !runtime.folder) return;
    const source = sourceByKey(key);
    if (!source) return;
    if (!source.own) { toast('info', '불러온 폴더의 이름은 그 캐릭터에서 바꿔 주세요.'); return; }
    if (source.preset.id === BASE_ID) { toast('info', "'원본'은 캐릭터 폴더 자체라 이름을 바꿀 수 없어요."); return; }
    if (source.error) { toast('warning', '이 프리셋의 목록을 못 읽었어요. 새로고침을 먼저 눌러 주세요.'); return; }
    const typed = await inputDialog('프리셋 이름 바꾸기', source.preset.name, { ok: '바꾸기' });
    if (typed === null) return;
    let name;
    try {
        name = checkRename(settings(), runtime.folder, source.preset.id, typed);
    } catch (error) {
        toast('warning', error.message);
        return;
    }
    // 1.4.2: 마지막 목록 대신 옮기기 직전에 다시 읽은 목록으로 옮긴다. 읽기 실패로 빈 목록이면 0장을 옮기고
    // 바꿨다고 해서 그림이 옛 폴더에 남았다. 읽는 동안 다른 올리기가 끼지 않게 먼저 바쁨으로 둔다.
    const oldKey = source.key, newKey = `${runtime.folder}/${name}`, oldName = source.preset.name;
    if (notReady()) return;
    setBusy(true);
    let members = null;
    try {
        members = await fetchAssets(oldKey);
    } catch (error) {
        console.error('[캐릭터 에셋] 프리셋 이름 바꾸기: 목록 읽기 실패', oldKey, error);
    }
    const stop = (message) => { setBusy(false); toast('warning', message, { timeOut: 10000 }); };
    if (!members) { stop('목록을 다시 읽지 못해서 이름을 바꾸지 않았어요.'); return; }
    if (!members.length && source.assets.length) { stop('목록이 비어 보여서 이름을 바꾸지 않았어요. 새로고침을 먼저 눌러 주세요.'); return; }
    // 확장자만 다른 같은 이름(이름.png + 이름.jpg)은 서버가 올릴 때 서로 지운다 — 옮기는 길이 없으니 먼저 정리하게 한다
    const twins = members.filter(asset => sameBaseSiblings(members, asset).length).map(asset => asset.file);
    if (twins.length) {
        stop(`확장자만 다른 같은 이름의 그림이 있어서 바꾸지 않았어요: ${twins.slice(0, 3).join(', ')}. 하나를 먼저 이름을 바꾸거나 지워 주세요.`);
        return;
    }
    const copied = [];
    let failed = '';
    try {
        for (const asset of members) {
            try {
                const response = await fetch(asset.url, { cache: 'no-cache' });
                if (!response.ok) throw new Error('원본 파일을 읽지 못했어요.');
                const blob = await response.blob();
                await uploadImage(newKey, new File([blob], asset.file, { type: blob.type || 'application/octet-stream' }), asset.base);
                copied.push(asset.base);
            } catch (error) {
                console.error('[캐릭터 에셋] 프리셋 이름 바꾸기: 옮기기 실패', asset.file, error);
                failed = asset.file;
                break;
            }
        }
        if (failed) {
            for (const base of copied) { try { await deleteAsset(newKey, base); } catch { /* 새 폴더의 남은 사본 — 그림은 옛 폴더에 그대로 있다 */ } }
        } else {
            const left = [];
            for (const asset of members) { try { await deleteAsset(oldKey, asset.base); } catch (error) { console.error('[캐릭터 에셋] 옛 폴더 지우기 실패', asset.file, error); left.push(asset.file); } }
            const store = settings();
            source.preset.name = name;
            if (store.disabled[oldKey]) { store.disabled[newKey] = store.disabled[oldKey]; delete store.disabled[oldKey]; }
            const record = store.optimizedImages;
            if (record && typeof record === 'object' && !Array.isArray(record)) {
                for (const asset of members) {
                    const from = JSON.stringify([oldKey, asset.file]);
                    if (from in record) { record[JSON.stringify([newKey, asset.file])] = record[from]; delete record[from]; }
                }
            }
            saveSettings();
            if (activeKey === oldKey) activeKey = newKey;
            if (left.length) toast('warning', `옛 폴더에 ${left.length}장이 남았어요 (새 폴더에는 다 있어요): ${left.slice(0, 3).join(', ')}`, { timeOut: 10000 });
        }
    } finally {
        setBusy(false);
    }
    selected.clear();
    await reload();
    if (failed) toast('error', `'${failed}'을(를) 옮기지 못해서 이름을 바꾸지 않았어요. 그림은 그대로예요.`);
    else toast('success', `'${oldName}' → '${name}'`);
}

// 1.4.0: 프리셋 칩을 꾹 누르면(0.55초) 이름 바꾸기. PC 에서는 오른쪽 클릭도 된다.
// 칩은 그릴 때마다 새로 만들어지니 패널 뿌리에서 받는다. 꾹 누른 뒤 손을 뗄 때 생기는 click 은 한 번 삼킨다(칩이 눌린 것으로 치지 않게).
let chipHoldFired = 0;
function bindChipHold(root) {
    let timer = 0, startX = 0, startY = 0, key = '';
    const cancel = () => { clearTimeout(timer); timer = 0; };
    const fire = () => { timer = 0; chipHoldFired = Date.now(); renamePresetFlow(key); };
    root.addEventListener('pointerdown', (event) => {
        cancel();
        const chip = event.target.closest?.('.eh-pchip[data-preset]');
        if (!chip || (event.pointerType === 'mouse' && event.button !== 0)) return;
        key = chip.dataset.preset; startX = event.clientX; startY = event.clientY;
        timer = setTimeout(fire, 550);
    });
    root.addEventListener('pointermove', (event) => { if (timer && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel(); });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) root.addEventListener(type, cancel);
    root.addEventListener('contextmenu', (event) => {
        const chip = event.target.closest?.('.eh-pchip[data-preset]');
        if (!chip) return;
        event.preventDefault(); // 폰의 길게 누르기 메뉴 · PC 의 오른쪽 클릭 메뉴 대신
        cancel();
        if (Date.now() - chipHoldFired < 1500) return; // 꾹 누르기가 이미 창을 열었다
        chipHoldFired = Date.now();
        renamePresetFlow(chip.dataset.preset);
    });
}

async function deletePresetFlow() {
    if (notReady()) return;
    const source = ownActive();
    if (!source || source.preset.id === BASE_ID) return;
    const count = source.assets.length;
    const ok = await confirmDialog(`'${source.label}' 프리셋을 지울까요?${count ? `\n안의 그림 ${count}장이 함께 지워지고 되돌릴 수 없어요.` : ''}`, { ok: '지우기' });
    if (!ok) return;
    const folder = source.key;
    setBusy(true);
    const failed = [];
    try {
        for (const base of new Set(source.assets.map(asset => asset.base))) {
            try {
                await deleteAsset(folder, base);
            } catch (error) {
                console.error('[캐릭터 에셋] 프리셋 그림 지우기 실패', base, error);
                failed.push(base);
            }
        }
    } finally {
        setBusy(false);
    }
    if (failed.length) {
        toast('error', `${failed.length}장을 지우지 못해서 프리셋은 남겨 뒀어요: ${failed.slice(0, 3).join(', ')}`);
        await reload();
        return;
    }
    removePreset(settings(), runtime.folder, source.preset.id);
    delete settings().disabled[folder];
    saveSettings();
    activeKey = runtime.folder;
    await reload();
    toast('success', `'${source.label}' 프리셋을 지웠어요.`);
}

function renderHero() {
    const character = runtime.character;
    if (!character) {
        refs.avatar.hidden = true;
        refs.name.textContent = isGroupChat() ? '그룹 채팅' : '캐릭터가 없어요';
        refs.meta.textContent = isGroupChat() ? '그룹 채팅에서는 그림을 관리할 수 없어요. 캐릭터를 하나 열어 주세요.' : '캐릭터를 열면 그 캐릭터의 그림이 여기 보여요.';
        return;
    }
    refs.avatar.hidden = false;
    refs.avatar.src = getThumbnailUrl('avatar', character.avatar);
    refs.name.textContent = character.name || runtime.folder;
    if (runtime.loading) {
        refs.meta.textContent = '불러오는 중…';
        return;
    }
    if (runtime.error) {
        refs.meta.textContent = `목록을 읽지 못했어요: ${runtime.error}`;
        return;
    }
    const ownSources = runtime.sources.filter(source => source.own);
    const total = ownSources.reduce((sum, source) => sum + source.assets.length, 0);
    const off = ownSources.reduce((sum, source) => {
        const set = disabledSet(source.key);
        return sum + source.assets.filter(asset => set.has(asset.file)).length; // 목록에 남은 옛 이름은 세지 않는다
    }, 0);
    const parts = [`그림 ${total}장`];
    // 캐릭터마다 한 줄인 목록은 맨 앞에 '(one line per character…)' 안내 줄이 있어서 그 줄은 세지 않는다 (1.3.2: 1개 더 세었다)
    if (runtime.keywords) parts.push(`AI 목록 ${runtime.keywords.split(/[,\n]/).filter(part => part.trim() && !part.startsWith('(one line per character')).length}개`);
    if (ownSources.length > 1) parts.push(`프리셋 ${ownSources.length}개`);
    const linked = runtime.sources.length - ownSources.length;
    if (linked) parts.push(`불러온 폴더 ${linked}개`);
    if (off) parts.push(`꺼짐 ${off}장`);
    refs.meta.textContent = parts.join(' · ');
}

function matchesQuery(group) {
    if (!query) return true;
    if (group.label.toLowerCase().includes(query)) return true;
    return group.members.some(asset => asset.file.toLowerCase().includes(query));
}

function visibleGroups() {
    return currentGroups().filter(matchesQuery);
}

function tileHtml(group) {
    const off = group.onCount === 0;
    const partial = !off && group.onCount < group.members.length;
    const shown = group.exact ?? group.members.find(asset => !disabledSet(asset.folder).has(asset.file)) ?? group.members[0];
    const classes = ['eh-tile'];
    if (off) classes.push('is-off');
    if (partial) classes.push('is-partial');
    if (selecting && selected.has(group.key)) classes.push('is-selected');
    const title = group.members.length > 1
        ? `${group.label} (${group.members.length}장${off ? ', 꺼짐' : partial ? `, ${group.onCount}장 켜짐` : ''})`
        : `${shown.file}${off ? ' (꺼짐)' : ''}`;
    return `
        <div class="${classes.join(' ')}" data-key="${escapeHtml(group.key)}" role="button" tabindex="0" title="${escapeHtml(title)}">
            <div class="eh-tile-img"><img src="${escapeHtml(shown.url)}" alt="" loading="lazy" decoding="async"></div>
            <div class="eh-tile-name">${escapeHtml(group.label)}</div>
            ${group.members.length > 1 ? `<span class="eh-tile-badge">${partial ? `${group.onCount}/` : ''}${group.members.length}</span>` : ''}
            ${off ? '<span class="eh-tile-off"><i class="fa-solid fa-eye-slash"></i></span>' : ''}
            <span class="eh-tile-check"><i class="fa-solid fa-check"></i></span>
        </div>`;
}

function renderGrid() {
    refs.grid.classList.toggle('is-selecting', selecting);
    if (!runtime.folder) {
        refs.grid.innerHTML = '';
        showEmpty(isGroupChat() ? '그룹 채팅은 지원하지 않아요.' : '캐릭터를 열어 주세요.', false);
        return;
    }
    const source = activeSource();
    if (runtime.loading && !source?.assets.length) {
        refs.grid.innerHTML = '';
        showEmpty('불러오는 중…', false);
        return;
    }
    if (!source?.assets.length) {
        refs.grid.innerHTML = '';
        const error = source?.error || runtime.error;
        showEmpty(error ? `목록을 읽지 못했어요: ${error}` : (source && source.preset.name ? `'${source.label}' 프리셋이 비어 있어요. 이미지나 ZIP을 올리거나 여기에 끌어다 놓으면 이 폴더로 들어가요.` : '아직 그림이 없어요. 이미지나 ZIP을 올리거나 여기에 끌어다 놓으세요.'), !error);
        return;
    }
    const groups = visibleGroups();
    if (!groups.length) {
        refs.grid.innerHTML = '';
        showEmpty(`'${query}'에 맞는 그림이 없어요.`, false);
        return;
    }
    refs.empty.hidden = true;
    refs.grid.innerHTML = groups.map(tileHtml).join('');
    updateSelectBar();
}

function showEmpty(text, big) {
    refs.empty.hidden = false;
    refs.empty.classList.toggle('is-big', big);
    refs.empty.innerHTML = `${big ? '<i class="fa-solid fa-images"></i>' : ''}<span>${escapeHtml(text)}</span>`;
    updateSelectBar();
}

function updateSelectBar() {
    refs.selectBar.hidden = !selecting;
    refs.selectBtn.setAttribute('aria-pressed', String(selecting));
    if (!selecting) return;
    const all = currentGroups();
    const groups = all.filter(group => selected.has(group.key));
    const files = groups.reduce((sum, group) => sum + group.members.length, 0);
    refs.selectCount.textContent = groups.length ? `${groups.length}개 선택 (그림 ${files}장)` : '그림을 눌러 고르세요';
    const visible = visibleGroups();
    refs.selectAllLabel.textContent = visible.length && visible.every(group => selected.has(group.key)) ? '선택 해제' : '전체 선택';
}

function setSelecting(next) {
    selecting = next;
    selected.clear();
    renderGrid();
}

/** 목록을 읽는 중이거나 다른 작업 중이면 true (그 사이에는 파일을 건드리지 않는다) */
function notReady() {
    if (busy) {
        toast('info', '아직 올리는 중이에요. 잠시만요.');
        return true;
    }
    if (runtime.loading) {
        toast('info', '목록을 불러오는 중이에요. 잠시만요.');
        return true;
    }
    return false;
}

// ── 올리기 ────────────────────────────────────────────────────

function setBusy(next) {
    busy = next;
    root.classList.toggle('is-busy', next);
}

async function handleFiles(fileList) {
    if (notReady()) return;
    if (!runtime.folder) {
        toast('warning', isGroupChat() ? '그룹 채팅에서는 올릴 수 없어요.' : '먼저 캐릭터를 열어 주세요.');
        return;
    }
    const target = ownActive();
    if (!target) {
        toast('warning', '불러온 폴더에는 여기서 올릴 수 없어요. 원본이나 내 프리셋을 고른 뒤 올려 주세요.');
        return;
    }
    // 지금 보고 있는 프리셋 폴더로 들어간다 ('캐릭터' 또는 '캐릭터/프리셋')
    const folder = target.key;
    const files = [...fileList];
    const images = files.filter(file => isAllowedName(file.name));
    const zips = files.filter(file => isZipName(file.name));
    const skipped = files.length - images.length - zips.length;
    if (!images.length && !zips.length) {
        toast('warning', 'PNG, JPG, WebP, GIF, BMP, AVIF 그림이나 ZIP만 올릴 수 있어요.');
        return;
    }

    const inFolder = () => sourceByKey(folder)?.assets ?? [];
    if (images.length) {
        // 서버는 확장자가 달라도 이름이 같으면 덮어쓴다 (같은 폴더 안에서만)
        // 1.3.2: 이름마다 파일 전부를 센다. 확장자만 다른 같은 이름(이름.png + 이름.jpg)이 있으면 서버는 둘 다 지우는데,
        //        예전에는 하나만 적어서 나머지가 말없이 지워졌다.
        const existing = new Map();
        for (const asset of inFolder()) {
            const key = asset.base.toLowerCase();
            existing.set(key, [...(existing.get(key) ?? []), asset.file]);
        }
        const dupes = [...new Set(images.flatMap(file => existing.get(baseOf(file.name).toLowerCase()) ?? []))];
        if (dupes.length) {
            const preview = dupes.slice(0, 5).join(', ') + (dupes.length > 5 ? ` 외 ${dupes.length - 5}장` : '');
            const ok = await confirmDialog(`같은 이름의 그림 ${dupes.length}장을 덮어써요:\n${preview}\n\n계속할까요?`, { ok: '덮어쓰기' });
            if (!ok) return;
        }
    }
    if (zips.length && inFolder().length) {
        // ZIP 안은 미리 볼 수 없어서 한 번 물어본다
        const ok = await confirmDialog(`ZIP ${zips.length}개 안의 그림을 모두 올려요.\n같은 이름의 그림이 이미 있으면 묻지 않고 덮어써요.\n\n계속할까요?`, { ok: '올리기' });
        if (!ok) return;
    }
    if (!sourceByKey(folder)) return; // 확인창을 띄운 사이 캐릭터가 바뀜

    setBusy(true);
    const total = images.length + zips.length;
    const before = inFolder().length;
    let done = 0;
    let zipCount = 0;
    let zipFailed = 0;
    const failed = [];
    const progress = toast('info', `올리는 중… 0 / ${total}`, { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    const tick = () => {
        done++;
        progress?.find?.('.toast-message').text(`올리는 중… ${done} / ${total}`);
    };

    try {
        // 서버가 파일을 하나씩 받으니 동시에 3장까지만 보낸다.
        const queue = [...images];
        const worker = async () => {
            while (queue.length) {
                const file = queue.shift();
                try {
                    await uploadImage(folder, file);
                } catch (error) {
                    console.error('[캐릭터 에셋] 올리기 실패', file.name, error);
                    failed.push(`${file.name} (${error?.message ?? '오류'})`);
                }
                tick();
            }
        };
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));

        for (const zip of zips) {
            try {
                zipCount += await uploadZip(folder, zip);
            } catch (error) {
                console.error('[캐릭터 에셋] ZIP 올리기 실패', zip.name, error);
                zipFailed++;
                failed.push(`${zip.name} (${error?.message ?? '오류'})`);
            }
            tick();
        }
    } finally {
        if (progress && typeof toastr !== 'undefined') toastr.clear(progress);
        setBusy(false);
    }

    await reload();

    const okImages = images.length - (failed.length - zipFailed);
    const summary = [];
    if (okImages > 0) summary.push(`그림 ${okImages}장`);
    if (zipCount > 0) summary.push(`ZIP에서 ${zipCount}장`);
    const overwrote = zipCount > 0 && sourceByKey(folder) && inFolder().length - before < zipCount;
    if (summary.length) toast('success', `${summary.join(', ')} 올렸어요.${overwrote ? ' (같은 이름은 덮어썼어요)' : ''}`);
    if (zips.length && zipCount === 0 && !zipFailed) toast('warning', 'ZIP 안에 올릴 수 있는 그림이 없었어요.');
    if (skipped > 0) toast('info', `그림이 아닌 파일 ${skipped}개는 건너뛰었어요.`);
    if (failed.length) toast('error', `${failed.length}개는 올리지 못했어요: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' …' : ''}`, { timeOut: 10000 });
}

// ── 선택 모드의 한꺼번에 하기 ───────────────────────────────────

function selectedMembers() {
    return currentGroups().filter(group => selected.has(group.key)).flatMap(group => group.members);
}

function bulkToggle(off) {
    if (notReady()) return;
    const members = selectedMembers();
    if (!members.length) {
        toast('info', '먼저 그림을 골라 주세요.');
        return;
    }
    for (const asset of members) setDisabled(asset.folder, asset.file, off);
    recompute();
    toast('success', `그림 ${members.length}장을 ${off ? '껐어요. AI에게 알려 주지 않아요.' : '켰어요.'}`);
}

/** 고른 그림을 다른 프리셋 폴더로: 새 폴더에 올린 뒤 예전 파일을 지운다 (꺼짐 상태도 같이). */
async function bulkMove() {
    if (notReady()) return;
    const source = ownActive();
    if (!source) {
        toast('warning', '불러온 폴더의 그림은 여기서 옮길 수 없어요.');
        return;
    }
    const picked = selectedMembers();
    if (!picked.length) {
        toast('info', '먼저 그림을 골라 주세요.');
        return;
    }
    // 1.3.2: 확장자만 다른 같은 이름(이름.png + 이름.jpg)은 옮기지 않는다. 서버는 올릴 때도 지울 때도 같은 이름을 한꺼번에
    //        지워서, 하나를 옮기면 나머지가 원래 폴더에서 지워지고 옮길 곳에서도 덮어써져 그림 하나가 영영 사라졌다.
    const members = picked.filter(asset => !sameBaseSiblings(source.assets, asset).length);
    const kept = picked.filter(asset => !members.includes(asset)).map(asset => asset.file);
    if (!members.length) {
        toast('warning', `확장자만 다른 같은 이름의 그림이 있어서 옮기지 않았어요: ${kept.slice(0, 3).join(', ')}. 하나를 먼저 이름을 바꾸거나 지워 주세요.`, { timeOut: 10000 });
        return;
    }
    const others = runtime.sources.filter(item => item.own && item.key !== source.key);
    if (!others.length) {
        toast('info', '옮길 다른 프리셋이 없어요. 위의 + 프리셋으로 먼저 만들어 주세요.');
        return;
    }
    const targetKey = await pickDialog(`그림 ${members.length}장을 어느 프리셋으로 옮길까요?\n같은 이름이 거기 있으면 덮어써요.`, others.map(item => ({ value: item.key, label: item.label })), { ok: '옮기기' });
    if (!targetKey || !sourceByKey(targetKey)) return;
    setBusy(true);
    const failed = [];
    let moved = 0;
    try {
        for (const asset of members) {
            if (!sourceByKey(source.key)) break; // 캐릭터가 바뀜
            try {
                const response = await fetch(asset.url, { cache: 'no-cache' });
                if (!response.ok) throw new Error('원본 파일을 읽지 못했어요.');
                const blob = await response.blob();
                const file = new File([blob], asset.file, { type: blob.type || 'application/octet-stream' });
                await uploadImage(targetKey, file, asset.base);
                const wasOff = disabledSet(asset.folder).has(asset.file);
                if (wasOff) setDisabled(targetKey, asset.file, true);
                await deleteAsset(asset.folder, asset.base);
                setDisabled(asset.folder, asset.file, false);
                moved++;
            } catch (error) {
                console.error('[캐릭터 에셋] 옮기기 실패', asset.file, error);
                failed.push(asset.file);
            }
        }
    } finally {
        setBusy(false);
    }
    selected.clear();
    await reload();
    const label = sourceByKey(targetKey)?.label ?? targetKey;
    if (failed.length) toast('error', `${failed.length}장은 옮기지 못했어요: ${failed.slice(0, 3).join(', ')}`);
    if (kept.length) toast('warning', `확장자만 다른 같은 이름이 있는 ${kept.length}장은 그대로 뒀어요: ${kept.slice(0, 3).join(', ')}`, { timeOut: 10000 });
    if (moved) toast('success', `그림 ${moved}장을 '${label}'(으)로 옮겼어요.`);
}

async function bulkDelete() {
    if (notReady()) return;
    const source = ownActive();
    if (!source) {
        toast('warning', '불러온 폴더의 그림은 여기서 지울 수 없어요.');
        return;
    }
    const members = selectedMembers();
    if (!members.length) {
        toast('info', '먼저 그림을 골라 주세요.');
        return;
    }
    const folder = source.key;
    // 서버는 이름이 같고 확장자만 다른 파일도 함께 지우므로, 그것까지 세어서 물어본다 (이름마다 한 번만 지운다).
    const targets = [...new Set(members.flatMap(asset => [asset, ...sameBaseSiblings(source.assets, asset)]))];
    const bases = [...new Set(targets.map(asset => asset.base))];
    const extra = targets.length - members.length;
    const ok = await confirmDialog(`그림 ${targets.length}장을 지울까요?${extra > 0 ? `\n(고른 것과 이름이 같은 다른 확장자 파일 ${extra}장도 함께 지워져요)` : ''}\n파일이 지워지고 되돌릴 수 없어요.`, { ok: '지우기' });
    if (!ok) return;
    if (!sourceByKey(folder)) {
        toast('warning', '확인하는 사이 캐릭터가 바뀌어서 지우지 않았어요.');
        return;
    }
    setBusy(true);
    const failed = [];
    let deleted = 0;
    let aborted = false;
    try {
        for (const base of bases) {
            if (!sourceByKey(folder)) { // 캐릭터가 바뀌면 남은 건 그만둔다
                aborted = true;
                break;
            }
            try {
                await deleteAsset(folder, base);
                for (const asset of targets) {
                    if (asset.base !== base) continue;
                    setDisabled(folder, asset.file, false);
                    deleted++;
                }
            } catch (error) {
                console.error('[캐릭터 에셋] 지우기 실패', base, error);
                failed.push(base);
            }
        }
    } finally {
        setBusy(false);
    }
    selected.clear();
    await reload();
    if (aborted) toast('warning', `캐릭터가 바뀌어서 ${deleted}장만 지우고 멈췄어요.`);
    else if (failed.length) toast('error', `${failed.length}개는 지우지 못했어요: ${failed.slice(0, 3).join(', ')}`);
    else toast('success', `그림 ${deleted}장을 지웠어요.`);
}

// ── 설정 ──────────────────────────────────────────────────────

function savePromptSoon() {
    clearTimeout(promptTimer);
    promptTimer = setTimeout(savePromptNow, 500);
}

function savePromptNow() {
    clearTimeout(promptTimer);
    promptTimer = null;
    const store = settings();
    if (store.prompt === refs.prompt.value) return;
    store.prompt = refs.prompt.value;
    saveSettings();
}

function setSwitch(name, value) {
    const store = settings();
    store[name] = value;
    saveSettings();
    recompute(); // 키워드·찾아보기표를 다시 만들고 채팅도 다시 본다
}

// ── 이벤트 ────────────────────────────────────────────────────

function bind() {
    root.addEventListener('click', onClick);
    bindChipHold(root);

    refs.search.addEventListener('input', () => {
        query = refs.search.value.trim().toLowerCase();
        refs.searchClear.hidden = !query;
        renderGrid();
    });
    refs.search.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            refs.search.blur();
        }
    });

    refs.grid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const tile = event.target.closest('.eh-tile');
        if (!tile) return;
        event.preventDefault();
        tile.click();
    });

    refs.inputImages.addEventListener('change', async () => {
        const files = refs.inputImages.files;
        if (files?.length) await handleFiles(files);
        refs.inputImages.value = '';
    });
    refs.inputZip.addEventListener('change', async () => {
        const files = refs.inputZip.files;
        if (files?.length) await handleFiles(files);
        refs.inputZip.value = '';
    });

    // 끌어다 놓기. 실리태번의 전체 화면 드롭(캐릭터 카드 가져오기)이 같이 받지 않도록 전파를 막는다.
    let dragDepth = 0;
    refs.gridWrap.addEventListener('dragenter', (event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        event.stopPropagation();
        dragDepth++;
        refs.gridWrap.classList.add('is-dragging');
    });
    refs.gridWrap.addEventListener('dragover', (event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
    });
    refs.gridWrap.addEventListener('dragleave', (event) => {
        event.stopPropagation();
        dragDepth = Math.max(0, dragDepth - 1);
        if (!dragDepth) refs.gridWrap.classList.remove('is-dragging');
    });
    refs.gridWrap.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth = 0;
        refs.gridWrap.classList.remove('is-dragging');
        if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files);
    });

    refs.prompt.addEventListener('input', savePromptSoon);
    refs.prompt.addEventListener('change', savePromptNow);
    refs.prompt.addEventListener('blur', savePromptNow);

    root.querySelector('.eh-guide').addEventListener('toggle', (event) => {
        settings().guideOpen = event.target.open;
        saveSettings();
    });
}

async function onClick(event) {
    const target = event.target;

    const copyChip = target.closest('[data-copy]');
    if (copyChip) {
        const ok = await copyText(copyChip.dataset.copy);
        toast(ok ? 'success' : 'error', ok ? `${copyChip.dataset.copy} 복사했어요.` : '복사하지 못했어요.');
        return;
    }

    const option = target.closest('.eh-segmented [data-value]');
    if (option) {
        const group = option.closest('.eh-segmented');
        group.querySelectorAll('[data-value]').forEach((button) => {
            const active = button === option;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-checked', String(active));
        });
        if (group.dataset.setting === 'thumbSize') {
            settings().thumbSize = option.dataset.value;
            saveSettings();
            refs.grid.dataset.size = option.dataset.value;
        }
        return;
    }

    const toggle = target.closest('.eh-switch');
    if (toggle) {
        const next = toggle.getAttribute('aria-checked') !== 'true';
        toggle.setAttribute('aria-checked', String(next));
        if (toggle.dataset.pset) setPresetEnabled(next);
        else setSwitch(toggle.dataset.setting, next);
        return;
    }

    const chip = target.closest('.eh-pchip[data-preset]');
    if (chip) {
        if (Date.now() - chipHoldFired < 1200) return; // 꾹 누른 뒤의 click
        if (chip.dataset.preset !== activeKey) {
            activeKey = chip.dataset.preset;
            selected.clear();
            renderPresets();
            renderGrid();
        }
        return;
    }

    const tile = target.closest('.eh-tile');
    if (tile) {
        onTile(tile.dataset.key);
        return;
    }

    const action = target.closest('[data-act]')?.dataset.act;
    if (!action) return;
    switch (action) {
        case 'preset-add':
            await addPresetFlow();
            break;
        case 'preset-delete':
            await deletePresetFlow();
            break;
        case 'link-add':
            await linkAddFlow();
            break;
        case 'link-remove':
            linkRemoveFlow();
            break;
        case 'preset-up':
        case 'preset-down': {
            const source = ownActive();
            if (!source) break;
            if (movePreset(settings(), runtime.folder, source.preset.id, action === 'preset-up' ? -1 : 1)) {
                saveSettings();
                recompute();
            }
            break;
        }
        case 'bulk-move':
            await bulkMove();
            break;
        case 'refresh':
            await reload();
            if (!runtime.error) toast('success', '다시 불러왔어요.');
            else toast('error', `목록을 읽지 못했어요: ${runtime.error}`);
            break;
        case 'shrink':
            await runShrink();
            break;
        case 'redraw': {
            // 그림이 안 나올 때 어디서 막혔는지 한 번에 보여 준다.
            const report = redrawNow();
            if (!report.hasIndex) {
                toast('warning', '그림 목록을 아직 못 읽었어요. 옆의 새로고침을 먼저 눌러 주세요.', { timeOut: 15000 });
                break;
            }
            if (!report.renderEnabled) {
                toast('warning', '아래 ‘채팅에 그림 표시’가 꺼져 있어요. 켜면 태그가 그림으로 바뀌어요.', { timeOut: 15000 });
                break;
            }
            const changed = report.tagsBefore - report.tagsAfter;
            const missing = report.unresolved.length ? ` · 못 찾은 이름: ${report.unresolved.join(', ')}` : '';
            const stuck = report.stuck.length ? ` · 있는데 안 바뀐 이름: ${report.stuck.join(', ')}` : '';
            const swapped = report.substituted.length ? ` · 비슷한 그림으로: ${report.substituted.join(', ')}` : '';
            const repeated = report.repeated.length ? ` · 같은 그림이라 뺌(‘같은 그림은 한 번만’): ${report.repeated.join(', ')}` : '';
            const watch = report.watching ? '' : ' · 채팅 감시 꺼짐';
            toast('info', `메시지 ${report.messages}개 · 태그 ${report.tagsBefore}개 중 ${changed}개 바꿈 · 그림 ${report.images}장 · 목록 ${report.assets}장 (${report.folder || '폴더 없음'})${missing}${stuck}${swapped}${repeated}${watch}`, { timeOut: 25000 });
            break;
        }
        case 'upload':
            if (!runtime.folder) toast('warning', isGroupChat() ? '그룹 채팅에서는 올릴 수 없어요.' : '먼저 캐릭터를 열어 주세요.');
            else if (!notReady()) refs.inputImages.click();
            break;
        case 'upload-zip':
            if (!runtime.folder) toast('warning', isGroupChat() ? '그룹 채팅에서는 올릴 수 없어요.' : '먼저 캐릭터를 열어 주세요.');
            else if (!notReady()) refs.inputZip.click();
            break;
        case 'select':
            setSelecting(!selecting);
            break;
        case 'select-done':
            setSelecting(false);
            break;
        case 'select-all': {
            const groups = visibleGroups();
            const all = groups.every(group => selected.has(group.key));
            for (const group of groups) {
                if (all) selected.delete(group.key);
                else selected.add(group.key);
            }
            renderGrid();
            break;
        }
        case 'bulk-on':
            bulkToggle(false);
            break;
        case 'bulk-off':
            bulkToggle(true);
            break;
        case 'bulk-delete':
            await bulkDelete();
            break;
        case 'search-clear':
            refs.search.value = '';
            refs.search.dispatchEvent(new Event('input'));
            break;
        case 'prompt-reset':
            if (await confirmDialog('AI에게 주는 규칙을 기본값으로 되돌릴까요?', { ok: '되돌리기' })) {
                refs.prompt.value = DEFAULT_PROMPT;
                savePromptNow();
                toast('success', '기본값으로 되돌렸어요.');
            }
            break;
        case 'prompt-copy': {
            savePromptNow();
            const text = expandedPrompt();
            if (!text) {
                toast('warning', '지금 캐릭터에 켜진 그림이 없어서 {{img_inprompt}}는 빈 글이 돼요.');
                break;
            }
            const ok = await copyText(text);
            toast(ok ? 'success' : 'error', ok ? `완성본을 복사했어요. (${text.length}자)` : '복사하지 못했어요.');
            break;
        }
        default:
            break;
    }
}

function onTile(key) {
    if (selecting) {
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        const tile = refs.grid.querySelector(`.eh-tile[data-key="${CSS.escape(key)}"]`);
        tile?.classList.toggle('is-selected', selected.has(key));
        updateSelectBar();
        return;
    }
    const groups = visibleGroups();
    const items = groups.flatMap(group => group.members);
    const group = groups.find(item => item.key === key);
    if (!group) return;
    const first = group.exact ?? group.members[0];
    openViewer({ items, start: Math.max(0, items.indexOf(first)) });
}

export function showHelp() {
    const guide = root?.querySelector('.eh-guide')?.cloneNode(true);
    if (!guide) return;
    guide.querySelector('summary')?.remove();
    guide.querySelectorAll('button').forEach(button => button.remove());
    const body = document.createElement('div');
    body.className = 'eh-root'; applyThemeVars(body);
    body.innerHTML = '<h3>캐릭터 에셋 사용방법</h3>' + guide.innerHTML;
    return callGenericPopup(body, POPUP_TYPE.TEXT, '', {okButton:'닫기', wide:true});
}
