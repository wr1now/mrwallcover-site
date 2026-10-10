/**
 * The hero photograph's rendered box: the viewport less its side margins (12px a side on phones,
 * 24px from 768px; src/styles/hero-mobile.css). Used by the <img>, its <source> and the preload.
 *
 * It is deliberately not the cropped width. On a portrait phone object-fit:cover shows about
 * 890 CSS px of the photograph; asking for that would fetch the 2000w file (471 KB) instead of
 * the 960w (124 KB) phones get today, and the photograph would not look the same.
 */
export const HERO_SIZES = '(max-width: 767px) calc(100vw - 24px), calc(100vw - 48px)';
