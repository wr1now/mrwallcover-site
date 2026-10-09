# Accessibility results: Glass Atelier stage 5 (G7)

Run on 9 October 2026 against the production build of this branch (built without `SITE_PHONE`, so the phone and WhatsApp controls were absent; the dock had two cells) served by `astro preview`, with `scripts/glass-verify.cjs`: Playwright (Chromium, device scale 1) at 1440x900 and 390x844, axe-core 4.12.1 with the `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa` tags, and a scripted keyboard pass. Screenshots are in the operator folder `screens/glass/` (not committed). This is an automated check plus one scripted interaction pass, not an audit; the accessibility page says the same.

## axe-core

| Page | 1440 violations | 390 violations | Passed rules | Incomplete (needs a human) |
|---|---|---|---|---|
| `/` | 0 | 0 | 30 | aria-prohibited-attr x1, color-contrast x3, video-caption x3 |
| `/materials/` | 0 | 0 | 28 | none |
| `/projects/browns-hotel-mayfair/` | 0 | 0 | 23 | video-caption x3 |
| `/contact/` | 0 | 0 | 24 | none |
| `/advice/choosing-wallcoverings/` | 0 | 0 | 21 | color-contrast x1 |
| `/` with `html[data-effects="reduced"]` (390) | 0 | n/a | 30 | as `/` |

Violations by rule and impact: none, at either width, with or without the reduced-effects preference. Nothing introduced by stage 5 needed fixing after the run; the one serious issue found during the work (the "Save to shortlist" and field boundaries at 1.35:1 against their panel) was fixed in G3 by the `--color-field-border` token, 3.49:1, before this pass.

Incomplete results are checks axe could not decide, not failures. Each was looked at:

- **color-contrast** on `/` (3) and the guide (1): text over the hero photograph's ink panel and over the proof section's image frame, where axe cannot resolve the background. The pairs behind them (ivory, ivory-soft and gold on ink; ink and stone on paper) are measured in `CONTRAST.md` and pass. No change.
- **video-caption** (3 on `/`, 3 on the project page): the three on-site films are muted footage of the work with a visible caption under each; there is no speech, so there is nothing to caption. A transcript would be empty. No change; recorded here so the next stage does not treat it as a gap.
- **aria-prohibited-attr** (1 on `/`): the proof strip is a `div` with `tabindex="0"` and an `aria-label` so a keyboard user can scroll the photographs; `aria-label` on a plain `div` is prohibited by ARIA. Pre-existing markup, outside this slice (homepage sections are PR #12 territory). Suggested fix for stage 6: give the strip `role="region"` or move the label to `aria-labelledby` on the section.

## Keyboard pass (scripted, recorded verbatim from `summary.json`)

Phone, 390x844, from the top of `/`:

| Step | Focus after the step | `aria-expanded` |
|---|---|---|
| Tab 1 | skip link "Skip to content" | false |
| Tab 2 | wordmark | false |
| Tab 3 | "Start" | false |
| Tab 4 | menu toggle | false |
| Enter | first panel link "Services" (focus moved into the panel, body scroll locked) | true |
| Tab x6 | Materials, Projects, For Professionals, Guide, About, Start your project | true |
| Tab x4 | wordmark, Start, toggle, Services again: the cycle stays inside the bar and the panel; the rest of the page is inert | true |
| Shift+Tab | toggle | true |
| Escape | toggle (focus returned, panel closed, scroll unlocked) | false |
| Space | "Services" (opens again) | true |
| Click a panel link | navigated to `/contact/`; the new page's toggle is closed | false |
| Open, then resize to 1440 | panel closed, scroll unlocked | false |

Without JavaScript (Playwright with scripts disabled): the 7 panel links render in flow under the bar and the toggle is not shown.

Desktop, 1440x900, Tab order: skip link, wordmark, Services, Materials, Projects, For Professionals, Guide, About, "Start your project", then into the page (the hero's partnership link, then the hero's first button). The phone reveal was absent in this build; with `SITE_PHONE` it sits between About and the action, as a button.

## Dock (390x844, measured)

- Two cells in this build (Start, Projects); four with `SITE_PHONE`. Dock top at 776px, 56px tall.
- Hero buttons end at 670px, 670px and 732px: none under the dock in the first view.
- Scrolled to the end, the footer's last control ("Reduce visual effects") ends at 732px, above the dock.
- Dock hidden while the menu is open; hidden while a text field on `/contact/` has focus; back after blur.
- No horizontal overflow on any screenshot at either width.

## What this does not cover

A screen reader pass, large-text zoom, slow-connection behaviour and a real device with a safe-area inset were not run here; they belong to stage 16 of the contract. The pages ran without `SITE_PHONE`, so the phone-reveal button inside the menu and the dock's WhatsApp and phone cells were not exercised by axe; their markup is the same `PhoneReveal` and `WhatsAppLink` components as before this slice.
