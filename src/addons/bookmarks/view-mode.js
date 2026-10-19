// 북마크 1.7.0 (7.2.7) — 보기 고르기(글만 · 글+그림 · 그림만)와 생각 칸 숨김 판정.
// 실리태번을 import 하지 않는 순수 함수라 node 로 시험한다 (tools/tests/bookmark-view-727.mjs).
import { imageList } from './images.js';
import { excerptList } from './excerpts.js';

/** 보기: text = 글만 (발췌 · 메시지 북마크, 그림 없이) · all = 글+그림 (예전 그대로) · images = 그림만 (격자) */
export const VIEW_MODES = Object.freeze(['text', 'all', 'images']);
export const VIEW_LABELS = Object.freeze({ text: '글만', all: '글+그림', images: '그림만' });

export function normalizeViewMode(value) {
    return VIEW_MODES.includes(value) ? value : 'all';
}

/**
 * 그림만 있는 북마크인가 — 다른 확장이 그림을 붙이며 만든 북마크(blImageBorn)에 메모 · 발췌가 없는 것.
 * 사용자가 손으로 단 별표(메시지 북마크)는 나중에 그림이 붙어도 글 북마크로 본다.
 */
export function isImageOnly(fav) {
    if (!fav || typeof fav !== 'object' || fav.blImageBorn !== true) return false;
    if (!imageList(fav).length) return false;
    return !String(fav.note ?? '').trim() && !excerptList(fav).length;
}

/** 글만 보기에 나오는가 */
export function hasText(fav) {
    return !!fav && typeof fav === 'object' && !isImageOnly(fav);
}

/** 그 보기에 나올 북마크만 ([{ fav, index }] 순서 그대로) */
export function filterForView(items, mode) {
    const view = normalizeViewMode(mode);
    if (view === 'text') return items.filter(item => hasText(item.fav));
    if (view === 'images') return items.filter(item => imageList(item.fav).length > 0);
    return items;
}

/** 그림만 보기의 칸: 북마크마다 붙인 차례로 그림 하나씩 → [{ fav, index, image }] */
export function imageTiles(items) {
    return items.flatMap(item => imageList(item.fav).map(image => ({ fav: item.fav, index: item.index, image })));
}

/** 보기 기준 개수 — 글만 = 글 북마크 수 · 글+그림 = 북마크 수 · 그림만 = 그림 수 */
export function viewCount(favorites, mode) {
    const list = Array.isArray(favorites) ? favorites.filter(fav => fav && typeof fav === 'object') : [];
    const view = normalizeViewMode(mode);
    if (view === 'text') return list.filter(hasText).length;
    if (view === 'images') return list.reduce((sum, fav) => sum + imageList(fav).length, 0);
    return list.length;
}

/** 머리 줄 글: 「북마크 N개」 · 「글 북마크 N개」 · 「그림 N개」 */
export function countLabel(count, mode) {
    const view = normalizeViewMode(mode);
    return `${view === 'images' ? '그림' : view === 'text' ? '글 북마크' : '북마크'} ${count}개`;
}

/**
 * 생각 칸을 숨기는가 — 채팅과 같은 규칙.
 * 블루 레몬에이드는 실리태번 「모델 추론 요청」(Request model reasoning · 채팅 완성 프리셋의 show_thoughts, #openai_show_thoughts)이
 * 꺼져 있으면 body 에 salty-reasoning-off 를 붙여 채팅의 지난 생각 칸(.mes_reasoning_details)을 가린다
 * (apply.js stReasoningOff · 채팅 › 화면 「추론 요청을 끄면 지난 추론도 숨기기」 chat.reasoningFollow · 테마가 켜져 있을 때).
 * 북마크 카드 · 앞뒤 문맥 창도 같은 클래스를 그대로 따른다 — 채팅에 생각 칸이 보이면 여기도 보이고, 숨으면 여기도 숨는다.
 */
export function reasoningHidden(body = globalThis.document?.body) {
    return !!body?.classList?.contains?.('salty-reasoning-off');
}
