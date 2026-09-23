// 성능 보조 — 스트리밍 중 바뀐 곳만 다시 그리기
//
// 실리태번은 스트리밍 한 걸음마다(streaming_fps) 답 전체를 messageFormatting 으로 다시 만들고
// `.mes_text.innerHTML = …` 로 통째로 갈아 끼운다(스트리밍 페이드 인이 꺼져 있을 때). 요소 · <style> 이 매번 새로 생기니
// 브라우저는 답 전체를 다시 스타일 계산하고(데우스 카드의 <style> 6개도 다시 적용), keyboard.js · a11y.js 의 body 관찰자는
// 새로 생긴 요소마다 선택자 수십 개로 다시 훑는다.
// 여기서는 지금 스트리밍 중인 그 `.mes_text` 요소 하나에만 innerHTML 세터를 인스턴스 속성으로 덮어,
// 같은 HTML 을 떼어 둔 복제본에 원래 세터로 파싱한 뒤 morphdom(실리태번 lib.js 에 들어 있는 것)으로 바뀐 곳만 옮긴다.
// 결과 DOM 의 직렬화는 innerHTML 대입과 같다(시험 · 실제 턴에서 틱마다 비교). 스트림이 끝나면 곧바로 속성을 지운다.
//
// 안전장치: 이 요소 · 이 스트림(processor.messageTextDom 이 이 요소이고 멈추지 않음)이 아니면 원래 세터를 그대로 부른다.
// morphdom 이 던지면 원래 세터로 다시 쓰고 이번 스트림에서는 손을 뗀다. <template> 가 든 HTML 은 원래 세터로.
// 다른 확장이 걸음 사이에 넣은 요소(▲ 접기 버튼 · 그림 등)는 고쳐 쓰지 않고 뺀다 — 그 요소에 달린 누름 처리가
// 자리가 같은 본문 요소로 옮겨 붙지 않게 (통째로 갈아 끼울 때처럼 버려진다).
// 다른 확장이 속성을 바꾼 요소(테마가 그림 틀에 붙인 salty-asset · 색 맞춤 등)도 고쳐 쓰지 않고 새 요소로 갈아 끼운다 —
// morphdom 이 그 속성만 지우면 "새 요소가 들어옴"을 보고 다시 붙이는 관찰자가 알아채지 못해, 답이 끝난 뒤에도 빠진 채 남았다.

/**
 * morphdom 옵션: 자식만 옮기고, id 로 요소를 짝짓지 않는다(자리 순서로만 비교).
 * 기본값(id 짝짓기)은 같은 id 가 두 번 나오는 HTML 뒤에 옛 요소 하나를 남겨 innerHTML 결과와 달라졌다 (자체 시험에서 잡힘).
 * 우리가 그리지 않은 요소(drawn 에 없음)에는 저마다 다른 열쇠를 줘서, 열쇠 없는 새 요소와 짝지어지지 않고 끝에 지워지게 한다.
 * 예전에는 열린 <details> 끝의 ▲ 버튼(div)이 다음 걸음에 새로 생긴 본문 div 로 고쳐 쓰여, 그 줄을 누르면 카드가 접혔다.
 * 4.8.3: 걸음마다 답 전체(수백 요소)를 훑어 지도를 만들지 않는다 — 첫 걸음(붙이기 전부터 있던 것 전부가 남의 것)만 통째로 보고,
 * 그 뒤로는 관찰자가 본 것(남이 새로 넣은 요소와 그 아래 · 남이 속성을 바꾼 요소)만 열쇠를 준다. 남의 요소는 걸음마다 지워지므로
 * (열쇠 없는 새 요소와 짝지어지지 않아 끝에 버려진다) 지난 걸음의 남의 요소가 남아 있을 일은 없다. 폰 리그 답 하나 0.76s@4x 의 큰 몫.
 * @param {Element} el 스트리밍 중인 .mes_text
 * @param {WeakSet<Element>} drawn 지난 걸음들에서 morphdom 이 넣거나 맞춘 요소
 * @param {{ added: Element[], touched: Element[] } | null} [seen] 관찰자가 본 것 (null 이면 첫 걸음: 전부 훑는다)
 */
export function morphOptions(el, drawn, seen = null) {
    const foreign = new Map();
    let n = 0;
    const mark = (node) => { if (!drawn.has(node) && !foreign.has(node)) foreign.set(node, `pa-foreign-${n++}`); };
    if (seen === null) {
        if (typeof el?.getElementsByTagName === 'function') {
            const all = el.getElementsByTagName('*');
            for (let i = 0; i < all.length; i++) mark(all[i]);
        }
    } else {
        for (const root of seen.added) {
            if (root === el || !el.contains(root)) continue;
            mark(root);
            const all = root.getElementsByTagName('*');
            for (let i = 0; i < all.length; i++) mark(all[i]);
        }
        for (const node of seen.touched) if (node !== el && el.contains(node)) mark(node);
    }
    return {
        childrenOnly: true,
        getNodeKey: node => foreign.get(node),
        onNodeAdded: (node) => {
            if (node.nodeType === 1) drawn.add(node);
            return node;
        },
        onElUpdated: (node) => { drawn.add(node); },
        foreign: foreign.size,
    };
}

/**
 * 스트리밍 중인 요소 아래에서 남이 속성을 바꾼 요소를 모은다. 우리가 morphdom 으로 바꾼 것은 skip() 으로 버린다.
 * @param {typeof MutationObserver} MO
 * @param {Element} el
 */
function watchAttributes(MO, el) {
    const touched = new Set();
    const added = new Set();   // 4.8.3: 남이 걸음 사이에 넣은 요소 (morphdom 이 넣은 것은 skip() 으로 버린다)
    const note = (record) => {
        if (record.type === 'childList') { for (const node of record.addedNodes) if (node.nodeType === 1) added.add(node); }
        else touched.add(record.target);
    };
    const observer = new MO((records) => { for (const record of records) note(record); });
    observer.observe(el, { attributes: true, childList: true, subtree: true });
    return {
        /** @returns {{ added: Element[], touched: Element[] }} */
        take() {
            for (const record of observer.takeRecords()) note(record);
            const out = { added: [...added], touched: [...touched] };
            added.clear();
            touched.clear();
            return out;
        },
        skip() { observer.takeRecords(); },
        stop() {
            observer.disconnect();
            added.clear();
            touched.clear();
        },
    };
}

/**
 * @param {object} env
 * @param {Function} env.morphdom
 * @param {PropertyDescriptor} env.descriptor Element.prototype 의 innerHTML 속성 설명자
 * @param {typeof MutationObserver} env.MutationObserver
 * @param {() => boolean} env.enabled
 * @param {(error: unknown) => void} [env.onFallback]
 */
export function createStreamMorph(env) {
    const desc = env.descriptor;
    const stats = { streams: 0, ticks: 0, native: 0, fallbacks: 0, foreign: 0, touched: 0 };
    /** @type {{ el: Element, processor: any, drawn: WeakSet<Element>, attrs: ReturnType<typeof watchAttributes>, fresh: boolean } | null} */
    let current = null;

    function usable() {
        return typeof env.morphdom === 'function' && typeof env.MutationObserver === 'function'
            && !!desc && typeof desc.get === 'function' && typeof desc.set === 'function';
    }

    function ours(el) {
        const own = Object.getOwnPropertyDescriptor(el, 'innerHTML');
        return !!own && own.set === morphSetter;
    }

    /** 덮어쓴 속성을 지운다 (우리 것일 때만) */
    function release() {
        const state = current;
        current = null;
        try { state?.attrs.stop(); } catch { /* */ }
        if (state && ours(state.el)) delete state.el.innerHTML;
    }

    function nativeSet(el, value) {
        stats.native++;
        desc.set.call(el, value);
    }

    function morphSetter(value) {
        const state = current;
        const live = state && state.el === this && env.enabled()
            && state.processor && !state.processor.isStopped && state.processor.messageTextDom === this;
        if (!live) {
            if (state && state.el === this) release();
            else if (ours(this)) delete this.innerHTML;
            nativeSet(this, value);
            return;
        }
        const html = String(value);
        if (html.includes('<template')) {
            nativeSet(this, html);
            return;
        }
        const target = this.cloneNode(false);
        desc.set.call(target, html);
        try {
            // 지난 걸음 뒤 남이 속성을 바꾼 요소는 '우리가 그린 것'에서 빼서 새로 갈아 끼우게 한다
            const seen = state.attrs.take();
            for (const node of seen.touched) {
                if (node !== this && state.drawn.delete(node)) stats.touched++;
            }
            const options = morphOptions(this, state.drawn, state.fresh ? null : seen);
            stats.foreign += options.foreign;
            env.morphdom(this, target, options);
            state.attrs.skip();
            state.fresh = false;
            stats.ticks++;
        } catch (error) {
            stats.fallbacks++;
            release();
            desc.set.call(this, html);
            try { env.onFallback?.(error); } catch { /* 알림만 */ }
            return;
        }
        // 마지막 걸음(끝났거나 멈춤으로 끝난 뒤 한 번 더 그리는 것)까지 옮겼으면 바로 뗀다
        if (state.processor.isFinished) release();
    }

    /**
     * 스트리밍 중인 processor 의 messageTextDom 에 붙인다. 이미 같은 요소면 그대로.
     * @returns {boolean} 붙였거나 이미 붙어 있으면 true
     */
    function attach(processor) {
        if (!usable() || !env.enabled()) return false;
        const el = processor?.messageTextDom;
        if (!el || typeof el.cloneNode !== 'function' || !el.isConnected) return false;
        if (processor.type === 'impersonate' || processor.isStopped || processor.isFinished) return false;
        if (current && current.el === el && current.processor === processor) return true;
        release();
        // 다른 누군가 이미 이 요소의 innerHTML 을 덮었으면 손대지 않는다
        if (Object.getOwnPropertyDescriptor(el, 'innerHTML')) return false;
        Object.defineProperty(el, 'innerHTML', {
            configurable: true,
            enumerable: false,
            get() { return desc.get.call(this); },
            set: morphSetter,
        });
        // 붙이기 전부터 있던 요소는 모두 '남이 넣은 것'으로 본다 → 첫 걸음은 통째로 갈아 끼우는 것과 같다
        current = { el, processor, drawn: new WeakSet(), attrs: watchAttributes(env.MutationObserver, el), fresh: true };
        stats.streams++;
        return true;
    }

    /**
     * 떼어 둔 요소로 innerHTML 대입과 결과가 같은지 확인한다 (못 쓰는 환경이면 false).
     * 걸음 사이에 다른 확장처럼 요소를 하나 끼워 넣어, 그 요소가 다음 걸음에서 빠지는지도 본다.
     * @param {() => Element} makeElement 문서에 붙지 않은 빈 요소를 만든다
     * @param {string[]} steps 차례로 넣어 볼 HTML
     */
    function selfTest(makeElement, steps) {
        if (!usable()) return false;
        try {
            const el = makeElement();
            const ref = makeElement();
            const drawn = new WeakSet();
            const attrs = watchAttributes(env.MutationObserver, el);
            let planted = null;
            let marked = null;
            let fresh = true;
            try {
                for (const html of steps) {
                    const seen = attrs.take();
                    for (const node of seen.touched) drawn.delete(node);
                    const target = el.cloneNode(false);
                    desc.set.call(target, html);
                    env.morphdom(el, target, morphOptions(el, drawn, fresh ? null : seen));
                    fresh = false;
                    attrs.skip();
                    desc.set.call(ref, html);
                    if (desc.get.call(el) !== desc.get.call(ref)) return false;
                    if (planted && el.contains(planted)) return false; // 남의 요소가 고쳐 쓰여 본문에 남음
                    if (marked && el.contains(marked)) return false; // 남이 속성을 바꾼 요소가 그 속성만 지워진 채 남음
                    marked = typeof el.querySelector === 'function' ? el.querySelector('details, div, p') : null;
                    if (marked) marked.setAttribute('data-pa-other', '1');
                    // 다음 걸음 전에 남의 요소 하나: 마지막 <details> (없으면 첫 요소) 안 맨 끝 (열린 카드 끝의 ▲ 버튼처럼)
                    const cards = typeof el.querySelectorAll === 'function' ? el.querySelectorAll('details') : [];
                    const host = cards.length ? cards[cards.length - 1] : (typeof el.querySelector === 'function' ? el.querySelector('*') : null);
                    planted = null;
                    if (host && typeof el.ownerDocument?.createElement === 'function') {
                        planted = el.ownerDocument.createElement('div');
                        host.appendChild(planted);
                    }
                }
            } finally {
                attrs.stop();
            }
            return true;
        } catch {
            return false;
        }
    }

    return { attach, release, selfTest, usable, stats, attached: () => current?.el ?? null };
}

/** 자체 시험용 HTML: 데우스 카드 모양(details/summary/style), 표, 코드, 인용, 그림, 입력 요소, 같은 id, 주석, SVG */
export const SELF_TEST_STEPS = [
    '<p>첫 줄</p>',
    '<p>첫 줄 이어서 <q>"대사</q></p><style>.x{color:red}</style>',
    '<details class="custom-dem-card" open><summary><span class="t">제목</span></summary><div class="b"><p>본문 <em>강조</em></p></div></details><style>.x{color:red}</style><p>첫 줄 이어서 <q>"대사"</q> 그리고</p>',
    '<details class="custom-dem-card"><summary><span class="t">제목</span><span class="tag">태그</span></summary><div class="b"><p>본문 <em>강조</em> 더</p><ul><li>하나</li><li>둘</li></ul></div></details><style>.x{color:red}</style><p id="a">첫 줄 이어서 <q>"대사"</q> 그리고 <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""></p><!-- 주석 --><br>',
    '<table><tbody><tr><td>1</td><td>2</td></tr></tbody></table><pre><code class="language-js">let a = 1;\n</code></pre><p id="a">같은 id</p><p id="a">같은 id 둘</p><input type="checkbox" checked><textarea>글\n자</textarea><select><option>a</option><option selected>b</option></select>',
    '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg><p>끝 &amp; &lt;표시&gt; &nbsp;</p><blockquote><p>인용</p></blockquote>',
    '',
    '<p>다시 처음</p>',
    // 열린 카드 안에 줄(div)이 하나씩 늘어난다 — 끝에 끼운 남의 div 가 새 줄로 고쳐 쓰이면 안 된다
    '<details open><summary>상태</summary><div class="custom-row">하나</div></details>',
    '<details open><summary>상태</summary><div class="custom-row">하나</div><div class="custom-row">둘</div></details>',
    '<details open><summary>상태</summary><div class="custom-row">하나</div><div class="custom-row">둘</div><div class="custom-row">셋</div></details><p>끝</p>',
];
