// 글꾸 마트 표본 글 · 표본 화면 색 · 화면 글꼴 · 칸 값 — tools/mart-build.mjs(미리보기 · HTML 복사)와 tools/mart/parts-plan.mjs(부품 고르기)가 같이 써요
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { dateLabel } = await import(pathToFileURL(path.join(ROOT, 'src', 'log-copy-presets.js')).href);
// ── 표본 글: 지어낸 글(세라피나 · 숲 오두막) — 커뮤니티 시연(outputs/공지-1000/할로윈-시연-만들기.mjs)과 같은 꼴 ──
// 미리보기와 「HTML 복사」(테마 없이 커뮤니티 글에 바로 붙여 쓰는 완성 HTML)는 같은 것이에요 — 보이는 그대로 복사돼요.
const FONT = { 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'letter-spacing': '-0.025em', 'line-height': '1.7', color: '#1c2a3a' };
// 표본 화면 색(SAMPLE_SCREEN) — 실제 채팅 복사처럼 글자 효과마다 다른 색을 써 두면, 테마가 틀 색 묶음으로 바꿔 입혀요(conceptModel → recolorLog: dialogue · em · strong · marker · muted · line …)
export const SAMPLE_SCREEN = { bg: '#ffffff', surface: '#ffffff', raised: '#f3f5f8', text: '#1c2a3a', dialogue: '#b4572a', em: '#6b4fa0', strong: '#9a2f4a', marker: '#fff1a8', muted: '#6b7785', faint: '#8a95a3', accent: '#2f7cf6', pop: '#2f7cf6', line: '#d5dbe3' };
const S = SAMPLE_SCREEN;
const run = (t, style = {}, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children: [{ t: 'text', text: t }] });
const para = (...parts) => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { margin: '0 0 8px' }, children: parts.map(x => (typeof x === 'string' ? { t: 'text', text: x } : x)) });
const say = t => run(t, { color: S.dialogue }, 'dialogue');                                  // "따옴표 대사"
// 대사 배경: 테마 대사 모양 「형광펜」(기본 · settings.js dialogue.style marker · 가운데 54% 띠)을 복사한 꼴 그대로 — 띠 색은 형광펜 화면 색이라 틀 형광펜 색(mark)으로 바뀌어요
const sayBand = t => run(t, { color: S.dialogue, 'background-image': `linear-gradient(transparent 23%, ${S.marker} 23%, ${S.marker} 77%, transparent 77%)` }, 'dialogue');
const think = t => run(t, { color: S.em, 'font-style': 'italic' }, 'em');                    // 『속마음』
const bold = t => run(t, { color: S.strong, 'font-weight': '700' }, 'strong');               // **강조**
const marker = t => run(t, { 'background-color': S.marker }, 'mark');                        // 형광펜
const del = t => run(t, { 'text-decoration-line': 'line-through', 'text-decoration-color': S.muted }, 'del');   // ~~취소선~~
const lean = t => run(t, { 'font-style': 'italic' }, 'em');                                   // 기울임
const small = t => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { color: S.muted, 'font-size': '13px', margin: '0 0 8px' }, children: [{ t: 'text', text: t }] });   // 작은 글 · 상태 줄
const heading = t => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { 'font-weight': '700', color: S.dialogue, margin: '6px 0 2px' }, children: [{ t: 'text', text: t }] });   // 소제목 — 강조색(대사색) 굵게 · 강조(**굵게**)는 진한 강조색이라 둘이 달라요
const rule = { t: 'hr', style: { 'border-top': `1px solid ${S.line}`, margin: '10px 0' } };
const msg = (user, name, time, nodes) => ({ index: null, user, name, nameStyle: { color: user ? S.accent : S.text, 'font-family': FONT['font-family'], 'font-size': '14px', 'font-weight': '700', 'letter-spacing': '-0.025em' }, time, font: { ...FONT }, bubble: null, nodes });
const T0 = Date.UTC(2026, 10, 3, 12, 0);
// 1.0.0 홈페이지 사진의 씨앗 채팅(세라피나 · 숲의 오두막) — 대사 · 속마음 · 강조 · 형광펜 · 취소선 · 기울임 · 작은 글 · 소제목 · 구분선 · 상태 줄 · 대사 배경(여행자 「고마워요.」)이 한 번씩 다 보여요
export const SAMPLE = {
    chatName: 'Seraphina', userName: '여행자', base: { bg: S.bg, ...FONT }, images: [],
    messages: [
        msg(false, 'Seraphina', T0, [
            para('창밖으로 숲 바람이 스며들었다. 세라피나는 식은 찻잔을 내려놓고 ', bold('천천히'), ' 고개를 들었다.'),
            para(say('"깨어났네요. 상처는 거의 다 아물었어요."')),
            para('그녀가 손끝으로 이마를 짚자 ', marker('옅은 분홍빛'), '이 번졌다. 머리맡의 작은 등불이 한 번 깜박였다.'),
            heading('세라피나의 속마음'),
            para(think('『다행이다… 숲이 이 사람을 받아 주었어.』')),
        ]),
        msg(true, '여행자', T0 + 60000, [para('여기가 어디예요? 숲에서 길을 잃은 것까지는 기억나는데.')]),
        msg(false, 'Seraphina', T0 + 120000, [
            small('【오후 5시 · 맑음 · 엘도리아 숲 오두막】'),
            para(say('"엘도리아 숲 안쪽, 제 오두막이에요."'), ' 세라피나가 창문을 조금 더 열었다.'),
            para('그녀는 말린 허브 한 줌을 주전자에 넣었다. ', del('당장 떠나라고 할 생각은'), ' 처음부터 없었다.'),
            rule,
            para(lean('레몬밤 향이 오두막에 천천히 번졌다.')),
        ]),
        msg(true, '여행자', T0 + 180000, [para(sayBand('"고마워요."'), ' 차 냄새가 좋네요.')]),
    ],
};
export const UI = { family: "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", tracking: '-0.025em' };
// 1.0.1(11-04 사용자 「위에 세라피나 있는 곳을 타이틀이라고」 · 「깡통 / 모델 / 프롬프트 예시 문구」): 큰 제목 칸은 「Title」 · 그 아래 알약 셋
export const FIELDS = { title: 'Title', mark: 'LOG', char: '세라피나', model: 'Argon', prompt: '천사깡', date: dateLabel(T0), from: '여행자', tail: '', info: '', page: '1', subtitle: '' };
