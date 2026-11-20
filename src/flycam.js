// First-person fly camera with two modes:
//  fly:   pointer locked, mouse looks, crosshair builds
//  build: free cursor builds, hold right mouse to look
// WASD flies along the view in both modes; Space rises, Shift descends.
import * as THREE from 'three';
import { SIZE_X, SIZE_Z, GROUND } from './world.js';

const SENS = 0.0022;
const MIN_Y = GROUND + 0.25, MAX_Y = 180, MARGIN = 150;

export function createFlycam(camera, canvas, { onMode = () => {}, onSpeed = () => {},
  bounds = () => ({ x0: 0, x1: SIZE_X, z0: 0, z1: SIZE_Z }) } = {}) {
  let mode = 'build';
  let looking = false; // right mouse held in build mode
  let speed = 14; // blocks per second
  const held = new Set();
  const vel = new THREE.Vector3();
  let dolly = 0;

  // Start outside the plot, looking at its centre.
  camera.position.set(SIZE_X / 2 + 34, GROUND + 20, SIZE_Z / 2 + 34);
  const look = new THREE.Vector3(SIZE_X / 2, GROUND, SIZE_Z / 2).sub(camera.position).normalize();
  let yaw = Math.atan2(-look.x, -look.z);
  let pitch = Math.asin(look.y);
  camera.rotation.set(pitch, yaw, 0);

  const locked = () => document.pointerLockElement === canvas;
  const lock = () => { try { const p = canvas.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch {} };
  const unlock = () => { if (locked()) document.exitPointerLock(); };

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    onMode(mode);
  }
  function toggle() {
    if (mode === 'build') lock(); // becomes 'fly' once the lock is granted
    else unlock();
  }

  document.addEventListener('pointerlockchange', () => {
    if (locked()) { if (!looking) setMode('fly'); }
    else { looking = false; setMode('build'); canvas.style.cursor = ''; }
  });

  addEventListener('mousemove', e => {
    if (!((mode === 'fly' && locked()) || looking)) return;
    yaw -= e.movementX * SENS;
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * SENS, -1.55, 1.55);
    camera.rotation.set(pitch, yaw, 0);
  });

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 2 || mode !== 'build') return;
    looking = true;
    canvas.style.cursor = 'none';
    lock();
  });
  addEventListener('pointerup', e => {
    if (e.button !== 2 || !looking) return;
    looking = false;
    canvas.style.cursor = '';
    unlock();
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (looking) { // right mouse + wheel: fly speed
      speed = THREE.MathUtils.clamp(speed * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 2, 80);
      onSpeed(Math.round(speed));
    } else {
      dolly += -Math.sign(e.deltaY) * Math.max(2, speed * 0.35);
    }
  }, { passive: false });

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') { e.preventDefault(); toggle(); return; }
    if (e.key === ' ') e.preventDefault();
    const k = e.key === ' ' ? 'space' : e.key === 'Shift' ? 'shift' : e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'space', 'shift'].includes(k)) held.add(k);
  });
  addEventListener('keyup', e => {
    const k = e.key === ' ' ? 'space' : e.key === 'Shift' ? 'shift' : e.key.toLowerCase();
    held.delete(k);
  });
  addEventListener('blur', () => held.clear());

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();
  function update(dt) {
    camera.getWorldDirection(fwd);
    right.set(-Math.cos(yaw), 0, Math.sin(yaw)).negate(); // horizontal strafe axis
    want.set(0, 0, 0);
    if (held.has('w')) want.add(fwd);
    if (held.has('s')) want.sub(fwd);
    if (held.has('d')) want.add(right);
    if (held.has('a')) want.sub(right);
    if (held.has('space')) want.y += 1;
    if (held.has('shift')) want.y -= 1;
    if (want.lengthSq()) want.normalize().multiplyScalar(speed);
    vel.lerp(want, 1 - Math.exp(-dt * 10)); // eased start and stop

    const p = camera.position;
    p.addScaledVector(vel, dt);
    if (dolly) { // wheel nudges glide out
      const d = dolly * (1 - Math.exp(-dt * 8));
      p.addScaledVector(fwd, d);
      dolly -= d;
      if (Math.abs(dolly) < 0.01) dolly = 0;
    }
    const b = bounds();
    p.x = THREE.MathUtils.clamp(p.x, b.x0 - MARGIN, b.x1 + MARGIN);
    p.z = THREE.MathUtils.clamp(p.z, b.z0 - MARGIN, b.z1 + MARGIN);
    p.y = THREE.MathUtils.clamp(p.y, MIN_Y, MAX_Y);
  }

  return {
    update,
    toggle,
    mode: () => mode,
    crosshair: () => mode === 'fly' && locked(),
  };
}
