import test from 'node:test';
import assert from 'node:assert/strict';
import { getCharacterById } from '../data/hanziCurriculum';
import {
  calculateCharacterStars,
  evaluateUserStroke,
  polylineLength,
  resamplePoints,
} from './strokeEvaluator';

test('resamplePoints produces exact requested sample count and preserves endpoints', () => {
  const raw = [
    { x: 10, y: 50 },
    { x: 90, y: 50 },
  ];
  const sampled = resamplePoints(raw, 16);
  assert.equal(sampled.length, 16);
  assert.equal(Math.round(sampled[0].x), 10);
  assert.equal(Math.round(sampled[15].x), 90);
  assert.equal(Math.round(polylineLength(sampled)), 80);
});

test('evaluateUserStroke accepts a well-drawn horizontal stroke with high accuracy', () => {
  const yi = getCharacterById('yi');
  const stroke = yi.strokes[0];
  const userDrawn = [
    { x: 18, y: 53 },
    { x: 40, y: 51 },
    { x: 65, y: 49 },
    { x: 84, y: 48 },
  ];
  const result = evaluateUserStroke(userDrawn, stroke);
  assert.equal(result.accepted, true);
  assert.ok(result.accuracy >= 85, `Expected accuracy >= 85, got ${result.accuracy}`);
});

test('evaluateUserStroke rejects a stroke drawn in the reverse direction', () => {
  const yi = getCharacterById('yi');
  const stroke = yi.strokes[0];
  const reversed = [...stroke.points].reverse();
  const result = evaluateUserStroke(reversed, stroke);
  assert.equal(result.accepted, false);
  assert.equal(result.issue, 'wrong_direction');
});

test('evaluateUserStroke rejects a stroke that is far too short', () => {
  const shi = getCharacterById('shi');
  const verticalStroke = shi.strokes[1];
  const tinyTap = [
    { x: 50, y: 15 },
    { x: 50, y: 20 },
  ];
  const result = evaluateUserStroke(tinyTap, verticalStroke);
  assert.equal(result.accepted, false);
  assert.equal(result.issue, 'too_short');
});

test('evaluateUserStroke rejects a stroke starting far away from target start', () => {
  const shan = getCharacterById('shan');
  const centerVertical = shan.strokes[0];
  const misplaced = [
    { x: 85, y: 17 },
    { x: 85, y: 48 },
    { x: 85, y: 78 },
  ];
  const result = evaluateUserStroke(misplaced, centerVertical);
  assert.equal(result.accepted, false);
  assert.equal(result.issue, 'wrong_start');
});

test('calculateCharacterStars awards 3 stars for high accuracy and rewards no-trace challenge', () => {
  const withTrace = calculateCharacterStars([94, 91, 90], 0, true);
  assert.equal(withTrace.stars, 3);
  assert.equal(withTrace.inkReward, 45);

  const withoutTrace = calculateCharacterStars([86, 84], 0, false);
  assert.equal(withoutTrace.stars, 3);
  assert.equal(withoutTrace.inkReward, 55);

  const withManyHints = calculateCharacterStars([86, 86], 3, true);
  assert.equal(withManyHints.stars, 1);
});
