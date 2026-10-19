// Minimal PNG reader (8-bit RGB/RGBA/gray, non-interlaced) for QA image comparisons.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export function readPng(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${file}`);
  let pos = 8;
  let width = 0,
    height = 0,
    depth = 0,
    type = 0,
    interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (${depth} bit, interlace ${interlace}): ${file}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`unsupported PNG colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * channels);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return { width, height, channels, data: out };
}

/** Mean absolute difference over RGB in [0, 255], optionally inside a rect {x, y, w, h}. */
export function mad(a, b, rect) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("size mismatch");
  const r = rect ?? { x: 0, y: 0, w: a.width, h: a.height };
  let sum = 0,
    n = 0,
    max = 0;
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(a.data[(y * a.width + x) * a.channels + c] - b.data[(y * b.width + x) * b.channels + c]);
        sum += d;
        if (d > max) max = d;
        n++;
      }
    }
  return { mad: sum / n, max };
}

export function psnr(a, b) {
  let se = 0,
    n = 0;
  for (let i = 0, j = 0; i < a.data.length && j < b.data.length; i += a.channels, j += b.channels)
    for (let c = 0; c < 3; c++) {
      const d = a.data[i + c] - b.data[j + c];
      se += d * d;
      n++;
    }
  const mse = se / n;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

/** Mean relative luminance (sRGB) inside a rect. */
export function meanLuminance(img, rect) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  let sum = 0,
    n = 0,
    max = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * img.width + x) * img.channels;
      const L = 0.2126 * lin(img.data[i]) + 0.7152 * lin(img.data[i + 1]) + 0.0722 * lin(img.data[i + 2]);
      sum += L;
      if (L > max) max = L;
      n++;
    }
  return { mean: sum / n, max };
}
