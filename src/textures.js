// Procedural, tileable textures generated at startup (no asset files needed).
import * as THREE from 'three';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable fractal value noise over u,v in [0,1).
function tileNoise(seed) {
  const r = rng(seed);
  const cache = {};
  const grid = f => cache[f] || (cache[f] = Float32Array.from({ length: f * f }, r));
  return (u, v, base = 4, oct = 5) => {
    let sum = 0, amp = 0.5, norm = 0, f = base;
    for (let o = 0; o < oct; o++) {
      const g = grid(f);
      const x = u * f, y = v * f;
      const xi = Math.floor(x), yi = Math.floor(y);
      const tx = x - xi, ty = y - yi;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const x0 = ((xi % f) + f) % f, x1 = (x0 + 1) % f, y0 = ((yi % f) + f) % f, y1 = (y0 + 1) % f;
      const a = g[y0 * f + x0], b = g[y0 * f + x1], c = g[y1 * f + x0], d = g[y1 * f + x1];
      const top = a + (b - a) * sx, bot = c + (d - c) * sx;
      sum += amp * (top + (bot - top) * sy);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = t => t * t * (3 - 2 * t);
const hex = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };

function canvasTex(size, fill, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function normalFromHeight(h, size, strength) {
  return canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const xl = (x - 1 + size) % size, xr = (x + 1) % size;
        const yu = (y - 1 + size) % size, yd = (y + 1) % size;
        const dx = (h[y * size + xr] - h[y * size + xl]) * strength;
        const dy = (h[yd * size + x] - h[yu * size + x]) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        d[i] = (-dx / len * 0.5 + 0.5) * 255;
        d[i + 1] = (dy / len * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
  }, false);
}

// Coursed stonework: rows of stones with mortar joints, bevelled edges and mottling.
export function masonry({ size = 512, rows = 4, minW = 0.22, maxW = 0.45, mortar = 4, bevel = 14,
  colors = ['#cfc6b4', '#b9ad97', '#d8d0bf'], mortarColor = '#9d958a', seed = 1, strength = 3.5 }) {
  const r = rng(seed), n = tileNoise(seed + 7), n2 = tileNoise(seed + 13);
  const rh = size / rows;
  const pal = colors.map(hex), mc = hex(mortarColor);
  const layout = [];
  for (let row = 0; row < rows; row++) {
    const ws = [];
    let tot = 0;
    while (tot < size * 0.98) { const w = lerp(minW, maxW, r()) * size; ws.push(w); tot += w; }
    const k = size / tot;
    let x = 0;
    const segs = ws.map(w => { const s = { x0: x, x1: x + w * k, c: r(), p: r(), shade: 0.88 + r() * 0.2 }; x += w * k; return s; });
    layout.push({ off: r() * size, segs });
  }
  const height = new Float32Array(size * size);
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++) {
      const row = Math.min(rows - 1, Math.floor(y / rh)), ly = y - row * rh, L = layout[row];
      for (let x = 0; x < size; x++) {
        const xs = (x - L.off + size) % size;
        let s = L.segs[L.segs.length - 1];
        for (const g of L.segs) if (xs < g.x1) { s = g; break; }
        const u = x / size, v = y / size;
        const big = n(u, v, 4, 5), fine = n2(u, v, 32, 3);
        // irregular joint width
        const jitter = (n2(u, v, 16, 2) - 0.5) * 4;
        const dEdge = Math.min(xs - s.x0, s.x1 - xs, ly, rh - ly) + jitter;
        const i = (y * size + x) * 4;
        let col, h;
        if (dEdge < mortar) {
          const m = 0.85 + fine * 0.25;
          col = mc.map(c => c * m);
          h = 0.05 + fine * 0.05;
        } else {
          const t = smooth(clamp01((dEdge - mortar) / bevel));
          const base = s.c < 0.5 ? pal[0].map((c, j) => lerp(c, pal[1][j], s.c * 2))
                                 : pal[1].map((c, j) => lerp(c, pal[2][j], (s.c - 0.5) * 2));
          const mott = (0.82 + big * 0.3) * (0.92 + fine * 0.16) * s.shade;
          const crev = 0.72 + 0.28 * t;
          col = base.map(c => c * mott * crev);
          // occasional lichen / weathering stain
          const stain = clamp01((n(u + s.p, v, 8, 3) - 0.62) * 4);
          col = col.map((c, j) => lerp(c, [120, 128, 92][j], stain * 0.35));
          h = 0.35 + 0.55 * t + (big - 0.5) * 0.35 + (fine - 0.5) * 0.12;
        }
        height[y * size + x] = h;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
  });
  return { map, normalMap: normalFromHeight(height, size, strength) };
}

export function grassTex(size = 512, seed = 3) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 5), r = rng(seed);
  const height = new Float32Array(size * size);
  const a = hex('#5b7a37'), b = hex('#8da35a'), dry = hex('#ad9f66');
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const big = n(u, v, 3, 4), fine = n2(u, v, 64, 2), spk = r();
        let col = a.map((c, j) => lerp(c, b[j], big));
        col = col.map((c, j) => lerp(c, dry[j], clamp01((n(u + 0.3, v, 6, 3) - 0.6) * 2.5) * 0.5));
        const m = 0.8 + fine * 0.35 + (spk > 0.97 ? 0.2 : spk < 0.03 ? -0.25 : 0);
        const i = (y * size + x) * 4;
        d[i] = col[0] * m; d[i + 1] = col[1] * m; d[i + 2] = col[2] * m; d[i + 3] = 255;
        height[y * size + x] = fine * 0.6 + big * 0.4;
      }
  });
  return { map, normalMap: normalFromHeight(height, size, 2.5) };
}

export function earthTex(size = 512, seed = 9, bands = true) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 2), r = rng(seed);
  const pebbles = Array.from({ length: 140 }, () => ({ x: r() * size, y: r() * size, rad: 2 + r() * 7, c: r() }));
  const height = new Float32Array(size * size);
  const dark = hex('#4a3423'), light = hex('#7a5a3c'), stone = hex('#8f8678');
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const band = bands ? 0.5 + 0.5 * Math.sin((v + n(u, v, 2, 3) * 0.15) * Math.PI * 10) : 0.35;
        const fine = n2(u, v, 48, 3);
        let col = dark.map((c, j) => lerp(c, light[j], band * 0.6 + n(u, v, 6, 4) * 0.4));
        let h = fine * 0.4;
        for (const p of pebbles) {
          const dx = Math.min(Math.abs(x - p.x), size - Math.abs(x - p.x));
          const dy = Math.min(Math.abs(y - p.y), size - Math.abs(y - p.y));
          const dd = Math.hypot(dx, dy) / p.rad;
          if (dd < 1) { const t = Math.sqrt(1 - dd * dd); col = col.map((c, j) => lerp(c, stone[j] * (0.7 + p.c * 0.5), clamp01(t * 3))); h += t * 0.8; }
        }
        const m = 0.8 + fine * 0.35;
        const i = (y * size + x) * 4;
        d[i] = col[0] * m; d[i + 1] = col[1] * m; d[i + 2] = col[2] * m; d[i + 3] = 255;
        height[y * size + x] = h;
      }
  });
  return { map, normalMap: normalFromHeight(height, size, 3) };
}

export function woodTex(size = 512, seed = 21, c0 = '#2b1a10', c1 = '#5a3a22', seams = 0) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 4);
  const height = new Float32Array(size * size);
  const a = hex(c0), b = hex(c1);
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const warp = n(u, v, 2, 4);
        const g = 0.5 + 0.5 * Math.sin((v * 40 + warp * 6) * Math.PI);
        const fine = n2(u * 0.25, v, 64, 2);
        let col = a.map((c, j) => lerp(c, b[j], g * 0.7 + fine * 0.3));
        let h = g * 0.3 + fine * 0.2;
        if (seams) { // plank joints
          const f = (v * seams) % 1;
          if (f < 0.035) { col = col.map(c => c * 0.45); h = 0; }
        }
        const i = (y * size + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        height[y * size + x] = h;
      }
  });
  return { map, normalMap: normalFromHeight(height, size, 1.5) };
}

// Grayscale low-frequency noise for breaking up tiling in world space.
export function noiseTex(size = 256, seed = 41) {
  const n = tileNoise(seed);
  return canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = n(x / size, y / size, 4, 6) * 255, i = (y * size + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
  }, false);
}

// Rippled water normal map.
export function waterNormalTex(size = 512, seed = 77) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 1);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      h[y * size + x] = n(u, v, 8, 4) * 0.7 + n2(u, v, 24, 3) * 0.3;
    }
  return normalFromHeight(h, size, 9);
}

// Alpha-cut clump of grass blades for instanced tufts.
// Tileable Voronoi stones: gravel (many small), cobbles (medium), natural rock (few large).
export function voronoiStones({ size = 512, cells = 10, gap = 0.08, colors, gapColor, seed = 1, strength = 4, rough = 0.15, warp = 0.5 }) {
  const r = rng(seed), n = tileNoise(seed + 3), n2 = tileNoise(seed + 4);
  const pts = [];
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + r() * 0.7) / cells, (j + 0.15 + r() * 0.7) / cells, r(), 0.85 + r() * 0.3]);
  const pal = colors.map(hex), gc = hex(gapColor);
  const height = new Float32Array(size * size);
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let u = x / size, v = y / size;
        const fine = n2(u, v, 48, 3);
        u += (n(u, v, 4, 3) - 0.5) * warp / cells;
        v += (n(v, u, 4, 3) - 0.5) * warp / cells;
        const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
        let f1 = 9, f2 = 9, best = null;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = ((ci + di) % cells + cells) % cells, jj = ((cj + dj) % cells + cells) % cells;
            const p = pts[jj * cells + ii];
            const px = p[0] + (ci + di - ii) / cells, py = p[1] + (cj + dj - jj) / cells;
            const dd = Math.hypot((u - px) * cells, (v - py) * cells);
            if (dd < f1) { f2 = f1; f1 = dd; best = p; } else if (dd < f2) f2 = dd;
          }
        const edge = f2 - f1;
        const i = (y * size + x) * 4;
        let col, h;
        if (edge < gap) {
          col = gc.map(c => c * (0.8 + fine * 0.4));
          h = 0.05 + fine * 0.05;
        } else {
          const t = smooth(clamp01((edge - gap) / (gap * 2 + 0.12)));
          const base = pal[Math.floor(best[2] * pal.length)];
          col = base.map(c => c * best[3] * (0.84 + fine * 0.3) * (0.72 + 0.28 * t));
          h = 0.3 + 0.6 * t + (fine - 0.5) * rough;
        }
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        height[y * size + x] = h;
      }
  });
  return { map, normalMap: normalFromHeight(height, size, strength) };
}

// Fine sand with wind ripples.
export function sandTex(size = 512, seed = 101) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 1), r = rng(seed);
  const height = new Float32Array(size * size);
  const a = hex('#c7b088'), b = hex('#dccaa0');
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const big = n(u, v, 3, 4), grain = n2(u, v, 128, 2), spk = r();
        const ripple = 0.5 + 0.5 * Math.sin((v * 22 + n(u, v, 2, 3) * 3) * Math.PI * 2);
        const m = (0.9 + grain * 0.18) * (0.96 + ripple * 0.06) * (spk > 0.985 ? 0.75 : 1);
        const col = a.map((c, j) => lerp(c, b[j], big) * m);
        const i = (y * size + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        height[y * size + x] = ripple * 0.35 + grain * 0.25;
      }
  });
  return { map, normalMap: normalFromHeight(height, size, 2) };
}

// Lime plaster / render: soft mottling, hairline cracks.
export function plasterTex(size = 256, seed = 61) {
  const n = tileNoise(seed), n2 = tileNoise(seed + 3), n3 = tileNoise(seed + 9);
  const height = new Float32Array(size * size);
  const a = hex('#d8cdb6'), b = hex('#eee6d2');
  const map = canvasTex(size, d => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const big = n(u, v, 3, 4), fine = n2(u, v, 64, 3);
        const crack = Math.abs(n3(u, v, 6, 3) - 0.5) < 0.006 ? 0.65 : 1;
        const col = a.map((c, j) => lerp(c, b[j], big * 0.8) * (0.93 + fine * 0.14) * crack);
        const i = (y * size + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        height[y * size + x] = fine * 0.5 + big * 0.5 - (crack < 1 ? 0.3 : 0);
      }
  });
  return { map, normalMap: normalFromHeight(height, size, 1.6) };
}

export function bladeTex(seed = 5) {
  const r = rng(seed), size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = size * (0.1 + r() * 0.8), h = size * (0.45 + r() * 0.55), w = 3 + r() * 5;
    const bend = (r() - 0.5) * size * 0.25;
    const g = ctx.createLinearGradient(0, size, 0, size - h);
    const tone = 0.8 + r() * 0.4;
    g.addColorStop(0, `rgb(${40 * tone},${70 * tone},${22 * tone})`);
    g.addColorStop(1, `rgb(${150 * tone},${185 * tone},${80 * tone})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, size);
    ctx.quadraticCurveTo(x - w * 0.5 + bend * 0.5, size - h * 0.6, x + bend, size - h);
    ctx.quadraticCurveTo(x + w * 0.5 + bend * 0.5, size - h * 0.6, x + w, size);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
