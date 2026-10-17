# Calculator follow-up review — 17 October 2026

Base: main `14225b5`, the successfully deployed squash merge of PR #62. The other release chat completed source/browser/live checks; this follow-up preserves its work. PR #72 was an alternative extraction prepared concurrently and is superseded by that live release.

## Changes

- Shared Action shortcut opens the transparent approved worked example; it does not silently substitute example wall dimensions for a visitor's room.
- PatternMatchGuide uses an original schematic for six match types. Its selection follows the form, hides for mural/panel formats and never participates in quantity maths.
- Native details disclosure, explanatory captions and maker-label guidance remain usable without an additional graphic library.

## Verification

141 source checks and 14 isolated calculator browser scenarios pass; the added tests cover all match diagrams, mural hiding and the example shortcut on mobile. No enquiries sent. Reviewed screenshots at 390px and 1440px show no horizontal overflow. 226 built-site checks, 5 Guide checks, 2 typography/hero-contrast checks, new-route and phone fixtures, strict private-name guard and no-loss passed. All 106 routes/twins and 3,610 media files were preserved.

Production and Search Console status will be reported separately; a successful deploy does not establish Google indexing.

The concurrent joinery clarification release `51f372c` was integrated; its source changes and review note are retained. No calculator file conflicts occurred.
