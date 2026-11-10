// 1.1.2 실리태번 기본 프롬프트 항목 이름 사전 — 프리셋이 손대지 않고 둔 기본 칸 이름(World Info (before) · Chat History …)을 프롬프트 목록에서 한글로 보여요.
//   열쇠는 실리태번 본체(AGPL-3.0, https://github.com/SillyTavern/SillyTavern)의 기본 프롬프트 이름(public/scripts/PromptManager.js 의 기본 항목) 그대로예요.
//   프리셋의 본문 · 정규식 · 프리셋 고유 이름은 담지 않아요. 화면 글만 바꾸고 저장되는 이름은 그대로예요(src/scripts/prompt-engine.js).
//   「실리태번 한글화」를 켠 동안만 쓰고(끄면 원문 그대로), 서랍을 처음 쓸 때 받아요(src/scripts/runtime.js basicPromptNames) — 시작 때는 받지 않아요.
//   우선순위가 프리셋 사전(데우스 · 과일 · 솔라 = 20)보다 낮아서, 프리셋 사전이 같은 이름을 다르게 옮기면 그쪽이 먼저예요.
//   프리셋 고유 이름은 여기에 더하지 않아요: 원작 출처와 이용 조건을 확인한 프리셋만 계열별 사전(src/scripts/plain/<계열>.js)으로 따로 둬요.
export default {
    priority: 5,
    prompts: [
        { id: 'main', name: 'Main Prompt', title: '메인 프롬프트', desc: '실리태번 기본 항목: 맨 앞에 들어가는 기본 지시문 자리예요.' },
        { id: 'worldInfoBefore', name: 'World Info (before)', title: '월드 인포 (앞)', desc: '실리태번 기본 항목: 캐릭터 설명 앞에 들어가는 월드 인포(로어북) 내용이에요.' },
        { id: 'personaDescription', name: 'Persona Description', title: '페르소나 설명', desc: '실리태번 기본 항목: 내 페르소나 설명이 들어가는 자리예요.' },
        { id: 'charDescription', name: 'Char Description', title: '캐릭터 설명', desc: '실리태번 기본 항목: 캐릭터 카드의 설명이 들어가는 자리예요.' },
        { id: 'charPersonality', name: 'Char Personality', title: '캐릭터 성격', desc: '실리태번 기본 항목: 캐릭터 카드의 성격 요약이 들어가는 자리예요.' },
        { id: 'scenario', name: 'Scenario', title: '시나리오', desc: '실리태번 기본 항목: 캐릭터 카드의 시나리오가 들어가는 자리예요.' },
        { id: 'enhanceDefinitions', name: 'Enhance Definitions', title: '설정 보강', desc: '실리태번 기본 항목: 모델이 이미 아는 캐릭터 지식을 보태 쓰게 하는 기본 지시문 자리예요.' },
        { id: 'nsfw', name: 'Auxiliary Prompt', title: '보조 프롬프트', desc: '실리태번 기본 항목: 메인 프롬프트를 거드는 기본 지시문 자리예요.' },
        { id: 'worldInfoAfter', name: 'World Info (after)', title: '월드 인포 (뒤)', desc: '실리태번 기본 항목: 캐릭터 설명 뒤에 들어가는 월드 인포(로어북) 내용이에요.' },
        { id: 'dialogueExamples', name: 'Chat Examples', title: '예시 대화', desc: '실리태번 기본 항목: 캐릭터 카드의 예시 대화가 들어가는 자리예요.' },
        { id: 'chatHistory', name: 'Chat History', title: '채팅 기록', desc: '실리태번 기본 항목: 지금까지 나눈 대화가 요청할 때 들어가는 자리예요.' },
        { id: 'jailbreak', name: 'Post-History Instructions', title: '기록 뒤 지시', desc: '실리태번 기본 항목: 채팅 기록 뒤에 들어가는 기본 지시문 자리예요.' },
    ],
};
