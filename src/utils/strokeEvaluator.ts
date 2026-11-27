import { Point2D, StrokeDef, StrokeEvaluation } from '../types/hanzi';

export function distance2D(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function polylineLength(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance2D(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Uniformly resamples a polyline into exactly `count` points along arc length.
 */
export function resamplePoints(points: Point2D[], count = 24): Point2D[] {
  if (points.length === 0) return [];
  if (points.length === 1 || count <= 1) return Array.from({ length: Math.max(1, count) }, () => ({ ...points[0] }));

  const totalLen = polylineLength(points);
  if (totalLen < 1e-4) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  const step = totalLen / (count - 1);
  const resampled: Point2D[] = [{ ...points[0] }];
  let accum = 0;
  let prev = { ...points[0] };

  for (let i = 1; i < points.length; i++) {
    let curr = points[i];
    let segLen = distance2D(prev, curr);

    while (accum + segLen >= step && resampled.length < count) {
      const ratio = (step - accum) / Math.max(segLen, 1e-6);
      const nx = prev.x + ratio * (curr.x - prev.x);
      const ny = prev.y + ratio * (curr.y - prev.y);
      const newPt = { x: nx, y: ny };
      resampled.push(newPt);
      prev = newPt;
      segLen = distance2D(prev, curr);
      accum = 0;
    }

    accum += segLen;
    prev = curr;
  }

  while (resampled.length < count) {
    resampled.push({ ...points[points.length - 1] });
  }

  return resampled;
}

function normalizedVector(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Evaluates a student's hand-drawn stroke (in 0..100 normalized Tianzige coordinates)
 * against the canonical stroke definition. Kid-friendly tolerances while enforcing
 * correct stroke direction and reasonable placement.
 */
export function evaluateUserStroke(userPoints: Point2D[], targetStroke: StrokeDef): StrokeEvaluation {
  const targetLen = polylineLength(targetStroke.points);
  const userLen = polylineLength(userPoints);

  // Reject tiny accidental taps (allow smaller dots inside dense Grade 5-6 multi-stroke characters)
  const minRequiredLen = Math.max(2.5, targetLen * 0.32);
  if (userPoints.length < 2 || userLen < minRequiredLen) {
    return {
      accepted: false,
      accuracy: 0,
      issue: 'too_short',
      feedback: `这一笔「${targetStroke.name}」写得太短啦，再完整画一遍吧！`,
    };
  }

  const samples = 24;
  const targetSampled = resamplePoints(targetStroke.points, samples);
  const userSampled = resamplePoints(userPoints, samples);

  // Compute start/end distances
  const startDist = distance2D(userSampled[0], targetSampled[0]);
  const endDist = distance2D(userSampled[samples - 1], targetSampled[samples - 1]);

  // Check if user drew the stroke backwards (e.g. right-to-left instead of left-to-right)
  let forwardMeanDist = 0;
  let reverseMeanDist = 0;
  for (let i = 0; i < samples; i++) {
    forwardMeanDist += distance2D(userSampled[i], targetSampled[i]);
    reverseMeanDist += distance2D(userSampled[i], targetSampled[samples - 1 - i]);
  }
  forwardMeanDist /= samples;
  reverseMeanDist /= samples;

  const targetDir = normalizedVector(targetSampled[0], targetSampled[samples - 1]);
  const userDir = normalizedVector(userSampled[0], userSampled[samples - 1]);
  const dirDot = targetDir.x * userDir.x + targetDir.y * userDir.y;

  // Detect reversed direction clearly
  const isReversed =
    (reverseMeanDist + 7 < forwardMeanDist && dirDot < 0.15) ||
    (targetLen > 14 && dirDot < -0.25);

  if (isReversed) {
    return {
      accepted: false,
      accuracy: Math.max(10, Math.round(45 - forwardMeanDist)),
      issue: 'wrong_direction',
      feedback: `运笔方向反啦！「${targetStroke.name}」要记得：${targetStroke.directionTip}`,
    };
  }

  // Start point tolerance (generous enough for elementary fingers/mouse, strict enough for discipline)
  const maxStartDist = targetLen < 18 ? 24 : 26;
  if (startDist > maxStartDist) {
    return {
      accepted: false,
      accuracy: Math.max(20, Math.round(70 - startDist)),
      issue: 'wrong_start',
      feedback: `起笔位置偏了一点，跟着红点开始写「${targetStroke.name}」哦！`,
    };
  }

  // Length sanity check (don't accept wildly oversized scribbles)
  const lengthRatio = userLen / Math.max(targetLen, 1);
  if (lengthRatio > 2.35) {
    return {
      accepted: false,
      accuracy: 35,
      issue: 'off_path',
      feedback: `笔画拖得太长啦，跟着田字格里的「${targetStroke.name}」轻稳收笔。`,
    };
  }

  // Mean path deviation check
  const maxMeanDist = targetLen < 18 ? 20 : 21;
  if (forwardMeanDist > maxMeanDist || endDist > 30) {
    return {
      accepted: false,
      accuracy: Math.max(25, Math.round(92 - forwardMeanDist * 2.5)),
      issue: 'off_path',
      feedback: `再贴近笔画轨迹一点点，${targetStroke.directionTip}`,
    };
  }

  // Compute accuracy score 65..100 for accepted strokes
  const penalty = forwardMeanDist * 1.65 + startDist * 0.35 + endDist * 0.35 + Math.abs(1 - lengthRatio) * 14;
  const accuracy = Math.max(66, Math.min(100, Math.round(104 - penalty)));

  let feedback = `写得真棒！「${targetStroke.name}」笔顺规范，结构匀称。`;
  if (accuracy >= 92) {
    feedback = `太赞了！「${targetStroke.name}」起笔收笔都非常精准！`;
  } else if (accuracy < 78) {
    feedback = `过关啦！「${targetStroke.name}」方向正确，下次再贴紧虚线会更漂亮。`;
  }

  return {
    accepted: true,
    accuracy,
    feedback,
  };
}

/**
 * Calculates 1..3 stars earned for completing a character writing session.
 */
export function calculateCharacterStars(strokeAccuracies: number[], hintsUsed: number, traceGuideEnabled: boolean): {
  stars: number;
  averageAccuracy: number;
  inkReward: number;
} {
  if (strokeAccuracies.length === 0) {
    return { stars: 1, averageAccuracy: 0, inkReward: 10 };
  }
  const sum = strokeAccuracies.reduce((acc, v) => acc + v, 0);
  const averageAccuracy = Math.round(sum / strokeAccuracies.length);
  const adjustedScore = averageAccuracy - hintsUsed * 5 + (traceGuideEnabled ? 0 : 4);

  let stars = 1;
  if (adjustedScore >= 85 && hintsUsed <= 1) {
    stars = 3;
  } else if (adjustedScore >= 72) {
    stars = 2;
  }

  const inkReward = stars * 15 + (traceGuideEnabled ? 0 : 10);
  return { stars, averageAccuracy, inkReward };
}
