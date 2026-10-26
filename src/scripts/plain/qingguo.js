// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/qingguo.js 을 고치고 다시 만든다
export default function blueLemonadeScript(BlueLemonade) {
/*BL-SCRIPT-START*/
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
  const relevant=node=>node?.nodeType===1&&(node.matches(roots+',#tavern_helper')||node.closest(roots+',#tavern_helper')||node.querySelector(roots+',#tavern_helper'));
  const observer=new host.MutationObserver(records=>{
    if(records.some(record=>relevant(record.target.nodeType===3?record.target.parentElement:record.target)||[...record.addedNodes].some(relevant)))schedule();
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

installQingguoKorean(BlueLemonade,{"ui":{"🍏 青果·缄默白描质检与修枝台":"🍏 청과 문장 점검·다듬기","青果·缄默白描质检与修枝台":"청과 문장 점검·다듬기","待扫描":"점검 대기","🎨 文风读取中…":"🎨 문체를 읽고 있어요…","↻ 重新扫描":"↻ 다시 점검","✕ 关闭":"✕ 닫기","🔍 质检雷达":"🔍 문장 점검","🎨 文风协同":"🎨 문체 연동","📋 规则库(增删改查)":"📋 규칙 관리","🌱 修枝台 (":"🌱 문장 다듬기 (","⚙️ 配置":"⚙️ 설정","⚡ 一键本地净水":"⚡ 로컬 문장 정리","🌱 AI 果农保味修枝":"🌱 AI로 문체 살려 다듬기","当前聊天中尚未找到 AI 回复楼层，您可先切换到「🎨 文风协同」或「📋 规则库(增删改查)」管理配置。":"현재 채팅에 AI 답변이 없어요. 문체 연동이나 규칙 관리에서 먼저 설정할 수 있어요.","🎨 文风 × 缄默准则 智能无冲突协同已生效：":"🎨 문체와 침묵 원칙의 연동을 사용해요:","✨ 未检出任何否定起手、二元伪深刻转折、装腔比喻或青果黑名单禁词！":"✨ 이번 점검에서 지정된 도입·전환·비유·금지어 규칙에 걸린 문장이 없어요.","若觉得某一段不够贴合当前预设文风，可前往「🎨 文风协同」勾选段落定向润色。":"현재 문체와 맞지 않는 문단은 문체 연동에서 골라 다듬을 수 있어요.","自定义":"직접 설정","✏️ 修改此规则":"✏️ 규칙 수정","● 当前预设已启用":"● 현재 프리셋에서 사용 중","当前预设中未检测到开启的《⌨️ 文风区》或《✍️ 写作区》条目，您可以直接在下方列表中一键开启！":"현재 켜진 문체·쓰기 항목이 없어요. 아래 목록에서 켤 수 있어요.","✨ 定向段落文风润色（即使无禁词违规，也可让指定段落更贴合当前预设文风）":"✨ 선택한 문단 다듬기 · 금지어가 없어도 현재 문체에 맞출 수 있어요","勾选觉得“文风出戏/味道不够”的段落，点击右侧按钮交由 AI 果农按当前开启的《⌨️ 文风》+《🚫 缄默准则3.5》重写：":"다듬을 문단을 고르면 AI가 현재 문체와 침묵 원칙 3.5에 따라 다시 써요:","🔄 预设《✍️ 写作指导》与《⌨️ 文风区》实时联动开关（与酒馆预设 & 果实之心 100% 同步，零冗余）":"🔄 쓰기 지침·문체 선택을 프리셋과 과일의 마음에 연결해요","在此处开关文风会直接同步写回当前青果预设，无需在预设面板与修枝台两边重复勾选：":"여기서 문체를 바꾸면 현재 청과 프리셋에도 저장돼요:","🎨 青果文风 × 缄默准则 无冲突协同机制":"🎨 청과 문체와 침묵 원칙 연동","生成阶段交由原预设负责":"생성 단계는 원래 프리셋을 따라요","（本脚本绝不在请求中重复塞入第2份文风Prompt，零Token冗余）；":"(문체 지시를 요청에 한 번 더 넣지 않아요).","质检阶段智能豁免":"점검 단계에서 문체별 예외를 적용해요","（开启浪漫/意识流/轻喜剧文风时自动放宽比喻密度，不误伤通感与幽默）；":"(낭만·의식의 흐름·로맨틱 코미디 문체에서는 비유 허용 범위를 넓혀요).","修枝阶段注入文风保味":"다듬기 단계에서 현재 문체를 참고해요","开启「文风×缄默准则」比喻/感官阈值动态协调":"문체에 맞춰 비유·감각 표현 기준 조절","AI 修枝时自动携带当前预设《⌨️ 文风》保味":"AI로 다듬을 때 현재 프리셋 문체 포함","📝 附加个人文风微调口令（可选，将随预设文风一并传给 AI 修枝官）：":"📝 추가 문체 지시 · 선택 사항이며 AI 다듬기에 함께 보내요:","💾 保存口令":"💾 지시 저장","💾 保存规则":"💾 규칙 저장","取消":"취소","规则名称 (必填)：":"규칙 이름 (필수):","所属维度分类：":"분류:","违规严重度级别（影响扣分权重）：":"심각도 (감점 기준):","🔴 高优红线 (每处扣6分)":"🔴 높음 (한 곳당 6점 감점)","🟡 中度建议 (每处扣3分)":"🟡 중간 (한 곳당 3점 감점)","🔵 轻度提示 (每处扣1分)":"🔵 낮음 (한 곳당 1점 감점)","来源说明备注：":"출처·설명:","匹配模式：":"찾기 방식:","🔤 关键词列表模式（推荐新手：多个词用 | 或逗号分隔，自动转正则）":"🔤 단어 목록 (| 또는 쉼표로 구분해요)","🧩 高级正则表达式模式（每行一条正则表达式）":"🧩 정규식 (한 줄에 하나씩 입력해요)","💡 AI 修枝指导建议（当命中此规则时，会作为修改指令发给 AI 果农）：":"💡 AI 수정 지침 (이 규칙에 걸리면 AI에 보내요):","⚡ 本地一键净水快修策略：":"⚡ 로컬 문장 정리 방식:","仅交由 AI 修枝（本地净水不自动替换）":"AI로만 다듬기 (로컬에서 자동 교체하지 않아요)","将命中词直接替换为右侧指定文本（留空即直接删除）":"지정한 글로 교체 (빈칸이면 삭제해요)","使用青果内置智能净水函数":"청과 내장 정리 함수 사용","本地净水替换目标词（当左方选“替换为指定文本”时生效，留空代表直接删去命中词）：":"교체할 글 (지정한 글로 교체를 골랐을 때 사용하며, 빈칸이면 삭제해요):","全部来源":"모든 출처","➕ 新增规则":"➕ 규칙 추가","📤 导出":"📤 내보내기","📥 导入":"📥 가져오기","🔄 全部重置":"🔄 모두 초기화","自定义规则":"직접 만든 규칙","已自定义修改":"직접 수정됨","✏️ 编辑":"✏️ 편집","🗑️ 删除":"🗑️ 삭제","↺ 还原默认":"↺ 기본값 복원","未找到符合筛选条件的质检规则。":"조건에 맞는 점검 규칙이 없어요.","「⚡ 一键本地净水」":"「⚡ 로컬 문장 정리」","（秒级清理直引号与套话前缀）、":"(곧은따옴표와 상투적인 도입부를 정리해요),","「🌱 AI 果农保味修枝」":"「🌱 AI로 문체 살려 다듬기」","（按《缄默准则3.5》+当前预设文风重写违规段），":"(침묵 원칙 3.5와 현재 문체에 따라 해당 문단을 다시 써요),","「🎨 文风协同」":"「🎨 문체 연동」","（可在下方绿色文本框直接微调，确认无误后点击右侧写回）":"(아래 입력칸에서 수정한 뒤 적용할 수 있어요)","🔀 新建候选层 (Swipe·保留原版可左右滑对比)":"🔀 새 답변 후보 (원본을 보존하고 넘겨 비교해요)","✏️ 直接原位覆写当前楼层":"✏️ 현재 메시지 덮어쓰기","✅ 采纳并写回酒馆":"✅ 채택·메시지에 적용","移除此项":"이 항목 제거","修枝前（原段落）：":"다듬기 전 (원문):","修枝后（可自由编辑）：":"다듬기 후 (수정할 수 있어요):","1. AI 果农修枝通道与写回策略":"1. AI 다듬기 연결·적용 방식","调用方式：":"연결 방식:","🔌 直接复用酒馆当前主 API（免填 Key·即开即用）":"🔌 실리태번의 현재 API 사용","⚡ 独立副 API 通道（可配 Gemini Flash / DeepSeek 极速修枝）":"⚡ 별도 API 사용","默认写回方式：":"기본 적용 방식:","🔀 新建候选层 (Swipe) 并自动同步 ECoT（推荐·零损原稿）":"🔀 새 답변 후보·ECoT 동기화 (원본 보존)","✏️ 直接覆写当前消息":"✏️ 현재 메시지 덮어쓰기","每次收到 AI 新回复后自动在后台执行白描扫描并在悬浮球显示得分":"AI 답변을 받을 때 자동 점검하고 떠 있는 버튼에 점수 표시","2. 独立副 API 详细参数（当上方选择「独立副 API 通道」时生效）":"2. 별도 API 설정 (별도 API를 골랐을 때 사용해요)","接口协议：":"API 형식:","OpenAI 兼容格式 (/v1/chat/completions)":"OpenAI 호환 (/v1/chat/completions)","Google Gemini 原生格式 (/v1beta)":"Google Gemini 기본 (/v1beta)","API 基础地址 (Base URL)：":"API 기본 주소:","模型名称 (Model)：":"모델 이름:","💾 保存配置":"💾 설정 저장","未定位消息":"메시지를 찾지 못했어요","⏳ 果农修枝中…":"⏳ 문장을 다듬고 있어요…","⏳ 文风润色中…":"⏳ 문체를 다듬고 있어요…","点击查看/联动当前青果预设开启的文风":"현재 청과 프리셋의 문체를 확인하고 연결해요","零API消耗：一键按规则执行本地净水替换":"API 호출 없이 로컬 규칙으로 글을 교체해요","调用AI果农：按《🚫 缄默准则3.5》排雷 + 按当前预设《⌨️ 文风》保味修枝":"AI를 호출해 침묵 원칙 3.5와 현재 문체에 따라 다듬어요","例如：保持冷幽默短句、多用器物光影烘托气氛、对白带一点市井烟火气…":"원하는 문체 조정 내용을 입력해요","例如：高频口头禅与私人雷点词":"자주 나오는 말버릇·피하고 싶은 단어 등","例如：自定义质检规则 / 青果黑名单·禁用词":"직접 만든 점검 규칙·청과 금지어 등","例如：《个人雷点补充》":"개인 금지어 보완 등","在此输入要拦截的词条或正则…":"찾을 단어나 정규식을 입력해요…","告诉 AI 果农遇到该问题时应如何改写…":"이 문제를 어떻게 고칠지 AI에 알려요…","留空表示直接删除该冗余词，或填入替换词":"빈칸이면 삭제하며, 교체할 글을 넣을 수도 있어요","🔍 搜索规则名称 / 禁词 / 正则 / 修枝建议…":"🔍 규칙 이름·금지어·정규식·수정 지침 검색…","导出自定义规则与修改项为 JSON":"직접 만든 규칙과 수정 사항을 JSON으로 내보내요","从 JSON 导入自定义规则":"JSON에서 규칙을 가져와요","将所有规则恢复为青果 1.5 出厂默认设置":"모든 규칙을 청과 1.5 기본값으로 복원해요","恢复此内置规则的出厂默认正则与建议":"이 내장 규칙의 정규식·수정 지침을 기본값으로 복원해요","启用/禁用此规则":"이 규칙을 켜거나 꺼요","例如 https://api.openai.com/v1":"예: https://api.openai.com/v1","如 gemini-2.5-flash / deepseek-chat":"예: gemini-2.5-flash / deepseek-chat","段落/分句否定起手":"문단·절을 부정 표현으로 시작하기","“不是…而是…”二元伪深刻转折":"부정 뒤 긍정으로 바꾸는 상투적 전환","青果核心黑名单垃圾词":"청과 핵심 금지어","NSFW 场景专属禁词":"성인 장면 전용 금지어","高烈度副词与夸张视线钉死":"과도한 부사·시선 강조","装腔声口与眼神比喻":"과장된 목소리·눈빛 비유","空泛修饰套话（一丝/几分/某种名为/弧度）":"막연한 수식·상투어","动物塑与陈词滥调造喻":"동물에 빗대기·상투적 비유","明喻/暗喻密度超标（支持文风动态协调）":"직유·은유의 과밀 (문체별 기준 적용)","工业参数与医学解剖词污染":"공학 수치·의학 해부 용어 남용","弱势方物化/瓷器玩偶化":"약한 인물을 사물·인형처럼 묘사하기","古早霸总油腻动作与超雄台词":"과도한 지배적 행동·대사","擅加烟酒与刻板配饰把玩":"근거 없는 술·담배·액세서리 추가","廉价语气词堆砌与英文直引号违规":"과도한 추임새·곧은따옴표","尾段钓鱼提问 / 总结升华 / 越权代写 User":"끝맺음의 유도 질문·과장된 요약·사용자 대신 행동","正文字数区间核查 (1200–2000字)":"본문 글자 수 점검 (1,200~2,000자)","缄默准则·句法铁律":"침묵 원칙 · 문장 구조","青果黑名单·禁用词":"청과 금지어","缄默准则·白描极简":"침묵 원칙 · 간결한 묘사","缄默准则·去装腔比喻":"침묵 원칙 · 과장된 비유 줄이기","缄默准则·去理工与反物化":"침묵 원칙 · 수치 남용·대상화 방지","调色盘·抗超雄与神人压制":"인물 다양성 · 과도한 지배성·능력 억제","角色塑造·克制外貌":"인물 묘사 · 외모 절제","对白指导·活人声口":"대사 지침 · 자연스러운 말투","正文尾铁律·收束规范":"본문 끝 · 마무리 규칙","自定义质检规则":"직접 만든 점검 규칙","《🚫 缄默准则3.5》第一条：封杀否定起手":"침묵 원칙 3.5 제1항 · 부정 표현 도입 금지","《🚫 缄默准则3.5》第二条：彻底拔除先否定再肯定句式":"침묵 원칙 3.5 제2항 · 부정 뒤 긍정 전환 줄이기","《🈲禁词》明令封杀词条":"금지어 항목","《🈲NSFW禁词》词条":"성인 묘사 금지어 항목","《🚫 缄默准则3.5》第一条 & 《🥵官能凝视补丁》第四条":"침묵 원칙 3.5 제1항·감각적 시선 보정 제4항","《🚫 缄默准则3.5》第三条：封杀装腔眼神/听感比喻":"침묵 원칙 3.5 제3항 · 과장된 눈빛·청각 비유 금지","《🚫 缄默准则3.5》第三条：抹杀空泛修饰":"침묵 원칙 3.5 제3항 · 막연한 수식 줄이기","《🚫 缄默准则3.5》第三条 & 《🈲禁词》":"침묵 원칙 3.5 제3항·금지어","《✍️ 极光写作指导》第二条 & 《🚫 缄默准则3.5》能直写不造喻":"오로라 쓰기 지침 제2항·침묵 원칙 3.5의 직접 묘사","《🚫 缄默准则3.5》第四条：封杀工业与解剖参数污染":"침묵 원칙 3.5 제4항 · 공학·해부 수치 남용 금지","《🚫 缄默准则3.5》第四条：反物化与主体尊严":"침묵 원칙 3.5 제4항 · 대상화 방지·인격 존중","《🍓 优先人设｜调色盘与抗超雄》 & 《🧩 神人压制》Clean Charisma":"인물 설정 우선·과도한 능력 억제","《🧩 无人万能与克制外貌》：禁擅加烟酒与刻板配饰":"만능 인물 방지·외모 절제 · 술·담배·액세서리 임의 추가 금지","《🍇 对白指导》：拒绝刻意演口语 & 统一使用中文双引号“”":"대사 지침 · 과도한 구어체 방지·따옴표 통일","《📌 正文尾》三条铁律：物理瞬间停点、严守User主权、零总结升华":"본문 끝 세 규칙 · 장면에서 멈추기·사용자 선택 존중·요약 절제","《📌 正文与字数要求（抗重复）》：需求字数 1200-2000 字":"본문·글자 수 요구 · 1,200~2,000자","用户自定义规则":"사용자가 만든 규칙","正文字数区间核查 (600–2400字)":"본문 글자 수 점검 (600~2,400자)","《📌 字数·随境三档 / 轻快短篇》：需求字数 600-2400 字":"글자 수 · 상황 따라 3단계 / 가벼운 짧은 글 · 600~2,400자"},"patterns":[["^目标楼层：#(\\d+)$","대상 메시지: #$1"],["^字（共 (\\d+) 段）$","자 (총 $1개 문단)"],["^\\[第(\\d+)段\\]$","[$1번째 문단]"],["^命中 (\\d+) 处$","규칙에 걸린 곳 $1개"],["^🎨 按当前预设文风润色选中段 \\((\\d+)\\)$","🎨 현재 문체로 선택 문단 다듬기 ($1)"],["^✍️ 写作区（共 (\\d+) 项）$","✍️ 쓰기 지침 (총 $1개)"],["^⌨️ 文风区（共 (\\d+) 项）$","⌨️ 문체 (총 $1개)"],["^⚙️ 青果内置特殊结构探针 \\((\\d+)\\)$","⚙️ 청과 내장 구조 검사 ($1)"],["^匹配词条 / 正则表达式（(.*?)）：$","찾을 단어·정규식 ($1):"],["^全部分类 \\((\\d+)\\)$","모든 분류 ($1)"],["^已生成 (\\d+) 处修枝建议$","$1곳의 수정안을 만들었어요"]],"helpers":[["果实之心-ECoT自动注入与解析 @YUKI","과일의 마음 · ECoT 자동 삽입·해석 @YUKI"],["果实之心丨Git正式版","과일의 마음 · Git 정식판"],["果实之心丨本地版","과일의 마음 · 로컬판"],["🍏 青果·缄默白描质检与修枝台","🍏 청과 문장 점검·다듬기"]]});

/*BL-SCRIPT-END*/
}
