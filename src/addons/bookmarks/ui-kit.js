// 북마크 — 공용 시트(작은 창): 확인, 글 편집, 앞뒤 문맥 등이 모두 이 모양을 쓴다.
import { applyTheme } from './state.js';
import { escapeHtml } from './render.js';

/** 열린 시트. 마지막이 맨 위다. Esc는 맨 위 시트부터 닫는다. */
const openSheets = [];

export function hasOpenSheet() {
    return openSheets.length > 0;
}

export function closeTopSheet() {
    const sheet = openSheets.at(-1);
    if (!sheet) return false;
    sheet.close(null);
    return true;
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} [options.icon] Font Awesome 이름 (예: 'fa-feather-pointed')
 * @param {'sm'|'md'|'lg'} [options.size]
 * @param {string|Node} [options.body]
 * @param {{label: string, kind?: 'primary'|'danger'|'ghost', icon?: string, onClick?: (sheet) => (boolean|void|Promise<boolean|void>)}[]} [options.actions]
 *        onClick이 false를 돌려주면 시트를 닫지 않는다.
 * @param {boolean} [options.dismissOnBackdrop] 바깥을 눌러 닫을지 (편집 창은 실수로 날아가지 않게 끈다)
 * @param {(result: any) => void} [options.onClose]
 */
export function openSheet({ title, subtitle = '', icon = '', size = 'md', body = '', actions = [], dismissOnBackdrop = true, onClose = null, className = '' }) {
    const overlay = document.createElement('div');
    overlay.className = `cg-root cg-sheet-overlay ${className}`.trim();
    applyTheme(overlay);
    overlay.innerHTML = `
        <div class="cg-sheet cg-sheet--${size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <header class="cg-sheet-head">
                ${icon ? `<span class="cg-sheet-icon"><i class="fa-solid ${icon}"></i></span>` : ''}
                <div class="cg-sheet-titles">
                    <div class="cg-sheet-title">${escapeHtml(title)}</div>
                    ${subtitle ? `<div class="cg-sheet-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                </div>
                <div class="cg-sheet-extra"></div>
                <button type="button" class="cg-icon-btn" data-sheet-close title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
            </header>
            <div class="cg-sheet-body"></div>
            ${actions.length ? '<footer class="cg-sheet-foot"></footer>' : ''}
        </div>`;

    const bodyElement = overlay.querySelector('.cg-sheet-body');
    if (typeof body === 'string') bodyElement.innerHTML = body;
    else if (body) bodyElement.append(body);

    let closed = false;
    let resolveClosed;
    const sheet = {
        overlay,
        element: overlay.querySelector('.cg-sheet'),
        body: bodyElement,
        extra: overlay.querySelector('.cg-sheet-extra'),
        closed: new Promise(resolve => { resolveClosed = resolve; }),
        close(result = null) {
            if (closed) return;
            closed = true;
            openSheets.splice(openSheets.indexOf(sheet), 1);
            overlay.classList.remove('is-open');
            setTimeout(() => overlay.remove(), 200);
            onClose?.(result);
            resolveClosed(result);
        },
    };

    const foot = overlay.querySelector('.cg-sheet-foot');
    for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cg-btn cg-btn--${action.kind ?? 'ghost'}`;
        button.innerHTML = `${action.icon ? `<i class="fa-solid ${action.icon}"></i>` : ''}<span>${escapeHtml(action.label)}</span>`;
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
                const keepOpen = (await action.onClick?.(sheet)) === false;
                if (!keepOpen) sheet.close(action.result ?? action.label);
            } finally {
                button.disabled = false;
            }
        });
        foot.append(button);
    }

    overlay.querySelector('[data-sheet-close]').addEventListener('click', () => sheet.close(null));
    overlay.addEventListener('click', (event) => {
        if (dismissOnBackdrop && event.target === overlay) sheet.close(null);
    });

    document.body.append(overlay);
    openSheets.push(sheet);
    void overlay.offsetWidth; // 애니메이션 시작점을 확정한다 (requestAnimationFrame 없이)
    overlay.classList.add('is-open');
    return sheet;
}

/** 예/아니오 확인. true면 확인을 누른 것이다. */
export async function confirmSheet(message, { title = '확인', okLabel = '확인', danger = false, icon = '' } = {}) {
    let confirmed = false;
    const sheet = openSheet({
        title,
        icon: icon || (danger ? 'fa-triangle-exclamation' : 'fa-circle-question'),
        size: 'sm',
        body: `<p class="cg-confirm-text">${escapeHtml(message)}</p>`,
        actions: [
            { label: '취소', kind: 'ghost' },
            { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { confirmed = true; } },
        ],
    });
    await sheet.closed;
    return confirmed;
}

/**
 * 여러 줄 글 편집. 저장하면 글을, 취소하면 null을 돌려준다.
 * Ctrl/⌘+Enter로도 저장한다.
 */
export async function textSheet({ title, subtitle = '', icon = 'fa-pen', value = '', placeholder = '', hint = '', okLabel = '저장', size = 'md', rows = 6 }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cg-editor';
    wrapper.innerHTML = `
        <textarea class="cg-textarea" rows="${rows}" spellcheck="false" placeholder="${escapeHtml(placeholder)}"></textarea>
        ${hint ? `<p class="cg-hint">${hint}</p>` : ''}`;
    const textarea = wrapper.querySelector('textarea');
    textarea.value = value;

    let saved = null;
    const sheet = openSheet({
        title,
        subtitle,
        icon,
        size,
        body: wrapper,
        dismissOnBackdrop: false,
        actions: [
            { label: '취소', kind: 'ghost' },
            { label: okLabel, kind: 'primary', icon: 'fa-check', onClick: () => { saved = textarea.value; } },
        ],
    });
    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.stopPropagation(); // 1.2.9: 실리태번의 Ctrl+Enter(마지막 답 다시 생성)까지 가지 않게
            saved = textarea.value;
            sheet.close('saved');
        }
    });
    // 모바일에서 키보드가 올라오며 창이 흔들리지 않도록 애니메이션 뒤에 초점을 준다.
    setTimeout(() => {
        textarea.focus({ preventScroll: true });
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }, 220);
    await sheet.closed;
    return saved;
}
