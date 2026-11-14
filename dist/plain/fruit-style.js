function Rt(mt,bt){function pt(h,k){let s=bt;try{for(;s.parent&&s.parent!==s&&s.parent.document;)s=s.parent}catch{}const w="__blueLemonadeFruitStyle_v1";s[w]?.stop?.();const f=s.document,q=f.createElement("style");q.dataset.blFruitStyle="1",q.textContent=k,(f.head||f.documentElement).append(q);const y=wt(f,s),l=At(f,s,Et,y),g=h.fruitOptionHelp?.(),t=Lt(f,s,y),m=Ot(f,s,y),E=_t(f,s,y),C=Nt(f,s,h,y);let A=!1;function e(){A||(A=!0,l(),g?.(),t(),m(),E(),C(),y.stop(),q.remove(),s[w]?.stop===e&&delete s[w])}s[w]={stop:e},h.onCleanup(e)}const W=1,V=2,U=4,et=8,H=16,Z=32,at=64,it=128;function wt(h,k){const s=[],w=new Map,f=new Set,q={childList:!0,subtree:!0,characterData:!0,attributes:!0,attributeFilter:["class","style"]},y={childList:!0,attributes:!0,attributeFilter:["class","data-bl-fruit-entry"]};let l=!1;const g=()=>{const e=h.body;e&&!f.has(e)&&(f.add(e),m.observe(e,y))};function t(e){let i=0;const d=new Map;for(const r of e){const n=r.target;if(n===h.documentElement&&r.type==="childList"){i|=W;continue}if(f.has(n)){i|=r.type==="childList"?V:r.attributeName==="class"?U:et;continue}const o=r.type==="childList"?H:r.type==="characterData"?Z:r.attributeName==="class"?at:it,p=w.size===1?w.keys().next().value:[...w.keys()].find(x=>x===n||x.contains?.(n));for(const x of p?[p]:w.keys())d.set(x,(d.get(x)||0)|o)}i&W&&g();for(const r of s.slice())!r.off&&r.mask&(i|(r.root&&d.get(r.root)||0))&&r.wake()}const m=new k.MutationObserver(e=>{l||t(e)});m.observe(h.documentElement,{childList:!0}),g();function E(){const e=m.takeRecords();e.length&&t(e),m.disconnect(),f.clear(),m.observe(h.documentElement,{childList:!0}),g();for(const i of w.keys())m.observe(i,q)}function C(e,i,d=!1){if(i=i||null,e.root===i)return;const r=e.root;if(e.root=i,i){const n=w.get(i)||0;w.set(i,n+1),!n&&!l&&m.observe(i,q)}if(r){const n=(w.get(r)||1)-1;n>0?w.set(r,n):(w.delete(r),!d&&!l&&E())}}function A(){l||(l=!0,m.disconnect(),s.length=0,w.clear(),f.clear())}return{add(e,i){const d={mask:e,wake:i,root:null,off:!1};return s.push(d),{seen:r=>{d.off||C(d,r)},off:()=>{if(d.off)return;d.off=!0,C(d,null,!0);const r=s.indexOf(d);r>=0&&s.splice(r,1),s.length||A()}}},stop:A}}const gt=W|V|H,xt=V|U|H|Z,kt=W|V|U|H|at,qt=W|V|U|H,St=W|V|U|et|H|Z|it;function At(h,k,s,w){const f="data-bl-fruit-help";let q=!1,y=!1,l=null,g=null,t=null,m=null,E=!1,C=0,A="";const e=(S,F,z)=>{const _=h.createElement(S);return F!==void 0&&(_.textContent=F),z&&(_.className=z),_};function i(S=!0){E=!1,m?.remove(),t?.setAttribute("aria-expanded","false"),t?.removeAttribute("aria-controls"),S&&l?.isConnected&&(g?.isConnected&&(g.scrollTop=C),t?.focus({preventScroll:!0}))}function d(){const S=e("section",void 0,"bl-fruit-help-panel");S.setAttribute(f,"panel"),S.id="bl-fruit-help-panel-v1",S.setAttribute("role","region"),S.setAttribute("aria-labelledby","bl-fruit-help-title-v1");const F=e("div",void 0,"bl-fruit-help-head"),z=e("h3","과일의 마음 도움말");z.id="bl-fruit-help-title-v1",z.tabIndex=-1;const _=e("button","접기","fh-btn");_.type="button",_.addEventListener("click",I=>{I.stopPropagation(),i()}),F.append(z,_),S.append(F,e("p",s.intro+" 옵션을 길게 누르면 켰을 때의 효과를 확인해요. 키보드에서는 Alt+Enter 또는 Shift+F10을 누르세요.","bl-fruit-help-intro"));for(const I of s.sections){const M=e("details");M.dataset.helpView=I.id,M.append(e("summary",I.title));for(const Q of I.items){const K=e("div",void 0,"bl-fruit-help-item");K.append(e("h4",Q.title),e("small",Q.source),e("p",Q.text)),M.append(K)}S.append(M)}const P=e("p",void 0,"bl-fruit-help-sources");P.append(e("span",s.credit));for(const I of s.links){const M=e("a",I.label);M.href=I.url,M.target="_blank",M.rel="noopener noreferrer",P.append(M)}return S.append(P),S}function r(){x(),!(!g||!t)&&(C=g.scrollTop,E=!0,m||(m=d()),A="",x(),g.scrollTop=0,m.querySelector("h3")?.focus({preventScroll:!0}))}function n(S){S.preventDefault(),S.stopPropagation(),E?i():r()}function o(S){S.key==="Escape"&&E&&(S.preventDefault(),S.stopPropagation(),i())}function p(){l?.removeEventListener("keydown",o,!0),t?.removeEventListener("click",n),t?.remove(),m?.remove(),E&&l?.isConnected&&g?.isConnected&&l.contains(g)&&(g.scrollTop=C),l=g=t=m=null,E=!1,A=""}function x(){if(q)return;const S=h.getElementById("fruit-heart-v6");if(S!==l&&(p(),l=S,N.seen(l),l&&l.addEventListener("keydown",o,!0)),!l)return;const F=l.querySelector(".fh-brand strong");if(g=l.querySelector(".fh-main"),!(!F||!g)){if(!t||t.parentNode!==F){t?.removeEventListener("click",n),t?.remove(),t=e("button",void 0,"bl-fruit-help-button");const z=e("i",void 0,"fa-solid fa-question");z.setAttribute("aria-hidden","true"),t.append(z),t.type="button",t.setAttribute(f,"button"),t.setAttribute("aria-label","과일의 마음 도움말"),t.title="과일의 마음 도움말",t.setAttribute("aria-expanded",String(E)),t.addEventListener("click",n),F.append(t)}if(E&&m){const z=l.querySelector(".fh-nav-item.on")?.dataset.nav||"overview";if(A&&z!==A&&(C=g.scrollTop),m.parentNode!==g&&g.prepend(m),t.setAttribute("aria-expanded","true"),t.setAttribute("aria-controls",m.id),z!==A){for(const _ of m.querySelectorAll("details"))_.open=_.dataset.helpView===z;A=z}}}}function b(){y||q||(y=!0,Promise.resolve().then(()=>{y=!1,x()}))}const N=w.add(gt,b);return x(),()=>{q||(q=!0,N.off(),p())}}const Et={intro:"과일 프리셋의 옵션을 화면에서 고르는 도구예요. 아래에서 처음 쓰는 법과 현재 탭의 설명을 볼 수 있어요.",sections:[{id:"general",title:"처음 쓰는 분께",items:[{title:"어디서 시작하나요?",text:"홈에서 자주 쓰는 옵션을 고르고, 더 자세한 설정은 ‘항목’에서 찾아요.",source:"원작 안내 정리"},{title:"선택하면 무엇이 바뀌나요?",text:"프리셋 옵션은 고르면 실제 설정에 저장돼요. 화면에 보일 구역을 고르는 설정은 표시만 바꿔요.",source:"동작 해설"},{title:"QR을 누르기 전에",text:"입력창만 채우는 카드와 바로 전송하는 카드가 있어요. 카드 설명을 확인하고 눌러요.",source:"원작 안내 정리"}]},{id:"overview",title:"홈",items:[{title:"모델 묶음",text:"선택한 모델에 맞는 프리셋 항목 묶음을 켜요. API 연결이나 실제 모델을 바꾸는 버튼은 아니에요.",source:"동작 해설"},{title:"자주 쓰는 옵션",text:"홈에서 고른 옵션도 실제 프리셋에 적용돼요. 하나만 고르는 종류는 다른 선택이 함께 꺼질 수 있어요.",source:"동작 해설"},{title:"본문 글자 수",text:"프리셋에 적힌 답변 길이 요청을 바꿔요. API의 최대 출력 토큰 설정과는 달라요.",source:"동작 해설"},{title:"NSFW 자동",text:"답변 생성 전에 입력의 시작·종료 단어와 이전 답변의 장면 정보를 보고 전체 스위치를 바꿔요. 판단할 정보가 없으면 현재 상태를 유지해요.",source:"동작 해설"}]},{id:"qr",title:"QR",items:[{title:"입력창에 먼저 넣기",text:"기본 ‘전개 지시’와 ‘괄호 지시’는 입력창을 채워요. 내용을 확인하거나 고친 뒤 직접 보내면 돼요.",source:"원작 안내 정리"},{title:"바로 전송하는 카드",text:"기본 요약·개요·카드 작성·프롬프트 조정·자동 계속은 메시지를 보내고 AI 답변 생성을 시작해요.",source:"동작 해설"},{title:"채팅 숨기기",text:"숨기기는 지정한 대화를 AI에게 보내는 내용에서 빼고, 숨김 해제는 다시 넣어요. 채팅 기록은 남아 있어요.",source:"동작 해설"},{title:"직접 가져온 QR",text:"가져오거나 편집한 카드는 그 안의 명령대로 실행돼요. 위 설명은 기본 카드 기준이에요.",source:"동작 해설"}]},{id:"entries",title:"항목",items:[{title:"항목 켜고 끄기",text:"체크하면 실제 프리셋 항목을 켜거나 꺼요. 핵심 항목은 변경 전에 확인창이 나올 수 있어요.",source:"동작 해설"},{title:"필요한 항목 찾기",text:"이름으로 검색하거나 ‘켜진 항목만’으로 좁혀 볼 수 있어요. 구역을 열면 그 안의 항목이 보여요.",source:"원작 안내 정리"},{title:"구역 순서와 표시",text:"구역 정렬은 패널 안의 순서만 바꿔요. 설정에서 구역을 숨겨도 프리셋 항목 자체는 꺼지지 않아요.",source:"원작 안내 정리"}]},{id:"settings",title:"설정",items:[{title:"연결 모델 따라가기",text:"연결된 모델을 알아보면 그 모델용 프리셋 항목으로 맞춰요. 알아보지 못한 모델은 그대로 둬요.",source:"원작 안내 정리"},{title:"NSFW 단어와 종료 여유",text:"종료 단어가 우선이며, 단어 편집은 자동 저장돼요. 종료 여유는 NSFW 장면이 끝난 뒤 몇 회 더 유지할지 정해요. 판단은 답변 생성 전에 해요.",source:"동작 해설"},{title:"보일 구역 고르기",text:"홈의 펼침 상태와 ‘항목’에 표시할 구역을 정해요. 표시를 줄이는 설정이며, 실제 프리셋 항목의 켜짐 상태는 바꾸지 않아요.",source:"원작 안내 정리"},{title:"항목 변경 동기화",text:"실리태번에서 항목을 추가하거나 옮겼다면 구역 목록을 다시 읽어요. 프리셋 본문이나 항목의 켜짐 상태는 바꾸지 않아요.",source:"원작 안내 정리"},{title:"스킨과 글꼴",text:"스킨에서 블루레몬에이드를 고르면 테마 색을 따라요. 글꼴 목록 아래에 블루레몬에이드 글꼴이 이어지고, 여기서 고른 글꼴은 이 창에만 적용돼요.",source:"동작 해설"},{title:"빠른 답장 이름",text:"빠른 답장 줄에 보일 이름을 적어요. 비우면 원래 이름으로 돌아가고, QR 명령은 바뀌지 않아요.",source:"동작 해설"},{title:"홈 화면 항목 되돌리기",text:"⠿ 손잡이를 잡았을 때만 순서가 바뀌어요. 처음 순서로 되돌리기는 이 프리셋에 저장된 순서와 펼침 상태만 지워요.",source:"동작 해설"}]}],credit:"원작 화면의 안내를 정리하고, 코드로 확인한 내용은 ‘동작 해설’로 구분했어요.",links:[{label:"원작 저장소",url:"https://github.com/kongkongmie/guoshizhixin"},{label:"프롬프트 원문",url:"https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064"}]};function Lt(h,k,s){const w="data-bl-fruit-reading-hidden",f=new Map,q=new Map;let y=null,l=!1,g=!1;const t=d=>{for(const[r,n]of d.notes)r.getAttribute(w)==="1"&&(n===null?r.removeAttribute(w):r.setAttribute(w,n));d.notes.clear(),d.tools.remove()},m=()=>{for(const d of f.values())t(d);f.clear()},E=d=>{for(const[n,o]of d.notes)d.open?n.getAttribute(w)==="1"&&(o===null?n.removeAttribute(w):n.setAttribute(w,o)):n.getAttribute(w)!=="1"&&n.setAttribute(w,"1");d.button.setAttribute("aria-expanded",String(d.open));const r=d.open?"설명 접기":"설명 보기";d.label.textContent!==r&&(d.label.textContent=r)},C=d=>{if(d.closest("details")||d.querySelector('button,input,select,textarea,a,[role="button"]'))return!1;const r=d.textContent.trim();return r.length>=30&&!/[⚠❗]|주의|경고|지원하지|지원되지|오류|실패|무효|복구|삭제|되돌릴|无效|不支持|过低|已删|无法恢复|不能恢复/.test(r)},A=()=>{if(g=!1,l)return;const d=h.getElementById("fruit-heart-v6");if(d!==y&&(m(),y=d,i.seen(y)),!y||!h.body?.classList.contains("salty")||y.querySelector(".fh-nav-item.on")?.dataset.nav!=="settings"){m();return}const r=[...y.querySelectorAll(".fh-main .fh-card,.fh-main .fh-grp")],n=new Set(r);for(const[o,p]of f)n.has(o)||(t(p),f.delete(o));for(const o of r){const p=[...o.querySelectorAll(".fh-card-head > p,.fh-mech > .fh-note,.fh-toggle > span > small")].filter(b=>b.closest(".fh-card,.fh-grp")===o&&C(b));let x=f.get(o);if(!p.length){x&&(t(x),f.delete(o));continue}if(!x){const b=o.querySelector(":scope > .fh-card-head"),N=(b?.querySelector("h3")?.textContent||o.querySelector(".fh-toggle > span")?.firstChild?.textContent||"설정").trim(),S=h.createElement("div");S.className="bl-fruit-reading-tools",S.dataset.blFruitReading="tools";const F=h.createElement("button");F.type="button",F.className="bl-fruit-reading-toggle",F.setAttribute("aria-label",`${N} 설명 펼치기 또는 접기`);const z=h.createElement("span");F.append(z),S.append(F),x={notes:new Map,tools:S,button:F,label:z,open:q.get(N)===!0,title:N},f.set(o,x),F.addEventListener("click",P=>{P.stopPropagation(),x.open=!x.open,q.set(N,x.open),E(x)});const _=b?null:o.previousElementSibling;b?b.append(S):_?.classList.contains("fh-sect")?_.append(S):o.insertBefore(S,o.firstChild)}for(const[b,N]of x.notes)p.includes(b)||(b.getAttribute(w)==="1"&&(N===null?b.removeAttribute(w):b.setAttribute(w,N)),x.notes.delete(b));for(const b of p)x.notes.has(b)||x.notes.set(b,b.getAttribute(w));E(x)}},e=()=>{!l&&!g&&(g=!0,queueMicrotask(A))},i=s.add(xt,e);return A(),()=>{l||(l=!0,i.off(),m(),q.clear())}}const ht="blue_lemonade_scripts",ft=40,D="data-bl-fruit-user-label",Ct={sans:"고딕",serif:"명조",display:"꾸밈 · 손글씨",mono:"고정폭",custom:"내 글꼴"};function tt(h){return Array.from(String(h??"").replace(/\s+/g," ").trim()).slice(0,ft).join("").trim()}function Ft(h){return(Array.isArray(h)?h:[]).filter(k=>k&&typeof k.id=="string"&&!k.unusable&&(k.group==="custom"||k.lang==="ko"))}function zt(h){const k=h.SillyTavern?.getContext?.(),s=k?.extensionSettings;if(!s||typeof s!="object")return null;const w=()=>{let f=s[ht];return(!f||typeof f!="object"||Array.isArray(f))&&(f=s[ht]={version:1,enabled:{},overrides:{}}),(!f.names||typeof f.names!="object"||Array.isArray(f.names))&&(f.names={}),f.names};return{read:()=>tt(w().fruit),write(f){w().fruit=tt(f),k.saveSettingsDebounced?.()}}}const G=h=>!!h.body?.classList.contains("salty"),B={read(h,k){try{return h.localStorage.getItem(k)}catch{return null}},write(h,k,s){try{s===null?h.localStorage.removeItem(k):h.localStorage.setItem(k,s)}catch{}}};function Ot(h,k,s){const w="blue-lemonade-fruit-skin",f="data-bl-fruit-skin";let q=B.read(k,w)!=="native",y=null,l=!1,g=!1,t=null;const m=new Set,E=()=>{for(const r of m)r.isConnected&&r.classList.add("on");m.clear()},C=()=>{t?.remove(),t=null};function A(){if(g=!1,l)return;const r=h.getElementById("fruit-heart-v6");if(r!==y&&(y?.removeAttribute(f),E(),C(),y=r,d.seen(y)),!y)return;if(!G(h)){y.removeAttribute(f),E(),C();return}q?y.getAttribute(f)!=="lemonade"&&y.setAttribute(f,"lemonade"):y.hasAttribute(f)&&y.removeAttribute(f);for(const p of m)p.isConnected||m.delete(p);const n=[...y.querySelectorAll("[data-skin-set]")],o=n[0]?.closest(".fh-seg");if(!o){C();return}(!t?.isConnected||t.parentNode!==o)&&(C(),t=h.createElement("button"),t.type="button",t.dataset.blSkinSet="lemonade",t.setAttribute(D,""),t.textContent="블루레몬에이드",t.addEventListener("click",p=>{p.preventDefault(),p.stopPropagation(),q=!0,B.write(k,w,null),A()}),o.append(t)),t.classList.contains("on")!==q&&t.classList.toggle("on",q),t.getAttribute("aria-pressed")!==String(q)&&t.setAttribute("aria-pressed",String(q));for(const p of n)q&&p.classList.contains("on")?(p.classList.remove("on"),m.add(p)):!q&&m.has(p)&&(p.classList.add("on"),m.delete(p))}const e=()=>{!l&&!g&&(g=!0,k.queueMicrotask(A))},i=r=>{l||!y?.contains(r.target)||!r.target.closest?.("[data-skin-set]")||(q=!1,B.write(k,w,"native"),e())};h.addEventListener("click",i,!0);const d=s.add(kt,e);return A(),()=>{l||(l=!0,d.off(),h.removeEventListener("click",i,!0),y?.removeAttribute(f),E(),C())}}function _t(h,k,s){const w="fruit-heart-control-config-v2";let f=null,q=!1,y=!1,l=!1;const g=new Map,t=r=>{for(const n of[k,k.TavernHelper])if(typeof n?.[r]=="function")return n[r].bind(n);return null},m=()=>{for(const r of g.values())r.remove();g.clear()},E=r=>{const n=r?.prompts?.find(p=>String(p?.id??"")===w);let o;try{o=JSON.parse(n?.content||"null")}catch{}if(!o||o.version!==4||!o.controlGroups)throw Error("이 프리셋의 홈 화면 항목은 되돌릴 수 없어요.");return{prompt:n,config:o}};async function C(r){if(l||q||!r.isConnected)return;const n=t("getLoadedPresetName"),o=t("getPreset"),p=t("updatePresetWith");if(!n||!o||!p){k.toastr?.error?.("실리태번 헬퍼에서 프리셋을 읽지 못했어요.");return}l=!0,r.disabled=!0;const x=f;let b="";const N=()=>{if(q||f!==x||!x?.isConnected||n()!==b)throw Error("프리셋이 바뀌어 되돌리기를 멈췄어요.")};try{if(b=n(),!b)throw Error("현재 프리셋 이름을 읽지 못했어요.");E(o("in_use")),E(o(b));const S=F=>{N();const{prompt:z,config:_}=E(F);return delete _.homeOrder,delete _.homeOpen,z.content=JSON.stringify(_),z.enabled=!1,F};await p("in_use",S,{render:"immediate"}),N(),await p(b,S,{render:"none"}),x.querySelector('.fh-nav-item[data-nav="settings"]')?.click(),k.toastr?.success?.("홈 화면 항목을 처음 순서로 되돌렸어요.")}catch(S){k.toastr?.error?.(S?.message||"홈 화면 항목을 되돌리지 못했어요.")}finally{l=!1,r.isConnected&&(r.disabled=!1)}}function A(){if(y=!1,q)return;const r=h.getElementById("fruit-heart-v6");if(r!==f&&(m(),f=r,d.seen(f)),!f||!G(h)){m();return}for(const[n,o]of g)n.isConnected||(o.remove(),g.delete(n));for(const n of f.querySelectorAll("[data-home-sort]")){if(g.has(n))continue;const o=n.closest(".fh-pad");if(!o||!o.closest(".fh-card"))continue;const p=h.createElement("div");p.className="fh-card-actions bl-fruit-home-actions",p.setAttribute(D,"");const x=h.createElement("button");x.type="button",x.className="fh-btn bl-fruit-home-reset",x.textContent="처음 순서로 되돌리기",x.addEventListener("click",b=>{b.preventDefault(),b.stopPropagation(),C(x)}),p.append(x),o.after(p),g.set(n,p)}}const e=()=>{!q&&!y&&(y=!0,k.queueMicrotask(A))},i=r=>{q||!G(h)||!f?.contains(r.target)||!r.target.closest?.(".fh-sortrow")?.closest(".fh-sortlist")||r.target.closest(".fh-grip,.fh-sw,button,input,select,textarea,a")||r.stopPropagation()};h.addEventListener("pointerdown",i,!0);const d=s.add(qt,e);return A(),()=>{q||(q=!0,d.off(),h.removeEventListener("pointerdown",i,!0),m())}}function Nt(h,k,s,w){const f="blue-lemonade-fruit-font",q=zt(k);let y=B.read(k,f)||"",l=q?.read()||"",g=l,t=null,m=!1,E=!1,C=!1,A=null,e=null,i=null,d=!1,r=null;const n=new Map,o=new Map,p=new Map,x=new Set,b=(a,u,c)=>{const v=h.createElement(a);return u!=null&&(v.textContent=u),c&&(v.className=c),v},N=()=>{try{return Ft(s.fonts?.list?.())}catch{return[]}};let S=!s.fonts?.ready,F=null;const z=()=>{S||F||(F=Promise.resolve().then(()=>s.fonts.ready()).then(a=>{m||a===!1||(S=!0,y&&s.fonts.load?.(y),J())}).catch(a=>k.console?.warn?.("[Blue Lemonade] 과일 글꼴 목록을 받지 못했어요",a)).finally(()=>{F=null}))},_=a=>a&&N().find(u=>u.id===a)||null;function P(){if(A){const{node:a,value:u,priority:c,applied:v}=A;a.style.getPropertyValue("--font")===v&&(u?a.style.setProperty("--font",u,c):a.style.removeProperty("--font")),a.removeAttribute("data-bl-fruit-font"),A=null}for(const a of n.values())a.label.remove(),a.text.nodeValue===""&&(a.text.nodeValue=a.value);n.clear()}function I(){const a=_(y),u=a&&s.fonts?.stack?.(a.id);if(!t||!a||!u){P();return}(!A||A.node!==t)&&(P(),A={node:t,value:t.style.getPropertyValue("--font"),priority:t.style.getPropertyPriority("--font"),applied:""});const c=t.style.getPropertyValue("--font");A.applied&&c!==A.applied&&(A.value=c,A.priority=t.style.getPropertyPriority("--font")),c!==u&&t.style.setProperty("--font",u),A.applied=u,t.getAttribute("data-bl-fruit-font")!==a.id&&t.setAttribute("data-bl-fruit-font",a.id);for(const[v]of n)v.isConnected||n.delete(v);for(const v of t.querySelectorAll("[data-pick-font]")){let L=n.get(v);if(!L){const O=[...v.childNodes].find(X=>X.nodeType===3);if(!O)continue;const R=b("span","","bl-fruit-font-label");R.setAttribute(D,""),L={text:O,value:O.nodeValue,label:R},n.set(v,L),v.insertBefore(R,O)}L.text.nodeValue!==""&&(L.value=L.text.nodeValue,L.text.nodeValue=""),L.label.textContent!==a.label&&(L.label.textContent=a.label),L.label.isConnected||v.insertBefore(L.label,L.text)}}function M(){y="",B.write(k,f,null),P()}function Q(a){a.querySelector("[data-sheet-close]")?.click()}function K(a){if(p.has(a)||!s.fonts)return;const u=a.querySelector(".fh-sheet-list");if(!u)return;const c=N();if(!c.length)return;const v=b("section",null,"bl-fruit-font-options");v.setAttribute(D,"");const L=b("input");L.type="search",L.className="bl-fruit-font-search",L.placeholder="블루레몬에이드 글꼴 찾기",L.setAttribute("aria-label","블루레몬에이드 글꼴 찾기");const O=b("div",null,"bl-fruit-font-choices"),R=b("p","맞는 글꼴이 없어요.","bl-fruit-font-empty");R.hidden=!0,v.append(b("div","블루레몬에이드 글꼴","fh-sheet-head"),L,O,R);const X=y?[...u.querySelectorAll("[data-pick-index].on")]:[];for(const T of X)T.classList.remove("on");const yt=c.map(T=>{const j=b("button",null,"fh-sheet-item");j.type="button",j.dataset.blFruitFontChoice=T.id,j.append(b("span",T.label),b("em",Ct[T.group]||"블루레몬에이드"),b("i","✓"));const Y=T.id===y;return j.classList.toggle("on",Y),j.setAttribute("aria-pressed",String(Y)),j.addEventListener("click",ct=>{ct.preventDefault(),ct.stopPropagation(),y=T.id,B.write(k,f,T.id);try{s.fonts.load(T.id)}catch{}I(),Q(a)}),{button:j,key:`${T.label} ${T.id}`.toLocaleLowerCase()}});O.append(...yt.map(T=>T.button)),u.append(v),a.dataset.blFruitFontSheet="1",L.addEventListener("input",()=>{const T=L.value.trim().toLocaleLowerCase();let j=0;for(const Y of yt)Y.button.hidden=!!T&&!Y.key.includes(T),Y.button.hidden||j++;R.hidden=j>0}),p.set(a,{group:v,nativeOn:X})}function $(a){for(const[u,c]of a.texts)u.nodeValue===""&&(u.nodeValue=c);a.label.remove();for(const[u,c]of a.attrs)a.node.getAttribute(u)===a.applied&&(c===null?a.node.removeAttribute(u):a.node.setAttribute(u,c));a.node.removeAttribute(D)}function lt(){if(!l&&!o.size)return;const a=new Set(h.querySelectorAll('[data-fh-cat="1"]'));for(const[u,c]of o)(!a.has(u)||!l)&&($(c),o.delete(u));if(l)for(const u of a){const c=u.querySelector(".qr--button-label")||u;let v=o.get(u);if(v&&v.label.parentNode!==c&&($(v),o.delete(u),v=null),!v){const O=b("span",l,"bl-fruit-entry-name");O.setAttribute(D,""),v={node:u,label:O,texts:new Map,attrs:new Map(["title","aria-label"].map(R=>[R,u.getAttribute(R)])),applied:""},u.setAttribute(D,""),c.append(O),o.set(u,v)}const L=h.createTreeWalker(c,4);for(;L.nextNode();){const O=L.currentNode;O.parentElement?.closest(".bl-fruit-entry-name,svg,.fh-bar-cat,.qr--button-expander,.qr--button-icon")||(O.nodeValue!==""?(v.texts.set(O,O.nodeValue),O.nodeValue=""):v.texts.has(O)||v.texts.set(O,""))}v.label.textContent!==l&&(v.label.textContent=l);for(const O of["title","aria-label"]){const R=u.getAttribute(O);v.applied&&R!==v.applied&&v.attrs.set(O,R),R!==l&&u.setAttribute(O,l)}v.applied=l}}function nt(){l=tt(i?.isConnected?i.value:g),g=l,i&&i.value!==l&&(i.value=l),q?.write(l),lt()}function Tt(){const a=t?.querySelector('[data-entry-toggle="bar"]')?.closest(".fh-toggle"),u=h.body?.getAttribute("data-bl-fruit-entry");if(!a||u&&u!=="qr"){e?.remove(),e=i=null;return}if(e?.isConnected&&e.previousElementSibling===a)return;e?.remove(),e=b("div",null,"fh-row fh-stack bl-fruit-qr-name"),e.setAttribute(D,"");const c=b("span","빠른 답장 이름","fh-k"),v=b("div",null,"fh-v");if(i=b("input"),i.type="text",i.value=g,i.placeholder="비우면 원래 이름",i.maxLength=ft,i.autocomplete="off",i.setAttribute("aria-label","빠른 답장 줄에 보일 이름"),i.addEventListener("input",()=>{g=i.value,r=[i.selectionStart,i.selectionEnd]}),i.addEventListener("change",nt),i.addEventListener("keydown",L=>{L.key==="Enter"&&(L.preventDefault(),nt(),i.blur())}),i.addEventListener("focus",()=>{d=!0}),v.append(i),e.append(c,v),a.after(e),d&&(i.focus({preventScroll:!0}),r))try{i.setSelectionRange(...r)}catch{}}function st(){if(E=!1,m)return;[...x].some(c=>!c.isConnected)&&(rt.disconnect(),x.clear());for(const c of["#form_sheld","#qr--popout","#quickReplies"].flatMap(v=>[...h.querySelectorAll(v)]))x.has(c)||(x.add(c),rt.observe(c,{childList:!0,subtree:!0,characterData:!0}));const a=h.getElementById("fruit-heart-v6");a!==t&&(P(),t=a,e=i=null,C=!1,vt.seen(t));for(const[c,{group:v}]of p)c.isConnected||(v.remove(),p.delete(c));const u=G(h);if(!d&&q){const c=q.read();c!==l&&(l=c,g=c,i&&(i.value=c))}if(t&&u){if(z(),I(),Tt(),C&&S){const c=t.querySelector(".fh-sheet");c&&(K(c),C=!1)}}else P(),e?.remove(),e=i=null;if(u)lt();else for(const[c,v]of o)$(v),o.delete(c)}const J=()=>{!m&&!E&&(E=!0,k.queueMicrotask(st))},ot=a=>{const u=a.target?.closest?.("button");!t||!u||!t.contains(u)||(u.matches("[data-pick-font]")?(C=!0,z(),J()):u.matches("[data-pick-index]")&&u.closest("[data-bl-fruit-font-sheet]")&&M())},ut=a=>{e&&!e.contains(a.target)&&(d=!1)},dt=a=>{e&&!e.contains(a.target)&&(d=!1)},vt=w.add(St,J),rt=new k.MutationObserver(J);if(h.addEventListener("click",ot,!0),h.addEventListener("pointerdown",ut,!0),h.addEventListener("focusin",dt,!0),y)try{s.fonts?.load?.(y)}catch{}return st(),()=>{if(!m){m=!0,vt.off(),rt.disconnect(),h.removeEventListener("click",ot,!0),h.removeEventListener("pointerdown",ut,!0),h.removeEventListener("focusin",dt,!0),P();for(const a of o.values())$(a);o.clear(),e?.remove(),e=i=null;for(const[a,{group:u,nativeOn:c}]of p){u.remove();for(const v of c)v.isConnected&&v.classList.add("on");a.removeAttribute("data-bl-fruit-font-sheet")}p.clear()}}}pt(mt,`/* Every rule is gated by the active theme; only the panel's presentation changes.\r
   :is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) = the Fruit window while Blue Lemonade is on (layout, typography, control geometry: every skin).\r
   :is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] = the same window while its skin choice is 블루레몬에이드 (palette only). The original skins keep\r
   their own colors, tape and glass when the user picks them in the window. */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) {\r
  --font-sans:var(--salty-font-ui,var(--mainFontFamily,system-ui));\r
  --bl-fh-acc-ink:var(--acc); --bl-fh-field:var(--card2); --bl-fh-hover:var(--fill2);\r
  --bl-fh-danger:var(--acc); --bl-fh-danger-soft:var(--acc-soft); --bl-fh-scrim:#1a161366;\r
  --bl-fh-sheet-shadow:var(--shadow); --bl-fh-knob-shadow:0 1px 3px #00000033;\r
  --bl-fh-pad:12px; --bl-fh-row:44px; --bl-fh-control:36px; --bl-fh-chip:32px;\r
  --salty-accent-13:color-mix(in srgb,var(--salty-accent) 13%,transparent);\r
  --salty-accent-28:color-mix(in srgb,var(--salty-accent) 28%,transparent);\r
  --salty-well-in:inset 0 1px 2px rgba(0,0,0,.06);\r
  font-family:var(--font) !important;\r
  font-size:var(--salty-ui-size,var(--mainFontSize,15px)); line-height:1.5;\r
  font-weight:var(--salty-ui-weight,normal); letter-spacing:var(--bl-settings-tracking,normal);\r
  word-break:keep-all; overflow-wrap:anywhere;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) * { box-sizing:border-box; }\r
\r
/* ── Blue Lemonade skin: the theme palette, day/night follow the window's own switch ── */\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] {\r
  --paper:var(--salty-panel-surface,var(--salty-surface)) !important;\r
  --card:var(--salty-fill-surface,var(--salty-surface)) !important;\r
  --card2:var(--salty-control,var(--salty-surface)) !important;\r
  --fill:var(--salty-shade) !important;\r
  --fill2:var(--salty-shade-2) !important;\r
  --ink:var(--salty-text) !important;\r
  --ink2:var(--salty-muted) !important;\r
  --ink3:var(--salty-muted) !important;\r
  --line:var(--salty-line) !important;\r
  --acc:var(--salty-accent) !important;\r
  --acc-soft:var(--salty-accent-13,var(--salty-shade)) !important;\r
  --acc-line:var(--salty-accent-28) !important;\r
  --gold:var(--salty-accent) !important;\r
  --on-acc:var(--salty-on-accent) !important;\r
  --knob:var(--salty-raised,var(--salty-text)) !important;\r
  --track:var(--salty-line) !important;\r
  --shadow:var(--salty-e1) !important;\r
  --grain:none !important;\r
  --r:var(--bl-r-md,12px) !important;\r
  --r2:var(--bl-r-sm,8px) !important;\r
  --bl-fh-acc-ink:var(--salty-accent-ink,var(--salty-accent));\r
  --bl-fh-field:var(--salty-fill-field,var(--salty-field));\r
  --bl-fh-hover:var(--salty-control-hover,var(--fill2));\r
  --bl-fh-danger:var(--salty-danger); --bl-fh-danger-soft:var(--salty-danger-soft);\r
  --bl-fh-scrim:var(--salty-scrim); --bl-fh-sheet-shadow:var(--salty-e4); --bl-fh-knob-shadow:var(--salty-knob,var(--salty-e1));\r
  color:var(--salty-text); background:var(--salty-scrim);\r
  backdrop-filter:none; -webkit-backdrop-filter:none;\r
  color-scheme:light;\r
}\r
:is(html > body.salty.salty-dark #fruit-heart-v6#fruit-heart-v6, html > body.salty.salty-dark ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] { color-scheme:dark; }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"][data-theme="day"] {\r
  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#fafbfc);\r
  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 2%,#fff);\r
  --salty-control:color-mix(in srgb,var(--salty-accent) 4%,#edf0f4);\r
  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 10%,#e9edf3);\r
  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#e9edf2);\r
  --salty-text:#242b35; --salty-muted:#586473; --salty-line:rgba(43,56,73,.16);\r
  --salty-shade:rgba(43,56,73,.055); --salty-shade-2:rgba(43,56,73,.09);\r
  --salty-raised:#fff; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 58%,#17222e);\r
  --salty-scrim:rgba(21,27,35,.22); color-scheme:light !important;\r
}\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"][data-theme="night"] {\r
  --salty-panel-surface:color-mix(in srgb,var(--salty-accent) 3%,#20242c);\r
  --salty-fill-surface:color-mix(in srgb,var(--salty-accent) 3%,#282d36);\r
  --salty-control:color-mix(in srgb,var(--salty-accent) 5%,#303641);\r
  --salty-control-hover:color-mix(in srgb,var(--salty-accent) 12%,#353c49);\r
  --salty-fill-field:color-mix(in srgb,var(--salty-accent) 3%,#1b2028);\r
  --salty-text:#ecf0f5; --salty-muted:#b1bdcc; --salty-line:rgba(221,232,246,.17);\r
  --salty-shade:rgba(221,232,246,.06); --salty-shade-2:rgba(221,232,246,.10);\r
  --salty-raised:#dce6f2; --salty-accent-ink:color-mix(in srgb,var(--salty-accent) 50%,#fff); /* 7.9.9: 66% 는 밝은 팔레트의 진한 포인트(#2477D3)를 고른 칸 면(13%) 위에 3.97 로 깔았다 → 50% 면 내장 팔레트 전부 4.9 이상(리얼 블랙 #5C5C5C 가 가장 낮음) */\r
  --salty-scrim:rgba(4,7,12,.40); color-scheme:dark !important;\r
}\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-shell { background:var(--paper); border:0; box-shadow:var(--salty-e5); backdrop-filter:none; -webkit-backdrop-filter:none; }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-grp):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-qr-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-sec):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-update-entry):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-sortrow):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry,.fh-sortrow) {\r
  background:var(--card); border:1px solid var(--line); box-shadow:none; overflow:hidden;\r
  backdrop-filter:none; -webkit-backdrop-filter:none;\r
}\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-grp):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before,
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before,
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-qr-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before,
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-sec):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec)::before,
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-qr-card::after { content:none; }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-card-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-qr-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-ch):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] :where(.fh-sec-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) { background:var(--fill); }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-brand strong { background:none; background-clip:border-box; -webkit-background-clip:border-box; color:var(--ink); }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-brand-mark { filter:none; }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-bottom-nav { background:var(--paper); }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-sheet-box { background:var(--card); border:0; backdrop-filter:none; -webkit-backdrop-filter:none; }\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-lab, :is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6)[data-bl-fruit-skin="lemonade"] .fh-link { color:var(--bl-fh-acc-ink); }\r
\r
/* ── Shell ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-shell {\r
  container:bl-fruit-settings / inline-size;\r
  width:min(760px,100%); min-width:0; max-width:100%;\r
  grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) auto;\r
  grid-template-areas:"head" "main" "nav"; border-radius:var(--r);\r
}\r
:is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6).fh-is-fullscreen .fh-shell { width:100%; height:100%; border-radius:var(--r2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-header):is(.fh-header,.fh-main,.fh-bottom-nav),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-main):is(.fh-header,.fh-main,.fh-bottom-nav),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-bottom-nav):is(.fh-header,.fh-main,.fh-bottom-nav) { min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-header { grid-area:head; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:4px 8px; padding:12px; border:0; align-items:center; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-brand):is(.fh-brand,.fh-brand > div),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(div):is(.fh-brand,.fh-brand > div) { display:contents; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand-mark { grid-column:1; grid-row:1; width:1.5em; height:1.5em; margin:0; color:var(--bl-fh-acc-ink); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand strong { grid-column:2; grid-row:1; min-width:0; font-size:1.15em; line-height:1.35; letter-spacing:normal; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand :where(em):is(em,small),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand :where(small):is(em,small) { grid-column:1 / -1; min-width:0; font-size:.78em; line-height:1.45; letter-spacing:normal; margin:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand em { grid-row:2; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand small { grid-row:3; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-header:has(.fh-update-badge:not([hidden])) .fh-brand em { padding-right:44px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-update-badge { grid-column:3; grid-row:2; justify-self:end; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-header-meta { grid-column:3; grid-row:1; gap:4px; flex-wrap:nowrap; justify-content:flex-end; max-width:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-header-meta::before { content:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-close):is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-theme):is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-fullscreen):is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-update-badge):is(.fh-close,.fh-theme,.fh-fullscreen,.fh-update-badge) {\r
  display:inline-flex; align-items:center; justify-content:center; padding:0; text-align:center;\r
  width:var(--bl-fh-control); height:var(--bl-fh-control); min-width:var(--bl-fh-control); min-height:var(--bl-fh-control);\r
  font-size:1em; line-height:1; border:0; border-radius:var(--r2);\r
  background:var(--card2); color:var(--ink);\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-close { font-size:1.25em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-main { grid-area:main; padding:8px 12px; overflow:auto; scrollbar-gutter:stable; background:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-main > * { max-width:100%; margin-left:0; margin-right:0; }\r
\r
/* ── Type scale: one size for titles and labels, one smaller size for notes ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(h2,h3,.fh-k,.fh-ck,.fh-ch b,.fh-sec-head b,.fh-qr-copy strong,.fh-qr-head strong,.fh-toggle,.fh-sortrow b,.fh-mech-head b) {\r
  font-size:1em; line-height:1.45; font-weight:inherit; letter-spacing:inherit; color:var(--ink);\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) h2 { font-size:1.2em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(h3):is(.fh-card-head h3,.fh-ch b,.fh-sec-head b,.fh-qr-head strong),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(b):is(.fh-card-head h3,.fh-ch b,.fh-sec-head b,.fh-qr-head strong),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(strong):is(.fh-card-head h3,.fh-ch b,.fh-sec-head b,.fh-qr-head strong) { font-weight:600; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(p,.fh-dim,.fh-lab,.fh-hint,.fh-note,.fh-sect b,.fh-sect span,.fh-doc > summary,.fh-doc p,.fh-foot,.fh-empty,.fh-qr-copy small,.fh-qr-desc,.fh-qr-tip,.fh-sign,.fh-exp-tip,.fh-exp-rtext small,.fh-toggle span small,.fh-update-tip,.fh-update-status,.fh-update-entry ul,.fh-ck em,.fh-sortrow span,.fh-ch .fh-n,.fh-mech-head i,.fh-mech-head .fh-n) {\r
  font-size:.85em; line-height:1.5; letter-spacing:inherit;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(p,.fh-hint,.fh-note,.fh-dim,.fh-toggle span small,.fh-ck em,.fh-sortrow span,.fh-ch .fh-n) { color:var(--ink2); opacity:1; }\r
/* 7.9.9: 실리태번 small { opacity:.7 } 이 보조 글자색(--ink3 = muted) 위에 한 번 더 흐려 QR 안내(13px)가 4.16 : 1 이었다 — 색은 창 토큰이 정하고 흐림은 끈다 */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) small { opacity:1; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-lab):is(.fh-lab,.fh-sect),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sect):is(.fh-lab,.fh-sect) { margin:14px 4px 6px; padding:0; border:0; flex-wrap:wrap; color:var(--ink2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect { flex-direction:column; align-items:flex-start; gap:2px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect b { font-size:1em; font-weight:600; letter-spacing:inherit; color:var(--ink); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect span { line-height:1.5; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-lab { font-weight:600; letter-spacing:inherit; }\r
\r
/* ── Cards ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-grp):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-card):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sec):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-update-entry):is(.fh-grp,.fh-card,.fh-qr-card,.fh-sec,.fh-update-entry) { border-radius:var(--r); margin-top:0; margin-bottom:10px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-card-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-ch):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sec-head):is(.fh-card-head,.fh-qr-head,.fh-ch,.fh-sec-head) { padding:9px var(--bl-fh-pad); gap:8px; border:0; border-bottom:1px solid var(--line); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card-head > p { margin:3px 0 0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-card-actions):is(.fh-card-actions,.fh-pad,.fh-qr-acts),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-pad):is(.fh-card-actions,.fh-pad,.fh-qr-acts),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-acts):is(.fh-card-actions,.fh-pad,.fh-qr-acts) { padding:10px var(--bl-fh-pad); gap:6px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips { padding:10px var(--bl-fh-pad); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-card,.fh-grp,.fh-qr-card,.fh-sec) > .fh-chips + .fh-card-actions { padding-top:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card > :where(.fh-v):is(.fh-v,textarea),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card > :where(textarea):is(.fh-v,textarea) { margin:10px var(--bl-fh-pad); width:calc(100% - var(--bl-fh-pad) * 2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-card,.fh-grp) > .fh-tagbox { padding:0 var(--bl-fh-pad) 10px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-chips):is(.fh-chips,.fh-qr-acts,.fh-card-actions),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-acts):is(.fh-chips,.fh-qr-acts,.fh-card-actions),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-card-actions):is(.fh-chips,.fh-qr-acts,.fh-card-actions) { display:grid; grid-template-columns:minmax(0,1fr); gap:6px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-chips,.fh-qr-acts,.fh-card-actions) > :where(button):is(button,.fh-btn,.fh-chip),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-chips,.fh-qr-acts,.fh-card-actions) > :where(.fh-btn):is(button,.fh-btn,.fh-chip),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-chips,.fh-qr-acts,.fh-card-actions) > :where(.fh-chip):is(button,.fh-btn,.fh-chip) { width:100%; margin:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-ch { min-height:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-ch b { min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech { margin:8px var(--bl-fh-pad); padding:6px 0 6px 10px; border-left:2px solid var(--line); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech + .fh-mech { margin-top:0; padding-top:8px; border-top:1px solid var(--line); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech-head { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; margin-bottom:4px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech-head b { flex:1 1 auto; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech-head > .fh-n { margin-left:auto; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech :where(.fh-row):is(.fh-row,.fh-toggle,.fh-pad),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech :where(.fh-toggle):is(.fh-row,.fh-toggle,.fh-pad),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-mech :where(.fh-pad):is(.fh-row,.fh-toggle,.fh-pad) { padding-left:0; padding-right:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) #fh-ecot-end-tags { height:4.5em; min-height:3em; max-height:none; }\r
\r
/* ── Rows: name on the left, control on the right, on one line whenever it fits.\r
   A control that is too wide for the remaining space moves to its own full-width line. ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; min-height:var(--bl-fh-row); padding:7px var(--bl-fh-pad); position:static; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-row):is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-pad):is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-item):is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-toggle):is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sheet-item):is(.fh-row,.fh-pad,.fh-item,.fh-toggle,.fh-sheet-item)::before { content:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-row,.fh-toggle) + :where(.fh-row):is(.fh-row,.fh-toggle),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-row,.fh-toggle) + :where(.fh-toggle):is(.fh-row,.fh-toggle) { border-top:1px solid var(--line); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-k { flex:0 1 auto; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-v { flex:1 1 8em; min-width:0; max-width:100%; margin-left:auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row > .fh-seg,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-v > .fh-seg { flex:1 1 8em; margin-left:auto; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row.fh-stack { display:block; padding-top:9px; padding-bottom:9px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row.fh-stack .fh-k { display:block; margin-bottom:8px; line-height:1.5; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row.fh-stack .fh-v { margin-left:0; justify-content:flex-start; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row.act .fh-k { color:var(--bl-fh-acc-ink); font-weight:600; }\r
\r
/* ── Switch rows: title, thin switch at the end of the same line, note underneath ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toggle {\r
  display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:2px 12px;\r
  padding:9px var(--bl-fh-pad); min-height:var(--bl-fh-row); position:static; cursor:pointer;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toggle > span { display:contents; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toggle > span > small { grid-column:1; grid-row:2; display:block; margin:0; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toggle > .fh-sw { grid-column:2; grid-row:1 / span 2; align-self:center; margin:0; }\r
\r
/* ── Switch: the theme's own switch size (36 × 20, 14px knob), one geometry everywhere ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sw {\r
  width:36px; height:20px; min-width:36px; min-height:20px; margin:0; padding:0;\r
  border:0; border-radius:20px; background:var(--track); box-shadow:none; flex:none;\r
  transition:background .18s;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sw::after { top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; box-shadow:var(--bl-fh-knob-shadow); transition:left .18s; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sw.on { background:var(--acc); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sw.on::after { left:19px; background:#fff; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sw[disabled] { opacity:.45; cursor:not-allowed; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cv .fh-sw,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-row .fh-sw { margin-left:auto; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item .fh-sw { display:none; }\r
\r
/* ── Choice buttons (segments), pickers, buttons, chips: one height ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button,.fh-more,.fh-tag,.fh-check,.fh-sheet-item,.fh-sheet-cancel) {\r
  min-width:0; max-width:100%; font-size:1em; line-height:1.45;\r
  word-break:keep-all; overflow-wrap:anywhere; font-weight:inherit; letter-spacing:inherit;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-btn,.fh-chip,.fh-tag),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-chip):is(.fh-btn,.fh-chip,.fh-tag),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-tag):is(.fh-btn,.fh-chip,.fh-tag) {\r
  min-height:var(--bl-fh-control); padding:7px 10px; border:0; border-radius:var(--r2);\r
  background:var(--card2); color:var(--ink); box-shadow:none; white-space:normal;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-seg { display:inline-flex; flex-wrap:wrap; max-width:100%; min-width:0; gap:3px; padding:3px; border:0; background:var(--fill); border-radius:var(--r2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-seg button { flex:1 1 auto; min-height:var(--bl-fh-chip); padding:4px 10px; border:0; border-radius:calc(var(--r2) - 2px); background:transparent; color:var(--ink); box-shadow:none; white-space:nowrap; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cv .fh-seg button { padding:4px 10px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-btn.on,.fh-chip.on,.fh-sheet-item.on),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-chip):is(.fh-btn.on,.fh-chip.on,.fh-sheet-item.on),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sheet-item):is(.fh-btn.on,.fh-chip.on,.fh-sheet-item.on) { background:var(--acc-soft); color:var(--bl-fh-acc-ink); box-shadow:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-seg button.on { background:var(--acc-soft); color:var(--bl-fh-acc-ink); box-shadow:inset 0 0 0 1px var(--acc); font-weight:600; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-btn.primary,.fh-btn.solid) { background:var(--acc); color:var(--on-acc); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-btn.danger { color:var(--bl-fh-danger); background:var(--bl-fh-danger-soft); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-btn[disabled] { opacity:.45; }\r
@media(hover:hover) and (pointer:fine) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-chip):is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-sel):is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(button):is(.fh-btn,.fh-chip,.fh-sel,.fh-seg button):hover { background:var(--bl-fh-hover); }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-btn.primary,.fh-btn.solid):hover { background:var(--acc); color:var(--on-acc); filter:brightness(1.04); }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-seg button.on:hover { background:var(--acc-soft); }\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chip::before { content:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chips { gap:6px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chip { display:inline-flex; align-items:center; justify-content:flex-start; gap:8px; padding:7px 10px; text-align:left; }\r
/* 7.9.9: ✓ 는 글자 줄 밖(절대 위치 · 세로 가운데)에 두고 그만큼 왼쪽 여백을 비운다 — 줄 안에 있으면 control-ink 가 「섞인 글자」로 보고 칩 글자 잉크를 가운데로 못 맞췄다(1.9~2.0px 아래) */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chip { position:relative; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chip.on { padding-left:calc(18px + .9em); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-chip.on::before { content:'✓'; position:absolute; left:10px; top:50%; transform:translateY(-50%); display:inline-flex; align-items:center; justify-content:center; width:.9em; height:auto; margin:0; border:0; background:none; color:currentColor; font-size:.9em; line-height:1; }\r
/* Picker buttons show their current value on one line and shorten it with an ellipsis. */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sel {\r
  display:block; position:relative; flex:0 1 auto; min-width:0; max-width:100%;\r
  min-height:var(--bl-fh-control); padding:7px 2em 7px 10px; border:0; border-radius:var(--r2);\r
  background:var(--card2); color:var(--ink); box-shadow:none; text-align:left;\r
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sel-t { display:inline; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sel > i { position:absolute; right:.75em; top:50%; transform:translateY(-50%); display:inline-flex; align-items:center; margin:0; font-size:.7em; line-height:1; color:var(--ink2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sel.on { background:var(--acc-soft); color:var(--bl-fh-acc-ink); font-weight:inherit; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sel.on > i { color:currentColor; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-v > .fh-sel { max-width:100%; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where([type=text]):is(input[type=text],input[type=search],input[type=number],textarea,select),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where([type=search]):is(input[type=text],input[type=search],input[type=number],textarea,select),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where([type=number]):is(input[type=text],input[type=search],input[type=number],textarea,select),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(textarea):is(input[type=text],input[type=search],input[type=number],textarea,select),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(select):is(input[type=text],input[type=search],input[type=number],textarea,select) {\r
  min-width:0; max-width:100%; font-size:1em; line-height:1.5; min-height:var(--bl-fh-control);\r
  border:0; border-radius:var(--r2); background:var(--bl-fh-field);\r
  font-weight:inherit; letter-spacing:inherit; color:var(--ink); box-shadow:var(--salty-well-in); padding:7px 10px;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(code):is(code,pre,textarea:not([data-card-desc])),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(pre):is(code,pre,textarea:not([data-card-desc])),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(textarea):is(code,pre,textarea:not([data-card-desc])) {\r
  font-family:var(--salty-font-code,ui-monospace,Consolas,monospace) !important;\r
  font-size:var(--salty-code-size,.9em); word-break:normal; overflow-wrap:normal;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) textarea[data-card-desc] { font-family:var(--font) !important; font-size:1em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(pre):is(pre,.fh-exp-preview),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-exp-preview):is(pre,.fh-exp-preview) { max-width:100%; overflow:auto; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toolbar { flex-wrap:wrap; gap:8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-search { flex:1 1 12em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-toolbar > .fh-search { flex:1 0 100%; width:100%; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-tagadd):is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-exp-range):is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-exp-head):is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-update-entry-head):is(.fh-tagadd,.fh-exp-range,.fh-exp-head,.fh-update-entry-head) { flex-wrap:wrap; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-tagadd input { flex:1 1 8em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-tagadd .fh-btn { flex:none; width:auto; }\r
\r
/* ── Home: 일반 설정 grid. Switch cells pair up in two columns; cells with a picker or choice\r
   buttons take a full line so their control stays beside its name. ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-grid { display:grid; grid-template-columns:minmax(0,1fr); grid-auto-flow:dense; gap:0 12px; padding:2px 0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell { display:flex; flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 10px; min-height:var(--bl-fh-row); padding:7px var(--bl-fh-pad); border:0; border-top:1px solid var(--line); background:transparent; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell:first-child { border-top:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell:has(> .fh-cv > .fh-sw:only-child) { flex-wrap:nowrap; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-ck { flex:0 1 auto; display:flex; align-items:baseline; gap:6px; min-width:0; letter-spacing:inherit; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cv { flex:1 1 auto; min-width:0; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cv:empty { display:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cv > .fh-seg { flex:1 1 8em; }\r
/* Four or more choices take a full line of their own instead of wrapping beside the name. */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-row,.fh-v,.fh-cv) > .fh-seg:has(> :nth-child(4)) { flex:1 0 100%; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell > .fh-hint { flex:1 0 100%; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell > .fh-dim { margin-left:auto; text-align:right; }\r
\r
/* ── QR, entries, sheets ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-copy { flex:1; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-copy small { display:block; margin-top:3px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-head { flex-wrap:wrap; gap:4px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-head > strong { flex:1 1 10em; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-head > .fh-tag { font-size:.8em; min-height:0; padding:3px 6px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-card > p { margin:0; padding:8px var(--bl-fh-pad) 0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-card > p:empty { display:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-btn):is(.fh-qr-acts .fh-btn,.fh-qr-acts.dense .fh-btn) { font-size:1em; padding:7px 10px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-form { margin:0 var(--bl-fh-pad) 10px; padding:0; gap:8px 10px; border:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sec-head { min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-entry { min-width:0; gap:8px; padding:10px var(--bl-fh-pad); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 8px; padding:10px var(--bl-fh-pad); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item-name { font-size:.93em; grid-column:1; white-space:normal; overflow:visible; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item-meta { grid-column:1; font-size:.85em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-tick { grid-column:2; grid-row:1 / span 2; width:20px; height:20px; border:2px solid var(--line); border-radius:6px; background:var(--card2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item.on { background:var(--acc-soft); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item.on .fh-tick { border-color:var(--acc); background:var(--acc); color:var(--on-acc); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-item.on .fh-item-name { color:var(--ink); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet { padding:12px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-bg { background:var(--bl-fh-scrim); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-box { width:min(24em,100%); max-height:75%; border-radius:var(--r); box-shadow:var(--bl-fh-sheet-shadow); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-head { font-size:.85em; letter-spacing:normal; padding:10px 12px; border:0; color:var(--ink2); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-item { grid-template-columns:minmax(0,1fr) auto; min-height:var(--bl-fh-row); padding:9px 12px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-item span { white-space:normal; overflow:visible; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-item em { font-size:.85em; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sheet-cancel { border:0; padding:12px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-dot):is(.fh-dot,.fh-tile,.fh-qr-ico),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-tile):is(.fh-dot,.fh-tile,.fh-qr-ico),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-ico):is(.fh-dot,.fh-tile,.fh-qr-ico) { box-shadow:none; background:var(--acc); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-tile):is(.fh-tile,.fh-qr-ico),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-ico):is(.fh-tile,.fh-qr-ico) { color:var(--on-acc); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(button):is(button,input,select,textarea,summary):focus-visible,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(input):is(button,input,select,textarea,summary):focus-visible,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(select):is(button,input,select,textarea,summary):focus-visible,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(textarea):is(button,input,select,textarea,summary):focus-visible,
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(summary):is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--acc); outline-offset:2px; }\r
\r
/* ── Sortable lists: only the ⠿ handle starts a drag, so the list scrolls like the rest ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortlist { display:flex; flex-direction:column; gap:6px; touch-action:pan-y; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow { display:flex; align-items:center; gap:8px; min-height:var(--bl-fh-row); margin:0; padding:6px 8px 6px 6px; border-radius:var(--r2); touch-action:pan-y; cursor:default; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow .fh-grip { display:inline-grid; place-items:center; width:32px; height:32px; min-width:32px; margin:0; font-size:1.1em; letter-spacing:0; color:var(--ink2); touch-action:none; cursor:grab; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow.moving { outline:2px solid var(--acc); outline-offset:-2px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow.moving .fh-grip { cursor:grabbing; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow b { flex:1 1 auto; min-width:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sortrow .fh-sw { margin-left:auto; }\r
\r
/* ── Bottom tabs: icon and name side by side on one line ── */\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-bottom-nav {\r
  grid-area:nav; display:grid; grid-template-columns:repeat(2,minmax(0,1fr));\r
  padding:6px 10px 8px; gap:6px; border:0; backdrop-filter:none; -webkit-backdrop-filter:none;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item {\r
  display:flex; flex-direction:row; align-items:center; justify-content:center; gap:.4em;\r
  min-width:0; min-height:38px; margin:0; padding:6px 4px;\r
  font-size:1em; font-weight:inherit; line-height:1.45; letter-spacing:inherit;\r
  border:0; border-radius:var(--r2); text-align:center; color:var(--ink2); background:var(--fill);\r
  white-space:nowrap; word-break:keep-all;\r
}\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item b { display:inline-flex; align-items:center; justify-content:center; flex:none; width:auto; font-size:1.05em; line-height:1; margin:0; color:inherit; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item span { display:inline; word-break:keep-all; overflow-wrap:normal; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item.on { color:var(--bl-fh-acc-ink); background:var(--acc-soft); font-weight:600; }\r
\r
@container bl-fruit-settings (min-width:18em) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-chips):is(.fh-chips,.fh-qr-acts,.fh-card-actions),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-qr-acts):is(.fh-chips,.fh-qr-acts,.fh-card-actions),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :where(.fh-card-actions):is(.fh-chips,.fh-qr-acts,.fh-card-actions) { grid-template-columns:repeat(2,minmax(0,1fr)); }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-pad:has(> .fh-btn) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-pad:has(> .fh-btn) > .fh-btn { width:100%; margin:0; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-bottom-nav { grid-template-columns:repeat(4,minmax(0,1fr)); }\r
}\r
@container bl-fruit-settings (min-width:20em) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-grid > :where(.wide):is(.wide,.fh-cell:has(.fh-seg),.fh-cell:has(.fh-sel),.fh-cell:has(.fh-hint),.fh-cell:has(.fh-dim)),
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-grid > :where(.fh-cell):is(.wide,.fh-cell:has(.fh-seg),.fh-cell:has(.fh-sel),.fh-cell:has(.fh-hint),.fh-cell:has(.fh-dim)) { grid-column:1 / -1; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-cell:nth-child(2):not(.wide,:has(.fh-seg),:has(.fh-sel),:has(.fh-hint),:has(.fh-dim)) { border-top:0; }\r
}\r
@container bl-fruit-settings (min-width:40em) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; align-items:start; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-list > .fh-qr-card { margin:0; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-qr-list > .fh-btn { grid-column:1 / -1; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item { gap:.5em; }\r
}\r
@container bl-fruit-settings (max-width:20em) {\r
  /* Narrow window or large text: every choice group takes its own full line under its name. */\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-row,.fh-v,.fh-cv) > .fh-seg { flex:1 0 100%; }\r
}\r
@container bl-fruit-settings (max-width:15em) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-nav-item b { display:none; }\r
}\r
@media(max-width:380px) {\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-header { gap:6px; padding:10px; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-brand-mark { width:1.2em; height:1.2em; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-main { padding-left:8px; padding-right:8px; }\r
  :where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-bottom-nav { padding:6px; }\r
}\r
\r
/* ── Owned controls: help, note folding, home order reset, quick-reply name, fonts, skin ── */\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button {\r
  display:inline-flex; align-items:center; justify-content:center; vertical-align:middle; flex:none;\r
  width:max(24px,1em); height:max(24px,1em); min-width:24px; min-height:24px;\r
  margin:0 0 0 5px; padding:0; border:0; border-radius:6px; background:transparent;\r
  color:var(--ink2); font-size:inherit; font-weight:inherit; line-height:1;\r
}\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-button > svg { display:block; width:1em; height:1em; flex:none; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel {\r
  min-width:0; margin:0 0 10px; padding:10px 12px; border:1px solid var(--line);\r
  border-radius:var(--r); background:var(--card); color:var(--ink); overflow-wrap:anywhere;\r
}\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-head h3 { margin:0; min-width:0; font-size:1em; line-height:1.5; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel p { margin:6px 0; font-size:1em; line-height:1.6; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details { margin-top:8px; border-top:1px solid var(--line); }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel summary { min-height:36px; padding:8px 0; cursor:pointer; line-height:1.5; list-style:disclosure-closed inside; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-panel details[open] > summary { list-style-type:disclosure-open; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item { padding:8px 0; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item h4 { margin:0; font-size:1em; line-height:1.5; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-item small { display:block; margin:2px 0 4px; color:var(--ink2); font-size:.85em; line-height:1.5; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources { display:flex; flex-wrap:wrap; gap:6px 12px; padding-top:8px; border-top:1px solid var(--line); }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources > span { flex-basis:100%; color:var(--ink2); font-size:.85em; }\r
#fruit-heart-v6#fruit-heart-v6 .bl-fruit-help-sources a { color:var(--bl-fh-acc-ink); text-decoration:underline; text-underline-offset:3px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) [data-bl-fruit-reading-hidden="1"] { display:none !important; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-reading-tools { display:flex; justify-content:flex-end; padding:0; margin:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card-head:has(> .bl-fruit-reading-tools) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:3px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card-head:has(> .bl-fruit-reading-tools) > h3 { grid-column:1; grid-row:1; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card-head:has(> .bl-fruit-reading-tools) > p { grid-column:1 / -1; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-card-head > .bl-fruit-reading-tools { grid-column:2; grid-row:1; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect:has(> .bl-fruit-reading-tools) { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; column-gap:8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect > :where(.fh-sect > *):not(.bl-fruit-reading-tools):is(.bl-fruit-reading-tools ~ *, :has(~ .bl-fruit-reading-tools)) { grid-column:1; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .fh-sect > .bl-fruit-reading-tools { grid-column:2; grid-row:1 / span 2; align-self:end; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) :is(.fh-card,.fh-grp) > .bl-fruit-reading-tools { padding:6px var(--bl-fh-pad) 0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-reading-toggle { display:inline-flex; align-items:center; gap:6px; min-height:28px; padding:2px 6px; border:0; border-radius:6px; background:transparent; color:var(--ink2); font:inherit; font-size:.85em; line-height:1.4; cursor:pointer; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-reading-toggle::after { content:'⌄'; font-size:1em; transform:rotate(-90deg); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-reading-toggle[aria-expanded="true"]::after { transform:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-qr-name > .fh-v { flex:none; margin-left:0; justify-content:flex-start; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-qr-name input { flex:1 1 auto; width:100%; max-width:none; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-home-actions { padding-top:0; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-options { padding:6px 0 0; border-top:1px solid var(--line); }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-options > .fh-sheet-head { padding-bottom:6px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-search { display:block; width:calc(100% - 24px); margin:0 12px 8px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-choices > button { content-visibility:auto; contain-intrinsic-size:auto 44px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-empty { margin:0; padding:8px 12px 12px; }\r
:where(#fruit-heart-v6):is(html > body.salty #fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6) .bl-fruit-font-empty[hidden] { display:none; }\r
/* The renamed quick-reply entry stays one line; a long name is shortened, never wrapped. */\r
.bl-fruit-entry-name { display:inline-block; max-width:min(14em,60vw); vertical-align:bottom; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }`)}export{Rt as default};
