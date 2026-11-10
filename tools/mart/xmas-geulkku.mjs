// 연말 글꾸 6종(11-09) — 크리스마스 · 연말 · 새해 한 장면 틈 템플릿: 스노우볼 · 성탄 카드 · 오너먼트 대화 · 겨울 기차표 · 연말 정산 · 소원 부적.
//   테마 내장(tools/mart/build-builtin.mjs → src/log-copy-builtin.gen.js, 분류 「연말」 xmas)과 글꾸 마트(사이트 tools/geulkku-xmas.mjs)가 같이 써요.
//   장면 글꾸(scene-geulkku.mjs)와 같은 규칙만 써요(src/log-copy-template.js checkTemplate): 인라인 style · details/summary · data-bl-egg · bl- 키프레임 — input · class · <style> 없음.
//   읽기 규칙(시험 tools/tests/log-copy-xmas.mjs)
//     - 글이 든 칸은 모두 제 글자색 · 제 바탕색(background-color)을 적어요 — 어두운 · 밝은 게시판 어디에 붙여도 글자 대비 4.5(장식 기호 3) 이상.
//     - 그라데이션 · 그림은 글 없는 장식 칸(aria-hidden)에만 · 글에는 opacity 를 안 써요.
//     - 폭은 max-width + 줄바꿈(flex-wrap)만 — 폰 390 에서 가로로 넘치지 않아요(고정 폭 큰 칸 없음).
//   성탄 카드만 닫힌 채 시작해요(반응 글꾸 봉투 · 초대장과 같은 길 — 미리보기만 펼쳐 보이고 복사하면 닫혀요). 겉면을 누르면 열려요.
//   다크 둘(스노우볼 · 오너먼트 대화) · 라이트 넷(성탄 카드 · 겨울 기차표 · 연말 정산 · 소원 부적).
const SANS = "font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const SERIF = "font-family:'Noto Serif KR','AppleMyungjo','Nanum Myeongjo',Batang,Georgia,serif";
const MONO = "font-family:ui-monospace,'SFMono-Regular','Cascadia Mono','D2Coding',Menlo,Consolas,monospace";
const deco = (style, inner = '', egg = '') => `<span aria-hidden="true"${egg ? ` data-bl-egg="${egg}"` : ''} style="${style}">${inner}</span>`;
const div = (style, inner = '') => `<div style="${style}">${inner}</div>`;
const span = (style, inner = '') => `<span style="${style}">${inner}</span>`;
const SLOT_HEAD = '{{head}}', SLOT_BODY = '{{body}}', SLOT_INFO = '{{info}}', SLOT_TAIL = '{{tail}}';
const WRAP = 'box-sizing:border-box;max-width:480px;margin:0 auto;overflow-wrap:anywhere;word-break:keep-all';

// ① 스노우볼 — 밤 바탕 위 유리 공(눈이 흩날리고 작은 집 · 트리 · 달) · 나무 받침 · 받침 아래 편지지에 로그 · 공 속 달을 누르면 반짝
const snowGlobe = (() => {
    const night = '#101a2e', glass = '#1c2b4b', wood = '#6b4429', paper = '#fbf7ee', ink = '#26283a', muted = '#5c5a6c', line = '#e3dccd';
    const flakes = [['14%', '0s', '7s', '11px'], ['28%', '2.2s', '8s', '9px'], ['41%', '1s', '6.5s', '13px'], ['55%', '3.1s', '7.5s', '10px'], ['68%', '.5s', '8.5s', '12px'], ['80%', '1.8s', '7s', '9px']]
        .map(([l, d, t, sz]) => deco(`position:absolute;left:${l};top:-14px;display:block;color:#eef4ff;font-size:${sz};line-height:1;animation:bl-s-fall ${t} linear ${d} infinite;--bl-fall:150px;--bl-x:6px;--bl-x2:-4px;--bl-r:120deg`, '❄')).join('');
    return div(`${SANS};${WRAP};padding:16px 14px 14px;background-color:${night};color:#eef2fb;border-radius:14px`,
        deco(`position:relative;display:block;width:70%;max-width:240px;aspect-ratio:1/1;margin:0 auto;overflow:hidden;clip-path:circle(50%);border-radius:50%;background-color:${glass};color:#eef4ff;background-image:radial-gradient(circle at 32% 26%,rgba(255,255,255,.32),transparent 22%),radial-gradient(circle at 50% 120%,#f4f7fc 0 34%,transparent 34.5%),linear-gradient(#1a2747,#2a3c63);box-shadow:inset 0 0 0 3px rgba(255,255,255,.18),inset 0 -10px 24px rgba(0,0,0,.35)`,
            flakes
            + deco(`position:absolute;left:66%;top:18%;display:block;width:22px;height:22px;border-radius:50%;background-color:#fff1bf;color:#fff1bf;box-shadow:0 0 14px rgba(255,241,191,.75),inset -6px -3px 0 #e8d18a`, '', 'glow')
            + deco(`position:absolute;left:0;right:0;bottom:16%;display:block;text-align:center;color:#ffffff;font-size:30px;line-height:1;letter-spacing:4px`, '🏠🎄'))
        + deco(`display:block;width:62%;max-width:220px;height:26px;margin:-4px auto 0;background-color:${wood};color:${wood};clip-path:polygon(8% 0,92% 0,100% 100%,0 100%);background-image:linear-gradient(#86583a,#5a3a22);box-shadow:0 6px 12px rgba(0,0,0,.35)`)
        + div(`position:relative;margin:14px 6px 0;padding:18px 16px 14px;background-color:${paper};color:${ink};border-radius:4px;box-shadow:0 0 0 1px ${line},0 10px 22px rgba(0,0,0,.3)`,
            div(`${SERIF};color:${muted};background-color:${paper};font-size:11px;letter-spacing:.32em;line-height:1.6`, '흔들면 눈이 와요')
            + div(`margin-top:6px;text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
            + deco(`display:block;height:1px;margin:12px 0;background-color:${line};color:${line}`)
            + div(`background-color:${paper};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:12px;text-align:right;color:${muted};background-color:${paper};${SERIF};font-size:12px;line-height:1.6`, SLOT_TAIL)));
})();

// ② 성탄 카드 — 겉면: 붉은 카드 · 금빛 테 · 트리(별을 누르면 빙글) · Merry Christmas / 누르면 펼쳐져 안쪽 크림색 면에 로그 · 호랑가시 장식
const xmasCard = (() => {
    const red = '#8e1b24', gold = '#f1d38a', cream = '#fffaf0', ink = '#2d2420', muted = '#62554c', green = '#1f5b3a';
    const tree = deco('display:block;width:80px;height:88px;margin:0 auto;background-color:#2e7d4f;color:#2e7d4f;clip-path:polygon(50% 0,64% 26%,58% 26%,76% 52%,68% 52%,92% 84%,58% 84%,58% 100%,42% 100%,42% 84%,8% 84%,32% 52%,24% 52%,42% 26%,36% 26%);background-image:radial-gradient(circle at 40% 40%,#ffd36b 0 3px,transparent 3.5px),radial-gradient(circle at 62% 58%,#ff6b6b 0 3px,transparent 3.5px),radial-gradient(circle at 34% 70%,#8fd3ff 0 3px,transparent 3.5px),radial-gradient(circle at 66% 76%,#ffd36b 0 3px,transparent 3.5px),linear-gradient(#3a9461,#24683f)');
    return div(`${SANS};${WRAP};padding:16px;background-color:#efe3d0;color:${ink};border-radius:14px`,
        '<details style="display:block;margin:0">'
        + `<summary style="list-style:none;display:block;cursor:pointer;outline:none;margin:0;padding:22px 18px 18px;text-align:center;border-radius:10px;background-color:${red};color:#fff3d6;box-shadow:inset 0 0 0 6px ${red},inset 0 0 0 7px ${gold},0 12px 26px rgba(90,20,24,.35)">`
        + deco(`display:block;color:${gold};font-size:22px;line-height:1;margin-bottom:-2px`, '★', 'spin')
        + tree
        + span(`display:block;margin-top:12px;${SERIF};color:#fff3d6;background-color:${red};font-size:22px;font-weight:700;letter-spacing:.06em;line-height:1.3`, 'Merry Christmas')
        + span(`display:block;margin-top:4px;color:${gold};background-color:${red};font-size:12px;letter-spacing:.2em;line-height:1.6`, '눌러서 펼쳐요')
        + '</summary>'
        + div(`position:relative;margin-top:8px;padding:22px 18px 16px;background-color:${cream};color:${ink};border-radius:10px;box-shadow:inset 0 0 0 1px #e6d6b8,0 10px 22px rgba(90,62,34,.18);animation:bl-s-rise .7s cubic-bezier(.3,.7,.2,1) both;--bl-from:-14px;--bl-to:0px`,
            deco(`position:absolute;left:12px;top:10px;display:block;color:${green};font-size:18px;line-height:1;transform:rotate(-18deg)`, '❦', 'wiggle')
            + deco(`position:absolute;right:12px;top:10px;display:block;color:#b3242c;font-size:14px;line-height:1;letter-spacing:2px`, '●●')
            + div(`text-align:center;background-color:${cream};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:14px;background-color:${cream};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:12px;padding-top:10px;border-top:1px dashed #d9c49b;text-align:center;color:${muted};background-color:${cream};${SERIF};font-size:12.5px;line-height:1.6`, SLOT_TAIL))
        + '</details>');
})();

// ③ 오너먼트 대화 — 짙은 전나무 바탕 · 위에 걸린 줄에 오너먼트 다섯(누르면 통 · 빙글 · 반짝 · 흔들 · 쑥) · 금빛 테 로그 칸
const ornaments = (() => {
    const pine = '#0f2a1f', face = '#0f2a1f', panel = '#163b2c', ink = '#eef6ee', muted = '#b4cbbd', gold = '#e8c766';
    const BALLS = [['#d94a4a', 'bounce', '0s'], ['#e8c766', 'spin', '.4s'], ['#5aa9e6', 'glow', '.8s'], ['#c86bd6', 'wiggle', '1.2s'], ['#f2f2f2', 'drop', '1.6s']];
    const ball = ([c, egg, d], i) => deco(`display:flex;flex-direction:column;align-items:center;transform-origin:50% 0;animation:bl-s-sway ${3 + i * .4}s ease-in-out ${d} infinite`,
        deco(`display:block;width:1px;height:${[14, 26, 10, 22, 16][i]}px;background-color:#c9b98a;color:#c9b98a`)
        + deco(`display:block;width:8px;height:5px;border-radius:2px 2px 0 0;background-color:#c9b98a;color:#c9b98a`)
        + deco(`display:block;width:26px;height:26px;border-radius:50%;background-color:${c};color:${c};background-image:radial-gradient(circle at 34% 30%,rgba(255,255,255,.75),rgba(255,255,255,0) 40%),linear-gradient(transparent 44%,rgba(255,255,255,.35) 44%,rgba(255,255,255,.35) 56%,transparent 56%);box-shadow:0 4px 8px rgba(0,0,0,.35)`, '', egg));
    return div(`${SANS};${WRAP};padding:0 14px 14px;background-color:${pine};color:${ink};border-radius:14px;overflow:hidden`,   /* 1.1.1: 맨 위 6px 띠의 둥근 모서리(14px 가 6px 높이에 맞춰 6px 로 줄어듦)가 판 곡선 밖으로 2.4px 나오던 것 — 판이 잘라요 */
        deco(`display:block;height:6px;margin:0 -14px;border-radius:14px 14px 0 0;background-color:#24563f;color:#24563f;background-image:repeating-linear-gradient(90deg,#2f6b4f 0 10px,#1d4a35 10px 20px)`)
        + deco(`display:flex;justify-content:space-around;align-items:flex-start;height:60px;margin:0 4px;border-top:2px solid #c9b98a;color:#c9b98a`, BALLS.map(ball).join(''))
        + div(`margin-top:6px;text-align:center;color:${gold};background-color:${face};${SERIF};font-size:11px;letter-spacing:.42em;text-indent:.42em;line-height:1.6`, '✦ HOLIDAY TALK ✦')
        + div(`margin-top:6px;text-align:center;background-color:${face};color:${ink}`, SLOT_HEAD)
        + div(`margin-top:12px;padding:14px 12px;border-radius:12px;background-color:${panel};color:${ink};box-shadow:inset 0 0 0 1px #2c5a45,inset 0 0 0 4px ${panel},inset 0 0 0 5px rgba(232,199,102,.45)`, SLOT_BODY)
        + SLOT_INFO
        + div(`margin-top:12px;text-align:center;color:${muted};background-color:${pine};font-size:12px;line-height:1.6`, SLOT_TAIL));
})();

// ④ 겨울 기차표 — 두꺼운 종이 승차권: 겨울 열차 머리 · 출발 → 도착 큰 글씨 · 열차 · 호차 · 좌석 · 출발 칸 · 선로를 달리는 기차 · 점선 아래 로그 · 검표 도장(누르면 빙글)
const trainTicket = (() => {
    const ink = '#1f2a33', muted = '#4f5d68', blue = '#1d5b8f', red = '#a3262a', paper = '#fffdf7', line = '#d5dde3';
    const cell = (k, v) => div(`flex:1 1 40%;min-width:0;padding:6px 8px;border-left:1px solid ${line};border-bottom:1px solid ${line};background-color:${paper};color:${ink}`,
        span(`display:block;color:${muted};background-color:${paper};font-size:10.5px;font-weight:700;letter-spacing:.14em;line-height:1.5`, k)
        + span(`display:block;${MONO};color:${ink};background-color:${paper};font-size:14px;font-weight:800;line-height:1.4`, v));
    return div(`${SANS};${WRAP};padding:14px;background-color:#e6edf2;color:${ink};border-radius:14px`,
        div(`position:relative;border-radius:10px;background-color:${paper};color:${ink};box-shadow:0 0 0 1px ${line},0 10px 22px rgba(29,59,90,.14)`,
            div(`display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:10px 14px;border-radius:10px 10px 0 0;background-color:${blue};color:#ffffff`,
                span(`color:#ffffff;background-color:${blue};font-size:13px;font-weight:800;letter-spacing:.16em;line-height:1.5`, '겨울 열차 승차권')
                + span(`margin-left:auto;${MONO};color:#dcebf8;background-color:${blue};font-size:11px;letter-spacing:.12em;line-height:1.5`, 'WINTER EXPRESS'))
            + div(`display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 14px;padding:14px 14px 6px;background-color:${paper};color:${ink}`,
                span(`${SERIF};color:${ink};background-color:${paper};font-size:24px;font-weight:800;line-height:1.3`, '오늘')
                + span(`color:${red};background-color:${paper};font-size:18px;font-weight:800;line-height:1.3`, '→')
                + span(`${SERIF};color:${ink};background-color:${paper};font-size:24px;font-weight:800;line-height:1.3`, '눈의 나라'))
            + div(`text-align:center;color:${muted};background-color:${paper};font-size:11px;letter-spacing:.2em;line-height:1.6`, '편도 · 1 매 · 어른')
            + deco(`position:relative;display:block;height:26px;margin:8px 14px 0;overflow:hidden;clip-path:inset(0);background-color:${paper};color:${ink};background-image:repeating-linear-gradient(90deg,#8a96a0 0 2px,transparent 2px 12px),linear-gradient(transparent 20px,#8a96a0 20px,#8a96a0 22px,transparent 22px);background-size:100% 4px,100% 100%;background-position:0 23px,0 0;background-repeat:repeat-x,no-repeat`,
                deco(`position:absolute;left:0;top:0;display:block;font-size:18px;line-height:1;animation:bl-ticker 9s linear infinite;--bl-tick-from:-30px;--bl-tick-to:440px`, '🚂', 'fly'))
            + div(`display:flex;flex-wrap:wrap;margin:10px 14px 0;border:1px solid ${line};border-left:0;border-bottom:0;background-color:${paper};color:${ink}`,
                cell('열차', '1225') + cell('호차', '7') + cell('좌석', '12A') + cell('출발', '23:59'))
            + deco(`position:relative;display:block;height:0;margin:14px 0 0;border-top:2px dashed ${line}`,
                deco(`position:absolute;left:-9px;top:-9px;display:block;width:16px;height:16px;border-radius:50%;background-color:#e6edf2;color:#e6edf2`)
                + deco(`position:absolute;right:-9px;top:-9px;display:block;width:16px;height:16px;border-radius:50%;background-color:#e6edf2;color:#e6edf2`))
            + div(`position:relative;padding:14px 14px 14px;border-radius:0 0 10px 10px;background-color:${paper};color:${ink}`,   /* 1.1.1: 아래 모서리가 표 둥근 판(10px) 밖으로 3.2px 나오던 것 */
                deco(`position:absolute;right:12px;top:8px;display:block;width:50px;height:50px;box-sizing:border-box;border:2px solid ${red};border-radius:50%;background-color:${paper};color:${red};font-size:11px;font-weight:800;line-height:14px;text-align:center;padding-top:10px;transform:rotate(-12deg)`, '검표<br>완료', 'spin')
                + div(`padding-right:56px;text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
                + div(`margin-top:12px;background-color:${paper};color:${ink}`, SLOT_BODY)
                + SLOT_INFO
                + div(`margin-top:12px;text-align:center;color:${muted};background-color:${paper};${MONO};font-size:12px;letter-spacing:.08em;line-height:1.6`, SLOT_TAIL))));
})();

// ⑤ 연말 정산 — 올해를 계산한 긴 영수증: 톱니 가장자리 · 가게 머리 · 일시 · 손님 · 품목 줄(같이 웃은 날 ×365 …) · 합계 · 상세 내역(로그) · 바코드 · 「정산 완료」 도장(누르면 통)
const receipt = (() => {
    const desk = '#d9e2dc', paper = '#fffefa', ink = '#24221f', muted = '#5d5953', red = '#b0262c', line = '#cfcac0';
    const TEETH = `display:block;height:8px;background-color:${desk};color:${desk};background-image:linear-gradient(135deg,${paper} 25%,transparent 25%),linear-gradient(225deg,${paper} 25%,transparent 25%);background-size:12px 12px`;
    const item = (k, v) => div(`display:flex;flex-wrap:wrap;gap:0 10px;padding:3px 0;background-color:${paper};color:${ink}`,
        span(`flex:1 1 auto;min-width:0;${MONO};color:${ink};background-color:${paper};font-size:13px;line-height:1.6`, k)
        + span(`flex:0 0 auto;${MONO};color:${ink};background-color:${paper};font-size:13px;font-weight:700;line-height:1.6`, v));
    return div(`${SANS};${WRAP};padding:14px;background-color:${desk};color:${ink};border-radius:12px`,
        div(`margin:0 auto;max-width:400px;background-color:${desk};color:${ink};filter:drop-shadow(0 8px 12px rgba(40,50,44,.22))`,
            deco(`${TEETH};background-position:0 0;transform:scaleY(-1)`)
            + div(`position:relative;padding:14px 16px 16px;background-color:${paper};color:${ink}`,
                div(`text-align:center;${MONO};color:${ink};background-color:${paper};font-size:15px;font-weight:800;letter-spacing:.3em;text-indent:.3em;line-height:1.5`, '올해 정산서')
                + div(`text-align:center;${MONO};color:${muted};background-color:${paper};font-size:11px;letter-spacing:.16em;line-height:1.6`, 'YEAR-END RECEIPT · No.1231')
                + div(`display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 10px;margin-top:10px;padding:6px 0;border-top:1px dashed ${line};border-bottom:1px dashed ${line};background-color:${paper};color:${muted};${MONO};font-size:11.5px;line-height:1.6`,
                    span(`color:${muted};background-color:${paper}`, '일시 12.31 23:59') + span(`color:${muted};background-color:${paper}`, '손님 우리 둘'))
                + div(`margin-top:8px;background-color:${paper};color:${ink}`,
                    item('같이 웃은 날', '×365') + item('주고받은 말', '×∞') + item('서운했던 날', '−3') + item('다시 웃은 날', '+3'))
                + div(`display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 10px;margin-top:6px;padding-top:6px;border-top:2px solid ${ink};background-color:${paper};color:${ink};${MONO};font-size:15px;font-weight:800;line-height:1.6`,
                    span(`color:${ink};background-color:${paper}`, '합계') + span(`color:${red};background-color:${paper}`, '다 좋았음'))
                + deco(`display:block;margin:12px auto 0;width:58px;height:58px;box-sizing:border-box;border:2px solid ${red};border-radius:50%;background-color:${paper};color:${red};${MONO};font-size:11px;font-weight:800;line-height:15px;text-align:center;padding-top:13px;transform:rotate(-14deg)`, '정산<br>완료', 'bounce')
                + div(`margin-top:14px;text-align:center;${MONO};color:${muted};background-color:${paper};font-size:11px;letter-spacing:.3em;text-indent:.3em;line-height:1.6`, '— 상세 내역 —')
                + div(`margin-top:6px;text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
                + div(`margin-top:10px;background-color:${paper};color:${ink}`, SLOT_BODY)
                + SLOT_INFO
                + deco(`display:block;height:34px;margin:14px 8% 0;background-color:${paper};color:${ink};background-image:repeating-linear-gradient(90deg,${ink} 0 2px,transparent 2px 4px,${ink} 4px 5px,transparent 5px 8px,${ink} 8px 11px,transparent 11px 12px)`)
                + div(`margin-top:8px;text-align:center;${MONO};color:${muted};background-color:${paper};font-size:12px;line-height:1.6`, SLOT_TAIL))
            + deco(TEETH)));
})();

// ⑥ 소원 부적 — 한지 바탕 위 노란 부적: 붉은 겹테 · 所願成就 큰 글씨 · 붉은 「福」 도장(누르면 빙글) · 소원(로그) · 새해 첫날 꼬리
const charm = (() => {
    const hanji = '#efe6cf', paper = '#f8e08a', panel = '#fcefc0', ink = '#3a2208', muted = '#6a4a1c', red = '#9e1b1b';
    return div(`${SANS};${WRAP};padding:14px;background-color:${hanji};color:${ink};border-radius:12px`,
        div(`position:relative;padding:8px;background-color:${paper};color:${ink};border-radius:4px;box-shadow:0 10px 22px rgba(98,64,20,.22)`,
            div(`position:relative;padding:14px 12px 12px;border:2px solid ${red};box-shadow:inset 0 0 0 3px ${paper},inset 0 0 0 4px ${red};background-color:${paper};color:${ink}`,
                deco(`position:absolute;right:10px;top:10px;display:block;width:44px;height:44px;box-sizing:border-box;border-radius:6px;background-color:${red};color:#fff3d0;${SERIF};font-size:24px;font-weight:900;line-height:44px;text-align:center;transform:rotate(6deg);box-shadow:inset 0 0 0 3px #b83a2a`, '福', 'spin')
                + div(`${SERIF};padding-right:50px;color:${red};background-color:${paper};font-size:26px;font-weight:900;letter-spacing:.24em;line-height:1.3`, '所願成就')
                + div(`margin-top:2px;padding-right:50px;color:${muted};background-color:${paper};font-size:11px;font-weight:700;letter-spacing:.3em;line-height:1.6`, '소 원 성 취 · 새 해 부 적')
                + deco(`display:block;height:2px;margin:10px 0;background-color:${red};color:${red};background-image:repeating-linear-gradient(90deg,${red} 0 10px,${paper} 10px 14px)`)
                + div(`text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
                + div(`margin-top:12px;padding:12px;border-radius:4px;background-color:${panel};color:${ink};box-shadow:inset 0 0 0 1px #e0c26a`, SLOT_BODY)
                + SLOT_INFO
                + div(`display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;margin-top:12px;background-color:${paper};color:${ink}`,
                    deco(`display:block;color:${red};font-size:14px;letter-spacing:4px;line-height:1`, '✦✦✦')
                    + div(`color:${muted};background-color:${paper};${SERIF};font-size:12px;line-height:1.6`, SLOT_TAIL)))));
})();

export const XMAS_CATEGORY = { id: 'xmas', label: '연말 · 크리스마스' };
// 색 역할은 장면 · 반응 · 심플 글꾸와 같아요(log-copy-template.js TEMPLATE_ROLES) — face 는 {{head}} 가 놓이는 바탕 · panel/panel2 는 메시지 칸
export const XMAS_FRAMES = [
    { id: 'c-xmas-sp-1', label: '스노우볼', emoji: '❄️', desc: '밤 바탕 위 유리 공 속에 눈이 흩날리고(작은 집 · 트리 · 달) 나무 받침 아래 편지지에 로그를 적어요 · 공 속 달을 누르면 반짝', template: snowGlobe, messages: 'box', tail: '유리 공 속엔 아직 눈이 와요', type: { font: 'serif', size: 22, weight: 700, align: 'left' },
        colors: { bg: '#101a2e', face: '#fbf7ee', faceText: '#26283a', faceMuted: '#5c5a6c', panel: '#fbf7ee', panel2: '#f2ede1', text: '#26283a', dialogue: '#0a5cc2', thought: '#8a2fa8', emphasis: '#a8321f', mark: '#fbe3a0', quoteBar: '#1f5f9e', name: '#1f5f9e', muted: '#5c5a6c', chip: '#eef0f6', chipText: '#26283a', accent: '#1f3f73', onAccent: '#ffffff', line: '#e3dccd', deco1: '#1f3f73', deco2: '#e3dccd', deco3: '#fbf7ee' } },
    { id: 'c-xmas-sp-2', label: '성탄 카드', emoji: '🎅', desc: '붉은 크리스마스 카드 겉면(금빛 테 · 트리 · Merry Christmas) — 누르면 펼쳐져 크림색 안쪽 면에 로그 · 트리 꼭대기 별을 누르면 빙글', template: xmasCard, messages: 'box', tail: '따뜻한 성탄 보내요', type: { font: 'serif', size: 24, weight: 700, align: 'center', tracking: 0.03 },
        colors: { bg: '#efe3d0', face: '#fffaf0', faceText: '#2d2420', faceMuted: '#62554c', panel: '#fffaf0', panel2: '#f7eedd', text: '#2d2420', dialogue: '#a3192c', thought: '#1f5b3a', emphasis: '#2f4f9e', mark: '#fbe08a', quoteBar: '#a3192c', name: '#a3192c', muted: '#62554c', chip: '#f7eedd', chipText: '#2d2420', accent: '#8e1b24', onAccent: '#fff3d6', line: '#e6d6b8', deco1: '#8e1b24', deco2: '#1f5b3a', deco3: '#fffaf0' } },
    { id: 'c-xmas-sp-3', label: '오너먼트 대화', emoji: '✨', desc: '짙은 전나무 바탕 위 줄에 걸린 오너먼트 다섯(누르면 통 · 빙글 · 반짝 · 흔들 · 쑥) · 금빛 테 칸에 로그', template: ornaments, messages: 'box', tail: '오늘 밤도 반짝반짝', type: { font: 'serif', size: 22, weight: 700, align: 'center', tracking: 0.04 },
        colors: { bg: '#0f2a1f', face: '#0f2a1f', faceText: '#eef6ee', faceMuted: '#b4cbbd', panel: '#163b2c', panel2: '#1e4a37', text: '#eef6ee', dialogue: '#ffc94a', thought: '#6cc4ff', emphasis: '#ff9a9a', mark: '#4d4414', quoteBar: '#e8c766', name: '#e8c766', muted: '#b4cbbd', chip: '#1e4a37', chipText: '#eef6ee', accent: '#e8c766', onAccent: '#0f2a1f', line: '#2c5a45', deco1: '#e8c766', deco2: '#d94a4a', deco3: '#1e4a37' } },
    { id: 'c-xmas-sp-4', label: '겨울 기차표', emoji: '🚂', desc: '두꺼운 종이 겨울 열차 승차권 — 오늘 → 눈의 나라 · 열차 · 호차 · 좌석 · 출발 칸, 선로를 달리는 기차(누르면 휙) · 점선 아래 로그 · 검표 도장을 누르면 빙글', template: trainTicket, messages: 'box', tail: '이 열차는 눈의 나라까지 가요', type: { font: 'sans', size: 20, weight: 800, align: 'left' },
        colors: { bg: '#e6edf2', face: '#fffdf7', faceText: '#1f2a33', faceMuted: '#4f5d68', panel: '#fffdf7', panel2: '#f0f4f7', text: '#2a2724', dialogue: '#005fb8', thought: '#9a2db0', emphasis: '#a3262a', mark: '#fde9a6', quoteBar: '#1d5b8f', name: '#1d5b8f', muted: '#4f5d68', chip: '#e3ebf1', chipText: '#1f2a33', accent: '#1d5b8f', onAccent: '#ffffff', line: '#d5dde3', deco1: '#1d5b8f', deco2: '#a3262a', deco3: '#fffdf7' } },
    { id: 'c-xmas-sp-5', label: '연말 정산', emoji: '🧾', desc: '올해를 계산한 긴 영수증 — 톱니 가장자리 · 일시 · 손님, 같이 웃은 날 ×365 같은 품목 줄과 합계, 상세 내역(로그) · 바코드 · 「정산 완료」 도장을 누르면 통', template: receipt, messages: 'box', tail: '또 오세요 · 내년에도', type: { font: 'mono', size: 18, weight: 800, align: 'left', tracking: 0.04 },
        colors: { bg: '#d9e2dc', face: '#fffefa', faceText: '#24221f', faceMuted: '#5d5953', panel: '#fffefa', panel2: '#f4f2ec', text: '#24221f', dialogue: '#b0262c', thought: '#1f5fa8', emphasis: '#2f7a3a', mark: '#fde58a', quoteBar: '#b0262c', name: '#b0262c', muted: '#5d5953', chip: '#efece4', chipText: '#24221f', accent: '#24221f', onAccent: '#fffefa', line: '#cfcac0', deco1: '#b0262c', deco2: '#cfcac0', deco3: '#fffefa' } },
    { id: 'c-xmas-sp-6', label: '소원 부적', emoji: '📜', desc: '한지 위 노란 새해 부적 — 붉은 겹테 · 所願成就 큰 글씨, 소원(로그) 칸 · 붉은 「福」 도장을 누르면 빙글', template: charm, messages: 'box', tail: '새해엔 다 이루어져요', type: { font: 'serif', size: 22, weight: 800, align: 'left', tracking: 0.04 },
        colors: { bg: '#efe6cf', face: '#f8e08a', faceText: '#3a2208', faceMuted: '#6a4a1c', panel: '#fcefc0', panel2: '#fff6d8', text: '#3a2208', dialogue: '#c0161b', thought: '#1f4f8a', emphasis: '#2f6b2f', mark: '#ffd970', quoteBar: '#9e1b1b', name: '#9e1b1b', muted: '#6a4a1c', chip: '#f8e6a6', chipText: '#3a2208', accent: '#9e1b1b', onAccent: '#fff3d0', line: '#e0c26a', deco1: '#9e1b1b', deco2: '#e0c26a', deco3: '#fcefc0' } },
];
