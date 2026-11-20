import * as THREE from 'three';
import { World, SUB, NY, GROUND, STONE, DARK, BRICK, TIMBER, PLASTER, ROOF, EARTH, WATER,
  DIRT, SAND, GRAVEL, COBBLE, ROCK, MOAT, isWater } from './world.js';
import { createScene } from './scene.js';
import { createHud } from './hud.js';
import { saveWorld, loadWorld } from './save.js';
import { createFlycam } from './flycam.js';

// ---------- scene + world ----------
const { renderer, scene, camera, blockMaterials, render, updateGrass, setPlot, toggleTilt, setOnFrame } = createScene();
const canvas = renderer.domElement;
const world = new World(scene, blockMaterials);
world.onChange = (lo, hi) => { updateGrass(world, lo, hi); queueSave(); };
loadWorld(world);
world.buildAll();
setPlot(world);
world.onBounds = () => { setPlot(world); queueSave(); hud.flash(plotLabel()); };

// Live plot limits per axis, in sub-cells (inclusive).
const axisLo = a => (a === 0 ? world.sx0 : a === 1 ? 0 : world.sz0);
const axisHi = a => (a === 0 ? world.sx1 : a === 1 ? NY : world.sz1) - 1;
const axisLen = a => axisHi(a) - axisLo(a) + 1;
function plotLabel() {
  const b = world.blockBounds();
  return `Plot ${b.x1 - b.x0} × ${b.z1 - b.z0}`;
}

// ---------- autosave ----------
let saveTimer = null;
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => hud.saved(saveWorld(world)), 900);
}

// ---------- HUD ----------
// Material chips show a crop of the material's real texture.
function thumb(slot, fallback) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 100;
  const ctx = cv.getContext('2d');
  const img = blockMaterials[slot].map?.image;
  if (img) {
    ctx.drawImage(img, 0, 0, img.width / 4, img.height / 4, 0, 0, 100, 100);
  } else {
    const g = ctx.createLinearGradient(0, 0, 100, 100);
    g.addColorStop(0, fallback[0]); g.addColorStop(1, fallback[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    for (let y = 18; y < 100; y += 20) {
      ctx.beginPath();
      for (let x = 0; x <= 100; x += 5) ctx.lineTo(x, y + Math.sin(x * 0.12 + y) * 3);
      ctx.stroke();
    }
  }
  return cv.toDataURL();
}

const MATERIALS = [
  { id: STONE, name: 'Light Stone', key: 1, slot: 0, group: 'castle' },
  { id: DARK, name: 'Dark Stone', key: 2, slot: 5, group: 'castle' },
  { id: BRICK, name: 'Brick', key: 3, slot: 7, group: 'castle' },
  { id: TIMBER, name: 'Timber', key: 4, slot: 9, group: 'castle' },
  { id: PLASTER, name: 'Plaster', key: 5, slot: 11, group: 'castle' },
  { id: ROOF, name: 'Roof Tile', key: 6, slot: 13, group: 'castle' },
  { id: EARTH, name: 'Grass', key: 1, slot: 3, group: 'land' },
  { id: DIRT, name: 'Dirt', key: 2, slot: 15, group: 'land' },
  { id: SAND, name: 'Sand', key: 3, slot: 16, group: 'land' },
  { id: GRAVEL, name: 'Gravel', key: 4, slot: 17, group: 'land' },
  { id: COBBLE, name: 'Cobblestone', key: 5, slot: 18, group: 'land' },
  { id: ROCK, name: 'Rock', key: 6, slot: 19, group: 'land' },
  { id: WATER, name: 'Lake Water', key: 7, slot: 4, group: 'land', fallback: ['#2f6f7c', '#173f49'] },
  { id: MOAT, name: 'Moat Water', key: 8, slot: 20, group: 'land', fallback: ['#4f5c36', '#222b18'] },
].map(m => ({ ...m, thumb: thumb(m.slot, m.fallback) }));
const keyFor = (group, key) => MATERIALS.find(m => m.group === group && String(m.key) === key)?.id;

const STEPS = [
  { value: SUB, label: '1', name: 'Full block', key: 'Z' },
  { value: SUB / 2, label: '½', name: 'Half block', key: 'X' },
  { value: 1, label: '¼', name: 'Quarter block', key: 'C' },
];

let currentMat = STONE;
let step = SUB;
const hud = createHud({
  materials: MATERIALS,
  steps: STEPS,
  onMat: setMat,
  onStep: setStep,
  onShape: toggleShape,
  onGroup: setGroup,
  onExpand: side => { if (!world.expand(side)) hud.flash('Plot is at its largest'); },
  onPaint: paint,
  onClear: () => { sel = null; showSelection(); showGhost(0); world.reset(); },
});

const fly = createFlycam(camera, canvas, {
  bounds: () => world.blockBounds(),
  onMode: m => { hud.setMode(m); if (m === 'build') canvas.style.cursor = 'crosshair'; },
  onSpeed: s => hud.flash(`Fly speed ${s}`),
});

let group = 'castle';
function setGroup(g) { group = g; hud.setGroup(g); }
function setMat(m) {
  currentMat = m;
  const g = MATERIALS.find(x => x.id === m).group;
  if (g !== group) setGroup(g);
  hud.setMat(m);
}
function setStep(s) { step = s; hud.setStep(s); showSelection(); }
function toggleShape() { world.setAutoShape(!world.autoShape); hud.setShape(world.autoShape); }

const FRACTIONS = { 0: '', 1: '¼', 2: '½', 3: '¾' };
function fmtBlocks(sub) {
  const a = Math.abs(sub), whole = Math.floor(a / SUB), frac = FRACTIONS[a % SUB];
  return (whole || !frac ? String(whole) : '') + frac;
}

// ---------- selection overlays ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function overlay(fill, edge, opacity) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity, depthWrite: false }));
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: edge })));
  m.visible = false;
  scene.add(m);
  return m;
}
const selMesh = overlay('#e8c27a', '#a8823e', 0.4);
const ghost = overlay('#7ad36b', '#2e6b25', 0.35);

// sel: { axis, dir, layer (sub index of the solid cell on the selected face), a0,a1,b0,b1 raw tangent cells }
let sel = null;
let mode = null; // 'select' | 'pull'
let dragStart = 0;
let pullAmount = 0;
let pullOrigin = null;
const tagAnchor = new THREE.Vector3();

// In fly mode the crosshair (screen centre) is the cursor.
function setMouse(e) {
  if (fly.crosshair() || !e) mouse.set(0, 0);
  else {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  }
  camera.updateMatrixWorld();
  raycaster.setFromCamera(mouse, camera);
}

function pick() {
  const hits = raycaster.intersectObjects(world.meshes(), false);
  if (!hits.length) return null;
  const h = hits[0];
  const n = h.face.normal;
  const nn = [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
  const cell = [0, 1, 2].map(i => Math.floor(h.point.getComponent(i) * SUB - nn[i] * 0.5));
  return { cell, normal: nn };
}

const tangents = axis => [0, 1, 2].filter(a => a !== axis);
const snap = v => Math.floor(v / step) * step;

function planeCell(s) {
  const n = new THREE.Vector3(); n.setComponent(s.axis, 1);
  const faceCoord = (s.layer + (s.dir > 0 ? 1 : 0)) / SUB;
  const plane = new THREE.Plane(n, -faceCoord);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return null;
  return tangents(s.axis).map(a => Math.floor(p.getComponent(a) * SUB));
}

function ranges() {
  const [ta, tb] = tangents(sel.axis);
  const r = (a, b, ax) => {
    const lo = snap(Math.min(a, b)), hi = snap(Math.max(a, b)) + step - 1;
    return [Math.max(axisLo(ax), lo), Math.min(axisHi(ax), hi)];
  };
  return { ta, tb, A: r(sel.a0, sel.a1, ta), B: r(sel.b0, sel.b1, tb) };
}

function boxFor(fromLayer, toLayer) {
  const { ta, tb, A, B } = ranges();
  const min = [0, 0, 0], max = [0, 0, 0];
  min[ta] = A[0]; max[ta] = A[1];
  min[tb] = B[0]; max[tb] = B[1];
  min[sel.axis] = Math.min(fromLayer, toLayer); max[sel.axis] = Math.max(fromLayer, toLayer);
  return { min, max };
}

function placeBoxMesh(mesh, min, max, pad = 0) {
  mesh.scale.set(...[0, 1, 2].map(i => (max[i] - min[i] + 1) / SUB + pad * 2));
  mesh.position.set(...[0, 1, 2].map(i => (min[i] + max[i] + 1) / 2 / SUB));
}

function dimText() {
  const { A, B } = ranges();
  return `${fmtBlocks(A[1] - A[0] + 1)} × ${fmtBlocks(B[1] - B[0] + 1)}`;
}

function showSelection() {
  if (!sel) { selMesh.visible = false; hud.tag(null); return; }
  const { min, max } = boxFor(sel.layer, sel.layer);
  placeBoxMesh(selMesh, min, max, 0.005);
  selMesh.scale.setComponent(sel.axis, 0.06);
  selMesh.position.setComponent(sel.axis, (sel.layer + (sel.dir > 0 ? 1 : 0)) / SUB + sel.dir * 0.03);
  selMesh.visible = true;
  tagAnchor.copy(selMesh.position);
  hud.tag(dimText());
}

function rangeFor(amount) {
  if (amount > 0) return [sel.layer + sel.dir, sel.layer + sel.dir * amount];
  return [sel.layer, sel.layer + sel.dir * (amount + 1)];
}

function showGhost(amount) {
  if (!amount || !sel) { ghost.visible = false; if (sel) { tagAnchor.copy(selMesh.position); hud.tag(dimText()); } return; }
  const [f, t] = rangeFor(amount);
  const { min, max } = boxFor(f, t);
  placeBoxMesh(ghost, min, max, 0.004);
  const up = amount > 0;
  ghost.material.color.set(up ? (isWater(currentMat) ? '#5ab4e6' : '#7ad36b') : '#e2685a');
  ghost.children[0].material.color.set(up ? '#2e6b25' : '#8b2a20');
  ghost.visible = true;
  // Tag rides on the far face of the ghost.
  tagAnchor.copy(ghost.position);
  if (up) tagAnchor.setComponent(sel.axis, ghost.position.getComponent(sel.axis) + sel.dir * ghost.scale.getComponent(sel.axis) / 2);
  hud.tag(dimText(), (up ? '+' : '−') + fmtBlocks(amount), !up);
}

function clampBox(min, max) {
  for (let i = 0; i < 3; i++) {
    min[i] = Math.max(axisLo(i), min[i]); max[i] = Math.min(axisHi(i), max[i]);
    if (min[i] > max[i]) return false;
  }
  return true;
}

function apply(amount) {
  if (!sel || !amount) return;
  const [f, t] = rangeFor(amount);
  const { min, max } = boxFor(f, t);
  if (!clampBox(min, max)) return;
  world.fillBox(min, max, amount > 0 ? currentMat : 0);
  hud.dismissHint();
  sel.layer += sel.dir * amount;
  if (sel.layer < axisLo(sel.axis) - 1 || sel.layer > axisHi(sel.axis)) sel = null;
  showSelection();
}

// Paint: re-material the selected surface layer (one step deep). Never adds or removes blocks.
function paint() {
  if (!sel) return;
  const { min, max } = boxFor(sel.layer, sel.layer - sel.dir * (step - 1));
  if (!clampBox(min, max)) return;
  world.fillBox(min, max, currentMat, true);
  hud.dismissHint();
}

function onSelection() {
  if (!sel) return false;
  const c = planeCell(sel);
  if (!c) return false;
  const { A, B } = ranges();
  return c[0] >= A[0] && c[0] <= A[1] && c[1] >= B[0] && c[1] <= B[1];
}

function pullParam() {
  const n = new THREE.Vector3(); n.setComponent(sel.axis, sel.dir);
  const O = raycaster.ray.origin, d = raycaster.ray.direction;
  const w = pullOrigin.clone().sub(O);
  const b = n.dot(d), dn = n.dot(w), e = d.dot(w);
  const denom = 1 - b * b;
  if (denom < 1e-4) return 0;
  return (b * e - dn) / denom;
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  setMouse(e);
  if (onSelection()) {
    mode = 'pull';
    pullOrigin = selMesh.getWorldPosition(new THREE.Vector3());
    dragStart = pullParam();
    pullAmount = 0;
  } else {
    const hit = pick();
    if (!hit) { sel = null; showSelection(); return; }
    const axis = hit.normal.findIndex(v => v !== 0);
    const [ta, tb] = tangents(axis);
    sel = { axis, dir: hit.normal[axis], layer: hit.cell[axis],
            a0: hit.cell[ta], a1: hit.cell[ta], b0: hit.cell[tb], b1: hit.cell[tb] };
    mode = 'select';
    showSelection();
  }
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});

function dragUpdate() {
  if (mode === 'select' && sel) {
    const c = planeCell(sel);
    if (!c) return;
    sel.a1 = c[0]; sel.b1 = c[1];
    showSelection();
  } else if (mode === 'pull') {
    let amt = Math.round(((pullParam() - dragStart) * SUB) / step) * step;
    amt = Math.max(-axisLen(sel.axis), Math.min(axisLen(sel.axis), amt));
    if (amt !== pullAmount) { pullAmount = amt; showGhost(amt); }
  }
}

canvas.addEventListener('pointermove', e => {
  setMouse(e);
  if (mode) dragUpdate();
  else if (fly.mode() === 'build' && canvas.style.cursor !== 'none') canvas.style.cursor = onSelection() ? 'ns-resize' : 'crosshair';
});

canvas.addEventListener('pointerup', e => {
  if (e.button !== 0) return;
  if (mode === 'pull') { apply(pullAmount); pullAmount = 0; showGhost(0); }
  mode = null;
});

addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (hud.controlsOpen()) hud.toggleControls(false);
    else { sel = null; showSelection(); showGhost(0); }
    return;
  }
  if (k === '?' || k === 'f1') { e.preventDefault(); hud.toggleControls(); return; }
  if (k === 'h') return hud.toggleHidden();
  if (k === 'e') apply(step);
  else if (k === 'q') apply(-step);
  else if (k === 't') toggleTilt();
  else if (k === 'z') setStep(SUB);
  else if (k === 'x') setStep(SUB / 2);
  else if (k === 'c') setStep(1);
  else if (k === 'b') toggleShape();
  else if (k === 'f') paint();
  else if (k === 'v') setGroup(group === 'castle' ? 'land' : 'castle');
  else if (keyFor(group, k)) setMat(keyFor(group, k));
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Keep the selection tag pinned to its spot in the world.
const proj = new THREE.Vector3();
function placeTag() {
  if (!hud.tagVisible()) return;
  proj.copy(tagAnchor).project(camera);
  hud.placeTag((proj.x * 0.5 + 0.5) * innerWidth, (-proj.y * 0.5 + 0.5) * innerHeight);
}

setGroup(group);
setMat(STONE);
setStep(SUB);
hud.setShape(world.autoShape);
hud.ready();
setOnFrame(dt => {
  fly.update(dt);
  // Flying while dragging with the crosshair keeps the selection / pull live.
  if (mode && fly.crosshair()) { setMouse(); dragUpdate(); }
});
// Expand handles: a + marker just outside the middle of each plot edge (Build mode only).
const edgePt = new THREE.Vector3();
function placeEdges() {
  const show = fly.mode() === 'build';
  const b = world.blockBounds(), mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
  const pts = { n: [mx, b.z0 - 1.5], s: [mx, b.z1 + 1.5], e: [b.x1 + 1.5, mz], w: [b.x0 - 1.5, mz] };
  for (const side in pts) {
    edgePt.set(pts[side][0], GROUND - 0.5, pts[side][1]).project(camera);
    const onScreen = show && edgePt.z < 1 && Math.abs(edgePt.x) < 1.1 && Math.abs(edgePt.y) < 1.1;
    hud.placeEdge(side, (edgePt.x * 0.5 + 0.5) * innerWidth, (-edgePt.y * 0.5 + 0.5) * innerHeight, onScreen);
  }
}

hud.setMode(fly.mode());
renderer.setAnimationLoop(() => { render(); placeTag(); placeEdges(); });
