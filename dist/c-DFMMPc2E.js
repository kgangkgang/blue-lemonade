import{o as et,P as tt,p as z}from"./c-B3POQUVk.js";import{q as at,c as lt,d as st,s as rt,P as nt}from"./c-CJ69qCzV.js";import{aL as B,b6 as it,b7 as ot,b4 as ct,aX as de,aW as dt}from"./index.js";import{pane as ut}from"./c-Vmk6rBBh.js";import{callGenericPopup as Q,POPUP_TYPE as Z,POPUP_RESULT as ue}from"../../../../popup.js";import{T as O,V as pt,s as T,a as $,t as pe,r as me,j as mt,k as bt,n as be,d as ee,m as v,o as te,f as ft,q as gt,u as vt,e as fe,v as ht,w as D,c as ge}from"./c-DsHGvJKs.js";import{onBudget as ve,config as ae,refresh as U,rememberKeyHost as he,onAmountChanged as $e,testConnection as $t,isConfigured as H,resetBaseline as yt,summary as ye,inheritedHostChanged as kt,todayKey as ke,spendBetween as we,monthStartKey as Te,refreshWaitMs as wt,limitedUntil as Tt,canRefreshNow as St,loadDaily as xt,budgetState as Lt,quotaToMoney as _t}from"./c-BAwGHCuR.js";import{c as Et}from"./c-Cdw2X3ZK.js";import{main_api as F}from"../../../../../script.js";import{textgenerationwebui_settings as Mt,getTextGenModel as Pt,getTextGenServer as At}from"../../../../textgen-settings.js";import{nai_settings as Ct}from"../../../../nai-settings.js";import{getChatCompletionModel as Dt,oai_settings as Ft}from"../../../../openai.js";import{c as qt,P as Rt,a as It,q as Nt,m as jt}from"./c-Cv7L2rmQ.js";import{priceSnapshot as Bt}from"./c-T_ySoVm-.js";import{syncPriceSync as Ot,refreshPrices as Se,pricingSyncStatus as xe}from"./c-CykBq5GG.js";const W=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Le=e=>`₩${Math.round(Number(e)||0).toLocaleString("ko-KR")}`;function Ut(){return`
        <div class="rl-price-head rl-ledger-head"><b>사용량 장부</b><small>확장 · 기능마다 오늘 얼마 썼나 (이 기기에만 90일)</small></div>
        <label class="checkbox_label rl-check" for="rl_ledger_enabled"><input type="checkbox" id="rl_ledger_enabled"><span>사용량 장부 적기</span></label>
        <div class="rl-row rl-numbers">
            <label><span>환율</span><input type="number" class="text_pole rl-ledger-krw" min="1" step="0.1" inputmode="decimal"><span>원 / $</span></label>
            <small class="rl-hint rl-ledger-krw-date"></small>
        </div>
        <div class="rl-ledger-pay"></div>
        <small class="rl-hint rl-ledger-today"></small>
        <details class="rl-budget-adv rl-compare"></details>
        <small class="rl-hint">공식 API 는 공식 공개 단가, 중계는 중계 장부의 실제 과금(못 맞추면 중계 단가표 「≈」)으로 따로 셈해요. 결제 수단(크레딧 · 실제 결제 · 중계)은 다른 확장이 영수증 도장으로 써요. 키는 장부에 남지 않아요.</small>`}async function Ht(e){const t=await at({from:Date.now()-2592e6}).catch(s=>(console.warn("[Blue Lemonade] 사용 장부 읽기 실패",s),null));if(!t){e.innerHTML='<small class="rl-hint">장부를 읽지 못했어요. 창을 닫았다 다시 열어 주세요.</small>';return}const a=new Map;for(const s of t){const l=lt(s);if(a.has(l))continue;const r=s.cost?.kind==="relay"?`중계 · ${s.cost.relay}`:s.cost?.kind==="official"?`${s.cost.provider} 공식`:l.replace(/^other:/,"");a.set(l,{key:l,label:r,method:st(s)})}if(!a.size){e.innerHTML='<small class="rl-hint">아직 적힌 요청이 없어요. 요청이 적히면 연결마다 결제 수단을 고를 수 있어요.</small>';return}e.innerHTML=[...a.values()].map(s=>`<label class="rl-row rl-ledger-pay-row" data-pay-key="${W(s.key)}"><span>${W(s.label)}</span><select class="text_pole rl-ledger-pay-select">${dt.map(l=>`<option value="${W(l)}"${l===s.method?" selected":""}>${W(l)}</option>`).join("")}</select></label>`).join("")}async function Wt(e){const t=await rt({}).catch(()=>null);if(!t){e.textContent="";return}const a=t.lines.slice(0,3).map(s=>`${s.label}${s.approx?" ≈":""} ${Le(s.krw)}`).join(" · ");e.textContent=`오늘 ${Le(t.total.krw)} · 요청 ${t.requests}번${t.replies?` · 답 ${t.replies}개`:""}${a?` — ${a}`:""}`}function Kt(e){const t=i=>e.querySelector(i),a=B();t("#rl_ledger_enabled").checked=a.enabled!==!1,t(".rl-ledger-krw").value=a.krw.rate;const s=()=>{const i=B().krw;t(".rl-ledger-krw-date").textContent=`${i.date} 기준${i.source?` · ${i.source}`:""} (처음 값 ${de.rate}원 · ${de.date})`};s(),t("#rl_ledger_enabled").addEventListener("change",i=>{B().enabled=i.target.checked,globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced?.()}),t(".rl-ledger-krw").addEventListener("change",i=>{it(i.target.value)||(i.target.value=B().krw.rate),s()}),t(".rl-ledger-pay").addEventListener("change",i=>{const d=i.target.closest("[data-pay-key]");d&&ot(d.dataset.payKey,i.target.value)});const l=t(".rl-compare");l&&(l.innerHTML="<summary>중계 · 공식 가격 비교</summary>",l.addEventListener("toggle",()=>{!l.open||l.dataset.ready||(l.dataset.ready="1",import("./c-DVfoy3rS.js").then(i=>{l.innerHTML=i.compareMarkup(),l.open=!0,i.bindCompare(l)}).catch(i=>{l.dataset.ready="",console.warn("[요청 로그] 가격 비교",i)}))}));const r=()=>{Ht(t(".rl-ledger-pay")).catch(()=>{}),Wt(t(".rl-ledger-today")).catch(()=>{})};r();let n=0;ct("change",()=>{e.isConnected&&(clearTimeout(n),n=setTimeout(r,1500))})}const m=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),q=e=>Number(e).toLocaleString("en-US",{maximumFractionDigits:8}),_e=e=>e?new Date(e).toLocaleDateString("ko-KR"):"";function Ee(e){const t=Date.now()-Date.parse(e.checked)>2592e5,a=e.priceStatus;return a==="review"?"요금 조건 변경 · 이전 확인 가격":a==="error"?"공식 조회 실패 · 이전 확인 가격":t?"갱신 지연 · 이전 확인 가격":a==="ok"?"자동 확인 가격":"설치본 가격"}function Me(e,t="이 요청의 가격 기준"){if(!e)return'<p class="rl-dim">예전 기록에는 연결처·단가가 저장되지 않았어요. 당시 사용자 가격표로 계산한 비용이에요.</p>';const a={input:"일반 입력",output:"출력",cacheRead:"캐시 읽기",cacheWrite:"캐시 저장",cacheWrite5m:"캐시 저장 · 5분",cacheWrite1h:"캐시 저장 · 1시간"},s=e.currency==="USD"?"US$":e.currency,l=Object.entries(a).filter(([d])=>e.rates?.[d]!=null).map(([d,b])=>`<div><dt>${b}</dt><dd>${m(s)}${q(e.rates[d])}</dd></div>`).join(""),r=Rt[e.provider],n={official:e.minimum?"공식 목록 시작 단가":"공식 공개 단가",reported:"API 응답 비용",relay:"중계 서버 자동 가격",manual:"사용자 가격표",plan:"구독·크레딧 요금",local:"직접 운영",deployment:"배포·계약별 요금",free:"무료 경로"}[e.kind]||"단가 미확인",i=e.alternatives?`<p class="rl-pricing-note">시간대별 단가 (100만 토큰): ${Object.entries(e.alternatives.rates).map(([d,b])=>`${d==="peak"?"혼잡":"그 외"} 입력 ${m(s)}${q(b.input)} · 출력 ${m(s)}${q(b.output)} · 캐시 ${m(s)}${q(b.cacheRead)}`).join(" / ")}</p>`:"";return`<section class="rl-pricing-card" aria-label="${m(t)}">
        <div class="rl-pricing-head"><b>${m(t)}</b><span>${m(n)}</span></div>
        <p class="rl-pricing-model">${m(e.label)} · <strong>${m(e.model||"모델 미선택")}</strong></p>
        ${l?`<dl class="rl-pricing-rates">${l}</dl><p class="rl-pricing-unit">100만 토큰당 ${m(e.currency)}${e.tier?` · ${m(e.tier.split(" · ").map(d=>({standard:"기본 요금",priority:"우선 처리",fast:"Fast",flex:"Flex",batch:"일괄 처리",ultrafast:"Ultrafast"})[d]||d).join(" · "))}`:""}</p>`:""}
        ${i}<p class="rl-pricing-note">${m(e.note)}</p>
        ${r?`<p class="rl-pricing-source"><a href="${r}" target="_blank" rel="noopener noreferrer">공식 요금표 보기 ↗</a><span>${e.checked?m(_e(e.checked))+" 확인 · "+(t==="기본 단가 상세"?Ee(e):"요청 당시 가격 보존"):"공식 요금은 제공처에서 확인하세요"}</span></p>`:""}
    </section>`}function Vt(e,t,a="$"){if(e.costs||={},!t.priced)return;const s=t.currency||(a==="$"?"USD":a);e.costs[s]=(e.costs[s]||0)+(Number(t.cost)||0)}function Gt(e){const t=e.currency==="USD"?"US$":e.currency,a=e.rates?[["input","입력"],["output","출력"],["cacheRead","캐시 읽기"]].filter(([s])=>e.rates[s]!=null).map(([s,l])=>`${l} ${m(t)}${q(e.rates[s])}`).join(" · "):{plan:"구독·크레딧 요금",local:"직접 운영 서버",deployment:"배포·계약별 요금"}[e.kind]||"단가 미확인";return`<details class="rl-pricing-preview"><summary>
        <b>현재 연결의 모델 단가</b><span>${m(e.label)} · ${m(e.model||"모델 미선택")}</span>
        <span>${a}${e.rates?" / 100만 토큰":""}</span><span class="rl-pricing-more">${e.rates?Ee(e)+" · ":""}캐시·출처 보기</span>
        </summary>${Me(e,"기본 단가 상세")}<p class="rl-dim">확장 전용 API·긴 문맥·처리 등급은 각 요청을 눌러 확인하세요.</p></details>`}function Pe(){return`<details class="rl-provider-coverage"><summary>연결 가능한 API의 요금 안내</summary><p class="rl-dim">실제 연결처의 공식 자료를 하루 한 번 확인해요. 단위·조건·모델 목록이 달라지면 이전 가격을 보존해요. 새 모델·계약·플랜을 확인할 수 없는 요청은 비용 미확인으로 남아요.</p><ul>${Object.entries(nt).map(([t,a])=>{const s=["anthropic","openai"].includes(t)||qt(t)>0,l=a.billing==="plan"?"플랜 안내":a.billing==="deployment"?"배포별 확인":a.billing==="local"?"운영 비용 별도":a.billing==="free"?"무료 경로":s?"모델 단가":"공식 요금 확인",r=Bt(t),n=r?(r.status==="review"?"조건 확인 필요":r.status==="error"?"조회 실패":r.status==="ok"?"자동 확인":"설치본")+" · "+_e(r.checkedAt):l;return`<li><span>${m(a.label)}</span><small>${n}</small></li>`}).join("")}</ul><p class="rl-dim">Vertex·Cohere·AI21의 복잡한 표는 원문이 달라지면 검토 후 갱신해요. 구독·개별 계약은 토큰 단가로 환산하지 않아요. 이미 저장한 요청 비용은 바뀌지 않아요.</p></details>`}function Ae(){if(T().priceAutoRefresh===!1)return"자동 갱신 꺼짐 · 저장된 가격 사용";const e=xe();return{loading:"공식 가격 확인 중…",ready:"하루 한 번 자동 확인",cached:"저장된 확인 가격 사용",offline:"연결하지 못했어요 · 마지막 확인 가격 유지",stale:"가격표 갱신 지연 · 마지막 확인 가격 유지",bundled:"설치본 가격 사용 · 자동 확인 대기"}[e.state]+(e.memoryOnly?" · 이 창에서만 보관":"")}function Ce(e){const t=e.querySelector(".rl-price-sync-status");t&&(t.textContent=Ae());const a=e.querySelector('[data-act="refresh-pricing"]');a&&(a.disabled=xe().state==="loading");const s=e.querySelector(".rl-provider-coverage");if(s){const l=s.open;s.outerHTML=Pe(),e.querySelector(".rl-provider-coverage").open=l}}function De(){let e="",t={},a="/api/backends/chat-completions/generate";if(F==="openai")e=Dt(),t=Ft;else if(F==="textgenerationwebui"){const n=Mt;e=n.type==="ollama"&&!n.ollama_model?"":Pt(),t={api_type:n.type,api_server:At()},a="/api/backends/text-completions/generate"}else F==="novel"?(e=Ct.model_novel,a="/api/novelai/generate"):F==="koboldhorde"?a="/api/horde/generate-text":F==="kobold"&&(t={api_server:document.querySelector("#api_url_text")?.value},a="/api/backends/kobold/generate");const s=It(a,t,location.origin),l=ft(e),r=Nt({connection:s,model:e,manualPrice:jt(l,s),manualUnit:T().unit});return Gt(r)}function K(e){const t=e.querySelector(".rl-current-pricing");if(!t)return;const a=t.querySelector("details")?.open;t.innerHTML=De(),t.querySelector("details").open=!!a,Ce(e)}document.addEventListener("bl-prices-updated",()=>document.querySelectorAll(".rl-root").forEach(K));function Fe(e){const t=e.pricing?.currency==="USD"?"US$":e.pricing?.currency||T().unit;return o(v(e.cost,{unit:t}))}const V=100,qe=500,Re=5e3,Ie=(e,t,a,s=1/0)=>{const l=Number.parseInt(e,10);return Number.isFinite(l)?Math.min(s,Math.max(a,l)):t};function o(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function y(e,t,a={}){typeof toastr<"u"&&toastr[e](t,O,{timeOut:e==="success"?1800:3e3,...a})}const u=e=>(Number(e)||0).toLocaleString("ko-KR");function _(e){return e==null?"":e>=1e4?`${Math.round(e/1e3)}s`:`${(e/1e3).toFixed(1)}s`}const R=e=>String(e).padStart(2,"0");function Ne(e){const t=new Date(e);return`${R(t.getHours())}:${R(t.getMinutes())}:${R(t.getSeconds())}`}function le(e){const t=new Date(e);return`${t.getFullYear()}.${R(t.getMonth()+1)}.${R(t.getDate())} ${Ne(e)}`}function je(e){return e.aborted?{className:"is-aborted",icon:"fa-ban",label:"중단"}:e.ok?{className:"is-ok",icon:"fa-check",label:"성공"}:{className:"is-error",icon:"fa-triangle-exclamation",label:"오류"}}function Be(e){const t=e.caller==="chat"?ht(e.type):"";return`${D(e.caller)} · ${e.label||z(e.purpose)}${t?` · ${t}`:""}`}let g=null;function Xt(){const e=ut("log");if(!e||g)return;g=document.createElement("div"),g.id="request_log_settings",g.className="rl-settings",g.innerHTML=`
        <div class="inline-drawer">
<div class="inline-drawer-toggle inline-drawer-header">
<b><i class="fa-solid fa-receipt"></i> ${O} <span class="rl-version ext-version">v${pt}</span></b>
<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
</div>
<div class="inline-drawer-content">
<div class="rl-body">
<small class="rl-hint">실리태번과 확장이 보내는 API 요청을 이 기기에 기록해요. 마법봉 메뉴의 ${O}에서 봐요.</small>
<div class="rl-row">
<label class="checkbox_label rl-check" for="rl_enabled"><input type="checkbox" id="rl_enabled"><span>기록하기</span></label>
<div class="menu_button menu_button_icon rl-open"><i class="fa-solid fa-receipt"></i><span>열기</span></div>
</div>
<div class="rl-row rl-numbers">
<label><span>본문 보관</span><input type="number" class="text_pole rl-keep" min="0" step="1"><span>개</span></label>
<label><span>기록 보관</span><input type="number" class="text_pole rl-max" min="20" step="10"><span>개</span></label>
</div>
<small class="rl-hint rl-keep-warn" hidden></small>
<small class="rl-hint">본문 보관 수를 넘긴 요청은 프롬프트·응답 글은 지워지고 토큰 수만 남아요. 날짜별 집계는 지워지지 않아요.</small>
<div class="rl-price-head">
<b>직접 지정 가격표</b><small>공식 API 외 연결용 · 100만 토큰당</small>
<label class="rl-unit"><span>단위</span><input type="text" class="text_pole rl-unit-input" maxlength="4"></label>
</div>
<div class="rl-price-list"></div>
<div class="rl-row rl-price-add">
<input type="text" class="text_pole rl-price-model" placeholder="모델 이름" autocomplete="off">
<input type="number" class="text_pole rl-price-in" placeholder="입력" min="0" step="0.01" inputmode="decimal">
<input type="number" class="text_pole rl-price-out" placeholder="출력" min="0" step="0.01" inputmode="decimal">
<div class="menu_button menu_button_icon rl-price-save"><i class="fa-solid fa-plus"></i></div>
</div>
<small class="rl-hint">연결한 제공처의 확인된 공식 단가를 자동 적용해요. 정액제·직접 운영 서버는 과금 방식을 안내해요. 이 표는 공식 단가를 확인하지 못한 연결에 써요. "자동"은 중계 서버에서 받은 가격으로, 같은 서버에만 적용해요. 새 로그는 요청 당시 단가를 보존하고, 예전 집계만 수정한 가격으로 다시 계산해요.</small>
<div class="rl-price-head rl-budget-head">
<b>예산</b><small>중계 서버(new-api 계열)의 실제 과금·잔액</small>
</div>
<label class="checkbox_label rl-check" for="rl_budget_enabled"><input type="checkbox" id="rl_budget_enabled"><span>중계 서버에서 사용량 가져오기</span></label>
<div class="rl-budget-fields">
<label><span>서버 주소</span><input type="text" class="text_pole rl-b-url" placeholder="비우면 사용자 지정 API 주소의 서버" autocomplete="off"></label>
<label><span>API 키</span><input type="password" class="text_pole rl-b-key" placeholder="sk-…" autocomplete="off"></label>
<div class="rl-budget-nums">
<label><span>예산</span><input type="number" class="text_pole rl-b-amount" min="0" step="0.01" inputmode="decimal"></label>
<label><span>경고</span><input type="number" class="text_pole rl-b-warn" min="1" max="100" step="1"><span>% 쓰면</span></label>
<label><span>하루 한도</span><input type="number" class="text_pole rl-b-daily" min="0" step="0.01" inputmode="decimal"></label>
</div>
<details class="rl-budget-adv">
<summary>계정 토큰 (선택)</summary>
<label><span>액세스 토큰</span><input type="password" class="text_pole rl-b-access" autocomplete="off"></label>
<label><span>사용자 ID</span><input type="text" class="text_pole rl-b-user" inputmode="numeric" autocomplete="off"></label>
<small class="rl-hint">콘솔 → 개인 설정 → 시스템 액세스 토큰. 넣으면 계정의 실제 잔액을 그대로 보여 줘요.</small>
</details>
</div>
<div class="rl-row">
<div class="menu_button menu_button_icon rl-b-test"><i class="fa-solid fa-plug"></i><span>연결 확인</span></div>
<div class="menu_button menu_button_icon rl-b-reset"><i class="fa-solid fa-flag"></i><span>지금부터 다시 세기</span></div>
</div>
<small class="rl-hint rl-b-warning" hidden></small>
<small class="rl-hint">예산에는 충전한 금액을 적어요. 기준 시점 이후 쓴 금액을 예산에서 빼서 잔액을 계산하고, 경고 비율이나 하루 한도를 넘으면 한 번 알려요. 키는 settings.json에 저장돼요.</small>
                    ${Ut()}
                    <div class="rl-row rl-danger-row">
<div class="menu_button menu_button_icon rl-clear"><i class="fa-solid fa-broom"></i><span>기록 비우기</span></div>
</div>
</div>
</div>
</div>`,e.append(g);try{Kt(g)}catch(l){console.warn("[요청 로그] 사용량 장부 설정",l)}const t=l=>g.querySelector(l),a=T();t("#rl_enabled").checked=a.enabled,t(".rl-keep").value=a.keepBodies,t(".rl-max").value=a.maxEntries;const s=()=>{const l=[a.keepBodies>qe?`본문 ${qe}개`:"",a.maxEntries>Re?`기록 ${Re.toLocaleString("ko-KR")}개`:""].filter(Boolean),r=t(".rl-keep-warn");r.hidden=!l.length,r.textContent=l.length?`${l.join(" · ")}를 넘겨 남기면 이 기기 저장 공간을 그만큼 더 써요(막지는 않아요).`:""};s(),t(".rl-unit-input").value=a.unit,t("#rl_enabled").addEventListener("change",l=>{a.enabled=l.target.checked,$()}),t(".rl-keep").addEventListener("change",l=>{a.keepBodies=Ie(l.target.value,a.keepBodies,0),l.target.value=a.keepBodies,s(),$(),pe().catch(()=>{})}),t(".rl-max").addEventListener("change",l=>{a.maxEntries=Ie(l.target.value,a.maxEntries,20),l.target.value=a.maxEntries,s(),$(),pe().catch(()=>{})}),t(".rl-unit-input").addEventListener("change",l=>{a.unit=l.target.value.trim().slice(0,4)||"$",l.target.value=a.unit,$()}),t(".rl-open").addEventListener("click",()=>Ue()),g.addEventListener("click",l=>{const r=l.target.closest?.(".rl-hint");r&&!l.target.closest("a,button,input")&&r.classList.toggle("is-open")}),t(".rl-price-save").addEventListener("click",Oe);for(const l of[".rl-price-model",".rl-price-in",".rl-price-out"])t(l).addEventListener("keydown",r=>{r.key==="Enter"&&!r.isComposing&&(r.preventDefault(),Oe())});t(".rl-price-list").addEventListener("click",async l=>{const r=l.target.closest("[data-act]");if(!r)return;const i=r.closest("[data-model]")?.dataset.model;i&&(r.dataset.act==="delete"?(delete a.prices[i],$(),X(),await me(ge)):r.dataset.act==="edit"&&(t(".rl-price-model").value=i,t(".rl-price-in").value=a.prices[i].input,t(".rl-price-out").value=a.prices[i].output,t(".rl-price-in").focus()))}),t(".rl-clear").addEventListener("click",async()=>{await Q("요청 기록과 날짜별 집계를 모두 지울까요? 되돌릴 수 없어요.",Z.CONFIRM,"",{okButton:"비우기",cancelButton:"취소"})===ue.AFFIRMATIVE&&(await mt(),await bt(),y("success","기록을 비웠어요."),h&&h.reload())}),X(),Yt()}function G(){const e=g?.querySelector(".rl-b-warning");if(!e)return;const t=kt();e.hidden=!t,t&&(e.textContent=ae().keyHost?"본체의 API 주소가 키를 넣을 때와 달라졌어요. 다른 서버로 키가 가지 않게 조회를 멈췄어요. 같은 서버가 맞으면 API 키 칸을 한 번 저장하고, 아니면 서버 주소를 직접 적어 주세요.":"이 키를 어느 서버에서 받았는지 적혀 있지 않아, 다른 서버로 키가 가지 않게 조회를 멈췄어요. 키를 받은 중계 서버 주소를 서버 주소 칸에 직접 적어 주세요.")}function Yt(){const e=s=>g.querySelector(s),t=ae();e("#rl_budget_enabled").checked=t.enabled,e(".rl-b-url").value=t.baseUrl,e(".rl-b-key").value=t.key,e(".rl-b-amount").value=t.amount||"",e(".rl-b-warn").value=t.warnPercent,e(".rl-b-daily").value=t.dailyLimit||"",e(".rl-b-access").value=t.accessToken,e(".rl-b-user").value=t.userId,g.querySelector(".rl-budget-fields").hidden=!t.enabled,ve(()=>{X(),G()}),G();const a=(s,l=0)=>{const r=Number(s);return Number.isFinite(r)&&r>=0?r:l};e("#rl_budget_enabled").addEventListener("change",s=>{t.enabled=s.target.checked,g.querySelector(".rl-budget-fields").hidden=!t.enabled,$(),t.enabled&&U().catch(()=>{})}),e(".rl-b-url").addEventListener("change",s=>{t.baseUrl=s.target.value.trim().replace(/\/+$/,""),s.target.value=t.baseUrl,he(),G()}),e(".rl-b-key").addEventListener("change",s=>{const l=s.target.value.trim();l!==t.key&&(t.baselineUsed=null,t.baselineAt=null,t.alerted=null),t.key=l,he(),G()}),e(".rl-b-amount").addEventListener("change",s=>{t.amount=a(s.target.value),s.target.value=t.amount||"",$e()}),e(".rl-b-warn").addEventListener("change",s=>{t.warnPercent=Math.min(100,Math.max(1,Number.parseInt(s.target.value,10)||80)),s.target.value=t.warnPercent,$e()}),e(".rl-b-daily").addEventListener("change",s=>{t.dailyLimit=a(s.target.value),s.target.value=t.dailyLimit||"",t.dailyAlertedDay="",$()}),e(".rl-b-access").addEventListener("change",s=>{t.accessToken=s.target.value.trim(),$()}),e(".rl-b-user").addEventListener("change",s=>{t.userId=s.target.value.trim(),$()}),e(".rl-b-test").addEventListener("click",async s=>{const l=s.currentTarget;l.classList.add("disabled");try{const r=await $t();y("success",`연결됐어요. ${r}`,{timeOut:6e3}),U().catch(()=>{})}catch(r){y("error",`연결하지 못했어요: ${r.message}`,{timeOut:8e3})}finally{l.classList.remove("disabled")}}),e(".rl-b-reset").addEventListener("click",async()=>{if(!H())return y("warning","먼저 중계 서버 연동을 켜고 API 키를 넣어 주세요.");if(await Q("지금까지 쓴 금액을 0으로 보고 이 시점부터 다시 셀까요? 예산에는 지금 충전된 금액을 적어 두세요.",Z.CONFIRM,"",{okButton:"다시 세기",cancelButton:"취소"})===ue.AFFIRMATIVE)try{await yt(),y("success","지금부터 다시 세요.")}catch(l){y("error",`기준을 잡지 못했어요: ${l.message}`,{timeOut:8e3})}})}async function Oe(){const e=l=>g.querySelector(l),t=e(".rl-price-model").value.trim(),a=Number(e(".rl-price-in").value),s=Number(e(".rl-price-out").value);if(!t)return y("warning","모델 이름을 적어 주세요.");if(!Number.isFinite(a)||!Number.isFinite(s)||a<0||s<0)return y("warning","가격은 0 이상의 숫자로 적어 주세요.");T().prices[t]={input:a,output:s},$(),e(".rl-price-model").value="",e(".rl-price-in").value="",e(".rl-price-out").value="",X(),await me(ge),y("success",`${t} 가격을 저장했어요.`)}function X(){const e=g.querySelector(".rl-price-list"),t=T().prices,a=Object.keys(t).sort();if(!a.length){e.innerHTML='<small class="rl-hint rl-price-empty">직접 지정한 가격이 없어요. 공식 가격표에 있는 모델은 입력하지 않아도 연결처별 단가를 써요.</small>';return}e.innerHTML=a.map(s=>`
        <div class="rl-price-row" data-model="${o(s)}">
<span class="rl-price-name">${o(s)}${t[s].auto?'<small class="rl-price-auto">자동</small>':""}</span>
<span class="rl-price-nums">${o(t[s].input)} / ${o(t[s].output)}</span>
<button type="button" class="rl-icon-btn" data-act="edit" aria-label="고치기"><i class="fa-solid fa-pen"></i></button>
<button type="button" class="rl-icon-btn" data-act="delete" aria-label="지우기"><i class="fa-solid fa-xmark"></i></button>
</div>`).join("")}let h=null;function Jt(){const e=document.createElement("div");return e.className="rl-root",e.innerHTML=`
        <div class="rl-top">
<div class="rl-tabs" role="tablist">
<button type="button" class="rl-tab" data-tab="log" aria-pressed="true"><i class="fa-solid fa-list"></i><span>로그</span></button>
<button type="button" class="rl-tab" data-tab="stats" aria-pressed="false"><i class="fa-solid fa-chart-simple"></i><span>집계</span></button>
<button type="button" class="rl-tab" data-tab="budget" aria-pressed="false"><i class="fa-solid fa-wallet"></i><span>예산</span><span class="rl-tab-sub"></span></button>
</div>
<span class="rl-top-note">${be()?"이 창을 닫으면 사라져요 (저장소 없음)":"이 기기에만 남아요"}</span>
</div>
<section class="rl-view" data-view="log">
<div class="rl-current-pricing">${De()}</div>
<div class="rl-price-sync-controls">
<label><input type="checkbox" data-act="auto-pricing" ${T().priceAutoRefresh!==!1?"checked":""}> 가격 자동 갱신</label>
<button type="button" class="rl-chip rl-chip-icon" data-act="refresh-pricing" title="지금 확인" aria-label="지금 확인"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
<span class="rl-price-sync-status" role="status">${Ae()}</span>
</div>
            ${Pe()}
            <div class="rl-filters">
<select class="text_pole rl-filter-caller"><option value="">모두</option></select>
<select class="text_pole rl-filter-purpose" aria-label="사용 용도">${Ve([])}</select>
<select class="text_pole rl-filter-status">
<option value="">성공·오류</option>
<option value="ok">성공만</option>
<option value="error">오류만</option>
</select>
<span class="rl-filter-count"></span>
</div>
<div class="rl-list"></div>
<button type="button" class="rl-more" hidden>더 보기</button>
</section>
<section class="rl-view" data-view="detail" hidden></section>
<section class="rl-view" data-view="stats" hidden>
<div class="rl-ranges">
<button type="button" class="rl-chip" data-range="today" aria-pressed="true">오늘</button>
<button type="button" class="rl-chip" data-range="7" aria-pressed="false">7일</button>
<button type="button" class="rl-chip" data-range="30" aria-pressed="false">30일</button>
<button type="button" class="rl-chip" data-range="all" aria-pressed="false">전체</button>
</div>
<div class="rl-stats"></div>
</section>
<section class="rl-view" data-view="budget" hidden>
<div class="rl-budget"></div>
</section>`,e}async function Ue({tab:e="log"}={}){if(h)return;const t=Jt(),a={root:t,tab:e,entries:[],exhausted:!1,loading:!1,callerFilter:"",purposeFilter:"",statusFilter:"",range:"today",detailId:null,reload:()=>Ke(a)};h=a;const s=n=>t.querySelector(n);t.addEventListener("click",n=>oa(n,a)),t.querySelector('[data-act="auto-pricing"]').addEventListener("change",n=>{T().priceAutoRefresh=n.target.checked,$(),Ce(t),Ot(),n.target.checked&&Se()}),s(".rl-filter-caller").addEventListener("change",n=>{a.callerFilter=n.target.value,M(a)}),s(".rl-filter-purpose").addEventListener("change",n=>{a.purposeFilter=n.target.value,M(a)}),s(".rl-filter-status").addEventListener("change",n=>{a.statusFilter=n.target.value,M(a)});const l=et(n=>{if(h!==a)return;if(K(a.root),a.tab==="stats"){ie(a);return}if(a.tab!=="log")return;const i=a.entries.at(-1);(a.exhausted||!i||n.at>=i.at)&&(a.entries=te(a.entries,[n])),ne(a),re(a),a.detailId||M(a)}),r=ve(()=>{h===a&&(We(a),a.tab==="budget"&&se(a))});a.budgetRange="today",We(a),He(a,e);try{await Q(t,Z.TEXT,"",{okButton:"닫기",wide:!0,large:!0,allowVerticalScrolling:!0})}finally{l(),r(),h===a&&(h=null)}}function He(e,t){e.tab=t,e.detailId=null;for(const a of e.root.querySelectorAll(".rl-tab"))a.setAttribute("aria-pressed",String(a.dataset.tab===t));for(const a of e.root.querySelectorAll(".rl-view"))a.hidden=a.dataset.view!==t;t==="log"?Ke(e):t==="budget"?zt(e):ie(e)}async function zt(e){await xt().catch(()=>{}),h===e&&(se(e),H()&&U().catch(()=>{}))}function We(e){const t=e.root.querySelector('.rl-tab[data-tab="budget"] .rl-tab-sub');if(!t)return;const{remaining:a}=ye();t.textContent=H()&&a!==null?v(a):"",t.classList.toggle("is-low",a!==null&&a<=0)}const Qt={account:"계정 잔액",token:"키 한도",manual:"예산에서 계산"};function Zt(e){if(!e)return"";const t=Date.now()-e;return t<6e4?"방금":t<36e5?`${Math.floor(t/6e4)}분 전`:le(e)}function ea(e){if(e==="today")return ke();if(e==="month")return Te();if(e==="all")return"";const t=new Date;return t.setDate(t.getDate()-Number(e)),ee(t.getTime())}function se(e){const t=e.root.querySelector(".rl-budget");if(!t)return;const a=Lt(),s=ae();if(!H()){t.innerHTML=`
            <div class="rl-empty"><i class="fa-solid fa-wallet"></i><b>중계 서버 연동이 꺼져 있어요</b>
<p>확장 설정 → ${o(O)} → 예산에서 켜고 API 키를 넣어 주세요. new-api 계열 서버에서 실제 과금과 잔액을 가져와요.</p></div>`;return}const l=ye(),r=a.loading?'<i class="fa-solid fa-spinner fa-spin rl-dim"></i>':"",n=a.error?`<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${o(a.error)}</b></div></div>`:"",i=[];a.accountError&&i.push(`계정 잔액은 못 가져왔어요: ${o(a.accountError)}`),a.logsError&&i.push(`요청 내역은 못 가져왔어요: ${o(a.logsError)}`);let d;if(l.remaining!==null){const f=l.remaining<=0?"is-over":l.ratio!==null&&l.ratio*100>=s.warnPercent?"is-warn":"is-ok",k=l.ratio!==null?`<div class="rl-bar"><i style="width:${Math.round(l.ratio*100)}%"></i></div>`:"",x=l.total!==null?`${v(l.total)} 중 ${v(l.spent)} 사용${l.ratio!==null?` · ${Math.round(l.ratio*100)}%`:""}`:l.sinceBaseline!==null?`기준 시점 이후 ${v(l.sinceBaseline)} 사용`:"";d=`
            <div class="rl-balance ${f}">
<small>잔액 <span class="rl-dim">· ${Qt[l.source]??""}</span></small>
<b>${v(l.remaining)}</b>
                ${k}
                <span>${x}</span>
</div>`}else d=`
            <div class="rl-balance is-unknown">
<small>잔액</small>
<b>${l.sinceBaseline!==null?v(l.sinceBaseline):"—"}</b>
<span>${l.sinceBaseline!==null?"기준 시점 이후 쓴 금액이에요. 예산을 적으면 잔액이 나와요.":a.loading?"가져오는 중…":"아직 못 가져왔어요."}</span>
</div>`;const b=ke(),S=we(b,b),E=we(Te()),Y=`
        <div class="rl-tiles">
<div class="rl-tile"><small>오늘</small><b>${v(S.amount)}</b><span class="rl-dim">${u(S.requests)}건${s.dailyLimit?` · 한도 ${v(s.dailyLimit)}`:""}</span></div>
<div class="rl-tile"><small>이번 달</small><b>${v(E.amount)}</b><span class="rl-dim">${u(E.requests)}건</span></div>
<div class="rl-tile"><small>이 키 누적</small><b>${v(l.usedTotal)}</b><span class="rl-dim">${s.baselineAt?`기준 ${le(s.baselineAt)}`:""}</span></div>
</div>`,N=ea(e.budgetRange),j=a.daily.filter(f=>!N||f.day>=N),A=new Map,C=new Map;for(const f of j)for(const[k,x]of[[A,f.model],[C,f.day]]){const L=k.get(x)??{label:x,requests:0,quota:0,promptTokens:0,completionTokens:0};L.requests+=Number(f.requests)||0,L.quota+=Number(f.quota)||0,L.promptTokens+=Number(f.promptTokens)||0,L.completionTokens+=Number(f.completionTokens)||0,k.set(x,L)}const c=(f,k,x)=>{if(!k.length)return"";const L=[...k].sort((w,ce)=>x==="label"?String(ce.label).localeCompare(String(w.label)):ce.quota-w.quota);return`
            <div class="rl-table-wrap">
<div class="rl-section-head"><b>${o(f)}</b></div>
<table class="rl-table">
<thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>과금</th></tr></thead>
<tbody>${L.map(w=>`
                        <tr>
<td class="rl-td-label">${o(x==="label"?w.label.replace(/-/g,"."):w.label)}</td>
<td data-label="요청">${u(w.requests)}</td>
<td data-label="입력">${u(w.promptTokens)}</td>
<td data-label="출력">${u(w.completionTokens)}</td>
<td data-label="과금">${v(_t(w.quota))}</td>
</tr>`).join("")}
                    </tbody>
</table>
</div>`},Qe=[["today","오늘"],["7","7일"],["month","이번 달"],["30","30일"],["all","전체"]].map(([f,k])=>`<button type="button" class="rl-chip" data-brange="${f}" aria-pressed="${String(e.budgetRange===f)}">${k}</button>`).join(""),Ze=j.length?"":'<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-chart-bar"></i><b>이 기간의 과금 내역이 없어요</b><p></p></div>',J=wt(),oe=Tt()?`${Math.max(1,Math.ceil(J/6e4))}분 뒤 다시 가져와요`:J>0?`다음 조회까지 ${Math.max(1,Math.ceil(J/6e4))}분`:"";t.innerHTML=`
        <div class="rl-budget-top">
<span class="rl-dim">${a.updatedAt?`${Zt(a.updatedAt)} 기준`:""}${oe?` · ${oe}`:""} ${r}</span>
<button type="button" class="rl-icon-btn" data-act="budget-refresh" aria-label="새로 고침" ${St()?"":"disabled"}><i class="fa-solid fa-rotate"></i></button>
</div>
        ${n}
        ${d}
        ${Y}
        ${i.length?`<small class="rl-hint rl-budget-note">${i.join("<br>")}</small>`:""}
        <div class="rl-ranges">${Qe}</div>
        ${Ze}
        ${c("모델별",[...A.values()],"quota")}
        ${e.budgetRange==="today"?"":c("날짜별",[...C.values()],"label")}
        <small class="rl-hint rl-budget-note">과금은 중계 서버가 기록한 실제 금액이에요. 서버는 최근 1,000건만 주니, 하루에 그보다 많이 요청한 날은 일부가 빠질 수 있어요.</small>`}async function Ke(e){e.loading=!0;const t=new Set(e.entries.map(s=>s.id));try{const s=await fe({limit:V});e.entries=te(s,e.entries.filter(l=>!t.has(l.id))),e.exhausted=s.length<V}catch(s){console.warn("[요청 로그] 기록을 읽지 못했어요",s),e.entries=[],e.exhausted=!0}finally{e.loading=!1}if(h!==e)return;const a=e.root?.querySelector(".rl-top-note");a&&(a.textContent=be()?"이 창을 닫으면 사라져요 (저장소 없음)":"이 기기에만 남아요"),ne(e),re(e),M(e)}async function ta(e){if(e.loading||e.exhausted)return;e.loading=!0;const t=e.entries[e.entries.length-1];try{const a=new Set(e.entries.map(r=>r.id)),s=t?e.entries.filter(r=>r.at===t.at).length:0,l=(await fe({limit:V+s,before:t?t.at:null,inclusive:!0})).filter(r=>!a.has(r.id));e.entries=te(e.entries,l),e.exhausted=l.length<V}catch(a){console.warn("[Blue Lemonade] 요청 기록 더 읽기 실패",a),globalThis.toastr?.warning?.("요청 기록을 더 읽지 못했어요. 잠시 뒤 다시 눌러 주세요.","Blue Lemonade");return}finally{e.loading=!1}h===e&&(ne(e),re(e),M(e))}function Ve(e){return'<option value="">모든 용도</option>'+Object.entries(tt).map(([t,a])=>`<option value="${t}">${a}</option>`).join("")+(e.length?`<optgroup label="이름표">${e.map(t=>`<option value="${o("label:"+t)}">${o(t)}</option>`).join("")}</optgroup>`:"")}function re(e){const t=e.root.querySelector(".rl-filter-purpose"),a=[...new Set(e.entries.map(l=>l.label).filter(Boolean))].sort((l,r)=>l.localeCompare(r,"ko")),s=e.purposeFilter||"";t.innerHTML=Ve(a),t.value=s,t.value!==s&&(e.purposeFilter=t.value)}function ne(e){const t=e.root.querySelector(".rl-filter-caller"),a=[...new Set(e.entries.map(l=>l.caller||"unknown"))].sort((l,r)=>l==="chat"?-1:r==="chat"?1:D(l).localeCompare(D(r),"ko")),s=e.callerFilter;t.innerHTML='<option value="">모두</option>'+a.map(l=>`<option value="${o(l)}">${o(D(l))}</option>`).join(""),t.value=a.includes(s)?s:"",t.value!==s&&(e.callerFilter=t.value)}function aa(e){return e.entries.filter(t=>!(e.purposeFilter&&(e.purposeFilter.startsWith("label:")?(t.label||"")!==e.purposeFilter.slice(6):(t.purpose||"unknown")!==e.purposeFilter)||e.callerFilter&&(t.caller||"unknown")!==e.callerFilter||e.statusFilter==="ok"&&!t.ok||e.statusFilter==="error"&&t.ok))}function Ge(e){const t=e.estimated?'<i class="rl-approx" aria-label="추정">≈</i>':"",a=e.reasoningTokens?` <span class="rl-dim">생각 ${u(e.reasoningTokens)} 포함</span>`:"";return`${t}${u(e.promptTokens)} <i class="fa-solid fa-arrow-right-long rl-arrow"></i> ${u(e.completionTokens)}${a}`}function M(e){const t=e.root.querySelector(".rl-list"),a=aa(e);e.root.querySelector(".rl-filter-count").textContent=a.length?`${a.length}건`:"";const s=e.root.querySelector(".rl-more");if(s.hidden=e.exhausted,!a.length){t.innerHTML=`<div class="rl-empty"><i class="fa-regular fa-folder-open"></i><b>${e.entries.length?"조건에 맞는 요청이 없어요":"아직 기록이 없어요"}</b><p>${e.entries.length?"":"메시지를 보내면 여기에 쌓여요."}</p></div>`;return}let l="";const r=[];for(const n of a){const i=ee(n.at);i!==l&&(l=i,r.push(`<div class="rl-day">${o(i.replace(/-/g,"."))}</div>`));const d=je(n),b=n.cost===null||n.cost===void 0?" · 비용 미확인":` · ${Fe(n)}`,S=n.error&&!n.ok?`<small class="rl-item-error">${o(String(n.error).slice(0,120))}</small>`:"";r.push(`
            <button type="button" class="rl-item ${d.className}" data-id="${o(n.id)}">
<span class="rl-item-time">${Ne(n.at)}</span>
<span class="rl-item-main">
<b><span class="rl-item-title">${o(Be(n))}</span><span class="rl-item-model">${o(n.model||"?")}</span></b>
<small>${n.connection?.label?`${o(n.connection.label)} · `:""}${Ge(n)} · ${_(n.durationMs)}${b}</small>
                    ${S}
                </span>
<i class="rl-item-status fa-solid ${d.icon}" aria-label="${d.label}"></i>
</button>`)}t.innerHTML=r.join("")}async function la(e,t){const a=await vt(t);if(!a||h!==e)return;e.detailId=t;const s=e.root.querySelector('[data-view="detail"]');e.root.querySelector('[data-view="log"]').hidden=!0,s.hidden=!1,s.innerHTML=na(a),s.dataset.id=t,s.scrollIntoView?.({block:"start"}),e.detailEntry=a}function sa(e){e.detailId=null,e.detailEntry=null;const t=e.root.querySelector('[data-view="detail"]');t.hidden=!0,t.replaceChildren(),e.root.querySelector('[data-view="log"]').hidden=!1}function p(e,t,a=""){return t==null||t===""?"":`<span class="rl-meta-chip ${a}"><small>${o(e)}</small><b>${t}</b></span>`}function Xe(e,t,a){const s=String(e.role??"?"),l=String(e.content??""),r=t>=a-2||s==="system"&&t===0;return`
        <details class="rl-msg is-${o(s)}" ${r?"open":""}>
<summary><b>${o(s)}</b>${e.name?`<span>${o(e.name)}</span>`:""}<small>${u(l.length)}자</small></summary>
            <pre>${o(l)||'<i class="rl-dim">(빈 내용)</i>'}</pre>
        </details>`}function ra(e){if(!e||!Array.isArray(e.marks))return"";const t=[["보내기 ("+o(e.source||"버튼")+")",0],...e.marks,["요청 보냄",e.requestAt]],a=t.map(([l,r],n)=>{const i=n?t[n-1][1]:0,d=r-i;return`<div class="rl-trace-row${d>=700?" is-heavy":""}"><span class="rl-trace-at">${_(r)}</span><span class="rl-trace-label">${o(l)}</span><span class="rl-trace-gap">${n?"+"+_(d):""}</span></div>`}).join(""),s=(e.fetches||[]).map(l=>`<div class="rl-trace-row is-fetch"><span class="rl-trace-at">${_(l.at)}</span><span class="rl-trace-label">${o(l.label)}</span><span class="rl-trace-gap">${_(l.ms)}</span></div>`).join("");return`
        <div class="rl-section-head"><b>전송 흐름</b><small>버튼을 누른 순간이 0초 · 굵은 줄은 0.7초 넘게 걸린 단계</small></div>
<div class="rl-trace">${a}${s?`<div class="rl-trace-sub">그 사이에 난 요청</div>${s}`:""}</div>`}function na(e){const t=je(e),a=[p("상태",`<i class="fa-solid ${t.icon}"></i> ${t.label}${e.status?` · HTTP ${e.status}`:""}`,t.className),p("걸린 시간",`${_(e.durationMs)}${e.firstByteMs!==null&&e.firstByteMs!==void 0?` <span class="rl-dim">첫 글자 ${_(e.firstByteMs)}</span>`:""}`),p("토큰",Ge(e)),e.cachedTokens?p("캐시",u(e.cachedTokens)):"",p("예상 비용",e.cost===null||e.cost===void 0?'<span class="rl-dim">계산 불가</span>':Fe(e)),p("끝난 이유",e.finish?o(e.finish):""),p("보내기",e.stream?"스트림":"한 번에"),p("메시지",e.messageCount?`${u(e.messageCount)}개 · ${u(e.promptChars)}자`:""),p("캐릭터",e.character?o(e.character):""),p("용도",o(e.label||z(e.purpose))),p("사용량",e.usageKnown?"API 응답":e.estimated?"토큰 추정":"확인 불가"),p("연결처",o(e.connection?.label||"예전 기록 · 미확인")),e.cacheWriteTokens?p("캐시 저장",u(e.cacheWriteTokens)):"",e.cacheWrite5mTokens?p("5분 저장",u(e.cacheWrite5mTokens)):"",e.cacheWrite1hTokens?p("1시간 저장",u(e.cacheWrite1hTokens)):"",p("API 경로",o(e.endpoint||"")),p("소스",e.source?o(e.source):""),e.swipes>1?p("스와이프",`${e.swipes}개`):""].join(""),s=e.error&&!e.ok?`<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${o(e.error)}</b>${e.raw&&e.raw!==e.error?`<pre>${o(e.raw)}</pre>`:""}</div></div>`:"";let l;if(e.stripped)l='<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-file"></i><b>본문은 지워졌어요</b><p>본문 보관 수보다 오래된 요청이라 숫자만 남아 있어요.</p></div>';else{const i=Array.isArray(e.messages)?e.messages.map((S,E)=>Xe(S,E,e.messages.length)).join(""):e.prompt?Xe({role:"prompt",content:e.prompt},0,1):"",d=e.reasoning?`<details class="rl-msg is-reasoning"><summary><b>생각</b><small>${u(e.reasoning.length)}자</small></summary><pre>${o(e.reasoning)}</pre></details>`:"",b=`<details class="rl-msg is-reply" open><summary><b>응답</b><small>${u((e.reply??"").length)}자</small></summary><pre>${o(e.reply??"")||'<i class="rl-dim">(빈 응답)</i>'}</pre></details>`;l=`
            <div class="rl-section-head"><b>프롬프트</b><small>${u(e.messageCount)}개</small></div>
<div class="rl-messages">${i||'<small class="rl-dim">프롬프트가 없어요.</small>'}</div>
<div class="rl-section-head"><b>응답</b></div>
<div class="rl-messages">${d}${b}</div>`}const r=e.params?`<details class="rl-msg is-params"><summary><b>설정값</b><small>${Object.keys(e.params).length}개</small></summary><pre>${o(JSON.stringify(e.params,null,2))}</pre></details>`:"",n=ra(e.sendTrace);return`
        <div class="rl-detail-head">
<button type="button" class="rl-icon-btn rl-back" data-act="back" aria-label="목록으로"><i class="fa-solid fa-arrow-left"></i></button>
<div class="rl-detail-title">
<b><span class="rl-item-title">${o(Be(e))}</span><span class="rl-item-model">${o(e.model||"?")}</span></b>
<small>${le(e.at)}</small>
</div>
<div class="rl-detail-actions">
<button type="button" class="rl-icon-btn" data-act="copy-prompt" aria-label="프롬프트 복사" ${e.stripped?"disabled":""}><i class="fa-regular fa-copy"></i><span>프롬프트</span></button>
<button type="button" class="rl-icon-btn" data-act="copy-reply" aria-label="응답 복사" ${e.stripped?"disabled":""}><i class="fa-regular fa-copy"></i><span>응답</span></button>
</div>
</div>
<div class="rl-meta">${a}</div>
        ${Me(e.pricing)}
        ${s}
        ${n}
        ${l}
        <div class="rl-messages">${r}</div>`}async function Ye(e,t){await Et(e)?y("success",`${t}을 복사했어요.`):y("warning","복사하지 못했어요. 글을 직접 골라서 복사해 주세요.")}function ia(e){if(e==="all")return"";const t=e==="today"?0:Number(e),a=new Date;return a.setDate(a.getDate()-t),ee(a.getTime())}function P(e,t,a){const s=new Map;for(const l of e){const r=t(l),n=s.get(r)??{key:r,label:a(l),cachedTokens:0,unknownUsage:0,requests:0,errors:0,promptTokens:0,completionTokens:0,reasoningTokens:0,estimatedRequests:0,cost:0,priced:0};for(const i of["cachedTokens","unknownUsage","requests","errors","promptTokens","completionTokens","reasoningTokens","estimatedRequests","cost","priced"])n[i]+=Number(l[i])||0;Vt(n,l,T().unit),s.set(r,n)}return[...s.values()]}function Je(e){return e.priced?(e.priced<e.requests?'<span class="rl-dim">일부</span> ':"")+Object.entries(e.costs||{}).map(([a,s])=>o(v(s,{unit:a==="USD"?"US$":a}))).join(" / "):'<span class="rl-dim">—</span>'}function ze(e){return e.estimatedRequests?'<i class="rl-approx" aria-label="일부 추정">≈</i>':""}function I(e,t,{sortBy:a="promptTokens",desc:s=!0}={}){if(!t.length)return"";const l=[...t].sort((r,n)=>(s?n[a]-r[a]:r[a]-n[a])||String(r.label).localeCompare(String(n.label),"ko"));return`
        <div class="rl-table-wrap">
<div class="rl-section-head"><b>${o(e)}</b></div>
<table class="rl-table">
<thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>캐시 입력</th><th>예상 비용</th></tr></thead>
<tbody>${l.map(r=>`
                    <tr>
<td class="rl-td-label">${o(r.label)}${r.errors?`<small class="rl-td-err">오류 ${r.errors}</small>`:""}</td>
<td data-label="요청">${u(r.requests)}</td>
<td data-label="입력">${ze(r)}${u(r.promptTokens)}</td>
<td data-label="출력">${u(r.completionTokens)}${r.reasoningTokens?`<small class="rl-dim">생각 ${u(r.reasoningTokens)} 포함</small>`:""}</td>
<td data-label="캐시 입력">${u(r.cachedTokens)}</td><td data-label="예상 비용">${Je(r)}${r.unknownUsage?`<small class="rl-dim">사용량 미확인 ${u(r.unknownUsage)}건</small>`:""}</td>
</tr>`).join("")}
                </tbody>
</table>
</div>`}async function ie(e){const t=e.root.querySelector(".rl-stats");let a;try{a=await gt()}catch(c){console.warn("[요청 로그] 집계를 읽지 못했어요",c),a=[]}if(h!==e)return;for(const c of e.root.querySelectorAll("[data-range]"))c.setAttribute("aria-pressed",String(c.dataset.range===e.range));const s=ia(e.range),l=a.filter(c=>!s||c.day>=s);if(!l.length){t.innerHTML='<div class="rl-empty"><i class="fa-regular fa-chart-bar"></i><b>이 기간에는 요청이 없어요</b><p></p></div>';return}const r=P(l,()=>"all",()=>"전체")[0],n=r.promptTokens+r.completionTokens,i=`
        <div class="rl-tiles">
<div class="rl-tile"><small>요청</small><b>${u(r.requests)}</b>${r.errors?`<span class="rl-td-err">오류 ${u(r.errors)}</span>`:""}</div>
<div class="rl-tile"><small>입력 토큰</small><b>${ze(r)}${u(r.promptTokens)}</b></div>
<div class="rl-tile"><small>출력 토큰</small><b>${u(r.completionTokens)}</b>${r.reasoningTokens?`<span class="rl-dim">생각 ${u(r.reasoningTokens)}</span>`:""}</div>
<div class="rl-tile"><small>비용</small><b>${Je(r)}</b><span class="rl-dim">${u(n)} 토큰</span></div>
</div>`,d=c=>(c.purpose||"unknown")+(c.label?"#"+c.label:""),b=c=>c.label||z(c.purpose),S=P(l,d,b),E=P(l,c=>d(c)+"|"+c.model,c=>b(c)+" · "+c.model),Y=P(l,c=>c.model+"|"+(c.providerLabel||""),c=>c.model+" · "+(c.providerLabel||"예전 기록")),N=P(l,c=>c.caller,c=>D(c.caller)),j=P(l,c=>c.day,c=>c.day.replace(/-/g,".")),A=Object.keys(r.costs||{}).length>1,C=A?"requests":"cost";t.innerHTML=i+'<p class="rl-dim">용도별 비용은 모델 단가 기준 예상액이에요. 예전 기록은 용도 분류 불가로 남고, 사용량·가격이 없는 요청은 0원으로 계산하지 않아요. 새 기록은 요청 당시 연결처·공식 캐시 단가를 반영해요. 단가 확인이 안 된 요청은 합계에서 빠져요. 서로 다른 통화는 나눠 보여요.</p>'+I(A?"용도별 · 요청 많은 순 (통화가 서로 달라요)":"용도별 · 비용 많은 순",S,{sortBy:C})+I("용도 · 모델별",E,{sortBy:C})+I("모델별",Y)+I("보낸 곳별",N)+(e.range==="today"?"":I("날짜별",j,{sortBy:"label",desc:!0}))}function oa(e,t){const a=e.target;if(a.closest('[data-act="refresh-pricing"]')){K(t.root),Se({force:!0}).then(()=>K(t.root));return}const s=a.closest(".rl-tab");if(s)return He(t,s.dataset.tab);const l=a.closest("[data-range]");if(l)return t.range=l.dataset.range,ie(t);const r=a.closest("[data-brange]");if(r)return t.budgetRange=r.dataset.brange,se(t);if(a.closest('[data-act="budget-refresh"]'))return U({force:!0}).catch(()=>{});const n=a.closest(".rl-item[data-id]");if(n)return la(t,n.dataset.id);if(a.closest(".rl-more"))return ta(t);const i=a.closest("[data-act]")?.dataset.act,d=t.detailEntry;switch(i){case"back":return sa(t);case"copy-prompt":return d?Ye(JSON.stringify(d.messages??d.prompt??"",null,2),"프롬프트"):void 0;case"copy-reply":return d?Ye(d.reply??"","응답"):void 0}}export{Xt as buildDrawer,Ue as openDialog};
