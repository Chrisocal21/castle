// Rendering: sky + IBL, sun shadows, island in a lake, wind-blown grass, post-processing.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { masonry, grassTex, earthTex, bladeTex, noiseTex, waterNormalTex, plasterTex, woodTex, voronoiStones, sandTex } from './textures.js';
import { SIZE_X, SIZE_Z, GROUND, EARTH, AIR, SUB } from './world.js';

const LAKE_LEVEL = GROUND - 0.7;

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c7d3da', 220, 900);

  // First-person camera; movement and look live in flycam.js.
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 4000);
  camera.rotation.order = 'YXZ';

  // ---- sky + image based lighting ----
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(215));
  const makeSky = () => {
    const s = new Sky();
    s.scale.setScalar(10000);
    const u = s.material.uniforms;
    u.turbidity.value = 3.5; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.88;
    u.sunPosition.value.copy(sunDir);
    return s;
  };
  scene.add(makeSky());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.9;

  const sun = new THREE.DirectionalLight('#fff3e3', 2.4);
  const center = new THREE.Vector3(SIZE_X / 2, GROUND, SIZE_Z / 2);
  sun.position.copy(center).addScaledVector(sunDir, 130);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 280 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#d6e4ff', '#6b6a4a', 0.45));

  // ---- world-space weathering: breaks texture repetition, adds grime + rain streaks ----
  const macro = noiseTex();
  function weather(mat, { amount = 0.22, scale = 1 / 22, grime = 0, streaks = 0 } = {}) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uMacro = { value: macro };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uMacro;\nvarying vec3 vWPos;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float m1 = texture2D(uMacro, vWPos.xz * ${scale.toFixed(4)} + vec2(vWPos.y * 0.017)).r;
          float m2 = texture2D(uMacro, vec2((vWPos.x + vWPos.z) * 0.11, vWPos.y * 0.012)).r;
          diffuseColor.rgb *= mix(${(1 - amount).toFixed(3)}, ${(1 + amount * 0.6).toFixed(3)}, m1);
          diffuseColor.rgb *= 1.0 - ${streaks.toFixed(3)} * smoothstep(0.5, 0.75, m2) * (0.6 + 0.4 * m1);
          float gr = ${grime.toFixed(3)} * (1.0 - smoothstep(${GROUND.toFixed(1)}, ${(GROUND + 2.2).toFixed(1)}, vWPos.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.6, 0.45), gr);`);
    };
    return mat;
  }
  const tiled = (tex, span) => { const t = tex.clone(); t.repeat.set(1 / span, 1 / span); t.needsUpdate = true; return t; };

  // ---- materials (slots match world.js) ----
  const wall = masonry({ size: 1024, rows: 6, minW: 0.11, maxW: 0.22, mortar: 5, bevel: 18, seed: 11,
    colors: ['#b9b2a4', '#a49b8b', '#c6bfb0'], mortarColor: '#8e877c', strength: 4 });
  const flag = masonry({ size: 1024, rows: 5, minW: 0.14, maxW: 0.3, mortar: 4, bevel: 10, seed: 29,
    colors: ['#aaa496', '#9a9384', '#b5ae9f'], mortarColor: '#7f786d', strength: 3 });
  const grass = grassTex(1024);
  const earth = earthTex();
  const waterNormal = waterNormalTex();

  const stoneWall = weather(new THREE.MeshStandardMaterial({
    map: tiled(wall.map, 4), normalMap: tiled(wall.normalMap, 4), normalScale: new THREE.Vector2(1.3, 1.3),
    vertexColors: true, roughness: 0.9 }), { amount: 0.28, grime: 0.7, streaks: 0.22 });
  const stoneTop = weather(new THREE.MeshStandardMaterial({
    map: tiled(flag.map, 4), normalMap: tiled(flag.normalMap, 4), vertexColors: true, roughness: 0.88 }), { amount: 0.25 });
  const earthSide = weather(new THREE.MeshStandardMaterial({
    map: tiled(earth.map, 5), normalMap: tiled(earth.normalMap, 5), vertexColors: true, roughness: 1 }), { amount: 0.2 });
  const grassTop = weather(new THREE.MeshStandardMaterial({
    map: tiled(grass.map, 8), normalMap: tiled(grass.normalMap, 8), vertexColors: true, roughness: 0.95 }), { amount: 0.35, scale: 1 / 30 });

  const waterTime = { value: 0 };
  function makeWater(span, color = '#1f4d55', opacity = 0.78) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: 0.04, metalness: 0.1, transparent: true, opacity,
      normalMap: tiled(waterNormal, span), normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false,
    });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = waterTime;
      sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace(
        'texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0',
        `normalize(
          (texture2D( normalMap, vNormalMapUv + vec2(uTime * 0.012, uTime * 0.007) ).xyz * 2.0 - 1.0) +
          (texture2D( normalMap, vNormalMapUv * 1.7 + vec2(-uTime * 0.009, uTime * 0.013) ).xyz * 2.0 - 1.0))`);
    };
    return m;
  }
  const waterMat = makeWater(6);

  // Dark stone: heavier, cooler blocks.
  const darkW = masonry({ size: 1024, rows: 6, minW: 0.11, maxW: 0.22, mortar: 5, bevel: 18, seed: 51,
    colors: ['#6d6b6a', '#5a5859', '#7a7877'], mortarColor: '#444242', strength: 4 });
  const darkT = masonry({ size: 512, rows: 5, minW: 0.14, maxW: 0.3, mortar: 4, bevel: 10, seed: 63,
    colors: ['#656362', '#565455', '#727070'], mortarColor: '#3d3b3b', strength: 3 });
  const darkWall = weather(new THREE.MeshStandardMaterial({
    map: tiled(darkW.map, 4), normalMap: tiled(darkW.normalMap, 4), vertexColors: true, roughness: 0.9 }),
    { amount: 0.25, grime: 0.7, streaks: 0.25 });
  const darkTop = weather(new THREE.MeshStandardMaterial({
    map: tiled(darkT.map, 4), normalMap: tiled(darkT.normalMap, 4), vertexColors: true, roughness: 0.88 }), { amount: 0.22 });

  // Brick: small, regular courses.
  const brickT = masonry({ size: 512, rows: 16, minW: 0.115, maxW: 0.115, mortar: 2, bevel: 4, seed: 71,
    colors: ['#9c4b36', '#873e2d', '#ab5a40'], mortarColor: '#b4ab9b', strength: 4 });
  const brick = weather(new THREE.MeshStandardMaterial({
    map: tiled(brickT.map, 4), normalMap: tiled(brickT.normalMap, 4), vertexColors: true, roughness: 0.85 }),
    { amount: 0.2, grime: 0.55, streaks: 0.15 });

  // Timber: horizontal planks.
  const oak = woodTex(512, 83, '#5f4125', '#a67c4d', 8);
  const timber = weather(new THREE.MeshStandardMaterial({
    map: tiled(oak.map, 4), normalMap: tiled(oak.normalMap, 4), vertexColors: true, roughness: 0.7 }), { amount: 0.15, grime: 0.3 });

  // Plaster: pale lime render.
  const lime = plasterTex();
  const plaster = weather(new THREE.MeshStandardMaterial({
    map: tiled(lime.map, 4), normalMap: tiled(lime.normalMap, 4), vertexColors: true, roughness: 0.95 }),
    { amount: 0.12, grime: 0.6, streaks: 0.25 });

  // Roof tile: terracotta courses.
  const tileT = masonry({ size: 512, rows: 14, minW: 0.08, maxW: 0.08, mortar: 2, bevel: 7, seed: 91,
    colors: ['#a2532f', '#8c4527', '#b5623a'], mortarColor: '#5b2c1a', strength: 6 });
  const roof = weather(new THREE.MeshStandardMaterial({
    map: tiled(tileT.map, 4), normalMap: tiled(tileT.normalMap, 4), vertexColors: true, roughness: 0.6 }), { amount: 0.18 });

  // ---- land & water (slots 15-20) ----
  function landMaterials() {
    const std = (t, span, rough, w) => weather(new THREE.MeshStandardMaterial({
      map: tiled(t.map, span), normalMap: tiled(t.normalMap, span), vertexColors: true, roughness: rough }), w);
    const dirtT = earthTex(512, 17, false);
    const sand = sandTex();
    const gravel = voronoiStones({ cells: 26, gap: 0.14, seed: 5, strength: 3, warp: 0.3,
      colors: ['#8d877c', '#a39d90', '#77716a', '#9a8f7e'], gapColor: '#6b5f4c' });
    const cobble = voronoiStones({ cells: 11, gap: 0.09, seed: 8, strength: 5, warp: 0.5,
      colors: ['#7d7a74', '#8e8a82', '#6c6964', '#9a948a'], gapColor: '#3f3a33' });
    const rock = voronoiStones({ cells: 5, gap: 0.025, seed: 12, strength: 5, rough: 0.6, warp: 1.2,
      colors: ['#8a857c', '#7a756d', '#958f85'], gapColor: '#4a463f' });
    return [
      std(dirtT, 4, 1, { amount: 0.3 }),
      std(sand, 4, 0.95, { amount: 0.2, scale: 1 / 30 }),
      std(gravel, 2, 0.95, { amount: 0.2 }),
      std(cobble, 3, 0.85, { amount: 0.25, grime: 0.4 }),
      std(rock, 6, 0.9, { amount: 0.3, streaks: 0.2 }),
      makeWater(6, '#33402a', 0.9),
    ];
  }

  const blockMaterials = [
    stoneWall, stoneTop, earthSide, grassTop, waterMat,
    darkWall, darkTop, brick, brick, timber, timber, plaster, plaster, roof, roof,
    ...landMaterials(),
  ];

  // ---- the lake around the plot (rebuilt with a hole matching the plot when it grows) ----
  const lake = new THREE.Mesh(new THREE.BufferGeometry(), makeWater(10));
  lake.position.set(0, LAKE_LEVEL, 0);
  lake.receiveShadow = true;
  lake.renderOrder = -1;
  scene.add(lake);
  function buildLake({ x0, x1, z0, z1 }) {
    // Shape XY maps to world XZ after rotation (y -> -z).
    const shape = new THREE.Shape([
      new THREE.Vector2(-2000, -2000), new THREE.Vector2(2000, -2000),
      new THREE.Vector2(2000, 2000), new THREE.Vector2(-2000, 2000)]);
    shape.holes.push(new THREE.Path([
      new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1),
      new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv; // world-space UVs: ripples match voxel water
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
    lake.geometry.dispose();
    lake.geometry = geo;
  }

  const bedTex = earthTex(512, 33);
  const bedGeo = new THREE.PlaneGeometry(4000, 4000);
  bedGeo.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({
    map: (() => { const t = bedTex.map.clone(); t.repeat.set(500, 500); t.needsUpdate = true; return t; })(),
    color: '#9a8f72', roughness: 1 }));
  bed.position.set(SIZE_X / 2, -0.01, SIZE_Z / 2);
  bed.receiveShadow = true;
  scene.add(bed);

  // ---- grass tufts (instanced, wind animated, only on exposed grass) ----
  const PER_CELL = 3;
  const tuftGeo = new THREE.BufferGeometry();
  {
    const p = [], uv = [], idx = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI, cx = Math.cos(a) * 0.4, cz = Math.sin(a) * 0.4, h = 0.38;
      const b = p.length / 3;
      p.push(-cx, 0, -cz, cx, 0, cz, cx, h, cz, -cx, h, -cz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    tuftGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    tuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(Array(p.length / 3).fill([0, 1, 0]).flat(), 3));
    tuftGeo.setIndex(idx);
  }
  const tuftMat = new THREE.MeshStandardMaterial({ map: bladeTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  tuftMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(position, 1.0);
      float sway = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.22) + 0.5 * sin(uTime * 2.7 + wp.x * 0.9);
      transformed.x += sway * 0.05 * position.y * 2.5;
      transformed.z += sway * 0.035 * position.y * 2.5;`);
  };
  // Tufts are rebuilt for the whole plot when it grows; density drops on big plots to stay cheap.
  let tufts = null, tb = null, perCell = 3, tuftMatrices = [];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const rand = (x, z, k, salt) => { // stable per block, so tufts don't jump when the plot grows
    let h = (x * 73856093) ^ (z * 19349663) ^ ((k * 4 + salt) * 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  function rebuildGrass(world) {
    tb = world.blockBounds();
    const W = tb.x1 - tb.x0, D = tb.z1 - tb.z0;
    perCell = W * D <= 8192 ? 3 : W * D <= 20000 ? 2 : 1;
    if (tufts) { scene.remove(tufts); tufts.dispose(); }
    tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, W * D * perCell);
    tufts.receiveShadow = true;
    tuftMatrices = new Array(W * D * perCell);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++)
        for (let k = 0; k < perCell; k++) {
          const i = (z * W + x) * perCell + k, bx = x + tb.x0, bz = z + tb.z0;
          pos.set(bx + 0.1 + rand(bx, bz, k, 0) * 0.8, GROUND, bz + 0.1 + rand(bx, bz, k, 1) * 0.8);
          q.setFromAxisAngle(up, rand(bx, bz, k, 2) * Math.PI);
          const sc = 0.5 + rand(bx, bz, k, 3) * 0.8;
          s.set(sc, sc * (0.6 + rand(bx, bz, k, 4) * 0.8), sc);
          m.compose(pos, q, s);
          tuftMatrices[i] = m.clone();
          col.setHSL(0.2 + rand(bx, bz, k, 5) * 0.06, 0.3, 0.5 + rand(bx, bz, k, 6) * 0.2);
          tufts.setColorAt(i, col);
        }
    scene.add(tufts);
    updateGrass(world, [world.sx0, 0, world.sz0], [world.sx1 - 1, GROUND * SUB, world.sz1 - 1]);
  }
  // lo/hi arrive in sub-cells; a tuft shows only if the whole block column is open grass.
  function updateGrass(world, lo, hi) {
    if (!tufts) return;
    const top = GROUND * SUB;
    if (lo[1] > top) return;
    const W = tb.x1 - tb.x0;
    const bx0 = Math.max(tb.x0, Math.floor(lo[0] / SUB)), bx1 = Math.min(tb.x1 - 1, Math.floor(hi[0] / SUB));
    const bz0 = Math.max(tb.z0, Math.floor(lo[2] / SUB)), bz1 = Math.min(tb.z1 - 1, Math.floor(hi[2] / SUB));
    for (let z = bz0; z <= bz1; z++)
      for (let x = bx0; x <= bx1; x++) {
        let show = true;
        for (let dz = 0; dz < SUB && show; dz++)
          for (let dx = 0; dx < SUB; dx++) {
            const sx = x * SUB + dx, sz = z * SUB + dz;
            if (world.get(sx, top - 1, sz) !== EARTH || world.get(sx, top, sz) !== AIR) { show = false; break; }
          }
        for (let k = 0; k < perCell; k++) {
          const i = ((z - tb.z0) * W + (x - tb.x0)) * perCell + k;
          tufts.setMatrixAt(i, show ? tuftMatrices[i] : zero);
        }
      }
    tufts.instanceMatrix.needsUpdate = true;
  }

  // Called when the plot is created, loaded or expanded.
  function setPlot(world) {
    buildLake(world.blockBounds());
    rebuildGrass(world);
  }

  // ---- post-processing ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.5, scale: 1, samples: 16 });
  gtao.blendIntensity = 0.75;
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.12, 0.4, 0.95));
  const hBlur = new ShaderPass(HorizontalTiltShiftShader);
  const vBlur = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(hBlur);
  composer.addPass(vBlur);
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));

  let tiltShift = false; // off by default: crisp image
  function setTilt() {
    hBlur.enabled = vBlur.enabled = tiltShift;
    hBlur.uniforms.h.value = 0.9 / innerWidth;
    vBlur.uniforms.v.value = 0.9 / innerHeight;
    hBlur.uniforms.r.value = vBlur.uniforms.r.value = 0.5;
  }
  setTilt();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    setTilt();
  });

  // The shadow box tracks the ground point the camera is looking at, so big plots keep crisp shadows.
  const focus = new THREE.Vector3(), camFwd = new THREE.Vector3();
  function followSun() {
    camera.getWorldDirection(camFwd);
    const h = camera.position.y - GROUND;
    let d = camFwd.y < -0.05 ? h / -camFwd.y : 40;
    d = Math.min(d, 45);
    focus.copy(camera.position).addScaledVector(camFwd, d);
    focus.set(Math.round(focus.x), GROUND, Math.round(focus.z)); // snap to whole blocks to limit shimmer
    if (focus.equals(sun.target.position)) return;
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 130);
  }

  const clock = new THREE.Clock();
  let last = 0;
  function render() {
    const now = clock.getElapsedTime();
    const dt = Math.min(0.05, now - last);
    last = now;
    waterTime.value = now;
    onFrame(dt);
    followSun();
    composer.render();
  }

  let onFrame = () => {};
  return {
    renderer, scene, camera, blockMaterials, render, updateGrass, setPlot,
    setOnFrame(fn) { onFrame = fn; },
    toggleTilt() { tiltShift = !tiltShift; setTilt(); },
  };
}
