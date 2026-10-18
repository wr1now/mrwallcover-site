/** Choosing a shared question surface opts a new page into object studies, unless it is factual/utility content. */
export type QuestionVisualVariant = 'drawing' | 'dimensional';
const factualFamilies = ['/for-ai/', '/wallcovering-installation-ai-crawler/', '/ai/', '/privacy/', '/accessibility/', '/image-use/', '/legal/', '/policies/', '/reference/', '/makers/', '/buying-routes/', '/search/', '/thank-you/', '/calculator/', '/wallpapering/'];
export function questionVisualForPath(pathname: string): QuestionVisualVariant {
  const path = pathname.split(/[?#]/, 1)[0];
  if (path === '/404.html' || factualFamilies.some((family) => path === family.slice(0, -1) || path.startsWith(family))) return 'drawing';
  return 'dimensional';
}
