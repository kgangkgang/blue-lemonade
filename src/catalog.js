// 기본 글꼴 목록 — 시작할 때는 5개(기본값 Pretendard · 코드 기본값 Neo둥근모 · 프리젠테이션 · 리디바탕 · 갈무리모노11)만. 1.0.0: 8.2.5 의 전체 목록(1,016개)은 catalog-full.js —
//   설정 창 · 상태창 글자 고르기는 그 모듈을 정적으로 받고, 고른 글꼴이 이 5개 밖이면 loadFullCatalog 로 받아 CATALOG 를 채운 뒤 다시 칠해요(apply.js).
//  lang: ko | ja | zh | en   group: sans | serif | display(꾸밈·손글씨) | mono
//  google: fonts.googleapis.com/css2 의 family= 값 / css: @font-face CSS 주소(들) / files: [{ url, weight, range? }]
//  size: 한 번에 받는 파일 크기(KB, 나눠 받지 않는 글꼴만) / single: 굵기가 하나뿐 / native: 현지 이름
//  latin: 한국어 글꼴인데 영어 칸에도 보임 (도트 글꼴처럼 라틴 글자를 제대로 갖춘 것)
//  probe: false — 빈 글리프 검사(fonts.js blankScripts)를 빌드 때 끝냄 (tools/build-fonts.py check_blank)
// 9.0.9 글꼴 로컬 woff2: 프리젠테이션 · 갈무리모노11 은 jsDelivr 대신 테마 안 fonts/ 의 조각(tools/build-fonts.py · SIL OFL 1.1 — fonts/LICENSE-OFL.txt).
//   1.0.0 리디바탕은 조각을 담지 않고 8.2.5 처럼 공개 배포 주소(jsDelivr noonnu)에서 받아요 — 글꼴 파일에 라이선스 칸이 없어서.
//   조각마다 range(unicode-range)가 있어 화면에 나온 글자 갈래의 조각만 받아요(영문 · 한글 2,350자 · 드문 한글 · 그 밖).
//   Pretendard 는 기본값일 뿐 지금 고른 칸이 없고, 이미 jsDelivr 가 92조각(전체 2.9MB)으로 나눠 주는 CSS 라 그대로 둬요.
import { LOCAL_FONT_FILES } from './fonts-local.gen.js';

/** fonts/ 조각 → files 항목. 주소는 같은 서버의 절대 경로('/scripts/extensions/…/fonts/…') — settings.js cssUrl 이 받는 꼴 */
const local = id => LOCAL_FONT_FILES[id].map(f => ({ url: new URL(`../fonts/${f.file}`, import.meta.url).pathname, weight: f.weight, range: f.range, part: f.part }));

export const CATALOG = [
    { id: 'pretendard', label: 'Pretendard', family: "'Pretendard Variable'", group: 'sans', lang: 'ko', css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css' },
    { id: 'freesentation', label: '프리젠테이션', family: 'Freesentation', group: 'sans', lang: 'ko', files: local('freesentation'), probe: false },
    { id: 'ridibatang', single: true, label: '리디바탕', family: 'RIDIBatang', group: 'serif', lang: 'ko', files: [{ url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff', weight: 400 }], size: 708 },
    { id: 'galmurimono11', label: '갈무리모노11', family: 'GalmuriMono11', group: 'mono', lang: 'ko', latin: true, files: local('galmurimono11'), single: true, probe: false },
    { id: 'neodgm', label: 'Neo둥근모', family: 'NeoDunggeunmo', group: 'mono', lang: 'ko', latin: true, files: [{ url: 'https://cdn.jsdelivr.net/npm/@kfonts/neodgm@0.5.0/neodgm.woff2', weight: 400 }], size: 45, single: true }
];

let full = null, filled = false;
/** catalog-full.js 가 CATALOG 를 채운 뒤 불러요 (설정 창이 정적으로 받아도 같은 표시) */
export function markCatalogFull() { filled = true; }
/** 전체 목록(catalog-full.js)을 받아 CATALOG 를 채워요 (한 번만 · 못 받으면 다음에 다시). 받으면 true */
export function loadFullCatalog() {
    return full ||= import('./catalog-full.js').then(() => true, error => { full = null; console.warn('[Blue Lemonade] 글꼴 목록', error); return false; });
}
export const catalogReady = () => filled;
