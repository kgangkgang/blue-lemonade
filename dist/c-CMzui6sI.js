const h=['.TH-custom-tailwind [data-type="script"] > .grow',".regex-script-label > .regex_script_name"].join(", "),n="salty-marquee",x=45,f="salty-marquee-style",w=`
body.salty .regex-script-label > .regex_script_name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  scroll-behavior: auto;
  cursor: pointer;
}
body.salty .regex-script-label > .regex_script_name.${n} {
  text-overflow: clip;
}
body.salty #completion_prompt_manager #completion_prompt_manager_list .completion_prompt_manager_prompt_name > .${n}.${n} { /* 클래스 두 번 = style.css 의 말줄임 규칙(a 태그 포함)보다 무겁게 */
  text-overflow: clip;
}
@media (prefers-reduced-motion: reduce) {
  body.salty .regex-script-label > .regex_script_name.${n} {
    white-space: normal;
  }
}`,s=new WeakMap,L=e=>e<.5?2*e*e:1-(-2*e+2)**2/2;function b(e){const r=s.get(e);r&&cancelAnimationFrame(r),s.delete(e)}function g(e){b(e),e.scrollLeft=0,e.classList.remove(n)}function E(e){if(!document.body.classList.contains("salty"))return;const r=e.target;if(!(r instanceof Element))return;const t=r.closest(h);if(!t)return;const o=t.scrollWidth-t.clientWidth;if(o<=1)return;if(matchMedia("(prefers-reduced-motion: reduce)").matches){t.classList.toggle(n);return}g(t),t.classList.add(n);const c=Math.min(6e3,Math.max(900,o/x*1e3)),a=[[400,0,0],[c,0,o],[900,o,o],[c*.6,o,0]];let i=0,l=performance.now();const m=d=>{if(!t.isConnected){s.delete(t);return}const[y,p,_]=a[i],u=Math.min(1,(d-l)/y);if(t.scrollLeft=p+(_-p)*L(u),u>=1&&(i++,l=d,i>=a.length)){g(t);return}s.set(t,requestAnimationFrame(m))};s.set(t,requestAnimationFrame(m))}function v(){if(!document.getElementById(f)){const e=document.createElement("style");e.id=f,e.textContent=w,document.head.append(e)}document.addEventListener("click",E,!0)}export{v as startNameMarquee};
