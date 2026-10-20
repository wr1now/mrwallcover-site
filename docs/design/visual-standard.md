# Visual standard

This is the standing design contract for existing and future Mr Wallcover pages. Apply it with the existing Glass Atelier direction; historical preview styles in `scripts/glass-variants.preview.css` are not shipped styles. Review coverage and outstanding evidence belong in [page-review.md](page-review.md).

Every normal HTML route also needs a concrete decision in [route-review.json](route-review.json). The build checks exact route coverage, mobile/desktop overflow, image loading, main headings, action sizes and decorative icon semantics. A new route must inherit the shared shell and use the appropriate family template; a new standalone route is verified by the temporary new-page fixture. These checks support visual review and do not replace inspecting composition and crops.

## Character and composition

Keep warm ivory reading surfaces, ink text, restrained olive and brass accents, Cormorant Garamond headings and Outfit body text. Photography should show the material or the work honestly. Use clear section hierarchy, readable line lengths and generous, deliberate spacing. Glass belongs to controls and navigation; paragraphs and long articles sit on paper.

Use three shared text roles: 18px reading text, 15px labels/controls/captions, and the existing responsive serif display hierarchy. Keep technical/code exceptions purposeful; do not add another small prose size to fit a layout.

Keep the homepage to its current seven-section narrative: hero, trust, selected hotels, founder, five stages, aftercare and one closing action. Relocate extended content to the relevant indexable Practice, Projects, Contact, FAQ or Materials destination. Preserve every authored block, genuine photograph/film, credit, link and FAQ answer; record exact destinations in the [relocation manifest](clearer-home/content-relocations.json) and [published-content proof](clearer-home/content-preservation.json). The homepage preservation guard checks real destination HTML rather than accepting an archive or source-only copy.

Choose a visual because it explains a material, demonstrates workmanship, clarifies a decision or helps navigation. A measured elevation can explain surveying; a labelled pattern diagram can explain matching; an envelope can identify email. An unrelated room photograph beside a performance claim does not establish that claim. Do not decorate every paragraph or enforce an image count.

## Shared foundation

- All normal HTML pages use `src/layouts/Base.astro`. It owns the header, footer, mobile dock, metadata and shared CSS, including `src/styles/visual-system.css`. Never duplicate page chrome in a new route.
- Use the matching data-driven template for service, area, material, project, professional or Guide content. New entries then inherit improvements centrally. The editorial catch-all also uses `Base`.
- Use `Action.astro` for new prominent actions, `Icon.astro` for small symbols, `Picture.astro` for registered photography and `GuideCard.astro` for Guide cards. Use `Glass.astro` only when its surface helps a control or navigation.
- Use `DesignStudy.astro` for a standalone original object study with its caption and motion control. Reuse the template's grouped `DesignObject` and `ObjectMotionControls` pattern for material or Guide cards; do not replace registered photographic evidence with an illustration.
- Existing `.btn` classes are a compatibility layer for older markup. Prefer shared components in new work; do not create another button recipe or copy page-specific overrides to make it fit.
- `src/styles/editorial-layout.css` supplies the shared reading measure, list/table rhythm and container-aware open question composition. Reuse the family template's contents navigation, aligned evidence/briefing/facts rail and clearly separated next actions. Do not make unrelated facts float in an unused column or shrink text to fit a decorative study. Keep article text, sources, project credits and tables semantic and selectable.

## Buttons, links and icons

`Action.astro` provides `primary`, `secondary` and `quiet` variants. Primary actions have an opaque ink surface and contrasting text; secondary actions have a legible paper surface and border; quiet actions use a restrained text treatment. Reserve visual priority for the visitor's main next step. Avoid a row of equally dominant buttons.

Pass `href` to render an anchor; omit it to render a button (`type="button"` by default). Native attributes pass through. Anchors default to the `arrow-right` icon; choose the appropriate `icon` name or `icon={false}`. Buttons have no icon by default. Use `type="submit"` only for a real form submit action. `Icon.astro` accepts a typed `name` and optional `class`; extend its shared family when a new symbol is justified.

Use an anchor with `href` for navigation and a button for an action. Keep ordinary reading links as links. A filter needs selected state, a toggle needs pressed/expanded state, and a form needs its existing submission behaviour. A disabled link must not remain actionable. Do not add a loading spinner or success message unless the underlying operation exposes that state.

Keep controls at least 44px tall where practical, with generous hit areas, consistent padding and icon alignment. Show distinct hover, focus-visible, active, selected and disabled states as relevant. Preserve an obvious keyboard focus ring and WCAG AA contrast. Check controls over actual photographs: a transparent border alone is not enough against a busy image.

Interactive editing workspaces can set `data-dock-clearance` on their container. The shared mobile dock then hides while a control in that workspace has focus, preserving keyboard access at narrow and zoomed layouts, and returns when focus leaves. Use this shared behaviour instead of a route-specific dock override.

Icons accompany text labels and use the shared stroke family. Use an arrow for navigation, a download symbol for a file, a contact symbol for email or booking and plus/minus or a native marker for disclosure. Do not give every control the same diagonal arrow. Decorative icons are hidden from assistive technology. An icon-only control requires an accessible name and a real need for that compact treatment.

Question rows use `QuestionVisual.astro` and the shared topic/presentation policy. A physical material or detail can earn a substantial right-hand study, such as measuring, quantities, joins or repairs. Generic timing, folio and document questions are typographic through `dimensionalStudyHelps`; they must not reserve an empty study frame or rail. Static factual routes retain their drawing policy. All question treatments remain decorative, hidden from assistive technology and separate from the actual answer and native disclosure marker. Do not add a certification badge or illustration as evidence of a performance claim.

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

Mixed Guide-card rows use the shared media slot, consistent caption space and category row in `GuideCard.astro`. Prefer relevant registered photographs; use an object only when it explains the topic, and allow a full-width text reference when it does not. Keep photographic subjects legible and object geometry complete; reserve enough room for the real motion control so photo and 3D card titles align at tablet and desktop widths. New Guide entries inherit this composition without local sizing overrides.

Check each image's subject, crop, alt text, caption and reuse terms before adding it to a new context. `src/data/image-rights.json` and [asset-rights.md](../asset-rights.md) record provenance; inclusion in a manifest alone does not grant unrestricted reuse. Retain required credits beside the image and the corresponding structured data. A venue's official photograph must remain identified as venue imagery. A maker's name means a product installed on a recorded project, never endorsement or accreditation.

Use `Picture.astro` with a registered image id and realistic `sizes`. Keep intrinsic dimensions, responsive AVIF/WebP sources, deliberate focal points and lazy loading below the fold. Prioritise the actual lead image only. Do not upscale a small source into a large proof image. Material comparisons need photographs of that material rather than an unrelated finished room. Verify crops at mobile width so the relevant seam or detail is still visible.

Use original SVG diagrams for technical explanation. Label schematic diagrams as illustrative or not to scale, provide a title/description or equivalent text, and keep labels readable on mobile. Distinguish free, straight and drop matches; retain real product instructions and source caveats. A live cutting diagram must render the calculator's existing result, not a second quantity algorithm. Fire illustrations must distinguish the product, substrate and tested build-up; no decorative certification or fireproof badges.

`EvidenceFigure.astro` keeps a registered photograph, caption, credit and optional source link together. `ProjectEvidence.astro` presents cleared own photographs from linked projects and retains the remaining project records as links. `ProfessionalBriefing.astro` supplies a labelled checklist and real download action. Prefer these shared patterns to copying a sidebar or inventing a new card style. Material and professional entries can provide their own evidence metadata; guide frontmatter supports an evidence figure or a technical diagram.

Makers cards use `MakerCardPhoto.astro` with the reviewed mapping in `src/data/maker-card-photography.json`. The current twenty cards contain thirteen directly evidenced maker installations and seven contextual photographs from the practice’s own published work. Caption a contextual example with its actual maker/site and preserve the explicit craft-example distinction; it is not evidence of work with the directory brand. Retain registered rights, visible credits, evidence links and “During installation” labels where applicable. A new maker needs the same provenance review; do not fabricate a match to fill a card.

Generated realistic graphics must be labelled **Illustrative**, recorded with provenance and kept separate from project evidence. Do not generate wallpaper artwork, a completed commission, client approval, maker endorsement or a certificate and present it as real. Do not leave placeholder image boxes in finished pages.

## Procedural dimensional objects

`DesignObject.astro` is the reusable presentation for original procedural Three.js objects. `design-object-kinds.ts` defines fourteen objects: panels, samples, layers, roll, calendar, folio, document, price, privacy, room, care, measure, junction and film. The geometry, deterministic material textures, camera and lighting come from `design-object-scenes.ts`; these are illustrative material and detail studies, not photographs, named products, tested assemblies or completed commissions. Use a model because its subject clarifies the adjacent content. Preserve the real installation photographs, captions and credits alongside it.

The measuring study has a rounded tape casing, a concave numbered blade, metal hook and surface sample. The junction study turns a woven covering around a physical corner/return, with a join, thin lifted backing and visible substrate/trim. The film study shows a thin curled film over a timber panel and its separate reverse, with an application tool. `objectKindForQuestion(question, id)` distinguishes these subjects from generic swatches, paperwork and layers; qualifications, insurance and fire-evidence questions remain typographic on dimensional routes, with their actual evidence in the text and links. Material and Guide topic maps reuse the same studies. The printed tape scale and modelled build-up are illustrative, never an ordering measurement, prescribed installation system or performance claim.

The shared presentation policy in `src/lib/question-visual-policy.ts` applies the dimensional treatment to suitable service, area, material, Guide, FAQ and professional surfaces. `QuestionVisual`, `BuyerFaq` and `FaqList` derive their default from `questionVisualForPath(Astro.url.pathname)`. A future page using the shared FAQ inherits this selective policy: useful physical studies remain dimensional, while `dimensionalStudyHelps` omits generic calendar, folio and document objects and releases their layout rail. Explicit factual and utility exclusions retain drawings. Their common templates own the placement, topic selection, illustrative label and `ObjectMotionControls.astro`. A justified static question layout can pass `variant="drawing"` directly or `visual="drawing"` through the FAQ component; `/for-ai/` explicitly does so. Use these shared defaults when adding a standalone route; do not scatter route-specific checks, copy a renderer or require a new local opt-in for every suitable page. Factual AI pages, legal reading and reference utilities retain a static presentation. Review any exception against the route's purpose and record the reason in the route ledger.

`QuestionVisual` renders a useful physical family member on the right of a question, or a typographic row when the generic object would add no explanation. Shared FAQ components must pass the policy-selected presentation through consistently. Keep open buyer and Guide answers open; native FAQ summaries retain keyboard activation, expanded state and their existing disclosure marker. An object is never a second toggle or a replacement for the actual question. Preserve exact factual content, anchor ids and FAQ structured data.

For retained physical studies, use the shared question-size tokens rather than a small icon-sized frame or page-specific dimensions. Open buyer/Guide question composition uses the actual `buyer-questions` container: 144px studies in compact content, 192px from 600px of available width and 288px from 896px. This prevents a narrow sidebar or article from inheriting an oversized desktop rail just because the viewport is wide. Native FAQ studies retain their shared 144px phone, 192px intermediate and 224px desktop frames with the native disclosure marker clear. Keep the study on the right with readable heading space on narrow phones. Open answers use the full width below the heading/graphic in compact layouts; wider containers reserve a separate right-hand rail. Limit long headings and answers to the shared 44rem reading measure, and inspect intermediate widths, including 688px, 768px and 1024px.

Outside questions, `DesignStudy` accepts a typed `kind` plus optional `caption` and `class`, and keeps the object, illustrative caption and shared motion control together. Material family cards share a group control; individual Guide studies reuse the same control state. Icon mapping in `design-object-presentation.ts` and material/Guide topic mapping in `design-study-topic.ts` support consistent choices across templates; review the choice when adding a new material, topic or card. Keep a suitable registered photograph in a Guide card when one is available. A study for a card without photography is an original topic illustration, not substitute evidence of the project.

Give the objects readable depth at their actual display size: show a useful angle, visible material thickness, a plausible curled edge or roll opening, restrained surface texture and consistent lighting. The wallpaper roll may carry an original illustrative floral pattern; do not copy a named maker's artwork or imply that the model depicts a product supplied or installed by Mr Wallcover. Keep the modelling shared, and verify the same angle, pattern and silhouette in the poster and live scene.

The larger frame must contain a substantial object, not extra blank space around the previous silhouette. Use believable proportions, modelled edges, a visible side or layered construction, and directional shading with a grounded contact shadow. Surface texture should reinforce the material without obscuring the form. Apply that same modelling, camera and lighting standard to the shared question, service, material, Guide and contact studies; new pages inherit the common scene family rather than introducing a flatter local substitute. Review both a small phone frame and the full desktop frame for depth, crisp detail and complete, unclipped geometry.

The server-rendered markup always includes a dimensioned, lazy WebP poster from `public/media/design-objects/`. `scripts/capture-design-object-posters.mjs` generates these stills from the same original scene family; regenerate them when the model or resting composition changes. The poster is a complete illustration, not a loading placeholder. It remains available without JavaScript, under reduced motion, when motion is paused, and if WebGL loading or rendering fails. Keep its aspect ratio stable when the live view appears. Decorative objects use empty image alt text and are hidden from assistive technology; the adjacent labelled content supplies the meaning. Keep the visible **Illustrative** label for the study group.

One shared detached WebGL renderer serves visible objects; do not create a renderer per card or question. Load the 3D scene module lazily after the real page photograph has had priority and a study is visible. Animate only visible studies while the document is active and motion is enabled. Fine-pointer tilt is a restrained visual effect and must leave touch scrolling, links and question controls usable. Stop the animation loop off screen, in a hidden tab, on failure or on page exit, and release the scene resources and listeners when leaving.

Respect both `prefers-reduced-motion` and the footer's **Reduce visual effects** preference, including changes made after loading. The labelled **Pause motion** control uses a real shared action button and reports its state accurately; reduced effects take precedence over resuming animation. Show the posters when motion is reduced or paused. A failed enhancement must leave readable content and usable posters rather than an empty canvas or a dead control.

Before publishing a dimensional treatment, inspect its actual smallest display size and mobile/desktop composition; compare the poster and live resting view; exercise pause/resume, pointer tilt, scrolling out of view, tab visibility, live preference changes, no JavaScript and WebGL failure. Check that static-policy routes do not acquire 3D objects or request their scene runtime. Cover a service, material, Guide, native FAQ and every professional profile when changing the shared policy. Record the performance comparison and verification results in the page review. A new family entry must inherit the same accessible presentation without bespoke page code.

## Shared page composition and linen/botanical ambience

Apply a coherent reading hierarchy across the website, including routes where no new photograph is useful. Service/area sections pair a clear numbered heading with the explanation; material decisions separate appearance, joins, setting, handling and care from save/enquiry controls. Professional pages separate their introduction, genuine evidence and optional briefing checklist from the full-width question section. Guide articles keep a readable paper surface and contents navigation, with questions outside the narrow article rail and sources/next actions in their own endmatter. Editorial Markdown uses generated section navigation and a consistent evidence/briefing column. Case studies place the authored story beside a compact native disclosure containing the standard seven facts, followed by natural-proportion galleries with each credit kept with its figure. Preserve public content and facts even when disclosure reduces repetition in the initial layout.

`Base.astro` includes `AtelierAtmosphere.astro`, the shared decorative ivory-linen ground with original plum blossom, small perched birds on branches and a discreet lower-right water-lily accent. `public/media/atelier-botanicals/ivory-linen.webp` tiles beneath the page at an 18rem repeat, with a more visible but restrained weave: normal opacity .25 and quiet opacity .16. `branch-birds.webp` and `plum-blossom.webp` supply transparent painterly branches in masked, inward-fading margins; `water-lilies.webp` adds the quieter lower-right accent at 70% of the branch opacity. The motifs stay clipped to the outer edges and below main content/footer. At widths up to 767px hide the bird, plum and pond layers completely and retain the visible linen ground. From 768px the existing desktop botanical composition remains; never place a repeated motif across phone paragraphs. Keep paper reading surfaces opaque and photographs, links, menus and forms unobstructed. New pages inherit the same asset/component treatment without another local background.

These are original generated decorative illustrations in a hand-painted textile tradition. They are not a named maker's wallpaper/pattern, a logo, proof of maker affiliation, a photograph of installed linen/silk or evidence of a completed commission. Do not describe the artwork as an installed product or imply that Mr Wallcover or a named maker painted it by hand. Preserve current prompts, source/derivative records and hashes in [the plum/water-lily register](plum-water-lilies/assets.md), alongside [the retained linen/bird sources](linen-botanicals/assets.md), and keep genuine project photographs with their own provenance and credits. The background is decorative and hidden from assistive technology; it does not replace the visible illustrative labels on topic studies or the actual technical/evidence content.

The theme uses four active shared optimised WebPs, not another WebGL renderer, requestAnimationFrame loop or preference controller. Keep the earlier `blossom-sprig.webp` URL available without requesting it in the theme. CSS perspective and a few pixels of slow drift provide restrained depth: bird branch 32s, plum branch 38s and water lilies 42s. Keep birds perched and avoid distracting independent effects. Do not turn the art into a fullscreen object, scroll hijack or competing hero. Include the real background-image transfer, decoded dimensions and loading behaviour in performance review; the earlier image-free CSS-paper receipt does not establish the cost of this asset-backed theme.

Suitable normal pages use the shared slow CSS motion after the page loads. The existing preference controller pauses it in hidden tabs and follows live `prefers-reduced-motion`, the footer's Reduce visual effects preference and the shared object Pause motion state. Reduced effects, forced colours and print hide the layer; OS reduced motion leaves it static. Without JavaScript, its initial CSS state is static. Factual/legal/reference-policy routes, including Makers, Buying routes, the calculator and `/wallpapering/` references, retain static linen and right-hand bird artwork, omitting the plum and water-lily layers; noindex pages omit the layer entirely. New normal pages inherit the shell treatment automatically and still require a route-specific visual decision, not an image quota.

## Footer and responsive navigation

The header and mobile menu share all eleven destinations from `src/content/navigation.json`: Projects, Expertise, Materials, Wallpapering, Wallpaper calculator, Wallpaper my room, For designers, Guide, About, AI Crawler and Contact. The owner explicitly requested full menu access on 19 October 2026, replacing the previous six-link direction. Show them in two desktop rows and one mobile list, with the separate Start your project action. Retain footer access and existing routes. Shared booking controls use **Book a call**, preserving the twenty-minute appointment destination and accessible duration.

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
| Machine reference resource | A static monospace terminal surface can distinguish the reading task; retain semantic HTML, ordinary file links, full source parity and the shared shell. Keep evidence expanded and avoid simulated command inputs or decorative motion. |

## Review and performance

For shared visual changes capture before/after home, services, Guide, contact and the Timorous Beasties page/footer at 390px and 1440px. Check 360, 768, 1024 and 1280px for overflow, long labels and dock/menu behaviour. For a small page change, inspect the changed page and its shared template at mobile and desktop width; broaden checks when the component's reach warrants it.

Check keyboard order, visible focus, disclosure state, contrast, reduced motion, the Reduce visual effects preference and no-JavaScript content. The mobile dock must hide during form focus and while the menu is open. Forms, shortlist, calculator, booking links and query-intent handoffs must retain their real behaviour. A local intercepted form test does not prove live email delivery.

Compare the same representative pages before and after for image transfer, script/CSS cost, layout shifts and loading behaviour. Resolve material regressions. Static decoration does not justify new site-wide animation or 3D dependencies. Do not load nonessential graphics before the lead image.

Run the available `check`, `build`, `check:dist`, `check:guides`, `check:phone`, `check:type`, `check:no-loss` and `check:visual` scripts. The visual check covers shared contracts and responsive browser smoke checks. `check:type` is a typography guard, not a full TypeScript check. Run analytics and private-name guards when configured; a missing guard or an absent list is a skipped check, never a pass. Do not print or commit a private list. Record commands and results with the screenshots; source checks cannot judge composition.

Preserve routes, media, captions, Markdown twins, structured data, sitemap coverage and enquiry semantics. The PR must state its base, any deliberately integrated unpublished features and outstanding content or publication blockers. Design work does not authorise merging a stack or publishing draft content.
