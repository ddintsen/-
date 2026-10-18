/** Three simultaneous stands on a 1.85 m arc; side stands turn 24° toward the viewer. */
const radius = 1.85;
const side = (42 * Math.PI) / 180;
const angle = (24 * Math.PI) / 180;
const half = (id: number, x: number, y: number) => ({
  id,
  x,
  y,
  width: 0.58,
  height: 0.3625,
  wide: false,
});
const wide = (id: number, y: number) => ({
  id,
  x: 0,
  y,
  width: 1.2,
  height: 0.375,
  wide: true,
});
export const spatialStands = [
  {
    key: "cash",
    title: "Кассовые операции",
    x: -radius * Math.sin(side),
    z: -radius * Math.cos(side),
    angle,
    panels: [wide(5, 0.16), half(6, -0.31, -0.235), half(7, 0.31, -0.235)],
  },
  {
    key: "payments",
    title: "Платежи",
    x: 0,
    z: -radius,
    angle: 0,
    panels: [
      half(1, -0.31, 0.16),
      half(2, 0.31, 0.16),
      half(3, -0.31, -0.235),
      half(4, 0.31, -0.235),
    ],
  },
  {
    key: "equipment",
    title: "Оборудование",
    x: radius * Math.sin(side),
    z: -radius * Math.cos(side),
    angle: -angle,
    panels: [half(8, -0.31, 0.16), half(9, 0.31, 0.16), wide(10, -0.235)],
  },
];
export const FOCUS_ROWS = 24;
export const focusTextureHeight = (count: number) =>
  Math.max(900, 240 + Math.min(FOCUS_ROWS, count) * 42);
export const focusSurfaceHeight = (count: number) =>
  (2.04 * focusTextureHeight(count)) / 2048;
