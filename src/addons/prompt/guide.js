// Blue Lemonade guide and accessible controls. Modified 2026-09-24. AGPL-3.0.
const chapters = [
 ['처음이라면 이 순서로', `<ol><li>메뉴부터 한글로 보고 싶다면 <b>한글화</b> 탭에서 필요한 항목을 켜세요. 기존 설정을 이어 쓰며 API를 호출하지 않아요.</li><li><b>프리셋</b> 탭에서 평소 쓰는 프리셋 이름을 고르고 <b>불러오기</b>를 누르세요. 불러오기와 검색은 번역 API를 호출하지 않아요.</li><li>항목을 펼쳐 원문을 읽어 보세요. 체크박스는 작업할 항목을 고르는 것이며 실리태번의 실제 프롬프트 켜짐/꺼짐을 바꾸는 스위치가 아니에요.</li><li>상단 <b>설정 → 연결</b>에서 공급자·모델·언어를 확인하세요. 이 패널의 연결 설정은 채팅 번역기와 별개예요.</li><li>한 항목만 선택하고 <b>번역</b>을 눌러 결과를 확인하세요. 번역은 선택한 공급자에 내용을 보내고 API 요금이 발생할 수 있어요.</li><li>마음에 들면 필요한 항목을 더 번역하거나 복사·내보내기를 쓰세요. 읽기만 할 때는 <b>원본에 적용</b>할 필요가 없어요.</li></ol>`],
 ['이 패널로 무엇을 하나요?', `<p>여러 화면에 흩어진 프롬프트를 <b>읽기·검색·번역·내보내기</b>하는 작업대예요. 외국어 프리셋의 각 토글이 무엇을 하는지 읽고 싶거나, 월드인포 내용을 비교하거나, 봇카드의 특정 설명만 번역할 때 편해요.</p><p>채팅 메시지를 자동으로 번역하는 LLM 번역기와는 달라요. 여기서는 프리셋·월드인포·봇카드를 직접 선택해서 작업합니다. 패널을 여는 것만으로 대화가 생성되거나 전체 자료가 번역되지는 않아요.</p>`],
 ['탭별로 무엇을 하나요?', `<dl><dt>한글화</dt><dd>실리태번·타번 헬퍼 메뉴와 데우스·샤진의 이름을 준비된 사전으로 표시해요. 기존 한글화 설정을 그대로 이어 쓰고 API 없이 켜고 끌 수 있어요. 남은 영어 찾기는 화면에 남은 영어 UI를 모아요.</dd><dt>정규식</dt><dd>현재 전역·프리셋·봇카드의 정규식 이름을 불러와 API로 번역해요. 저장된 이름이나 검색식·치환식은 바꾸지 않고 화면에 표시해요.</dd><dt>설정</dt><dd>API 연결, 번역 방식, 화면 설명 표시, 캐시를 관리해요.</dd><dt>프리셋</dt><dd>채팅 완성 프리셋에 들어 있는 프롬프트 토글을 읽어요. 글쓰기 규칙이나 형식 지시가 어떤 역할을 하는지 제목부터 번역해 볼 수 있어요. 정규식·그룹·JS러너의 제목도 개조본의 지원 범위 안에서 다룹니다.</dd><dt>월드인포</dt><dd>로어북의 각 엔트리와 발동 키워드, 위치·깊이·순서 같은 정보를 읽어요. 이 수치들은 내용 번역과 다른 설정이며 의미를 모르면 그대로 두는 편이 좋아요.</dd><dt>봇카드</dt><dd>캐릭터 설명·성격·시나리오·첫 메시지 등 카드의 필드를 읽어요. 체크한 필드만 번역해서 어떤 문장이 바뀌는지 확인할 수 있어요. 카드 이미지를 생성하는 도구는 아니에요.</dd></dl>`],
 ['불러오기 · 새로고침 · 검색', `<p>위쪽 이름 입력칸은 <b>자료 이름 찾기</b>, 작업 줄의 검색칸은 <b>불러온 항목 내용 찾기</b>예요. 자료를 선택한 뒤 불러오기를 눌러야 작업 대상이 바뀝니다. 새로 추가한 자료가 없다면 우측 상단 새로고침으로 목록을 갱신하세요.</p><p>검색은 원문과 번역문을 함께 찾습니다. 검색으로 보이는 항목 수와 체크된 항목 수는 다를 수 있으니 실행 전에 선택 수를 확인하세요. 토큰 표시는 비용·문맥 크기를 가늠하기 위한 추정치이며 실제 모델 청구량과 다를 수 있어요.</p>`],
 ['번역 · 재번역 · 제목 보기', `<dl><dt>번역</dt><dd>대상 항목의 본문 또는 주석 번역 방식을 고릅니다. 기존 캐시가 있으면 재사용할 수 있어요. 선택이 없을 때 전체가 대상이 될 수 있으니 처음에는 한 항목을 체크하세요.</dd><dt>재번역</dt><dd>이미 번역된 항목도 모델에 다시 요청해요. 결과가 달라질 수 있고 비용이 다시 발생할 수 있어요.</dd><dt>제목</dt><dd>긴 본문 대신 토글·엔트리 이름을 번역해요. 제목 묶음 크기는 한 요청에 묶을 개수이며 본문을 요약하는 기능은 아니에요.</dd><dt>제목 보기</dt><dd>패널 안 제목을 번역본/원문으로 번갈아 보여줘요. 이 표시 전환만으로 원본 자료의 이름을 덮어쓰지는 않아요.</dd><dt>중단</dt><dd>진행 중인 번역 중단을 요청해요. 이미 공급자에서 처리한 요청 비용까지 취소되는 것은 아니며, 먼저 완료된 번역은 남을 수 있어요.</dd></dl>`],
 ['본문 번역과 주석 번역', `<p><b>본문 번역</b>은 실제 내용을 다른 언어로 옮긴 결과예요. <b>주석 번역</b>은 원문을 유지하면서 읽기 위한 설명을 별도 주석으로 덧붙이는 방식이에요. 제목·본문·주석 언어는 각각 정할 수 있어요.</p><p>주석은 실리태번의 <code>{{// … }}</code> 형식으로 들어갑니다. 이 형식은 일반적으로 모델에 보내지 않는 주석에 사용돼요. 하지만 내보낸 파일을 다른 프로그램이나 별도 처리기로 읽으면 취급이 다를 수 있으니 사용 환경을 확인하세요.</p><p>변수·매크로·정규식 같은 기호는 뜻을 가진 코드일 수 있어요. 번역 후 중요한 지시문과 기호가 유지됐는지 직접 확인하세요. 번역 품질과 지시문의 동일한 효과를 보장하지는 않아요.</p>`],
 ['보기와 원본에 적용은 달라요', `<p><b>불러오기·검색·제목 보기</b>는 자료를 읽거나 표시를 바꾸는 작업이에요. <b>번역</b>은 결과를 번역 캐시에 저장합니다.</p><p><b>번개 아이콘 「원본에 적용」은 실제 프리셋·월드인포·봇카드 파일을 덮어쓰는 기능</b>이에요. 단순히 패널 화면에 적용한다는 뜻이 아니에요. 적용 전에 원본을 실리태번에서 별도로 내보내 백업하세요. 이 패널의 번역본 JSON은 원본 백업을 대신하지 않아요.</p><p>적용할 자료 이름·제목만/본문 포함·선택 범위를 확인한 뒤 마지막 확인창에서 결정하세요. 취소하면 쓰기를 진행하지 않아요. 적용 후 한 번에 되돌리는 공통 버튼은 없으므로 복구에는 백업이 필요해요.</p>`],
 ['자료별 적용 범위', `<dl><dt>프리셋</dt><dd>구조를 보존하기 위해 전체 프리셋 단위로 저장해요. 패널에서 일부 토글만 체크했다고 그 토글만 원본에 적용되는 것은 아니에요. 제목만 적용과 제목+본문 적용을 구분하세요.</dd><dt>월드인포</dt><dd>선택한 엔트리가 있으면 그 항목, 선택이 없으면 전체가 대상이에요. 키워드를 번역하면 발동 조건에도 영향을 줄 수 있어요. 특히 모든 키워드 일치를 요구하는 조건은 단순히 키워드를 추가하는 것과 결과가 달라요.</dd><dt>봇카드</dt><dd>선택한 필드의 번역을 적용해요. 선택이 없으면 전체가 대상이 될 수 있어요. 첫 메시지나 설명을 바꾸면 이후의 사용에 영향을 주므로 먼저 복제 카드에서 확인하세요.</dd></dl>`],
 ['복사 · TXT · JSON · 제목 스크립트', `<dl><dt>복사 / TXT</dt><dd>읽기 좋은 텍스트를 클립보드나 파일로 꺼내요. 원문·번역문·둘 다 중 원하는 형식을 고를 수 있어요. TXT는 실리태번 설정을 복원하는 백업 형식이 아니에요.</dd><dt>JSON</dt><dd>실리태번에서 다시 가져올 수 있는 구조로 내보내요. 프리셋은 전체 구조를 보존하고, 월드인포와 봇카드는 선택 범위에 따라 결과가 달라요. 내보내기만으로 설치된 원본을 바꾸지는 않아요.</dd><dt>JS Runner 제목 스크립트</dt><dd>지원되는 내보내기 메뉴에서 제목용 스크립트를 만들 수 있어요. 사용하려면 Tavern Helper/JS Runner가 필요해요. 생성한 스크립트의 안내와 적용·복원 범위를 읽고 사용하세요. 패널 안의 「제목 보기」 버튼과는 다른 기능입니다.</dd></dl>`],
 ['번역 메모리와 캐시', `<p>번역 캐시는 번역 결과를 다시 읽기 위한 저장소예요. 이 개조본은 실리태번 서버의 사용자 파일 영역에 캐시를 저장하고, 이전 IndexedDB 캐시를 읽어 옮기는 경로도 포함해요. 브라우저만 닫는다고 매번 번역이 사라지는 방식은 아니에요.</p><p>프리셋·월드인포의 <b>번역 메모리</b> 버튼으로 지원되는 결과를 파일로 내보내거나 가져올 수 있어요. 이는 원본 프리셋 전체 백업과 달라요. 다른 자료에 가져올 때는 항목이 맞는지 확인하세요.</p><p><b>캐시 삭제는 번역 결과를 지우는 작업</b>이에요. 이미 원본에 적용한 내용을 원어로 돌려놓지 않습니다. 삭제 전 필요한 번역은 내보내세요.</p>`],
 ['번역 설정: 공급자 · 모델 · 연결', `<p>상단 <b>설정 → 연결</b>에서 설정 창을 열 수 있어요. 확장 탭의 한글화 패널 설정과 같은 화면이라 양쪽 값이 따로 저장되지 않아요.</p><dl><dt>공급자 직접 선택</dt><dd>사용할 API 종류와 모델을 선택해요. 실리태번에 해당 공급자의 연결 정보가 준비돼 있어야 합니다. 목록에 없으면 커스텀 모델에 정확한 모델 ID를 입력하세요.</dd><dt>ST 프로필</dt><dd>다운받은 개조본에 포함된 연결 프로필 기능이에요. 미리 만든 프로필을 골라 연결·모델을 사용합니다. 선택 가능한 프로필이 없으면 먼저 실리태번에서 만들거나 공급자를 직접 선택하세요. 프로필 모드에서는 직접 모델·샘플링·프록시 입력이 숨겨집니다.</dd><dt>역방향 프록시</dt><dd>사용하는 중계 서버가 있을 때만 주소와 필요한 인증 정보를 설정하세요. 번역 대상 내용이 그 서버로 전달됩니다.</dd></dl>`],
 ['속도 · 재시도 · 응답 길이', `<dl><dt>동시 요청 수</dt><dd>한 번에 처리할 작업 수예요. 높이면 빨라질 수 있지만 공급자 한도에 더 빨리 걸릴 수 있어요. 처음에는 1로 결과를 확인하세요.</dd><dt>요청 간 대기</dt><dd>요청 사이의 대기 시간(ms)이에요. 1000ms는 1초예요. 요청 한도 오류가 나면 동시 수를 낮추고 대기를 늘려 보세요.</dd><dt>재시도</dt><dd>네트워크·요청 한도·서버 오류처럼 일시적인 실패에 다시 요청하는 횟수예요. 잘못된 인증이나 모델 이름을 자동으로 고쳐 주지는 않아요.</dd><dt>시간 제한</dt><dd>응답을 기다리는 상한이에요. 느린 모델에서 너무 짧으면 정상 요청도 중단될 수 있어요.</dd><dt>출력 토큰 / 샘플링</dt><dd>공급자가 지원하는 항목만 실제 요청에 전달돼요. 출력이 잘리면 길이 제한을 확인하고 작은 항목으로 먼저 시험하세요. 값이 클수록 번역이 항상 좋아지는 것은 아니에요.</dd><dt>프리필</dt><dd>모델 답변의 시작을 미리 지정하는 기능이에요. 지원하지 않는 모델도 있어 처음 설치할 때는 꺼져 있어요.</dd></dl>`],
 ['원하는 모습으로 쓰기', `<p>블루레몬에이드 색을 따라가며 테마 선택은 따로 없어요. 원문·번역문 글자 크기는 설정 → 화면에서 조절하세요.</p><p>설정 → 화면의 설명 표시를 끄면 보조 설명을 숨겨요. 버전 버튼의 상세 사용방법은 언제든 다시 열 수 있어요. 플로팅 버튼 없이 확장 탭의 한글화 패널 열기로 사용합니다.</p>`],
 ['막혔을 때 확인하기', `<dl><dt>목록이 비었어요</dt><dd>해당 종류의 자료가 실리태번에 있는지 확인한 뒤 새로고침하세요. 프리셋 탭은 채팅 완성 프리셋을 대상으로 해요.</dd><dt>번역이 시작되지 않아요</dt><dd>자료를 불러왔는지, 모델 또는 ST 프로필을 선택했는지 확인하세요. 공급자 인증도 확인하세요. 설정을 바꾼 뒤에는 한 항목으로 다시 시험하세요.</dd><dt>번역이 이전 결과로 보여요</dt><dd>캐시가 재사용될 수 있어요. 새로운 결과가 필요하면 재번역을 쓰세요. 전체 캐시를 지우기 전에 해당 항목으로 확인하는 편이 좋아요.</dd><dt>원본에 적용했는데 화면이 그대로예요</dt><dd>현재 사용 중인 자료와 적용 대상이 같은지 확인하세요. 일부 연결 확장은 프리셋을 다시 선택하거나 설정 창을 다시 열어야 새 이름을 읽습니다.</dd><dt>두 패널이나 두 버튼이 떠요</dt><dd>원본 Prompt Panel과 이 개조본이 함께 켜져 있는지 확인하세요. 설정과 캐시를 공유하므로 한 버전만 켜세요.</dd></dl>`],
 ['출처 · 수정 · 라이선스', `<p>원본 <a href="https://github.com/anon4961/prompt-panel" target="_blank" rel="noopener noreferrer">anon4961 / Prompt Panel</a> · AGPL-3.0. 사용자가 제공한 개인개조+++ 버전 위에 2026-09-24 블루레몬에이드 화면·도움말·LLM 연결 방식을 추가했어요. 원작자·수정자와 라이선스의 전체 고지는 블루레몬에이드 버전 옆 ⓒ 버튼에서도 확인할 수 있어요.</p><p>이 프로그램은 무보증으로 제공됩니다. AGPL-3.0 조건에 따라 수정·재배포할 수 있으며, 원작자 고지와 해당 조건을 지켜야 합니다. 배포 ZIP의 LICENSE와 수정 가능한 소스를 참고하세요.</p>`],
];
const intro = {
 preset:['프리셋의 지시문을 읽는 곳','평소 쓰는 프리셋을 고르고 불러오세요. 제목부터 번역하면 각 토글의 역할을 빠르게 훑을 수 있어요. 체크는 작업 선택이며 실제 토글의 켜짐/꺼짐을 바꾸지 않아요.'],
 wi:['로어북의 엔트리를 읽는 곳','월드인포를 고르고 불러오세요. 본문과 발동 키워드를 함께 살펴볼 수 있어요. 원본에 적용하면 키워드 조건도 바뀔 수 있으니 번역 결과를 먼저 확인하세요.'],
 char:['캐릭터카드의 필드를 읽는 곳','봇카드를 고르고 불러오세요. 설명·성격·첫 메시지 중 필요한 필드를 골라 번역해 볼 수 있어요. 읽거나 번역만 할 때는 원본 카드가 덮어써지지 않아요.'],
};
export function installGuide({doc,cfg,save,openPanel,closePanel}) {
 const panel=doc.getElementById('pt-panel');if(!panel||panel.dataset.blGuide)return;
 panel.dataset.blGuide='true';panel.setAttribute('aria-label','한글화 패널');
 const header=panel.querySelector('#pt-panel-header'),tabs=panel.querySelector('#pt-tabs'),content=panel.querySelector('#pt-panel-content');
 const version=doc.createElement('button');version.type='button';version.className='pt-version';version.dataset.ptGuide='';version.textContent='v1.1.0';version.setAttribute('aria-label','한글화 패널 사용방법');header.querySelector('h3').append(version);
 const settingsTab=doc.createElement('button');settingsTab.type='button';settingsTab.className='pt-tab';settingsTab.dataset.tab='settings';settingsTab.textContent='설정';tabs.append(settingsTab);
 const settingsPage=doc.createElement('div');settingsPage.id='pt-page-settings';settingsPage.className='pt-page';content.append(settingsPage);settingsPage.append(doc.getElementById('pt-settings-form'));
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','한글화 패널 메뉴');
 function activate(key){
  for(const tab of tabs.querySelectorAll('.pt-tab')){const on=tab.dataset.tab===key;tab.id=`pt-main-tab-${tab.dataset.tab}`;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`pt-page-${tab.dataset.tab}`);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;tab.classList.toggle('active',on);}
  for(const page of content.children){const on=page.id===`pt-page-${key}`;page.classList.toggle('active',on);page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',`pt-main-tab-${page.id.replace('pt-page-','')}`);}
 }
 tabs.querySelectorAll('.pt-tab').forEach(tab=>tab.addEventListener('click',()=>activate(tab.dataset.tab)));
 const keyboardTabs=nav=>nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...nav.querySelectorAll('[role="tab"]')];const current=buttons.indexOf(doc.activeElement);if(current<0)return;event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});keyboardTabs(tabs);
 const settingsNav=doc.querySelector('.pt-settings-nav');keyboardTabs(settingsNav);
 settingsNav.querySelectorAll('button').forEach(button=>button.onclick=()=>{
  for(const tab of settingsNav.children){const on=tab===button;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
  for(const page of settingsPage.querySelectorAll('[data-setting-page]'))page.hidden=page.dataset.settingPage!==button.dataset.settingTab;
  settingsPage.querySelector('.pt-settings-scroll').scrollTop=0;
 });
 const helpCheck=doc.getElementById('pt-help-check');
 function syncHelp(){panel.classList.toggle('pt-bl-no-help',cfg().blShowHelp===false);helpCheck.checked=cfg().blShowHelp!==false;}
 helpCheck.onchange=()=>{cfg().blShowHelp=helpCheck.checked;save();syncHelp();};syncHelp();
 for(const [key,[title,body]] of Object.entries(intro)){
  const scroll=panel.querySelector(`#pt-page-${key} .pt-page-scroll`),note=doc.createElement('details');note.className='pt-bl-intro pt-bl-help';note.innerHTML=`<summary>${title}</summary><p>${body}</p>`;scroll.prepend(note);
  const prefix=key==='preset'?'pt-preset':key==='wi'?'pt-wi':'pt-char';
  for(const [suffix,label] of Object.entries({load:'불러오기',apply:'원본에 적용',copy:'복사',txt:'TXT 내보내기',json:'JSON 내보내기',tm:'번역 메모리',eye:'제목 보기',clr:'이 자료의 번역 캐시 삭제'})){
   const el=panel.querySelector(`#${prefix}-${suffix}`);if(!el)continue;el.setAttribute('aria-label',label);el.title=label;
   if(suffix==='load')el.textContent=label;
   if(suffix==='apply'){el.classList.add('pt-bl-apply');el.innerHTML='<i class="fa-solid fa-bolt" aria-hidden="true"></i><span>원본에 적용</span>';}
  }
 }
 let dialog=null,returnFocus=null;
 chapters.push(['정규식 이름 번역', '<p>정규식 탭에서 현재 정규식을 불러오고 번역할 항목을 선택하세요. 선택한 이름만 API로 전송합니다. 번역 결과를 확인하고 화면에 표시를 누르면 정규식 목록·툴팁에 적용돼요. 원문 표시로 언제든 되돌릴 수 있어요.</p><p>검색식·치환식·정규식의 켜짐 상태·저장된 원본 이름은 바꾸지 않습니다. 한글화 탭의 데우스·샤진 사전과 함께 사용할 수 있어요. 직접 번역해 적용한 이름이 우선하고, 원문 표시를 누르면 사전 번역이 다시 보여요.</p>']);
 const groups=[['시작하기',[0,1,2,3]],['번역·적용',[4,5,6,7,8,9,15]],['연결·설정',[10,11,12]],['문제 해결·출처',[13,14]]];
 function showGuide(){
  if(dialog?.open)return;returnFocus=doc.activeElement;
  dialog=doc.createElement('dialog');dialog.className='pt-help-dialog';dialog.setAttribute('aria-label','한글화 패널 사용방법');
  dialog.innerHTML=`<header><div><small>BLUE LEMONADE</small><h2>한글화 패널 사용방법</h2></div><button type="button" aria-label="사용방법 닫기">×</button></header><nav role="tablist" aria-label="사용방법 주제">${groups.map(([name],i)=>`<button type="button" role="tab" id="pt-help-tab-${i}" aria-controls="pt-help-topic-${i}" aria-selected="${!i}" tabindex="${i?-1:0}" data-help-group="${i}">${name}</button>`).join('')}</nav><div class="pt-help-body">${groups.map(([,indices],i)=>`<section role="tabpanel" id="pt-help-topic-${i}" aria-labelledby="pt-help-tab-${i}" data-help-page="${i}" ${i?'hidden':''}>${i===0?'<p class="pt-help-lead">메뉴를 한글로 보고, 외국어 프롬프트와 정규식 이름을 번역하는 도구예요.</p>':''}${indices.map((n,j)=>`<details class="pt-help-chapter" ${j===0?'open':''}><summary>${chapters[n][0]}</summary><div>${chapters[n][1]}</div></details>`).join('')}</section>`).join('')}</div><footer><label class="pt-check"><input type="checkbox" data-help-inline ${cfg().blShowHelp!==false?'checked':''}><span>작업 화면에 보조 설명 표시</span></label><button type="button" class="pt-ui-button" data-help-start>패널 사용하기</button></footer>`;
  doc.body.append(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.querySelector('[data-help-start]').onclick=()=>{dialog.close();openPanel();};
  dialog.querySelector('[data-help-inline]').onchange=event=>{cfg().blShowHelp=event.target.checked;save();syncHelp();};
  const nav=dialog.querySelector('nav');keyboardTabs(nav);
  nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{for(const tab of nav.children){const on=tab===button;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}for(const page of dialog.querySelectorAll('[data-help-page]'))page.hidden=page.dataset.helpPage!==button.dataset.helpGroup;dialog.querySelector('.pt-help-body').scrollTop=0;});
  dialog.addEventListener('close',()=>{dialog.remove();dialog=null;if(returnFocus?.isConnected)returnFocus.focus();},{once:true});
  dialog.showModal();cfg().blIntroSeen110=true;save();
 }
 doc.querySelectorAll('[data-pt-guide]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();showGuide();}));
 panel.addEventListener('pt:opened',()=>{if(!cfg().blIntroSeen110)showGuide();});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog?.open){event.stopPropagation();closePanel();}});
 activate('localization');
}
