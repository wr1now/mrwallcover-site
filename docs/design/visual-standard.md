# Visual standard

This is the standing design contract for existing and future Mr Wallcover pages. Apply it with the existing Glass Atelier direction; historical preview styles in `scripts/glass-variants.preview.css` are not shipped styles. Review coverage and outstanding evidence belong in [page-review.md](page-review.md).

## Character and composition

Keep warm ivory reading surfaces, ink text, restrained olive and brass accents, Cormorant Garamond headings and Outfit body text. Photography should show the material or the work honestly. Use clear section hierarchy, readable line lengths and generous, deliberate spacing. Glass belongs to controls and navigation; paragraphs and long articles sit on paper.

Choose a visual because it explains a material, demonstrates workmanship, clarifies a decision or helps navigation. A measured elevation can explain surveying; a labelled pattern diagram can explain matching; an envelope can identify email. An unrelated room photograph beside a performance claim does not establish that claim. Do not decorate every paragraph or enforce an image count.

## Shared foundation

- All normal HTML pages use `src/layouts/Base.astro`. It owns the header, footer, mobile dock, metadata and shared CSS, including `src/styles/visual-system.css`. Never duplicate page chrome in a new route.
- Use the matching data-driven template for service, area, material, project, professional or Guide content. New entries then inherit improvements centrally. The editorial catch-all also uses `Base`.
- Use `Action.astro` for new prominent actions, `Icon.astro` for small symbols, `Picture.astro` for registered photography and `GuideCard.astro` for Guide cards. Use `Glass.astro` only when its surface helps a control or navigation.
- Existing `.btn` classes are a compatibility layer for older markup. Prefer shared components in new work; do not create another button recipe or copy page-specific overrides to make it fit.

## Buttons, links and icons

`Action.astro` provides `primary`, `secondary` and `quiet` variants. Primary actions have an opaque ink surface and contrasting text; secondary actions have a legible paper surface and border; quiet actions use a restrained text treatment. Reserve visual priority for the visitor's main next step. Avoid a row of equally dominant buttons.

Pass `href` to render an anchor; omit it to render a button (`type="button"` by default). Native attributes pass through. Anchors default to the `arrow-right` icon; choose the appropriate `icon` name or `icon={false}`. Buttons have no icon by default. Use `type="submit"` only for a real form submit action. `Icon.astro` accepts a typed `name` and optional `class`; extend its shared family when a new symbol is justified.

Use an anchor with `href` for navigation and a button for an action. Keep ordinary reading links as links. A filter needs selected state, a toggle needs pressed/expanded state, and a form needs its existing submission behaviour. A disabled link must not remain actionable. Do not add a loading spinner or success message unless the underlying operation exposes that state.

Keep controls at least 44px tall where practical, with generous hit areas, consistent padding and icon alignment. Show distinct hover, focus-visible, active, selected and disabled states as relevant. Preserve an obvious keyboard focus ring and WCAG AA contrast. Check controls over actual photographs: a transparent border alone is not enough against a busy image.

Icons accompany text labels and use the shared stroke family. Use an arrow for navigation, a download symbol for a file, a contact symbol for email or booking and plus/minus or a native marker for disclosure. Do not give every control the same diagonal arrow. Decorative icons are hidden from assistive technology. An icon-only control requires an accessible name and a real need for that compact treatment.

```astro
---
import Base from '../layouts/Base.astro';
import Action from '../components/Action.astro';
---
<Base title="Example | Mr Wallcover" description="Describe the page." path="/example/">
  <div class="container-page pb-20">
    <header class="page-head">
      <p class="eyebrow">Planning your room</p>
      <h1>A useful, specific heading</h1>
      <p class="lede mt-5">Explain the decision this page helps the visitor make.</p>
      <Action href="/contact/?intent=install" variant="primary">Discuss your room</Action>
    </header>
    <!-- Use relevant content and shared media or diagram components here. -->
  </div>
</Base>
```

This demonstrates inherited page chrome and action styling without local CSS. Replace the example with approved content; it is not a route to publish.

## Photography and graphics

Check each image's subject, crop, alt text, caption and reuse terms before adding it to a new context. `src/data/image-rights.json` and [asset-rights.md](../asset-rights.md) record provenance; inclusion in a manifest alone does not grant unrestricted reuse. Retain required credits beside the image and the corresponding structured data. A venue's official photograph must remain identified as venue imagery. A maker's name means a product installed on a recorded project, never endorsement or accreditation.

Use `Picture.astro` with a registered image id and realistic `sizes`. Keep intrinsic dimensions, responsive AVIF/WebP sources, deliberate focal points and lazy loading below the fold. Prioritise the actual lead image only. Do not upscale a small source into a large proof image. Material comparisons need photographs of that material rather than an unrelated finished room. Verify crops at mobile width so the relevant seam or detail is still visible.

Use original SVG diagrams for technical explanation. Label schematic diagrams as illustrative or not to scale, provide a title/description or equivalent text, and keep labels readable on mobile. Distinguish free, straight and drop matches; retain real product instructions and source caveats. A live cutting diagram must render the calculator's existing result, not a second quantity algorithm. Fire illustrations must distinguish the product, substrate and tested build-up; no decorative certification or fireproof badges.

Generated realistic graphics must be labelled **Illustrative**, recorded with provenance and kept separate from project evidence. Do not generate wallpaper artwork, a completed commission, client approval, maker endorsement or a certificate and present it as real. Do not leave placeholder image boxes in finished pages.

## Footer and responsive navigation

`Footer.astro` is the only site footer. Keep brand and workflow concise; put contact actions next; organise short, vertical navigation lists by Explore, Expertise, Materials and Areas. Expertise may use separate Material installation and Specialist work groups. Keep legal/accessibility/image-use/AI links and the labelled Reduce visual effects preference in a compact utility area.

Preserve every unique existing destination, including the Hotels anchor. Remove a duplicate only if its destination remains clearly available. Add approved new routes in the relevant group. Long lists must not form a wrapping tag cloud or leave a long column beside several empty columns.

On narrow screens place brand and contact before navigation. Use accessible disclosure groups for long lists, with links in server-rendered HTML and usable without JavaScript. On desktop, show navigation groups expanded. Preserve the preference control's stored state and keyboard access. Account for safe-area insets, the sticky header and mobile dock so final links remain reachable.

## Content can remain text-only

Record the decision, not an arbitrary exception:

| Page purpose | Appropriate decision |
| --- | --- |
| Privacy notice or image-use terms | Text with clear headings and links supports close reading; decorative photography would interrupt it. |
| FAQ | Native questions and answers provide the visual hierarchy; add a diagram only when a specific answer needs one. |
| Professional intake instructions | A small set of meaningful checklist icons may improve scanning; unrelated room imagery would add little. |
| Material page without a cleared relevant close-up | Keep accurate decision guidance and real linked work; do not substitute a room image as evidence of material properties. |
| Noindex confirmation or error page | A short status, clear next step and accessible action are enough. |

## Review and performance

For shared visual changes capture before/after home, services, Guide, contact and the Timorous Beasties page/footer at 390px and 1440px. Check 360, 768, 1024 and 1280px for overflow, long labels and dock/menu behaviour. For a small page change, inspect the changed page and its shared template at mobile and desktop width; broaden checks when the component's reach warrants it.

Check keyboard order, visible focus, disclosure state, contrast, reduced motion, the Reduce visual effects preference and no-JavaScript content. The mobile dock must hide during form focus and while the menu is open. Forms, shortlist, calculator, booking links and query-intent handoffs must retain their real behaviour. A local intercepted form test does not prove live email delivery.

Compare the same representative pages before and after for image transfer, script/CSS cost, layout shifts and loading behaviour. Resolve material regressions. Static decoration does not justify new site-wide animation or 3D dependencies. Do not load nonessential graphics before the lead image.

Run the available `check`, `build`, `check:dist`, `check:guides`, `check:phone`, `check:type`, `check:no-loss` and `check:visual` scripts. The visual check covers shared contracts and responsive browser smoke checks. `check:type` is a typography guard, not a full TypeScript check. Run analytics and private-name guards when configured; a missing guard or an absent list is a skipped check, never a pass. Do not print or commit a private list. Record commands and results with the screenshots; source checks cannot judge composition.

Preserve routes, media, captions, Markdown twins, structured data, sitemap coverage and enquiry semantics. The PR must state its base, any deliberately integrated unpublished features and outstanding content or publication blockers. Design work does not authorise merging a stack or publishing draft content.
