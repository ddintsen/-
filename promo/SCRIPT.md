# Orbita promo film · shooting script

Screenwriter and motion director's script for `promo/BRIEF.md`. Version 1, 18 October 2026.
Written against `D:\--main` at HEAD `0d89a56` (XR textures in the glass system, source shown only
when it needs attention) while a chart and colour pass was still uncommitted (`src/api/model.ts`,
`src/components/charts.tsx`, `DashboardCard.tsx`, tokens, `DESIGN.md`). Every value marked
**live** must be re-measured by the builder from the frozen commit that is rendered; the numbers
given here were measured on 18 October 2026 and are the reference for checking, not for
hard-coding.

## 0. Summary

- **Logline.** The three glass stands of PrivatBank's Orbita leave the screen and surround you in
  Meta Quest 3S: the camera flies from the dashboard through the headset lens to prove they are
  the same.
- **Runtime.** 44.000 s = 1320 frames at 30 fps (frames 0-1319). 1920×1080 output, rendered at
  3840×2160 and downscaled. Silent.
- **Masters.** `uk` (primary) and `en`. Frame-identical timing; only the app locale and the titles
  differ.
- **Structure.** 6 beats, 17 shots. Desktop part 0:05-0:18, headset object 0:18-0:25, in-headset
  0:25-0:39, end card 0:39-0:44.
- **On-screen text rule.** No «Демодані» / «Демонстраційні дані» / "Demo data" anywhere (owner's
  rule). Nothing may imply live data: no "live", "real time", "online". The report period
  «Жовтень 2026» / "October 2026" is the only time reference and comes from the app.

## 1. Decisions

1. **The desktop part follows the product's own path.** Overview arrives → cursor opens
   «Recycle: 7,2%» → focus «Стан обладнання» → back → cursor clicks «Відкрити в просторі» → the
   spatial preview. The spatial preview is one of the four desktop scenes the brief lists under
   Material, and it is the UI that "becomes a window floating over Earth" in beat 3: the
   «Простір» dialog detaches from the screen and floats in space with the stands visible inside
   it. The causal chain (click → space → headset) reads without sound. Veto option in §14.
2. **One world for beats 3-6.** The headset is placed exactly where the XR viewer's head is (arc
   centre, eye height 1.6 m). The camera dollies into the left lens and lands on the real
   first-person camera. The lens glass shows the XR scene from the camera's own pose (a
   see-through portal), so the cut from "headset object" to "in-headset view" is pixel-identical
   and needs no trick; the rim framing and the light bloom mark the moment.
3. **The in-headset view is the real XR scene in session mode.** It is composed from the app's own
   exported modules (stands from `layout.ts`, `SpatialWing`, `SpatialControl`, `SpatialSurface`
   with its real hover lift and appear cascade, textures from `drawPanel.ts`, `SpaceEnvironment`
   with `clouds={false}` because `SpatialView` renders `clouds={!session}`, the session-only
   controls), and the ray and pointer use the real `@pmndrs/xr` materials and update functions
   the app gets by default (`controller: { model: false }`: no controller model, 5 mm white ray,
   1 m long). The hovered and selected panel is **id 10, «Стан обладнання»** on the equipment
   stand, so the headset beat rhymes with the desktop deviation (Recycle 7,2%).
4. **Few titles, never over data.** Three titles plus the lockup and the end card. Each sits in
   empty sky or night Earth in its shot. The cold-open lockup match-moves into the app's own
   header wordmark (built from the same SVG and computed styles), and the end card reuses it.
5. **Deterministic, supersampled pipeline.** Playwright with system Chrome on the GPU, Playwright
   clock for rAF and timers, every CSS animation and transition paused and seeked through WAAPI;
   R3F with `frameloop="never"` and `advance(k / 30)`; 2× render, 180° shutter motion blur by
   temporal supersampling, one compositor page, ffmpeg (`ffmpeg-static`) to H.264.
6. **Messenger safety.** The master carries a digitally silent AAC track so Telegram and similar
   apps play it as a video with controls rather than converting it to a looping GIF. It is still
   a silent master; drop the track if the owner prefers no audio stream.

## 2. Conventions

- **Frames and time.** Frame `k` is at `t = k/30` s. Ranges are half-open `[in, out)`. Timecodes
  are `m:ss.ss`.
- **3D units.** Metres. three.js axes, +y up; at yaw 0 the view looks along −z. Yaw ψ positive
  turns left (rotation about +Y). Pitch θ positive looks up. `vfov` is the vertical field of
  view in degrees, aspect 16:9. Euler order for cameras `YXZ`, no roll.
- **XR world.** The XR anchor sits at the origin (as in a session started at the origin):
  head H = (0, 1.6, 0); stands from `layout.ts` at (x, 1.6, z):
  cash (−1.237892, 1.6, −1.374818) yaw +24°, payments (0, 1.6, −1.85) yaw 0,
  equipment (1.237892, 1.6, −1.374818) yaw −24°. Seen from H: stand centres at ±42° and 0°,
  payments edges ±19.4°, side-stand inner edges ±21.4°, outer edges ±58.8°, vertical extent
  ±17.1°. `SpaceEnvironment` at the world origin: Earth centre (0, −417, −249), radius 400, limb
  top 4.0° below eye level straight ahead; sun (dark) at azimuth 21.7° left, elevation −2.0°,
  4.4° above the limb; it sits in the gap between the payments and cash stands.
- **Neck model (first person).** Neck pivot N = (0, 1.525, 0.095); left-eye offset in head space
  o = (−0.0315, 0.075, −0.095). Camera B position = N + R_y(ψ)·R_x(θ)·o, orientation
  R_y(ψ)·R_x(θ). At ψ 0, θ −2° the eye is at (−0.0315, 1.5966, −0.0026). This gives the real
  6DoF parallax between the stands and the Earth when the head turns.
- **DOM units.** CSS px in a 1920×1080 viewport captured at deviceScaleFactor 2 (3840×2160).
  The DOM "virtual camera" V = (s, cx, cy): output pixel (X, Y) shows DOM point
  (cx + (X − 960)/s, cy + (Y − 540)/s). Clamp every frame: cx ∈ [960/s, 1920 − 960/s],
  cy ∈ [540/s, 1080 − 540/s]. V never shows beyond the captured viewport.
- **Output units.** px in the 1920×1080 frame. Title safe area: x 96-1824, y 54-1026 (5%).
- **Easing tokens.**

| Token | Curve | Used for |
| --- | --- | --- |
| E-calm | `cubic-bezier(0.37, 0, 0.63, 1)` (sine in-out, peak 1.57× average speed) | camera moves, V moves, scroll, fov, title fade-out |
| E-arrive | `cubic-bezier(0.16, 1, 0.3, 1)` (the app's `stand-arrive` curve) | object arrival (headset glide), title and end-card entry |
| E-move | `cubic-bezier(0.77, 0, 0.175, 1)` (motion-director inOut token) | the lockup match-move only |
| MJ | minimum jerk `s(u) = 10u³ − 15u⁴ + 6u⁵` | head turns, hand, cursor paths |
| linear | `s(u) = u` | dissolves, flare ramp windows |

  Product-owned motion keeps its own timing and is never retimed: the CSS arrival
  (`stand-arrive` 900 ms, `section-arrive` 700 ms, `bar-grow` 900 ms, `fill-grow` 1000 ms with the
  delays in §9.3), the focus `fill-grow` (500 ms delay, 1000 ms), the `SpatialSurface` appear
  (0.7 s ease-out cubic) and hover lift (exponential, rate 14/s), the Earth, cloud and star motion.
  No speed ramps: the whole film runs at 1×.
- **Colours.** Only `DESIGN.md` tokens: titles `text` #f5f3f8, secondary `muted` #c6c4ce,
  graphite `glass` rgb #2c2d33, `background` #0d1017, `elevated` #1c2330, `space-night` #050a16,
  `space-blue` #102442, `space-sun` #ffc58a, `space-sun-core` #fff4e2.

## 3. Shot table

All DOM shots: `http://localhost:5173/` (the running Vite dev server), theme dark, locale `uk`
or `en`, viewport 1920×1080 at DPR 2 (§9). All 3D shots: the film player (§10).

| Shot | Frames | Time | On screen | Source | Camera start → end | Easing | Out | Title UA / EN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 Cold open | 0-150 | 0:00.00-0:05.00 | Night Earth with city lights, sunrise flare grows on the limb, lockup appears and flies to the header | Player 3D "desktop world": `SpaceEnvironment dark`, clouds on, no stands | pos (0, 1.6, 0.7), vfov 68; target (0, 0.95, −9) → LOOK_TO (x_orb, 2.45, −9) by f120, hold | E-calm; lockup E-arrive in, E-move flight | Dissolve f129-147 into the DOM; lockup handed to the DOM wordmark at f144 | Lockup «ПриватБанк \| Орбіта» / [ПриватБанк] \| Orbita |
| S02 Overview arrives | 150-240 | 0:05.00-0:08.00 | Three stands rise, values grow | DOM, scroll 0, arrival restarted and seeked | V (1.000, 960, 540) → continuing push | product CSS; V E-calm | continuous | none |
| S03 Scroll | 240-282 | 0:08.00-0:09.40 | Glass stands slide over the fixed Earth toward «Зони уваги» | DOM, scroll 0 → 630 (f240-306) | V push continues | E-calm | continuous | none |
| S04 Recycle chip | 282-334 | 0:09.40-0:11.13 | Cursor appears, finds «Recycle: 7,2%», hover, click | DOM, scroll 630 | V → (1.080, 889, 580) at f324 | MJ cursor; E-calm V | 6-frame dissolve f334-340 | none |
| S05 Focus | 334-420 | 0:11.13-0:14.00 | «Стан обладнання», «Жовтень 2026», downtime bars grow, Recycle 7,2% red past the SLA 5% mark | DOM `.focus-modal` (dashboard 10) | V (1.080, 889, 580) → (1.180, 955, 498) by f370 | E-calm | continuous | none |
| S06 Back, to «Відкрити в просторі» | 420-484 | 0:14.00-0:16.13 | Click outside closes the focus, page returns to the top, cursor goes to the primary action and clicks | DOM | V (1.180, 955, 498) → (1.000, 960, 540) f427-469 | E-calm; MJ cursor | 6-frame dissolve f484-490 | none |
| S07 Spatial preview | 484-540 | 0:16.13-0:18.00 | «Простір» dialog, the three stands rise in the 3D preview over Earth | DOM `.spatial-modal`, dark environment, panorama | V (1.000, 960, 540) → (1.040, 955, 542) f490-540 | E-calm | hard continuation: f539 becomes the pane texture, pixel-exact | none |
| S08 The window floats | 540-600 | 0:18.00-0:20.00 | The dialog detaches, the screen dissolves into space, the window floats over the limb, sun emerges beside it | Player 3D "headset world" (clouds off) + pane | A0 (−0.005, 1.598, −2.310212) look −z, vfov 68 → (0, 1.62, 0.52) look at pane, vfov 34 by f612 | E-calm | continuous | none |
| S09 Headset glides in | 600-690 | 0:20.00-0:23.00 | Logo-free headset glides in from the right, turns, sunrise sweeps across the satin visor | Player 3D + headset + portal lenses | (0, 1.62, 0.52) → (0, 1.615, 0.50); target pane → H; vfov 34 | E-arrive headset; E-calm camera | continuous | T3 «Тепер у Meta Quest 3S» / "Now in Meta Quest 3S" |
| S10 Into the lens | 690-750 | 0:23.00-0:25.00 | Headset turns its lenses to us; dolly into the left lens; rim frames the frame; bloom; inside | Player 3D, portal; cut to layer B at f749/750 | (0, 1.615, 0.50) vfov 34 → eye (−0.0315, 1.5966, −0.0026) ψ 0 θ −2 vfov 52 at f756 | monotone cubic z; E-calm xy | invisible cut f749/750 | T3 out by f714 |
| S11 Around you | 750-810 | 0:25.00-0:27.00 | First person: payments ahead with «Жовтень 2026», cash and equipment turned toward you, sun in the gap, night Earth, session controls below | Layer B direct, camera B | ψ 0 → +0.8, θ −2, vfov 52 | E-calm | continuous | T4 «Ті самі стенди — навколо вас» / "The same stands, all around you" |
| S12 Turn left | 810-873 | 0:27.00-0:29.10 | Cash operations: «Операції в касах» 19,7 млн, 6 and 7 | Layer B, camera B | ψ +0.8 → +40.0 (f858), hold to +40.5 | MJ | continuous | T4 out f846-858 |
| S13 Turn right | 873-951 | 0:29.10-0:31.70 | Sweep back through payments to equipment | Layer B, camera B | ψ +40.5 → −40.0 | MJ | continuous | T5 in f918 |
| S14 Ray, hover, select | 951-1006 | 0:31.70-0:33.53 | Thin white ray appears, panel 10 rises 3.5 cm and brightens, press, select | Layer B + ray/cursor (real materials) + R3F pointer events | ψ −40.0 → −40.6, θ −2 | MJ hand; product lift | product state change at f1006 | T5 «Наведіть промінь, натисніть курок» / "Point the ray, pull the trigger", out by f1005 |
| S15 Focus panel | 1006-1116 | 0:33.53-0:37.20 | «Стан обладнання», «Жовтень 2026», chart section and «Точні значення» section at 1.5 m; then the ray selects «Панорама» | Layer B, focus = 10 | hold ψ −40.6; θ −2 → −5 (f1086-1104) | E-calm | product state change at f1116 | none |
| S16 Panorama returns | 1116-1170 | 0:37.20-0:39.00 | Stands rise again (product cascade), head returns to payments | Layer B, panorama | ψ −40.6 → 0, θ −5 → −2 (f1122-1164) | MJ | invisible reverse cut f1169/1170 | none |
| S17 Out, end card | 1170-1320 | 0:39.00-0:44.00 | Pull out through the lens; headset from behind with the stands in its lenses; end card | Player 3D + portal + overlay | eye → (0, 1.72, 0.60) look (0, 1.70, −2.0) vfov 40 by f1218 → (0, 1.718, 0.58) | monotone cubic z; E-calm | ends on the end card, no fade | Lockup + «Відкрийте в Meta Quest Browser» + `ddintsen.github.io/-` / "Open in Meta Quest Browser" |

Beats: 1 = S01; 2 = S02-S06; 3 = S07-S09; 4 = S10; 5 = S11-S16; 6 = S17.

## 4. Shot details

### S01 · Cold open · f0-150
- **Scene.** Film player, desktop world: `<SpaceEnvironment dark motion />` (clouds on, exactly
  what `SpaceBackdrop` mounts), no stands, no headset. The environment clock is pre-rolled so
  that at f150 it equals the DOM backdrop's clock at DOM frame 150 (§9.4); the Black Marble city
  lights of Ukraine sit near the limb and drift slowly with the Earth spin.
- **Camera.** The app's backdrop camera: position (0, 1.6, 0.7), vfov 68°, near 0.1, far 1000.
  Look target (0, 0.95, −9) at f0 (pitch −3.8°) → (x_orb, 2.45, −9) at f120 (pitch +5.0°, the
  app's `LOOK_TO`), E-calm; then hold to f150 tracking x_orb. x_orb(t) = 0.09·sin(0.157·T) with T
  the backdrop's R3F clock (`clock.elapsedTime`) mapped per §9.4, so the f150 pose equals the DOM
  backdrop's camera. This echoes the app's own "view lifts from the night side toward the limb".
- **Black.** f0 fully black, linear fade from black f0-18.
- **Flare grows.** Ramp k = smootherstep((t − 0.5 s)/3.1 s), 0 before f15, 1 from f108. Each
  frame, after the module's own `useFrame`, set on the four sprites of the sun group (identify by
  scale): glow 520×520 opacity 0.55·k; wide 1700×380 opacity 0.42·k; core 60×60 opacity 1.0·k;
  streak 1500×18 opacity 0.35·k and `scale.x = 1500·(0.4 + 0.6·k)`. Halo uniform
  `strength = 0.35 + 0.65·k`. Do not touch the sun group's scale (the module sets its breathing
  every frame). From f108 every value is the product's own.
- **Lockup L** (§6.2). In f54-78: opacity 0 → 1 and rise 10 px → 0, E-arrive, at scale 2.4,
  centre (960, 432) in the dark sky above the limb. Hold. Match-move f114-144 with E-move to the
  DOM `.topbar .wordmark` box (live; measured x 180, y 15, 230.7×40 UA, 226.8×40 EN) at scale 1.0.
  At f144 the DOM wordmark is unhidden under L (§9.5); L stays on top until the dissolve ends and
  is removed at f147, so the handover cannot be seen.
- **DOM dissolve.** f129-147 the DOM layer fades in (linear 0 → 1) over the player's environment.
  The DOM frames f129-149 show the pre-arrival state: stands invisible (arrival at time 0),
  header, side rail and controls visible, wordmark hidden until f144.

### S02 · The overview arrives · f150-240
- **DOM.** Arrival animations restarted and paused (§9.3); every (sub)frame sets
  `currentTime = (k − 150)·1000/30` ms. The arrival ends at about f195 (1.5 s).
- **V.** One slow push across S02-S04: (1.000, 960, 540) at f150 → (1.080, 889, 580) at f324,
  E-calm.
- **Mouse.** Untouched until f282 (no backdrop parallax yet).

### S03 · Scroll to the attention zone · f240-282 (scroll runs f240-306)
- `scrollTo({ top: y, behavior: "instant" })` with y = max·E-calm((k − 240)/66), max = live
  `scrollHeight − innerHeight` (measured 630). Peak 15 px per frame. The fixed Earth stays, the
  glass stands slide over it with live backdrop blur.

### S04 · The cursor finds «Recycle: 7,2%» · f282-334
- **Cursor** (§9.6). Appears at f282 at (1240, 700), opacity 0 → 1 over 9 frames. Moves along a
  quadratic Bézier with control (760, 860) to the chip centre (live; measured UA (343.9, 996.4),
  EN "Recycle: 7.2%" (373.2, 996.4)), MJ, arriving f324. Arrow → hand while over an element whose
  computed `cursor` is `pointer`. The real mouse follows every (sub)frame, so card hover, chip
  hover and the backdrop parallax are the product's own.
- **Hover.** The chip's hover state currently renders identically to rest (§13 D2); the hand
  cursor is the only cue until that is fixed.
- **Click.** Mouse down f332, up f334; cursor press scale 0.92 for f332-334, back to 1.0 by f340.
  React opens the focus of dashboard 10.
- **Out.** The product opens the dialog instantly; the film cross-dissolves from the held f333
  frame to the live frames over f334-340 (200 ms, inside the 180-260 ms band of `DESIGN.md`).

### S05 · Focus «Стан обладнання» · f334-420
- **DOM.** `.focus-modal`: title «Стан обладнання» / "Equipment status", description
  «Жовтень 2026» / "October 2026" (live; no source text for mock data), chart (ТСО, АТМ, Recycle
  lines), «Простій», three downtime rows. The three `fill-grow` animations are adopted at f334 and
  seeked: bars grow f349-379; the Recycle 7,2% bar runs past the SLA 5% tick.
- **V.** (1.080, 889, 580) at f334 → (1.180, 955, 498) at f370, E-calm; hold. Visible: dialog
  title, chart, downtime rows, the «Точні значення» heading. The 1,7% / 4,6% / 7,2% figures are
  about 26 px tall at 1080p.
- **Cursor.** Stays at the chip (off-frame at this zoom). f402-420 it moves to (300, 900), MJ,
  entering from the lower left of the frame; pointer down f421 on the dimmed overlay (Radix closes
  on pointer-down outside), up f423. A pointer close leaves no keyboard focus ring.
- **Out.** 6-frame dissolve f421-427 to the overview.

### S06 · Back to the overview, to «Відкрити в просторі» · f420-484
- **DOM.** Scroll 630 → 0 over f427-469, E-calm. V (1.180, 955, 498) → (1.000, 960, 540) over
  f427-469, E-calm. The two returning moves read as one.
- **Cursor.** (300, 900) → `.xr-entry` centre (live; measured UA «Відкрити в просторі»
  (1727.1, 122.4), EN "Open in Space" (1744.6, 122.4)) over f441-477, quadratic Bézier control
  (1300, 760), MJ. Press f482, click f484.
- **Precondition.** The dark-theme hover of `.xr-entry` must keep the filled look (§13 D1). If it
  is not fixed at render time, trigger this click with `element.click()` and keep the real mouse
  away from the button; record the fallback in the render log.
- **Out.** 6-frame dissolve f484-490 into the spatial dialog.

### S07 · The spatial preview · f484-540
- **DOM.** `.spatial-modal`, title «Простір» / "Spatial view", dark environment, panorama. The R3F
  preview runs the product's appear cascade (payments first, then the side stands; each surface
  0.7 s) from its first rendered frame; the lazy chunk and textures are pre-warmed (§9.2) so no
  loading text appears. Visible product copy: «Для AR і VR відкрийте сайт у Meta Quest Browser.».
- **V.** Hold to f490, then (1.000, 960, 540) → (1.040, 955, 542) at f540, E-calm (attention to
  the 3D view). Cursor fades out f490-499.
- **Out.** Frame f539 (the DOM image under V(f539)) becomes the pane in S08, pixel-exact (§10.4).

### S08 · The window floats over Earth · f540-600
- **Scene.** Player 3D, headset world: `SpaceEnvironment dark clouds={false}` (session parity for
  beats 3-6), plus the pane: the DOM still f539 on a 1.920 × 1.080 m plane at P = (0, 1.6, −3.08)
  facing +z (1 CSS px = 1 mm), unlit, `toneMapped: false`, texture at 3840×2160 with mipmaps and
  anisotropy 16. Alpha: 1 inside the `.spatial-modal` rect (live; measured x 320, y 65.8,
  1280×948.4, radius = computed `border-radius`, 28 px), outside it 1 → 0 over f540-558 (linear):
  the blurred overview and the dialog shadow dissolve, the real 3D space appears around the
  window. A floating window has no shadow.
- **Camera A.** f540: A0 = (−0.005, 1.598, −2.310212), looking along −z, vfov 68.000°
  (= P + offset of V's centre + 0.80058/1.04 m; reproduces V(f539) exactly). → f612:
  (0, 1.62, 0.52), looking at P, vfov 34°. Position and vfov both E-calm over f540-612. The
  window shrinks from 88% to 43% of the frame height; the sun flare emerges beside its left edge
  (sun at x ≈ 13%), the limb arcs behind it.

### S09 · The headset glides in · f600-690
- **Headset** (§7) at its own local frame (origin = eye midpoint; local −z = visor side). Path:
  cubic Bézier H0 (0.48, 1.68, −0.12) → c1 (0.36, 1.665, −0.09) → c2 (0.10, 1.615, −0.02) →
  H (0, 1.6, 0), f600-684, E-arrive (enters past the right frame edge, settles in front of the
  window). Yaw φ (0 = worn, visor toward −z): 145° at f600 → 70° at f684, E-calm. Roll +5° → 0°
  and nose pitch −6° → 0°, f600-684, E-arrive.
- **The visor catches the sun.** The visor normal bisects the sun and camera directions at
  φ ≈ 100.8°, reached near f647 (0:21.57); the highlight sweeps across the wrapped satin visor
  from about f620 to f680. Builder verifies the peak frame from the geometry.
- **Camera A.** (0, 1.62, 0.52) → (0, 1.615, 0.50) over f600-690, E-calm; look target blends from
  P to H over f600-660 (pitch ≈ −2.2°); vfov 34° from f612.
- **Depth of field.** Background layer (environment + pane) Gaussian σ 0 → 6 px (1080p px; 12 px
  at 4K) over f600-630; the headset stays sharp (§10.5).
- **Bloom.** UnrealBloom on the headset world from f600: strength 0.5, radius 0.35, threshold 0.85
  (catches the sun core and the visor peak only).
- **Title T3** (§6.1) bottom-left.

### S10 · Into the lens · f690-750
- **Headset.** Yaw 70° → 0° over f684-720, E-calm: the lenses face the camera (the pose of a
  headset about to be put on). The relaxed strap hangs below the line of sight (§7.1).
- **Camera A keyframes** (z by monotone cubic through the keys, x and y E-calm between keys, vfov
  monotone cubic; orientation slerps from "look at H" at f690 to ψ 0 / θ −2° at f726, then fixed):

| Frame | Position | vfov | Note |
| --- | --- | --- | --- |
| 690 | (0, 1.615, 0.500) | 34 | hero distance |
| 726 | (−0.0315, 1.600, 0.075) | 40 | on the left-lens axis |
| 738 | (−0.0315, 1.599, 0.050) | 44 | rim frames the frame: lens circle ≈92% of frame height, bezel ring at the edges (slow, 25 mm in 0.4 s) |
| 749 | (−0.0315, 1.597, 0.008) | 51.5 | cut frame: lens aperture (r 0.024 at z −0.015) contains all four frame corners |
| 756 | (−0.0315, 1.5966, −0.0026) | 52 | = camera B at ψ 0, θ −2° (landed) |

- **Focus pull.** Background σ 6 → 0 px over f700-740 (the world becomes the subject); headset
  layer σ 0 → 8 px over f720-745 (the rim is too close to be sharp).
- **Light bloom.** Additive radial glow in `space-sun-core` #fff4e2, centred on the sun's screen
  position, radius 0.9 × frame width, opacity 0 → 0.45 over f737-749 (smoothstep) and 0.45 → 0
  over f749-770; UnrealBloom strength 0.5 → 0.9 → 0 on the same curve. Physically motivated: the
  sun is in view through the lens. No lens dirt, no chromatic aberration.
- **Cut.** First frame whose four corner rays all pass inside the lens aperture: target f749.
  From f750 render layer B directly with camera B. The two must be identical (§12).

### S11 · The same stands, around you · f750-810
- **Scene.** Layer B direct (§8): panorama, session mode. Camera B (neck model), ψ 0 → +0.8°
  over f756-810 (E-calm, a living head, never a shake), θ −2°, vfov 52° (≈19 px per degree at the
  centre, close to Quest 3S's ≈20, so the film does not promise more sharpness than the headset).
- **Framing.** Payments stand x ≈ 571-1349 px, y ≈ 156-839 px, its heading «Платежі» with
  «Жовтень 2026» on the right; the cash and equipment stands enter from the frame edges, turned
  24° toward the viewer; the sun core in the gap at x ≈ 520 px, y ≈ 540 px; night Earth with city
  lights below; the session-only controls «Центрувати простір» / «Завершити XR-сеанс» at
  y ≈ 887-1024 px.
- **Bloom tail** from S10 ends at f770; nothing else is added to the product image.
- **Title T4** top-left.

### S12 · Head turns left to cash operations · f810-873
- ψ +0.8° → +40.0° over f810-858 (MJ, peak ≈46°/s), θ −2°; hold +40.0 → +40.5 over f858-873
  (E-calm). The cash stand is centred: wide panel 5 «Операції в касах» (19,7 млн операцій), panels
  6 and 7 below; the sun peeks between it and the payments stand at the right.

### S13 · Back through payments, on to equipment · f873-951
- ψ +40.5° → −40.0° over f873-951 (MJ, 2.6 s, peak ≈58°/s), passing 0° at ≈f912; θ −2°.
- T5 enters at f918.

### S14 · The ray hovers panel 10, it rises, select · f951-1006
- **Hand** (target-ray origin; no controller model, as in the app). World positions:
  f951 (0.32, 1.12, −0.10) → f972 (0.331, 1.22, −0.114), MJ; hold to f1006.
- **Hit point.** Path in equipment-stand local metres (stand origin (1.237892, 1.6, −1.374818),
  yaw −24°): wing (0.30, −0.50, −0.025) at f951 → panel 10 face (0.131, −0.263, 0) at f972, MJ,
  straight in stand-local space; world target (1.357561, 1.337, −1.321540) before the lift. Every
  frame the builder intersects the hand → hit ray with the current (lifted) surface.
- **Ray.** Visible from f951, the first frame it intersects something (the wing's bottom margin),
  exactly like the app (the ray is hidden without an intersection). Length min(1 m, distance), so
  it ends ≈0.6 m short of the panel, fading to zero. The pointer dot sits 1 cm off the hit surface.
- **Hover.** The hit enters panel 10's rect at ≈f959; real R3F pointer events (§10.6) set
  `SpatialSurface` hover: lift 3.5 cm toward the viewer (rate 14/s), colour ×1.16. Panel 10 spans
  x ≈ 600-1300 px, y ≈ 530-765 px (about 37% of the frame width); its «Простій · SLA 5%» list
  shows ТСО 1,7%, АТМ 4,6%, Recycle 7,2%.
- **Select.** Pointer down f1002 (pressed colour (0.78, 0.78, 0.9), lift 1.4 cm, ray opacity
  0.6); up and click f1006 → `focused = 10`.
- **Head.** ψ −40.0 → −40.6 (E-calm), θ −2°.
- **T5** out f996-1005, before the focus appears.

### S15 · Focus panel: chart and exact values · f1006-1116
- **State.** At f1006 the stands unmount (instantly, as in the app) and the focus group mounts with
  the product's appear (0.7 s). Its pose is computed exactly like `SpatialView` from camera B at
  f1006: p + 1.5·(horizontal view direction), facing the viewer. Reference: centre
  F ≈ (1.0158, 1.5966, −1.1386), yaw −40.6°.
- **Content** (`drawFocusPanel(model 10, compact = true, offset 0, dark = true, period)`),
  2.04 × 1.1176 m (21 facts → texture 2048×1122): title «Стан обладнання» / "Equipment status",
  subtitle «Працюючі пристрої» / "Operating devices", period «Жовтень 2026» / "October 2026" top
  right; left section: working-devices lines (ТСО, АТМ, Recycle), «Простій · SLA 5%», three
  meters 1,7% / 4,6% / 7,2%; right section «Точні значення» / "Exact values": ТСО 1,7% SLA 5%
  «Низький простій», АТМ 4,6% «Робочий рівень», Recycle 7,2% «Високий простій», then 18 daily
  device counts (ТСО 4 120 … 4 230, АТМ 3 180 … 3 010, Recycle 1 890 … 1 990). Controls below:
  «← Назад», «Панорама», «Далі →» (disabled at dashboard 10), «Центрувати простір». No source line.
- **Framing.** At θ −2° the panel spans x ≈ 207-1713 px, y ≈ 84-914 px; the controls row is just
  inside the bottom edge. Reading hold f1027-1086 with the hand lowered: f1008-1026 the hand goes
  to (0.30, 1.02, −0.10) (MJ) and the ray disappears.
- **To the panorama.** θ −2° → −5° over f1086-1104 (E-calm); hand f1086 → f1104 to
  (0.30, 1.10, −0.12) (MJ); aim point in focus-group local metres from (−0.30, −0.80), below the
  controls where nothing is hit and the ray stays hidden, up to the «Панорама» centre
  (−0.26, −0.6788) (MJ). The ray appears on contact with the control at ≈f1093, which is also
  the hover (lift, ×1.16). Approaching from below avoids the 4 cm gap between panel and controls,
  where the product would drop the ray for a frame. Pointer down f1112, click f1116 →
  `focused = null`.

### S16 · Back to the panorama · f1116-1170
- At f1116 the stands remount with the product's cascade (`STAND_ORDER` [1, 0, 1] × 0.12 s, panels
  +0.18 s + 0.07 s × index, 0.7 s each): payments first, the side stands 0.12 s later; the
  equipment stand, in view, rises from depth while the head turns back.
- Hand lowers f1118-1134 to (0.26, 1.02, −0.18) (MJ); ray hidden.
- Head ψ −40.6° → 0°, θ −5° → −2° over f1122-1164 (MJ, peak ≈56°/s); hold to f1170.

### S17 · Out of the headset, end card · f1170-1320
- **f1170.** Switch from layer B direct back to "headset world + portal lenses", camera at the
  same pose (identical frame). Headset at H, φ 0 (worn orientation); the pane is not rendered.
- **Camera A keyframes** (same interpolation rules as S10):

| Frame | Position | Look | vfov |
| --- | --- | --- | --- |
| 1170 | (−0.0315, 1.5966, −0.0026) | ψ 0, θ −2° | 52 |
| 1180 | (−0.0315, 1.598, 0.012) | ψ 0, θ −2° | 49 |
| 1194 | (−0.0315, 1.605, 0.065) | ψ 0, θ −1° | 44 (rim passes again) |
| 1218 | (0, 1.720, 0.600) | target (0, 1.700, −2.0) | 40 |
| 1320 | (0, 1.718, 0.580) | same target | 40 (E-calm push from f1218) |

- **Light.** Lens glow 0.30 at f1172 → 0 by f1190; headset layer σ 8 → 0 px over f1176-1196;
  background σ 0 → 3 px by f1218.
- **End card** (§6.3): the headset seen from behind in the lower third (lenses glowing with the
  stands inside), the text block above it. Text enters f1212-1245, full from f1245, held to the
  last frame (2.5 s). No fade to black: the last frame is the end card.

## 5. The one idea, frame by frame
The three stands are seen four ways and each view is real: as glass columns on the screen (S02),
in the browser's 3D preview (S07), in the lenses of the headset (S10, S17) and around the viewer
(S11-S16). The pane, the portal and the first-person camera share one world, so the stands do not
morph or jump at any point.

## 6. Typography

Fonts: the app's own `@font-face` block (copy `src/styles/app.css` lines 5-85: `local()` first,
then `public/fonts/*.woff2`). Titles Pryvat Sans Display 500 (`PryvatSans-DisplayMedium.woff2`),
URL Pryvat Sans 400 (`PryvatSans-Regular.woff2`). Sentence case, at most six words, one title at a
time, no boxes, scrims, shadows or underlines (house rules). Before rendering assert
`document.fonts.check('500 64px "Pryvat Sans Display"')` and the Pryvat Sans weights.
Licence: Pryvat Sans carries "Exclusively for JSC CB PRIVATBANK"; this film is an internal
PrivatBank communication.

### 6.1 Titles

Style T: Pryvat Sans Display 500, 64 px, line-height 1, letter-spacing −0.025em, colour #f5f3f8,
single line, left-aligned. Entry: opacity 0 → 1 and translateY 10 px → 0 over 18 frames, E-arrive.
Exit: opacity 1 → 0 over 12 frames, E-calm. Use non-breaking spaces inside «Meta Quest 3S», after
«у», and in "Meta Quest 3S".

| Id | UA | EN | In | Full | Out | Anchor | Background |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L | lockup «ПриватБанк \| Орбіта» | [ПриватБанк] \| Orbita | f54-78 | f78-114 | flies to the header f114-144 | centre (960, 432), scale 2.4 | night sky above the limb |
| T3 | Тепер у Meta Quest 3S | Now in Meta Quest 3S | f630-648 | f648-702 | f702-714 | bottom-left: x 128, baseline 968 | night Earth below the window |
| T4 | Ті самі стенди — навколо вас | The same stands, all around you | f762-780 | f780-846 | f846-858 | top-left: x 128, baseline 112 | sky above the stands (stand tops ≥156 px) |
| T5 | Наведіть промінь, натисніть курок | Point the ray, pull the trigger | f918-936 | f936-996 | f996-1005 | top-left: x 128, baseline 112 | sky above the stands |

No titles over the desktop part: the interface speaks there, and the owner's rule forbids filler
text. T5 repeats the app's own help («натисніть курок») and the action the viewer sees.

### 6.2 Lockup
Built in HTML in the overlay, not as a bitmap: `<img src="src/assets/privatbank.svg">` with
`filter: brightness(0) invert(1)` (white), width 142 px; divider 1×21 px `currentColor` at
opacity 0.28; «Орбіта» / "Orbita" in Pryvat Sans Display 600, 18 px, letter-spacing −0.4 px,
white; flex, gap 12 px, align-items center, box height 40 px (all values live from
`getComputedStyle` of `.topbar .wordmark` and its children). Scaled by CSS transform. At f144 the
1.0× lockup must overlay the DOM wordmark with a mean absolute difference below 1/255.

### 6.3 End card (S17)

| Element | Text UA / EN | Style | Position |
| --- | --- | --- | --- |
| Lockup | as 6.2 | scale 2.0 | centre (960, 330) |
| Action | «Відкрийте в Meta Quest Browser» / "Open in Meta Quest Browser" | Pryvat Sans Display 500, 60 px, −0.025em, #f5f3f8 | centred, baseline 482 |
| Address | `ddintsen.github.io/-` | Pryvat Sans 400, 48 px, #c6c4ce, ligatures off | centred, baseline 552 |

Entry: lockup f1212-1230, action f1221-1239, address f1227-1245, each E-arrive with a 10 px rise.
The headset occupies y ≈ 701-965 px below the block; the sun streak passes at y ≈ 581 between them.
Nothing else on the card: no small print, no source label.

## 7. The headset

### 7.1 Model (procedural three.js, stylised, logo-free)
A generic device of the Quest 3S class, not a replica: no logos, wordmarks, text, sensor-cluster
patterns or Meta-specific shapes. Local frame: origin at the eye midpoint, −z toward the visor,
+x the wearer's right. Dimensions in cm:

| Part | Size and placement |
| --- | --- |
| Front shell | 19.0 wide × 10.0 high × 7.0 deep (z −11.0 to −4.0); plan-view superellipse corners r 3.4; the front face bulges 1.0 at the centre and wraps strongly at the sides |
| Satin visor | the front face inset 0.6 from the shell outline, proud 0.05, separated by a 0.08 functional seam |
| Facial interface | soft foam ring 3.0 deep (z −4.0 to −1.0), outline = shell inset 0.6, nose cut-out 3.8 × 2.6 at the bottom centre |
| Lenses | two circular apertures, clear Ø 4.8, bezel Ø 5.8 × 0.4 deep, centres x ±3.15 (63 mm IPD), y 0, z −1.5 (15 mm in front of the eyes) |
| Strap | soft band 3.0 wide × 0.4 thick; side arms from (±9.5, 0, −6.0); relaxed loop through (±10, −4, 3), (±6, −10, 11) to the back pad at (0, −11.5, 13), so it hangs below the line of sight and never blocks the lenses |

### 7.2 Materials (tokens only)
- Shell: `MeshPhysicalMaterial` colour #2c2d33 (`glass` RGB), roughness 0.58, metalness 0,
  clearcoat 0.15, clearcoatRoughness 0.5: matte graphite.
- Visor: colour #0d1017 (`background`), roughness 0.18, clearcoat 1.0, clearcoatRoughness 0.06,
  ior 1.5, `envMap` from a per-frame `CubeCamera` (512 px, near 0.05, far 1000) at H rendering the
  environment and the pane only: satin black that reflects the sun, the limb glow and the window.
- Seam #050a16. Foam #1c2330 (`elevated`), roughness 0.95, sheen 0.4. Bezel #050a16, roughness
  0.35, metalness 0.2. Strap #1c2330, roughness 0.9, sheen 0.6, sheenRoughness 0.8.
- Lens glass: the portal shader (§7.4).

### 7.3 Light and the sunrise on the visor
- Directional "sun" along the direction H → `SUN_DARK` (−0.369, −0.035, −0.929), colour #ffc58a,
  intensity 3.0; hemisphere sky #050a16 / ground #102442, intensity 0.35 (blue bounce from the
  night Earth); `RectAreaLight` on the pane, 1.28 × 0.948 m, colour #c6c4ce, intensity 2.0
  (the window rim-lights the headset from behind). These lights affect the headset only.
- The reflection: the sun is ahead-left of the camera, so a visor facing the camera cannot mirror
  it. As the headset turns, the visor normal reaches the half-vector of sun and camera at
  φ ≈ 100.8° (visor facing frame left). The strongly wrapped visor spreads that condition over
  φ ≈ 125° → 75°, so a warm vertical highlight slides across the visor for about two seconds and
  peaks near f647, picked up by the bloom threshold. It is real specular from the env map and the
  sun light, not a painted streak.

### 7.4 Lens fly-through
- **Portal.** Every frame of S09, S10 and S17, render layer B (the XR scene, §8) to `RT_B` with
  camera A's exact pose and projection, at full resolution. The lens glass material samples `RT_B`
  at `gl_FragCoord.xy / resolution`, multiplies by 0.97, adds a Fresnel reflection of the env map
  (F0 0.02, strength 0.6) and darkens towards the aperture edge by
  `1 − 0.25·smoothstep(0.7, 1.0, r/R)`. Through the lens you therefore see the world from where
  you stand plus the stands: an honest see-through view without refraction. `RT_B` gets the same
  blur as the background layer (σ_B = σ_BG).
- **Rim framing.** At f738 the camera is 6.5 cm from the lens plane, the clear aperture fills about
  92% of the frame height and the dark bezel ring sits on the frame edges: the stands appear
  inside a circle for a beat (slow dolly f726-749).
- **Bloom and cut.** The glow peaks at f749, the first frame where the aperture contains the whole
  frame (corner-ray test against r = 0.024 m at z = −0.015). From f750 layer B renders directly
  with camera B; because `RT_B` already was layer B from that pose, the cut is invisible. S17
  reverses the move.
- **Precision.** Headset pass near 0.005 m, far 5; environment and layer B near 0.1, far 1000 (the
  app's values). Composite by layer, not by a shared depth buffer.

## 8. First-person XR section (S11-S16)

### 8.1 Composition of layer B (must mirror `Scene` in `SpatialView.tsx`, session mode)
- `SpaceEnvironment dark clouds={false}` (live: `clouds={!session}`), `motion` on; ambient 0.35,
  directional (−3, 4, 2) 1.4 (dark values).
- Anchor group at the origin; for each `spatialStands` entry a group at (x, 1.6, z), yaw `angle`:
  slab `RoundedBoxGeometry(1.26, 1.1, 0.03, 4, 0.07)` at z −0.05, `MeshStandardMaterial` #102442,
  roughness 0.35, metalness 0.15, transparent, opacity 0.55, depthWrite false, renderOrder 0, no
  raycast; `SpatialWing` 1.28 × 1.12 at z −0.025 with `aside = period` on the payments stand only;
  panels with `drawOverviewPanel(model, wide, dark = true)` at their `layout.ts` positions and
  sizes; appear delays: wing `STAND_ORDER[i] × 0.12`, panels
  `STAND_ORDER[i] × 0.12 + 0.18 + 0.07 × panelIndex` (`STAND_ORDER` = [1, 0, 1]); `onSelect` →
  focus.
- No source line: `sourceAlert` is null for mock data (live: `sourceNotice` returns null for
  `mock`). Session-only controls: group at (0, 1.04, −1.35), rotation x −0.31, «Центрувати
  простір» at x −0.5 and «Завершити XR-сеанс» at x +0.5, 0.94 × 0.16 each.
- Focus group (when focused): `drawFocusPanel(model, compact = true, factsOffset 0, dark = true,
  period)` on 2.04 × `focusSurfaceHeight(facts)`, controls at y = −height/2 − 0.12 (x −0.79,
  −0.26, 0.27, 0.79; widths 0.44, 0.54, 0.44, 0.5; height 0.16), scroll arrows only if
  facts > 24 (not for 10). Pose from the camera at the click (§S15). `period` =
  `formatReportDate(data.meta.reportDate)` → «Жовтень 2026» / "October 2026".
- The app's `Panel` wrapper is not exported; copy its 30 lines verbatim (texture choice, sizes,
  memo keys). The store must hold `theme: "dark"` and `compact: true` before mount, because
  `SpatialWing`, `SpatialControl` and the panels read them.
- Parity test before rendering (§12): rebuild the browser preview with this composition (anchor
  at z 0.7, camera (0, 1.6, 2.2), vfov 50.77° for a 1214×640 canvas, clouds on, no session
  controls) and compare with the DOM spatial canvas; they must match.

### 8.2 Head path

| Frame | Time | ψ (+ left) | θ | Move |
| --- | --- | --- | --- | --- |
| 756 | 0:25.20 | 0.0 | −2.0 | landed |
| 810 | 0:27.00 | +0.8 | −2.0 | drift, E-calm |
| 858 | 0:28.60 | +40.0 | −2.0 | to cash, MJ |
| 873 | 0:29.10 | +40.5 | −2.0 | drift |
| 951 | 0:31.70 | −40.0 | −2.0 | to equipment through payments (0° at ≈f912), MJ |
| 1006 | 0:33.53 | −40.6 | −2.0 | drift during hover and select |
| 1086 | 0:36.20 | −40.6 | −2.0 | reading hold |
| 1104 | 0:36.80 | −40.6 | −5.0 | look at «Панорама», E-calm |
| 1122 | 0:37.40 | −40.6 | −5.0 | hold |
| 1164 | 0:38.80 | 0.0 | −2.0 | back to payments, MJ |
| 1170 | 0:39.00 | 0.0 | −2.0 | end of the in-headset view |

### 8.3 Controller ray and pointer (the app's own look)
- Import from `@pmndrs/xr/internals` (installed with `@react-three/xr` 6.6.32):
  `PointerRayMaterial`, `PointerCursorMaterial`, `updatePointerRayModel`,
  `updatePointerCursorModel`, `defaultRayPointerOpacity`. Drive them with a stub pointer:
  `{ getEnabled: () => true, getButtonsDown: () => pressed ? new Set([0]) : new Set(),
  getIntersection: () => hit && { distance, pointOnFace, normal: (0, 0, 1), object: hitMesh } }`.
- Ray: unit `BoxGeometry` mesh, `matrixAutoUpdate false`, renderOrder 2, inside a group at the
  hand whose −z points at the hit (orient with `Matrix4.lookAt(hand, hit, up)`; `Object3D.lookAt`
  would point +z). White, 5 mm thick, opacity 0.4 (0.6 while pressed), length min(1 m, distance),
  fading to zero at its far end. Pointer dot: unit `PlaneGeometry`, scale 0.1 m, radial falloff,
  1 cm off the surface, renderOrder 1. No controller model, no hand model, no logo: exactly
  `controller: { model: false }` in the app.

### 8.4 Hover and select
Use the real `SpatialSurface`: every frame of S14-S15 project the current hit point with camera B
and send `page.mouse.move` to that pixel (R3F raycasts from the camera and hits the same mesh);
`page.mouse.down/up` at the press frames. This produces the product's hover lift, brightening,
pressed colour, `onSelect` and the focus pose without re-implementing them.

## 9. DOM capture (Playwright)

### 9.1 Browser and context
- System Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe` (Playwright 1.64.1 expects
  chromium-1248, which is not installed; install nothing). Launch headless with
  `--use-angle=d3d11 --ignore-gpu-blocklist`; assert the backdrop's renderer is the GPU
  (measured "ANGLE (NVIDIA … RTX 4060 … D3D11)") and `canvas.dataset.spaceMotion === "drift"`.
  Software WebGL freezes the backdrop and is not acceptable.
- Fresh context per locale: viewport 1920×1080, deviceScaleFactor 2, `reducedMotion:
  "no-preference"`, empty storage (so the store loads the untouched baseline from
  `public/mock/dashboard-data.json`); init script `localStorage.setItem("orbita-locale", "uk" | "en")`.
  Headless hides scrollbars; the layout measured here is the 1920 px layout without a scrollbar.
- Freeze: record `git rev-parse HEAD`, `git status --short` and hashes of `src/` before and after
  each capture; any change in between invalidates the capture (Vite HMR would re-render
  mid-sequence). Fallback if the tree keeps moving: a temporary
  `vite build --mode standalone --outDir <temp outside the repo>` served by `vite preview`.

### 9.2 Settle sequence (before frame 129)
1. `page.clock.install({ time: 2026-10-18T10:00:00+03:00 })` before navigation, then pause it and
   verify that `performance.now()` does not advance over 500 ms of real time. From here on time
   moves only through `page.clock.runFor`.
2. `goto` the app, wait in real time for `.cockpit .wing` and `document.fonts.ready`.
3. Advance 4000 ms in 16 ms steps (backdrop mounts, its 2.8 s intro completes).
4. Dark theme: if `document.documentElement.dataset.theme !== "dark"` (the app starts in
   `office` and does not persist the theme), `dispatchEvent("click")` on the first
   `.topbar .icon-button` (no mouse move, so no parallax and no focus); assert `dark` afterwards.
   Advance 1000 ms.
5. Pre-warm the spatial chunk and textures: dispatch a click on `.xr-entry`, wait in real time for
   `.xr-canvas canvas`, advance 1500 ms, press Escape, `document.activeElement.blur()`, advance
   3500 ms. Closing remounts the backdrop and restarts its intro; record `T_mount`, the fake time at
   which `canvas[data-space-ready="true"]` reappears.
6. Inject `.topbar .wordmark { visibility: hidden }` (removed at f144).
7. Restart and pause the arrival (§9.3).

### 9.3 CSS animations through WAAPI
- Restart the arrival without touching inline delays:
  ```js
  const sel = ".cockpit .wing, .cockpit .wing-cards > .dashboard-card, .grow-bar, .progress-fill";
  document.querySelectorAll(sel).forEach((el) => (el.style.animationName = "none"));
  void document.body.offsetHeight;
  document.querySelectorAll(sel).forEach((el) => (el.style.animationName = ""));
  ```
  then adopt `document.getAnimations()` whose `animationName` is one of `stand-arrive`,
  `section-arrive`, `bar-grow`, `fill-grow`; `pause()` each and set `currentTime = 0`.
- Inventory measured at load (live): `stand-arrive` 900 ms with delays 50 / 160 / 220 ms;
  `section-arrive` 700 ms × 9 with delays 300 / 380 / 460 ms; `bar-grow` 900 ms × 16 with inline
  delays 0-245 ms; `fill-grow` 1000 ms × 15 with 500 ms delay. The arrival is complete 1500 ms
  after the restart.
- After every state change (hover, click, dialog open or close) adopt every new `Animation` in
  `document.getAnimations()` (CSS animations and CSS transitions alike), `pause()` it, store its
  birth frame, and from then on set `currentTime = (k + subOffset − birth)·1000/30`. The focus
  dialog brings three `fill-grow` animations (birth f334).
- Screenshots: `page.screenshot({ type: "png", scale: "device", animations: "allow", caret:
  "hide" })` → 3840×2160. `animations: "disabled"` would fast-forward the arrival and is forbidden.

### 9.4 Environment clock registration (S01 ↔ DOM)
The DOM backdrop's environment time at DOM frame k is `T_env(k) = T_fake(k) − T_mount` (R3F
accumulates the frame deltas; frames are at most 50 ms apart at `DRIFT_FPS` 20). The player
pre-rolls its desktop-world environment from 0 to `T_env(150) − 5.0 s` in 0.1 s steps, then renders
S01 with `advance` steps of 1/30 s, so the Earth spin, clouds, stars and sun breathing match at the
dissolve. The S01 camera's x_orb uses the same time base. Verify (§12) by capturing DOM frame 150
with `.app-shell { visibility: hidden }` and comparing it with player frame 150.

### 9.5 Capture timeline
DOM frames f129-539 per locale (411 frames, sub-frames per §10.7):

| Frames | Action |
| --- | --- |
| 129-149 | pre-arrival hold (arrival at time 0, wordmark hidden) |
| 144 | remove the wordmark-hiding style |
| 150 | arrival time 0 |
| 240-306 | `scrollTo` 0 → max |
| 282-334 | `page.mouse.move` along the S04 cursor path; down f332, up f334 |
| 334 | focus dialog opens; adopt its animations |
| 402-421 | mouse to (300, 900); down f421 (dialog closes), up f423 |
| 427-469 | `scrollTo` max → 0 |
| 441-484 | mouse along the S06 path; down f482, up f484 (or `element.click()` fallback) |
| 484-539 | spatial dialog; wait in real time for its canvas before advancing f485 |

`T_fake(k) = T_start + round(k·100/3)` ms (33, 33, 34 ms steps). Every page interaction happens
between frames, after `runFor` and before the screenshot of the next frame.

### 9.6 Cursor overlay
Drawn by the compositor in DOM space, so it zooms with V. Arrow: a classic 12×19 CSS px pointer,
fill #f5f3f8, 1.2 px stroke #0d1017, hotspot at the tip, no shadow. Hand (over `cursor: pointer`
targets, tested with `elementFromPoint` + computed `cursor` on the live page each frame): 15×19 CSS
px, same fill and stroke, hotspot at the fingertip. Opacity fades as listed; press scale 0.92.

## 10. Film player (three.js scenes and compositor)

### 10.1 Location and stack
`promo/player/` is its own Vite root (`vite.config.ts` there, port 5174), using the repo's
installed React 19, three 0.180, @react-three/fiber 9.8.2, @react-three/xr 6.6.32 and
`@fontsource-variable/inter` / `manrope` (import them as `src/main.tsx` does). The config must
`define` `__INITIAL_DASHBOARD_DATA__` from `public/mock/dashboard-data.json` exactly like the app's
`vite.config.ts` (the store and `scenarios.ts` need it), allow `server.fs` access to the repo root,
and import from `src/` read-only. No new dependencies in the app.

### 10.2 Imported read-only
`src/spatial/SpaceEnvironment.tsx`, `SpatialSurface.tsx` (`SpatialSurface`, `SpatialWing`,
`SpatialControl`, `useBrandFontReady`), `drawPanel.ts` (`drawOverviewPanel`, `drawFocusPanel`),
`layout.ts` (`spatialStands`, `focusSurfaceHeight`, `FOCUS_ROWS`), `src/api/model.ts`
(`dashboardModel`, `colors`), `src/api/format.ts` (`formatSource`, `sourceNotice`),
`src/i18n.ts` (`setLocale`, `formatReportDate`, `t`), `src/store/dashboard.ts`
(`useDashboardStore.setState({ theme: "dark", compact: true })`), `src/assets/privatbank.svg`,
the Earth JPGs through `SpaceEnvironment`, `public/mock/dashboard-data.json`. Call
`setLocale(locale)` before the first render; preload Pryvat Sans 400/500/600/700 and Pryvat Sans
Display 500/600/700 before any texture is drawn.

### 10.3 Determinism
- The player page is 1920×1080 CSS px at deviceScaleFactor 2, with
  `<Canvas frameloop="never" dpr={2} gl={{ antialias: true, preserveDrawingBuffer: true }}>`
  filling it: the drawing buffer is 3840×2160 and the HTML overlay (titles, lockup, end card) is
  also rasterised at 2×. Capture with `page.screenshot({ scale: "device" })`.
- Advance with `advance(t)` where `t` is seconds; R3F 9.8.2 sets `delta = t − clock.elapsedTime`.
  Frame k uses t = k/30 (plus sub-frame offsets). The layer-B scene mounts at the start and is
  pre-rolled ≥ 1.5 s so its cascade has finished before f600; it is remounted (panorama → focus →
  panorama) only at f1006 and f1116.
- All randomness in the modules is seeded (the star field uses a fixed LCG); the headset geometry
  is deterministic.

### 10.4 Layers per frame
| Frames | Render |
| --- | --- |
| 0-149 | desktop-world environment with camera S01; overlay lockup; from f129 the DOM layer through V on top |
| 150-539 | DOM layer through V (full-screen quad of the 3840×2160 frame), cursor, overlay |
| 540-749 | headset world: background (environment + pane) → blur → headset (with `RT_B` portal lenses, env cube) → bloom → overlay |
| 750-1169 | layer B direct with camera B, ray and pointer; first 20 frames add the bloom tail |
| 1170-1319 | headset world without the pane, portal lenses, overlay end card |

Pane mapping check at f540: the player frame must equal the S07 composite of DOM f539 within a
mean absolute difference of 1/255 (sample at texel centres, mip level 0).

### 10.5 Depth of field
Two-layer, artefact-free: render the background (environment, pane) and the headset into separate
targets, blur each with a separable Gaussian of its own σ (values per shot above, 1080p px; double
them at 4K), composite the headset over the background with its alpha. The in-headset view
(S11-S16) has no depth of field and no post effect: it must look like the headset.

### 10.6 Pointer events in the player
The canvas receives `page.mouse` events from the render driver at the projected hit point
(camera B). Call `camera.updateMatrixWorld()` after setting the pose and before dispatching. Send a
`pointermove` every frame during S14-S15 so hover follows the head. Overlay elements carry
`pointer-events: none` so every event reaches the canvas; outside S14-S15 park the mouse at a
pixel where nothing is raycastable.

### 10.7 Motion blur by temporal supersampling
180° shutter: frame k averages N samples at `t = k/30 + ((i + 0.5)/N − 0.5)/60` s, i = 0…N−1,
accumulated in linear light in a float target, then converted to sRGB. N = 6 for 3D frames, N = 4
for DOM frames (offsets −6, −2, +2, +6 ms through `runFor`). Frames inside holds may use N = 1 when
the builder proves nothing moves. Titles are HTML above the canvas and are not blurred; the cursor
is drawn inside the accumulation.

## 11. Render and encode

### 11.1 Layout under `promo/`
```
promo/SCRIPT.md            this script
promo/README.md            builder: re-render commands, versions, licences
promo/package.json         isolated, private; devDependency ffmpeg-static@5.3.0 only
promo/.gitignore           .cache/
promo/capture/dom.mjs      DOM capture per locale → .cache/<loc>/dom/f00129.png … (+ _s0.._s3)
promo/player/              film player (Vite root) with timeline.ts holding every keyframe above
promo/render/frames.mjs    drives the player → .cache/<loc>/final/f00000.png … f01319.png
promo/render/encode.mjs    ffmpeg → promo/out/
promo/out/                 deliverables
```
`ffmpeg-static` 5.3.0 (GPL-3.0-or-later, checked with `npm view` on 18 October 2026) downloads a
binary on install; install it only with the owner's approval. There is no ffmpeg on PATH; the
Playwright ffmpeg is a VP8-only build and cannot encode H.264.

### 11.2 Order
1. Animatic: every 10th frame at 1920×1080, no motion blur, held for 10 frames → `out/animatic-uk.mp4`
   for a timing review before the full render.
2. Full render per locale: DOM capture → player frames → encode.
3. Poster, contact sheet, captions, render log.

### 11.3 Encode
```
ffmpeg -y -framerate 30 -start_number 0 -i promo/.cache/uk/final/f%05d.png \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -vf "scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -x264-params "keyint=60:min-keyint=30:scenecut=0:aq-mode=3" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 64k -shortest -movflags +faststart promo/out/orbita-promo-uk.mp4
```
Same for `en`. Before encoding, the player adds ±0.5 LSB blue-noise dither to the 8-bit output so
the dark sky gradients do not band. Target size 12-25 MB; if above 40 MB use CRF 20.

### 11.4 Deliverables
- `promo/out/orbita-promo-uk.mp4`, `promo/out/orbita-promo-en.mp4` (1920×1080, 30 fps CFR,
  1320 frames, 44.00 s).
- Poster: frame f650 (0:21.67, the visor highlight with T3) from the 4K final frame, lanczos to
  1920×1080: `promo/out/orbita-promo-uk-poster.png` and `.jpg` (quality 92); same for `en`.
- Contact sheet every 2 s: frames 0, 60, …, 1260 and 1319 (23 cells), 480×270 each, 6 × 4 grid:
  ```
  ffmpeg -i promo/out/orbita-promo-uk.mp4 -vf "select='not(mod(n\,60))+eq(n\,1319)',scale=480:270,tile=6x4:padding=8:margin=8:color=0x050a16" -frames:v 1 -fps_mode vfr promo/out/orbita-promo-uk-contact.png
  ```
- Captions: `promo/out/orbita-promo-<loc>.vtt` with T3, T4, T5 and the end-card lines at the full
  windows above.
- `promo/out/render-log-<loc>.json`: commit, `git status`, hashes of `src/` and the mock JSON,
  Chrome and GPU strings, `T_mount`, measured boxes, cut frames, fallbacks used, timings.

## 12. QA checklist (report only checks that ran)

**Truth**
- [ ] Every number on screen comes from the app (DOM capture or `dashboardModel` over the untouched
      `public/mock/dashboard-data.json`; record its SHA-256). Titles contain no figures except
      "3S" and the address.
- [ ] No «Демодані», «Демонстраційні дані», "Demo data", "live", "real time" or "online" anywhere:
      scan the visible DOM text at every captured state (skip `.sr-only`), confirm `sourceAlert`
      is null in layer B, and read every title and end-card string.
- [ ] Fresh browser context (no `orbita-demo-v1` in storage), locale and theme confirmed per master.

**Joins**
- [ ] f144 lockup handover: difference below 1/255.
- [ ] f149/150 environment registration: player vs DOM backdrop with UI hidden, PSNR ≥ 32 dB.
- [ ] f539/540 pane: difference below 1/255.
- [ ] f749/750 and f1169/1170 portal cuts: identical frames.
- [ ] No spike in the mean absolute difference between consecutive frames above 3× the local median
      except at the listed product state changes (f334, f421, f484, f1006, f1116).

**Picture**
- [ ] Legible at 1080p: title cap height ≥ 44 px; contrast of each title against the luminance
      under its box ≥ 4.5:1 on every frame of its full window.
- [ ] 390 px phone: downscale the MP4 to 390×219 and view at 100%: T3-T5, the action line and the
      address must read; product figures are not expected to. Also check landscape full screen.
- [ ] No clipped text: titles inside x 96-1824, y 54-1026; in S05 the dialog title stays in frame;
      in S15 the panel title and the period are fully visible.
- [ ] No aliasing or shimmer: ray, chart lines, meter ticks and panel text during head turns
      (mipmaps, anisotropy, 2× render); no crawling edges on the pane during S08.
- [ ] No banding in the S01 and S17 sky gradients after encoding.
- [ ] Motion: no judder in the scroll and head turns (motion blur active), no frozen frames.

**Both locales**
- [ ] `uk` and `en` have identical frame counts and cut frames; cursor targets were re-measured per
      locale; every title matches §6; EN texts in the app and textures are English.

**Determinism and file**
- [ ] Re-render f650 and f1050 and compare byte for byte.
- [ ] `ffprobe`: 1920×1080, 30/1 CFR, 1320 frames, H.264 High, yuv420p, BT.709 tags, faststart,
      size below 40 MB, audio stream silent (or absent if the owner declines it).
- [ ] Watch each master three times (story; timing; frame by frame around every cut), then side by
      side with the strongest reference and note where ours falls short.

## 13. Product defects visible in frame (fix in the app before recording)
Found on 18 October 2026 against the working tree described at the top. The film must not hide
them by faking states; fix them in the app or use the stated fallback.

| Id | Route and state | What shows | Shot | Where |
| --- | --- | --- | --- | --- |
| D1 | `/`, dark, hover on «Відкрити в просторі» / "Open in Space" (`.xr-entry`) | The filled primary button turns almost transparent on hover (background rgba(250, 249, 253, 0.13)) while its text stays #302b3b: the label nearly disappears | S06 | the fine-pointer neutral hover rule overrides the primary fill |
| D2 | `/`, dark, hover on «Recycle: 7,2%» (`.attention-items .button`) | Rest and hover render identically, contrary to `DESIGN.md` "Hover слегка осветляет поверхность"; the brief's "hover on an attention chip" reads only through the cursor | S04 | attention chip hover style |
| D3 | `/`, `en` | CTA "Open in Space" breaks the sentence-case rule ("Open in space") | S06-S07 EN | `src/i18n.ts`, «Открыть в пространстве» |
| D4 | XR focus, dashboard 10, `en` | Table headers "Plan / Threshold" and "Performance" collide with no gap; "Plan / Threshold" is horizontally squeezed by `fillText` max width 140 | S15 EN | `drawFocusPanel` header row |
| D5 | XR focus, dashboard 10, `uk` | Status words «Низький простій», «Робочий рівень», «Високий простій» are visibly condensed by `fillText` max width 150 | S15 UA | `drawFocusPanel` status column |
| D6 | XR focus, any downtime dashboard | Column header «Виконання» / "Performance" stands over status words; the DOM table says «Виконання / Статус» | S15 | `drawFocusPanel` header text |
| D7 | XR focus, dashboard 10 | The chart (480 px) is centred in an 890 px section: about 200 px of empty section above the chart and below the meters, while the key figure Recycle 7,2% is the smallest element on the panel (≈1° at 1.5 m) | S15 | `drawFocusPanel` chart placement and `drawBody` gauge scale 0.85 |
| D8 | XR panorama, panel 10 (`drawOverviewPanel` wide equipment) | Each status line («Низький простій» at y+60) sits as close to the next row's label (y+92) as to its own meter, so it reads as the caption of the next row | S14 | equipment branch of `drawOverviewPanel` |
| D9 | XR, pointing at the focus panel or its controls | The pointer dot (renderOrder 1) is drawn before the focus layer (renderOrder 10, ≈85-95% opaque) and is hidden there; the default ray stops at 1 m, so it ends 0.3-0.6 m short of targets at 1.5-1.85 m and on the focus layer the target is shown only by the lift | S15 (ray length also in S14) | `SpatialView` renderOrder vs `@pmndrs/xr` defaults (`rayModel.maxLength`, cursor renderOrder) |
| D10 | `/`, dark, 1920×1080, scrolled down | «Каси й команда» has a ≈200 px empty band between its chart and «17 вакансій»; «Платежі з початку року» ends with an empty band | S03-S04 | equal 3×3 row heights (optional) |

Not in frame but found while checking: when `sourceAlert` is shown (fallback or API error), its
line at (0, 0.91, −1.85) spans −19.1° to −21.8° from the eye and the session controls at
(0, 1.04, −1.35) span −19.4° to −25.6°, so in a headset the controls cover the notice.

## 14. Veto option: the brief's literal beat 3
If the owner prefers the overview itself to become the window: delete S06's cursor-to-CTA move and
S07; after the focus closes, scroll to the top (f427-469) and hold the overview to f480; use the
whole DOM frame f479 as the pane (no surround dissolve; the full 1.920 × 1.080 m pane at
P = (0, 1.6, −3.08), A0 = (0, 1.6, −2.27942), vfov 68°); shift every later keyframe by −60 frames;
runtime 42.0 s (1260 frames). Everything else stays.

## 15. References used
Opened in the owner's library `D:\design-kit\library\screens\09_SHOTS_LIBRARY\product\rondesignlab`
(RonDesignLab, Dribbble; private reference, not for republishing):
- SpaceX mission control 27175042, 27209445, 27360220. Take: one warm sunrise flare doing the
  drama, glass UI over the Earth, shallow focus that keeps one plane sharp. Leave: hands, phone
  mock-ups, decorative angle labels.
- Siemens industrial control 27149101. Take: one big calm figure per moment, a dark glass card in
  front of a soft background. Leave: the device frame.
- Vexto traffic 27220417. Take: a glass card floating at an angle over a terrain in depth. Leave:
  dashed routes and coloured map pins.
- Quantis health 27474777. Take: the product object at three-quarter view on a quiet background
  with light falling off its edges. Leave: the monitor, the skeleton render.
Product references: the app's own backdrop intro (view lifting from the night side to the limb),
the stands' arrival, the XR hover lift and appear cascade. No external films were watched for this
script.

## 16. Open questions for the owner
None block the script. Two facts to confirm before the render: (1) whether the uncommitted chart
and colour pass is final for the film, since every capture depends on it; (2) whether D1-D9 will
be fixed in the app first, or the film should use the D1 fallback and show D2-D9 as they are.
