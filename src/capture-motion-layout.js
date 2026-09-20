// The capture planner already split the content into fixed, legible pages.
export function motionLayout(still, options = {}) {
    const gif = options.format === 'gif';
    const target = gif ? 720 : (Number(options.resolution) === 1440 ? 1440 : 1080);
    const width = Math.max(2, Math.floor(Math.min(target, still.width) / 2) * 2);
    const ratio = width / still.width;
    const contentHeight = Math.ceil(still.height * ratio);
    const height = Math.max(2, Math.ceil(contentHeight / 2) * 2);
    const travel = 0;
    const duration = Math.min(30, Math.max(3, Number(options.duration) || 6));
    return { width, height, ratio, contentHeight, travel, duration,
        offsetAt() { return 0; } };
}
