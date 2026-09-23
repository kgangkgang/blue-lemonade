'use strict';
// Synthetic demonstration chat; revised settings and weather filmed with the 4.7.2 runtime.
const topics = [
  {
    "id": "color",
    "label": "색",
    "title": "한 방울씩, 나만의 색.",
    "sub": "에이드를 섞고, 번짐을 조절하고, 마음에 든 색을 저장해요.",
    "cards": [
      [
        "471-mix-setting.mp4",
        "에이드 섞기",
        "두세 가지 색을 원하는 비율로.",
        "471-mix-setting.jpg"
      ],
      [
        "472-colors.mp4",
        "색 하나하나",
        "바탕부터 글자까지 따로 고쳐요.",
        "472-colors.jpg"
      ],
      [
        "472-styles.mp4",
        "한 번에 입히는 스타일",
        "소설책 · 메신저 · 또렷하게.",
        "472-styles.jpg"
      ],
      [
        "471-palette-library.mp4",
        "마음에 든 색 보관하기",
        "라이트와 나이트를 한 쌍으로.",
        "471-palette-library.jpg"
      ],
      [
        "471-auto.mp4",
        "낮과 밤에 맞춰서",
        "기기 테마나 정해 둔 시간을 따라가요.",
        "471-auto.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-mix-setting.mp4",
        "섞고, 바로 보고",
        "미리보기와 설정을 나란히.",
        "471-pc-mix-setting.jpg"
      ],
      [
        "472-pc-colors.mp4",
        "색 하나하나",
        "",
        "472-pc-colors.jpg"
      ],
      [
        "472-pc-styles.mp4",
        "완성된 스타일",
        "",
        "472-pc-styles.jpg"
      ]
    ]
  },
  {
    "id": "text",
    "label": "대사",
    "title": "읽는 리듬까지 내 취향으로.",
    "sub": "형광펜 · 글꼴 · 여백 · 움직이는 대사.",
    "cards": [
      [
        "471-marker-setting.mp4",
        "형광펜의 모양과 굵기",
        "펜 자국 · 직사각형 · 알약.",
        "471-marker-setting.jpg"
      ],
      [
        "472-fx-setting.mp4",
        "감정이 실린 대사",
        "움직임 · 빛 · 색 흐름을 골라요.",
        "472-fx-setting.jpg"
      ],
      [
        "471-text-gradient-setting.mp4",
        "글자에도 그라데이션",
        "이름과 대사를 서로 다른 색으로.",
        "471-text-gradient-setting.jpg"
      ],
      [
        "471-fonts.mp4",
        "언어마다 다른 글꼴",
        "",
        "471-fonts.jpg"
      ],
      [
        "471-para.mp4",
        "문단과 여백",
        "",
        "471-para.jpg"
      ],
      [
        "472-outline-setting.mp4",
        "글자 그림자 · 외곽선",
        "",
        "472-outline-setting.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-marker-setting.mp4",
        "형광펜 조절",
        "",
        "471-pc-marker-setting.jpg"
      ],
      [
        "472-pc-fx-setting.mp4",
        "움직임의 크기까지",
        "",
        "472-pc-fx-setting.jpg"
      ],
      [
        "471-pc-fonts.mp4",
        "글꼴과 읽는 리듬",
        "",
        "471-pc-fonts.jpg"
      ]
    ]
  },
  {
    "id": "profile",
    "label": "사진",
    "title": "사진을 크게, 이야기는 편안하게.",
    "sub": "큰 프로필 · 작은 프로필 · 대화만. 액자와 배치도 따로.",
    "cards": [
      [
        "472-profile-setting.mp4",
        "사진은 원하는 만큼",
        "없음 · 작게 · 상단 크게.",
        "472-profile-setting.jpg"
      ],
      [
        "472-my-profile.mp4",
        "내 프로필은 따로",
        "",
        "472-my-profile.jpg"
      ],
      [
        "472-name-time.mp4",
        "이름과 시간 줄",
        "",
        "472-name-time.jpg"
      ],
      [
        "472-image-layout.mp4",
        "채팅 속 그림 배치",
        "",
        "472-image-layout.jpg"
      ],
      [
        "472-image-frame.mp4",
        "둥글기와 테두리",
        "",
        "472-image-frame.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-profile-setting.mp4",
        "프로필의 크기와 배치",
        "",
        "472-pc-profile-setting.jpg"
      ],
      [
        "472-pc-my-profile.mp4",
        "내 사진도 따로",
        "",
        "472-pc-my-profile.jpg"
      ],
      [
        "472-pc-image-frame.mp4",
        "사진의 마무리",
        "",
        "472-pc-image-frame.jpg"
      ]
    ]
  },
  {
    "id": "weather",
    "label": "날씨",
    "title": "이야기 뒤에 흐르는 풍경.",
    "sub": "실사 · 일러스트 · 셀 애니. 같은 날씨도 다른 분위기로.",
    "cards": [
      [
        "471-look-feather.mp4",
        "빛 사이로 내려오는 깃털",
        "천천히 흔들리고, 가볍게 회전해요.",
        "471-look-feather.jpg"
      ],
      [
        "471-look-butterfly.mp4",
        "문장 곁의 나비",
        "날갯짓하며 떠오르는 작은 색.",
        "471-look-butterfly.jpg"
      ],
      [
        "472-lemon-cel.mp4",
        "가벼운 셀 애니풍",
        "단순한 색면, 부드러운 명암.",
        "472-lemon-cel.jpg"
      ],
      [
        "471-look-lemon-anime.mp4",
        "일러스트풍 레몬",
        "기존 애니풍도 그대로 남겨 뒀어요.",
        "471-look-lemon-anime.jpg"
      ],
      [
        "471-look-sun.mp4",
        "햇살 머무는 오후",
        "구름과 따뜻한 빛을 겹쳐요.",
        "471-look-sun.jpg"
      ],
      [
        "472-look-rain.mp4",
        "비 오는 창가",
        "",
        "472-look-rain.jpg"
      ],
      [
        "471-look-stars.mp4",
        "은하수와 유성",
        "",
        "471-look-stars.jpg"
      ],
      [
        "472-weather-style.mp4",
        "실사 · 일러스트 · 셀 애니",
        "같은 날씨, 세 가지 그림체.",
        "472-weather-style.jpg"
      ],
      [
        "471-weather-color.mp4",
        "색도 내 마음대로",
        "기본 · 직접 고르기 · 두 색 그라데이션.",
        "471-weather-color.jpg"
      ],
      [
        "471-weather-bubble.mp4",
        "내 메시지 너머로도",
        "",
        "471-weather-bubble.jpg"
      ],
      [
        "471-weather-custom.mp4",
        "내 그림도 내려요",
        "",
        "471-weather-custom.jpg"
      ],
      [
        "472-weather-outline.mp4",
        "외곽선은 취향대로",
        "그림 외곽선을 켜고 끌 수 있어요.",
        "472-weather-outline.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-sun.mp4",
        "햇살 머무는 오후",
        "",
        "471-pc-sun.jpg"
      ],
      [
        "471-pc-stars.mp4",
        "밤의 은하수",
        "",
        "471-pc-stars.jpg"
      ],
      [
        "471-pc-picker.mp4",
        "두 날씨를 함께",
        "",
        "471-pc-picker.jpg"
      ],
      [
        "471-pc-weather-color.mp4",
        "색과 움직임",
        "",
        "471-pc-weather-color.jpg"
      ]
    ]
  },
  {
    "id": "capture",
    "label": "캡처",
    "title": "좋아하는 장면을 간직하는 법.",
    "sub": "미리 보고, 문단을 고르고, 이미지나 영상으로.",
    "cards": [
      [
        "471-capture-quick.mp4",
        "먼저 미리보기",
        "",
        "471-capture-quick.jpg"
      ],
      [
        "471-capture-editor.mp4",
        "남길 문단만 고르기",
        "캡처용 사본만 바꿔요.",
        "471-capture-editor.jpg"
      ],
      [
        "471-capture-format.mp4",
        "이미지 · 영상 · 움짤",
        "PNG · MP4/WebM · GIF · APNG · WebP.",
        "471-capture-format.jpg"
      ],
      [
        "471-capture-info.mp4",
        "본문만, 또는 정보까지",
        "",
        "471-capture-info.jpg"
      ],
      [
        "471-capture-privacy.mp4",
        "공유할 때는 이름 가리고",
        "",
        "471-capture-privacy.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-capture-quick.mp4",
        "미리보기와 설정을 한 화면에",
        "",
        "471-pc-capture-quick.jpg"
      ],
      [
        "471-pc-capture-editor.mp4",
        "문단별로 가볍게 편집",
        "",
        "471-pc-capture-editor.jpg"
      ],
      [
        "471-pc-capture-format.mp4",
        "저장 형식 고르기",
        "",
        "471-pc-capture-format.jpg"
      ],
      [
        "471-pc-capture-info.mp4",
        "담을 정보 고르기",
        "",
        "471-pc-capture-info.jpg"
      ]
    ]
  },
  {
    "id": "tools",
    "label": "도구",
    "title": "필요한 것만, 가까운 곳에.",
    "sub": "스크립트부터 모델 전환까지 테마 안에서.",
    "cards": [
      [
        "472-words.mp4",
        "단어 치환",
        "",
        "472-words.jpg"
      ],
      [
        "472-modelswitch.mp4",
        "모델을 한 번에 바꾸기",
        "",
        "472-modelswitch.jpg"
      ],
      [
        "472-models.mp4",
        "목록에 없는 모델 등록",
        "",
        "472-models.jpg"
      ],
      [
        "472-perf.mp4",
        "성능 보조",
        "",
        "472-perf.jpg"
      ],
      [
        "472-regexlink.mp4",
        "프롬프트와 정규식을 함께",
        "",
        "472-regexlink.jpg"
      ],
      [
        "472-order.mp4",
        "확장 순서 정리",
        "",
        "472-order.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-modelswitch.mp4",
        "여러 확장의 모델을 한 번에",
        "",
        "472-pc-modelswitch.jpg"
      ],
      [
        "472-pc-models.mp4",
        "모델 등록",
        "",
        "472-pc-models.jpg"
      ],
      [
        "472-pc-regexlink.mp4",
        "프롬프트 연동 정규식",
        "",
        "472-pc-regexlink.jpg"
      ]
    ]
  },
  {
    "id": "rewrite",
    "label": "다시 쓰기",
    "title": "마음에 안 드는 문장만, 다시.",
    "sub": "금지 묘사 · 규칙 만들기 · 예외 · 테스트.",
    "cards": [
      [
        "471-rw-rules.mp4",
        "금지 묘사 규칙",
        "",
        "471-rw-rules.jpg"
      ],
      [
        "471-rw-ai.mp4",
        "AI에게 부탁해서 규칙 만들기",
        "",
        "471-rw-ai.jpg"
      ],
      [
        "471-rw-exceptions.mp4",
        "캐릭터별 예외",
        "",
        "471-rw-exceptions.jpg",
        null,
        [
          "예시: 공유봇 천지합동청 ↗",
          "https://kkangtong.xyz/posts/54677"
        ]
      ],
      [
        "471-rw-test.mp4",
        "걸리는 표현 미리 확인하기",
        "",
        "471-rw-test.jpg"
      ],
      [
        "471-rw-connect.mp4",
        "사용할 모델 고르기",
        "",
        "471-rw-connect.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-rw-rules.mp4",
        "규칙 하나씩 살펴보기",
        "",
        "471-pc-rw-rules.jpg"
      ],
      [
        "471-pc-rw-ai.mp4",
        "규칙 만들기도 편하게",
        "",
        "471-pc-rw-ai.jpg"
      ]
    ],
    "guide": true
  },
  {
    "id": "read",
    "label": "읽기",
    "title": "읽는 동안에는, 이야기만.",
    "sub": "북마크 · 빠른 버튼 · 프롬프트 카드 · 한 손 조작.",
    "cards": [
      [
        "472-bookmark-setting.mp4",
        "좋아하는 장면에 북마크",
        "",
        "472-bookmark-setting.jpg"
      ],
      [
        "472-pins-setting.mp4",
        "자주 쓰는 버튼은 가까이",
        "",
        "472-pins-setting.jpg"
      ],
      [
        "472-prompt-tab.mp4",
        "프롬프트 카드도 같은 분위기로",
        "",
        "472-prompt-tab.jpg"
      ],
      [
        "472-qr-setting.mp4",
        "퀵 리플라이 자리와 모양",
        "",
        "472-qr-setting.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-qr-setting.mp4",
        "빠른 답장 설정",
        "",
        "472-pc-qr-setting.jpg"
      ]
    ]
  },
  {
    "id": "settings",
    "label": "설정",
    "title": "꾸미는 시간도 가볍게.",
    "sub": "검색하고, 되돌리고, 내 설정을 보관해요.",
    "cards": [
      [
        "472-changes.mp4",
        "바꾼 것만 모아서",
        "",
        "472-changes.jpg"
      ],
      [
        "471-favorites.mp4",
        "자주 쓰는 설정은 가까이",
        "",
        "471-favorites.jpg"
      ],
      [
        "472-backup.mp4",
        "필요한 프리셋만 공유",
        "형광펜 · 날씨 · 글꼴을 골라 담고, 필요한 것만 불러와요.",
        "472-backup.jpg"
      ],
      [
        "472-css-setting.mp4",
        "다른 CSS와 함께 쓸 때",
        "",
        "472-css-setting.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-backup.mp4",
        "필요한 프리셋만 공유",
        "형광펜 · 날씨 · 글꼴을 골라 담고, 필요한 것만 불러와요.",
        "472-pc-backup.jpg"
      ]
    ]
  }
];
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
// media cache keys: one stable key for everything; a file retaken under the same name gets its own entry here (never bump the stable key)
const RETAKEN={};
const mv=file=>'?v='+(RETAKEN[file]||'s1');

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionAllowed=false;try{motionAllowed=sessionStorage.getItem('bl-site-motion')==='1';}catch{}
const calm=()=>reduceMotion.matches&&!motionAllowed;
document.documentElement.classList.add('js');
const lightbox=$('#lightbox');
const inView=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){if(calm()||target.dataset.userPaused)continue;if(isIntersecting){if(!target.src&&target.dataset.src)target.src=target.dataset.src;target.play().catch(()=>{});}else target.pause();}},{threshold:.35});
function galleryBlock(topic, device, cards, withHeading){
  const block=element('section','gallery-block'), heading=element('div','gallery-heading'), label=element('div'); block.dataset.device=device;
  label.append(element('h3','',topic.title),element('p','',topic.sub));
  heading.append(label);
  const track=element('div','track'); track.tabIndex=0; track.setAttribute('aria-label',topic.title+(device==='pc'?' PC':'')+' 갤러리');
  const arrows=element('div','arrows'), buttons=[];
  for(const [symbol,dir,name] of [['←',-1,'이전'],['→',1,'다음']]){const b=element('button','',symbol);b.setAttribute('aria-label',topic.title+' '+name);b.onclick=()=>track.scrollBy({left:dir*(track.querySelector('.card').offsetWidth+16),behavior:reduceMotion.matches?'instant':'smooth'});arrows.append(b);buttons.push(b);}heading.append(arrows);
  const syncArrows=()=>{buttons[0].disabled=track.scrollLeft<4;buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;};
  track.addEventListener('scroll',syncArrows,{passive:true});addEventListener('resize',syncArrows);block.syncArrows=syncArrows;
  for(const [file,title,description,poster,gif,credit] of cards){
    const card=element('figure','card'), wrap=element('div','media-wrap'), caption=element('figcaption','',title); card.style.setProperty('--i',Math.min(track.children.length,6));
    if(file.startsWith('410-export.')||file.startsWith('420-capture-moving.'))wrap.classList.add('export-media');
    if(file.endsWith('.mp4')){
      const video=element('video');video.preload='none';video.playsInline=true;video.muted=true;video.loop=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.dataset.src='media/'+file+mv(file);video.poster='media/'+poster+mv(poster);video.setAttribute('aria-label',title);
      if(reduceMotion.matches){video.controls=true;video.src=video.dataset.src;}
      else{const state=element('span','play-state','▶');state.setAttribute('aria-hidden','true');wrap.classList.add('paused');
        video.addEventListener('play',()=>wrap.classList.remove('paused'));video.addEventListener('pause',()=>wrap.classList.add('paused'));
        const toggle=()=>{if(!video.src&&video.dataset.src)video.src=video.dataset.src;if(video.paused){delete video.dataset.userPaused;video.play().catch(()=>{});}else{video.dataset.userPaused='1';video.pause();}};
        video.tabIndex=0;video.setAttribute('role','button');video.setAttribute('aria-label',title+' 재생 또는 일시정지');
        video.addEventListener('click',toggle);video.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
        wrap.append(state);inView.observe(video);}
      wrap.prepend(video);
      const enlarge=element('button','gallery-expand','크게 보기 ↗');enlarge.type='button';enlarge.setAttribute('aria-label',title+' 크게 보기');
      enlarge.onclick=()=>{const dialog=$('#atmosphere-lightbox'), player=dialog.querySelector('video');player.poster=video.poster;player.src=video.getAttribute('src')||video.dataset.src;player.setAttribute('aria-label',title);dialog.showModal();player.play().catch(()=>{});};wrap.append(enlarge);
    }else{const img=element('img');img.src='media/'+file+mv(file);img.alt=title;img.loading='lazy';img.decoding='async';img.tabIndex=0;const open=()=>{lightbox.querySelector('img').src=img.src;lightbox.querySelector('img').alt=title;lightbox.querySelector('p').textContent=title;lightbox.showModal();};img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open();}};wrap.append(img);}
    caption.append(element('small','',description));if(credit){const c=element('a','gif-link',credit[0]);c.href=credit[1];c.target='_blank';c.rel='noopener';caption.append(c);}if(gif){const a=element('a','gif-link','움짤로 보기 ↗');a.href='media/'+gif+mv(gif);a.target='_blank';a.rel='noopener';caption.append(a);}card.append(wrap,caption);track.append(card);
  }block.append(heading,track);return block;
}
// Topic tabs: a topic's cards are built the first time it is opened, so the page starts with one topic's media instead of all of them
{
  const host=$('#galleries'), tabs=element('div','topic-tabs'), panels=new Map();tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','둘러볼 주제');
  const show=(id,focus)=>{
    for(const b of tabs.children){const on=b.dataset.topic===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();
      if(on&&tabs.scrollWidth>tabs.clientWidth)tabs.scrollTo({left:b.offsetLeft-(tabs.clientWidth-b.offsetWidth)/2,behavior:reduceMotion.matches?'instant':'smooth'});}
    let panel=panels.get(id);
    if(!panel){const topic=topics.find(t=>t.id===id);panel=element('div','topic-panel');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','topic-tab-'+id);
      if(topic.pc)panel.append(galleryBlock(topic,'pc',topic.pc,true));
      const phone=galleryBlock(topic,'mobile',topic.cards,true);if(topic.tall)phone.classList.add('tall-media');if(topic.guide){const g=document.querySelector('#rewrite-guide');if(g){g.hidden=false;phone.querySelector('.gallery-heading').after(g);}}if(topic.pc){phone.classList.add('after-pc');phone.querySelector('.gallery-heading>div').append(element('p','gallery-device','모바일 화면'));}panel.append(phone);panels.set(id,panel);host.append(panel);}
    for(const [key,p] of panels){p.hidden=key!==id;if(key!==id)for(const b of p.children)b.classList.remove('in');}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const b of panel.children){b.classList.add('in');b.syncArrows();}}));
    try{sessionStorage.setItem('bl-site-topic',id);}catch{}
  };
  for(const topic of topics){const b=element('button','',topic.label);b.type='button';b.id='topic-tab-'+topic.id;b.dataset.topic=topic.id;b.setAttribute('role','tab');b.append(element('span','',String(topic.cards.length+(topic.pc?topic.pc.length:0))));if(topic.fresh){b.classList.add('fresh-topic');b.setAttribute('aria-label',topic.label+' (새 기능 있음)');}b.onclick=()=>show(topic.id);tabs.append(b);}
  tabs.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const list=[...tabs.children],i=list.findIndex(b=>b.getAttribute('aria-selected')==='true');show(list[(i+d+list.length)%list.length].dataset.topic,true);});
  host.before(tabs);
  for(const link of document.querySelectorAll('a[data-topic]'))link.addEventListener('click',()=>show(link.dataset.topic));
  let first=topics[0].id;try{const saved=sessionStorage.getItem('bl-site-topic');if(topics.some(t=>t.id===saved))first=saved;}catch{}
  show(first);
}
{const big=lightbox.querySelector('img');big.addEventListener('load',()=>{lightbox.classList.toggle('tall',big.naturalHeight>big.naturalWidth*1.9);lightbox.scrollTop=0;});}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
const SHOWN_NOTES=3;
fetch('release-notes.json').then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();
  // one card per day, like the theme's own notice: a busy day reads as "v4.1.2 ~ v4.2.4 · 업데이트 13번"
  const days=[];for(const note of notes){const last=days.at(-1);if(last&&last.date===note.date)last.notes.push(note);else days.push({date:note.date,notes:[note]});}
  days.forEach((day,i)=>{const d=element('details','note');d.open=i===0;d.hidden=i>=SHOWN_NOTES;const s=element('summary'),first=day.notes.at(-1).version,latest=day.notes[0].version;
    s.append(element('span','num',latest));if(i===0)s.append(element('span','tag','NEW'));
    if(day.notes.length>1)s.append(element('span','span',`v${first} ~ v${latest} · 업데이트 ${day.notes.length}번`));
    s.append(element('span','date',day.date.replaceAll('-','.')),element('span','plus','+'));d.append(s);
    day.notes.forEach(note=>{if(day.notes.length>1)d.append(element('h4','ver','v'+note.version));const ul=element('ul');note.items.forEach((t,k)=>{const li=element('li','',t);li.style.setProperty('--i',Math.min(k,10));ul.append(li);});d.append(ul);});
    $('#notes').append(d);});
  if(days.length>SHOWN_NOTES){const more=element('button','notes-more',`이전 날짜 ${days.length-SHOWN_NOTES}일 더 보기`);more.type='button';more.onclick=()=>{document.querySelectorAll('.note[hidden]').forEach((n,k)=>{n.hidden=false;n.classList.add('appear');n.style.setProperty('--i',Math.min(k,12));});more.remove();};$('#notes').after(more);}
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
document.querySelectorAll('.fresh-item').forEach((el,i)=>el.style.setProperty('--i',i));
document.querySelectorAll('.fresh,.section-head,.palette-layout,.reading-layout,.gallery-block,.feature-search,.notice-guide,#notes,.install-inner>*').forEach(el=>{el.classList.add('reveal');reveal.observe(el);});

// which device the visitor mostly uses: picked in the hero, remembered, defaults to the screen they are on
(() => {
  const html = document.documentElement, pcReady = topics.some(t => t.pc);
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
  const start = v => { if (!v.src && v.dataset.src) { if (v.dataset.poster) v.poster = v.dataset.poster; v.src = v.dataset.src; } v.muted = true; const p = v.play(); if (p) p.catch(() => { if (!motionAllowed) motionNote('blocked'); }); };
  // a quiet line under the hero when videos are held back, with one button to play them anyway
  function motionNote(why) { let n = document.querySelector('.motion-note'); if (!n) { n = document.createElement('p'); n.className = 'motion-note'; const t = document.createElement('span'), b = document.createElement('button'); b.type = 'button'; b.textContent = '영상 재생'; b.onclick = () => { motionAllowed = true; try { sessionStorage.setItem('bl-site-motion', '1'); } catch {} n.remove(); sync(); for (const v of document.querySelectorAll('.topic-panel:not([hidden]) video')) { const r = v.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); } } }; n.append(t, b); (document.querySelector('.device-pick') || art).after(n); } n.firstChild.textContent = why === 'blocked' ? '절전 모드 등으로 자동 재생이 막혀 있어요.' : '기기의 ‘애니메이션 줄이기’가 켜져 있어 영상을 멈춰 뒀어요.'; }
  const sync = () => { const on = !document.hidden && !calm() && !art.classList.contains('idle'); for (const v of vids) { if (shown(v) && on) start(v); else v.pause(); } };
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(art, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', () => { if (calm()) motionNote('reduce'); else document.querySelector('.motion-note')?.remove(); sync(); });
  if (calm()) motionNote('reduce');
  sync();
})();
