// 텍스트·알림·시계 갱신은 상태창의 종류나 문서 경계를 바꾸지 않아요.
export function fruitStructureChanged(records, roots, panels='') {
    const contains=node=>node?.nodeType===1&&!node.matches?.('.bl-ft-shortcut')&&(node.matches?.(roots)||!!node.querySelector?.(roots));
    return records.some(record=>{
        const target=record.target?.nodeType===1?record.target:record.target?.parentElement;
        if(target?.closest?.('.bl-ft-shortcut'))return false;
        if(panels&&target?.closest?.(panels))return true;
        return [...record.addedNodes||[],...record.removedNodes||[]].some(contains);
    });
}
