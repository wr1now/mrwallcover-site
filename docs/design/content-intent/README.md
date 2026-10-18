# Quotation, preparation and exterior content review

18 October 2026. Based on public main `a26c1c04534a07193f48702205f1104e2e9dcf5c`. This is a focused content correction, with no new routes, product claims, photography, CSS or runtime dependencies.

- `/advice/cost/` now helps a visitor prepare a quotation enquiry. The detailed cost-factor explanation remains at `/advice/installation-cost/`, with links in both directions. The original three FAQ answers, their schema, the survey diagram and the enquiry action remain intact. The footer label now says Quotation checklist.
- `/wallpapering/preparation/` identifies itself as tables by wall type and condition, and points to the explanatory readiness guide. Its technical table entries, product links and manufacturer-precedence rules are unchanged.
- The designer specification checklist links to the installed-paper record beside the product identity task, keeping its distinction between experience and endorsement.
- Two exterior case studies explicitly select an exterior account of the work. They preserve their photographs, article prose and credits. Wallpaper batch, pattern and guarantee terms no longer describe exterior work; wallcovering case studies retain the existing method and terms. The previous detail destination remains labelled as wallcovering work, alongside the exterior-service link.

The shared templates, actions, icons, survey diagram, footer and motion preferences are retained. The quotation checklist needs the reader's own room information, so more project imagery would add little; the exterior pages already carry genuine photographs. The preparation reference stays static and text-led for lookup. No new visual asset is needed.

## Screenshots

Captured from production builds in isolated Chrome 155 at 390px and 1440px. Reduced motion is enabled consistently for these static comparisons. The browser pass covers six routes at both widths, before and after, with no horizontal overflow or browser exception. All twelve changed-route/width cases also retain their content with JavaScript disabled. Existing quotation FAQs pass Enter activation with and without JavaScript; the original enquiry destination remains.

| Page | Before | After |
|---|---|---|
| Quotation, mobile | [390px](before-cost-390.png) | [390px](after-cost-390.png) |
| Quotation, desktop | [1440px](before-cost-1440.png) | [1440px](after-cost-1440.png) |
| Exterior method, mobile | [390px](before-inverness-detail-390.png) | [390px](after-inverness-detail-390.png) |
| Exterior method, desktop | [1440px](before-pimlico-detail-1440.png) | [1440px](after-pimlico-detail-1440.png) |
| Preparation tables | Existing table layout retained | [390px](after-preparation-tables-390.png), [1440px](after-preparation-tables-1440.png) |
| Designer evidence link | Existing guide layout retained | [390px](after-designer-checklist-detail-390.png), [1440px](after-designer-checklist-detail-1440.png) |

## Verification

Production build and postbuild text generation pass. Source checks pass 142/142. Focused built-output, discovery, FAQ/schema, HTML/Markdown, footer and shared visual contracts pass 50/50. Three added output regressions are included in the existing `check:dist` entry point through discovery integrity; they verify the meaningful exterior/interior distinction, quotation answer/schema preservation, preparation tables and installed-paper evidence link.

No-loss comparison against the exact base preserves 106 sitemap pages, 3,621 media files, 106 Markdown twins, project records and galleries, 8,181 JSON-LD nodes and 36,741 properties. No guard was relaxed. The original irrelevant exterior method copy is deliberately replaced by a factual exterior account; the interior source and terms remain unchanged.

The six changed pages reference the same direct stylesheet/script assets as the base. Their uncompressed HTML changes by roughly 0.2–1.6 KB; see [asset-comparison.json](asset-comparison.json). This is a static asset inventory, not a field Core Web Vitals measurement. No ranking or conversion improvement is claimed.

Full hosted checks and integrated-branch verification remain required before release. The private-name input was not available to this focused worker; hosted strict validation must run with the real input. No merge, deployment, account change, indexing request or email occurred in this work.
