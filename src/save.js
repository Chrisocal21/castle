// Autosave: sparse chunks, each run-length encoded, packed into one base64 string in localStorage.
// v2 stores plot bounds + chunks. v1 (one flat 256x192x256 grid) is migrated on load.
import { CHUNK, ckey } from './world.js';

const KEY = 'castle.save.v1'; // same slot; the payload carries its own version

function rle(data, out) {
  const n = data.length;
  let i = 0;
  while (i < n) {
    const v = data[i];
    let j = i + 1;
    while (j < n && data[j] === v) j++;
    out.push(v);
    varint(out, j - i);
    i = j;
  }
}
function unrle(bytes, p, end, target) {
  let o = 0;
  while (p < end && o < target.length) {
    const v = bytes[p++];
    const r = readVarint(bytes, p); p = r.p;
    target.fill(v, o, o + r.v);
    o += r.v;
  }
  return o === target.length;
}
function varint(out, c) {
  while (c >= 128) { out.push((c & 127) | 128); c = Math.floor(c / 128); }
  out.push(c);
}
function readVarint(bytes, p) {
  let v = 0, mul = 1, b;
  do { b = bytes[p++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
  return { v, p };
}
const zig = n => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzig = n => (n & 1 ? -(n + 1) / 2 : n / 2);

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function saveWorld(world) {
  try {
    const out = [];
    const b = world.bounds;
    [b.x0, b.x1, b.z0, b.z1].forEach(v => varint(out, zig(v)));
    const list = [];
    for (const [k, a] of world.cells) if (a.some(v => v)) list.push([k, a]);
    varint(out, list.length);
    for (const [k, a] of list) {
      const cy = k % 8, rest = (k - cy) / 8, cz = (rest % 8192) - 4096, cx = Math.floor(rest / 8192) - 4096;
      varint(out, zig(cx)); varint(out, cy); varint(out, zig(cz));
      const body = [];
      rle(a, body);
      varint(out, body.length);
      for (const v of body) out.push(v);
    }
    localStorage.setItem(KEY, JSON.stringify({ v: 2, data: toB64(Uint8Array.from(out)) }));
    return true;
  } catch {
    return false;
  }
}

export function loadWorld(world) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const bytes = fromB64(s.data);
    if (s.v === 1) { // flat grid from before the plot could expand
      const [nx, ny, nz] = s.dims;
      if (nx % CHUNK || nz % CHUNK) return false;
      const flat = new Uint8Array(nx * ny * nz);
      if (!unrle(bytes, 0, bytes.length, flat)) return false;
      world.loadFlat(flat, nx, ny, nz);
      return true;
    }
    if (s.v !== 2) return false;
    let p = 0;
    const rd = () => { const r = readVarint(bytes, p); p = r.p; return r.v; };
    const bounds = { x0: unzig(rd()), x1: unzig(rd()), z0: unzig(rd()), z1: unzig(rd()) };
    const count = rd();
    const cells = new Map();
    for (let i = 0; i < count; i++) {
      const cx = unzig(rd()), cy = rd(), cz = unzig(rd());
      const len = rd();
      const a = new Uint8Array(CHUNK * CHUNK * CHUNK);
      if (!unrle(bytes, p, p + len, a)) return false;
      p += len;
      cells.set(ckey(cx, cy, cz), a);
    }
    world.setBounds(bounds);
    world.cells = cells;
    world._k = -1;
    return true;
  } catch {
    return false;
  }
}
