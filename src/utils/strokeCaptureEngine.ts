import {
  CapturedPoint,
  DeviationStatus,
  LiveCaptureTelemetry,
  Point2D,
  PressureLevel,
  PressureMode,
  StrokeDef,
} from '../types/hanzi';
import { distance2D, polylineLength } from './strokeEvaluator';

export interface PolylineProjection {
  distance: number;
  nearestPoint: Point2D;
  progress: number; // 0..1 along polyline arc length
}

/**
 * Projects a 2D point onto a polyline and returns exact perpendicular distance,
 * closest point on the track, and normalized progress (0..1) along the stroke.
 */
export function projectPointOntoPolyline(pt: Point2D, polyline: Point2D[]): PolylineProjection {
  if (polyline.length === 0) {
    return { distance: 0, nearestPoint: { ...pt }, progress: 0 };
  }
  if (polyline.length === 1) {
    return {
      distance: distance2D(pt, polyline[0]),
      nearestPoint: { ...polyline[0] },
      progress: 0,
    };
  }

  const totalLen = Math.max(polylineLength(polyline), 1e-5);
  let bestDist = Infinity;
  let bestPt: Point2D = { ...polyline[0] };
  let bestArcLen = 0;
  let accumLen = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const segLenSq = vx * vx + vy * vy;
    const segLen = Math.sqrt(segLenSq);

    let t = 0;
    if (segLenSq > 1e-6) {
      t = ((pt.x - a.x) * vx + (pt.y - a.y) * vy) / segLenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = a.x + vx * t;
    const projY = a.y + vy * t;
    const d = Math.hypot(pt.x - projX, pt.y - projY);

    if (d < bestDist) {
      bestDist = d;
      bestPt = { x: projX, y: projY };
      bestArcLen = accumLen + segLen * t;
    }

    accumLen += segLen;
  }

  return {
    distance: bestDist,
    nearestPoint: bestPt,
    progress: Math.max(0, Math.min(1, bestArcLen / totalLen)),
  };
}

/**
 * Classifies a normalized pressure value (0.15..1.0) into light / medium / heavy.
 */
export function classifyPressureLevel(pressure: number): PressureLevel {
  if (pressure < 0.38) return 'light';
  if (pressure < 0.72) return 'medium';
  return 'heavy';
}

export function getPressureLabel(level: PressureLevel): string {
  switch (level) {
    case 'light':
      return '轻笔';
    case 'medium':
      return '适中';
    case 'heavy':
      return '重笔';
  }
}

/**
 * Computes smoothed brush pressure (0.15..1.0) combining real stylus hardware pressure
 * (when available) with velocity-adaptive calligraphy physics or manual pressure preset.
 */
export function computeBrushPressure(params: {
  rawPointerPressure: number;
  pointerType: string;
  speedPxPerMs: number;
  prevPressure: number;
  mode: PressureMode;
  strokePointCount: number;
}): number {
  const { rawPointerPressure, pointerType, speedPxPerMs, prevPressure, mode, strokePointCount } =
    params;

  let target: number;

  if (mode === 'light') {
    target = 0.24;
  } else if (mode === 'medium') {
    target = 0.56;
  } else if (mode === 'heavy') {
    target = 0.92;
  } else {
    // Auto mode: use real stylus pressure if pen provides non-default pressure,
    // otherwise synthesize natural calligraphy dynamics from pen speed & start press.
    const hasRealHardwarePressure =
      pointerType === 'pen' && rawPointerPressure > 0 && Math.abs(rawPointerPressure - 0.5) > 0.02;

    if (hasRealHardwarePressure) {
      target = Math.max(0.18, Math.min(1.0, rawPointerPressure));
    } else {
      // Slower deliberate stroke -> heavier pressure; brisk stroke -> slender ink line
      const clampedSpeed = Math.max(0, Math.min(1.8, speedPxPerMs));
      const speedCurve = 0.86 - clampedSpeed * 0.34;
      // Subtle 起笔顿笔 boost on initial contact
      const entryBoost = strokePointCount <= 3 ? 0.1 : 0;
      target = Math.max(0.2, Math.min(0.96, speedCurve + entryBoost));
    }
  }

  // Smooth exponential filter to prevent noisy width jitter
  const alpha = strokePointCount <= 1 ? 1 : 0.35;
  const smoothed = prevPressure + (target - prevPressure) * alpha;
  return Math.max(0.16, Math.min(1.0, Number(smoothed.toFixed(3))));
}

/**
 * Checks whether the student started writing a *different* stroke out of order.
 * Returns the index of the accidentally targeted future stroke, or null if order looks right.
 */
export function detectWrongOrderStroke(
  startPt: Point2D,
  strokes: StrokeDef[],
  expectedIndex: number,
): number | null {
  const expected = strokes[expectedIndex];
  if (!expected) return null;

  const expectedStartDist = distance2D(startPt, expected.points[0]);
  const expectedTrackDist = projectPointOntoPolyline(startPt, expected.points).distance;

  // If the student is comfortably near the expected stroke start, order is right
  if (expectedStartDist <= 16 || expectedTrackDist <= 12) {
    return null;
  }

  let closestOtherIdx: number | null = null;
  let closestOtherDist = Infinity;

  for (let i = expectedIndex + 1; i < strokes.length; i++) {
    const candidateStartDist = distance2D(startPt, strokes[i].points[0]);
    if (candidateStartDist < closestOtherDist) {
      closestOtherDist = candidateStartDist;
      closestOtherIdx = i;
    }
  }

  // Only flag wrong order when start point is clearly on a future stroke's start
  // and significantly closer to that future stroke than to the expected stroke
  if (
    closestOtherIdx !== null &&
    closestOtherDist <= 17 &&
    closestOtherDist + 10 < expectedStartDist
  ) {
    return closestOtherIdx;
  }

  return null;
}

/**
 * Performs continuous real-time analysis of a student's active stroke:
 * checks stroke order, track deviation, direction alignment, and brush pressure tier.
 */
export function analyzeLiveStrokeStep(
  capturedPoints: CapturedPoint[],
  strokes: StrokeDef[],
  expectedIndex: number,
): LiveCaptureTelemetry {
  const targetStroke = strokes[expectedIndex];
  if (!targetStroke || capturedPoints.length === 0) {
    return {
      status: 'idle',
      deviation: 0,
      nearestTrackPoint: null,
      progressAlongStroke: 0,
      pressure: 0.55,
      pressureLevel: 'medium',
      wrongOrderTargetIndex: null,
      coachingHint: targetStroke
        ? `请写第 ${expectedIndex + 1} 笔「${targetStroke.name}」：${targetStroke.directionTip}`
        : '准备就绪',
    };
  }

  const latest = capturedPoints[capturedPoints.length - 1];
  const startPt = capturedPoints[0];
  const pressure = latest.pressure;
  const pressureLevel = classifyPressureLevel(pressure);

  const projStart = projectPointOntoPolyline(startPt, targetStroke.points);
  const projLatest = projectPointOntoPolyline(latest, targetStroke.points);

  // 1. Check wrong stroke order first
  const wrongOrderIdx = detectWrongOrderStroke(startPt, strokes, expectedIndex);
  if (wrongOrderIdx !== null) {
    const wrongStroke = strokes[wrongOrderIdx];
    return {
      status: 'wrong_order',
      deviation: projLatest.distance,
      nearestTrackPoint: targetStroke.points[0],
      progressAlongStroke: 0,
      pressure,
      pressureLevel,
      wrongOrderTargetIndex: wrongOrderIdx,
      coachingHint: `笔顺小提醒：你刚落笔在第 ${wrongOrderIdx + 1} 笔「${wrongStroke.name}」，请先写第 ${expectedIndex + 1} 笔「${targetStroke.name}」哦！`,
    };
  }

  // 2. Check reverse direction once the stroke has moved enough distance
  const drawnLen = polylineLength(capturedPoints);
  if (drawnLen >= 11 && projStart.progress - projLatest.progress > 0.14) {
    return {
      status: 'reverse_direction',
      deviation: projLatest.distance,
      nearestTrackPoint: projLatest.nearestPoint,
      progressAlongStroke: projLatest.progress,
      pressure,
      pressureLevel,
      wrongOrderTargetIndex: null,
      coachingHint: `方向写反啦！第 ${expectedIndex + 1} 笔「${targetStroke.name}」要记得：${targetStroke.directionTip}`,
    };
  }

  // 3. Evaluate lateral track deviation with gentle graduated bands
  let status: DeviationStatus = 'on_track';
  let coachingHint = `运笔很稳！正在书写第 ${expectedIndex + 1} 笔「${targetStroke.name}」（${getPressureLabel(pressureLevel)}）`;

  if (projLatest.distance > 14.5) {
    status = 'off_track';
    coachingHint = `稍微偏出轨道啦，顺着柔和光带慢慢回到「${targetStroke.name}」虚线上吧`;
  } else if (projLatest.distance > 8.5) {
    status = 'drifting';
    coachingHint = `轻轻往标准轨道靠拢一点点，保持稳稳行笔`;
  }

  return {
    status,
    deviation: Number(projLatest.distance.toFixed(2)),
    nearestTrackPoint: projLatest.nearestPoint,
    progressAlongStroke: projLatest.progress,
    pressure,
    pressureLevel,
    wrongOrderTargetIndex: null,
    coachingHint,
  };
}

/**
 * Maps normalized brush pressure (0.15..1.0) to 2D canvas stroke width (px)
 * and 3D Three.js tube radius + vertical lacquer relief height.
 */
export function pressureToMetrics(pressure: number): {
  canvasWidthPx: number;
  tubeRadius3D: number;
  reliefHeight3D: number;
} {
  const p = Math.max(0.15, Math.min(1.0, pressure));
  return {
    canvasWidthPx: Number((6.5 + p * 17.5).toFixed(2)), // ~9px (light) -> ~24px (heavy)
    tubeRadius3D: Number((0.042 + p * 0.148).toFixed(4)), // ~0.065 (light) -> ~0.19 (heavy)
    reliefHeight3D: Number((0.024 + p * 0.072).toFixed(4)), // subtle to plump 3D ink relief
  };
}

/**
 * Pure math helper generating variable-radius 3D ribbon/tube geometry buffers
 * so pressure-sensitive 3D stroke geometry can be unit-tested deterministically.
 */
export function computeVariableTubeRadii(points: CapturedPoint[]): number[] {
  if (points.length === 0) return [];
  const n = points.length;
  return points.map((pt, idx) => {
    const base = pressureToMetrics(pt.pressure).tubeRadius3D;
    // Slight natural calligraphic taper at the very tail end
    const t = n > 1 ? idx / (n - 1) : 0.5;
    const tailTaper = t > 0.88 ? 1 - ((t - 0.88) / 0.12) * 0.25 : 1;
    return Number((base * tailTaper).toFixed(4));
  });
}
