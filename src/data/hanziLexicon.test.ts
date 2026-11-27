import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  decodeCatalogTuples,
  decodeCompactStrokes,
  filterLexicon,
  GRADE_SEMESTERS,
  RawCatalogTuple,
  RawCompactStroke,
  TOTAL_LEXICON_COUNT,
} from './hanziLexicon';
import { createInitialProgress, recordWritingCompletion } from '../utils/progressStore';

const CATALOG_PATH = path.resolve(process.cwd(), 'public/hanzi-data/catalog.json');
const STROKES_DIR = path.resolve(process.cwd(), 'public/hanzi-data/strokes');

test('generated catalog covers 3,000 unique characters evenly across Grade 1 to Grade 6 (12 semesters)', () => {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RawCatalogTuple[];
  const entries = decodeCatalogTuples(raw);

  assert.equal(entries.length, TOTAL_LEXICON_COUNT);
  assert.equal(GRADE_SEMESTERS.length, 12);

  const uniqueChars = new Set(entries.map((e) => e.char));
  const uniqueIds = new Set(entries.map((e) => e.id));
  assert.equal(uniqueChars.size, 3000, 'Every character must be unique');
  assert.equal(uniqueIds.size, 3000, 'Every character ID must be unique');

  // Verify each of the 12 semesters has exactly 250 characters across 10 units
  for (const sem of GRADE_SEMESTERS) {
    const semChars = entries.filter((e) => e.semesterId === sem.id);
    assert.equal(semChars.length, 250, `Semester ${sem.id} must have 250 chars`);
    const units = new Set(semChars.map((e) => e.unitIndex));
    assert.equal(units.size, 10, `Semester ${sem.id} must span 10 units`);
  }
});

test('all 12 semester stroke chunks decode into valid 0..100 Tianzige polylines for every single character', () => {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RawCatalogTuple[];
  const entries = decodeCatalogTuples(raw);

  let verifiedCount = 0;
  for (const sem of GRADE_SEMESTERS) {
    const chunkPath = path.join(STROKES_DIR, `${sem.id}.json`);
    assert.ok(fs.existsSync(chunkPath), `Missing stroke chunk ${sem.id}.json`);
    const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8')) as Record<string, RawCompactStroke[]>;
    const semEntries = entries.filter((e) => e.semesterId === sem.id);

    for (const entry of semEntries) {
      const compact = chunk[entry.id];
      assert.ok(Array.isArray(compact) && compact.length >= 1, `Missing strokes for ${entry.char} (${entry.id})`);
      const strokes = decodeCompactStrokes(entry.id, compact);
      assert.equal(strokes.length, entry.strokeCount, `Stroke count mismatch for ${entry.char}`);
      for (const st of strokes) {
        assert.ok(st.name.length >= 1, `Empty stroke name on ${entry.char}`);
        assert.ok(st.points.length >= 2, `Stroke ${st.id} must have >= 2 points`);
        for (const pt of st.points) {
          assert.ok(pt.x >= 0 && pt.x <= 100 && pt.y >= 0 && pt.y <= 100, `Out of bounds point on ${entry.char}`);
        }
      }
      verifiedCount++;
    }
  }
  assert.equal(verifiedCount, 3000);
});

test('filterLexicon supports grade/semester/unit filtering, full-library search (char/pinyin/radical/word), and mastery filter', () => {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RawCatalogTuple[];
  const entries = decodeCatalogTuples(raw);

  // Filter Grade 6 Semester 2 Unit 10
  const g6u10 = filterLexicon(entries, { semesterId: 'g6s2', unitIndex: 10 });
  assert.equal(g6u10.length, 25);
  assert.ok(g6u10.every((e) => e.gradeNum === 6 && e.unitIndex === 10));

  // Search by exact Chinese char across all grades
  const springRes = filterLexicon(entries, { query: '春' });
  assert.ok(springRes.some((e) => e.char === '春'));

  // Search by tone-less ASCII pinyin
  const longRes = filterLexicon(entries, { query: 'long' });
  assert.ok(longRes.some((e) => e.char === '龙'), 'Pinyin search "long" must match 龙');

  // Search by radical
  const waterRad = filterLexicon(entries, { query: '氵' });
  assert.ok(waterRad.length >= 30, 'Radical 氵 should return many water-radical characters');

  // Mastery filter
  let progress = createInitialProgress();
  progress = recordWritingCompletion(progress, 'yi', 3, 98, 45);
  const threeStar = filterLexicon(entries, { masteryFilter: 'three_star', progress });
  assert.equal(threeStar.length, 1);
  assert.equal(threeStar[0].id, 'yi');
});
