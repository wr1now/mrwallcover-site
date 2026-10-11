/**
 * Sizes for the hero photograph (<img>, its <source> and the preload).
 *
 * Phones: the hero box is the viewport less 12px a side (src/styles/hero-mobile.css), so the
 * browser picks the 960w file at 375-412px, the same file as before.
 * From 768px: object-fit:cover crops the photograph to a box that is often taller than 4:3,
 * so the visible photo is wider than the box. 100vw over-asks slightly for the box and keeps
 * the same file as before (2000w on a 768px tablet at 2x). Asking for the box width alone
 * (calc(100vw - 48px)) picked the 1440w file there and the photo went visibly softer.
 * Asking for the full cropped width would fetch 2000w (471 KB) on phones instead of 960w (124 KB).
 */
export const HERO_SIZES = '(max-width: 767px) calc(100vw - 24px), 100vw';
