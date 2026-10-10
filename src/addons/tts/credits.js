// Shared, static attribution. Importing this module never starts TTS or reads settings.
const upstream = 'https://github.com/JINSIN2/MultiCast-TTS';
const revision = 'f48ebeef9b19d814bf8d4568af13613544007e63';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const link = (text, href) => `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>`;
const local = file => new URL(file, import.meta.url).href;

export function ttsCreditsHtml() {
    return `<div class="lv-credits">
        <p><b>개발 · Blue Lemonade</b><br>기존 TTS와 한국어 보강·연결 코드는 ${link('AGPL-3.0', local('../../../LICENSE'))} 조건으로 제공합니다. 내장 효과음은 총 71개이며, 아래 출처별 조건을 따릅니다.</p>
        <p><b>${link('MultiCast-TTS · JINSIN2', `${upstream}/tree/${revision}`)}</b><br>Copyright (c) 2026 JINSIN2 · MIT<br>원본 manifest 저자: Cao Cao &amp; Claude.<br>효과음 목록·키워드 매칭을 가져왔으며, 대본 편집·효과음 배치·반복·겹침 재생은 원본 흐름을 참고해 기존 TTS에 연결했습니다. 원문의 저작권·허가·면책 조항을 ${link('동봉 MIT 전문', local('./LICENSE-MultiCast.txt'))}에 보존합니다. ${link('원본 MIT 전문', `${upstream}/blob/${revision}/LICENSE`)}</p>
        <p><b>MultiCast에서 가져온 효과음 47개</b><br>고정한 원본 커밋의 MP3를 변경 없이 동봉했습니다. ${link('원본 저장소의 CC0 표기', `${upstream}/blob/${revision}/index.js#L1465`)}를 따르며, 개별 원음의 최초 제작자·원출처·라이선스를 독립적으로 확인한 것은 아닙니다. 직접 가져온 음원은 해당 출처의 이용 조건을 따릅니다.</p>
        <p><b>BigSoundBank 효과음 20개</b><br>Joseph SARDIN 19개 · cecilegatina 1개(탁자에 컵 놓기). 1.5.3에서 휴대폰 진동·의자 끌기·펜 뚜껑·냉장고 문·전기주전자·양치질 6개를, 1.5.7에서 찰싹 한 번·엉덩이 찰싹 연속 2개를 더했습니다. 각 원본 페이지의 ${link('CC0 표시', 'https://bigsoundbank.com/licenses.html')}를 확인했습니다. ${link('CC0 전문', local('./sfx-extra/LICENSE-CC0.txt'))}</p>
        <p><b>공유마당 생활 효과음 4개</b><br>한국저작권위원회 · ${link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/deed.ko')}. 가위질·과자 봉투·국물 마시기·국자 놓기 음원을 사용했습니다. 이 음원이 들어간 WAV·영상 등을 공유할 때 제작자·원본 출처·라이선스 링크와 변경 여부를 함께 표시해 주세요. ${link('CC BY 전문', local('./sfx-extra/LICENSE-CC-BY.txt'))}</p>
        <p>추가 효과음 24개는 한 동작 또는 짧은 연속 구간을 골라 음량·페이드·MP3 인코딩을 조정했습니다. ${link('24개 원본·변경 내역·SHA-256', local('./sfx-extra/SOURCES.json'))}에서 개별 제작자와 원본 페이지를 확인할 수 있어요.</p>
        <p>${link('반영 범위·전체 고지', local('./NOTICE.md'))} · ${link('MultiCast 47개 파일별 출처·SHA-256', local('./sfx/SOURCES.json'))}</p>
    </div>`;
}

export function ttsCreditsSummaryHtml() {
    return `<span>개발 Blue Lemonade · ${link('AGPL-3.0', local('../../../LICENSE'))}</span><span>효과음·대본 참고 ${link('JINSIN2 / MultiCast-TTS', `${upstream}/tree/${revision}`)} · ${link('MIT', local('./LICENSE-MultiCast.txt'))}</span><span>효과음 71개: MultiCast 47 · BigSoundBank 20 · 공유마당 4</span><span>BigSoundBank: Joseph SARDIN·cecilegatina / CC0 · 공유마당: 한국저작권위원회 / CC BY 4.0</span><span>MultiCast 음원은 원본의 CC0 표기 기준 · 개별 원출처는 독립 검증하지 않았어요.</span>`;
}
