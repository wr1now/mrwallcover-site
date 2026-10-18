import type { APIRoute } from 'astro';
import { SITE_URL } from '../../config';
import page from '../../content/fire-ratings/page.json' with { type: 'json' };
import {
  FIRE_CHECKED, classes, decoderExamples, dropletClasses, englandLinings,
  evidenceLabel, formatClassification, gapsFor, jurisdictions, products,
  smokeClasses, sources, standards, validateFireData,
  type DecoderEntry,
} from '../../lib/fire-ratings.ts';

const sourceUrl = `${SITE_URL}/advice/wallcovering-fire-ratings-uk/`;
const decoderEntry = (entry: DecoderEntry) => ({
  code: entry.code, label: entry.label, meaning: entry.meaning, basis: entry.basis, sourceIds: entry.sourceIds,
});

export const GET: APIRoute = () => {
  const problems = validateFireData();
  if (problems.length) throw new Error(`Fire-ratings data needs fixing before it can be published:\n- ${problems.join('\n- ')}`);

  // Every row below is rendered on the public reference. Keep an explicit field
  // allowlist: hashes, internal notes and undisplayed technical fields stay out.
  return new Response(JSON.stringify({
    schemaVersion: '1.0',
    url: `${SITE_URL}/ai/fire-ratings.json`,
    sourceUrl,
    markdownUrl: `${sourceUrl}index.md`,
    title: page.title,
    description: page.description,
    published: page.published,
    updated: page.updated,
    checked: FIRE_CHECKED,
    sourceCheckDates: [...new Set(sources.map((item) => item.accessed))].sort(),
    scope: {
      jurisdiction: page.scope.jurisdiction,
      sourcesChecked: page.scope.sourcesChecked,
      review: page.scope.review,
      notice: page.scope.notice,
    },
    decoder: {
      introduction: page.decoderIntro,
      classes: classes.map(decoderEntry),
      smoke: smokeClasses.map(decoderEntry),
      droplets: dropletClasses.map(decoderEntry),
      examples: decoderExamples.map((example) => ({ notation: example.notation, reading: example.reading, note: example.note })),
    },
    standards: standards.map((standard) => ({
      id: standard.id, designation: standard.designation, title: standard.title,
      latestEdition: standard.latestEdition, published: standard.published, status: standard.status,
      role: standard.role, editionNote: standard.editionNote, sourceIds: standard.sourceIds,
    })),
    regulations: {
      englandLinings: {
        document: englandLinings.document, table: englandLinings.table,
        notice: `Read the table, its notes and Section 6 in full before relying on it.`,
        rows: englandLinings.rows.map((row) => ({ location: row.location, detail: row.detail, euroclass: row.euroclass })),
        notes: englandLinings.notes,
        sourceIds: englandLinings.sourceIds,
      },
      jurisdictions: jurisdictions.map((jurisdiction) => ({
        id: jurisdiction.id, name: jurisdiction.name, document: jurisdiction.document,
        edition: jurisdiction.edition, linings: jurisdiction.linings, nationalClasses: jurisdiction.nationalClasses,
        dates: jurisdiction.dates.map((date) => ({ label: date.label, date: date.date, kind: date.kind })),
        notes: jurisdiction.notes, sourceIds: jurisdiction.sourceIds,
      })),
    },
    productEvidenceNotice: 'Each row covers only the product and build-up named. It is not a ranking and not a list of approved products.',
    products: products.map((product) => ({
      id: product.id,
      sourceUrl: `${sourceUrl}#product-${product.id}`,
      manufacturer: product.manufacturer, product: product.product, reference: product.reference,
      scope: product.scope, construction: product.construction, weight: product.weight,
      classificationRaw: product.classificationRaw,
      notation: product.notation,
      classification: { class: product.classification.class, smoke: product.classification.smoke, droplets: product.classification.droplets },
      reading: product.notation ? formatClassification(product.classification)
        : product.conflicts.length ? 'not resolved: the documents disagree (see gaps)' : 'no European class printed',
      classificationStandardCited: product.classificationStandardCited,
      evidence: product.evidence.map((item) => ({
        sourceId: item.sourceId, evidenceType: item.evidenceType, label: evidenceLabel[item.evidenceType],
        documentReference: item.documentReference, testBody: item.testBody,
      })),
      testedBuildup: {
        substrate: product.testedBuildup.substrate,
        adhesive: product.testedBuildup.adhesive,
        other: product.testedBuildup.other,
      },
      fieldOfApplication: product.fieldOfApplication,
      limitations: product.limitations,
      gaps: gapsFor(product).map((gap) => ({ kind: gap.kind, text: gap.text })),
      conflicts: product.conflicts,
      unresolved: product.unresolved,
      status: product.status,
      evidenceLevel: product.evidenceLevel,
      checked: product.checked,
    })),
    sourcesIntroduction: page.sourcesIntro,
    sources: sources.map((item) => ({
      id: item.id, issuer: item.issuer, title: item.title, reference: item.reference,
      type: item.type, group: item.group, issued: item.issued, effective: item.effective,
      statedExpiry: item.statedExpiry, url: item.url, accessed: item.accessed,
      establishes: item.establishes, limits: item.limits, status: item.status,
    })),
    checklists: page.checklists.map((list) => ({ title: list.title, intro: list.intro, items: list.items })),
    faq: page.faq.map((item) => ({ q: item.q, a: item.a })),
  }, null, 2) + '\n', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
