// 내장 스크립트 korean (9.0.7 부터 iframe 없이 테마 창에서 도는 모듈). 만든 파일 — tools/build-korean-dict.mjs 가 tools/scripts-src/korean.js 에서 만들어요(사전은 src/ko-ui-text.index.gen.js 색인 + ko-ui-text.<조각>.gen.js). 손으로 고치지 않아요.
// 실행기(src/scripts/runtime.js)가 BlueLemonade(테마 API)와 스크립트별 창 대리 window(src/scripts/realm.js — 타이머 · 감시 모음, setInterval 은 공용 스케줄러)를 넘겨요.
export default function blueLemonadeScript(BlueLemonade, window) {
/*BL-SCRIPT-START*/
// SillyTavern Korean UI (leftover English), v1.4.8
// Replaces exact English UI strings SillyTavern leaves untranslated. Chat messages, names, presets and other
// user content are never rewritten. Only built-in welcome labels/greetings are handled inside chat.
// Nothing is saved, and turning the script off restores the original text.
(() => {
  'use strict';
  const host = window.parent;
  const doc = host.document;
  const INSTANCE_KEY = '__sillyTavernKoreanUI_v1';
  host[INSTANCE_KEY]?.cleanup?.();

  // 사전은 src/ko-ui-text.gen.js — tools/build-korean-dict.mjs 가 원본(tools/scripts-src/korean.js)의 TRANSLATIONS 를 미리 정리해 둔 표예요(normalize · 블록 쪼개기 · 태그 벗긴 사본까지 원본과 같은 결과). 처음 필요할 때 받아 useDictionary 로 끼워요
  // 값이 끼워지는 문구(예: Character "이름" not found)는 완전 일치로 못 잡으니 정규식으로.
  // build.cjs 가 영어 템플릿을 ^...(.+?)...$ 로 구워서 넣는다. ko 안의 $1 $2 가 잡힌 값이다.
  let PATTERNS = [];
  // Everything outside the chat column plus the input bar. Drawers, popups, menus and toasts are <body> children.
  const SCOPE = 'body > :not(#sheld, script, style, link, template), #form_sheld';
  const SKIP = [
    '.bl-capture-stage', '.bl-sticky', '.bl-notes-dialog', '#bl-notes-bar', '.bl-qrf-layer', '.bwr_quickban',
    'script', 'style', 'pre', 'code', 'svg', '[contenteditable="true"]', '.monaco-editor', '.cm-editor',
    '#chat', '#completion_prompt_manager_list', '.completion_prompt_manager_prompt',
    '#rm_print_characters_block', '.character_select', '.group_select', '.group_member', '#rm_button_selected_ch',
    '.ch_name', '#user_avatar_block', '.persona_name', '.avatar-container', '#bg_menu_content', '.tag',
    '.select2-selection__choice', '.select_chat_block', '.regex-script-label', '.qr--button-label',
    // 2026-10-06: 타번 헬퍼 스크립트 버튼(.qr--button 안 바로 글자) · 빠른 답장 버튼과 메뉴 항목의 title 은 사용자 · 카드가 지은 이름이다.
    '.qr--button', '.ctx-item',
    '#tavern_helper', '.TH-popup', '.TH-custom-tailwind', '.bwr_settings',
    // v1.3.1: 북마크 확장 창·시트(.cg-root)는 <body> 바로 아래라 범위에 들어왔는데, 안에 채팅 메시지 본문을 그대로 그린다.
    // 전역 사전이 메시지 글('Summary', 'Error: …', 'Thought for a moment, …')을 바꾸면 안 되므로 통째로 뺀다.
    // (그 창의 UI 는 원래 한국어이고, 프리셋 카드 제목은 아래 채팅 감시가 따로 번역한다.)
    '.cg-root',
    // v1.3.1: LLM 번역기 설정의 용어집 목록은 사용자가 적은 원문 낱말이다 (실제 데이터의 'Scale' 이 '스케일' 로 보였다).
    '.llmt-gl-list',
  ].join(',');
  const ATTRIBUTE_NAMES = ['title', 'placeholder', 'aria-label'];
  const textChanges = new Map();
  const attributeChanges = new Map();
  // BL 9.0.7: 범위(body 바로 아래 칸 수십 개) · 채팅 뿌리 · 헬퍼 창마다 감시 객체를 하나씩 만들던 것을 종류마다 하나로 — 한 감시 객체가 여러 칸을 봐요.
  //   떨어져 나간 칸은 목록에서만 지워요(떨어진 칸은 기록을 거의 안 내고, 나와도 flush 가 isConnected 로 거릅니다). 끌 때 한 번에 끊어요.
  const scopes = new Set();
  let stopped = false;
  let timer = null;
  const dirty = new Set();

  function normalize(text) {
    return String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
  // v1.4.2: 사전 열쇠(4,270) · 패턴(297)은 모두 라틴 글자나 한자 · 가나를 품는다 → 그 글자가 없는 글(한글 · 숫자 · 기호뿐)은 찾아볼 필요가 없다.
  // 첫 훑기에서 글자 노드 수천 개의 대부분이 이미 한글이라, NFKC · 공백 정리 · Map 조회를 통째로 건너뛴다.
  const MAYBE_FOREIGN = /[A-Za-z\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
  let exact = new Map();
  // v1.4.3: 블록 태그(div · p · li · br …)로 이어진 긴 도움말은 태그 자리에서 쪼개 조각마다 열쇠로 — 화면에는 조각(글자 노드)으로 놓인다.
  // 번역문도 같은 태그 구조로 적혀 있어 조각 수가 같을 때만 짝짓는다.
  const BLOCK = /<\/?(?:div|p|ul|ol|li|br|pre|h[1-6]|table|tr|td|th|tbody|thead)\b[^>]*>/gi;
  // v1.4.3: 슬래시 명령 도움말처럼 <code> 가 낀 문장은 글자 노드 여러 개로 쪼개져 있어 노드 단위로는 못 맞춘다 —
  // 자식이 글자와 인라인 요소(code · b · strong …)뿐인 칸은 innerHTML 을 열쇠로 통째로 바꾼다. 열쇠 · 칸 양쪽을 같은 규칙(엔티티 풀기 · 공백 정리)으로 고른다.
  const htmlKey = text => normalize(String(text ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  let htmlExact = new Map();
  // 자동 완성 목록은 도움말의 HTML 을 벗겨 글자만 보여 준다 → 태그 벗긴 사본도 열쇠로
  const TAG = /<\/?[a-z][^>]*>/gi;
  const HTML_INLINE = new Set(['CODE', 'B', 'STRONG', 'I', 'EM', 'BR', 'SPAN', 'A', 'KBD', 'SMALL']);
  const HTML_MARKS = new Set(['CODE', 'B', 'STRONG', 'EM']);
  const htmlChanges = new WeakMap();
  function translateHtml(element) {
    if ((!htmlExact.size && !htmlPart.size) || element.childElementCount === 0 || element.childElementCount > 12) return false;   // BL 1.0.0: html 조각을 아직 안 받았어도 색인이 알면 봐요
    let marked = false;
    for (const child of element.children) {
      if (!HTML_INLINE.has(child.tagName) || child.childElementCount) return false;
      if (HTML_MARKS.has(child.tagName)) marked = true;
    }
    if (!marked) return false;
    let latin = false;
    for (const node of element.childNodes) if (node.nodeType === 3 && MAYBE_FOREIGN.test(node.nodeValue)) { latin = true; break; }
    if (!latin) return false;
    const before = element.innerHTML;
    if (htmlChanges.get(element) === before) return true;
    const korean = htmlExact.get(htmlKey(before));
    if (korean === undefined) {
      const part = htmlPart.get(fnv(htmlKey(before)));
      if (part && !partsReady.has(part)) { wantPart(part); pendingHtml.add(element); }
      return false;
    }
    element.innerHTML = korean;
    htmlChanges.set(element, element.innerHTML);
    return true;
  }

  // 패턴을 첫 낱말로 나눠 둔다 (값이 맨 앞에 오는 패턴만 공용 목록). 글자 노드가 수천 개라도 몇 개만 시도한다.
  const firstWord = text => {
    const match = /^[^\s]+/.exec(text);
    return match ? match[0].toLowerCase() : '';
  };
  const byWord = new Map();
  const headless = [];
  function indexPatterns() {
    byWord.clear();
    headless.length = 0;
    for (const item of PATTERNS) {
      let compiled;
      try {
        compiled = { re: new RegExp(item.re), ko: item.ko };
      } catch {
        continue; // 잘못된 정규식은 조용히 건너뜀 (나머지는 계속 동작)
      }
      if (item.head) {
        const list = byWord.get(item.head) || [];
        list.push(compiled);
        byWord.set(item.head, list);
      } else {
        headless.push(compiled);
      }
    }
  }
  // BL 9.0.7: 내장본(src/scripts/plain/korean.js)은 사전을 싣지 않고 빈 표로 시작해요. 사전(src/ko-ui-text.index.gen.js 색인 + 조각 — 빌드가 위 정리를 미리 돌린 결과)은
  //   처음 필요할 때 받아 여기서 끼워요 (아래 startWhenNeeded).
  // BL 1.0.0 (극한 최적화): 사전은 색인 + 조각(boot · drawers · templates · js · html · rest)으로 나뉘어 처음 필요할 때 조각만 받아요(src/ko-ui-text.*.gen.js).
  //   색인(열쇠 지문 fnv32 → 조각 · 패턴 머리 낱말 → 조각)으로 「아직 안 받은 조각에 있는 글」을 알아보고 그 조각을 받은 뒤 미뤄 둔 글을 다시 봐요.
  //   통째 사전(옛 꼴 · 시험 · 사전을 품은 이 원본)도 그대로 끼워요 — 조각은 합쳐 쌓여요
  function useDictionary(data) {
    for (const [key, korean] of data.exact || []) exact.set(key, korean);
    for (const [key, korean] of data.htmlExact || []) htmlExact.set(key, korean);
    if (data.PATTERNS?.length) PATTERNS = PATTERNS.concat(data.PATTERNS);
    indexPatterns();
  }
  const keyPart = new Map(), htmlPart = new Map(), headPart = new Map(), partsAsked = new Set(), partsReady = new Set();
  const pendingText = new Map(), pendingAttr = new Set(), pendingHtml = new Set();
  let loadPart = null, wanted = false, quiet = false;
  const laterParts = new Set();   // 닫힌 서랍을 쉴 때 훑다 만난 조각 — 서랍을 열거나 처음 누를 때 받아요(쉴 때는 받지 않아요)
  function flushLater() { for (const part of [...laterParts]) { laterParts.delete(part); wantPart(part); } }
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function useIndex(index, load) {
    loadPart = load;
    // 지문 목록: 차이를 36진수로 이어 적은 글(빌드) 또는 숫자 배열(시험)
    const each = (list, fn) => { if (typeof list === 'string') { let h = 0; for (const d of list.split(',')) if (d) { h += parseInt(d, 36); fn(h); } } else for (const h of list || []) fn(h); };
    for (const [part, list] of Object.entries(index.keys || {})) each(list, h => keyPart.set(h, part));
    for (const [part, list] of Object.entries(index.html || {})) each(list, h => htmlPart.set(h, part));
    for (const [part, list] of Object.entries(index.heads || {})) for (const w of list) headPart.set(w, part);
    if (index.headless?.length) useDictionary({ PATTERNS: index.headless });
  }
  /** 받지 않은 조각이면 받아요 — 그동안 못 바꾼 글(pending*)은 조각이 오면 다시 봐요 */
  function wantPart(part) {
    if (!part || partsAsked.has(part) || !loadPart) return;
    if (quiet) { laterParts.add(part); return; }
    partsAsked.add(part);
    Promise.resolve().then(() => loadPart(part)).then(data => {
      if (stopped) return;
      partsReady.add(part);
      useDictionary(data || {});
      retryPending();
    }).catch(error => { partsAsked.delete(part); console.warn('[한글화] 사전 조각을 받지 못했어요', part, error); });
  }
  /** 못 찾은 글이 아직 안 받은 조각에 있으면 그 조각을 받고 「기다림」 표시(wanted) */
  function noteMiss(key) {
    const part = keyPart.get(fnv(key)) || headPart.get(firstWord(key));
    if (part && !partsReady.has(part)) { if (host.__blKoDebug) host.__blKoDebug.push([part, key.slice(0, 80), quiet, Math.round(host.performance.now())]); wantPart(part); wanted = true; }   // __blKoDebug: 진단(어느 글이 조각을 받게 했나)
  }
  /** 닫힌 서랍 안이면 조각을 받지 않고 적어만 두는 채로(quiet) 돌려요 */
  function quietFor(element, fn) {
    const wasQuiet = quiet;
    if (!quiet && element?.closest?.(DEFER)) quiet = true;
    try { fn(); } finally { quiet = wasQuiet; }
  }
  function retryPending() {
    const texts = [...pendingText]; pendingText.clear();
    for (const [node, fn] of texts) if (node.isConnected) quietFor(node.parentElement, () => swapText(node, fn));
    const attrs = [...pendingAttr]; pendingAttr.clear();
    for (const element of attrs) if (element.isConnected) quietFor(element, () => translateAttributes(element, false));
    const htmls = [...pendingHtml]; pendingHtml.clear();
    for (const element of htmls) if (element.isConnected) quietFor(element, () => translateHtml(element));
  }

  function translate(text) {
    const key = normalize(text);
    if (!key) return null;
    const hit = lookup(key);
    if (hit !== null) return hit;
    return translateSentences(key);
  }
  // v1.4.3: 문장 여러 개가 한 글자 노드에 붙은 것(슬래시 명령 목록의 도움말: "설명. 설명. Example: /cmd …") — 문장마다 맞춰 잇는다.
  // 어느 한 조각이라도 못 맞추면(명령 예시 · 라틴 글자 없는 조각은 그대로 둔다) 원문을 건드리지 않는다.
  const SENTENCE = /(?<=[.!?:])\s+(?=[A-Z/\[(])/;
  function translateSentences(key) {
    if (!/[.!?:]\s+[A-Z/\[(]/.test(key)) return null;
    const parts = key.split(SENTENCE);
    if (parts.length < 2) return null;
    const out = [];
    for (const part of parts) {
      const hit = lookup(part);
      if (hit !== null) { out.push(hit); continue; }
      if (part.startsWith('/') || !/[A-Za-z]/.test(part)) { out.push(part); continue; }
      return null;
    }
    return out.join(' ');
  }
  function lookup(key) {
    if (exact.has(key)) return exact.get(key);
    if (!PATTERNS.length) { noteMiss(key); return null; }
    const candidates = byWord.get(firstWord(key));
    for (const list of [candidates, headless]) {
      if (!list) continue;
      for (const { re, ko } of list) {
        const match = re.exec(key);
        if (!match) continue;
        // 끼워진 값이 비었으면(빈 문자열·공백) 원문을 건드리지 않는다
        if (match.slice(1).some(value => !value || !value.trim())) continue;
        return ko.replace(/\$([1-9])/g, (whole, index) => match[Number(index)] ?? whole);
      }
    }
    noteMiss(key);
    return null;
  }

  // 채팅 안은 원래 건드리지 않지만, 실리태번이 그리는 생각 칸 머리글(Thought for …)과 프리셋 카드(DEM) 제목·꼬리표만은 번역한다.
  // 'Status'·'Active' 같은 흔한 낱말이라 전역 사전과 섞지 않고 이 칸들에만 쓰는 사전을 따로 둔다 (build.cjs 가 chat-*.json 을 넣음).
  const CHAT_TRANSLATIONS = {"Thinking...":"생각하는 중...","Thought for some time":"잠시 생각함","Status":"상태","Live":"실시간","Scene Plan":"장면 계획","Scene Plan !":"장면 계획 !","Flow map":"흐름도","Your Choices":"선택지","Decide":"고르기","Story Threads":"이야기 갈래","Lore":"설정","Psychological States":"심리 상태","Mind":"마음","Momentum Engine":"전개 엔진","Route computed":"경로 계산됨","Conflict":"갈등","Active":"진행 중","@Tracker":"@추적기","Recovered":"복구됨","@CYOA":"@선택지","@Status":"@상태","@Story Threads":"@이야기 갈래","@Psychological States":"@심리 상태","@Momentum Engine":"@전개 엔진","@Conflict":"@갈등"};
  const CHAT_TARGETS = '.mes_reasoning_header_title, [class*="dem-card__title"], [class*="dem-card__tag"]';
  const chatExact = new Map();
  for (const [source, korean] of Object.entries(CHAT_TRANSLATIONS)) {
    const key = normalize(source);
    if (key && key !== normalize(korean)) chatExact.set(key, korean);
  }
  function translateChat(text) {
    const key = normalize(text);
    if (!key) return null;
    return chatExact.get(key) ?? translate(text);
  }


  // Welcome UI is inside #chat, but recent-chat titles/previews and real messages remain excluded.
  const WELCOME_TARGETS = '.welcomePanel .recentChatsTitle, .welcomePanel .welcomeShortcuts [data-i18n], .welcomePanel .noRecentChat [data-i18n], .welcomePanel .welcomeHeaderTitle [data-i18n], .welcomePanel .chatActions button[data-i18n], .welcomePanel .recentChatPinned [data-i18n]';
  const TEMP_NOTE = '.mes[type="assistant_note"] [data-type="assistant_note"]';
  // SillyTavern's sanitizer prefixes the title class with custom- when rendering messages.
  const TEMP_TARGETS = `${TEMP_NOTE} :is(.assistant_note_title, .custom-assistant_note_title) > [data-i18n], ${TEMP_NOTE} button[data-i18n], ${TEMP_NOTE} button > span[data-i18n]`;
  const WELCOME_LABELS = `${WELCOME_TARGETS}, ${TEMP_TARGETS}`;
  const WELCOME_CONTAINER = '.welcomePanel, .mes[type="assistant_message"], .mes[type="assistant_note"]';
  const welcomeExact = new Map(Object.entries({
    'Recent Chats': '최근 대화', 'Temporary Chat': '임시 대화',
    'Note:': '안내:',
    'this chat is temporary and will be deleted as soon as you leave it.': '이 대화는 임시 대화이며, 나가면 바로 삭제됩니다.',
    'Load': '불러오기', 'Save': '저장',
    'Import from JSONL': 'JSONL 파일에서 불러오기',
    'Export as JSONL': 'JSONL 파일로 저장',
    'No recent chats': '최근 대화가 없어요', 'Docs': '도움말',
    'Show recent chats': '최근 대화 펼치기', 'Hide recent chats': '최근 대화 접기',
    'Recent chats settings': '최근 대화 설정', 'Recent Chats Settings': '최근 대화 설정',
    'Pinned chat': '고정한 대화', 'Pin chat': '대화 고정',
    'Rename chat': '대화 이름 변경', 'Delete chat': '대화 삭제',
  }).map(([key, value]) => [normalize(key), value]));
  const welcomeGreeting = "If you're connected to an API, try asking me something!";
  const welcomeGreetingKo = 'API에 연결했다면 무엇이든 물어보세요!';
  const welcomeHint = 'Hint: Set any character as your welcome page assistant from their "More..." menu.';
  const welcomeHintKo = '도움말: 캐릭터의 "더보기..." 메뉴에서 해당 캐릭터를 메인 화면 도우미로 지정할 수 있어요.';
  const welcomeText = new Map(Object.entries({
    [welcomeGreeting]: welcomeGreetingKo,
    'Hint:': '도움말:',
    'Set any character as your welcome page assistant from their': '캐릭터의',
    'More...': '더보기...', '"More..."': '"더보기..."',
    'menu.': '메뉴에서 해당 캐릭터를 메인 화면 도우미로 지정할 수 있어요.',
    'Set any character as your welcome page assistant from their "More..." menu.': '캐릭터의 "더보기..." 메뉴에서 해당 캐릭터를 메인 화면 도우미로 지정할 수 있어요.',
  }).map(([key, value]) => [normalize(key), value]));
  const welcomeKey = text => normalize(text).replace(/[“”]/g, '"');
  function welcomeAttribute(element, name) {
    const before = element.getAttribute(name);
    const after = welcomeExact.get(normalize(before));
    if (!after || before === after) return;
    let changes = attributeChanges.get(element);
    if (!changes) attributeChanges.set(element, changes = new Map());
    changes.set(name, { before, after });
    element.setAttribute(name, after);
  }
  function processWelcome(root) {
    if (!root || root.nodeType !== 1) return;
    // Streaming ordinary messages cannot contain built-in welcome UI.
    const messageRoot = root.closest('.mes');
    if (messageRoot && !messageRoot.matches('.mes[type="assistant_message"], .mes[type="assistant_note"]')) return;
    const labels = [...root.querySelectorAll(WELCOME_LABELS)];
    if (root.matches(WELCOME_LABELS)) labels.unshift(root);
    for (const label of labels) {
      watchChatText(label);
      for (const node of label.childNodes) if (node.nodeType === 3) swapText(node, text => welcomeExact.get(normalize(text)) ?? null);
      for (const attribute of ATTRIBUTE_NAMES) welcomeAttribute(label, attribute);
    }
    const assistants = [...root.querySelectorAll('.mes[type="assistant_message"][ch_name="Assistant"]')];
    if (root.matches('.mes[type="assistant_message"][ch_name="Assistant"]')) assistants.unshift(root);
    for (const message of assistants) {
      watchChatText(message);
      const avatar = message.querySelector('.avatar img');
      const avatarSrc=avatar?.getAttribute('src')||'';
      let defaultAvatar=avatarSrc.split('?')[0].endsWith('img/five.png');
      try { const url=new URL(avatarSrc,doc.baseURI);defaultAvatar ||= url.pathname.endsWith('/thumbnail')&&url.searchParams.get('type')==='avatar'&&url.searchParams.get('file')==='default_Assistant.png'; } catch { /* Not a built-in avatar URL. */ }
      if (!defaultAvatar) continue;
      const body = message.querySelector('.mes_text');
      if (!body || body.querySelector('[contenteditable="true"], textarea')) continue;
      const paragraphs = [...body.children].filter(el => el.tagName === 'P');
      if (paragraphs.length !== 2) continue;
      if (![welcomeGreeting, welcomeGreetingKo].includes(welcomeKey(paragraphs[0].textContent))) continue;
      if (![welcomeHint, welcomeHintKo].includes(welcomeKey(paragraphs[1].textContent))) continue;
      const name = message.querySelector('.ch_name .name_text');
      if (name) for (const node of name.childNodes) if (node.nodeType === 3) swapText(node, text => normalize(text) === 'Assistant' ? '도우미' : null);
      for (const paragraph of paragraphs) {
        const walker = doc.createTreeWalker(paragraph, host.NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) swapText(walker.currentNode, text => welcomeText.get(welcomeKey(text)) ?? null);
      }
    }
  }

  // Only individual text nodes change, so controls, event handlers and values stay intact.
  // trusted: 뿌리가 SKIP 밖이고 TreeWalker 가 SKIP 칸을 건너뛴 뒤라 조상을 다시 묻지 않는다 (v1.4.0 — 첫 훑기의 대부분이 이 closest 였다).
  // 글자 노드의 부모가 input 일 수는 없고, textarea 의 글자는 textarea 바로 아래다.
  function translateText(node, trusted) {
    const element = node.parentElement;
    if (!element) return;
    if (trusted ? element.tagName === 'TEXTAREA' : (element.closest(SKIP) || element.closest('input, textarea'))) return;
    const value = node.nodeValue;
    if (!value || !MAYBE_FOREIGN.test(value)) return; // 빈 칸 · 한글뿐인 노드 (번역할 것 없음)
    // SillyTavern reads some <option> texts back (preset names), so only its own i18n-tagged options are touched.
    if (element.tagName === 'OPTION' && !element.hasAttribute('data-i18n')) return;
    swapText(node, translate);
  }

  function swapText(node, lookup) {
    const before = node.nodeValue;
    const previous = textChanges.get(node);
    if (previous && before === previous.after) return;
    wanted = false;
    const translated = lookup(before);
    if (translated === null) { if (wanted) pendingText.set(node, lookup); wanted = false; return; }
    const whitespace = before.match(/^(\s*)[\s\S]*?(\s*)$/);
    const after = whitespace[1] + translated + whitespace[2];
    if (before === after) return;
    textChanges.set(node, { before, after });
    node.nodeValue = after;
  }

  function translateAttributes(element, trusted) {
    if (!trusted && element.closest(SKIP)) return;
    for (const attribute of ATTRIBUTE_NAMES) {
      if (!element.hasAttribute(attribute)) continue;
      const before = element.getAttribute(attribute);
      if (!before || !MAYBE_FOREIGN.test(before)) continue;
      wanted = false;
      const translated = translate(before);
      if (translated === null) { if (wanted) pendingAttr.add(element); wanted = false; continue; }
      if (translated === before) continue;
      let changes = attributeChanges.get(element);
      if (!changes) attributeChanges.set(element, changes = new Map());
      const previous = changes.get(attribute);
      if (previous && before === previous.after) continue;
      changes.set(attribute, { before, after: translated });
      element.setAttribute(attribute, translated);
    }
  }

  // v1.4.3: <code> 가 낀 문장(htmlExact)은 요소마다 보지 않고 <code> 의 부모만 본다 — 열쇠가 모두 <code> 를 품으므로 (요소 1만 6천 → 수백)
  function translateHtmlAround(node) {
    if (!htmlExact.size && !htmlPart.size) return;   // BL 1.0.0: html 조각을 아직 안 받았어도 색인이 알면 봐요
    const codes = node.getElementsByTagName('code');
    let last = null;
    for (let i = 0; i < codes.length; i++) {
      const parent = codes[i].parentElement;
      if (!parent || parent === last || parent.tagName === 'PRE') continue;
      last = parent;
      if (!parent.closest(SKIP)) translateHtml(parent);
    }
    if (node.tagName === 'CODE' && node.parentElement && !node.parentElement.closest(SKIP)) translateHtml(node.parentElement);
  }
  // v1.4.8 (BL 7.3.0 폰 시작): 첫 훑기에서 닫힌 위 막대 서랍은 건너뛰고(deferred) 열릴 때 · 쉴 때 번역한다 (첫 훑기 약 4배 → 1배쯤)
  const DEFER = '.drawer-content:not(.openDrawer)';
  const deferred = new Set(), kids = new Map();
  let deferOn = false;
  // 서랍이 열림(class · style 바뀜)은 관찰자 콜백 — 그 일(task)이 끝나고 그리기 전에 돈다. 미룬 서랍은 그때 통째로,
  //   미루지 않은 서랍도 그 안의 밀린 번역(dirty — 40ms 모아 처리)을 바로 한다. 시작 직후 서랍을 열면 실리태번이 서랍 글자를 다시 쓴 직후라
  //   첫 프레임에 영어(서랍마다 12~316개)가 보이던 것까지 없앤다
  const openWatch = new host.MutationObserver(records => {
    if (stopped) return;
    const seen = new Set();
    for (const record of records) {
      const drawer = record.target;
      if (seen.has(drawer) || !drawer.isConnected) continue;
      seen.add(drawer);
      takePending();
      flushLater();   // BL 1.0.0: 쉴 때 훑어 두고 안 받은 조각을 서랍이 열리는 순간 받아요
      if (deferred.delete(drawer)) { kids.delete(drawer); processNode(drawer); continue; }
      for (const node of dirty) if (drawer.contains(node)) { dirty.delete(node); if (node.isConnected) processNode(node); }
    }
  });
  const DRAWER_WATCH = { attributes: true, attributeFilter: ['class', 'style'] };
  function addDeferred(element) {
    if (deferred.has(element)) return;
    deferred.add(element);
    openWatch.observe(element, DRAWER_WATCH);
  }
  function watchDrawers(root) {
    for (const drawer of root.querySelectorAll?.('.drawer-content') || []) openWatch.observe(drawer, DRAWER_WATCH);
  }
  // 범위 관찰자가 아직 안 넘긴 기록을 먼저 받아 밀린 번역에 넣는다 (열림 콜백이 범위 관찰자보다 먼저 불려도 빠지지 않게)
  function takePending() {
    handleRecords(scopeWatch.takeRecords());
  }
  function handleRecords(records) {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') schedule(record.target);
      else {
        for (const node of record.addedNodes) schedule(node);
        // 미룬 서랍에서 다른 곳으로 옮겨 보여 주는 칸(서랍 자신의 class · style 은 안 바뀌는 길) — 옮겨진 자리에서 그리기 전에 바로
        if (deferred.size) for (const node of record.removedNodes) if (node.nodeType === 1 && node.isConnected) processNode(node);
      }
    }
  }
  function processNode(node) {
    // BL 1.0.0: 닫힌 서랍 안(나중에 들어온 확장 설정 칸 · 글자 고침)은 조각을 받지 않고 적어만 둬요(laterParts) — 열리거나 처음 누를 때 받아요
    quietFor(node.nodeType === 3 ? node.parentElement : node, () => processNodeNow(node));
  }
  function processNodeNow(node) {
    if (node.nodeType === 3) {
      translateText(node);
      return;
    }
    if (node.nodeType !== 1 || node.closest(SKIP)) return;
    translateAttributes(node, true);
    const walker = doc.createTreeWalker(node, host.NodeFilter.SHOW_ELEMENT | host.NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        if (deferOn && child.nodeType === 1 && child.matches(DEFER)) { addDeferred(child); return host.NodeFilter.FILTER_REJECT; }
        if (child.nodeType === 1 && child.matches(SKIP)) return host.NodeFilter.FILTER_REJECT;
        return host.NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const child = walker.currentNode;
      if (child.nodeType === 3) translateText(child, true);
      else translateAttributes(child, true);
    }
    translateHtmlAround(node);
  }

  function flush() {
    timer = null;
    if (stopped) return;
    const work = [...dirty];
    dirty.clear();
    for (const node of work) if (node.isConnected) processNode(node);
    for (const node of textChanges.keys()) if (!node.isConnected) textChanges.delete(node);
    for (const element of attributeChanges.keys()) if (!element.isConnected) attributeChanges.delete(element);
  }

  function schedule(node) {
    dirty.add(node);
    if (timer === null) timer = host.setTimeout(flush, 40);
  }

  const scopeWatch = new host.MutationObserver(handleRecords);
  function attachScope(element) {
    if (scopes.has(element) || element.closest(SKIP)) return;
    if ([...scopes].some(root => root.contains(element))) return;
    scopes.add(element);
    scopeWatch.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTE_NAMES });
    processNode(element);
    watchDrawers(element);
  }

  // 채팅: 메시지가 수천 개라도 번역할 칸(CHAT_TARGETS)이 들어오거나 바뀐 곳만 본다.
  const chatDirty = new Set();
  let chatTimer = null;

  function translateChatLabel(element) {
    watchChatText(element);
    if (element.closest('[contenteditable="true"], textarea')) return;
    for (const child of element.childNodes) if (child.nodeType === 3) swapText(child, translateChat);
  }

  function flushChat() {
    chatTimer = null;
    if (stopped) return;
    const work = [...chatDirty];
    chatDirty.clear();
    for (const element of work) {
      if (!element.isConnected) continue;
      processWelcome(element);
      if (element.matches(CHAT_TARGETS)) translateChatLabel(element);
      for (const label of element.querySelectorAll(CHAT_TARGETS)) translateChatLabel(label);
    }
    for (const node of textChanges.keys()) if (!node.isConnected) textChanges.delete(node);
    for (const element of attributeChanges.keys()) if (!element.isConnected) attributeChanges.delete(element);
    chatText.takeRecords(); // 방금 바꾼 글자(우리가 쓴 것)의 기록은 버린다
  }

  function scheduleChat(element) {
    chatDirty.add(element);
    if (chatTimer === null) chatTimer = host.setTimeout(flushChat, 40);
  }

  // 채팅처럼 메시지를 그리는 칸: #chat 과 북마크 확장 창(.cg-root — messageFormatting 으로 같은 프리셋 카드를 그림, v1.2.1)
  const CHAT_ROOTS = '#chat, .cg-root';
  const chatObservers = new Map();
  // 글자만 고쳐 쓰는 기록(characterData)은 채팅 뿌리 전체가 아니라 번역하는 칸(CHAT_TARGETS · 환영 칸 글자 · 도우미 인사말)에만 건다.
  //   뿌리 전체에 걸면 답이 스트리밍으로 본문 글자 노드를 고쳐 쓸 때마다 콜백이 불렸다 (폰 4배 측정: 채팅 열기 · 그리기 · 스트리밍에 2,019번).
  //   칸이 들어오는 것(childList)은 뿌리가 그대로 보고, 칸을 처음 볼 때(translateChatLabel · processWelcome) 그 칸에 글자 감시를 붙인다.
  const chatTextWatched = new WeakSet();
  const chatText = new host.MutationObserver(handleChatRecords);
  const CHAT_TEXT_WATCH = { subtree: true, characterData: true };
  function watchChatText(element) {
    if (chatTextWatched.has(element)) return;
    chatTextWatched.add(element);
    chatText.observe(element, CHAT_TEXT_WATCH);
  }

  function handleChatRecords(records) {
    if (stopped) return;
    // 뿌리 콜백이 먼저 불려도 아직 안 넘어온 글자 기록을 같이 본다 (끝에서 버리는 것은 이 콜백 안에서 우리가 쓴 것뿐)
    records = records.concat(chatText.takeRecords());
    const labels = new Set();
    const welcomes = new Set();
    let removed = false;
    // BL 8.2.7: 채팅을 열면 기록 수천 개가 같은 부모 몇백 개(메시지마다 단추 줄)에 몰려요 — 부모마다 조상 두 번 거슬러 오르기(closest)를 한 번만 해요.
    //   이 콜백 안에서는 아직 아무것도 바꾸지 않으니(바꾸기는 아래 고리 뒤) 같은 부모의 답은 같아요. 자식 요소가 없는 요소는 그 아래를 훑지 않아요(찾을 것이 없음)
    const ancestors = new Map();
    for (const record of records) {
      if (record.removedNodes.length) removed = true;
      const target = record.type === 'characterData' ? record.target.parentElement : record.target;
      let found = ancestors.get(target);
      if (!found) { found = { welcome: target?.closest(WELCOME_CONTAINER), label: target?.closest(CHAT_TARGETS) }; ancestors.set(target, found); }
      const welcome = found.welcome;
      if (welcome) welcomes.add(welcome);
      // 생각 칸 머리글은 textContent 로 통째로 바뀐다 → 그 칸 자신이 target
      const label = found.label;
      if (label) labels.add(label);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (!welcome) welcomes.add(node);
        if (node.matches(CHAT_TARGETS)) labels.add(node);
        if (node.firstElementChild !== null) for (const inner of node.querySelectorAll(CHAT_TARGETS)) labels.add(inner);
      }
    }
    for (const welcome of welcomes) if (welcome.isConnected) processWelcome(welcome);
    // v1.3.2: 그리기 전에 이 자리에서 바꾼다. 스트리밍은 걸음마다 메시지를 새로 써서, 40ms 뒤에 바꾸면
    // 걸음마다 카드 제목·생각 칸 머리글이 영어로 한두 프레임씩 보였다 (폰 5fps 에서 보이는 프레임의 15~20%).
    for (const label of labels) if (label.isConnected) translateChatLabel(label);
    // 방금 바꾼 글자(swapText)의 기록은 버린다 — 예전엔 제 번역 때문에 콜백이 한 번 더 불렸다
    chatText.takeRecords();
    // 40ms 타이머는 문서에서 떨어져 나간 글자 기록만 치운다 (걸음마다 옛 제목 글자 노드가 빠진다)
    if ((labels.size || (removed && (textChanges.size || attributeChanges.size))) && chatTimer === null) chatTimer = host.setTimeout(flushChat, 40);
  }

  const chatRootWatch = new host.MutationObserver(handleChatRecords);
  function watchChatRoot(root) {
    if (!root || chatObservers.has(root)) return;
    const observer = chatRootWatch;
    observer.observe(root, { subtree: true, childList: true });
    chatObservers.set(root, observer);
    scheduleChat(root);
  }

  function watchChat() {
    for (const root of doc.querySelectorAll(CHAT_ROOTS)) watchChatRoot(root);
  }

  // Helper release notes are excluded from the general dictionary. Only known
  // update prose is translated here; script editors and arbitrary popups stay intact.
  // v1.4.7: 실리태번 헬퍼 업데이트 창은 CHANGELOG 를 '설치된 판 다음 ~ 최신 판'만큼 한 창에 보여 준다 (4.10.0 ~ 4.11.3 을 안다).
  // 버전 제목(h1~h3 의 '4.11.3' 따위) 다음부터 다음 버전 제목 전까지가 한 칸이고, 아는 버전이며 그 칸의 code 에 sign 이 있을 때만 바꾼다.
  // 문단(h3 · li · p)은 코드 밖 글자 노드들이 원문 조각과 모두 같을 때만 통째로 바꾼다 (같은 '新增'도 문단마다 다르게 옮겨야 해서 낱개 사전은 못 쓴다).
  // 그 문단 안 code 는 예시 값만(code 표), pre 는 주석 · 예시 문자열만(pre 표) — 함수 · 인자 · 매크로 이름은 그대로. 원문이 바뀐 문단은 중국어 그대로 둔다.
  const helperObservers=new Map();
  const NOTICE_HEADINGS=[
    ["📦函数", "📦 함수"],
    ["🐛修复", "🐛 수정"],
    ["💬酒馆助手宏", "💬 실리태번 헬퍼 매크로"],
    ["🗣提示词查看器", "🗣 프롬프트 뷰어"],
    ["🪪许可证", "🪪 라이선스"],
    ["⏫功能", "⏫ 기능"],
    ["💻界面", "💻 화면"],
    ["🎨渲染器", "🎨 렌더러"],
    ["📕脚本库", "📕 스크립트 라이브러리"],
    ["📚脚本库", "📚 스크립트 라이브러리"],
    ["🔧杂项", "🔧 기타"],
    ["🔢变量管理器", "🔢 변수 관리자"],
    ["🔍日志查看器", "🔍 로그 뷰어"],
  ];
  const HELPER_NOTICES=new Map(Object.entries({
    "4.11.3":{sign:"{{format_message|chat|character|preset|global_variable_quoted::}}",blocks:[
      [["新增", "宏 (by @fengzgk).", "相比起", "宏, 它会始终给字符串两边添加双引号.", "例如", "用", "替换后将显示成", ", 避免 AI 误认为是 100 除以 100."],
       ["새로", "매크로를 추가했어요 (by @fengzgk).", "기존", "매크로와 달리 문자열 양쪽에 항상 큰따옴표를 붙여요.", "예를 들어", "같은 값은", "매크로로 치환하면", "처럼 표시되어, AI 가 100 나누기 100 으로 오해하지 않아요."]],
    ],code:[["体力值: 100/100", "체력: 100/100"], ["{{format_message_variable_quoted::体力值}}", "{{format_message_variable_quoted::체력}}"], ["体力值: \"100/100\"", "체력: \"100/100\""]]},
    "4.11.2":{sign:"1.14.0",blocks:[
      [["对酒馆", "~", "版本的兼容性"],
       ["실리태번", "~", "버전과의 호환성 문제를 수정했어요."]],
    ]},
    "4.11.1":{sign:"should_return_reasoning",blocks:[
      [["为", "和", "新增", "参数, 启用后将能在返回值中获得 AI 的思考过程和思考签名."],
       ["이제", "및", "함수에서", "인자를 쓸 수 있어요. 켜면 반환값에 AI 의 추론 과정과 추론 서명이 함께 담겨요."]],
      [["新增", "实验选项, 容易受第三方插件和脚本影响而显示不准确, 因此开关放在提示词查看器里的某个神秘位置, 默认关闭. 启用后能在提示词查看器中查看提示词内容来源于哪里, 例如来自世界书中名为", "的条目."],
       ["새로 ", " 실험 옵션을 추가했어요. 다른 확장 프로그램이나 스크립트의 영향으로 틀리게 표시되기 쉬워서, 스위치는 프롬프트 뷰어 속 어딘가 비밀스러운 곳에 두었고 기본값은 꺼짐이에요. 켜면 프롬프트 뷰어에서 프롬프트 내용이 어디에서 왔는지 볼 수 있어요. 예를 들어 로어북의", "항목에서 왔다고 알려 줘요."]],
    ],code:[["启用内容溯源", "내용 출처 표시 사용"]],pre:[["'你好'", "'안녕하세요'"], ["// 获取 AI 的回复正文", "// AI 답변 본문 가져오기"], ["// 获取 AI 的思考过程 (reasoning)", "// AI 추론 과정 (reasoning) 가져오기"]]},
    "4.11.0":{sign:"replaceCharacter",blocks:[
      [["现在", "、", "等函数支持使用角色卡的头像id/文件名称作为参数. 例如如果你在酒馆网页上复制了一张", "角色卡, 两张角色卡虽然都显示成", ", 但它们的头像id/文件名称将分别是", "和", "——现在你可以使用", "或", "来操作对应角色卡."],
       ["이제", ", ", "등의 함수에서 캐릭터 카드의 아바타 id/파일 이름을 인자로 쓸 수 있어요. 예를 들어 실리태번 웹 화면에서", "캐릭터 카드를 복제하면 두 카드의 표시 이름은 모두", "이지만, 아바타 id/파일 이름은 서로 달라요:", "및", ". 이제", "또는", "이름으로 해당 캐릭터 카드를 다룰 수 있어요."]],
      [["修复了有多张显示名称相同的角色卡时，酒馆助手脚本只会对其中一张角色卡生效的问题"],
       ["표시 이름이 같은 캐릭터 카드가 여러 장일 때 실리태번 헬퍼 스크립트가 그중 한 장에만 적용되던 문제를 수정했어요."]],
      [["从原来的 Aladdin 禁止商业化许可证, 切换为表述更清楚、对开源更宽松的 PolyForm NonCommercial 1.0.0 禁止商业化许可证"],
       ["라이선스를 기존 Aladdin 상업적 이용 금지 라이선스에서, 표현이 더 분명하고 오픈 소스에 더 너그러운 PolyForm NonCommercial 1.0.0 상업적 이용 금지 라이선스로 바꿨어요."]],
    ],code:[["'少女歌剧'", "'소녀가극'"], ["'少女歌剧.png'", "'소녀가극.png'"], ["'少女歌剧_1.png'", "'소녀가극_1.png'"]],pre:[["// 显示名称:", "// 표시 이름:"], ["// 头像id/文件名称:", "// 아바타 id/파일 이름:"], ["// 获取 '少女歌剧_1.png' 角色卡对应的数据", "// '소녀가극_1.png' 캐릭터 카드의 데이터 가져오기"], ["少女歌剧", "소녀가극"]]},
    "4.10.0":{sign:"iframe_events.GENERATION_REQUESTED",blocks:[
      [["现在", "和", "在调用最初时会触发", "事件, 允许你监听情况和修改生成配置"],
       ["이제", "및", "호출을 시작할 때", "이벤트가 발생하여, 생성 요청을 감지하고 생성 설정을 바꿀 수 있어요."]],
      [["在极端情况下没正常发送世界书提示词的问题"],
       ["특정 예외 상황에서 월드 정보 프롬프트가 정상적으로 전송되지 않던 문제를 수정했어요."]],
      [["在酒馆欢迎页面开关“禁用酒馆助手宏”时，酒馆版本号和最近聊天面板消失的问题"],
       ["시작 화면에서 “헬퍼 매크로 사용 안 함”을 켜거나 끌 때 실리태번 버전과 최근 대화 목록이 사라지던 문제를 수정했어요."]],
    ],pre:[["你想要监听的生成id", "감지할_생성_ID"], ["新的用户输入", "새로운 사용자 입력"]]},
  }));
  const noticeKey=texts=>JSON.stringify(texts.map(normalize));
  for(const notice of HELPER_NOTICES.values()){
    notice.blocks=new Map([...NOTICE_HEADINGS.map(([zh,ko])=>[[zh],[ko]]),...notice.blocks].map(([zh,ko])=>[noticeKey(zh),ko]));
    notice.code=new Map((notice.code??[]).map(([zh,ko])=>[normalize(zh),ko]));
    notice.pre??=[];
  }
  const NOTICE_HEADING='h1,h2,h3',NOTICE_BLOCK='h1,h2,h3,h4,h5,h6,li,p',NOTICE_VERSION=/^\d+\.\d+\.\d+$/;
  function translateNoticeSection(notice,elements){
    for(const element of elements){
      const groups=new Map();
      const walker=doc.createTreeWalker(element,host.NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const node=walker.currentNode,parent=node.parentElement;
        if(parent.closest('pre')){
          // 앞뒤 공백은 swapText 가 원문에서 다시 붙이므로 잘라서 돌려준다 (1.4.5 까지는 첫 줄 들여쓰기가 두 배가 됐다)
          swapText(node,text=>{let next=text;for(const [zh,ko] of notice.pre)next=next.replaceAll(zh,ko);return next===text?null:next.trim();});
          continue;
        }
        const block=parent.closest(NOTICE_BLOCK);
        if(!block||!element.contains(block)||!normalize(node.nodeValue))continue;
        if(!groups.has(block))groups.set(block,{texts:[],codes:[]});
        groups.get(block)[parent.closest('code')?'codes':'texts'].push(node);
      }
      for(const {texts,codes} of groups.values()){
        const korean=notice.blocks.get(noticeKey(texts.map(node=>node.nodeValue)));
        if(!korean||korean.length!==texts.length)continue;
        texts.forEach((node,index)=>swapText(node,()=>korean[index]));
        for(const node of codes)swapText(node,text=>notice.code.get(normalize(text))??null);
      }
    }
  }
  function processHelperNotice(popup) {
    if(!popup.querySelector('code'))return;
    for(const heading of popup.querySelectorAll(NOTICE_HEADING)){
      const notice=HELPER_NOTICES.get(normalize(heading.textContent));
      if(!notice)continue;
      const elements=[];
      for(let next=heading.nextElementSibling;next&&!(next.matches(NOTICE_HEADING)&&NOTICE_VERSION.test(normalize(next.textContent)));next=next.nextElementSibling)elements.push(next);
      if(elements.some(element=>[...element.querySelectorAll('code')].some(code=>code.textContent.includes(notice.sign))))translateNoticeSection(notice,elements);
    }
  }
  // 헬퍼 창 감시도 하나: 기록마다 어느 창인지 거슬러 올라가 창마다 한 번씩
  const helperWatch=new host.MutationObserver(records=>{
    const pops=new Set();
    for(const record of records){const node=record.target.nodeType===1?record.target:record.target.parentElement;const pop=node?.closest('.TH-popup');if(pop&&helperObservers.has(pop))pops.add(pop);}
    for(const pop of pops)processHelperNotice(pop);
  });
  function watchHelper(pop) {
    if(helperObservers.has(pop))return;
    helperWatch.observe(pop,{childList:true,characterData:true,subtree:true});helperObservers.set(pop,helperWatch);processHelperNotice(pop);
  }
  // New popups, menus and toasts are appended to <body>; only those roots are watched in detail.
  const discovery = new host.MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(SCOPE)) attachScope(node);
        if(node.matches('.TH-popup'))watchHelper(node);
        else for(const pop of node.querySelectorAll('.TH-popup'))watchHelper(pop);
        // 북마크 창은 열 때마다 body 에 새로 붙는다
        if (node.matches(CHAT_ROOTS)) watchChatRoot(node);
        else for (const root of node.querySelectorAll(CHAT_ROOTS)) watchChatRoot(root);
      }
    }
    for (const element of scopes) if (!element.isConnected) scopes.delete(element);
    for (const root of chatObservers.keys()) if (!root.isConnected) chatObservers.delete(root);
    for(const pop of helperObservers.keys())if(!pop.isConnected)helperObservers.delete(pop);
    if (records.some(record => record.removedNodes.length) && (textChanges.size || attributeChanges.size) && timer === null) {
      timer = host.setTimeout(flush, 40);
    }
  });

  function cleanup() {
    if (stopped) return;
    stopped = true;
    if (wantDictionary) { doc.removeEventListener('pointerdown', wantDictionary, true); doc.removeEventListener('keydown', wantDictionary, true); wantDictionary = null; }
    if (prefetchParts) { doc.removeEventListener('pointerdown', prefetchParts, true); doc.removeEventListener('keydown', prefetchParts, true); prefetchParts = null; }
    loadPart = null; pendingText.clear(); pendingAttr.clear(); pendingHtml.clear(); laterParts.clear();
    discovery.disconnect();
    openWatch.disconnect(); deferred.clear(); kids.clear();
    helperWatch.disconnect();helperObservers.clear();
    chatRootWatch.disconnect();
    chatObservers.clear();
    chatText.disconnect();
    scopeWatch.disconnect();
    scopes.clear();
    if (timer !== null) host.clearTimeout(timer);
    if (chatTimer !== null) host.clearTimeout(chatTimer);
    dirty.clear();
    chatDirty.clear();
    for (const [node, change] of textChanges) {
      if (node.isConnected && node.nodeValue === change.after) node.nodeValue = change.before;
    }
    for (const [element, changes] of attributeChanges) {
      if (!element.isConnected) continue;
      for (const [attribute, change] of changes) {
        if (element.getAttribute(attribute) === change.after) element.setAttribute(attribute, change.before);
      }
    }
    textChanges.clear();
    attributeChanges.clear();
    if (host[INSTANCE_KEY]?.cleanup === cleanup) delete host[INSTANCE_KEY];
  }

  // 쉴 때 미룬 서랍을 하나씩 (한 번에 10ms 쯤 — 긴 작업을 만들지 않게 큰 서랍은 자식 단위로 나눈다)
  function drainDeferred(deadline) {
    if (stopped) return;
    const started = host.performance.now();
    quiet = true;   // BL 1.0.0: 닫힌 서랍의 글은 조각을 받지 않고 적어만 둬요(laterParts · pending) — 열리거나 처음 누를 때 받아요
    const budget = () => (deadline?.timeRemaining && !deadline.didTimeout ? deadline.timeRemaining() > 2 : host.performance.now() - started < 10);   // 시간 초과로 불리면 남은 시간이 0 이라 10ms 만큼은 한다
    while (deferred.size && budget()) {
      const root = deferred.values().next().value;
      if (!root.isConnected) { deferred.delete(root); kids.delete(root); continue; }
      // 다 끝날 때까지 서랍은 deferred 에 남아, 그 사이 열리면 통째로 바로 번역한다
      let queue = kids.get(root);
      if (!queue) {
        if (root.children.length > 1 && root.querySelectorAll('*').length > 400) {
          translateAttributes(root, true);
          for (const n of root.childNodes) if (n.nodeType === 3) translateText(n, true);
          kids.set(root, queue = [...root.children]);
        } else { deferred.delete(root); processNode(root); continue; }
      }
      const child = queue.shift();
      if (child?.isConnected) processNode(child);
      if (!queue.length) { deferred.delete(root); kids.delete(root); }
    }
    quiet = false;
    if (deferred.size) { if (deadline && !deadline.didTimeout) idle(drainDeferred); else host.setTimeout(() => drainDeferred(null), 20); }   // 쉴 틈이 없으면 10ms 일 · 20ms 쉼
  }
  const idle = fn => (host.requestIdleCallback ? host.requestIdleCallback(fn, { timeout: 1000 }) : host.setTimeout(() => fn(null), 60));
  function init() {
    if (stopped) return;
    deferOn = true;
    for (const scope of doc.querySelectorAll(SCOPE)) attachScope(scope);
    deferOn = false;
    if (deferred.size) idle(drainDeferred);
    discovery.observe(doc.body, { childList: true });
    watchChat();
    for(const pop of doc.querySelectorAll('.TH-popup'))watchHelper(pop);
  }

  // BL 9.0.7: 사전(1.0.0 부터는 색인 약 40KB)은 처음 필요할 때 받아요 — 쉬는 틈(늦어도 3초 뒤) · 화면을 처음 누르거나 글쇠를 칠 때 중 먼저 오는 것.
  //   받기 전에는 아무것도 바꾸지 않고 감시도 걸지 않아요. 받은 뒤 처음 훑기(init)가 그동안 그려진 것까지 한 번에 봐요(닫힌 서랍은 예전처럼 미뤄요).
  let wantDictionary = null, prefetchParts = null;
  function startWhenNeeded(load) {
    let idleHandle = 0;
    const go = () => {
      if (wantDictionary !== go) return;
      wantDictionary = null;
      doc.removeEventListener('pointerdown', go, true);
      doc.removeEventListener('keydown', go, true);
      if (idleHandle && host.cancelIdleCallback) host.cancelIdleCallback(idleHandle);
      Promise.resolve().then(load).then(data => {
        if (stopped) return;
        if (data && data.index && typeof data.load === 'function') {
          useIndex(data.index, data.load);   // BL 1.0.0: 색인만 — 조각은 처음 필요할 때(위 noteMiss) · 처음 누를 때(아래) 받아요
          prefetchParts = () => {
            doc.removeEventListener('pointerdown', prefetchParts, true); doc.removeEventListener('keydown', prefetchParts, true); prefetchParts = null;
            for (const part of ['boot', 'drawers', 'templates']) wantPart(part);   // 서랍을 여는 순간 · 창이 뜨는 순간 영어가 비치지 않게 미리
            flushLater();
          };
          doc.addEventListener('pointerdown', prefetchParts, true);
          doc.addEventListener('keydown', prefetchParts, true);
        } else useDictionary(data);
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
        else init();
      }).catch(error => {
        console.warn('[한글화] 사전을 받지 못했어요 — 5초 뒤 다시 받아요', error);
        if (!stopped) host.setTimeout(() => { if (!stopped) startWhenNeeded(load); }, 5000);
      });
    };
    wantDictionary = go;
    doc.addEventListener('pointerdown', go, true);
    doc.addEventListener('keydown', go, true);
    idleHandle = host.requestIdleCallback ? host.requestIdleCallback(go, { timeout: 3000 }) : host.setTimeout(go, 600);
  }

  host[INSTANCE_KEY] = { version: '1.4.8', cleanup };
  window.addEventListener('pagehide', cleanup, { once: true });
  // 내장본은 실행기가 BlueLemonade.koreanDictionary 를 넘겨요 → 처음 필요할 때. 사전을 품은 이 원본을 그대로 돌리면 바로 시작해요
  const loadDictionary = typeof BlueLemonade === 'object' && BlueLemonade ? BlueLemonade.koreanDictionary : null;
  if (typeof loadDictionary === 'function') startWhenNeeded(loadDictionary);
  else if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
/*BL-SCRIPT-END*/
}
