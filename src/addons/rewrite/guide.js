// 1.8.0 — the long how-to behind the version badge. Static HTML only (no user data), shown in a SillyTavern popup.
/** @param {boolean} personal whether the persona rule (유저 외모 색깔) ships in this build */
export const guideHtml = personal => `
<div class="bwr_guide">
  <h3><i class="fa-solid fa-glasses"></i> 다시 쓰기 사용법</h3>
  <p class="bwr_guide_lead">AI 답변에서 <b>내가 보기 싫은 묘사</b>가 나온 문장만 골라, 그 문장만 다시 쓰게 하는 확장이에요. 답변 전체를 다시 뽑지 않아서 빠르고, 나머지 글은 한 글자도 바뀌지 않아요.</p>

  <details open>
    <summary>1. 어떻게 돌아가나요</summary>
    <ol>
      <li>AI 답변이 도착하면 <b>금지 묘사</b> 목록의 단어로 답변을 훑어요. 이 단계는 기기 안에서만 돌아서 돈이 들지 않아요.</li>
      <li>걸린 문장이 있으면 <b>그 문장들만</b> AI에게 보내 "이 묘사만 빼고 다시 써 줘"라고 부탁해요. 걸린 게 없으면 아무 요청도 보내지 않아요.</li>
      <li>돌아온 문장에 금지 묘사가 또 있으면 <b>고급 › 최대 시도</b> 횟수까지 다시 부탁하고, 끝까지 안 되면 원래 문장을 그대로 둬요.</li>
      <li>고친 글은 번역 확장이 번역하기 <b>전에</b> 바뀌어서, 번역을 두 번 하지 않아요.</li>
    </ol>
    <p>스트리밍 중에는 기다렸다가 답변이 끝난 순간에 한 번만 검사해요. 고치는 동안에는 보내기 · 스와이프가 잠깐 잠기고, 멈춤 버튼을 누르면 고치기를 그만두고 원래 답변을 남겨요.</p>
  </details>

  <details>
    <summary>2. 처음 켜기</summary>
    <ol>
      <li>맨 위 <b>금지 묘사</b> 스위치를 켜요.</li>
      <li><b>연결</b> 탭에서 고칠 때 쓸 모델을 골라요.
        <ul>
          <li><b>현재 연결</b> — 지금 채팅에 쓰는 모델 그대로. 설정할 게 없어서 처음엔 이걸 권해요.</li>
          <li><b>직접 선택</b> — 공급자와 모델을 따로 골라요. 채팅은 비싼 모델, 고치기는 싸고 빠른 모델로 나눌 때 써요. API 키는 실리태번 본체의 API 연결에 저장해 둔 것을 그대로 써요.</li>
          <li><b>연결 프로필</b> — 실리태번 연결 관리자에 저장한 프로필을 써요.</li>
        </ul>
      </li>
      <li><b>금지 묘사</b> 탭에서 필요 없는 기본 규칙은 끄거나 지우고, 내 규칙을 추가해요 (아래 3번).</li>
      <li><b>테스트</b> 탭에 걸릴 만한 문장을 넣어서 실제로 잡히는지, 어떻게 고쳐지는지 확인해요.</li>
    </ol>
    <p>요술봉 메뉴의 <b>다시 쓰기</b>나 설정의 <b>마지막 답변 검사</b>는 이미 받은 마지막 답변을 지금 검사해요.</p>
  </details>

  <details open>
    <summary>3. 금지 묘사 만들기 — AI에게 부탁하기 (추천)</summary>
    <p>단어 목록은 손으로 쓰기 어려워요. 영어 소설체의 온갖 변형(복수형, 하이픈, 어순)을 다 떠올려야 하거든요. 그래서 <b>프롬프트를 드리고, 쓰시는 AI에게 대신 만들게</b> 하는 길을 넣었어요.</p>
    <ol>
      <li><b>금지 묘사</b> 탭 › <b>AI에게 부탁해서 만들기</b>를 눌러요.</li>
      <li>싫어하는 묘사를 <b>평소 말투로</b> 적어요. 예: "캐릭터가 자꾸 수염을 기르고 나와", "내 캐릭터 눈 색을 멋대로 정해", "킁킁거리는 묘사 싫어".</li>
      <li><b>프롬프트 복사</b>를 누르고, ChatGPT · Claude · Gemini 등 아무 AI 채팅창에 붙여넣어요.</li>
      <li>AI가 준 답(<code>[</code> 로 시작하는 글)을 <b>통째로</b> 복사해 <b>AI 답 붙여넣기</b> 칸에 넣고 <b>규칙 추가</b>를 눌러요.</li>
      <li>추가된 규칙을 눌러 단어를 훑어보고, <b>테스트</b> 탭에서 확인해요. 너무 많이 잡으면 그 단어를 지우고, 빠진 표현은 직접 더해요.</li>
    </ol>
    <p>잘못된 정규식이나 위험한 패턴은 추가할 때 알아서 걸러요. 이미 같은 규칙이 있으면 건너뛰어요. 마음에 안 들면 규칙을 지우고 AI에게 "더 좁게 / 더 넓게"라고 다시 부탁하면 돼요.</p>
  </details>

  <details>
    <summary>4. 단어를 직접 쓰는 법</summary>
    <ul>
      <li>쉼표나 줄바꿈으로 나눠요. 대소문자는 가리지 않아요: <code>glasses, spectacles</code></li>
      <li>영어는 <b>단어 통째로</b>만 잡아요. <code>tan</code>은 "tan"만 잡고 "important"는 안 잡아요.</li>
      <li><code>*</code> = 아무 글자: <code>beard*</code> → beards, bearded</li>
      <li>띄어쓰기와 <code>-</code>는 서로 통해요: <code>sun-tanned</code> → sun tanned, suntanned</li>
      <li><code>…</code>(또는 <code>...</code>) = 사이에 꾸미는 말 최대 3개: <code>pointed … ears</code> → pointed celestial ears. (at · the · his 같은 말은 끼지 못해서 "pointed at his ears"는 안 잡아요.)</li>
      <li>한 줄을 <code>/…/</code>로 감싸면 정규식이에요. "색깔 + 손톱"처럼 조합을 잡을 때 써요.</li>
      <li>한글 · 일본어 · 중국어는 단어 경계가 없어 <b>어디에 있든</b> 잡아요. 짧은 말(예: "털")은 엉뚱한 데 걸리니 "가슴털"처럼 구체적으로 써요.</li>
      <li><b>AI에게 줄 설명</b>은 고쳐 쓰는 AI가 읽어요. 무엇을 빼고 무엇은 남길지 영어로 적으면 가장 잘 들어요: <code>chest hair — keep the chest itself</code></li>
    </ul>
  </details>

  <details>
    <summary>5. "이 캐릭터에게만" · "이 말의 것일 때만"</summary>
    <p>모두에게 금지가 아니라 <b>한 캐릭터에게만</b> 금지일 때 써요. 대표적으로 "내 캐릭터의 머리색 · 눈색을 AI가 멋대로 정하는 것".</p>
    <ul>
      <li><b>이 캐릭터에게만</b> — 이름을 쉼표로 적어요 (여러 언어 표기를 모두). 최근 메시지에 그 이름이 나올 때만 규칙이 켜지고, 고쳐 쓰는 AI에게 "다른 캐릭터는 진짜 그 특징이 있을 수 있다"고 알려 줘서 남의 묘사는 그대로 둬요. <code>{{user}}</code>는 지금 페르소나 이름으로 바뀌어요.</li>
      <li><b>이 말의 것일 때만</b> — 머리 · 눈처럼 다른 캐릭터도 매번 묘사되는 특징이라면 요청이 너무 잦아져요. 여기에 <code>her, she, you, your, 이름</code>처럼 <b>주인을 가리키는 말</b>을 적으면, 그 말이 걸린 단어 바로 앞(세 단어 안)에 있거나, 같은 문장에 있으면서 바로 옆에 his · 누구's 같은 남의 표시가 없을 때만 잡아요.</li>
    </ul>
${personal ? `<p><b>기본 규칙 "유저 외모 색깔"</b>은 만든 사람의 캐릭터 이름으로 맞춰져 있어요. 쓰시려면 두 칸의 이름을 <b>내 캐릭터 이름</b>이나 <code>{{user}}</code>로 바꾸고, 대명사(her/she ↔ his/he)도 맞춰 주세요. 안 쓰시면 끄거나 지우면 돼요.</p>` : ''}
  </details>

  <details>
    <summary>6. 예외 — 원래 그 특징이 있는 캐릭터</summary>
    <p>안경이 금지인데 <b>원래 안경을 쓰는 캐릭터</b>가 있다면 예외에 넣어요. 이름과, 그 캐릭터에게 허락할 규칙을 체크해요. 최근 메시지에 이름이 나오면 예외가 켜지고, 누구의 묘사인지는 고쳐 쓰는 AI가 판단해요.</p>
    <p>기본으로 들어 있는 예외 두 개(벨포드 · 아델스타인)는 <a href="https://kkangtong.xyz/posts/54677" target="_blank" rel="noopener noreferrer">공유 봇 「천지합동청」</a>의 캐릭터예요. 그 봇을 쓰지 않으면 지우세요.</p>
  </details>

  <details>
    <summary>7. 리롤 — 씬 플랜이 없거나 끊긴 답변 다시 받기</summary>
    <p>답변 앞에 <code>&lt;scene_plan&gt;</code> 같은 계획 블록을 쓰게 하는 프리셋(데우스 엑스 마키나 등)용이에요. 프롬프트에 <b>표시 문구</b>가 들어 있는 요청인데 답변이 <b>시작 문구</b>로 시작하지 않거나 블록이 닫히지 않고 끊겼으면, 같은 요청을 조용히 다시 보내 답변을 바꿔요.</p>
    <ul>
      <li>표시 문구가 없는 프리셋에서는 절대 리롤하지 않아요. 그런 프리셋을 안 쓰면 꺼 두세요 (기본: 꺼짐).</li>
      <li>리롤은 <b>답변 하나를 통째로 다시 받는 것</b>이라 그만큼 비용이 들어요.</li>
      <li>이어 쓰기(Continue)와 직접 멈춘 답변은 건드리지 않아요.</li>
    </ul>
  </details>

  <details>
    <summary>8. 비용과 속도</summary>
    <ul>
      <li>찾기는 공짜, <b>고치기만</b> API를 써요. 보내는 건 걸린 문장 + 짧은 안내문이라 보통 답변 하나의 몇 % 정도예요.</li>
      <li>규칙이 넓을수록(흔한 단어일수록) 자주 걸려서 요청이 늘어요. 알림에 "그대로 뒀어요"가 자주 뜨면 그 규칙이 너무 넓다는 뜻이에요.</li>
      <li><b>고급</b> 탭: 온도 · 최대 토큰 · 제한 시간 · 최대 시도 · 예외/캐릭터 한정을 판단할 때 돌아볼 메시지 수를 바꿀 수 있어요.</li>
      <li>고치는 모델은 빠르고 싼 모델이면 충분해요.</li>
    </ul>
  </details>

  <details>
    <summary>9. 기본으로 들어 있는 규칙</summary>
    <p>만든 사람이 실제로 쓰는 목록 그대로예요. 취향이니 <b>안 맞는 건 끄거나 지우세요.</b></p>
    <ul>
      <li>안경 · 수염 · 태닝 · 지팡이 · 뾰족귀 · 색깔 손톱 · 가슴털 · 코 벌렁거림 · "후후 · えへへ" 웃음 — 모두에게</li>
      <li>뿔 — <a href="https://kkangtong.xyz/posts/54677" target="_blank" rel="noopener noreferrer">공유 봇 「천지합동청」</a>의 사탄에게만 (다른 봇에서는 이름을 바꾸거나 지우세요)</li>
      ${personal ? `<li>유저 외모 색깔 — 내 캐릭터의 머리 · 눈 · 피부색을 AI가 정하지 못하게 (5번 참고)</li>` : ''}
    </ul>
    <p>영어 · 한국어 · 일본어 · 중국어 표현이 함께 들어 있어요. 사탄 · 벨포드 · 아델스타인은 <a href="https://kkangtong.xyz/posts/54677" target="_blank" rel="noopener noreferrer">공유 봇 「천지합동청」</a>의 캐릭터이고, 이 확장을 만든 사람의 캐릭터가 아니에요.</p>
  </details>

  <details>
    <summary>10. 잘 안 될 때</summary>
    <ul>
      <li><b>아무것도 안 잡아요</b> — 맨 위 스위치, 규칙의 "사용", 그리고 "이 캐릭터에게만"의 이름이 최근 메시지에 나오는지 확인해요. 테스트 탭에 문장을 넣어 보면 바로 알 수 있어요.</li>
      <li><b>실리태번 정규식(Regex)으로 같은 단어를 지우고 있다면</b> 그 정규식이 먼저 돌아서 여기엔 아무것도 안 보여요. 그 정규식을 끄거나 "형식 표시만"으로 바꿔 주세요.</li>
      <li><b>요청 실패</b> — 연결 탭의 모델 · 주소를 확인해요. "현재 연결"로 바꿔서 되는지 보면 원인을 좁힐 수 있어요.</li>
      <li><b>고쳤는데 번역문은 그대로예요</b> — 번역 확장이 다시 번역할 때까지 잠깐 걸려요. 계속 그대로면 그 메시지를 다시 번역해 주세요.</li>
      <li><b>블루 레몬에이드 안의 다시 쓰기와 단독 확장</b>은 둘 중 하나만 켜 주세요. 설정은 같은 곳에 저장돼서 어느 쪽으로 옮겨도 그대로예요.</li>
    </ul>
  </details>
</div>`;

// The "?" next to 씬 플랜 리롤. What a Scene Plan is comes from the Deus Ex Machina preset's "! Scene Plan !" prompt.
export const SCENE_HELP_HTML = `
<div class="bwr_guide">
  <h3><i class="fa-solid fa-rotate"></i> 씬 플랜 리롤</h3>
  <p class="bwr_guide_lead"><b>데우스 엑스 마키나</b> 프리셋을 쓸 때만 필요한 기능이에요. 다른 프리셋에서는 꺼 두세요.</p>
  <details open>
    <summary>씬 플랜(장면 계획)이 뭔가요</summary>
    <p>데우스 엑스 마키나의 <b>! Scene Plan !</b> 프롬프트는 AI에게 <b>모든 답변을 <code>&lt;scene_plan&gt;</code> 칸으로 시작</b>하라고 시켜요. 본문을 쓰기 전에 아래 항목을 한 줄씩 먼저 정하는 칸이에요.</p>
    <ul>
      <li><b>Context</b> — 속뜻 · 앞 내용과의 연결 · 캐릭터 시트 · 세계관</li>
      <li><b>OOC</b> — 내가 직접 내린 지시가 있으면 어떻게 따를지</li>
      <li><b>Knowledge</b> — 이번 장면에 필요한 사실</li>
      <li><b>Story progression</b> — 속도(Pacing)를 지키면서 장면을 어떻게 나아가게 할지</li>
      <li><b>Prose Length · Language · Narrative Style</b> — 분량, 출력 언어, 문체</li>
      <li>켜 둔 모듈마다 한 줄씩 — 선택지(CYOA) · 원작 고증(Fandom) · Momentum Engine · 긍정 편향 막기 · 캐릭터 전지 막기 · 캐릭터 현실성 등</li>
    </ul>
    <p>프리셋 설명 그대로 <b>일관성을 지키는 데 꼭 필요한 칸</b>이고, 채팅에서는 접힌 "Scene Plan" 카드로 보여요.</p>
  </details>
  <details open>
    <summary>왜 다시 받나요</summary>
    <p>모델이 가끔 이 칸을 <b>건너뛰고 바로 본문을 쓰거나</b>, 계획을 쓰다가 <b>중간에 끊겨요</b>. 그런 답변은 프리셋의 문체 · 분량 · 전개 규칙을 거치지 않은 답이라 품질이 흔들리고, 끊긴 칸은 카드가 깨져 보여요.</p>
    <p>이 기능을 켜면 답변이 도착했을 때 확인해서, 씬 플랜이 <b>없거나 닫히지 않았으면 같은 요청을 조용히 다시 보내</b> 답변을 바꿔요. 번역 확장이 번역하기 전에 끝나서 번역을 두 번 하지 않아요.</p>
  </details>
  <details>
    <summary>언제 움직이고 언제 안 움직이나요</summary>
    <ul>
      <li>보낸 프롬프트에 <b>표시 문구</b>(기본 <code>&lt;scene_plan_guide&gt;</code>)가 있을 때만 검사해요. 그래서 다른 프리셋의 답변은 절대 다시 받지 않아요.</li>
      <li>답변이 <b>시작 문구</b>(기본 <code>&lt;scene_plan</code>, <code>&lt;scene_reasoning</code>) 중 하나로 시작하고, 열린 칸이 모두 닫혔고, 그 뒤에 본문이 있어야 통과예요.</li>
      <li>이어 쓰기(Continue)와 <b>내가 직접 멈춘</b> 답변은 건드리지 않아요. 연결이 끊겨서 잘린 답변은 다시 받아요.</li>
      <li>다시 받는 동안에는 보내기 · 스와이프가 잠기고, 멈춤 버튼을 누르면 그만두고 원래 답변을 남겨요.</li>
      <li><b>리롤</b> 탭에서 문구 · 최대 시도 · 제한 시간을 바꿀 수 있어요. 끝까지 실패하면 원래 답변을 그대로 둬요.</li>
    </ul>
  </details>
  <details>
    <summary>비용</summary>
    <p>다시 받기 한 번 = <b>답변 하나를 통째로 다시 생성</b>하는 비용이에요(채팅에 쓰는 연결 · 같은 프롬프트, 스트리밍 없이). 금지 묘사 고치기처럼 몇 문장만 보내는 게 아니에요. 자주 뜬다면 프리셋의 Scene Plan 프롬프트가 켜져 있는지, 모델의 추론(Reasoning) 설정이 너무 높지 않은지 먼저 확인해 보세요.</p>
  </details>
</div>`;
