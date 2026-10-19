# Orbita promo film

A 47-second launch film for Orbita built from the real product: the app is captured frame by frame,
the in-headset view is the app's own XR scene, and the headset is a procedural, logo-free model.
`BRIEF.md` is the art-director brief, `SCRIPT.md` the shooting script; this file is the builder's
record. **The English master is the final one** (owner's decision, 19 October 2026). The Ukrainian
files in `out/` are older drafts (earlier timeline, previous track, address on the end card); the
pipeline renders Ukrainian the same way with `--locale uk`.

## Deliverables (`promo/out/`)

| File | What |
| --- | --- |
| `orbita-promo-en.mp4` | 1920×1080, 30 fps CFR, 1410 frames (47.0 s), H.264 High 4.1, yuv420p, BT.709, faststart; AAC LC 48 kHz stereo ≈192 kbps; 26.2 MB |
| `orbita-promo-en-poster.png` / `.jpg` | frame 740 (0:24.67): the headset with "Now in Meta Quest 3S", from the 4K frame |
| `orbita-promo-en-contact.png` | contact sheet, one cell every 2 s (frames 0, 60 … 1380, 1409) |
| `orbita-promo-en.vtt` | captions for the three titles and the end card |
| `render-log-en.json` | commit, tree state, GPU, capture measurements, timings, loudness |
| `qa/qa-en.json`, `qa/phone-en.png` | automatic QA results and a 390 px phone strip |

## Re-render

Requirements: Windows with system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`
and a GPU (ANGLE D3D11; software WebGL is refused), Node ≥ 22, the repo's own `node_modules`
(Playwright 1.64, three, React, R3F, Vite). Once: `npm --prefix promo install` (only
`ffmpeg-static`, which downloads its ffmpeg binary).

```
npm --prefix promo run render -- --locale en   # the final master, from the committed HEAD
node promo/render/qa.mjs --locale en --determinism
```

`render` exports the committed HEAD (`git archive`) into `promo/.cache/snapshot`, builds the app
and the film player from it (uncommitted edits never reach the film), serves them on
127.0.0.1:5175 and :5176, captures the DOM, renders every frame, mixes the music and encodes;
about 11 minutes on an RTX 4060. Stage flags: `--skip-build`, `--skip-capture`, `--skip-frames`,
`--skip-encode`. Nothing outside `promo/` is written and the dev server on :5173 is not touched.

## Timeline (film frames at 30 fps)

| Frames | Time | Shot |
| --- | --- | --- |
| 0-149 | 0:00-0:05 | Cold open: the app's long-lens backdrop camera lifts 4.5° from the night side to its pose; lockup in the sky above the limb, match-moved onto the header wordmark; dissolve into the app f129-147 |
| 150-469 | 0:05-0:15.6 | Overview arrives, scroll, «Recycle: 7.2%», focus "Equipment status", close, back to the top |
| 441-560 | 0:14.7-0:18.7 | **Light/dark beat:** the cursor clicks the theme toggle; the overview turns to the day side on the music's drop (f480, held-frame dissolve 0.5 s, the app's CSS cross-fade eased 0.2 s → 0.5 s); held about 2.4 s with a slow push |
| 530-629 | 0:17.7-0:21.0 | «Open in space» (f553) opens the preview in the light environment; «Dark environment» (f600) brings back the night on the next downbeat; push into the 3D view |
| 630-839 | 0:21-0:28 | The window floats over the night Earth, the headset glides in (T3 f720-804), into the lens; lens bloom on the downbeat at f839 |
| 840-1259 | 0:28-0:42 | First person in the headset: T4, cash, equipment, T5, ray, panel 10 rises, focus panel, «Panorama» |
| 1260-1409 | 0:42-0:47 | Out through the lens, end card: lockup, "Open in Meta Quest Browser", "Payments, cash desks and equipment in one space" |

From the floating window on, every shot keeps the script's numbering: film frame = script frame +
90 (`XR_SHIFT` in `timeline.mjs`).

## How it is built

- `capture/dom.mjs` - the app's production build in system Chrome at 1920×1080, DPR 2:
  Playwright's clock drives rAF and timers, every CSS animation and transition is paused and seeked
  through the Web Animations API, scroll and the real mouse are set per sub-frame, the product
  reacts with its own hover, focus, theme and dialogs. Frames 129-629, four sub-frames
  (−6, −2, +2, +6 ms) where anything moves. Measurements (wordmark box and styles, chip, CTA, theme
  toggle and «Dark environment» centres, dialog rect, backdrop camera and Earth clock read through
  three's devtools hook) go to `capture.json`.
- `player/` - a Vite root importing the product read-only (`SpaceEnvironment`, `SpatialSurface`,
  `SpatialWing`, `SpatialControl`, `drawPanel`, `layout`, `dashboardModel`, store, i18n, fonts,
  the PrivatBank SVG). One R3F canvas with `frameloop="never"` stepped by a fixed clock; every
  frame averages 4 (DOM, cold open) or 6 (3D) shutter samples in linear light; layers render into
  float targets that encode exactly like the canvas, so the product's colours are unchanged. The
  DOM frames are a 1.92 × 1.08 m pane in the same 3D world (1 CSS px = 1 mm), so the window floats
  off the screen pixel-exactly. Titles and lockups are HTML above the canvas.
- `render/frames.mjs` drives the player (real mouse for the in-headset hover and select), takes
  lossless 4K screenshots and downscales them with lanczos; `render/encode.mjs` encodes (x264 CRF
  18), mixes the soundtrack, writes poster, contact sheet, captions and log; `timeline.mjs` holds
  every keyframe.

## Music

«Future Design» by penguinmusic, Pixabay Content License (`music/LICENSE.md`): free use, no
attribution required, modification allowed; not to be sold or distributed as a standalone music
file. The page marks it Content ID registered (a YouTube upload may get a claim that can be
cleared). Optional credit: "Music by penguinmusic from Pixabay".

Cut: film t = track t − 2.443 s (the first 2.4 s of the intro beat are skipped). Onset check
(`node render/music.mjs`, spectral flux and band energy, 120.25 BPM): the drop's first bass hit at
18.44 s lands on the night-to-day flip (f480); the two-bar downbeats (3.99 s apart) fall on the
return to night (f600), the headset reveal (f719) and the lens bloom (f839), and within four
frames of the head turn to equipment (f963) and the «Panorama» press (f1202); the breakdown
(45.28 s) opens under the pull-out, so the end card rides into it. The brief asked for the drop on the headset reveal: with
the light/dark beat the reveal sits at 24 s, which the drop at 18.4 s cannot reach without silence
before the music or a re-edited track, so the drop takes the theme flip and the reveal takes the
second downbeat. Mix: fade in 0.3 s, fade out over the last 2.5 s, two-pass EBU R128 loudnorm,
measured −13.9 LUFS integrated, true peak −2.0 dBTP, AAC 48 kHz. A silent copy costs nothing:
`ffmpeg -i out/orbita-promo-en.mp4 -an -c copy orbita-promo-en-silent.mp4`.

## Deviations from SCRIPT.md (and why)

1. **Light/dark beat and +3 s** (owner): inserted after the return to the overview; everything
   after the spatial preview shifts by 90 frames; runtime 47.0 s (1410 frames).
2. **End card line** (owner): "Payments, cash desks and equipment in one space" replaces the
   address, in the address's style and position; the address appears nowhere in the film or captions.
3. **Long lenses** (owner): the planet must read as a sphere. The cold open uses the app's own new
   backdrop camera (read from the capture, so the dissolve stays registered); the DOM pane is
   modelled with a 30° lens, so the window's float-off is a pure dolly back (30° → 34°) instead of
   a 68° → 34° zoom; the end card is on a 30° lens pulled back to 0.83 m. The headset view keeps 52°.
4. **Head pitch +1.5°** in the headset (not −2°): the session pills «Recenter space» / «End XR
   session» sit at the bottom edge, slightly cropped, labels readable (they are real session UI).
   The head dips to −2° after the select and to −5° for «Panorama», as scripted.
5. **Capture source.** A production build of the committed HEAD (the script's §9.1 fallback), not
   the dev server.
6. **Closing the focus.** The product's dialog dismisses on the click (release): the cursor
   reaches the overlay at f418, presses at f419, releases at f421; the dissolve is unchanged.
7. **S04-S05 framing.** V tilts up 40 px while the cursor reaches the chip and presses (f316-334),
   so the focus dialog's title is in frame from its first frame.
8. **Headset light and look.** The scripted lights alone left the graphite headset a black
   silhouette. Added: a soft cool key area light from the camera side, the Earth's blue bounce at
   1.4, a cool rim light from behind on the far side (the atmosphere) for a readable silhouette
   against the Earth, a stronger warm sun (4.2), and a reflection rig seen only by the visor's cube
   camera (the sun as a corona, the sunrise glow along the horizon, the limb as a thin band). The
   satin visor (clearcoat roughness 0.13) carries a warm sunrise sweep and the blue limb. The strap
   is thinner (2.0 cm), darker and shorter, the loop raised so it reads as a strap.
9. **What the lenses show.** Each lens shows its display from a distance (the wearer's view,
   95° wide: the three stands) and narrows to exactly the aperture's see-through view as the
   camera arrives (an off-axis frustum through the aperture), then hands over to the screen-space
   portal the cut needs; reversed on the way out. Both cuts stay frame-identical.
10. **Lens effects fade** (0.97 transmission, edge darkening, Fresnel tint) before each cut.
11. **Bloom** thresholds HDR at 1.0 (only the sun's core blooms; at 0.85 UI text glowed); the lens
    keeps HDR so the bloom is continuous across the cut.
12. **Ray and cursor** use the app's current `SPATIAL_RAY` (3 m, opacity 0.5, 5 cm cursor at 0.85,
    render order 30/31). After the select the ray slides straight down past the disabled «Next →»,
    moves left only while it hits nothing, then rises onto «Panorama»; after that click it drops
    below the stands. Pointer events start only when the ray appears.
13. **Earth clocks.** The cold open is registered to the app's backdrop (PSNR 48 dB at f150); the
    headset world sets the Earth's spin to the app's mount pose at script f900.
14. **Curves and samples.** Dolly keys start and land with zero slope; held-frame dissolves end on
    their last listed frame; 4 samples per DOM and cold-open frame, 6 per 3D frame, 1 for still DOM
    frames. The session-only controls have no-op handlers (never pressed).

## QA that ran (EN master, `qa/qa-en.json`)

- No «Демодані» / "Demo data" / "live" / "real time" / "online" or the address in the visible DOM
  text at f149, 200, 300, 380, 470, 520, 580, 629, in the titles or in the end card; every figure
  comes from the app capture or `dashboardModel` over the untouched mock.
- Joins: lockup handover f146/147 mean abs. difference 0.38/255; pane f629/630 0.05/255;
  out-of-lens cut f1259/1260 0.19/255; into-lens cut f839/840 3.1/255 (the motion between two
  frames; no frame-difference spike); frame-difference spikes only at designed changes.
- Title contrast against the background under each title: 12.7-17.7:1; end card lines 13:1 and 7:1.
- Determinism: f1140 re-renders byte-identical; f740 differs by 0.008/255 when reached by skipping
  frames (the visor's per-frame environment map); a continuous re-render is identical.
- File: 1410 frames, 47.00 s, H.264 High, yuv420p, BT.709 tags, faststart, 26.2 MB; −13.9 LUFS,
  −2.0 dBTP.

## Found in the product while building

- `SpaceEnvironment` star breathing and cloud morphing never run: R3F 9.8 copies each
  ShaderMaterial uniform when applying the `uniforms` prop, so `starUniforms.time` and
  `cloudUniforms.time` increment objects the materials no longer read (the cloud deck still rotates,
  the sun still breathes). The film shows the product as it is.

## Asset licences

- Product UI, data, textures and code: this repository (captured and imported read-only).
- Pryvat Sans / Pryvat Sans Display (`public/fonts`): «Exclusively for JSC CB PRIVATBANK»; this
  film is a PrivatBank internal communication.
- Earth photographs inside `SpaceEnvironment`: NASA Blue Marble / Black Marble, public domain.
- XR ray and cursor materials: `@pmndrs/xr` 6.6.32 (MIT-style licence, Bela Bohlender), as the app
  uses them.
- Headset: procedural three.js geometry written for this film (`player/src/headset.ts`), generic,
  no logos, wordmarks, sensor patterns or copies of Meta renders.
- Music: see above. ffmpeg: `ffmpeg-static` 5.3.0 (GPL-3.0-or-later), binary ffmpeg 6.1.1
  essentials build by gyan.dev (GPL v3), used as a tool only.
