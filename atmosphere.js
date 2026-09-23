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
    sun: {title: '햇살이 머무는\n문장 사이.', description: '부드러운 구름과 따뜻한 볕.\n평범한 대화도 느긋한 오후처럼.', file: '471-look-sun', detail: '안개 · 구름 띠  +  햇살 · 따뜻한 빛', number: '01 / SUNLIT AFTERNOON'},
    rain: {title: '빗소리가 들릴 듯,\n조용한 이야기.', description: '창에 맺힌 작은 빗방울.\n흐린 날에는 조금 더 가까이.', file: '471-look-rain', detail: '유리 빗방울  +  옅은 안개', number: '02 / RAIN ON THE WINDOW'},
    stars: {title: '잠들기 아까운\n푸른 밤.', description: '은하수 위로 천천히 흐르는 유성.\n끝내고 싶지 않은 대화의 배경.', file: '471-look-stars', detail: '별 · 은하수  +  둥글게 도는 유성', number: '03 / UNDER THE STARS'}
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
    root.dataset.weather = key;
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
  const initialLook = () => (root.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark' ? 'stars' : 'sun';
  choose(initialLook());
  document.addEventListener('bl-theme', () => {if (!manualWeather) choose(initialLook());});
  systemDark.addEventListener('change', () => {if (!manualWeather) choose(initialLook());});
  narrow.addEventListener('change', () => choose(root.dataset.weather || initialLook()));
  new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; sync();}, {threshold: .08}).observe(scene);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  for (const host of document.querySelectorAll('.weather-particles')) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('i');
      p.style.cssText = `--x:${(i * 37 + 7) % 100}%;--y:${(i * 19 + 11) % 100}%;--size:${1 + i % 3}px;--delay:-${i * .47}s;--time:${5 + i % 6}s`;
      fragment.append(p);
    }
    host.append(fragment);
  }
  const hero = document.querySelector('.hero');
  let heroVisible = true;
  const syncHero = () => hero.classList.toggle('is-idle', !heroVisible || document.hidden);
  new IntersectionObserver(([entry]) => {heroVisible = entry.isIntersecting; syncHero();}).observe(hero);
  document.addEventListener('visibilitychange', syncHero);
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
  const profiles = {
    large: ['471-profile-large.jpg', '상단 큰 프로필 · PC에서 사진을 이야기의 첫 장면처럼.'],
    small: ['471-profile-small.jpg', '작은 프로필 · 익숙한 얼굴과 가볍게 주고받는 대화.'],
    none: ['471-profile-none.jpg', '프로필 없이 · 문장과 여백에만 집중하는 화면.']
  };
  document.querySelectorAll('[data-profile-pick]').forEach(button => button.addEventListener('click', () => {
    const [file, caption] = profiles[button.dataset.profilePick];
    document.querySelectorAll('[data-profile-pick]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    profileImage.pause(); profileImage.removeAttribute('src'); profileImage.poster = `media/${file}`;
    profileImage.dataset.src = `media/${file.replace('.jpg', '.mp4')}`;
    profileImage.setAttribute('aria-label', caption); profileCaption.textContent = caption; profileImage.load(); syncPortrait();
  }));
})();
