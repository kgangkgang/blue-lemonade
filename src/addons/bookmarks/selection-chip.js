// 북마크 — 채팅에서 글을 고르면 아래에 뜨는 고른 글 도구 줄(src/selection-bar.js)의 「북마크」 단추
// 줄 · 자리 · 누르는 순간 모양 뜨기는 테마의 도구 줄이 맡고, 여기서는 한 메시지 안 선택일 때 단추를 올리고 그 글을 담는다.
// 여러 메시지에 걸친 선택에는 북마크 단추가 없다 (로그 복사만).
import { captureExcerpt } from './excerpt-capture.js';
import { registerSelectionTool, hideSelectionBar, refreshSelectionBar } from '../../selection-bar.js';

let options = null;

export function hideSelectionChip({ forget = true } = {}) {
    hideSelectionBar({ forget });
}

/**
 * @param {{ enabled: () => boolean, iconName: () => string, onBookmark: (info: { index: number, root: Element, excerpt: object }) => Promise<void> }} config
 */
export function startSelectionChip(config) {
    if (options) { options = config; refreshSelectionBar(); return; }
    options = config;
    registerSelectionTool({
        id: 'bookmark',
        order: 10,
        label: '북마크',
        aria: '고른 글 북마크',
        icon: () => options?.iconName?.() ?? 'fa-star',
        enabled: () => !!options?.enabled?.(),
        accepts: target => target.single === true,
        capture: target => captureExcerpt(target.range, target.root),
        run: ({ target, captured }) => options?.onBookmark?.({ index: target.index, root: target.root, excerpt: captured }),
    });
}
