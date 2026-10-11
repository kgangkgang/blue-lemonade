'use strict';
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
document.documentElement.classList.add('js');
// Open the folded credits when a guide link or shared URL leads directly here.
function revealSiteCredits(hash) {
  if(hash !== '#site-credits') return;
  const credits = $('#site-credits');
  credits.open = true;
  credits.scrollIntoView({block:'start', behavior:'instant'});
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href="#site-credits"]');
  if(!link) return;
  event.preventDefault();
  if(location.hash !== link.hash) history.pushState(null, '', link.hash);
  revealSiteCredits(link.hash);
});
addEventListener('hashchange', () => revealSiteCredits(location.hash));
addEventListener('load', () => revealSiteCredits(location.hash), {once:true});
revealSiteCredits(location.hash);
const lightbox=$('#lightbox');
{const big=lightbox.querySelector('img');big.addEventListener('load',()=>{lightbox.classList.toggle('tall',big.naturalHeight>big.naturalWidth*1.9);lightbox.scrollTop=0;});}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
{const dialog=$('#atmosphere-lightbox'), video=dialog.querySelector('video');
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');delete video.dataset.modeBase;video.load();});}
const SHOWN_NOTES=3;
fetch('release-notes.json?v=605', {cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();
  // one card per day, like the theme's own notice: a busy day reads as "v4.1.2 ~ v4.2.4 · 업데이트 13번"
  const days=[];for(const note of notes){const last=days.at(-1);if(last&&last.date===note.date)last.notes.push(note);else days.push({date:note.date,notes:[note]});}
  days.forEach((day,i)=>{const d=element('details','note');d.open=i===0;d.hidden=i>=SHOWN_NOTES;const s=element('summary'),first=day.notes.at(-1).version,latest=day.notes[0].version;
    s.append(element('span','num',latest));if(i===0)s.append(element('span','tag','새 소식'));
    if(day.notes.length>1)s.append(element('span','span',`v${first} ~ v${latest} · 업데이트 ${day.notes.length}번`));
    s.append(element('span','date',day.date.replaceAll('-','.')),element('span','plus','+'));d.append(s);
    day.notes.forEach(note=>{if(day.notes.length>1)d.append(element('h4','ver','v'+note.version));const ul=element('ul');note.items.forEach((t,k)=>{const li=element('li','',t);li.style.setProperty('--i',Math.min(k,10));ul.append(li);});d.append(ul);});
    $('#notes').append(d);});
  if(days.length>SHOWN_NOTES){const more=element('button','notes-more',`이전 날짜 ${days.length-SHOWN_NOTES}일 더 보기`);more.type='button';more.onclick=()=>{document.querySelectorAll('.note[hidden]').forEach((n,k)=>{n.hidden=false;n.classList.add('appear');n.style.setProperty('--i',Math.min(k,12));});more.remove();};$('#notes').after(more);}
}).catch(()=>{$('#notes').textContent='업데이트 내역을 불러오지 못했어요. 잠시 후 새로고침해 주세요.';});
$('#copy-repo').onclick=async()=>{try{await navigator.clipboard.writeText($('#repo-url').textContent);const cb=$('#copy-repo');cb.textContent='복사했어요 ✓';cb.classList.add('done');setTimeout(()=>{cb.textContent='주소 복사';cb.classList.remove('done');},1800);$('#copy-help').textContent='복사했어요. 실리태번의 확장 설치에 붙여 넣으세요.';}catch{$('#copy-repo').textContent='다시 복사';const r=document.createRange();r.selectNodeContents($('#repo-url'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);$('#copy-help').textContent='자동 복사가 안 됐어요. 선택된 주소를 길게 누르거나 Ctrl+C로 복사해 주세요.';}};
document.addEventListener('play',e=>{if(e.target.tagName==='VIDEO'&&e.target.controls)document.querySelectorAll('video').forEach(v=>{if(v!==e.target)v.pause();});},true);

// header: hairline after scrolling, current section in the nav
const header=$('.top');
let headerFrame=0;const onScroll=()=>{headerFrame=0;header.classList.toggle('scrolled',scrollY>8);};
addEventListener('scroll',()=>{if(!headerFrame)headerFrame=requestAnimationFrame(onScroll);},{passive:true});onScroll();
const navLinks=[...document.querySelectorAll('.top nav a')].map(a=>[a,document.querySelector(a.hash)]).filter(([,s])=>s);
// which section is under the middle of the screen — the browser reports it, nothing is measured per frame
let current=null;const setCurrent=id=>{current=id;for(const [a,s] of navLinks){const on=String(s.id===id);if(a.getAttribute('aria-current')!==on)a.setAttribute('aria-current',on);}};
const spy=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)setCurrent(e.target.id);else if(current===e.target.id)setCurrent(null);}},{rootMargin:'-45% 0px -54% 0px'});
navLinks.forEach(([,s])=>spy.observe(s));

// Homepage stays light; palette preview brightness is independent.

// quiet fade-up as blocks enter
const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('in');reveal.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.fresh-item').forEach((el,i)=>el.style.setProperty('--i',i));
document.querySelectorAll('.fresh,.section-head,.palette-layout,.reading-layout,.gallery-block,.feature-search,.notice-guide,#notes,.install-inner>*').forEach(el=>{el.classList.add('reveal');reveal.observe(el);});

// which device the visitor mostly uses: picked in the hero, remembered, defaults to the screen they are on
(() => {
  const html = document.documentElement, pcReady = true;
  document.querySelector('.hero-art')?.classList.toggle('has-pc', pcReady);
  const pick = document.querySelector('.device-pick');
  if (!pcReady) { pick?.remove(); return; }
  const set = device => { html.classList.toggle('device-pc', device === 'pc'); html.classList.toggle('device-mobile', device !== 'pc');
    pick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
    document.querySelectorAll('.track').forEach(t => t.dispatchEvent(new Event('scroll'))); document.dispatchEvent(new CustomEvent('bl-device',{detail:device})); };
  set(html.classList.contains('device-pc') ? 'pc' : 'mobile');
  pick.addEventListener('click', e => { const b = e.target.closest('button[data-device]'); if (!b||b.getAttribute('aria-pressed')==='true') return; set(b.dataset.device); try { localStorage.setItem('bl-site-device', b.dataset.device); } catch {} });
})();
