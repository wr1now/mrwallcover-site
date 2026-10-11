import { media } from './content';

/**
 * The <source> sets Picture.astro prints for a media id, in order. Shared with the
 * case-study head so the hero preload uses exactly the srcset (and type) the browser
 * will pick from, and the preloaded file is the one it then paints.
 */
export function pictureSources(id: string, thumbOnly = false): { type: string; srcset: string }[] {
  const img = media(id);
  const useFull = img.hasFull && !thumbOnly;
  const variants = img.variants;
  if (variants) {
    return [
      { type: 'image/avif', srcset: variants.widths.map((w) => `${variants.base}-${w}.avif ${w}w`).join(', ') },
      { type: 'image/webp', srcset: variants.widths.map((w) => `${variants.base}-${w}.webp ${w}w`).join(', ') },
    ];
  }
  return [
    { type: 'image/webp', srcset: useFull ? `${img.thumb} ${img.thumbWidth}w, ${img.src} ${img.width}w` : `${img.thumb} ${img.thumbWidth}w` },
    { type: 'image/jpeg', srcset: useFull ? `${img.thumbJpg} ${img.thumbWidth}w, ${img.jpg} ${img.width}w` : `${img.thumbJpg} ${img.thumbWidth}w` },
  ];
}
