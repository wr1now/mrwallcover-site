# Architecture

The public site stays a static Astro build on GitHub Pages. Pushes to `main` deploy it. This branch does not.

Enquiries on that static build go through FormSubmit to info@mrwallcover.com. GitHub Pages cannot store a lead, retry email, or keep a photograph private.

`server/index.ts` is the private store. It listens only when `LEAD_API_ENABLED=1`. It writes each enquiry to `data/leads/<reference>/` before it answers, then tries a notification. The default notifier is unconfigured, so the lead is kept and marked failed. `LEAD_NOTIFIER=file` writes a notification file for a local check. `LEAD_NOTIFIER=fail` is the test double. There is no paid host and no SMTP account in this repository.

Set `PUBLIC_LEAD_API` at build time only when that process is actually running. Leave it empty for GitHub Pages.

Uploads are sniffed. JPEG and PNG location metadata is removed. HEIC and PDF are stored and not executed. Staff reads need `LEAD_STAFF_TOKEN`. The browser must send an allowed `Origin`.

Material exploration is a Three.js module loaded after a click. It is not in the initial homepage script. The quantity calculator is a small page script and does not publish prices.

Editing copy is still a change to `src/content/`, opened as a pull request. A pull request builds and does not deploy. Merging to `main` is the production publish.

## Atelier presentation and AI decision layer

The owner-private Sites edition is registered in `.openai/hosting.json`; it is a separate deployment from the public custom domain. The exact committed source is pushed to Sites before the saved version is deployed. No runtime database or AI API is needed for discovery.

`src/lib/ai-crawler.ts` projects only published, allowlisted business, project and image-credit fields. `src/lib/ai-decision-guide.ts` adds editorial fit guidance, source-linked reasons, material decisions and exact aftercare content. One shared model drives the semantic HTML and the three JSON resources. Unknown information stays null or explicitly unconfirmed. The enquiry template is data only; it cannot book work or send a message.

All pages advertise the business and decision resources with `rel=describedby`; existing Markdown alternatives, sitemap and llms files remain available. The proposal files are supplemental, not a universal agent protocol. Existing robots preferences are preserved.

The portfolio filters enhance a complete server-rendered gallery. Invalid filters reset to All. The material studio owns an abortable session and explicitly disposes graphics resources and listeners on close or failure. Both paths have regression checks; final browser checks are recorded separately in QA_REPORT.md.
