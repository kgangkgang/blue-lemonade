// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/fold.js 을 고치고 다시 만든다
export default function blueLemonadeScript(BlueLemonade) {
/*BL-SCRIPT-START*/
// ▲ 접기 (Tavern Helper 전역 스크립트)
// 펼친 접기 칸(<details>) 맨 아래에 ▲ 버튼을 붙인다. 누르면 칸을 접고, 제목 줄이 화면 밖으로
// 밀려났으면 버튼이 있던 자리로 되돌려 읽던 위치를 잃지 않게 한다.
//
// 대상
// - 채팅(#chat) 안의 모든 접기 칸: 답변 속 카드, 칸 속의 칸, 생각 과정 칸, 번역기 원문 칸
// - 메시지 본문(.mes_text)을 그리는 다른 화면: 북마크 패널, 앞뒤 문맥 창 등
// - 채팅 안 프런트엔드(iframe) 속 접기 칸
// 설정 패널처럼 메시지와 상관없는 접기 칸은 건드리지 않는다.
(() => {
  'use strict';

  const VERSION = '1.0.1';
  const LOG = '[▲ 접기]';
  const ST = window.parent ?? window;
  const stDoc = ST.document;
  const BTN = 'data-thk-fold';
  const STYLE = 'data-thk-fold-style';
  const INSTANCE = '__thkFold';
  const MARGIN = 8;
  const SWEEP_EVENTS = [
    'CHAT_CHANGED', 'MORE_MESSAGES_LOADED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED',
    'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_SWIPED', 'GENERATION_ENDED',
  ];

  // 같은 스크립트가 두 개 켜져 있어도 마지막 것만 동작한다.
  try {
    ST[INSTANCE]?.destroy();
  } catch (error) {
    console.warn(LOG, '이전 실행분 정리 실패', error);
  }

  const B = `details > .thk-fold[${BTN}]`;
  const CSS = `
${B} {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  width: 100% !important;
  min-height: 34px;
  margin: 4px 0 0 !important;
  padding: 4px 0 !important;
  position: static !important;
  float: none !important;
  visibility: visible !important;
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: none;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
${B}::before {
  content: '▲';
  display: inline-block;
  padding: 6px 20px;
  border-radius: 999px;
  font-family: inherit;
  font-size: calc(var(--mainFontSize, 15px) * 0.8);
  font-style: normal;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-box: trim-both cap alphabetic;
  color: var(--SmartThemeBodyColor, currentColor);
  background: rgba(128, 128, 128, 0.14);
  background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 10%, transparent);
  opacity: 0.7;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
@media (hover: hover) {
  ${B}:hover::before {
    opacity: 1;
    background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
  }
}
${B}:active::before,
${B}:focus-visible::before {
  opacity: 1;
  background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
}
${B}:focus-visible::before {
  outline: 2px solid var(--SmartThemeQuoteColor, currentColor);
  outline-offset: 2px;
}
`;
  // 예전 '▲' 스크립트(收回折叠)가 같이 켜져 있으면 그쪽 버튼은 숨긴다.
  const HIDE_OLD = 'details > .details-collapse-btn[data-collapse-btn] { display: none !important; }';

  let alive = true;
  let sweepTimer = 0;
  const docs = new Map(); // 연결한 문서 → 정리 함수
  const frames = new Set(); // load 리스너를 단 iframe
  const offs = []; // 실리태번 이벤트 해제 함수

  // ── 대상 판별 ─────────────────────────────────────────────

  // 메시지 내용에 속한 접기 칸인지. iframe 문서는 채팅 속 iframe만 연결하므로 전부 대상이다.
  function isTarget(details) {
    if (details.ownerDocument !== stDoc) return true;
    return !!(details.closest('#chat, .mes_text') || details.querySelector(':scope > .mes_text, :scope > .mes_reasoning'));
  }

  function buttonsOf(details) {
    return Array.from(details.children).filter(el => el.hasAttribute(BTN));
  }

  // 뒤에 공백 말고 다른 내용이 없으면 맨 아래에 있는 것이다.
  function isLast(node) {
    for (let next = node.nextSibling; next; next = next.nextSibling) {
      if (next.nodeType === 1) return false;
      if (next.nodeType === 3 && next.nodeValue.trim()) return false;
    }
    return true;
  }

  // 열린 칸에는 버튼 하나를 맨 아래에 두고, 닫힌 칸에서는 뗀다.
  function sync(details) {
    if (!alive || !details.isConnected || !isTarget(details)) return;
    const own = buttonsOf(details);
    if (!details.open) {
      own.forEach(button => button.remove());
      return;
    }
    if (own.length === 1 && isLast(own[0])) return;
    own.slice(1).forEach(button => button.remove());
    details.append(own[0] ?? makeButton(details.ownerDocument));
  }

  function scan(root) {
    root.querySelectorAll('details').forEach(sync);
    root.querySelectorAll('iframe').forEach(maybeFrame);
  }

  // ── 버튼 ──────────────────────────────────────────────────

  // 글자는 CSS로 그려서 복사·번역·읽어 주기에 섞이지 않게 한다.
  function makeButton(doc) {
    const button = doc.createElement('div');
    button.className = 'thk-fold';
    button.setAttribute(BTN, '');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', '접기');
    button.addEventListener('click', onButtonClick);
    button.addEventListener('keydown', onButtonKey);
    return button;
  }

  function onButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    fold(event.currentTarget);
  }

  function onButtonKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    fold(event.currentTarget)?.focus({ preventScroll: true });
  }

  function fold(button) {
    const details = button.parentElement;
    if (!details || details.localName !== 'details') return null;
    const summary = details.querySelector(':scope > summary');
    const target = summary ?? details;
    const anchor = viewportRect(button).top;
    const scrollers = scrollersOf(target);
    // 브라우저의 스크롤 고정이 위치 보정에 끼어들지 않게 잠시 끈다.
    const saved = scrollers.map(el => el.style.overflowAnchor);
    scrollers.forEach(el => { el.style.overflowAnchor = 'none'; });
    details.open = false;
    buttonsOf(details).forEach(el => el.remove());
    for (const scroller of scrollers) bringBack(scroller, target, anchor);
    setTimeout(() => scrollers.forEach((el, i) => { el.style.overflowAnchor = saved[i]; }), 150);
    return summary;
  }

  // ── 접은 뒤 위치 보정 ─────────────────────────────────────

  // 실리태번 창 기준 위치. iframe 안 요소면 iframe 위치를 더한다.
  function viewportRect(el) {
    const rect = el.getBoundingClientRect();
    let top = rect.top;
    for (let win = el.ownerDocument.defaultView; win && win !== ST && win.frameElement; win = win.parent) {
      const frame = win.frameElement;
      top += frame.getBoundingClientRect().top + frame.clientTop;
    }
    return { top, bottom: top + rect.height, height: rect.height };
  }

  function inStDoc(el) {
    let node = el;
    while (node.ownerDocument !== stDoc) {
      const frame = node.ownerDocument.defaultView?.frameElement;
      if (!frame) break;
      node = frame;
    }
    return node;
  }

  // 안쪽부터 바깥쪽까지 스크롤되는 상자들
  function scrollersOf(el) {
    const list = [];
    for (let p = inStDoc(el).parentElement; p && list.length < 4; p = p.parentElement) {
      if (p === stDoc.body || p === stDoc.documentElement) break;
      const overflowY = ST.getComputedStyle(p).overflowY;
      if (/^(auto|scroll|overlay)$/.test(overflowY) && p.scrollHeight > p.clientHeight + 1) list.push(p);
    }
    const root = stDoc.scrollingElement;
    if (root && root.scrollHeight > root.clientHeight + 1) list.push(root);
    return list;
  }

  // 제목 줄이 보이면 그대로 두고, 가려졌으면 버튼이 있던 자리 바로 위로 옮긴다.
  function bringBack(scroller, target, anchor) {
    let top = 0;
    let bottom = ST.innerHeight;
    if (scroller !== stDoc.scrollingElement) {
      top = scroller.getBoundingClientRect().top + scroller.clientTop;
      bottom = top + scroller.clientHeight;
    }
    const rect = viewportRect(target);
    if (rect.top >= top && rect.bottom <= bottom) return;
    const height = Math.min(rect.height, bottom - top - MARGIN * 2);
    const want = Math.min(Math.max(anchor - height, top + MARGIN), bottom - height - MARGIN);
    scroller.scrollTop += rect.top - want;
  }

  // ── 문서 연결 ─────────────────────────────────────────────

  function hookDoc(doc) {
    if (!alive || docs.has(doc) || !doc.documentElement) return;
    const style = doc.createElement('style');
    style.setAttribute(STYLE, '');
    style.textContent = CSS + (doc === stDoc ? HIDE_OLD : '');
    (doc.head ?? doc.documentElement).append(style);
    const observer = new MutationObserver(onMutations);
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    doc.addEventListener('toggle', onToggle, true);
    docs.set(doc, () => {
      observer.disconnect();
      doc.removeEventListener('toggle', onToggle, true);
      style.remove();
      doc.querySelectorAll(`[${BTN}]`).forEach(button => button.remove());
    });
    scan(doc);
  }

  function onToggle(event) {
    const target = event.target;
    if (target?.localName === 'details') sync(target);
  }

  function onMutations(records) {
    if (!alive) return;
    for (const record of records) {
      // 열림/닫힘이 바뀌었거나, 칸 안에 새 내용이 붙어 버튼이 맨 아래가 아니게 된 경우
      if (record.target.localName === 'details') sync(record.target);
      if (record.type !== 'childList') continue;
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || node.hasAttribute(BTN)) continue;
        if (node.localName === 'details') sync(node);
        else if (node.localName === 'iframe') maybeFrame(node);
        if (node.firstElementChild) scan(node);
      }
    }
  }

  // 채팅 속 프런트엔드 iframe. 다시 그려질 때마다 새 문서가 생기므로 load마다 연결한다.
  function maybeFrame(frame) {
    if (!alive) return;
    if (frame.ownerDocument === stDoc && !frame.closest('#chat, .mes_text')) return;
    if (!frames.has(frame)) {
      frames.add(frame);
      frame.addEventListener('load', onFrameLoad);
    }
    hookFrameDoc(frame);
  }

  function onFrameLoad(event) {
    hookFrameDoc(event.currentTarget);
  }

  function hookFrameDoc(frame) {
    let doc = null;
    try {
      doc = frame.contentDocument;
    } catch {
      return; // 다른 출처 iframe은 건드릴 수 없다
    }
    if (doc?.body) hookDoc(doc);
  }

  // ── 안전망: 화면이 크게 바뀐 뒤 한 번 더 훑기 ─────────────

  function scheduleSweep() {
    if (!alive) return;
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweep, 80);
  }

  function sweep() {
    if (!alive) return;
    for (const [doc, off] of docs) {
      if (doc !== stDoc && doc.defaultView?.document !== doc) {
        docs.delete(doc);
        try { off(); } catch { /* 이미 사라진 iframe 문서 */ }
        continue;
      }
      scan(doc);
    }
    for (const frame of frames) {
      if (frame.isConnected) continue;
      frame.removeEventListener('load', onFrameLoad);
      frames.delete(frame);
    }
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    clearTimeout(sweepTimer);
    stDoc.removeEventListener('visibilitychange', scheduleSweep);
    offs.splice(0).forEach(off => { try { off(); } catch { /* 이미 사라진 창 */ } });
    for (const frame of frames) frame.removeEventListener('load', onFrameLoad);
    frames.clear();
    for (const off of docs.values()) {
      try { off(); } catch { /* 이미 사라진 iframe 문서 */ }
    }
    docs.clear();
    if (ST[INSTANCE] === instance) delete ST[INSTANCE];
    console.info(LOG, '꺼짐');
  }

  const instance = { version: VERSION, destroy };
  ST[INSTANCE] = instance;
  window.addEventListener('pagehide', destroy);
  stDoc.addEventListener('visibilitychange', scheduleSweep);
  if (typeof eventOn === 'function' && typeof tavern_events === 'object') {
    for (const name of SWEEP_EVENTS) {
      if (tavern_events[name]) eventOn(tavern_events[name], scheduleSweep);
    }
  } else {
    // 테마 실행기 틀에는 헬퍼 전역(eventOn)이 없다 — 실리태번 이벤트에 직접 달고 destroy 에서 뗀다.
    let ctx = null;
    try { ctx = ST.SillyTavern?.getContext?.(); } catch { /* 없으면 visibilitychange 만 */ }
    const bus = ctx?.eventSource, types = ctx?.event_types;
    if (bus && types) {
      for (const name of SWEEP_EVENTS) {
        const type = types[name];
        if (!type) continue;
        bus.on(type, scheduleSweep);
        offs.push(() => bus.removeListener(type, scheduleSweep));
      }
    }
  }
  hookDoc(stDoc);
  console.info(LOG, '켜짐', VERSION);
})();

/*BL-SCRIPT-END*/
}
