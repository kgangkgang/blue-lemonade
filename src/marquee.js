// 긴 이름 흘려 보기: 한 줄에 안 들어가 말줄임된 이름을 누르면 옆으로 흘러서 끝까지 보여 주고 돌아옴.
// 대상: 헬퍼 스크립트 줄 이름, 정규식 줄 이름. 이름 칸은 헬퍼(Vue) · 실리태번이 그리는 칸이라
// 감싸는 칸을 끼우지 않고 그 칸의 scrollLeft 를 움직인다.
// CSS 애니메이션은 쓰지 않음 — 실리태번의 '움직임 줄이기'(body.reduced-motion)와 !important 규칙에 막혀 안 움직였다.
// 프롬프트 관리자 줄 이름은 뺀다 (2.0.7): 이름이 <a> 라 누르면 살펴보기 창이 열려야 하는데, 흘려 보기가 그 클릭을 먹어 화면이 안 넘어갔다 (사용자)
const NAME_SEL = [
    '.TH-custom-tailwind [data-type="script"] > .grow', // 헬퍼 스크립트 (한 줄 · 말줄임은 style.css)
    '.regex-script-label > .regex_script_name', // 정규식 목록 (편집 창의 같은 이름 입력칸은 제외)
].join(', ');
const CLASS = 'salty-marquee'; // 흐르는 동안 말줄임(…) 끄기
const SPEED = 45; // 흘러가는 빠르기 (px/초)
const STYLE_ID = 'salty-marquee-style';
// 정규식 이름은 실리태번이 여러 줄로 줄 바꿈해서 보여 줌 → 한 줄 + 말줄임. 이 모듈만으로 켜고 끄게 여기서 넣는다.
const STYLE = `
body.salty .regex-script-label > .regex_script_name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  scroll-behavior: auto;
  cursor: pointer;
}
body.salty .regex-script-label > .regex_script_name.${CLASS} {
  text-overflow: clip;
}
body.salty #completion_prompt_manager #completion_prompt_manager_list .completion_prompt_manager_prompt_name > .${CLASS}.${CLASS} { /* 클래스 두 번 = style.css 의 말줄임 규칙(a 태그 포함)보다 무겁게 */
  text-overflow: clip;
}
@media (prefers-reduced-motion: reduce) {
  body.salty .regex-script-label > .regex_script_name.${CLASS},
  body.salty #completion_prompt_manager #completion_prompt_manager_list .completion_prompt_manager_prompt_name > .${CLASS}.${CLASS} {
    white-space: normal;
  }
}`;
const running = new WeakMap(); // 이름 칸 → requestAnimationFrame 번호

const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function stop(name) {
    const id = running.get(name);
    if (id) cancelAnimationFrame(id);
    running.delete(name);
}

function finish(name) {
    stop(name);
    name.scrollLeft = 0;
    name.classList.remove(CLASS);
}

function play(ev) {
    if (!document.body.classList.contains('salty')) return;
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const name = target.closest(NAME_SEL);
    if (!name) return;
    const shift = name.scrollWidth - name.clientWidth;
    if (shift <= 1) return; // 다 보이는 이름은 그대로
    // 기기의 '움직임 줄이기'면 흘리지 않고, 누를 때마다 이름 전체를 펼치거나 접음
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        name.classList.toggle(CLASS);
        return;
    }
    finish(name); // 흐르는 중에 다시 누르면 처음부터
    name.classList.add(CLASS);
    const move = Math.min(6000, Math.max(900, (shift / SPEED) * 1000));
    // [시간(ms), 시작 위치, 끝 위치]: 잠깐 멈춤 → 끝까지 → 끝에서 멈춤 → 돌아옴
    const steps = [[400, 0, 0], [move, 0, shift], [900, shift, shift], [move * 0.6, shift, 0]];
    let index = 0;
    let start = performance.now();
    const tick = (now) => {
        if (!name.isConnected) { running.delete(name); return; }
        const [duration, from, to] = steps[index];
        const t = Math.min(1, (now - start) / duration);
        name.scrollLeft = from + (to - from) * ease(t);
        if (t >= 1) {
            index++;
            start = now;
            if (index >= steps.length) { finish(name); return; }
        }
        running.set(name, requestAnimationFrame(tick));
    };
    running.set(name, requestAnimationFrame(tick));
}

export function startNameMarquee() {
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLE;
        document.head.append(style);
    }
    document.addEventListener('click', play, true); // capture: 프롬프트 이름 <a> 의 살펴보기 클릭보다 먼저 받는다
}
