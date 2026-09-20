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
