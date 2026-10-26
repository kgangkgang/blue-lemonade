// 시험 고정물 (시험 아님): 프리셋별 모델 답 꼴 그대로 지어낸 메시지 + 그 프리셋의 표시 정규식(찾기는 원작 그대로, 바꿀 글은 style · 그림을 뺀 뼈대).
//   인물 · 장소는 지어낸 것이에요. 데우스 2.5 · 데우스 V3 · 레모나(데우스식 시간 상태창) · 과일 6.4 · 청과 2.0 · 야한 과일 2.0.

const prose = (open = '<prose>', close = '</prose>') => `${open}
Rain needled the window. Rex leaned against the doorframe, arms folded, watching the city lights blur into long streaks of gold.

<span style="color:#e06c75">「まだ起きてたのか。」</span>

Mina did not look up from the book in her lap. The lamp beside her painted half her face amber, the other half lost in shadow.

<span style="color:#61afef">「眠れないの。雨の音がうるさくて。」</span>

He crossed the room in three slow strides and sat on the edge of the bed. <true_thoughts character="Rex">She looks tired. Don't push.</true_thoughts>

<shout><span style="color:#e06c75">「いい加減にしろ！」</span></shout> The words came out harsher than he meant, and he winced at his own voice.

<whispering><span style="color:#61afef">「……ごめん。」</span></whispering> Mina closed the book and finally met his eyes.
${close}`;

export const TRACKER = '<tracker> 🌙 11:42 PM | October 27, Tuesday, 2026 | Seoul → Hannam Apartment → Bedroom | 🌧️ Light rain, 12°C </tracker>';
export const TRACKER_25 = '<tracker> 🌅 Morning | April 2, Tuesday, 2030 | Old Town → Library → Reading Room | ☀️ Clear, 19°C </tracker>';
const THINK_ROWS = `- Context: Rex came home late; Mina is awake and avoiding him.
- Knowledge: none
- Constraints: @Anti-Positivity Bias — temptation to resolve the fight at once; counter: keep it unresolved.
- Story progression: next beat via @Plot Guidance, per @Pacing.
- @Prose Length: 400 words, 6 paragraphs`;

export const FIXTURES = {
    // 데우스 2.5: 시간 상태창 + 장면 계획(숨은 블록) + <prose> 본문
    deus25: `<scene_plan>
Phase 1 — Inputs: Rex is late. Phase 2 — Plan: keep tension.
</scene_plan>

${TRACKER_25}

${prose()}`,
    // 데우스 V3: 시간 상태창(Exact Time) + <prose>
    deusV3: `${TRACKER}

${prose()}`,
    // 데우스 V3 + Gemini 버릇: 상태창을 코드칸(```)에 싸서 씀 — V3 정규식 「Unwrap @Tracker from code backticks」가 화면에서 풀어요
    deusV3Fenced: `\`\`\`
${TRACKER}
\`\`\`

${prose()}`,
    // 데우스 V3 「Thinking (FALLBACK)」: 생각을 태그 없이 줄로 쓴 답 — 화면에서는 접힌 「Thinking Plan」 카드
    deusV3Fallback: `${THINK_ROWS}

${TRACKER}

${prose()}`,
    // 레모나 5.15: 데우스식 시간 상태창 + 본문(prose 감싸개 없음)
    lemona: `${TRACKER.replace('🌙 11:42 PM', '🕖 7:40 PM').replace('October 27, Tuesday, 2026', 'March 14, 2026, Saturday')}

${prose('', '').trim()}`,
    // 과일 6.4: ECoT 생각 + 숨은 주석 + 상태창(日期： 꼴, 영어 값) + <content> 본문 + 숨는 disclaimer
    fruit64: `<ECoT>
Step 1: confirm the task. Step 2: plan the scene.
</ECoT>
<!-- 自检：节奏正常

输出结果 -->
<status_bar>
日期：Monday, October 27
时间：11:42 PM
天气：Light rain, 12℃
地点：Hannam apartment · bedroom
题记：The rain remembers what we choose to forget.
之间：Half a step · an umbrella still folded
</status_bar>
${prose('<content>', '</content>')}
<disclaimer>This is fiction.</disclaimer>`,
    // 청과 2.0: 상태창([Info|…] 꼴, 중국어 값) + 본문(중국어) + 요약 meow_FM + 인물표 profile + 선택지 branches
    qingguo: `<ECoT>
确认任务。规划剧情。
</ECoT>
<status_bar>
[Info|10月27日 星期二|下午 14:30|晴 微风 26℃|港城半山别墅-玄关]
[Quote|雨记得我们选择遗忘的一切。]
[Outfit|白衬衫 黑色长裤|灰色毛衣]
</status_bar>
<content>
雨点敲打着窗户。雷克斯靠在门框上，双臂交叉，看着城市的灯光变得模糊。

<span style="color:#e06c75">“你还没睡？”</span>

米娜没有抬头。
</content>
<meow_FM>
serial:🍎No.012
time: <time>2026.10.27.星期二☆14:30-14:45
scene:别墅玄关</time>
plot:雷克斯回家很晚，米娜假装在看书。
echo：“你还没睡？”——雷克斯
</meow_FM>
<profile>
| 名字 | 身份 | 衣着 |
|---|---|---|
| 米娜 | 学生 | 灰色毛衣 |
<!--果农草稿:关系-->
\`\`\`mermaid
graph TD
A[米娜]-->|同居|B[雷克斯]
\`\`\`
</profile>
<branches>
<details><summary>🍊剧情分支</summary>

A.米娜合上书，问雷克斯为什么回来晚了。
B.雷克斯一言不发地走进浴室。
</details>
</branches>`,
    // 야한 과일 2.0: 상태창([Info|…] 꼴) + 본문 + 小剧场 snow(html 코드칸: style · script 포함) + meow_FM
    yahan: `<status_bar>
[Info|10月27日 星期二|晚上 23:42|小雨 12℃|公寓-卧室]
[Quote|The rain remembers what we choose to forget.]
[Outfit|White shirt|Grey sweater]
</status_bar>
${prose('<content>', '</content>')}
<snow>
<details><summary>汐见：雨夜电台</summary>
<!-- 设计思路 -->
<p style="text-align: center;font-size: 0.65em;font-style: italic">Tonight the radio only plays rain.</p>
\`\`\`html
<!DOCTYPE html><html><head><style>body{height:auto;background:#123;color:#eee;font-family:serif}.btn{padding:8px 12px;border-radius:8px;background:#345}</style></head><body><div class="radio"><h3>Rain Radio</h3><button class="btn" onclick="next()">Next song</button><p id="now">Now playing: Quiet Rain</p></div><script>const songs=["Quiet Rain","Neon Puddles"];let i=0;function next(){i=(i+1)%songs.length;document.getElementById("now").textContent="Now playing: "+songs[i];}</script></body></html>
\`\`\`
</details>
</snow>
<meow_FM>
serial:🍎No.013
time: <time>2026.10.27.星期二☆23:42-23:50
scene:公寓卧室</time>
plot:Rex came home late and Mina pretended to read.
</meow_FM>`,
};

// 표시 정규식 (원작 찾기 그대로 · 바꿀 글은 뼈대만). 순서는 원작 순서.
const V3_TRACKER = {
    find: String.raw`/<tracker\b[^>]*>[*_\s]*(?:\[[*_\s]*)?(?:((?:[⌀-⯿〰〽㊗㊙©®\uD800-\uDFFF️‍]+))[*_\s]*)?([^\s*_|"](?:[^|"]*?[^\s*_|"])?)[*_\s]*\|[*_\s]*([^\s*_|](?:[^|]*?[^\s*_|])?)[*_\s]*\|[*_\s]*([^\s*_|](?:[^|]*?[^\s*_|])?)[*_\s]*\|[*_\s]*(?:((?:[⌀-⯿〰〽㊗㊙©®\uD800-\uDFFF️‍]+))[*_\s]*)?([^|<"]*?)[\s,;]*(-?\d+(?:\.\d+)?(?:\s*[-–—~]\s*-?\d+(?:\.\d+)?)?)(?:\s*(?:(?:°|º|deg(?:rees?)?\s*)?([CF])(?:elsius|ahrenheit)?(?:(?:\s*[,;]\s*|\s+)([^\s|<"\]\d,;][^|<"\]]{0,31}?))?|[°º]))?[*_\s]*(?:\][*_\s]*)?<\/tracker\s*>/gim`,
    replace: '<div class="dem-track" data-t="$2" data-w="$5 $6 $1"><div class="dem-track__grid"><i class="dem-track__scene" aria-hidden="true"></i><div class="dem-track__time"><span class="dem-track__glyph">$1</span><span class="dem-track__clock">$2</span></div><div class="dem-track__date">$3</div><div class="dem-track__place"><span class="dem-track__crumb">$4</span></div><div class="dem-track__wx"><span class="dem-track__sky"><span class="dem-track__glyph">$5</span>$6</span><span class="dem-track__temp">$7°$8<span class="dem-track__tq">$9</span></span></div></div><div class="dem-track__rule" aria-hidden="true">✦</div></div>',
};
const V3_UNWRAP = { find: String.raw`/(\`{1,3})(?:[a-z]{0,12}[ \t]*\r?\n)?[ \t]*(<tracker\b[^>\`]{0,200}>[^\`]{0,2000}?<\/tracker\s*>)[ \t]*\r?\n?[ \t]*\1(?!\`)/gi`, replace: '$2' };
const V3_CRUMBS = { find: String.raw`/(?=[ \t]*(?:→|->|⟶|➜|➞))(?<=<span class="dem-track__crumb">[^<\r\n]{0,512})[ \t]*(?:→|->|⟶|➜|➞)[ \t]*|(?=,[ \t])(?<=<span class="dem-track__crumb">[^<\r\n>→⟶➜➞]{0,512}),[ \t]*(?=[^<\r\n>→⟶➜➞]{0,512}<\/span>)/g`, replace: '</span><span class="dem-track__sep" aria-hidden="true">›</span><span class="dem-track__crumb">' };
const V3_FALLBACK = { find: String.raw`/<tracker\b[^>]*>\s*([\s\S]*?)\s*<\/tracker\s*>/gim`, replace: '<details open class="dem-card dem-tracker"><summary><span class="dem-card__title">Tracker</span><span class="dem-card__tag">Recovered</span></summary><div class="dem-card__body">$1</div></details>' };
const D25_TRACKER = {
    find: String.raw`/<tracker\b[^>]*>\s*\[?\s*(\S+)\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(?:(\S+)\s+)?([^|<]*?)\s*(?:,|;)?\s*(-?\d+(?:\.\d+)?)\s*(?:°|º|deg(?:rees?)?\s*)?([CF])(\s*\([^()<]{1,60}\))?\s*\]?\s*<\/tracker\s*>/gim`,
    replace: '<div class="dem-track"><div class="dem-track__item dem-track__item--time"><span class="dem-track__icon">$1</span><span class="dem-track__value">$2</span></div><div class="dem-track__item dem-track__item--date"><span class="dem-track__icon">🗓️</span><span class="dem-track__value">$3</span></div><div class="dem-track__item dem-track__item--location"><span class="dem-track__icon">📍</span><span class="dem-track__value">$4</span></div><div class="dem-track__item dem-track__item--weather"><span class="dem-track__icon">$5</span><span class="dem-track__value">$6$9</span><span class="dem-track__temp">$7°$8</span></div></div>',
};
const D25_FALLBACK = { find: String.raw`/<tracker\b[^>]*>\s*([\s\S]*?)\s*<\/tracker\s*>/gim`, replace: '<details open class="dem-track" open><summary><span class="dem-card__title">@Tracker</span><span class="dem-card__tag">Recovered</span></summary><div class="dem-card__body">$1</div></details>' };
const COLOR = { find: String.raw`/<span\b(?=[^>]*\bstyle\s*=\s*"[^"]*\bcolor\s*:\s*([^;"']+)[^"]*")[^>]*>([\s\S]*?)<\/span>/gi`, replace: '<font color="$1">$2</font>' };
const FRUIT_STATUS = { find: String.raw`/<status_bar>([\s\S]*?)<\/status_bar>/i`, replace: '```html\n<!DOCTYPE html><html><body><div class="fate-status-wrapper"><div class="fate-raw" hidden>$1</div></div></body></html>\n```' };
const INFO_STATUS = { find: String.raw`/<status_bar>\s*\[Info\|(.*?)\|(.*?)\|(.*?)\|(.*?)\]\s*\[Quote\|(.*?)\]\s*\[Outfit\|(.*?)\|(.*?)\]\s*<\/status_bar>/s`, replace: '```html\n<!DOCTYPE html><html><body><div class="fate-status-wrapper" data-date="$1" data-time="$2"><p>$3</p><p>$4</p><p>$5</p><p>$6</p><p>$7</p></div></body></html>\n```' };
const MEOW = { find: String.raw`/<meow_FM>\s+serial[:：](.+?)\s*time[:：](.+?)\s*scene[:：](.+?)\s*plot[:：](.+?)\s*(?:seeds[:：]\s?(.+?))?\s*</[^bp>]*>/si`, replace: '<div class="meow-fm-ghost"><details><summary><span>$1</span><span>$2</span></summary><div><div>→ $3</div><div>$4</div></div></details></div>' };
const HIDE_FRUIT = { find: String.raw`/^[\s\S]*\[finire\]\s?|\s?<finish>[\s\S]*</finish>|\s?<disclaimer>[\s\S]*</disclaimer>|\s?<!--[\s\S]*?-->|(?<=<p style)-/gi`, replace: '' };

export const DISPLAY_REGEX = {
    deus25: [D25_TRACKER, D25_FALLBACK, COLOR],
    deusV3: [V3_UNWRAP, V3_TRACKER, V3_CRUMBS, V3_FALLBACK, COLOR],
    lemona: [V3_UNWRAP, V3_TRACKER, V3_CRUMBS, V3_FALLBACK, COLOR],
    fruit64: [HIDE_FRUIT, FRUIT_STATUS, COLOR],
    qingguo: [HIDE_FRUIT, MEOW, INFO_STATUS, COLOR],
    yahan: [HIDE_FRUIT, MEOW, INFO_STATUS, COLOR],
};
DISPLAY_REGEX.deusV3Fenced = DISPLAY_REGEX.deusV3Fallback = DISPLAY_REGEX.deusV3;
