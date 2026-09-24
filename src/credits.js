// Copyright and license notices are deliberately one click from the version.
const upstream=[
 ['Moonlit Echoes Theme','RivelleDays','https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme','AGPL-3.0','LICENSE','블루레몬에이드의 기반 테마'],
 ['LLM Translator','1234anon','https://github.com/1234anon/llm-translator','AGPL-3.0','LICENSE','번역 확장 원본'],
 ['LLM Translator Custom','NamelessKkang','https://github.com/NamelessKkang/llm-translator-custom','AGPL-3.0','LICENSE','번역 확장 수정판'],
 ['Prompt Panel','anon4961','https://github.com/anon4961/prompt-panel','AGPL-3.0','LICENSE','프리셋·월드인포·봇카드 번역'],
 ['CustomThemeStyleInputs','IceFog72 · Copyright © 2025','https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs','MIT','LICENSE','커스텀 CSS 변수 조절'],
];
let dialog;
export function openCredits(){
 if(dialog?.open)return;
 const previous=document.activeElement;
 dialog=document.createElement('dialog');dialog.className='bl-credits-dialog';dialog.setAttribute('aria-label','출처·라이선스');
 dialog.innerHTML=`<header><h2>출처·라이선스</h2><button type="button" aria-label="출처·라이선스 닫기">×</button></header><div class="bl-credits-body"><p>블루레몬에이드는 AGPL-3.0 조건으로 제공됩니다. 수정·재배포 시 해당 조건과 아래 구성요소의 고지를 지켜 주세요. 이 프로그램은 무보증으로 제공됩니다.</p><p><a href="https://github.com/kgangkgang/blue-lemonade" target="_blank" rel="noopener noreferrer">전체 소스</a> · <a href="https://github.com/kgangkgang/blue-lemonade/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">AGPL 전문</a> · <a href="https://github.com/kgangkgang/blue-lemonade/blob/main/THIRD-PARTY-NOTICES.md" target="_blank" rel="noopener noreferrer">전체 고지</a></p>${upstream.map(([name,author,url,license,file,desc])=>`<section><h3>${name}</h3><p>${author}<br>${desc}</p><a href="${url}" target="_blank" rel="noopener noreferrer">원본 저장소</a> · <a href="${url}/blob/main/${file}" target="_blank" rel="noopener noreferrer">${license} 원문</a></section>`).join('')}<section><h3>Prompt Panel 개인개조+++</h3><p>게시글 작성자 「깡」의 공유 개조본을 기반으로 화면과 연결 기능을 수정했습니다. 2026-09-24 Blue Lemonade 수정: 내장 연결, 상단 탭, 사용방법, 테마 통일.</p><a href="https://kkangtong.xyz/posts/138394" target="_blank" rel="noopener noreferrer">개인개조+++ 게시글 · 작성자 「깡」</a> · <a href="https://kkangtong.xyz/posts/87408" target="_blank" rel="noopener noreferrer">원작 소개글</a></section><p>원 저작권과 고지는 각 권리자에게 있습니다. 이 안내는 원작자의 후원·보증을 의미하지 않습니다. 배포 파일에도 라이선스 전문을 함께 제공합니다.</p></div>`;
 document.body.append(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();dialog=null;if(previous?.isConnected)previous.focus();},{once:true});dialog.showModal();
}
export function installCredits(){
 document.addEventListener('click',event=>{if(event.target.closest('[data-bl-credits]')){event.preventDefault();event.stopPropagation();openCredits();}},true);
}
