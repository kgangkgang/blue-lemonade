// 애드온 카드 꼬리 출처 줄 (5.1.2 · 1.0.0 바탕에서 되살림) — 원작자 있는 내장 확장의 세부 설정 화면 맨 아래에 엔딩 크레딧처럼 회색 출처(ⓒ 창과 같은 링크).
//   전개 지시 · 캐릭터 에셋은 원작 허락 조건이 「출처 명시」라 이 줄이 그 조건이에요(THIRD-PARTY-NOTICES.md · 각 NOTICE.md).
//   설정 창(panel.js)이 받아 addons.js 의 setAddonCredits 로 넘겨요 — 시작 그래프(addons.js)에 TTS 출처 표를 싣지 않게.
import { ttsCreditsSummaryHtml } from './addons/tts/credits.js';
const credits={direction:['temporary0723 · Direction-Manager','https://github.com/temporary0723/Direction-Manager','수정·업로드 허락 게시글','https://kkangtong.xyz/posts/104303'],assets:['tincansimagine · character-assets','https://github.com/tincansimagine/character-assets','공유 허락 댓글','https://kkangtong.xyz/posts/122931#comment-7bd0d60e-f2f9-4c2c-9f42-4f395873fa17'],translator:['1234anon · llm-translator','https://github.com/1234anon/llm-translator','수정판 NamelessKkang','https://github.com/NamelessKkang/llm-translator-custom'],prompt:['anon4961 · prompt-panel','https://github.com/anon4961/prompt-panel','개인개조+++ 게시글 · 「깡」','https://kkangtong.xyz/posts/138394'],customstyle:['IceFog72 · SillyTavern-CustomThemeStyleInputs (MIT)','https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs'],mermaid:['Cohee1207 · Extension-Mermaid','https://github.com/SillyTavern/Extension-Mermaid'],'prompt-template':['zonde306 · ST-Prompt-Template (AGPL-3.0)','https://github.com/zonde306/ST-Prompt-Template']};
const link=(text,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
const all='<button type="button" class="bl-addon-credit-all" data-bl-credits><span aria-hidden="true">ⓒ</span> 전체 출처·라이선스</button>';
export function addonCreditHtml(id){
    if(id==='tts')return `<footer class="bl-addon-credit">${ttsCreditsSummaryHtml()}${all}</footer>`;
    const c=credits[id];
    return c?`<footer class="bl-addon-credit"><span>원작 ${link(c[0],c[1])}</span>${c[2]?`<span>${link(c[2],c[3])}</span>`:''}${all}</footer>`:'';
}
