// Voxel storage + chunked meshing. Only chunks touched by an edit rebuild.
// Storage is on a sub-grid: one full block = SUB x SUB x SUB sub-cells (quarter steps).
// Chunks are stored sparsely, so the plot can be expanded without paying for empty sky.
// Auto-shaping (battlements, rounded corners) is applied at mesh time and never changes stored data.
import * as THREE from 'three';

export const SUB = 4;
export const CHUNK = 32;              // sub-cells per chunk edge
export const CB = CHUNK / SUB;        // blocks per chunk edge (8)
export const SIZE_X = 64, SIZE_Y = 48, SIZE_Z = 64; // starting plot, in blocks
export const NY = SIZE_Y * SUB;       // height in sub-cells (fixed)
export const CY = NY / CHUNK;         // chunk layers
export const MAX_PLOT = 256;          // largest plot edge, in blocks
export const GROUND = 4;              // blocks of diggable earth under the grass

export const AIR = 0, STONE = 1, EARTH = 2, WATER = 3, DARK = 4, BRICK = 5, TIMBER = 6, PLASTER = 7, ROOF = 8;
// Land & water
export const DIRT = 9, SAND = 10, GRAVEL = 11, COBBLE = 12, ROCK = 13, MOAT = 14;
export const isWater = t => t === WATER || t === MOAT;

// Material slots: [side, top] per voxel type. Order must match scene.js.
// 0/1 light stone, 2/3 earth + grass, 4 water, 5/6 dark stone, 7/8 brick, 9/10 timber, 11/12 plaster, 13/14 roof,
// 15 dirt, 16 sand, 17 gravel, 18 cobble, 19 rock, 20 moat water
const LAND_SLOT = { [DIRT]: 15, [SAND]: 16, [GRAVEL]: 17, [COBBLE]: 18, [ROCK]: 19, [MOAT]: 20 };
const SIDE_SLOT = { [STONE]: 0, [EARTH]: 2, [WATER]: 4, [DARK]: 5, [BRICK]: 7, [TIMBER]: 9, [PLASTER]: 11, [ROOF]: 13, ...LAND_SLOT };
const TOP_SLOT = { [STONE]: 1, [EARTH]: 3, [WATER]: 4, [DARK]: 6, [BRICK]: 8, [TIMBER]: 10, [PLASTER]: 12, [ROOF]: 14, ...LAND_SLOT };
const SLOTS = 21;
const WATER_DROP = 0.12; // blocks the water surface sits below the cell top

// Which materials take which auto-shape rule.
const CRENEL = new Uint8Array(16); [STONE, DARK, BRICK].forEach(t => (CRENEL[t] = 1));
const ROUNDABLE = new Uint8Array(16); [STONE, DARK, BRICK, PLASTER].forEach(t => (ROUNDABLE[t] = 1));
const SHAPE_REACH = 8; // how far (sub-cells) an edit can change the shaping of a neighbour

const FACES = [
  { n: [1, 0, 0], v: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], v: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0, 1, 0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1], v: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0, 0, -1], v: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
const TANGENTS = [[1, 2], [0, 2], [0, 2]].map((_, a) => [0, 1, 2].filter(i => i !== a));

const C2 = CHUNK * CHUNK, C3 = C2 * CHUNK;
const ckey = (cx, cy, cz) => ((cx + 4096) * 8192 + (cz + 4096)) * 8 + cy;
const lidx = (x, y, z) => (x & 31) + ((z & 31) << 5) + ((y & 31) << 10);

const opaque = t => t !== AIR && !isWater(t);
const isBuild = t => t === STONE || (t >= DARK && t <= ROOF); // castle materials, not land

function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function groundChunk() {
  const a = new Uint8Array(C3);
  a.fill(EARTH, 0, GROUND * SUB * C2); // y-major: bottom layers are contiguous
  return a;
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.cells = new Map();   // chunk key -> Uint8Array(C3)
    this.chunks = new Map();  // chunk key -> mesh
    this.onChange = null;     // (lo, hi) in sub-cells after an edit
    this.onBounds = null;     // () after the plot grows
    this.autoShape = true;
    this.setBounds({ x0: 0, x1: SIZE_X / CB, z0: 0, z1: SIZE_Z / CB });
    this.fillGround();
  }

  // Plot bounds are kept in chunks; sx0..sx1 / sz0..sz1 are the same in sub-cells (exclusive max).
  setBounds(b) {
    this.bounds = { ...b };
    this.sx0 = b.x0 * CHUNK; this.sx1 = b.x1 * CHUNK;
    this.sz0 = b.z0 * CHUNK; this.sz1 = b.z1 * CHUNK;
  }
  blockBounds() {
    const b = this.bounds;
    return { x0: b.x0 * CB, x1: b.x1 * CB, z0: b.z0 * CB, z1: b.z1 * CB };
  }

  fillGround() {
    this.cells.clear();
    this._k = -1;
    const b = this.bounds;
    for (let cz = b.z0; cz < b.z1; cz++)
      for (let cx = b.x0; cx < b.x1; cx++) this.cells.set(ckey(cx, 0, cz), groundChunk());
  }

  // Clear the plot back to grass (keeps its size).
  reset() {
    this.fillGround();
    this.buildAll();
    if (this.onChange) this.onChange([this.sx0, 0, this.sz0], [this.sx1 - 1, NY - 1, this.sz1 - 1]);
  }

  // Grow the plot by one chunk (8 blocks) on one side: 'n' (-z), 's' (+z), 'e' (+x), 'w' (-x).
  expand(side) {
    const b = { ...this.bounds };
    const maxC = MAX_PLOT / CB;
    if ((side === 'e' || side === 'w') && b.x1 - b.x0 >= maxC) return false;
    if ((side === 'n' || side === 's') && b.z1 - b.z0 >= maxC) return false;
    if (side === 'e') b.x1++; else if (side === 'w') b.x0--; else if (side === 's') b.z1++; else if (side === 'n') b.z0--;
    // New strip of chunk columns, plus the old edge strip (its outer faces are now hidden).
    let strip;
    if (side === 'e') strip = { x0: b.x1 - 2, x1: b.x1, z0: b.z0, z1: b.z1 };
    if (side === 'w') strip = { x0: b.x0, x1: b.x0 + 2, z0: b.z0, z1: b.z1 };
    if (side === 's') strip = { x0: b.x0, x1: b.x1, z0: b.z1 - 2, z1: b.z1 };
    if (side === 'n') strip = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + 2 };
    this.setBounds(b);
    this._k = -1;
    for (let cz = strip.z0; cz < strip.z1; cz++)
      for (let cx = strip.x0; cx < strip.x1; cx++) {
        const k = ckey(cx, 0, cz);
        if (!this.cells.has(k)) this.cells.set(k, groundChunk());
      }
    for (let cz = strip.z0; cz < strip.z1; cz++)
      for (let cx = strip.x0; cx < strip.x1; cx++)
        for (let cy = 0; cy < CY; cy++) this.buildChunk(cx, cy, cz);
    if (this.onBounds) this.onBounds();
    return true;
  }

  inBounds(x, y, z) {
    return y >= 0 && y < NY && x >= this.sx0 && x < this.sx1 && z >= this.sz0 && z < this.sz1;
  }
  get(x, y, z) {
    if (y < 0 || y >= NY || x < this.sx0 || x >= this.sx1 || z < this.sz0 || z >= this.sz1) return AIR;
    const k = ckey(x >> 5, y >> 5, z >> 5);
    if (k !== this._k) { this._k = k; this._a = this.cells.get(k); }
    return this._a ? this._a[lidx(x, y, z)] : AIR;
  }
  set(x, y, z, v) {
    if (!this.inBounds(x, y, z)) return;
    const k = ckey(x >> 5, y >> 5, z >> 5);
    let a = this.cells.get(k);
    if (!a) {
      if (!v) return;
      a = new Uint8Array(C3);
      this.cells.set(k, a);
      this._k = -1;
    }
    a[lidx(x, y, z)] = v;
  }

  setAutoShape(on) {
    this.autoShape = on;
    this.buildAll();
  }

  // Inclusive box in sub-cell coordinates. onlySolid: repaint existing cells only (Paint tool).
  fillBox(min, max, v, onlySolid = false) {
    const lo = [0, 0, 0], hi = [0, 0, 0];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(min[i], max[i]); hi[i] = Math.max(min[i], max[i]); }
    lo[0] = Math.max(lo[0], this.sx0); hi[0] = Math.min(hi[0], this.sx1 - 1);
    lo[1] = Math.max(lo[1], 0); hi[1] = Math.min(hi[1], NY - 1);
    lo[2] = Math.max(lo[2], this.sz0); hi[2] = Math.min(hi[2], this.sz1 - 1);
    if (lo[0] > hi[0] || lo[1] > hi[1] || lo[2] > hi[2]) return;
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++)
        for (let x = lo[0]; x <= hi[0]; x++) if (!onlySolid || this.get(x, y, z)) this.set(x, y, z, v);
    const c0 = lo.map(c => Math.floor((c - SHAPE_REACH) / CHUNK));
    const c1 = hi.map(c => Math.floor((c + SHAPE_REACH) / CHUNK));
    const b = this.bounds;
    for (let cy = Math.max(0, c0[1]); cy <= Math.min(CY - 1, c1[1]); cy++)
      for (let cz = Math.max(b.z0, c0[2]); cz <= Math.min(b.z1 - 1, c1[2]); cz++)
        for (let cx = Math.max(b.x0, c0[0]); cx <= Math.min(b.x1 - 1, c1[0]); cx++) this.buildChunk(cx, cy, cz);
    if (this.onChange) this.onChange(lo, hi);
  }

  buildAll() {
    const b = this.bounds;
    for (const [k, mesh] of this.chunks) { // drop meshes outside the plot
      const cy = k % 8, rest = (k - cy) / 8, cz = (rest % 8192) - 4096, cx = Math.floor(rest / 8192) - 4096;
      if (cx < b.x0 || cx >= b.x1 || cz < b.z0 || cz >= b.z1) { this.scene.remove(mesh); mesh.geometry.dispose(); this.chunks.delete(k); }
    }
    for (let cy = 0; cy < CY; cy++)
      for (let cz = b.z0; cz < b.z1; cz++)
        for (let cx = b.x0; cx < b.x1; cx++) this.buildChunk(cx, cy, cz);
  }

  // Should this stored cell be hidden by an auto-shape rule?
  carved(x, y, z, t) {
    const lx = x & 3, ly = y & 3, lz = z & 3;

    // Rounded convex corners: trim 3 of the 16 columns in an outside corner of a block -> quarter circle.
    if (ROUNDABLE[t]) {
      const sx = lx >= 2 ? 1 : -1, sz = lz >= 2 ? 1 : -1;
      const mx = sx > 0 ? lx : 3 - lx, mz = sz > 0 ? lz : 3 - lz;
      if (mx + mz >= 5) {
        const xn = x - lx + (sx > 0 ? 4 : -1), zn = z - lz + (sz > 0 ? 4 : -1);
        if (!opaque(this.get(xn, y, z)) && !opaque(this.get(x, y, zn)) && !opaque(this.get(xn, y, zn))) return true;
      }
    }

    // Battlements: on the rim of a wall top (wall >= 2 blocks tall), every other block loses its upper half.
    if (CRENEL[t] && ly >= 2) {
      const bx = x >> 2, bz = z >> 2;
      if (((bx + bz) & 1) === 0) {
        const yb = (y >> 2) << 2;
        if (isBuild(this.get(x, yb + 3, z)) && this.get(x, yb + 4, z) === AIR && isBuild(this.get(x, yb - 1, z))) {
          const x0 = bx << 2, z0 = bz << 2, yt = yb + 3;
          if (!opaque(this.get(x0 + 4, yt, z)) || !opaque(this.get(x0 - 1, yt, z)) ||
              !opaque(this.get(x, yt, z0 + 4)) || !opaque(this.get(x, yt, z0 - 1))) return true;
        }
      }
    }
    return false;
  }

  buildChunk(cx, cy, cz) {
    const key = ckey(cx, cy, cz);
    let mesh = this.chunks.get(key);
    const drop = () => { if (mesh) { this.scene.remove(mesh); mesh.geometry.dispose(); this.chunks.delete(key); } };
    if (!this.cells.has(key)) return drop(); // faces belong to solid cells, so an empty chunk draws nothing

    const pos = [], nor = [], col = [], uv = [];
    const idx = Array.from({ length: SLOTS }, () => []);
    const c = new THREE.Color();
    const inv = 1 / SUB;

    // Effective (shaped) voxels for this chunk plus a 1-cell border.
    const P = CHUNK + 2;
    const ox = cx * CHUNK - 1, oy = cy * CHUNK - 1, oz = cz * CHUNK - 1;
    const eff = new Uint8Array(P * P * P);
    for (let ly = 0; ly < P; ly++)
      for (let lz = 0; lz < P; lz++)
        for (let lx = 0; lx < P; lx++) {
          const x = ox + lx, y = oy + ly, z = oz + lz;
          let t = this.get(x, y, z);
          if (t && this.autoShape && (CRENEL[t] || ROUNDABLE[t]) && this.carved(x, y, z, t)) t = AIR;
          eff[lx + P * (lz + P * ly)] = t;
        }
    const g = (x, y, z) => {
      const lx = x - ox, ly = y - oy, lz = z - oz;
      if (lx < 0 || ly < 0 || lz < 0 || lx >= P || ly >= P || lz >= P) return AIR;
      return eff[lx + P * (lz + P * ly)];
    };
    const visible = (wet, nt) => (wet ? nt === AIR : !opaque(nt));

    // A face can merge with its 4x4 patch (one block face) when every sub-face is the same material,
    // visible, and unshadowed by ambient occlusion. Big flat ground and walls collapse 16:1.
    const tryPatch = (x, y, z, f, t, wet) => {
      const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
      const [ta, tb] = TANGENTS[axis];
      const p = [x, y, z];
      for (let j = -1; j <= 4; j++)
        for (let i = -1; i <= 4; i++) {
          const q = p.slice(); q[ta] += i; q[tb] += j;
          const inside = i >= 0 && i < 4 && j >= 0 && j < 4;
          if (inside && g(q[0], q[1], q[2]) !== t) return false;
          const nt = g(q[0] + f.n[0], q[1] + f.n[1], q[2] + f.n[2]);
          if (inside ? !visible(wet, nt) : !wet && opaque(nt)) return false;
        }
      return true;
    };

    const done = new Uint8Array(C3); // bit per face direction: already covered by a merged quad
    const emit = (x, y, z, f, t, slot, scale, wet, lowerTop, tint) => {
      const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
      const [ta, tb] = TANGENTS[axis];
      const s = [1, 1, 1]; s[ta] = scale; s[tb] = scale;
      const base = pos.length / 3;
      for (const v of f.v) {
        const wx = (x + v[0] * s[0]) * inv, wz = (z + v[2] * s[2]) * inv;
        const wy = (y + v[1] * s[1]) * inv - (lowerTop && v[1] === 1 ? WATER_DROP : 0);
        pos.push(wx, wy, wz);
        nor.push(f.n[0], f.n[1], f.n[2]);
        if (axis === 0) uv.push(wz, wy);
        else if (axis === 1) uv.push(wx, wz);
        else uv.push(wx, wy);
        const ao = wet || scale > 1 ? 0 : this.vertexAO(g, x, y, z, f.n, v);
        c.setScalar(tint * (1 - ao * 0.38));
        col.push(c.r, c.g, c.b);
      }
      idx[slot].push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let z = cz * CHUNK; z < (cz + 1) * CHUNK; z++)
        for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
          const t = g(x, y, z);
          if (!t) continue;
          const wet = isWater(t);
          const tint = wet ? 1 : 0.95 + hash(x >> 2, y >> 2, z >> 2) * 0.06;
          const lowerTop = wet && !isWater(g(x, y + 1, z));
          const li = lidx(x, y, z);
          for (let fi = 0; fi < 6; fi++) {
            if (done[li] & (1 << fi)) continue;
            const f = FACES[fi];
            if (!visible(wet, g(x + f.n[0], y + f.n[1], z + f.n[2]))) continue;
            const isTop = f.n[1] === 1;
            const slot = isTop ? TOP_SLOT[t] : SIDE_SLOT[t];
            const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
            const [ta, tb] = TANGENTS[axis];
            const p = [x, y, z];
            if ((p[ta] & 3) === 0 && (p[tb] & 3) === 0 && (!wet || isTop) && tryPatch(x, y, z, f, t, wet)) {
              for (let j = 0; j < 4; j++)
                for (let i = 0; i < 4; i++) {
                  const q = p.slice(); q[ta] += i; q[tb] += j;
                  done[lidx(q[0], q[1], q[2])] |= 1 << fi;
                }
              emit(x, y, z, f, t, slot, 4, wet, lowerTop, tint);
            } else {
              emit(x, y, z, f, t, slot, 1, wet, lowerTop, tint);
            }
          }
        }

    if (!pos.length) return drop();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const all = [];
    idx.forEach((list, slot) => {
      if (list.length) geo.addGroup(all.length, list.length, slot);
      for (const i of list) all.push(i);
    });
    geo.setIndex(all);
    geo.computeBoundingSphere();
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = geo; }
    else {
      mesh = new THREE.Mesh(geo, this.materials);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.chunks.set(key, mesh);
    }
  }

  vertexAO(g, x, y, z, n, v) {
    const axis = n[0] ? 0 : n[1] ? 1 : 2;
    const t = TANGENTS[axis];
    const p = [x + n[0], y + n[1], z + n[2]];
    const s = t.map(a => (v[a] ? 1 : -1));
    const at = (da, db) => {
      const q = p.slice(); q[t[0]] += da; q[t[1]] += db; return opaque(g(q[0], q[1], q[2])) ? 1 : 0;
    };
    const a = at(s[0], 0), b = at(0, s[1]), cc = at(s[0], s[1]);
    return a && b ? 1 : (a + b + cc) / 3;
  }

  // Load a pre-expansion flat save (256 x 192 x 256 sub-cells at the origin).
  loadFlat(flat, nx, ny, nz) {
    this.setBounds({ x0: 0, x1: nx / CHUNK, z0: 0, z1: nz / CHUNK });
    this.cells.clear();
    this._k = -1;
    for (let y = 0; y < ny; y++)
      for (let z = 0; z < nz; z++) {
        const row = nx * (z + nz * y);
        for (let x = 0; x < nx; x++) { const v = flat[row + x]; if (v) this.set(x, y, z, v); }
      }
  }

  meshes() { return [...this.chunks.values()]; }
}

export { ckey };
