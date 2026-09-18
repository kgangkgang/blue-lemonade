'use strict';
const groups = [
  { title: '대사는 또렷하게, 분위기는 그대로.', sub: '프롬프트 색 · 형광펜 · 외곽선 · 나이트 모드', cards: [
    ['371-ink-text.png','프롬프트가 고른 대사 색','데우스가 칠한 색을 글자에 그대로.'],
    ['371-ink-marker.png','취향은 형광펜 쪽','글자는 선명하게, 붓자국 띠만 프롬프트 색으로.'],
    ['371-ink-outline-night.png','어두운 화면에서도 또렷하게','대사에만 외곽선과 그림자를 더할 수 있어요.'],
    ['371-ink-outline-setting.png','가독성도 원하는 만큼','색, 두께, 각도를 조절하고 미리보기로 확인하세요.'],
    ['371-outline-setting.png','본문 전체에 글자 외곽선','글자 › 그림자 · 외곽선에서 설정해요.'],
  ]},
  { title: '작은 화면을 넓게 쓰는 방법.', sub: '퀵 리플라이 · 전체 찾기 · 가로·세로 스크롤', cards: [
    ['372-qr-place.mp4','입력창 위로, 한 줄 더','폰에서도 QR 줄을 입력창 위로 올릴 수 있어요.','372-qr-top.png','372-qr-place.gif'],
    ['354-qr-vertical.png','여러 줄이 편하다면','세로 스크롤은 보이는 줄을 1~4줄로 정할 수 있어요.'],
    ['355-qr-find-mark.png','이름도, 내용도 한 번에','찾은 부분에 형광펜이 칠해져요. 하위 세트도 함께 찾아요.'],
    ['354-qr-snap.mp4','반쯤 걸린 버튼 없이','넘기다 멈추면 돋보기 옆에 가지런히 붙어요.','354-qr-scroll-setting.png','354-qr-snap.gif'],
    ['352-pc-wheel.mp4','PC에서는 휠만 굴리세요','Shift 없이 옆으로. 마우스로 끌어서 넘겨도 돼요.','371-pc-qr-top.png','352-pc-wheel.gif'],
  ]},
  { title: '읽는 동안에는, 이야기만.', sub: '몰입 읽기 · 한 손 버튼 · 데우스 카드', cards: [
    ['310-reader.mp4','밀어서 몰입하기','아래로 읽으면 메뉴와 입력창이 잠시 비켜나요.','310-onehand.png','310-reader.gif'],
    ['310-onehand.png','한 손으로 닿는 버튼','스와이프, 사칭, 이어 쓰기, 다시 생성을 입력창 가까이에.'],
    ['310-fold.mp4','폰에서는 카드를 접어서','트래커와 장면 계획을 필요한 순간에 펼쳐 보세요.','310-skin-fold.png','310-fold.gif'],
    ['341-card-own-color.png','데우스의 원래 색도 그대로','카드 색 통일을 끄면 항목마다 다른 색을 볼 수 있어요.'],
    ['340-prompt-tab.png','프롬프트 설정을 한곳에','카드 스킨부터 날씨까지, 데우스 호환 기능을 모았어요.'],
  ]},
  { title: '오늘의 색, 오늘의 날씨.', sub: '이미지에서 색 뽑기 · 비와 눈 · 내 스타일', cards: [
    ['351-color-loupe.png','좋아하는 사진에서 한 방울','확대경으로 원하는 부분의 색을 콕 집어요.'],
    ['351-color-swatches.png','이미지의 대표 색','색 조합을 한 줄에서 고르고 최근 색도 다시 써요.'],
    ['330-rain.mp4','창밖에 비가 내리는 날','채팅 뒤에 은은하게 흐르는 비. 세기도 조절해요.','330-rain.png','330-rain.gif'],
    ['330-snow.mp4','조용히 내려오는 눈','트래커의 날씨를 따르게 할 수도 있어요.','330-snow.png','330-snow.gif'],
    ['331-lemon.mp4','레몬도 내려요','투명 PNG로 꽃잎, 별, 마음에 드는 그림을 더해요.','331-lemon.png','331-lemon.gif'],
    ['362-weather-preview.mp4','움직이는 미리보기','크기, 투명도, 속도, 각도를 바꾸면 바로 따라와요.','362-weather-panel.png','362-weather-preview.gif'],
    ['310-styles.png','한 번에 입히는 스타일','소설책, 메신저, 또렷하게. 완성 스타일로 시작하세요.'],
    ['320-auto.png','낮에는 밝게, 밤에는 편안하게','기기 다크 모드나 정해 둔 시간을 따라 전환해요.'],
  ]},
  { title: '설정하는 시간도 편안하게.', sub: 'PC와 폰 설정 · 긴 목록 · 다른 CSS 끄기', cards: [
    ['301-pc-st-settings.png','PC 설정은 두 열로','스위치와 슬라이더를 나란히 정리했어요.'],
    ['351-pc-color-bars.png','길고 보기 편한 색 칸','이름 옆에서 지금 색을 바로 확인해요.'],
    ['364-ext-drawer.png','좁아도 가지런한 확장 서랍','아이콘은 밀리지 않고 글자는 줄 너비에 맞춰져요.'],
    ['363-long-list.png','화면 밖으로 넘치지 않는 목록','높이가 낮아져도 목록 안에서 스크롤할 수 있어요.'],
    ['372-css-setting.png','다른 테마에서 넘어왔다면','남아 있는 커스텀 CSS를 지우지 않고 잠시 꺼 둬요.'],
    ['351-splash.mp4','처음부터 레몬 화면','새로고침하는 짧은 순간까지 같은 분위기로.','331-lemon.png','351-splash.gif'],
  ]},
];
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
const lightbox=$('#lightbox');
for(const group of groups){
  const block=element('section','gallery-block'), heading=element('div','gallery-heading'), label=element('div');
  label.append(element('h3','',group.title),element('p','',group.sub));heading.append(label);
  const track=element('div','track'); track.tabIndex=0; track.setAttribute('aria-label',group.title+' 갤러리');
  const arrows=element('div','arrows');for(const [symbol,dir,name] of [['←',-1,'이전'],['→',1,'다음']]){const b=element('button','',symbol);b.setAttribute('aria-label',group.title+' '+name);b.onclick=()=>track.scrollBy({left:dir*(track.querySelector('.card').offsetWidth+18),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});arrows.append(b);}heading.append(arrows);
  for(const [file,title,description,poster,gif] of group.cards){
    const card=element('figure','card'), wrap=element('div','media-wrap'), caption=element('figcaption','',title);
    if(file.endsWith('.mp4')){const video=element('video');video.controls=true;video.preload='none';video.playsInline=true;video.muted=true;video.loop=true;video.src='media/'+file;video.poster='media/'+poster;video.setAttribute('aria-label',title);wrap.append(video);}else{const img=element('img');img.src='media/'+file;img.alt=title;img.loading='lazy';img.decoding='async';img.tabIndex=0;const open=()=>{lightbox.querySelector('img').src=img.src;lightbox.querySelector('img').alt=title;lightbox.querySelector('p').textContent=title;lightbox.showModal();};img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open();}};wrap.append(img);}
    caption.append(element('small','',description));if(gif){const a=element('a','gif-link','움짤로 보기 ↗');a.href='media/'+gif;a.target='_blank';a.rel='noopener';caption.append(a);}card.append(wrap,caption);track.append(card);
  }block.append(heading,track);$('#galleries').append(block);
}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
fetch('release-notes.json').then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();notes.forEach((note,i)=>{const d=element('details','note');d.open=i===0;const s=element('summary');s.append(element('span','num',note.version));if(i===0)s.append(element('span','tag','NEW'));s.append(element('span','date',note.date.replaceAll('-','.')),element('span','plus','+'));const ul=element('ul');note.items.forEach(t=>ul.append(element('li','',t)));d.append(s,ul);$('#notes').append(d);});}).catch(()=>{$('#notes').textContent='업데이트 내역을 불러오지 못했어요. 잠시 후 새로고침해 주세요.';});
$('#copy-repo').onclick=async()=>{try{await navigator.clipboard.writeText($('#repo-url').textContent);$('#toast').textContent='설치 주소를 복사했어요.';$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200);}catch{$('#copy-repo').textContent='주소 선택';const r=document.createRange();r.selectNodeContents($('#repo-url'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);}};
document.addEventListener('play',e=>{if(e.target.tagName==='VIDEO')document.querySelectorAll('video').forEach(v=>{if(v!==e.target)v.pause();});},true);
