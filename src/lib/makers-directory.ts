import directory from '../data/makers-directory.json';
export const makerDirectory = directory;
export type MakerProfile = typeof directory.makers[number];
export type BuyingRoute = MakerProfile['routes'][number];
export const directoryReview = import.meta.env.MW_CONTENT_PREVIEW === '1';
// A preview flag exposes drafts locally; it does not grant publication approval.
export const directoryPublished = directory.publication.approved === true && Boolean(directory.publication.approved_by && directory.publication.approved_on);
export const directoryVisible = directoryReview || directoryPublished;
export const directoryRoutes = directory.makers.flatMap(maker => maker.routes.map(route => ({ ...route, makerSlug: maker.slug, makerName: maker.name })));
export function routeLabel(type: string): string {
  if (/stockist|distributor|representative/.test(type)) return 'Find a stockist or representative';
  if (/sample/.test(type)) return 'Samples';
  if (/webshop|shop|consumer|stock_purchase/.test(type)) return 'Shop or product ordering';
  if (/stock_information/.test(type)) return 'Stock information and enquiry';
  if (/trade/.test(type)) return 'Trade enquiry';
  return 'Showroom or brand contact';
}
