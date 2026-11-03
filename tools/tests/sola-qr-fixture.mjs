// 솔라 빠른 설정 시험용 합성 프리셋 — 이름 · id · 본문을 모두 지어냈어요(실제 솔라 프리셋 글 없음).
// 이름 규칙(구역 머리 ━ … ══ · [PICK 1: 꼬리] · [PICK 1: ↓↕↑] · 「… 택1: …」 · (N-M Words))만 원작과 같은 꼴로 따라요.
// 자동화(리그 사진)도 같은 모양을 써요: automation/checks/rig/prepare-sola-fixture.mjs.
const SECTIONS = [
    ['━🧪 00. TEST SOLA\'S MIND ══════════', [
        '🪨 조약돌 솔라 [PICK 1: MIND]', '🏮 등불 솔라 [PICK 1: MIND]', '🌿 고사리 솔라 [PICK 1: MIND]']],
    ['━👁️ 01. POINT OF VIEW (POV) ══════════', [
        '가까운 렌즈 지금 [PICK 1: POV]', '먼 렌즈 그때 [PICK 1: POV]', '혼합 렌즈 시험 (3인칭 세계 + 2인칭 감각) [PICK 1: POV]',
        '달 / 나의 [PICK 1: PRONOUN]', '해 / 너의 [PICK 1: PRONOUN]']],
    ['━📜 02. CORE ══════════', [
        '[PICK 1: ↓] 가벼운 주도권 시험', '[PICK 1: ↕] 꾸며 쓰는 주도권 시험', '[PICK 1: ↑] Director Mode Draft',
        '🌐 언어 택1: 시험 서술 · 시험 대사', '🌐 언어 택1: 다른 서술 · 다른 대사', '시험 핵심 규칙', '🚫 끄면 안 되는 시험 뼈대']],
    ['━✍️ 03. PROSE ══════════', ['[PICK 1: ↓] 상투어 시험 전체', '[PICK 1: ↑] 상투어 시험 가볍게', '시험 문장 다듬기', 'Plain Prose Toggle']],
    ['━🌍 04. WORLD & ACTION ══════════', ['[PICK 1: ↓] 무르기 방지 시험 ⚖️', '[PICK 1: ↑] 잔혹 방지 시험 ⚖️', '살아 있는 시험 세계', '시험 전투 안무 ⚔️']],
    ['━🎙️ 05. VOICE ══════════', ['시험 말투 엔진', '{{char}} 시험 목소리']],
    ['━✨ 07. 꾸미기 ══════════', ['[택1: ↓] 시험 대사 색 가 🎨', '[택1: ↑] 시험 대사 색 나 🎨', '🎨 대사 색상 택1: 시험 자동', '시험 화면 꾸밈 🪶']],
    ['━💓 08. INTIMACY ══════════', ['시험 친밀 장면 💓', '시험 그리움 💓']],
    ['━⏱️ 10. LENGTH & RHYTHM ══════════', ['긴 시험 (900-1200 Words)', '짧은 시험 (100-200 Words)', '느린 시험 전개']],
    ['━📊 11. TELEMETRY & STATE TRACKERS ══════════', ['시험 시간 트래커 🕰️', '시험 감정 엔진 📊', '{{user}} 시험 메모']],
    ['━🛰️ 15. MYSTERY ZONE ══════════', ['모르는 시험 장치']],
    ['━🗂️ 13. ASSEMBLY & MARKERS ══════════', ['🚫DO NOT TOUCH🚫 시험 뼈대', '@worldInfoBefore', '@scenario', '@chatHistory', '@worldInfoAfter', '시험 접근성 메모: 👻 공백 바꾸기']],
    ['━🚫DO NOT ENABLE🚫 ══════════', ['@dialogueExamples', '@charDescription', '@personaDescription', '%nsfw', '@charPersonality', '%enhanceDefinitions', '숨겨 둔 시험 기본값']],
];
// 켜 둔 항목(합성): 묶음마다 첫 항목 하나 + 몇몇 단일 항목
const ON = new Set(['🪨 조약돌 솔라 [PICK 1: MIND]', '먼 렌즈 그때 [PICK 1: POV]', '[PICK 1: ↑] Director Mode Draft', '🌐 언어 택1: 시험 서술 · 시험 대사', '시험 핵심 규칙', '🚫 끄면 안 되는 시험 뼈대',
    '[PICK 1: ↑] 상투어 시험 가볍게', '살아 있는 시험 세계', '시험 말투 엔진', '🎨 대사 색상 택1: 시험 자동', '시험 친밀 장면 💓', '짧은 시험 (100-200 Words)', '시험 감정 엔진 📊', '시험 접근성 메모: 👻 공백 바꾸기']);
/** prefix 로 id 를 바꾸면 「판이 바뀌어 id 가 달라진」 경우를 흉내 내요. */
export function solaFixturePreset({ prefix = 'sola-test', content = '합성 검사 문구예요.' } = {}) {
    const prompts = [], order = [];
    let n = 0;
    const add = (name, extra = {}) => {
        const identifier = extra.identifier || `${prefix}-${String(++n).padStart(3, '0')}`;
        prompts.push({ identifier, name, role: 'system', content: extra.marker ? '' : content, system_prompt: false, injection_position: 0, ...extra });
        order.push({ identifier, enabled: solaHead(name) || !!extra.marker || ON.has(name) });
        return identifier;
    };
    const byName = new Map();
    for (const [head, items] of SECTIONS) {
        byName.set(head, add(head));
        for (const name of items) {
            // @ = 실리태번 자리 표식, % = 실리태번 기본 글 칸(이름 · 본문 합성) — 실리태번은 프리셋에 없는 기본 칸을 화면 값에 더해 「미저장」으로 보이게 해요
            if (name.startsWith('@')) { const id = name.slice(1); add(id, { identifier: id, marker: true }); continue; }
            if (name.startsWith('%')) { const id = name.slice(1); add(`시험 기본 칸 ${id}`, { identifier: id, system_prompt: true }); continue; }
            byName.set(name, add(name));
        }
    }
    // 순서 목록 밖의 실리태번 기본 글 칸(원작처럼 main · jailbreak 는 순서에 없어요)
    for (const id of ['main', 'jailbreak']) prompts.push({ identifier: id, name: `시험 기본 칸 ${id}`, role: 'system', content, system_prompt: true });
    const meta = { version: 1, groups: [{ id: 'test-dialogue-color', ids: ['[택1: ↓] 시험 대사 색 가 🎨', '[택1: ↑] 시험 대사 색 나 🎨', '🎨 대사 색상 택1: 시험 자동'].map(x => byName.get(x)) }] };
    return { prompts, prompt_order: [{ character_id: 100001, order }], extensions: { blPromptChoices: meta }, byName };
}
const solaHead = name => /^━/.test(name);
