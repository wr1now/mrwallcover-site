# Owner guide

## Enquiries

On the live site, a note arrives by the FormSubmit alias already in `src/config.ts`. If a reference was shown, it is in that email. If nothing arrives, the visitor was told to email info@mrwallcover.com. Do not treat the thank-you page, by itself, as proof of delivery.

To use the private store on your own machine:

1. `LEAD_API_ENABLED=1 LEAD_STAFF_TOKEN=… LEAD_NOTIFIER=file npm run lead-api`
2. Rebuild with `PUBLIC_LEAD_API=http://127.0.0.1:8787`
3. Read a lead with `curl -H "Authorization: Bearer …" http://127.0.0.1:8787/api/leads/MW-…`

Aftercare notes are `kind: aftercare`. They are not new-installation leads. A failed notification is on the lead. Retry with `POST /api/leads/MW-…/notify` until three attempts, then deal with it yourself. Deleting `data/leads/` deletes the only copy.

## Content

Change JSON or a case study in `src/content/`. Open a pull request. The Actions build is the preview. It does not go live until that pull request is merged to `main`.

`draft: true` on a case study keeps it out of the site. `src/content/unpublished/hotels-held.json` is the same idea for three hotel names. Do not import that file into a page.

## Photographs

Own Brown's Hotel photographs can be used large. Exterior and press images stay small and captioned. Do not add room photographs of private houses, or name those houses. The Lanesborough is a name only.

## Rollback

Revert the merge on `main` and let GitHub Pages redeploy. Do not change names.co.uk DNS, MX, SPF, DKIM or DMARC to roll back the website. Email is separate from the Pages certificate, which was still being issued when this branch was prepared.

## Wallcovering Guide and professional pages

Guide copy lives in `src/content/guides/*.md`. Its frontmatter connects it to materials, related guides and the enquiry action. Internal editorial notes are in `docs/content/guides/`, outside page content.

Run `npm run build:review` to include draft guides in a separate `dist-review/` build. Every review page is noindex; the review build emits no sitemap. `npm run preview:review` opens it locally. PR builds attach this output as `wallcovering-content-review`. Do not deploy that artifact as the production site.

After a guide is technically reviewed, set `draft: false`, record only an actual reviewer and publication date, and check the normal build. Do not invent a review or date to fill metadata. Guides appear automatically in advice, search, relevant material pages and the text summary when published. The sitemap follows the generated routes.

Professional page text is in `src/content/professionals.json`. Designers, developers and hotels have distinct paths and intake values. Existing `commercial` links remain valid. CSV planning templates are in `public/downloads/`; they are not quantity calculators.

Material finder choices remain in session storage until cleared. They are shown on the enquiry form with a remove control. A shortlist remains on the device until cleared. The finder offers family comparisons, not product suitability or certification.
