// 과일 계열 화면 보조: 과일의 마음 창의 항목 이름(과일 · 야한과일 · 청과 공통 사전)과 청과 문장 점검 화면 · 출잔 도구 호출 창의 고정 문구를 바꿔요.
// 저장 값·명령·프리셋 선택은 그대로 두어요. 이 파일을 고치면 node tools/build-fruit-family.mjs 로 번들을 다시 만들어요.
function installQingguoKorean(BlueLemonade, data) {
  let host = window;
  try { while (host.parent !== host && host.parent.document) host = host.parent; } catch {}
  const doc = host.document, key = '__blueLemonadeQingguoKorean_v1';
  host[key]?.stop?.();
  const roots = '#qg-prose-pruner-backdrop,#qg-prose-pruner-ball,#fruit-heart-v6,#serve-anti-host';
  const skip = 'script,style,svg,code,pre,input,textarea,[contenteditable]:not([contenteditable="false"]),.qgp-diff-old,.qgp-diff-new,.qgp-hit-item,.fh-exp-preview,.fh-exp-rule,[data-profile],[data-nsfw-drop],[data-bl-fruit-user-label]';
  const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const phrases = new Map(Object.entries(data.ui).map(([a,b])=>[normalize(a),b]));
  const patterns = data.patterns.map(([pattern,replacement])=>[new RegExp(pattern),replacement]);
  // 항목 이름은 블루레몬에이드의 과일 계열 사전(프롬프트 관리자와 같은 것)에서 찾아요. 예전 실행기면 이 파일에 실린 목록으로.
  const promptTitles = new Map((data.prompts||[]).map(p=>[normalize(p.name),p.title]));
  const promptTitle = core => (typeof BlueLemonade.promptTitle === 'function' ? BlueLemonade.promptTitle(null, core) : null) ?? promptTitles.get(core);
  const helpers = new Map(data.helpers);
  // 출잔 도구 호출 창(#serve-anti-host): 고정 문구 · 「지금 모델」 줄 · 상태 기록 줄의 제목만 바꿔요. 기록의 시각 · 모델 이름 · 서버 원문은 그대로예요.
  const serve = data.serve || {};
  const servePhrases = new Map(Object.entries(serve.ui || {}).map(([a,b])=>[normalize(a),b]));
  const servePatterns = (serve.patterns || []).map(([pattern,replacement])=>[new RegExp(pattern),replacement]);
  const serveStatus = serve.status || [];
  // 도구 호출 1.5(11-18): 따로 뜨던 창 대신 과일의 마음 창(#fruit-heart-v6) 안 탭으로 그려요 — 본문 칸 안의 [data-fh-serve-view] 가 든 화면 · 아래 메뉴 [data-nav="serve"] · 홈 카드 [data-action="open-serve-panel"].
  //   그 자리에서만 serve.fh 표(먼저) → 옛 창 표 순서로 찾아요. 과일의 마음 창의 다른 탭 글은 건드리지 않아요. 옛 1.4 창(#serve-anti-host)은 아래 예전 길 그대로예요.
  const fh = serve.fh || {};
  const fhPhrases = new Map(Object.entries(fh.ui || {}).map(([a,b])=>[normalize(a),b]));
  const fhPatterns = [...(fh.patterns || []), ...(serve.patterns || [])].map(([pattern,replacement])=>[new RegExp(pattern),replacement]);
  const fhParts = [...(fh.parts || []), ...serveStatus, ...(fh.tail || [])];
  let fhServeView = null;
  const inFhServe = element => !!element.closest('#fruit-heart-v6') && ((!!fhServeView && fhServeView.contains(element)) || !!element.closest('[data-nav="serve"],[data-action="open-serve-panel"]'));
  const fhWords = value => { let out = value; for (const [from,to] of fhParts) out = out.split(from).join(to); return out; };
  // 과일의 마음 창 공용 번역이 먼저 지나가면 한자 뒤 전각 쌍점(：)이 「: 」로 바뀌어 있어요(리그에서 확인) — 그 꼴도 같은 글로 봐요
  const colonBack = text => text.replace(/(\p{Script=Han}): ?/gu, '$1：').replace(/: ?$/, '：');
  // 띄어쓰기 · 쌍점 꼴만 다른 글도 같은 글로 찾아요(공용 번역이 먼저 손댄 꼴 · 「JSON:」처럼 한자 뒤가 아닌 쌍점)
  const loose = text => text.replace(/\s+/g, '').replace(/：/g, ':');
  const fhLoose = new Map([...servePhrases, ...fhPhrases].map(([a,b])=>[loose(a),b]));
  // 그 공용 번역이 상태 값 「开启 · 关闭」를 단추 말(켜기 · 끄기)로 먼저 바꾼 것을 상태 말로
  const fhValues = new Map(fh.values || []);
  function fhText(core) {
    const exact = fhPhrases.get(core) ?? servePhrases.get(core) ?? fhLoose.get(loose(core));
    if (exact !== undefined) return exact;
    for (const text of core === colonBack(core) ? [core] : [core, colonBack(core)]) {
      for (const [pattern,replacement] of fhPatterns) if (pattern.test(text)) return fhWords(text.replace(pattern,replacement));
    }
    return undefined;
  }
  // 출잔 스크립트가 띄우는 알림(제목이 「出杯·工具调用」인 토스트)만 골라 바꿔요. 다른 알림은 건드리지 않아요.
  const toast = serve.toast || {};
  const toastTitle = toast.title ? normalize(toast.title[0]) : null;
  const toastPhrases = new Map(Object.entries(toast.ui || {}).map(([a,b])=>[normalize(a),b]));
  const toastPatterns = (toast.patterns || []).map(([pattern,replacement])=>[new RegExp(pattern),replacement]);
  const toastParts = [...(toast.parts || []), ...serveStatus];
  function toastText(value) {
    const core = normalize(value);
    let next = toastPhrases.get(core);
    if (next === undefined) for (const [pattern,replacement] of toastPatterns) {
      if (!pattern.test(core)) continue;
      next = core.replace(pattern,replacement);
      for (const [from,to] of toastParts) next = next.split(from).join(to);
      break;
    }
    return next === undefined ? value : next;
  }
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
    if (!quality && element.closest('#serve-anti-host')) {
      next = servePhrases.get(core);
      if (next === undefined) for (const [pattern,replacement] of servePatterns) {
        if (pattern.test(core)) { next=core.replace(pattern,replacement);break; }
      }
      // 상태 기록은 여러 줄(시각 · 제목 · HTTP · 모델)이라 줄바꿈을 지키고 제목 낱말만 바꿔요
      if (next === undefined && element.closest('.serve-status')) {
        let out = value;
        for (const [from,to] of serveStatus) out = out.split(from).join(to);
        return out;
      }
    }
    if (!quality && inFhServe(element)) {
      // 홈 카드 그림 칸(.fh-qr-ico)은 스크립트가 주기마다 제 글자로 되돌려요 — 건드리면 서로 다퉈서 그대로 둬요
      const hit = element.closest('.fh-qr-ico') ? undefined : fhText(core);
      if (hit !== undefined) next = hit;
      else if (element.closest('.fh-serve-val') && fhValues.has(core)) next = fhValues.get(core);
      // 1.7.7 홈 카드 한 줄(「지금: … · … · 최근: …」)은 「 · 」 조각마다 따로 — 과일의 마음 창 공용 번역이 앞 조각만 먼저 바꿔 둔 꼴(「지금: 도구 모드 · 抗外审… · 最近：…」)도 뒤 조각까지 바꿔요
      else if (element.closest('.fh-qr-copy') && core.includes(' · ')) {
        const out = core.split(' · ').map(part => fhText(part) ?? fhWords(colonBack(part))).join(' · ');
        if (out !== core) next = out;
      }
      // 기록 제목 · 기록 풀이 · 홈 카드 한 줄은 서버 원문 · 모델 이름이 섞여요 — 아는 낱말만 바꾸고 나머지는 그대로
      else if (element.closest('.fh-serve-ltitle,.fh-serve-ldetail,.fh-qr-copy')) { const out = fhWords(colonBack(value)); return out === colonBack(value) ? value : out; }
    }
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
    if (root.getAttribute('id') === 'fruit-heart-v6') fhServeView = root.querySelector('[data-fh-serve-view]')?.parentElement || null;
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
    if (toastTitle) for (const box of doc.querySelectorAll('#toast-container .toast')) {
      const title = box.querySelector('.toast-title'), message = box.querySelector('.toast-message');
      const head = title && [...title.childNodes].find(node => node.nodeType === 3);
      if (!head || !message || normalize(texts.get(head)?.before ?? head.nodeValue) !== toastTitle) continue;
      paintNode(head, toast.title[1]);
      for (const node of message.childNodes) if (node.nodeType === 3) paintNode(node, toastText(node.nodeValue));
    }
    for (const node of texts.keys()) if (!node.isConnected) texts.delete(node);
    for (const node of attrs.keys()) if (!node.isConnected) attrs.delete(node);
  }
  const schedule=()=>{if(!stopped&&!frame)frame=host.requestAnimationFrame(flush);};
  // 8.0.4 속도: 바뀐 요소마다 그 아래 전체를 querySelector 로 훑으면(채팅 300개를 그릴 때 #chat 통째로) 과일 계열을 켠 모든 사용자의 화면 변화가 느려져요.
  // 뿌리 요소(아이디 여섯)를 문서에서 한 번 찾고, 바뀐 요소가 그 조상·자손·자신인지만 봐요 — 같은 판정이에요. 문서에 붙지 않은 요소·그림자 트리는 예전 방식 그대로예요.
  const rootIds=['qg-prose-pruner-backdrop','qg-prose-pruner-ball','fruit-heart-v6','serve-anti-host','toast-container','tavern_helper'];
  const slowRelevant=node=>node.matches(roots+',#tavern_helper')||node.closest(roots+',#tavern_helper')||node.querySelector(roots+',#tavern_helper');
  const relevantTo=present=>node=>{
    if(node?.nodeType!==1)return false;
    if(node.getRootNode()!==doc)return !!slowRelevant(node);
    for(const el of present)if(el===node||el.contains(node)||node.contains(el))return true;
    return false;
  };
  // 1.7.7 도구 호출 스크립트는 과일의 마음 창이 열려 있는 동안 0.2초마다 홈 카드 한 줄을 새로 쓰고(값이 같아도), 탭을 바꾸면 아래 메뉴 단추를 다시 끼워요.
  //   그때마다 다음 그리기 박자(rAF)에 창 전체를 훑던 것을, 그 자리(홈 카드 한 줄 · 아래 메뉴 단추)만 그 작업 끝(microtask)에서 바로 바꿔요 —
  //   원문이 한 번도 칠해지지 않고(깜빡임 없음 · 그리기 박자가 느린 화면에서 단추 이름이 몇 초 원문이던 것), 창 전체 훑기도 안 돌아요. 그 밖의 변화는 예전 길 그대로예요.
  const QUICK='[data-action="open-serve-panel"] .fh-qr-copy small,.fh-bottom-nav [data-nav="serve"]';
  const quickSpot=node=>{const el=node?.nodeType===3?node.parentElement:node;const hit=el?.closest?.(QUICK);return hit&&hit.closest('#fruit-heart-v6')?hit:null;};
  const observer=new host.MutationObserver(records=>{
    if(stopped)return;
    const spots=new Set();let rest=false;
    for(const record of records){
      const spot=quickSpot(record.target);
      if(spot){spots.add(spot);continue;}
      let added=0,quick=0;
      for(const node of record.addedNodes){added++;const hit=node.nodeType===1&&node.matches?.('[data-nav="serve"]')?quickSpot(node):null;if(hit){spots.add(hit);quick++;}}
      if(!added||quick!==added){rest=true;}
    }
    for(const spot of spots)if(spot.isConnected!==false)paintRoot(spot);
    if(spots.size){for(const node of texts.keys())if(!node.isConnected)texts.delete(node);for(const node of attrs.keys())if(!node.isConnected)attrs.delete(node);}   // 창 전체 훑기가 안 도는 동안에도 떨어진 노드 기억은 치워요
    if(!rest)return;
    records=records.filter(record=>!quickSpot(record.target));
    const present=[];for(const id of rootIds)for(const el of doc.querySelectorAll('#'+id))present.push(el);
    // 8.2.7 기록 수만 개가 같은 부모에 몰려요(스트리밍 글자 · 메시지마다 단추 줄) — 부모마다 판정은 한 번만(이 판정은 읽기만 해서 답이 같아요) · 기록마다 새 배열 없이
    const relevant=relevantTo(present),seen=new Map(),targetRelevant=node=>{let hit=seen.get(node);if(hit===undefined){hit=relevant(node);seen.set(node,hit);}return hit;};
    if(records.some(record=>{if(targetRelevant(record.target.nodeType===3?record.target.parentElement:record.target))return true;for(const node of record.addedNodes)if(relevant(node))return true;return false;}))schedule();
  });
  // 1.7.7 과일의 마음 창(#fruit-heart-v6)은 body 안이 아니라 body 옆(html 바로 아래)에 붙어요 — body 만 지켜보면 그 창 안의 변화(탭을 바꿔 다시 끼운 아래 메뉴 단추 · 홈 카드 한 줄)를
  //   못 보고, body 쪽에 다른 변화가 생길 때에야 같이 번역됐어요(아래 메뉴 「出杯」가 몇 초 ~ 계속 원문). 문서 뿌리부터 지켜봐요(판정은 위 relevantTo 그대로).
  observer.observe(doc.documentElement||doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  function stop(){
    if(stopped)return;stopped=true;observer.disconnect();host.cancelAnimationFrame(frame);
    if(host.confirm===localizedConfirm)host.confirm=originalConfirm;
    for(const [node,value] of texts)if(node.nodeValue===value.shown)node.nodeValue=value.before;
    for(const [node,values] of attrs)for(const [name,value] of values)if(node.getAttribute(name)===value.shown)node.setAttribute(name,value.before);
    texts.clear();attrs.clear();if(host[key]?.stop===stop)delete host[key];
  }
  host[key]={stop};BlueLemonade.onCleanup(stop);flush();
}
