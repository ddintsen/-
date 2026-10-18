# Charts and colour · Орбіта

Date: 2026-10-18. Owner's words: «пусть подберет графики и цвета, мне кажется можно красивее сделать», «мне тёмно-коричневый не нравится», about the attention chips: «и тут еле видно».
Method: the `dataviz` skill (form → colour job → validator → mark specs) inside the product rules of `product-interface-design`. References: the owner's Rondesignlab shots (SpaceX mission control, Siemens, StreamLogic, Vexto incident response, Quantis, Credit Karma, Lendora): calm grounds, white figures, colour only on marks that mean something, thin precise marks.

## What was wrong (audit, before)

- **Brown and maroon text.** Light theme: every below-85% plan figure in `#63290a`, danger figures in `#70122c`, success in near-black teal `#063f32`, and the vacancy figure in brown. Warning fills `#d97706` were 2.6:1 on the light glass (marks need 3:1).
- **Fades into the dark.** The monthly columns faded to 35% alpha, so the peach series (`#efba94`) turned into brown over navy; in the light theme the series stayed dark-theme pastels (1.4:1).
- **Status used as identity.** Dashboard 10 drew the TSO line in success green right above TSO's downtime meter; Dashboard 5 coloured operation types green / yellow / red / purple (from the SPEC sample), so «Зняття готівки» wore the danger token and yellow sat at 1.2:1 on the light glass.
- **A sea of amber.** Seven YTD meters (76–84%) were painted as warnings although YTD has no monthly pacing contract and is deliberately excluded from attention zones.
- **Marks.** Dashed gridlines, a 0.5px outline around January bars, round feet on columns, a 1px sparkline, a non-round middle tick (846), dots of 2.8px, a donut track in the border colour.
- **Chips.** Translucent pills on the sky, 12px text: barely visible, same at rest and on hover.
- **Validator, old dark series** (`#91dbef,#c0adff,#efba94`): FAIL lightness band (L 0.79–0.85 against 0.48–0.67) and chroma floor (C 0.08); old light set FAIL contrast (1.4:1).

## Principle

Cool data, warm attention. Identity hues come from the night side and its atmosphere; warmth is the sunrise and means state. Figures are ink, colour lives in marks. Neutral things (tracks, grid, targets, rings) are hairlines of the surface.

## Palette (DESIGN.md tokens; every key has a `light-*` twin for DOM and XR)

| Role | Token | Dark | Light |
|---|---|---|---|
| Series 1 · atmosphere | `series-1` | `#2c99f8` | `#1848a6` |
| Series 2 · aurora | `series-2` | `#8d57d6` | `#8a5ad6` |
| Series 3 · sea | `series-3` | `#00aba2` | `#017e9a` |
| Series 4 · rose (4th part only) | `series-4` | `#d04a6d` | `#a01560` |
| Previous period (January) | `series-muted` | `#6b7a93` | `#76849b` |
| Success | `success` | `#56d57b` | `#047a3c` |
| Warning · sunrise | `warning` | `#f9b73f` | `#bf4a00` |
| Danger · flare | `danger` | `#f66c6d` | `#c51b32` |
| Neutral meter (85–95%, YTD) | `meter-neutral` | `#b8cde4` | `#4c759f` |
| Text tones | `success-text` / `warning-text` / `danger-text` | `#72e096` / `#ffc861` / `#ff8f8f` | `#036c36` / `#b03a02` / `#b3122f` |
| Track / grid / marker / ring | `chart-track` / `chart-grid` / `chart-marker` / `chart-ring` | white 12% / 7.5% / `rgba(236,241,248,.78)` / night 92% | ink 10% / 8% / ink 72% / white 95% |

Validator (`dataviz/scripts/validate_palette.js`, surfaces sampled from the real glass: dark `#1a2338`, light `#dbe8f5`):
- Dark, adjacent: ALL PASS · worst CVD ΔE 8.2 (aqua↔rose, deutan) · normal 17.8 · all ≥3:1. All-pairs of the first three (lines may cross): PASS · CVD 8.9 · normal 15.4. Donut ring incl. rose↔blue: PASS.
- Light, adjacent: ALL PASS · worst CVD 9.5 (sea↔aurora, deutan) · normal 18.5 · all ≥3:1 (3.7–6.7). All-pairs first three: PASS · normal 16.0. Donut ring: PASS.
- WCAG for status and text (light glass / light modal): success 4.4/4.5, warning 4.0/4.1, danger 4.7/4.9 as marks; text tones 4.9–5.7. Dark: every mark and text tone ≥5.4 on the section, danger ≥4.2 on the brightest atmosphere glow. Labels inside the columns: white on dark tints 4.8–6.9, ink on light tints 6.4–7.7.
- Caveat: the light backdrop is live (clouds, day side). Over the darkest cloud patch (`#c1cbca`) violet/sea series and the light neutral drop to 2.7–2.9:1; every such mark has a visible value label (relief rule), and text tones stay ≥3.7.

## Decisions per dashboard

1. **Платежі за каналами.** Emphasis pair instead of two purples: reporting month in series 1, January in `series-muted`; square feet, 4px rounded ends, no outlines; only a baseline (every bar is labelled, so gridlines added nothing). ДБО ring: 10px track, series 1 arc with round ends trimmed so they do not overstate 81.5%.
2–3. **Кількість / Обсяг.** Vertical glass columns kept (≤48px): tinted body (series at 62%→16% dark, 42%→10% light), a 3px lit cap at the data end, ink label inside, square foot, dashed 100% threshold drawn over the columns. Sparklines: 1.6px non-scaling line with a ringed latest point; deltas in muted ink, not series colour. «Разом» keeps the same series and adds a 12% wash.
4, 6. **З початку року.** Neutral meters (no monthly pacing contract), success from 95%. Figures ink.
5. **Операції в касах.** Operation types take series 1–4 in API order, 2px surface gaps instead of outlines, legend swatches in the same themed colour. The monthly plan meter is neutral at 85–95%.
7. **Каси й команда.** Single line in series 1, 2px, soft gradient wash, ringed end point, clean 1-2-5 ticks (0 / 1 тис. / 2 тис.). Vacancies keep their state colour (the only state channel there): warning mark colour on the large figure, danger text above 20.
8–9. **Пристрої.** Current month: success / neutral / warning by plan band; YTD neutral below 95%.
10. **Стан обладнання.** Lines take identity hues (TSO blue, ATM violet, Recycle sea) with line-key legend; downtime meters keep success / warning / danger on the neutral 0–10% track with the 2px SLA 5% marker separated by a surface ring. Only the over-SLA figure wears colour.
- **Meters everywhere:** 6px track (8px in focus), solid fill of real length, 2px target centred on its value, `data-tone` keeps the business band, `data-meter-tone` carries the colour role.
- **Attention chips:** 40px pills, 13px semibold ink, opaque glass (86% white light, 13% ink dark), a quiet brighten on hover inside `(hover: hover) and (pointer: fine)`, global focus ring kept. A state dot appears when the chip has `data-tone` (needs one attribute in `App.tsx`, see below).
- **Settings inline warning:** a tinted wash with readable text instead of orange text.

## Contracts kept

Vertical monthly columns; plan vs downtime encodings; real downtime length on a neutral track with SLA 5%; no 100%-filled bars; YTD outside attention zones (now also outside warning colour); 3×3 rows; no numbering, frames, dividers or uppercase; tabular figures; ≥11px text; data, units and strings unchanged; `plan-bars svg rect` count stays 3.

## Open items

- `App.tsx` (not in this pass): add `data-tone={item.kind === "downtime" ? "danger" : "warning"}` to the attention `Button` to switch on the state dot.
- XR (`drawPanel.ts`, main session): use `meterToneColors[meterTone(model, i)]` for meter fills (YTD and 85–95% neutral), `seriesColors[0]` / `colors["series-muted"]` for channel bars instead of `colors.purple`, ink for figures except `danger-text`, and the `chart-*` tokens for track, grid, marker and ring.
- API contract: `types[].color` of Dashboard 5 is now a hint used only past the fourth type; worth a line in API_CONTRACT.md.
- `orange`, `cyan`, `purple` legacy tokens remain for compatibility; no chart reads them any more except XR until the item above lands.
