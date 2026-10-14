// Observe only selected awaited dispatches without delaying the emitter or changing its result.
// Completion callbacks must enqueue work, not return a translation promise to the emitter.
export function observeEventCompletion(source, capture, onError = console.warn) {
    const own = Object.getOwnPropertyDescriptor(source, 'emit');
    const original = source.emit;
    let stopped = false;
    const report = error => { try { onError(error); } catch { /* observer errors never affect the host */ } };
    function emit(...args) {
        if (stopped || this !== source) return Reflect.apply(original, this, args);
        let finish;
        try { finish = capture(...args); } catch (error) { report(error); }
        const complete = success => {
            if (!stopped && typeof finish === 'function') {
                try { finish(success); } catch (error) { report(error); }
            }
        };
        let result;
        try { result = Reflect.apply(original, this, args); }
        catch (error) { complete(false); throw error; }
        if (typeof finish === 'function') {
            // Observe the original Promise and return that exact object to callers.
            // Both branches are handled: a failed dispatch must never start translation.
            Promise.resolve(result).then(() => complete(true), () => complete(false));
        }
        return result;
    }
    source.emit = emit;
    return () => {
        if (stopped) return;
        stopped = true;
        // A later extension may wrap us. Do not remove its wrapper; our retained layer is inert.
        if (source.emit === emit) {
            if (own) Object.defineProperty(source, 'emit', own);
            else delete source.emit;
        }
    };
}
