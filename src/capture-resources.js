// 형광펜 띠를 캡처에 '보이는 대로' 옮긴다.
// 화면의 띠(프롬프트 색 형광펜 · 감정 대사 색 흐름)는 바탕색 + 마스크 두 층(글자 층 + 붓자국 그림)인데, SVG 그림 안에서는
// 글자 모양 마스크(-webkit-mask-clip: text)가 먹지 않아 띠가 불투명한 진한 색으로 나왔다. 그래서 붓자국 그림(투명도 포함)에
// 띠 색을 직접 칠한 배경 그림으로 바꿔 적는다. 색이 흐르는 띠는 그 순간의 위치로 그라데이션을 굽는다.
export function bakeMarker(style, target) {
    if (!style.getPropertyValue('-webkit-mask-clip').includes('text')) return;
    const hit = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image'));
    if (!hit) return;
    let svg; try { svg = decodeURIComponent(hit[1]); } catch { return; }
    const last = value => value.split(/,(?![^(]*\))/).at(-1).trim();
    const stops = /linear-gradient\(/.test(style.backgroundImage) ? [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => m[0]) : [];
    if (stops.length > 1) {
        const span = Math.max(1, (parseFloat(style.backgroundSize) || 100) / 100), at = (parseFloat(style.backgroundPositionX) || 0) / 100;
        const x1 = -at * (span - 1);
        const flow = `<linearGradient id='bl-flow' x1='${x1}' x2='${x1 + span}' y1='0' y2='0'>${stops.map((c, i) => `<stop offset='${i / (stops.length - 1)}' stop-color='${c}'/>`).join('')}</linearGradient>`;
        svg = svg.replace(/(<svg[^>]*>)/, `$1<defs>${flow}</defs>`).replace(/fill='(?!url|none)[^']*'/g, "fill='url(#bl-flow)'").replace(/stop-color='[^']*'(?=[^>]*stop-opacity)/g, `stop-color='${stops[Math.floor(stops.length / 2)]}'`);
    } else {
        const color = style.backgroundColor;
        svg = svg.replace(/fill='(?!url|none)[^']*'/g, `fill='${color}'`).replace(/stop-color='[^']*'/g, `stop-color='${color}'`);
    }
    target.setProperty('background-color', 'transparent');
    target.setProperty('background-image', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    target.setProperty('background-size', last(style.getPropertyValue('mask-size')));
    target.setProperty('background-repeat', last(style.getPropertyValue('mask-repeat')));
    target.setProperty('background-position', last(style.getPropertyValue('mask-position')));
    target.setProperty('-webkit-mask', 'none'); target.setProperty('mask', 'none');
}

// One export batch owns this snapshot. Never retain private images across exports.
export function createCaptureResources() {
    let styles = new WeakMap(), bytes = 0, closed = false;
    const images = new Map(), limit = 24 * 1024 * 1024;
    return {
        paint(source, clone) {
            if (closed) throw new DOMException('캡처를 취소했어요.', 'AbortError');
            let entry = styles.get(source);
            if (!entry) {
                const style = getComputedStyle(source);
                for (const property of style) clone.style.setProperty(property, style.getPropertyValue(property));
                bakeMarker(style, clone.style);
                if (source.tagName === 'Q' && ['none', 'normal', '""', "''"].includes(getComputedStyle(source, '::before').content)) clone.style.quotes = 'none';
                entry = { css: clone.style.cssText, background: style.backgroundImage };
                styles.set(source, entry);
            } else clone.style.cssText = entry.css;
            return entry.background;
        },
        embed(url, signal) {
            signal?.throwIfAborted();
            if (closed) return Promise.reject(new DOMException('캡처를 취소했어요.', 'AbortError'));
            if (url.startsWith('data:')) return Promise.resolve(url);
            if (images.has(url)) return images.get(url).promise;
            const entry = { bytes: 0, promise: null };
            entry.promise = (async () => {
                try {
                    const response = await fetch(url, { signal });
                    if (!response.ok) throw Error('이미지를 읽지 못했어요. 불러온 이미지를 확인해 주세요.');
                    const blob = await response.blob();
                    signal?.throwIfAborted();
                    const result = await new Promise((resolve, reject) => {
                        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
                    });
                    signal?.throwIfAborted();
                    if (!closed && images.get(url) === entry) {
                        entry.bytes = result.length * 2; bytes += entry.bytes;
                        for (const [key, value] of images) {
                            if (bytes <= limit) break;
                            if (value.bytes) { bytes -= value.bytes; images.delete(key); }
                        }
                    }
                    return result;
                } catch (error) {
                    if (images.get(url) === entry) images.delete(url);
                    throw error;
                }
            })();
            images.set(url, entry); return entry.promise;
        },
        close() { closed = true; styles = new WeakMap(); images.clear(); bytes = 0; },
    };
}
