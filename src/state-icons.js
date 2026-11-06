// 상태 아이콘은 쓰는 창이 열릴 때만 받아요. 공용 선 아이콘과 같은 24칸·1.6 선 규격이에요.
const STAR = '<path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.36l-5.62 2.97 1.07-6.28L2.9 9.6l6.3-.9Z"/>';
export const starIconSvg = filled => `<svg class="bl-state-star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${STAR}</svg>`;
