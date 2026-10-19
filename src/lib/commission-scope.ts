/** Owner-confirmed installation scope, separate from resource review dates and live availability. */
import { SITE_URL } from '../config';
import source from '../data/commission-scope.json';
import { caseStudies, projectHref } from './content';
import { glanceDetails } from './glance';

/** Explicit public allowlist; project titles, periods and roles reuse their published records. */
export const commissionScope = {
  heading: source.heading,
  minimumInstallationRooms: source.minimumInstallationRooms,
  minimumInstallationScope: source.minimumInstallationScope,
  programmeRange: source.programmeRange,
  confirmation: source.confirmation,
  pricing: source.pricing,
  basis: source.basis,
  ownerConfirmed: source.ownerConfirmed,
  sourceUrl: new URL(source.sourcePath, SITE_URL).href,
  supportingProjects: source.supportingProjectSlugs.map((slug) => {
    const study = caseStudies.find(item => item.frontmatter.slug === slug && !item.frontmatter.draft)?.frontmatter;
    if (!study) throw new Error(`Commission scope references an unpublished case study: ${slug}`);
    return {
      title: study.title,
      url: new URL(projectHref(slug), SITE_URL).href,
      projectDates: glanceDetails(study).year ?? study.years,
      role: study.role,
      basis: 'Company-reported project record',
    };
  }),
};
