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
