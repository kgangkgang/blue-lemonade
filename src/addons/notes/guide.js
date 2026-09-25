// 메모 사용방법 — 패널 머리 · 큰 창 머리의 버전 버튼을 누르면 뜨는 창 (한글화 패널 사용방법과 같은 모양: 주제 탭 + 펼치는 장)
// 정적 글만 (사용자 자료 없음). 애드온이 꺼져 있어도 열 수 있게 메모 스타일만 따로 붙인다.
import { NOTES_VERSION } from './version.js';

const CHAPTERS = [
    ['메모는 이런 거예요', `<p>제목과 내용을 적어 두는 쪽지예요. 롤플하면서 설정 · 할 일 · 떡밥 · 말투 같은 걸 적어 두고, 채팅하다가 바로 꺼내 봐요.</p>
<p>메모는 실리태번 설정 파일에 같이 저장돼요. 새로고침해도, 같은 실리태번에 접속한 다른 기기에서도 그대로 남아요. 모두 300개까지 둘 수 있어요.</p>`],
    ['여는 곳', `<dl><dt>입력창 위 메모 줄</dt><dd>빠른 답장처럼 메모 제목이 칩으로 늘 보여요. 칩을 누르면 그 메모 하나만 펼쳐서 바로 고쳐요. 한 번 더 누르면 접혀요.</dd>
<dt>☰ 짧게 누르기</dt><dd>입력창 위에 작은 목록이 열려요. 큰 창과 똑같이 쓰고 고칠 수 있어요.</dd>
<dt>☰ 길게 누르기 · 요술봉 › 메모</dt><dd>큰 창이 열려요. 여러 장을 한눈에 볼 때 편해요.</dd></dl>
<p>메모 줄과 요술봉 메뉴는 블루레몬에이드 › 확장 › 메모 › 미리보기에서 숨기거나 다시 보여요.</p>`],
    ['쓰고 고치기', `<ol><li><b>+</b> 를 누르면 새 메모가 맨 위에 생겨요. 제목을 적고 엔터를 누르면 내용 칸으로 넘어가요.</li>
<li>쓰는 동안은 글자 그대로 보이고, 칸 밖을 누르면 <b>채팅과 같은 모습</b>으로 그려져요. 표시 정규식 · 마크다운 · 대사 색 · 감정 대사가 모두 적용돼요.</li>
<li>그려진 내용을 다시 누르면 고치기로 돌아가요. 따로 저장 버튼은 없어요. 쓰는 대로 저장돼요.</li></ol>`],
    ['서식 버튼 (펜)', `<p>고치는 중에 제목 옆 <b>펜</b>을 누르면 서식 버튼이 펼쳐져요. 글을 선택하고 누르면 감싸고, 한 번 더 누르면 풀려요.</p>
<dl><dt>굵게 · 기울기 · 취소선 · 밑줄 · 코드</dt><dd>채팅에서 쓰는 마크다운 그대로예요. 기울기는 속마음 색으로 보여요.</dd>
<dt>제목</dt><dd>누르면 H1 · H2 · H3 중에서 골라요.</dd>
<dt>목록</dt><dd>점 목록 · 번호 목록 · 체크박스 목록 중에서 골라요. 목록 줄에서 엔터를 누르면 다음 항목이 이어지고, 빈 항목에서 엔터를 누르면 목록이 끝나요. 체크박스는 그려진 모습에서 눌러 체크해요.</dd>
<dt>형광펜</dt><dd>테마의 형광펜 색으로 칠해요.</dd>
<dt>링크</dt><dd>외부 링크(인터넷 주소)를 달거나, 다른 메모를 끌어와요. 자세한 건 태그·연결 탭에서 볼 수 있어요.</dd></dl>
<p>대사 따옴표 · 글자색 버튼은 처음엔 숨겨져 있어요. 톱니 › 서식 버튼에서 켜고, 끄고, 끌어서 순서를 바꿔요.</p>`],
    ['어디에 보이나요 (귀속)', `<p>채팅 안에서 만든 메모는 <b>그 채팅에서만</b> 보여요. 날짜 옆에 캐릭터 프로필 동그라미가 붙어 있어요.</p>
<p>채팅을 열지 않은 첫 화면에서 만든 메모는 <b>전체 메모</b>예요(지구 표시). 어느 채팅에서나 보여요.</p>
<dl><dt>동그라미 누르기</dt><dd>옆에 그 채팅방 이름이 나와요.</dd>
<dt>동그라미 꾹 누르기</dt><dd>귀속 바꾸기 창이 떠요. 전체 메모로 풀거나, 지금 채팅이나 다른 캐릭터의 채팅으로 옮겨요. 캐릭터는 이름 · 태그 · 크리에이터 메모로 찾을 수 있어요.</dd></dl>
<p>채팅 이름을 바꾸면 귀속도 따라가요. 메모가 안 보이면 다른 채팅에 귀속된 메모일 수 있어요.</p>`],
    ['순서 · 정렬 · 찾기', `<dl><dt>꾹 눌러 끌기</dt><dd>메모를 꾹 누른 채로 끌면 자리가 바뀌어요. 놓으면 '직접 정한 순'으로 저장돼요.</dd>
<dt>정렬 버튼</dt><dd>직접 정한 순 · 가나다순 · 최근 고친 순 중에서 골라요.</dd>
<dt>돋보기</dt><dd>제목 옆에 얇은 찾기 칸이 열려요. 제목과 내용에서 찾아요.</dd>
<dt>한 줄에 몇 장</dt><dd>톱니 › 한 줄에 메모에서 자동 · 1장 · 2장 · 3장 중에서 골라요.</dd></dl>`],
    ['폴더', `<ol><li>메모를 꾹 눌러 끌어서 <b>다른 메모 한가운데</b>로 가져가 잠깐 기다리면 테두리가 빛나요.</li>
<li>그때 놓으면 두 메모가 폴더로 합쳐져요. 폴더 칸에 놓으면 그 폴더에 들어가요.</li>
<li>폴더는 작게 접혀서 메모마다 제목과 내용 첫 줄만 보여요. 칸이 좁으면 제목만 보여요.</li>
<li>폴더를 누르면 안으로 들어가 평소처럼 쓰고 고쳐요. 위쪽 ‹ 로 나와요.</li></ol>
<p>폴더 안에서 이름을 바꾸고, 폴더 풀기 버튼으로 풀어요. 메모 카드의 빼기 버튼을 누르면 그 메모만 폴더에서 나와요. 메모가 하나만 남으면 폴더는 저절로 풀려요.</p>`],
    ['PC 스티커', `<p>넓은 화면(가로 900px 이상)에서는 메모를 꾹 눌러 목록 밖에 놓으면 그 자리에 스티커로 떠요. 카드의 ↗ 버튼도 같아요.</p>
<dl><dt>옮기기 · 크기</dt><dd>머리띠를 끌어 옮기고, 오른쪽 아래 모서리를 끌어 크기를 바꿔요. 새로고침해도 자리를 기억해요.</dd>
<dt>스티커끼리 합치기</dt><dd>스티커를 다른 스티커 위에 놓으면 폴더 스티커가 돼요. 폴더 스티커는 작게, 제목과 첫 줄만 보여요. 줄을 누르면 그 메모가 옆에 스티커로 떠요.</dd>
<dt>다시 넣기</dt><dd>스티커를 입력창 위 메모 줄이나 작은 목록에 끌어다 놓으면 다시 목록으로 들어가요. 작은 목록의 메모 위에 놓으면 그 메모와 폴더가 돼요.</dd></dl>`],
    ['태그', `<p>내용에 <code>#태그</code> 를 적어요. 띄어쓰기 없이 붙여 써요. 예: <code>#떡밥</code> <code>#에이드/말투</code></p>
<dl><dt>태그 누르기</dt><dd>그려진 메모에서 태그를 누르면 그 태그가 든 메모만 보여요.</dd>
<dt># 버튼</dt><dd>머리의 # 버튼을 누르면 지금 쓰인 태그가 개수와 함께 모여요. 하나를 누르면 그 태그만 보이고, 한 번 더 누르면 풀려요.</dd>
<dt>하위 태그</dt><dd><code>/</code> 로 나눠요. <code>#에이드</code> 로 모아 보면 <code>#에이드/말투</code> 메모도 같이 나와요.</dd></dl>
<p>찾기 칸에 <code>#태그</code> 를 적어도 같아요. 숫자만 있는 <code>#1</code> 은 태그가 아니에요.</p>`],
    ['메모 연결 · 끌어오기', `<dl><dt><code>[[메모 제목]]</code> 연결</dt><dd>누르면 그 메모로 가요. 없는 제목이면 누를 때 그 제목으로 새 메모를 만들어요. <code>[[제목|보일 이름]]</code> 처럼 다른 이름으로 보이게 할 수도 있어요.</dd>
<dt><code>![[메모 제목]]</code> 끌어오기</dt><dd>그 메모의 내용을 이 메모 안에 그대로 보여 줘요. 원래 메모를 고치면 같이 바뀌고, 안의 체크박스도 눌러서 체크돼요.</dd>
<dt><code>[[</code> 치기</dt><dd>내용에 [[ 를 치면 메모 목록이 떠요. 골라 누르거나 엔터로 넣어요.</dd>
<dt>링크 버튼</dt><dd>서식 줄의 링크 버튼에서 <b>외부 링크</b>(주소를 적어 넣기)나 <b>메모 끌어오기</b>를 골라요. 메모 끌어오기에서는 '연결'과 '내용째' 중 하나를 고른 뒤 메모를 눌러요.</dd></dl>
<p>메모 제목을 바꾸면 다른 메모에 적힌 연결도 새 제목으로 바뀌어요. 연결은 제목이 있는 메모에만 걸려요.</p>`],
    ['연결 보기 (그래프)', `<p>머리의 점 버튼을 누르면 메모가 점, 연결이 선으로 그려져요. 연결이 많은 메모일수록 점이 커요.</p>
<dl><dt>점 누르기</dt><dd>그 메모로 가요.</dd>
<dt>끌기 · 확대</dt><dd>점을 끌면 움직이고, 빈 곳을 끌면 화면이 움직여요. 마우스 휠이나 두 손가락으로 확대해요. 마우스를 올리면 이어진 메모만 밝아져요.</dd>
<dt># 버튼</dt><dd>태그도 점으로 그려요. 태그 점을 누르면 그 태그 메모만 보여요.</dd></dl>
<p>지금 보이는 메모(전체 메모 + 이 채팅의 메모)만 그려요.</p>`],
    ['메모지 색 · 글자색', `<p>날짜 옆 동그라미를 누르면 메모지 색과 글자색을 골라요. 테마 팔레트 색이 기본으로 나오고, + 로 내가 원하는 색을 더할 수 있어요.</p>
<p>어두운 메모지에는 글자색을 밝게 바꾸면 잘 읽혀요. 대사 · 속마음 색은 테마 색을 그대로 따라가요.</p>`],
    ['메모 설정 (톱니)', `<dl><dt>글꼴</dt><dd>메모에만 쓸 글꼴을 골라요. 고딕 · 명조 · 손글씨처럼 묶음별로 나뉘어 있고, 줄마다 그 글꼴로 미리 보여요.</dd>
<dt>크기 · 줄 간격 · 자간 · 굵기</dt><dd>'같게'를 켜 두면 채팅 본문 설정을 따라가요. 끄면 메모만 따로 정해요. 맨 위 예시에서 바로 확인해요.</dd>
<dt>한 줄에 메모</dt><dd>자동은 PC 한 줄 3장 · 폰 1장이에요.</dd>
<dt>서식 버튼</dt><dd>켜고 끄고, 끌어서 순서를 바꿔요.</dd></dl>`],
    ['막혔을 때', `<dl><dt>메모 줄이 안 보여요</dt><dd>확장 › 메모 › 미리보기의 '입력창 위에 메모 줄 표시'를 켜요. 기능을 처음 켰다면 새로고침해서 적용을 눌러요.</dd>
<dt>메모가 사라졌어요</dt><dd>다른 채팅에 귀속된 메모일 수 있어요. 그 채팅을 열면 보여요. 찾기나 태그 모아보기가 켜져 있는지도 확인해요.</dd>
<dt>스티커가 안 떠요</dt><dd>가로 900px 이상인 화면에서만 떠요. 폰에서는 작은 목록과 큰 창을 써요.</dd>
<dt>연결이 흐리게 보여요</dt><dd>그 제목의 메모가 없다는 뜻이에요. 누르면 새로 만들어요.</dd></dl>`],
];
const GROUPS = [['시작하기', [0, 1, 2, 3]], ['정리하기', [4, 5, 6, 7]], ['태그·연결', [8, 9, 10]], ['꾸미기·문제', [11, 12, 13]]];

function ensureStyle() {
    if (document.querySelector('link[href*="addons/notes/style.css"]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./style.css', import.meta.url).href; document.head.append(link);
}
let dialog = null;
/** onOpen 이 있으면(애드온이 돌 때) 아래에 '메모 열기' 버튼 */
export function showNotesGuide({ onOpen = null } = {}) {
    if (dialog?.open) return;
    ensureStyle();
    const back = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'bl-notes-help'; dialog.setAttribute('aria-label', '메모 사용방법');
    dialog.innerHTML = `<header><div><small>BLUE LEMONADE · v${NOTES_VERSION}</small><h2>메모 사용방법</h2></div><button type="button" class="bl-note-btn" data-help="close" aria-label="사용방법 닫기"><i class="fa-solid fa-xmark"></i></button></header>
<nav role="tablist" aria-label="사용방법 주제">${GROUPS.map(([name], i) => `<button type="button" role="tab" id="bl-notes-help-tab-${i}" aria-controls="bl-notes-help-page-${i}" aria-selected="${!i}" tabindex="${i ? -1 : 0}" data-help-tab="${i}">${name}</button>`).join('')}</nav>
<div class="bl-notes-help-body">${GROUPS.map(([, list], i) => `<section role="tabpanel" id="bl-notes-help-page-${i}" aria-labelledby="bl-notes-help-tab-${i}" data-help-page="${i}" ${i ? 'hidden' : ''}>${i === 0 ? '<p class="bl-notes-help-lead">채팅 옆에 두고 쓰는 쪽지예요. 태그로 모으고, 메모끼리 연결하고, 폴더로 묶을 수 있어요.</p>' : ''}${list.map((n, j) => `<details ${j === 0 ? 'open' : ''}><summary>${CHAPTERS[n][0]}</summary><div>${CHAPTERS[n][1]}</div></details>`).join('')}</section>`).join('')}</div>
${onOpen ? '<footer><button type="button" class="bl-notes-help-open" data-help="open"><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> 메모 열기</button></footer>' : ''}`;
    document.body.append(dialog);
    const nav = dialog.querySelector('nav'), body = dialog.querySelector('.bl-notes-help-body');
    const pick = button => {
        for (const tab of nav.children) { const on = tab === button; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
        for (const page of dialog.querySelectorAll('[data-help-page]')) page.hidden = page.dataset.helpPage !== button.dataset.helpTab;
        body.scrollTop = 0;
    };
    nav.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = [...nav.children], at = tabs.indexOf(document.activeElement); if (at < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        pick(tabs[next]); tabs[next].focus();
    });
    dialog.addEventListener('click', event => {
        event.stopPropagation(); // 확장 패널의 접기(인라인 서랍)로 새지 않게
        const tab = event.target.closest('[data-help-tab]'); if (tab) { pick(tab); return; }
        const act = event.target.closest('[data-help]')?.dataset.help;
        if (act === 'close') dialog.close();
        if (act === 'open') { dialog.close(); onOpen?.(); }
    });
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; if (back?.isConnected) back.focus({ preventScroll: true }); }, { once: true });
    dialog.showModal();
}
