# Wallcovering Guide content pack

Ten guides (nine articles plus the quantity calculator page), implemented guide pages, material decision support and professional journeys for the existing Mr Wallcover site.

Start with [implementation status and verification](implementation-status.md), then read the [development brief](development-brief.md). The articles have a single source in `src/content/guides/`, with the slugs from section 27.6 of the master build prompt. Normal builds include only guides with `draft: false`; `npm run build:review` renders drafts too, in `dist-review/`, with noindex on every page. This branch has not been deployed.

| Guide | Topic |
| --- | --- |
| [01](guides/01-choosing-wallcoverings.md) | Choosing wallcoverings for the room (the former room-by-room guide is merged here) |
| [02](guides/02-grasscloth-seams-and-variation.md) | Grasscloth seams and variation |
| [03](guides/03-wall-preparation.md) | Wall preparation |
| [04](guides/04-quantities.md) | Quantities: the existing calculator page, with the explanation around it |
| [05](guides/05-installation-cost.md) | Installation cost, without price bands; the bands wait in a draft |
| [06](guides/06-hand-painted-murals-set-out.md) | Hand-painted papers and murals: set-out |
| [07](guides/07-hotel-wallcovering-specification.md) | Hotel wallcovering specification |
| [08](guides/08-designer-specification-checklist.md) | Designer specification checklist |
| [09](guides/09-developer-wallcovering-package.md) | Developer tender and handover package |
| [10](guides/10-wallcovering-problems-and-aftercare.md) | Problems and aftercare |

The links above retain editorial notes and point to the corresponding source file. Internal notes are kept out of the article source and rendered HTML. Byline/reviewer and publication dates must reflect actual review. Image permissions follow [the existing rights register](../asset-rights.md).

The build brief also covers ChatGPT search discovery, material data, room/geographic coverage, different professional journeys and acceptance evidence. Its future functionality requirements are implementation targets, not claims about current live capability.
