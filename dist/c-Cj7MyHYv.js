import{w as Z}from"./c-D9-XG6CL.js";let y=!1;function ee(H){if(!H){y&&window.__thkFold?.destroy(),y=!1;return}y&&window.__thkFold||(y=!0,(()=>{const T="1.0.1",b="[▲ 접기]",a=window.parent??window,i=a.document,p="data-thk-fold",O="data-thk-fold-style",h="__thkFold",v=8,D=["CHAT_CHANGED","MORE_MESSAGES_LOADED","CHARACTER_MESSAGE_RENDERED","USER_MESSAGE_RENDERED","MESSAGE_UPDATED","MESSAGE_EDITED","MESSAGE_SWIPED","GENERATION_ENDED"];try{a[h]?.destroy()}catch(e){console.warn(b,"이전 실행분 정리 실패",e)}const u=`details > .thk-fold[${p}]`,$=`
${u} {
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
${u}::before {
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
  ${u}:hover::before {
    opacity: 1;
    background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
  }
}
${u}:active::before,
${u}:focus-visible::before {
  opacity: 1;
  background: color-mix(in srgb, var(--SmartThemeBodyColor, currentColor) 17%, transparent);
}
${u}:focus-visible::before {
  outline: 2px solid var(--SmartThemeQuoteColor, currentColor);
  outline-offset: 2px;
}
`,F="details > .details-collapse-btn[data-collapse-btn] { display: none !important; }";let l=!0,w=0;const f=new Map,m=new Set,_=[];function I(e){return e.ownerDocument!==i?!0:!!(e.closest("#chat, .mes_text")||e.querySelector(":scope > .mes_text, :scope > .mes_reasoning"))}function A(e){return Array.from(e.children).filter(t=>t.hasAttribute(p))}function q(e){for(let t=e.nextSibling;t;t=t.nextSibling)if(t.nodeType===1||t.nodeType===3&&t.nodeValue.trim())return!1;return!0}function E(e){if(!l||!e.isConnected||!I(e))return;const t=A(e);if(!e.open){t.forEach(n=>n.remove());return}t.length===1&&q(t[0])||(t.slice(1).forEach(n=>n.remove()),e.append(t[0]??V(e.ownerDocument)))}function S(e){e.querySelectorAll("details").forEach(E),e.querySelectorAll("iframe").forEach(R)}function V(e){const t=e.createElement("div");return t.className="thk-fold",t.setAttribute(p,""),t.setAttribute("role","button"),t.setAttribute("tabindex","0"),t.setAttribute("aria-label","접기"),t.addEventListener("click",P),t.addEventListener("keydown",z),t}function P(e){e.preventDefault(),e.stopPropagation(),C(e.currentTarget)}function z(e){e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),e.stopPropagation(),C(e.currentTarget)?.focus({preventScroll:!0}))}function C(e){const t=e.parentElement;if(!t||t.localName!=="details")return null;const n=t.querySelector(":scope > summary"),o=n??t,r=k(e).top,s=j(o),g=s.map(c=>c.style.overflowAnchor);s.forEach(c=>{c.style.overflowAnchor="none"}),t.open=!1,A(t).forEach(c=>c.remove());for(const c of s)U(c,o,r);return setTimeout(()=>s.forEach((c,X)=>{c.style.overflowAnchor=g[X]}),150),n}function k(e){const t=e.getBoundingClientRect();let n=t.top;for(let o=e.ownerDocument.defaultView;o&&o!==a&&o.frameElement;o=o.parent){const r=o.frameElement;n+=r.getBoundingClientRect().top+r.clientTop}return{top:n,bottom:n+t.height,height:t.height}}function Y(e){let t=e;for(;t.ownerDocument!==i;){const n=t.ownerDocument.defaultView?.frameElement;if(!n)break;t=n}return t}function j(e){const t=[];for(let o=Y(e).parentElement;o&&t.length<4&&!(o===i.body||o===i.documentElement);o=o.parentElement){const r=a.getComputedStyle(o).overflowY;/^(auto|scroll|overlay)$/.test(r)&&o.scrollHeight>o.clientHeight+1&&t.push(o)}const n=i.scrollingElement;return n&&n.scrollHeight>n.clientHeight+1&&t.push(n),t}function U(e,t,n){let o=0,r=a.innerHeight;e!==i.scrollingElement&&(o=e.getBoundingClientRect().top+e.clientTop,r=o+e.clientHeight);const s=k(t);if(s.top>=o&&s.bottom<=r)return;const g=Math.min(s.height,r-o-v*2),c=Math.min(Math.max(n-g,o+v),r-g-v);e.scrollTop+=s.top-c}function L(e){if(!l||f.has(e)||!e.documentElement)return;const t=e.createElement("style");t.setAttribute(O,""),t.textContent=$+(e===i?F:""),(e.head??e.documentElement).append(t);const n=Z(e.documentElement,{childList:!0,subtree:!0,attributes:["open"],exclude:"head",name:"접기 ▲"},Q);e.addEventListener("toggle",N,!0),f.set(e,()=>{n(),e.removeEventListener("toggle",N,!0),t.remove(),e.querySelectorAll(`[${p}]`).forEach(o=>o.remove())}),S(e)}function N(e){const t=e.target;t?.localName==="details"&&E(t)}function W(e){return e.ownerDocument!==i?!0:!!(e.nodeType===1?e:e.parentElement)?.closest("#chat, .mes_text")}function K(e){if(e.type!=="childList")return!1;for(const t of e.addedNodes)if(t.nodeType===1&&(t.matches("#chat, .mes_text")||t.querySelector("#chat, .mes_text")))return!0;return!1}function Q(e){if(l){for(const t of e)if(!(!W(t.target)&&!K(t))&&(t.target.localName==="details"&&E(t.target),t.type==="childList"))for(const n of t.addedNodes)n.nodeType!==1||n.hasAttribute(p)||(n.localName==="details"?E(n):n.localName==="iframe"&&R(n),n.firstElementChild&&S(n))}}function R(e){l&&(e.ownerDocument===i&&!e.closest("#chat, .mes_text")||(m.has(e)||(m.add(e),e.addEventListener("load",x)),B(e)))}function x(e){B(e.currentTarget)}function B(e){let t=null;try{t=e.contentDocument}catch{return}t?.body&&L(t)}function d(){l&&(clearTimeout(w),w=setTimeout(J,80))}function J(){if(l){for(const[e,t]of f){if(e!==i&&e.defaultView?.document!==e){f.delete(e);try{t()}catch{}continue}S(e)}for(const e of m)e.isConnected||(e.removeEventListener("load",x),m.delete(e))}}function M(){if(window.removeEventListener("pagehide",M),!!l){l=!1,clearTimeout(w),i.removeEventListener("visibilitychange",d),_.splice(0).forEach(e=>{try{e()}catch{}});for(const e of m)e.removeEventListener("load",x);m.clear();for(const e of f.values())try{e()}catch{}f.clear(),a[h]===G&&delete a[h],console.info(b,"꺼짐")}}const G={version:T,destroy:M};if(a[h]=G,i.addEventListener("visibilitychange",d),typeof eventOn=="function"&&typeof tavern_events=="object")for(const e of D)tavern_events[e]&&eventOn(tavern_events[e],d);else{let e=null;try{e=a.SillyTavern?.getContext?.()}catch{}const t=e?.eventSource,n=e?.event_types;if(t&&n)for(const o of D){const r=n[o];r&&(t.on(r,d),_.push(()=>t.removeListener(r,d)))}}L(i),console.info(b,"켜짐",T)})())}export{ee as syncFold};
