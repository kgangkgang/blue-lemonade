// 11-11 옛 글꾸를 글꾸 마트에서 뺐어요(사용자 「마트에 옛날것들 다 없애라 그냥 어차피 안쓸거같은데...」).
//   옛 글꾸 자료(mart/data/geulkku 의 옛 조각 · index.json 의 옛 줄)를 만들거나 점검하던 도구는 소스를 그대로 두고 쉬어요 — 돌리면 한 줄 알리고 0 으로 끝나요.
//   되살리기: 마트-길닦기.md 12절의 「되살릴 자리」 커밋에서 mart/data/geulkku 를 꺼낸 뒤 GEULKKU_OLD=1 로 돌려요.
//   지금 글꾸 마트 자료는 tools/geulkku-simple.mjs(심플 새 틀) 하나가 써요.
export function retired(name) {
    if (process.env.GEULKKU_OLD === '1') return;
    console.log(`${name}: 옛 글꾸는 마트에서 뺐어요 — 이 도구는 쉬어요(자료 · 점검은 tools/geulkku-simple.mjs · 되살리려면 GEULKKU_OLD=1)`);
    process.exit(0);
}
