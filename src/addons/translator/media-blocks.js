// 1.1.3 그림 · 영상 조각 — 번역 요청에 보내지 않고 제자리에 원문 그대로 둬요 (hidden-blocks.js HIDDEN_BLOCKS 맨 뒤 → index.js getCombinedRegexes 맨 뒤).
//   그림 확장이 넣은 <img> 는 7.2.4 부터 가렸지만, <video> · <audio> · <svg> · <iframe> 같은 태그와 글에 맨몸으로 박힌 base64 그림 ·
//   마크다운 그림 ![…](…) 은 모델에게 그대로 갔어요. 모델이 태그를 빼먹거나 속성 글을 「번역」하면 그림이 깨졌어요.
//   맨 뒤에 붙어서, 이런 조각이 없는 답의 [[__VAR_n__]] 번호 · 문단 캐시 키는 예전 그대로예요.
//   (기능 아이디어: ST-Interpres 1.5.1 「답변 수정 시 그림이 사라지던 문제」 — 코드는 옮기지 않고 이 번역기 구조로 새로 씀)
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-media-blocks.mjs).
import { PIC_REQUEST, AUTOPIC_REQUEST } from './picture-swap.js';

const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
export const MEDIA_BLOCKS = Object.freeze([
    // 짝이 있는 미디어 요소는 통째로 (안의 <source> · 대체 글 포함)
    new RegExp(String.raw`<(video|audio|picture|svg|iframe|object|canvas)\b${ATTRS}>[\s\S]*?<\/\1\s*>`, 'gi'),
    // 홀로 쓰인 미디어 태그 — 속성 안의 '>' 에도 끊기지 않게
    new RegExp(String.raw`<(?:video|audio|source|embed|iframe)\b${ATTRS}>`, 'gi'),
    // 마크다운 그림
    /!\[[^\]\n]*\]\([^)\n]*\)/g,
    // 글에 맨몸으로 박힌 data URI 그림 (태그 안의 것은 앞 규칙 · <img> 규칙이 이미 가렸어요)
    /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{16,}/gi,
]);

const IMG = new RegExp(String.raw`<img\b${ATTRS}>`, 'gi');
const WHOLE = [IMG, PIC_REQUEST, AUTOPIC_REQUEST, ...MEDIA_BLOCKS];
/** 글 전체가 그림 · 영상 조각 하나인가 — 모델이 자리표시를 빠뜨려도 원문 문단 자리에 되돌릴 블록 (hidden-blocks.js isHiddenBlock → index.js droppedPlaceholders) */
export function isMediaBlock(block) {
    const value = String(block ?? '');
    if (!value.trim()) return false;
    return WHOLE.some(rule => {
        const m = new RegExp(rule.source, rule.flags.replace('g', '')).exec(value);
        return m?.index === 0 && m[0] === value;
    });
}
