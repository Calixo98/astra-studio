# Contextual help
Objective: Explain existing ASTRA controls in plain Spanish without changing audio behavior.
Authorized scope: local UI help, tests, documentation only; no deploy or remote work.
TDD: off (no configured mode); runner: node --test tests/*.test.mjs.
Forecast: about 350 authored lines; advisory only. Delivery: ask-on-risk.
Git: no usable worktree; no initialization or commits authorized. RDD: off, default.
Engram mirror: pending (ambiguous project; do not guess).
Acceptance: accessible hover/focus/tap help; one open; Escape/outside close; no label interference; mobile fit; dynamic editor coverage; accurate existing DSP explanations.
- [x] H1 Implement reusable popover and declarative content.
- [x] H2 Run content tests, existing tests, typecheck, build and browser checks.
- [x] H3 Document usage and evidence.
Next: no implementation work remains; optional physical-device and exhaustive assistive-technology validation.

H1 evidence: separate UI-only help system and declarative Spanish content, event delegation, scoped idempotent MutationObserver, no DSP changes. Buttons outside labels; capture-phase click isolates upload zones. ArrowDown enters readable panel, Escape restores trigger focus without reopening.
H2 observed: node --test tests/*.test.mjs 27/27 passed (24 original + 3 help); npx tsc --noEmit passed; npm run build passed. Chrome verified click/open, keyboard focus opening, ArrowDown panel focus, Escape/restore, one expanded trigger, outside click close, section switch close. At 375px viewport popup x27..367 inside viewport; original macro values 25/10/20 unchanged; zero help buttons nested inside labels.
H2 initial pending checks were resolved by the final independent verification below; physical touch hardware remains untested.
H3 evidence: README usage and file locations updated. Engram mirror remains pending due ambiguous project; no project guessed. No git commits: no usable worktree and no initialization authorized. RDD off/default, no review started. No deploy, push or remote publication.

Final independent verification: 27/27 tests passed. All six tabs have contextual-help counts 20/20/12/6/3/3. Hover bridge remains open; keyboard focus and ArrowDown expose readable text; Escape restores focus without reopening. Space pins, repeated click toggles, and outside click closes. Touch-emulated 375px popup fits without overflow. Parameter values remain unchanged and no help buttons are nested inside labels. Imported synthetic clip selected and duplicated three times: exactly six clip-help buttons and one track-help button, without duplication. Numeric labels remain intact. Content verified against DSP. Browser page errors: none. Parent spot-check node --test tests/help.test.mjs: 3 passed. No blockers. Physical touch hardware and exhaustive assistive-technology coverage were not tested. Engram mirror remains pending; no deployment performed.

Presentation correction reopened: preserve compact headings/control rows; eliminate oversized inherited rectangular info buttons. One scoped correction authorized; reverify before closure.


Bounded presentation correction completed: heading info buttons are adjacent within reserved heading space; controls use an external label wrapper and reserved 44px side slot, with 22px visible circular icon and 44x44 effective target. No extra help rows. No buttons inside labels. Desktop and 375px mobile screenshots visually inspected. At 375px, document scrollWidth 360, help popup x27..367, zero intersections between help targets and input/select/output rectangles. ArrowDown and Escape/focus restoration rechecked. After correction: 27/27 tests, TypeScript and production build passed again. No audio behavior changes. All H1–H3 complete; physical-device and exhaustive assistive-technology testing remain optional limitations.

Final scoped Master EQ follow-up: five-band help targets are stacked above their own sliders, each band retaining a 44px minimum target width; no broader source changes. node --test tests/*.test.mjs: 27/27 passed; npx tsc --noEmit and npm run build passed after this correction. Independent final geometry at 375px and 1440px: all six tabs have zero help-target/control overlaps and zero document overflow, including Conversor. Writer's separate Chrome session confirmed zero meaningful help/control intersections across all tabs; a subpixel shared-boundary difference of 0.00003px was not an overlap. That separate session reported Conversor scrollWidth386 at viewport375 (content extending to386.4); independent final session did not reproduce it. No further changes were made, keeping the requested correction scoped. Source frozen for delivery. All H1–H3 remain complete. Engram mirror pending; no deployment; physical-device and exhaustive assistive-technology limitations unchanged.
