// 시험 고정물 (시험 아님): 데우스 V4(v4.0) 새 모듈 — 운명의 주사위(<fate>) · 일기장(<diary>) · 새 얼굴(<face> · <extra>) 답 꼴 + 그 표시 정규식.
//   찾기는 데우스 V4 원작 그대로, 바꿀 글은 style · svg · 인라인 style · 안내 문장을 뺀 뼈대(원작 프리셋에서 뽑음). 인물 · 장소 · 문장은 지어낸 것이에요.
// 출처 · 라이선스: 이 파일의 표시 정규식(찾기 식 · 바꿀 글의 뼈대)은 데우스 엑스 마키나(Deus ex Machina, lsennn —
//   https://github.com/lsennn/Deus-ex-machina · V4 https://github.com/lsennn/Deus-ex-machina/releases/tag/v4.0) 프리셋에서 옮긴 것이에요. 원작은 CC BY-NC-SA 4.0
//   (https://creativecommons.org/licenses/by-nc-sa/4.0/) 이라 이 파일만 테마의 다른 파일(AGPL-3.0)과 달리 CC BY-NC-SA 4.0 조건으로 배포해요
//   — 비상업 목적으로, 같은 조건으로만 다시 나눌 수 있어요. 바꾼 것: 바꿀 글에서 style · 그림 · 안내 문장을 뺐어요. 메시지 · 인물은 지어낸 것이에요. 원작자의 보증을 뜻하지 않아요.
const V4_FATE_PASS_LANDING = { find: "/\\n{0,2}<fate odds=\"((?:1(?=\\d\" roll=\"0)|2(?=\\d\" roll=\"[01])|3(?=\\d\" roll=\"[0-2])|4(?=\\d\" roll=\"[0-3])|5(?=\\d\" roll=\"[0-4])|6(?=\\d\" roll=\"[0-5])|7(?=\\d\" roll=\"[0-6])|8(?=\\d\" roll=\"[0-7])|9(?=\\d\" roll=\"[0-8]))\\d|(?<tens>\\d)(?=\\d\" roll=\"\\k<tens>)(?:1(?=\" roll=\"\\d0)|2(?=\" roll=\"\\d[01])|3(?=\" roll=\"\\d[0-2])|4(?=\" roll=\"\\d[0-3])|5(?=\" roll=\"\\d[0-4])|6(?=\" roll=\"\\d[0-5])|7(?=\" roll=\"\\d[0-6])|8(?=\" roll=\"\\d[0-7])|9(?=\" roll=\"\\d[0-8]))|(?:1(?=\" roll=\"00)|2(?=\" roll=\"0[01])|3(?=\" roll=\"0[0-2])|4(?=\" roll=\"0[0-3])|5(?=\" roll=\"0[0-4])|6(?=\" roll=\"0[0-5])|7(?=\" roll=\"0[0-6])|8(?=\" roll=\"0[0-7])|9(?=\" roll=\"0[0-8])))\" roll=\"(\\d\\d)\">\\s*<pass>((?:(?!<\\/?(?:pass|fail|fate)\\b)[\\s\\S])*?)<\\/(?:pass|fail)>\\s*<fail>((?:(?!<\\/?(?:pass|fail|fate)\\b)[\\s\\S])*?)<\\/(?:fail|pass)>\\s*<\\/fate>/gi", replace: "\n\n$4\n\n<div class=\"dem-fate\" data-no-island><span>Fate</span> <span>· rolled $3 · need under $1</span> <span><span aria-hidden=\"true\"></span><b>passed</b></span><span data-no-island></span></div>" };
const V4_FATE_FAIL_LANDING = { find: "/\\n{0,2}<fate odds=\"(\\d\\d?)\" roll=\"(\\d\\d)\">\\s*<pass>((?:(?!<\\/?(?:pass|fail|fate)\\b)[\\s\\S])*?)<\\/(?:pass|fail)>\\s*<fail>((?:(?!<\\/?(?:pass|fail|fate)\\b)[\\s\\S])*?)<\\/(?:fail|pass)>\\s*<\\/fate>/gi", replace: "\n\n$4\n\n<div class=\"dem-fate\" data-no-island><span>Fate</span> <span>· rolled $2 · need under $1</span> <span><span aria-hidden=\"true\"></span><b>failed</b></span><span data-no-island></span></div>" };
const V4_DIARIES_UI_KEEPER = { find: "/(?:^|(?<=>))[ \\t]*(?:(?:\\*\\*|__|#{1,4})[ \\t]*)?([^\\s<*_#:\\-•·](?:[^\\r\\n<:*_]{0,78}[^\\s<:*_])?)[ \\t]*(?:\\*\\*|__)?[ \\t]*:?[ \\t]*(?=\\r?$)(?=(?=([^<]*(?:<(?=\\/?(?:i|b|em|strong|u|s|q|span|font|small|mark|br)\\b)[^<]*){0,64}))\\2(?:<\\/details\\s*>\\s*)?<\\/(?:diary|diaries)\\s*>)/gim", replace: "</div></div><div class=\"dem-diary-book\"><div class=\"dem-diary-keeper\">$1</div><div class=\"dem-diary-entries\">" };
const V4_DIARIES_UI_ENTRY = { find: "/(?:^|(?<=>))[ \\t]*(?:[-*•·][ \\t]*)?(?:(?:\\*\\*|__)[ \\t]*)?([^\\s<*_:\\-•·](?:(?:[^\\r\\n<:]|:(?![ \\t])){0,118}?[^\\s<:*_])?)[ \\t]*(?:\\*\\*|__)?[ \\t]*:(?:(?:\\*\\*|__)[ \\t]+|[ \\t]+(?:(?:\\*\\*|__)[ \\t]*)?)(?=([^\\r\\n<]*(?:<(?=\\/?(?:i|b|em|strong|u|s|q|span|font|small|mark|br)\\b)[^\\r\\n<]*){0,64}))\\2(?=\\r?$)(?=(?=([^<]*(?:<(?=\\/?(?:i|b|em|strong|u|s|q|span|font|small|mark|br|div)\\b)[^<]*){0,64}))\\3(?:<\\/details\\s*>\\s*)?<\\/(?:diary|diaries)\\s*>)/gim", replace: "<div class=\"dem-diary-entry\"><span class=\"dem-diary-entry__when\">$1</span><span class=\"dem-diary-entry__text\">$2</span></div>" };
const V4_DIARIES_UI_EMPTY = { find: "/(?:^|(?<=>))[ \\t]*(?:[-*•·][ \\t]*)?(?:None|No entries(?: yet)?)\\.?[ \\t]*(?=\\r?$)(?=(?=([^<]*(?:<(?=\\/?(?:i|b|em|strong|u|s|q|span|font|small|mark|br|div)\\b)[^<]*){0,64}))\\1(?:<\\/details\\s*>\\s*)?<\\/(?:diary|diaries)\\s*>)/gim", replace: "<div class=\"dem-diary-none\">No entries yet</div>" };
const V4_DIARIES_UI = { find: "/<(?:diary|diaries)\\b[^>]{0,256}>(?=[\\s\\S]*?<\\/(?:diary|diaries)\\s*>)(?:\\s*<summary\\b[^>]{0,256}>[^<]{0,256}<\\/summary\\s*>)?(?:\\s*<details\\b[^>]{0,256}>)?(?:\\s*(\\S(?:[\\s\\S]*?\\S)??))??\\s*(?:<\\/details\\s*>\\s*)?<\\/(?:diary|diaries)\\s*>/gim", replace: "<details class=\"dem-card dem-diaries\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">Diaries</span></summary><div class=\"dem-diaries__body\"><div class=\"dem-diary-book\"><div class=\"dem-diary-entries\">$1</div></div></div></details>" };
const V4_NEW_FACES_UI_CALLED = { find: "/<face\\b[^>]{0,256}>(?=(?:(?!<\\/face\\s*>)[\\s\\S])*?^[ \\t]*(?:Called|Seen as):(?![ \\t]*(?:-|–|—|none|n\\/a)?[ \\t]*$)[ \\t]*([^\\n<]*?\\S)[ \\t]*$)(?=[\\s\\S]*?<\\/face\\s*>)\\s*(\\S(?:[\\s\\S]*?\\S)??)\\s*<\\/face\\s*>/gim", replace: "<details class=\"dem-card dem-new-face\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">$1</span><span class=\"dem-card__tag\">Recurring</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```yaml\n$2\n```\n\n</div></details>" };
const V4_NEW_FACES_UI = { find: "/<face\\b[^>]{0,256}>(?=\\s*Name:(?![^|\\n<]*\\bsecret\\b)[ \\t]*([^|\\n<]*?\\S)[ \\t]*(?:\\||$))(?=[\\s\\S]*?<\\/face\\s*>)\\s*(\\S(?:[\\s\\S]*?\\S)??)\\s*<\\/face\\s*>/gim", replace: "<details class=\"dem-card dem-new-face\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">$1</span><span class=\"dem-card__tag\">Recurring</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```yaml\n$2\n```\n\n</div></details>" };
const V4_NEW_FACES_UI_MINOR_SEEN_AS = { find: "/<extra\\b[^>]{0,256}>(?=[^<]*?·[ \\t]*Seen as:(?![ \\t]*(?:-|–|—|none|n\\/a)?[ \\t]*<\\/extra)[ \\t]*([^<·\\n]*?\\S)[ \\t]*<\\/extra\\s*>)(?=[\\s\\S]*?<\\/extra\\s*>)\\s*(\\S(?:[\\s\\S]*?\\S)??)\\s*<\\/extra\\s*>/gi", replace: "<details class=\"dem-card dem-new-face dem-new-face--minor\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">$1</span><span class=\"dem-card__tag\">Passing</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```text\n$2\n```\n\n</div></details>" };
const V4_NEW_FACES_UI_MINOR = { find: "/<extra\\b[^>]{0,256}>(?=\\s*([^·(<\\s](?:[^·(<\\n]*[^·(<\\s])?)[ \\t]*(?:\\((?![ \\t]*secret[ \\t]*\\))[^)<\\n]*\\)[ \\t]*)?·)(?=[\\s\\S]*?<\\/extra\\s*>)\\s*(\\S(?:[\\s\\S]*?\\S)??)\\s*<\\/extra\\s*>/gi", replace: "<details class=\"dem-card dem-new-face dem-new-face--minor\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">$1</span><span class=\"dem-card__tag\">Passing</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```text\n$2\n```\n\n</div></details>" };
const V4_DIARIES_UI_FALLBACK = { find: "/<(?:diary|diaries)\\b[^>]*>(?=[\\s\\S]*?<\\/(?:diary|diaries)\\s*>)(?:\\s*(\\S(?:[\\s\\S]*?\\S)??))??\\s*<\\/(?:diary|diaries)\\s*>/gim", replace: "<details open class=\"dem-card dem-diaries\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">Diaries</span><span class=\"dem-card__tag\">Recovered</span></summary><div class=\"dem-card__body\"><div><div>$1</div></div></div></details>" };
const V4_NEW_FACES_UI_FALLBACK = { find: "/<face\\b[^>]{0,256}>(?=[\\s\\S]*?<\\/face\\s*>)(?:\\s*(\\S(?:[\\s\\S]*?\\S)??))??\\s*<\\/face\\s*>/gi", replace: "<details class=\"dem-card dem-new-face\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">New face</span><span class=\"dem-card__tag\">Recurring</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```yaml\n$1\n```\n\n</div></details>" };
const V4_NEW_FACES_UI_MINOR_FALLBACK = { find: "/<extra\\b[^>]{0,256}>(?=[\\s\\S]*?<\\/extra\\s*>)(?:\\s*(\\S(?:[\\s\\S]*?\\S)??))??\\s*<\\/extra\\s*>/gi", replace: "<details class=\"dem-card dem-new-face dem-new-face--minor\"><summary><span class=\"dem-card__icon\"></span><span class=\"dem-card__title\">New face</span><span class=\"dem-card__tag\">Passing</span></summary><div class=\"dem-new-face__body\"><p class=\"dem-new-face__keep\"></p>\n\n```text\n$1\n```\n\n</div></details>" };
export const V4_MODULE_REGEX = [V4_FATE_PASS_LANDING, V4_FATE_FAIL_LANDING, V4_DIARIES_UI_KEEPER, V4_DIARIES_UI_ENTRY, V4_DIARIES_UI_EMPTY, V4_DIARIES_UI, V4_NEW_FACES_UI_CALLED, V4_NEW_FACES_UI, V4_NEW_FACES_UI_MINOR_SEEN_AS, V4_NEW_FACES_UI_MINOR, V4_DIARIES_UI_FALLBACK, V4_NEW_FACES_UI_FALLBACK, V4_NEW_FACES_UI_MINOR_FALLBACK];

// 운명의 주사위: 「봉인」 정규식이 받은 답에 roll 을 넣은 뒤의 저장본 꼴 (45 아래면 성공 — 72 는 실패)
export const FATE = `<prose>
Rain hammered the dock as Mira raised the lantern. The dockhand watched from the crates.

<span style="color:#3aa7ff">"You're late,"</span> she said.

You lunge for the rope before the boat drifts away.
<fate odds="45" roll="72">
<pass>Your fingers close on the wet rope, and the boat jerks to a stop.</pass>
<fail>The rope slides through your palm, and the boat slips into the dark. <span style="color:#3aa7ff">"Too slow."</span></fail>
</fate>
</prose>`;
export const FACE = `<face>
Name: Tomas Reyes
Seen as: the dockhand
Gender: Male
Age: 34
Occupation: Dockhand, smuggler (secret)
Appearance: Broad shoulders, salt-stained coat
Background: Lost his brother at sea; now trusts no captain
Personality: Quiet, watchful
Speech: Short, clipped sentences
Goal: Pay off his debt to the harbor boss (secret)
Abilities and skills: Knots, night sailing; misreads people
</face>`;
export const EXTRA = '<extra>Old Bess · female, 70s · net mender · grey shawl · hums while working · Seen as: the old woman by the nets</extra>';
export const DIARY = `<diary>
<summary>Diaries</summary>
<details>
Mira
- Night two, the dock: He reached for the rope without thinking. I did not expect that.
Tomas
- None
</details>
</diary>`;
export const V4_REPLY = `${FATE}\n\n${FACE}\n\n${EXTRA}\n\n${DIARY}`;
