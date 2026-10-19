// Pointer cursors drawn in DOM space (promo/SCRIPT.md §9.6): a classic arrow 12×19 CSS px and a
// pointing hand 15×19 CSS px, fill #f5f3f8 with a 1.2 px #0d1017 stroke, no shadow. Rasterised
// at 8× so they stay crisp at the 1.18× zoom of the 4K frame.
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from "three";

const SCALE = 8;
const FILL = "#f5f3f8";
const STROKE = "#0d1017";

function texture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx);
  // Premultiply nothing: the pane shader blends straight alpha in display space.
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.premultiplyAlpha = false;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

function arrowPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(1.0, 1.0);
  ctx.lineTo(1.0, 15.9);
  ctx.lineTo(4.6, 12.6);
  ctx.lineTo(7.0, 17.9);
  ctx.lineTo(9.3, 16.9);
  ctx.lineTo(7.0, 11.7);
  ctx.lineTo(11.3, 11.7);
  ctx.closePath();
}

function handShapes(ctx: CanvasRenderingContext2D) {
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.roundRect(x, y, w, h, r);
  };
  ctx.beginPath();
  rr(4.1, 1.0, 2.9, 10.5, 1.45); // index finger
  rr(6.9, 6.6, 2.5, 6.0, 1.25); // middle
  rr(9.3, 7.2, 2.4, 5.6, 1.2); // ring
  rr(11.6, 8.0, 2.3, 5.0, 1.15); // little
  rr(4.1, 9.2, 9.8, 8.8, 3.2); // palm
  ctx.moveTo(4.6, 15.2);
  ctx.save();
  ctx.translate(2.4, 12.6);
  ctx.rotate(-0.7);
  rr(-1.2, -3.2, 2.5, 6.0, 1.25); // thumb
  ctx.restore();
}

export function createCursor() {
  const arrow = texture(12, 19, (ctx) => {
    arrowPath(ctx);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = STROKE;
    ctx.stroke();
    ctx.fillStyle = FILL;
    ctx.fill();
  });
  const hand = texture(15, 19, (ctx) => {
    handShapes(ctx);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = STROKE;
    ctx.stroke();
    ctx.fillStyle = FILL;
    ctx.fill("nonzero");
    // Finger separations read at small sizes.
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(6.95, 9.6);
    ctx.lineTo(6.95, 12.2);
    ctx.moveTo(9.35, 9.9);
    ctx.lineTo(9.35, 12.4);
    ctx.moveTo(11.65, 10.4);
    ctx.lineTo(11.65, 12.6);
    ctx.stroke();
  });
  return {
    arrow,
    hand,
    arrowSize: [12, 19],
    handSize: [15, 19],
    arrowHot: [1.0, 1.0],
    handHot: [5.55, 1.0],
  };
}
