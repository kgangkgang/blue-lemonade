// 반응 글꾸 4종(11-09) — 누르면 반응하는 틈 템플릿: 봉투 열기 · 초대장 · 쪽 넘기기 · 통통 카드.
//   테마 내장(tools/mart/build-builtin.mjs → src/log-copy-builtin.gen.js, 분류 「반응」)과 글꾸 마트(사이트 tools/geulkku-react.mjs)가 같이 써요.
//   받은 글꾸와 같은 규칙(src/log-copy-template.js checkTemplate)만 써요: 인라인 style · details/summary · data-bl-egg · bl- 키프레임.
//   봉투 · 초대장은 펼친 채로 시작해요(다른 눌러 접는 틀과 같아요 — 미리보기에서 로그가 바로 보여요). 겉면을 누르면 닫히고 다시 누르면 열려요.
//   열린 모습(열린 봉투 · 열린 문)은 details 안 첫 칸을 겉면 위에 겹쳐(margin-top 음수 · pointer-events:none) 그려요 — 눌림은 아래 겉면으로 가요.
//   커뮤니티 글에 바로 붙이는 사진 틀(체크박스 · 사진 6장 · n/6)은 따로 있어요: 작업 허브 outputs/지시-1109/반응글꾸/반응글꾸-*.html
const SANS = "font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const SERIF = "font-family:'Noto Serif KR','AppleMyungjo','Nanum Myeongjo',Batang,Georgia,serif";
const MONO = "font-family:ui-monospace,'SFMono-Regular','Cascadia Mono',Menlo,Consolas,monospace";
const deco = (style, inner = '', egg = '') => `<span aria-hidden="true"${egg ? ` data-bl-egg="${egg}"` : ''} style="${style}">${inner}</span>`;
const abs = (l, t, w, h) => `position:absolute;left:${l};top:${t};width:${w};height:${h};display:block`;
const RISE = (delay = '0s', from = '18px') => `animation:bl-s-rise .9s cubic-bezier(.3,.7,.2,1) ${delay} both;--bl-from:${from};--bl-to:0px`;

// ① 봉투 열기 — 겉면: 덮개를 닫은 봉투 · 붉은 봉랍(누르면 통) / 열면: 덮개가 젖혀진 봉투에서 편지가 올라오고 아래로 로그 편지가 나와요
const FOLD = 'linear-gradient(to bottom right,transparent calc(50% - 1px),rgba(165,131,84,.32) 50%,#f3e6cc calc(50% + .5px)) 0 100%/50% 50% no-repeat,linear-gradient(to bottom left,transparent calc(50% - 1px),rgba(165,131,84,.32) 50%,#f3e6cc calc(50% + .5px)) 100% 100%/50% 50% no-repeat';
const envelope = `<div style="${SANS};box-sizing:border-box;max-width:480px;margin:0 auto;padding:18px 16px 16px;background-color:#efe4d0;border-radius:14px">`
    + '<details open="" style="display:block;margin:0">'
    + `<summary style="list-style:none;display:block;cursor:pointer;outline:none;position:relative;margin:0;padding:60% 0 0;border-radius:8px;overflow:hidden;background:linear-gradient(160deg,#ead7b5,#e2cba4);box-shadow:0 10px 22px rgba(90,62,34,.24),0 1px 3px rgba(90,62,34,.2)">`
    + deco(`${abs('0', '0', '100%', '100%')};background:${FOLD}`)
    + deco(`${abs('0', '2%', '100%', '58%')};clip-path:polygon(0 0,100% 0,53% 96%,50% 100%,47% 96%);background-color:rgba(107,74,42,.16)`)
    + deco(`${abs('0', '0', '100%', '58%')};clip-path:polygon(0 0,100% 0,53% 96%,50% 100%,47% 96%);background:linear-gradient(#f1e2c6,#e6d0aa)`)
    + `<span style="position:absolute;left:0;right:0;bottom:9%;display:block;text-align:center;${SERIF};font-size:15px;font-weight:600;letter-spacing:.1em;line-height:1.4;color:#7a5634">To.</span>`
    + deco(`position:absolute;left:50%;top:58%;display:block;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:48% 52% 50% 46%/50% 46% 54% 50%;background:radial-gradient(circle at 34% 30%,#ff8a92,#e63946 46%,#a3202c);box-shadow:inset 0 0 0 6px rgba(255,255,255,.16),inset 0 -3px 6px rgba(0,0,0,.24),0 4px 10px rgba(90,26,32,.35);color:#ffe9ea;font-size:19px;line-height:54px;text-align:center`, '✦', 'bounce')
    + '</summary>'
    // 열린 봉투(겉면 위에 겹침 · 눌림은 겉면으로)
    + `<div aria-hidden="true" style="position:relative;display:block;margin:-60% 0 0;padding:60% 0 0;pointer-events:none;border-radius:8px;overflow:hidden;background-color:#efe4d0">`
    + deco(`${abs('0', '6%', '100%', '36%')};clip-path:polygon(0 100%,47% 4%,50% 0,53% 4%,100% 100%);background:linear-gradient(#d9c39c,#cdb48b)`)
    + deco(`${abs('0', '40%', '100%', '60%')};border-radius:0 0 8px 8px;background:linear-gradient(#c3a77c,#d8c098);box-shadow:0 10px 22px rgba(90,62,34,.22)`)
    + deco(`${abs('10%', '16%', '80%', '74%')};border-radius:3px;background:repeating-linear-gradient(#fffdf7 0 17px,#efe3cf 17px 18px) 0 36px/100% calc(100% - 52px) no-repeat,#fffdf7;box-shadow:0 0 0 1px #eadcc4,0 4px 12px rgba(90,62,34,.18);${RISE('.05s', '46px')}`)
    + deco(`${abs('0', '40%', '100%', '60%')};border-radius:0 0 8px 8px;clip-path:polygon(0 0,50% 46%,100% 0,100% 100%,0 100%);background:${FOLD},linear-gradient(160deg,#ead7b5,#e2cba4)`)
    + deco(`${abs('calc(50% - 15px)', '64%', '30px', '30px')};border-radius:50%;background:radial-gradient(circle at 34% 30%,#ff8a92,#e63946 46%,#a3202c);opacity:.9;clip-path:polygon(0 0,46% 0,58% 48%,40% 100%,0 100%)`)
    + '</div>'
    // 로그 편지
    + `<div style="position:relative;margin:-10px 6px 0;padding:24px 18px 16px;background-color:#fffdf7;border-radius:3px;box-shadow:0 0 0 1px #eadcc4,inset 0 0 0 6px #fffdf7,inset 0 0 0 7px #ecd9bb,0 12px 26px rgba(90,62,34,.2);${RISE('.2s', '-26px')}">`
    + `<div style="text-align:left">{{head}}</div><div style="margin-top:14px">{{body}}</div>{{info}}<div style="margin-top:10px;text-align:right;color:#776a5c;font-size:12px;line-height:1.6">{{tail}}</div>`
    + '</div></details></div>';

// ② 초대장 — 겉면: 남색 두 문 · 금빛 테 · INVITATION · 금 봉인(누르면 반짝) / 열면: 문이 양옆으로 젖혀지고 금빛 · 별이 반짝이며 아래로 초대장 본문
const DOOR = 'repeating-linear-gradient(45deg,rgba(240,216,120,.06) 0 1px,transparent 1px 16px),repeating-linear-gradient(-45deg,rgba(240,216,120,.06) 0 1px,transparent 1px 16px),linear-gradient(165deg,#283157,#171d39 70%)';
const invitation = `<div style="${SANS};box-sizing:border-box;max-width:460px;margin:0 auto;padding:16px;background-color:#141a33;border-radius:14px">`
    + '<details open="" style="display:block;margin:0">'
    + `<summary style="list-style:none;display:block;cursor:pointer;outline:none;position:relative;margin:0;padding:62% 0 0;border-radius:6px;overflow:hidden;background:${DOOR};box-shadow:0 0 0 1px rgba(240,216,120,.4),0 14px 30px rgba(0,0,0,.4)">`
    + deco(`${abs('14px', '14px', 'calc(50% - 14px)', 'calc(100% - 28px)')};box-sizing:border-box;border:1px solid rgba(240,216,120,.6);border-right:0;border-radius:3px 0 0 3px;box-shadow:inset 0 0 0 4px #1d2442,inset 0 0 0 5px rgba(240,216,120,.3)`)
    + deco(`${abs('50%', '14px', 'calc(50% - 14px)', 'calc(100% - 28px)')};box-sizing:border-box;border:1px solid rgba(240,216,120,.6);border-left:0;border-radius:0 3px 3px 0;box-shadow:inset 0 0 0 4px #1d2442,inset 0 0 0 5px rgba(240,216,120,.3)`)
    + deco(`${abs('calc(50% - 1px)', '0', '2px', '100%')};background:linear-gradient(rgba(240,216,120,.15),rgba(240,216,120,.55),rgba(240,216,120,.15))`)
    + `<span style="position:absolute;left:0;right:0;top:22%;display:block;text-align:center;font-size:11px;font-weight:600;letter-spacing:.42em;text-indent:.42em;line-height:1;color:#f0d878">INVITATION</span>`
    + deco(`position:absolute;left:50%;top:56%;display:block;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff6c8,#f0d878 42%,#b8963a);box-shadow:inset 0 0 0 5px rgba(255,248,216,.45),0 0 0 6px rgba(240,216,120,.12),0 6px 16px rgba(0,0,0,.45);color:#1d2442;font-size:24px;line-height:70px;text-align:center`, '✦', 'glow')
    + '</summary>'
    + `<div aria-hidden="true" style="position:relative;display:block;margin:-62% 0 0;padding:62% 0 0;pointer-events:none;border-radius:6px;overflow:hidden;background:radial-gradient(ellipse 60% 70% at 50% 55%,rgba(255,231,150,.55),rgba(240,216,120,.12) 55%,transparent 75%),linear-gradient(#1b2244,#10152b)">`
    + deco(`${abs('0', '0', '15%', '100%')};clip-path:polygon(0 0,100% 9%,100% 91%,0 100%);background:${DOOR};box-shadow:inset -2px 0 0 rgba(240,216,120,.55)`)
    + deco(`${abs('85%', '0', '15%', '100%')};clip-path:polygon(0 9%,100% 0,100% 100%,0 91%);background:${DOOR};box-shadow:inset 2px 0 0 rgba(240,216,120,.55)`)
    + deco(`position:absolute;left:50%;top:50%;display:block;width:60px;height:60px;margin:-30px 0 0 -30px;color:#fff3c0;font-size:46px;line-height:60px;text-align:center;text-shadow:0 0 18px rgba(255,226,140,.9);animation:bl-twinkle 2.6s ease-in-out infinite`, '✦')
    + [['30%', '28%', '14px', '0s'], ['66%', '24%', '11px', '.7s'], ['24%', '70%', '10px', '1.3s'], ['72%', '68%', '15px', '.4s'], ['48%', '18%', '9px', '1.8s']].map(([l, t, s, d]) => deco(`position:absolute;left:${l};top:${t};display:block;color:#f6e3a0;font-size:${s};line-height:1;animation:bl-twinkle 2.2s ease-in-out ${d} infinite`, '✦')).join('')
    + '</div>'
    + `<div style="position:relative;margin:-8px 4% 0;padding:26px 20px 18px;background-color:#fbf6ea;border-radius:0 0 6px 6px;box-shadow:inset 0 0 0 1px #d9c48a,inset 0 0 0 6px #fbf6ea,inset 0 0 0 7px #e2cf98,0 14px 30px rgba(0,0,0,.35);${RISE('.25s', '-22px')}">`
    + `<div aria-hidden="true" style="text-align:center;font-size:12px;letter-spacing:.5em;text-indent:.5em;line-height:1;color:#b8963a;margin:0 0 14px">✦ ✦ ✦</div>`
    + `<div style="text-align:center">{{head}}</div><div style="margin-top:16px">{{body}}</div>{{info}}<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2cf98;text-align:center;color:#6b6a70;font-size:12px;line-height:1.6">{{tail}}</div>`
    + '</div></details></div>';

// ③ 쪽 넘기기 — 세 쪽(표지 · 로그 · 맺음)을 옆으로 넘겨요(폰 손가락 · PC Shift+휠 · 아래 얇은 스크롤바) · 쪽마다 「n / 3」 · 모서리 귀(누르면 들썩)
const PAGE = n => `flex:0 0 100%;box-sizing:border-box;min-width:0;scroll-snap-align:start;scroll-snap-stop:always;position:relative;display:flex;flex-direction:column;padding:22px 18px 14px 26px;border-radius:3px 12px 12px 3px;background:linear-gradient(to right,rgba(43,58,78,.14),rgba(43,58,78,.04) 12px,transparent 28px),linear-gradient(#fdfbf6,#f8f4ea);box-shadow:inset 0 0 0 1px #e3dccd${n === 1 ? ';justify-content:center;min-height:300px' : ''}`;
const FOOT = n => `<div style="margin-top:auto;padding-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;${MONO};font-size:12px;line-height:1;color:#66768a">${deco('display:inline-block;width:18px;height:1px;background-color:#c9d3df')}<span><b style="color:#2f5f8f">${n}</b> / 3</span>${deco('display:inline-block;width:18px;height:1px;background-color:#c9d3df')}</div>`;
const EAR = deco('position:absolute;right:0;top:0;display:block;width:22px;height:22px;border-radius:0 12px 0 0;background:linear-gradient(225deg,#e9eef4 50%,#dfe5ec 50%,#f3efe6);box-shadow:-1px 1px 2px rgba(43,58,78,.15)', '', 'flip');
const pages = `<div style="${SANS};box-sizing:border-box;max-width:500px;margin:0 auto;padding:16px 16px 12px;background-color:#e9eef4;border-radius:14px">`
    + `<div style="display:flex;gap:14px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:#9fb6cf transparent;padding:0 2px 10px;border-radius:3px 12px 12px 3px">`
    + `<div style="${PAGE(1)}">${EAR}<div aria-hidden="true" style="text-align:center;color:#79a9d8;font-size:13px;letter-spacing:.5em;text-indent:.5em;line-height:1;margin-bottom:18px">✦ ✦ ✦</div><div style="text-align:center">{{head}}</div><div aria-hidden="true" style="margin:20px auto 0;width:44px;height:2px;border-radius:2px;background-color:#79a9d8"></div><div style="margin-top:22px;text-align:center;color:#66768a;font-size:12px;line-height:1.6">넘겨요 ›</div>${FOOT(1)}</div>`
    + `<div style="${PAGE(2)}">${EAR}<div>{{body}}</div>${FOOT(2)}</div>`
    + `<div style="${PAGE(3)}">${EAR}<div>{{info}}</div><div style="margin-top:14px;text-align:center;color:#66768a;font-size:12.5px;line-height:1.7">{{tail}}</div>${FOOT(3)}</div>`
    + '</div></div>';

// ④ 통통 카드 — 맨 위 캐릭터 색 카드 여섯 장(누르면 통 · 반짝 · 흔들 · 빙글 · 뒤집 · 쑥)과 아래 로그 카드
const CARDS = [['#79A9D8', '♥', 'bounce'], ['#f0d878', '✦', 'glow'], ['#3aa7ff', '♪', 'wiggle'], ['#ff5a3c', '★', 'spin'], ['#b799e8', '☾', 'flip'], ['#ffa04a', '✿', 'grow']];
const card = ([c, ch, egg], i) => deco(`position:relative;display:block;aspect-ratio:3/4;border-radius:10px;background:linear-gradient(160deg,${c},${c} 55%,rgba(255,255,255,.55) 56%,${c} 57%);box-shadow:0 0 0 3px #fff,0 6px 14px rgba(59,47,90,.18);transform:rotate(${[-4, 3, -2, 4, -3, 2][i]}deg);color:#fff;font-size:20px;line-height:1;text-align:center;text-shadow:0 1px 3px rgba(29,31,39,.35)`, `<span style="position:absolute;left:0;right:0;top:50%;margin-top:-10px;display:block">${ch}</span><span style="position:absolute;right:6px;top:5px;display:block;${MONO};font-size:9px;letter-spacing:.04em">0${i + 1}</span>`, egg);
const cards = `<div style="${SANS};box-sizing:border-box;max-width:500px;margin:0 auto;padding:18px 16px 16px;background:radial-gradient(rgba(255,255,255,.85) 1px,transparent 1.6px) 0 0/16px 16px,linear-gradient(155deg,#eeeaf8,#fbf3ee 60%,#eef4fa);border-radius:20px;box-shadow:inset 0 0 0 1px #e2dcef">`
    + `<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;padding:6px 6px 16px">${CARDS.map(card).join('')}</div>`
    + `<div style="padding:18px 16px 14px;background-color:#ffffff;border-radius:16px;box-shadow:0 0 0 1px #ece8f3,0 8px 20px rgba(59,47,90,.1)"><div style="text-align:center">{{head}}</div><div style="margin-top:14px">{{body}}</div>{{info}}<div style="margin-top:10px;text-align:center;color:#6a6478;font-size:12px;line-height:1.6">{{tail}}</div></div>`
    + '</div>';

export const REACT_CATEGORY = { id: 'react', label: '반응 글꾸' };
export const REACT_FRAMES = [
    { id: 'c-react-sp-1', label: '봉투 열기', emoji: '💌', desc: '봉투를 누르면 닫히고 다시 누르면 덮개가 젖혀지며 편지가 올라와요 · 봉랍을 누르면 통', template: envelope, messages: 'box', tail: '', type: { font: 'serif', size: 20, weight: 700, align: 'left' },
        colors: { bg: '#efe4d0', face: '#fffdf7', faceText: '#3d3128', faceMuted: '#7a6650', panel: '#fffdf7', panel2: '#f6eedf', text: '#3d3128', dialogue: '#b8343a', thought: '#6d5a2a', emphasis: '#9a3a2a', mark: '#f6e2b8', quoteBar: '#e63946', name: '#b8343a', muted: '#776a5c', chip: '#f3eadb', chipText: '#3d3128', accent: '#b8343a', onAccent: '#ffffff', line: '#d8c6a6', deco1: '#e63946', deco2: '#c9ad82', deco3: '#fffdf7' } },
    { id: 'c-react-sp-2', label: '초대장', emoji: '🎫', desc: '남색 두 문 · 금빛 테 · 누르면 문이 열리고 별이 반짝이며 본문이 펼쳐져요', template: invitation, messages: 'box', tail: '', type: { font: 'serif', size: 24, weight: 700, align: 'center', tracking: 0.03 },
        colors: { bg: '#141a33', face: '#fbf6ea', faceText: '#1d2442', faceMuted: '#6b6650', panel: '#fbf6ea', panel2: '#f3ecda', text: '#1d2442', dialogue: '#8a6510', thought: '#4a5480', emphasis: '#9a3a2a', mark: '#f3e2a8', quoteBar: '#c9a94a', name: '#8a6510', muted: '#6b6a70', chip: '#efe6cc', chipText: '#1d2442', accent: '#8a6510', onAccent: '#ffffff', line: '#d9c48a', deco1: '#f0d878', deco2: '#2a3460', deco3: '#fbf6ea' } },
    { id: 'c-react-sp-3', label: '쪽 넘기기', emoji: '📖', desc: '표지 · 로그 · 맺음 세 쪽을 옆으로 넘겨요 · 쪽마다 「n / 3」 · 모서리 귀를 누르면 들썩', template: pages, messages: 'box', tail: '', type: { font: 'sans', size: 20, weight: 700, align: 'center' },
        colors: { bg: '#e9eef4', face: '#fdfbf6', faceText: '#2b3a4e', faceMuted: '#66768a', panel: '#fdfbf6', panel2: '#f1efe8', text: '#2b3a4e', dialogue: '#2f5f8f', thought: '#5a4f86', emphasis: '#8a3a3a', mark: '#dbe8f5', quoteBar: '#79a9d8', name: '#2f5f8f', muted: '#66768a', chip: '#e6edf5', chipText: '#2b3a4e', accent: '#2f5f8f', onAccent: '#ffffff', line: '#d6dde6', deco1: '#79a9d8', deco2: '#cfc7b5', deco3: '#fdfbf6' } },
    { id: 'c-react-sp-4', label: '통통 카드', emoji: '🃏', desc: '캐릭터 색 카드 여섯 장 · 누르면 통통 · 반짝 · 흔들 · 빙글 · 뒤집 · 쑥', template: cards, messages: 'bubble', tail: '', type: { font: 'sans', size: 20, weight: 800, align: 'center' },
        colors: { bg: '#f1eef8', face: '#ffffff', faceText: '#1d1f27', faceMuted: '#6a6478', panel: '#ffffff', panel2: '#f6f3fb', text: '#1d1f27', dialogue: '#0b5fa8', thought: '#6a4aa8', emphasis: '#b5321a', mark: '#fbeaa8', quoteBar: '#b799e8', name: '#6a4aa8', muted: '#6a6478', chip: '#efeaf8', chipText: '#1d1f27', accent: '#6a4aa8', onAccent: '#ffffff', line: '#e2dcef', deco1: '#ff5fa2', deco2: '#79a9d8', deco3: '#f0d878' } },
];
