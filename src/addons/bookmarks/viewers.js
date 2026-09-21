// 북마크 — 메모·원문 편집, 삭제 확인, 앞뒤 문맥 창, 채팅에서 미리보기
import { addOneMessage, reloadCurrentChat } from '../../../../../../../script.js';
// isGenerating은 실리태번 버전에 따라 없을 수 있어서 이름으로 import하지 않는다 (없는 이름을 import하면 확장 전체가 안 뜬다).
import * as sillyTavern from '../../../../../../../script.js';
import { hooks, settings, saveSettings, iconName } from './state.js';
import { loadRecord, removeBookmark, setNote, editMessageText, flushBookmarkSave } from './data.js';
import { escapeHtml, formatDate, renderMessageHtml, renderReasoningHtml, avatarForMessage, hydrateHtmlBlocks } from './render.js';
import { openSheet, confirmSheet, textSheet } from './ui-kit.js';
import { hasTranslation, originalTextOf, editableTranslation, setTranslation, clearTranslation } from './translate.js';
import { isBlockedPreviewKey } from './preview-guard.js';

const NOTE_HINT = '*기울기*, **굵게**, &lt;br&gt; 같은 HTML도 쓸 수 있어요. Ctrl+Enter로 저장.';

/**
 * 메모 편집. createdNow면 방금 만든 북마크라서, 취소하면 북마크도 없던 일로 한다.
 * @returns {Promise<boolean>} 북마크가 남아 있으면 true
 */
export async function openNoteEditor(record, fav, { createdNow = false } = {}) {
    const message = record.messages?.[Number(fav.messageId)];
    const note = await textSheet({
        title: createdNow ? '북마크 + 메모' : '메모',
        subtitle: `${message?.name ?? fav.sender ?? ''} · #${fav.messageId}`,
        icon: 'fa-feather-pointed',
        value: fav.note ?? '',
        placeholder: '이 장면을 기억할 한마디…',
        hint: NOTE_HINT,
        rows: 5,
    });
    try {
        if (note === null) {
            if (createdNow) await removeBookmark(record, fav.id);
            return !createdNow;
        }
        if (note !== (fav.note ?? '')) await setNote(record, fav.id, note);
        return true;
    } catch (error) {
        toastr.error(error.message, '북마크');
        return true;
    }
}

/** @returns {Promise<boolean>} 원문을 바꿨으면 true */
export async function openMessageEditor(record, index) {
    await loadRecord(record);
    const message = record.messages[index];
    if (!message) {
        toastr.error('메시지를 찾을 수 없습니다.', '북마크');
        return false;
    }
    const translatedNote = message.extra?.display_text
        ? '번역문이 있는 메시지예요. 원문을 바꾸면 번역문은 지워지고 원문이 보여요.<br>'
        : '';
    const text = await textSheet({
        title: '메시지 원문 수정',
        subtitle: `${message.name} · #${index}`,
        icon: 'fa-pen-to-square',
        value: message.mes ?? '',
        size: 'lg',
        rows: 16,
        hint: `${translatedNote}<b>채팅 기록의 원문이 바뀝니다.</b>`,
    });
    if (text === null || text === message.mes) return false;
    try {
        await editMessageText(record, index, text);
        toastr.success('원문을 고쳤어요.', '북마크');
        return true;
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
}

// ── 번역문 ──────────────────────────────────────────────────

/**
 * 번역문 직접 쓰기·고치기. 번역문이 없으면 빈 칸에서 시작하고, 있으면 번역기 DB의 원본을 채워 준다.
 * 비워서 저장하면 번역문을 지운다 (채팅 화면의 '번역문 수정'과 같다).
 * @returns {Promise<boolean>} 바꿨으면 true
 */
export async function openTranslationEditor(record, index) {
    let current;
    try {
        await loadRecord(record);
        current = await editableTranslation(record, index);
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
    const message = record.messages[index];
    if (!message) {
        toastr.error('메시지를 찾을 수 없습니다.', '북마크');
        return false;
    }
    // 창을 열어 둔 사이에 메시지가 바뀌면(지워지거나 밀리면) 저장하지 않도록 지금 값을 잡아 둔다.
    const expected = { message, original: originalTextOf(message) };
    const existing = hasTranslation(message);
    const text = await textSheet({
        title: existing ? '번역문 직접 고치기' : '번역문 직접 쓰기',
        subtitle: `${message.name} · #${index}`,
        icon: 'fa-pen-nib',
        value: current,
        placeholder: '여기에 쓴 글이 원문 대신 보여요.',
        size: 'lg',
        rows: 16,
        hint: existing
            ? '채팅 화면에도 똑같이 보여요. <b>비워서 저장하면 번역문을 지워요.</b>'
            : '원문은 그대로 두고 이 글을 번역문으로 보여 줘요. 채팅 화면에도 똑같이 보여요.',
    });
    if (text === null) return false;
    try {
        if (!text.trim()) {
            if (!existing) return false;
            await clearTranslation(record, index, expected);
            toastr.success('번역문을 지웠어요.', '북마크', { timeOut: 1800 });
            return true;
        }
        if (text === current) return false;
        await setTranslation(record, index, text, expected);
        toastr.success(existing ? '번역문을 고쳤어요.' : '번역문을 넣었어요.', '북마크', { timeOut: 1800 });
        return true;
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
}

/** @returns {Promise<boolean>} 지웠으면 true */
export async function confirmClearTranslation(record, index) {
    let expected;
    try {
        await loadRecord(record);
        const message = record.messages[index];
        if (!hasTranslation(message)) {
            toastr.info('지울 번역문이 없어요.', '북마크');
            return false;
        }
        expected = { message, original: originalTextOf(message) };
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
    const confirmed = await confirmSheet('이 메시지의 번역문을 지울까요? 원문은 그대로 남고, 채팅 화면에도 원문이 보여요.', { title: '번역문 지우기', okLabel: '지우기', danger: true, icon: 'fa-eraser' });
    if (!confirmed) return false;
    try {
        return await clearTranslation(record, index, expected);
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
}

/** @returns {Promise<boolean>} 지웠으면 true */
export async function confirmDeleteBookmark(record, fav) {
    const confirmed = await confirmSheet('이 북마크를 지울까요? 원래 메시지는 그대로 남아요.', { title: '북마크 삭제', okLabel: '삭제', danger: true, icon: 'fa-trash-can' });
    if (!confirmed) return false;
    try {
        await removeBookmark(record, fav.id);
        return true;
    } catch (error) {
        toastr.error(error.message, '북마크');
        return false;
    }
}

// ── 앞뒤 문맥 창 ─────────────────────────────────────────────

function renderBubble(record, index, isFocus) {
    const message = record.messages[index];
    const formatIndex = record.isCurrent ? index : null;
    const reasoning = renderReasoningHtml(message, formatIndex);
    const row = document.createElement('div');
    row.className = `cg-bubble-row ${message.is_user ? 'is-user' : 'is-ai'}${isFocus ? ' is-focus' : ''}`;
    row.innerHTML = `
        <img class="cg-bubble-avatar" src="${escapeHtml(avatarForMessage(message, record.owner))}" alt="" loading="lazy" onerror="this.src='img/ai4.png'">
        <div class="cg-bubble">
            <div class="cg-bubble-name">
                <b>${escapeHtml(message.name ?? '')}</b>
                <span>#${index}${message.send_date ? ` · ${escapeHtml(formatDate(message.send_date))}` : ''}</span>
                ${isFocus ? `<span class="cg-bubble-tag"><i class="fa-solid ${iconName()}"></i> 북마크</span>` : ''}
            </div>
            ${reasoning ? `<details class="cg-reasoning"><summary><i class="fa-solid fa-brain"></i> 생각 과정</summary><div class="mes_text">${reasoning}</div></details>` : ''}
            <div class="salty-preview cg-chatlike" data-prev="bookmark"><div class="mes" is_user="${!!message.is_user}"><div class="mes_block"><div class="cg-bubble-text mes_text">${renderMessageHtml(message, formatIndex)}</div></div></div></div>
        </div>`;
    return row;
}

export async function openContextViewer(record, index) {
    try {
        await loadRecord(record);
    } catch (error) {
        toastr.error(`앞뒤 문맥을 불러오지 못했습니다: ${error.message}`, '북마크');
        return;
    }
    if (!record.messages[index]) {
        toastr.error('메시지를 찾을 수 없습니다.', '북마크');
        return;
    }

    const body = document.createElement('div');
    body.className = 'cg-context';
    const sheet = openSheet({ title: '앞뒤 문맥', subtitle: record.label, icon: 'fa-layer-group', size: 'lg', body });
    sheet.extra.innerHTML = `
        <div class="cg-stepper cg-stepper--compact" title="앞뒤로 보여 줄 메시지 수">
            <button type="button" data-step="-1" aria-label="줄이기"><i class="fa-solid fa-minus"></i></button>
            <span class="cg-stepper-label"></span>
            <button type="button" data-step="1" aria-label="늘리기"><i class="fa-solid fa-plus"></i></button>
        </div>`;
    const label = sheet.extra.querySelector('.cg-stepper-label');

    const render = () => {
        const range = settings().contextRange;
        label.textContent = range === 0 ? '이 메시지만' : `앞뒤 ${range}개`;
        body.replaceChildren();
        const first = Math.max(0, index - range);
        const last = Math.min(record.messages.length - 1, index + range);
        for (let i = first; i <= last; i++) body.append(renderBubble(record, i, i === index));
        hydrateHtmlBlocks(body);
        const focus = body.querySelector('.is-focus');
        if (focus) sheet.body.scrollTop = Math.max(0, focus.offsetTop - 12);
    };

    sheet.extra.addEventListener('click', (event) => {
        const button = event.target.closest('[data-step]');
        if (!button) return;
        const next = Math.min(10, Math.max(0, settings().contextRange + Number(button.dataset.step)));
        if (next === settings().contextRange) return;
        settings().contextRange = next;
        saveSettings();
        render();
    });
    render();
}

// ── 채팅에서 미리보기 ────────────────────────────────────────
// 다른 채팅(또는 현재 채팅의 아직 안 불러온 부분)의 메시지 주변을 채팅 화면에 잠깐 그린다.
// 미리보기 중에는 편집·스와이프 버튼을 숨겨서, 현재 채팅의 같은 번호 메시지를 잘못 고치지 않게 한다.

let preview = null; // { record, index }

/**
 * 실리태번이 답을 만드는 중인지. 그동안 채팅 화면을 미리보기로 바꾸면 스트리밍이 사라진 칸에 쓰이거나 새 답이 미리보기 아래에 붙고,
 * 끝내기로 채팅을 다시 불러오면 만들던 답을 잃는다. 예전 실리태번은 생성 중에 body에 붙는 data-generating으로 본다.
 */
function isGenerating() {
    if (typeof sillyTavern.isGenerating === 'function' && sillyTavern.isGenerating()) return true;
    return document.body.dataset.generating === 'true';
}

export function previewRecord() {
    return preview?.record ?? null;
}

export function isPreviewing() {
    return preview !== null;
}

function ensurePreviewBar() {
    let bar = document.getElementById('cg-preview-bar');
    if (bar) return bar;
    const formSheld = document.getElementById('form_sheld');
    if (!formSheld) return null;
    bar = document.createElement('div');
    bar.id = 'cg-preview-bar';
    bar.innerHTML = `
        <span class="cg-preview-chip"><i class="fa-solid fa-eye"></i> 미리보기</span>
        <span class="cg-preview-label"></span>
        <button type="button" class="cg-preview-btn" data-act="open"><i class="fa-solid ${iconName()}"></i><span>북마크 목록</span></button>
        <button type="button" class="cg-preview-btn is-primary" data-act="exit"><i class="fa-solid fa-arrow-right-from-bracket"></i><span>끝내기</span></button>`;
    bar.addEventListener('click', (event) => {
        const action = event.target.closest('[data-act]')?.dataset.act;
        if (action === 'open') hooks.openPanel({ keepState: true });
        if (action === 'exit') exitPreview();
    });
    formSheld.append(bar);
    return bar;
}

function flashMessage(index) {
    const element = document.querySelector(`#chat .mes[mesid="${index}"]`);
    if (!element) return false;
    element.scrollIntoView({ block: 'start' });
    element.classList.remove('cg-flash');
    void element.offsetWidth;
    element.classList.add('cg-flash');
    setTimeout(() => element.classList.remove('cg-flash'), 2200);
    return true;
}

export async function enterPreview(record, index) {
    // 현재 채팅에 이미 그려진 메시지라면 그 자리로 이동만 한다.
    if (record.isCurrent && !preview && document.querySelector(`#chat .mes[mesid="${index}"]`)) {
        hooks.closePanel();
        flashMessage(index);
        return;
    }
    try {
        await loadRecord(record);
    } catch (error) {
        toastr.error(`미리보기를 불러오지 못했습니다: ${error.message}`, '북마크');
        return;
    }
    if (!record.messages[index]) {
        toastr.error('메시지를 찾을 수 없습니다.', '북마크');
        return;
    }
    if (isGenerating()) {
        toastr.info('답을 만드는 중에는 채팅에서 볼 수 없어요. 답이 끝난 뒤에 다시 눌러 주세요.', '북마크');
        return;
    }

    hooks.closePanel({ keepColors: true });
    preview = { record, index };
    document.body.classList.add('cg-previewing');
    const bar = ensurePreviewBar();
    if (bar) bar.querySelector('.cg-preview-label').textContent = `${record.label} · #${index}`;

    const chatElement = document.getElementById('chat');
    chatElement.replaceChildren();
    const first = Math.max(0, index - 2);
    const last = Math.min(record.messages.length - 1, index + 2);
    for (let i = first; i <= last; i++) {
        // 실리태번이 메시지 객체를 손볼 수 있으니 복사본을 넘긴다.
        const element = addOneMessage(structuredClone(record.messages[i]), { forceId: i, scroll: false, showSwipes: false });
        const node = element?.[0] ?? element;
        if (node instanceof HTMLElement) hydrateHtmlBlocks(node);
    }
    hooks.refreshMessageIcons();
    setTimeout(() => flashMessage(index), 60);
}

// 1.2.9: 미리보기 중에는 실리태번 단축키(Ctrl+Enter 다시 생성 · Alt+Enter 이어 쓰기 · ←/→ 스와이프 · ↑ 편집 · 보내기)를 창 단계에서 먼저 막는다.
// 화면에는 다른 채팅이 그려져 있지만 실리태번의 데이터는 지금 채팅이라, 그대로 두면 지금 채팅의 답을 지우고 새 답을 미리보기 화면에 그렸다.
// (입력창 위 버튼들은 style.css가 #form_sheld 안에서 미리보기 막대만 남기고 숨긴다.)
window.addEventListener('keydown', (event) => {
    if (!preview || !isBlockedPreviewKey(event)) return;
    event.preventDefault();
    event.stopPropagation();
}, true);

/**
 * 1.2.9: 미리보기 중에 그래도 답 만들기가 시작되면(슬래시 명령 · 다른 확장 · 빠른 답장) 곧바로 미리보기를 끝내고 지금 채팅을 다시 그린다.
 * GENERATION_STARTED 를 실리태번이 기다려 주므로, 다시 생성이 마지막 답을 지우거나 새 답을 붙이기 전에 화면이 지금 채팅으로 돌아온다.
 * 서버에서 다시 불러오지 않고 메모리의 채팅으로 그린다 (답을 만드는 중에 채팅을 비우면 안 된다).
 */
export async function abandonPreviewForGeneration() {
    if (!preview) return;
    preview = null;
    document.body.classList.remove('cg-previewing');
    if (typeof sillyTavern.printMessages === 'function') {
        document.getElementById('chat')?.replaceChildren();
        await sillyTavern.printMessages();
    } else {
        await reloadCurrentChat();
    }
    hooks.refreshMessageIcons();
    toastr.info('답을 만들기 시작해서 미리보기를 끝냈어요.', '북마크', { timeOut: 2500 });
}

export async function exitPreview({ reload = true } = {}) {
    if (!preview) return;
    if (reload && isGenerating()) {
        toastr.info('답을 만드는 중이에요. 답이 끝난 뒤에 끝내기를 눌러 주세요.', '북마크');
        return;
    }
    preview = null;
    document.body.classList.remove('cg-previewing');
    if (reload) {
        // 미리보기 중에 단 현재 채팅 북마크는 실리태번의 debounce 저장에 맡겨져 있는데, 다시 불러오기(clearChat)가 그 저장을 취소한다.
        await flushBookmarkSave();
        await reloadCurrentChat();
    }
    hooks.refreshMessageIcons();
}
