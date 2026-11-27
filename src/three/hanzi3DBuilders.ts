import * as THREE from 'three';
import { Point2D, StrokeDef } from '../types/hanzi';

export const PAPER_SIZE = 5.2;
export const PAPER_Y = 0.04;
const WRITING_EXTENT = 4.4; // Maps 0..100 into [-2.2, +2.2]

export function tianzigeToWorld(pt: Point2D, y = PAPER_Y + 0.02): THREE.Vector3 {
  const wx = ((pt.x - 50) / 100) * WRITING_EXTENT;
  const wz = ((pt.y - 50) / 100) * WRITING_EXTENT;
  return new THREE.Vector3(wx, y, wz);
}

/**
 * Generates a high-resolution procedural Xuan paper + Tianzige CanvasTexture.
 */
export function createTianzigePaperTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm crisp Xuan paper base
  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, size, size);

  // Subtle paper grain texture
  ctx.fillStyle = 'rgba(180, 165, 140, 0.05)';
  for (let i = 0; i < 1600; i++) {
    const x = (i * 197.3) % size;
    const y = (i * 311.7) % size;
    const w = 1.5 + (i % 5);
    const h = 1 + (i % 2);
    ctx.fillRect(x, y, w, h);
  }

  // Outer double vermilion calligraphy border matching writing extent
  const pad = Math.round(((PAPER_SIZE - WRITING_EXTENT) / 2 / PAPER_SIZE) * size);
  const innerSize = size - pad * 2;

  ctx.strokeStyle = '#C94136';
  ctx.lineWidth = 6;
  ctx.strokeRect(pad - 12, pad - 12, innerSize + 24, innerSize + 24);

  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, innerSize, innerSize);

  // Dashed center cross (田字格横中线 & 竖中线)
  ctx.save();
  ctx.strokeStyle = 'rgba(201, 65, 54, 0.58)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 10]);

  ctx.beginPath();
  ctx.moveTo(pad, size / 2);
  ctx.lineTo(size - pad, size / 2);
  ctx.moveTo(size / 2, pad);
  ctx.lineTo(size / 2, size - pad);
  ctx.stroke();

  // Subtle diagonal Mi-zi guide lines
  ctx.strokeStyle = 'rgba(201, 65, 54, 0.22)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(size - pad, size - pad);
  ctx.moveTo(size - pad, pad);
  ctx.lineTo(pad, size - pad);
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a subtle procedural grayscale wood grain bump texture.
 */
export function createWoodBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const shade = Math.round(115 + Math.sin(y * 0.14) * 20 + Math.cos(y * 0.43) * 10);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a soft radial contact shadow disc texture.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.18)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the composite 3D Calligraphy Desk, Walnut Tianzige Board,
 * Carved Slate Inkstone (砚台), and Celadon Porcelain Brush Rest (笔山).
 */
export function buildCalligraphyDeskGroup(maxAnisotropy: number): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const woodBump = createWoodBumpTexture();
  const paperTex = createTianzigePaperTexture(maxAnisotropy);
  const shadowTex = createContactShadowTexture();
  disposables.push(woodBump, paperTex, shadowTex);

  // 1. Studio desk surface (soft architectural light desk plane)
  const deskGeo = new THREE.PlaneGeometry(36, 36);
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0xeaeef3,
    roughness: 0.9,
    metalness: 0.0,
  });
  const deskMesh = new THREE.Mesh(deskGeo, deskMat);
  deskMesh.rotation.x = -Math.PI / 2;
  deskMesh.position.y = -0.26;
  deskMesh.receiveShadow = true;
  group.add(deskMesh);
  disposables.push(deskGeo, deskMat);

  // Soft grounded contact shadow beneath the writing tablet
  const shadowGeo = new THREE.PlaneGeometry(8.2, 8.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.235; // Offset >= 0.02 above desk plane
  group.add(shadowPlane);
  disposables.push(shadowGeo, shadowMat);

  // 2. Writing board base slab (walnut wood)
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6f4b32,
    roughness: 0.62,
    metalness: 0.04,
    bumpMap: woodBump,
    bumpScale: 0.015,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x4b3120,
    roughness: 0.55,
    metalness: 0.06,
    bumpMap: woodBump,
    bumpScale: 0.012,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af63,
    roughness: 0.24,
    metalness: 0.86,
  });
  disposables.push(woodMat, darkWoodMat, brassMat);

  const boardBaseGeo = new THREE.BoxGeometry(PAPER_SIZE + 0.76, 0.24, PAPER_SIZE + 0.76);
  const boardBase = new THREE.Mesh(boardBaseGeo, darkWoodMat);
  boardBase.position.y = -0.14;
  boardBase.castShadow = true;
  boardBase.receiveShadow = true;
  group.add(boardBase);
  disposables.push(boardBaseGeo);

  // 4 beveled perimeter wooden frame rails
  const railThickness = 0.34;
  const railHeight = 0.14;
  const span = PAPER_SIZE + railThickness * 2;
  const horizRailGeo = new THREE.BoxGeometry(span, railHeight, railThickness);
  const vertRailGeo = new THREE.BoxGeometry(railThickness, railHeight, PAPER_SIZE);
  disposables.push(horizRailGeo, vertRailGeo);

  const railOffset = PAPER_SIZE / 2 + railThickness / 2;
  const northRail = new THREE.Mesh(horizRailGeo, woodMat);
  northRail.position.set(0, 0.02, -railOffset);
  northRail.castShadow = true;
  northRail.receiveShadow = true;

  const southRail = new THREE.Mesh(horizRailGeo, woodMat);
  southRail.position.set(0, 0.02, railOffset);
  southRail.castShadow = true;
  southRail.receiveShadow = true;

  const westRail = new THREE.Mesh(vertRailGeo, woodMat);
  westRail.position.set(-railOffset, 0.02, 0);
  westRail.castShadow = true;
  westRail.receiveShadow = true;

  const eastRail = new THREE.Mesh(vertRailGeo, woodMat);
  eastRail.position.set(railOffset, 0.02, 0);
  eastRail.castShadow = true;
  eastRail.receiveShadow = true;

  group.add(northRail, southRail, westRail, eastRail);

  // 4 brushed brass corner inlays (high contrast metallic accent)
  const cornerGeo = new THREE.BoxGeometry(0.42, 0.165, 0.42);
  disposables.push(cornerGeo);
  const cornerPos = PAPER_SIZE / 2 + 0.18;
  for (const [cx, cz] of [
    [-cornerPos, -cornerPos],
    [cornerPos, -cornerPos],
    [-cornerPos, cornerPos],
    [cornerPos, cornerPos],
  ]) {
    const corner = new THREE.Mesh(cornerGeo, brassMat);
    corner.position.set(cx, 0.025, cz);
    corner.castShadow = true;
    group.add(corner);
  }

  // 3. Xuan paper writing surface (raised above base slab, no Z-fighting)
  const paperGeo = new THREE.BoxGeometry(PAPER_SIZE, 0.05, PAPER_SIZE);
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paperTex,
    roughness: 0.88,
    metalness: 0.0,
  });
  const paperMesh = new THREE.Mesh(paperGeo, paperMat);
  paperMesh.position.y = PAPER_Y - 0.025;
  paperMesh.receiveShadow = true;
  group.add(paperMesh);
  disposables.push(paperGeo, paperMat);

  // 4. Side Prop A: Carved Slate Inkstone (端砚) at top-right of the desk
  const inkstoneGroup = new THREE.Group();
  inkstoneGroup.position.set(3.75, -0.26, -1.15);

  const slateShape = new THREE.Shape();
  slateShape.moveTo(-0.68, -0.88);
  slateShape.lineTo(0.68, -0.88);
  slateShape.lineTo(0.68, 0.88);
  slateShape.lineTo(-0.68, 0.88);
  slateShape.closePath();

  const slateGeo = new THREE.ExtrudeGeometry(slateShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  slateGeo.rotateX(-Math.PI / 2);
  const slateMat = new THREE.MeshStandardMaterial({
    color: 0x2d333d,
    roughness: 0.74,
    metalness: 0.08,
  });
  const slateMesh = new THREE.Mesh(slateGeo, slateMat);
  slateMesh.position.y = 0.04;
  slateMesh.castShadow = true;
  slateMesh.receiveShadow = true;
  inkstoneGroup.add(slateMesh);

  // Glossy liquid ink pool inside inkstone
  const poolGeo = new THREE.BoxGeometry(1.0, 0.03, 1.2);
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: 0x090c12,
    roughness: 0.07,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const poolMesh = new THREE.Mesh(poolGeo, poolMat);
  poolMesh.position.set(0, 0.315, 0.08);
  inkstoneGroup.add(poolMesh);

  // Gold-accented pine-soot ink stick resting diagonally
  const stickGeo = new THREE.BoxGeometry(0.22, 0.14, 1.24);
  const stickMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e26,
    roughness: 0.42,
    metalness: 0.12,
  });
  const stickMesh = new THREE.Mesh(stickGeo, stickMat);
  stickMesh.position.set(0.28, 0.39, -0.22);
  stickMesh.rotation.y = 0.32;
  stickMesh.castShadow = true;
  inkstoneGroup.add(stickMesh);

  // Subtle gold trim on ink stick
  const stickTrimGeo = new THREE.BoxGeometry(0.23, 0.03, 0.18);
  const stickTrim = new THREE.Mesh(stickTrimGeo, brassMat);
  stickTrim.position.set(0.28, 0.46, -0.22);
  stickTrim.rotation.y = 0.32;
  inkstoneGroup.add(stickTrim);

  group.add(inkstoneGroup);
  disposables.push(slateGeo, slateMat, poolGeo, poolMat, stickGeo, stickMat, stickTrimGeo);

  // 5. Side Prop B: Celadon Porcelain Mountain Brush Rest (青瓷笔山) at left-front
  const mountainShape = new THREE.Shape();
  mountainShape.moveTo(-0.82, 0);
  mountainShape.quadraticCurveTo(-0.58, 0.48, -0.4, 0.38);
  mountainShape.quadraticCurveTo(-0.2, 0.25, 0, 0.72);
  mountainShape.quadraticCurveTo(0.2, 0.25, 0.4, 0.42);
  mountainShape.quadraticCurveTo(0.6, 0.52, 0.82, 0);
  mountainShape.closePath();

  const mountainGeo = new THREE.ExtrudeGeometry(mountainShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
  });
  mountainGeo.translate(0, 0, -0.14);
  const celadonMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fbca7,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const brushRest = new THREE.Mesh(mountainGeo, celadonMat);
  brushRest.position.set(-3.68, -0.24, 0.85);
  brushRest.rotation.y = Math.PI / 2.25;
  brushRest.castShadow = true;
  brushRest.receiveShadow = true;
  group.add(brushRest);
  disposables.push(mountainGeo, celadonMat);

  return { group, disposables };
}

/**
 * Builds an articulated 5-part 3D Calligraphy Brush pivoted cleanly at its ink tip (0, 0, 0).
 */
export function buildCalligraphyBrushGroup(): {
  group: THREE.Group;
  tipMaterial: THREE.MeshStandardMaterial;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Part 1: Tapered calligraphy brush hair cone (LatheGeometry from tip y=0 up to y=0.66)
  const hairProfile = [
    new THREE.Vector2(0.008, 0.0),
    new THREE.Vector2(0.045, 0.12),
    new THREE.Vector2(0.115, 0.32),
    new THREE.Vector2(0.145, 0.52),
    new THREE.Vector2(0.125, 0.68),
  ];
  const hairGeo = new THREE.LatheGeometry(hairProfile, 20);
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1d232f,
    roughness: 0.52,
    metalness: 0.05,
  });
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.castShadow = true;
  group.add(hairMesh);

  // Part 2: Glowing vermilion-ink tip accent (highlights brush contact point)
  const tipGeo = new THREE.ConeGeometry(0.048, 0.16, 16);
  tipGeo.rotateX(Math.PI);
  tipGeo.translate(0, 0.08, 0);
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: 0xd93829,
    emissive: 0xd93829,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.1,
  });
  const tipMesh = new THREE.Mesh(tipGeo, tipMaterial);
  group.add(tipMesh);

  // Part 3: Ivory/bone collar (笔斗)
  const collarProfile = [
    new THREE.Vector2(0.126, 0.67),
    new THREE.Vector2(0.142, 0.78),
    new THREE.Vector2(0.132, 0.94),
  ];
  const collarGeo = new THREE.LatheGeometry(collarProfile, 20);
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xf0eadc,
    roughness: 0.24,
    metalness: 0.02,
  });
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.castShadow = true;
  group.add(collarMesh);

  // Part 4: Brushed brass ferrule ring
  const ringGeo = new THREE.CylinderGeometry(0.138, 0.136, 0.12, 20);
  ringGeo.translate(0, 0.99, 0);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd4af63,
    roughness: 0.2,
    metalness: 0.9,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  group.add(ringMesh);

  // Part 5: Sculpted bamboo handle with subtle organic nodes
  const shaftProfile = [
    new THREE.Vector2(0.126, 1.05),
    new THREE.Vector2(0.118, 1.85),
    new THREE.Vector2(0.13, 1.92), // Bamboo node 1
    new THREE.Vector2(0.116, 2.0),
    new THREE.Vector2(0.106, 2.95),
    new THREE.Vector2(0.116, 3.02), // Bamboo node 2
    new THREE.Vector2(0.1, 3.1),
    new THREE.Vector2(0.088, 3.95),
    new THREE.Vector2(0.0, 4.02),
  ];
  const shaftGeo = new THREE.LatheGeometry(shaftProfile, 20);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0xc29555,
    roughness: 0.44,
    metalness: 0.04,
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.castShadow = true;
  group.add(shaftMesh);

  // Tilt slightly like a real hand holding a calligraphy brush
  group.rotation.set(0.14, 0, -0.18);

  disposables.push(
    hairGeo,
    hairMat,
    tipGeo,
    tipMaterial,
    collarGeo,
    collarMat,
    ringGeo,
    ringMat,
    shaftGeo,
    shaftMat,
  );

  return { group, tipMaterial, disposables };
}

export interface BuiltStroke3D {
  curve: THREE.CatmullRomCurve3;
  tubularSegments: number;
  radialSegments: number;
  inkMesh: THREE.Mesh;
  guideMesh: THREE.Mesh;
  startCap: THREE.Mesh;
  endCap: THREE.Mesh;
  airArcMesh?: THREE.Mesh;
  airArcCurve?: THREE.CatmullRomCurve3;
}

/**
 * Creates 3D stroke tubes (with zero-allocation drawRange animation support)
 * and 3D parabolic air-transfer trajectory arcs between consecutive strokes.
 */
export function buildCharacterStrokes3D(
  strokes: StrokeDef[],
): {
  group: THREE.Group;
  builtStrokes: BuiltStroke3D[];
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const builtStrokes: BuiltStroke3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const tubularSegments = strokes.length >= 14 ? 28 : 44;
  const radialSegments = strokes.length >= 14 ? 8 : 10;
  const strokeRadius =
    strokes.length <= 8 ? 0.115 : strokes.length <= 14 ? 0.092 : 0.074;

  const guideMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
    opacity: 0.48,
  });

  const airArcMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xd97706,
    emissiveIntensity: 0.28,
    roughness: 0.35,
    metalness: 0.25,
    transparent: true,
    opacity: 0.78,
  });

  const capGeo = new THREE.SphereGeometry(strokeRadius, 12, 10);
  capGeo.scale(1, 0.55, 1);
  disposables.push(guideMat, airArcMat, capGeo);

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    const pts = stroke.points.map((p, idx) => {
      // Slight elevation modulation so strokes have tactile 3D relief
      const t = stroke.points.length > 1 ? idx / (stroke.points.length - 1) : 0;
      const relief = 0.048 + Math.sin(t * Math.PI) * 0.016;
      return tianzigeToWorld(p, PAPER_Y + relief);
    });

    // Ensure CatmullRomCurve3 has at least 2 distinct points
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45);

    // Subtle faint guide silhouette on paper
    const guideGeo = new THREE.TubeGeometry(curve, 28, strokeRadius * 0.86, 8, false);
    guideGeo.scale(1, 0.35, 1);
    const guideMesh = new THREE.Mesh(guideGeo, guideMat);
    guideMesh.position.y = PAPER_Y + 0.018 - (PAPER_Y + 0.048) * 0.35;
    group.add(guideMesh);
    disposables.push(guideGeo);

    // Main animated volumetric ink stroke
    const inkGeo = new THREE.TubeGeometry(curve, tubularSegments, strokeRadius, radialSegments, false);
    const inkMat = new THREE.MeshPhysicalMaterial({
      color: 0x182230,
      roughness: 0.22,
      metalness: 0.06,
      clearcoat: 0.75,
      clearcoatRoughness: 0.2,
    });
    const inkMesh = new THREE.Mesh(inkGeo, inkMat);
    inkMesh.castShadow = true;
    inkMesh.receiveShadow = true;
    inkGeo.setDrawRange(0, 0);
    group.add(inkMesh);
    disposables.push(inkGeo, inkMat);

    const startCap = new THREE.Mesh(capGeo, inkMat);
    startCap.position.copy(pts[0]);
    startCap.visible = false;
    group.add(startCap);

    const endCap = new THREE.Mesh(capGeo, inkMat);
    endCap.position.copy(pts[pts.length - 1]);
    endCap.visible = false;
    group.add(endCap);

    // Build 3D parabolic air-transfer arc from previous stroke end -> this stroke start
    let airArcMesh: THREE.Mesh | undefined;
    let airArcCurve: THREE.CatmullRomCurve3 | undefined;
    if (i > 0) {
      const prevStroke = strokes[i - 1];
      const from = tianzigeToWorld(prevStroke.points[prevStroke.points.length - 1], PAPER_Y + 0.08);
      const to = tianzigeToWorld(stroke.points[0], PAPER_Y + 0.08);
      const dist = from.distanceTo(to);
      const arcHeight = PAPER_Y + 0.72 + Math.min(0.68, dist * 0.22);
      const mid = new THREE.Vector3(
        (from.x + to.x) * 0.5,
        arcHeight,
        (from.z + to.z) * 0.5,
      );
      airArcCurve = new THREE.CatmullRomCurve3([from, mid, to]);
      const arcGeo = new THREE.TubeGeometry(airArcCurve, 24, 0.024, 8, false);
      airArcMesh = new THREE.Mesh(arcGeo, airArcMat);
      airArcMesh.visible = false;
      group.add(airArcMesh);
      disposables.push(arcGeo);
    }

    builtStrokes.push({
      curve,
      tubularSegments,
      radialSegments,
      inkMesh,
      guideMesh,
      startCap,
      endCap,
      airArcMesh,
      airArcCurve,
    });
  }

  return { group, builtStrokes, disposables };
}

/**
 * Resamples CapturedPoint[] smoothly while preserving continuous pressure values.
 */
function smoothCapturedPoints(points: Array<{ x: number; y: number; pressure: number }>, targetCount: number) {
  if (points.length <= 2) return points;
  const dists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    dists.push(total);
  }
  if (total < 1e-4) return points;

  const out: Array<{ x: number; y: number; pressure: number }> = [];
  let cursor = 0;
  for (let k = 0; k < targetCount; k++) {
    const targetDist = (k / (targetCount - 1)) * total;
    while (cursor < dists.length - 2 && dists[cursor + 1] < targetDist) {
      cursor++;
    }
    const segLen = Math.max(dists[cursor + 1] - dists[cursor], 1e-6);
    const localT = Math.max(0, Math.min(1, (targetDist - dists[cursor]) / segLen));
    const a = points[cursor];
    const b = points[cursor + 1];
    out.push({
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
      pressure: a.pressure + (b.pressure - a.pressure) * localT,
    });
  }
  return out;
}

/**
 * Builds a sculpted 3D BufferGeometry ink ribbon/ridge whose cross-sectional width
 * AND vertical 3D ink relief vary continuously with captured brush pressure.
 */
export function buildVariablePressureStrokeGeometry(
  rawPoints: Array<{ x: number; y: number; pressure: number }>,
  options?: { isDeviating?: boolean },
): THREE.BufferGeometry | null {
  if (rawPoints.length < 2) return null;

  const sampleCount = Math.max(12, Math.min(56, rawPoints.length * 2));
  const pts = smoothCapturedPoints(rawPoints, sampleCount);
  const n = pts.length;
  const radialSegs = 12;

  const worldPts = pts.map((p) => tianzigeToWorld(p, PAPER_Y + 0.014));
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const prev = worldPts[Math.max(0, i - 1)];
    const next = worldPts[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3().subVectors(next, prev);
    t.y = 0;
    if (t.lengthSq() < 1e-8) {
      t.set(1, 0, 0);
    } else {
      t.normalize();
    }
    tangents.push(t);
  }

  // Ring vertices + 2 center cap vertices (start & end)
  const ringStride = radialSegs + 1;
  const totalVerts = n * ringStride + 2;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  const colorLight = new THREE.Color(options?.isDeviating ? 0xe5984b : 0x3b495e);
  const colorHeavy = new THREE.Color(options?.isDeviating ? 0xb45309 : 0x0b111b);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const p = Math.max(0.15, Math.min(1.0, pts[i].pressure));
    const tNorm = n > 1 ? i / (n - 1) : 0.5;
    // Gentle calligraphic taper at the very entry and tail tips
    const startTaper = tNorm < 0.08 ? 0.65 + (tNorm / 0.08) * 0.35 : 1;
    const endTaper = tNorm > 0.88 ? 1 - ((tNorm - 0.88) / 0.12) * 0.3 : 1;
    const taper = startTaper * endTaper;

    // Pressure-driven 3D radius and vertical lacquer ink height
    const radius = (0.042 + p * 0.148) * taper;
    const relief = (0.026 + p * 0.084) * taper;

    const tan = tangents[i];
    const binormX = -tan.z;
    const binormZ = tan.x;
    const center = worldPts[i];

    tmpColor.copy(colorLight).lerp(colorHeavy, (p - 0.15) / 0.85);

    for (let j = 0; j <= radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Flat-bottomed plump ink dome profile sitting flush on paper
      const vx = center.x + binormX * cosT * radius;
      const vy = PAPER_Y + 0.012 + (sinT >= 0 ? sinT * relief + relief * 0.25 : (1 + sinT) * relief * 0.25);
      const vz = center.z + binormZ * cosT * radius;

      const vIdx = (i * ringStride + j) * 3;
      positions[vIdx] = vx;
      positions[vIdx + 1] = vy;
      positions[vIdx + 2] = vz;

      colors[vIdx] = tmpColor.r;
      colors[vIdx + 1] = tmpColor.g;
      colors[vIdx + 2] = tmpColor.b;
    }
  }

  // Start and end cap center vertices
  const startCenterIdx = n * ringStride;
  const endCenterIdx = startCenterIdx + 1;

  const p0 = Math.max(0.15, Math.min(1.0, pts[0].pressure));
  const pLast = Math.max(0.15, Math.min(1.0, pts[n - 1].pressure));
  const r0 = (0.042 + p0 * 0.148) * 0.65;
  const rLast = (0.042 + pLast * 0.148) * 0.7;

  positions[startCenterIdx * 3] = worldPts[0].x - tangents[0].x * r0 * 0.55;
  positions[startCenterIdx * 3 + 1] = PAPER_Y + 0.025 + p0 * 0.025;
  positions[startCenterIdx * 3 + 2] = worldPts[0].z - tangents[0].z * r0 * 0.55;
  tmpColor.copy(colorLight).lerp(colorHeavy, (p0 - 0.15) / 0.85);
  colors[startCenterIdx * 3] = tmpColor.r;
  colors[startCenterIdx * 3 + 1] = tmpColor.g;
  colors[startCenterIdx * 3 + 2] = tmpColor.b;

  positions[endCenterIdx * 3] = worldPts[n - 1].x + tangents[n - 1].x * rLast * 0.55;
  positions[endCenterIdx * 3 + 1] = PAPER_Y + 0.022 + pLast * 0.02;
  positions[endCenterIdx * 3 + 2] = worldPts[n - 1].z + tangents[n - 1].z * rLast * 0.55;
  tmpColor.copy(colorLight).lerp(colorHeavy, (pLast - 0.15) / 0.85);
  colors[endCenterIdx * 3] = tmpColor.r;
  colors[endCenterIdx * 3 + 1] = tmpColor.g;
  colors[endCenterIdx * 3 + 2] = tmpColor.b;

  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Cap triangles
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j + 1, j);
    const lastRing = (n - 1) * ringStride;
    indices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

