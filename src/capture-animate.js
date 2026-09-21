// 움직이는 캡처 (영상 · 움짤): 채팅에서 돌고 있는 CSS 애니메이션(데우스 감정 대사 등)을 그대로 담는다.
//
// 캡처는 메시지 사본에 계산된 모양을 전부 인라인으로 적고 SVG 그림 한 장으로 굽는다 — 그 안에는 키프레임이 없어 글자가 멈춘다.
// 그래서 움직이는 칸만 따로 다룬다:
//   1. 바탕 그림에서는 그 칸을 숨긴다 (자리 · 말풍선 바탕은 그대로).
//   2. 칸이 든 문단을 떼어 작은 조각 문서로 만들고(그 칸만 보이게), 원본 애니메이션의 시간을 프레임마다 옮겨 가며
//      계산값(이동 · 회전 · 크기 · 필터 · 투명도 · 빛 · 색 흐름 위치)을 조각 사본에 적어 한 주기를 굽는다.
//   3. 영상 · 움짤은 바탕 위에 조각을 제자리에 그린다. 애니메이션마다 주기가 달라도 한 바퀴(LOOP) 안에 정수 번 돌게 시간을 맞춰 이음매가 없다.
// 원본 메시지는 시간만 잠깐 옮겼다가 돌려놓는다. 글 · 저장 데이터는 건드리지 않는다.

import { bakeMarker } from './capture-resources.js';

const PROPS = ['translate', 'rotate', 'scale', 'transform', 'filter', 'opacity', 'background-position', 'text-shadow', 'letter-spacing'];
const LOOP = 3000;       // 한 바퀴(ms)
const MARGIN = 28;       // 조각 위아래 여유(px) — 튀어 오름 · 기울기 · 빛이 잘리지 않게
const MAX_UNITS = 16;
const BUDGET = 96 * 1024 * 1024; // 조각 그림 메모리 상한

const endless = a => a.playState === 'running' && a.effect?.getComputedTiming?.().iterations === Infinity;
const pathTo = (root, el) => { const path = []; for (let n = el; n && n !== root; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n)); return path; };
const follow = (root, path) => path.reduce((n, i) => n?.children[i], root);
function setVisibility(root, value) { for (const el of [root, ...root.querySelectorAll('*')]) el.style?.setProperty('visibility', value, 'important'); }

/** 방금 만든 사본에서: 원본의 움직이는 칸(가장 바깥 것)과 짝이 되는 사본 칸을 찾아 둔다. 사본을 고치기 전에 불러야 자리가 맞는다 */
export function collectAnimated(source, clone) {
    const body = source.querySelector('.mes_text');
    if (!body || typeof body.getAnimations !== 'function') return [];
    const moving = [...body.querySelectorAll('*')].filter(el => el.getAnimations().some(endless));
    const roots = moving.filter(el => !moving.some(other => other !== el && other.contains(el)));
    return roots.slice(0, MAX_UNITS).map(el => ({ source: el, clone: follow(clone, pathTo(source, el)) })).filter(pair => pair.clone?.style);
}

/**
 * 바탕을 굽기 직전에 부른다. 조각 문서를 떼어 두고 바탕에서는 그 칸을 숨긴다.
 * @returns {null | {units: object[], render: Function, close: Function}}
 */
export function prepareAnimated(pairs, wrapper, page, fonts) {
    const origin = wrapper.getBoundingClientRect();
    const units = [];
    for (const pair of pairs) {
        if (!pair.clone.isConnected || !wrapper.contains(pair.clone)) continue; // 캡처용 글 편집으로 본문이 바뀐 메시지
        const block = pair.clone.closest('p, li, blockquote, td, h1, h2, h3, h4, h5, h6') || pair.clone.parentElement;
        const rect = block.getBoundingClientRect();
        const top = rect.top - origin.top - MARGIN, height = rect.height + MARGIN * 2;
        if (rect.width < 2 || rect.height < 2 || top + height <= page.top || top >= page.top + page.height) continue;
        const sourceParts = [pair.source, ...pair.source.querySelectorAll('*')];
        const piece = block.cloneNode(true);
        const target = follow(piece, pathTo(block, pair.clone));
        if (!target) continue;
        setVisibility(piece, 'hidden');
        setVisibility(target, 'visible');
        for (const [key, value] of Object.entries({ position: 'absolute', left: `${rect.left - origin.left}px`, top: `${MARGIN}px`, width: `${rect.width}px`, margin: '0', 'box-sizing': 'border-box' })) piece.style.setProperty(key, value, 'important');
        let targetParts = [target, ...target.querySelectorAll('*')];
        if (targetParts.length !== sourceParts.length) targetParts = [target]; // 이름 가리기 등으로 안쪽이 달라졌으면 칸 자신만 움직인다
        units.push({ top, height, piece, sourceParts: sourceParts.slice(0, targetParts.length), targetParts });
    }
    if (!units.length) return null;
    for (const pair of pairs) if (pair.clone.isConnected) setVisibility(pair.clone, 'hidden');
    const width = origin.width;
    const style = `<style>${fonts.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>`;
    const serializer = new XMLSerializer();

    /** 한 바퀴를 frames 장으로. scale = 내보낼 그림의 배율(css px → px). 돌려주는 값: 조각마다 { y, height, images[] } (px) */
    async function render(scale, frames, progress = () => {}, signal = null) {
        const count = Math.max(2, Math.min(frames, Math.floor(BUDGET / Math.max(1, units.reduce((sum, u) => sum + Math.ceil(width * scale) * Math.ceil(u.height * scale) * 4, 0)))));
        const animations = units.flatMap(u => u.sourceParts.flatMap(el => el.getAnimations().filter(endless)));
        const saved = animations.map(a => ({ a, time: a.currentTime }));
        const cycles = new Map(animations.map((a) => {
            const timing = a.effect.getComputedTiming();
            const cycle = Math.max(50, Number(timing.duration) || 1000) * (String(timing.direction).startsWith('alternate') ? 2 : 1);
            return [a, cycle * Math.max(1, Math.round(LOOP / cycle))]; // 한 바퀴 동안 정수 번
        }));
        const out = units.map(u => ({ y: (u.top - page.top) * scale, height: Math.ceil(u.height * scale), images: [] }));
        try {
            for (let k = 0; k < count; k++) {
                signal?.throwIfAborted();
                for (const a of animations) { a.pause(); a.currentTime = (k / count) * cycles.get(a); }
                for (const [i, unit] of units.entries()) {
                    unit.sourceParts.forEach((el, n) => {
                        const live = getComputedStyle(el), to = unit.targetParts[n].style;
                        for (const prop of PROPS) to.setProperty(prop, live.getPropertyValue(prop));
                        to.setProperty('animation', 'none');
                        bakeMarker(live, to); // 색이 흐르는 형광펜 띠는 프레임마다 그 순간의 위치로 다시 굽는다
                    });
                    const html = serializer.serializeToString(unit.piece);
                    const pw = Math.ceil(width * scale), ph = out[i].height;
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${width} ${unit.height}"><foreignObject width="${width}" height="${unit.height}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${unit.height}px">${style}${html}</div></foreignObject></svg>`;
                    const image = new Image();
                    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(Error('움직이는 글자를 그리지 못했어요.')); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
                    // SVG 그림에서 바로 만든 ImageBitmap 은 크롬이 '외부 그림'으로 쳐서 캔버스를 읽을 수 없게 만든다 → 바탕 그림과 같은 길(캔버스에 그린 뒤)로
                    const sheet = document.createElement('canvas'); sheet.width = pw; sheet.height = ph;
                    sheet.getContext('2d').drawImage(image, 0, 0, pw, ph);
                    out[i].images.push(await createImageBitmap(sheet));
                    sheet.width = sheet.height = 1;
                }
                progress(`움직이는 글자 준비 중… ${k + 1} / ${count}장`);
            }
        } finally {
            for (const { a, time } of saved) { try { a.currentTime = time; a.play(); } catch { /* 메시지가 사라짐 */ } }
        }
        return { loop: LOOP, count, pieces: out };
    }
    return { units, render, close() { units.length = 0; } };
}

/** prepareMotion 의 draw 가 프레임마다 부른다 */
export function drawAnimated(ctx, rendered, elapsedSeconds, offsetY = 0) {
    const k = Math.floor(((elapsedSeconds * 1000) % rendered.loop) / rendered.loop * rendered.count) % rendered.count;
    for (const piece of rendered.pieces) { const image = piece.images[k]; if (image) ctx.drawImage(image, 0, piece.y - offsetY, ctx.canvas.width, piece.height); }
}

export function closeAnimated(rendered) {
    for (const piece of rendered?.pieces || []) { for (const image of piece.images) image.close?.(); piece.images.length = 0; }
}
