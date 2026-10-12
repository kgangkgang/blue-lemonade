// 월드인포 설정 「?」 도움말 (6.1.5) — 글과 붙일 자리만 있는 순수 데이터. DOM 은 wi-help.js.
// 설명은 실리태번 world-info.js 의 실제 동작 기준. 추천값은 긴 컨텍스트 모델로 인물 로어북을 쓰는 롤플레이 기준.

export const WI_HELP = {
    summary: {
        title: '월드인포는 어떻게 들어가나요?',
        body: [
            '월드인포(로어북)는 최근 메시지에서 키워드를 찾아, 걸린 항목의 내용만 프롬프트에 넣는 장치예요. 상시(🔵) 항목은 키워드 없이 늘 들어가요.',
            '아래 전역 설정은 「얼마나 옛날 메시지까지 찾을지」 · 「모두 합쳐 얼마나 넣을지」 · 「항목이 다른 항목을 부를지」를 정해요. 칸마다 옆의 ?에 자세한 뜻이 있어요.',
        ],
        list: [
            ['스캔 깊이', '2~4'],
            ['컨텍스트 %', '25 (넘침 알림이 뜰 때만 올리기)'],
            ['예산 상한', '0 (끔)'],
            ['최소 활성화 · 최대 깊이', '0 · 0'],
            ['최대 재귀 단계', '0 (재귀 스캔을 끄면 상관없음)'],
            ['삽입 방식', '캐릭터 로어 먼저'],
            ['이름 포함', '켬'],
            ['재귀 스캔', '끔'],
            ['대소문자 구분', '끔'],
            ['단어 단위 일치', '영어 짧은 키워드(IT · PR 같은)가 있으면 켬'],
            ['그룹 점수', '끔'],
            ['예산 넘침 알림', '켬'],
        ],
        rec: '처음이면 위 값 그대로 두고, AI가 설정을 자꾸 잊으면 스캔 깊이를, 넘침 알림이 뜨면 컨텍스트 %를 올려 보세요.',
    },
    activeWorlds: {
        title: '모든 채팅에 켤 월드인포',
        body: [
            '여기서 고른 로어북은 어느 캐릭터 · 채팅에서든 켜져요(전역 로어).',
            '캐릭터 카드에 묶인 로어북(캐릭터 로어)은 여기서 고르지 않아도 그 캐릭터와 대화할 때 저절로 켜져요.',
        ],
        rec: '세계관 공용 설정처럼 어디서나 필요한 것만 고르고, 특정 캐릭터의 로어북은 카드에 묶어 두세요. 같은 로어북을 양쪽에 다 켤 필요는 없어요.',
    },
    scanDepth: {
        title: '스캔 깊이',
        body: [
            '최근 메시지 몇 개에서 키워드를 찾을지예요. 2면 마지막 메시지 2개(보통 내 메시지와 그 앞의 답)만 봐요. 키워드가 이 범위 안에 있어야 그 항목이 들어가요.',
            '숫자를 키우면 몇 턴 전에 나온 이름도 계속 잡혀서 항목이 오래 붙어 있지만, 그만큼 들어가는 양(토큰 · 요금)도 늘어요.',
            '0이면 채팅에서 찾지 않아서 상시(🔵) 항목만 들어가요(「추가로 찾을 곳」도 찾지 않아요). 항목마다 스캔 깊이를 따로 적은 항목은 예외예요.',
        ],
        rec: '2~4. 인물이 여럿 오가는 대화면 3~4, 한두 명이면 기본 2로 충분해요.',
    },
    budget: {
        title: '컨텍스트 %',
        body: [
            '월드인포 전체가 쓸 수 있는 양을, 최대 컨텍스트에서 응답 길이(최대 응답 토큰)를 뺀 크기에 대한 %로 정해요. 예: 최대 컨텍스트 200,000 · 응답 길이 8,000토큰에 25%면 48,000토큰까지예요.',
            '걸린 항목이 이 한도를 넘으면 뒤 차례 항목부터 빠져요. 차례는 지속(Sticky) 중인 항목 → 채팅 로어 → 페르소나 로어 → 「삽입 방식」에 따른 캐릭터 · 전역 로어 순이고, 같은 묶음 안에서는 순서(Order) 숫자가 큰 것이 앞이에요. 상시 항목도 한도 안에서 계산돼요.',
        ],
        rec: '기본 25면 대부분 충분해요. 「예산 넘침 알림」을 켜 두고 알림이 뜰 때만 올리세요. 컨텍스트를 작게(예: 16k) 쓰면 40~50까지 올려도 돼요.',
    },
    budgetCap: {
        title: '예산 상한',
        body: [
            '위의 %와 상관없이 월드인포가 넘지 않을 토큰 수예요. 0이면 꺼져 있어요.',
            '컨텍스트가 아주 큰 모델은 %만으로는 한도가 수만 토큰이 되니, 들어가는 양 · 요금을 일정하게 묶고 싶을 때 써요.',
        ],
        rec: '0(끔). 요금이 신경 쓰이면 8,000~15,000 정도.',
    },
    minActivations: {
        title: '최소 활성화',
        body: [
            '켜진 항목이 이 개수가 될 때까지 스캔 깊이보다 더 옛날 메시지로 한 개씩 거슬러 올라가며 찾아요. 0이면 꺼져 있어요.',
            '「최대 재귀 단계」를 1 이상으로 쓰면 이 칸은 작동하지 않아요.',
        ],
        rec: '0(끔). 항목이 너무 안 걸려서 AI가 설정을 자꾸 잊을 때만 2~3.',
    },
    maxDepth: {
        title: '최대 깊이 (최소 활성화용)',
        body: [
            '「최소 활성화」가 거슬러 올라갈 때 최대 몇 번째 메시지까지 볼지예요. 0이면 예산이 찰 때까지(필요하면 채팅 처음까지) 봐요.',
            '최소 활성화가 0이면 아무 효과가 없어요.',
        ],
        rec: '최소 활성화를 쓸 때만 10~20.',
    },
    maxRecursion: {
        title: '최대 재귀 단계',
        body: [
            '「재귀 스캔」을 켰을 때, 항목이 다른 항목을 부르는 연쇄를 몇 단계까지 허용할지예요.',
            '0 = 제한 없음, 1 = 한 번만 찾고 연쇄 없음, 2 = 연쇄 한 번, 3 = 연쇄 두 번…',
            '1 이상이면 「최소 활성화」가 꺼져요.',
        ],
        rec: '재귀 스캔을 끄면 상관없어요. 켜면 2~3.',
    },
    strategy: {
        title: '삽입 방식',
        body: [
            '캐릭터 카드에 묶인 로어(캐릭터 로어)와 「모든 채팅에 켤 월드인포」(전역 로어)를 어떤 순서로 처리할지예요. 예산이 모자라면 앞 순서가 먼저 들어가요.',
            '고르게 = 둘을 섞어서 순서(Order)대로. 캐릭터 로어 먼저 = 캐릭터 쪽을 먼저. 전역 로어 먼저 = 전역 쪽을 먼저.',
        ],
        rec: '캐릭터 로어 먼저(기본).',
    },
    includeNames: {
        title: '이름 포함',
        body: [
            '키워드를 찾을 때 각 메시지 앞에 말한 사람 이름을 붙여서("이름: 내용") 찾아요.',
            '그래서 키워드에 캐릭터 이름이나 내 페르소나 이름이 들어 있으면, 그 사람이 말할 때마다 그 항목이 켜져요.',
        ],
        rec: '켬(기본). 내 페르소나 항목을 늘 넣고 싶을 때 편해요. 이름 때문에 항목이 계속 켜져 토큰이 아까우면 끄세요.',
    },
    recursive: {
        title: '재귀 스캔',
        body: [
            '켜진 항목의 본문 안에서도 다른 항목의 키워드를 찾아요. 예: 용어 A 항목 본문에 용어 B가 나오면 B 항목도 같이 들어가요.',
            '인물끼리 서로 많이 언급하는 로어북이면 한 명만 불러도 거의 전부가 줄줄이 켜져서 들어가는 양이 크게 늘어요.',
        ],
        rec: '끔(기본). 인물 로어북은 꺼 두는 게 좋아요. 세계관 용어가 다른 용어를 꼭 데려와야 할 때만 켜고, 항목별 「재귀 안 됨 · 더 재귀 안 함」으로 조절하세요.',
    },
    caseSensitive: {
        title: '대소문자 구분',
        body: [
            '영어 키워드에서 대문자와 소문자를 다르게 볼지예요. 한글 · 일본어 키워드와는 상관없어요.',
        ],
        rec: '끔(기본).',
    },
    wholeWords: {
        title: '단어 단위 일치',
        body: [
            '한 단어짜리 영어 키워드가 다른 단어 속에 섞여 있으면 잡지 않아요. 예: 키워드 IT가 with 안에서 잡히지 않게.',
            '한글 · 일본어 키워드는 이 설정과 상관없이 낱말 속에서도 잡혀요(조사가 붙어도 잡힘).',
        ],
        rec: '로어북에 IT · PR · SNS 같은 짧은 영어 키워드가 있으면 켬. 없으면 아무거나 괜찮아요.',
    },
    groupScoring: {
        title: '그룹 점수',
        body: [
            '같은 「포함 그룹」에 든 항목이 여러 개 걸렸을 때, 키워드가 가장 많이 맞은 항목만 후보로 남겨요.',
            '포함 그룹을 쓰지 않으면 아무 효과가 없어요.',
        ],
        rec: '끔(기본).',
    },
    overflowAlert: {
        title: '예산 넘침 알림',
        body: [
            '걸린 항목이 예산(컨텍스트 % · 예산 상한)을 넘어서 일부가 빠졌을 때 알림을 띄워요.',
        ],
        rec: '켬. 설정이 빠지는 걸 바로 알 수 있어요.',
    },

    // ── 항목 칸 ──
    entryHeader: {
        title: '항목 머리줄의 칸들',
        list: [
            ['🔵 · 🟢 · 🔗', '🔵 상시 = 키워드 없이 늘 들어가요. 🟢 일반 = 키워드가 잡힐 때만. 🔗 벡터 = 키워드로도 켜지고, 벡터 저장소 확장에서 「Enable for World Info」를 켜 두면 뜻이 비슷한 대화에서도 켜져요.'],
            ['위치', '프롬프트 어디에 넣을지예요. ↑Char · ↓Char = 캐릭터 설명 앞 · 뒤, ↑EM · ↓EM = 예시 대화 앞 · 뒤, ↑AN · ↓AN = 작가 노트 앞 · 뒤(작가 노트가 들어가는 턴에만 들어가요. 삽입 빈도가 0이면 안 들어가요), @D = 채팅 기록 사이 깊이 D 자리(⚙️ 시스템 · 👤 사용자 · 🤖 AI 역할로), ➡️ Outlet = 자동으로 넣지 않고 {{outlet::이름}}을 적은 자리에.'],
            ['깊이', '위치가 @D일 때만 써요. 0 = 마지막 메시지 바로 뒤, 4 = 마지막에서 메시지 4개 위. 작을수록 AI가 최근 일처럼 강하게 의식해요.'],
            ['순서', '숫자가 클수록 우선이에요. 같은 로어 묶음 안에서는 예산이 모자랄 때 먼저 들어가 살아남고(캐릭터 로어 · 전역 로어 사이 차례는 「삽입 방식」이 정해요), 같은 위치 안에서는 더 뒤쪽(AI가 마지막에 읽는 쪽)에 놓여요.'],
            ['발동 %', '걸렸을 때 실제로 넣을 확률이에요(상시 항목도 이 확률을 따라요). 100이면 항상 들어가요.'],
        ],
        rec: '인물 · 용어 항목은 🟢 + ↑Char 또는 ↓Char, 순서 100~200, 발동 100. 늘 지켜야 할 규칙은 🔵 + @D ⚙️ 깊이 2~4.',
    },
    keys: {
        title: '주 키워드',
        body: [
            '이 낱말 중 하나라도 스캔 범위(최근 메시지)에 나오면 항목이 켜져요. 쉼표로 여러 개를 넣어요. /정규식/ 모양으로 넣으면 정규식으로 찾아요.',
            '이름 · 별명 · 직함 · 다른 언어 표기를 다 넣어 두면 대화가 어떤 말로 불러도 잘 걸려요.',
        ],
        rec: '대화에 실제로 나올 말 위주로. 너무 흔한 말(고양이, 비서 같은)은 엉뚱한 때도 켜지니 꼭 필요할 때만.',
    },
    logic: {
        title: '논리 (보조 필터 조건)',
        list: [
            ['AND ANY', '보조 키워드 중 하나라도 있어야 켜져요.'],
            ['AND ALL', '보조 키워드가 전부 있어야 켜져요.'],
            ['NOT ANY', '보조 키워드가 하나라도 있으면 안 켜져요.'],
            ['NOT ALL', '보조 키워드가 전부 있으면 안 켜져요.'],
        ],
        body: ['주 키워드가 잡힌 뒤 「보조 필터」를 어떻게 따질지예요. 보조 필터가 비어 있으면 무시돼요.'],
        rec: '보통 AND ANY(기본).',
    },
    secondary: {
        title: '보조 필터',
        body: [
            '주 키워드가 잡힌 다음 한 번 더 거르는 낱말이에요. 예: 주 키워드 「사무실」 + 보조 「야근」 + AND ANY = 사무실 이야기 중 야근이 나올 때만.',
            '비워 두면 주 키워드만으로 켜져요.',
        ],
        rec: '비워 두기. 같은 낱말이 여러 상황에 나와서 구분이 필요할 때만.',
    },
    outlet: {
        title: '아웃렛 이름',
        body: [
            '위치를 ➡️ Outlet으로 했을 때만 써요. 이 항목은 자동으로 프롬프트에 들어가지 않고, 프롬프트 관리자의 프롬프트(또는 스토리 문자열 · 시스템 프롬프트) 안에 {{outlet::이 이름}}을 적어 둔 자리에 들어가요.',
            '캐릭터 설명 · 페르소나 설명에 적으면 월드인포를 찾기 전에 먼저 바뀌어서 비어 버려요.',
        ],
        rec: '안 쓰면 비워 두기.',
    },
    entryScanDepth: {
        title: '스캔 깊이 (이 항목만)',
        body: [
            '이 항목만 전역 「스캔 깊이」 대신 이 숫자만큼 최근 메시지에서 키워드를 찾아요. 비워 두면 전역 설정을 따라요.',
        ],
        rec: '비워 두기. 가끔 언급되지만 한 번 나오면 오래 붙어 있어야 하는 항목만 크게(예: 6~10).',
    },
    entryCase: {
        title: '대소문자 구분 (이 항목만)',
        body: ['「전역 설정 사용」이면 전역 칸을 따르고, 예 · 아니오로 이 항목만 바꿔요. 영어 키워드에만 영향이 있어요.'],
        rec: '전역 설정 사용.',
    },
    entryWholeWords: {
        title: '단어 단위 일치 (이 항목만)',
        body: [
            '「전역 설정 사용」이면 전역 칸을 따르고, 예 · 아니오로 이 항목만 바꿔요.',
            '켜면 한 단어짜리 영어 키워드가 다른 단어 속에서 잡히지 않아요. 한글 · 일본어 키워드는 상관없이 잡혀요.',
        ],
        rec: '전역 설정 사용. 이 항목에 IT 같은 짧은 영어 키워드가 있으면 예.',
    },
    entryGroupScoring: {
        title: '그룹 점수 (이 항목만)',
        body: ['「전역 설정 사용」이면 전역 칸을 따라요. 포함 그룹 안에서 키워드가 가장 많이 맞은 항목만 남길지를 이 항목만 바꿔요.'],
        rec: '전역 설정 사용.',
    },
    automationId: {
        title: '자동화 ID',
        body: ['이 항목이 켜질 때, 같은 자동화 ID를 가진 빠른 답장(Quick Reply)을 실행해요.'],
        rec: '안 쓰면 비워 두기.',
    },
    recursionLevel: {
        title: '재귀 단계',
        body: [
            '「재귀까지 미루기」를 켠 항목이 몇 번째 재귀에서 잡힐지예요. 작은 숫자부터 차례로 열려서, 앞 단계에서 더 걸릴 게 없을 때 다음 단계가 열려요.',
        ],
        rec: '1(기본). 재귀를 단계별로 나눠 쓰는 복잡한 로어북이 아니면 그대로.',
    },
    excludeRecursion: {
        title: '재귀 안 됨',
        body: ['다른 항목 본문에 키워드가 나와도 이 항목은 켜지지 않아요. 채팅에 키워드가 나와야만 켜져요.'],
        rec: '재귀 스캔을 켰을 때, 대화에 직접 나올 때만 필요한 항목(인물 항목 등)에.',
    },
    preventRecursion: {
        title: '더 재귀 안 함',
        body: ['이 항목 본문은 다른 항목을 부르지 않아요. 다른 인물 이름이 많이 나오는 인물 항목에 켜 두면 연쇄를 막아요.'],
        rec: '재귀 스캔을 켰다면 인물 항목에 켬.',
    },
    delayUntilRecursion: {
        title: '재귀까지 미루기',
        body: ['첫 채팅 스캔에서는 켜지지 않고, 그 뒤 재귀 단계가 돌 때만 켜져요. 재귀 단계에서는 다른 항목 본문뿐 아니라 채팅에 있는 키워드로도 켜져요.', '재귀 스캔이 꺼져 있으면 보통 켜질 일이 없어요(재귀 단계 숫자를 두 가지 이상 나눠 쓴 경우만 예외).'],
        rec: '끔. 다른 항목에 딸린 세부 설정에만.',
    },
    ignoreBudget: {
        title: '예산 무시',
        body: ['예산(컨텍스트 % · 상한)을 넘어도 이 항목은 빠지지 않고 들어가요.'],
        rec: '끔. 절대 빠지면 안 되는 짧은 규칙에만.',
    },
    inclusionGroup: {
        title: '포함 그룹',
        body: [
            '같은 그룹 이름을 단 항목이 여러 개 걸려도 그중 하나만 들어가요(가중치에 따라 무작위). 쉼표로 여러 그룹에 넣을 수 있어요.',
            '같은 상황의 변형(날씨 · 기분 · 사건 같은)을 번갈아 쓰고 싶을 때 써요.',
        ],
        rec: '비워 두기. 변형 항목을 묶을 때만.',
    },
    prioritize: {
        title: '우선',
        body: ['켜면 포함 그룹에서 무작위로 뽑지 않고 이 항목이 뽑혀요. 「우선」이 켜진 항목이 여러 개 걸렸으면 그중 순서(Order)가 가장 큰 것이 뽑혀요.'],
        rec: '끔. 그룹 안에서 늘 이 항목을 먼저 쓰고 싶을 때만.',
    },
    groupWeight: {
        title: '그룹 가중치',
        body: ['포함 그룹 안에서 뽑힐 상대적인 확률이에요. 기본 100, 200이면 100인 항목보다 두 배 잘 뽑혀요.'],
        rec: '100(기본).',
    },
    sticky: {
        title: '지속',
        body: ['한 번 켜지면 키워드가 사라져도 메시지 N개 동안 계속 켜져 있어요.'],
        rec: '비워 두기. 한 번 나오면 한동안 이어지는 사건 · 장소에 3~5.',
    },
    cooldown: {
        title: '재사용 대기',
        body: ['켜졌다가 꺼진 뒤 메시지 N개 동안은 키워드가 나와도 다시 켜지지 않아요.'],
        rec: '비워 두기. 너무 자주 끼어드는 항목에 3~5.',
    },
    delay: {
        title: '지연',
        body: ['채팅에 메시지가 N개 이상 쌓이기 전에는 켜지지 않아요.'],
        rec: '비워 두기. 대화 초반엔 숨겨 두고 싶은 설정(반전 · 비밀)에.',
    },
    characterFilter: {
        title: '캐릭터 · 태그 필터',
        body: ['고른 캐릭터와 대화할 때만 켜져요. 태그를 고르면 그 태그가 붙은 캐릭터일 때만 켜지고, 캐릭터와 태그를 둘 다 고르면 둘 다 맞아야 켜져요.', '「제외」를 켜면 반대로 고른 캐릭터이거나 그 태그가 붙은 캐릭터에서는 안 켜져요.'],
        rec: '비워 두기(모든 캐릭터). 전역 로어북을 특정 캐릭터에서 빼고 싶을 때만.',
    },
    triggers: {
        title: '생성 종류 필터',
        body: ['고른 생성 종류(일반 · 이어쓰기 · 사칭 · 스와이프 · 다시 생성 · 조용히)일 때만 켜져요. 비워 두면 모든 생성에서 켜져요.'],
        rec: '비워 두기.',
    },
    matchSources: {
        title: '추가로 찾을 곳',
        body: [
            '채팅 메시지 말고도 체크한 곳(캐릭터 설명 · 성격 · 시나리오 · 페르소나 설명 · 캐릭터 노트 · 제작자 노트)에서도 이 항목의 키워드를 찾아요.',
            '그곳에 키워드가 늘 들어 있으면 이 항목도 사실상 늘 켜져요.',
        ],
        rec: '모두 끔(기본). 페르소나 설명에 적힌 종족 · 소속에 맞춰 항목을 켜고 싶을 때만.',
    },
};

// [붙일 곳 선택자, 도움말 id, 'after' = 그 요소 바로 뒤 | 'append' = 그 요소 안 끝]
export const GLOBAL_ANCHORS = [
    ['small[data-i18n="Global World Info/Lorebook activation settings"]', 'summary', 'append'],
    ['small[data-i18n="Active World(s) for all chats"]', 'activeWorlds', 'append'],
    ['#wiSliders span[data-i18n="Scan Depth"]', 'scanDepth', 'after'],
    ['#wiSliders span[data-i18n="Context %"]', 'budget', 'after'],
    ['#wiSliders span[data-i18n="Budget Cap"]', 'budgetCap', 'after'],
    ['#wiSliders span[data-i18n="Min Activations"]', 'minActivations', 'after'],
    ['#wiSliders span[data-i18n="Max Depth"]', 'maxDepth', 'after'],
    ['#wiSliders span[data-i18n="Max Recursion Steps"]', 'maxRecursion', 'after'],
    ['#wiSliders small[data-i18n="Insertion Strategy"]', 'strategy', 'append'],
    ['#wiCheckboxes small[data-i18n="Include Names"]', 'includeNames', 'append'],
    ['#wiCheckboxes small[data-i18n="Recursive Scan"]', 'recursive', 'append'],
    ['#wiCheckboxes small[data-i18n="Case Sensitive"]', 'caseSensitive', 'append'],
    ['#wiCheckboxes small[data-i18n="Match Whole Words"]', 'wholeWords', 'append'],
    ['#wiCheckboxes small[data-i18n="Use Group Scoring"]', 'groupScoring', 'append'],
    ['#wiCheckboxes small[data-i18n="Alert On Overflow"]', 'overflowAlert', 'append'],
];

// 항목 틀(#entry_edit_template) 안 — 실리태번이 이 틀을 복제해 항목을 그리므로 한 번만 붙이면 모든 항목에 생긴다
export const ENTRY_ANCHORS = [
    ['.world_entry .probabilityContainer', 'entryHeader', 'append'],   // 머리줄 끝(발동 % 뒤)에 하나 — 칸마다 붙이면 폰에서 줄이 늘어난다
    ['.world_entry_edit small[data-i18n="Primary Keywords"]', 'keys', 'append'],
    ['.world_entry_edit small[data-i18n="Logic"]', 'logic', 'append'],
    ['.world_entry_edit small[data-i18n="Optional Filter"]', 'secondary', 'append'],
    ['.world_entry_edit span[data-i18n="Outlet Name"]', 'outlet', 'after'],
    ['.world_entry_edit [name="perEntryOverridesBlock"] small[data-i18n="Scan Depth"]', 'entryScanDepth', 'append'],
    ['.world_entry_edit small[data-i18n="Case-Sensitive"]', 'entryCase', 'append'],
    ['.world_entry_edit small[data-i18n="Whole Words"]', 'entryWholeWords', 'append'],
    ['.world_entry_edit small[data-i18n="Group Scoring"]', 'entryGroupScoring', 'append'],
    ['.world_entry_edit small[data-i18n="Automation ID"]', 'automationId', 'append'],
    ['.world_entry_edit span[data-i18n="Recursion Level"]', 'recursionLevel', 'after'],
    ['.world_entry_edit span[data-i18n="Non-recursable"]', 'excludeRecursion', 'after'],
    ['.world_entry_edit span[data-i18n="Prevent further recursion"]', 'preventRecursion', 'after'],
    ['.world_entry_edit span[data-i18n="Delay until recursion"]', 'delayUntilRecursion', 'after'],
    ['.world_entry_edit span[data-i18n="Ignore budget"]', 'ignoreBudget', 'after'],
    ['.world_entry_edit span[data-i18n="Inclusion Group"]', 'inclusionGroup', 'after'],
    ['.world_entry_edit span[data-i18n="Prioritize"]', 'prioritize', 'after'],
    ['.world_entry_edit small[data-i18n="Group Weight"]', 'groupWeight', 'append'],
    ['.world_entry_edit span[data-i18n="Sticky"]', 'sticky', 'after'],
    ['.world_entry_edit span[data-i18n="Cooldown"]', 'cooldown', 'after'],
    ['.world_entry_edit span[data-i18n="Delay"]', 'delay', 'after'],
    ['.world_entry_edit small[data-i18n="Filter to Characters or Tags"]', 'characterFilter', 'append'],
    ['.world_entry_edit span[data-i18n="Filter to Generation Triggers"]', 'triggers', 'after'],
    ['.world_entry_edit strong[data-i18n="Additional Matching Sources"]', 'matchSources', 'after'],
];
