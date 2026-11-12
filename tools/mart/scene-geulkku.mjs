// 장면 글꾸 8종(11-09) — 서류 · 화면 한 장면을 흉내 낸 틈 템플릿: 사랑 재판 · 속보 방송 · 탑승권 · 레시피 카드 · 타로 리딩 · 터미널 · 학적부 · 전보.
//   옛 테마 내장(1.1.7 에 뺐어요 · 분류 「장면」 scene)과 글꾸 마트(사이트 tools/geulkku-scene.mjs)가 같이 써요.
//   반응 글꾸(react-geulkku.mjs)와 같은 규칙만 써요(src/log-copy-template.js checkTemplate): 인라인 style · details/summary · data-bl-egg · bl- 키프레임 — input · class · <style> 없음.
//   읽기 규칙(시험 tools/tests/log-copy-scene.mjs)
//     - 글이 든 칸은 모두 제 글자색 · 제 바탕색(background-color)을 적어요 — 어두운 · 밝은 게시판 어디에 붙여도 글자 대비 4.5(장식 기호 3) 이상.
//     - 그라데이션 · 그림은 글 없는 장식 칸(aria-hidden)에만 · 글에는 opacity 를 안 써요.
//     - 폭은 max-width + 줄바꿈(flex-wrap)만 — 폰 390 에서 가로로 넘치지 않아요(고정 폭 큰 칸 없음).
//   다크 셋(속보 방송 · 타로 리딩 · 터미널) · 라이트 다섯.
const SANS = "font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const SERIF = "font-family:'Noto Serif KR','AppleMyungjo','Nanum Myeongjo',Batang,Georgia,serif";
const MONO = "font-family:ui-monospace,'SFMono-Regular','Cascadia Mono','D2Coding',Menlo,Consolas,monospace";
const deco = (style, inner = '', egg = '') => `<span aria-hidden="true"${egg ? ` data-bl-egg="${egg}"` : ''} style="${style}">${inner}</span>`;
const div = (style, inner = '') => `<div style="${style}">${inner}</div>`;
const span = (style, inner = '') => `<span style="${style}">${inner}</span>`;
const SLOT_HEAD = '{{head}}', SLOT_BODY = '{{body}}', SLOT_INFO = '{{info}}', SLOT_TAIL = '{{tail}}';
const WRAP = 'box-sizing:border-box;max-width:480px;margin:0 auto;overflow-wrap:anywhere;word-break:keep-all';

// ① 사랑 재판 — 연애법원 조서: 법원 머리 · 사건 칸(사건 · 원고 · 피고) · 조서(로그) · 주문 칸 · 붉은 네모 판결 도장(누르면 쿵)
const court = (() => {
    const ink = '#2b2622', muted = '#5f554a', red = '#a3192c', paper = '#fffdf8', line = '#d8cdb8';
    const row = (k, v) => div(`display:flex;gap:10px;padding:7px 12px;border-top:1px solid ${line};background-color:${paper};color:${ink};font-size:13px;line-height:1.55`,
        span(`flex:0 0 48px;color:${muted};font-weight:700;letter-spacing:.3em`, k) + span(`flex:1 1 auto;min-width:0;color:${ink}`, v));
    return div(`${SANS};${WRAP};padding:14px;background-color:#efe7d6;color:${ink};border-radius:6px`,
        div(`position:relative;padding:16px 14px 14px;background-color:${paper};color:${ink};border:1px solid ${line};box-shadow:0 1px 0 #e2d6bf,0 8px 18px rgba(84,62,30,.12)`,
            div(`${SERIF};text-align:center;color:${ink};background-color:${paper};font-size:12px;font-weight:700;letter-spacing:.42em;text-indent:.42em;line-height:1.6`, '마음연애법원')
            + div(`text-align:center;color:${muted};background-color:${paper};font-size:11px;letter-spacing:.12em;line-height:1.6;margin-top:2px`, '제 1 심장부 · 공 판 조 서')
            + deco(`display:block;height:3px;margin:10px 0 12px;border-top:1px solid ${ink};border-bottom:1px solid ${ink}`)
            + div(`text-align:center;background-color:${paper};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:12px;border:1px solid ${line};border-top:0;background-color:${paper};color:${ink}`,
                row('사건', '마음 무단 점유 및 설렘 유발') + row('원고', '나') + row('피고', '너'))
            + div(`margin:16px 0 6px;color:${red};background-color:${paper};font-size:11px;font-weight:700;letter-spacing:.3em;line-height:1.6`, '진 술 기 록')
            + div(`background-color:${paper};color:${ink}`, SLOT_BODY)
            + div(`position:relative;margin-top:16px;padding:12px 76px 12px 12px;border:1px double ${red};border-width:3px;background-color:${paper};color:${ink}`,
                div(`color:${red};background-color:${paper};font-size:11px;font-weight:700;letter-spacing:.3em;line-height:1.6`, '주 문')
                + div(`${SERIF};margin-top:4px;color:${ink};background-color:${paper};font-size:14px;font-weight:700;line-height:1.6`, '피고는 원고의 곁에 오래 머물 것.')
                + div(`margin-top:2px;color:${muted};background-color:${paper};font-size:11px;line-height:1.6`, '항소는 받지 않아요.')
                + deco(`position:absolute;right:10px;top:50%;display:block;width:52px;height:52px;margin-top:-26px;box-sizing:border-box;border:3px solid ${red};border-radius:6px;background-color:${paper};color:${red};${SERIF};font-size:15px;font-weight:900;line-height:20px;text-align:center;padding-top:4px;transform:rotate(-8deg)`, '판<br>결', 'bounce'))
            + SLOT_INFO
            + div(`margin-top:12px;text-align:right;color:${muted};background-color:${paper};font-size:12px;line-height:1.6`, SLOT_TAIL)));
})();

// ② 속보 방송 — 어두운 뉴스 화면: 방송사 · LIVE(점이 깜박) · 속보 머리 · 자막 로그 · 아래 띠(속보 딱지 + 흐르는 소식)
const news = (() => {
    const bg = '#0b1222', screen = '#121c33', ink = '#eef2f8', muted = '#a9b4c8', red = '#d72638', gold = '#ffd34d';
    return div(`${SANS};${WRAP};padding:12px;background-color:${bg};color:${ink};border-radius:14px`,
        div(`display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:2px 2px 10px;background-color:${bg};color:${ink}`,
            span(`display:inline-block;padding:2px 8px;border-radius:4px;background-color:#1f2c4c;color:${ink};font-size:12px;font-weight:800;letter-spacing:.08em;line-height:1.5`, 'BLN 24')
            + span(`display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:4px;background-color:${red};color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.14em;line-height:1.6`,
                deco('display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#ffffff;animation:bl-pulse 1.4s ease-in-out infinite') + 'LIVE')
            + span(`margin-left:auto;color:${muted};background-color:${bg};font-size:11px;letter-spacing:.06em;line-height:1.6`, '단독 · 생중계'))
        + div(`position:relative;padding:14px 12px 12px;border-radius:8px;background-color:${screen};color:${ink};box-shadow:inset 0 0 0 1px #24304f`,
            deco(`position:absolute;right:10px;top:8px;display:block;color:${gold};font-size:16px;line-height:1`, '📡', 'wiggle')
            + div(`color:${gold};background-color:${screen};font-size:11px;font-weight:800;letter-spacing:.24em;line-height:1.6`, '뉴스 속보')
            + div(`margin-top:4px;text-align:left;background-color:${screen};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:12px;background-color:${screen};color:${ink}`, SLOT_BODY))
        + div(`display:flex;align-items:stretch;margin-top:10px;border-radius:6px;overflow:hidden;background-color:#1a2440;color:${ink}`,
            span(`flex:0 0 auto;display:block;padding:6px 10px;background-color:${red};color:#ffffff;font-size:12px;font-weight:900;letter-spacing:.12em;line-height:1.6`, '속보')
            + span(`flex:1 1 auto;min-width:0;display:block;overflow:hidden;white-space:nowrap;background-color:#1a2440;color:${ink}`,
                span(`display:inline-block;padding:6px 10px;background-color:#1a2440;color:${gold};font-size:12px;font-weight:700;line-height:1.6;animation:bl-ticker 14s linear infinite;--bl-tick-from:60%;--bl-tick-to:-100%`, '두 사람, 오늘 밤도 대화 이어 가 · 자세한 내용은 아래 로그에서')))
        + SLOT_INFO
        + div(`margin-top:10px;text-align:center;color:${muted};background-color:${bg};font-size:12px;line-height:1.6`, SLOT_TAIL));
})();

// ③ 탑승권 — 흰 표에 출발 · 도착 큰 글씨, 편명 · 좌석 칸, 점선 뜯는 줄, 바코드 · 비행기(누르면 휙)
const boarding = (() => {
    const ink = '#1d2b3e', muted = '#4f6075', blue = '#1f5fa8', paper = '#ffffff', line = '#cfdae6';
    const cell = (k, v) => div(`flex:1 1 52px;min-width:0;background-color:${paper};color:${ink}`,
        div(`color:${muted};background-color:${paper};font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.5`, k)
        + div(`${MONO};color:${ink};background-color:${paper};font-size:15px;font-weight:800;line-height:1.4`, v));
    const port = (code, name, align) => div(`flex:1 1 0;min-width:0;text-align:${align};background-color:${paper};color:${ink}`,
        div(`${MONO};color:${ink};background-color:${paper};font-size:30px;font-weight:900;letter-spacing:.04em;line-height:1.1`, code)
        + div(`color:${muted};background-color:${paper};font-size:11px;line-height:1.5`, name));
    return div(`${SANS};${WRAP};padding:14px;background-color:#dfe9f3;color:${ink};border-radius:16px`,
        div(`border-radius:14px;overflow:hidden;background-color:${paper};color:${ink};box-shadow:0 10px 24px rgba(31,63,104,.16)`,
            div(`display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 14px;background-color:${blue};color:#ffffff`,
                span(`color:#ffffff;background-color:${blue};font-size:12px;font-weight:800;letter-spacing:.2em;line-height:1.5`, 'BOARDING PASS')
                + span(`margin-left:auto;color:#ffffff;background-color:${blue};font-size:12px;font-weight:700;line-height:1.5`, '탑승권 · 편도'))
            + div(`padding:14px 14px 10px;background-color:${paper};color:${ink}`,
                div(`display:flex;align-items:center;gap:8px;background-color:${paper};color:${ink}`,
                    port('NOW', '지금 여기', 'left')
                    + deco(`flex:0 0 auto;display:block;color:${blue};font-size:22px;line-height:1;transform:rotate(45deg)`, '✈', 'fly')
                    + port('US', '우리 둘', 'right'))
                + div(`display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:12px;padding-top:10px;border-top:1px solid ${line};background-color:${paper};color:${ink}`,
                    cell('편명', 'BL 1109') + cell('좌석', '1A') + cell('게이트', '♡') + cell('탑승', '지금')))
            + deco(`display:block;height:0;margin:0 12px;border-top:2px dashed ${line}`)
            + div(`padding:12px 14px 4px;background-color:${paper};color:${ink}`,
                div(`text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
                + div(`margin-top:12px;background-color:${paper};color:${ink}`, SLOT_BODY)
                + SLOT_INFO)
            + div(`display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 14px 14px;background-color:${paper};color:${ink}`,
                deco(`flex:1 1 140px;display:block;height:30px;max-width:220px;background:repeating-linear-gradient(90deg,${ink} 0 2px,transparent 2px 4px,${ink} 4px 5px,transparent 5px 8px,${ink} 8px 11px,transparent 11px 13px)`)
                + div(`flex:1 1 140px;min-width:0;text-align:right;color:${muted};background-color:${paper};font-size:12px;line-height:1.6`, SLOT_TAIL))));
})();

// ④ 레시피 카드 — 줄 친 색인 카드: 붉은 머리줄 · 조리 시간 · 인분 · 난이도 칸 · 재료 · 만드는 법(로그) · 프라이팬(누르면 흔들)
const recipe = (() => {
    const ink = '#3a2a1e', muted = '#6c5643', red = '#b23a2e', card = '#fffcf5', line = '#ead9c0', chip = '#f7ead6';
    const tagBox = t => span(`display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border-radius:999px;background-color:${chip};color:${ink};font-size:12px;font-weight:600;line-height:1.5`, t);
    const item = t => div(`padding:4px 0;border-bottom:1px dashed ${line};background-color:${card};color:${ink};font-size:13px;line-height:1.6`, span(`color:${red};background-color:${card};font-weight:900`, '·') + ' ' + t);
    return div(`${SANS};${WRAP};padding:14px;background-color:#f4e6cf;color:${ink};border-radius:12px`,
        div(`position:relative;padding:0 14px 14px;border-radius:6px;background-color:${card};color:${ink};box-shadow:0 8px 18px rgba(110,72,30,.14)`,
            deco(`display:block;height:6px;margin:0 -14px 12px;border-radius:6px 6px 0 0;background-color:${red}`)
            + deco(`position:absolute;right:12px;top:16px;display:block;font-size:24px;line-height:1`, '🍳', 'wiggle')
            + div(`color:${red};background-color:${card};font-size:11px;font-weight:800;letter-spacing:.26em;line-height:1.6`, 'RECIPE · 오늘의 레시피')
            + div(`margin-top:4px;padding-right:36px;text-align:left;background-color:${card};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:10px;line-height:0;background-color:${card};color:${ink}`, tagBox('⏱ 한 장면') + tagBox('🍽 2인분') + tagBox('난이도 ★★☆'))
            + div(`display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:6px;background-color:${card};color:${ink}`,
                div(`flex:1 1 180px;min-width:0;background-color:${card};color:${ink}`,
                    div(`color:${muted};background-color:${card};font-size:11px;font-weight:800;letter-spacing:.2em;line-height:1.8`, '재료')
                    + item('대화 한 줌') + item('설렘 약간') + item('밤공기 두 스푼')))
            + div(`margin:14px 0 6px;color:${muted};background-color:${card};font-size:11px;font-weight:800;letter-spacing:.2em;line-height:1.6`, '만드는 법')
            + div(`background-color:${card};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:12px;padding:8px 10px;border-left:3px solid ${red};background-color:${chip};color:${ink};font-size:12px;line-height:1.6`,
                div(`color:${red};background-color:${chip};font-weight:800;margin-bottom:2px`, '셰프의 한마디') + SLOT_TAIL)));
})();

// ⑤ 타로 리딩 — 금테 큰 카드(XVII 별) · 과거 · 현재 · 미래 작은 카드 셋(누르면 뒤집) · 리딩(로그)
const tarot = (() => {
    const bg = '#17112a', panel = '#231a3d', ink = '#f1ebff', muted = '#c2b6dc', gold = '#e8c766';
    const mini = (label, egg) => div(`flex:1 1 0;min-width:0;text-align:center;background-color:${bg};color:${ink}`,
        deco(`display:block;margin:0 auto;width:44px;height:66px;box-sizing:border-box;border:2px solid ${gold};border-radius:6px;background:repeating-linear-gradient(45deg,#3a2c63 0 4px,#2b2050 4px 8px);box-shadow:inset 0 0 0 3px ${bg};color:${gold};font-size:16px;line-height:62px;text-align:center`, '✦', egg)
        + div(`margin-top:4px;color:${muted};background-color:${bg};font-size:11px;letter-spacing:.14em;line-height:1.5`, label));
    return div(`${SANS};${WRAP};padding:16px 14px;background-color:${bg};color:${ink};border-radius:16px`,
        div(`margin:0 auto;max-width:220px;padding:10px;border:1px solid ${gold};border-radius:12px;background-color:${bg};color:${ink};box-shadow:0 0 0 4px ${bg},0 0 0 5px rgba(232,199,102,.45)`,
            div(`${SERIF};text-align:center;color:${gold};background-color:${bg};font-size:13px;font-weight:700;letter-spacing:.3em;text-indent:.3em;line-height:1.6`, 'XVII')
            + div(`position:relative;height:84px;margin:6px 0;border-radius:8px;background-color:${panel};color:${gold}`,
                deco(`position:absolute;left:50%;top:50%;display:block;width:50px;height:50px;margin:-25px 0 0 -25px;color:${gold};font-size:40px;line-height:50px;text-align:center`, '★', 'spin')
                + deco(`position:absolute;left:18%;top:20%;display:block;width:8px;height:8px;border-radius:50%;background-color:${gold};animation:bl-twinkle 2.4s ease-in-out infinite`)
                + deco(`position:absolute;right:16%;bottom:22%;display:block;width:6px;height:6px;border-radius:50%;background-color:${gold};animation:bl-twinkle 3.1s ease-in-out .8s infinite`))
            + div(`${SERIF};text-align:center;color:${gold};background-color:${bg};font-size:12px;font-weight:700;letter-spacing:.24em;text-indent:.24em;line-height:1.6`, 'THE STAR · 별'))
        + div(`display:flex;gap:10px;max-width:260px;margin:14px auto 0;background-color:${bg};color:${ink}`, mini('과거', 'flip') + mini('현재', 'flip') + mini('미래', 'flip'))
        + div(`margin-top:14px;text-align:center;background-color:${bg};color:${ink}`, SLOT_HEAD)
        + div(`margin:12px 0 6px;color:${gold};background-color:${bg};font-size:11px;font-weight:700;letter-spacing:.3em;line-height:1.6;text-align:center`, '— 리 딩 —')
        + div(`background-color:${bg};color:${ink}`, SLOT_BODY)
        + SLOT_INFO
        + div(`margin-top:12px;text-align:center;color:${muted};background-color:${bg};font-size:12px;line-height:1.6`, SLOT_TAIL));
})();

// ⑥ 터미널 — 어두운 창: 신호등 세 점 · 경로 제목 · $ 명령 줄 · 로그 · 끝 줄 깜박이는 커서
const terminal = (() => {
    const bg = '#0d1117', bar = '#1b2230', ink = '#d8dee6', muted = '#9aa7b6', green = '#5fd38a', cyan = '#7cc7ff';
    const dot = c => deco(`display:inline-block;width:11px;height:11px;margin-right:6px;border-radius:50%;background-color:${c};vertical-align:middle`);
    const cmd = t => div(`${MONO};color:${ink};background-color:${bg};font-size:12px;line-height:1.7`, span(`color:${green};background-color:${bg};font-weight:700`, 'bl@lemon') + span(`color:${muted};background-color:${bg}`, ':') + span(`color:${cyan};background-color:${bg}`, '~/logs') + span(`color:${muted};background-color:${bg}`, '$ ') + t);
    return div(`${SANS};${WRAP};padding:0;background-color:${bg};color:${ink};border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px #2a3342`,
        div(`display:flex;align-items:center;gap:4px;padding:8px 12px;background-color:${bar};color:${muted}`,
            dot('#ff5f57') + dot('#febc2e') + dot('#28c840')
            + span(`${MONO};flex:1 1 auto;min-width:0;margin-right:39px;text-align:center;color:${muted};background-color:${bar};font-size:11px;line-height:1.6;overflow:hidden;white-space:nowrap;text-overflow:ellipsis`, 'bl@lemon: ~/logs — zsh'))
        + div(`padding:12px 12px 14px;background-color:${bg};color:${ink}`,
            cmd('cat ./tonight.log')
            + div(`margin-top:8px;text-align:left;background-color:${bg};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:10px;background-color:${bg};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:10px;color:${muted};background-color:${bg};font-size:12px;line-height:1.7`, SLOT_TAIL)
            + div(`margin-top:2px;${MONO};color:${ink};background-color:${bg};font-size:12px;line-height:1.7`,
                span(`color:${green};background-color:${bg};font-weight:700`, 'bl@lemon') + span(`color:${muted};background-color:${bg}`, ':') + span(`color:${cyan};background-color:${bg}`, '~/logs') + span(`color:${muted};background-color:${bg}`, '$ ')
                + deco(`display:inline-block;width:8px;height:15px;vertical-align:-3px;background-color:${green};animation:bl-flicker 1.6s steps(2) infinite`, '', 'wink'))));
})();

// ⑦ 학적부 — 학교 서식: 학년 · 반 머리 · 항목 표(출결 · 특기 · 행동 특성) · 담임 의견(로그) · 분홍 「참 잘했어요」 동그라미 도장(누르면 통)
const school = (() => {
    const ink = '#22302a', muted = '#4f6157', green = '#2f6b4f', paper = '#fdfefb', line = '#c9d8cd', head = '#e6efe8', pink = '#c2185b';
    const tr = (k, v) => div(`display:flex;border-top:1px solid ${line};background-color:${paper};color:${ink}`,
        span(`flex:0 0 74px;box-sizing:border-box;padding:7px 8px;border-right:1px solid ${line};background-color:${head};color:${green};font-size:12px;font-weight:700;line-height:1.5;text-align:center`, k)
        + span(`flex:1 1 auto;min-width:0;padding:7px 10px;background-color:${paper};color:${ink};font-size:13px;line-height:1.5`, v));
    return div(`${SANS};${WRAP};padding:14px;background-color:#e3ece4;color:${ink};border-radius:10px`,
        div(`position:relative;padding:14px;background-color:${paper};color:${ink};border:1px solid ${line};border-radius:4px`,
            div(`display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding-bottom:8px;border-bottom:2px solid ${green};background-color:${paper};color:${ink}`,
                span(`${SERIF};color:${green};background-color:${paper};font-size:16px;font-weight:800;letter-spacing:.12em;line-height:1.5`, '학교 학적부')
                + span(`margin-left:auto;color:${muted};background-color:${paper};font-size:11px;line-height:1.5`, '2학년 · 마음반 · 관찰 기록'))
            + div(`margin-top:12px;padding-right:62px;text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
            + deco(`position:absolute;right:12px;top:52px;display:block;width:58px;height:58px;box-sizing:border-box;border:3px solid ${pink};border-radius:50%;background-color:${paper};color:${pink};font-size:11px;font-weight:900;line-height:15px;text-align:center;padding-top:12px;transform:rotate(12deg)`, '참 잘<br>했어요', 'bounce')
            + div(`margin-top:12px;border:1px solid ${line};border-top:0;background-color:${paper};color:${ink}`,
                tr('출결', '개근 · 매일 마주침') + tr('특기', '몰래 웃기 · 눈 맞추기') + tr('행동 특성', '함께 있으면 말이 많아짐'))
            + div(`margin:14px 0 6px;color:${green};background-color:${paper};font-size:12px;font-weight:800;letter-spacing:.14em;line-height:1.6`, '✎ 담임 의견')
            + div(`background-color:${paper};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:12px;text-align:right;color:${muted};background-color:${paper};font-size:12px;line-height:1.6`, SLOT_TAIL)));
})();

// ⑧ 전보 — 누런 전보 용지: 줄무늬 테 · TELEGRAM 머리 · 수신 · 발신 · 접수 칸 · 타자 글 로그 · 소인(누르면 빙글) · STOP
const telegram = (() => {
    const ink = '#2e2a1c', muted = '#5e563a', red = '#9c2a1c', paper = '#fbf4d9', line = '#d6c891';
    const field = (k, v) => div(`flex:1 1 120px;min-width:0;padding:5px 0;border-bottom:1px solid ${line};background-color:${paper};color:${ink}`,
        span(`${MONO};color:${muted};background-color:${paper};font-size:11px;font-weight:700;letter-spacing:.12em;line-height:1.6`, k) + ' '
        + span(`${MONO};color:${ink};background-color:${paper};font-size:13px;font-weight:700;line-height:1.6`, v));
    return div(`${SANS};${WRAP};padding:8px;background-color:#e7d9a6;color:${ink};border-radius:4px`,
        deco('display:block;height:8px;background:repeating-linear-gradient(-45deg,#9c2a1c 0 8px,#fbf4d9 8px 14px,#1f4e8c 14px 22px,#fbf4d9 22px 28px)')
        + div(`position:relative;padding:12px 14px 14px;background-color:${paper};color:${ink}`,
            div(`display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;background-color:${paper};color:${ink}`,
                span(`${SERIF};color:${red};background-color:${paper};font-size:18px;font-weight:900;letter-spacing:.36em;line-height:1.4`, '電報')
                + span(`${MONO};color:${ink};background-color:${paper};font-size:12px;font-weight:700;letter-spacing:.3em;line-height:1.4`, 'TELEGRAM'))
            + deco(`position:absolute;right:12px;top:8px;display:block;width:50px;height:50px;box-sizing:border-box;border:2px solid ${red};border-radius:50%;background-color:${paper};color:${red};${MONO};font-size:9px;font-weight:700;line-height:12px;text-align:center;padding-top:8px;transform:rotate(-14deg)`, '빠른<br>우편<br>11·09', 'spin')
            + div(`display:flex;flex-wrap:wrap;gap:0 14px;margin-top:10px;padding-right:44px;background-color:${paper};color:${ink}`,
                field('수신', '너에게') + field('발신', '나로부터') + field('접수', '밤 11:09') + field('급수', '지급'))
            + div(`margin-top:12px;text-align:left;background-color:${paper};color:${ink}`, SLOT_HEAD)
            + div(`margin-top:10px;background-color:${paper};color:${ink}`, SLOT_BODY)
            + SLOT_INFO
            + div(`margin-top:12px;${MONO};text-align:center;color:${red};background-color:${paper};font-size:12px;font-weight:700;letter-spacing:.2em;line-height:1.6`, SLOT_TAIL))
        + deco('display:block;height:8px;background:repeating-linear-gradient(-45deg,#9c2a1c 0 8px,#fbf4d9 8px 14px,#1f4e8c 14px 22px,#fbf4d9 22px 28px)'));
})();

export const SCENE_CATEGORY = { id: 'scene', label: '장면 글꾸' };
// 색 역할은 반응 · 심플 글꾸와 같아요(log-copy-template.js TEMPLATE_ROLES) — face 는 {{head}} 가 놓이는 바탕 · panel/panel2 는 메시지 칸
export const SCENE_FRAMES = [
    { id: 'c-scene-sp-1', label: '사랑 재판', emoji: '⚖️', desc: '연애법원 공판 조서 — 사건 · 원고 · 피고 칸, 진술 기록, 주문 칸 · 붉은 판결 도장을 누르면 쿵', template: court, messages: 'box', tail: '위 조서는 진실임을 확인함 · 서기', type: { font: 'serif', size: 22, weight: 800, align: 'center', tracking: 0.04 },
        colors: { bg: '#efe7d6', face: '#fffdf8', faceText: '#2b2622', faceMuted: '#5f554a', panel: '#fffdf8', panel2: '#f5efe2', text: '#2b2622', dialogue: '#a3192c', thought: '#2f4f8f', emphasis: '#7a5300', mark: '#f7e3a1', quoteBar: '#a3192c', name: '#a3192c', muted: '#5f554a', chip: '#efe7d6', chipText: '#2b2622', accent: '#2b2622', onAccent: '#fffdf8', line: '#d8cdb8', deco1: '#a3192c', deco2: '#d8cdb8', deco3: '#fffdf8' } },
    { id: 'c-scene-sp-2', label: '속보 방송', emoji: '📺', desc: '어두운 뉴스 화면 — LIVE 점이 깜박, 로그는 방송 자막처럼, 아래 띠에 속보가 흘러요 · 안테나를 누르면 흔들', template: news, messages: 'subtitle', tail: '지금까지 BLN 24 였어요', type: { font: 'display', size: 22, weight: 800, align: 'left' },
        colors: { bg: '#0b1222', face: '#121c33', faceText: '#eef2f8', faceMuted: '#a9b4c8', panel: '#121c33', panel2: '#1b2744', text: '#eef2f8', dialogue: '#ffd34d', thought: '#5aa9ff', emphasis: '#ff8a8a', mark: '#5a4a12', quoteBar: '#d72638', name: '#ffd34d', muted: '#a9b4c8', chip: '#1f2c4c', chipText: '#eef2f8', accent: '#d72638', onAccent: '#ffffff', line: '#2c3a5e', deco1: '#d72638', deco2: '#ffd34d', deco3: '#1b2744' } },
    { id: 'c-scene-sp-3', label: '탑승권', emoji: '✈️', desc: '편도 탑승권 — 출발 NOW · 도착 US 큰 글씨, 편명 · 좌석 · 게이트 칸, 점선 아래 로그 · 바코드 · 비행기를 누르면 휙', template: boarding, messages: 'box', tail: '즐거운 여행 되세요', type: { font: 'sans', size: 20, weight: 800, align: 'left' },
        colors: { bg: '#dfe9f3', face: '#ffffff', faceText: '#1d2b3e', faceMuted: '#4f6075', panel: '#ffffff', panel2: '#eef4fa', text: '#1d2b3e', dialogue: '#00766a', thought: '#8a2fa8', emphasis: '#a8321f', mark: '#fde9a6', quoteBar: '#1f5fa8', name: '#1f5fa8', muted: '#4f6075', chip: '#e3edf7', chipText: '#1d2b3e', accent: '#1f5fa8', onAccent: '#ffffff', line: '#cfdae6', deco1: '#1f5fa8', deco2: '#cfdae6', deco3: '#ffffff' } },
    { id: 'c-scene-sp-4', label: '레시피 카드', emoji: '🍳', desc: '줄 친 색인 카드 레시피 — 조리 시간 · 인분 · 난이도, 재료 목록, 만드는 법(로그) · 셰프의 한마디 · 프라이팬을 누르면 흔들', template: recipe, messages: 'box', tail: '맛있게 드세요', type: { font: 'hand', size: 28, weight: 700, align: 'left' },
        colors: { bg: '#f4e6cf', face: '#fffcf5', faceText: '#3a2a1e', faceMuted: '#6c5643', panel: '#fffcf5', panel2: '#f7ead6', text: '#3a2a1e', dialogue: '#b23a2e', thought: '#2f6a6a', emphasis: '#7a4fa0', mark: '#fbe08a', quoteBar: '#b23a2e', name: '#b23a2e', muted: '#6c5643', chip: '#f7ead6', chipText: '#3a2a1e', accent: '#b23a2e', onAccent: '#ffffff', line: '#ead9c0', deco1: '#b23a2e', deco2: '#ead9c0', deco3: '#fffcf5' } },
    { id: 'c-scene-sp-5', label: '타로 리딩', emoji: '🔮', desc: '금테 별 카드(XVII) · 과거 · 현재 · 미래 작은 카드 셋을 누르면 뒤집혀요 · 로그는 오늘의 리딩', template: tarot, messages: 'box', tail: '카드는 오늘 당신 편이에요', type: { font: 'serif', size: 22, weight: 700, align: 'center', tracking: 0.06 },
        colors: { bg: '#17112a', face: '#17112a', faceText: '#f1ebff', faceMuted: '#c2b6dc', panel: '#231a3d', panel2: '#2e2350', text: '#f1ebff', dialogue: '#f2d27a', thought: '#6cc4ff', emphasis: '#ff7aa8', mark: '#5b4520', quoteBar: '#e8c766', name: '#f2d27a', muted: '#c2b6dc', chip: '#2e2350', chipText: '#f1ebff', accent: '#e8c766', onAccent: '#17112a', line: '#463a6e', deco1: '#e8c766', deco2: '#3a2c63', deco3: '#2e2350' } },
    { id: 'c-scene-sp-6', label: '터미널', emoji: '💻', desc: '어두운 터미널 창 — 신호등 세 점 · $ cat ./tonight.log 로 로그가 출력되고, 끝 줄 커서가 깜박(누르면 찡긋)', template: terminal, messages: 'box', tail: 'exit 0 · 로그 끝', type: { font: 'mono', size: 18, weight: 700, align: 'left', ink: 'accent' },
        colors: { bg: '#0d1117', face: '#0d1117', faceText: '#d8dee6', faceMuted: '#9aa7b6', panel: '#161b22', panel2: '#1f2630', text: '#d8dee6', dialogue: '#ffd27a', thought: '#3d9bff', emphasis: '#ff8f8f', mark: '#3d3a14', quoteBar: '#5fd38a', name: '#5fd38a', muted: '#9aa7b6', chip: '#1f2630', chipText: '#d8dee6', accent: '#5fd38a', onAccent: '#0d1117', line: '#2a3342', deco1: '#5fd38a', deco2: '#7cc7ff', deco3: '#1f2630' } },
    { id: 'c-scene-sp-7', label: '학적부', emoji: '📋', desc: '학교 학적부 서식 — 출결 · 특기 · 행동 특성 표, 담임 의견(로그) · 분홍 「참 잘했어요」 도장을 누르면 통', template: school, messages: 'box', tail: '위 학생은 오늘도 참 잘했어요', type: { font: 'sans', size: 20, weight: 800, align: 'left' },
        colors: { bg: '#e3ece4', face: '#fdfefb', faceText: '#22302a', faceMuted: '#4f6157', panel: '#fdfefb', panel2: '#eef4ef', text: '#22302a', dialogue: '#0b7440', thought: '#3b4fa0', emphasis: '#b0124f', mark: '#fff0a0', quoteBar: '#2f6b4f', name: '#2f6b4f', muted: '#4f6157', chip: '#e6efe8', chipText: '#22302a', accent: '#2f6b4f', onAccent: '#ffffff', line: '#c9d8cd', deco1: '#c2185b', deco2: '#c9d8cd', deco3: '#fdfefb' } },
    { id: 'c-scene-sp-8', label: '전보', emoji: '📠', desc: '누런 전보 용지 — 빨강 · 파랑 줄무늬 테, 수신 · 발신 · 접수 칸, 타자 글 로그 · 소인을 누르면 빙글 · 끝은 STOP', template: telegram, messages: 'box', tail: '— STOP —', type: { font: 'mono', size: 18, weight: 800, align: 'left', tracking: 0.04 },
        colors: { bg: '#e7d9a6', face: '#fbf4d9', faceText: '#2e2a1c', faceMuted: '#5e563a', panel: '#fbf4d9', panel2: '#f3e9c2', text: '#2e2a1c', dialogue: '#9c2a1c', thought: '#1f4e8c', emphasis: '#8a5a00', mark: '#f2d36b', quoteBar: '#9c2a1c', name: '#9c2a1c', muted: '#5e563a', chip: '#f3e9c2', chipText: '#2e2a1c', accent: '#9c2a1c', onAccent: '#ffffff', line: '#d6c891', deco1: '#9c2a1c', deco2: '#1f4e8c', deco3: '#fbf4d9' } },
];
