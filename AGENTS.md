# Mr Wallcover website

Read [README.md](README.md) before changing this Astro site.

Every new or substantially changed page must follow [the visual standard](docs/design/visual-standard.md) and use the shared layout and components. Use `Base.astro` for page chrome, `Action.astro` for new prominent actions, `Icon.astro` for the shared icon family and `Picture.astro` for registered photography. Improve shared templates before repeating local markup or CSS.

Assess whether relevant photography, a diagram or an icon helps visitors understand or navigate the content. Record the decision in [the page review](docs/design/page-review.md) and the PR; give a concrete reason when a text-only layout is appropriate. There is no image quota. Preserve image provenance, captions, credits and the distinction between an illustration and evidence of completed work. Do not invent commissions, endorsements or technical certification.

Add each new HTML route to [the route review](docs/design/route-review.json) with its specific visual decision. `check:dist` checks that this ledger covers every normal published and utility page, then opens each at mobile and desktop widths. Use the shared landing, guide, material and professional templates so new entries inherit their evidence, briefing and action patterns. Keep legal, factual and utility content text-led when imagery does not help.

Question rows use `QuestionVisual.astro` with a relevant topic drawing on the right. Reuse the shared FAQ components and review `question-visual.ts` mappings when adding questions; retain existing answers and native disclosure behaviour.

Preserve existing destinations, enquiry behaviour, accessibility, structured data and public content projections. Keep the shared footer on new routes. Include responsive screenshots and interaction checks proportionate to the change; passing builds do not establish visual quality. Keep verification status honest and list skipped checks with their reason.

This is a public website repository. Do not import private research archives, private exclusion lists, leads, credentials or unpublished claims. Draft publication requires the existing editorial review; design changes do not clear content blockers. Do not merge or deploy unless the user has authorised that action.
