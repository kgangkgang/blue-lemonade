// 이어하기 저장소는 번역·캐시 관리가 처음 필요할 때 받아요.
// 공개 함수는 원래부터 Promise를 돌려줘요. 불러온 뒤에는 같은 함수로 바로 넘겨요.
let module = null, pending = null;
function load() {
    return pending ??= import('./translation-resume.js').then(value => {
        module = value;
        return value;
    }).catch(error => {
        pending = null;
        throw error;
    });
}
const call = (name, args) => module ? module[name](...args) : load().then(value => value[name](...args));
export const checkpointKey = (...args) => call('checkpointKey', args);
export const readCheckpoint = (...args) => call('readCheckpoint', args);
export const writeCheckpoint = (...args) => call('writeCheckpoint', args);
export const clearCheckpoints = (...args) => call('clearCheckpoints', args);
export const translateChunks = (...args) => call('translateChunks', args);
