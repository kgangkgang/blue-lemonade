// 안내만 연다. TTS 설정·음성 엔진·네트워크 요청은 초기화하지 않는다.
import { TTS_VERSION } from './version.js';

const providers = [
    ['browser', '브라우저 내장 · 무료', 'API 키가 필요 없어요. 목소리 탭의 ‘계정에서 불러오기’를 누르고 ‘브라우저 내장’을 골라 기기의 음성 목록을 가져오세요. 표시되는 이름은 기기마다 달라요. 목록이 비면 기기의 한국어 음성을 설치하거나 다른 엔진을 사용하세요. 음성 파일 내려받기는 지원하지 않아요.'],
    ['minimax', 'MiniMax', '본인 계정의 API 키를 저장하고 계정에 맞는 API 지역과 음성 모델을 고르세요. 목소리 탭에서 계정 목록을 불러오거나 사용할 수 있는 voice ID를 직접 넣어요. 예시 ID를 그대로 넣으면 소리가 나지 않아요.'],
    ['openai', 'OpenAI', 'API 키를 저장하고 사용할 수 있는 음성 모델을 고르세요. 공식 API를 쓰면 기본 주소를 유지해요. 목소리 탭에서 제공되는 목소리를 불러온 뒤 선택하세요. 일반 채팅 모델 이름을 음성 모델 칸에 넣지 않아요.'],
    ['openai_compat', 'OpenAI 호환 · 직접 서버', '실행 중인 음성 서버가 안내하는 API 주소, 모델 이름, 목소리 ID를 넣으세요. 주소는 서버가 요구하는 /v1까지 입력해요. 기본 예시 주소는 서버를 설치하거나 실행해 주지 않아요. 서버가 인증을 요구할 때만 키를 넣어요.'],
    ['openrouter', 'OpenRouter', 'OpenRouter API 키와 오디오 출력을 지원하는 모델을 선택하세요. 목소리 목록에서 해당 모델에 맞는 목소리를 골라요. 모든 채팅 모델이 음성을 만들 수 있는 것은 아니에요.'],
    ['elevenlabs', 'ElevenLabs', 'API 키와 음성 모델을 선택한 뒤 계정 목록에서 목소리를 가져오세요. 직접 추가할 때는 이름 대신 해당 목소리의 voice ID를 넣어요.'],
    ['gemini', 'Google Gemini', 'Google API 키와 음성 생성 모델을 선택하세요. 목소리 탭에서 제공되는 목소리를 가져오고 사용할 언어를 설정해요. 일반 채팅용 모델과 음성 모델은 구분해 주세요.'],
    ['azure', 'Azure', 'Azure Speech 리소스의 키와 지역을 입력하세요. 예를 들어 지역이 Korea Central이면 리소스에 표시되는 지역 코드 koreacentral을 넣어요. 목록을 불러온 뒤 언어와 목소리를 고르세요.'],
    ['typecast', 'Typecast', 'Typecast API 키를 입력하고 계정에서 사용할 목소리를 불러오세요. 직접 추가할 때는 해당 서비스의 voice ID를 사용해요.'],
    ['cartesia', 'Cartesia', 'Cartesia API 키와 음성 모델을 고르세요. 목소리 탭에서 계정 목록을 가져오거나 본인이 사용할 수 있는 voice ID를 직접 입력해요.'],
    ['gtranslate', 'Google 번역 · 무료', 'API 키 없이 사용해요. 목소리 목록에서 언어를 고르세요. 실리태번에 Google 음성 생성 경로가 있어야 하며, 경로가 없다는 안내가 나오면 브라우저 내장 등 다른 엔진을 사용하세요.'],
];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sample = '[\n  {"voiceId":"my_voice_id","name":"안내","lang":"ko","group":"내 목소리"}\n]';

export function guideHtml() {
    return `<section class="bl-tts-guide" style="text-align:left;overflow-wrap:anywhere">
      <h3>TTS 사용법 <small>v${TTS_VERSION}</small></h3>
      <p>채팅 속 대사를 캐릭터마다 다른 목소리로 들을 수 있어요. 처음에는 짧은 문장 하나만 재생해 보면 돼요.</p>
      <h4>처음이라면: 무료 음성으로 시작</h4>
      <ol>
        <li>블루 레몬에이드의 <b>애드온 → TTS</b>를 켜고 세부 설정을 열어요.</li>
        <li><b>엔진 → 브라우저 내장</b>을 골라요. API 키는 필요 없어요.</li>
        <li><b>목소리 → 계정에서 불러오기 → 브라우저 내장</b>에서 원하는 음성을 가져와요. 기기의 음성을 읽는 메뉴예요.</li>
        <li><b>기본 목소리</b>를 고르고, 목소리 목록의 재생 버튼으로 “안녕하세요.”를 들어 보세요.</li>
        <li>캐릭터 채팅을 열고 <b>캐릭터별 목소리</b>를 지정한 뒤, 채팅의 따옴표 대사를 눌러요. 캐릭터별 지정이 없으면 기본 목소리를 사용해요.</li>
      </ol>
      <p>읽기 탭의 <b>대사 클릭</b>을 켜 두세요. 처음 설치하면 자동 읽기·미리 만들기·감정 분석은 꺼져 있어 누른 대사부터 시험할 수 있어요. 무료 시험에 감정 분석은 필요 없어요. 이전에 저장한 설정은 유지해요.</p>
      <details>
        <summary><b>API 목소리를 쓰고 싶어요</b></summary>
        <p><b>엔진 연결 → 목소리 등록 → 캐릭터 지정 → 대사 클릭</b> 순서예요. 아래에서 사용할 엔진을 골라 입력할 값을 확인하세요.</p>
        <label>사용할 엔진 <select class="text_pole" style="display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box" data-tts-guide-provider aria-label="사용법에서 엔진 선택">${providers.map(([id,name])=>`<option value="${id}">${escape(name)}</option>`).join('')}</select></label>
        ${providers.map(([id,,text],i)=>`<p data-tts-guide-help="${id}"${i?' hidden':''}>${escape(text)}</p>`).join('')}
        <p>키를 저장한 다음 <b>연결 확인</b>을 눌러요. 키 줄 아래 <b>잔액 줄</b>에 남은 글자·크레딧이 보여요 (ElevenLabs · Typecast · OpenRouter · Cartesia; MiniMax는 쓴 글자와 결제 페이지 링크). 유료 엔진의 음성 시험과 감정 분석은 API 사용량이 생길 수 있어요. 직접 등록할 때 <b>이름</b>은 화면에 보일 이름, <b>목소리 ID</b>는 서비스가 발급한 값이에요.</p>
      </details>
      <details>
        <summary><b>목소리 목록 JSON은 어떻게 넣나요?</b></summary>
        <p>MiniMax 목소리를 여러 개 등록할 때 <b>목소리 → 목록 붙여넣기</b>를 사용해요. 아래 예시의 <code>my_voice_id</code>를 본인이 사용할 수 있는 실제 ID로 바꾸세요.</p>
        <pre style="white-space:pre-wrap;overflow-wrap:anywhere"><code>${escape(sample)}</code></pre>
        <p><code>voiceId</code>는 필수예요. <code>name</code>은 표시 이름, <code>lang</code>은 <code>ko</code>·<code>ja</code>·<code>en</code>·<code>zh</code>, <code>group</code>은 목록의 묶음이에요. 같은 ID를 다시 넣으면 이름 등 제공한 정보를 갱신해요. API 키는 목록에 넣지 않아요. 다른 엔진은 <b>직접 추가</b>에서 엔진을 골라 등록해요.</p>
      </details>
      <details>
        <summary><b>소리가 안 나거나 다른 목소리로 읽어요</b></summary>
        <ul>
          <li><b>아무 소리도 없어요:</b> TTS와 대사 클릭이 켜졌는지, 기본 목소리가 선택됐는지 확인해요. 기기 음량·브라우저 탭 음소거를 확인하고 재생 버튼을 직접 한 번 누르세요.</li>
          <li><b>대사를 눌러도 안 돼요:</b> 일반 글이나 링크가 아닌 대화문을 눌러 보세요. 메시지의 읽기 버튼으로도 시험할 수 있어요.</li>
          <li><b>목소리가 없다고 해요:</b> voice ID가 예시 값인지, 현재 API 계정에서 사용할 수 있는 목소리인지 확인하고 목록을 다시 불러와요.</li>
          <li><b>인증·잔액·연결 오류:</b> 엔진의 키·지역·주소·사용량을 확인해요. 직접 서버를 쓰면 서버가 켜져 있는지도 확인하세요.</li>
          <li><b>캐릭터가 다르게 들려요:</b> 현재 캐릭터의 목소리 연결을 확인해요. 화자를 못 찾으면 기본 목소리를 사용해요. 여러 화자가 나오는 글은 이름이나 대화 색 연결도 맞춰 주세요.</li>
          <li><b>두 번 읽어요:</b> 같은 기능의 이전 TTS 확장이나 실리태번 기본 TTS가 함께 자동 읽기 중인지 확인해요. 이전 확장을 끈 뒤 새로고침하세요.</li>
        </ul>
        <p>실패 이유는 <b>데이터 → 기록</b>에서도 볼 수 있어요. 새 음성 요청이 느린 경우 같은 대사를 다시 들을 때는 캐시를 사용할 수 있어요.</p>
      </details>
      <details>
        <summary><b>상태창은 빼고 본문만 읽고 싶어요</b></summary>
        <p><b>읽기 → 본문과 제외할 내용</b>에서 골라요. 새 설정은 상태창·계획·미디어 태그 안의 내용과 코드 블록을 제외해요. 별도 태그가 없는 본문도 읽고, <code>&lt;prose&gt;</code> 같은 본문 태그는 안쪽 글을 살려요.</p>
        <ul>
          <li><b>건너뛸 태그:</b> 태그 안의 내용까지 빼요. 예를 들어 <code>status</code>를 넣으면 <code>&lt;status&gt;상태 정보&lt;/status&gt;</code> 전체를 읽지 않아요. 쉼표로 구분해요.</li>
          <li><b>추가로 지울 글(정규식):</b> 규칙에 맞는 부분만 빼요. 태그 자체는 자동 정리하므로 보통 비워 두세요. 태그만 지우는 규칙은 상태창의 내용 제외나 감정 힌트를 방해할 수 있어요.</li>
          <li><b>속마음:</b> 태그 제외 목록이 아니라 <b>읽을 부분 → 직접 설정 → 속마음</b>에서 골라요.</li>
        </ul>
        <p>이전 설정이 복잡하면 <b>본문 필터 기본값</b>을 누르세요. 바뀔 내용을 확인한 뒤에만 적용해요. 읽을 부분·속마음·목소리·분석 연결·발음 사전은 유지하고, 정규식을 비워 감정 힌트를 살려요. 기존 사용자의 값이나 저장된 채팅은 업데이트만으로 바뀌지 않아요.</p>
      </details>
      <details>
        <summary><b>고급: 감정과 원어로 읽기</b></summary>
        <p>원할 때 <b>읽기 → 대사 분석</b>에서 분석용 API·모델을 연결한 뒤 <b>사용</b>을 켜요. 이 모델은 대사의 감정과 번역을 정하고, 실제 소리는 <b>엔진</b> 탭의 음성 모델이 만들어요. 채팅에 쓰는 API 연결을 이용하거나 별도 연결을 지정할 수 있어요.</p>
        <p>목소리의 원어를 정하고 번역 옵션을 켜면 해당 언어로 읽을 수 있어요. 분석은 대사·화자·주변 문맥 일부를 선택한 분석 서비스에 보내므로 별도 사용량이 생겨요.</p>
        <p>감정 지원은 엔진·모델·목소리마다 달라요. 브라우저 내장·Google 번역은 감정 파라미터를 지원하지 않아요. MiniMax 2.8 처럼 속삭임이 없는 모델은 속마음 · 속삭이는 대사만 같은 등급의 2.6 모델로 읽어요. 분석이 ‘차분’이라고 한 대사는 감정을 따로 보내지 않고 엔진이 글을 보고 정해요. <b>감정 세기</b>는 약하게(감정을 따로 보내지 않음, 속삭임만 유지) · 보통 · 강하게(MiniMax 2.8 에서 감정에 맞춰 숨 · 웃음 · 한숨 · 헉 소리를 붙임) 중에서 골라요. <b>속마음</b>은 속삭임 또는 일반(속삭이지 않고 엔진이 글을 보고 감정을 정함)으로 읽어요. 일부 모델은 말투 지시를 무시할 수 있어요. 분석을 켜는 것만으로 감정 연기의 세기가 보장되지는 않아요.</p>
      </details>
      <details>
        <summary><b>재생 표시·자동 읽기·저장</b></summary>
        <p><b>블루 레몬에이드 → 확장 → TTS → 표시할 위치</b>의 <b>확장 탭에 TTS 설정 표시</b>를 켜면 실리태번 확장 탭에서 바로 설정해요. 기본은 켬이에요. 숨겨도 블루 레몬에이드의 세부 설정과 켜 둔 요술봉 메뉴에서 같은 설정을 열 수 있어요.</p>
        <p><b>읽기 → 재생 → 재생 표시</b>에서 색깔만 / 색깔 + 밑줄 / 밑줄만을 골라요. 재생 중에도 바로 바뀌고, 읽는 대사 강조를 끄면 표시하지 않아요.</p>
        <p>자동 읽기는 새 답장을 읽고, 미리 만들기는 다음 클릭을 빠르게 하도록 소리를 먼저 만들어요. MiniMax 공식 서버 같은 유료 엔진은 미리 만들지 않고 누른 줄만 만들어요. <b>유료 엔진도 미리 만들기</b>를 켜면 듣지 않은 소리도 요청 사용량이 생겨요. 자동 읽기·미리 만들기·감정 분석은 필요한 것만 켜면 돼요.</p>
        <p>키는 TTS 설정 내보내기에 포함하지 않아요. 등록한 목소리와 기존 <code>lemon_voice</code> 설정은 이어 쓰고, 만든 소리는 브라우저 캐시에 저장해요. 애드온을 끄면 재생과 새 요청을 멈추지만 이미 서비스에 도착한 요청의 요금까지 취소되지는 않아요.</p>
      </details>
    </section>`;
}

let opening = false;
export async function showTtsGuide() {
    if (opening) return;
    opening = true;
    try {
        const { POPUP_TYPE, callGenericPopup } = await import('../../../../../../popup.js');
        const root = document.createElement('div'); root.innerHTML = guideHtml();
        root.addEventListener('change', event => {
            if (!event.target.matches('[data-tts-guide-provider]')) return;
            for (const item of root.querySelectorAll('[data-tts-guide-help]')) item.hidden = item.dataset.ttsGuideHelp !== event.target.value;
        });
        await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') });
    } finally { opening = false; }
}
