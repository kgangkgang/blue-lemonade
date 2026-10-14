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
  const stopReading = installFruitReading(doc, host);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    stopHelp();
    stopReading();
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
    panel.append(head, make('p', guide.intro, 'bl-fruit-help-intro'));
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

const FRUIT_HELP_GUIDE = {"intro":"과일 프리셋의 옵션을 화면에서 고르는 도구예요. 아래에서 처음 쓰는 법과 현재 탭의 설명을 볼 수 있어요.","sections":[{"id":"general","title":"처음 쓰는 분께","items":[{"title":"어디서 시작하나요?","text":"홈에서 자주 쓰는 옵션을 고르고, 더 자세한 설정은 ‘항목’에서 찾아요.","source":"원작 안내 정리"},{"title":"선택하면 무엇이 바뀌나요?","text":"프리셋 옵션은 고르면 실제 설정에 저장돼요. 화면에 보일 구역을 고르는 설정은 표시만 바꿔요.","source":"동작 해설"},{"title":"QR을 누르기 전에","text":"입력창만 채우는 카드와 바로 전송하는 카드가 있어요. 카드 설명을 확인하고 눌러요.","source":"원작 안내 정리"}]},{"id":"overview","title":"홈","items":[{"title":"모델 묶음","text":"선택한 모델에 맞는 프리셋 항목 묶음을 켜요. API 연결이나 실제 모델을 바꾸는 버튼은 아니에요.","source":"동작 해설"},{"title":"자주 쓰는 옵션","text":"홈에서 고른 옵션도 실제 프리셋에 적용돼요. 하나만 고르는 종류는 다른 선택이 함께 꺼질 수 있어요.","source":"동작 해설"},{"title":"본문 글자 수","text":"프리셋에 적힌 답변 길이 요청을 바꿔요. API의 최대 출력 토큰 설정과는 달라요.","source":"동작 해설"},{"title":"NSFW 자동","text":"답변 생성 전에 입력의 시작·종료 단어와 이전 답변의 장면 정보를 보고 전체 스위치를 바꿔요. 판단할 정보가 없으면 현재 상태를 유지해요.","source":"동작 해설"}]},{"id":"qr","title":"QR","items":[{"title":"입력창에 먼저 넣기","text":"기본 ‘전개 지시’와 ‘괄호 지시’는 입력창을 채워요. 내용을 확인하거나 고친 뒤 직접 보내면 돼요.","source":"원작 안내 정리"},{"title":"바로 전송하는 카드","text":"기본 요약·개요·카드 작성·프롬프트 조정·자동 계속은 메시지를 보내고 AI 답변 생성을 시작해요.","source":"동작 해설"},{"title":"채팅 숨기기","text":"숨기기는 지정한 대화를 AI에게 보내는 내용에서 빼고, 숨김 해제는 다시 넣어요. 채팅 기록은 남아 있어요.","source":"동작 해설"},{"title":"직접 가져온 QR","text":"가져오거나 편집한 카드는 그 안의 명령대로 실행돼요. 위 설명은 기본 카드 기준이에요.","source":"동작 해설"}]},{"id":"entries","title":"항목","items":[{"title":"항목 켜고 끄기","text":"체크하면 실제 프리셋 항목을 켜거나 꺼요. 핵심 항목은 변경 전에 확인창이 나올 수 있어요.","source":"동작 해설"},{"title":"필요한 항목 찾기","text":"이름으로 검색하거나 ‘켜진 항목만’으로 좁혀 볼 수 있어요. 구역을 열면 그 안의 항목이 보여요.","source":"원작 안내 정리"},{"title":"구역 순서와 표시","text":"구역 정렬은 패널 안의 순서만 바꿔요. 설정에서 구역을 숨겨도 프리셋 항목 자체는 꺼지지 않아요.","source":"원작 안내 정리"}]},{"id":"settings","title":"설정","items":[{"title":"연결 모델 따라가기","text":"연결된 모델을 알아보면 그 모델용 프리셋 항목으로 맞춰요. 알아보지 못한 모델은 그대로 둬요.","source":"원작 안내 정리"},{"title":"NSFW 단어와 종료 여유","text":"종료 단어가 우선이며, 단어 편집은 자동 저장돼요. 종료 여유는 NSFW 장면이 끝난 뒤 몇 회 더 유지할지 정해요. 판단은 답변 생성 전에 해요.","source":"동작 해설"},{"title":"보일 구역 고르기","text":"홈의 펼침 상태와 ‘항목’에 표시할 구역을 정해요. 표시를 줄이는 설정이며, 실제 프리셋 항목의 켜짐 상태는 바꾸지 않아요.","source":"원작 안내 정리"},{"title":"항목 변경 동기화","text":"실리태번에서 항목을 추가하거나 옮겼다면 구역 목록을 다시 읽어요. 프리셋 본문이나 항목의 켜짐 상태는 바꾸지 않아요.","source":"원작 안내 정리"}]}],"credit":"원작 화면의 안내를 정리하고, 코드로 확인한 내용은 ‘동작 해설’로 구분했어요.","links":[{"label":"원작 저장소","url":"https://github.com/kongkongmie/guoshizhixin"},{"label":"프롬프트 원문","url":"https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064"}]};
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
        if(heading)heading.append(tools);else card.insertBefore(tools,card.firstChild);
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

installFruitStyle(BlueLemonade, "/* Every rule is gated by the active theme; only the panel's presentation changes. */\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 {\n  --paper:var(--salty-panel-surface,var(--salty-surface)) !important;\n  --card:var(--salty-fill-surface,var(--salty-surface)) !important;\n  --card2:var(--salty-control,var(--salty-surface)) !important;\n  --fill:var(--salty-shade) !important;\n  --fill2:var(--salty-shade-2) !important;\n  --ink:var(--salty-text) !important;\n  --ink2:var(--salty-muted) !important;\n  --ink3:var(--salty-muted) !important;\n  --line:var(--salty-line) !important;\n  --acc:var(--salty-accent) !important;\n  --acc-soft:var(--salty-accent-13,var(--salty-shade)) !important;\n  --acc-line:var(--salty-accent-28) !important;\n  --gold:var(--salty-accent) !important;\n  --on-acc:var(--salty-on-accent) !important;\n  --knob:var(--salty-raised,var(--salty-text)) !important;\n  --track:var(--salty-line) !important;\n  --shadow:var(--salty-e1) !important;\n  --grain:none !important;\n  --r:var(--bl-r-md,12px) !important;\n  --r2:var(--bl-r-sm,8px) !important;\n  --font:var(--salty-font-ui,var(--mainFontFamily,system-ui)) !important;\n  --font-sans:var(--salty-font-ui,var(--mainFontFamily,system-ui)) !important;\n  color:var(--salty-text); background:var(--salty-scrim);\n  font-family:var(--font) !important;\n  font-size:var(--salty-ui-size,var(--mainFontSize,15px)); line-height:1.5;\n  font-weight:var(--salty-ui-weight,normal); letter-spacing:var(--bl-settings-tracking,normal);\n  word-break:keep-all; overflow-wrap:anywhere;\n  backdrop-filter:none; -webkit-backdrop-filter:none;\n  color-scheme:light;\n}\nhtml:has(> body.salty.salty-dark) #fruit-heart-v6#fruit-heart-v6 { color-scheme:dark; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-shell {\n  container:bl-fruit-settings / inline-size;\n  width:min(760px,100%); min-width:0; max-width:100%;\n  grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) auto;\n  grid-template-areas:\"head\" \"main\" \"nav\";\n  background:var(--paper); border:0; border-radius:var(--r);\n  box-shadow:var(--salty-e5); backdrop-filter:none; -webkit-backdrop-filter:none;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6.fh-is-fullscreen .fh-shell { width:100%; height:100%; border-radius:var(--r2); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-header,.fh-main,.fh-bottom-nav) { min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-header { grid-area:head; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:4px 8px; padding:12px; border:0; align-items:center; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-brand,.fh-brand > div) { display:contents; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand-mark { grid-column:1; grid-row:1; width:1.5em; height:1.5em; margin:0; color:var(--salty-accent-ink,var(--acc)); filter:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand strong { grid-column:2; grid-row:1; min-width:0; font-size:1.15em; line-height:1.35; letter-spacing:normal; background:none; background-clip:border-box; -webkit-background-clip:border-box; color:var(--ink); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand :is(em,small) { grid-column:1 / -1; min-width:0; font-size:.78em; line-height:1.45; letter-spacing:normal; margin:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand em { grid-row:2; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand small { grid-row:3; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-header:has(.fh-update-badge:not([hidden])) .fh-brand em { padding-right:44px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-update-badge { grid-column:3; grid-row:2; justify-self:end; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-header-meta { grid-column:3; grid-row:1; gap:4px; flex-wrap:nowrap; justify-content:flex-end; max-width:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-header-meta::before { content:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge) {\n  display:inline-flex; align-items:center; justify-content:center; padding:0; text-align:center;\n  width:36px; height:36px; min-width:36px; min-height:36px;\n  font-size:1em; line-height:1; border:0; border-radius:var(--r2);\n  background:var(--card2); color:var(--ink);\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-close { font-size:1.25em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-main { grid-area:main; padding:10px 12px; overflow:auto; scrollbar-gutter:stable; background:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-main > * { max-width:100%; margin-left:0; margin-right:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(h2,h3,.fh-k,.fh-ch b,.fh-sec-head b,.fh-qr-copy strong,.fh-qr-head strong,.fh-toggle,.fh-sortrow b) {\n  font-size:1em; line-height:1.45; font-weight:inherit; letter-spacing:inherit;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 h2 { font-size:1.2em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(p,.fh-dim,.fh-lab,.fh-ck,.fh-hint,.fh-note,.fh-sect b,.fh-sect span,.fh-doc > summary,.fh-doc p,.fh-mech-head b,.fh-foot,.fh-empty,.fh-qr-copy small,.fh-qr-desc,.fh-qr-tip,.fh-sign,.fh-exp-tip,.fh-exp-rtext small,.fh-toggle span small,.fh-update-tip,.fh-update-status,.fh-update-entry ul) {\n  font-size:.85em; line-height:1.5; letter-spacing:inherit;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-lab,.fh-sect) { margin:16px 4px 8px; padding:0; border:0; flex-wrap:wrap; color:var(--ink2); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow) {\n  background:var(--card); border:1px solid var(--line); border-radius:var(--r);\n  box-shadow:none; margin-top:0; margin-bottom:12px; overflow:hidden;\n  backdrop-filter:none; -webkit-backdrop-filter:none;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before,\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-card::after { content:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before { content:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) {\n  padding:10px; gap:8px; background:var(--fill); border:0; border-bottom:1px solid var(--line);\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-actions,.fh-pad,.fh-qr-acts) { padding:10px; gap:8px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips { padding:10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips + .fh-card-actions { padding-top:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card > :is(.fh-v,textarea) { margin:10px; width:calc(100% - 20px); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp) > .fh-tagbox { padding:0 10px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-row,.fh-toggle) { padding:10px; gap:8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-row { flex-wrap:wrap; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-k { flex:1 1 8em; min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-v { flex:0 1 auto; min-width:0; max-width:100%; margin-left:auto; gap:6px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-row.fh-stack .fh-v { justify-content:flex-start; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-row:not(.act):has(> .fh-k):has(> .fh-v) { flex-direction:column; align-items:stretch; gap:6px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-row:not(.act) > .fh-k { flex:none; margin-bottom:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-row:not(.act) > .fh-v { flex:none; width:100%; margin-left:0; justify-content:flex-start; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-ch { min-height:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-ch b { min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-ch :is(.fh-n,.fh-dim) { font-size:.8em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-grid { grid-template-columns:repeat(auto-fit,minmax(min(100%,12em),1fr)); gap:8px 10px; padding:10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-cell { padding:0; min-width:0; gap:8px; border:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-cell:nth-child(odd):not(.wide) { border:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-ck,.fh-cv,.fh-chips,.fh-item-meta) { min-width:0; max-width:100%; flex-wrap:wrap; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-ck em { font-size:.85em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-ck:has(> em) { flex-direction:column; align-items:flex-start; gap:3px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sect { flex-direction:column; align-items:flex-start; gap:3px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sect span { line-height:1.5; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button,.fh-more,.fh-tag,.fh-check,.fh-sheet-item,.fh-sheet-cancel) {\n  min-width:0; max-width:100%; font-size:1em; line-height:1.45;\n  white-space:normal; word-break:keep-all; overflow-wrap:anywhere; font-weight:inherit; letter-spacing:inherit;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button,.fh-tag) {\n  min-height:36px; padding:7px 10px; border:0; border-radius:var(--r2);\n  background:var(--card2); color:var(--ink); box-shadow:none;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.on,.fh-chip.on,.fh-sel.on,.fh-seg button.on,.fh-sheet-item.on) {\n  background:var(--acc-soft); color:var(--salty-accent-ink,var(--acc)); box-shadow:none;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.primary,.fh-btn.solid) { background:var(--acc); color:var(--on-acc); }\n@media(hover:hover) and (pointer:fine) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover { background:var(--salty-control-hover,var(--fill2)); }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-btn.primary,.fh-btn.solid):hover { background:var(--acc); color:var(--on-acc); filter:brightness(1.04); }\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-btn.danger { color:var(--salty-danger); background:var(--salty-danger-soft); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-chip::before { content:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-chips { gap:8px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-chip { align-items:center; justify-content:flex-start; gap:8px; padding:8px 12px; text-align:left; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-chip.on::before { content:'✓'; display:inline-flex; align-items:center; justify-content:center; flex:none; width:auto; height:auto; border:0; background:none; color:currentColor; font-size:.9em; line-height:1.45; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-seg { display:inline-flex; flex-wrap:wrap; max-width:100%; min-width:0; gap:4px; padding:3px; border:0; background:var(--fill); border-radius:var(--r2); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-seg button { flex:1 1 auto; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-cv .fh-seg button { padding:7px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sel { flex:0 1 auto; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sel-t { white-space:normal; overflow:visible; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sel i { display:inline-flex; align-items:center; justify-content:center; line-height:1; transform:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sw { border:0; background:var(--track); box-shadow:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sw.on { background:var(--acc); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sw::after { background:var(--knob); box-shadow:var(--salty-knob,var(--salty-e1)); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sw.on::after { background:var(--on-acc); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(input[type=text],input[type=number],textarea,select) {\n  min-width:0; max-width:100%; font-size:1em; line-height:1.5;\n  border:0; border-radius:var(--r2); background:var(--salty-fill-field,var(--salty-field));\n  font-weight:inherit; letter-spacing:inherit;\n  color:var(--ink); box-shadow:var(--salty-well-in); padding:9px 10px;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(code,pre,textarea:not([data-card-desc])) {\n  font-family:var(--salty-font-code,ui-monospace,Consolas,monospace) !important;\n  font-size:var(--salty-code-size,.9em); word-break:normal; overflow-wrap:normal;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 textarea[data-card-desc] { font-family:var(--font) !important; font-size:1em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(pre,.fh-exp-preview) { max-width:100%; overflow:auto; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toolbar { flex-wrap:wrap; gap:8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-search { flex:1 1 12em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toolbar > .fh-search { flex:1 0 100%; width:100%; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head) { flex-wrap:wrap; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-tagadd input { flex:1 1 8em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-copy { flex:1; min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-copy small { display:block; margin-top:3px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-head { flex-wrap:wrap; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-head > strong { flex:1 0 100%; min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-card > p { padding:10px 10px 0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-qr-acts .fh-btn,.fh-qr-acts.dense .fh-btn) { font-size:1em; padding:7px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-form { margin:0 10px 10px; padding:0; gap:8px 10px; border:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sec-head { min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-entry { min-width:0; gap:8px; padding:10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 8px; padding:10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item-name { font-size:.93em; grid-column:1; white-space:normal; overflow:visible; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item-meta { grid-column:1; font-size:.85em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-tick { grid-column:2; grid-row:1 / span 2; width:20px; height:20px; border:2px solid var(--line); border-radius:6px; background:var(--card2); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item.on { background:var(--acc-soft); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item.on .fh-tick { border-color:var(--acc); background:var(--acc); color:var(--on-acc); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-item.on .fh-item-name { color:var(--ink); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toggle > span { min-width:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toggle:has(> span > small) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:6px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toggle:has(> span > small) > span { display:contents; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toggle:has(> span > small) > span > small { grid-column:1 / -1; grid-row:2; margin-top:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-toggle:has(> span > small) > .fh-sw { grid-column:2; grid-row:1; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet { padding:12px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-bg { background:var(--salty-scrim); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-box { width:min(24em,100%); max-height:75%; border:0; background:var(--card); border-radius:var(--r); box-shadow:var(--salty-e4); backdrop-filter:none; -webkit-backdrop-filter:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-head { font-size:.85em; letter-spacing:normal; padding:12px; border:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item { grid-template-columns:minmax(0,1fr) auto; padding:10px 12px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item span { white-space:normal; overflow:visible; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-item em { font-size:.85em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sheet-cancel { border:0; padding:12px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav {\n  grid-area:nav; display:grid; grid-template-columns:repeat(2,minmax(0,1fr));\n  padding:8px 12px 10px; gap:8px 10px; border:0; background:var(--paper);\n  backdrop-filter:none; -webkit-backdrop-filter:none;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item {\n  --bl-tab-optical-shift:clamp(1px,.17em,4px);\n  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;\n  min-width:0; min-height:36px; margin:0;\n  padding:calc(7px + var(--bl-tab-optical-shift)) 5px calc(7px - var(--bl-tab-optical-shift));\n  font-size:1em; font-weight:inherit; line-height:1.45; letter-spacing:inherit;\n  border:0; border-radius:var(--r2); text-align:center; color:var(--ink2); background:var(--fill);\n  white-space:normal; word-break:keep-all;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item b { display:inline-flex; align-items:center; justify-content:center; flex:none; width:auto; font-size:1.2em; line-height:1; margin:0; color:inherit; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item span { word-break:keep-all; overflow-wrap:normal; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item.on { color:var(--salty-accent-ink,var(--acc)); background:var(--acc-soft); font-weight:inherit; }\n@container bl-fruit-settings (min-width:22em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { grid-template-columns:repeat(4,minmax(0,1fr)); }\n}\n@container bl-fruit-settings (min-width:40em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item { --bl-tab-optical-shift:clamp(.25px,calc(.04em * (1 + var(--bl-ink-k,1))),2px); flex-direction:row; gap:10px; }\n}\n@container bl-fruit-settings (max-width:16em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item b { display:none; }\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-exp-rtext :is(b,small) { white-space:normal; overflow:visible; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-exp-rtext b { font-size:.93em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-dot,.fh-tile,.fh-qr-ico) { box-shadow:none; background:var(--acc); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-tile,.fh-qr-ico) { color:var(--on-acc); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-link,.fh-lab) { color:var(--salty-accent-ink,var(--acc)); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--acc); outline-offset:2px; }\n@media(max-width:380px) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-header { gap:6px; padding:10px; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-brand-mark { width:1.2em; height:1.2em; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-main { padding-left:8px; padding-right:8px; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { padding:6px; }\n}\n\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button {\n  display:inline-flex; align-items:center; justify-content:center; vertical-align:middle;\n  width:1.8em; height:1.8em; min-width:32px; min-height:32px; max-width:40px; max-height:40px;\n  margin:0 0 0 6px; padding:0; border:1px solid var(--line); border-radius:50%;\n  background:var(--fill); color:var(--ink2); font-size:.75em; font-weight:600; line-height:1;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel {\n  min-width:0; margin:0 0 12px; padding:10px; border:1px solid var(--line);\n  border-radius:var(--r); background:var(--card); color:var(--ink); overflow-wrap:anywhere;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head {\n  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head h3 { margin:0; min-width:0; font-size:1em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel p { margin:6px 0; font-size:1em; line-height:1.6; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details { margin-top:8px; border-top:1px solid var(--line); }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel summary { min-height:36px; padding:8px 0; cursor:pointer; line-height:1.5; list-style:disclosure-closed inside; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details[open] > summary { list-style-type:disclosure-open; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item { padding:8px 0; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item h4 { margin:0; font-size:1em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item small { display:block; margin:2px 0 4px; color:var(--ink2); font-size:.85em; line-height:1.5; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources { display:flex; flex-wrap:wrap; gap:6px 12px; padding-top:8px; border-top:1px solid var(--line); }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources > span { flex-basis:100%; color:var(--ink2); font-size:.85em; }\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources a { color:var(--acc); text-decoration:underline; text-underline-offset:3px; }\n\n/* The original Fruit day/night switch owns data-theme. Keep its saved choice local to\n   this window while retaining Blue Lemonade's typeface, accent and control geometry. */\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6[data-theme=\"day\"] {\n  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#fafbfc);\n  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 2%,#fff);\n  --salty-control:color-mix(in srgb,var(--salty-accent) 4%,#edf0f4);\n  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 10%,#e9edf3);\n  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#e9edf2);\n  --salty-text:#242b35; --salty-muted:#586473; --salty-line:rgba(43,56,73,.16);\n  --salty-shade:rgba(43,56,73,.055); --salty-shade-2:rgba(43,56,73,.09);\n  --salty-raised:#fff; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 58%,#17222e);\n  --salty-scrim:rgba(21,27,35,.22); color-scheme:light !important;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6[data-theme=\"night\"] {\n  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#20242c);\n  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 3%,#282d36);\n  --salty-control:color-mix(in srgb,var(--salty-accent) 5%,#303641);\n  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 12%,#353c49);\n  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#1b2028);\n  --salty-text:#ecf0f5; --salty-muted:#b1bdcc; --salty-line:rgba(221,232,246,.17);\n  --salty-shade:rgba(221,232,246,.06); --salty-shade-2:rgba(221,232,246,.10);\n  --salty-raised:#dce6f2; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 66%,#fff);\n  --salty-scrim:rgba(4,7,12,.40); color-scheme:dark !important;\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 {\n  --salty-accent-13:color-mix(in srgb,var(--salty-accent) 13%,transparent);\n  --salty-accent-28:color-mix(in srgb,var(--salty-accent) 28%,transparent);\n  --salty-well-in:inset 0 1px 2px rgba(0,0,0,.06);\n}\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-main { padding-top:8px; padding-bottom:8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec) { margin-bottom:10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) { padding:8px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card-actions,.fh-pad,.fh-qr-acts) { gap:6px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions) { display:grid; grid-template-columns:minmax(0,1fr); gap:6px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions) > :is(button,.fh-btn,.fh-chip) { width:100%; margin:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-chip { padding:7px 10px; gap:6px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-grid { grid-template-columns:minmax(0,1fr); gap:10px 12px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-cell { display:flex; flex-direction:column; align-items:stretch; gap:6px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-cell .fh-cv { justify-content:flex-start; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-head { gap:4px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-head > strong { flex:1 1 10em; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-head > .fh-tag { font-size:.8em; min-height:0; padding:3px 6px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-card > p { margin:0; padding:8px 10px 0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-card > p:empty { display:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { gap:6px; padding:6px 10px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item { gap:4px; padding:6px 4px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-nav-item b { font-size:1.05em; }\n/* The original sort handler compares pointer Y only, so its rows remain one column. */\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-sortrow { margin-bottom:4px; min-height:44px; padding:8px 10px; gap:8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-mech { margin:8px 10px; padding:6px 0 6px 10px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-mech + .fh-mech { margin-top:0; padding-top:8px; }\n@container bl-fruit-settings (min-width:18em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-chips,.fh-qr-acts,.fh-card-actions,.fh-grid) { grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-grid > :is(.wide,.fh-cell:has(.fh-seg),.fh-cell:has(.fh-hint)) { grid-column:1 / -1; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-pad:has(> .fh-btn) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-pad:has(> .fh-btn) > .fh-btn { width:100%; margin:0; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-bottom-nav { grid-template-columns:repeat(4,minmax(0,1fr)); }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card:has(> .fh-toggle) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card:has(> .fh-toggle) > * { grid-column:1 / -1; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card:has(> .fh-toggle) > .fh-toggle:not(:has(small)) { grid-column:auto; display:flex; flex-direction:column; align-items:flex-start; justify-content:space-between; gap:6px; }\n}\n@container bl-fruit-settings (min-width:40em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; align-items:start; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-list > .fh-qr-card { margin:0; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-qr-list > .fh-btn { grid-column:1 / -1; }\n}\n/* Only the owned help glyph changes; the original title text and controls stay in place. */\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button {\n  width:max(24px,1em); height:max(24px,1em); min-width:24px; min-height:24px; max-width:none; max-height:none;\n  margin-left:5px; border:0; border-radius:6px; background:transparent;\n  font-size:inherit; font-weight:inherit; color:var(--ink2); flex:none;\n}\n#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button > svg { display:block; width:1em; height:1em; flex:none; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 [data-bl-fruit-reading-hidden=\"1\"] { display:none !important; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-tools { display:flex; justify-content:flex-end; padding:4px 0 0; margin:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:4px 8px; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) > h3 { grid-column:1; grid-row:1; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card-head:has(> .bl-fruit-reading-tools) > p { grid-column:1/-1; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card-head > .bl-fruit-reading-tools { grid-column:2; grid-row:1; padding:0; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 :is(.fh-card,.fh-grp) > .bl-fruit-reading-tools { padding:6px 10px 0; grid-column:1/-1; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle { display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:2px 6px; border:0; border-radius:6px; background:transparent; color:var(--ink2); font:inherit; line-height:1.4; cursor:pointer; }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle::after { content:'⌄'; font-size:1em; transform:rotate(-90deg); }\nhtml:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .bl-fruit-reading-toggle[aria-expanded=\"true\"]::after { transform:none; }\n@container bl-fruit-settings (min-width:18em) {\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card:has(> .fh-toggle) > .fh-toggle:has(> span > small[data-bl-fruit-reading-hidden=\"1\"]) { grid-column:auto; display:grid; grid-template-columns:minmax(0,1fr); gap:6px; align-items:start; }\n  html:has(> body.salty) #fruit-heart-v6#fruit-heart-v6 .fh-card:has(> .fh-toggle) > .fh-toggle:has(> span > small[data-bl-fruit-reading-hidden=\"1\"]) > .fh-sw { grid-column:1; grid-row:2; justify-self:start; }\n}\n");

/*BL-SCRIPT-END*/
}
