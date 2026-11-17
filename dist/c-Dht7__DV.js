import{w as oe}from"./index.js";let b=!1;function re(I){if(!I){b&&window.__thkFold?.destroy(),b=!1;return}b&&window.__thkFold||(b=!0,(()=>{const A="1.0.1",v="[▲ 접기]",s=window.parent??window,r=s.document,p="data-thk-fold",V="data-thk-fold-style",d="__thkFold",w=8,D=["CHAT_CHANGED","MORE_MESSAGES_LOADED","CHARACTER_MESSAGE_RENDERED","USER_MESSAGE_RENDERED","MESSAGE_UPDATED","MESSAGE_EDITED","MESSAGE_SWIPED","GENERATION_ENDED"];try{s[d]?.destroy()}catch(e){console.warn(v,"이전 실행분 정리 실패",e)}const f=`details > .thk-fold[${p}]`,q=`
${f} {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  width: 100% !important;
  min-height: 34px;
  margin: 4px 0 0 !important;
  padding: 4px 0 !important;
  position: static !important;
  float: none !important;
  visibility: visible !important;
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
  outline: none;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
${f}::before {
  content: '▲';
  display: inline-block;
  padding: 6px 20px;
  border-radius: 999px;
  font-family: inherit;
  font-size: calc(var(--mainFontSize, 15px) * 0.8);
  font-style: normal;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-box: trim-both cap alphabetic;
  color: var(--SmartThemeBodyColor, currentColor);
  background: rgba(128, 128, 128, 0.14);
  background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 10%, transparent);
  opacity: 0.7;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
@media (hover: hover) {
  ${f}:hover::before {
    opacity: 1;
    background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
  }
}
${f}:active::before,
${f}:focus-visible::before {
  opacity: 1;
  background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
}
${f}:focus-visible::before {
  outline: 2px solid var(--SmartThemeQuoteColor, currentColor);
  outline-offset: 2px;
}
`,P="details > .details-collapse-btn[data-collapse-btn] { display: none !important; }";let l=!0,S=0;const u=new Map,m=new Set,_=[];function z(e){return e.ownerDocument!==r?!0:!!(e.closest("#chat, .mes_text")||e.querySelector(":scope > .mes_text, :scope > .mes_reasoning"))}function C(e){return Array.from(e.children).filter(t=>t.hasAttribute(p))}function U(e){for(let t=e.nextSibling;t;t=t.nextSibling)if(t.nodeType===1||t.nodeType===3&&t.nodeValue.trim())return!1;return!0}function h(e){if(!l||!e.isConnected||!z(e))return;const t=C(e);if(!e.open){t.forEach(n=>n.remove());return}t.length===1&&U(t[0])||(t.slice(1).forEach(n=>n.remove()),e.append(t[0]??Y(e.ownerDocument)))}function E(e){e.querySelectorAll("details").forEach(h),e.querySelectorAll("iframe").forEach(M)}function Y(e){const t=e.createElement("div");return t.className="thk-fold",t.setAttribute(p,""),t.setAttribute("role","button"),t.setAttribute("tabindex","0"),t.setAttribute("aria-label","접기"),t.addEventListener("click",j),t.addEventListener("keydown",W),t}function j(e){e.preventDefault(),e.stopPropagation(),k(e.currentTarget)}function W(e){e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),e.stopPropagation(),k(e.currentTarget)?.focus({preventScroll:!0}))}function k(e){const t=e.parentElement;if(!t||t.localName!=="details")return null;const n=t.querySelector(":scope > summary"),o=n??t,i=L(e).top,c=Q(o),y=c.map(a=>a.style.overflowAnchor);c.forEach(a=>{a.style.overflowAnchor="none"}),t.open=!1,C(t).forEach(a=>a.remove());for(const a of c)J(a,o,i);return setTimeout(()=>c.forEach((a,ne)=>{a.style.overflowAnchor=y[ne]}),150),n}function L(e){const t=e.getBoundingClientRect();let n=t.top;for(let o=e.ownerDocument.defaultView;o&&o!==s&&o.frameElement;o=o.parent){const i=o.frameElement;n+=i.getBoundingClientRect().top+i.clientTop}return{top:n,bottom:n+t.height,height:t.height}}function K(e){let t=e;for(;t.ownerDocument!==r;){const n=t.ownerDocument.defaultView?.frameElement;if(!n)break;t=n}return t}function Q(e){const t=[];for(let o=K(e).parentElement;o&&t.length<4&&!(o===r.body||o===r.documentElement);o=o.parentElement){const i=s.getComputedStyle(o).overflowY;/^(auto|scroll|overlay)$/.test(i)&&o.scrollHeight>o.clientHeight+1&&t.push(o)}const n=r.scrollingElement;return n&&n.scrollHeight>n.clientHeight+1&&t.push(n),t}function J(e,t,n){let o=0,i=s.innerHeight;e!==r.scrollingElement&&(o=e.getBoundingClientRect().top+e.clientTop,i=o+e.clientHeight);const c=L(t);if(c.top>=o&&c.bottom<=i)return;const y=Math.min(c.height,i-o-w*2),a=Math.min(Math.max(n-y,o+w),i-y-w);e.scrollTop+=c.top-a}function N(e){if(!l||u.has(e)||!e.documentElement)return;const t=e.createElement("style");t.setAttribute(V,""),t.textContent=q+(e===r?P:""),(e.head??e.documentElement).append(t);const n=oe(e.documentElement,{childList:!0,subtree:!0,attributes:["open"],exclude:"head",name:"접기 ▲"},ee);e.addEventListener("toggle",R,!0),u.set(e,()=>{n(),e.removeEventListener("toggle",R,!0),t.remove(),e.querySelectorAll(`[${p}]`).forEach(o=>o.remove())}),E(e)}function R(e){const t=e.target;t?.localName==="details"&&h(t)}function X(e){return e.ownerDocument!==r?!0:!!(e.nodeType===1?e:e.parentElement)?.closest("#chat, .mes_text")}function Z(e){if(e.type!=="childList")return!1;for(const t of e.addedNodes)if(t.nodeType===1&&(t.matches("#chat, .mes_text")||t.querySelector("#chat, .mes_text")))return!0;return!1}function ee(e){if(l){for(const t of e)if(!(!X(t.target)&&!Z(t))&&(t.target.localName==="details"&&h(t.target),t.type==="childList"))for(const n of t.addedNodes)n.nodeType!==1||n.hasAttribute(p)||(n.localName==="details"?h(n):n.localName==="iframe"&&M(n),n.firstElementChild&&E(n))}}function M(e){l&&(e.ownerDocument===r&&!e.closest("#chat, .mes_text")||(m.has(e)||(m.add(e),e.addEventListener("load",T)),B(e)))}function T(e){B(e.currentTarget)}function B(e){let t=null;try{t=e.contentDocument}catch{return}t?.body&&N(t)}let x=!1;function G(e=!0){l&&(e&&(x=!0),clearTimeout(S),S=setTimeout(te,80))}const g=()=>G(!0),H=()=>G(!1),O=new Set(["CHAT_CHANGED","MORE_MESSAGES_LOADED"]);function te(){if(!l)return;const e=x;x=!1;for(const[t,n]of u){if(t!==r&&t.defaultView?.document!==t){u.delete(t);try{n()}catch{}continue}if(t===r&&!e){const o=r.getElementById("chat");E(o??t);continue}E(t)}for(const t of m)t.isConnected||(t.removeEventListener("load",T),m.delete(t))}function F(){if(window.removeEventListener("pagehide",F),!!l){l=!1,clearTimeout(S),r.removeEventListener("visibilitychange",g),_.splice(0).forEach(e=>{try{e()}catch{}});for(const e of m)e.removeEventListener("load",T);m.clear();for(const e of u.values())try{e()}catch{}u.clear(),s[d]===$&&delete s[d],console.info(v,"꺼짐")}}const $={version:A,destroy:F};if(s[d]=$,r.addEventListener("visibilitychange",g),typeof eventOn=="function"&&typeof tavern_events=="object")for(const e of D)tavern_events[e]&&eventOn(tavern_events[e],O.has(e)?g:H);else{let e=null;try{e=s.SillyTavern?.getContext?.()}catch{}const t=e?.eventSource,n=e?.event_types;if(t&&n)for(const o of D){const i=n[o];if(!i)continue;const c=O.has(o)?g:H;t.on(i,c),_.push(()=>t.removeListener(i,c))}}N(r),console.info(v,"켜짐",A)})())}export{re as syncFold};
