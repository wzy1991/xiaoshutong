import test from 'node:test';
import assert from 'node:assert/strict';
import { getCharacterById } from '../data/hanziCurriculum';
import {
  analyzeLiveStrokeStep,
  classifyPressureLevel,
  computeBrushPressure,
  computeVariableTubeRadii,
  detectWrongOrderStroke,
  pressureToMetrics,
  projectPointOntoPolyline,
} from './strokeCaptureEngine';

test('projectPointOntoPolyline computes exact perpendicular distance and progress', () => {
  const line = [
    { x: 20, y: 50 },
    { x: 80, y: 50 },
  ];
  const proj = projectPointOntoPolyline({ x: 50, y: 60 }, line);
  assert.equal(Math.round(proj.distance), 10);
  assert.equal(Math.round(proj.nearestPoint.x), 50);
  assert.equal(Math.round(proj.nearestPoint.y), 50);
  assert.equal(Number(proj.progress.toFixed(2)), 0.5);
});

test('detectWrongOrderStroke catches writing stroke 2 before stroke 1 on 十', () => {
  const shi = getCharacterById('shi');
  // Stroke 1 is horizontal (16,46)->(84,44); Stroke 2 is vertical (50,15)->(50,86)
  const wrongIdx = detectWrongOrderStroke({ x: 50, y: 16 }, shi.strokes, 0);
  assert.equal(wrongIdx, 1);

  // Starting near stroke 1 start returns null (correct order)
  const okIdx = detectWrongOrderStroke({ x: 18, y: 46 }, shi.strokes, 0);
  assert.equal(okIdx, null);
});

test('analyzeLiveStrokeStep detects on_track, drifting, off_track, and reverse_direction smoothly', () => {
  const yi = getCharacterById('yi');

  // On track
  const onTrack = analyzeLiveStrokeStep(
    [
      { x: 16, y: 52, pressure: 0.55, timestamp: 0 },
      { x: 42, y: 50, pressure: 0.58, timestamp: 100 },
    ],
    yi.strokes,
    0,
  );
  assert.equal(onTrack.status, 'on_track');
  assert.equal(onTrack.pressureLevel, 'medium');
  assert.ok(onTrack.deviation < 3);

  // Drifting (~11 units away)
  const drifting = analyzeLiveStrokeStep(
    [
      { x: 16, y: 52, pressure: 0.25, timestamp: 0 },
      { x: 45, y: 61, pressure: 0.25, timestamp: 100 },
    ],
    yi.strokes,
    0,
  );
  assert.equal(drifting.status, 'drifting');
  assert.equal(drifting.pressureLevel, 'light');
  assert.ok(drifting.nearestTrackPoint !== null);

  // Off track (>14.5 units away)
  const offTrack = analyzeLiveStrokeStep(
    [
      { x: 16, y: 52, pressure: 0.9, timestamp: 0 },
      { x: 50, y: 74, pressure: 0.92, timestamp: 100 },
    ],
    yi.strokes,
    0,
  );
  assert.equal(offTrack.status, 'off_track');
  assert.equal(offTrack.pressureLevel, 'heavy');

  // Reverse direction (right-to-left on horizontal stroke)
  const reversed = analyzeLiveStrokeStep(
    [
      { x: 82, y: 48, pressure: 0.55, timestamp: 0 },
      { x: 52, y: 50, pressure: 0.55, timestamp: 100 },
    ],
    yi.strokes,
    0,
  );
  assert.equal(reversed.status, 'reverse_direction');
});

test('computeBrushPressure respects manual pressure modes and speed-adaptive auto dynamics', () => {
  const light = computeBrushPressure({
    rawPointerPressure: 0.5,
    pointerType: 'mouse',
    speedPxPerMs: 0.5,
    prevPressure: 0.24,
    mode: 'light',
    strokePointCount: 5,
  });
  const heavy = computeBrushPressure({
    rawPointerPressure: 0.5,
    pointerType: 'mouse',
    speedPxPerMs: 0.5,
    prevPressure: 0.92,
    mode: 'heavy',
    strokePointCount: 5,
  });
  assert.equal(classifyPressureLevel(light), 'light');
  assert.equal(classifyPressureLevel(heavy), 'heavy');
  assert.ok(heavy > light + 0.5);

  // Slow pen produces heavier auto pressure than fast sweep
  const slowAuto = computeBrushPressure({
    rawPointerPressure: 0.5,
    pointerType: 'mouse',
    speedPxPerMs: 0.05,
    prevPressure: 0.7,
    mode: 'auto',
    strokePointCount: 5,
  });
  const fastAuto = computeBrushPressure({
    rawPointerPressure: 0.5,
    pointerType: 'mouse',
    speedPxPerMs: 1.5,
    prevPressure: 0.7,
    mode: 'auto',
    strokePointCount: 5,
  });
  assert.ok(slowAuto > fastAuto);
});

test('pressureToMetrics and computeVariableTubeRadii scale 3D thickness and relief monotonically', () => {
  const lightMetrics = pressureToMetrics(0.2);
  const mediumMetrics = pressureToMetrics(0.55);
  const heavyMetrics = pressureToMetrics(0.95);

  assert.ok(lightMetrics.tubeRadius3D < mediumMetrics.tubeRadius3D);
  assert.ok(mediumMetrics.tubeRadius3D < heavyMetrics.tubeRadius3D);
  assert.ok(lightMetrics.reliefHeight3D < heavyMetrics.reliefHeight3D);
  assert.ok(lightMetrics.canvasWidthPx < heavyMetrics.canvasWidthPx);

  const radii = computeVariableTubeRadii([
    { x: 15, y: 50, pressure: 0.2, timestamp: 0 },
    { x: 50, y: 50, pressure: 0.95, timestamp: 100 },
    { x: 85, y: 50, pressure: 0.3, timestamp: 200 },
  ]);
  assert.equal(radii.length, 3);
  assert.ok(radii[1] > radii[0] * 1.8, 'Heavy middle pressure must produce significantly thicker 3D tube radius');
  assert.ok(radii[1] > radii[2] * 1.8);
});
