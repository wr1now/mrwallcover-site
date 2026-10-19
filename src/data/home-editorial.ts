/** Existing published homepage selections, reused on their full editorial destinations. */
import { projects } from '../lib/content';
export const selection = [
  { slug: 'raffles-london-the-owo', label: 'Raffles London at The OWO', type: 'Hospitality', image: 'owo-official-classic', credit: 'Venue photograph · Raffles London at The OWO (official)' },
  { slug: 'trematon-castle', label: 'The Castle of Trematon', type: 'Historic interiors', image: 'trematon-01', credit: '' },
  { slug: 'calico-beverly-1975-cadence', label: 'Calico × BEVERLY 1975', type: 'Design & culture', image: 'beverly-08', credit: '' },
].map(item => ({...item, project: projects.find(p => p.slug === item.slug)!}));
// These original homepage selections now supplement the complete project explorer; no commission is removed.
const shownSlugs = new Set(['browns-hotel-mayfair', ...selection.map((item) => item.slug)]);
export const moreWork = projects.filter((project) => project.featured && !shownSlugs.has(project.slug));
export const alsoOnRecord = projects.filter((project) => !project.featured && !shownSlugs.has(project.slug));
export const calicoProjects = projects.filter((project) => project.group === 'design-weeks');
export const calicoLabel = (project: (typeof projects)[number]) =>
  project.slug === 'heathrow-terminal-4-calico' ? 'Calico Wallpaper at Heathrow Terminal 4' : project.title.replace(/: '?([^']+)'? at .*$/, ': $1');
// Top-of-page showcase: one large finished-room photograph per hotel and historic commission.
// Our own photographs first; a credited venue image only where we have no finished-room photo of our own.
export const showcase = [
  { slug: 'browns-hotel-mayfair', name: 'Brown’s Hotel', place: 'Mayfair', image: 'browns-hotel-mayfair-10', credit: '' },
  { slug: 'raffles-london-the-owo', name: 'Raffles London at The OWO', place: 'Whitehall', image: 'owo-official-junior-suite', credit: 'Image: Raffles London at The OWO (official)' },
  { slug: 'four-seasons-ten-trinity-square', name: 'Four Seasons, Ten Trinity Square', place: 'Private Residences, City of London', image: 'fs-residences-01' },
  { slug: 'old-bailey-hotel', name: 'Hyde London City', place: 'Old Bailey', image: 'old-bailey-06', credit: '' },
  { slug: 'heathrow-terminal-4-calico', name: 'Calico Wallpaper at Heathrow', place: 'Terminal 4', image: 'heathrow-05', credit: '' },
  { slug: 'trematon-castle', name: 'The Castle of Trematon', place: 'Cornwall', image: 'trematon-01', credit: '' },
  { slug: 'house-of-hackney-st-michaels', name: 'House of Hackney', place: 'St Michael’s Clergy House', image: 'house-of-hackney-st-michaels-06', credit: '' },
].filter((item) => projects.some((p) => p.slug === item.slug));
// "How we work" in photographs: our own process photographs already in the media library, each linked to the guide that explains that step.
export const processPhotos = [
  { step: 'Survey', image: 'masterpiece-01', text: 'Laser levels, tape and blades: the room measured and set out before a roll is opened.', href: '/advice/installation-cost/#how-is-the-area-measured', guide: 'How the area is measured' },
  { step: 'Preparation', image: 'ahluwalia-estuary-03', text: 'The surface sanded smooth, because raking light shows every flaw under a fine paper.', href: '/advice/wall-preparation/#is-it-smooth-enough-for-this-material', guide: 'Is the wall smooth enough?' },
  { step: 'Lining', image: 'trematon-24', text: 'An atrium at Trematon Castle stripped back and lined before any paper went up.', href: '/advice/wall-preparation/#what-is-lining-paper-for-and-does-this-wall-need-it', guide: 'What lining paper is for' },
  { step: 'Hanging', image: 'lee-broom-07', text: 'A full drop of a panelled design hung to the laser line, before trimming at the skirting.', href: '/advice/hand-painted-murals-set-out/#how-does-the-panel-sequence-work', guide: 'How the panel sequence works' },
  { step: 'Seams', image: 'beverly-05', text: 'A seam in a deep oxblood paper, checked by hand so the joint disappears.', href: '/advice/grasscloth-seams-and-variation/#what-is-normal-and-what-is-a-fault', guide: 'What is normal at a seam' },
];
