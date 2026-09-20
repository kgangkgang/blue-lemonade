// Work in CSS pixels first: deleting paragraphs changes both the frame and travel.
export function motionLayout(still, options = {}) {
    const gif = options.format === 'gif';
    const target = gif ? 720 : (Number(options.resolution) === 1440 ? 1440 : 1080);
    const width = Math.max(2, Math.floor(Math.min(target, still.width) / 2) * 2);
    const ratio = width / still.width;
    const contentHeight = Math.ceil(still.height * ratio);
    const height = Math.max(2, Math.ceil(Math.min(contentHeight, width * 16 / 9) / 2) * 2);
    const travel = Math.max(0, contentHeight - height);
    const duration = Math.min(30, Math.max(3, Number(options.duration) || 6));
    return { width, height, ratio, contentHeight, travel, duration,
        offsetAt(seconds) { return travel * Math.min(1, Math.max(0, (seconds - 1) / Math.max(1, duration - 2))); } };
}
