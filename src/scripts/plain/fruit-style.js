// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/fruit-style.js 을 고치고 다시 만든다
export default function blueLemonadeScript(BlueLemonade) {
/*BL-SCRIPT-START*/
// Optional presentation and help. No preset, command, input or skin preference is changed.
function installFruitStyle(BlueLemonade, css) {
  let host = window;
  try { while (host.parent && host.parent !== host && host.parent.document) host = host.parent; } catch {}
  const key = '__blueLemonadeFruitStyle_v1';
  host[key]?.stop?.();
  const doc = host.document;
  const style = doc.createElement('style');
  style.dataset.blFruitStyle = '1';
  style.textContent = css;
  (doc.head || doc.documentElement).append(style);
  const stopHelp = installFruitHelp(doc, host, FRUIT_HELP_GUIDE);
  const stopOptionHelp = BlueLemonade.fruitOptionHelp?.();
  const stopReading = installFruitReading(doc, host);
  const stopSkin = installFruitSkin(doc, host);
  const stopHomeOrder = installFruitHomeOrder(doc, host);
  const stopExtra = installFruitExtraControls(doc, host, BlueLemonade);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    stopHelp();
    stopOptionHelp?.();
    stopReading();
    stopSkin();
    stopHomeOrder();
    stopExtra();
    style.remove();
    if (host[key]?.stop === stop) delete host[key];
  }
  host[key] = { stop };
  BlueLemonade.onCleanup(stop);
}


// This guide only owns its button and inline reading panel.
function installFruitHelp(doc, host, guide) {
  const marker = 'data-bl-fruit-help';
  let stopped = false, scheduled = false, root = null, main = null;
  let button = null, card = null, open = false, previousScroll = 0, currentView = '';
  let watchedBody = null;
  const make = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function hide(restore = true) {
    open = false;
    card?.remove();
    button?.setAttribute('aria-expanded', 'false');
    button?.removeAttribute('aria-controls');
    if (restore && root?.isConnected) {
      if (main?.isConnected) main.scrollTop = previousScroll;
      button?.focus({preventScroll: true});
    }
  }
  function createCard() {
    const panel = make('section', undefined, 'bl-fruit-help-panel');
    panel.setAttribute(marker, 'panel');
    panel.id = 'bl-fruit-help-panel-v1';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', 'bl-fruit-help-title-v1');
    const head = make('div', undefined, 'bl-fruit-help-head');
    const title = make('h3', '과일의 마음 도움말');
    title.id = 'bl-fruit-help-title-v1';
    title.tabIndex = -1;
    const back = make('button', '접기', 'fh-btn');
    back.type = 'button';
    back.addEventListener('click', event => {event.stopPropagation(); hide();});
    head.append(title, back);
    panel.append(head, make('p', guide.intro + ' 옵션을 길게 누르면 켰을 때의 효과를 확인해요. 키보드에서는 Alt+Enter 또는 Shift+F10을 누르세요.', 'bl-fruit-help-intro'));
    for (const group of guide.sections) {
      const details = make('details');
      details.dataset.helpView = group.id;
      details.append(make('summary', group.title));
      for (const item of group.items) {
        const entry = make('div', undefined, 'bl-fruit-help-item');
        entry.append(make('h4', item.title), make('small', item.source), make('p', item.text));
        details.append(entry);
      }
      panel.append(details);
    }
    const sources = make('p', undefined, 'bl-fruit-help-sources');
    sources.append(make('span', guide.credit));
    for (const source of guide.links) {
      const link = make('a', source.label);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sources.append(link);
    }
    panel.append(sources);
    return panel;
  }
  function show() {
    sync();
    if (!main || !button) return;
    previousScroll = main.scrollTop;
    open = true;
    if (!card) card = createCard();
    currentView = '';
    sync();
    main.scrollTop = 0;
    card.querySelector('h3')?.focus({preventScroll: true});
  }
  function toggle(event) {
    event.preventDefault(); event.stopPropagation();
    if (open) hide(); else show();
  }
  function keydown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); hide();
    }
  }
  function detach() {
    inner.disconnect();
    root?.removeEventListener('keydown', keydown, true);
    button?.removeEventListener('click', toggle);
    button?.remove(); card?.remove();
    // Disabling styling restores the original view without moving keyboard focus.
    if (open && root?.isConnected && main?.isConnected && root.contains(main)) main.scrollTop = previousScroll;
    root = main = button = card = null;
    open = false; currentView = '';
  }
  function sync() {
    if (stopped) return;
    if (watchedBody !== doc.body) {
      watchedBody = doc.body;
      outer.disconnect();
      outer.observe(doc.documentElement, {childList: true});
      if (watchedBody) outer.observe(watchedBody, {childList: true});
    }
    const next = doc.getElementById('fruit-heart-v6');
    if (next !== root) {
      detach(); root = next;
      if (root) {
        root.addEventListener('keydown', keydown, true);
        inner.observe(root, {childList: true, subtree: true});
      }
    }
    if (!root) return;
    const title = root.querySelector('.fh-brand strong');
    main = root.querySelector('.fh-main');
    if (!title || !main) return;
    if (!button || button.parentNode !== title) {
      button?.removeEventListener('click', toggle); button?.remove();
      button = make('button', undefined, 'bl-fruit-help-button');
      const ns = 'http://www.w3.org/2000/svg', glyph = doc.createElementNS(ns, 'svg');
      glyph.setAttribute('viewBox', '0 0 24 24'); glyph.setAttribute('fill', 'none'); glyph.setAttribute('stroke', 'currentColor');
      glyph.setAttribute('stroke-width', '1.7'); glyph.setAttribute('stroke-linecap', 'round'); glyph.setAttribute('aria-hidden', 'true');
      const circle = doc.createElementNS(ns, 'circle'); circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '9');
      const mark = doc.createElementNS(ns, 'path'); mark.setAttribute('d', 'M9.5 9a2.5 2.5 0 1 1 4 2l-1.5 1v1M12 16h.01');
      glyph.append(circle, mark); button.append(glyph);
      button.type = 'button';
      button.setAttribute(marker, 'button');
      button.setAttribute('aria-label', '과일의 마음 도움말');
      button.title = '과일의 마음 도움말';
      button.setAttribute('aria-expanded', String(open));
      button.addEventListener('click', toggle);
      title.append(button);
    }
    if (open && card) {
      const view = root.querySelector('.fh-nav-item.on')?.dataset.nav || 'overview';
      // A native tab change owns its scroll position; never restore the prior tab's offset.
      if (currentView && view !== currentView) previousScroll = main.scrollTop;
      if (card.parentNode !== main) main.prepend(card);
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-controls', card.id);
      if (view !== currentView) {
        for (const section of card.querySelectorAll('details')) section.open = section.dataset.helpView === view;
        currentView = view;
      }
    }
  }
  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    Promise.resolve().then(() => {scheduled = false; sync();});
  }
  const outer = new host.MutationObserver(schedule);
  const inner = new host.MutationObserver(schedule);
  outer.observe(doc.documentElement, {childList: true});
  sync();
  return () => {
    if (stopped) return;
    stopped = true; outer.disconnect(); detach();
  };
}

const FRUIT_HELP_GUIDE = {"intro":"과일 프리셋의 옵션을 화면에서 고르는 도구예요. 아래에서 처음 쓰는 법과 현재 탭의 설명을 볼 수 있어요.","sections":[{"id":"general","title":"처음 쓰는 분께","items":[{"title":"어디서 시작하나요?","text":"홈에서 자주 쓰는 옵션을 고르고, 더 자세한 설정은 ‘항목’에서 찾아요.","source":"원작 안내 정리"},{"title":"선택하면 무엇이 바뀌나요?","text":"프리셋 옵션은 고르면 실제 설정에 저장돼요. 화면에 보일 구역을 고르는 설정은 표시만 바꿔요.","source":"동작 해설"},{"title":"QR을 누르기 전에","text":"입력창만 채우는 카드와 바로 전송하는 카드가 있어요. 카드 설명을 확인하고 눌러요.","source":"원작 안내 정리"}]},{"id":"overview","title":"홈","items":[{"title":"모델 묶음","text":"선택한 모델에 맞는 프리셋 항목 묶음을 켜요. API 연결이나 실제 모델을 바꾸는 버튼은 아니에요.","source":"동작 해설"},{"title":"자주 쓰는 옵션","text":"홈에서 고른 옵션도 실제 프리셋에 적용돼요. 하나만 고르는 종류는 다른 선택이 함께 꺼질 수 있어요.","source":"동작 해설"},{"title":"본문 글자 수","text":"프리셋에 적힌 답변 길이 요청을 바꿔요. API의 최대 출력 토큰 설정과는 달라요.","source":"동작 해설"},{"title":"NSFW 자동","text":"답변 생성 전에 입력의 시작·종료 단어와 이전 답변의 장면 정보를 보고 전체 스위치를 바꿔요. 판단할 정보가 없으면 현재 상태를 유지해요.","source":"동작 해설"}]},{"id":"qr","title":"QR","items":[{"title":"입력창에 먼저 넣기","text":"기본 ‘전개 지시’와 ‘괄호 지시’는 입력창을 채워요. 내용을 확인하거나 고친 뒤 직접 보내면 돼요.","source":"원작 안내 정리"},{"title":"바로 전송하는 카드","text":"기본 요약·개요·카드 작성·프롬프트 조정·자동 계속은 메시지를 보내고 AI 답변 생성을 시작해요.","source":"동작 해설"},{"title":"채팅 숨기기","text":"숨기기는 지정한 대화를 AI에게 보내는 내용에서 빼고, 숨김 해제는 다시 넣어요. 채팅 기록은 남아 있어요.","source":"동작 해설"},{"title":"직접 가져온 QR","text":"가져오거나 편집한 카드는 그 안의 명령대로 실행돼요. 위 설명은 기본 카드 기준이에요.","source":"동작 해설"}]},{"id":"entries","title":"항목","items":[{"title":"항목 켜고 끄기","text":"체크하면 실제 프리셋 항목을 켜거나 꺼요. 핵심 항목은 변경 전에 확인창이 나올 수 있어요.","source":"동작 해설"},{"title":"필요한 항목 찾기","text":"이름으로 검색하거나 ‘켜진 항목만’으로 좁혀 볼 수 있어요. 구역을 열면 그 안의 항목이 보여요.","source":"원작 안내 정리"},{"title":"구역 순서와 표시","text":"구역 정렬은 패널 안의 순서만 바꿔요. 설정에서 구역을 숨겨도 프리셋 항목 자체는 꺼지지 않아요.","source":"원작 안내 정리"}]},{"id":"settings","title":"설정","items":[{"title":"연결 모델 따라가기","text":"연결된 모델을 알아보면 그 모델용 프리셋 항목으로 맞춰요. 알아보지 못한 모델은 그대로 둬요.","source":"원작 안내 정리"},{"title":"NSFW 단어와 종료 여유","text":"종료 단어가 우선이며, 단어 편집은 자동 저장돼요. 종료 여유는 NSFW 장면이 끝난 뒤 몇 회 더 유지할지 정해요. 판단은 답변 생성 전에 해요.","source":"동작 해설"},{"title":"보일 구역 고르기","text":"홈의 펼침 상태와 ‘항목’에 표시할 구역을 정해요. 표시를 줄이는 설정이며, 실제 프리셋 항목의 켜짐 상태는 바꾸지 않아요.","source":"원작 안내 정리"},{"title":"항목 변경 동기화","text":"실리태번에서 항목을 추가하거나 옮겼다면 구역 목록을 다시 읽어요. 프리셋 본문이나 항목의 켜짐 상태는 바꾸지 않아요.","source":"원작 안내 정리"},{"title":"스킨과 글꼴","text":"스킨에서 블루레몬에이드를 고르면 테마 색을 따라요. 글꼴 목록 아래에 블루레몬에이드 글꼴이 이어지고, 여기서 고른 글꼴은 이 창에만 적용돼요.","source":"동작 해설"},{"title":"빠른 답장 이름","text":"빠른 답장 줄에 보일 이름을 적어요. 비우면 원래 이름으로 돌아가고, QR 명령은 바뀌지 않아요.","source":"동작 해설"},{"title":"홈 화면 항목 되돌리기","text":"⠿ 손잡이를 잡았을 때만 순서가 바뀌어요. 처음 순서로 되돌리기는 이 프리셋에 저장된 순서와 펼침 상태만 지워요.","source":"동작 해설"}]}],"credit":"원작 화면의 안내를 정리하고, 코드로 확인한 내용은 ‘동작 해설’로 구분했어요.","links":[{"label":"원작 저장소","url":"https://github.com/kongkongmie/guoshizhixin"},{"label":"프롬프트 원문","url":"https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064"}]};
// Compact optional explanations without moving or replacing original text/control nodes.
function installFruitReading(doc,host) {
  const HIDDEN='data-bl-fruit-reading-hidden',groups=new Map(),opened=new Map();
  let root=null,stopped=false,scheduled=false;
  const restore=record=>{for(const [node,before]of record.notes){if(node.getAttribute(HIDDEN)==='1'){if(before===null)node.removeAttribute(HIDDEN);else node.setAttribute(HIDDEN,before);}}record.notes.clear();record.tools.remove();};
  const clear=()=>{for(const record of groups.values())restore(record);groups.clear();};
  const paint=record=>{
    for(const [node,before]of record.notes){if(record.open){if(node.getAttribute(HIDDEN)==='1'){if(before===null)node.removeAttribute(HIDDEN);else node.setAttribute(HIDDEN,before);}}else if(node.getAttribute(HIDDEN)!=='1')node.setAttribute(HIDDEN,'1');}
    record.button.setAttribute('aria-expanded',String(record.open));
    const text=record.open?'설명 접기':'설명 보기';if(record.label.textContent!==text)record.label.textContent=text;
  };
  const eligible=node=>{
    if(node.closest('details') || node.querySelector('button,input,select,textarea,a,[role="button"]'))return false;
    const text=node.textContent.trim();
    return text.length>=30 && !/[⚠❗]|주의|경고|지원하지|지원되지|오류|실패|무효|복구|삭제|되돌릴|无效|不支持|过低|已删|无法恢复|不能恢复/.test(text);
  };
  const sync=()=>{
    scheduled=false;if(stopped)return;
    const next=doc.getElementById('fruit-heart-v6');
    if(next!==root){inner.disconnect();clear();root=next;if(root)inner.observe(root,{childList:true,subtree:true,characterData:true});}
    if(!root || !doc.body?.classList.contains('salty') || root.querySelector('.fh-nav-item.on')?.dataset.nav!=='settings'){clear();return;}
    const cards=[...root.querySelectorAll('.fh-main .fh-card,.fh-main .fh-grp')],live=new Set(cards);
    for(const [card,record]of groups)if(!live.has(card)){restore(record);groups.delete(card);}
    for(const card of cards){
      const notes=[...card.querySelectorAll('.fh-card-head > p,.fh-mech > .fh-note,.fh-toggle > span > small')].filter(n=>n.closest('.fh-card,.fh-grp')===card&&eligible(n));
      let record=groups.get(card);
      if(!notes.length){if(record){restore(record);groups.delete(card);}continue;}
      if(!record){
        const heading=card.querySelector(':scope > .fh-card-head'),title=(heading?.querySelector('h3')?.textContent||card.querySelector('.fh-toggle > span')?.firstChild?.textContent||'설정').trim();
        const tools=doc.createElement('div');tools.className='bl-fruit-reading-tools';tools.dataset.blFruitReading='tools';
        const button=doc.createElement('button');button.type='button';button.className='bl-fruit-reading-toggle';button.setAttribute('aria-label',`${title} 설명 펼치기 또는 접기`);
        const label=doc.createElement('span');button.append(label);tools.append(button);
        record={notes:new Map(),tools,button,label,open:opened.get(title)===true,title};groups.set(card,record);
        button.addEventListener('click',event=>{event.stopPropagation();record.open=!record.open;opened.set(title,record.open);paint(record);});
        const sect=heading?null:card.previousElementSibling;if(heading)heading.append(tools);else if(sect?.classList.contains('fh-sect'))sect.append(tools);else card.insertBefore(tools,card.firstChild);
      }
      for(const [node,before]of record.notes)if(!notes.includes(node)){if(node.getAttribute(HIDDEN)==='1'){if(before===null)node.removeAttribute(HIDDEN);else node.setAttribute(HIDDEN,before);}record.notes.delete(node);}
      for(const note of notes)if(!record.notes.has(note))record.notes.set(note,note.getAttribute(HIDDEN));
      paint(record);
    }
  };
  const queue=()=>{if(!stopped&&!scheduled){scheduled=true;queueMicrotask(sync);}};
  const inner=new host.MutationObserver(queue),outer=new host.MutationObserver(queue);
  outer.observe(doc.body||doc.documentElement,{childList:true,attributes:true,attributeFilter:['class']});sync();
  return ()=>{if(stopped)return;stopped=true;outer.disconnect();inner.disconnect();clear();opened.clear();};
}

// ── Added controls. The quick-reply name lives with the theme's script settings (it follows the
//    user's settings file); the window skin and font choices stay on this device, beside the
//    original window's own appearance keys. Nothing here edits prompts, commands or QR sets. ──
const FRUIT_STORE_KEY = 'blue_lemonade_scripts', FRUIT_NAME_LIMIT = 40, FRUIT_USER_LABEL = 'data-bl-fruit-user-label';
const FRUIT_FONT_GROUPS = { sans: '고딕', serif: '명조', display: '꾸밈 · 손글씨', mono: '고정폭', custom: '내 글꼴' };
function fruitCleanName(value) {
  return Array.from(String(value ?? '').replace(/\s+/g, ' ').trim()).slice(0, FRUIT_NAME_LIMIT).join('').trim();
}
function fruitFontChoices(list) {
  // Korean families and the user's own fonts. English, Japanese and Chinese lists stay in the theme settings.
  return (Array.isArray(list) ? list : []).filter(font => font && typeof font.id === 'string' && !font.unusable && (font.group === 'custom' || font.lang === 'ko'));
}
function fruitSettingsStore(host) {
  const context = host.SillyTavern?.getContext?.();
  const settings = context?.extensionSettings;
  if (!settings || typeof settings !== 'object') return null;
  // Resolved on every call: the theme may replace the whole store object (settings import, restore).
  const names = () => {
    let state = settings[FRUIT_STORE_KEY];
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = settings[FRUIT_STORE_KEY] = { version: 1, enabled: {}, overrides: {} };
    if (!state.names || typeof state.names !== 'object' || Array.isArray(state.names)) state.names = {};
    return state.names;
  };
  return {
    read: () => fruitCleanName(names().fruit),
    write(value) { names().fruit = fruitCleanName(value); context.saveSettingsDebounced?.(); },
  };
}
const fruitSalty = doc => !!doc.body?.classList.contains('salty');
const fruitLocal = {
  read(host, key) { try { return host.localStorage.getItem(key); } catch { return null; } },
  write(host, key, value) { try { if (value === null) host.localStorage.removeItem(key); else host.localStorage.setItem(key, value); } catch {} },
};

// Skin: a 블루레몬에이드 choice beside the original skins. Only the shown state of the original
// skin buttons changes; the skin the window stores for itself is untouched.
function installFruitSkin(doc, host) {
  const KEY = 'blue-lemonade-fruit-skin', ATTR = 'data-bl-fruit-skin';
  let lemonade = fruitLocal.read(host, KEY) !== 'native';
  let root = null, stopped = false, queued = false, button = null;
  const dimmed = new Set();
  const restoreNative = () => { for (const node of dimmed) if (node.isConnected) node.classList.add('on'); dimmed.clear(); };
  const dropButton = () => { button?.remove(); button = null; };
  function sync() {
    queued = false; if (stopped) return;
    const next = doc.getElementById('fruit-heart-v6');
    if (next !== root) {
      inner.disconnect(); root?.removeAttribute(ATTR); restoreNative(); dropButton(); root = next;
      if (root) inner.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    if (!root) return;
    if (!fruitSalty(doc)) { root.removeAttribute(ATTR); restoreNative(); dropButton(); return; }
    if (lemonade) { if (root.getAttribute(ATTR) !== 'lemonade') root.setAttribute(ATTR, 'lemonade'); }
    else if (root.hasAttribute(ATTR)) root.removeAttribute(ATTR);
    for (const node of dimmed) if (!node.isConnected) dimmed.delete(node);
    const natives = [...root.querySelectorAll('[data-skin-set]')], seg = natives[0]?.closest('.fh-seg');
    if (!seg) { dropButton(); return; }
    if (!button?.isConnected || button.parentNode !== seg) {
      dropButton();
      button = doc.createElement('button'); button.type = 'button'; button.dataset.blSkinSet = 'lemonade';
      button.setAttribute(FRUIT_USER_LABEL, ''); button.textContent = '블루레몬에이드';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); lemonade = true; fruitLocal.write(host, KEY, null); sync(); });
      seg.append(button);
    }
    if (button.classList.contains('on') !== lemonade) button.classList.toggle('on', lemonade);
    if (button.getAttribute('aria-pressed') !== String(lemonade)) button.setAttribute('aria-pressed', String(lemonade));
    for (const node of natives) {
      if (lemonade && node.classList.contains('on')) { node.classList.remove('on'); dimmed.add(node); }
      else if (!lemonade && dimmed.has(node)) { node.classList.add('on'); dimmed.delete(node); }
    }
  }
  const schedule = () => { if (!stopped && !queued) { queued = true; host.queueMicrotask(sync); } };
  const onClick = event => {
    if (stopped || !root?.contains(event.target) || !event.target.closest?.('[data-skin-set]')) return;
    lemonade = false; fruitLocal.write(host, KEY, 'native'); schedule();
  };
  doc.addEventListener('click', onClick, true);
  const inner = new host.MutationObserver(schedule), outer = new host.MutationObserver(schedule);
  outer.observe(doc.documentElement, { childList: true });
  if (doc.body) outer.observe(doc.body, { childList: true, attributes: true, attributeFilter: ['class'] });
  sync();
  return () => {
    if (stopped) return; stopped = true;
    inner.disconnect(); outer.disconnect(); doc.removeEventListener('click', onClick, true);
    root?.removeAttribute(ATTR); restoreNative(); dropButton();
  };
}

// Home order: only the ⠿ handle starts a drag, and a reset removes the saved order so the
// original window computes its own default again. The preset is written through the same
// Helper API the original uses for the same prompt.
function installFruitHomeOrder(doc, host) {
  const CONFIG = 'fruit-heart-control-config-v2';
  let root = null, stopped = false, queued = false, saving = false;
  const boxes = new Map();
  const resolve = name => { for (const source of [host, host.TavernHelper]) if (typeof source?.[name] === 'function') return source[name].bind(source); return null; };
  const clear = () => { for (const box of boxes.values()) box.remove(); boxes.clear(); };
  const configOf = preset => {
    const prompt = preset?.prompts?.find(item => String(item?.id ?? '') === CONFIG);
    let config; try { config = JSON.parse(prompt?.content || 'null'); } catch {}
    if (!config || config.version !== 4 || !config.controlGroups) throw Error('이 프리셋의 홈 화면 항목은 되돌릴 수 없어요.');
    return { prompt, config };
  };
  async function reset(button) {
    if (saving || stopped || !button.isConnected) return;
    const getName = resolve('getLoadedPresetName'), getPreset = resolve('getPreset'), update = resolve('updatePresetWith');
    if (!getName || !getPreset || !update) { host.toastr?.error?.('실리태번 헬퍼에서 프리셋을 읽지 못했어요.'); return; }
    saving = true; button.disabled = true; const owner = root; let name = '';
    const check = () => { if (stopped || root !== owner || !owner?.isConnected || getName() !== name) throw Error('프리셋이 바뀌어 되돌리기를 멈췄어요.'); };
    try {
      name = getName(); if (!name) throw Error('현재 프리셋 이름을 읽지 못했어요.');
      configOf(getPreset('in_use')); configOf(getPreset(name));
      // Only the saved order and open states go; every other setting in the configuration stays.
      const resetOne = preset => {
        check(); const { prompt, config } = configOf(preset);
        delete config.homeOrder; delete config.homeOpen;
        prompt.content = JSON.stringify(config); prompt.enabled = false; return preset;
      };
      await update('in_use', resetOne, { render: 'immediate' }); check();
      await update(name, resetOne, { render: 'none' });
      owner.querySelector('.fh-nav-item[data-nav="settings"]')?.click();
      host.toastr?.success?.('홈 화면 항목을 처음 순서로 되돌렸어요.');
    } catch (error) { host.toastr?.error?.(error?.message || '홈 화면 항목을 되돌리지 못했어요.'); }
    finally { saving = false; if (button.isConnected) button.disabled = false; }
  }
  function sync() {
    queued = false; if (stopped) return;
    const next = doc.getElementById('fruit-heart-v6');
    if (next !== root) { inner.disconnect(); clear(); root = next; if (root) inner.observe(root, { childList: true, subtree: true }); }
    if (!root || !fruitSalty(doc)) { clear(); return; }
    for (const [list, box] of boxes) if (!list.isConnected) { box.remove(); boxes.delete(list); }
    for (const list of root.querySelectorAll('[data-home-sort]')) {
      if (boxes.has(list)) continue;
      const pad = list.closest('.fh-pad'); if (!pad || !pad.closest('.fh-card')) continue;
      const box = doc.createElement('div'); box.className = 'fh-card-actions bl-fruit-home-actions'; box.setAttribute(FRUIT_USER_LABEL, '');
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'fh-btn bl-fruit-home-reset'; button.textContent = '처음 순서로 되돌리기';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void reset(button); });
      box.append(button); pad.after(box); boxes.set(list, box);
    }
  }
  const schedule = () => { if (!stopped && !queued) { queued = true; host.queueMicrotask(sync); } };
  // The original starts a drag on pointerdown anywhere in a row; outside the handle the touch
  // now scrolls the list instead. Switches and buttons inside rows keep their own handlers.
  const pointer = event => {
    if (stopped || !fruitSalty(doc) || !root?.contains(event.target)) return;
    const row = event.target.closest?.('.fh-sortrow'); if (!row?.closest('.fh-sortlist')) return;
    if (event.target.closest('.fh-grip,.fh-sw,button,input,select,textarea,a')) return;
    event.stopPropagation();
  };
  doc.addEventListener('pointerdown', pointer, true);
  const inner = new host.MutationObserver(schedule), outer = new host.MutationObserver(schedule);
  outer.observe(doc.documentElement, { childList: true });
  if (doc.body) outer.observe(doc.body, { childList: true, attributes: true, attributeFilter: ['class'] });
  sync();
  return () => { if (stopped) return; stopped = true; inner.disconnect(); outer.disconnect(); doc.removeEventListener('pointerdown', pointer, true); clear(); };
}

// Quick-reply name and Blue Lemonade fonts, added through the original window's own controls.
// The entry keeps its id, command and click handler; only its visible label and tooltip change.
function installFruitExtraControls(doc, host, BlueLemonade) {
  const FONT_KEY = 'blue-lemonade-fruit-font';
  const store = fruitSettingsStore(host);
  let selectedFont = fruitLocal.read(host, FONT_KEY) || '', entryName = store?.read() || '', draft = entryName;
  let root = null, stopped = false, scheduled = false, sheetPending = false, fontRecord = null, nameRow = null, nameInput = null;
  let draftFocused = false, draftSelection = null;
  const pickLabels = new Map(), entries = new Map(), sheets = new Map(), barRoots = new Set();
  const make = (tag, text, className) => { const node = doc.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const fontList = () => { try { return fruitFontChoices(BlueLemonade.fonts?.list?.()); } catch { return []; } };
  const fontById = id => id ? fontList().find(font => font.id === id) || null : null;
  function restoreFont() {
    if (fontRecord) {
      const { node, value, priority, applied } = fontRecord;
      if (node.style.getPropertyValue('--font') === applied) { if (value) node.style.setProperty('--font', value, priority); else node.style.removeProperty('--font'); }
      node.removeAttribute('data-bl-fruit-font'); fontRecord = null;
    }
    for (const record of pickLabels.values()) { record.label.remove(); if (record.text.nodeValue === '') record.text.nodeValue = record.value; }
    pickLabels.clear();
  }
  function applyFont() {
    const font = fontById(selectedFont), stack = font && BlueLemonade.fonts?.stack?.(font.id);
    if (!root || !font || !stack) { restoreFont(); return; }
    if (!fontRecord || fontRecord.node !== root) { restoreFont(); fontRecord = { node: root, value: root.style.getPropertyValue('--font'), priority: root.style.getPropertyPriority('--font'), applied: '' }; }
    const now = root.style.getPropertyValue('--font');
    // The original rewrites --font when its own font or skin changes; that value is the one to restore later.
    if (fontRecord.applied && now !== fontRecord.applied) { fontRecord.value = now; fontRecord.priority = root.style.getPropertyPriority('--font'); }
    if (now !== stack) root.style.setProperty('--font', stack);
    fontRecord.applied = stack;
    if (root.getAttribute('data-bl-fruit-font') !== font.id) root.setAttribute('data-bl-fruit-font', font.id);
    for (const [button] of pickLabels) if (!button.isConnected) pickLabels.delete(button);
    for (const button of root.querySelectorAll('[data-pick-font]')) {
      let record = pickLabels.get(button);
      if (!record) {
        const text = [...button.childNodes].find(node => node.nodeType === 3); if (!text) continue;
        const label = make('span', '', 'bl-fruit-font-label'); label.setAttribute(FRUIT_USER_LABEL, '');
        record = { text, value: text.nodeValue, label }; pickLabels.set(button, record); button.insertBefore(label, text);
      }
      if (record.text.nodeValue !== '') { record.value = record.text.nodeValue; record.text.nodeValue = ''; }
      if (record.label.textContent !== font.label) record.label.textContent = font.label;
      if (!record.label.isConnected) button.insertBefore(record.label, record.text);
    }
  }
  function clearFont() { selectedFont = ''; fruitLocal.write(host, FONT_KEY, null); restoreFont(); }
  function closeSheet(sheet) { sheet.querySelector('[data-sheet-close]')?.click(); }
  function addFontOptions(sheet) {
    if (sheets.has(sheet) || !BlueLemonade.fonts) return;
    const list = sheet.querySelector('.fh-sheet-list'); if (!list) return;
    const fonts = fontList(); if (!fonts.length) return;
    const group = make('section', null, 'bl-fruit-font-options'); group.setAttribute(FRUIT_USER_LABEL, '');
    const search = make('input'); search.type = 'search'; search.className = 'bl-fruit-font-search'; search.placeholder = '블루레몬에이드 글꼴 찾기'; search.setAttribute('aria-label', '블루레몬에이드 글꼴 찾기');
    const choices = make('div', null, 'bl-fruit-font-choices'), empty = make('p', '맞는 글꼴이 없어요.', 'bl-fruit-font-empty'); empty.hidden = true;
    group.append(make('div', '블루레몬에이드 글꼴', 'fh-sheet-head'), search, choices, empty);
    const nativeOn = selectedFont ? [...list.querySelectorAll('[data-pick-index].on')] : [];
    for (const button of nativeOn) button.classList.remove('on');
    const rows = fonts.map(font => {
      const button = make('button', null, 'fh-sheet-item'); button.type = 'button'; button.dataset.blFruitFontChoice = font.id;
      button.append(make('span', font.label), make('em', FRUIT_FONT_GROUPS[font.group] || '블루레몬에이드'), make('i', '✓'));
      const on = font.id === selectedFont; button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on));
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        selectedFont = font.id; fruitLocal.write(host, FONT_KEY, font.id);
        try { BlueLemonade.fonts.load(font.id); } catch {}
        applyFont(); closeSheet(sheet);
      });
      return { button, key: `${font.label} ${font.id}`.toLocaleLowerCase() };
    });
    choices.append(...rows.map(row => row.button)); list.append(group); sheet.dataset.blFruitFontSheet = '1';
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase(); let visible = 0;
      for (const row of rows) { row.button.hidden = !!query && !row.key.includes(query); if (!row.button.hidden) visible++; }
      empty.hidden = visible > 0;
    });
    sheets.set(sheet, { group, nativeOn });
  }
  function restoreEntry(record) {
    for (const [text, value] of record.texts) if (text.nodeValue === '') text.nodeValue = value;
    record.label.remove();
    for (const [name, before] of record.attrs) if (record.node.getAttribute(name) === record.applied) { if (before === null) record.node.removeAttribute(name); else record.node.setAttribute(name, before); }
    record.node.removeAttribute(FRUIT_USER_LABEL);
  }
  function paintEntries() {
    const live = new Set(doc.querySelectorAll('[data-fh-cat="1"]'));
    for (const [node, record] of entries) if (!live.has(node) || !entryName) { restoreEntry(record); entries.delete(node); }
    if (!entryName) return;
    for (const node of live) {
      const target = node.querySelector('.qr--button-label') || node;
      let record = entries.get(node);
      if (record && record.label.parentNode !== target) { restoreEntry(record); entries.delete(node); record = null; }
      if (!record) {
        const label = make('span', entryName, 'bl-fruit-entry-name'); label.setAttribute(FRUIT_USER_LABEL, '');
        record = { node, label, texts: new Map(), attrs: new Map(['title', 'aria-label'].map(name => [name, node.getAttribute(name)])), applied: '' };
        node.setAttribute(FRUIT_USER_LABEL, ''); target.append(label); entries.set(node, record);
      }
      const walker = doc.createTreeWalker(target, 4);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (text.parentElement?.closest('.bl-fruit-entry-name,svg,.fh-bar-cat,.qr--button-expander,.qr--button-icon')) continue;
        if (text.nodeValue !== '') { record.texts.set(text, text.nodeValue); text.nodeValue = ''; }
        else if (!record.texts.has(text)) record.texts.set(text, '');
      }
      if (record.label.textContent !== entryName) record.label.textContent = entryName;
      for (const name of ['title', 'aria-label']) {
        const current = node.getAttribute(name);
        if (record.applied && current !== record.applied) record.attrs.set(name, current);
        if (current !== entryName) node.setAttribute(name, entryName);
      }
      record.applied = entryName;
    }
  }
  function commitName() {
    entryName = fruitCleanName(nameInput?.isConnected ? nameInput.value : draft); draft = entryName;
    if (nameInput && nameInput.value !== entryName) nameInput.value = entryName;
    store?.write(entryName); paintEntries();
  }
  function mountRename() {
    const toggle = root?.querySelector('[data-entry-toggle="bar"]')?.closest('.fh-toggle');
    const entry = doc.body?.getAttribute('data-bl-fruit-entry');
    if (!toggle || (entry && entry !== 'qr')) { nameRow?.remove(); nameRow = nameInput = null; return; } // QR 이 아닌 여는 방법(요술봉 · 고양이)에서는 빠른 답장 이름이 쓸모없다
    if (nameRow?.isConnected && nameRow.previousElementSibling === toggle) return;
    nameRow?.remove();
    nameRow = make('div', null, 'fh-row fh-stack bl-fruit-qr-name'); nameRow.setAttribute(FRUIT_USER_LABEL, '');
    const key = make('span', '빠른 답장 이름', 'fh-k'), box = make('div', null, 'fh-v');
    nameInput = make('input'); nameInput.type = 'text'; nameInput.value = draft; nameInput.placeholder = '비우면 원래 이름';
    nameInput.maxLength = FRUIT_NAME_LIMIT; nameInput.autocomplete = 'off'; nameInput.setAttribute('aria-label', '빠른 답장 줄에 보일 이름');
    nameInput.addEventListener('input', () => { draft = nameInput.value; draftSelection = [nameInput.selectionStart, nameInput.selectionEnd]; });
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commitName(); nameInput.blur(); } });
    nameInput.addEventListener('focus', () => { draftFocused = true; });
    box.append(nameInput); nameRow.append(key, box); toggle.after(nameRow);
    if (draftFocused) { nameInput.focus({ preventScroll: true }); if (draftSelection) try { nameInput.setSelectionRange(...draftSelection); } catch {} }
  }
  function sync() {
    scheduled = false; if (stopped) return;
    if ([...barRoots].some(node => !node.isConnected)) { barObserver.disconnect(); barRoots.clear(); }
    for (const node of doc.querySelectorAll('#form_sheld,#qr--popout,#quickReplies')) if (!barRoots.has(node)) { barRoots.add(node); barObserver.observe(node, { childList: true, subtree: true, characterData: true }); }
    const next = doc.getElementById('fruit-heart-v6');
    if (next !== root) {
      restoreFont(); inner.disconnect(); root = next; nameRow = nameInput = null; sheetPending = false;
      if (root) inner.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    }
    for (const [sheet, { group }] of sheets) if (!sheet.isConnected) { group.remove(); sheets.delete(sheet); }
    const active = fruitSalty(doc);
    if (!draftFocused && store) { const stored = store.read(); if (stored !== entryName) { entryName = stored; draft = stored; if (nameInput) nameInput.value = stored; } }
    if (root && active) {
      applyFont(); mountRename();
      if (sheetPending) { const sheet = root.querySelector('.fh-sheet'); if (sheet) { addFontOptions(sheet); sheetPending = false; } }
    } else { restoreFont(); nameRow?.remove(); nameRow = nameInput = null; }
    if (active) paintEntries();
    else for (const [node, record] of entries) { restoreEntry(record); entries.delete(node); }
  }
  const queue = () => { if (!stopped && !scheduled) { scheduled = true; host.queueMicrotask(sync); } };
  const onClick = event => {
    const target = event.target?.closest?.('button'); if (!root || !target || !root.contains(target)) return;
    if (target.matches('[data-pick-font]')) { sheetPending = true; queue(); }
    else if (target.matches('[data-pick-index]') && target.closest('[data-bl-fruit-font-sheet]')) clearFont();
  };
  const onPointer = event => { if (nameRow && !nameRow.contains(event.target)) draftFocused = false; };
  const onFocus = event => { if (nameRow && !nameRow.contains(event.target)) draftFocused = false; };
  const inner = new host.MutationObserver(queue), outer = new host.MutationObserver(queue), barObserver = new host.MutationObserver(queue);
  outer.observe(doc.documentElement, { childList: true });
  if (doc.body) outer.observe(doc.body, { childList: true, attributes: true, attributeFilter: ['class', 'data-bl-fruit-entry'] });
  doc.addEventListener('click', onClick, true); doc.addEventListener('pointerdown', onPointer, true); doc.addEventListener('focusin', onFocus, true);
  if (selectedFont) try { BlueLemonade.fonts?.load?.(selectedFont); } catch {}
  sync();
  return () => {
    if (stopped) return; stopped = true;
    inner.disconnect(); outer.disconnect(); barObserver.disconnect();
    doc.removeEventListener('click', onClick, true); doc.removeEventListener('pointerdown', onPointer, true); doc.removeEventListener('focusin', onFocus, true);
    restoreFont(); for (const record of entries.values()) restoreEntry(record); entries.clear();
    nameRow?.remove(); nameRow = nameInput = null;
    for (const [sheet, { group, nativeOn }] of sheets) { group.remove(); for (const button of nativeOn) if (button.isConnected) button.classList.add('on'); sheet.removeAttribute('data-bl-fruit-font-sheet'); }
    sheets.clear();
  };
}

installFruitStyle(BlueLemonade, "/* Every rule is gated by the active theme; only the panel's presentation changes.\n   html > body.salty #fruit-heart-v6#fruit-heart-v6 = the Fruit window while Blue Lemonade is on (layout, typography, control geometry: every skin).\n   html > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] = the same window while its skin choice is 블루레몬에이드 (palette only). The original skins keep\n   their own colors, tape and glass when the user picks them in the window. */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 {\n  --font-sans:var(--salty-font-ui,var(--mainFontFamily,system-ui));\n  --bl-fh-acc-ink:var(--acc); --bl-fh-field:var(--card2); --bl-fh-hover:var(--fill2);\n  --bl-fh-danger:var(--acc); --bl-fh-danger-soft:var(--acc-soft); --bl-fh-scrim:#1a161366;\n  --bl-fh-sheet-shadow:var(--shadow); --bl-fh-knob-shadow:0 1px 3px #00000033;\n  --bl-fh-pad:12px; --bl-fh-row:44px; --bl-fh-control:36px; --bl-fh-chip:32px;\n  --salty-accent-13:color-mix(in srgb,var(--salty-accent) 13%,transparent);\n  --salty-accent-28:color-mix(in srgb,var(--salty-accent) 28%,transparent);\n  --salty-well-in:inset 0 1px 2px rgba(0,0,0,.06);\n  font-family:var(--font) !important;\n  font-size:var(--salty-ui-size,var(--mainFontSize,15px)); line-height:1.5;\n  font-weight:var(--salty-ui-weight,normal); letter-spacing:var(--bl-settings-tracking,normal);\n  word-break:keep-all; overflow-wrap:anywhere;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 * { box-sizing:border-box; }\n\n/* ── Blue Lemonade skin: the theme palette, day/night follow the window's own switch ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] {\n  --paper:var(--salty-panel-surface,var(--salty-surface)) !important;\n  --card:var(--salty-fill-surface,var(--salty-surface)) !important;\n  --card2:var(--salty-control,var(--salty-surface)) !important;\n  --fill:var(--salty-shade) !important;\n  --fill2:var(--salty-shade-2) !important;\n  --ink:var(--salty-text) !important;\n  --ink2:var(--salty-muted) !important;\n  --ink3:var(--salty-muted) !important;\n  --line:var(--salty-line) !important;\n  --acc:var(--salty-accent) !important;\n  --acc-soft:var(--salty-accent-13,var(--salty-shade)) !important;\n  --acc-line:var(--salty-accent-28) !important;\n  --gold:var(--salty-accent) !important;\n  --on-acc:var(--salty-on-accent) !important;\n  --knob:var(--salty-raised,var(--salty-text)) !important;\n  --track:var(--salty-line) !important;\n  --shadow:var(--salty-e1) !important;\n  --grain:none !important;\n  --r:var(--bl-r-md,12px) !important;\n  --r2:var(--bl-r-sm,8px) !important;\n  --bl-fh-acc-ink:var(--salty-accent-ink,var(--salty-accent));\n  --bl-fh-field:var(--salty-fill-field,var(--salty-field));\n  --bl-fh-hover:var(--salty-control-hover,var(--fill2));\n  --bl-fh-danger:var(--salty-danger); --bl-fh-danger-soft:var(--salty-danger-soft);\n  --bl-fh-scrim:var(--salty-scrim); --bl-fh-sheet-shadow:var(--salty-e4); --bl-fh-knob-shadow:var(--salty-knob,var(--salty-e1));\n  color:var(--salty-text); background:var(--salty-scrim);\n  backdrop-filter:none; -webkit-backdrop-filter:none;\n  color-scheme:light;\n}\nhtml > body.salty.salty-dark #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] { color-scheme:dark; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"][data-theme=\"day\"] {\n  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#fafbfc);\n  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 2%,#fff);\n  --salty-control:color-mix(in srgb,var(--salty-accent) 4%,#edf0f4);\n  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 10%,#e9edf3);\n  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#e9edf2);\n  --salty-text:#242b35; --salty-muted:#586473; --salty-line:rgba(43,56,73,.16);\n  --salty-shade:rgba(43,56,73,.055); --salty-shade-2:rgba(43,56,73,.09);\n  --salty-raised:#fff; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 58%,#17222e);\n  --salty-scrim:rgba(21,27,35,.22); color-scheme:light !important;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"][data-theme=\"night\"] {\n  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#20242c);\n  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 3%,#282d36);\n  --salty-control:color-mix(in srgb,var(--salty-accent) 5%,#303641);\n  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 12%,#353c49);\n  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#1b2028);\n  --salty-text:#ecf0f5; --salty-muted:#b1bdcc; --salty-line:rgba(221,232,246,.17);\n  --salty-shade:rgba(221,232,246,.06); --salty-shade-2:rgba(221,232,246,.10);\n  --salty-raised:#dce6f2; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 66%,#fff);\n  --salty-scrim:rgba(4,7,12,.40); color-scheme:dark !important;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-shell { background:var(--paper); border:0; box-shadow:var(--salty-e5); backdrop-filter:none; -webkit-backdrop-filter:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow) {\n  background:var(--card); border:1px solid var(--line); box-shadow:none; overflow:hidden;\n  backdrop-filter:none; -webkit-backdrop-filter:none;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before, html > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-qr-card::after { content:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] :is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) { background:var(--fill); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-brand strong { background:none; background-clip:border-box; -webkit-background-clip:border-box; color:var(--ink); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-brand-mark { filter:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-bottom-nav { background:var(--paper); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-sheet-box { background:var(--card); border:0; backdrop-filter:none; -webkit-backdrop-filter:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-lab, html > body.salty #fruit-heart-v6#fruit-heart-v6[data-bl-fruit-skin=\"lemonade\"] .fh-link { color:var(--bl-fh-acc-ink); }\n\n/* ── Shell ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-shell {\n  container:bl-fruit-settings / inline-size;\n  width:min(760px,100%); min-width:0; max-width:100%;\n  grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) auto;\n  grid-template-areas:\"head\" \"main\" \"nav\"; border-radius:var(--r);\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6.fh-is-fullscreen .fh-shell { width:100%; height:100%; border-radius:var(--r2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-header,.fh-main,.fh-bottom-nav) { min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-header { grid-area:head; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:4px 8px; padding:12px; border:0; align-items:center; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-brand,.fh-brand > div) { display:contents; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand-mark { grid-column:1; grid-row:1; width:1.5em; height:1.5em; margin:0; color:var(--bl-fh-acc-ink); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand strong { grid-column:2; grid-row:1; min-width:0; font-size:1.15em; line-height:1.35; letter-spacing:normal; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand :is(em,small) { grid-column:1 / -1; min-width:0; font-size:.78em; line-height:1.45; letter-spacing:normal; margin:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand em { grid-row:2; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand small { grid-row:3; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-header:has(.fh-update-badge:not([hidden])) .fh-brand em { padding-right:44px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-update-badge { grid-column:3; grid-row:2; justify-self:end; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-header-meta { grid-column:3; grid-row:1; gap:4px; flex-wrap:nowrap; justify-content:flex-end; max-width:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-header-meta::before { content:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge) {\n  display:inline-flex; align-items:center; justify-content:center; padding:0; text-align:center;\n  width:var(--bl-fh-control); height:var(--bl-fh-control); min-width:var(--bl-fh-control); min-height:var(--bl-fh-control);\n  font-size:1em; line-height:1; border:0; border-radius:var(--r2);\n  background:var(--card2); color:var(--ink);\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-close { font-size:1.25em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-main { grid-area:main; padding:8px 12px; overflow:auto; scrollbar-gutter:stable; background:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-main > * { max-width:100%; margin-left:0; margin-right:0; }\n\n/* ── Type scale: one size for titles and labels, one smaller size for notes ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(h2,h3,.fh-k,.fh-ck,.fh-ch b,.fh-sec-head b,.fh-qr-copy strong,.fh-qr-head strong,.fh-toggle,.fh-sortrow b,.fh-mech-head b) {\n  font-size:1em; line-height:1.45; font-weight:inherit; letter-spacing:inherit; color:var(--ink);\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 h2 { font-size:1.2em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-head h3,.fh-ch b,.fh-sec-head b,.fh-qr-head strong) { font-weight:600; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(p,.fh-dim,.fh-lab,.fh-hint,.fh-note,.fh-sect b,.fh-sect span,.fh-doc > summary,.fh-doc p,.fh-foot,.fh-empty,.fh-qr-copy small,.fh-qr-desc,.fh-qr-tip,.fh-sign,.fh-exp-tip,.fh-exp-rtext small,.fh-toggle span small,.fh-update-tip,.fh-update-status,.fh-update-entry ul,.fh-ck em,.fh-sortrow span,.fh-ch .fh-n,.fh-mech-head i,.fh-mech-head .fh-n) {\n  font-size:.85em; line-height:1.5; letter-spacing:inherit;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(p,.fh-hint,.fh-note,.fh-dim,.fh-toggle span small,.fh-ck em,.fh-sortrow span,.fh-ch .fh-n) { color:var(--ink2); opacity:1; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-lab,.fh-sect) { margin:14px 4px 6px; padding:0; border:0; flex-wrap:wrap; color:var(--ink2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect { flex-direction:column; align-items:flex-start; gap:2px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect b { font-size:1em; font-weight:600; letter-spacing:inherit; color:var(--ink); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect span { line-height:1.5; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-lab { font-weight:600; letter-spacing:inherit; }\n\n/* ── Cards ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry) { border-radius:var(--r); margin-top:0; margin-bottom:10px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) { padding:9px var(--bl-fh-pad); gap:8px; border:0; border-bottom:1px solid var(--line); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card-head > p { margin:3px 0 0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-actions,.fh-pad,.fh-qr-acts) { padding:10px var(--bl-fh-pad); gap:6px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips { padding:10px var(--bl-fh-pad); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips + .fh-card-actions { padding-top:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card > :is(.fh-v,textarea) { margin:10px var(--bl-fh-pad); width:calc(100% - var(--bl-fh-pad) * 2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp) > .fh-tagbox { padding:0 var(--bl-fh-pad) 10px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions) { display:grid; grid-template-columns:minmax(0,1fr); gap:6px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions) > :is(button,.fh-btn,.fh-chip) { width:100%; margin:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-ch { min-height:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-ch b { min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech { margin:8px var(--bl-fh-pad); padding:6px 0 6px 10px; border-left:2px solid var(--line); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech + .fh-mech { margin-top:0; padding-top:8px; border-top:1px solid var(--line); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech-head { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; margin-bottom:4px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech-head b { flex:1 1 auto; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech-head > .fh-n { margin-left:auto; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-mech :is(.fh-row,.fh-toggle,.fh-pad) { padding-left:0; padding-right:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 #fh-ecot-end-tags { height:4.5em; min-height:3em; max-height:none; }\n\n/* ── Rows: name on the left, control on the right, on one line whenever it fits.\n   A control that is too wide for the remaining space moves to its own full-width line. ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; min-height:var(--bl-fh-row); padding:7px var(--bl-fh-pad); position:static; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before { content:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-toggle) + :is(.fh-row,.fh-toggle) { border-top:1px solid var(--line); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-k { flex:0 1 auto; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-v { flex:1 1 8em; min-width:0; max-width:100%; margin-left:auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row > .fh-seg, html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-v > .fh-seg { flex:1 1 8em; margin-left:auto; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row.fh-stack { display:block; padding-top:9px; padding-bottom:9px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row.fh-stack .fh-k { display:block; margin-bottom:8px; line-height:1.5; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row.fh-stack .fh-v { margin-left:0; justify-content:flex-start; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row.act .fh-k { color:var(--bl-fh-acc-ink); font-weight:600; }\n\n/* ── Switch rows: title, thin switch at the end of the same line, note underneath ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toggle {\n  display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:2px 12px;\n  padding:9px var(--bl-fh-pad); min-height:var(--bl-fh-row); position:static; cursor:pointer;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toggle > span { display:contents; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toggle > span > small { grid-column:1; grid-row:2; display:block; margin:0; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toggle > .fh-sw { grid-column:2; grid-row:1 / span 2; align-self:center; margin:0; }\n\n/* ── Switch: the theme's own switch size (36 × 20, 14px knob), one geometry everywhere ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sw {\n  width:36px; height:20px; min-width:36px; min-height:20px; margin:0; padding:0;\n  border:0; border-radius:20px; background:var(--track); box-shadow:none; flex:none;\n  transition:background .18s;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sw::after { top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; box-shadow:var(--bl-fh-knob-shadow); transition:left .18s; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sw.on { background:var(--acc); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sw.on::after { left:19px; background:#fff; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sw[disabled] { opacity:.45; cursor:not-allowed; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cv .fh-sw, html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-row .fh-sw { margin-left:auto; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item .fh-sw { display:none; }\n\n/* ── Choice buttons (segments), pickers, buttons, chips: one height ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button,.fh-more,.fh-tag,.fh-check,.fh-sheet-item,.fh-sheet-cancel) {\n  min-width:0; max-width:100%; font-size:1em; line-height:1.45;\n  word-break:keep-all; overflow-wrap:anywhere; font-weight:inherit; letter-spacing:inherit;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-tag) {\n  min-height:var(--bl-fh-control); padding:7px 10px; border:0; border-radius:var(--r2);\n  background:var(--card2); color:var(--ink); box-shadow:none; white-space:normal;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-seg { display:inline-flex; flex-wrap:wrap; max-width:100%; min-width:0; gap:3px; padding:3px; border:0; background:var(--fill); border-radius:var(--r2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-seg button { flex:1 1 auto; min-height:var(--bl-fh-chip); padding:4px 10px; border:0; border-radius:calc(var(--r2) - 2px); background:transparent; color:var(--ink); box-shadow:none; white-space:nowrap; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cv .fh-seg button { padding:4px 10px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.on,.fh-chip.on,.fh-sheet-item.on) { background:var(--acc-soft); color:var(--bl-fh-acc-ink); box-shadow:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-seg button.on { background:var(--acc-soft); color:var(--bl-fh-acc-ink); box-shadow:inset 0 0 0 1px var(--acc); font-weight:600; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.primary,.fh-btn.solid) { background:var(--acc); color:var(--on-acc); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-btn.danger { color:var(--bl-fh-danger); background:var(--bl-fh-danger-soft); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-btn[disabled] { opacity:.45; }\n@media(hover:hover) and (pointer:fine) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover { background:var(--bl-fh-hover); }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.primary,.fh-btn.solid):hover { background:var(--acc); color:var(--on-acc); filter:brightness(1.04); }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-seg button.on:hover { background:var(--acc-soft); }\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-chip::before { content:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-chips { gap:6px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-chip { display:inline-flex; align-items:center; justify-content:flex-start; gap:8px; padding:7px 10px; text-align:left; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-chip.on::before { content:'✓'; display:inline-flex; align-items:center; justify-content:center; flex:none; width:auto; height:auto; border:0; background:none; color:currentColor; font-size:.9em; line-height:1.45; }\n/* Picker buttons show their current value on one line and shorten it with an ellipsis. */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sel {\n  display:block; position:relative; flex:0 1 auto; min-width:0; max-width:100%;\n  min-height:var(--bl-fh-control); padding:7px 2em 7px 10px; border:0; border-radius:var(--r2);\n  background:var(--card2); color:var(--ink); box-shadow:none; text-align:left;\n  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sel-t { display:inline; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sel > i { position:absolute; right:.75em; top:50%; transform:translateY(-50%); display:inline-flex; align-items:center; margin:0; font-size:.7em; line-height:1; color:var(--ink2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sel.on { background:var(--acc-soft); color:var(--bl-fh-acc-ink); font-weight:inherit; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sel.on > i { color:currentColor; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-v > .fh-sel { max-width:100%; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(input[type=text],input[type=search],input[type=number],textarea,select) {\n  min-width:0; max-width:100%; font-size:1em; line-height:1.5; min-height:var(--bl-fh-control);\n  border:0; border-radius:var(--r2); background:var(--bl-fh-field);\n  font-weight:inherit; letter-spacing:inherit; color:var(--ink); box-shadow:var(--salty-well-in); padding:7px 10px;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(code,pre,textarea:not([data-card-desc])) {\n  font-family:var(--salty-font-code,ui-monospace,Consolas,monospace) !important;\n  font-size:var(--salty-code-size,.9em); word-break:normal; overflow-wrap:normal;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 textarea[data-card-desc] { font-family:var(--font) !important; font-size:1em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(pre,.fh-exp-preview) { max-width:100%; overflow:auto; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toolbar { flex-wrap:wrap; gap:8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-search { flex:1 1 12em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-toolbar > .fh-search { flex:1 0 100%; width:100%; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head) { flex-wrap:wrap; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-tagadd input { flex:1 1 8em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-tagadd .fh-btn { flex:none; width:auto; }\n\n/* ── Home: 일반 설정 grid. Switch cells pair up in two columns; cells with a picker or choice\n   buttons take a full line so their control stays beside its name. ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-grid { display:grid; grid-template-columns:minmax(0,1fr); grid-auto-flow:dense; gap:0 12px; padding:2px 0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell { display:flex; flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 10px; min-height:var(--bl-fh-row); padding:7px var(--bl-fh-pad); border:0; border-top:1px solid var(--line); background:transparent; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell:first-child { border-top:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell:has(> .fh-cv > .fh-sw:only-child) { flex-wrap:nowrap; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-ck { flex:0 1 auto; display:flex; align-items:baseline; gap:6px; min-width:0; letter-spacing:inherit; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cv { flex:1 1 auto; min-width:0; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cv:empty { display:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cv > .fh-seg { flex:1 1 8em; }\n/* Four or more choices take a full line of their own instead of wrapping beside the name. */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-v,.fh-cv) > .fh-seg:has(> :nth-child(4)) { flex:1 0 100%; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell > .fh-hint { flex:1 0 100%; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell > .fh-dim { margin-left:auto; text-align:right; }\n\n/* ── QR, entries, sheets ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-copy { flex:1; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-copy small { display:block; margin-top:3px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-head { flex-wrap:wrap; gap:4px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-head > strong { flex:1 1 10em; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-head > .fh-tag { font-size:.8em; min-height:0; padding:3px 6px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-card > p { margin:0; padding:8px var(--bl-fh-pad) 0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-card > p:empty { display:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-qr-acts .fh-btn,.fh-qr-acts.dense .fh-btn) { font-size:1em; padding:7px 10px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-form { margin:0 var(--bl-fh-pad) 10px; padding:0; gap:8px 10px; border:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sec-head { min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-entry { min-width:0; gap:8px; padding:10px var(--bl-fh-pad); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 8px; padding:10px var(--bl-fh-pad); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item-name { font-size:.93em; grid-column:1; white-space:normal; overflow:visible; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item-meta { grid-column:1; font-size:.85em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-tick { grid-column:2; grid-row:1 / span 2; width:20px; height:20px; border:2px solid var(--line); border-radius:6px; background:var(--card2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item.on { background:var(--acc-soft); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item.on .fh-tick { border-color:var(--acc); background:var(--acc); color:var(--on-acc); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-item.on .fh-item-name { color:var(--ink); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet { padding:12px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-bg { background:var(--bl-fh-scrim); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-box { width:min(24em,100%); max-height:75%; border-radius:var(--r); box-shadow:var(--bl-fh-sheet-shadow); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-head { font-size:.85em; letter-spacing:normal; padding:10px 12px; border:0; color:var(--ink2); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item { grid-template-columns:minmax(0,1fr) auto; min-height:var(--bl-fh-row); padding:9px 12px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item span { white-space:normal; overflow:visible; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item em { font-size:.85em; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sheet-cancel { border:0; padding:12px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-dot,.fh-tile,.fh-qr-ico) { box-shadow:none; background:var(--acc); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-tile,.fh-qr-ico) { color:var(--on-acc); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--acc); outline-offset:2px; }\n\n/* ── Sortable lists: only the ⠿ handle starts a drag, so the list scrolls like the rest ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortlist { display:flex; flex-direction:column; gap:6px; touch-action:pan-y; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow { display:flex; align-items:center; gap:8px; min-height:var(--bl-fh-row); margin:0; padding:6px 8px 6px 6px; border-radius:var(--r2); touch-action:pan-y; cursor:default; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow .fh-grip { display:inline-grid; place-items:center; width:32px; height:32px; min-width:32px; margin:0; font-size:1.1em; letter-spacing:0; color:var(--ink2); touch-action:none; cursor:grab; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow.moving { outline:2px solid var(--acc); outline-offset:-2px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow.moving .fh-grip { cursor:grabbing; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow b { flex:1 1 auto; min-width:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sortrow .fh-sw { margin-left:auto; }\n\n/* ── Bottom tabs: icon and name side by side on one line ── */\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav {\n  grid-area:nav; display:grid; grid-template-columns:repeat(2,minmax(0,1fr));\n  padding:6px 10px 8px; gap:6px; border:0; backdrop-filter:none; -webkit-backdrop-filter:none;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item {\n  display:flex; flex-direction:row; align-items:center; justify-content:center; gap:.4em;\n  min-width:0; min-height:38px; margin:0; padding:6px 4px;\n  font-size:1em; font-weight:inherit; line-height:1.45; letter-spacing:inherit;\n  border:0; border-radius:var(--r2); text-align:center; color:var(--ink2); background:var(--fill);\n  white-space:nowrap; word-break:keep-all;\n}\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item b { display:inline-flex; align-items:center; justify-content:center; flex:none; width:auto; font-size:1.05em; line-height:1; margin:0; color:inherit; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item span { display:inline; word-break:keep-all; overflow-wrap:normal; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item.on { color:var(--bl-fh-acc-ink); background:var(--acc-soft); font-weight:600; }\n\n@container bl-fruit-settings (min-width:18em) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions) { grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-pad:has(> .fh-btn) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-pad:has(> .fh-btn) > .fh-btn { width:100%; margin:0; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { grid-template-columns:repeat(4,minmax(0,1fr)); }\n}\n@container bl-fruit-settings (min-width:20em) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-grid > :is(.wide,.fh-cell:has(.fh-seg),.fh-cell:has(.fh-sel),.fh-cell:has(.fh-hint),.fh-cell:has(.fh-dim)) { grid-column:1 / -1; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-cell:nth-child(2):not(.wide,:has(.fh-seg),:has(.fh-sel),:has(.fh-hint),:has(.fh-dim)) { border-top:0; }\n}\n@container bl-fruit-settings (min-width:40em) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; align-items:start; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-list > .fh-qr-card { margin:0; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-qr-list > .fh-btn { grid-column:1 / -1; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item { gap:.5em; }\n}\n@container bl-fruit-settings (max-width:20em) {\n  /* Narrow window or large text: every choice group takes its own full line under its name. */\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-v,.fh-cv) > .fh-seg { flex:1 0 100%; }\n}\n@container bl-fruit-settings (max-width:15em) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-nav-item b { display:none; }\n}\n@media(max-width:380px) {\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-header { gap:6px; padding:10px; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-brand-mark { width:1.2em; height:1.2em; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-main { padding-left:8px; padding-right:8px; }\n  html > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { padding:6px; }\n}\n\n/* ── Owned controls: help, note folding, home order reset, quick-reply name, fonts, skin ── */\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button {\n  display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; flex:none;\n  width:max(24px,1em); height:max(24px,1em); min-width:24px; min-height:24px;\n  margin:0 0 0 5px; padding:0; border:0; border-radius:6px; background:transparent;\n  color:var(--ink2); font-size:inherit; font-weight:inherit; line-height:1;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button > svg { display:block; width:1em; height:1em; flex:none; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel {\n  min-width:0; margin:0 0 10px; padding:10px 12px; border:1px solid var(--line);\n  border-radius:var(--r); background:var(--card); color:var(--ink); overflow-wrap:anywhere;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head h3 { margin:0; min-width:0; font-size:1em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel p { margin:6px 0; font-size:1em; line-height:1.6; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details { margin-top:8px; border-top:1px solid var(--line); }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel summary { min-height:36px; padding:8px 0; cursor:pointer; line-height:1.5; list-style:disclosure-closed inside; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details[open] > summary { list-style-type:disclosure-open; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item { padding:8px 0; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item h4 { margin:0; font-size:1em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item small { display:block; margin:2px 0 4px; color:var(--ink2); font-size:.85em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources { display:flex; flex-wrap:wrap; gap:6px 12px; padding-top:8px; border-top:1px solid var(--line); }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources > span { flex-basis:100%; color:var(--ink2); font-size:.85em; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources a { color:var(--bl-fh-acc-ink); text-decoration:underline; text-underline-offset:3px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 [data-bl-fruit-reading-hidden=\"1\"] { display:none !important; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-tools { display:flex; justify-content:flex-end; padding:0; margin:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:3px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) > h3 { grid-column:1; grid-row:1; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) > p { grid-column:1 / -1; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-card-head > .bl-fruit-reading-tools { grid-column:2; grid-row:1; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect:has(> .bl-fruit-reading-tools) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; column-gap:8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect:has(> .bl-fruit-reading-tools) > :not(.bl-fruit-reading-tools) { grid-column:1; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .fh-sect > .bl-fruit-reading-tools { grid-column:2; grid-row:1 / span 2; align-self:end; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp) > .bl-fruit-reading-tools { padding:6px var(--bl-fh-pad) 0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle { display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:2px 6px; border:0; border-radius:6px; background:transparent; color:var(--ink2); font:inherit; font-size:.85em; line-height:1.4; cursor:pointer; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle::after { content:'⌄'; font-size:1em; transform:rotate(-90deg); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle[aria-expanded=\"true\"]::after { transform:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-qr-name > .fh-v { flex:none; margin-left:0; justify-content:flex-start; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-qr-name input { flex:1 1 auto; width:100%; max-width:none; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-home-actions { padding-top:0; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-options { padding:6px 0 0; border-top:1px solid var(--line); }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-options > .fh-sheet-head { padding-bottom:6px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-search { display:block; width:calc(100% - 24px); margin:0 12px 8px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-choices > button { content-visibility:auto; contain-intrinsic-size:auto 44px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-empty { margin:0; padding:8px 12px 12px; }\nhtml > body.salty #fruit-heart-v6#fruit-heart-v6 .bl-fruit-font-empty[hidden] { display:none; }\n/* The renamed quick-reply entry stays one line; a long name is shortened, never wrapped. */\n.bl-fruit-entry-name { display:inline-block; max-width:min(14em,60vw); vertical-align:bottom; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }");

/*BL-SCRIPT-END*/
}
