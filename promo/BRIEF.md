# Orbita promo film · art-director brief

Owner's idea (his words, Russian): show the manager the new product — first the interface scene, then Meta glasses fly out, we fly into them and see the interface the way it looks in VR: volumetric, in a semicircle.

## Purpose and audience
- One short film the owner sends to his manager (head of a PrivatBank department) in a messenger. The manager has a Meta Quest 3S. The film must make him want to put the headset on and open Orbita.
- Watched on a phone or a laptop, often muted: the story must read without sound.
- Versions: Ukrainian (primary, the product's default language) and English. Same picture, localised titles and the app's own locale (`uk` / `en`).

## The one idea
From screen to space: the same three glass stands that sit on the screen are the stands that surround you in the headset. The camera literally passes from one to the other through the lens.

## Tone and quality bar
- Calm, precise, premium. Think of a hardware launch reveal: slow eased camera, long holds on readable states, light doing the drama (sunrise over the limb), nothing shaking.
- References: the owner's library `D:\design-kit\library\screens\09_SHOTS_LIBRARY\product\rondesignlab` (SpaceX mission control, Siemens, Vexto, Quantis: one hero object, glass around it, big calm numbers); the product's own environment (night Earth, sunrise flare, Ukraine on the limb).
- Not allowed: glitch, chromatic aberration, neon, lens-dirt spam, whip pans, speed ramps, fake HUD text, particle confetti, stock music.

## Material: only the real product
- Desktop scenes are captured from the running app (dark theme, 1440 or 1920 wide, DPR 2): overview with the arrival motion, a hover on an attention chip, a dashboard in focus, the spatial preview.
- The in-headset view is rendered from the real XR scene, not a mock-up: `src/spatial/SpaceEnvironment.tsx` (Earth, sun, stars), panel textures from `src/spatial/drawPanel.ts` (`drawOverviewPanel`, `drawFocusPanel`, `drawWing`), stand placement from `src/spatial/layout.ts` (1.85 m arc, side stands at ±42°, turned 24°), data from `public/mock/dashboard-data.json` through `dashboardModel`. Import these read-only.
- Data is demo data for October 2026. Never imply live data (no "live", "real time", "online" claims); the owner asked not to print "демодані" on screen.

## The headset
- A stylised, logo-free headset of the Quest 3S class (wide front visor, soft strap, two lenses), matte graphite with a satin visor that catches the sunrise. Model it procedurally in three.js, or use a CC0 model and record its source and licence.
- No Meta logos, wordmarks or copies of Meta's product renders. Titles may name "Meta Quest 3S" as the device the product runs on.

## Beats (target 40-45 s)
1. Cold open: night Earth, the sunrise flare grows on the limb, the lockup «ПриватБанк | Орбіта» appears.
2. The screen: the overview arrives (stands rise, values grow), slow push-in; the cursor finds «Recycle 7,2%» in the attention zones and opens the focus of «Стан обладнання»; back to the overview.
3. Leaving the screen: the UI becomes a window floating over Earth; the headset glides in, turns to camera, its visor catches the sun.
4. Into the lens: the camera dollies into one lens; the lens rim frames the frame for a moment; light blooms; we are inside.
5. Through the headset: first person at eye height, three stands in a semicircle over Earth; the head turns left to cash operations, back to payments, right to equipment; a thin controller ray hovers a panel, it rises toward us, a select opens its focus panel with the chart and exact values; back to the panorama.
6. End card: out of the headset; lockup, «Відкрийте в Meta Quest Browser» + `ddintsen.github.io/-`.

## Typography and brand
- Pryvat Sans / Pryvat Sans Display (`public/fonts/*.woff2`), sentence case, one title at a time, no more than six words per title.
- Lockup: `src/assets/privatbank.svg` + divider + «Орбіта», white on dark.
- Colours from `DESIGN.md` tokens; no new palette for the film.

## Technical
- 1920×1080, 30 fps, H.264 High, yuv420p, CRF ~18, under 40 MB; render at 2× and downscale.
- Deterministic frame-by-frame rendering: three.js scenes stepped by a fixed clock; DOM captures with CSS animations seeked through the Web Animations API (`document.getAnimations()`, `currentTime`) and Playwright's clock for rAF. No screen-recording jitter.
- Tools: three.js (already in the repo), Playwright (repo), ffmpeg (system binary or an isolated `promo/` package such as `ffmpeg-static`, checked with `npm view` first). Do not use Remotion (company licence required). Do not add dependencies to the app.
- Music: «Future Design» by penguinmusic (Pixabay Content License), `promo/music/pixabay-future-design-344320.mp3`, chosen by the owner (the first track was too dark); licence and edit notes in `promo/music/LICENSE.md`. Cut to picture: the drop lands on the headset reveal, the lens bloom on a drop downbeat; fade out over the last 2.5 s, -14 LUFS, true peak ≤ -1 dBTP.

## Deliverables
- `promo/SCRIPT.md` (screenwriter): shot list with timecodes, camera paths in scene units, UI states and how to reach them (selectors, URL, locale), titles in Ukrainian and English, transitions and easing, a QA checklist.
- `promo/out/orbita-promo-uk.mp4`, `promo/out/orbita-promo-en.mp4`, a poster frame, a contact sheet every 2 s, `promo/README.md` with the re-render command (builder).

## Guardrails
- Never invent metrics, clients, quotes or claims; every number on screen comes from the app.
- Do not modify `src/`, `tests/` or the app's dependencies; build the film under `promo/`.
- Do not commit or push; the owner's session reviews and publishes.
