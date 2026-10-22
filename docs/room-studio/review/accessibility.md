# Room Studio accessibility review

Reviewed 18 October 2026 against selected WCAG 2.1 AA objectives. This is a focused automated implementation review, not a compliance certification. Screen-reader testing and physical iPhone/Android checks remain pending.

Three issues were corrected and rechecked:

| Finding | Criterion | Resolution |
| --- | --- | --- |
| Form-field boundaries were too faint: 1.74:1 | 1.4.11 Non-text contrast | Field and selected segmented-control borders use `#838d78`; the field boundary measures 3.42:1. |
| Opening buttons in the plan accepted Enter but omitted Space | 2.1.1 Keyboard | Both activation keys open the selected opening's labelled numeric controls. Chromium regression coverage is part of the regular Studio browser suite. |
| The fixed contact dock covered a focused editor button at the 200% equivalent layout | 2.4.7 Focus visible | The shared dock supports `data-dock-clearance` editing workspaces. It hides during workspace focus and returns afterward. WebKit verifies the focused button's centre hits its own control. |

| Sample | Contrast ratio | Checked threshold |
| --- | --- | --- |
| Body text on Studio paper | 12.03:1 | 4.5:1 |
| Hint text on controls panel | 6.34:1 | 4.5:1 |
| Save-status text | 5.55:1 | 4.5:1 |
| Stage numbers | 4.92:1 | 4.5:1 |
| Focus outline against field surface | 5.27:1 | 3:1 |
| Field boundary against field surface | 3.42:1 | 3:1 |

All four stages fit at 320 CSS pixels and a 640×450 CSS effective viewport representing a 1280×900 desktop layout at 200% zoom. The loaded control snapshots contain no missing accessible names. Native macOS Option+Tab navigation, stage activation, keyboard dimension edits and opening activation pass in desktop WebKit 26.5. The dock focus regression passes at both widths and restores the dock when focus moves outside Studio. No browser errors occurred.

The [machine receipt](accessibility.json) records layout, computed colours, keyboard checks and the corrected dock behaviour. The seven Chromium suites additionally check numeric alternatives to dragging, error messages, WebGL recovery, reduced-motion behaviour and the no-JavaScript contact fallback. VoiceOver/NVDA announcements, physical touch devices and deployed cloud flows have not been tested.
