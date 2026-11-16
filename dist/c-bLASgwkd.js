import{showThemeModal as N}from"./c-C3Bolmvp.js";import{saveSettingsDebounced as M,eventSource as I,event_types as T}from"../../../../../script.js";import{extension_settings as g}from"../../../../extensions.js";import{a as E}from"./c-DNO_Gd7U.js";import{b0 as w,b1 as V}from"./index.js";import{s as k,w as O}from"./c-B8dtxqs3.js";const $=new WeakMap;let B=1;const S=new WeakSet;let v=null,b=null;function D(r){for(let e=r.target;e;e=e.parentNode)if(e.nodeName==="STYLE"){S.add(e);return}}function F(r){const e=r.head;if(b===e){for(const t of v.takeRecords())D(t);return!0}return b||typeof MutationObserver!="function"||typeof e?.nodeType!="number"||(v=new MutationObserver(t=>{for(const i of t)D(i)}),v.observe(e,{childList:!0,subtree:!0,characterData:!0}),b=e),!1}function R(r,e=!1){const t=$.get(r);if(e&&t&&!S.has(r))return t.rev;S.delete(r);const i=r.textContent;if(t&&t.text===i)return t.rev;const s=B++;return $.set(r,{text:i,rev:s}),s}function A(r=document,e=globalThis){const t=r.documentElement;if(typeof t?.getAttribute!="function"||typeof r.head?.querySelectorAll!="function")return"";const i=[t.getAttribute("class"),t.getAttribute("style"),e.innerWidth,e.innerHeight,e.devicePixelRatio],s=F(r);for(const n of r.head.querySelectorAll('style, link[rel~="stylesheet"]')){let a=-1;try{a=n.sheet?.cssRules.length??-1}catch{}i.push(n.tagName,n.getAttribute("href")||"",n.getAttribute("media")||"",n.disabled||n.sheet?.disabled?1:0,a,n.tagName==="STYLE"?R(n,s):0)}return JSON.stringify(i)}const P="0.1.3",c="--custom-theme-style-inputs",_="ctsi-drawer",h="ctsi-drawer-content",W=`
:root {
  --custom-theme-style-inputs: [
  {
    "type": "slider",
    "varId": "customCSS-font-size",
    "displayText": "CustomCSS font size",
    "default": "5",
    "min": 0,
    "max": 32,
    "step": 1
  },
  {
    "type": "color",
    "varId": "customCSS-background",
    "displayText": "CustomCSS background",
    "default": "rgba(149, 78, 178, 40)"
  },
  {
    "type": "color",
    "varId": "customCSS-Drawer-iconColor",
    "displayText": "Drawer icon Color",
    "default": "rgba(19, 78, 78, 30)"
  },
  {
    "type": "text",
    "varId": "customAnimation-duration",
    "displayText": "animation duration",
    "default": "0.1s"
  },
  {
    "type": "select",
    "varId": "expressionVisibility",
    "displayText": "Expression Visibility",
    "default": "visible",
    "options": [
      {
        "label": "visible",
        "value": "visible"
      },
      {
        "label": "hidden",
        "value": "hidden"
      },
      {
        "label": "collapse",
        "value": "collapse"
      }
    ]
  },
  {
    "type": "select",
    "varId": "expressionWidth",
    "displayText": "Expression size",
    "default": "512px",
    "options": [
      {
        "label": "512px",
        "value": "512px"
      },
      {
        "label": "0px",
        "value": "0px"
      }
    ]
  }
]
}

/* !!! Exemples. If using slider always * 1(Unit) !!!*/
* {
    --animation-duration: calc(var(--customAnimation-duration) * 1s);
}

.expression-holder {
    width: var(--expressionWidth) !important;
    height: var(--expressionWidth) !important;
    min-width: var(--expressionWidth) !important;
    min-height: var(--expressionWidth) !important;
}

.drawer-icon {
    color: var(--customCSS-Drawer-iconColor) !important;
}

#expression-image {
    visibility: var(--expressionVisibility);
}

#customCSS {
    background: var(--customCSS-background);
    font-size: calc(var(--customCSS-font-size) * 1px);
}
`;class z{constructor(){this.settings=this.initializeSettings(),this.previousStyleValue=null,this.isAppReady=!1,this.handleDelegatedInput=this.handleDelegatedInput.bind(this),this.handleDelegatedChange=this.handleDelegatedChange.bind(this),this.handleDelegatedClick=this.handleDelegatedClick.bind(this)}initializeSettings(){return g.CTSI||(g.CTSI={}),g.CTSI}_parseCSSConfig(e){try{const t=getComputedStyle(document.documentElement).getPropertyValue(e);if(!t||!t.trim()||["none",'""',"''"].includes(t.trim()))return[];const i=JSON.parse(t);if(!Array.isArray(i))return console.warn("[CTSI] CSS content is not an array"),[];const s=new Set;return i.filter(n=>!n||!["slider","color","text","checkbox","select"].includes(n.type)||!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(n.varId)||!n.displayText?!1:s.has(n.varId)?(console.warn(`[CTSI] Duplicate varId ignored: ${n.varId}`),!1):(s.add(n.varId),!0))}catch(t){return console.error(`[CTSI] Failed to parse ${e}:`,t),[]}}updateCSSVariables(e){const t=new Set(this._parseCSSConfig(c).map(i=>i.varId));Object.entries(e).forEach(([i,s])=>{if(!t.has(i)||!i||i==="undefined")return;const n=`${i}-unit`,a=e[n]||"",o=a?`${s}${a}`:s;o!==""&&document.documentElement.style.setProperty(`--${i}`,o)})}saveSettings(e){this.settings.entries=e,this.updateCSSVariables(e),M()}syncSettingsWithConfig(e){const t=e.map(s=>s.varId),i=this.settings.entries||{};for(const s of this.appliedKeys||[])t.includes(s)||document.documentElement.style.removeProperty(`--${s}`);this.appliedKeys=new Set(t),e.forEach(s=>{if(i[s.varId]===void 0)if(s.type==="select"){const n=(s.options||[]).find(a=>a.value===s.default)||(s.options||[])[0];i[s.varId]=n?n.value:""}else s.type==="checkbox"?i[s.varId]=s.checked||!1:i[s.varId]=s.default??""}),this.settings.entries=i}generateEntryHTML(e,t){const i=n=>String(n??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]);e={...e,displayText:i(e.displayText),default:i(e.default),min:i(e.min),max:i(e.max),step:i(e.step),options:(e.options||[]).map(n=>({label:i(n.label),value:i(n.value)}))},e.type!=="checkbox"&&t!==void 0&&(t=i(t));const s=t!==void 0?t:e.default;switch(e.type){case"slider":return`
                    <div class="flex-container alignitemscenter">      
                        <span data-i18n="${e.displayText}">${e.displayText}</span><br>
<div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
<input class="neo-range-slider" type="range" data-var-id="${e.varId}" min="${e.min}" max="${e.max}" value="${s}" step="${e.step||1}">
<input class="neo-range-input" type="number" data-var-id="${e.varId}" min="${e.min}" max="${e.max}" value="${s}" step="${e.step||1}">
</div>
</div>`;case"color":return`
                    <div class="flex-container alignItemsBaseline">
<span>${e.displayText}</span>
                        <toolcool-color-picker data-var-id="${e.varId}" color="${s}"></toolcool-color-picker>
                    </div>`;case"text":return`
                    <label class="flex-container alignItemsBaseline">
<span>${e.displayText}</span><br>
<input type="text" class="text_pole wide100p widthNatural flex1 margin0" data-var-id="${e.varId}" value="${s}" />
</label>`;case"checkbox":return`
                    <label class="checkbox_label alignItemsBaseline">
<span>${e.displayText}</span>
<input type="checkbox" data-var-id="${e.varId}" ${s?"checked":""}>
</label>`;case"select":const n=(e.options||[]).map(a=>`<option value="${a.value}" ${a.value===s?"selected":""}>${a.label}</option>`).join("");return`
                    <div class="flex-container alignItemsBaseline">
<span>${e.displayText}</span>
<select class="widthNatural flex1 margin0" data-var-id="${e.varId}">${n}</select>
</div>`;default:return""}}handleDelegatedInput(e){const t=e.target,i=t.dataset.varId;if(i)if(t.classList.contains("neo-range-slider")||t.classList.contains("neo-range-input")){const s=t.value;t.closest(".alignitemscenter").querySelectorAll(`[data-var-id="${i}"]`).forEach(o=>{o!==t&&(o.value=s)}),this.settings.entries[i]=s,this.saveSettings(this.settings.entries)}else t.type==="text"&&(this.settings.entries[i]=t.value,this.saveSettings(this.settings.entries))}handleDelegatedChange(e){const t=e.target,i=t.dataset.varId;i&&(t.type==="checkbox"?(this.settings.entries[i]=t.checked,this.saveSettings(this.settings.entries)):t.tagName==="SELECT"&&(this.settings.entries[i]=t.value,this.saveSettings(this.settings.entries)))}bindColorPickers(){const e=document.getElementById(h);if(!e)return;e.querySelectorAll("toolcool-color-picker").forEach(i=>{i.addEventListener("change",s=>{const n=i.dataset.varId,a=s.detail?.rgba||s.detail?.hex||i.color;n&&a&&(this.settings.entries[n]=a,this.saveSettings(this.settings.entries))})})}handleDelegatedClick(e){const t=e.target.closest(".interactable");t&&(t.id==="ctsi-copy-to-clipboard"?this.copyToClipboard():t.id==="ctsi-update-customCSS"?this.updateCustomCSSFile():t.id==="ctsi-reset-defaults"?this.resetDefaults():t.id==="insert-default-css"&&this.insertDefaultCSS())}async copyToClipboard(){const e=this.generateCSSContent();try{try{await navigator.clipboard.writeText(e)}catch{const t=document.activeElement,i=document.createElement("textarea");i.value=e,i.readOnly=!0,i.style.cssText="position:fixed;top:0;left:0;opacity:0",(document.querySelector(".bl-ctsi-dialog[open]")||document.body).append(i);let s=!1;try{i.select(),i.setSelectionRange(0,i.value.length),s=document.execCommand("copy")}finally{i.remove(),t?.focus?.({preventScroll:!0})}if(!s)throw Error("Clipboard unavailable")}toastr.success("CSS를 복사했어요.")}catch{toastr.error("CSS를 복사하지 못했어요.")}}updateCustomCSSFile(){const e=document.getElementById("customCSS");if(!e){toastr.error("커스텀 CSS 입력칸을 찾지 못했어요.");return}const t=e.value,i=this.generateSettingsJSON();let s=t;const n=/--custom-theme-style-inputs\s*:\s*\[/.exec(t);if(n){const a=n.index+n[0].length-1;let o=-1;for(let l=t.indexOf("]",a);l!==-1;l=t.indexOf("]",l+1))try{JSON.parse(t.substring(a,l+1)),o=l+1;break}catch{}if(o!==-1){const l=t.substring(0,a),p=t.substring(o);s=l+i+p}else console.warn("[CTSI] Could not find matching closing bracket for variable array")}else{const a=/:root\s*\{/;a.test(t)?s=t.replace(a,()=>`:root {
  --custom-theme-style-inputs: ${i};
`):s=`${t}
:root {
  --custom-theme-style-inputs: ${i};
}`}s!==t?(e.value=s,e.dispatchEvent(new Event("input",{bubbles:!0})),toastr.success("커스텀 CSS에 저장했어요.")):toastr.success("커스텀 CSS에 이미 같은 내용이 있어요.")}generateSettingsJSON(){const e=this.settings.entries,i=this._parseCSSConfig(c).map(s=>{const n=e[s.varId];return{...s,default:n!==void 0?n:s.default}});return JSON.stringify(i,null,2)}generateCSSContent(){return`:root {
  --custom-theme-style-inputs: ${this.generateSettingsJSON()}
}`}async insertDefaultCSS(){if(!await E("현재 커스텀 CSS 앞에 예제를 추가할까요? 적용하면 화면 모양이 바뀔 수 있어요.",{ok:"추가",cancel:"취소"}))return;const e=document.getElementById("customCSS");e&&(e.value=`${W}
${e.value}`,e.dispatchEvent(new Event("input",{bubbles:!0})),this.buildUI())}async resetDefaults(){if(await E("현재 CSS 설정 항목을 기본값으로 되돌릴까요?",{ok:"되돌리기",cancel:"취소"})){for(const e of this._parseCSSConfig(c))delete this.settings.entries[e.varId],document.documentElement.style.removeProperty(`--${e.varId}`);this.updateCSSVariables({}),this.previousStyleValue=null,this.buildUI(),this.saveSettings(this.settings.entries),toastr.info("현재 항목을 기본값으로 되돌렸어요.")}}buildUI(){const e=document.getElementById(h);if(!e)return;e.innerHTML=`
            <div class="flex-container ctsi-container flexFlowColumn">
<div class="flex-container ctsi-flex-container">
<div id="cts-row-1" class="flex-container flexFlowColumn" style="flex: 1;"></div>
<div id="cts-row-2" class="flex-container flexFlowColumn" style="flex: 1;"></div>
</div>
<div class="flex-container ctsi-button-container">
<div id="ctsi-copy-to-clipboard" title="설정 CSS 복사" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-copy"></i></div>
<div id="ctsi-update-customCSS" title="커스텀 CSS에 저장" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-save"></i></div>
<div id="ctsi-reset-defaults" title="기본값 복원" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-undo"></i></div>
                    
                </div>
</div>`;const t=document.getElementById("cts-row-1"),i=document.getElementById("cts-row-2"),s=this._parseCSSConfig(c);if(this.syncSettingsWithConfig(s),s.length===0){t.innerHTML='<p class="alert-message">이 CSS에는 조절 항목이 아직 없어요. 아래 예제 형식을 참고해 주세요.</p>',i.innerHTML='<button id="insert-default-css" class="menu_button menu_button_icon interactable flex1">예제 CSS 추가</button>',this.updateCSSVariables({});return}s.forEach((n,a)=>{const o=this.generateEntryHTML(n,this.settings.entries[n.varId]);a<s.length/2?t.insertAdjacentHTML("beforeend",o):i.insertAdjacentHTML("beforeend",o)}),this.bindColorPickers()}injectDrawer(){if(document.getElementById(_))return;const e=`
            <div id="${_}" class="inline-drawer wide100p flexFlowColumn">
<div class="inline-drawer-toggle inline-drawer-header userSettingsInnerExpandable">
<b>커스텀 CSS 조절</b>
<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
</div>
<div id="${h}" class="inline-drawer-content" style="font-size:small;"></div>
</div>
<hr>`,t=document.getElementById("bl-ctsi-holder");t?t.insertAdjacentHTML("beforeend",e):console.warn("[CTSI] Target container FontBlurChatWidthBlock not found")}setupDelegation(){const e=document.getElementById(h);e&&(e.removeEventListener("input",this.handleDelegatedInput),e.removeEventListener("change",this.handleDelegatedChange),e.removeEventListener("click",this.handleDelegatedClick),e.addEventListener("input",this.handleDelegatedInput),e.addEventListener("change",this.handleDelegatedChange),e.addEventListener("click",this.handleDelegatedClick))}initialize(){const e=()=>{this.isAppReady||(this.isAppReady=!0,this.injectDrawer(),this.previousStyleValue=this._parseCSSConfig(c),f=A(),this.buildUI(),this.setupDelegation(),this.updateCSSVariables(this.settings.entries||{}))};this.boot=e,requestAnimationFrame(()=>setTimeout(e,0)),setTimeout(e,1e3);let t=null,i=0,s=null;const n=()=>{cancelAnimationFrame(i),clearTimeout(s),i=0,s=null;const x=A();if(f&&x===f)return;f=x;const y=this._parseCSSConfig(c);JSON.stringify(y)!==JSON.stringify(this.previousStyleValue)&&(this.previousStyleValue=y,this.buildUI(),this.updateCSSVariables(this.settings.entries||{}))};let a=!!document.getElementById("loader"),o=!1;a&&I.once(T.APP_READY,()=>{a=!1,o&&u()}),I.on(T.SETTINGS_UPDATED,()=>{if(this.isAppReady){if(a){o=!0;return}u()}});let l=!1;const p=O(()=>u()),u=()=>{if(clearTimeout(t),p.cancel(),w()){l||(l=!0,V({quietMs:300}).then(()=>{l=!1,u()}));return}if(k()){p();return}t=setTimeout(()=>{if(w()||k()){u();return}cancelAnimationFrame(i),clearTimeout(s),s=setTimeout(n,1e3),i=requestAnimationFrame(()=>{i=0,clearTimeout(s),s=setTimeout(n,0)})},300)}}}let f="";const m=document.createElement("div");m.id="bl-ctsi-holder",m.hidden=!0,document.body.append(m);const d=new z;d.initialize();let C=null;function L(){if(C?.open)return;d.boot?.();const r=document.getElementById("ctsi-drawer");d.buildUI(),d.updateCSSVariables(d.settings.entries||{});const e=document.createElement("dialog");C=e,e.className="bl-ctsi-dialog",e.setAttribute("aria-label","커스텀 CSS 조절"),e.innerHTML='<header><b><i class="fa-solid fa-sliders" aria-hidden="true"></i> 커스텀 CSS 조절 <span class="ext-version">v'+P+'</span></b><button type="button" aria-label="커스텀 CSS 조절 닫기">×</button></header><p>CSS에 정의된 색·크기·텍스트 값을 입력칸으로 조절해요.</p><div class="bl-ctsi-body"></div><small>Copyright © 2025 <a href="https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs" target="_blank" rel="noopener noreferrer">IceFog72</a> · <a href="https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></small>',document.body.append(e),e.querySelector(".bl-ctsi-body").append(r),e.querySelector("header button").onclick=()=>e.close(),e.addEventListener("close",()=>{m.append(r),e.remove(),C=null},{once:!0}),N(e)}function H(r){const e=document.createElement("button");return e.type="button",e.className="salty-btn",e.textContent="커스텀 CSS 조절 열기",e.onclick=L,r.replaceChildren(e),()=>r.replaceChildren()}export{d as default,H as mountInline,L as openPanel};
