'use strict';
const groups = [
  { title: '에이드를 섞어, 나만의 색으로.', sub: '에이드 혼합 · 번짐 · 글자 그라데이션', cards: [
    ['397-blend.mp4','번짐은 내 마음대로','0이면 색 경계가 딱 나뉘고, 100이면 끝에서 끝까지 천천히 번져요.','397-blend.jpg','397-blend.gif'],
    ['396-mix.mp4','에이드를 섞어서','방향을 돌리고 두세 가지 에이드를 골라 섞어요.','396-mix.jpg','396-mix.gif'],
    ['396-text-gradient.png','글자에도 그라데이션','이름·대사·속마음을 따로 물들일 수 있어요.'],
    ['396-mix-setting.png','섞는 건 간단하게','혼합을 켜고 에이드를 고르면 끝. 라이트·나이트 따로 저장돼요.'],
  ]},
  { title: '열두 가지 에이드, 가벼워진 설정.', sub: '새 에이드 6종 · 알약·직사각형 형광펜 · 설정 검색 · 되돌리기 · 변경한 설정', cards: [
    ['388-ades.mp4','에이드가 열두 가지로','라벤더·딸기·민트·오렌지·우드·수박이 더해졌어요.','388-ades.jpg','388-ades.gif'],
    ['390-pill-marker.png','끝이 둥근 알약 형광펜','펜 자국·직사각형에 알약 모양까지 더해졌어요.'],
    ['388-rect-marker.png','끝이 반듯한 형광펜','펜 자국 대신 직사각형으로. 위치와 굵기도 맞춰요.'],
    ['385-search.mp4','말로 찾는 설정','"내 사진 오른쪽"처럼 입력하면 그 설정으로 바로 가요.','385-search.jpg','385-search.gif'],
    ['389-history.mp4','되돌리기·다시 실행','바꾼 값을 한 번에 되돌려요. 무엇이 바뀌었는지 알려 줘요.','389-history.jpg','389-history.gif'],
    ['385-zoom.mp4','미리보기는 확대해서','최대 300%까지 키우고, 끌어서 구석까지 확인해요.','385-zoom.jpg','385-zoom.gif'],
    ['390-changes.png','바꾼 설정만 모아서','기본값과 다른 항목을 한눈에. 하나씩 기본값으로 돌려요.'],
  ]},
  { title: '사진은 크게, 액자는 취향대로.', sub: '큰 프로필 · 장식 액자 · 액자 색 · 내 PNG 액자 · 내 프로필', cards: [
    ['380-big-profile.png','사진을 이야기 첫머리에','캐릭터 사진을 본문 위에 크게. 크기와 자르기도 자유롭게.'],
    ['383-frames.mp4','여섯 가지 장식 액자','수채화부터 낙서 노트까지, 눌러서 바로 바꿔요.','383-frames.jpg','383-frames.gif'],
    ['399-frame-colors.mp4','액자 색도 내 마음대로','기본 액자는 바탕색과 포인트색을 따로 골라요.','399-frame-colors.jpg','399-frame-colors.gif'],
    ['399-frame-colors-set.png','바탕색 · 포인트색','캐릭터 프로필 › 장식 액자에서 두 칸만 바꾸면 돼요.'],
    ['399-custom-frame.mp4','내 PNG로 만드는 액자','그림을 고르면 사진이 들어갈 안쪽을 찾아 주고, 한 번 누르면 끝이에요.','399-custom-frame.jpg','399-custom-frame.gif'],
    ['399-custom-frame-chat.png','내 액자 그대로','직접 만든 폴라로이드도 기본 액자처럼 어울려요.'],
    ['384-my-profile.png','내 프로필도 따로','내 사진에는 다른 액자를. 캐릭터와 따로 꾸며요.'],
  ]},
  { title: '대사는 또렷하게, 분위기는 그대로.', sub: '프롬프트 색 · 형광펜 · 외곽선 · 나이트 모드', cards: [
    ['371-ink-text.png','프롬프트가 고른 대사 색','데우스가 칠한 색을 글자에 그대로.'],
    ['371-ink-marker.png','취향은 형광펜 쪽','글자는 선명하게, 붓자국 띠만 프롬프트 색으로.'],
    ['371-ink-outline-night.png','어두운 화면에서도 또렷하게','대사에만 외곽선과 그림자를 더할 수 있어요.'],
    ['371-ink-outline-setting.png','가독성도 원하는 만큼','색, 두께, 각도를 조절하고 미리보기로 확인하세요.'],
    ['371-outline-setting.png','본문 전체에 글자 외곽선','글자 › 그림자 · 외곽선에서 설정해요.'],
  ]},
  { title: '작은 화면을 넓게 쓰는 방법.', sub: '퀵 리플라이 · 전체 찾기 · 가로·세로 스크롤', cards: [
    ['372-qr-place.mp4','입력창 위로, 한 줄 더','폰에서도 QR 줄을 입력창 위로 올릴 수 있어요.','372-qr-place.jpg','372-qr-place.gif'],
    ['354-qr-vertical.png','여러 줄이 편하다면','세로 스크롤은 보이는 줄을 1~4줄로 정할 수 있어요.'],
    ['355-qr-find-mark.png','이름도, 내용도 한 번에','찾은 부분에 형광펜이 칠해져요. 하위 세트도 함께 찾아요.'],
    ['354-qr-snap.mp4','반쯤 걸린 버튼 없이','넘기다 멈추면 돋보기 옆에 가지런히 붙어요.','354-qr-snap.jpg','354-qr-snap.gif'],
    ['352-pc-wheel.mp4','PC에서는 휠만 굴리세요','Shift 없이 옆으로. 마우스로 끌어서 넘겨도 돼요.','352-pc-wheel.jpg','352-pc-wheel.gif'],
  ]},
  { title: '읽는 동안에는, 이야기만.', sub: '몰입 읽기 · 한 손 버튼 · 데우스 카드', cards: [
    ['310-reader.mp4','밀어서 몰입하기','아래로 읽으면 메뉴와 입력창이 잠시 비켜나요.','310-reader.jpg','310-reader.gif'],
    ['310-onehand.png','한 손으로 닿는 버튼','스와이프, 사칭, 이어 쓰기, 다시 생성을 입력창 가까이에.'],
    ['310-fold.mp4','폰에서는 카드를 접어서','트래커와 장면 계획을 필요한 순간에 펼쳐 보세요.','310-fold.jpg','310-fold.gif'],
    ['341-card-own-color.png','데우스의 원래 색도 그대로','카드 색 통일을 끄면 항목마다 다른 색을 볼 수 있어요.'],
    ['340-prompt-tab.png','프롬프트 설정을 한곳에','카드 스킨부터 날씨까지, 데우스 호환 기능을 모았어요.'],
  ]},
  { title: '오늘의 색, 오늘의 날씨.', sub: '이미지에서 색 뽑기 · 비와 눈 · 내 스타일', cards: [
    ['351-color-loupe.png','좋아하는 사진에서 한 방울','확대경으로 원하는 부분의 색을 콕 집어요.'],
    ['351-color-swatches.png','이미지의 대표 색','색 조합을 한 줄에서 고르고 최근 색도 다시 써요.'],
    ['330-rain.mp4','창밖에 비가 내리는 날','채팅 뒤에 은은하게 흐르는 비. 세기도 조절해요.','330-rain.jpg','330-rain.gif'],
    ['330-snow.mp4','조용히 내려오는 눈','트래커의 날씨를 따르게 할 수도 있어요.','330-snow.jpg','330-snow.gif'],
    ['331-lemon.mp4','내 그림도 내려요','투명 PNG로 꽃잎, 별, 마음에 드는 그림을 더해요.','331-lemon.jpg','331-lemon.gif'],
    ['362-weather-preview.mp4','움직이는 미리보기','크기, 투명도, 속도, 각도를 바꾸면 바로 따라와요.','362-weather-preview.jpg','362-weather-preview.gif'],
    ['310-styles.png','한 번에 입히는 스타일','소설책, 메신저, 또렷하게. 완성 스타일로 시작하세요.'],
    ['320-auto.png','낮에는 밝게, 밤에는 편안하게','기기 다크 모드나 정해 둔 시간을 따라 전환해요.'],
  ]},
  { title: '설정하는 시간도 편안하게.', sub: '숫자 쉼표 · 두 칸 설정 · 프롬프트 목록 · 긴 목록 · 다른 CSS 끄기', cards: [
    ['399-context-commas.mp4','128,000처럼 쉼표로','폰에서도 설정은 두 칸으로. 큰 숫자는 끊어 보여서 컨텍스트를 헷갈리지 않아요.','399-context-commas.jpg','399-context-commas.gif'],
    ['399-prompt-list.png','프롬프트 목록도 한눈에','위쪽은 두 줄로, 토큰 수는 오른쪽에 맞춰 정리했어요.'],
    ['301-pc-st-settings.png','PC 설정은 두 열로','스위치와 슬라이더를 나란히 정리했어요.'],
    ['351-pc-color-bars.jpg','길고 보기 편한 색 칸','이름 옆에서 지금 색을 바로 확인해요.'],
    ['364-ext-drawer.png','좁아도 가지런한 확장 서랍','아이콘은 밀리지 않고 글자는 줄 너비에 맞춰져요.'],
    ['363-long-list.png','화면 밖으로 넘치지 않는 목록','높이가 낮아져도 목록 안에서 스크롤할 수 있어요.'],
    ['372-css-setting.png','다른 테마에서 넘어왔다면','남아 있는 커스텀 CSS를 지우지 않고 잠시 꺼 둬요.'],
    ['351-splash.mp4','처음부터 레몬 화면','새로고침하는 짧은 순간까지 같은 분위기로.','351-splash.jpg','351-splash.gif'],
  ]},
];
// PC screens (1440×900) — shown instead of the phone groups when the visitor picks PC
const pcGroups = [
  { title: '넓은 화면에서, 더 시원하게.', sub: '배경 그림 · 에이드 혼합 · 번짐 · 액자 색 · 내 PNG 액자 · 나란히 보는 설정 · 날씨', cards: [
    ['pc-mix.mp4','에이드를 섞어서','두세 가지 에이드로 형광펜과 면을 함께 물들여요.','pc-mix.jpg','pc-mix.gif'],
    ['pc-blend.mp4','번짐은 내 마음대로','미리보기를 보면서 경계를 또렷하게, 또는 부드럽게.','pc-blend.jpg','pc-blend.gif'],
    ['pc-night.jpg','밤바다 위의 나이트','배경 그림이 은은하게 비치는 차콜 화면.'],
    ['pc-settings.jpg','미리보기와 설정을 나란히','왼쪽에서 보고, 오른쪽에서 바로 바꿔요.'],
    ['pc-search.mp4','찾으면 바로 그 설정','"형광펜 모양"처럼 입력하면 그 자리로 가요.','pc-search.jpg','pc-search.gif'],
    ['pc-ades.mp4','열두 가지 에이드','넓은 화면에서 한 번에 바꿔 보세요.','pc-ades.jpg','pc-ades.gif'],
    ['pc-frame-colors.mp4','액자 색도 내 마음대로','리본 액자의 바탕색과 포인트색을 바꿔 가며.','pc-frame-colors.jpg','pc-frame-colors.gif'],
    ['pc-frame-colors-set.jpg','바탕색 · 포인트색','미리보기를 보면서 두 칸만 바꾸면 돼요.'],
    ['pc-custom-frame.mp4','내 PNG로 만드는 액자','파란 자리에 사진이 들어가요. 확인하고 한 번 누르면 적용돼요.','pc-custom-frame.jpg','pc-custom-frame.gif'],
    ['pc-weather.mp4','눈 내리는 밤','채팅 뒤로 조용히 눈이 내려요.','pc-weather.jpg','pc-weather.gif'],
  ]},
];
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
// media version: bump when shots are retaken under the same names, so cached copies don't linger
const MV='?v=20260920-408';
const additions = { title: '새로 더한, 나만의 작은 도구.', sub: '4.0.7 · 날씨 · 에이드 보관함 · 선택해서 켜는 확장', cards: [
 ['407-lorebook-night.png','연결된 책에 불이 들어와요','캐릭터·채팅 로어북이 연결되면 아이콘이 테마색으로 은은하게 빛나요.'],
 ['407-lorebook-light.png','밝은 화면에서도 한눈에','화이트·나이트와 그룹 채팅 모두 적용돼요. 연결 해제 시 기본 모습으로 돌아와요.'],
 ['403-hero-phone-dark.mp4','유성우에서 비와 눈으로','실제 테마의 세 가지 날씨가 부드럽게 이어져요.','403-hero-phone-dark.jpg','403-hero-phone-dark.gif'],
 ['403-capture-new-desktop.png','넓은 화면에서는 나란히','PC는 왼쪽에서 선택·미리보기, 오른쪽에서 두 열의 설정을 조절해요.'],
 ['403-capture-parameters-mobile.jpg','가림 모양도 섬세하게','얇은 슬라이더와 테마색 손잡이로 여백·기울기·외곽선·그림자를 조절해요.'],
 ['400-weather-lemon.mp4','레몬은 기본 날씨로','그림을 따로 준비하지 않아도, 레몬 조각이 내려요.','400-weather-lemon.jpg','400-weather-lemon.gif'],
 ['400-weather-petal.mp4','흔들흔들 꽃잎','낙하 방식·흔들림·회전을 모든 날씨에 적용해요.','400-weather-petal.jpg','400-weather-petal.gif'],
 ['402-weather-meteor.mp4','밤하늘을 둥글게 도는 유성우','방향·곡률·원 크기로 직선부터 원형까지.','402-weather-meteor.jpg','402-weather-meteor.gif'],
 ['402-weather-settings.png','움직임까지 직접','유성우 방향·곡률·원 크기도 미리 보면서 맞춰요.'],
 ['403-palette-library.jpg','마음에 든 색은 보관함에','화이트·나이트를 한 쌍으로, 24개까지 저장해요.'],
 ['403-words-desktop.png','단어 치환도 한곳에서','번역본·원문 보기로 메시지를 고르고, 치환 전후를 확인해요.'],
 ['403-capture-new-desktop.png','좋아하는 장면을 이미지·영상으로','캡처용 글 편집과 가림 꾸밈, 배경 영상까지 미리 봐요.'],
 ['403-order-desktop.png','확장 순서 정리','필요할 때만 켜고, 기존 단독 확장과 중복 실행을 막아요.'],
 ['402-capture-editor.png','공유할 문장만 다듬어서','문장을 고치고 문단을 옮겨도 원문과 번역문은 그대로예요.'],
 ['402-capture-video.mp4','배경과 날씨도 함께','이름을 가린 캡처에도 움직이는 장면을 담아요.','402-capture-video.jpg','402-capture-video.gif'],
 ['403-models-desktop.png','목록에 없는 모델도 직접','공급자를 고르고 모델 이름을 등록해요.'],
 ['403-modelorder-desktop.png','모델 순서도 테마 안에서','직접 등록한 모델을 끌거나 화살표로 정렬해요.'],
 ['403-perf-desktop.png','성능 보조도 선택해서','왼쪽에서 표시 위치를 고르고 오른쪽에서 다섯 도구를 바로 조절해요.'],
]};
groups.unshift({...additions,cards:additions.cards.map(card=>card[0]==='403-capture-new-desktop.png'?['403-capture-mobile.png','모바일에서도 미리 보고 저장','선택한 채팅과 이름 가림을 확인하고, 설정을 바꾼 뒤 다시 만들어요.']:card)});pcGroups.unshift(additions);
const scripts408 = {title:'한글화와 업데이트도, 테마 안에서.',sub:'4.0.8 · 스크립트 5종 · 개별 켜기·끄기 · 코드 편집 · 단독 업데이트'};
groups.unshift({...scripts408,cards:[
 ['408-scripts-mobile.jpg','필요한 스크립트만 켜요','실리태번·헬퍼 한글화, 데우스·샤진 번역과 삼각형 접기를 각각 선택해요. 기존 헬퍼의 같은 스크립트는 먼저 꺼 주세요.'],
 ['408-update-mobile.jpg','이 테마만 업데이트','전체 확장 목록을 기다리지 않고 확인해요. 업데이트 후 새로고침하면 적용돼요.']
]});
pcGroups.unshift({...scripts408,cards:[
 ['408-scripts-pc.jpg','왼쪽에서 고르고, 오른쪽에서 편집','스크립트마다 코드를 수정·저장·복원할 수 있어요. 사용자 수정본은 테마 업데이트 뒤에도 남아요.'],
 ['408-update-pc.jpg','업데이트도 테마 설정에서','Git 설치는 직접 업데이트, ZIP 설치는 다운로드를 안내해요. 버튼을 누르기 전에는 조회하지 않아요.']
]});

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
document.documentElement.classList.add('js');
const lightbox=$('#lightbox');
const inView=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){if(reduceMotion.matches||target.dataset.userPaused)continue;if(isIntersecting)target.play().catch(()=>{});else target.pause();}},{threshold:.35});
for(const group of [...pcGroups.map(g=>({...g,device:'pc'})),...groups.map(g=>({...g,device:'mobile'}))]){
  const block=element('section','gallery-block'), heading=element('div','gallery-heading'), label=element('div'); block.dataset.device=group.device;
  label.append(element('h3','',group.title),element('p','',group.sub));heading.append(label);
  const track=element('div','track'); track.tabIndex=0; track.setAttribute('aria-label',group.title+' 갤러리');
  const arrows=element('div','arrows'), buttons=[];
  for(const [symbol,dir,name] of [['←',-1,'이전'],['→',1,'다음']]){const b=element('button','',symbol);b.setAttribute('aria-label',group.title+' '+name);b.onclick=()=>track.scrollBy({left:dir*(track.querySelector('.card').offsetWidth+16),behavior:reduceMotion.matches?'instant':'smooth'});arrows.append(b);buttons.push(b);}heading.append(arrows);
  const syncArrows=()=>{buttons[0].disabled=track.scrollLeft<4;buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;};
  track.addEventListener('scroll',syncArrows,{passive:true});addEventListener('resize',syncArrows);
  for(const [file,title,description,poster,gif] of group.cards){
    const card=element('figure','card'), wrap=element('div','media-wrap'), caption=element('figcaption','',title); card.style.setProperty('--i',Math.min(track.children.length,6));
    if(file.endsWith('.mp4')){
      const video=element('video');video.preload='metadata';video.playsInline=true;video.muted=true;video.loop=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.src='media/'+file+MV;video.poster='media/'+poster+MV;video.setAttribute('aria-label',title);
      if(reduceMotion.matches)video.controls=true;
      else{const state=element('span','play-state','▶');state.setAttribute('aria-hidden','true');wrap.classList.add('paused');
        video.addEventListener('play',()=>wrap.classList.remove('paused'));video.addEventListener('pause',()=>wrap.classList.add('paused'));
        video.addEventListener('click',()=>{if(video.paused){delete video.dataset.userPaused;video.play().catch(()=>{});}else{video.dataset.userPaused='1';video.pause();}});
        wrap.append(state);inView.observe(video);}
      wrap.prepend(video);
    }else{const img=element('img');img.src='media/'+file+MV;img.alt=title;img.loading='lazy';img.decoding='async';img.tabIndex=0;const open=()=>{lightbox.querySelector('img').src=img.src;lightbox.querySelector('img').alt=title;lightbox.querySelector('p').textContent=title;lightbox.showModal();};img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open();}};wrap.append(img);}
    caption.append(element('small','',description));if(gif){const a=element('a','gif-link','움짤로 보기 ↗');a.href='media/'+gif+MV;a.target='_blank';a.rel='noopener';caption.append(a);}card.append(wrap,caption);track.append(card);
  }block.append(heading,track);$('#galleries').append(block);syncArrows();
}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
const SHOWN_NOTES=5;
fetch('release-notes.json').then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();notes.forEach((note,i)=>{const d=element('details','note');d.open=i===0;d.hidden=i>=SHOWN_NOTES;const s=element('summary');s.append(element('span','num',note.version));if(i===0)s.append(element('span','tag','NEW'));s.append(element('span','date',note.date.replaceAll('-','.')),element('span','plus','+'));const ul=element('ul');note.items.forEach((t,k)=>{const li=element('li','',t);li.style.setProperty('--i',Math.min(k,10));ul.append(li);});d.append(s,ul);$('#notes').append(d);});
  if(notes.length>SHOWN_NOTES){const more=element('button','notes-more',`이전 버전 ${notes.length-SHOWN_NOTES}개 더 보기`);more.type='button';more.onclick=()=>{document.querySelectorAll('.note[hidden]').forEach((n,k)=>{n.hidden=false;n.classList.add('appear');n.style.setProperty('--i',Math.min(k,12));});more.remove();};$('#notes').after(more);}
}).catch(()=>{$('#notes').textContent='업데이트 내역을 불러오지 못했어요. 잠시 후 새로고침해 주세요.';});
$('#copy-repo').onclick=async()=>{try{await navigator.clipboard.writeText($('#repo-url').textContent);const cb=$('#copy-repo');cb.textContent='복사됨 ✓';cb.classList.add('done');setTimeout(()=>{cb.textContent='복사';cb.classList.remove('done');},1800);$('#toast').textContent='설치 주소를 복사했어요.';$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200);}catch{$('#copy-repo').textContent='주소 선택';const r=document.createRange();r.selectNodeContents($('#repo-url'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);}};
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

// white / night toggle — follows the device until the visitor picks one
const root=document.documentElement, dark=matchMedia('(prefers-color-scheme: dark)');
$('#theme-toggle').onclick=e=>{const next=(root.dataset.theme||(dark.matches?'dark':'light'))==='dark'?'light':'dark';const swap=()=>{root.dataset.theme=next;try{localStorage.setItem('bl-site-theme',next);}catch{}document.dispatchEvent(new CustomEvent('bl-theme',{detail:next}));};
  if(!document.startViewTransition||reduceMotion.matches){swap();return;}
  const b=e.currentTarget.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  root.classList.add('theme-swap');const vt=document.startViewTransition(swap);vt.finished.finally(()=>root.classList.remove('theme-swap'));vt.ready.then(()=>root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:850,easing:'cubic-bezier(.45,0,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});};

// quiet fade-up as blocks enter
const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('in');reveal.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.section-head,.palette-layout,.reading-layout,.gallery-block,.feature-search,.notice-guide,#notes,.install-inner>*').forEach(el=>{el.classList.add('reveal');reveal.observe(el);});

// which device the visitor mostly uses: picked in the hero, remembered, defaults to the screen they are on
(() => {
  const html = document.documentElement, pcReady = pcGroups.length > 0;
  $('#galleries').classList.toggle('has-pc', pcReady);
  document.querySelector('.hero-art')?.classList.toggle('has-pc', pcReady);
  const pick = document.querySelector('.device-pick');
  if (!pcReady) { pick?.remove(); return; }
  const set = device => { html.classList.toggle('device-pc', device === 'pc'); html.classList.toggle('device-mobile', device !== 'pc');
    pick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
    document.querySelectorAll('.track').forEach(t => t.dispatchEvent(new Event('scroll'))); };
  set(html.classList.contains('device-pc') ? 'pc' : 'mobile');
  pick.addEventListener('click', e => { const b = e.target.closest('button[data-device]'); if (!b) return; set(b.dataset.device); try { localStorage.setItem('bl-site-device', b.dataset.device); } catch {} });
})();

// hero loops (phones for mobile, browser windows for PC): only the chosen device's pair is fetched
(() => {
  const art = document.querySelector('.hero-art'); if (!art) return;
  const vids = [...art.querySelectorAll('video.hero-video')];
  const shown = v => document.documentElement.classList.contains('device-pc') ? !!v.closest('.pc-stage') : !!v.closest('.phone-slot');
  const start = v => { if (!v.src && v.dataset.src) { if (v.dataset.poster) v.poster = v.dataset.poster; v.src = v.dataset.src; } v.muted = true; const p = v.play(); if (p) p.catch(() => {}); };
  const sync = () => { const on = !document.hidden && !reduceMotion.matches && !art.classList.contains('idle'); for (const v of vids) { if (shown(v) && on) start(v); else v.pause(); } };
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(art, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', sync);
  sync();
})();
