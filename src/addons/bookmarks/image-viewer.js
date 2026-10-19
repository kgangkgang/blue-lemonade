// 북마크 1.7.0 (7.2.7) — 붙인 그림 크게 보기. 사용자 요청: "북마크 그림 원본 해상도로 보이게 해 줘"
// 화면에 맞춰 띄운 뒤 원본 해상도(1:1)까지 확대한다: 폰 = 두 손가락 벌리기 · 두 번 톡(원본 크기 ↔ 맞춤), PC = 휠 · 두 번 클릭.
// 확대 손짓은 캐릭터 에셋 그림 보기와 같은 것(src/image-zoom.js). 여러 그림이면 옆으로 쓸거나 ← → 로 넘긴다.
// 창은 북마크 시트(ui-kit.js openSheet) — Esc · 닫기 단추 · 초점 되돌리기를 다른 시트와 똑같이 받는다.
import { openSheet } from './ui-kit.js';
import { safeImageSrc } from './render.js';
import { attachZoom } from '../../image-zoom.js';

let current = null; // { sheet, step }

export function isImageViewerOpen() {
    return current !== null;
}

/**
 * @param {{ src: string, prompt?: string, label?: string }[]} items 보여 줄 그림들 (붙인 차례)
 * @param {number} [start] 처음 보여 줄 칸
 */
export function openImageViewer(items, start = 0) {
    const list = (Array.isArray(items) ? items : []).map(item => ({ ...item, url: safeImageSrc(item?.src) })).filter(item => item.url);
    if (!list.length) return null;
    current?.sheet.close(null);
    let cursor = Math.min(Math.max(0, Number.parseInt(start, 10) || 0), list.length - 1);
    const many = list.length > 1;

    const body = document.createElement('div');
    body.className = 'cg-viewer';
    body.innerHTML = `
        <div class="cg-viewer-stage">
            <img class="cg-viewer-img" alt="" decoding="async">
            <span class="cg-viewer-wait" hidden><span class="cg-spinner"></span></span>
            <p class="cg-viewer-error" hidden><i class="fa-solid fa-link-slash" aria-hidden="true"></i> 그림을 불러오지 못했어요</p>
        </div>
        <div class="cg-viewer-bar">
            <button type="button" class="cg-viewer-btn" data-viewer="prev" aria-label="이전 그림"${many ? '' : ' hidden'}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <div class="cg-viewer-info" aria-live="polite"><b class="cg-viewer-count"></b><span class="cg-viewer-size"></span></div>
            <button type="button" class="cg-viewer-btn" data-viewer="prompt" aria-expanded="false" aria-label="그림 태그 보기"><i class="fa-solid fa-tag" aria-hidden="true"></i></button>
            <a class="cg-viewer-btn" data-viewer="raw" target="_blank" rel="noopener noreferrer" aria-label="원본 그림을 새 탭에서 열기"><i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i></a>
            <button type="button" class="cg-viewer-btn" data-viewer="next" aria-label="다음 그림"${many ? '' : ' hidden'}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
        <pre class="cg-image-prompt cg-viewer-prompt" hidden></pre>`;

    const stage = body.querySelector('.cg-viewer-stage');
    const img = body.querySelector('.cg-viewer-img');
    const wait = body.querySelector('.cg-viewer-wait');
    const error = body.querySelector('.cg-viewer-error');
    const count = body.querySelector('.cg-viewer-count');
    const size = body.querySelector('.cg-viewer-size');
    const raw = body.querySelector('[data-viewer="raw"]');
    const promptButton = body.querySelector('[data-viewer="prompt"]');
    const promptBox = body.querySelector('.cg-viewer-prompt');
    let zoom = null;

    const sheet = openSheet({
        title: '붙인 그림',
        subtitle: list[cursor].label ?? '',
        icon: 'fa-image',
        size: 'lg',
        className: 'cg-image-sheet cg-viewer-sheet',
        body,
        dismissOnBackdrop: true,
        onClose: () => {
            zoom?.destroy();
            if (current?.sheet === sheet) current = null;
        },
    });

    // 화면에 맞춘 크기 대비 원본 크기 (1 이하면 원본이 화면보다 작다)
    const nativeRatio = () => (img.naturalWidth && img.clientWidth ? img.naturalWidth / img.clientWidth : 1);
    zoom = attachZoom({
        element: sheet.overlay,
        stage,
        img,
        onSwipe: delta => step(delta),
        // 원본 해상도의 2배까지 (작은 그림도 5배까지는 확대된다)
        maxScale: () => nativeRatio() * 2,
        // 두 번 톡 = 원본 해상도 1:1 (원본이 화면보다 조금 크거나 작으면 2배)
        doubleScale: () => (nativeRatio() >= 1.25 ? nativeRatio() : 2),
    });

    function show() {
        const item = list[cursor];
        zoom.clear();
        error.hidden = true;
        wait.hidden = false;
        img.hidden = false;
        img.removeAttribute('src');
        img.src = item.url;
        raw.href = item.url;
        count.textContent = many ? `${cursor + 1} / ${list.length}` : '';
        size.textContent = '';
        const subtitle = sheet.element.querySelector('.cg-sheet-subtitle');
        if (subtitle) subtitle.textContent = item.label ?? '';
        const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
        promptButton.hidden = !prompt;
        promptBox.textContent = prompt;
        if (!prompt) {
            promptBox.hidden = true;
            promptButton.setAttribute('aria-expanded', 'false');
        }
        // 옆 그림은 미리 받아 둔다 (넘길 때 빈 화면이 덜 보이게) — 둘만
        if (many) for (const near of [cursor + 1, cursor - 1]) { const next = list[(near + list.length) % list.length]; if (next !== item) new Image().src = next.url; }
    }

    function step(delta) {
        if (!many) return;
        cursor = (cursor + delta + list.length) % list.length;
        show();
    }

    img.addEventListener('load', () => {
        wait.hidden = true;
        size.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    });
    img.addEventListener('error', () => {
        if (!img.getAttribute('src')) return;
        wait.hidden = true;
        img.hidden = true;
        error.hidden = false;
    });

    body.addEventListener('click', (event) => {
        const action = event.target.closest('[data-viewer]')?.dataset.viewer;
        if (action === 'prev') return step(-1);
        if (action === 'next') return step(1);
        if (action === 'prompt') {
            const open = promptBox.hidden;
            promptBox.hidden = !open;
            promptButton.setAttribute('aria-expanded', String(open));
            return;
        }
        if (action) return;
        // 그림 밖 어두운 곳을 톡 = 닫기 (끌기 · 두 손가락 · 두 번 톡 뒤 따라오는 click 은 빼고, 확대 중에는 닫지 않는다)
        if (event.target === stage && !zoom.quiet() && !zoom.zoomed()) sheet.close(null);
    });

    current = { sheet, step };
    show();
    return sheet;
}

// ← → 로 넘기기. 북마크 창이 열려 있으면 preview-guard 가 실리태번 스와이프로 새지 않게 막아 두므로 여기서는 넘기기만 한다
window.addEventListener('keydown', (event) => {
    if (!current || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    if (event.target?.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
    event.preventDefault();
    current.step(event.key === 'ArrowLeft' ? -1 : 1);
}, true);

/** 지금 보이는 그림 칸들 → 크게 보기 목록 (패널의 카드 · 격자 공용) */
export function viewerItemsFrom(entries) {
    return entries.map(({ image, label }) => ({ src: image.src, prompt: image.prompt, label }));
}
