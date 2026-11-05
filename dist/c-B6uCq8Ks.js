import{o as Qe,P as Ze,p as X}from"./c-BlYncMdV.js";import{i as j,n as et,u as tt,v as at,D as ce,q as lt,x as st,y as rt,z as nt,A as it,P as ot}from"./index.js";import{pane as ct}from"./c-R6rx6DA0.js";import{callGenericPopup as Q,POPUP_TYPE as Z,POPUP_RESULT as de}from"../../../../popup.js";import{T as B,V as dt,s as S,a as $,t as ue,r as pe,j as ut,k as pt,n as me,d as ee,m as v,o as te,f as mt,q as bt,u as ft,e as be,v as gt,w as D,c as fe}from"./c-CGvCg1e1.js";import{onBudget as ge,config as ve,refresh as U,rememberKeyHost as he,onAmountChanged as $e,testConnection as vt,isConfigured as H,resetBaseline as ht,summary as ye,inheritedHostChanged as $t,todayKey as ke,spendBetween as we,monthStartKey as Se,refreshWaitMs as yt,limitedUntil as kt,canRefreshNow as wt,loadDaily as St,budgetState as Tt,quotaToMoney as xt}from"./c-C7RECG4-.js";import{c as Lt}from"./c-8921B0ga.js";import{main_api as F}from"../../../../../script.js";import{textgenerationwebui_settings as _t,getTextGenModel as Et,getTextGenServer as Mt}from"../../../../textgen-settings.js";import{nai_settings as Pt}from"../../../../nai-settings.js";import{getChatCompletionModel as Ct,oai_settings as At}from"../../../../openai.js";import{c as Dt,P as Ft,a as qt,q as Rt,m as It}from"./c-DPQcjRaw.js";import{priceSnapshot as Nt}from"./c-CCK526Gx.js";import{syncPriceSync as Ot,refreshPrices as Te,pricingSyncStatus as xe}from"./c-fR19VJl6.js";const K=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Le=e=>`₩${Math.round(Number(e)||0).toLocaleString("ko-KR")}`;function jt(){return`
        <div class="rl-price-head rl-ledger-head"><b>사용량 장부</b><small>확장 · 기능마다 오늘 얼마 썼나 (이 기기에만 90일)</small></div>
        <label class="checkbox_label rl-check" for="rl_ledger_enabled"><input type="checkbox" id="rl_ledger_enabled"><span>사용량 장부 적기</span></label>
        <div class="rl-row rl-numbers">
            <label><span>환율</span><input type="number" class="text_pole rl-ledger-krw" min="1" max="99999" step="0.1" inputmode="decimal"><span>원 / $</span></label>
            <small class="rl-hint rl-ledger-krw-date"></small>
        </div>
        <div class="rl-ledger-pay"></div>
        <small class="rl-hint rl-ledger-today"></small>
        <details class="rl-budget-adv rl-compare"></details>
        <small class="rl-hint">공식 API 는 공식 공개 단가, 중계는 중계 장부의 실제 과금(못 맞추면 중계 단가표 「≈」)으로 따로 셈해요. 결제 수단(크레딧 · 실제 결제 · 중계)은 다른 확장이 영수증 도장으로 써요. 키는 장부에 남지 않아요.</small>`}async function Bt(e){const t=await lt({from:Date.now()-2592e6}).catch(()=>[]),a=new Map;for(const l of t){const s=st(l);if(a.has(s))continue;const r=l.cost?.kind==="relay"?`중계 · ${l.cost.relay}`:l.cost?.kind==="official"?`${l.cost.provider} 공식`:s.replace(/^other:/,"");a.set(s,{key:s,label:r,method:rt(l)})}if(!a.size){e.innerHTML='<small class="rl-hint">아직 적힌 요청이 없어요. 요청이 적히면 연결마다 결제 수단을 고를 수 있어요.</small>';return}e.innerHTML=[...a.values()].map(l=>`<label class="rl-row rl-ledger-pay-row" data-pay-key="${K(l.key)}"><span>${K(l.label)}</span><select class="text_pole rl-ledger-pay-select">${nt.map(s=>`<option value="${K(s)}"${s===l.method?" selected":""}>${K(s)}</option>`).join("")}</select></label>`).join("")}async function Ut(e){const t=await it({}).catch(()=>null);if(!t){e.textContent="";return}const a=t.lines.slice(0,3).map(l=>`${l.label}${l.approx?" ≈":""} ${Le(l.krw)}`).join(" · ");e.textContent=`오늘 ${Le(t.total.krw)} · 요청 ${t.requests}번${t.replies?` · 답 ${t.replies}개`:""}${a?` — ${a}`:""}`}function Ht(e){const t=o=>e.querySelector(o),a=j();t("#rl_ledger_enabled").checked=a.enabled!==!1,t(".rl-ledger-krw").value=a.krw.rate;const l=()=>{const o=j().krw;t(".rl-ledger-krw-date").textContent=`${o.date} 기준${o.source?` · ${o.source}`:""} (처음 값 ${ce.rate}원 · ${ce.date})`};l(),t("#rl_ledger_enabled").addEventListener("change",o=>{j().enabled=o.target.checked,globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced?.()}),t(".rl-ledger-krw").addEventListener("change",o=>{et(o.target.value)||(o.target.value=j().krw.rate),l()}),t(".rl-ledger-pay").addEventListener("change",o=>{const d=o.target.closest("[data-pay-key]");d&&tt(d.dataset.payKey,o.target.value)});const s=t(".rl-compare");s&&(s.innerHTML="<summary>중계 · 공식 가격 비교</summary>",s.addEventListener("toggle",()=>{!s.open||s.dataset.ready||(s.dataset.ready="1",import("./c-B5UZpmra.js").then(o=>{s.innerHTML=o.compareMarkup(),s.open=!0,o.bindCompare(s)}).catch(o=>{s.dataset.ready="",console.warn("[요청 로그] 가격 비교",o)}))}));const r=()=>{Bt(t(".rl-ledger-pay")).catch(()=>{}),Ut(t(".rl-ledger-today")).catch(()=>{})};r();let n=0;at("change",()=>{e.isConnected&&(clearTimeout(n),n=setTimeout(r,1500))})}const m=e=>String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),q=e=>Number(e).toLocaleString("en-US",{maximumFractionDigits:8}),_e=e=>e?new Date(e).toLocaleDateString("ko-KR"):"";function Ee(e){const t=Date.now()-Date.parse(e.checked)>2592e5,a=e.priceStatus;return a==="review"?"요금 조건 변경 · 이전 확인 가격":a==="error"?"공식 조회 실패 · 이전 확인 가격":t?"갱신 지연 · 이전 확인 가격":a==="ok"?"자동 확인 가격":"설치본 가격"}function Me(e,t="이 요청의 가격 기준"){if(!e)return'<p class="rl-dim">예전 기록에는 연결처·단가가 저장되지 않았어요. 당시 사용자 가격표로 계산한 비용이에요.</p>';const a={input:"일반 입력",output:"출력",cacheRead:"캐시 읽기",cacheWrite:"캐시 저장",cacheWrite5m:"캐시 저장 · 5분",cacheWrite1h:"캐시 저장 · 1시간"},l=e.currency==="USD"?"US$":e.currency,s=Object.entries(a).filter(([d])=>e.rates?.[d]!=null).map(([d,b])=>`<div><dt>${b}</dt><dd>${m(l)}${q(e.rates[d])}</dd></div>`).join(""),r=Ft[e.provider],n={official:e.minimum?"공식 목록 시작 단가":"공식 공개 단가",reported:"API 응답 비용",relay:"중계 서버 자동 가격",manual:"사용자 가격표",plan:"구독·크레딧 요금",local:"직접 운영",deployment:"배포·계약별 요금",free:"무료 경로"}[e.kind]||"단가 미확인",o=e.alternatives?`<p class="rl-pricing-note">시간대별 단가 (100만 토큰): ${Object.entries(e.alternatives.rates).map(([d,b])=>`${d==="peak"?"혼잡":"그 외"} 입력 ${m(l)}${q(b.input)} · 출력 ${m(l)}${q(b.output)} · 캐시 ${m(l)}${q(b.cacheRead)}`).join(" / ")}</p>`:"";return`<section class="rl-pricing-card" aria-label="${m(t)}">
        <div class="rl-pricing-head"><b>${m(t)}</b><span>${m(n)}</span></div>
        <p class="rl-pricing-model">${m(e.label)} · <strong>${m(e.model||"모델 미선택")}</strong></p>
        ${s?`<dl class="rl-pricing-rates">${s}</dl><p class="rl-pricing-unit">100만 토큰당 ${m(e.currency)}${e.tier?` · ${m(e.tier.split(" · ").map(d=>({standard:"기본 요금",priority:"우선 처리",fast:"Fast",flex:"Flex",batch:"일괄 처리",ultrafast:"Ultrafast"})[d]||d).join(" · "))}`:""}</p>`:""}
        ${o}<p class="rl-pricing-note">${m(e.note)}</p>
        ${r?`<p class="rl-pricing-source"><a href="${r}" target="_blank" rel="noopener noreferrer">공식 요금표 보기 ↗</a><span>${e.checked?m(_e(e.checked))+" 확인 · "+(t==="기본 단가 상세"?Ee(e):"요청 당시 가격 보존"):"공식 요금은 제공처에서 확인하세요"}</span></p>`:""}
    </section>`}function Kt(e,t,a="$"){if(e.costs||={},!t.priced)return;const l=t.currency||(a==="$"?"USD":a);e.costs[l]=(e.costs[l]||0)+(Number(t.cost)||0)}function Wt(e){const t=e.currency==="USD"?"US$":e.currency,a=e.rates?[["input","입력"],["output","출력"],["cacheRead","캐시 읽기"]].filter(([l])=>e.rates[l]!=null).map(([l,s])=>`${s} ${m(t)}${q(e.rates[l])}`).join(" · "):{plan:"구독·크레딧 요금",local:"직접 운영 서버",deployment:"배포·계약별 요금"}[e.kind]||"단가 미확인";return`<details class="rl-pricing-preview"><summary>
        <b>현재 연결의 모델 단가</b><span>${m(e.label)} · ${m(e.model||"모델 미선택")}</span>
        <span>${a}${e.rates?" / 100만 토큰":""}</span><span class="rl-pricing-more">${e.rates?Ee(e)+" · ":""}캐시·출처 보기</span>
        </summary>${Me(e,"기본 단가 상세")}<p class="rl-dim">확장 전용 API·긴 문맥·처리 등급은 각 요청을 눌러 확인하세요.</p></details>`}function Pe(){return`<details class="rl-provider-coverage"><summary>연결 가능한 API의 요금 안내</summary><p class="rl-dim">실제 연결처의 공식 자료를 하루 한 번 확인해요. 단위·조건·모델 목록이 달라지면 이전 가격을 보존해요. 새 모델·계약·플랜을 확인할 수 없는 요청은 비용 미확인으로 남아요.</p><ul>${Object.entries(ot).map(([t,a])=>{const l=["anthropic","openai"].includes(t)||Dt(t)>0,s=a.billing==="plan"?"플랜 안내":a.billing==="deployment"?"배포별 확인":a.billing==="local"?"운영 비용 별도":a.billing==="free"?"무료 경로":l?"모델 단가":"공식 요금 확인",r=Nt(t),n=r?(r.status==="review"?"조건 확인 필요":r.status==="error"?"조회 실패":r.status==="ok"?"자동 확인":"설치본")+" · "+_e(r.checkedAt):s;return`<li><span>${m(a.label)}</span><small>${n}</small></li>`}).join("")}</ul><p class="rl-dim">Vertex·Cohere·AI21의 복잡한 표는 원문이 달라지면 검토 후 갱신해요. 구독·개별 계약은 토큰 단가로 환산하지 않아요. 이미 저장한 요청 비용은 바뀌지 않아요.</p></details>`}function Ce(){if(S().priceAutoRefresh===!1)return"자동 갱신 꺼짐 · 저장된 가격 사용";const e=xe();return{loading:"공식 가격 확인 중…",ready:"하루 한 번 자동 확인",cached:"저장된 확인 가격 사용",offline:"연결하지 못했어요 · 마지막 확인 가격 유지",stale:"가격표 갱신 지연 · 마지막 확인 가격 유지",bundled:"설치본 가격 사용 · 자동 확인 대기"}[e.state]+(e.memoryOnly?" · 이 창에서만 보관":"")}function Ae(e){const t=e.querySelector(".rl-price-sync-status");t&&(t.textContent=Ce());const a=e.querySelector('[data-act="refresh-pricing"]');a&&(a.disabled=xe().state==="loading");const l=e.querySelector(".rl-provider-coverage");if(l){const s=l.open;l.outerHTML=Pe(),e.querySelector(".rl-provider-coverage").open=s}}function De(){let e="",t={},a="/api/backends/chat-completions/generate";if(F==="openai")e=Ct(),t=At;else if(F==="textgenerationwebui"){const n=_t;e=n.type==="ollama"&&!n.ollama_model?"":Et(),t={api_type:n.type,api_server:Mt()},a="/api/backends/text-completions/generate"}else F==="novel"?(e=Pt.model_novel,a="/api/novelai/generate"):F==="koboldhorde"?a="/api/horde/generate-text":F==="kobold"&&(t={api_server:document.querySelector("#api_url_text")?.value},a="/api/backends/kobold/generate");const l=qt(a,t,location.origin),s=mt(e),r=Rt({connection:l,model:e,manualPrice:It(s,l),manualUnit:S().unit});return Wt(r)}function W(e){const t=e.querySelector(".rl-current-pricing");if(!t)return;const a=t.querySelector("details")?.open;t.innerHTML=De(),t.querySelector("details").open=!!a,Ae(e)}document.addEventListener("bl-prices-updated",()=>document.querySelectorAll(".rl-root").forEach(W));function Fe(e){const t=e.pricing?.currency==="USD"?"US$":e.pricing?.currency||S().unit;return i(v(e.cost,{unit:t}))}const V=100,qe=(e,t,a,l)=>{const s=Number.parseInt(e,10);return Number.isFinite(s)?Math.min(l,Math.max(a,s)):t};function i(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function y(e,t,a={}){typeof toastr<"u"&&toastr[e](t,B,{timeOut:e==="success"?1800:3e3,...a})}const u=e=>(Number(e)||0).toLocaleString("ko-KR");function _(e){return e==null?"":e>=1e4?`${Math.round(e/1e3)}s`:`${(e/1e3).toFixed(1)}s`}const R=e=>String(e).padStart(2,"0");function Re(e){const t=new Date(e);return`${R(t.getHours())}:${R(t.getMinutes())}:${R(t.getSeconds())}`}function ae(e){const t=new Date(e);return`${t.getFullYear()}.${R(t.getMonth()+1)}.${R(t.getDate())} ${Re(e)}`}function Ie(e){return e.aborted?{className:"is-aborted",icon:"fa-ban",label:"중단"}:e.ok?{className:"is-ok",icon:"fa-check",label:"성공"}:{className:"is-error",icon:"fa-triangle-exclamation",label:"오류"}}function Ne(e){const t=e.caller==="chat"?gt(e.type):"";return`${D(e.caller)} · ${e.label||X(e.purpose)}${t?` · ${t}`:""}`}let g=null;function Vt(){const e=ct("log");if(!e||g)return;g=document.createElement("div"),g.id="request_log_settings",g.className="rl-settings",g.innerHTML=`
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-receipt"></i> ${B} <span class="rl-version ext-version">v${dt}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="rl-body">
                    <small class="rl-hint">실리태번과 확장이 보내는 API 요청을 이 기기에 기록해요. 마법봉 메뉴의 ${B}에서 봐요.</small>
                    <div class="rl-row">
                        <label class="checkbox_label rl-check" for="rl_enabled"><input type="checkbox" id="rl_enabled"><span>기록하기</span></label>
                        <div class="menu_button menu_button_icon rl-open"><i class="fa-solid fa-receipt"></i><span>열기</span></div>
                    </div>
                    <div class="rl-row rl-numbers">
                        <label><span>본문 보관</span><input type="number" class="text_pole rl-keep" min="0" max="500" step="1"><span>개</span></label>
                        <label><span>기록 보관</span><input type="number" class="text_pole rl-max" min="20" max="5000" step="10"><span>개</span></label>
                    </div>
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
                    ${jt()}
                    <div class="rl-row rl-danger-row">
                        <div class="menu_button menu_button_icon rl-clear"><i class="fa-solid fa-broom"></i><span>기록 비우기</span></div>
                    </div>
                </div>
            </div>
        </div>`,e.append(g);try{Ht(g)}catch(l){console.warn("[요청 로그] 사용량 장부 설정",l)}const t=l=>g.querySelector(l),a=S();t("#rl_enabled").checked=a.enabled,t(".rl-keep").value=a.keepBodies,t(".rl-max").value=a.maxEntries,t(".rl-unit-input").value=a.unit,t("#rl_enabled").addEventListener("change",l=>{a.enabled=l.target.checked,$()}),t(".rl-keep").addEventListener("change",l=>{a.keepBodies=qe(l.target.value,a.keepBodies,0,500),l.target.value=a.keepBodies,$(),ue().catch(()=>{})}),t(".rl-max").addEventListener("change",l=>{a.maxEntries=qe(l.target.value,a.maxEntries,20,5e3),l.target.value=a.maxEntries,$(),ue().catch(()=>{})}),t(".rl-unit-input").addEventListener("change",l=>{a.unit=l.target.value.trim().slice(0,4)||"$",l.target.value=a.unit,$()}),t(".rl-open").addEventListener("click",()=>je()),g.addEventListener("click",l=>{const s=l.target.closest?.(".rl-hint");s&&!l.target.closest("a,button,input")&&s.classList.toggle("is-open")}),t(".rl-price-save").addEventListener("click",Oe);for(const l of[".rl-price-model",".rl-price-in",".rl-price-out"])t(l).addEventListener("keydown",s=>{s.key==="Enter"&&!s.isComposing&&(s.preventDefault(),Oe())});t(".rl-price-list").addEventListener("click",async l=>{const s=l.target.closest("[data-act]");if(!s)return;const n=s.closest("[data-model]")?.dataset.model;n&&(s.dataset.act==="delete"?(delete a.prices[n],$(),Y(),await pe(fe)):s.dataset.act==="edit"&&(t(".rl-price-model").value=n,t(".rl-price-in").value=a.prices[n].input,t(".rl-price-out").value=a.prices[n].output,t(".rl-price-in").focus()))}),t(".rl-clear").addEventListener("click",async()=>{await Q("요청 기록과 날짜별 집계를 모두 지울까요? 되돌릴 수 없어요.",Z.CONFIRM,"",{okButton:"비우기",cancelButton:"취소"})===de.AFFIRMATIVE&&(await ut(),await pt(),y("success","기록을 비웠어요."),h&&h.reload())}),Y(),Gt()}function G(){const e=g?.querySelector(".rl-b-warning");if(!e)return;const t=$t();e.hidden=!t,t&&(e.textContent="본체의 API 주소가 키를 넣을 때와 달라졌어요. 다른 서버로 키가 가지 않게 조회를 멈췄어요. 같은 서버가 맞으면 API 키 칸을 한 번 저장하고, 아니면 서버 주소를 직접 적어 주세요.")}function Gt(){const e=l=>g.querySelector(l),t=ve();e("#rl_budget_enabled").checked=t.enabled,e(".rl-b-url").value=t.baseUrl,e(".rl-b-key").value=t.key,e(".rl-b-amount").value=t.amount||"",e(".rl-b-warn").value=t.warnPercent,e(".rl-b-daily").value=t.dailyLimit||"",e(".rl-b-access").value=t.accessToken,e(".rl-b-user").value=t.userId,g.querySelector(".rl-budget-fields").hidden=!t.enabled,ge(()=>{Y(),G()}),G();const a=(l,s=0)=>{const r=Number(l);return Number.isFinite(r)&&r>=0?r:s};e("#rl_budget_enabled").addEventListener("change",l=>{t.enabled=l.target.checked,g.querySelector(".rl-budget-fields").hidden=!t.enabled,$(),t.enabled&&U().catch(()=>{})}),e(".rl-b-url").addEventListener("change",l=>{t.baseUrl=l.target.value.trim().replace(/\/+$/,""),l.target.value=t.baseUrl,he(),G()}),e(".rl-b-key").addEventListener("change",l=>{const s=l.target.value.trim();s!==t.key&&(t.baselineUsed=null,t.baselineAt=null,t.alerted=null),t.key=s,he(),G()}),e(".rl-b-amount").addEventListener("change",l=>{t.amount=a(l.target.value),l.target.value=t.amount||"",$e()}),e(".rl-b-warn").addEventListener("change",l=>{t.warnPercent=Math.min(100,Math.max(1,Number.parseInt(l.target.value,10)||80)),l.target.value=t.warnPercent,$e()}),e(".rl-b-daily").addEventListener("change",l=>{t.dailyLimit=a(l.target.value),l.target.value=t.dailyLimit||"",t.dailyAlertedDay="",$()}),e(".rl-b-access").addEventListener("change",l=>{t.accessToken=l.target.value.trim(),$()}),e(".rl-b-user").addEventListener("change",l=>{t.userId=l.target.value.trim(),$()}),e(".rl-b-test").addEventListener("click",async l=>{const s=l.currentTarget;s.classList.add("disabled");try{const r=await vt();y("success",`연결됐어요. ${r}`,{timeOut:6e3}),U().catch(()=>{})}catch(r){y("error",`연결하지 못했어요: ${r.message}`,{timeOut:8e3})}finally{s.classList.remove("disabled")}}),e(".rl-b-reset").addEventListener("click",async()=>{if(!H())return y("warning","먼저 중계 서버 연동을 켜고 API 키를 넣어 주세요.");if(await Q("지금까지 쓴 금액을 0으로 보고 이 시점부터 다시 셀까요? 예산에는 지금 충전된 금액을 적어 두세요.",Z.CONFIRM,"",{okButton:"다시 세기",cancelButton:"취소"})===de.AFFIRMATIVE)try{await ht(),y("success","지금부터 다시 세요.")}catch(s){y("error",`기준을 잡지 못했어요: ${s.message}`,{timeOut:8e3})}})}async function Oe(){const e=s=>g.querySelector(s),t=e(".rl-price-model").value.trim(),a=Number(e(".rl-price-in").value),l=Number(e(".rl-price-out").value);if(!t)return y("warning","모델 이름을 적어 주세요.");if(!Number.isFinite(a)||!Number.isFinite(l)||a<0||l<0)return y("warning","가격은 0 이상의 숫자로 적어 주세요.");S().prices[t]={input:a,output:l},$(),e(".rl-price-model").value="",e(".rl-price-in").value="",e(".rl-price-out").value="",Y(),await pe(fe),y("success",`${t} 가격을 저장했어요.`)}function Y(){const e=g.querySelector(".rl-price-list"),t=S().prices,a=Object.keys(t).sort();if(!a.length){e.innerHTML='<small class="rl-hint rl-price-empty">직접 지정한 가격이 없어요. 공식 가격표에 있는 모델은 입력하지 않아도 연결처별 단가를 써요.</small>';return}e.innerHTML=a.map(l=>`
        <div class="rl-price-row" data-model="${i(l)}">
            <span class="rl-price-name">${i(l)}${t[l].auto?'<small class="rl-price-auto">자동</small>':""}</span>
            <span class="rl-price-nums">${i(t[l].input)} / ${i(t[l].output)}</span>
            <button type="button" class="rl-icon-btn" data-act="edit" aria-label="고치기"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="rl-icon-btn" data-act="delete" aria-label="지우기"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join("")}let h=null;function Yt(){const e=document.createElement("div");return e.className="rl-root",e.innerHTML=`
        <div class="rl-top">
            <div class="rl-tabs" role="tablist">
                <button type="button" class="rl-tab" data-tab="log" aria-pressed="true"><i class="fa-solid fa-list"></i><span>로그</span></button>
                <button type="button" class="rl-tab" data-tab="stats" aria-pressed="false"><i class="fa-solid fa-chart-simple"></i><span>집계</span></button>
                <button type="button" class="rl-tab" data-tab="budget" aria-pressed="false"><i class="fa-solid fa-wallet"></i><span>예산</span><span class="rl-tab-sub"></span></button>
            </div>
            <span class="rl-top-note">${me()?"이 창을 닫으면 사라져요 (저장소 없음)":"이 기기에만 남아요"}</span>
        </div>
        <section class="rl-view" data-view="log">
            <div class="rl-current-pricing">${De()}</div>
            <div class="rl-price-sync-controls">
                <label><input type="checkbox" data-act="auto-pricing" ${S().priceAutoRefresh!==!1?"checked":""}> 가격 자동 갱신</label>
                <button type="button" class="rl-chip rl-chip-icon" data-act="refresh-pricing" title="지금 확인" aria-label="지금 확인"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
                <span class="rl-price-sync-status" role="status">${Ce()}</span>
            </div>
            ${Pe()}
            <div class="rl-filters">
                <select class="text_pole rl-filter-caller"><option value="">모두</option></select>
                <select class="text_pole rl-filter-purpose" aria-label="사용 용도">${Ke([])}</select>
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
        </section>`,e}async function je({tab:e="log"}={}){if(h)return;const t=Yt(),a={root:t,tab:e,entries:[],exhausted:!1,loading:!1,callerFilter:"",purposeFilter:"",statusFilter:"",range:"today",detailId:null,reload:()=>He(a)};h=a;const l=n=>t.querySelector(n);t.addEventListener("click",n=>na(n,a)),t.querySelector('[data-act="auto-pricing"]').addEventListener("change",n=>{S().priceAutoRefresh=n.target.checked,$(),Ae(t),Ot(),n.target.checked&&Te()}),l(".rl-filter-caller").addEventListener("change",n=>{a.callerFilter=n.target.value,M(a)}),l(".rl-filter-purpose").addEventListener("change",n=>{a.purposeFilter=n.target.value,M(a)}),l(".rl-filter-status").addEventListener("change",n=>{a.statusFilter=n.target.value,M(a)});const s=Qe(n=>{if(h!==a)return;if(W(a.root),a.tab==="stats"){ne(a);return}if(a.tab!=="log")return;const o=a.entries.at(-1);(a.exhausted||!o||n.at>=o.at)&&(a.entries=te(a.entries,[n])),re(a),se(a),a.detailId||M(a)}),r=ge(()=>{h===a&&(Ue(a),a.tab==="budget"&&le(a))});a.budgetRange="today",Ue(a),Be(a,e);try{await Q(t,Z.TEXT,"",{okButton:"닫기",wide:!0,large:!0,allowVerticalScrolling:!0})}finally{s(),r(),h===a&&(h=null)}}function Be(e,t){e.tab=t,e.detailId=null;for(const a of e.root.querySelectorAll(".rl-tab"))a.setAttribute("aria-pressed",String(a.dataset.tab===t));for(const a of e.root.querySelectorAll(".rl-view"))a.hidden=a.dataset.view!==t;t==="log"?He(e):t==="budget"?zt(e):ne(e)}async function zt(e){await St().catch(()=>{}),h===e&&(le(e),H()&&U().catch(()=>{}))}function Ue(e){const t=e.root.querySelector('.rl-tab[data-tab="budget"] .rl-tab-sub');if(!t)return;const{remaining:a}=ye();t.textContent=H()&&a!==null?v(a):"",t.classList.toggle("is-low",a!==null&&a<=0)}const Jt={account:"계정 잔액",token:"키 한도",manual:"예산에서 계산"};function Xt(e){if(!e)return"";const t=Date.now()-e;return t<6e4?"방금":t<36e5?`${Math.floor(t/6e4)}분 전`:ae(e)}function Qt(e){if(e==="today")return ke();if(e==="month")return Se();if(e==="all")return"";const t=new Date;return t.setDate(t.getDate()-Number(e)),ee(t.getTime())}function le(e){const t=e.root.querySelector(".rl-budget");if(!t)return;const a=Tt(),l=ve();if(!H()){t.innerHTML=`
            <div class="rl-empty"><i class="fa-solid fa-wallet"></i><b>중계 서버 연동이 꺼져 있어요</b>
            <p>확장 설정 → ${i(B)} → 예산에서 켜고 API 키를 넣어 주세요. new-api 계열 서버에서 실제 과금과 잔액을 가져와요.</p></div>`;return}const s=ye(),r=a.loading?'<i class="fa-solid fa-spinner fa-spin rl-dim"></i>':"",n=a.error?`<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${i(a.error)}</b></div></div>`:"",o=[];a.accountError&&o.push(`계정 잔액은 못 가져왔어요: ${i(a.accountError)}`),a.logsError&&o.push(`요청 내역은 못 가져왔어요: ${i(a.logsError)}`);let d;if(s.remaining!==null){const f=s.remaining<=0?"is-over":s.ratio!==null&&s.ratio*100>=l.warnPercent?"is-warn":"is-ok",k=s.ratio!==null?`<div class="rl-bar"><i style="width:${Math.round(s.ratio*100)}%"></i></div>`:"",x=s.total!==null?`${v(s.total)} 중 ${v(s.spent)} 사용${s.ratio!==null?` · ${Math.round(s.ratio*100)}%`:""}`:s.sinceBaseline!==null?`기준 시점 이후 ${v(s.sinceBaseline)} 사용`:"";d=`
            <div class="rl-balance ${f}">
                <small>잔액 <span class="rl-dim">· ${Jt[s.source]??""}</span></small>
                <b>${v(s.remaining)}</b>
                ${k}
                <span>${x}</span>
            </div>`}else d=`
            <div class="rl-balance is-unknown">
                <small>잔액</small>
                <b>${s.sinceBaseline!==null?v(s.sinceBaseline):"—"}</b>
                <span>${s.sinceBaseline!==null?"기준 시점 이후 쓴 금액이에요. 예산을 적으면 잔액이 나와요.":a.loading?"가져오는 중…":"아직 못 가져왔어요."}</span>
            </div>`;const b=ke(),T=we(b,b),E=we(Se()),z=`
        <div class="rl-tiles">
            <div class="rl-tile"><small>오늘</small><b>${v(T.amount)}</b><span class="rl-dim">${u(T.requests)}건${l.dailyLimit?` · 한도 ${v(l.dailyLimit)}`:""}</span></div>
            <div class="rl-tile"><small>이번 달</small><b>${v(E.amount)}</b><span class="rl-dim">${u(E.requests)}건</span></div>
            <div class="rl-tile"><small>이 키 누적</small><b>${v(s.usedTotal)}</b><span class="rl-dim">${l.baselineAt?`기준 ${ae(l.baselineAt)}`:""}</span></div>
        </div>`,N=Qt(e.budgetRange),O=a.daily.filter(f=>!N||f.day>=N),C=new Map,A=new Map;for(const f of O)for(const[k,x]of[[C,f.model],[A,f.day]]){const L=k.get(x)??{label:x,requests:0,quota:0,promptTokens:0,completionTokens:0};L.requests+=Number(f.requests)||0,L.quota+=Number(f.quota)||0,L.promptTokens+=Number(f.promptTokens)||0,L.completionTokens+=Number(f.completionTokens)||0,k.set(x,L)}const c=(f,k,x)=>{if(!k.length)return"";const L=[...k].sort((w,oe)=>x==="label"?String(oe.label).localeCompare(String(w.label)):oe.quota-w.quota);return`
            <div class="rl-table-wrap">
                <div class="rl-section-head"><b>${i(f)}</b></div>
                <table class="rl-table">
                    <thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>과금</th></tr></thead>
                    <tbody>${L.map(w=>`
                        <tr>
                            <td class="rl-td-label">${i(x==="label"?w.label.replace(/-/g,"."):w.label)}</td>
                            <td data-label="요청">${u(w.requests)}</td>
                            <td data-label="입력">${u(w.promptTokens)}</td>
                            <td data-label="출력">${u(w.completionTokens)}</td>
                            <td data-label="과금">${v(xt(w.quota))}</td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            </div>`},Je=[["today","오늘"],["7","7일"],["month","이번 달"],["30","30일"],["all","전체"]].map(([f,k])=>`<button type="button" class="rl-chip" data-brange="${f}" aria-pressed="${String(e.budgetRange===f)}">${k}</button>`).join(""),Xe=O.length?"":'<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-chart-bar"></i><b>이 기간의 과금 내역이 없어요</b><p></p></div>',J=yt(),ie=kt()?`${Math.max(1,Math.ceil(J/6e4))}분 뒤 다시 가져와요`:J>0?`다음 조회까지 ${Math.max(1,Math.ceil(J/6e4))}분`:"";t.innerHTML=`
        <div class="rl-budget-top">
            <span class="rl-dim">${a.updatedAt?`${Xt(a.updatedAt)} 기준`:""}${ie?` · ${ie}`:""} ${r}</span>
            <button type="button" class="rl-icon-btn" data-act="budget-refresh" aria-label="새로 고침" ${wt()?"":"disabled"}><i class="fa-solid fa-rotate"></i></button>
        </div>
        ${n}
        ${d}
        ${z}
        ${o.length?`<small class="rl-hint rl-budget-note">${o.join("<br>")}</small>`:""}
        <div class="rl-ranges">${Je}</div>
        ${Xe}
        ${c("모델별",[...C.values()],"quota")}
        ${e.budgetRange==="today"?"":c("날짜별",[...A.values()],"label")}
        <small class="rl-hint rl-budget-note">과금은 중계 서버가 기록한 실제 금액이에요. 서버는 최근 1,000건만 주니, 하루에 그보다 많이 요청한 날은 일부가 빠질 수 있어요.</small>`}async function He(e){e.loading=!0;const t=new Set(e.entries.map(l=>l.id));try{const l=await be({limit:V});e.entries=te(l,e.entries.filter(s=>!t.has(s.id))),e.exhausted=l.length<V}catch(l){console.warn("[요청 로그] 기록을 읽지 못했어요",l),e.entries=[],e.exhausted=!0}finally{e.loading=!1}if(h!==e)return;const a=e.root?.querySelector(".rl-top-note");a&&(a.textContent=me()?"이 창을 닫으면 사라져요 (저장소 없음)":"이 기기에만 남아요"),re(e),se(e),M(e)}async function Zt(e){if(e.loading||e.exhausted)return;e.loading=!0;const t=e.entries[e.entries.length-1];try{const a=new Set(e.entries.map(r=>r.id)),l=t?e.entries.filter(r=>r.at===t.at).length:0,s=(await be({limit:V+l,before:t?t.at:null,inclusive:!0})).filter(r=>!a.has(r.id));e.entries=te(e.entries,s),e.exhausted=s.length<V}finally{e.loading=!1}h===e&&(re(e),se(e),M(e))}function Ke(e){return'<option value="">모든 용도</option>'+Object.entries(Ze).map(([t,a])=>`<option value="${t}">${a}</option>`).join("")+(e.length?`<optgroup label="이름표">${e.map(t=>`<option value="${i("label:"+t)}">${i(t)}</option>`).join("")}</optgroup>`:"")}function se(e){const t=e.root.querySelector(".rl-filter-purpose"),a=[...new Set(e.entries.map(s=>s.label).filter(Boolean))].sort((s,r)=>s.localeCompare(r,"ko")),l=e.purposeFilter||"";t.innerHTML=Ke(a),t.value=l,t.value!==l&&(e.purposeFilter=t.value)}function re(e){const t=e.root.querySelector(".rl-filter-caller"),a=[...new Set(e.entries.map(s=>s.caller||"unknown"))].sort((s,r)=>s==="chat"?-1:r==="chat"?1:D(s).localeCompare(D(r),"ko")),l=e.callerFilter;t.innerHTML='<option value="">모두</option>'+a.map(s=>`<option value="${i(s)}">${i(D(s))}</option>`).join(""),t.value=a.includes(l)?l:"",t.value!==l&&(e.callerFilter=t.value)}function ea(e){return e.entries.filter(t=>!(e.purposeFilter&&(e.purposeFilter.startsWith("label:")?(t.label||"")!==e.purposeFilter.slice(6):(t.purpose||"unknown")!==e.purposeFilter)||e.callerFilter&&(t.caller||"unknown")!==e.callerFilter||e.statusFilter==="ok"&&!t.ok||e.statusFilter==="error"&&t.ok))}function We(e){const t=e.estimated?'<i class="rl-approx" aria-label="추정">≈</i>':"",a=e.reasoningTokens?` <span class="rl-dim">생각 ${u(e.reasoningTokens)} 포함</span>`:"";return`${t}${u(e.promptTokens)} <i class="fa-solid fa-arrow-right-long rl-arrow"></i> ${u(e.completionTokens)}${a}`}function M(e){const t=e.root.querySelector(".rl-list"),a=ea(e);e.root.querySelector(".rl-filter-count").textContent=a.length?`${a.length}건`:"";const l=e.root.querySelector(".rl-more");if(l.hidden=e.exhausted,!a.length){t.innerHTML=`<div class="rl-empty"><i class="fa-regular fa-folder-open"></i><b>${e.entries.length?"조건에 맞는 요청이 없어요":"아직 기록이 없어요"}</b><p>${e.entries.length?"":"메시지를 보내면 여기에 쌓여요."}</p></div>`;return}let s="";const r=[];for(const n of a){const o=ee(n.at);o!==s&&(s=o,r.push(`<div class="rl-day">${i(o.replace(/-/g,"."))}</div>`));const d=Ie(n),b=n.cost===null||n.cost===void 0?" · 비용 미확인":` · ${Fe(n)}`,T=n.error&&!n.ok?`<small class="rl-item-error">${i(String(n.error).slice(0,120))}</small>`:"";r.push(`
            <button type="button" class="rl-item ${d.className}" data-id="${i(n.id)}">
                <span class="rl-item-time">${Re(n.at)}</span>
                <span class="rl-item-main">
                    <b><span class="rl-item-title">${i(Ne(n))}</span><span class="rl-item-model">${i(n.model||"?")}</span></b>
                    <small>${n.connection?.label?`${i(n.connection.label)} · `:""}${We(n)} · ${_(n.durationMs)}${b}</small>
                    ${T}
                </span>
                <i class="rl-item-status fa-solid ${d.icon}" aria-label="${d.label}"></i>
            </button>`)}t.innerHTML=r.join("")}async function ta(e,t){const a=await ft(t);if(!a||h!==e)return;e.detailId=t;const l=e.root.querySelector('[data-view="detail"]');e.root.querySelector('[data-view="log"]').hidden=!0,l.hidden=!1,l.innerHTML=sa(a),l.dataset.id=t,l.scrollIntoView?.({block:"start"}),e.detailEntry=a}function aa(e){e.detailId=null,e.detailEntry=null;const t=e.root.querySelector('[data-view="detail"]');t.hidden=!0,t.replaceChildren(),e.root.querySelector('[data-view="log"]').hidden=!1}function p(e,t,a=""){return t==null||t===""?"":`<span class="rl-meta-chip ${a}"><small>${i(e)}</small><b>${t}</b></span>`}function Ve(e,t,a){const l=String(e.role??"?"),s=String(e.content??""),r=t>=a-2||l==="system"&&t===0;return`
        <details class="rl-msg is-${i(l)}" ${r?"open":""}>
            <summary><b>${i(l)}</b>${e.name?`<span>${i(e.name)}</span>`:""}<small>${u(s.length)}자</small></summary>
            <pre>${i(s)||'<i class="rl-dim">(빈 내용)</i>'}</pre>
        </details>`}function la(e){if(!e||!Array.isArray(e.marks))return"";const t=[["보내기 ("+i(e.source||"버튼")+")",0],...e.marks,["요청 보냄",e.requestAt]],a=t.map(([s,r],n)=>{const o=n?t[n-1][1]:0,d=r-o;return`<div class="rl-trace-row${d>=700?" is-heavy":""}"><span class="rl-trace-at">${_(r)}</span><span class="rl-trace-label">${i(s)}</span><span class="rl-trace-gap">${n?"+"+_(d):""}</span></div>`}).join(""),l=(e.fetches||[]).map(s=>`<div class="rl-trace-row is-fetch"><span class="rl-trace-at">${_(s.at)}</span><span class="rl-trace-label">${i(s.label)}</span><span class="rl-trace-gap">${_(s.ms)}</span></div>`).join("");return`
        <div class="rl-section-head"><b>전송 흐름</b><small>버튼을 누른 순간이 0초 · 굵은 줄은 0.7초 넘게 걸린 단계</small></div>
        <div class="rl-trace">${a}${l?`<div class="rl-trace-sub">그 사이에 난 요청</div>${l}`:""}</div>`}function sa(e){const t=Ie(e),a=[p("상태",`<i class="fa-solid ${t.icon}"></i> ${t.label}${e.status?` · HTTP ${e.status}`:""}`,t.className),p("걸린 시간",`${_(e.durationMs)}${e.firstByteMs!==null&&e.firstByteMs!==void 0?` <span class="rl-dim">첫 글자 ${_(e.firstByteMs)}</span>`:""}`),p("토큰",We(e)),e.cachedTokens?p("캐시",u(e.cachedTokens)):"",p("예상 비용",e.cost===null||e.cost===void 0?'<span class="rl-dim">계산 불가</span>':Fe(e)),p("끝난 이유",e.finish?i(e.finish):""),p("보내기",e.stream?"스트림":"한 번에"),p("메시지",e.messageCount?`${u(e.messageCount)}개 · ${u(e.promptChars)}자`:""),p("캐릭터",e.character?i(e.character):""),p("용도",i(e.label||X(e.purpose))),p("사용량",e.usageKnown?"API 응답":e.estimated?"토큰 추정":"확인 불가"),p("연결처",i(e.connection?.label||"예전 기록 · 미확인")),e.cacheWriteTokens?p("캐시 저장",u(e.cacheWriteTokens)):"",e.cacheWrite5mTokens?p("5분 저장",u(e.cacheWrite5mTokens)):"",e.cacheWrite1hTokens?p("1시간 저장",u(e.cacheWrite1hTokens)):"",p("API 경로",i(e.endpoint||"")),p("소스",e.source?i(e.source):""),e.swipes>1?p("스와이프",`${e.swipes}개`):""].join(""),l=e.error&&!e.ok?`<div class="rl-error"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${i(e.error)}</b>${e.raw&&e.raw!==e.error?`<pre>${i(e.raw)}</pre>`:""}</div></div>`:"";let s;if(e.stripped)s='<div class="rl-empty rl-empty-inline"><i class="fa-regular fa-file"></i><b>본문은 지워졌어요</b><p>본문 보관 수보다 오래된 요청이라 숫자만 남아 있어요.</p></div>';else{const o=Array.isArray(e.messages)?e.messages.map((T,E)=>Ve(T,E,e.messages.length)).join(""):e.prompt?Ve({role:"prompt",content:e.prompt},0,1):"",d=e.reasoning?`<details class="rl-msg is-reasoning"><summary><b>생각</b><small>${u(e.reasoning.length)}자</small></summary><pre>${i(e.reasoning)}</pre></details>`:"",b=`<details class="rl-msg is-reply" open><summary><b>응답</b><small>${u((e.reply??"").length)}자</small></summary><pre>${i(e.reply??"")||'<i class="rl-dim">(빈 응답)</i>'}</pre></details>`;s=`
            <div class="rl-section-head"><b>프롬프트</b><small>${u(e.messageCount)}개</small></div>
            <div class="rl-messages">${o||'<small class="rl-dim">프롬프트가 없어요.</small>'}</div>
            <div class="rl-section-head"><b>응답</b></div>
            <div class="rl-messages">${d}${b}</div>`}const r=e.params?`<details class="rl-msg is-params"><summary><b>설정값</b><small>${Object.keys(e.params).length}개</small></summary><pre>${i(JSON.stringify(e.params,null,2))}</pre></details>`:"",n=la(e.sendTrace);return`
        <div class="rl-detail-head">
            <button type="button" class="rl-icon-btn rl-back" data-act="back" aria-label="목록으로"><i class="fa-solid fa-arrow-left"></i></button>
            <div class="rl-detail-title">
                <b><span class="rl-item-title">${i(Ne(e))}</span><span class="rl-item-model">${i(e.model||"?")}</span></b>
                <small>${ae(e.at)}</small>
            </div>
            <div class="rl-detail-actions">
                <button type="button" class="rl-icon-btn" data-act="copy-prompt" aria-label="프롬프트 복사" ${e.stripped?"disabled":""}><i class="fa-regular fa-copy"></i><span>프롬프트</span></button>
                <button type="button" class="rl-icon-btn" data-act="copy-reply" aria-label="응답 복사" ${e.stripped?"disabled":""}><i class="fa-regular fa-copy"></i><span>응답</span></button>
            </div>
        </div>
        <div class="rl-meta">${a}</div>
        ${Me(e.pricing)}
        ${l}
        ${n}
        ${s}
        <div class="rl-messages">${r}</div>`}async function Ge(e,t){await Lt(e)?y("success",`${t}을 복사했어요.`):y("warning","복사하지 못했어요. 글을 직접 골라서 복사해 주세요.")}function ra(e){if(e==="all")return"";const t=e==="today"?0:Number(e),a=new Date;return a.setDate(a.getDate()-t),ee(a.getTime())}function P(e,t,a){const l=new Map;for(const s of e){const r=t(s),n=l.get(r)??{key:r,label:a(s),cachedTokens:0,unknownUsage:0,requests:0,errors:0,promptTokens:0,completionTokens:0,reasoningTokens:0,estimatedRequests:0,cost:0,priced:0};for(const o of["cachedTokens","unknownUsage","requests","errors","promptTokens","completionTokens","reasoningTokens","estimatedRequests","cost","priced"])n[o]+=Number(s[o])||0;Kt(n,s,S().unit),l.set(r,n)}return[...l.values()]}function Ye(e){return e.priced?(e.priced<e.requests?'<span class="rl-dim">일부</span> ':"")+Object.entries(e.costs||{}).map(([a,l])=>i(v(l,{unit:a==="USD"?"US$":a}))).join(" / "):'<span class="rl-dim">—</span>'}function ze(e){return e.estimatedRequests?'<i class="rl-approx" aria-label="일부 추정">≈</i>':""}function I(e,t,{sortBy:a="promptTokens",desc:l=!0}={}){if(!t.length)return"";const s=[...t].sort((r,n)=>(l?n[a]-r[a]:r[a]-n[a])||String(r.label).localeCompare(String(n.label),"ko"));return`
        <div class="rl-table-wrap">
            <div class="rl-section-head"><b>${i(e)}</b></div>
            <table class="rl-table">
                <thead><tr><th></th><th>요청</th><th>입력</th><th>출력</th><th>캐시 입력</th><th>예상 비용</th></tr></thead>
                <tbody>${s.map(r=>`
                    <tr>
                        <td class="rl-td-label">${i(r.label)}${r.errors?`<small class="rl-td-err">오류 ${r.errors}</small>`:""}</td>
                        <td data-label="요청">${u(r.requests)}</td>
                        <td data-label="입력">${ze(r)}${u(r.promptTokens)}</td>
                        <td data-label="출력">${u(r.completionTokens)}${r.reasoningTokens?`<small class="rl-dim">생각 ${u(r.reasoningTokens)} 포함</small>`:""}</td>
                        <td data-label="캐시 입력">${u(r.cachedTokens)}</td><td data-label="예상 비용">${Ye(r)}${r.unknownUsage?`<small class="rl-dim">사용량 미확인 ${u(r.unknownUsage)}건</small>`:""}</td>
                    </tr>`).join("")}
                </tbody>
            </table>
        </div>`}async function ne(e){const t=e.root.querySelector(".rl-stats");let a;try{a=await bt()}catch(c){console.warn("[요청 로그] 집계를 읽지 못했어요",c),a=[]}if(h!==e)return;for(const c of e.root.querySelectorAll("[data-range]"))c.setAttribute("aria-pressed",String(c.dataset.range===e.range));const l=ra(e.range),s=a.filter(c=>!l||c.day>=l);if(!s.length){t.innerHTML='<div class="rl-empty"><i class="fa-regular fa-chart-bar"></i><b>이 기간에는 요청이 없어요</b><p></p></div>';return}const r=P(s,()=>"all",()=>"전체")[0],n=r.promptTokens+r.completionTokens,o=`
        <div class="rl-tiles">
            <div class="rl-tile"><small>요청</small><b>${u(r.requests)}</b>${r.errors?`<span class="rl-td-err">오류 ${u(r.errors)}</span>`:""}</div>
            <div class="rl-tile"><small>입력 토큰</small><b>${ze(r)}${u(r.promptTokens)}</b></div>
            <div class="rl-tile"><small>출력 토큰</small><b>${u(r.completionTokens)}</b>${r.reasoningTokens?`<span class="rl-dim">생각 ${u(r.reasoningTokens)}</span>`:""}</div>
            <div class="rl-tile"><small>비용</small><b>${Ye(r)}</b><span class="rl-dim">${u(n)} 토큰</span></div>
        </div>`,d=c=>(c.purpose||"unknown")+(c.label?"#"+c.label:""),b=c=>c.label||X(c.purpose),T=P(s,d,b),E=P(s,c=>d(c)+"|"+c.model,c=>b(c)+" · "+c.model),z=P(s,c=>c.model+"|"+(c.providerLabel||""),c=>c.model+" · "+(c.providerLabel||"예전 기록")),N=P(s,c=>c.caller,c=>D(c.caller)),O=P(s,c=>c.day,c=>c.day.replace(/-/g,".")),C=Object.keys(r.costs||{}).length>1,A=C?"requests":"cost";t.innerHTML=o+'<p class="rl-dim">용도별 비용은 모델 단가 기준 예상액이에요. 예전 기록은 용도 분류 불가로 남고, 사용량·가격이 없는 요청은 0원으로 계산하지 않아요. 새 기록은 요청 당시 연결처·공식 캐시 단가를 반영해요. 단가 확인이 안 된 요청은 합계에서 빠져요. 서로 다른 통화는 나눠 보여요.</p>'+I(C?"용도별 · 요청 많은 순 (통화가 서로 달라요)":"용도별 · 비용 많은 순",T,{sortBy:A})+I("용도 · 모델별",E,{sortBy:A})+I("모델별",z)+I("보낸 곳별",N)+(e.range==="today"?"":I("날짜별",O,{sortBy:"label",desc:!0}))}function na(e,t){const a=e.target;if(a.closest('[data-act="refresh-pricing"]')){W(t.root),Te({force:!0}).then(()=>W(t.root));return}const l=a.closest(".rl-tab");if(l)return Be(t,l.dataset.tab);const s=a.closest("[data-range]");if(s)return t.range=s.dataset.range,ne(t);const r=a.closest("[data-brange]");if(r)return t.budgetRange=r.dataset.brange,le(t);if(a.closest('[data-act="budget-refresh"]'))return U({force:!0}).catch(()=>{});const n=a.closest(".rl-item[data-id]");if(n)return ta(t,n.dataset.id);if(a.closest(".rl-more"))return Zt(t);const o=a.closest("[data-act]")?.dataset.act,d=t.detailEntry;switch(o){case"back":return aa(t);case"copy-prompt":return d?Ge(JSON.stringify(d.messages??d.prompt??"",null,2),"프롬프트"):void 0;case"copy-reply":return d?Ge(d.reply??"","응답"):void 0}}export{Vt as buildDrawer,je as openDialog};
