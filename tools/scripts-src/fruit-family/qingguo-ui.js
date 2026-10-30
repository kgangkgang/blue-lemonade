// 과일 계열 화면 보조: 과일의 마음 창의 항목 이름(과일 · 야한과일 · 청과 공통 사전)과 청과 문장 점검 화면의 고정 문구를 바꿔요.
// 저장 값·명령·프리셋 선택은 그대로 두어요. 이 파일을 고치면 node tools/build-fruit-family.mjs 로 번들을 다시 만들어요.
function installQingguoKorean(BlueLemonade, data) {
  let host = window;
  try { while (host.parent !== host && host.parent.document) host = host.parent; } catch {}
  const doc = host.document, key = '__blueLemonadeQingguoKorean_v1';
  host[key]?.stop?.();
  const roots = '#qg-prose-pruner-backdrop,#qg-prose-pruner-ball,#fruit-heart-v6';
  const skip = 'script,style,svg,code,pre,input,textarea,[contenteditable]:not([contenteditable="false"]),.qgp-diff-old,.qgp-diff-new,.qgp-hit-item,.fh-exp-preview,.fh-exp-rule,[data-profile],[data-nsfw-drop],[data-bl-fruit-user-label]';
  const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const phrases = new Map(Object.entries(data.ui).map(([a,b])=>[normalize(a),b]));
  const patterns = data.patterns.map(([pattern,replacement])=>[new RegExp(pattern),replacement]);
  // 항목 이름은 블루레몬에이드의 과일 계열 사전(프롬프트 관리자와 같은 것)에서 찾아요. 예전 실행기면 이 파일에 실린 목록으로.
  const promptTitles = new Map((data.prompts||[]).map(p=>[normalize(p.name),p.title]));
  const promptTitle = core => (typeof BlueLemonade.promptTitle === 'function' ? BlueLemonade.promptTitle(null, core) : null) ?? promptTitles.get(core);
  const helpers = new Map(data.helpers);
  const texts = new Map(), attrs = new Map();
  const originalConfirm=host.confirm;
  const confirmMessage='确定要恢复全部青果内置规则默认设置并清空自定义修改吗？';
  function localizedConfirm(message,...args){return originalConfirm.call(this,message===confirmMessage?'청과 내장 규칙을 모두 기본값으로 되돌리고 직접 수정한 내용을 비울까요?':message,...args);}
  if(typeof originalConfirm==='function')host.confirm=localizedConfirm;
  let stopped = false, frame = 0;
  function translated(value, element) {
    const core = normalize(value);
    const quality = element.closest('#qg-prose-pruner-backdrop,#qg-prose-pruner-ball');
    let next = quality ? phrases.get(core) : undefined;
    if (quality && next === undefined) for (const [pattern,replacement] of patterns) {
      if (pattern.test(core)) { next=core.replace(pattern,replacement);break; }
    }
    if (!quality && element.closest('.fh-item-name,.fh-item-meta,[data-chip],.fh-sel,.fh-sheet,.fh-sec-head')) next = promptTitle(core) ?? undefined;
    if (quality && element.closest('.qgp-score-pill')) {
      const match = /^白描纯净度 (\d+) 分 ｜ 命中 (\d+) 处$/.exec(core);
      if (match) next = `문장 점수 ${match[1]}점 · 규칙에 걸린 곳 ${match[2]}개`;
    }
    return next === undefined ? value : value.match(/^\s*/)[0] + next + value.match(/\s*$/)[0];
  }
  function paintNode(node, override) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const value = node.nodeValue, old = texts.get(node);
    if (old?.shown === value) return;
    const next = override ?? translated(value, node.parentElement);
    if (next === value) { texts.delete(node); return; }
    texts.set(node, {before:value,shown:next}); node.nodeValue = next;
  }
  function paintRoot(root) {
    const walker = doc.createTreeWalker(root, host.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) paintNode(walker.currentNode);
    for (const element of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')]) {
      if (element.closest(skip.replace('input,textarea,',''))) continue;
      for (const name of ['title','aria-label','placeholder']) {
        const value = element.getAttribute(name); if (value === null) continue;
        const token = attrs.get(element)?.get(name); if (token?.shown === value) continue;
        const next = translated(value,element);
        if (next === value) { attrs.get(element)?.delete(name); continue; }
        if (!attrs.has(element)) attrs.set(element,new Map());
        attrs.get(element).set(name,{before:value,shown:next}); element.setAttribute(name,next);
      }
    }
  }
  const helperSelector = '#tavern_helper [data-type="script"][data-script-id] > div.grow.overflow-hidden';
  function flush() {
    frame=0; if (stopped) return;
    for (const root of doc.querySelectorAll(roots)) paintRoot(root);
    for (const label of doc.querySelectorAll(helperSelector)) for (const node of label.childNodes) {
      if (node.nodeType !== 3) continue;
      const next=helpers.get(normalize(node.nodeValue)); if (next) paintNode(node,next);
    }
    for (const node of texts.keys()) if (!node.isConnected) texts.delete(node);
    for (const node of attrs.keys()) if (!node.isConnected) attrs.delete(node);
  }
  const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
  // 8.0.4 속도: 바뀐 요소마다 그 아래 전체를 querySelector 로 훑으면(채팅 300개를 그릴 때 #chat 통째로) 과일 계열을 켠 모든 사용자의 화면 변화가 느려져요.
  // 뿌리 요소(아이디 넷)를 문서에서 한 번 찾고, 바뀐 요소가 그 조상·자손·자신인지만 봐요 — 같은 판정이에요. 문서에 붙지 않은 요소·그림자 트리는 예전 방식 그대로예요.
  const rootIds=['qg-prose-pruner-backdrop','qg-prose-pruner-ball','fruit-heart-v6','tavern_helper'];
  const slowRelevant=node=>node.matches(roots+',#tavern_helper')||node.closest(roots+',#tavern_helper')||node.querySelector(roots+',#tavern_helper');
  const relevantTo=present=>node=>{
    if(node?.nodeType!==1)return false;
    if(node.getRootNode()!==doc)return !!slowRelevant(node);
    for(const el of present)if(el===node||el.contains(node)||node.contains(el))return true;
    return false;
  };
  const observer=new host.MutationObserver(records=>{
    const present=[];for(const id of rootIds)for(const el of doc.querySelectorAll('#'+id))present.push(el);
    // 8.2.7 기록 수만 개가 같은 부모에 몰려요(스트리밍 글자 · 메시지마다 단추 줄) — 부모마다 판정은 한 번만(이 판정은 읽기만 해서 답이 같아요) · 기록마다 새 배열 없이
    const relevant=relevantTo(present),seen=new Map(),targetRelevant=node=>{let hit=seen.get(node);if(hit===undefined){hit=relevant(node);seen.set(node,hit);}return hit;};
    if(records.some(record=>{if(targetRelevant(record.target.nodeType===3?record.target.parentElement:record.target))return true;for(const node of record.addedNodes)if(relevant(node))return true;return false;}))schedule();
  });
  observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  function stop(){
    if(stopped)return;stopped=true;observer.disconnect();host.cancelAnimationFrame(frame);
    if(host.confirm===localizedConfirm)host.confirm=originalConfirm;
    for(const [node,value] of texts)if(node.nodeValue===value.shown)node.nodeValue=value.before;
    for(const [node,values] of attrs)for(const [name,value] of values)if(node.getAttribute(name)===value.shown)node.setAttribute(name,value.before);
    texts.clear();attrs.clear();if(host[key]?.stop===stop)delete host[key];
  }
  host[key]={stop};BlueLemonade.onCleanup(stop);flush();
}
