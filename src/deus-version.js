// 데우스 프리셋 판 표지 — 프롬프트 id 만(빠른 설정 deus-qr 와 같은 id). 옵션 설명(deus-option-help) · 상태창 글자 미리보기(fruit-type-sample)가 같이 써요.
// V3 표지: 관계 택1 · 상태창 범위 택1 · 대사 소리 · 친구들 택1 중 둘 이상.
export const DEUS_V3_SIGNS=['cb1fa811-516f-4a61-aa93-092bb94d5ba3','0f47d870-2bb8-4c25-b6fe-c3d4c9b4e626','279618e4-d961-489f-9d2b-56503e0d6067','8b648af7-db80-4402-9536-58a5d82a6fe2'];
// 11-19 V4 표지: 운명의 주사위 · 주사위 결과 · 폭력 묘사 택1 · 새 얼굴 · 일기장 중 둘 이상. V4 에는 V3 표지도 다 있어요.
export const DEUS_V4_SIGNS=['ecfff91e-43e0-4a5d-8cfe-4d15e56dd55d','a19b9951-7214-4f4e-a1b8-42047882c71c','fa2248a0-d567-4a0a-884d-1cfa390e8716','4f5509db-7cd8-4b7d-bff1-bd4063a8559f','de251b02-fb80-4a4a-b312-d83a349826aa'];
const hasSigns=(prompts,signs)=>Array.isArray(prompts)&&signs.filter(id=>prompts.some(p=>(p?.identifier||p?.id)===id)).length>=2;
/** 'v4' · 'v3' · null(표지 없음 — 2.5 이거나 데우스가 아님) */
export const deusPromptsVersion=prompts=>hasSigns(prompts,DEUS_V4_SIGNS)?'v4':hasSigns(prompts,DEUS_V3_SIGNS)?'v3':null;
