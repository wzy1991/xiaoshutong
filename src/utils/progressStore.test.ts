import test from 'node:test';
import assert from 'node:assert/strict';
import { HANZI_CHARACTERS, LEVEL_CHAPTERS } from '../data/hanziCurriculum';
import {
  createInitialProgress,
  getChapterStats,
  getMasteredCount,
  getNextRecommendedCharId,
  getTotalStars,
  getUnlockedSealIds,
  isChapterUnlocked,
  recordRecognitionAnswer,
  recordWritingCompletion,
} from './progressStore';

test('curriculum integrity: every chapter references valid characters with non-empty strokes', () => {
  assert.equal(LEVEL_CHAPTERS.length, 4);
  assert.equal(HANZI_CHARACTERS.length, 24);
  for (const ch of LEVEL_CHAPTERS) {
    assert.ok(ch.characterIds.length >= 6);
    for (const cid of ch.characterIds) {
      const found = HANZI_CHARACTERS.find((c) => c.id === cid);
      assert.ok(found, `Missing character ${cid} in chapter ${ch.id}`);
      assert.ok(found.strokes.length >= 1, `Character ${cid} must have strokes`);
      for (const s of found.strokes) {
        assert.ok(s.points.length >= 2, `Stroke ${s.id} must have at least 2 points`);
      }
    }
  }
});

test('progress store unlocks chapters and seals as stars accumulate', () => {
  let state = createInitialProgress();
  assert.equal(isChapterUnlocked(state, 'ch1'), true);
  assert.equal(isChapterUnlocked(state, 'ch2'), false);
  assert.equal(getUnlockedSealIds(state).length, 0);

  // Earn 3 stars on two Chapter 1 characters -> 6 stars unlocks Chapter 2
  state = recordWritingCompletion(state, 'yi', 3, 95, 45, 1000);
  state = recordWritingCompletion(state, 'er', 3, 92, 45, 2000);

  assert.equal(getTotalStars(state), 6);
  assert.equal(getMasteredCount(state), 2);
  assert.equal(isChapterUnlocked(state, 'ch2'), true);

  const seals = getUnlockedSealIds(state);
  assert.ok(seals.includes('first_char'));
  assert.ok(seals.includes('three_star_master'));
  assert.equal(getNextRecommendedCharId(state), 'san');
});

test('recognition game streak awards bonus ink points and unlocks quiz streak seal at 5', () => {
  let state = createInitialProgress();
  for (let i = 0; i < 5; i++) {
    state = recordRecognitionAnswer(state, 'yi', true, i === 4);
  }
  assert.equal(state.currentStreak, 5);
  assert.equal(state.bestStreak, 5);
  assert.equal(state.gamesCompleted, 1);
  assert.ok(state.inkPoints >= 70);
  assert.ok(getUnlockedSealIds(state).includes('quiz_streak'));

  // Wrong answer resets currentStreak but preserves bestStreak
  state = recordRecognitionAnswer(state, 'er', false, false);
  assert.equal(state.currentStreak, 0);
  assert.equal(state.bestStreak, 5);
});

test('chapter stats accurately count completed characters and stars', () => {
  let state = createInitialProgress();
  for (const cid of LEVEL_CHAPTERS[0].characterIds) {
    state = recordWritingCompletion(state, cid, 2, 82, 30, 5000);
  }
  const stats = getChapterStats(state, 'ch1');
  assert.equal(stats.completedChars, 6);
  assert.equal(stats.earnedStars, 12);
  assert.equal(stats.maxStars, 18);
  assert.ok(getUnlockedSealIds(state).includes('chapter1_clear'));
});
