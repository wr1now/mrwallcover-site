/**
 * /feed.xml: an Atom 1.0 feed of the published guides and case studies.
 * Hand-built because @astrojs/rss is not a dependency of this site.
 *
 * Only pages with real ISO dates in their frontmatter are listed (guides and
 * case studies both carry published/updated, stamped from the edit, never the
 * build). An item without them is left out rather than given an invented
 * date. Drafts are filtered out here explicitly, even though the content
 * modules already exclude them: the feed must never depend on that alone.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';
import facts from '../data/facts.json';
import { caseStudies, projectHref } from '../lib/content';
import { publishedGuides, guideHref } from '../lib/guides';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const rfc3339 = (iso: string) => `${iso}T00:00:00Z`;
const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface FeedEntry {
  title: string;
  url: string;
  summary: string;
  published: string;
  updated: string;
  category: 'guide' | 'case-study';
}

export function feedEntries(): FeedEntry[] {
  const entries: FeedEntry[] = [
    ...publishedGuides.filter((guide) => !guide.frontmatter.draft).map((guide) => ({
      title: guide.frontmatter.title,
      url: `${SITE_URL}${guideHref(guide.frontmatter.slug)}`,
      summary: guide.frontmatter.description,
      published: guide.frontmatter.published,
      updated: guide.frontmatter.updated,
      category: 'guide' as const,
    })),
    ...caseStudies.filter((study) => !study.frontmatter.draft).map((study) => ({
      title: study.frontmatter.title,
      url: `${SITE_URL}${projectHref(study.frontmatter.slug)}`,
      summary: study.frontmatter.standfirst,
      published: study.frontmatter.published,
      updated: study.frontmatter.updated,
      category: 'case-study' as const,
    })),
  ];
  return entries
    .filter((entry) => ISO.test(entry.published) && ISO.test(entry.updated))
    .sort((a, b) => b.updated.localeCompare(a.updated) || b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
}

export const GET: APIRoute = () => {
  const entries = feedEntries();
  const feedUpdated = entries.reduce((latest, entry) => (entry.updated > latest ? entry.updated : latest), facts.lastReviewed);
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-GB">',
    `  <id>${SITE_URL}/</id>`,
    `  <title>${escape(facts.brand)}: guides and case studies</title>`,
    `  <subtitle>${escape(facts.description)}</subtitle>`,
    `  <link rel="self" type="application/atom+xml" href="${SITE_URL}/feed.xml"/>`,
    `  <link rel="alternate" type="text/html" href="${SITE_URL}/"/>`,
    `  <updated>${rfc3339(feedUpdated)}</updated>`,
    `  <author><name>${escape(facts.founder.name)}</name><uri>${SITE_URL}${facts.founder.path}</uri></author>`,
    ...entries.flatMap((entry) => [
      '  <entry>',
      `    <id>${entry.url}</id>`,
      `    <title>${escape(entry.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${entry.url}"/>`,
      `    <published>${rfc3339(entry.published)}</published>`,
      `    <updated>${rfc3339(entry.updated)}</updated>`,
      `    <category term="${entry.category}"/>`,
      `    <summary>${escape(entry.summary)}</summary>`,
      `    <author><name>${escape(facts.founder.name)}</name></author>`,
      '  </entry>',
    ]),
    '</feed>',
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
