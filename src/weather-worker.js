// 날씨 효과 워커 (3.3.0) — 메인 스레드에서 넘겨받은 OffscreenCanvas 에 그린다. 실리태번이 답을 그리느라 바빠도 효과는 따로 돈다.
import { createEngine, createLoop } from './weather-engine.js';

let engine = null;
let loop = null;
let reduce = false, paused = false;

self.onmessage = ({ data }) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'init') {
        engine = createEngine(data.canvas.getContext('2d'));
        loop = createLoop(engine, fn => self.requestAnimationFrame(fn), id => self.cancelAnimationFrame(id));
        reduce = !!data.reduce;
        engine.onWake = () => apply();
        engine.resize(data.w, data.h, data.dpr);
        engine.config(data);
        apply();
        self.postMessage({type:'ready'});
        return;
    }
    if (!engine) return;
    if (data.type === 'resize') {
        engine.resize(data.w, data.h, data.dpr);
        if (!loop.running()) engine.draw();
    } else if (data.type === 'config') {
        engine.config(data);
        apply();
    } else if (data.type === 'pause') {
        paused=true;loop.stop();
    } else if (data.type === 'resume') {
        paused=false;apply();
    }
};

function apply() {
    if(paused){loop.stop();return;}
    if (engine.idle()) {
        loop.stop();
        engine.draw(); // 지움
    } else if (reduce) {
        loop.stop();
        engine.draw(); // 동작 줄이기: 멈춘 한 장
    } else {
        loop.start();
    }
}
