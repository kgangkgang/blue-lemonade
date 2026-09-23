/* Site-only atmosphere and curated profile examples. No theme settings are changed. */
(() => {
  'use strict';
  const root = document.documentElement;
  const scene = document.querySelector('.weather-scene');
  const video = document.querySelector('#scene-video');
  const play = document.querySelector('.scene-play');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const narrow = matchMedia('(max-width: 760px)');
  const looks = {
    clear: {title:'문장과 여백만.',description:'장식 없이도 편안한 대화 화면.',file:'calm-look-clear',detail:'날씨 효과 끔',number:'01 / CLEAR'},
    rain: {title:'조용히 내리는 비.',description:'작고 가는 빗줄기가 배경을 지나가요.',file:'calm-look-rain',detail:'비 · 약하게',number:'02 / RAIN'},
    snow: {title:'작은 눈이 천천히.',description:'동그란 눈송이만 가볍게 흩날려요.',file:'calm-look-snow',detail:'눈 · 약하게',number:'03 / SNOW'}
  };
  let visible = false, manuallyPaused = false, manualWeather = false;
  const sync = () => {
    const run = visible && !document.hidden && !manuallyPaused && !reduced.matches;
    scene.classList.toggle('is-idle', !run);
    if (!run) { video.pause(); return; }
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.play().catch(() => { play.textContent = '영상 재생'; play.setAttribute('aria-label', '날씨 시연 영상 재생'); });
  };
  video.addEventListener('play', () => {play.textContent = '일시정지'; play.setAttribute('aria-label', '날씨 시연 영상 일시정지');});
  video.addEventListener('pause', () => {play.textContent = '영상 재생'; play.setAttribute('aria-label', '날씨 시연 영상 재생');});
  video.addEventListener('error', () => {play.textContent = '다시 재생';});
  function choose(key) {
    const look = looks[key]; if (!look) return;
    scene.dataset.weather = key;
    document.querySelectorAll('[data-weather-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.weatherPick === key)));
    document.querySelector('.scene-title').textContent = look.title;
    document.querySelector('.scene-description').textContent = look.description;
    document.querySelector('.scene-number').textContent = look.number;
    document.querySelector('.scene-detail').textContent = look.detail;
    video.pause(); video.removeAttribute('src');
    const file = narrow.matches ? look.file : look.file.replace('-look-', '-pc-');
    video.poster = `media/${file}.jpg`;
    video.dataset.src = `media/${file}.mp4`;
    video.setAttribute('aria-label', `${look.detail} 실제 테마 시연`);
    video.load(); sync();
  }
  document.querySelectorAll('[data-weather-pick]').forEach(b => b.addEventListener('click', () => {manualWeather = true; choose(b.dataset.weatherPick);}));
  play.addEventListener('click', () => {
    if (!video.paused) {manuallyPaused = true; video.pause(); return;}
    manuallyPaused = false;
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.play().catch(() => {play.textContent = '다시 재생';});
  });
  const initialLook = () => 'clear';
  choose(initialLook());
  document.addEventListener('bl-theme', () => {if (!manualWeather) choose(initialLook());});
  systemDark.addEventListener('change', () => {if (!manualWeather) choose(initialLook());});
  narrow.addEventListener('change', () => choose(scene.dataset.weather || initialLook()));
  new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; sync();}, {threshold: .08}).observe(scene);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  const profileImage = document.querySelector('#portrait-image');
  const profileCaption = document.querySelector('#portrait-caption');
  let portraitVisible = false;
  const syncPortrait = () => {
    if (!portraitVisible || document.hidden || reduced.matches) {profileImage.pause(); return;}
    if (!profileImage.getAttribute('src')) profileImage.src = profileImage.dataset.src;
    profileImage.play().catch(() => {});
  };
  new IntersectionObserver(([entry]) => {portraitVisible = entry.isIntersecting; syncPortrait();}, {threshold:.1}).observe(profileImage);
  document.addEventListener('visibilitychange', syncPortrait);
  reduced.addEventListener('change', syncPortrait);
  profileImage.tabIndex = 0;
  profileImage.setAttribute('role', 'button');
  profileImage.setAttribute('aria-label', '프로필 예시 크게 보기');
  const motionDialog = document.querySelector('#atmosphere-lightbox'), expanded = motionDialog.querySelector('video');
  function expand(source) {expanded.poster = source.poster; expanded.src = source.getAttribute('src') || source.dataset.src; motionDialog.showModal(); expanded.play().catch(() => {});}
  function enlargeProfile() {expand(profileImage);}
  document.querySelector('.scene-expand').addEventListener('click', () => expand(video));
  motionDialog.querySelector('button').addEventListener('click', () => motionDialog.close());
  motionDialog.addEventListener('close', () => {expanded.pause(); expanded.removeAttribute('src'); expanded.load();});
  motionDialog.addEventListener('click', event => {if (event.target === motionDialog) motionDialog.close();});
  profileImage.addEventListener('click', enlargeProfile);
  profileImage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); enlargeProfile();}
  });
  const heroVideo = document.querySelector('#mix-hero'), heroPlay = document.querySelector('#hero-play');
  const heroCaption = document.querySelector('#hero-caption');
  const heroLooks = ['블루 × 민트 · 가볍게 읽기', '피치 × 딸기 · 단정하게 모으기', '라벤더 × 블루 · 굵고 또렷하게', '민트 × 멜론 · 여백을 넉넉하게'];
  function syncHeroCaption(){heroCaption.textContent=heroLooks[Math.floor((heroVideo.currentTime+.08)/4.2)%4];}
  heroVideo.addEventListener('timeupdate',syncHeroCaption);
  let heroVisible=false,heroPaused=false,heroConsent=false;
  function syncHero(){if(heroVisible&&!document.hidden&&!heroPaused&&(!reduced.matches||heroConsent)){if(!heroVideo.getAttribute('src'))heroVideo.src=heroVideo.dataset.src;heroVideo.play().catch(()=>{});}else heroVideo.pause();}
  function heroSource(){const file=narrow.matches?'hybrid-mobile':'hybrid-pc';heroVideo.pause();heroVideo.removeAttribute('src');heroVideo.poster=`media/${file}.jpg`;heroVideo.dataset.src=`media/${file}.mp4`;heroVideo.load();heroCaption.textContent=heroLooks[0];syncHero();}
  heroPlay.addEventListener('click',()=>{heroPaused=!heroVideo.paused;heroConsent=true;syncHero();});
  heroVideo.addEventListener('play',()=>{heroPlay.textContent='일시정지';heroPlay.setAttribute('aria-label','색·글자·여백 시연 일시정지');});
  heroVideo.addEventListener('pause',()=>{heroPlay.textContent='영상 재생';heroPlay.setAttribute('aria-label','색·글자·여백 시연 재생');});
  new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;syncHero();}).observe(heroVideo);
  document.addEventListener('visibilitychange',syncHero);reduced.addEventListener('change',syncHero);narrow.addEventListener('change',heroSource);heroSource();
  const profiles = {
    large: ['calm-profile-large.jpg', '상단 큰 프로필 · PC에서 사진을 이야기의 첫 장면처럼.'],
    small: ['calm-profile-small.jpg', '작은 프로필 · 익숙한 얼굴과 가볍게 주고받는 대화.'],
    none: ['calm-profile-none.jpg', '프로필 없이 · 문장과 여백에만 집중하는 화면.']
  };
  document.querySelectorAll('[data-profile-pick]').forEach(button => button.addEventListener('click', () => {
    const [file, caption] = profiles[button.dataset.profilePick];
    document.querySelectorAll('[data-profile-pick]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    profileImage.pause(); profileImage.removeAttribute('src'); profileImage.poster = `media/${file}`;
    profileImage.dataset.src = `media/${file.replace('.jpg', '.mp4')}`;
    profileImage.setAttribute('aria-label', caption); profileCaption.textContent = caption; profileImage.load(); syncPortrait();
  }));
})();
