import{p as O,a as et,e as V}from"./c-BqNNZ3Dp.js";const ka="숨겨진 글 보기",kt=".blsp-s>summary{list-style:none}.blsp-s>summary::-webkit-details-marker{display:none}.blsp-s:not([open])>summary>.blsp-l{display:none!important}.blsp-s:not([open])>summary>.blsp-b{display:inline!important;filter:blur(5px);-webkit-user-select:none;user-select:none;transition:filter .2s}.blsp-k:not([open])>summary>.blsp-b{display:block!important}.blsp-s:not([open])>summary:hover>.blsp-b,.blsp-s:not([open])>summary:focus-visible>.blsp-b{filter:blur(3px)}.blsp-s[open]>summary{display:none!important}",pn="blsp-p",jn=/(^|[\s>+~(,])p(?=$|[\s>+~.:#[),])/,gt=new RegExp(jn.source,"g");function st(n){const a=[];let t=0,k=0;for(let g=0;g<n.length;g++){const o=n[g];o==="("||o==="["?t++:o===")"||o==="]"?t=Math.max(0,t-1):o===","&&t===0&&(a.push(n.slice(k,g)),k=g+1)}return a.push(n.slice(k)),a}function ga(n){const a=String(n??"");return a.includes(`.${pn}`)?a:a.replace(/([^{}]+)\{/g,(t,k)=>{if(k.trim().startsWith("@")||!jn.test(k.trim()))return t;const g=k.match(/^\s*/)[0],o=k.slice(g.length).replace(/\s+$/,""),s=st(o).map(e=>e.trim()).filter(e=>jn.test(e)).map(e=>e.replace(gt,(i,r)=>`${r}.${pn}`));return s.length?`${g}${o},${s.join(",")}{`:t})}function sa(n){const a=String(n??"");if(!a.includes("data-bl-spoiler"))return a;let t=!1;const k=a.replace(/<p\b([^>]*)>((?:(?!<\/?p\b)[\s\S])*?)<\/p>/g,(g,o,s)=>{if(!s.includes("data-bl-spoiler"))return g;t=!0;const e=o.match(/\sclass="([^"]*)"/);return`<div${e?o.replace(e[0],` class="${`${e[1]} ${pn}`.trim()}"`):` class="${pn}"${o}`}>${s}</div>`});return t?k.replace(/(<style>)([\s\S]*?)(<\/style>)/,(g,o,s,e)=>o+ga(s)+e):a}function ot(n,a){let t=!1;for(let k=a.parentElement?.closest("p");k;k=a.parentElement?.closest("p")){const g=n.createElement("div");for(const o of[...k.attributes])g.setAttribute(o.name,o.value);g.classList.add(pn),g.append(...k.childNodes),k.replaceWith(g),t=!0}if(t)for(const k of n.body.querySelectorAll("style:not([data-bl-sp])")){const g=ga(k.textContent);g!==k.textContent&&(k.textContent=g)}}const oa=(n,a)=>{for(let t=a?.nodeType===1?a:a?.parentElement;t&&t!==n.body;t=t.parentElement){const k=n.defaultView.getComputedStyle(t).display;if(!k.startsWith("inline")&&k!=="contents")return t}return n.body},cn=(n,a,t,k)=>{const g=n.createElement(a);return t&&(g.className=t),k&&g.setAttribute("style",k),g},ia=(n,a)=>`display:inline-block;padding:0 8px;border:1px solid ${n.line};border-radius:6px;background-color:${n.raised};color:${n.muted};font-family:${String(a.family).replace(/"/g,"'")};font-size:13px;font-style:normal;font-weight:650;line-height:1.6;letter-spacing:${a.tracking};text-indent:0`,it=n=>String(n??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]);function Rn(n,a,t=!0){const k={line:a?.line||"#8884",raised:a?.raised||"transparent",muted:a?.muted||"inherit"},g={family:a?.family||"inherit",tracking:a?.tracking||"0"},o=`display:${t?"inline-block;max-width:100%;vertical-align:baseline;text-indent:0":"block;margin:8px 0"}`,s=t?"span":"div",e=t?"span":"div";return`<details class="${t?"blsp-s":"blsp-s blsp-k"}" data-bl-spoiler="" style="${o}"><summary class="blsp-h" style="display:${t?"inline":"block"};list-style:none;cursor:pointer"><span class="blsp-l" style="${it(ia(k,g))}">${ka}</span><${s} class="blsp-b" aria-hidden="true" style="display:none">${n}</${s}></summary><${e} class="blsp-c">${n}</${e}></details>`}const ra=n=>[...n.childNodes].some(a=>a.nodeType===8?Gn.test(a.data):a.nodeType===1&&(a.hasAttribute("data-bl-msg")||ra(a)));function rt(n,a,t,k){if(!a||a.collapsed||a.startContainer.parentElement?.closest("[data-bl-spoiler]")||a.endContainer.parentElement?.closest("[data-bl-spoiler]"))return null;for(let c,d,f;!a.collapsed;)if(c=a.endContainer,d=a.endOffset,f=c.childNodes[d-1],!d)a.setEndBefore(c);else if(f&&(f.nodeType===8||f.nodeType===3&&!f.data.trim()))a.setEnd(c,d-1);else break;const g=oa(n,a.startContainer)===oa(n,a.endContainer),o=a.cloneContents();if(!o.textContent.trim()||ra(o))return null;const s=a.extractContents(),e=cn(n,"details",g?"blsp-s":"blsp-s blsp-k",g?"display:inline-block;max-width:100%;vertical-align:baseline;text-indent:0":"display:block;margin:8px 0");e.setAttribute("data-bl-spoiler","");const i=cn(n,"summary","blsp-h",`display:${g?"inline":"block"};list-style:none;cursor:pointer`),r=cn(n,"span","blsp-l",ia(t,k));r.textContent=ka;const l=cn(n,g?"span":"div","blsp-b","display:none");l.setAttribute("aria-hidden","true"),l.append(o),i.append(r,l);const p=cn(n,g?"span":"div","blsp-c","");return p.append(s),e.append(i,p),a.insertNode(e),ot(n,e),la(n),e}function lt(n){const a=n?.querySelector(":scope > .blsp-c");return a?(n.replaceWith(...a.childNodes),!0):!1}const pt=n=>(n?.startContainer?.nodeType===1?n.startContainer:n?.startContainer?.parentElement)?.closest?.("[data-bl-spoiler]")??null;function la(n){const a=n.querySelector("[data-bl-spoiler]");let t=n.body.querySelector("style[data-bl-sp]");if(!a){t?.remove();return}t||(t=n.createElement("style"),t.setAttribute("data-bl-sp",""),t.textContent=kt,n.body.prepend(t))}const Gn=/^blm:(\d+|e)$/,ct="linear-gradient(transparent 5%, rgba(128, 128, 128, 0.35) 5%, rgba(128, 128, 128, 0.35) 100%, transparent 100%)";function dt(n){const a=[],t=k=>{for(let g=k.firstChild;g;g=g.nextSibling){if(g.nodeType===1){g.hasAttribute("data-bl-spoiler")||t(g);continue}const o=g.nodeType===8?Gn.exec(g.data):null;if(!o||o[1]==="e")continue;const s=a[Number(o[1])]??=[];for(let e=g.nextSibling;e&&!(e.nodeType===8&&Gn.test(e.data));e=e.nextSibling)e.nodeType===1&&s.push(e)}};return t(n),Array.from(a,k=>k??[])}function ft(n,a,t,k){if(!n||!a||n.messages.length!==a.messages.length)return null;const g=s=>(s||[]).map(e=>e.t!=="el"?"":e.kind==="spoiler"?`${wn(e.children).replace(/\s/g,"")}`:g(e.children)).join(""),o=(s,e)=>{const i=wn(n.messages[e].nodes).trim();return(t?.length===n.messages.length?i!==t[e]:i!==wn(s.nodes).trim())||g(n.messages[e].nodes)!==g(s.nodes)||k?.length===n.messages.length&&hn(n.messages[e].nodes)!==k[e]};return a.messages.some((s,e)=>o(s,e))?{...a,messages:a.messages.map((s,e)=>o(s,e)?{...s,nodes:n.messages[e].nodes}:s)}:null}const mt=n=>String(n??"").replace(/<!--blm:(?:\d+|e)-->\n?/g,"").replace(/(<[a-zA-Z][\w-]*\b(?:[^<>"']|"[^"]*"|'[^']*')*?)\sdata-f="(?:title|hidden)"/g,"$1"),hn=n=>(n||[]).map(a=>a.t==="text"?a.text.replace(/\s+/g,""):a.t!=="el"?"":/strong|em|del/.test(a.kind??"")?`${a.kind}${hn(a.children)}`:hn(a.children)).join(""),wn=n=>(n||[]).map(a=>a.t==="text"?a.text:a.t==="br"?`
`:wn(a.children)).join("");function bt(n){const a=n.defaultView,t=[...n.querySelectorAll("[data-bl-msg]")].filter(r=>!r.closest?.("[data-bl-spoiler]")),k=t.length?null:dt(n.body);if(!t.length&&!k.length)return null;const g=(r,l,p=!1)=>{const c=[],d=p&&r.classList?.contains("gk-dl")&&[...r.childNodes].some(f=>f.classList?.contains("gk-d"));for(const f of r.childNodes){if(f.nodeType===3){if(p&&/^[\u2060\u200b]+$/.test(f.data))continue;const w=f.data.replace(/[ \t\r\n\f]+/g," ");(w.trim()||w===" ")&&c.push({t:"text",text:w});continue}if(f.nodeType!==1||f.matches("style, script, summary, [data-bl-name], .blsp-b, [data-bl-pic]")||p&&f.classList.contains("gk-nm")||d&&!f.matches(".gk-d, [data-bl-spoiler]"))continue;if(f.tagName==="BR"){c.push({t:"br"});continue}if(f.matches("[data-bl-spoiler]")){const w=f.querySelector(":scope > .blsp-c"),C=f.classList.contains("blsp-k");c.push({t:"el",block:C,tag:C?"div":"span",kind:"spoiler",style:{},children:w?g(w,l,p):[]});continue}const u=a.getComputedStyle(f);if(u.display==="none")continue;const b=!u.display.startsWith("inline");let x=null;if(b)/^H[1-6]$/.test(f.tagName)||f.matches("ul, ol, li")?x=f.tagName.toLowerCase():Number.parseFloat(u.borderLeftWidth)>=2&&u.borderLeftStyle!=="none"?x="quote":x="p";else{const w=[];(Number.parseInt(u.fontWeight,10)||400)-l.weight>=200&&w.push("strong"),u.fontStyle!=="normal"&&!l.italic&&w.push("em"),(/line-through/.test(u.textDecorationLine)||f.matches("s, del, strike"))&&w.push("del"),x=w.join(" ")||null}const v=!p||b?{}:{...f.classList?.contains("gk-d")?{"background-image":ct}:{},.../\bstrong\b/.test(x??"")?{"font-weight":"700"}:{},.../\bem\b/.test(x??"")?{"font-style":"italic"}:{}};c.push({t:"el",block:b,tag:b?"div":"span",kind:x,style:v,children:g(f,l,p)})}return c},o=r=>{const l=a.getComputedStyle(r);return{weight:Number.parseInt(l.fontWeight,10)||400,italic:l.fontStyle!=="normal"}},s="[data-bl-spoiler]",e=`.gk-nm, .gk-nr, .gk-dl, ${s}`,i=(r,l)=>r.matches(e)?[r]:r.querySelector(".gk-nr, .gk-dl")?[...r.childNodes].flatMap(p=>p.nodeType===1?i(p,1):[]):l?[]:[r];return k?{messages:k.map(r=>{const l=r.flatMap(d=>i(d)),p=l.find(d=>d.classList.contains("gk-nm"));return{name:p?[...p.childNodes].map(d=>d.nodeType===3?d.data:d.nodeType===1&&!d.getAttribute("class")?d.textContent:"").join("").trim()||p.textContent.trim():"",nodes:l.filter(d=>!d.classList.contains("gk-nm")&&!d.matches("[data-bl-pic]")).map(d=>d.matches(s)?g({childNodes:[d]},o(d),!0)[0]:{t:"el",block:!0,tag:"div",kind:"p",style:{},children:g(d,o(d),!0)})}})}:{messages:t.map(r=>{const l=a.getComputedStyle(r),p={weight:Number.parseInt(l.fontWeight,10)||400,italic:l.fontStyle!=="normal"};return{name:(r.querySelector("[data-bl-name]")?.textContent||r.getAttribute("data-bl-who")||"").trim(),nodes:g(r,p)}})}}const yn="blq-pic",xt=`.${yn} .image-number-badge{display:none!important}.${yn} .image-number-wrapper{display:block!important;position:static!important}`,ut="업로드 이미지",Ln=40,pa=n=>String(n??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]),ca=/^(https?:\/\/|data:image\/(?:png|gif|jpe?g|webp|avif);)/i,vn=n=>Number.isFinite(Number(n))&&Number(n)>0?Math.round(Number(n)):0;function Pn(n,{tag:a="div"}={}){const t=String(n?.src??"").trim();if(!ca.test(t))return"";const k=vn(n?.w),g=vn(n?.h);return`<${a} class="${yn}" data-bl-pic style="${`${a==="span"?"display:block;":""}margin:0 0 1em;line-height:0;text-indent:0;text-align:center`}"><img src="${pa(t)}" alt="${pa(ut)}" loading="lazy" style="display:block;width:100%;max-width:100%;height:auto;${k&&g?`aspect-ratio:auto ${k}/${g};`:""}margin:0;border-radius:8px"></${a}>`}function ht(n){const a=String(n??"").toLowerCase().replace(/^\[|\]$/g,"").replace(/\.$/,"");return!a||!a.includes(".")||a.includes(":")||/^\d+(\.\d+){3}$/.test(a)?!0:/(^|\.)(localhost|local|internal|lan|home|localdomain|intranet|corp|private|arpa|ts\.net|test|invalid|example)$/.test(a)}function Qn(n,a=""){const t=String(n??"").trim();if(!/^https:\/\//i.test(t))return!0;let k;try{k=new URL(t)}catch{return!0}if(k.username||k.password||a&&k.origin===String(a))return!0;try{if(a&&k.hostname===new URL(String(a)).hostname)return!0}catch{}return ht(k.hostname)}function da(n,a=""){const t=[],k=new Set;let g=0;for(const o of n?.messages??[])for(const s of o?.pics??[]){const e=String(s?.src??"").trim();if(!e||k.has(e)||t.length>=Ln)continue;k.add(e);const i=Qn(e,a);t.push({src:e,w:vn(s?.w),h:vn(s?.h),upload:i,n:i?++g:0})}return t}function fa(n,{codes:a=[],origin:t="",allow:k=()=>!0}={}){const g=da(n,t),o=[];return a.forEach((e,i)=>{Qn(String(e??"").trim(),t)&&o.push(i+1)}),{items:g.map(e=>{if(!e.upload)return{...e,to:k(e.src)?e.src:"",why:k(e.src)?"":"hidden"};const i=String(a[e.n-1]??"").trim();return i?Qn(i,t)||!ca.test(i)?{...e,to:"",why:"bad"}:k(i)?{...e,to:i,why:""}:{...e,to:"",why:"hidden"}:{...e,to:"",why:"wait"}}),bad:o}}function wt(n,{codes:a=[],origin:t="",off:k=!1,allow:g=()=>!0}={}){if(k||!n?.messages?.length)return n;const{items:o}=fa(n,{codes:a,origin:t,allow:g}),s=new Map(o.filter(r=>r.to).map(r=>[r.src,r]));if(!s.size)return n;let e=!1;const i=n.messages.map(r=>{const l=[...new Set((r?.pics??[]).map(p=>String(p?.src??"").trim()))].map(p=>s.get(p)).filter(Boolean);return l.length?(e=!0,{...r,nodes:[...l.map(p=>({t:"pic",src:p.to,...p.w&&p.h?{w:p.w,h:p.h}:{}})),...r.nodes??[]]}):r});return e?{...n,messages:i}:n}function yt(n){const a=String(n??""),t=g=>g.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim(),k=[...a.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(g=>t(g[1]??g[2]??g[3]??""));return k.length?k.slice(0,Ln):a.replace(/<[^>]*>/g," ").split(/\s+/).filter(g=>/^(https?:\/\/|file:|data:|\/)\S+$/i.test(g)).slice(0,Ln)}const P=n=>String(n??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a]),ma=n=>String(n??"").replace(/"/g,"'").replace(/[<>{};\\]/g,"").trim();function vt(n){return Object.entries(n??{}).filter(([a,t])=>/^[a-z-]+$/.test(a)&&t!==void 0&&t!==null&&ma(t)!=="").map(([a,t])=>`${a}:${ma(t)}`).join(";")}const qt=n=>String(n??"").replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a]),dn=(n,a)=>n.replace(/^<([a-z]+)/,(t,k)=>`<${k} ${a}`),zt=/^(inline-block|inline-flex|flex|grid|inline-grid|inline-table|table)$/,$=(n,a,t)=>{a&&zt.test(String(a.display??"").trim())&&a["text-indent"]==null&&(a={...a,"text-indent":"0"});const k=a?vt(a):"";return`<${n}${k?` style="${qt(k)}"`:""}>${t}</${n}>`},ba=new Set(["img","br","col","hr","input","meta","wbr","source","link"]);function Ct(n,a,{bg:t=null,candidates:k=[],keepOwn:g=!1}={}){const o=[{ink:a,bg:O(t)}],s=e=>{const i=[a,...k].filter(Boolean);return i.find(r=>V(r,e)>=4.5)??i.reduce((r,l)=>V(l,e)>V(r,e)?l:r,i[0])};return String(n).replace(/<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>/g,(e,i,r,l,p)=>{const c=r.toLowerCase();if(i)return!ba.has(c)&&o.length>1&&o.pop(),e;if(ba.has(c)||c==="style"||c==="script"||p)return e;const d=o[o.length-1],f=l.match(/\sstyle="([^"]*)"/),u=f?.[1]??"",b=u.match(/(?:^|;)\s*color:\s*([^;]+)/),x=u.match(/(?:^|;)\s*background-color:\s*([^;]+)/)?.[1],v=x?O(x):null,w=v&&v.a>.01?v.a>=.999||!d.bg?v:et(v,d.bg):d.bg;let C=b?b[1].trim():d.ink;!(b&&x&&b[1].trim()===x.trim())&&!(g&&b)&&w&&C&&V(C,w)<4.5&&(C=s(w));let B=l;return b&&C!==b[1].trim()?B=l.replace(f[0],()=>` style="${u.replace(b[0],()=>`${b[0].startsWith(";")?";":""}color:${C}`)}"`):!b&&C&&(B=f?l.replace(f[0],()=>` style="color:${C};${u}"`):`${l} style="color:${C}"`),o.push({ink:C,bg:w}),`<${r}${B}>`})}function Dn(n,{inkFix:a=null,trimEdges:t=!1,relayout:k=!1}={}){const g=s=>{if(!a||!s)return s;const e={...s};for(const i of["color","text-decoration-color"])e[i]&&V(e[i],a.bg)<4.5&&(e[i]=a.ink);return delete e["background-color"],e},o=(s,e)=>{if(s.t==="text")return P(s.text);if(s.t==="br")return"<br>";if(s.t==="pic")return Pn(s);if(s.t==="hr")return $("div",{...s.style,height:"0","max-width":"100%"},"");let i=s.style;s.block?(i=a?g(i):{...i},e?.first&&delete i["margin-top"],e?.last&&delete i["margin-bottom"],k&&i["text-align"]==="justify"&&delete i["text-align"],k===!0&&delete i["text-indent"],(s.tag==="ul"||s.tag==="ol")&&(i={margin:"0","padding-left":i["padding-left"]||"1.5em",...i})):a&&i?.color&&V(i.color,a.bg)<4.5&&(i={...i,color:a.ink});const r=s.children.map((l,p)=>o(l,s.block&&e?{first:e.first&&p===0,last:e.last&&p===s.children.length-1}:null)).join("");return s.kind==="spoiler"?Rn(r,s.sp,!s.block):$(s.tag==="ul"||s.tag==="ol"||s.tag==="li"?s.tag:s.block?"div":"span",i,r)};return n.map((s,e)=>o(s,t?{first:e===0,last:e===n.length-1}:null)).join("")}const xa=n=>({color:n.color,"font-family":n["font-family"],"font-size":n["font-size"],"font-weight":n["font-weight"],"font-style":n["font-style"]==="italic"?"italic":void 0,"letter-spacing":n["letter-spacing"],"line-height":n["line-height"],"word-break":n["word-break"]||void 0}),Et=n=>/px$/.test(n["line-height"]??"")?n["line-height"]:"1.6em";function At(n,{names:a=!0,gap:t=!0,frameless:k=!0,relayout:g=!1}={}){const o=n.messages.map((e,i)=>{const r=i===n.messages.length-1,l=a&&e.name?dn($("div",{...e.nameStyle,"line-height":"1.4",margin:"0 0 4px"},P(e.name)),"data-bl-name"):"",p={...e.bubble?{...e.bubble,padding:"8px 12px"}:{},margin:r?"0":`0 0 ${t?Et(e.font):"8px"}`};return dn($("div",p,l+Dn(e.nodes,{trimEdges:!0,relayout:g})),"data-bl-msg")}).join(""),s={"box-sizing":"border-box","max-width":"100%","background-color":n.base.bg,...xa(n.base),padding:"12px 16px","text-align":"left","overflow-wrap":"anywhere"};return k&&(s["border-radius"]="12px"),$("div",s,o)}const ua=n=>n.replace(/([\\`*_~[\]])/g,"\\$1").replace(/^(\s*)([#>+-]|\d+\.)(\s)/,"$1\\$2$3");function Kn(n,a){return n.map(t=>{if(t.t==="text")return a?ua(t.text):t.text;if(t.t==="br")return a?`  
`:`
`;if(t.t!=="el")return"";let k=Kn(t.children,a);if(!a||!k.trim())return k;const g=String(t.kind??"").split(" "),o=k.match(/^\s*/)[0],s=k.match(/\s*$/)[0];let e=k.trim();return g.includes("spoiler")?`${o}(숨긴 글: ${e.replace(/\s*\n+\s*/g," / ")})${s}`:(g.includes("code")&&(e=`\`${e.replace(/\\([\\`*_~[\]])/g,"$1").replace(/`/g,"ˋ")}\``),g.includes("del")&&(e=`~~${e}~~`),g.includes("em")&&(e=`*${e}*`),g.includes("strong")&&(e=`**${e}**`),k=o+e+s,k)}).join("")}function qn(n,a,t=0){const k=[];let g=[];const o=()=>{const s=Kn(g,a).replace(/[ \t]+\n/g,a?`  
`:`
`).trim();s&&k.push(s),g=[]};for(const s of n){if(s.t==="hr"){o(),k.push(a?"---":"―――");continue}if(s.t!=="el"||!s.block){g.push(s);continue}o();const e=qn(s.children,a,t+1);if(!e.length)continue;const i=s.kind;if(a&&i==="quote")k.push(e.join(`

`).split(`
`).map(r=>r?`> ${r}`:">").join(`
`));else if(a&&/^h[1-6]$/.test(i))k.push(`${"#".repeat(Number(i[1]))} ${e.join(" ")}`);else if(i==="ul"||i==="ol"){const r=s.children.filter(l=>l.t==="el");k.push(r.map((l,p)=>`${i==="ol"?`${p+1}.`:a?"-":"·"} ${qn(l.children,a,t+1).join(" ")}`).join(`
`))}else a&&i==="pre"?k.push(`\`\`\`
${Kn(s.children,!1)}
\`\`\``):k.push(...e)}return o(),k}function St(n,{names:a=!0,gap:t=!0}={}){return n.messages.map(k=>{const g=qn(k.nodes,!0).join(`

`);return(a&&k.name?`**${ua(k.name)}**

`:"")+g}).join(t?`

&nbsp;

`:`

`)+`
`}function Bt(n,{names:a=!0,gap:t=!0}={}){return n.messages.map(k=>{const g=qn(k.nodes,!1).join(`
`);return(a&&k.name?`${k.name}
`:"")+g}).join(t?`

`:`
`)+`
`}const Mt=["A","B","C"],ha=4.6,Nt=.18,wa=Object.freeze({fill:"#FFE23C",stroke:"#E9BE00"}),On=.04,$t=Object.freeze({dark:Object.freeze({card:"#25272b",log:"#1c1e21",line:"rgba(224, 224, 228, 0.09)",text:"#e1e1e5",dialogue:"#f5f5f7"}),light:Object.freeze({card:"#ffffff",log:"#f5f5f6",line:"rgba(20, 20, 24, 0.08)",text:"#26272b",dialogue:"#111113"})}),zn=n=>(n/=255,n<=.04045?n/12.92:((n+.055)/1.055)**2.4),ya=n=>255*(n<=.0031308?12.92*n:1.055*n**(1/2.4)-.055),Yn=n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0"),en=(n,a,t)=>`#${Yn(n)}${Yn(a)}${Yn(t)}`;function Q(n){const a=typeof n=="string"?O(n):n;if(!a)return null;const[t,k,g]=[a.r,a.g,a.b].map(zn),o=Math.cbrt(.4122214708*t+.5363325363*k+.0514459929*g),s=Math.cbrt(.2119034982*t+.6806995451*k+.1073969566*g),e=Math.cbrt(.0883024619*t+.2817188376*k+.6299787005*g),i=.2104542553*o+.793617785*s-.0040720468*e,r=1.9779984951*o-2.428592205*s+.4505937099*e,l=.0259040371*o+.7827717662*s-.808675766*e;let p=Math.atan2(l,r)*180/Math.PI;return p<0&&(p+=360),{l:i,c:Math.hypot(r,l),h:p}}function va(n,a,t){const k=a*Math.cos(t*Math.PI/180),g=a*Math.sin(t*Math.PI/180),o=(n+.3963377774*k+.2158037573*g)**3,s=(n-.1055613458*k-.0638541728*g)**3,e=(n-.0894841775*k-1.291485548*g)**3;return[4.0767416621*o-3.3077115913*s+.2309699292*e,-1.2684380046*o+2.6097574011*s-.3413193965*e,-.0041960863*o-.7034186147*s+1.707614701*e]}function D(n,a,t){let k=Math.max(0,a);const g=Math.min(1,Math.max(0,n));for(let o=0;o<60;o++){const s=va(g,k,t);if(s.every(e=>e>=-5e-4&&e<=1.0005))return en(...s.map(ya));k*=.94}return en(...va(g,0,t).map(ya))}function X(n,a,t=ha){const k=O(n),g=O(a);if(!k||!g)return null;const o=en(k.r,k.g,k.b);if(V(o,g)>=t)return o;const s=Q(o),e=jt(g)<.18;for(let i=1;i<=100;i++){const r=e?s.l+i*.01:s.l-i*.01;if(r<0||r>1)break;const l=D(r,s.c,s.h);if(V(l,g)>=t)return l}return e?"#f5f5f7":"#111113"}function jt({r:n,g:a,b:t}){return .2126*zn(n)+.7152*zn(a)+.0722*zn(t)}const qa=(n,a)=>{const t=O(n);return`rgba(${t.r}, ${t.g}, ${t.b}, ${a})`};function Y(n){const a=O(n);return a&&a.a>=.5?en(a.r,a.g,a.b):null}function Cn(n,a="dark"){const t=a==="dark",k=Y(n);if(!k)return t?"rgba(225, 225, 229, 0.14)":"rgba(17, 17, 17, 0.1)";const g=Q(k),o=g.c<On,s=t?Math.min(Math.max(g.l,.6),.82):Math.min(Math.max(g.l,.55),.72);return qa(D(s,g.c,g.h),o?t?.16:.14:Nt)}function fn(n,{mode:a="dark",plan:t="B"}={}){const k=a==="light"?"light":"dark",g=Mt.includes(t)?t:"B",o=k==="dark",s=Y(n);if(g!=="C"||!s){const c=$t[k],d={plan:g,mode:k,...c,band:Cn(s,k),name:c.text,title:c.text,rule:null,lemon:{...wa}};return g==="B"&&s&&(d.name=X(s,c.log),d.rule=X(s,c.card)),Object.freeze(d)}const e=Q(s),i=(c,d)=>Math.min(e.c*c,d),r=o?{card:D(.255,i(.42,.065),e.h),log:D(.205,i(.36,.055),e.h),text:D(.925,i(.06,.012),e.h),dialogue:D(.975,i(.03,.008),e.h)}:{card:D(.982,i(.16,.022),e.h),log:D(.955,i(.26,.035),e.h),text:D(.29,i(.22,.035),e.h),dialogue:D(.2,i(.18,.03),e.h)},l=qa(D(o?.7:.55,e.c,e.h),o?.22:.2);let p={...wa};if(o&&e.c>=On){const c=X(D(.8,e.c,e.h),r.card,3),d=O(c);p={fill:c.toUpperCase(),stroke:en(d.r*.75,d.g*.75,d.b*.75).toUpperCase()}}return Object.freeze({plan:g,mode:k,...r,line:l,band:Cn(s,k),name:X(s,r.log),title:X(s,r.card),rule:null,lemon:p})}const za=.04,kn=Object.freeze({c100:"#f1f1f3",c300:"#c9cacf",c500:"#8b8e96",c700:"#4c4e55",c900:"#26272b"}),Rt=Object.freeze({c100:{sat:.8,up:.85},c300:{sat:.95,up:.45},c700:{sat:.85,down:.62},c900:{sat:.7,down:.34}});function Gt({r:n,g:a,b:t}){const[k,g,o]=[n,a,t].map(c=>c/255),s=Math.max(k,g,o),e=Math.min(k,g,o),i=(s+e)/2,r=s-e;if(!r)return{h:0,s:0,l:i};const l=i>.5?r/(2-s-e):r/(s+e);return{h:(s===k?(g-o)/r+(g<o?6:0):s===g?(o-k)/r+2:(k-g)/r+4)*60,s:l,l:i}}function Ca(n,a,t){const k=g=>{const o=(g+n/30)%12,s=a*Math.min(t,1-t);return 255*(t-s*Math.max(-1,Math.min(o-3,9-o,1)))};return en(k(0),k(8),k(4))}function Lt(n,a,t,k,g){let o=Ca(n,a,t);for(let s=0;s<200&&(g?Q(o).l<k:Q(o).l>k)&&(t=g?Math.min(1,t+.005):Math.max(0,t-.005),o=Ca(n,a,t),!(t===0||t===1));s++);return o}function En(n){const a=Y(n);if(!a||Q(a).c<On)return kn;const{h:t,s:k,l:g}=Gt(O(a)),o=Q(a).l,s=f=>{const u=Rt[f];return{s:k*u.sat,l:u.up?g+(1-g)*u.up:g*u.down}},e=Math.min(za,(1-o)/3),i=Math.min(za,o/3),r=(f,u,b)=>{const x=s(f);return Lt(t,x.s,x.l,u,b)},l=r("c300",o+e,!0),p=r("c100",Q(l).l+e,!0),c=r("c700",o-i,!1),d=r("c900",Q(c).l-i,!1);return Object.freeze({c100:p,c300:l,c500:a,c700:c,c900:d})}const L=n=>Object.freeze(n);Object.freeze({"02":Object.freeze({light:L({face:"c100",innerLine:"c300",dots:"c300",back:"c300",rim:"c500",topBand:"c700"}),dark:L({face:"c900",rim:"c500",topBand:"c300",innerLine:"c700",dots:"c700",back:"c700"})}),"03":Object.freeze({light:L({marginLine:"c300",arrow:"c500",spine:"c700",underline:"c700"}),dark:L({spine:"c500",marginLine:"c700",underline:"c300",arrow:"c500"})}),"04":Object.freeze({light:L({rulerBase:"c300",cursor:"c500",tick5:"c500",triangle:"c700"}),dark:L({cursor:"c500",tick5:"c500",triangle:"c300",rulerBase:"c700"})}),"05":Object.freeze({light:L({clearWater:"c100",tagFace:"c100",saucerShadow:"c100",sparkle:"c300",steam:"c300",tea:"c500",teabag:"c700",tagRim:"c700"}),dark:L({tea:"c500",sparkle:"c300",steam:"c300",tagRim:"c300",teabag:"c700",clearWater:"c900",tagFace:"c900"})}),"06":Object.freeze({light:L({filledBar:"c700",restBar:"c300",recDot:"c500"}),dark:L({filledBar:"c100",restBar:"c700",recDot:"c500"})}),"07":Object.freeze({light:L({flameOuter:"c700",flameMid:"c500",wick:"c300",glow:"c300",litBorder:"c500",rule:"c500",head:"c900"}),dark:L({flameOuter:"c500",flameMid:"c300",wick:"c100",glow:"c500",litBorder:"c700",rule:"c500",head:"c900"})}),"08":Object.freeze({light:L({shade:"c100",slat:"c300",bottomBar:"c500",cord:"c500",weight:"c700"}),dark:null})});const Ea=["kkangtong","kkangtong-mini","kkangtong-deep"],An=Object.freeze({"font-family":"'Salty Text', RIDIBatang, 'Noto Serif KR', serif","font-size":"14.5px","line-height":"23.2px","letter-spacing":"-0.36px"}),In=/^[\s​]*["“「『‘'«〈《]/,Pt=/linear-gradient\([^)]*?((?:rgba?\([^)]*\))|#[0-9a-f]{3,8})/i,Aa=.06,K=n=>{const a=O(n);return a&&a.a>=.05?`#${[a.r,a.g,a.b].map(t=>t.toString(16).padStart(2,"0")).join("")}`:null},mn=n=>{const a=K(n);return!!a&&Q(a).c>=Aa},Sa=.08,Ba=n=>{const a=Q(n),t=a.h*Math.PI/180;return[a.l,a.c*Math.cos(t),a.c*Math.sin(t)]},Ma=(n,a)=>{const t=Ba(n),k=Ba(a);return Math.hypot(t[0]-k[0],t[1]-k[1],t[2]-k[2])},Zn=(n,a)=>{const t=K(n),k=K(a);return!!t&&!!k&&Ma(t,k)<Sa/2},_n=(n,a)=>{const t=K(n);if(!t)return!1;if(Q(t).c>=Aa)return!0;const k=K(a);return!!k&&Ma(t,k)>=Sa};function Hn(n){if(!n)return null;const a=n["background-image"];if(a&&/linear-gradient/i.test(a)){const k=a.match(Pt);if(k)return K(k[1])}const t=O(n["background-color"]);return t&&t.a>.02?K(n["background-color"]):null}const Tn=n=>(n??[]).some(a=>a.t==="el"&&!a.block&&(Hn(a.style)||Tn(a.children))),bn=n=>n.map(a=>a.t==="text"?a.text:a.children?bn(a.children):"").join("");function Na(n){let a=null,t=null,k=null;const g=(s,e)=>{for(const i of s??[])if(i.t==="el"){if(!i.block){const r=Hn(i.style);r&&mn(r)&&!a&&(a=r),!t&&i.style?.color&&mn(i.style.color)&&In.test(bn(i.children))&&(t=K(i.style.color)),!k&&i.style?.color&&!mn(i.style.color)&&_n(i.style.color,e)&&(Tn(i.children)||In.test(bn(i.children)))&&(k=K(i.style.color))}g(i.children,i.block&&i.style?.color?i.style.color:e)}};g(n?.nodes,n?.font?.color);const o=n?.nameStyle?.color&&mn(n.nameStyle.color)?K(n.nameStyle.color):null;return Y(a??t??k??o)}function Vn(n,a=null){const t=new Map,k=new Map;for(const e of n?.messages??[]){const i=String(e.name??"").trim();let r=null;try{r=Y(a?.(i))}catch{r=null}r??=Na(e),r&&!t.has(i)&&t.set(i,r),e.user||k.set(i,(k.get(i)??0)+bn(e.nodes).length)}const o=[...k.entries()].sort((e,i)=>i[1]-e[1]).map(([e])=>e).find(e=>t.has(e))??null,s=new Set((n?.messages??[]).map(e=>String(e.name??"").trim()).filter(Boolean));return{byName:t,main:o?t.get(o):null,mainName:o,count:s.size}}function Fn(n,a,{speakers:t=null,font:k=!0}={}){const g=c=>{const d=Cn(c,a.mode);return`linear-gradient(transparent 5%, ${d} 5%, ${d} 100%, transparent 100%)`},o=c=>c&&a.text;let s={};const e=c=>{if(k)for(const d of["font-family","font-size","line-height","letter-spacing"])c[d]&&c[d]===s[d]&&(c[d]=An[d])},i=(c,d,f)=>(c??[]).map(u=>{if(u.t!=="el")return u;const b={...u.style};a.mode==="light"&&delete b["text-shadow"],e(b);const x=u.children;if(u.block)return delete b["background-color"],delete b["background-image"],b.color&&(b.color=o(b.color)),{...u,style:b,children:i(x,d,u.style?.color||f)};const v=Hn(b);if(v){const w=mn(v)?v:d;return delete b["background-color"],b["background-image"]=g(w),b.color=a.dialogue,{...u,style:b,children:l(x),who:Y(w)}}if(b.color&&_n(b.color,f)&&Tn(x))return delete b.color,{...u,style:b,children:i(x,K(u.style.color)??d,f)};if(b.color&&_n(b.color,f)&&In.test(bn(x))){const w=K(b.color);return b["background-image"]=g(w),b.color=a.dialogue,{...u,style:b,children:l(x),who:w}}return b.color&&(b.color=o(b.color)),{...u,style:b,children:i(x,d,f)}}),r=new Set(["color","background-image","background-color"]),l=c=>(c??[]).map(d=>d.t==="el"?{...d,style:Object.fromEntries(Object.entries(d.style??{}).filter(([f])=>!r.has(f)&&!(a.mode==="light"&&f==="text-shadow"))),children:l(d.children)}:d),p=(n?.messages??[]).map(c=>{const d=t?.byName?.get(String(c.name??"").trim())??Na(c);s=c.font??{};const f={...c.font,color:a.text,...k?An:{}};return{...c,font:f,bubble:null,nodes:i(c.nodes,d,c.font?.color),speaker:d}});return{...n,messages:p,base:{...n.base,color:a.text,bg:a.log,...k?An:{}}}}const $a=n=>n?.family||"'Salty UI', Freesentation, 'Pretendard Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",Qt=(n,a)=>n.plan==="A"||!a?n.text:X(a,n.log)??n.text;function Dt(n,a,t,k){const g=t.names!==!1&&k.count>1,o=n.messages.map((e,i)=>{const r=i===n.messages.length-1,l=g&&e.name?dn($("div",{color:Qt(a,e.speaker),"font-family":e.font["font-family"],"font-size":"12.5px","font-weight":"650","line-height":"1.5","letter-spacing":e.font["letter-spacing"],margin:"0 0 2px","text-indent":"0"},P(e.name)),"data-bl-name"):"",p={margin:r?"0":`0 0 ${t.gap===!1?"8px":e.font["line-height"]||"1.6em"}`};return dn($("div",p,l+Dn(e.nodes,{trimEdges:!0,relayout:"justify"})),"data-bl-msg")}).join(""),s={"box-sizing":"border-box","max-width":"100%","background-color":a.log,color:a.text,...An,"font-weight":"400",padding:"12px 16px","text-align":"left","overflow-wrap":"anywhere"};return $("div",s,o)}const ja=(n,a)=>$("div",{"max-height":`${a}px`,"overflow-y":"auto","scrollbar-width":"none"},n);function Kt(n,a,t={}){if(!a?.messages?.length)return{html:"",tone:null,speakers:null};const k=n==="kkangtong-deep"?"C":"B",g=Vn(a,t.lookup),o=fn(g.main,{mode:t.mode==="light"?"light":"dark",plan:k}),s=Fn(a,o,{speakers:g,font:t.font!==!1}),e=Dt(s,o,t,g),i=t.ui??{},r={"box-sizing":"border-box","max-width":"100%","background-color":o.card,border:`1px solid ${o.line}`,"border-radius":"12px",overflow:"clip",color:o.text,"font-family":$a(i),"letter-spacing":i.tracking||"-0.025em","text-align":"left"};if(n==="kkangtong-mini")return{html:$("div",{...r,"background-color":o.log},ja(e,t.height??420)),tone:o,speakers:g};const l=String(t.fields?.title??"").trim(),p={color:o.title,"font-family":$a(i),"font-size":"20px","font-weight":"650","line-height":"1.4","word-break":"keep-all","overflow-wrap":"anywhere","min-height":"28px",...o.rule&&l?{"border-bottom":`2px solid ${o.rule}`,"padding-bottom":"4px"}:{}},c=$("div",{padding:"16px 16px 12px"},$("div",p,l?$("span",null,P(l)).replace("<span",'<span data-f="title"'):"")),d=$("div",{margin:"0 12px 12px","border-radius":"8px",overflow:"clip"},ja(e,t.height??420));return{html:$("div",r,c+d),tone:o,speakers:g}}const Ot=n=>Ea.includes(n);function Yt(n,a,t={}){const k=Vn(a,t.lookup);return{tone:fn(k.main,{mode:t.mode==="light"?"light":"dark",plan:n==="kkangtong-deep"?"C":"B"}),speakers:k}}function It(n,a,t){const k=new Map,g=Array.isArray(a)&&a.length===n?.length;return(n??[]).forEach((o,s)=>{const e=String(o?.name??"").trim();e&&!k.has(e)&&k.set(e,String((g?a[s]?.name:o?.name)??"").trim())}),o=>{try{return t?.(k.get(String(o??"").trim())??o)?.color??null}catch{return null}}}const _=Object.freeze({blockSep:`

`,cv:Object.freeze({bl:"#3aa7ff",pk:"#ff5fa2",mt:"#3ccfbf",yl:"#f0d878",pp:"#b799e8"}),faces:Object.freeze({k1:{orig:["#fbfbfa","#fbfbfa"],alt:["#25272b","#25272b"]},k2:{orig:["#ffffff","#f5f5f6"],alt:["#25272b","#1c1e21"]},k3:{orig:["#f8f9fa","#f8f9fa"],alt:["#25272b","#25272b"]},k4:{orig:["#ffffff","#ffffff"],alt:["#25272b","#1c1e21"]},k5:{orig:["#fbfaf7","#f3f1ec"],alt:["#25272b","#1c1e21"]},k6:{orig:["#25272b","#1c1e21"],alt:["#ffffff","#f5f5f6"]},k7:{orig:["#1f2124","#1f2124"],alt:["#fbfbfa","#fbfbfa"]},k8:{orig:["#13233b","#0d1a2d"],alt:["#ffffff","#f5f5f6"]}}),peek:Object.freeze(["k1","k5","k7","k8"]),extraSteps:Object.freeze([Object.freeze({s:.6,l:.16})]),tagMix:Object.freeze({light:.11,dark:.15}),mainOrder:Object.freeze(["M","A"]),ink:Object.freeze({"gk-tl":"#26272b","gk-td":"#e1e1e5","gk-tx":"#e4e9f0"})}),Ra=["gk-tl","gk-td","gk-tx"],Ga=["gk-tn-d","gk-tn-n"],Zt=/^gk-((?:k|q)\d+)$/,_t=/\.gk-[a-z]+[A-Z](?![\w-])|media-controls-timeline/,Ht=/^gk-([a-z]+)([A-Z])$/,Tt=["n","d","s","u"],Vt=/(?:#|%23)[0-9a-f]{6}(?![0-9a-f])/gi,Sn=(n,a)=>Object.prototype.hasOwnProperty.call(n,a),Ft=n=>{const a=/^#?([0-9a-f]{6})/i.exec(String(n||""));if(!a)return"";const[t,k,g]=[0,2,4].map(c=>parseInt(a[1].slice(c,c+2),16)/255),o=Math.max(t,k,g),s=Math.min(t,k,g),e=o-s,i=(o+s)/2;if(e<.08)return"";const r=(o===t?((k-g)/e+6)%6:o===k?(g-t)/e+2:(t-k)/e+4)*60,l=Math.round(((r-53)%360+360)%360),p=Math.min(1.15,Math.max(.8,.52+.765*i));return`invert(${i>=.6?".5":".55"}) sepia(1) saturate(9) hue-rotate(${l}deg) brightness(${Number(p.toFixed(2))})`},gn=n=>[1,3,5].map(a=>parseInt(n.slice(a,a+2),16)),La=n=>"#"+n.map(a=>Math.round(Math.min(255,Math.max(0,a))).toString(16).padStart(2,"0")).join("");function Wn(n){const[a,t,k]=gn(n).map(l=>l/255),g=Math.max(a,t,k),o=Math.min(a,t,k),s=(g+o)/2,e=g-o;if(!e)return[0,0,s];const i=s>.5?e/(2-g-o):e/(g+o);return[(g===a?(t-k)/e+(t<k?6:0):g===t?(k-a)/e+2:(a-t)/e+4)*60,i,s]}function Bn(n,a,t){const k=g=>{const o=(g+n/30)%12,s=a*Math.min(t,1-t);return 255*(t-s*Math.max(-1,Math.min(o-3,9-o,1)))};return La([k(0),k(8),k(4)])}const Xn=n=>(n/=255,n<=.03928?n/12.92:((n+.055)/1.055)**2.4),Un=n=>{const[a,t,k]=gn(n);return .2126*Xn(a)+.7152*Xn(t)+.0722*Xn(k)},Wt=(n,a)=>{const t=Un(n),k=Un(a);return(Math.max(t,k)+.05)/(Math.min(t,k)+.05)};function xn(n,a,t=4.6){let[k,g,o]=Wn(n);const s=Un(a)>.4?-.01:.01;for(let e=0;e<100&&Wt(Bn(k,g,o),a)<t;e++)o=Math.min(1,Math.max(0,o+s));return Bn(k,g,o)}const Xt=(n,a,t)=>{const k=gn(n),g=gn(a);return La(k.map((o,s)=>o*t+g[s]*(1-t)))},Ut=n=>`rgba(${gn(n).join(",")},.18)`,Jt=/^(\s*)<div\b([^>]*?)\sclass="(gk(?:\s[^"]*)?)"([^>]*)>(\s*)<style>((?:(?!<\/?style)[\s\S])*)<\/style>/;function sn(n){const a=[];let t=0,k="",g=0;for(let o=0;o<n.length;o++){const s=n[o];if(k){s==="\\"?o++:s===k&&(k="");continue}s==='"'||s==="'"?k=s:s==="{"?t++:s==="}"&&(t--,t===0&&(a.push(n.slice(g,o+1).trim()),g=o+1))}return a.filter(Boolean)}const I=n=>n.slice(0,n.indexOf("{")),F=n=>n.slice(n.indexOf("{")),Pa=n=>n==="gk-tl"?"light":"dark",ne=n=>n?n.slice(1):"none",ae=(n,a)=>/media-controls-timeline/.test(n)?[a||"?"]:[...n.matchAll(/\.gk-[a-z]+([A-Z])(?![\w-])/g)].map(t=>t[1]);function Jn(n){const a=String(n??""),t=a.match(Jt);if(!t)return null;const k=t[3].split(/\s+/).filter(Boolean),g=k.map(x=>(x.match(Zt)||[])[1]).find(Boolean)||"",o=/^k\d+$/.test(g)?Number(g.slice(1)):0,s=k.find(x=>Ra.includes(x))||null,e=k.find(x=>/^gk-cv-[\w-]+$/.test(x))||null,i=e?e.slice(6):null,r=i==null?void 0:i==="none"?null:_.cv[i]||(/^[0-9a-f]{6}$/.test(i)?`#${i}`:void 0),l=t[6].replace(/^\n/,"").replace(/\n$/,""),p=l.split(_.blockSep),c=a.slice(t.index+t[0].length),d=new Set;for(const[,x]of c.matchAll(/\sclass="([^"]*)"/g))for(const v of x.split(/\s+/))v&&d.add(v);const f=[...new Set([...d].map(x=>(x.match(Ht)||[])[2]).filter(Boolean))].sort(),u={};for(const x of sn(p.slice(1).join(`
`)))for(const v of I(x).split(",")){const w=(v.trim().match(/\.gk-([a-z]+)[A-Z]$/)||[])[1];if(!w||Tt.includes(w))continue;const C=u[w]??=new Set;for(const q of F(x).slice(1,-1).split(";")){const B=q.split(":")[0].trim();/color$/.test(B)&&B!=="-webkit-text-fill-color"&&C.add(B)}}const b=[...c.matchAll(/\sclass="[^"]*\bgk-sn\s+gk-s([A-Z])\b[^"]*"/g)].map(x=>x[1]);return{key:g,no:o,base:s,classes:k,cvClass:e,cvName:i,K0:r,css:l,parts:p,base_css:p[0],color_css:p.slice(1).join(`
`),speakers:f,extra:u,soundBy:b,used:d,imageBand:/\.gk-d[A-Z]\{background-image:/.test(p.slice(1).join(`
`)),audio:/<audio\b/.test(c),match:t}}function Qa(n,a){if(_.faces[n.key])return _.faces[n.key];const t=n.key.replace(/[^\w-]/g,""),k=sn(n.css),g=d=>{for(const f of k)for(const u of I(f).split(","))if(d.test(u.trim())){const b=(F(f).match(/background-color:\s*(#[0-9a-f]{6})/i)||[])[1];if(b)return b.toLowerCase()}return null},o="(?:\\.gk-cv-[\\w-]+)?",s=`(?:\\.${a})?`,e=g(new RegExp(`^\\.gk-${t}${o}${s}$`)),i=g(new RegExp(`^\\.gk-${t}${o}${s} \\.gk-lg$`)),r=g(new RegExp(`^\\.gk-${t}${o}\\.gk-tn-[nd]$`)),l=g(new RegExp(`^\\.gk-${t}${o}\\.gk-tn-[nd] \\.gk-lg$`)),p=Pa(a)==="light",c=d=>d?["#25272b","#1c1e21"]:["#ffffff","#f5f5f6"];return{orig:[e||c(!p)[0],i||e||c(!p)[1]],alt:[r||c(p)[0],l||r||c(p)[1]]}}function un(n){const a={};for(const t of sn(n)){const k=t.match(/\.gk-d([A-Z])\{background-color:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)||t.match(/\.gk-d([A-Z])\{background-image:[^}]*?rgba?%28(\d+),(\d+),(\d+)/);k&&!(k[1]in a)&&(a[k[1]]=Y(`rgb(${k[2]}, ${k[3]}, ${k[4]})`))}return a}function Da({sel:n,base:a,mode:t,card:k,log:g,speakers:o,colors:s,used:e,extra:i={}}){const r=[],l=t==="dark",p=fn(null,{mode:t});for(const c of o){const d=s[c]??null,f=d?xn(d,g):_.ink[a]||p.text,u=xn(d||kn.c500,k),b=Xt(d||kn.c500,l?g:"#ffffff",_.tagMix[l?"dark":"light"]),x=d?xn(d,b):f;e.has(`gk-d${c}`)&&r.push(`${n} .gk-d${c}{background-color:${d?Ut(d):Cn(null,t)}}`),e.has(`gk-n${c}`)&&r.push(`${n} .gk-nm.gk-n${c}{color:${f};-webkit-text-fill-color:${f}}`),e.has(`gk-s${c}`)&&r.push(`${n} .gk-sn.gk-s${c}{color:${x};-webkit-text-fill-color:${x};background-color:${b}}`),e.has(`gk-u${c}`)&&r.push(`${n} .gk-u${c}{background-color:${u}}`);for(const[v,w]of Object.entries(i))!e.has(`gk-${v}${c}`)||!w.size||r.push(`${n} .gk-${v}${c}{${[...w].map(C=>C==="color"?`color:${f};-webkit-text-fill-color:${f}`:`${C}:${u}`).join(";")}}`)}return r}function Ka(n){return n.classes.some(a=>Ga.includes(a))?n.base!=="gk-tl"?"gk-tl":new RegExp("\\.gk-tx(?![\\w-])").test(n.css)?"gk-tx":"gk-td":n.base}function Oa(n){const a=un(n.color_css);return n.speakers.find(t=>n.K0&&a[t]===n.K0)||_.mainOrder.find(t=>n.speakers.includes(t))||n.speakers[0]}const Ya=Symbol("원래 색");function te(n,a,{mode:t="dark",main:k,others:g={},cvTail:o="",colors0:s}={}){const e=Jn(n);if(!e||!e.key||!e.base||e.K0===void 0)return n;const i=a===Ya,r=i?e.K0:Y(a),l=Ka(e),p=Qa(e,l),c=Pa(l),d=t==="light"?"light":"dark",f=l==="gk-tl"?"gk-td":"gk-tl",u=d===c?l:f,b=d===c?null:d==="dark"?"gk-tn-n":"gk-tn-d",x=(i&&e.cvClass?e.cvClass:`gk-cv-${ne(r)}`)+(o?`-${o}`:""),v=m=>e.cvClass?m.split(`.${e.cvClass}`).join(`.${x}`):m,w=e.classes.filter(m=>m!=="gk"&&!Ra.includes(m)&&!Ga.includes(m)).map(m=>m===e.cvClass?x:m),C=["gk",u,b,...w].filter(Boolean).join(" "),q=s?{...s}:un(e.color_css),B=k||Oa(e);for(const m of Object.keys(q))e.speakers.includes(m)||e.speakers.push(m);e.speakers.sort();const Z=Object.fromEntries(e.speakers.map(m=>[m,m===B?r:Sn(g,m)?Y(g[m]):q[m]??null])),rn=m=>m!=="?"&&!(m!==B&&Sn(g,m)&&!Sn(q,m))&&(Z[m]??null)===(q[m]??null),R=e.soundBy[0],Mn=m=>{const y=I(m).split(",").filter(N=>ae(N,R).every(rn));return y.length?v(y.join(","))+F(m):null},z=e.speakers.filter(m=>!rn(m)),S=m=>`.gk-${e.key}.${x}.${m}`,G=e.imageBand?new Set([...e.used].filter(m=>!/^gk-d[A-Z]$/.test(m))):e.used,M=[...Da({sel:S(l),base:l,mode:c,card:p.orig[0],log:p.orig[1],speakers:z,colors:Z,used:G,extra:e.extra}),...Da({sel:S(f),base:f,mode:c==="light"?"dark":"light",card:p.alt[0],log:p.alt[1],speakers:z,colors:Z,used:G,extra:e.extra})];if(e.audio&&R&&!rn(R)){const m=Ft(Z[R]);m&&M.push(`.gk-${e.key}.gk-${e.key}.gk-${e.key}.${x} audio::-webkit-media-controls-timeline{filter:${m}!important}`)}const j=new Map,W=(m,y)=>{m&&y&&!j.has(m.toLowerCase())&&j.set(m.toLowerCase(),y.toLowerCase())},U=En(e.K0),H=En(r);for(const m of Object.keys(U))W(U[m],H[m]);const T=e.K0||kn.c500,J=r||kn.c500;for(const{s:m,l:y}of _.extraSteps){const[N,A,tn]=Wn(T),[ln,at,tt]=Wn(J);W(Bn(N,A*m,tn*y),Bn(ln,at*m,tt*y))}for(const m of[...p.orig,...p.alt,"#ffffff"])W(xn(T,m),xn(J,m));for(const m of z){if(m===B||!q[m])continue;const y=En(q[m]),N=En(Z[m]??null);for(const A of Object.keys(y))W(y[A],N[A])}const E=m=>gn(m||kn.c500).join(","),nn=m=>z.reduce((y,N)=>q[N]?y.split(`(${E(q[N])},`).join(`(${E(Z[N])},`).split(`rgb%28${E(q[N])}%29`).join(`rgb%28${E(Z[N])}%29`):y,m),Xa=m=>m.replace(Vt,y=>{const N=y[0]==="#"?"#":"%23",A=j.get(`#${y.slice(N.length).toLowerCase()}`);return A?N+A.slice(1):y}),ta=m=>/^\{background-image:/.test(F(m))&&/\.gk-d[A-Z](?![\w-])/.test(I(m)),ea=m=>sn(m).map(y=>ta(y)?v(I(y))+nn(F(y)):_t.test(I(y))?Mn(y):v(I(y))+nn(Xa(F(y)))).filter(Boolean),Nn=[];if(e.imageBand){const m=new RegExp(`\\.gk-d${B}(?![\\w-])`),y=sn(e.parts[1]||"").find(A=>ta(A)&&m.test(I(A))),N=sn(e.base_css).filter(A=>!A.startsWith("@")&&I(A).split(",").some(tn=>m.test(tn)));for(const A of z)if(!(Sn(q,A)||!y||!e.used.has(`gk-d${A}`))){for(const tn of N)Nn.push(I(tn).split(",").filter(ln=>m.test(ln)).map(ln=>ln.split(`.gk-d${B}`).join(`.gk-d${A}`)).join(",")+F(tn));Nn.push(v(I(y).split(`.gk-d${B}`).join(`.gk-d${A}`))+F(y).split(`rgb%28${E(q[B])}%29`).join(`rgb%28${E(Z[A])}%29`))}}const Ua=[...ea(e.parts[1]||""),...Nn,...M],Ja=e.parts.slice(2).flatMap(ea),nt=[e.base_css,Ua.join(`
`),Ja.join(`
`)].filter(Boolean).join(_.blockSep),an=e.match;let $n=`${an[1]}<div${an[2]} class="${C}"${an[4]}>${an[5]}<style>
${nt}
</style>`+n.slice(an.index+an[0].length);return $n=$n.replace(/(<audio\b[^>]*\sstyle="[^"]*color-scheme:)(light|dark)/g,`$1${d}`),$n}const ee=Object.freeze([["gk-tt","제목"],["gk-nr","지문"],["gk-nm","화자 이름"],["gk-dl","대사"],["gk-sd","소리 카드 — 이름표 글자 · audio 의 src(mp3 주소)"],["gk-hl","숨은 한 줄(찻물이 차면 나와요)"]]),ke="<!-- ▲ 위 스타일 칸은 틀 모양 · 색이에요(고치지 않아도 돼요) · ▼ 아래는 글 — 「✎」 주석 바로 뒤 요소의 글자만 바꿔요 · 대사 · 지문 줄은 복사해 늘리거나 지워도 돼요 -->";function Ia(n,{skip:a=[]}={}){const t=String(n??"");if(t.includes("「✎」"))return t;const k=t.indexOf("</style>");if(k<0)return t;const g=t.slice(0,k+8),o=t.slice(k+8),s=new Map(ee.filter(([i])=>!a.includes(i))),e=o.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\sclass="([^"]*)"/g,(i,r,l,p,c,d)=>{const f=p.split(/\s+/).find(u=>s.has(u));return!f||/<!--\s*✎[^>]*-->\s*$/.test(d.slice(Math.max(0,c-200),c))?i:`<!-- ✎ ${s.get(f)} -->${i}`});return`${g}
${ke}${e.startsWith(`
`)?"":`
`}${e}`}const ge=["data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 472 472%22%3E%3Cpath fill=%22%23FFE23C%22 fill-rule=%22evenodd%22 stroke=%22%23E9BE00%22 stroke-width=%2212%22 stroke-linejoin=%22round%22 transform=%22translate%2812 428%29 scale%281 -1%29%22 d=%22M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 104%22%3E%3Cpath d=%22M46 22V16Q46 8 38 8H28%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3Crect x=%2244%22 y=%2218%22 width=%224%22 height=%2286%22/%3E%3Crect x=%2240%22 y=%2297%22 width=%2212%22 height=%227%22 rx=%222%22/%3E%3Cpath d=%22M12 16L16 7H32L36 16Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22%3E%3Cpath d=%22M84.8 30.1L89.4 32.0M76.1 38.8L78.0 43.4M63.9 38.8L62.0 43.4M55.2 30.1L50.6 32.0M55.2 17.9L50.6 16.0M63.9 9.2L62.0 4.6M76.1 9.2L78.0 4.6M84.8 17.9L89.4 16.0%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22%3E%3Ccircle cx=%2234%22 cy=%2246%22 r=%2212%22/%3E%3Ccircle cx=%2284%22 cy=%2248%22 r=%2210%22/%3E%3Crect x=%2234%22 y=%2246%22 width=%2250%22 height=%2212%22/%3E%3Ccircle cx=%2252%22 cy=%2236%22 r=%2216%22/%3E%3Ccircle cx=%2270%22 cy=%2240%22 r=%2214%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Cpath d=%22M54 73.5C52.5 73.5 42 66 42 58C42 53.5 45.2 50.5 48.6 50.5C51 50.5 53 51.8 54 53.8C55 51.8 57 50.5 59.4 50.5C62.8 50.5 66 53.5 66 58C66 66 55.5 73.5 54 73.5Z%22 stroke=%22%23000%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Cg fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.6%22 stroke-linecap=%22round%22%3E%3Cpath d=%22M9.54 21.08A10.5 10.5 0 0 1 19.08 11.54%22/%3E%3Cpath stroke-opacity=%22.5%22 d=%22M29.87 25.59A10.5 10.5 0 0 1 27.42 29.42%22/%3E%3C/g%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 70%22%3E%3Cpath d=%22M40.0 28.0L34.0 28.0M42.7 18.0L37.5 15.0M50.0 10.7L47.0 5.5M60.0 8.0L60.0 2.0M70.0 10.7L73.0 5.5M77.3 18.0L82.5 15.0M80.0 28.0L86.0 28.0%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M12 5H24Q28 5 28 10Q28 15 24 15H12Q8 15 8 10Q8 5 12 5ZM20 8H23Q25 8 25 10Q25 12 23 12H20Q18 12 18 10Q18 8 20 8Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M58 51q-2 3 0 6t0 6t0 6t0 6t0 6t0 6M62 51q-2 3 0 6t0 6t0 6t0 6t0 6t0 6M66 51q-2 3 0 6t0 6t0 6t0 6t0 6t0 6%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22%3E%3Ccircle cx=%2288%22 cy=%2248%22 r=%2210%22/%3E%3Ccircle cx=%22108%22 cy=%2250%22 r=%228%22/%3E%3Crect x=%2288%22 y=%2248%22 width=%2220%22 height=%2210%22/%3E%3Ccircle cx=%2298%22 cy=%2240%22 r=%2212%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%226%22 height=%2214%22 viewBox=%220 0 6 14%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M3 13C0 10 6 8 3 5C1 3 4 2 3 1%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M32.4 39L34.8 56Q35.6 62 42 62L62 62Q68.4 62 69.2 56L71.6 39Z%22/%3E%3Cpath d=%22M31 76.4H73%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222.2%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M10 7C10 20 20 26 20 32C20 38 10 44 10 57H34C34 44 24 38 24 32C24 26 34 20 34 7Z%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cellipse cx=%2228%22 cy=%2254%22 rx=%2222%22 ry=%2226%22/%3E%3Cellipse cx=%2246%22 cy=%2254%22 rx=%2220%22 ry=%2224%22/%3E%3Cellipse cx=%2264%22 cy=%2254%22 rx=%2222%22 ry=%2226%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Cpath d=%22M54 73.5C52.5 73.5 42 66 42 58C42 53.5 45.2 50.5 48.6 50.5C51 50.5 53 51.8 54 53.8C55 51.8 57 50.5 59.4 50.5C62.8 50.5 66 53.5 66 58C66 66 55.5 73.5 54 73.5Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cpath d=%22M30 36Q20 54 30 72M62 36Q72 54 62 72M18 40Q12 54 18 68M74 40Q80 54 74 68%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M40 51q4 -5 8 0t8 0t8 0t8 0t8 0M32 58q4 -5 8 0t8 0t8 0t8 0t8 0t8 0t8 0%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Crect x=%223%22 y=%221.5%22 width=%2238%22 height=%225.5%22 rx=%222%22/%3E%3Crect x=%223%22 y=%2257%22 width=%2238%22 height=%225.5%22 rx=%222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Crect x=%225%22 y=%2266%22 width=%2218%22 height=%228%22 rx=%224%22/%3E%3Crect x=%2297%22 y=%2266%22 width=%2218%22 height=%228%22 rx=%224%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Cpath d=%22M4 33L8 30V42%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2236%22 viewBox=%220 0 44 36%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M4 36V14Q0 12 0 8Q0 0 8 0H36Q44 0 44 8Q44 12 40 14V36Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2232%22 viewBox=%220 0 44 32%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M4 32V14Q0 12 0 8Q0 0 8 0H36Q44 0 44 8Q44 12 40 14V32Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2232%22 viewBox=%220 0 44 32%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M8 32V12Q4 10 4 8Q4 4 8 4H36Q40 4 40 8Q40 10 36 12V32Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M2 0H9Q19 2 22 6V14Q19 18 9 20H2Q0 20 0 18V2Q0 0 2 0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M3 2H9Q17 4 20 7V13Q17 16 9 18H3Q2 18 2 17V3Q2 2 3 2Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Crect x=%2210%22 y=%227%22 width=%226%22 height=%226%22 rx=%222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Crect x=%224%22 y=%224%22 width=%228%22 height=%222%22 rx=%221%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2220%22 viewBox=%220 0 30 20%22 shape-rendering=%22geometricPrecision%22%3E%3Crect x=%227%22 y=%227%22 width=%226%22 height=%226%22 rx=%222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M36 54.5q4 -5 8 0t8 0t8 0t8 0t8 0t8 0%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 11C1 7.5 .5 5 .5 3.6C.5 2 1.8 1 3.2 1C4.4 1 5.4 1.7 6 2.8C6.6 1.7 7.6 1 8.8 1C10.2 1 11.5 2 11.5 3.6C11.5 5 11 7.5 6 11Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cpath d=%22M30 36Q20 54 30 72M62 36Q72 54 62 72%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Crect x=%2220%22 y=%2246%22 width=%2214%22 height=%2216%22 rx=%221.5%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Cpath d=%22M11 17A10.5 10.5 0 0 1 17 11.6%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%222%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M44 28C40 22 48 18 44 12%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M60 28C56 22 64 18 60 12%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Crect x=%226.2%22 y=%226%22 width=%221.6%22 height=%2252%22/%3E%3Crect x=%2236.2%22 y=%226%22 width=%221.6%22 height=%2252%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M52 28C48 21 56 16 52 8%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M36 38C30 32 42 27 36 16%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M49 36C43 30 55 25 49 14%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Cpath d=%22M32 22C34.3 25.5 35.5 27.8 35.5 30.3C35.5 33 34 35 32 35C30 35 28.5 33 28.5 30.3C28.5 27.8 29.7 25.5 32 22Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M59.4 49.3L60.6 50.7L95.4 19.5L92.6 16.5Z%22/%3E%3Cpath d=%22M64.4 51.3L65.6 52.7L101.4 23.6L98.6 20.4Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Cpath d=%22M29.5 35.5L41.5 52.6%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%226%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Cpath d=%22M32 13C36.5 20 39 24.5 39 29C39 33.8 35.9 36.8 32 36.8C28.1 36.8 25 33.8 25 29C25 24.5 27.5 20 32 13Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Cpath d=%22M30 20H66M30 30H54%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Cpath d=%22M25 6H63A13 13 0 0 1 76 19V31A13 13 0 0 1 63 44H30L16 54L20 43A13 13 0 0 1 12 31V19A13 13 0 0 1 25 6Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Cpath d=%22M29 6H67A13 13 0 0 1 80 19V31A13 13 0 0 1 72 43L76 54L62 44H29A13 13 0 0 1 16 31V19A13 13 0 0 1 29 6Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cpath d=%22M46.0 38.0L50.7 49.5L63.1 50.4L53.6 58.5L56.6 70.6L46.0 64.0L35.4 70.6L38.4 58.5L28.9 50.4L41.3 49.5Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cpath d=%22M46.0 41.0L49.8 50.7L60.3 51.4L52.2 58.0L54.8 68.1L46.0 62.5L37.2 68.1L39.8 58.0L31.7 51.4L42.2 50.7Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M53.5 42.6H66%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221.6%22 stroke-linecap=%22round%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%226%22 viewBox=%220 0 12 6%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M6 6H10V2Q10 0 8 0Q6 0 6 2Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%226%22 viewBox=%220 0 12 6%22 shape-rendering=%22geometricPrecision%22%3E%3Cpath d=%22M0 0H4V4Q4 6 2 6Q0 6 0 4Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M15.4 44L16.2 41.9L18.8 37.6L20.4 34.7L21 33H23L23.6 34.7L25.2 37.6L27.8 41.9L28.6 44Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M15.4 20L16.2 22.1L18.8 26.4L20.4 29.3L21 31H23L23.6 29.3L25.2 26.4L27.8 22.1L28.6 20Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Ccircle cx=%2220%22 cy=%2222%22 r=%2215%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%224%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6.0 0.8L7.4 4.5L11.3 4.7L8.3 7.1L9.3 10.9L6.0 8.8L2.7 10.9L3.7 7.1L0.7 4.7L4.6 4.5Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Cpath d=%22M32 6C38 16 42 22 42 28C42 34 37.5 38 32 38C26.5 38 22 34 22 28C22 22 26 16 32 6Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M11.8 55.6L12.4 50Q13.2 46.6 15.2 44Q22 39.5 28.8 44Q30.8 46.6 31.6 50L32.2 55.6Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M10 7C10 20 20 26 20 32C20 38 10 44 10 57H34C34 44 24 38 24 32C24 26 34 20 34 7Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Cpath d=%22M11.8 8.4L12.4 14Q13.2 17.4 15.2 20Q22 24.5 28.8 20Q30.8 17.4 31.6 14L32.2 8.4Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Cpath d=%22M28.6 34.2L31.8 38.8%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%226.8%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M32.4 39L34.8 56Q35.6 62 42 62L62 62Q68.4 62 69.2 56L71.6 39Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 92 82%22%3E%3Cpath d=%22M38 33Q41 26 42 20Q43 14 49 11L55 14Q51 18 51 23Q51 28 54 33Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%2248%22 y=%227.5%22 width=%2212%22 height=%2211%22 rx=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Crect x=%2241%22 y=%2246%22 width=%2210%22 height=%2211%22 rx=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Crect x=%2220%22 y=%2246%22 width=%2214%22 height=%2216%22 rx=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%2238%22 y=%221.5%22 width=%2220%22 height=%224%22 rx=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%22108%22 y=%225%22 width=%2212%22 height=%2216%22 rx=%223%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%2270%22 y=%229%22 width=%2226%22 height=%228%22 rx=%221.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Crect x=%2224%22 y=%2220%22 width=%2260%22 height=%2236%22 rx=%222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Crect x=%2217%22 y=%2258%22 width=%2286%22 height=%226%22 rx=%223%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%2258%22 y=%225%22 width=%2256%22 height=%2216%22 rx=%223%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Crect x=%2234%22 y=%224%22 width=%2228%22 height=%2218%22 rx=%224%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Crect x=%228%22 y=%2235%22 width=%2292%22 height=%2246%22 rx=%223%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22%3E%3Cpath d=%22M6 1C8 4 10 5.8 10 7.6A4 4 0 0 1 2 7.6C2 5.8 4 4 6 1Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Crect x=%2221.4%22 y=%2232.5%22 width=%221.2%22 height=%2222.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 64%22%3E%3Crect x=%2221.4%22 y=%229%22 width=%221.2%22 height=%2222.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M22 62H98L94 92Q93 100 85 100H35Q27 100 26 92Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Cellipse cx=%2232%22 cy=%2237.5%22 rx=%224.2%22 ry=%225.6%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 70%22%3E%3Cpath d=%22M0 62Q24 52 50 60T100 60Q112 58 120 62V70H0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 34 28%22%3E%3Cellipse cx=%224.4%22 cy=%2214%22 rx=%223.2%22 ry=%2211%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cellipse cx=%2260%22 cy=%2258%22 rx=%2241%22 ry=%229%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22%3E%3Cellipse cx=%2226%22 cy=%2226%22 rx=%2215%22 ry=%2222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22%3E%3Cellipse cx=%2226%22 cy=%2226%22 rx=%226%22 ry=%2222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 70%22%3E%3Cpath d=%22M0 54Q30 40 62 50T120 46V70H0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 68%22%3E%3Ccircle cx=%2270%22 cy=%2224%22 r=%2212%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 70%22%3E%3Ccircle cx=%2260%22 cy=%2228%22 r=%2216%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Ccircle cx=%2232%22 cy=%2225%22 r=%223.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Ccircle cx=%2244%22 cy=%2225%22 r=%223.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 84 60%22%3E%3Ccircle cx=%2256%22 cy=%2225%22 r=%223.5%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 34 28%22%3E%3Cpath d=%22M10 4.3L14 5.1V22.9L10 23.7Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 60%22%3E%3Ccircle cx=%2220%22 cy=%2222%22 r=%2214%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22%3E%3Ccircle cx=%2226%22 cy=%2226%22 r=%2222%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 104%22%3E%3Cpath d=%22M18 16H30A6 6 0 0 1 18 16Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 62%22%3E%3Cpath d=%22M0 8Q16 -2 32 8T64 8V62H0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 24%22%3E%3Cpath d=%22M0 7Q12 -1 24 7T48 7V24H0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22%3E%3Ccircle cx=%2226%22 cy=%227%22 r=%223%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 34 28%22%3E%3Cpath d=%22M4 3L30 8.5V19.5L4 25Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 108%22%3E%3Cpath d=%22M24 76H96L95 83H25Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 104%22%3E%3Cpath d=%22M14 16H34L44 104H0Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Cpath d=%22M11 81L54 50L97 81Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Cpath d=%22M8 35L54 63L100 35Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 122 26%22%3E%3Cpath d=%22M49 9H43L39 17H49Z%22/%3E%3C/svg%3E","data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 108 84%22%3E%3Cpath d=%22M8 35L54 7L100 35Z%22/%3E%3C/svg%3E"],na=n=>typeof n=="string"?n.replace(/\uE000(\d+)\uE001/g,(a,t)=>ge[t]):Array.isArray(n)?n.map(na):n&&typeof n=="object"?Object.fromEntries(Object.entries(n).map(([a,t])=>[a,na(t)])):n,se=Object.freeze([{id:"simple-k1",label:"낫표",emoji:"💬",desc:"제목 줄을 누르면 가운데 붙어 있던 「 」가 모서리로 벌어지며 글이 드러나요 · 다시 누르면 닫혀요",key:"k1",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k1 gk-cv-bl"><style>
.gk-k1{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k1 *{box-sizing:border-box}
.gk-k1 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k1 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k1 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k1 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k1 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k1 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k1 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k1 .gk-lg>p:last-child{margin-bottom:0}
.gk-k1 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k1 .gk-kx{display:block}
.gk-k1 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k1 summary{list-style:none}
.gk-k1 summary::-webkit-details-marker{display:none}
.gk-k1 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k1 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k1 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k1{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:10px;background-color:#fbfbfa}
.gk-k1 .gk-bx{display:flex;flex-direction:column;container-type:inline-size}
.gk-k1 .gk-kx,.gk-k1 .gk-fd{display:contents}
.gk-k1 .gk-tt{order:1}
.gk-k1 .gk-ul{order:2;align-self:flex-start}
.gk-k1 .gk-r1{display:block;order:3;margin:16px 0 -6px}
.gk-k1 .gk-sl{display:grid;order:4;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;transition:grid-template-rows .36s cubic-bezier(.2,.8,.2,1)}
.gk-k1 .gk-r2{display:block;order:5;margin-top:-6px}
.gk-k1 .gk-q1{display:block;width:11px;height:24px;border-top:2px solid #26272b;border-left:2px solid #26272b;transform:translate(calc(50cqw - 16px),0);transition:transform .36s cubic-bezier(.2,.8,.2,1)}
.gk-k1 .gk-q2{display:block;width:11px;height:24px;margin-left:auto;border-bottom:2px solid #26272b;border-right:2px solid #26272b;transform:translate(calc(-50cqw + 16px),0);transition:transform .36s cubic-bezier(.2,.8,.2,1)}
.gk-k1 .gk-lg{min-height:0;overflow:clip;padding:0 26px;opacity:0;clip-path:inset(0 50% 0 50%);transition:clip-path .36s cubic-bezier(.2,.8,.2,1),opacity .2s ease}
.gk-k1:not(:has(.gk-kx[open])) .gk-dl{animation:none!important}
.gk-k1:has(.gk-kx[open]) .gk-q1,.gk-k1:has(.gk-kx[open]) .gk-q2{transform:translate(0,0)}
.gk-k1:has(.gk-kx[open]) .gk-sl{grid-template-rows:1fr}
.gk-k1:has(.gk-kx[open]) .gk-lg{opacity:1;clip-path:inset(0 0 0 0)}
.gk-k1.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k1.gk-tn-n .gk-q1,.gk-k1.gk-tn-n .gk-q2{border-color:#e1e1e5}
.gk-k1 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
@media (prefers-reduced-motion:reduce){.gk-k1 *{animation:none!important;transition:none!important}.gk-k1 .gk-q1,.gk-k1 .gk-q2{transform:none!important}.gk-k1 .gk-sl{grid-template-rows:1fr!important}.gk-k1 .gk-lg{opacity:1!important;clip-path:none!important}}
.gk-k1 p strong,.gk-k1 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k1.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k1.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k1.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k1.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k1.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k1.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k1.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k1.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k1.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k1.gk-td .gk-uA{background-color:#3aa7ff}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-bx"><details class="gk-kx"><summary class="gk-fd" aria-label="낫표 열기"><span class="gk-tt">{{제목}}</span><span class="gk-ul gk-uA"></span><span class="gk-r1"><span class="gk-q1"></span></span><span class="gk-r2"><span class="gk-q2"></span></span></summary></details><div class="gk-sl"><div class="gk-lg">
{{로그}}
</div></div></div>
</div>`},{id:"simple-k2",label:"견출지",emoji:"🏷️",desc:"제목이 견출지 한 장 — 누르면 오른쪽 아래부터 스티커처럼 뜯기고, 점선 자리를 누르면 다시 붙어요",key:"k2",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k2 gk-va gk-cv-bl gk-noaud"><style>
.gk-k2{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k2 *{box-sizing:border-box}
.gk-k2 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k2 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k2 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k2 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k2 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k2 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k2 .gk-lg>p:last-child{margin-bottom:0}
.gk-k2 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k2 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k2.gk-noaud .gk-sd{display:none}
.gk-k2 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k2 audio{display:block}
.gk-k2 .gk-kx{display:block}
.gk-k2 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k2 summary{list-style:none}
.gk-k2 summary::-webkit-details-marker{display:none}
.gk-k2 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k2 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k2 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k2{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k2 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-k2 .gk-lb{padding:3px;border-radius:8px}
.gk-k2 .gk-lb .gk-tt{margin:0;padding:6px 14px 7px;border-radius:4px}
.gk-k2 .gk-pw{display:inline-grid;max-width:100%;margin-top:12px}
.gk-k2 .gk-pw .gk-k0{display:block;grid-area:1/1/2/2;width:0;height:0;block-size:0}
.gk-k2 .gk-un{display:block;grid-area:1/1/2/2;border-radius:8px}
.gk-k2.gk-va .gk-lb{display:grid;grid-area:1/1/2/2;min-width:220px;clip-path:polygon(0 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%);transition:clip-path .4s ease-out,transform .4s cubic-bezier(.2,.9,.3,1.12),opacity .1s ease}
.gk-k2.gk-va .gk-lb .gk-tt{grid-area:1/1/2/2}
.gk-k2 .gk-fw{display:grid;grid-area:1/1/2/2;filter:drop-shadow(-1px -1px 1.5px rgba(20,20,24,.28))}
.gk-k2 .gk-fc{display:block;grid-area:1/1/2/2;clip-path:polygon(calc(100% - 13px) 100%,100% calc(100% - 13px),calc(100% - 13px) calc(100% - 13px));transition:clip-path .4s ease-out,transform .4s cubic-bezier(.2,.9,.3,1.12),opacity .1s ease}
.gk-k2.gk-va:has(.gk-kx[open]) .gk-lb{clip-path:polygon(0 0,59px 0,59px 0,0 100%,0 100%);opacity:0;transform:translate(-10px,-12px) rotate(-5deg) scale(1.03);transition:none;animation:gk-pf .58s linear 0s 1}
.gk-k2.gk-va:has(.gk-kx[open]) .gk-fc{clip-path:polygon(0 100%,59px 0,0 0);opacity:0;transform:translate(-10px,-12px) rotate(-5deg) scale(1.03);transition:none;animation:gk-pb .58s linear 0s 1}
.gk-k2.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k2.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-k2 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes gk-pf{0%{clip-path:polygon(0 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%);opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}30%{clip-path:polygon(0 0,100% 0,100% calc(100% - 59px),calc(100% - 59px) 100%,0 100%);opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}85%{clip-path:polygon(0 0,59px 0,59px 0,0 100%,0 100%);opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}100%{clip-path:polygon(0 0,59px 0,59px 0,0 100%,0 100%);opacity:0;transform:translate(-10px,-12px) rotate(-5deg) scale(1.03)}}
@keyframes gk-pb{0%{clip-path:polygon(calc(100% - 13px) 100%,100% calc(100% - 13px),calc(100% - 13px) calc(100% - 13px));opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}30%{clip-path:polygon(calc(100% - 59px) 100%,100% calc(100% - 59px),calc(100% - 59px) calc(100% - 59px));opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}85%{clip-path:polygon(0 100%,59px 0,0 0);opacity:1;transform:translate(0,0) rotate(0deg) scale(1)}100%{clip-path:polygon(0 100%,59px 0,0 0);opacity:0;transform:translate(-10px,-12px) rotate(-5deg) scale(1.03)}}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-panel,.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-play-button,.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-current-time-display,.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k2 p strong,.gk-k2 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k2.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k2.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k2.gk-tl .gk-nm.gk-nA,.gk-k2.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k2.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k2.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k2.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k2.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k2.gk-td .gk-nm.gk-nA,.gk-k2.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k2.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k2.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-k2.gk-k2.gk-k2 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k2.gk-cv-bl .gk-lb{border:2px solid #3aa7ff;border-top:9px solid #0f6ab4;background-color:#e4f1fc}
.gk-k2.gk-cv-bl .gk-lb .gk-tt{border:1px solid #95cefc;background-color:#e4f1fc}
.gk-k2.gk-cv-bl .gk-un{border:1px dashed #95cefc}
.gk-k2.gk-cv-bl .gk-fc{background-color:#95cefc}
.gk-k2.gk-cv-bl.gk-tn-n .gk-lb{border-color:#3aa7ff;border-top-color:#95cefc;background-color:#10395a}
.gk-k2.gk-cv-bl.gk-tn-n .gk-lb .gk-tt{border-color:#0f6ab4;background-color:#10395a}
.gk-k2.gk-cv-bl.gk-tn-n .gk-un{border-color:#0f6ab4}
.gk-k2.gk-cv-bl.gk-tn-n .gk-fc{background-color:#0f6ab4}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<details class="gk-kx"><summary class="gk-pw" aria-label="견출지 떼었다 붙이기"><span class="gk-k0"></span><span class="gk-un"></span><span class="gk-lb"><span class="gk-tt">{{제목}}</span></span><span class="gk-fw"><span class="gk-fc"></span></span></summary></details>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k3",label:"바인더",emoji:"🗂️",desc:"바인더 등 · 금속 고리 셋 · 여백 줄 — 오른쪽 아래 「1 / 2」를 누르면 종이가 옆으로 밀리며 다음 장",key:"k3",peek:!1,open:!1,pages:2,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#f8f9fa",log:"#f8f9fa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k3 gk-cv-pk"><style>
.gk-k3{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k3 *{box-sizing:border-box}
.gk-k3 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k3 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k3 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k3 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k3 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k3 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k3 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k3 .gk-lg>p:last-child{margin-bottom:0}
.gk-k3 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k3 .gk-kx{display:block}
.gk-k3 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k3 summary{list-style:none}
.gk-k3 summary::-webkit-details-marker{display:none}
.gk-k3 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k3 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k3 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k3{display:grid;grid-template-columns:44px minmax(0,1fr);border:1px solid rgba(20,20,24,.10);border-radius:8px;background-color:#f8f9fa}
.gk-k3 .gk-gt{display:flex;flex-direction:column;justify-content:space-around;align-items:flex-start;padding:26px 0}
.gk-k3 .gk-rn{display:block;width:33px;height:22px;block-size:22px;background-repeat:no-repeat;background-size:100% 100%}
.gk-k3 .gk-mn{min-width:0;padding:16px 20px 6px 18px}
.gk-k3 .gk-pp{display:grid;grid-template-columns:minmax(0,1fr);margin-top:16px}
.gk-k3 .gk-pp>.gk-lg{grid-area:1/1/2/2;min-width:0;transition:opacity .35s ease,transform .35s ease,visibility 0s linear .35s}
.gk-k3 .gk-p2{opacity:0;visibility:hidden;transform:translateX(14px)}
.gk-k3:has(.gk-kx[open]) .gk-p1{opacity:0;visibility:hidden;transform:translateX(-14px)}
.gk-k3:has(.gk-kx[open]) .gk-p1 .gk-dl,.gk-k3:not(:has(.gk-kx[open])) .gk-p2 .gk-dl{animation:none!important}
.gk-k3:has(.gk-kx[open]) .gk-p2{opacity:1;visibility:visible;transform:translateX(0);transition:opacity .35s ease,transform .35s ease,visibility 0s linear 0s}
.gk-k3:not(:has(.gk-kx[open])) .gk-p1{transition:opacity .35s ease,transform .35s ease,visibility 0s linear 0s}
.gk-k3 .gk-pg{display:flex;justify-content:flex-end;align-items:center;min-height:44px;margin-top:4px;font:500 11px/1 ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;font-variant-numeric:tabular-nums;color:#5f6168;-webkit-text-fill-color:#5f6168}
.gk-k3 .gk-n2{display:none}
.gk-k3:has(.gk-kx[open]) .gk-n1{display:none}
.gk-k3:has(.gk-kx[open]) .gk-n2{display:inline}
.gk-k3 .gk-ch{display:block;width:7px;height:7px;margin:0 3px 0 9px;transform:rotate(45deg);transition:transform .3s ease}
.gk-k3:has(.gk-kx[open]) .gk-ch{margin:0 0 0 12px;transform:rotate(225deg)}
.gk-k3.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k3.gk-tn-n .gk-pg{color:#9a9da6;-webkit-text-fill-color:#9a9da6}
.gk-k3 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
.gk-k3 .gk-rn{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 33 22%22%3E%3Ccircle cx=%2224%22 cy=%2213%22 r=%224.6%22 fill=%22%2316171a%22 stroke=%22rgba%2820,20,24,.3%29%22 stroke-width=%221%22/%3E%3Cpath d=%22M24 13C24 2 1 2 1 13%22 fill=%22none%22 stroke=%22%238f9299%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M21.5 8C18.5 4.6 7 4.6 4 8%22 fill=%22none%22 stroke=%22%23e3e4e8%22 stroke-width=%221%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k3.gk-tn-n .gk-rn{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 33 22%22%3E%3Ccircle cx=%2224%22 cy=%2213%22 r=%224.6%22 fill=%22%230f1012%22 stroke=%22rgba%28224,224,228,.28%29%22 stroke-width=%221%22/%3E%3Cpath d=%22M24 13C24 2 1 2 1 13%22 fill=%22none%22 stroke=%22%23a9acb4%22 stroke-width=%223%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M21.5 8C18.5 4.6 7 4.6 4 8%22 fill=%22none%22 stroke=%22%23f1f1f3%22 stroke-width=%221%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k3 p strong,.gk-k3 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k3.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k3.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k3.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k3.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k3.gk-tl .gk-uB{background-color:#c81e6a}
.gk-k3.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k3.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k3.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k3.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k3.gk-td .gk-uB{background-color:#ff5fa2}

.gk-k3.gk-cv-pk .gk-gt{border-left:10px solid #c9105e;border-right:1px solid #fda9cc}
.gk-k3.gk-cv-pk .gk-ch{border-top:2px solid #ff5fa2;border-right:2px solid #ff5fa2}
.gk-k3.gk-cv-pk .gk-ul{background-color:#c9105e}
.gk-k3.gk-cv-pk.gk-tn-n .gk-gt{border-left-color:#ff5fa2;border-right-color:#c9105e}
.gk-k3.gk-cv-pk.gk-tn-n .gk-ul{background-color:#fda9cc}
</style>
<div class="gk-gt"><span class="gk-rn"></span><span class="gk-rn"></span><span class="gk-rn"></span></div>
<div class="gk-mn">
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span>
<div class="gk-pp"><div class="gk-lg gk-p1">
{{로그}}
</div><div class="gk-lg gk-p2">
{{로그:2}}
</div></div>
<details class="gk-kx"><summary class="gk-pg" aria-label="쪽 넘기기"><span class="gk-n1">1 / 2</span><span class="gk-n2">2 / 2</span><span class="gk-ch"></span></summary></details>
</div>
</div>`},{id:"simple-k4",label:"줄자",emoji:"📏",desc:"위에 0~30cm 자 · 제목 끝 커서 — 자 위에서 휠(폰은 옆으로 밀기) · 세모 줄을 누르면 첫 줄 들여쓰기 켬/끔",key:"k4",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#ffffff",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k4 gk-cv-bl"><style>
.gk-k4{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k4 *{box-sizing:border-box}
.gk-k4 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k4 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k4 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k4 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k4 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k4 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k4 .gk-lg>p:last-child{margin-bottom:0}
.gk-k4 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k4 .gk-kx{display:block}
.gk-k4 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k4 summary{list-style:none}
.gk-k4 summary::-webkit-details-marker{display:none}
.gk-k4 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k4 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k4 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k4{border:1px solid rgba(20,20,24,.12);border-radius:8px;background-color:#ffffff}
.gk-k4 .gk-ru{display:block;padding-bottom:4px}
.gk-k4 .gk-rl{display:block;container-type:size;height:30px;block-size:30px;overflow:clip;background-color:#f1f2f4}
.gk-k4 .gk-rs{display:flex;width:100%;height:30px;block-size:30px;overflow-x:auto;overflow-y:clip;scrollbar-width:none;-ms-overflow-style:none}
.gk-k4 .gk-rs::-webkit-scrollbar{display:none;width:0;height:0}
.gk-k4 .gk-rc{display:block;flex:0 0 auto;width:calc(30cm + 43px);height:30px;block-size:30px}
.gk-k4 .gk-rr{display:flex;align-items:stretch;width:calc(30cm + 43px);height:30px;block-size:30px;padding-left:19px}
.gk-k4 .gk-cm{display:flex;flex:0 0 1cm;flex-direction:column;justify-content:space-between;width:1cm}
.gk-k4 .gk-cm.gk-e{flex-basis:24px;width:24px}
.gk-k4 .gk-nb{display:block;padding-left:3px;font:500 9px/15px ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;font-variant-numeric:tabular-nums;color:#5f6168;-webkit-text-fill-color:#5f6168}
.gk-k4 .gk-mm{display:flex;align-items:flex-end;height:12px;block-size:12px}
.gk-k4 .gk-mm span{display:block;flex:0 0 1mm;width:1mm;height:5px;border-left:1px solid rgba(20,20,24,.32)}
.gk-k4 .gk-mm span.gk-h{height:8px}
.gk-k4 .gk-mm span.gk-b{height:12px;border-left-color:rgba(20,20,24,.62)}
@media (hover:hover) and (pointer:fine) and (min-width:560px){.gk-k4 .gk-rs{display:block;width:100cqh;height:100cqw;block-size:100cqw;overflow-x:clip;overflow-y:auto;transform:rotate(-90deg) translateX(-100%);transform-origin:0 0}.gk-k4 .gk-rc{width:100%;height:calc(30cm + 43px);block-size:calc(30cm + 43px)}.gk-k4 .gk-rr{transform:rotate(90deg) translateY(-100%);transform-origin:0 0}}
.gk-k4 .gk-ms{display:flex;align-items:flex-start;height:13px;block-size:13px;padding:0 15px 0 29px;border-bottom:1px solid rgba(20,20,24,.12);background-color:#f1f2f4}
.gk-k4 .gk-t2{margin-left:auto}
.gk-k4 .gk-tr{display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;transition:transform .25s ease}
.gk-k4:has(.gk-kx[open]) .gk-t1{transform:translateX(-14px)}
.gk-k4 .gk-in{padding:10px 20px 20px}
.gk-k4 .gk-cr{display:inline-block;width:2px;height:21px;margin-left:4px;border-radius:1px;vertical-align:-4px}
.gk-k4 .gk-lg{margin-top:16px}
.gk-k4 .gk-lg p{transition:text-indent .25s ease}
.gk-k4:has(.gk-kx[open]) .gk-lg p{text-indent:0}
.gk-k4.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k4.gk-tn-n .gk-rl{background-color:#1c1e21}
.gk-k4.gk-tn-n .gk-ms{border-bottom-color:rgba(224,224,228,.12);background-color:#1c1e21}
.gk-k4.gk-tn-n .gk-nb{color:#9a9da6;-webkit-text-fill-color:#9a9da6}
.gk-k4.gk-tn-n .gk-mm span{border-left-color:rgba(224,224,228,.32)}
.gk-k4.gk-tn-n .gk-mm span.gk-b{border-left-color:rgba(224,224,228,.62)}
.gk-k4 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes gk-cr{0%{opacity:1}50%{opacity:0}100%{opacity:0}}
.gk-k4 p strong,.gk-k4 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k4.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k4.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k4.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k4.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k4.gk-tl .gk-cA{background-color:#0a69ae}
.gk-k4.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k4.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k4.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k4.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k4.gk-td .gk-cA{background-color:#3aa7ff}

.gk-k4.gk-cv-bl .gk-ms{border-top:2px solid #95cefc}
.gk-k4.gk-cv-bl .gk-cm.gk-f .gk-mm span.gk-b{border-left:2px solid #3aa7ff}
.gk-k4.gk-cv-bl .gk-tr{border-top:7px solid #0f6ab4}
.gk-k4.gk-cv-bl .gk-cr{background-color:#3aa7ff}
.gk-k4.gk-cv-bl.gk-tn-n .gk-ms{border-top-color:#0f6ab4}
.gk-k4.gk-cv-bl.gk-tn-n .gk-cm.gk-f .gk-mm span.gk-b{border-left-color:#3aa7ff}
.gk-k4.gk-cv-bl.gk-tn-n .gk-tr{border-top-color:#95cefc}
</style>
<details class="gk-kx"><summary class="gk-ru" aria-label="들여쓰기 바꾸기"><span class="gk-rl"><span class="gk-rs"><span class="gk-rc"><span class="gk-rr" aria-hidden="true"><span class="gk-cm gk-f"><span class="gk-nb">0</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">1</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">2</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">3</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">4</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-f"><span class="gk-nb">5</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">6</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">7</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">8</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">9</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-f"><span class="gk-nb">10</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">11</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">12</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">13</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">14</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-f"><span class="gk-nb">15</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">16</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">17</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">18</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">19</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-f"><span class="gk-nb">20</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">21</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">22</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">23</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">24</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-f"><span class="gk-nb">25</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">26</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">27</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">28</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm"><span class="gk-nb">29</span><span class="gk-mm"><span class="gk-b"></span><span></span><span></span><span></span><span></span><span class="gk-h"></span><span></span><span></span><span></span><span></span></span></span><span class="gk-cm gk-e gk-f"><span class="gk-nb">30</span><span class="gk-mm"><span class="gk-b"></span></span></span></span></span></span></span><span class="gk-ms"><span class="gk-tr gk-t1"></span><span class="gk-tr gk-t2"></span></span></summary></details>
<div class="gk-in">
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}<span class="gk-cr gk-cA" style="animation:gk-cr 1.1s steps(1,end) 0s infinite"></span></div>
<div class="gk-lg">
{{로그}}
</div>
</div>
</div>`},{id:"simple-k5",label:"티백",emoji:"🍵",desc:"옆에서 본 찻잔 · 흔들리는 꼬리표 · 김 — 찻잔을 누르면 캐릭터 색 찻물이 차오르고 숨은 한 줄이 나와요",key:"k5",peek:!0,open:!1,hidden:!0,main:"M",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfaf7",log:"#f3f1ec",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k5 gk-cv-pk"><style>
.gk-k5{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k5 *{box-sizing:border-box}
.gk-k5 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k5 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k5 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k5 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k5 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k5 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k5 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k5 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k5 .gk-lg>p:last-child{margin-bottom:0}
.gk-k5 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k5 .gk-ft{display:flex;justify-content:flex-end;align-items:center;margin-top:12px}
.gk-k5 .gk-kx{display:block}
.gk-k5 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k5 summary{list-style:none}
.gk-k5 summary::-webkit-details-marker{display:none}
.gk-k5 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k5 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k5 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k5{padding:16px 20px 12px;border:1px solid rgba(40,34,24,.12);border-radius:12px;background-color:#fbfaf7}
.gk-k5 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f3f1ec}
.gk-k5 .gk-ft{justify-content:space-between;align-items:center;gap:12px;margin-top:6px}
.gk-k5 .gk-hl{display:block;min-width:0;padding-left:2px;font:italic 400 13.5px/1.6 "RIDIBatang","Noto Serif KR",serif;color:#4a4843;-webkit-text-fill-color:#4a4843;opacity:0;transition:opacity 1.6s ease .5s}
.gk-k5 .gk-kx{flex:0 0 76px;width:76px;height:78px;block-size:78px}
.gk-k5 .gk-cup{display:grid;grid-template-columns:76px;grid-template-rows:78px;width:76px;height:78px;block-size:78px;line-height:0}
.gk-k5 .gk-sw{display:grid;grid-template-columns:76px;grid-template-rows:78px;transform-origin:22px 33.6px}
.gk-k5 .gk-stm{opacity:0}
.gk-k5 .gk-tea{transform-origin:50% 39px;transform:scaleY(0);opacity:0;transition:transform 1.8s cubic-bezier(.3,0,.3,1),opacity 1.2s ease}
.gk-k5:has(.gk-kx[open]) .gk-tea{transform:scaleY(1);opacity:1}
.gk-k5 .gk-tea2{opacity:0;transition:opacity .8s ease 1.2s}
.gk-k5:has(.gk-kx[open]) .gk-tea2{opacity:1}
.gk-k5:has(.gk-kx[open]) .gk-hl{opacity:1}
.gk-k5.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k5.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-k5.gk-tn-n .gk-hl{color:#c9cacf;-webkit-text-fill-color:#c9cacf}
.gk-k5 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
.gk-k5 .gk-m-st0{-webkit-mask-image:url('33');mask-image:url('33')}
.gk-k5 .gk-m-st1{-webkit-mask-image:url('36');mask-image:url('36')}
.gk-k5 .gk-m-st2{-webkit-mask-image:url('34');mask-image:url('34')}
.gk-k5 .gk-b-cup{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M20 67.5H84Q80 73.5 70 73.5H34Q24 73.5 20 67.5Z%22 fill=%22%23ffffff%22 stroke=%22%234a4843%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/%3E%3Cpath d=%22M73 40C85 38 87 54 71.5 55.5%22 fill=%22none%22 stroke=%22%234a4843%22 stroke-width=%221.6%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M30 34L33 56Q34 64 42 64L62 64Q70 64 71 56L74 34Z%22 fill=%22%23ffffff%22 stroke=%22%234a4843%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E')}
.gk-k5 .gk-m-wat{-webkit-mask-image:url('11');mask-image:url('11')}
.gk-k5 .gk-m-liq{-webkit-mask-image:url('60');mask-image:url('60')}
.gk-k5 .gk-m-bag{-webkit-mask-image:url('63');mask-image:url('63')}
.gk-k5 .gk-m-hl{-webkit-mask-image:url('48');mask-image:url('48')}
.gk-k5 .gk-b-str{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M46 46.2L36 33.6%22 fill=%22none%22 stroke=%22%234a4843%22 stroke-width=%221.1%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k5 .gk-b-st2{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M36 33.6Q30 30.4 28.4 37L27 46%22 fill=%22none%22 stroke=%22%234a4843%22 stroke-width=%221.1%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k5 .gk-m-tgf{-webkit-mask-image:url('64');mask-image:url('64')}
.gk-k5 .gk-m-tgs{-webkit-mask-image:url('31');mask-image:url('31')}
.gk-k5.gk-tn-n .gk-b-cup{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M20 67.5H84Q80 73.5 70 73.5H34Q24 73.5 20 67.5Z%22 fill=%22%23303238%22 stroke=%22%23e1e1e5%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/%3E%3Cpath d=%22M73 40C85 38 87 54 71.5 55.5%22 fill=%22none%22 stroke=%22%23e1e1e5%22 stroke-width=%221.6%22 stroke-linecap=%22round%22/%3E%3Cpath d=%22M30 34L33 56Q34 64 42 64L62 64Q70 64 71 56L74 34Z%22 fill=%22%23303238%22 stroke=%22%23e1e1e5%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E')}
.gk-k5.gk-tn-n .gk-b-str{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M46 46.2L36 33.6%22 fill=%22none%22 stroke=%22%23e1e1e5%22 stroke-width=%221.1%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k5.gk-tn-n .gk-b-st2{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2214 0 76 78%22%3E%3Cpath d=%22M36 33.6Q30 30.4 28.4 37L27 46%22 fill=%22none%22 stroke=%22%23e1e1e5%22 stroke-width=%221.1%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
@keyframes gk-tb{0%{transform:rotate(5deg)}100%{transform:rotate(-4deg)}}
@keyframes gk-sm{0%{opacity:0;transform:translateY(4px)}35%{opacity:.75}100%{opacity:0;transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){.gk-k5 *{animation:none!important;transition:none!important}.gk-k5 .gk-stm{opacity:.6}}
.gk-k5 p strong,.gk-k5 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k5.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k5.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k5.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k5.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k5.gk-cv-pk .gk-nm.gk-nM{color:#d40059;-webkit-text-fill-color:#d40059}
.gk-k5.gk-cv-pk .gk-dM{background-color:rgba(255,95,162,.18)}
.gk-k5.gk-cv-pk .gk-uM{background-color:#de005d}
.gk-k5.gk-cv-pk.gk-tn-n .gk-nm.gk-nM{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k5.gk-cv-pk.gk-tn-n .gk-uM{background-color:#ff5fa2}

.gk-k5.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-k5.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-k5.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-k5.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-k5.gk-cv-pk.gk-tn-n .gk-m-wat{background-color:#651235}
.gk-k5.gk-cv-pk.gk-tn-n .gk-m-tgf{background-color:#651235}
.gk-k5.gk-cv-pk.gk-tn-n .gk-m-tgs{background-color:#fda9cc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uM"></span>
<div class="gk-lg">
{{로그}}
</div>
<div class="gk-ft"><span class="gk-hl">{{숨은줄}}</span><details class="gk-kx"><summary class="gk-cup" aria-label="차 우리기"><span class="gk-ly gk-m-st0 gk-c3 gk-stm" style="animation:gk-sm 3.6s ease-in-out 0.0s infinite"></span><span class="gk-ly gk-m-st1 gk-c3 gk-stm" style="animation:gk-sm 3.6s ease-in-out 1.2s infinite"></span><span class="gk-ly gk-m-st2 gk-c3 gk-stm" style="animation:gk-sm 3.6s ease-in-out 2.4s infinite"></span><span class="gk-ly gk-b-cup"></span><span class="gk-ly gk-m-wat gk-c1"></span><span class="gk-ly gk-m-liq gk-c5 gk-tea"></span><span class="gk-ly gk-m-bag gk-c7"></span><span class="gk-ly gk-m-hl gk-c3 gk-tea2"></span><span class="gk-ly gk-b-str"></span><span class="gk-ly gk-sw" style="animation:gk-tb 4.8s ease-in-out 0s infinite alternate"><span class="gk-ly gk-b-st2"></span><span class="gk-ly gk-m-tgf gk-c1"></span><span class="gk-ly gk-m-tgs gk-c7"></span></span></summary></details></div>
</div>`},{id:"simple-k6",label:"음성 메모",emoji:"🎙️",desc:"말소리처럼 오르내리는 음파 막대 · 흐르는 녹음 시간",key:"k6",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl gk-tn-d",dark:"gk-td"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-td gk-k6 gk-cv-bl gk-noaud"><style>
.gk-k6{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k6 *{box-sizing:border-box}
.gk-k6 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k6 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k6 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k6 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k6 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k6 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k6 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k6 .gk-lg>p:last-child{margin-bottom:0}
.gk-k6 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k6 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k6.gk-noaud .gk-sd{display:none}
.gk-k6 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k6 audio{display:block}
.gk-k6 .gk-ft{display:flex;justify-content:flex-end;align-items:center;margin-top:12px}
@media (prefers-reduced-motion:reduce){.gk-k6 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k6{padding:16px 20px 16px;border:1px solid rgba(224,224,228,.09);border-radius:12px;background-color:#25272b}
.gk-k6 .gk-wv{display:grid;flex:0 0 auto;grid-template-columns:auto;height:26px;block-size:26px}
.gk-k6 .gk-wl{display:flex;grid-area:1/1/2/2;align-items:center;gap:3px;height:26px;block-size:26px}
.gk-k6 .gk-hi{clip-path:inset(0 50% 0 0)}
.gk-k6 .gk-wl span{display:block;flex:0 0 2px;width:2px;border-radius:1px;transform-origin:50% 50%}
.gk-k6 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#1c1e21}
.gk-k6 .gk-tc{display:flex;align-items:center;font:500 11px/12px ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;font-variant-numeric:tabular-nums;color:#9a9da6;-webkit-text-fill-color:#9a9da6}
.gk-k6 .gk-dt{display:block;flex:0 0 6px;width:6px;height:6px;margin-right:6px;border-radius:50%}
.gk-k6 .gk-dg{display:block;flex:0 0 auto;width:1ch;height:12px;block-size:12px;overflow:clip}
.gk-k6 .gk-ds{display:block}
.gk-k6 .gk-ds span{display:block;height:12px;block-size:12px;line-height:12px;text-align:center}
.gk-k6 .gk-cn{display:block;height:12px;block-size:12px;padding:0 1px;line-height:11px}
.gk-k6.gk-tn-d{border-color:rgba(20,20,24,.10);background-color:#ffffff}
.gk-k6.gk-tn-d .gk-lg{background-color:#f5f5f6}
.gk-k6.gk-tn-d .gk-tc{color:#5f6168;-webkit-text-fill-color:#5f6168}
.gk-k6 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes gk-wa{0%{transform:scaleY(.45)}30%{transform:scaleY(1)}55%{transform:scaleY(.6)}80%{transform:scaleY(.9)}100%{transform:scaleY(.4)}}
@keyframes gk-wb{0%{transform:scaleY(.9)}25%{transform:scaleY(.4)}60%{transform:scaleY(1)}100%{transform:scaleY(.55)}}
@keyframes gk-wc{0%{transform:scaleY(.6)}40%{transform:scaleY(.95)}70%{transform:scaleY(.35)}100%{transform:scaleY(.8)}}
@keyframes gk-t10{0%{transform:translateY(0)}100%{transform:translateY(-120px)}}
@keyframes gk-t6{0%{transform:translateY(0)}100%{transform:translateY(-72px)}}
@keyframes gk-rc{0%{opacity:1}100%{opacity:.3}}
@keyframes gk-fill{0%{clip-path:inset(0 100% 0 0)}88.9%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 100% 0 0)}}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-panel,.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-play-button,.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-current-time-display,.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
@media (prefers-reduced-motion:reduce){.gk-k6 *{animation:none!important;transition:none!important}.gk-k6 .gk-s1{transform:translateY(-48px)}.gk-k6 .gk-s0{transform:translateY(-24px)}}
.gk-k6 p strong,.gk-k6 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k6.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k6.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k6.gk-tl .gk-nm.gk-nA,.gk-k6.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k6.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k6.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k6.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k6.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k6.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k6.gk-td .gk-nm.gk-nA,.gk-k6.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k6.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k6.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-k6.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k6.gk-k6.gk-k6 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k6.gk-cv-bl .gk-wl span{background-color:#0f6ab4}
.gk-k6.gk-cv-bl .gk-hi span{background-color:#e4f1fc}
.gk-k6.gk-cv-bl .gk-dt{background-color:#3aa7ff}
.gk-k6.gk-cv-bl.gk-tn-d .gk-wl span{background-color:#95cefc}
.gk-k6.gk-cv-bl.gk-tn-d .gk-hi span{background-color:#0f6ab4}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><span class="gk-wv" aria-hidden="true"><span class="gk-wl"><span style="height:5px;animation:gk-wa 0.9s ease-in-out -0.00s infinite alternate"></span><span style="height:9px;animation:gk-wc 1.3s ease-in-out -0.37s infinite alternate"></span><span style="height:16px;animation:gk-wc 0.8s ease-in-out -0.74s infinite alternate"></span><span style="height:7px;animation:gk-wb 1.1s ease-in-out -1.11s infinite alternate"></span><span style="height:21px;animation:gk-wb 1.4s ease-in-out -0.18s infinite alternate"></span><span style="height:12px;animation:gk-wa 0.7s ease-in-out -0.55s infinite alternate"></span><span style="height:26px;animation:gk-wa 1.2s ease-in-out -0.92s infinite alternate"></span><span style="height:14px;animation:gk-wc 1s ease-in-out -1.29s infinite alternate"></span><span style="height:19px;animation:gk-wc 1.5s ease-in-out -0.36s infinite alternate"></span><span style="height:7px;animation:gk-wb 0.85s ease-in-out -0.73s infinite alternate"></span><span style="height:12px;animation:gk-wb 1.15s ease-in-out -1.10s infinite alternate"></span><span style="height:24px;animation:gk-wa 0.95s ease-in-out -0.17s infinite alternate"></span><span style="height:16px;animation:gk-wa 1.35s ease-in-out -0.54s infinite alternate"></span><span style="height:9px;animation:gk-wc 0.75s ease-in-out -0.91s infinite alternate"></span><span style="height:21px;animation:gk-wc 1.25s ease-in-out -1.28s infinite alternate"></span><span style="height:14px;animation:gk-wb 1.05s ease-in-out -0.35s infinite alternate"></span><span style="height:7px;animation:gk-wb 0.9s ease-in-out -0.72s infinite alternate"></span><span style="height:16px;animation:gk-wa 1.45s ease-in-out -1.09s infinite alternate"></span><span style="height:9px;animation:gk-wa 0.8s ease-in-out -0.16s infinite alternate"></span><span style="height:5px;animation:gk-wc 1.2s ease-in-out -0.53s infinite alternate"></span><span style="height:7px;animation:gk-wc 1s ease-in-out -0.90s infinite alternate"></span></span><span class="gk-wl gk-hi" style="animation:gk-fill 9s linear 0s infinite"><span style="height:5px;animation:gk-wa 0.9s ease-in-out -0.00s infinite alternate"></span><span style="height:9px;animation:gk-wc 1.3s ease-in-out -0.37s infinite alternate"></span><span style="height:16px;animation:gk-wc 0.8s ease-in-out -0.74s infinite alternate"></span><span style="height:7px;animation:gk-wb 1.1s ease-in-out -1.11s infinite alternate"></span><span style="height:21px;animation:gk-wb 1.4s ease-in-out -0.18s infinite alternate"></span><span style="height:12px;animation:gk-wa 0.7s ease-in-out -0.55s infinite alternate"></span><span style="height:26px;animation:gk-wa 1.2s ease-in-out -0.92s infinite alternate"></span><span style="height:14px;animation:gk-wc 1s ease-in-out -1.29s infinite alternate"></span><span style="height:19px;animation:gk-wc 1.5s ease-in-out -0.36s infinite alternate"></span><span style="height:7px;animation:gk-wb 0.85s ease-in-out -0.73s infinite alternate"></span><span style="height:12px;animation:gk-wb 1.15s ease-in-out -1.10s infinite alternate"></span><span style="height:24px;animation:gk-wa 0.95s ease-in-out -0.17s infinite alternate"></span><span style="height:16px;animation:gk-wa 1.35s ease-in-out -0.54s infinite alternate"></span><span style="height:9px;animation:gk-wc 0.75s ease-in-out -0.91s infinite alternate"></span><span style="height:21px;animation:gk-wc 1.25s ease-in-out -1.28s infinite alternate"></span><span style="height:14px;animation:gk-wb 1.05s ease-in-out -0.35s infinite alternate"></span><span style="height:7px;animation:gk-wb 0.9s ease-in-out -0.72s infinite alternate"></span><span style="height:16px;animation:gk-wa 1.45s ease-in-out -1.09s infinite alternate"></span><span style="height:9px;animation:gk-wa 0.8s ease-in-out -0.16s infinite alternate"></span><span style="height:5px;animation:gk-wc 1.2s ease-in-out -0.53s infinite alternate"></span><span style="height:7px;animation:gk-wc 1s ease-in-out -0.90s infinite alternate"></span></span></span></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<div class="gk-lg">
{{로그}}
</div>
<div class="gk-ft"><span class="gk-tc" aria-hidden="true"><span class="gk-dt" style="animation:gk-rc 1.6s ease-in-out 0s infinite alternate"></span><span class="gk-dg"><span class="gk-ds gk-m1" style="animation:gk-t6 3600s steps(6,end) 0s infinite"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></span></span><span class="gk-dg"><span class="gk-ds gk-m0" style="animation:gk-t10 600s steps(10,end) 0s infinite"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span><span class="gk-cn">:</span><span class="gk-dg"><span class="gk-ds gk-s1" style="animation:gk-t6 60s steps(6,end) 0s infinite"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></span></span><span class="gk-dg"><span class="gk-ds gk-s0" style="animation:gk-t10 10s steps(10,end) 0s infinite"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span></span></div>
</div>`},{id:"simple-k7",label:"성냥",emoji:"🔥",desc:"성냥 한 개비 — 누르면 불씨가 「탁」 붙고 테두리 · 가로줄이 캐릭터 색으로, 지문 글자가 또렷해져요 · 다시 누르면 연기 한 줄",key:"k7",peek:!0,open:!1,main:"M",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl gk-tn-d",dark:"gk-td"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#1f2124",log:"#1f2124",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-td gk-k7 gk-cv-pk"><style>
.gk-k7{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k7 *{box-sizing:border-box}
.gk-k7 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k7 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k7 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k7 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k7 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k7 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k7 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k7 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k7 .gk-lg>p:last-child{margin-bottom:0}
.gk-k7 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k7 .gk-ft{display:flex;justify-content:flex-end;align-items:center;margin-top:12px}
.gk-k7 .gk-kx{display:block}
.gk-k7 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k7 summary{list-style:none}
.gk-k7 summary::-webkit-details-marker{display:none}
.gk-k7 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k7 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k7 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k7{padding:16px 20px 18px;border:1px solid rgba(224,224,228,.10);border-radius:8px;background-color:#1f2124;transition:border-color .4s ease}
.gk-k7 .gk-hd{margin-bottom:-78px}
.gk-k7 .gk-kx{flex:0 0 64px;width:64px;height:100px;block-size:100px;margin-right:-6px}
.gk-k7 .gk-mt{display:block;width:64px;height:100px;block-size:100px;line-height:0}
.gk-k7 .gk-mr{display:grid;grid-template-columns:64px;grid-template-rows:100px;width:64px;height:100px;block-size:100px;transform:rotate(8deg);transform-origin:32px 98px}
.gk-k7 .gk-tt{padding-right:76px}
.gk-k7 .gk-hr{height:1px;margin:14px 72px 16px 0;background-color:rgba(224,224,228,.10);transition:background-color .4s ease}
.gk-k7 .gk-lg p.gk-nr{color:#b4b6bd;-webkit-text-fill-color:#b4b6bd;transition:color .4s ease,-webkit-text-fill-color .4s ease}
.gk-k7 .gk-rg{display:block;width:10px;height:10px;border:1.5px solid rgba(224,224,228,.36);border-radius:50%}
.gk-k7 .gk-fg{display:grid;grid-template-columns:64px;grid-template-rows:100px;opacity:0;transform-origin:32px 38px;transition:opacity .2s ease}
.gk-k7 .gk-fo,.gk-k7 .gk-fm,.gk-k7 .gk-fi{transform-origin:32px 38px}
.gk-k7 .gk-gw{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:34px;height:34px;block-size:34px;margin:9px 0 0 15px;border-radius:50%;opacity:.35;filter:blur(7px)}
.gk-k7 .gk-smk{opacity:0;visibility:visible;transform:translateY(-10px);transition:opacity 2s ease-in,transform 2s ease-out,visibility 0s}
.gk-k7:has(.gk-kx[open]) .gk-smk{opacity:.7;visibility:hidden;transform:translateY(4px);transition:none}
.gk-k7:has(.gk-kx[open]) .gk-fg{opacity:1;animation:gk-ig .35s ease-out 0s 1}
.gk-k7:has(.gk-kx[open]) .gk-lg p.gk-nr{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k7.gk-tn-d{border-color:rgba(20,20,24,.10);background-color:#fbfbfa}
.gk-k7.gk-tn-d .gk-hr{background-color:rgba(20,20,24,.12)}
.gk-k7.gk-tn-d .gk-lg p.gk-nr{color:#5b5d64;-webkit-text-fill-color:#5b5d64}
.gk-k7.gk-tn-d:has(.gk-kx[open]) .gk-lg p.gk-nr{color:#111113;-webkit-text-fill-color:#111113}
.gk-k7.gk-tn-d .gk-rg{border-color:rgba(20,20,24,.32)}
.gk-k7.gk-tn-d .gk-gw{width:44px;height:44px;block-size:44px;margin:4px 0 0 10px;opacity:.7;filter:blur(8px);animation-name:gk-gw2!important}
.gk-k7 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
.gk-k7 .gk-b-smk{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Cpath d=%22M32 30C27 22 37 15 32 6%22 fill=%22none%22 stroke=%22%239a9da6%22 stroke-width=%221.4%22 stroke-linecap=%22round%22/%3E%3C/svg%3E')}
.gk-k7 .gk-b-stk{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Crect x=%2229.75%22 y=%2238%22 width=%224.5%22 height=%2260%22 rx=%221.6%22 fill=%22%23d8d1c2%22/%3E%3C/svg%3E')}
.gk-k7 .gk-m-fo{-webkit-mask-image:url('55');mask-image:url('55')}
.gk-k7 .gk-m-fm{-webkit-mask-image:url('42');mask-image:url('42')}
.gk-k7 .gk-m-fi{-webkit-mask-image:url('39');mask-image:url('39')}
.gk-k7 .gk-m-mh{-webkit-mask-image:url('77');mask-image:url('77')}
.gk-k7.gk-tn-d .gk-b-stk{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 100%22%3E%3Crect x=%2229.75%22 y=%2238%22 width=%224.5%22 height=%2260%22 rx=%221.6%22 fill=%22%23c7b998%22/%3E%3C/svg%3E')}
@keyframes gk-ig{0%{transform:scale(.2)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes gk-fa{0%{transform:rotate(-4deg) scaleY(.92)}50%{transform:rotate(2deg) scaleY(1.08)}100%{transform:rotate(4deg) scaleY(.96)}}
@keyframes gk-fb{0%{transform:rotate(3deg) scaleY(1.06)}100%{transform:rotate(-3deg) scaleY(.92)}}
@keyframes gk-gw{0%{opacity:.28}100%{opacity:.36}}
@keyframes gk-gw2{0%{opacity:.6}100%{opacity:.78}}
.gk-k7 p strong,.gk-k7 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k7.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k7.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k7.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k7.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k7.gk-cv-pk .gk-nm.gk-nM{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k7.gk-cv-pk .gk-dM{background-color:rgba(255,95,162,.18)}
.gk-k7.gk-cv-pk .gk-uM{background-color:#ff5fa2}
.gk-k7.gk-cv-pk.gk-tn-d .gk-nm.gk-nM{color:#de005d;-webkit-text-fill-color:#de005d}
.gk-k7.gk-cv-pk.gk-tn-d .gk-uM{background-color:#de005d}

.gk-k7.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-k7.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-k7.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-k7.gk-cv-pk .gk-c9{background-color:#651235}
.gk-k7.gk-cv-pk:has(.gk-kx[open]){border-color:#c9105e}
.gk-k7.gk-cv-pk:has(.gk-kx[open]) .gk-hr{background-color:#ff5fa2}
.gk-k7.gk-cv-pk.gk-tn-d:has(.gk-kx[open]){border-color:#ff5fa2}
.gk-k7.gk-cv-pk.gk-tn-d:has(.gk-kx[open]) .gk-hr{background-color:#ff5fa2}
.gk-k7.gk-cv-pk.gk-tn-d .gk-m-fo{background-color:#c9105e}
.gk-k7.gk-cv-pk.gk-tn-d .gk-m-fm{background-color:#ff5fa2}
.gk-k7.gk-cv-pk.gk-tn-d .gk-m-fi{background-color:#fda9cc}
.gk-k7.gk-cv-pk.gk-tn-d .gk-gw{background-color:#fda9cc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><details class="gk-kx"><summary class="gk-mt" aria-label="불 켜기"><span class="gk-mr" aria-hidden="true"><span class="gk-ly gk-b-smk gk-smk"></span><span class="gk-ly gk-b-stk"></span><span class="gk-ly gk-fg"><span class="gk-gw gk-c5" style="animation:gk-gw 1.7s ease-in-out 0s infinite alternate"></span><span class="gk-ly gk-m-fo gk-c5 gk-fo" style="animation:gk-fa 1.3s ease-in-out 0s infinite alternate"></span><span class="gk-ly gk-m-fm gk-c3 gk-fm" style="animation:gk-fb 1.1s ease-in-out -.4s infinite alternate"></span><span class="gk-ly gk-m-fi gk-c1 gk-fi" style="animation:gk-fa .8s ease-in-out -.2s infinite alternate"></span></span><span class="gk-ly gk-m-mh gk-c9 gk-mh"></span></span></summary></details></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uM"></span>
<div class="gk-hr"></div>
<div class="gk-lg">
{{로그}}
</div>
<div class="gk-ft"><span class="gk-rg"></span></div>
</div>`},{id:"simple-k8",label:"블라인드",emoji:"🪟",desc:"제목 · 블라인드 · 당김줄을 누르면 살이 위로 모이고 대화가 펼쳐져요",key:"k8",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl gk-tn-d",dark:"gk-tx"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#13233b",log:"#0d1a2d",text:"#e4e9f0"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tx gk-k8 gk-cv-bl gk-noaud"><style>
.gk-k8{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k8 *{box-sizing:border-box}
.gk-k8 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k8 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;line-height:0;text-decoration:none}
.gk-k8 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k8 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k8 .gk-ul{display:block;width:36px;height:2px;margin:9px 0 0;border-radius:1px}
.gk-k8 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k8 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k8 .gk-lg>p:last-child{margin-bottom:0}
.gk-k8 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k8 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k8.gk-noaud .gk-sd{display:none}
.gk-k8 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k8 audio{display:block}
.gk-k8 .gk-ft{display:flex;justify-content:flex-end;align-items:center;margin-top:12px}
.gk-k8 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k8 summary{list-style:none}
.gk-k8 summary::-webkit-details-marker{display:none}
.gk-k8 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k8 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-k8 *{animation:none!important;transition:none!important}}
.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k8{padding:16px 20px 16px;border:1px solid;border-radius:12px}
.gk-k8 summary{display:block}
.gk-k8 .gk-bl{display:block;margin:14px -20px 0;padding-top:6px}
.gk-k8 .gk-bl span{display:block;height:1px;margin-bottom:6px;transition:margin-bottom .5s cubic-bezier(.4,0,.2,1)}
.gk-k8 details[open] .gk-bl span{margin-bottom:1.5px}
.gk-k8 .gk-br{display:block;height:2px;margin:0 -20px}
.gk-k8 .gk-cw{display:flex;justify-content:flex-end;height:38px;block-size:38px;padding-right:16px}
.gk-k8 .gk-cd{display:flex;flex-direction:column;align-items:center;transform-origin:50% 0}
.gk-k8 .gk-cl{display:block;width:1px;height:22px}
.gk-k8 .gk-cb{display:block;width:7px;height:9px;border-radius:3px 3px 4px 4px}
.gk-k8 .gk-lg{padding:16px 18px;border:1px solid;border-radius:8px}
.gk-k8 details[open] .gk-lg{animation:gk-dn .5s cubic-bezier(.4,0,.2,1)}
.gk-k8 .gk-dt{display:block;width:6px;height:6px;border-radius:50%}
.gk-k8.gk-tn-d{border-color:rgba(20,20,24,.10);background-color:#ffffff}
.gk-k8.gk-tn-d .gk-lg{border-color:rgba(20,20,24,.08);background-color:#f5f5f6}
.gk-k8 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes gk-cd{0%{transform:rotate(-3deg)}100%{transform:rotate(3deg)}}
@keyframes gk-dn{0%{opacity:0;transform:translateY(-10px);clip-path:inset(0 0 100% 0)}100%{opacity:1;transform:translateY(0);clip-path:inset(0 0 0 0)}}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-panel,.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-play-button,.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-current-time-display,.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k8 p strong,.gk-k8 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k8.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k8.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k8.gk-tl .gk-nm.gk-nA,.gk-k8.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k8.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k8.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k8.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k8.gk-tx .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k8.gk-tx .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k8.gk-tx .gk-nm.gk-nA,.gk-k8.gk-tx .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k8.gk-tx .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k8.gk-tx .gk-sn.gk-sA{background-color:#1c3554}
.gk-k8.gk-tx .gk-uA{background-color:#3aa7ff}
.gk-k8.gk-k8.gk-k8 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k8.gk-cv-bl.gk-tx .gk-tt{color:#f2f6fb;-webkit-text-fill-color:#f2f6fb}
.gk-k8.gk-cv-bl.gk-tx p{color:#e4e9f0;-webkit-text-fill-color:#e4e9f0}
.gk-k8.gk-cv-bl.gk-tx .gk-d{color:#f5f8fc;-webkit-text-fill-color:#f5f8fc}
.gk-k8.gk-cv-bl.gk-tx .gk-sd{border-color:rgba(110,170,240,.22)}
.gk-k8.gk-cv-bl.gk-tx{border-color:rgba(110,170,240,.22);background-color:#13233b}
.gk-k8.gk-cv-bl .gk-bl span{background-color:rgba(150,200,255,.30)}
.gk-k8.gk-cv-bl .gk-br{background-color:rgba(150,200,255,.46)}
.gk-k8.gk-cv-bl .gk-cl{background-color:rgba(150,200,255,.5)}
.gk-k8.gk-cv-bl .gk-cb{background-color:#9cc8f5}
.gk-k8.gk-cv-bl.gk-tx .gk-lg{border-color:rgba(110,170,240,.12);background-color:#0d1a2d}
.gk-k8.gk-cv-bl .gk-dt{background-color:#5fb0f5}
.gk-k8.gk-cv-bl.gk-tn-d .gk-bl{background-color:#e4f1fc}
.gk-k8.gk-cv-bl.gk-tn-d .gk-bl span{background-color:#95cefc}
.gk-k8.gk-cv-bl.gk-tn-d .gk-br{background-color:#3aa7ff}
.gk-k8.gk-cv-bl.gk-tn-d .gk-cl{background-color:#3aa7ff}
.gk-k8.gk-cv-bl.gk-tn-d .gk-cb{background-color:#0f6ab4}
.gk-k8.gk-cv-bl.gk-tn-d .gk-dt{background-color:#3aa7ff}
.gk-k8.gk-cv-bl.gk-k8:not(.gk-tn-d) .gk-lmi{background:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 472 472%22%3E%3Cpath fill=%22%238CC4FF%22 fill-rule=%22evenodd%22 stroke=%22%235A9BE0%22 stroke-width=%2212%22 stroke-linejoin=%22round%22 transform=%22translate%2812 428%29 scale%281 -1%29%22 d=%22M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z%22/%3E%3C/svg%3E') center/100% 100% no-repeat}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<details class="gk-bd"><summary aria-label="블라인드 걷기"><span class="gk-tt">{{제목}}</span><span class="gk-ul gk-uA"></span><span class="gk-bl"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span><span class="gk-br"></span><span class="gk-cw"><span class="gk-cd" style="animation:gk-cd 5.2s ease-in-out 0s infinite alternate"><span class="gk-cl"></span><span class="gk-cb"></span></span></span></summary>
<div class="gk-lg">
{{로그}}
</div></details>
<div class="gk-ft"><span class="gk-dt"></span></div>
</div>`},{id:"simple-k09",label:"지퍼",emoji:"🤐",desc:"지퍼 띠를 누르면 슬라이더가 걸렸다 주르륵 내려가며 이가 V 로 벌어지고 아래 글이 따라 드러나요",key:"k09",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#ffffff",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl" style="animation:gk-dl .35s ease-out {{지연}} both"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k09 gk-cv-bl gk-noaud"><style>
.gk-k09{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k09 *{box-sizing:border-box}
.gk-k09 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k09 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k09 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k09 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k09 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k09 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k09 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k09 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k09 .gk-lg>p:last-child{margin-bottom:0}
.gk-k09 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k09 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k09 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k09 audio{display:block}
.gk-k09 .gk-kx{display:block}
.gk-k09 summary{list-style:none}
.gk-k09 summary::-webkit-details-marker{display:none}
.gk-k09 summary:focus:not(:focus-visible){outline:none}
.gk-k09 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k09 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gk-k09 *{animation:none!important;transition:none!important}}
.gk-k09.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k09.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k09.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k09.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k09.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k09.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k09.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k09.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k09{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k09 .gk-zc{display:block;container-type:inline-size;margin:2px 0 0}
.gk-k09 .gk-zp{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:32px;padding-top:6px}
.gk-k09 .gk-tp{display:block;grid-area:1/1/2/2;height:32px;block-size:32px}
.gk-k09 .gk-zk,.gk-k09 .gk-zo,.gk-k09 .gk-zw{display:grid;grid-area:1/1/2/2;grid-template-columns:minmax(0,1fr);grid-template-rows:32px;height:32px;block-size:32px}
.gk-k09 .gk-zk,.gk-k09 .gk-zo{transition:clip-path .6s cubic-bezier(.4,-.07,.3,1.08) .1s}
.gk-k09 .gk-th{display:block;grid-area:1/1/2/2;align-self:start;height:6px;block-size:6px;-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x;-webkit-mask-size:12px 6px;mask-size:12px 6px;-webkit-mask-position:100% 0;mask-position:100% 0}
.gk-k09 .gk-zk .gk-tu{margin-top:12px}
.gk-k09 .gk-zk .gk-td{margin-top:14px}
.gk-k09 .gk-zo .gk-tu{margin-top:6px}
.gk-k09 .gk-zo .gk-td{margin-top:20px}
.gk-k09 .gk-gp{display:block;grid-area:1/1/2/2;align-self:start;height:8px;block-size:8px;margin-top:12px}
.gk-k09 .gk-zk{clip-path:inset(0 0 0 2px)}
.gk-k09 .gk-zo{clip-path:inset(0 calc(100% - 2px) 0 0)}
.gk-k09:has(.gk-kx[open]) .gk-zk{clip-path:inset(0 0 0 calc(100% - 36px))}
.gk-k09:has(.gk-kx[open]) .gk-zo{clip-path:inset(0 36px 0 0)}
.gk-k09 .gk-zw{overflow:clip}
.gk-k09 .gk-wg{display:block;grid-area:1/1/2/2;justify-self:start;width:24px;height:32px;block-size:32px;background-repeat:no-repeat;background-size:24px 32px;transform:translate(-10px,0);transition:transform .6s cubic-bezier(.4,-.07,.3,1.08) .1s}
.gk-k09:has(.gk-kx[open]) .gk-wg{transform:translate(calc(100cqw - 48px),0)}
.gk-k09 .gk-sp{display:block;grid-area:1/1/2/2;align-self:start;z-index:1;width:6px;height:24px;block-size:24px;margin-top:4px;border-radius:2px}
.gk-k09 .gk-s-l{justify-self:start}
.gk-k09 .gk-s-r{justify-self:end}
.gk-k09 .gk-zs{display:grid;grid-template-columns:30px;grid-template-rows:20px;width:30px;height:20px;block-size:20px;grid-area:1/1/2/2;justify-self:start;align-self:start;z-index:2;margin-top:6px;transform:translate(8px,0);transition:transform .6s cubic-bezier(.4,-.07,.3,1.08) .1s}
.gk-k09:has(.gk-kx[open]) .gk-zs{transform:translate(calc(100cqw - 30px),0)}
.gk-k09 .gk-pt{display:grid;grid-template-columns:30px;grid-template-rows:20px;width:30px;height:20px;block-size:20px;transform-origin:10px 10px;transform:rotate(90deg);transition:transform 1.2s cubic-bezier(.3,-12250,.7,5600)}
.gk-k09:has(.gk-kx[open]) .gk-pt{transform:rotate(90.02deg);transition:none;animation:gk-zo 1.2s ease 0s 1}
.gk-k09 .gk-sl{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;transition:grid-template-rows .6s cubic-bezier(.4,-.07,.3,1.08) .1s}
.gk-k09:has(.gk-kx[open]) .gk-sl{grid-template-rows:1fr}
.gk-k09 .gk-lw{min-height:0;overflow:clip;clip-path:inset(0 calc(100% - 18px) 0 0);transition:clip-path .6s cubic-bezier(.4,-.07,.3,1.08) .1s}
.gk-k09:has(.gk-kx[open]) .gk-lw{clip-path:inset(0 0 0 0)}
.gk-k09 .gk-lg{padding:12px 0 2px;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease}
.gk-k09:has(.gk-kx[open]) .gk-lg{opacity:1;transform:translateY(0);transition:opacity .45s ease .2s,transform .45s ease .2s}
.gk-k09:not(:has(.gk-kx[open])) .gk-dl{animation:none!important}
.gk-k09.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k09.gk-noaud .gk-sd{display:none}
.gk-k09 .gk-lmi{background:url('0') center/100% 100% no-repeat}
@keyframes gk-dl{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
.gk-k09 .gk-m-tt{-webkit-mask-image:url('50');mask-image:url('50')}
.gk-k09 .gk-m-tb{-webkit-mask-image:url('49');mask-image:url('49')}
.gk-k09 .gk-m-br{-webkit-mask-image:url('23');mask-image:url('23')}
.gk-k09 .gk-m-bf{-webkit-mask-image:url('24');mask-image:url('24')}
.gk-k09 .gk-m-bh{-webkit-mask-image:url('26');mask-image:url('26')}
.gk-k09 .gk-m-ax{-webkit-mask-image:url('27');mask-image:url('27')}
.gk-k09 .gk-m-pr{-webkit-mask-image:url('7');mask-image:url('7')}
.gk-k09 .gk-m-pf{-webkit-mask-image:url('25');mask-image:url('25')}
@keyframes gk-zo{0%{transform:rotate(90deg)}8%{transform:rotate(0deg)}62%{transform:rotate(0deg);animation-timing-function:ease-in}78%{transform:rotate(100deg)}90%{transform:rotate(86deg)}100%{transform:rotate(90.02deg)}}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-panel,.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-play-button,.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-current-time-display,.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k09 p strong,.gk-k09 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k09.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k09.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k09.gk-tl .gk-nm.gk-nA,.gk-k09.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k09.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k09.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k09.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k09.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k09.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k09.gk-td .gk-nm.gk-nA,.gk-k09.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k09.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k09.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-k09.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k09.gk-k09.gk-k09 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k09.gk-cv-bl .gk-tp{border-top:2px solid #95cefc;border-bottom:2px solid #95cefc;background-color:#e4f1fc}
.gk-k09.gk-cv-bl .gk-th{background-color:#0f6ab4}
.gk-k09.gk-cv-bl .gk-gp{background-color:#95cefc}
.gk-k09.gk-cv-bl .gk-wg{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2232%22 viewBox=%220 0 24 32%22 shape-rendering=%22geometricPrecision%22%3E%3Crect width=%2224%22 height=%2232%22 fill=%22%23e4f1fc%22/%3E%3Crect width=%2224%22 height=%222%22 fill=%22%2395cefc%22/%3E%3Crect y=%2230%22 width=%2224%22 height=%222%22 fill=%22%2395cefc%22/%3E%3Cpath d=%22M0 12L14 16L0 20Z%22 fill=%22%2395cefc%22/%3E%3Cpath fill=%22%230f6ab4%22 d=%22M0 8H4V12Q4 14 2 14Q0 14 0 12ZM6 24H10V20Q10 18 8 18Q6 18 6 20ZM12 10H16V14Q16 16 14 16Q12 16 12 14ZM18 20H22V16Q22 14 20 14Q18 14 18 16Z%22/%3E%3C/svg%3E')}
.gk-k09.gk-cv-bl .gk-sp{background-color:#0f6ab4}
.gk-k09.gk-cv-bl .gk-br,.gk-k09.gk-cv-bl .gk-ax,.gk-k09.gk-cv-bl .gk-pr{background-color:#0f6ab4}
.gk-k09.gk-cv-bl .gk-bf{background-color:#3aa7ff}
.gk-k09.gk-cv-bl .gk-bh,.gk-k09.gk-cv-bl .gk-pf{background-color:#95cefc}
.gk-k09.gk-cv-bl.gk-tn-n .gk-tp{background-color:#10395a;border-color:#0f6ab4}
.gk-k09.gk-cv-bl.gk-tn-n .gk-gp{background-color:#0a1b28}
.gk-k09.gk-cv-bl.gk-tn-n .gk-wg{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2232%22 viewBox=%220 0 24 32%22 shape-rendering=%22geometricPrecision%22%3E%3Crect width=%2224%22 height=%2232%22 fill=%22%2310395a%22/%3E%3Crect width=%2224%22 height=%222%22 fill=%22%230f6ab4%22/%3E%3Crect y=%2230%22 width=%2224%22 height=%222%22 fill=%22%230f6ab4%22/%3E%3Cpath d=%22M0 12L14 16L0 20Z%22 fill=%22%230a1b28%22/%3E%3Cpath fill=%22%2395cefc%22 d=%22M0 8H4V12Q4 14 2 14Q0 14 0 12ZM6 24H10V20Q10 18 8 18Q6 18 6 20ZM12 10H16V14Q16 16 14 16Q12 16 12 14ZM18 20H22V16Q22 14 20 14Q18 14 18 16Z%22/%3E%3C/svg%3E')}
.gk-k09.gk-cv-bl.gk-tn-n .gk-th,.gk-k09.gk-cv-bl.gk-tn-n .gk-sp{background-color:#95cefc}
.gk-k09.gk-cv-bl.gk-tn-n .gk-br,.gk-k09.gk-cv-bl.gk-tn-n .gk-pr{background-color:#95cefc}
.gk-k09.gk-cv-bl.gk-tn-n .gk-ax{background-color:#10395a}
.gk-k09.gk-cv-bl.gk-tn-n .gk-bh{background-color:#e4f1fc}
.gk-k09.gk-cv-bl.gk-tn-n .gk-pf{background-color:#0f6ab4}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<div class="gk-zc"><details class="gk-kx"><summary class="gk-zp" aria-label="지퍼 열기"><span class="gk-tp"></span><span class="gk-zk"><span class="gk-th gk-tu gk-m-tt"></span><span class="gk-th gk-td gk-m-tb"></span></span><span class="gk-zo"><span class="gk-gp"></span><span class="gk-th gk-tu gk-m-tt"></span><span class="gk-th gk-td gk-m-tb"></span></span><span class="gk-zw"><span class="gk-wg"></span></span><span class="gk-sp gk-s-l"></span><span class="gk-sp gk-s-r"></span><span class="gk-zs" aria-hidden="true"><span class="gk-ly gk-m-br gk-br"></span><span class="gk-ly gk-m-bf gk-bf"></span><span class="gk-ly gk-m-bh gk-bh"></span><span class="gk-ly gk-pt"><span class="gk-ly gk-m-pr gk-pr"></span><span class="gk-ly gk-m-pf gk-pf"></span></span><span class="gk-ly gk-m-ax gk-ax"></span></span></summary></details>
<div class="gk-sl"><div class="gk-lw"><div class="gk-lg">
{{로그}}
</div></div></div></div>
</div>`},{id:"simple-k10",label:"모래시계",emoji:"⏳",desc:"모래시계를 누르면 휙 뒤집혀 모래가 떨어지고, 본문 칸이 열리며 글자가 천천히 또렷해져요",key:"k10",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k10 gk-cv-bl gk-noaud"><style>
.gk-k10{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k10 *{box-sizing:border-box}
.gk-k10 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k10 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k10 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k10 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k10 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k10 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k10 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k10 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k10 .gk-lg>p:last-child{margin-bottom:0}
.gk-k10 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k10 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k10 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k10 audio{display:block}
.gk-k10 .gk-kx{display:block}
.gk-k10 summary{list-style:none}
.gk-k10 summary::-webkit-details-marker{display:none}
.gk-k10 summary:focus:not(:focus-visible){outline:none}
.gk-k10 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k10 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gk-k10 *{animation:none!important;transition:none!important}}
.gk-k10.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k10.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k10.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k10.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k10.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k10.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k10.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k10.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k10{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-k10 .gk-kx{margin:12px 0 0}
.gk-k10 .gk-hw{display:flex;align-items:center}
.gk-k10 .gk-sl{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;transition:grid-template-rows .6s ease}
.gk-k10:has(.gk-kx[open]) .gk-sl{grid-template-rows:1fr;transition:grid-template-rows .35s cubic-bezier(.3,0,.2,1) .1s}
.gk-k10 .gk-lw{min-height:0;overflow:clip}
.gk-k10 .gk-lg{padding-top:10px;opacity:0;transition:opacity .2s ease}
.gk-k10:has(.gk-kx[open]) .gk-lg{opacity:1;transition:opacity 2.9s cubic-bezier(.5,.1,.8,.6) .5s}
.gk-k10 .gk-dl{animation:none!important}
.gk-k10 .gk-ln{display:block;flex:1 1 0;height:1px;background-color:rgba(20,20,24,.12)}
.gk-k10 .gk-hr{display:grid;grid-template-columns:44px;grid-template-rows:64px;width:44px;height:64px;block-size:64px;flex:0 0 44px;margin:0 14px;line-height:0;transform:rotate(0deg);transition:transform .6s cubic-bezier(.5,0,.3,1.25)}
.gk-k10:has(.gk-kx[open]) .gk-hr{transform:rotate(180deg)}
.gk-k10 .gk-gf{background-color:#ffffff}
.gk-k10 .gk-go{background-color:#4a4843}
.gk-k10 .gk-xp{transform-origin:50% 55.6px;opacity:1;transform:scaleY(1);transition:opacity 0s linear .3s,transform 2.8s linear .6s}
.gk-k10:has(.gk-kx[open]) .gk-xp{opacity:0;transform:scaleY(0);transition:opacity 0s linear .3s,transform 0s linear .3s}
.gk-k10 .gk-xn,.gk-k10 .gk-yn{display:grid;grid-template-columns:44px;grid-template-rows:64px}
.gk-k10 .gk-gi{display:block;grid-area:1/1/2/2;align-self:start;height:11px;block-size:11px}
.gk-k10 .gk-xn{opacity:0;transition:opacity 0s linear .3s}
.gk-k10:has(.gk-kx[open]) .gk-xn{opacity:1}
.gk-k10 .gk-xn .gk-gi{margin-top:33px;transform:translateY(0);transition:transform 0s linear .3s}
.gk-k10:has(.gk-kx[open]) .gk-xn .gk-gi{transform:translateY(-11px);transition:transform 2.8s linear .6s}
.gk-k10 .gk-yn{opacity:1;transition:opacity 0s linear .3s}
.gk-k10:has(.gk-kx[open]) .gk-yn{opacity:0}
.gk-k10 .gk-yn .gk-gi{margin-top:20px;transform:translateY(11px);transition:transform 2.8s linear .6s}
.gk-k10:has(.gk-kx[open]) .gk-yn .gk-gi{transform:translateY(0);transition:transform 0s linear .3s}
.gk-k10 .gk-yp{transform-origin:50% 8.4px;opacity:0;transform:scaleY(0);transition:opacity 0s linear .3s,transform 0s linear .3s}
.gk-k10:has(.gk-kx[open]) .gk-yp{opacity:1;transform:scaleY(1);transition:opacity 0s linear .3s,transform 2.8s linear .6s}
.gk-k10 .gk-s1{visibility:hidden;opacity:1;transition:none}
.gk-k10:has(.gk-kx[open]) .gk-s1{visibility:visible;opacity:0;transition:opacity .4s linear 3.1s,visibility 0s linear .6s}
.gk-k10 .gk-s2{visibility:visible;opacity:0;transition:opacity .4s linear 3.1s,visibility 0s linear .6s}
.gk-k10:has(.gk-kx[open]) .gk-s2{visibility:hidden;opacity:1;transition:none}
.gk-k10.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k10.gk-tn-n .gk-ln{background-color:rgba(224,224,228,.12)}
.gk-k10.gk-tn-n .gk-gf{background-color:#303238}
.gk-k10.gk-tn-n .gk-go{background-color:#e1e1e5}
.gk-k10.gk-noaud .gk-sd{display:none}
.gk-k10 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-k10 .gk-m-po{-webkit-mask-image:url('35');mask-image:url('35')}
.gk-k10 .gk-m-gf{-webkit-mask-image:url('57');mask-image:url('57')}
.gk-k10 .gk-m-go{-webkit-mask-image:url('12');mask-image:url('12')}
.gk-k10 .gk-m-cp{-webkit-mask-image:url('17');mask-image:url('17')}
.gk-k10 .gk-m-xp{-webkit-mask-image:url('56');mask-image:url('56')}
.gk-k10 .gk-m-xn{-webkit-mask-image:url('51');mask-image:url('51')}
.gk-k10 .gk-m-yp{-webkit-mask-image:url('58');mask-image:url('58')}
.gk-k10 .gk-m-yn{-webkit-mask-image:url('52');mask-image:url('52')}
.gk-k10 .gk-m-s1{-webkit-mask-image:url('75');mask-image:url('75')}
.gk-k10 .gk-m-s2{-webkit-mask-image:url('74');mask-image:url('74')}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-panel,.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-play-button,.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-current-time-display,.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k10 p strong,.gk-k10 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k10.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k10.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k10.gk-tl .gk-nm.gk-nA,.gk-k10.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k10.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k10.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k10.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k10.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k10.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k10.gk-td .gk-nm.gk-nA,.gk-k10.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k10.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k10.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-k10.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k10.gk-k10.gk-k10 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k10.gk-cv-bl .gk-po{background-color:#95cefc}
.gk-k10.gk-cv-bl .gk-cp{background-color:#0f6ab4}
.gk-k10.gk-cv-bl .gk-sa{background-color:#3aa7ff}
.gk-k10.gk-cv-bl.gk-tn-n .gk-po{background-color:#0f6ab4}
.gk-k10.gk-cv-bl.gk-tn-n .gk-cp{background-color:#3aa7ff}
.gk-k10.gk-cv-bl.gk-tn-n .gk-sa{background-color:#95cefc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<details class="gk-kx"><summary class="gk-hw" aria-label="모래시계 뒤집기"><span class="gk-ln"></span><span class="gk-hr" aria-hidden="true"><span class="gk-ly gk-m-po gk-po"></span><span class="gk-ly gk-m-gf gk-gf"></span><span class="gk-ly gk-m-s1 gk-sa gk-s1"></span><span class="gk-ly gk-m-s2 gk-sa gk-s2"></span><span class="gk-ly gk-m-xp gk-sa gk-xp"></span><span class="gk-ly gk-m-xn gk-xn"><span class="gk-gi gk-sa"></span></span><span class="gk-ly gk-m-yp gk-sa gk-yp"></span><span class="gk-ly gk-m-yn gk-yn"><span class="gk-gi gk-sa"></span></span><span class="gk-ly gk-m-go gk-go"></span><span class="gk-ly gk-m-cp gk-cp"></span></span><span class="gk-ln"></span></summary></details>
<div class="gk-sl"><div class="gk-lw"><div class="gk-lg">
{{로그}}
</div></div></div>
</div>`},{id:"simple-k11",label:"실 전화",emoji:"📞",desc:"종이컵 둘을 잇는 늘어진 실 — 누르면 실이 팽팽해지며 떨리고 흐리던 글이 또렷해져요",key:"k11",peek:!0,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k11 gk-cv-bl gk-noaud"><style>
.gk-k11{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k11 *{box-sizing:border-box}
.gk-k11 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k11 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k11 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k11 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k11 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k11 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k11 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k11 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k11 .gk-lg>p:last-child{margin-bottom:0}
.gk-k11 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k11 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k11 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k11 audio{display:block}
.gk-k11 .gk-kx{display:block}
.gk-k11 summary{list-style:none}
.gk-k11 summary::-webkit-details-marker{display:none}
.gk-k11 summary:focus:not(:focus-visible){outline:none}
.gk-k11 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k11 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gk-k11 *{animation:none!important;transition:none!important}}
.gk-k11.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k11.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k11.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k11.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k11.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k11.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k11.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k11.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k11{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k11 .gk-kx{margin-top:14px}
.gk-k11 .gk-cw{display:flex;align-items:flex-start;height:28px;block-size:28px}
.gk-k11 .gk-cu{display:grid;grid-template-columns:34px;grid-template-rows:28px;width:34px;height:28px;block-size:28px;flex:0 0 34px;line-height:0}
.gk-k11 .gk-c2{transform:scaleX(-1)}
.gk-k11 .gk-sg{display:grid;flex:1 1 0;min-width:0;grid-template-columns:minmax(0,1fr);grid-template-rows:14px;height:14px;block-size:14px;margin-top:13px}
.gk-k11 .gk-sc{display:block;grid-area:1/1/2/2;align-self:start;height:14px;block-size:14px;background-repeat:no-repeat;background-size:100% 100%;transition:height .3s ease-out,opacity .06s linear}
.gk-k11 .gk-sb{display:block;grid-area:1/1/2/2;align-self:start;height:2px;block-size:2px;background-color:#3a3d44;opacity:0;transition:opacity .06s linear}
.gk-k11:has(.gk-kx[open]) .gk-sg{animation:gk-vb .5s linear .3s 1}
.gk-k11:has(.gk-kx[open]) .gk-sc{height:2px;block-size:2px;opacity:0;transition:height .3s ease-out,opacity .08s linear .24s}
.gk-k11:has(.gk-kx[open]) .gk-sb{opacity:1;transition:opacity .08s linear .24s}
.gk-k11 .gk-lg{margin-top:12px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-k11 .gk-dl{animation:none!important}
.gk-k11 .gk-lg>*{opacity:.4;transition:opacity .45s ease}
.gk-k11:has(.gk-kx[open]) .gk-lg>*{opacity:1}
.gk-k11.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k11.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-k11.gk-tn-n .gk-sb{background-color:#c9cbd1}
.gk-k11.gk-noaud .gk-sd{display:none}
.gk-k11 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-k11 .gk-m-cb{-webkit-mask-image:url('96');mask-image:url('96')}
.gk-k11 .gk-m-cs{-webkit-mask-image:url('89');mask-image:url('89')}
.gk-k11 .gk-m-co{-webkit-mask-image:url('79');mask-image:url('79')}
.gk-k11 .gk-sc{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 14%22 preserveAspectRatio=%22none%22%3E%3Cpath d=%22M0,1Q50,25 100,1%22 fill=%22none%22 stroke=%22%233a3d44%22 stroke-width=%222%22 vector-effect=%22non-scaling-stroke%22/%3E%3C/svg%3E')}
.gk-k11.gk-tn-n .gk-sc{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 14%22 preserveAspectRatio=%22none%22%3E%3Cpath d=%22M0,1Q50,25 100,1%22 fill=%22none%22 stroke=%22%23c9cbd1%22 stroke-width=%222%22 vector-effect=%22non-scaling-stroke%22/%3E%3C/svg%3E')}
@keyframes gk-vb{0%{transform:translateY(0)}20%{transform:translateY(-1.4px)}40%{transform:translateY(1.1px)}60%{transform:translateY(-.8px)}80%{transform:translateY(.5px)}100%{transform:translateY(0)}}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-panel,.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-play-button,.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-current-time-display,.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k11 p strong,.gk-k11 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k11.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k11.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k11.gk-tl .gk-nm.gk-nA,.gk-k11.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k11.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k11.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-k11.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k11.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k11.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k11.gk-td .gk-nm.gk-nA,.gk-k11.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k11.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k11.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-k11.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k11.gk-k11.gk-k11 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}
.gk-k11 .gk-c2 .gk-b5{background-color:#ff5fa2}
.gk-k11 .gk-c2 .gk-b3{background-color:#fde9f1}
.gk-k11 .gk-c2 .gk-b7{background-color:#c9105e}
.gk-k11.gk-tn-n .gk-c2 .gk-b3{background-color:#651235}
.gk-k11.gk-tn-n .gk-c2 .gk-b7{background-color:#fda9cc}

.gk-k11.gk-cv-bl .gk-c1 .gk-b5{background-color:#3aa7ff}
.gk-k11.gk-cv-bl .gk-c1 .gk-b3{background-color:#e4f1fc}
.gk-k11.gk-cv-bl .gk-c1 .gk-b7{background-color:#0f6ab4}
.gk-k11.gk-cv-bl.gk-tn-n .gk-c1 .gk-b3{background-color:#10395a}
.gk-k11.gk-cv-bl.gk-tn-n .gk-c1 .gk-b7{background-color:#95cefc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<details class="gk-kx"><summary class="gk-cw" aria-label="실 당기기"><span class="gk-cu gk-c1"><span class="gk-ly gk-m-cb gk-b5"></span><span class="gk-ly gk-m-cs gk-b3"></span><span class="gk-ly gk-m-co gk-b7"></span></span><span class="gk-sg"><span class="gk-sc"></span><span class="gk-sb"></span></span><span class="gk-cu gk-c2"><span class="gk-ly gk-m-cb gk-b5"></span><span class="gk-ly gk-m-cs gk-b3"></span><span class="gk-ly gk-m-co gk-b7"></span></span></summary></details>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k12",label:"돋보기",emoji:"🔍",desc:"돋보기를 누르면 글 쪽으로 기울며 글자가 크게 보여요",key:"k12",peek:!1,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k12 gk-cv-pk"><style>
.gk-k12{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k12 *{box-sizing:border-box}
.gk-k12 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k12 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k12 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k12 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k12 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k12 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k12 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k12 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k12 .gk-lg>p:last-child{margin-bottom:0}
.gk-k12 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k12 .gk-kx{display:block}
.gk-k12 summary{list-style:none}
.gk-k12 summary::-webkit-details-marker{display:none}
.gk-k12 summary:focus:not(:focus-visible){outline:none}
.gk-k12 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k12 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gk-k12 *{animation:none!important;transition:none!important}}
.gk-k12.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k12.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k12.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k12.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k12.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k12.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k12{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k12 .gk-tt{padding-right:72px}
.gk-k12 .gk-vt{display:grid;grid-template-columns:minmax(0,1fr);margin-top:14px}
.gk-k12 .gk-lg{grid-area:1/1/2/2;min-width:0;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-k12 .gk-lg p{transition:font-size .3s ease}
.gk-k12 .gk-dl{animation:none!important}
.gk-k12:has(.gk-kx[open]) .gk-lg p{font-size:17.5px}
.gk-k12:has(.gk-kx[open]) .gk-lg p.gk-nm{font-size:15px}
.gk-k12 .gk-kx{grid-area:1/1/2/2;justify-self:end;align-self:start;margin:-58px 10px 0 0}
.gk-k12 .gk-cv{display:grid;line-height:0}
.gk-k12 .gk-mg{display:grid;grid-template-columns:48px;grid-template-rows:60px;width:48px;height:60px;block-size:60px;transform-origin:41.5px 52.6px;transform:rotate(0deg);transition:transform .35s cubic-bezier(.3,1.3,.5,1)}
.gk-k12:has(.gk-kx[open]) .gk-mg{transform:rotate(-20deg)}
.gk-k12 .gk-gs{opacity:.75}
.gk-k12 .gk-gt{background-color:#ffffff}
.gk-k12.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k12.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-k12.gk-tn-n .gk-gs{opacity:.13}
.gk-k12 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-k12 .gk-m-hn{-webkit-mask-image:url('41');mask-image:url('41')}
.gk-k12 .gk-m-cl{-webkit-mask-image:url('59');mask-image:url('59')}
.gk-k12 .gk-m-gs{-webkit-mask-image:url('90');mask-image:url('90')}
.gk-k12 .gk-m-rg{-webkit-mask-image:url('53');mask-image:url('53')}
.gk-k12 .gk-m-gt{-webkit-mask-image:url('32');mask-image:url('32')}
.gk-k12.gk-tn-n .gk-m-gt{-webkit-mask-image:url('5');mask-image:url('5')}
.gk-k12 p strong,.gk-k12 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k12.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k12.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k12.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k12.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k12.gk-tl .gk-uB{background-color:#c81e6a}
.gk-k12.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k12.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k12.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k12.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k12.gk-td .gk-uB{background-color:#ff5fa2}

.gk-k12.gk-cv-pk .gk-hn{background-color:#ff5fa2}
.gk-k12.gk-cv-pk .gk-cl{background-color:#651235}
.gk-k12.gk-cv-pk .gk-gs{background-color:#fde9f1}
.gk-k12.gk-cv-pk .gk-rg{background-color:#c9105e}
.gk-k12.gk-cv-pk.gk-tn-n .gk-gs{background-color:#fda9cc}
.gk-k12.gk-cv-pk.gk-tn-n .gk-rg{background-color:#fda9cc}
.gk-k12.gk-cv-pk.gk-tn-n .gk-cl{background-color:#c9105e}
.gk-k12.gk-cv-pk.gk-tn-n .gk-gt{background-color:#fde9f1}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span>
<div class="gk-vt"><div class="gk-lg">
{{로그}}
</div><details class="gk-kx"><summary class="gk-cv" aria-label="글자 키우기"><span class="gk-mg"><span class="gk-ly gk-m-hn gk-hn"></span><span class="gk-ly gk-m-cl gk-cl"></span><span class="gk-ly gk-m-gs gk-gs"></span><span class="gk-ly gk-m-rg gk-rg"></span><span class="gk-ly gk-m-gt gk-gt"></span></span></summary></details></div>
</div>`},{id:"simple-k13",label:"형광펜",emoji:"🖍️",desc:"형광펜을 누르면 뚜껑이 톡 빠지고 대사 띠가 첫 줄부터 차례로 그어져요",key:"k13",peek:!0,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#ffffff",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k13 gk-cv-bl"><style>
.gk-k13{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-k13 *{box-sizing:border-box}
.gk-k13 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k13 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k13 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-k13 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-k13 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k13 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k13 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k13 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k13 .gk-lg>p:last-child{margin-bottom:0}
.gk-k13 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k13 .gk-kx{display:block}
.gk-k13 summary{list-style:none}
.gk-k13 summary::-webkit-details-marker{display:none}
.gk-k13 summary:focus:not(:focus-visible){outline:none}
.gk-k13 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k13 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.gk-k13 *{animation:none!important;transition:none!important}}
.gk-k13.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k13.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k13.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k13.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k13.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k13.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k13{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:10px;background-color:#ffffff}
.gk-k13 .gk-hd{min-height:26px}
.gk-k13 .gk-tt{margin-top:8px}
.gk-k13 .gk-lg{margin-top:16px}
.gk-k13 .gk-dl{animation:none!important}
.gk-k13 .gk-mk{display:grid;grid-template-columns:122px;grid-template-rows:26px;width:122px;height:26px;block-size:26px;line-height:0}
.gk-k13 .gk-kx{flex:0 0 122px;width:122px;height:26px;block-size:26px}
.gk-k13 .gk-cp{display:grid;grid-template-columns:122px;grid-template-rows:26px;width:122px;height:26px;block-size:26px;transform-origin:48px 13px;transform:translate(0,0) rotate(0deg);transition:transform .32s cubic-bezier(.3,1.4,.5,1)}
.gk-k13:has(.gk-kx[open]) .gk-cp{transform:translate(-31px,2px) rotate(-9deg)}
.gk-k13 .gk-dA,.gk-k13 .gk-dB{background-color:transparent;background-repeat:no-repeat;background-position:0 0;background-size:0% 100%;-webkit-box-decoration-break:slice;box-decoration-break:slice;transition:background-size .25s ease}
.gk-k13:has(.gk-kx[open]) .gk-d{background-size:100% 100%;transition:background-size .8s cubic-bezier(.4,0,.5,1) .25s}
.gk-k13:has(.gk-kx[open]) .gk-dl~.gk-dl .gk-d{transition-delay:1.15s}
.gk-k13.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k13 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-k13 .gk-m-bo{-webkit-mask-image:url('70');mask-image:url('70')}
.gk-k13 .gk-m-tl{-webkit-mask-image:url('66');mask-image:url('66')}
.gk-k13 .gk-m-lb{-webkit-mask-image:url('67');mask-image:url('67')}
.gk-k13 .gk-m-nk{-webkit-mask-image:url('62');mask-image:url('62')}
.gk-k13 .gk-m-tp{-webkit-mask-image:url('101');mask-image:url('101')}
.gk-k13 .gk-m-ca{-webkit-mask-image:url('71');mask-image:url('71')}
.gk-k13 .gk-m-cc{-webkit-mask-image:url('65');mask-image:url('65')}
.gk-k13 p strong,.gk-k13 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k13.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k13.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k13.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k13.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k13.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k13.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k13 .gk-dA{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 8 8%22 preserveAspectRatio=%22none%22%3E%3Crect width=%228%22 height=%228%22 fill=%22rgb%2858,167,255%29%22 fill-opacity=%22.26%22/%3E%3C/svg%3E')}
.gk-k13 .gk-dB{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 8 8%22 preserveAspectRatio=%22none%22%3E%3Crect width=%228%22 height=%228%22 fill=%22rgb%28255,95,162%29%22 fill-opacity=%22.26%22/%3E%3C/svg%3E')}

.gk-k13.gk-cv-bl .gk-tp{background-color:#3aa7ff}
.gk-k13.gk-cv-bl .gk-nk{background-color:#10395a}
.gk-k13.gk-cv-bl .gk-bo{background-color:#3aa7ff}
.gk-k13.gk-cv-bl .gk-tl2{background-color:#0f6ab4}
.gk-k13.gk-cv-bl .gk-lb{background-color:#e4f1fc}
.gk-k13.gk-cv-bl .gk-ca{background-color:#0f6ab4}
.gk-k13.gk-cv-bl .gk-cc{background-color:#3aa7ff}
.gk-k13.gk-cv-bl.gk-tn-n .gk-lb{background-color:#10395a}
.gk-k13.gk-cv-bl.gk-tn-n .gk-ca,.gk-k13.gk-cv-bl.gk-tn-n .gk-tl2{background-color:#95cefc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><details class="gk-kx"><summary class="gk-mk" aria-label="형광펜 긋기"><span class="gk-ly gk-m-tp gk-tp"></span><span class="gk-ly gk-m-nk gk-nk"></span><span class="gk-ly gk-m-bo gk-bo"></span><span class="gk-ly gk-m-tl gk-tl2"></span><span class="gk-ly gk-m-lb gk-lb"></span><span class="gk-ly gk-cp"><span class="gk-ly gk-m-cc gk-cc"></span><span class="gk-ly gk-m-ca gk-ca"></span></span></summary></details></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k14",label:"쥘부채",emoji:"🪭",desc:"제목 줄을 누르면 부채살이 촤락 벌어지고, 지그재그로 접힌 종이가 고르게 펴져 글 칸이 돼요",key:"k14",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k14 gk-cv-bl gk-noaud"><style>
.gk-k14{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:16px 20px 16px;overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k14 *{box-sizing:border-box}
.gk-k14 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k14 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k14 .gk-lmi{display:block;width:22px;height:22px;block-size:22px;background:url('0') center/100% 100% no-repeat}
.gk-k14 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k14 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k14 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k14 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k14 .gk-lg>p:last-child{margin-bottom:0}
.gk-k14 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k14 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k14 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k14 audio{display:block}
.gk-k14 .gk-kx{display:block}
.gk-k14 summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k14 summary::-webkit-details-marker{display:none}
.gk-k14 summary:focus:not(:focus-visible){outline:none}
.gk-k14 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k14.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k14.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k14.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k14.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k14.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k14.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k14.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k14.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k14.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k14 .gk-tr{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.gk-k14 .gk-tw{flex:1 1 auto;min-width:0;padding-bottom:8px}
.gk-k14 .gk-tt{margin-top:0}
.gk-k14 .gk-bs{display:block;line-height:normal}
.gk-k14 .gk-tw{display:block}
.gk-k14 .gk-fn{display:grid;flex:0 0 116px;grid-template-columns:116px;grid-template-rows:76px;width:116px;height:76px;block-size:76px;line-height:0}
.gk-k14 .gk-fs{display:grid;grid-area:1/1/2/2;grid-template-columns:116px;grid-template-rows:76px;width:116px;height:76px;block-size:76px;transform-origin:58px 56px;transition:transform .5s cubic-bezier(.4,-.07,.3,1.08)}
.gk-k14 .gk-s0{transform:rotate(48deg)}
.gk-k14:has(.gk-kx[open]) .gk-s0{transform:rotate(-72deg)}
.gk-k14 .gk-s1{transform:rotate(51deg)}
.gk-k14:has(.gk-kx[open]) .gk-s1{transform:rotate(-54deg)}
.gk-k14 .gk-s2{transform:rotate(54deg)}
.gk-k14:has(.gk-kx[open]) .gk-s2{transform:rotate(-36deg)}
.gk-k14 .gk-s3{transform:rotate(57deg)}
.gk-k14:has(.gk-kx[open]) .gk-s3{transform:rotate(-18deg)}
.gk-k14 .gk-s4{transform:rotate(60deg)}
.gk-k14:has(.gk-kx[open]) .gk-s4{transform:rotate(0deg)}
.gk-k14 .gk-s5{transform:rotate(63deg)}
.gk-k14:has(.gk-kx[open]) .gk-s5{transform:rotate(18deg)}
.gk-k14 .gk-s6{transform:rotate(66deg)}
.gk-k14:has(.gk-kx[open]) .gk-s6{transform:rotate(36deg)}
.gk-k14 .gk-s7{transform:rotate(69deg)}
.gk-k14:has(.gk-kx[open]) .gk-s7{transform:rotate(54deg)}
.gk-k14 .gk-s8{transform:rotate(72deg)}
.gk-k14:has(.gk-kx[open]) .gk-s8{transform:rotate(72deg)}
.gk-k14 .gk-fr{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:2px;height:58px;block-size:58px;margin:2px 0 0 57px;border-radius:1px}
.gk-k14 .gk-fg{width:4px;height:60px;block-size:60px;margin:0 0 0 56px;border-radius:2px}
.gk-k14 .gk-fp,.gk-k14 .gk-fb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:116px;height:76px;block-size:76px;transition:clip-path .5s cubic-bezier(.4,-.07,.3,1.08)}
.gk-k14 .gk-fp{clip-path:polygon(57.58px 32.00px,57.02px 0.01px,59.22px 0.01px,61.42px 0.10px,59.47px 32.04px,58.52px 32.01px)}
.gk-k14 .gk-fb{clip-path:polygon(57.25px 13.01px,57.18px 9.01px,59.03px 9.01px,60.87px 9.09px,60.63px 13.08px,58.94px 13.01px)}
.gk-k14:has(.gk-kx[open]) .gk-fp{clip-path:polygon(57.58px 32.00px,57.02px 0.01px,66.52px 0.65px,75.77px 2.89px,65.62px 33.24px,61.65px 32.28px)}
.gk-k14:has(.gk-kx[open]) .gk-fb{clip-path:polygon(57.25px 13.01px,57.18px 9.01px,65.15px 9.55px,72.91px 11.43px,71.64px 15.22px,64.54px 13.50px)}
.gk-k14 .gk-fv{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:6px;height:6px;block-size:6px;margin:53px 0 0 55px;border-radius:50%}
.gk-k14 .gk-ft{display:grid;grid-area:1/1/2/2;grid-template-columns:116px;grid-template-rows:76px;width:116px;height:76px;block-size:76px;transform-origin:58px 58px}
.gk-k14 .gk-ft span{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start}
.gk-k14 .gk-t1{width:2px;height:6px;block-size:6px;margin:60px 0 0 57px}
.gk-k14 .gk-t2{width:6px;height:4px;block-size:4px;margin:66px 0 0 55px;border-radius:2px}
.gk-k14 .gk-t3{width:4px;height:6px;block-size:6px;margin:70px 0 0 56px;border-radius:0 0 2px 2px}
@keyframes gk-ft{0%{transform:rotate(0deg)}25%{transform:rotate(-16deg)}50%{transform:rotate(10deg)}72%{transform:rotate(-5deg)}88%{transform:rotate(2deg)}100%{transform:rotate(0deg)}}
.gk-k14:has(.gk-kx[open]) .gk-ft{animation:gk-ft .9s ease-in-out .2s 1}
.gk-k14 .gk-fz{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(80px,auto);margin-top:14px}
.gk-k14 .gk-sl{display:grid;grid-area:1/1/2/2;align-self:start;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.4,0,.2,1)}
.gk-k14:has(.gk-kx[open]) .gk-sl{grid-template-rows:1fr}
.gk-k14 .gk-lw{min-height:0;overflow:clip}
.gk-k14 .gk-lg{padding:16px 18px;border:1px solid rgba(20,20,24,.08);border-radius:8px;background-color:#f5f5f6}
.gk-k14 .gk-pl{display:flex;flex-direction:column;grid-area:1/1/2/2;align-self:stretch;z-index:1;pointer-events:none;clip-path:polygon(0px 0%,24px 12.5%,0px 25%,24px 37.5%,0px 50%,24px 62.5%,0px 75%,24px 87.5%,0px 100%,calc(100% - 0px) 100%,calc(100% - 24px) 87.5%,calc(100% - 0px) 75%,calc(100% - 24px) 62.5%,calc(100% - 0px) 50%,calc(100% - 24px) 37.5%,calc(100% - 0px) 25%,calc(100% - 24px) 12.5%,calc(100% - 0px) 0%);opacity:1;transition:clip-path .5s cubic-bezier(.4,0,.2,1),opacity .1s ease}
.gk-k14:has(.gk-kx[open]) .gk-pl{clip-path:polygon(0px 0%,0px 12.5%,0px 25%,0px 37.5%,0px 50%,0px 62.5%,0px 75%,0px 87.5%,0px 100%,calc(100% - 0px) 100%,calc(100% - 0px) 87.5%,calc(100% - 0px) 75%,calc(100% - 0px) 62.5%,calc(100% - 0px) 50%,calc(100% - 0px) 37.5%,calc(100% - 0px) 25%,calc(100% - 0px) 12.5%,calc(100% - 0px) 0%);opacity:0;transition:clip-path .5s cubic-bezier(.4,0,.2,1),opacity .2s ease .3s}
.gk-k14 .gk-pv{display:block;flex:1 1 0;min-width:0;min-height:0;transition:background-color .3s cubic-bezier(.4,0,.2,1),border-color .3s cubic-bezier(.4,0,.2,1)}
.gk-k14.gk-k14:has(.gk-kx[open]) .gk-pv{background-color:#f5f5f6;border-color:#f5f5f6}
.gk-k14 .gk-dc{display:block;grid-area:1/1/2/2;z-index:2;pointer-events:none;opacity:1;transition:opacity .2s ease .3s}
.gk-k14:has(.gk-kx[open]) .gk-dc{opacity:0;transition:opacity .15s ease}
.gk-k14.gk-tn-n .gk-lg{border-color:rgba(224,224,228,.09);background-color:#1c1e21}
.gk-k14.gk-k14.gk-k14.gk-tn-n:has(.gk-kx[open]) .gk-pv{background-color:#1c1e21;border-color:#1c1e21}
.gk-k14 .gk-pd{border-bottom:4px solid}
.gk-k14 .gk-c1{justify-self:center;align-self:stretch;width:4px}
.gk-k14 .gk-c2{justify-self:center;align-self:center;width:12px;height:12px;block-size:12px;border-radius:50%}
.gk-k14 .gk-c3{justify-self:center;align-self:center;width:8px;height:16px;block-size:16px;margin-top:28px;border-radius:0 0 2px 2px}
@media (prefers-reduced-motion:reduce){.gk-k14 *{animation:none!important;transition:none!important}}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-panel,.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-play-button,.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-current-time-display,.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k14.gk-noaud .gk-sd{display:none}
.gk-k14 p strong,.gk-k14 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k14.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k14.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k14.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k14.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k14.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k14.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k14.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae;background-color:#e8f4ff}
.gk-k14.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff;background-color:#1f3246}
.gk-k14.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k14.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k14.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k14.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k14.gk-k14.gk-k14 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-k14.gk-cv-bl .gk-pe{background-color:#3aa7ff}
.gk-k14.gk-cv-bl .gk-po{background-color:#95cefc}
.gk-k14.gk-cv-bl .gk-fb{background-color:#e4f1fc}
.gk-k14.gk-cv-bl .gk-fr{background-color:#0f6ab4}
.gk-k14.gk-cv-bl .gk-fv{background-color:#10395a}
.gk-k14.gk-cv-bl .gk-t1{background-color:#0f6ab4}
.gk-k14.gk-cv-bl .gk-t2{background-color:#3aa7ff}
.gk-k14.gk-cv-bl .gk-t3{background-color:#0f6ab4}
.gk-k14.gk-cv-bl .gk-pv{background-color:#e4f1fc}
.gk-k14.gk-cv-bl .gk-pd{background-color:#95cefc}
.gk-k14.gk-cv-bl .gk-pd{border-color:#3aa7ff}
.gk-k14.gk-cv-bl .gk-c1{background-color:#0f6ab4}
.gk-k14.gk-cv-bl .gk-c2{background-color:#3aa7ff}
.gk-k14.gk-cv-bl .gk-c3{background-color:#0f6ab4}
.gk-k14.gk-cv-bl.gk-tn-n .gk-po{background-color:#0f6ab4}
.gk-k14.gk-cv-bl.gk-tn-n .gk-fr{background-color:#95cefc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-fv{background-color:#e4f1fc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-t1{background-color:#95cefc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-t3{background-color:#95cefc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-pv{background-color:#3aa7ff}
.gk-k14.gk-cv-bl.gk-tn-n .gk-pd{background-color:#0f6ab4}
.gk-k14.gk-cv-bl.gk-tn-n .gk-pd{border-color:#10395a}
.gk-k14.gk-cv-bl.gk-tn-n .gk-c1{background-color:#95cefc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-c2{background-color:#e4f1fc}
.gk-k14.gk-cv-bl.gk-tn-n .gk-c3{background-color:#95cefc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<details class="gk-kx"><summary class="gk-bs" aria-label="부채 펴기"><span class="gk-tr"><span class="gk-tw"><span class="gk-tt">{{제목}}</span><span class="gk-ul gk-uA"></span></span><span class="gk-fn"><span class="gk-fs gk-s0"><span class="gk-fp gk-pe"></span><span class="gk-fb"></span><span class="gk-fr gk-fg"></span></span><span class="gk-fs gk-s1"><span class="gk-fr"></span><span class="gk-fp gk-po"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s2"><span class="gk-fr"></span><span class="gk-fp gk-pe"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s3"><span class="gk-fr"></span><span class="gk-fp gk-po"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s4"><span class="gk-fr"></span><span class="gk-fp gk-pe"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s5"><span class="gk-fr"></span><span class="gk-fp gk-po"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s6"><span class="gk-fr"></span><span class="gk-fp gk-pe"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s7"><span class="gk-fr"></span><span class="gk-fp gk-po"></span><span class="gk-fb"></span></span><span class="gk-fs gk-s8"><span class="gk-fr gk-fg"></span></span><span class="gk-fv"></span><span class="gk-ft"><span class="gk-t1"></span><span class="gk-t2"></span><span class="gk-t3"></span></span></span></span></summary></details>
<div class="gk-fz"><div class="gk-sl"><div class="gk-lw"><div class="gk-lg">
{{로그}}
</div></div></div><span class="gk-pl" aria-hidden="true"><span class="gk-pv"></span><span class="gk-pv gk-pd"></span><span class="gk-pv"></span><span class="gk-pv gk-pd"></span><span class="gk-pv"></span><span class="gk-pv gk-pd"></span><span class="gk-pv"></span><span class="gk-pv gk-pd"></span></span><span class="gk-dc gk-c1"></span><span class="gk-dc gk-c3"></span><span class="gk-dc gk-c2"></span></div>
</div>`},{id:"simple-k15",label:"뉴턴의 요람",emoji:"⚪",desc:"요람을 누르면 공이 탁탁 주고받고, 공이 칠 때마다 그 화자의 대사 띠가 톡 짙어져요",key:"k15",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k15 gk-cv-bl gk-noaud"><style>
.gk-k15{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:16px 20px 16px;overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k15 *{box-sizing:border-box}
.gk-k15 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k15 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k15 .gk-lmi{display:block;width:22px;height:22px;block-size:22px;background:url('0') center/100% 100% no-repeat}
.gk-k15 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k15 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k15 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k15 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k15 .gk-lg>p:last-child{margin-bottom:0}
.gk-k15 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k15 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k15 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k15 audio{display:block}
.gk-k15 .gk-kx{display:block}
.gk-k15 summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k15 summary::-webkit-details-marker{display:none}
.gk-k15 summary:focus:not(:focus-visible){outline:none}
.gk-k15 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k15.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k15.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k15.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k15.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k15.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k15.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k15.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k15.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k15.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k15 .gk-hd{min-height:62px}
.gk-k15 .gk-kx{flex:0 0 128px;width:128px;height:62px;block-size:62px}
.gk-k15 .gk-nc{grid-template-columns:128px;grid-template-rows:62px;width:128px;height:62px;block-size:62px}
.gk-k15 .gk-nb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;justify-self:center;width:124px;height:4px;block-size:4px;border-radius:2px}
.gk-k15 .gk-np{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;justify-self:center;width:120px;height:52px;block-size:52px;margin-top:4px;border-left:3px solid;border-right:3px solid}
.gk-k15 .gk-nf{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;justify-self:center;align-self:end;width:128px;height:5px;block-size:5px;margin-bottom:1px;border-radius:2px}
.gk-k15 .gk-pr{display:flex;grid-area:1/1/2/2;justify-self:center;align-self:start;width:70px;height:47px;block-size:47px;margin-top:4px}
.gk-k15 .gk-pd{display:block;flex:0 0 14px;width:14px;height:47px;block-size:47px;transform-origin:7px 0;transform:rotate(0deg)}
.gk-k15 .gk-st{display:block;width:2px;height:33px;block-size:33px;margin:0 auto}
.gk-k15 .gk-bl{display:block;width:14px;height:14px;block-size:14px;padding:3px 0 0 3px;border-radius:50%}
.gk-k15 .gk-hl{display:block;width:4px;height:4px;block-size:4px;border-radius:50%}
@keyframes gk-nl{0%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}8.33%{transform:rotate(30deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}16.67%{transform:rotate(0deg)}33.33%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}41.67%{transform:rotate(19deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}50%{transform:rotate(0deg)}66.67%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}75%{transform:rotate(6deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}83.33%{transform:rotate(0deg)}100%{transform:rotate(0deg)}}
@keyframes gk-nr{0%{transform:rotate(0deg)}16.67%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}25%{transform:rotate(-26deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}33.33%{transform:rotate(0deg)}50%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}58.33%{transform:rotate(-12deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}66.67%{transform:rotate(0deg)}83.33%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.39,.575,.565,1)}91.67%{transform:rotate(-2.5deg);animation-timing-function:cubic-bezier(.47,0,.745,.715)}100%{transform:rotate(0deg)}}
.gk-k15 .gk-pl{transition:transform .56s cubic-bezier(.33,-1070,.67,-1070) .6s}
.gk-k15 .gk-pq{transition:transform .6s cubic-bezier(.33,1730,.67,1730)}
.gk-k15:has(.gk-kx[open]) .gk-pl{transform:rotate(.02deg);transition:none;animation:gk-nl 3s linear 0s 1}
.gk-k15:has(.gk-kx[open]) .gk-pq{transform:rotate(.02deg);transition:none;animation:gk-nr 3s linear 0s 1}
.gk-k15 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-k15.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-k15 .gk-st{background-color:#8b8e96}
.gk-k15 .gk-bm{background-color:#b4b6bd}
.gk-k15 .gk-bm .gk-hl{background-color:#f1f1f3}
.gk-k15.gk-tn-n .gk-st{background-color:#9a9da6}
.gk-k15.gk-tn-n .gk-bm{background-color:#6b6e76}
.gk-k15.gk-tn-n .gk-bm .gk-hl{background-color:#c9cacf}
@media (prefers-reduced-motion:reduce){.gk-k15 *{animation:none!important;transition:none!important}}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-panel,.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-play-button,.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-current-time-display,.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k15:has(.gk-kx[open]).gk-tl .gk-dA{animation:gk-ba-tl 3s linear 0s 1}
.gk-k15:has(.gk-kx[open]).gk-tl .gk-dB{animation:gk-bb-tl 3s linear 0s 1}
.gk-k15:has(.gk-kx[open]).gk-td .gk-dA{animation:gk-ba-td 3s linear 0s 1}
.gk-k15:has(.gk-kx[open]).gk-td .gk-dB{animation:gk-bb-td 3s linear 0s 1}
.gk-k15.gk-noaud .gk-sd{display:none}
.gk-k15 p strong,.gk-k15 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k15.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k15.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k15.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k15.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k15.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k15.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k15.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae;background-color:#e8f4ff}
.gk-k15.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff;background-color:#1f3246}
.gk-k15.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k15.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k15.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k15.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k15.gk-k15.gk-k15 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}
@keyframes gk-ba-tl{0%,15%{background-color:rgba(58,167,255,0.18)}19%{background-color:rgba(58,167,255,0.46)}30%,48%{background-color:rgba(58,167,255,0.18)}52%{background-color:rgba(58,167,255,0.36)}62%,82%{background-color:rgba(58,167,255,0.18)}85%{background-color:rgba(58,167,255,0.27)}93%,100%{background-color:rgba(58,167,255,0.18)}}
@keyframes gk-bb-tl{0%,32%{background-color:rgba(255,95,162,0.18)}36%{background-color:rgba(255,95,162,0.44)}47%,65%{background-color:rgba(255,95,162,0.18)}69%{background-color:rgba(255,95,162,0.32)}79%,100%{background-color:rgba(255,95,162,0.18)}}
@keyframes gk-ba-td{0%,15%{background-color:rgba(58,167,255,0.18)}19%{background-color:rgba(58,167,255,0.46)}30%,48%{background-color:rgba(58,167,255,0.18)}52%{background-color:rgba(58,167,255,0.36)}62%,82%{background-color:rgba(58,167,255,0.18)}85%{background-color:rgba(58,167,255,0.27)}93%,100%{background-color:rgba(58,167,255,0.18)}}
@keyframes gk-bb-td{0%,32%{background-color:rgba(255,95,162,0.18)}36%{background-color:rgba(255,95,162,0.44)}47%,65%{background-color:rgba(255,95,162,0.18)}69%{background-color:rgba(255,95,162,0.32)}79%,100%{background-color:rgba(255,95,162,0.18)}}
.gk-k15 .gk-bb{background-color:#ff5fa2}
.gk-k15 .gk-bb .gk-hl{background-color:#fde9f1}

.gk-k15.gk-cv-bl .gk-nb{background-color:#0f6ab4}
.gk-k15.gk-cv-bl .gk-nf{background-color:#0f6ab4}
.gk-k15.gk-cv-bl .gk-np{border-color:#95cefc}
.gk-k15.gk-cv-bl .gk-ba{background-color:#3aa7ff}
.gk-k15.gk-cv-bl .gk-ba .gk-hl{background-color:#e4f1fc}
.gk-k15.gk-cv-bl.gk-tn-n .gk-nb{background-color:#3aa7ff}
.gk-k15.gk-cv-bl.gk-tn-n .gk-nf{background-color:#3aa7ff}
.gk-k15.gk-cv-bl.gk-tn-n .gk-np{border-color:#0f6ab4}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><details class="gk-kx"><summary class="gk-nc" aria-label="공 튕기기"><span class="gk-np"></span><span class="gk-nb"></span><span class="gk-nf"></span><span class="gk-pr"><span class="gk-pd gk-pl"><span class="gk-st"></span><span class="gk-bl gk-ba"><span class="gk-hl"></span></span></span><span class="gk-pd gk-pm"><span class="gk-st"></span><span class="gk-bl gk-bm"><span class="gk-hl"></span></span></span><span class="gk-pd gk-pm"><span class="gk-st"></span><span class="gk-bl gk-bm"><span class="gk-hl"></span></span></span><span class="gk-pd gk-pm"><span class="gk-st"></span><span class="gk-bl gk-bm"><span class="gk-hl"></span></span></span><span class="gk-pd gk-pq"><span class="gk-st"></span><span class="gk-bl gk-bb"><span class="gk-hl"></span></span></span></span></summary></details></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k16",label:"지우개",emoji:"🧽",desc:"지우개를 누르면 내려와 쓱쓱 문지르고, 지문이 차례로 옅어져 대사만 남아요",key:"k16",peek:!1,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k16 gk-cv-pk"><style>
.gk-k16{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:16px 20px 16px;overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-k16 *{box-sizing:border-box}
.gk-k16 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k16 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k16 .gk-lmi{display:block;width:22px;height:22px;block-size:22px;background:url('0') center/100% 100% no-repeat}
.gk-k16 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k16 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k16 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k16 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k16 .gk-lg>p:last-child{margin-bottom:0}
.gk-k16 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k16 .gk-kx{display:block}
.gk-k16 summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k16 summary::-webkit-details-marker{display:none}
.gk-k16 summary:focus:not(:focus-visible){outline:none}
.gk-k16 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k16.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k16.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k16.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k16.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k16.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k16.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k16.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k16 .gk-hd{min-height:62px}
.gk-k16 .gk-kx{flex:0 0 140px;width:140px;height:62px;block-size:62px}
.gk-k16 .gk-ew{grid-template-columns:140px;grid-template-rows:62px;width:140px;height:62px;block-size:62px}
.gk-k16 .gk-er{display:grid;grid-area:1/1/2/2;justify-self:end;align-self:start;grid-template-columns:72px;grid-template-rows:28px;width:72px;height:28px;block-size:28px;margin:6px 4px 0 0;transform:translate(0px,0px) rotate(-10deg)}
@keyframes gk-er{0%{transform:translate(0px,0px) rotate(-10deg)}14%{transform:translate(-34px,12px) rotate(-24deg)}28%{transform:translate(-58px,12px) rotate(-24deg)}42%{transform:translate(-38px,12px) rotate(-24deg)}56%{transform:translate(-56px,12px) rotate(-24deg)}70%{transform:translate(-40px,12px) rotate(-24deg)}82%{transform:translate(-54px,12px) rotate(-24deg)}100%{transform:translate(0px,0px) rotate(-10deg)}}
.gk-k16:has(.gk-kx[open]) .gk-er{animation:gk-er 1.25s ease-in-out 0s 1}
.gk-k16 .gk-rb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:72px;height:28px;block-size:28px;border:2px solid;border-radius:6px 4px 4px 11px}
.gk-k16 .gk-sv{display:block;grid-area:1/1/2/2;justify-self:end;align-self:start;width:44px;height:28px;block-size:28px;border-radius:0 4px 4px 0;overflow:clip}
.gk-k16 .gk-sv span{display:block;width:44px;height:10px;block-size:10px}
.gk-k16 .gk-sv .gk-v2{width:44px;height:8px;block-size:8px}
.gk-k16 .gk-cr{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;border-radius:1px;opacity:0;transition:opacity .25s ease}
.gk-k16 .gk-r1{width:4px;height:2px;block-size:2px;margin:58px 0 0 16px}
.gk-k16 .gk-r2{width:2px;height:2px;block-size:2px;margin:60px 0 0 24px}
.gk-k16 .gk-r3{width:4px;height:2px;block-size:2px;margin:58px 0 0 32px}
.gk-k16 .gk-r4{width:2px;height:2px;block-size:2px;margin:60px 0 0 42px}
.gk-k16:has(.gk-kx[open]) .gk-cr{opacity:1;transition:opacity .15s ease .4s}
.gk-k16:has(.gk-kx[open]) .gk-r2{transition-delay:.6s}
.gk-k16:has(.gk-kx[open]) .gk-r3{transition-delay:.78s}
.gk-k16:has(.gk-kx[open]) .gk-r4{transition-delay:.95s}
.gk-k16 .gk-lg{margin-top:16px}
.gk-k16 .gk-nr{opacity:1;transition:opacity .3s ease}
.gk-k16:has(.gk-kx[open]) .gk-nr{opacity:.32;transition:opacity .5s ease .3s}
.gk-k16:has(.gk-kx[open]) .gk-nr~.gk-nr{transition-delay:.65s}
@media (prefers-reduced-motion:reduce){.gk-k16 *{animation:none!important;transition:none!important}}
.gk-k16 p strong,.gk-k16 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k16.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k16.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k16.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k16.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k16.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k16.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k16.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k16.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k16.gk-tl .gk-uB{background-color:#c81e6a}
.gk-k16.gk-td .gk-uB{background-color:#ff5fa2}

.gk-k16.gk-cv-pk .gk-rb{background-color:#fde9f1}
.gk-k16.gk-cv-pk .gk-rb{border-color:#fda9cc}
.gk-k16.gk-cv-pk .gk-cr{background-color:#fda9cc}
.gk-k16.gk-cv-pk .gk-v1{background-color:#ff5fa2}
.gk-k16.gk-cv-pk .gk-v2{background-color:#fde9f1}
.gk-k16.gk-cv-pk .gk-v3{background-color:#c9105e}
.gk-k16.gk-cv-pk.gk-tn-n .gk-v2{background-color:#651235}
.gk-k16.gk-cv-pk.gk-tn-n .gk-v3{background-color:#fda9cc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><details class="gk-kx"><summary class="gk-ew" aria-label="지문 지우기"><span class="gk-er"><span class="gk-rb"></span><span class="gk-sv"><span class="gk-v1"></span><span class="gk-v2"></span><span class="gk-v3"></span></span></span><span class="gk-cr gk-r1"></span><span class="gk-cr gk-r2"></span><span class="gk-cr gk-r3"></span><span class="gk-cr gk-r4"></span></summary></details></div>
<div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k17",label:"바람개비",emoji:"🎐",desc:"늘 천천히 도는 바람개비 — 누르면 후 불어 빠르게 돌다 잦아들어요",key:"k17",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k17 gk-cv-bl gk-noaud"><style>
.gk-k17{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:16px 20px 16px;overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-k17 *{box-sizing:border-box}
.gk-k17 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k17 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k17 .gk-lmi{display:block;width:22px;height:22px;block-size:22px;background:url('0') center/100% 100% no-repeat}
.gk-k17 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k17 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k17 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k17 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k17 .gk-lg>p:last-child{margin-bottom:0}
.gk-k17 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k17 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-k17 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k17 audio{display:block}
.gk-k17 .gk-kx{display:block}
.gk-k17 summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k17 summary::-webkit-details-marker{display:none}
.gk-k17 summary:focus:not(:focus-visible){outline:none}
.gk-k17 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k17.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k17.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k17.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k17.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-k17.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k17.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k17.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k17.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-k17.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k17 .gk-tr{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.gk-k17 .gk-tw{flex:1 1 auto;min-width:0;padding-bottom:14px}
.gk-k17 .gk-tt{margin-top:0}
.gk-k17 .gk-kx{flex:0 0 64px;width:64px;height:68px;block-size:68px;margin-right:14px}
.gk-k17 .gk-pw{grid-template-columns:64px;grid-template-rows:68px;width:64px;height:68px;block-size:68px}
.gk-k17 .gk-sk{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:4px;height:36px;block-size:36px;margin:32px 0 0 30px;border-radius:2px 2px 0 0;background-color:#c7b998}
.gk-k17.gk-tn-n .gk-sk{background-color:#d8d1c2}
@keyframes gk-wd{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.gk-k17 .gk-wo{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;grid-template-columns:56px;grid-template-rows:56px;width:56px;height:56px;block-size:56px;margin:4px 0 0 4px;animation:gk-wd 16s linear 0s infinite}
.gk-k17 .gk-wi{display:grid;grid-area:1/1/2/2;grid-template-columns:56px;grid-template-rows:56px;width:56px;height:56px;block-size:56px;transform:rotate(0deg);transition:transform 3s cubic-bezier(.1,.55,.15,1)}
.gk-k17:has(.gk-kx[open]) .gk-wi{transform:rotate(1080deg)}
.gk-k17 .gk-wb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:56px;height:56px;block-size:56px}
.gk-k17 .gk-a0{clip-path:polygon(28px 28px,6px 6px,28px 6px)}
.gk-k17 .gk-l0{clip-path:polygon(28px 28px,28px 6px,39px 17px)}
.gk-k17 .gk-a1{clip-path:polygon(28px 28px,50px 6px,50px 28px)}
.gk-k17 .gk-l1{clip-path:polygon(28px 28px,50px 28px,39px 39px)}
.gk-k17 .gk-a2{clip-path:polygon(28px 28px,50px 50px,28px 50px)}
.gk-k17 .gk-l2{clip-path:polygon(28px 28px,28px 50px,17px 39px)}
.gk-k17 .gk-a3{clip-path:polygon(28px 28px,6px 50px,6px 28px)}
.gk-k17 .gk-l3{clip-path:polygon(28px 28px,6px 28px,17px 17px)}
.gk-k17 .gk-hb{display:block;grid-area:1/1/2/2;justify-self:center;align-self:center;width:8px;height:8px;block-size:8px;border-radius:50%}
.gk-k17 .gk-lg{padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-k17.gk-tn-n .gk-lg{background-color:#1c1e21}
@media (prefers-reduced-motion:reduce){.gk-k17 *{animation:none!important;transition:none!important}}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-panel,.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-play-button,.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-current-time-display,.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-k17.gk-noaud .gk-sd{display:none}
.gk-k17 p strong,.gk-k17 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k17.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k17.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k17.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k17.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k17.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k17.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k17.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae;background-color:#e8f4ff}
.gk-k17.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff;background-color:#1f3246}
.gk-k17.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k17.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k17.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k17.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k17.gk-k17.gk-k17 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}
.gk-k17 .gk-w2{background-color:#ff5fa2}
.gk-k17 .gk-x2{background-color:#fda9cc}

.gk-k17.gk-cv-bl .gk-w1{background-color:#3aa7ff}
.gk-k17.gk-cv-bl .gk-x1{background-color:#95cefc}
.gk-k17.gk-cv-bl .gk-hb{background-color:#10395a}
.gk-k17.gk-cv-bl.gk-tn-n .gk-hb{background-color:#e4f1fc}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tr"><div class="gk-tw"><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div><details class="gk-kx"><summary class="gk-pw" aria-label="바람 불기"><span class="gk-sk"></span><span class="gk-wo"><span class="gk-wi"><span class="gk-wb gk-a0 gk-w1"></span><span class="gk-wb gk-l0 gk-x1"></span><span class="gk-wb gk-a1 gk-w2"></span><span class="gk-wb gk-l1 gk-x2"></span><span class="gk-wb gk-a2 gk-w1"></span><span class="gk-wb gk-l2 gk-x1"></span><span class="gk-wb gk-a3 gk-w2"></span><span class="gk-wb gk-l3 gk-x2"></span><span class="gk-hb"></span></span></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-k18",label:"토스터",emoji:"🍞",desc:"레버를 누르면 눈금이 틱틱 돌고 빵이 탁 튀어 오르며 글이 같이 튀어나와요",key:"k18",peek:!0,open:!0,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-k18 gk-cv-bl"><style>
.gk-k18{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:16px 20px 18px;overflow:clip;text-align:left;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-k18 *{box-sizing:border-box}
.gk-k18 .gk-hd{display:flex;justify-content:space-between;align-items:flex-start;min-height:22px}
.gk-k18 .gk-lm{display:block;flex:0 0 22px;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-k18 .gk-lmi{display:block;width:22px;height:22px;block-size:22px;background:url('0') center/100% 100% no-repeat}
.gk-k18 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k18 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-k18 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-k18 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-k18 .gk-lg>p:last-child{margin-bottom:0}
.gk-k18 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-k18 .gk-kx{display:block}
.gk-k18 summary{display:grid;list-style:none;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-k18 summary::-webkit-details-marker{display:none}
.gk-k18 summary:focus:not(:focus-visible){outline:none}
.gk-k18 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-k18.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-k18.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-k18.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-k18.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-k18.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-k18.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-k18.gk-tn-n{border-color:rgba(224,224,228,.09);background-color:#25272b}
.gk-k18 .gk-tr{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.gk-k18 .gk-tw{flex:1 1 auto;min-width:0;padding-bottom:10px}
.gk-k18 .gk-tt{margin-top:0}
.gk-k18 .gk-kx{flex:0 0 88px;width:88px;height:84px;block-size:84px}
.gk-k18 .gk-to{grid-template-columns:88px;grid-template-rows:84px;width:88px;height:84px;block-size:84px}
.gk-k18 .gk-bc{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;grid-template-columns:88px;grid-template-rows:84px;width:88px;height:42px;block-size:42px;overflow:clip}
.gk-k18 .gk-bm,.gk-k18 .gk-bi,.gk-k18 .gk-bt{display:grid;grid-area:1/1/2/2;grid-template-columns:88px;grid-template-rows:84px;width:88px;height:84px;block-size:84px}
.gk-k18 .gk-sb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:44px;height:36px;block-size:36px;margin:24px 0 0 24px}
.gk-k18 .gk-sc,.gk-k18 .gk-sf{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:44px;height:32px;block-size:32px;margin:28px 0 0 18px}
.gk-k18 .gk-sb{-webkit-mask-image:url('20');mask-image:url('20');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:44px 36px;mask-size:44px 36px}
.gk-k18 .gk-sc{-webkit-mask-image:url('21');mask-image:url('21');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:44px 32px;mask-size:44px 32px}
.gk-k18 .gk-sf{-webkit-mask-image:url('22');mask-image:url('22');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:44px 32px;mask-size:44px 32px}
@keyframes gk-tb18{0%{transform:translateY(0px);animation-timing-function:cubic-bezier(.5,0,.9,.6)}19%{transform:translateY(20px)}58%{transform:translateY(20px);animation-timing-function:cubic-bezier(.15,.8,.3,1)}69%{transform:translateY(-16px);animation-timing-function:ease-in-out}83%{transform:translateY(-8px);animation-timing-function:ease-in-out}100%{transform:translateY(-10px)}}
.gk-k18 .gk-bm{transform:translateY(0px);transition:transform .9s cubic-bezier(.33,6,.67,1.6)}
.gk-k18:has(.gk-kx[open]) .gk-bm{transform:translateY(-10px);transition:none;animation:gk-tb18 1.3s linear 0s 1}
.gk-k18 .gk-bi{opacity:1;transition:opacity 0s linear .38s}
.gk-k18:has(.gk-kx[open]) .gk-bi{opacity:0;transition:opacity 0s linear .45s}
.gk-k18 .gk-bt{opacity:0;transition:opacity 0s linear .38s}
.gk-k18:has(.gk-kx[open]) .gk-bt{opacity:1;transition:opacity 0s linear .45s}
.gk-k18 .gk-sm{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:6px;height:14px;block-size:14px;opacity:0}
.gk-k18 .gk-sm{-webkit-mask-image:url('10');mask-image:url('10');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:6px 14px;mask-size:6px 14px}
.gk-k18 .gk-m1{margin:2px 0 0 30px}
.gk-k18 .gk-m2{margin:2px 0 0 46px}
@keyframes gk-st{0%{opacity:0;transform:translateY(4px)}30%{opacity:.9}100%{opacity:0;transform:translateY(-4px)}}
.gk-k18:has(.gk-kx[open]) .gk-m1{animation:gk-st 2.6s ease-in-out 1.3s infinite}
.gk-k18:has(.gk-kx[open]) .gk-m2{animation:gk-st 2.6s ease-in-out 2.5s infinite}
.gk-k18 .gk-bd{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:72px;height:38px;block-size:38px;margin:42px 0 0 6px;border-radius:10px 10px 6px 6px}
.gk-k18 .gk-so{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:56px;height:4px;block-size:4px;margin:42px 0 0 14px;border-radius:0 0 2px 2px}
.gk-k18 .gk-sr{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:72px;height:4px;block-size:4px;margin:66px 0 0 6px}
.gk-k18 .gk-dw{display:grid;grid-area:1/1/2/2;justify-self:start;align-self:start;grid-template-columns:12px;grid-template-rows:12px;width:12px;height:12px;block-size:12px;margin:50px 0 0 14px;border-radius:50%;transform:rotate(0deg)}
.gk-k18 .gk-dt{display:block;grid-area:1/1/2/2;justify-self:center;align-self:start;width:4px;height:4px;block-size:4px;margin-top:2px;border-radius:2px}
.gk-k18 .gk-tk{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:2px;height:24px;block-size:24px;margin:48px 0 0 72px;border-radius:1px}
.gk-k18 .gk-kb{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:12px;height:8px;block-size:8px;margin:46px 0 0 76px;border-radius:4px;transform:translateY(0px)}
.gk-k18 .gk-f1,.gk-k18 .gk-f2{display:block;grid-area:1/1/2/2;justify-self:start;align-self:start;width:8px;height:4px;block-size:4px;margin:80px 0 0 14px;border-radius:0 0 2px 2px}
.gk-k18 .gk-f2{margin-left:62px}
@keyframes gk-tl{0%{transform:translateY(0px);animation-timing-function:cubic-bezier(.5,0,.9,.6)}19%{transform:translateY(16px)}58%{transform:translateY(16px);animation-timing-function:cubic-bezier(.2,.8,.3,1)}66%{transform:translateY(-4px)}80%{transform:translateY(2px)}100%{transform:translateY(0px)}}
@keyframes gk-td{0%{transform:rotate(0deg)}19%{transform:rotate(120deg);animation-timing-function:steps(6,end)}58%{transform:rotate(0deg)}100%{transform:rotate(0deg)}}
.gk-k18:has(.gk-kx[open]) .gk-kb{animation:gk-tl 1.3s linear 0s 1}
.gk-k18:has(.gk-kx[open]) .gk-dw{animation:gk-td 1.3s linear 0s 1}
.gk-k18 .gk-sl{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.gk-k18:has(.gk-kx[open]) .gk-sl{grid-template-rows:1fr;transition:grid-template-rows .32s cubic-bezier(.2,.9,.3,1) .75s}
.gk-k18 .gk-lw{min-height:0;overflow:clip}
.gk-k18 .gk-lg{padding-top:14px;opacity:0;transform:translateY(14px);transition:opacity .15s ease,transform .15s ease}
.gk-k18:has(.gk-kx[open]) .gk-lg{opacity:1;transform:translateY(0px);transition:opacity .2s ease .75s,transform .45s cubic-bezier(.3,1.5,.5,1) .75s}
@media (prefers-reduced-motion:reduce){.gk-k18 *{animation:none!important;transition:none!important}}
.gk-k18 p strong,.gk-k18 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-k18.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-k18.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-k18.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k18.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-k18.gk-tl .gk-uA{background-color:#0a69ae}
.gk-k18.gk-td .gk-uA{background-color:#3aa7ff}
.gk-k18.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-k18.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-k18.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-k18.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}

.gk-k18.gk-cv-bl .gk-bd{background-color:#3aa7ff}
.gk-k18.gk-cv-bl .gk-so{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-sr{background-color:#95cefc}
.gk-k18.gk-cv-bl .gk-dw{background-color:#e4f1fc}
.gk-k18.gk-cv-bl .gk-dt{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-tk{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-kb{background-color:#10395a}
.gk-k18.gk-cv-bl .gk-f1{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-f2{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-bi .gk-sb{background-color:#95cefc}
.gk-k18.gk-cv-bl .gk-bi .gk-sc{background-color:#3aa7ff}
.gk-k18.gk-cv-bl .gk-bi .gk-sf{background-color:#e4f1fc}
.gk-k18.gk-cv-bl .gk-bt .gk-sb{background-color:#0f6ab4}
.gk-k18.gk-cv-bl .gk-bt .gk-sc{background-color:#10395a}
.gk-k18.gk-cv-bl .gk-bt .gk-sf{background-color:#95cefc}
.gk-k18.gk-cv-bl .gk-sm{background-color:#95cefc}
.gk-k18.gk-cv-bl.gk-tn-n .gk-bd{background-color:#0f6ab4}
.gk-k18.gk-cv-bl.gk-tn-n .gk-so{background-color:#10395a}
.gk-k18.gk-cv-bl.gk-tn-n .gk-sr{background-color:#3aa7ff}
.gk-k18.gk-cv-bl.gk-tn-n .gk-dw{background-color:#95cefc}
.gk-k18.gk-cv-bl.gk-tn-n .gk-dt{background-color:#10395a}
.gk-k18.gk-cv-bl.gk-tn-n .gk-tk{background-color:#10395a}
.gk-k18.gk-cv-bl.gk-tn-n .gk-kb{background-color:#95cefc}
.gk-k18.gk-cv-bl.gk-tn-n .gk-f1{background-color:#3aa7ff}
.gk-k18.gk-cv-bl.gk-tn-n .gk-f2{background-color:#3aa7ff}
</style>
<div class="gk-hd"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a></div>
<div class="gk-tr"><div class="gk-tw"><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div><details class="gk-kx"><summary class="gk-to" aria-label="빵 굽기"><span class="gk-bc"><span class="gk-bm"><span class="gk-bi"><span class="gk-sb"></span><span class="gk-sc"></span><span class="gk-sf"></span></span><span class="gk-bt"><span class="gk-sb"></span><span class="gk-sc"></span><span class="gk-sf"></span></span></span></span><span class="gk-sm gk-m1"></span><span class="gk-sm gk-m2"></span><span class="gk-bd"></span><span class="gk-so"></span><span class="gk-sr"></span><span class="gk-dw"><span class="gk-dt"></span></span><span class="gk-tk"></span><span class="gk-kb"></span><span class="gk-f1"></span><span class="gk-f2"></span></summary></details></div>
<div class="gk-sl"><div class="gk-lw"><div class="gk-lg">
{{로그}}
</div></div></div>
</div>`},{id:"simple-q01",label:"여름 바다",emoji:"🏖️",desc:"물결 위에 떠 있는 비치볼 — 누르고 있는 동안 볼이 살짝 눌려요",key:"q01",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q01 gk-cv-bl"><style>
.gk-q01{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q01 *{box-sizing:border-box}
.gk-q01 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q01 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q01 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q01 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q01 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q01 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q01 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q01 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q01 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q01 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q01 .gk-lg>p:last-child{margin-bottom:0}
.gk-q01 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q01 .gk-tb{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
@media (prefers-reduced-motion:reduce){.gk-q01 *{animation:none!important;transition:none!important}}
.gk-q01.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q01.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q01.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q01.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q01.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q01.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q01 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q01{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-q01.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q01 .gk-lg{margin-top:16px}
.gk-q01{padding-bottom:0}
.gk-q01 .gk-sea{display:grid;grid-template-columns:minmax(0,1fr);height:72px;block-size:72px;margin:10px -20px 0;overflow:clip}
.gk-q01 .gk-sea>*{grid-area:1/1/2/2}
.gk-q01 .gk-wb{display:block;align-self:end;min-width:0;overflow:clip;line-height:0}
.gk-q01 .gk-wb1{height:62px;block-size:62px;margin-bottom:6px}
.gk-q01 .gk-wb2{height:24px;block-size:24px}
.gk-q01 .gk-ws{display:block;width:calc(100% + 64px);-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x}
.gk-q01 .gk-w1{height:62px;block-size:62px;-webkit-mask-size:64px 62px;mask-size:64px 62px}
.gk-q01 .gk-w2{height:24px;block-size:24px;-webkit-mask-size:48px 24px;mask-size:48px 24px}
.gk-q01 .gk-w1{-webkit-mask-image:url('93');mask-image:url('93')}
.gk-q01 .gk-w2{-webkit-mask-image:url('94');mask-image:url('94')}
.gk-q01 .gk-tb{display:grid;justify-self:end;align-self:end;grid-template-columns:52px;grid-template-rows:52px;width:52px;height:52px;block-size:52px;margin:0 44px 2px 0;line-height:0;transition:transform .5s cubic-bezier(.3,1.7,.5,1)}
.gk-q01 .gk-tb:active{transform:translateY(8px);transition:transform .18s ease-out}
.gk-q01 .gk-lw{grid-template-columns:52px;grid-template-rows:52px;transform-origin:26px 26px}
.gk-q01 .gk-tb .gk-ly,.gk-q01 .gk-tb .gk-lw{width:52px;height:52px;block-size:52px}
.gk-q01 .gk-m-b0{-webkit-mask-image:url('91');mask-image:url('91')}
.gk-q01 .gk-m-b1{-webkit-mask-image:url('81');mask-image:url('81')}
.gk-q01 .gk-m-b2{-webkit-mask-image:url('82');mask-image:url('82')}
.gk-q01 .gk-m-b3{-webkit-mask-image:url('95');mask-image:url('95')}
@keyframes gk-q-wv1{0%{transform:translateX(0)}100%{transform:translateX(-64px)}}
@keyframes gk-q-wv2{0%{transform:translateX(0)}100%{transform:translateX(-48px)}}
@keyframes gk-q-bob{0%{transform:translateY(-2px) rotate(-5deg)}100%{transform:translateY(2px) rotate(5deg)}}
.gk-q01 p strong,.gk-q01 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q01.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q01.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q01.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q01.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q01.gk-tl .gk-uA{background-color:#0a69ae}
.gk-q01.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q01.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q01.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q01.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q01.gk-td .gk-uA{background-color:#3aa7ff}

.gk-q01.gk-cv-bl .gk-c1{background-color:#e4f1fc}
.gk-q01.gk-cv-bl .gk-c3{background-color:#95cefc}
.gk-q01.gk-cv-bl .gk-c5{background-color:#3aa7ff}
.gk-q01.gk-cv-bl .gk-c7{background-color:#0f6ab4}
.gk-q01.gk-cv-bl .gk-c9{background-color:#10395a}
.gk-q01.gk-cv-bl .gk-cf{background-color:#e4f1fc}
.gk-q01.gk-cv-bl.gk-tn-n .gk-cf{background-color:#10395a}
.gk-q01.gk-cv-bl .gk-cb{background-color:#95cefc}
.gk-q01.gk-cv-bl.gk-tn-n .gk-cb{background-color:#0f6ab4}
.gk-q01.gk-cv-bl .gk-dk{background-color:#10395a}
.gk-q01.gk-cv-bl.gk-tn-n .gk-dk{background-color:#95cefc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div></div>
<div class="gk-lg">
{{로그}}
</div>
<div class="gk-sea"><span class="gk-wb gk-wb1"><span class="gk-ws gk-w1 gk-c3" style="animation:gk-q-wv1 9s linear 0s infinite"></span></span><span class="gk-tb" aria-label="비치볼"><span class="gk-lw" style="animation:gk-q-bob 3.2s ease-in-out 0s infinite alternate"><span class="gk-ly gk-m-b0 gk-c5"></span><span class="gk-ly gk-m-b1 gk-c1"></span><span class="gk-ly gk-m-b2 gk-c5"></span><span class="gk-ly gk-m-b3 gk-c7"></span></span></span><span class="gk-wb gk-wb2"><span class="gk-ws gk-w2 gk-c7" style="animation:gk-q-wv2 5s linear 0s infinite"></span></span></div>
</div>`},{id:"simple-q02",label:"흐림",emoji:"☁️",desc:"구름을 누르면 구름이 밀려나고 해와 햇살이 드러나요",key:"q02",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q02 gk-cv-bl gk-noaud"><style>
.gk-q02{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q02 *{box-sizing:border-box}
.gk-q02 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q02 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q02 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q02 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q02 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q02 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q02 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q02 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q02 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q02 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q02 .gk-lg>p:last-child{margin-bottom:0}
.gk-q02 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q02 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-q02.gk-noaud .gk-sd{display:none}
.gk-q02 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q02 audio{display:block}
.gk-q02 .gk-kx{display:block}
.gk-q02 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q02 summary{list-style:none}
.gk-q02 summary::-webkit-details-marker{display:none}
.gk-q02 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q02 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q02 *{animation:none!important;transition:none!important}}
.gk-q02.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q02.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q02.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q02.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q02.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q02.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q02.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-q02.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-q02 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q02{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q02.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q02 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q02.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q02 .gk-kx{flex:0 0 120px;width:120px;height:68px;block-size:68px}
.gk-q02 .gk-cl{display:grid;grid-template-columns:120px;grid-template-rows:68px;width:120px;height:68px;block-size:68px;line-height:0}
.gk-q02 .gk-lw{grid-template-columns:120px;grid-template-rows:68px}
.gk-q02 .gk-cl .gk-ly,.gk-q02 .gk-cl .gk-lw{width:120px;height:68px;block-size:68px}
.gk-q02 .gk-m-sn{-webkit-mask-image:url('84');mask-image:url('84')}
.gk-q02 .gk-m-sr{-webkit-mask-image:url('2');mask-image:url('2')}
.gk-q02 .gk-m-cb{-webkit-mask-image:url('9');mask-image:url('9')}
.gk-q02 .gk-m-cf{-webkit-mask-image:url('3');mask-image:url('3')}
.gk-q02 .gk-sr{opacity:0;transform:scale(.7);transform-origin:70px 24px;transition:opacity .25s ease 0s,transform .25s ease 0s}
.gk-q02 .gk-pf,.gk-q02 .gk-pb{transition:transform 1.1s cubic-bezier(.25,.8,.3,1)}
.gk-q02:has(.gk-kx[open]) .gk-pf{transform:translateX(-26px)}
.gk-q02:has(.gk-kx[open]) .gk-pb{transform:translateX(8px)}
.gk-q02:has(.gk-kx[open]) .gk-sr{opacity:1;transform:scale(1);transition:opacity .5s ease .7s,transform .5s cubic-bezier(.3,1.5,.5,1) .7s}
@keyframes gk-q-dr{0%{transform:translateX(-2px)}100%{transform:translateX(3px)}}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-panel,.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-play-button,.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-current-time-display,.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-q02 p strong,.gk-q02 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q02.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q02.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q02.gk-tl .gk-nm.gk-nA,.gk-q02.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q02.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q02.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-q02.gk-tl .gk-uA{background-color:#0a69ae}
.gk-q02.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q02.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q02.gk-td .gk-nm.gk-nA,.gk-q02.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q02.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q02.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-q02.gk-td .gk-uA{background-color:#3aa7ff}
.gk-q02.gk-q02.gk-q02 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-q02.gk-cv-bl .gk-c1{background-color:#e4f1fc}
.gk-q02.gk-cv-bl .gk-c3{background-color:#95cefc}
.gk-q02.gk-cv-bl .gk-c5{background-color:#3aa7ff}
.gk-q02.gk-cv-bl .gk-c7{background-color:#0f6ab4}
.gk-q02.gk-cv-bl .gk-c9{background-color:#10395a}
.gk-q02.gk-cv-bl .gk-cf{background-color:#e4f1fc}
.gk-q02.gk-cv-bl.gk-tn-n .gk-cf{background-color:#10395a}
.gk-q02.gk-cv-bl .gk-cb{background-color:#95cefc}
.gk-q02.gk-cv-bl.gk-tn-n .gk-cb{background-color:#0f6ab4}
.gk-q02.gk-cv-bl .gk-dk{background-color:#10395a}
.gk-q02.gk-cv-bl.gk-tn-n .gk-dk{background-color:#95cefc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div><details class="gk-kx"><summary class="gk-cl" aria-label="구름 걷기"><span class="gk-ly gk-m-sr gk-c5 gk-sr"></span><span class="gk-ly gk-m-sn gk-c5"></span><span class="gk-lw gk-pb"><span class="gk-ly gk-m-cb gk-c7"></span></span><span class="gk-lw gk-pf"><span class="gk-lw" style="animation:gk-q-dr 7s ease-in-out 0s infinite alternate"><span class="gk-ly gk-m-cf gk-c3"></span></span></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q03",label:"새해 첫날",emoji:"🌅",desc:"해돋이를 누르면 해가 떠오르고 햇살 일곱 줄이 퍼져요",key:"q03",peek:!0,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q03 gk-cv-pk"><style>
.gk-q03{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q03 *{box-sizing:border-box}
.gk-q03 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q03 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q03 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q03 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q03 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q03 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q03 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q03 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q03 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q03 .gk-lg>p:last-child{margin-bottom:0}
.gk-q03 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q03 .gk-kx{display:block}
.gk-q03 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q03 summary{list-style:none}
.gk-q03 summary::-webkit-details-marker{display:none}
.gk-q03 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q03 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q03 *{animation:none!important;transition:none!important}}
.gk-q03.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q03.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q03.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q03.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q03.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q03.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q03 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q03{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-q03.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q03 .gk-lg{margin-top:16px}
.gk-q03 .gk-kx{flex:0 0 120px;width:120px;height:70px;block-size:70px}
.gk-q03 .gk-hz{display:grid;grid-template-columns:120px;grid-template-rows:70px;width:120px;height:70px;block-size:70px;line-height:0}
.gk-q03 .gk-lw{grid-template-columns:120px;grid-template-rows:70px}
.gk-q03 .gk-hz .gk-ly,.gk-q03 .gk-hz .gk-lw{width:120px;height:70px;block-size:70px}
.gk-q03 .gk-hz{overflow:clip}
.gk-q03 .gk-m-so{-webkit-mask-image:url('85');mask-image:url('85')}
.gk-q03 .gk-m-ry{-webkit-mask-image:url('6');mask-image:url('6')}
.gk-q03 .gk-m-h1{-webkit-mask-image:url('83');mask-image:url('83')}
.gk-q03 .gk-m-h2{-webkit-mask-image:url('78');mask-image:url('78')}
.gk-q03 .gk-so{transform:translateY(22px);transition:transform 1.2s cubic-bezier(.4,0,.7,1)}
.gk-q03 .gk-ry{opacity:0;transform:scale(.8);transform-origin:60px 28px;transition:opacity .2s ease 0s,transform .2s ease 0s}
.gk-q03:has(.gk-kx[open]) .gk-so{transform:translateY(0);transition:transform 1.4s cubic-bezier(.3,0,.2,1)}
.gk-q03:has(.gk-kx[open]) .gk-ry{opacity:1;transform:scale(1);transition:opacity .5s ease 1s,transform .6s cubic-bezier(.3,1.5,.5,1) 1s}
.gk-q03 p strong,.gk-q03 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q03.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q03.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q03.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q03.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q03.gk-tl .gk-uB{background-color:#c81e6a}
.gk-q03.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q03.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q03.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q03.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q03.gk-td .gk-uB{background-color:#ff5fa2}

.gk-q03.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-q03.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-q03.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-q03.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-q03.gk-cv-pk .gk-c9{background-color:#651235}
.gk-q03.gk-cv-pk .gk-cf{background-color:#fde9f1}
.gk-q03.gk-cv-pk.gk-tn-n .gk-cf{background-color:#651235}
.gk-q03.gk-cv-pk .gk-cb{background-color:#fda9cc}
.gk-q03.gk-cv-pk.gk-tn-n .gk-cb{background-color:#c9105e}
.gk-q03.gk-cv-pk .gk-dk{background-color:#651235}
.gk-q03.gk-cv-pk.gk-tn-n .gk-dk{background-color:#fda9cc}
.gk-q03.gk-cv-pk.gk-tn-n .gk-m-h1{background-color:#651235}
.gk-q03.gk-cv-pk.gk-tn-n .gk-m-h2{background-color:#c9105e}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span></div><details class="gk-kx"><summary class="gk-hz" aria-label="해돋이"><span class="gk-ly gk-m-ry gk-c3 gk-ry"></span><span class="gk-ly gk-m-so gk-c5 gk-so"></span><span class="gk-ly gk-m-h1 gk-c7"></span><span class="gk-ly gk-m-h2 gk-c9"></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q04",label:"새벽",emoji:"🌌",desc:"가로등을 누르면 깜빡이다 켜지며 빛기둥이 내려와요",key:"q04",peek:!0,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q04 gk-cv-bl"><style>
.gk-q04{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q04 *{box-sizing:border-box}
.gk-q04 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q04 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q04 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q04 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q04 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q04 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q04 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q04 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q04 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q04 .gk-lg>p:last-child{margin-bottom:0}
.gk-q04 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q04 .gk-kx{display:block}
.gk-q04 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q04 summary{list-style:none}
.gk-q04 summary::-webkit-details-marker{display:none}
.gk-q04 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q04 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q04 *{animation:none!important;transition:none!important}}
.gk-q04.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q04.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q04.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q04.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q04.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q04.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q04 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q04{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q04.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q04 .gk-lg{margin-top:0px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q04.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q04 .gk-kx{flex:0 0 64px;width:64px;height:104px;block-size:104px}
.gk-q04 .gk-lp{display:grid;grid-template-columns:64px;grid-template-rows:104px;width:64px;height:104px;block-size:104px;line-height:0}
.gk-q04 .gk-lw{grid-template-columns:64px;grid-template-rows:104px}
.gk-q04 .gk-lp .gk-ly,.gk-q04 .gk-lp .gk-lw{width:64px;height:104px;block-size:104px}
.gk-q04 .gk-m-cn{-webkit-mask-image:url('98');mask-image:url('98')}
.gk-q04 .gk-m-lp{-webkit-mask-image:url('1');mask-image:url('1')}
.gk-q04 .gk-m-bb{-webkit-mask-image:url('92');mask-image:url('92')}
.gk-q04 .gk-on{opacity:0;transition:opacity .18s ease}
.gk-q04:has(.gk-kx[open]) .gk-on{opacity:1;transition:none;animation:gk-q-on .42s linear 0s 1}
@keyframes gk-q-on{0%{opacity:0}20%{opacity:1}45%{opacity:.35}70%{opacity:1}100%{opacity:1}}
.gk-q04 p strong,.gk-q04 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q04.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q04.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q04.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q04.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q04.gk-tl .gk-uA{background-color:#0a69ae}
.gk-q04.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q04.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q04.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q04.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q04.gk-td .gk-uA{background-color:#3aa7ff}

.gk-q04.gk-cv-bl .gk-c1{background-color:#e4f1fc}
.gk-q04.gk-cv-bl .gk-c3{background-color:#95cefc}
.gk-q04.gk-cv-bl .gk-c5{background-color:#3aa7ff}
.gk-q04.gk-cv-bl .gk-c7{background-color:#0f6ab4}
.gk-q04.gk-cv-bl .gk-c9{background-color:#10395a}
.gk-q04.gk-cv-bl .gk-cf{background-color:#e4f1fc}
.gk-q04.gk-cv-bl.gk-tn-n .gk-cf{background-color:#10395a}
.gk-q04.gk-cv-bl .gk-cb{background-color:#95cefc}
.gk-q04.gk-cv-bl.gk-tn-n .gk-cb{background-color:#0f6ab4}
.gk-q04.gk-cv-bl .gk-dk{background-color:#10395a}
.gk-q04.gk-cv-bl.gk-tn-n .gk-dk{background-color:#95cefc}
.gk-q04.gk-cv-bl .gk-m-lp{background-color:#10395a}
.gk-q04.gk-cv-bl.gk-tn-n .gk-m-lp{background-color:#0f6ab4}
.gk-q04.gk-cv-bl .gk-bo{background-color:#95cefc}
.gk-q04.gk-cv-bl.gk-tn-n .gk-bo{background-color:#10395a}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div><details class="gk-kx"><summary class="gk-lp" aria-label="가로등"><span class="gk-ly gk-m-cn gk-cf gk-on"></span><span class="gk-ly gk-m-lp"></span><span class="gk-ly gk-m-bb gk-bo"></span><span class="gk-ly gk-m-bb gk-c5 gk-on"></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q05",label:"메신저",emoji:"💭",desc:"입력 중 점 셋이 뛰는 말풍선 — 누르면 보낸 말풍선과 안 읽음 「1」이 떠요",key:"q05",peek:!1,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q05 gk-cv-pk gk-noaud"><style>
.gk-q05{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q05 *{box-sizing:border-box}
.gk-q05 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q05 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q05 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q05 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q05 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q05 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q05 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q05 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q05 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q05 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q05 .gk-lg>p:last-child{margin-bottom:0}
.gk-q05 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q05 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-q05.gk-noaud .gk-sd{display:none}
.gk-q05 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q05 audio{display:block}
.gk-q05 .gk-kx{display:block}
.gk-q05 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q05 summary{list-style:none}
.gk-q05 summary::-webkit-details-marker{display:none}
.gk-q05 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q05 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q05 *{animation:none!important;transition:none!important}}
.gk-q05.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q05.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q05.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q05.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q05.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q05.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q05.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-q05.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-q05 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q05{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q05.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q05 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q05.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q05 .gk-kx{flex:0 0 84px;width:84px;height:60px;block-size:60px}
.gk-q05 .gk-mb{display:grid;grid-template-columns:84px;grid-template-rows:60px;width:84px;height:60px;block-size:60px;line-height:0}
.gk-q05 .gk-lw{grid-template-columns:84px;grid-template-rows:60px}
.gk-q05 .gk-mb .gk-ly,.gk-q05 .gk-mb .gk-lw{width:84px;height:60px;block-size:60px}
.gk-q05 .gk-lw{transition:opacity .16s ease,transform .32s cubic-bezier(.3,1.4,.5,1)}
.gk-q05 .gk-m-tb{-webkit-mask-image:url('44');mask-image:url('44')}
.gk-q05 .gk-m-d0{-webkit-mask-image:url('86');mask-image:url('86')}
.gk-q05 .gk-m-d1{-webkit-mask-image:url('87');mask-image:url('87')}
.gk-q05 .gk-m-d2{-webkit-mask-image:url('88');mask-image:url('88')}
.gk-q05 .gk-m-sb{-webkit-mask-image:url('45');mask-image:url('45')}
.gk-q05 .gk-m-sl{-webkit-mask-image:url('43');mask-image:url('43')}
.gk-q05 .gk-m-s1{-webkit-mask-image:url('19');mask-image:url('19')}
.gk-q05 .gk-sa{transform-origin:16px 54px}
.gk-q05 .gk-sb{opacity:0;transform:scale(.6);transform-origin:76px 54px}
.gk-q05:has(.gk-kx[open]) .gk-sa{opacity:0;transform:scale(.6)}
.gk-q05:has(.gk-kx[open]) .gk-sb{opacity:1;transform:scale(1)}
@keyframes gk-q-ty{0%{transform:translateY(0)}25%{transform:translateY(-5px)}50%{transform:translateY(0)}100%{transform:translateY(0)}}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-panel,.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-play-button,.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-current-time-display,.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-q05 p strong,.gk-q05 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q05.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q05.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q05.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q05.gk-tl .gk-nm.gk-nB,.gk-q05.gk-tl .gk-sn.gk-sB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q05.gk-tl .gk-sn.gk-sB{background-color:#ffeef5}
.gk-q05.gk-tl .gk-uB{background-color:#c81e6a}
.gk-q05.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q05.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q05.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q05.gk-td .gk-nm.gk-nB,.gk-q05.gk-td .gk-sn.gk-sB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q05.gk-td .gk-sn.gk-sB{background-color:#422432}
.gk-q05.gk-td .gk-uB{background-color:#ff5fa2}
.gk-q05.gk-q05.gk-q05 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(285deg) brightness(1.05)!important}

.gk-q05.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-q05.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-q05.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-q05.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-q05.gk-cv-pk .gk-c9{background-color:#651235}
.gk-q05.gk-cv-pk .gk-cf{background-color:#fde9f1}
.gk-q05.gk-cv-pk.gk-tn-n .gk-cf{background-color:#651235}
.gk-q05.gk-cv-pk .gk-cb{background-color:#fda9cc}
.gk-q05.gk-cv-pk.gk-tn-n .gk-cb{background-color:#c9105e}
.gk-q05.gk-cv-pk .gk-dk{background-color:#651235}
.gk-q05.gk-cv-pk.gk-tn-n .gk-dk{background-color:#fda9cc}
.gk-q05.gk-cv-pk .gk-dt{background-color:#c9105e}
.gk-q05.gk-cv-pk.gk-tn-n .gk-dt{background-color:#fda9cc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span></div><details class="gk-kx"><summary class="gk-mb" aria-label="말풍선 보내기"><span class="gk-lw gk-sa"><span class="gk-ly gk-m-tb gk-cb"></span><span class="gk-ly gk-m-d0 gk-dt" style="animation:gk-q-ty 1.3s ease-in-out 0.00s infinite"></span><span class="gk-ly gk-m-d1 gk-dt" style="animation:gk-q-ty 1.3s ease-in-out 0.16s infinite"></span><span class="gk-ly gk-m-d2 gk-dt" style="animation:gk-q-ty 1.3s ease-in-out 0.32s infinite"></span></span><span class="gk-lw gk-sb"><span class="gk-ly gk-m-sb gk-c5"></span><span class="gk-ly gk-m-sl gk-c1"></span><span class="gk-ly gk-m-s1 gk-c5"></span></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q06",label:"편지 봉투",emoji:"✉️",desc:"봉투를 누르면 하트 스티커가 떨어지고 뚜껑이 젖혀지며 편지지가 올라와 글이 펼쳐져요",key:"q06",peek:!0,open:!0,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q06 gk-cv-pk"><style>
.gk-q06{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q06 *{box-sizing:border-box}
.gk-q06 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q06 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q06 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q06 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q06 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q06 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q06 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q06 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q06 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q06 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q06 .gk-lg>p:last-child{margin-bottom:0}
.gk-q06 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q06 .gk-kx{display:block}
.gk-q06 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q06 summary{list-style:none}
.gk-q06 summary::-webkit-details-marker{display:none}
.gk-q06 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q06 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q06 *{animation:none!important;transition:none!important}}
.gk-q06.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q06.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q06.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q06.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q06.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q06.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q06 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q06{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-q06.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q06 .gk-lg{margin-top:14px}
.gk-q06 .gk-kx{flex:0 0 108px;width:108px;height:84px;block-size:84px}
.gk-q06 .gk-ev{display:grid;grid-template-columns:108px;grid-template-rows:84px;width:108px;height:84px;block-size:84px;line-height:0}
.gk-q06 .gk-lw{grid-template-columns:108px;grid-template-rows:84px}
.gk-q06 .gk-ev .gk-ly,.gk-q06 .gk-ev .gk-lw{width:108px;height:84px;block-size:84px}
.gk-q06 .gk-m-fu{-webkit-mask-image:url('102');mask-image:url('102')}
.gk-q06 .gk-m-sh{-webkit-mask-image:url('68');mask-image:url('68')}
.gk-q06 .gk-m-bd{-webkit-mask-image:url('72');mask-image:url('72')}
.gk-q06 .gk-m-bf{-webkit-mask-image:url('99');mask-image:url('99')}
.gk-q06 .gk-m-fd{-webkit-mask-image:url('100');mask-image:url('100')}
.gk-q06 .gk-m-ht{-webkit-mask-image:url('14');mask-image:url('14')}
.gk-q06 .gk-m-hw{-webkit-mask-image:url('4');mask-image:url('4')}
.gk-q06 .gk-hw{background-color:#ffffff}
.gk-q06 .gk-sh{transform:translateY(22px);transition:transform .28s ease-in 0s}
.gk-q06 .gk-fb{transform:scaleY(0);transform-origin:54px 35px;transition:transform .16s ease-in .22s}
.gk-q06 .gk-ff{transform:scaleY(1);transform-origin:54px 35px;transition:transform .2s cubic-bezier(.3,1.4,.5,1) .38s}
.gk-q06 .gk-hs{filter:drop-shadow(0 1px 2px rgba(0,0,0,.18));transform:translate(0,0) rotate(0deg) scale(1);transform-origin:54px 62px;opacity:1;transition:transform .26s cubic-bezier(.3,1.7,.5,1) .6s,opacity .1s ease .6s}
.gk-q06:has(.gk-kx[open]) .gk-hs{transform:translate(-7px,-11px) rotate(-24deg) scale(.9);opacity:0;transition:transform .2s ease-in 0s,opacity .12s ease-in .1s}
.gk-q06:has(.gk-kx[open]) .gk-ff{transform:scaleY(0);transition:transform .16s ease-in .14s}
.gk-q06:has(.gk-kx[open]) .gk-fb{transform:scaleY(1);transition:transform .24s cubic-bezier(.3,1.5,.5,1) .3s}
.gk-q06:has(.gk-kx[open]) .gk-sh{transform:translateY(0);transition:transform .36s cubic-bezier(.3,1.6,.5,1) .44s}
.gk-q06 .gk-cz{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;margin-top:10px;transition:grid-template-rows .35s cubic-bezier(.4,0,.2,1) 0s}
.gk-q06 .gk-cz>.gk-lg{min-height:0;margin-top:0;overflow:clip;opacity:0;transition:opacity .2s ease 0s}
.gk-q06:has(.gk-kx[open]) .gk-cz{grid-template-rows:1fr;transition:grid-template-rows .45s cubic-bezier(.2,.8,.2,1) .3s}
.gk-q06:has(.gk-kx[open]) .gk-cz>.gk-lg{opacity:1;transition:opacity .3s ease .4s}
.gk-q06 p strong,.gk-q06 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q06.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q06.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q06.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q06.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q06.gk-tl .gk-uB{background-color:#c81e6a}
.gk-q06.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q06.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q06.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q06.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q06.gk-td .gk-uB{background-color:#ff5fa2}

.gk-q06.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-q06.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-q06.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-q06.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-q06.gk-cv-pk .gk-c9{background-color:#651235}
.gk-q06.gk-cv-pk .gk-cf{background-color:#fde9f1}
.gk-q06.gk-cv-pk.gk-tn-n .gk-cf{background-color:#651235}
.gk-q06.gk-cv-pk .gk-cb{background-color:#fda9cc}
.gk-q06.gk-cv-pk.gk-tn-n .gk-cb{background-color:#c9105e}
.gk-q06.gk-cv-pk .gk-dk{background-color:#651235}
.gk-q06.gk-cv-pk.gk-tn-n .gk-dk{background-color:#fda9cc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span></div><details class="gk-kx"><summary class="gk-ev" aria-label="봉투 열기"><span class="gk-lw gk-fb"><span class="gk-ly gk-m-fu gk-c7"></span></span><span class="gk-lw gk-sh"><span class="gk-ly gk-m-sh gk-c1"></span></span><span class="gk-ly gk-m-bd gk-c3"></span><span class="gk-ly gk-m-bf gk-c1"></span><span class="gk-lw gk-ff"><span class="gk-ly gk-m-fd gk-c5"></span></span><span class="gk-lw gk-hs"><span class="gk-ly gk-m-hw gk-hw"></span><span class="gk-ly gk-m-ht gk-c7"></span></span></summary></details></div>
<div class="gk-cz"><div class="gk-lg">
{{로그}}
</div></div>
</div>`},{id:"simple-q07",label:"호박",emoji:"🎃",desc:"호박을 누르면 별 창과 골 틈으로 불빛이 켜지고 일렁여요",key:"q07",peek:!0,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q07 gk-cv-pk"><style>
.gk-q07{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q07 *{box-sizing:border-box}
.gk-q07 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q07 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q07 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q07 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q07 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q07 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q07 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q07 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q07 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q07 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q07 .gk-lg>p:last-child{margin-bottom:0}
.gk-q07 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q07 .gk-kx{display:block}
.gk-q07 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q07 summary{list-style:none}
.gk-q07 summary::-webkit-details-marker{display:none}
.gk-q07 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q07 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q07 *{animation:none!important;transition:none!important}}
.gk-q07.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q07.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q07.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q07.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q07.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q07.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q07 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q07{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q07.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q07 .gk-lg{margin-top:6px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q07.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q07 .gk-kx{flex:0 0 92px;width:92px;height:82px;block-size:82px}
.gk-q07 .gk-pk{display:grid;grid-template-columns:92px;grid-template-rows:82px;width:92px;height:82px;block-size:82px;line-height:0}
.gk-q07 .gk-lw{grid-template-columns:92px;grid-template-rows:82px}
.gk-q07 .gk-pk .gk-ly,.gk-q07 .gk-pk .gk-lw{width:92px;height:82px;block-size:82px}
.gk-q07 .gk-m-pb{-webkit-mask-image:url('13');mask-image:url('13')}
.gk-q07 .gk-m-rb{-webkit-mask-image:url('15');mask-image:url('15')}
.gk-q07 .gk-m-rl{-webkit-mask-image:url('30');mask-image:url('30')}
.gk-q07 .gk-m-s2{-webkit-mask-image:url('46');mask-image:url('46')}
.gk-q07 .gk-m-s1{-webkit-mask-image:url('47');mask-image:url('47')}
.gk-q07 .gk-m-sm{-webkit-mask-image:url('61');mask-image:url('61')}
.gk-q07 .gk-on{opacity:0;transition:opacity .2s ease}
.gk-q07:has(.gk-kx[open]) .gk-on{opacity:1;transition:opacity .25s ease-out}
.gk-q07:has(.gk-kx[open]) .gk-o2{transition:opacity .3s ease-out .1s}
.gk-q07:has(.gk-kx[open]) .gk-fk{animation:gk-q-fk 1.8s ease-in-out .4s infinite alternate}
@keyframes gk-q-fk{0%{opacity:1}35%{opacity:.8}70%{opacity:.95}100%{opacity:.86}}
.gk-q07 p strong,.gk-q07 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q07.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q07.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q07.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q07.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q07.gk-tl .gk-uB{background-color:#c81e6a}
.gk-q07.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q07.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q07.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q07.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q07.gk-td .gk-uB{background-color:#ff5fa2}

.gk-q07.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-q07.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-q07.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-q07.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-q07.gk-cv-pk .gk-c9{background-color:#651235}
.gk-q07.gk-cv-pk .gk-cf{background-color:#fde9f1}
.gk-q07.gk-cv-pk.gk-tn-n .gk-cf{background-color:#651235}
.gk-q07.gk-cv-pk .gk-cb{background-color:#fda9cc}
.gk-q07.gk-cv-pk.gk-tn-n .gk-cb{background-color:#c9105e}
.gk-q07.gk-cv-pk .gk-dk{background-color:#651235}
.gk-q07.gk-cv-pk.gk-tn-n .gk-dk{background-color:#fda9cc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span></div><details class="gk-kx"><summary class="gk-pk" aria-label="호박 등불"><span class="gk-lw gk-ly gk-m-pb gk-c5"><span class="gk-ly gk-m-rb gk-c7"></span><span class="gk-ly gk-m-rl gk-c3 gk-on gk-o2"></span></span><span class="gk-ly gk-m-s2 gk-c3 gk-on gk-o2"></span><span class="gk-ly gk-m-s1 gk-c9"></span><span class="gk-ly gk-m-s1 gk-c1 gk-on gk-fk"></span><span class="gk-ly gk-m-sm gk-c9"></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q08",label:"라면",emoji:"🍜",desc:"김이 오르는 냄비 — 누르면 젓가락이 면발을 들어 올려요",key:"q08",peek:!1,open:!1,main:"B",second:"A",sample:"#ff5fa2",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#fbfbfa",log:"#fbfbfa",text:"#26272b"},dark:{card:"#25272b",log:"#25272b",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q08 gk-cv-pk"><style>
.gk-q08{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q08 *{box-sizing:border-box}
.gk-q08 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q08 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q08 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q08 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q08 .gk-ly{display:block;grid-area:1/1/2/2;width:100%;height:100%;block-size:100%;background-repeat:no-repeat;background-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.gk-q08 .gk-lw{display:grid;grid-area:1/1/2/2}
.gk-q08 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q08 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q08 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q08 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q08 .gk-lg>p:last-child{margin-bottom:0}
.gk-q08 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q08 .gk-kx{display:block}
.gk-q08 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q08 summary{list-style:none}
.gk-q08 summary::-webkit-details-marker{display:none}
.gk-q08 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q08 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q08 *{animation:none!important;transition:none!important}}
.gk-q08.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q08.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q08.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q08.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q08.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q08.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q08 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q08{padding:16px 20px 18px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#fbfbfa}
.gk-q08.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q08 .gk-lg{margin-top:10px}
.gk-q08 .gk-kx{flex:0 0 120px;width:120px;height:108px;block-size:108px}
.gk-q08 .gk-pt{display:grid;grid-template-columns:120px;grid-template-rows:108px;width:120px;height:108px;block-size:108px;line-height:0}
.gk-q08 .gk-lw{grid-template-columns:120px;grid-template-rows:108px}
.gk-q08 .gk-pt .gk-ly,.gk-q08 .gk-pt .gk-lw{width:120px;height:108px;block-size:108px}
.gk-q08 .gk-m-s0{-webkit-mask-image:url('37');mask-image:url('37')}
.gk-q08 .gk-m-s1{-webkit-mask-image:url('38');mask-image:url('38')}
.gk-q08 .gk-m-in{-webkit-mask-image:url('80');mask-image:url('80')}
.gk-q08 .gk-m-n1{-webkit-mask-image:url('16');mask-image:url('16')}
.gk-q08 .gk-m-n3{-webkit-mask-image:url('28');mask-image:url('28')}
.gk-q08 .gk-m-lg{-webkit-mask-image:url('18');mask-image:url('18')}
.gk-q08 .gk-m-pt{-webkit-mask-image:url('76');mask-image:url('76')}
.gk-q08 .gk-m-bd{-webkit-mask-image:url('97');mask-image:url('97')}
.gk-q08 .gk-m-nd{-webkit-mask-image:url('8');mask-image:url('8')}
.gk-q08 .gk-m-cs{-webkit-mask-image:url('40');mask-image:url('40')}
.gk-q08 .gk-m-rm{-webkit-mask-image:url('69');mask-image:url('69')}
.gk-q08 .gk-stm{opacity:0}
.gk-q08 .gk-nc{clip-path:inset(0 0 52px 0)}
.gk-q08 .gk-mv{transition:transform .5s cubic-bezier(.3,1.3,.45,1)}
.gk-q08:has(.gk-kx[open]) .gk-mv{transform:translateY(-14px)}
@keyframes gk-q-sm{0%{opacity:0;transform:translateY(4px)}35%{opacity:.85}100%{opacity:0;transform:translateY(-7px)}}
.gk-q08 p strong,.gk-q08 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q08.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q08.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q08.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q08.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q08.gk-tl .gk-uB{background-color:#c81e6a}
.gk-q08.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q08.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q08.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q08.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q08.gk-td .gk-uB{background-color:#ff5fa2}

.gk-q08.gk-cv-pk .gk-c1{background-color:#fde9f1}
.gk-q08.gk-cv-pk .gk-c3{background-color:#fda9cc}
.gk-q08.gk-cv-pk .gk-c5{background-color:#ff5fa2}
.gk-q08.gk-cv-pk .gk-c7{background-color:#c9105e}
.gk-q08.gk-cv-pk .gk-c9{background-color:#651235}
.gk-q08.gk-cv-pk .gk-cf{background-color:#fde9f1}
.gk-q08.gk-cv-pk.gk-tn-n .gk-cf{background-color:#651235}
.gk-q08.gk-cv-pk .gk-cb{background-color:#fda9cc}
.gk-q08.gk-cv-pk.gk-tn-n .gk-cb{background-color:#c9105e}
.gk-q08.gk-cv-pk .gk-dk{background-color:#651235}
.gk-q08.gk-cv-pk.gk-tn-n .gk-dk{background-color:#fda9cc}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uB"></span></div><details class="gk-kx"><summary class="gk-pt" aria-label="면 들어 올리기"><span class="gk-ly gk-m-s0 gk-c3 gk-stm" style="animation:gk-q-sm 3.4s ease-in-out 0s infinite"></span><span class="gk-ly gk-m-s1 gk-c3 gk-stm" style="animation:gk-q-sm 3.4s ease-in-out 1.6s infinite"></span><span class="gk-ly gk-m-in gk-c9"></span><span class="gk-ly gk-m-n1 gk-c1"></span><span class="gk-ly gk-m-n3 gk-c3"></span><span class="gk-ly gk-m-lg gk-c7"></span><span class="gk-ly gk-m-pt gk-c5"></span><span class="gk-ly gk-m-bd gk-c7"></span><span class="gk-lw gk-nc"><span class="gk-ly gk-m-nd gk-c3 gk-mv"></span></span><span class="gk-ly gk-m-cs gk-dk gk-mv"></span><span class="gk-ly gk-m-rm gk-c7"></span></summary></details></div>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q09",label:"카페 영수증",emoji:"🧾",desc:"출력기를 누르면 흰 영수증이 다 밀려 나와요 — 가게 이름 · 품목 · 합계 줄을 바꿔 써요(종이는 캐릭터 색을 안 따라요)",key:"q09",peek:!0,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q09 gk-cv-bl"><style>
.gk-q09{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q09 *{box-sizing:border-box}
.gk-q09 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q09 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q09 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q09 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q09 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q09 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q09 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q09 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q09 .gk-lg>p:last-child{margin-bottom:0}
.gk-q09 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q09 .gk-kx{display:block}
.gk-q09 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q09 summary{list-style:none}
.gk-q09 summary::-webkit-details-marker{display:none}
.gk-q09 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q09 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q09 *{animation:none!important;transition:none!important}}
.gk-q09.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q09.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q09.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q09.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q09.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q09.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q09 .gk-pb{background-color:#ffffff}
.gk-q09 .gk-pp span{color:#1f1f1f!important;-webkit-text-fill-color:#1f1f1f!important}
.gk-q09 .gk-pp .gk-fd,.gk-q09 .gk-pp .gk-fd span{color:#6a6a6a!important;-webkit-text-fill-color:#6a6a6a!important}
.gk-q09 .gk-bc span{background-color:#1f1f1f}
.gk-q09 .gk-pp a,.gk-q09 .gk-pp b,.gk-q09 .gk-pp strong,.gk-q09 .gk-pp em,.gk-q09 .gk-pp i{color:inherit!important;-webkit-text-fill-color:inherit!important;font-weight:inherit;font-style:normal;text-decoration:none;pointer-events:none}
.gk-q09 .gk-zz{background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 8 8%22%3E%3Cpath d=%22M0 0H8L4 5Z%22 fill=%22%23ffffff%22/%3E%3C/svg%3E')}
.gk-q09 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q09{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q09.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q09 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q09.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q09 .gk-kx{width:232px;max-width:100%;margin:12px auto 0}
.gk-q09 .gk-rc{display:block;line-height:0}
.gk-q09 .gk-sl{display:flex;justify-content:flex-end;align-items:center;height:12px;block-size:12px;padding:0 10px;border-radius:6px}
.gk-q09 .gk-led{display:block;width:4px;height:4px;block-size:4px;border-radius:50%}
.gk-q09 .gk-win{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:0fr;margin:0 8px;transition:grid-template-rows .5s cubic-bezier(.4,0,.6,1)}
.gk-q09 .gk-wi{display:block;min-height:10px;padding:0 4px 4px;margin:0 -4px -4px;overflow:clip}
.gk-q09.gk-tn-n .gk-wi{min-height:18px;padding:0 8px 12px;margin:0 -8px -12px}
.gk-q09 .gk-pp{display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.16));transform:translateY(calc(-100% + 6px));transition:transform .5s cubic-bezier(.4,0,.6,1)}
.gk-q09.gk-tn-n .gk-pp{filter:drop-shadow(0 2px 4px rgba(0,0,0,.55)) drop-shadow(0 4px 6px rgba(0,0,0,.4))}
.gk-q09:has(.gk-kx[open]) .gk-win{grid-template-rows:1fr;transition:grid-template-rows .9s cubic-bezier(.3,.05,.2,1)}
.gk-q09:has(.gk-kx[open]) .gk-pp{transform:translateY(0);transition:transform .9s cubic-bezier(.3,.05,.2,1)}
.gk-q09 .gk-pb{display:block;padding:10px 12px 8px}
.gk-q09 .gk-zz{display:block;height:6px;block-size:6px;background-repeat:repeat-x;background-size:8px 8px;background-position:0 0}
.gk-q09 .gk-pp span{display:block;font:400 10.5px/16px ui-monospace,"D2Coding","Consolas","Courier New",monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.gk-q09 .gk-pp .gk-nm9{font-size:14px;line-height:20px;text-align:center;letter-spacing:.08em}
.gk-q09 .gk-pp .gk-ct{text-align:center}
.gk-q09 .gk-pp .gk-rw{display:flex;gap:6px}
.gk-q09 .gk-pp .gk-rw span:first-child{flex:1 1 auto;min-width:0}
.gk-q09 .gk-pp .gk-q{flex:0 0 16px;text-align:right}
.gk-q09 .gk-pp .gk-a{flex:0 0 48px;text-align:right}
.gk-q09 .gk-pp .gk-dv{height:8px;block-size:8px;margin-top:7px;border-top:1px dashed #6a6a6a}
.gk-q09 .gk-pp .gk-tt9 span{font-size:14px;line-height:22px}
.gk-q09 .gk-pp .gk-bc{display:flex;justify-content:center;align-items:stretch;height:22px;block-size:22px;margin-top:8px}
.gk-q09 .gk-pp .gk-bc span{flex:0 0 auto;height:22px;block-size:22px}
.gk-q09 .gk-pp .gk-bn{font-size:9px;line-height:14px;text-align:center;letter-spacing:.12em}
.gk-q09:has(.gk-kx[open]) .gk-led{animation:gk-q-led .9s linear 0s 1}
@keyframes gk-q-led{0%{opacity:1}17%{opacity:.25}33%{opacity:1}50%{opacity:.25}67%{opacity:1}83%{opacity:.25}100%{opacity:1}}
.gk-q09 p strong,.gk-q09 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q09.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q09.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q09.gk-tl .gk-nm.gk-nA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q09.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q09.gk-tl .gk-uA{background-color:#0a69ae}
.gk-q09.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q09.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q09.gk-td .gk-nm.gk-nA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q09.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q09.gk-td .gk-uA{background-color:#3aa7ff}

.gk-q09.gk-cv-bl .gk-c1{background-color:#e4f1fc}
.gk-q09.gk-cv-bl .gk-c3{background-color:#95cefc}
.gk-q09.gk-cv-bl .gk-c5{background-color:#3aa7ff}
.gk-q09.gk-cv-bl .gk-c7{background-color:#0f6ab4}
.gk-q09.gk-cv-bl .gk-c9{background-color:#10395a}
.gk-q09.gk-cv-bl .gk-cf{background-color:#e4f1fc}
.gk-q09.gk-cv-bl.gk-tn-n .gk-cf{background-color:#10395a}
.gk-q09.gk-cv-bl .gk-cb{background-color:#95cefc}
.gk-q09.gk-cv-bl.gk-tn-n .gk-cb{background-color:#0f6ab4}
.gk-q09.gk-cv-bl .gk-dk{background-color:#10395a}
.gk-q09.gk-cv-bl.gk-tn-n .gk-dk{background-color:#95cefc}
.gk-q09.gk-cv-bl .gk-sl{background-color:#10395a}
.gk-q09.gk-cv-bl.gk-tn-n .gk-sl{background-color:#0f6ab4}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div></div>
<details class="gk-kx"><summary class="gk-rc" aria-label="영수증 뽑기"><span class="gk-sl"><span class="gk-led gk-c3"></span></span><span class="gk-win"><span class="gk-wi"><span class="gk-pp"><span class="gk-pb">
<!-- ✎ 가게 이름 -->
<span class="gk-nm9">옥상 매점</span>
<!-- ✎ 주소 · 전화 -->
<span class="gk-ct gk-fd">옥상로 12 · 000-0000</span>
<!-- ✎ 날짜 · 시각 · 주문 번호 -->
<span class="gk-ct gk-fd">2026-11-11 21:47 · No.0417</span>
<span class="gk-dv"></span>
<!-- ✎ 품목 줄: 이름 / 수량 / 금액 (줄을 복사해 늘리거나 지워요) -->
<span class="gk-rw"><span>캔 커피 · 따뜻한</span><span class="gk-q">1</span><span class="gk-a">1,500</span></span>
<span class="gk-rw"><span>캔 커피 · 미지근</span><span class="gk-q">1</span><span class="gk-a">1,500</span></span>
<span class="gk-dv"></span>
<!-- ✎ 소계 · 부가세 (자동 계산 아님) -->
<span class="gk-fd">소계 2,727 · 부가세 273</span>
<!-- ✎ 합계 (자동 계산 아님) -->
<span class="gk-rw gk-tt9"><span>합계</span><span class="gk-a">3,000</span></span>
<!-- ✎ 카드 번호 · 승인 -->
<span class="gk-rw gk-fd"><span>카드 ****-1234</span><span class="gk-a">승인</span></span>
<span class="gk-dv"></span>
<!-- ✎ 인사말 -->
<span class="gk-ct">감사합니다</span>
<!-- 바코드 막대(그림이라 고치지 않아요) -->
<span class="gk-bc"><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:1px"></span><span style="width:3px;margin-right:1px"></span><span style="width:1px;margin-right:3px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:2px;margin-right:1px"></span><span style="width:3px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:3px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:1px"></span><span style="width:3px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:1px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:3px"></span><span style="width:2px;margin-right:1px"></span><span style="width:3px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:1px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:3px"></span><span style="width:3px;margin-right:1px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:1px"></span><span style="width:2px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:1px;margin-right:1px"></span><span style="width:3px;margin-right:1px"></span><span style="width:1px;margin-right:2px"></span><span style="width:2px;margin-right:0px"></span></span>
<!-- ✎ 바코드 숫자 -->
<span class="gk-bn gk-fd">0417 2026 1111 2147</span>
</span><span class="gk-zz"></span></span></span></span></summary></details>
<div class="gk-lg">
{{로그}}
</div>
</div>`},{id:"simple-q10",label:"RPG 스탯",emoji:"🎮",desc:"HP · MP · EXP 게이지 — 누르면 EXP 가 가득 차 레벨이 오르고 HP · MP 가 회복돼요",key:"q10",peek:!1,open:!1,main:"A",second:"B",sample:"#3aa7ff",roots:{light:"gk-tl",dark:"gk-td gk-tn-n"},paper:{light:{card:"#ffffff",log:"#f5f5f6",text:"#26272b"},dark:{card:"#25272b",log:"#1c1e21",text:"#e1e1e5"}},rows:{지문:'<p class="gk-nr">{{지문}}</p>',이름:'<p class="gk-nm gk-n{{화자}}">{{이름}}</p>',대사:'<p class="gk-dl"><span class="gk-d gk-d{{화자}}">{{대사}}</span></p>'},html:`<div class="gk gk-tl gk-q10 gk-cv-bl gk-noaud"><style>
.gk-q10{box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;overflow:clip;text-align:left}
.gk-q10 *{box-sizing:border-box}
.gk-q10 .gk-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gk-q10 .gk-tc{display:block;flex:1 1 auto;min-width:0}
.gk-q10 .gk-lm{display:block;width:22px;height:22px;block-size:22px;line-height:0;text-decoration:none}
.gk-q10 .gk-lmi{display:block;width:22px;height:22px;block-size:22px}
.gk-q10 .gk-tt{display:block;margin:12px 0 0;font:700 20px/1.35 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.01em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q10 .gk-ul{display:block;width:36px;height:2px;block-size:2px;margin:9px 0 0;border-radius:1px}
.gk-q10 p{margin:0 0 10px;font:400 14.5px/1.6 "RIDIBatang","Noto Serif KR",serif;text-indent:1em;word-break:keep-all;overflow-wrap:anywhere}
.gk-q10 p.gk-nm{margin:14px 0 2px;font:700 13px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q10 .gk-lg>p:last-child{margin-bottom:0}
.gk-q10 .gk-d{padding:1px 2px;border-radius:2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.gk-q10 .gk-sd{display:flex;align-items:center;gap:2px;margin:0 0 12px;padding:3px 8px;border-radius:17px;border:1px solid transparent}
.gk-q10.gk-noaud .gk-sd{display:none}
.gk-q10 .gk-sn{display:inline-block;flex:0 0 auto;margin:0;padding:1px 7px;border-radius:999px;font:700 10.5px/1.5 Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.gk-q10 audio{display:block}
.gk-q10 .gk-kx{display:block}
.gk-q10 summary{cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.gk-q10 summary{list-style:none}
.gk-q10 summary::-webkit-details-marker{display:none}
.gk-q10 summary:focus-visible{outline:2px solid #7aa7d8;outline-offset:2px}
.gk-q10 summary:focus:not(:focus-visible){outline:none}
@media (prefers-reduced-motion:reduce){.gk-q10 *{animation:none!important;transition:none!important}}
.gk-q10.gk-tl .gk-tt{color:#1b1c20;-webkit-text-fill-color:#1b1c20}
.gk-q10.gk-tl p{color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q10.gk-tl .gk-d{color:#111113;-webkit-text-fill-color:#111113}
.gk-q10.gk-td .gk-tt{color:#f0f0f3;-webkit-text-fill-color:#f0f0f3}
.gk-q10.gk-td p{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q10.gk-td .gk-d{color:#f5f5f7;-webkit-text-fill-color:#f5f5f7}
.gk-q10.gk-tl .gk-sd{border-color:rgba(20,20,24,.14)}
.gk-q10.gk-td .gk-sd{border-color:rgba(224,224,228,.14)}
.gk-q10 .gk-lmi{background:url('0') center/100% 100% no-repeat}
.gk-q10{padding:16px 20px 16px;border:1px solid rgba(20,20,24,.10);border-radius:12px;background-color:#ffffff}
.gk-q10.gk-tn-n{border:1px solid rgba(224,224,228,.09);background-color:#25272b}
.gk-q10 .gk-lg{margin-top:14px;padding:16px 18px;border-radius:8px;background-color:#f5f5f6}
.gk-q10.gk-tn-n .gk-lg{background-color:#1c1e21}
.gk-q10 .gk-kx{margin-top:10px}
.gk-q10 .gk-sg{display:block}
.gk-q10 .gk-lv{display:grid;justify-content:start;height:20px;block-size:20px;font:700 13px/20px ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
.gk-q10 .gk-lv span{grid-area:1/1/2/2;transform-origin:0 50%}
.gk-q10 .gk-gr{display:flex;align-items:center;gap:6px;height:20px;block-size:20px;font:500 11px/20px ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;font-variant-numeric:tabular-nums;color:#5f6168;-webkit-text-fill-color:#5f6168}
.gk-q10.gk-tn-n .gk-gr{color:#9a9da6;-webkit-text-fill-color:#9a9da6}
.gk-q10 .gk-gi{display:block;flex:0 0 12px;width:12px;height:12px;block-size:12px;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:12px 12px;mask-size:12px 12px}
.gk-q10 .gk-ih{-webkit-mask-image:url('29');mask-image:url('29')}
.gk-q10 .gk-im{-webkit-mask-image:url('73');mask-image:url('73')}
.gk-q10 .gk-ix{-webkit-mask-image:url('54');mask-image:url('54')}
.gk-q10 .gk-gn{display:block;flex:0 0 26px;font-weight:700;color:#26272b;-webkit-text-fill-color:#26272b}
.gk-q10.gk-tn-n .gk-gn{color:#e1e1e5;-webkit-text-fill-color:#e1e1e5}
.gk-q10 .gk-gb{display:grid;flex:0 0 178px;width:178px;grid-template-columns:178px;height:10px;block-size:10px}
.gk-q10 .gk-g0,.gk-q10 .gk-g1{display:flex;grid-area:1/1/2/2;gap:2px}
.gk-q10 .gk-gb i{display:block;flex:0 0 16px;width:16px;height:10px;block-size:10px;border-radius:1px}
.gk-q10 .gk-hp{clip-path:inset(0 13px 0 0)}
.gk-q10 .gk-mp{clip-path:inset(0 64px 0 0)}
.gk-q10 .gk-xp{clip-path:inset(0 50px 0 0)}
.gk-q10 .gk-g1{transition:clip-path .3s ease}
.gk-q10:has(.gk-kx[open]) .gk-xp{clip-path:inset(0 0px 0 0);transition:clip-path .9s cubic-bezier(.6,0,.25,1) 0s}
.gk-q10:has(.gk-kx[open]) .gk-hp,.gk-q10:has(.gk-kx[open]) .gk-mp{clip-path:inset(0 0px 0 0);transition:clip-path .5s cubic-bezier(.2,.8,.2,1) 1s}
.gk-q10 .gk-gv{display:grid;flex:0 0 76px;text-align:right;white-space:nowrap}
.gk-q10 .gk-gv span{grid-area:1/1/2/2}
.gk-q10 .gk-v2{opacity:0}
.gk-q10:has(.gk-kx[open]) .gk-v1{opacity:0;transition:opacity .15s ease 1s}
.gk-q10:has(.gk-kx[open]) .gk-v2{opacity:1;transition:opacity .15s ease 1s}
.gk-q10:has(.gk-kx[open]) .gk-xv .gk-v1,.gk-q10:has(.gk-kx[open]) .gk-xv .gk-v2,.gk-q10:has(.gk-kx[open]) .gk-lv .gk-v1{transition-delay:.9s}
.gk-q10:has(.gk-kx[open]) .gk-lv .gk-v2{transition-delay:.9s;animation:gk-q-lv .5s cubic-bezier(.3,1.6,.5,1) .9s 1 both}
@keyframes gk-q-lv{0%{transform:scale(1)}45%{transform:scale(1.32)}100%{transform:scale(1)}}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-panel,.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-enclosure{background:transparent!important;background-color:transparent!important}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-panel{padding:0!important;align-items:center!important}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-play-button,.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-mute-button{min-width:24px!important;width:24px!important;height:24px!important;flex:0 0 24px!important;margin:0!important;padding:0!important;background-size:20px 20px!important;background-position:center!important}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-mute-button{align-self:center!important;position:relative!important;top:0!important;vertical-align:middle!important}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-volume-control-container{align-self:center!important;margin:0!important;padding:0!important}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-current-time-display,.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-time-remaining-display{font-size:12px!important}
.gk-q10 p strong,.gk-q10 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}

.gk-q10.gk-tl .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q10.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q10.gk-tl .gk-nm.gk-nA,.gk-q10.gk-tl .gk-sn.gk-sA{color:#0a69ae;-webkit-text-fill-color:#0a69ae}
.gk-q10.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}
.gk-q10.gk-tl .gk-sn.gk-sA{background-color:#e8f4ff}
.gk-q10.gk-tl .gk-uA{background-color:#0a69ae}
.gk-q10.gk-td .gk-dA{background-color:rgba(58,167,255,.18)}
.gk-q10.gk-td .gk-dB{background-color:rgba(255,95,162,.18)}
.gk-q10.gk-td .gk-nm.gk-nA,.gk-q10.gk-td .gk-sn.gk-sA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q10.gk-td .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}
.gk-q10.gk-td .gk-sn.gk-sA{background-color:#1f3246}
.gk-q10.gk-td .gk-uA{background-color:#3aa7ff}
.gk-q10.gk-tl .gk-vA{color:#0075d3;-webkit-text-fill-color:#0075d3}
.gk-q10.gk-td .gk-vA{color:#3aa7ff;-webkit-text-fill-color:#3aa7ff}
.gk-q10.gk-q10.gk-q10 audio::-webkit-media-controls-timeline{filter:invert(.5) sepia(1) saturate(9) hue-rotate(162deg) brightness(1)!important}

.gk-q10.gk-cv-bl .gk-c1{background-color:#e4f1fc}
.gk-q10.gk-cv-bl .gk-c3{background-color:#95cefc}
.gk-q10.gk-cv-bl .gk-c5{background-color:#3aa7ff}
.gk-q10.gk-cv-bl .gk-c7{background-color:#0f6ab4}
.gk-q10.gk-cv-bl .gk-c9{background-color:#10395a}
.gk-q10.gk-cv-bl .gk-cf{background-color:#e4f1fc}
.gk-q10.gk-cv-bl.gk-tn-n .gk-cf{background-color:#10395a}
.gk-q10.gk-cv-bl .gk-cb{background-color:#95cefc}
.gk-q10.gk-cv-bl.gk-tn-n .gk-cb{background-color:#0f6ab4}
.gk-q10.gk-cv-bl .gk-dk{background-color:#10395a}
.gk-q10.gk-cv-bl.gk-tn-n .gk-dk{background-color:#95cefc}
.gk-q10.gk-cv-bl .gk-ih{background-color:#0f6ab4}
.gk-q10.gk-cv-bl.gk-tn-n .gk-ih{background-color:#95cefc}
.gk-q10.gk-cv-bl .gk-im{background-color:#95cefc}
.gk-q10.gk-cv-bl.gk-tn-n .gk-im{background-color:#0f6ab4}
.gk-q10.gk-cv-bl .gk-ix{background-color:#3aa7ff}
.gk-q10.gk-cv-bl .gk-g0 i{background-color:#e4f1fc}
.gk-q10.gk-cv-bl.gk-tn-n .gk-g0 i{background-color:#10395a}
.gk-q10.gk-cv-bl .gk-hp i{background-color:#0f6ab4}
.gk-q10.gk-cv-bl.gk-tn-n .gk-hp i{background-color:#95cefc}
.gk-q10.gk-cv-bl .gk-mp i{background-color:#95cefc}
.gk-q10.gk-cv-bl.gk-tn-n .gk-mp i{background-color:#0f6ab4}
.gk-q10.gk-cv-bl .gk-xp i{background-color:#3aa7ff}
</style>
<div class="gk-top"><div class="gk-tc"><a class="gk-lm" href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드" aria-label="블루레몬에이드"><span class="gk-lmi"></span></a><div class="gk-tt">{{제목}}</div><span class="gk-ul gk-uA"></span></div></div>
<details class="gk-kx"><summary class="gk-sg" aria-label="경험치 채우기">
<!-- ✎ 레벨: 누르기 전 / 누른 뒤 -->
<span class="gk-lv gk-vA"><span class="gk-v1">Lv.12</span><span class="gk-v2">Lv.13</span></span>
<span class="gk-gr">
<span class="gk-gi gk-ih"></span>
<!-- ✎ 게이지 이름 -->
<span class="gk-gn">HP</span>
<span class="gk-gb"><span class="gk-g0"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="gk-g1 gk-hp"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
<!-- ✎ 숫자: 누르기 전 / 누른 뒤 -->
<span class="gk-gv"><span class="gk-v1">920 / 1000</span><span class="gk-v2">1000 / 1000</span></span>
</span>
<span class="gk-gr">
<span class="gk-gi gk-im"></span>
<!-- ✎ 게이지 이름 -->
<span class="gk-gn">MP</span>
<span class="gk-gb"><span class="gk-g0"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="gk-g1 gk-mp"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
<!-- ✎ 숫자: 누르기 전 / 누른 뒤 -->
<span class="gk-gv"><span class="gk-v1">320 / 500</span><span class="gk-v2">500 / 500</span></span>
</span>
<span class="gk-gr">
<span class="gk-gi gk-ix"></span>
<!-- ✎ 게이지 이름 -->
<span class="gk-gn">EXP</span>
<span class="gk-gb"><span class="gk-g0"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="gk-g1 gk-xp"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
<!-- ✎ 숫자: 누르기 전 / 누른 뒤 -->
<span class="gk-gv gk-xv"><span class="gk-v1">72%</span><span class="gk-v2">MAX</span></span>
</span>
</summary></details>
<div class="gk-lg">
{{로그}}
</div>
</div>`}].map(na)),h=Object.freeze({category:"simple",title:"{{제목}}",log:"{{로그}}",log2:"{{로그:2}}",hidden:"{{숨은줄}}",who:"{{화자}}",delay:"{{지연}}",rows:Object.freeze(["지문","이름","대사"]),band:'<span class="gk-d gk-d{{화자}}">{{대사}}</span>',root:"gk",frame:n=>`gk-${n}`,colorPrefix:"gk-cv-",noAudio:"gk-noaud",modeClasses:Object.freeze(["gk-tl","gk-td","gk-tx","gk-tn-d","gk-tn-n"]),blocks:/\n[ \t]*\n/,letters:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",quoted:/^[\s​]*[「『"“][\s\S]*[」』"”][\s​]*$/,delayStart:.2,delayStep:.25,delayMax:1.2}),oe=["light","dark"];function ie(n){const a=[],t=n??{};/^[a-z0-9-]{1,24}$/.test(String(t.id??""))||a.push("id"),/^[kq]\d+$/.test(String(t.key??""))||a.push("key");const k=String(t.html??""),g=_a(k);g?((!g.classes.includes(h.root)||!g.classes.includes(h.frame(t.key)))&&a.push(`뿌리 class ${h.root} ${h.frame(t.key)}`),(g.blocks.length<2||g.blocks.length>3)&&a.push("<style> 덩이 둘 · 셋(① 기본 · ② 화자 · ③ 소품 — 소품이 없는 틀은 ③ 없음)")):a.push("감싸는 div 의 첫 자식 <style>"),(k.match(/<style\b/gi)??[]).length!==1&&a.push("<style> 하나"),k.split(h.log).length!==2&&a.push(`${h.log} 하나`),k.split(h.log2).length!==(t.pages===2||t.units?2:1)&&a.push(`${h.log2} 는 pages: 2 일 때 하나`),(t.vary!==void 0||t.units!==void 0||t.nameFill!==void 0||t.colors0!==void 0)&&a.push(...re(t)),k.split(h.title).length>2&&a.push(`${h.title} 하나 이하`),k.split(h.hidden).length!==(t.hidden?2:1)&&a.push(`${h.hidden} 는 hidden 일 때 하나`),(/<(input|audio|video|source|script|svg)\b/i.test(k)||/\{\{소리/.test(k))&&a.push("테마 복사 글이 지우는 요소(input · audio …) · 소리 자리 없음");for(const s of h.rows)(typeof t.rows?.[s]!="string"||!t.rows[s].includes(`{{${s}}}`))&&a.push(`줄 꼴 ${s}`);for(const s of["이름","대사"])typeof t.rows?.[s]=="string"&&!t.rows[s].includes(h.who)&&a.push(`줄 꼴 ${s} 의 ${h.who}`);for(const s of oe){(!String(t.roots?.[s]??"").split(/\s+/).filter(Boolean).every(e=>h.modeClasses.includes(e))||!t.roots?.[s])&&a.push(`roots.${s}`);for(const e of["card","log","text"])Y(t.paper?.[s]?.[e])||a.push(`paper.${s}.${e}`)}Y(t.sample)||a.push("sample"),(!h.letters.includes(t.main??"")||!t.main)&&a.push("main"),(!h.letters.includes(t.second??"")||!t.second||t.second===t.main)&&a.push("second");const o=t.colors0??(g?un(g.blocks.slice(1).join(`
`)):{});return t.main&&t.second&&!(t.main in o&&t.second in o)&&a.push("② 에 주인공 · 상대 띠 색"),a}const Za=/<(input|audio|video|source|script|svg|style|iframe|img)\b|\{\{소리/i;function re(n){const a=[],t=(k,g)=>typeof g=="string"&&g.includes(`{{${k}}}`)&&(k==="지문"||g.includes(h.who))&&!Za.test(g);if(n.vary!==void 0)if(!n.vary||typeof n.vary!="object"||n.units)a.push("vary");else for(const[k,g]of Object.entries(n.vary))h.rows.includes(k)&&(g?.forms?Array.isArray(g.forms)&&g.forms.length>=2&&g.forms.length<=12&&g.forms.every(s=>t(k,s)):t(k,g?.base)&&t(k,g?.accent)&&["first","last"].includes(g?.at))||a.push(`vary.${k}`);if(n.units!==void 0){const k=n.units;!Array.isArray(k)||k.length!==2||n.pages?a.push("units"):k.forEach((g,o)=>{const s=(e,i)=>typeof e=="string"&&e.split(i).length===2&&!Za.test(e);(!s(g?.both,"{{지문들}}")||!s(g.both,"{{대사들}}")||!s(g.nr,"{{지문들}}")||g.nr.includes("{{대사들}}")||!s(g.dl,"{{대사들}}")||g.dl.includes("{{지문들}}"))&&a.push(`units.${o}`),(!t("지문",g?.rows?.지문)||!t("대사",g?.rows?.대사))&&a.push(`units.${o}.rows`)})}return n.colors0!==void 0&&(!n.units||!n.colors0||typeof n.colors0!="object"||Object.entries(n.colors0).some(([k,g])=>k.length!==1||!h.letters.includes(k)||!/^#[0-9a-f]{6}$/.test(g)))&&a.push("colors0"),n.nameFill!==void 0&&(!n.nameFill||typeof n.nameFill!="object"||Object.entries(n.nameFill).some(([k,g])=>!h.letters.includes(k)||k.length!==1||typeof g!="string"||g.length>40||/[<>{}]/.test(g)))&&a.push("nameFill"),a}function _a(n){const a=String(n??"").match(/^\s*<div\b[^>]*\sclass="([^"]*)"[^>]*>\s*<style>((?:(?!<\/?style)[\s\S])*)<\/style>/i);return a?{classes:a[1].split(/\s+/).filter(Boolean),blocks:a[2].replace(/^\n/,"").replace(/\n$/,"").split(h.blocks)}:null}function le(n){let a=2166136261;for(let t=0;t<n.length;t++)a^=n.charCodeAt(t),a=Math.imul(a,16777619)>>>0;return a.toString(36)}function Ha(n,{main:a="A",second:t=a==="A"?"B":"A",lookup:k=null}={}){const g=Vn(n,k),o=[];for(const p of n?.messages??[]){const c=String(p.name??"").trim();o.includes(c)||o.push(c)}const s=g.mainName??o[0]??"",e=[t,...[...h.letters].filter(p=>p!==a&&p!==t)],i=new Map([[s,a]]),r=new Map([[a,g.byName.get(s)??null]]);let l=0;for(const p of o){if(i.has(p))continue;const c=e[Math.min(l,e.length-1)];l>=e.length-1&&r.has(c)?r.set(c,null):r.set(c,g.byName.get(p)??null),i.set(p,c),l++}return{letterOf:i,colors:r,main:r.get(a)??null,count:g.count}}function Ta(n,a,{main:t="A",second:k=t==="A"?"B":"A"}={}){const g=new Map(n.colors),o=new Map,s=new Set(n.letterOf.values()),e=[k,...[...h.letters].filter(r=>r!==t&&r!==k)].filter(r=>!s.has(r)),i=(r,l)=>{for(const p of r??[])p.t==="el"&&(p.who&&l.push(p.who),i(p.children,l));return l};for(const r of a?.messages??[]){const l=g.get(n.letterOf.get(String(r.name??"").trim()));for(const p of i(r.nodes,[])){if(o.has(p)||Zn(p,l)||Zn(p,r.speaker))continue;const c=[...g].find(([f,u])=>u&&s.has(f)&&Zn(u,p))?.[0],d=c??e.shift();d&&(c||(g.set(d,p),s.add(d)),o.set(p,d))}}return o.size?{...n,colors:g,byColor:o}:n}function aa(n,a,t){if(!t||!t.main&&!t.other)return n;const k=new Map(n.colors),g=a.second??(a.main==="A"?"B":"A"),o=(s,e)=>{e==="orig"?k.has(s)&&k.set(s,null):/^#[0-9a-f]{6}$/i.test(e||"")&&k.set(s,e.toLowerCase())};return o(a.main,t.main),o(g,t.other),{...n,colors:k,main:k.get(a.main)??null}}function pe(n,a){const t=n.colors0??un(Jn(n.html)?.color_css??""),k=a.get(n.main)??Ya,g={};for(const[s,e]of a)s!==n.main&&(s!==n.second||e!=null)&&(g[s]=e??null);const o=Object.entries(g).filter(([s,e])=>!(s===n.second&&e===t[s])).map(([s,e])=>`${s}${e??"-"}`);return{K:k,others:g,cvTail:o.length?le(o.join("|")):""}}function ce(n){const a=[];let t=[];const k=()=>{for(;t.length&&t[0].br;)t.shift();for(;t.length&&t[t.length-1].br;)t.pop();t.some(s=>s.text.trim())&&a.push(t),t=[]},g=(s,e)=>(s??[]).map(i=>{if(i.t==="text"){let r=P(i.text);return e.s&&(r=`<s>${r}</s>`),e.i&&(r=`<em>${r}</em>`),e.b&&(r=`<strong>${r}</strong>`),r}return i.t==="br"?"<br>":i.t==="el"?g(i.children,e)+(i.block?"<br>":""):""}).join(""),o=(s,e)=>{for(const i of s??[])if(i.t==="text"){let r=P(i.text);e.s&&(r=`<s>${r}</s>`),e.i&&(r=`<em>${r}</em>`),e.b&&(r=`<strong>${r}</strong>`),t.push({dlg:e.dlg,html:r,text:i.text,who:e.dlg?e.who:null})}else if(i.t==="br")t.push({dlg:e.dlg,html:"<br>",text:"",br:!0});else if(i.t==="pic")k(),a.push([{pic:i,dlg:!1,html:"",text:""}]);else if(i.t==="hr")k();else if(i.t==="el"&&i.kind==="spoiler"){const r=Rn(g(i.children,e).replace(/^(<br>)+|(<br>)+$/g,""),i.sp,!i.block);i.block?(k(),t.push({dlg:!1,html:r,text:"숨긴 글"}),k()):t.push({dlg:!1,html:r,text:"숨긴 글"})}else if(i.t==="el"){const r=i.style??{},l={dlg:e.dlg||!i.block&&/gradient\(/i.test(String(r["background-image"]??"")),b:e.b||/^(bold|bolder|[6-9]\d\d)$/.test(String(r["font-weight"]??"").trim()),i:e.i||/italic|oblique/.test(String(r["font-style"]??"")),s:e.s||/line-through/.test(String(r["text-decoration"]??r["text-decoration-line"]??"")),who:i.who??e.who};i.block?(k(),o(i.children,l),k()):o(i.children,l)}};return o(n,{dlg:!1,b:!1,i:!1,s:!1,who:null}),k(),a}const on=(n,a)=>Object.entries(a).reduce((t,[k,g])=>t.split(k).join(g),n),de=n=>`${Number(n.toFixed(2))}s`,Va=n=>n.join("").replace(/<[^>]*>/g,"").length;function fe(n){const a=(o,s)=>[o.slice(0,s).flat(),o.slice(s).flat()],t=(o,s=1)=>{let e=-1,i=1/0;const r=Va(o.flat());for(let l=s;l<o.length;l++){const p=Math.abs(r-2*Va(o.slice(0,l).flat()));p<i&&(i=p,e=l)}return e};if(n.length>=2)return a(n,t(n));const k=(n[0]??[]).map(o=>[o]),g=/class="gk-nm\b/.test(k[0]?.[0]??"")?2:1;return k.length<=g?[k.flat(),[]]:a(k,t(k,g))}function me(n,a,t){const k=n.flatMap((i,r)=>i?Array.from({length:i},()=>r):[-1-r]),g=[[],[]];let o=0,s=0,e=null;for(const i of k){i>=0&&o===0&&s>=a.length&&(o=1,e=null);const r=i>=0?i:-1-i,l=g[o];(i<0||r!==e)&&l.push(`<!--blm:${r}-->`),e=r,i>=0&&(l.push(o?t[s-a.length]:a[s]),s++)}for(const i of g)i.length&&i.push("<!--blm:e-->");return g}const Fa=n=>String(n??"").replace(/(<[a-zA-Z][\w-]*\b(?:[^<>"']|"[^"]*"|'[^']*')*?)(\s*)><!--blf:(title|hidden)-->([^<]*)<!--\/blf-->(?=<\/)/g,(a,t,k,g,o)=>`${t} data-f="${g}"${k}>${o}`).replace(/<!--\/?blf(?::\w+)?-->/g,"");function be(n,a,t){const k=n.vary;if(!k)return s=>n.rows[s];const g={이름:a.filter(s=>t&&s.name).length,대사:0,지문:0};for(const s of a)for(const e of s.body)e.kind in g&&g[e.kind]++;const o={이름:0,대사:0,지문:0};return s=>{const e=o[s]++,i=k[s];return i?i.forms?i.forms[e%i.forms.length]:e===(i.at==="last"?g[s]-1:0)?i.accent:i.base:n.rows[s]}}function xe(n,a,t){const k=[[],[]],g=[];let o=0;for(const s of a){const e=[];for(const i of s.body){if(i.kind==="그림"){e.push({pic:i.html});continue}const r=e[e.length-1];(!r||r.pic||i.kind==="지문"&&r.dl.length)&&e.push({nr:[],dl:[]}),e[e.length-1][i.kind==="대사"?"dl":"nr"].push(i.vals)}for(const i of e){if(i.pic){k[o===0?0:1].push(i.pic);continue}const r=n.units[o++?1:0],l={"{{화자}}":s.letter,"{{이름}}":t&&s.name?P(s.name):"","{{지문들}}":i.nr.map(c=>on(r.rows.지문,c)).join(`
`),"{{대사들}}":i.dl.map(c=>on(r.rows.대사,c)).join(`
`)},p=(i.nr.length&&i.dl.length?r.both:i.nr.length?r.nr:r.dl).replace(/\{\{(?:화자|이름|지문들|대사들)\}\}/g,c=>l[c]);k[o===1?0:1].push(p.replace(/<(p|span) class="gk-nm\b[^"]*"><\/\1>\n?/g,""))}g.push(e.length)}return[k[0],k[1],g]}function Wa(n,a,t={}){const k=t.mode==="light"?"light":"dark",g={html:"",mode:k,cv:"",letters:new Map,colors:new Map,main:null};if(!a?.messages?.length)return g;const o=_a(n?.html);if(!o||o.blocks.length<2)return g;const s=Ha(a,{main:n.main,second:n.second,lookup:t.lookup}),e=fn(aa(s,n,t.cast).main,{mode:k,plan:"B"}),i=Fn(a,e,{font:!1}),r=aa(Ta(s,i,{main:n.main,second:n.second}),n,t.cast),l=(z,S)=>z&&r.byColor?.get(z)||S,p=t.names!==!1&&r.count>1,c=n.rows.띠??h.band;let d=0;const f=i.messages.map(z=>{const S=String(z.name??"").trim(),G=r.letterOf.get(S)??n.main,M=ce(z.nodes).map(j=>{if(j[0]?.pic)return{kind:"그림",html:Pn(j[0].pic)};const W=j.filter(E=>E.text.trim());if(W.every(E=>E.dlg)||h.quoted.test(j.map(E=>E.text).join(""))){const E=de(Math.min(h.delayStart+h.delayStep*d++,h.delayMax));return{kind:"대사",vals:{[h.who]:l(W.find(nn=>nn.who)?.who,G),[h.delay]:E,"{{대사}}":j.map(nn=>nn.html).join("").trim()}}}let U="",H=null,T=null;const J=()=>{H&&(U+=on(c,{[h.who]:l(T,G),"{{대사}}":H})),H=null,T=null};for(const E of j)E.dlg?(H!=null&&E.who&&T&&E.who!==T&&J(),H=(H??"")+E.html,T??=E.who):(J(),U+=E.html);return J(),{kind:"지문",vals:{"{{지문}}":U.trim()}}});return{name:S,letter:G,body:M}}),u=f.filter(z=>z.body.length);let b,x,v;if(n.units){let z,S=0;[b,x,z]=xe(n,u,p),v=f.map(G=>G.body.length?z[S++]:0)}else{const z=be(n,u,p),S=f.map(M=>M.body.length?[...p&&M.name?[on(z("이름"),{[h.who]:M.letter,"{{이름}}":P(M.name)})]:[],...M.body.map(j=>j.kind==="그림"?j.html:on(z(j.kind),j.vals))]:[]);v=S.map(M=>M.length);const G=S.filter(M=>M.length);[b,x]=n.pages===2?fe(G):[G.flat(),[]]}t.rows&&([b,x]=me(v,b,x));const w=(z,S)=>t.rows?`<!--blf:${z}-->${S}<!--/blf-->`:S,C=P(String(t.fields?.title??"").trim());let q=on(n.html,{[h.title]:w("title",C),[h.hidden]:w("hidden",P(String(t.fields?.hidden??"").trim()))});n.nameFill&&(q=q.replace(/\{\{이름:([A-Z])\}\}/g,(z,S)=>{const G=t.names!==!1&&[...r.letterOf].find(([,M])=>M===S)?.[0];return P(G||n.nameFill[S]||"")})),q=q.split(`
${h.log2}
`).join(x.length?`
${x.join(`
`)}
`:`
`),q=q.split(`
${h.log}
`).join(b.length?`
${b.join(`
`)}
`:`
`);const{K:B,others:Z,cvTail:rn}=pe(n,r.colors);let R=te(q,B,{mode:k,main:n.main,others:Z,cvTail:rn,colors0:n.colors0});t.marks!==!1&&(R=sa(R)),t.marks!==!1&&(R=Ia(R,{skip:n.hidden?[]:["gk-hl"]})),t.rows&&t.marks!==!1&&(R=Fa(R));const Mn=(R.match(/^<div class="[^"]*\b(gk-cv-[\w-]+)/)||[])[1]??"";return{html:R,mode:k,cv:Mn,letters:r.letterOf,colors:r.colors,main:r.main}}const ue=!1,he=se,we=n=>Object.freeze({id:n.id,label:n.label,...n.emoji?{emoji:n.emoji}:{icon:n.icon??"fa-feather"},category:h.category,simple:!0,frame:n,render:(a,t)=>Wa(n,a,t).html}),ye=(n=ue)=>n?he.map(we):[];export{Dn as A,St as B,Bt as C,xt as D,X as E,Ot as F,da as G,pt as H,ha as I,lt as J,rt as K,la as L,fa as M,yt as N,It as O,yn as P,Yt as Q,mt as R,_ as S,bt as T,hn as U,Ea as V,wt as W,ft as X,un as a,dn as b,ie as c,Ha as d,fn as e,Qa as f,Ta as g,P as h,h as i,Rn as j,ye as k,aa as l,Oa as m,Wa as n,Ka as o,Pn as p,Ia as q,Fn as r,Jn as s,$ as t,sa as u,Fa as v,Kt as w,Ct as x,At as y,xa as z};
