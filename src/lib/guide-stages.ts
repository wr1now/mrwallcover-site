/**
 * The Wallcovering Guide's five stages (owner, 14 Oct 2026): /advice/ is the front door of the reference, laid out
 * as Choose, Specify, Source, Prepare and Install, and every stage links to its own separate pages. Nothing here
 * goes on the home page. The same list draws the stage bar (GuideNav.astro) on the Guide's own pages.
 *
 * A guide is linked by its slug and takes its title from the guide itself, so a renamed guide stays in step; a slug
 * that is not on the hub stops the build rather than leaving a dead link.
 */
import { guideHref, hubCards } from './guides';

export interface StageLink {
  href: string;
  label: string;
  note: string;
}

export interface GuideStage {
  id: 'choose' | 'specify' | 'source' | 'prepare' | 'install';
  label: string;
  /** The reader's question at this stage, in their words. */
  question: string;
  links: StageLink[];
}

function guide(slug: string, note?: string): StageLink {
  const card = hubCards.find((item) => item.slug === slug);
  if (!card) throw new Error(`The Guide's stages link to a guide that is not on the hub: ${slug}`);
  return { href: guideHref(slug), label: card.shortTitle, note: note ?? card.description };
}

export const guideStages: GuideStage[] = [
  {
    id: 'choose',
    label: 'Choose',
    question: 'What should go on this wall?',
    links: [
      { href: '/materials/#material-finder', label: 'Find a material family', note: 'Compare appearance and everyday use, then shortlist.' },
      { href: '/projects/', label: 'Rooms we have hung', note: 'Projects with the maker and the paper named.' },
      guide('choosing-wallcoverings', 'What to ask of a paper before you fall for it.'),
    ],
  },
  {
    id: 'specify',
    label: 'Specify',
    question: 'How do I write it down so it is hung as drawn?',
    links: [
      { href: '/professionals/', label: 'Plan a professional package', note: 'Designers, developers and hotels.' },
      guide('designer-specification-checklist', 'What a schedule needs before a roll is ordered.'),
      guide('hotel-wallcovering-specification', 'Corridors, rooms and the spare stock a hotel keeps.'),
      guide('wallcovering-fire-ratings-uk', 'British Standards and what to ask the supplier for.'),
    ],
  },
  {
    id: 'source',
    label: 'Source',
    question: 'Where do I buy it, and from whom?',
    links: [
      { href: '/where-to-buy/', label: 'Where to buy', note: 'How wallpaper is sold, samples, lead times and duty.' },
      { href: '/materials/#makers-installed', label: 'Makers we have hung', note: 'In our own photographs, with the projects.' },
      { href: '/contact/?intent=source', label: 'Help choosing the paper', note: 'We help you choose, then hang it.' },
    ],
  },
  {
    id: 'prepare',
    label: 'Prepare',
    question: 'How much do I order, and what does the wall need?',
    links: [
      { href: '/calculator/', label: 'Work out the rolls', note: 'Cutting plan, spare and materials.' },
      { href: '/wallpapering/preparation/', label: 'Prepare the wall', note: 'Treatment, primer and lining by wall type.' },
      { href: '/wallpapering/lining-and-adhesives/', label: 'Lining, primers and paste', note: 'Products, grades and data sheets.' },
      guide('quantities', 'Count drops, not square metres.'),
    ],
  },
  {
    id: 'install',
    label: 'Install',
    question: 'Who hangs it, and how is it done well?',
    links: [
      { href: '/services/', label: 'Our installation expertise', note: 'What we hang, and for whom.' },
      guide('set-out-and-pattern-matching', 'Where the first drop goes, and why.'),
      { href: '/details/', label: 'Seams, corners and edges', note: 'Close-ups from our own jobs.' },
      { href: '/aftercare/', label: 'Care and repairs', note: 'What to expect after the hang.' },
    ],
  },
];

/** The trust page every stage rests on. */
export const howWeCheck: StageLink = {
  href: '/how-we-check/',
  label: 'How we check',
  note: 'Where every fact comes from, how it is checked, and why no maker or seller pays to appear.',
};
