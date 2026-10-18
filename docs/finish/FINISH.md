# Finish pass · Орбіта

Product: Орбіта (ПриватБанк)   Surface: product UI (desktop/mobile + WebXR, Meta Quest 3S)   Date: 2026-10-18

Point (intended, from the owner's words): for the department head, Орбіта shows the month's payments, cash operations and equipment as three stands in one space — on a screen and in the headset — so that deviations are seen at once, unlike a flat report.
Core object: the department's month (10 dashboards in three subjects). Core action: read a deviation and open it in focus. Hero moment: entering the space — the same three stands around you over Earth.

Point as read (1440 first viewport, after):
- What is it: «ПриватБанк | Орбіта», «Огляд», «Жовтень 2026» — departmental overview for a month.
- For whom: bank lockup + subjects «Касові операції / Платежі / Обладнання» — branch/department management.
- What can I do: expand icons on each dashboard, «Кількість / Обсяг / Разом», «Відкрити в просторі» (primary).
- Why this: three stands over Earth turned toward the viewer — the same composition as the headset.
- Next: «Відкрити в просторі» is the dominant action; «Зони уваги: Recycle 7,2%, Регулярні 84%» below.

Scores before → after: point 1 → 0 · template 2 → 1 · finish 2 → 0 (core flow) / 1 overall · anti-ai-slop 9 → 4

Protected qualities: the owner's three glass stands; the side dock on desktop and top tabs on mobile; the 3×3 row grid and all hotfix data contracts; light and dark environments.

Gaps fixed, by leverage:
1. Deploy: Pages had not updated since 5a4c709; the update check exposed a real defect — the service worker reloaded any tab once opened with `?orbita-update=1` on every release (unsaved drafts lost). Fixed in `public/sw-recovery.js` + `AppUpdate.tsx`.
2. Structure: nine separate cards → three stands with tonal sections; side stands turned 6° like the XR arc; rows centre or fill instead of leaving empty feet.
3. Type: ~25 text roles with 8–10px text → one scale (11/12/13/15/18/26/32/44), weights 400/500/600, Pryvat Sans, tabular figures incl. SVG.
4. Controls: radii 999/100/15/14/11/0 and heights 40/41/44/47 → pills of one height (40, 44 on touch), fields 14px, radius tokens in DESIGN.md; light-theme secondary buttons and scenario cards were invisible; selection without the one-off purple frame; «Відкрити в просторі» is the filled primary.
5. Details: decorative rules and the CTA arrow removed; select chevron unified; channel labels inside the chart; words never split mid-letter.
6. Motion: arrival once, values grow from the baseline, Earth spin, star breathing, pointer parallax; still under reduced motion and on software WebGL.

Remaining (not blocking): header icon buttons are 36px on ≤760px (above WCAG 24px, below 44px) to keep the lockup on one line; the 2D focus and spatial modal keep their own surfaces; physical Quest checks (docs/QUEST_ACCEPTANCE.md) not done.

Anti-AI-slop: 4/30 (acceptable)
1 visual signature 1 — glass is the owner's request and the spatial grammar; stands over Earth are the product's own image
2 typography 0 — PrivatBank's Pryvat Sans on one scale
3 hero structure 0 — the overview is the core object
4 card usage 1 — dashboards are sections of a stand, not cards on cards
5 decorative 0 — dividers, CTA arrow removed; focus numbering is the dashboard index from the audit
6 SaaS skeleton 1 — side dock + header kept by the owner's preference
7 fake content 0 — demo data stated in focus and XR source line
8 generic animation 1 — one arrival per load with growth of values; nothing loops over data
9 brand specificity 0 — lockup, typeface, Ukraine on the limb
10 memorable concept 0 — three glass stands over Earth, the same space as in the headset
Screenshot test: three tilted glass stands over a night Earth with sunrise. Logo-swap: fails for another brand (lockup, typeface, Ukrainian bank data, subjects).
Evidence: before/ after/ compare/ inventory/ scan/
