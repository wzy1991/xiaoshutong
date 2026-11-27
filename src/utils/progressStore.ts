import { HANZI_CHARACTERS, LEVEL_CHAPTERS } from '../data/hanziCurriculum';
import { AchievementSeal, GradeNumber, LexiconEntry, ProgressState, SemesterId } from '../types/hanzi';

export const STORAGE_KEY = 'moyun_hanzi_progress_v1';

export const ACHIEVEMENT_SEALS: AchievementSeal[] = [
  {
    id: 'first_char',
    name: '启蒙小书童',
    sealText: '启蒙',
    description: '完成第一个小学语文生字的规范书写练习',
    conditionText: '掌握至少 1 个生字',
  },
  {
    id: 'three_star_master',
    name: '满星小书法家',
    sealText: '满星',
    description: '在一次书写中拿下三颗星的高精准评价',
    conditionText: '任意 1 个生字获得 3 星',
  },
  {
    id: 'chapter1_clear',
    name: '象形探索者',
    sealText: '象形',
    description: '完成第一关“象形启蒙”的全部六个生字',
    conditionText: '第一关 6 字全部点亮',
  },
  {
    id: 'chapter2_clear',
    name: '山水小画师',
    sealText: '山水',
    description: '完成第二关“山水自然”的全部六个生字',
    conditionText: '第二关 6 字全部点亮',
  },
  {
    id: 'quiz_streak',
    name: '火眼金睛',
    sealText: '明辨',
    description: '在认字闯关游戏中连续答对 5 题以上',
    conditionText: '认字闯关连胜达到 5 题',
  },
  {
    id: 'ink_collector',
    name: '勤学墨宝',
    sealText: '墨宝',
    description: '坚持每日书写与认字，累计获得 200 墨宝积分',
    conditionText: '墨宝积分达到 200',
  },
  {
    id: 'ten_chars',
    name: '笔顺小能手',
    sealText: '笔顺',
    description: '熟练掌握 10 个以上教材生字的正确笔顺',
    conditionText: '掌握至少 10 个生字',
  },
  {
    id: 'grand_master',
    name: '翰墨全能王',
    sealText: '翰墨',
    description: '累计拿下 48 颗书写星星，笔法稳健端庄',
    conditionText: '累计获得 48 颗星星',
  },
  {
    id: 'hundred_chars',
    name: '百字小秀才',
    sealText: '百字',
    description: '跨越小学基础字库，熟练掌握 100 个规范生字',
    conditionText: '掌握至少 100 个生字',
  },
  {
    id: 'three_hundred_chars',
    name: '博学小书生',
    sealText: '博学',
    description: '持之以恒练习，掌握 300 个以上小学常用生字',
    conditionText: '掌握至少 300 个生字',
  },
  {
    id: 'thousand_chars',
    name: '千字小状元',
    sealText: '千字',
    description: '精通千字书写规范，堪称校园书法榜样',
    conditionText: '掌握至少 1,000 个生字',
  },
  {
    id: 'three_thousand_master',
    name: '小学全通大师',
    sealText: '通达',
    description: '攻克一年级至六年级 3,000 规范汉字字库',
    conditionText: '掌握 2,500 个以上生字',
  },
];

export function createInitialProgress(): ProgressState {
  return {
    inkPoints: 0,
    bestStreak: 0,
    currentStreak: 0,
    gamesCompleted: 0,
    mastery: {},
  };
}

export function loadProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      inkPoints: typeof parsed.inkPoints === 'number' ? parsed.inkPoints : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
      gamesCompleted: typeof parsed.gamesCompleted === 'number' ? parsed.gamesCompleted : 0,
      mastery: parsed.mastery && typeof parsed.mastery === 'object' ? parsed.mastery : {},
    };
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(state: ProgressState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function getTotalStars(state: ProgressState): number {
  return Object.values(state.mastery).reduce((sum, item) => sum + Math.min(3, item.bestStars), 0);
}

export function getMasteredCount(state: ProgressState): number {
  return Object.values(state.mastery).filter((item) => item.bestStars >= 1).length;
}

export function isChapterUnlocked(state: ProgressState, chapterId: string): boolean {
  const chapter = LEVEL_CHAPTERS.find((ch) => ch.id === chapterId);
  if (!chapter) return false;
  return getTotalStars(state) >= chapter.unlockStarsRequired;
}

export function getChapterStats(state: ProgressState, chapterId: string): {
  earnedStars: number;
  maxStars: number;
  completedChars: number;
  totalChars: number;
  unlocked: boolean;
} {
  const chapter = LEVEL_CHAPTERS.find((ch) => ch.id === chapterId);
  if (!chapter) {
    return { earnedStars: 0, maxStars: 0, completedChars: 0, totalChars: 0, unlocked: false };
  }
  const totalChars = chapter.characterIds.length;
  const maxStars = totalChars * 3;
  let earnedStars = 0;
  let completedChars = 0;

  for (const cid of chapter.characterIds) {
    const m = state.mastery[cid];
    if (m && m.bestStars > 0) {
      earnedStars += Math.min(3, m.bestStars);
      completedChars += 1;
    }
  }

  return {
    earnedStars,
    maxStars,
    completedChars,
    totalChars,
    unlocked: getTotalStars(state) >= chapter.unlockStarsRequired,
  };
}

export function recordWritingCompletion(
  state: ProgressState,
  charId: string,
  stars: number,
  accuracy: number,
  inkReward: number,
  now = Date.now(),
): ProgressState {
  const prev = state.mastery[charId];
  const nextMastery = {
    charId,
    bestStars: Math.max(prev?.bestStars ?? 0, Math.min(3, Math.max(1, stars))),
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
    practiceCount: (prev?.practiceCount ?? 0) + 1,
    recognizedCount: prev?.recognizedCount ?? 0,
    lastPracticedAt: now,
  };

  return {
    ...state,
    inkPoints: state.inkPoints + inkReward,
    mastery: {
      ...state.mastery,
      [charId]: nextMastery,
    },
  };
}

export function recordRecognitionAnswer(
  state: ProgressState,
  charId: string,
  correct: boolean,
  isRoundComplete = false,
): ProgressState {
  const nextStreak = correct ? state.currentStreak + 1 : 0;
  const bestStreak = Math.max(state.bestStreak, nextStreak);
  const pointsDelta = correct ? 10 + Math.min(10, (nextStreak - 1) * 2) : 0;

  const prev = state.mastery[charId];
  const nextMastery = correct
    ? {
        ...state.mastery,
        [charId]: {
          charId,
          bestStars: prev?.bestStars ?? 0,
          bestAccuracy: prev?.bestAccuracy ?? 0,
          practiceCount: prev?.practiceCount ?? 0,
          recognizedCount: (prev?.recognizedCount ?? 0) + 1,
          lastPracticedAt: prev?.lastPracticedAt ?? Date.now(),
        },
      }
    : state.mastery;

  return {
    ...state,
    inkPoints: state.inkPoints + pointsDelta,
    currentStreak: nextStreak,
    bestStreak,
    gamesCompleted: isRoundComplete ? state.gamesCompleted + 1 : state.gamesCompleted,
    mastery: nextMastery,
  };
}

export function getUnlockedSealIds(state: ProgressState): string[] {
  const unlocked: string[] = [];
  const masteredCount = getMasteredCount(state);
  const totalStars = getTotalStars(state);
  const hasThreeStar = Object.values(state.mastery).some((m) => m.bestStars >= 3);
  const ch1 = getChapterStats(state, 'ch1');
  const ch2 = getChapterStats(state, 'ch2');

  if (masteredCount >= 1) unlocked.push('first_char');
  if (hasThreeStar) unlocked.push('three_star_master');
  if (ch1.totalChars > 0 && ch1.completedChars >= ch1.totalChars) unlocked.push('chapter1_clear');
  if (ch2.totalChars > 0 && ch2.completedChars >= ch2.totalChars) unlocked.push('chapter2_clear');
  if (state.bestStreak >= 5) unlocked.push('quiz_streak');
  if (state.inkPoints >= 200) unlocked.push('ink_collector');
  if (masteredCount >= 10) unlocked.push('ten_chars');
  if (totalStars >= 48) unlocked.push('grand_master');
  if (masteredCount >= 100) unlocked.push('hundred_chars');
  if (masteredCount >= 300) unlocked.push('three_hundred_chars');
  if (masteredCount >= 1000) unlocked.push('thousand_chars');
  if (masteredCount >= 2500) unlocked.push('three_thousand_master');

  return unlocked;
}

export function getSemesterStats(
  state: ProgressState,
  catalog: LexiconEntry[],
  semesterId: SemesterId,
): { earnedStars: number; maxStars: number; completedChars: number; totalChars: number } {
  let earnedStars = 0;
  let completedChars = 0;
  let totalChars = 0;
  for (const item of catalog) {
    if (item.semesterId !== semesterId) continue;
    totalChars += 1;
    const m = state.mastery[item.id];
    if (m && m.bestStars > 0) {
      earnedStars += Math.min(3, m.bestStars);
      completedChars += 1;
    }
  }
  return {
    earnedStars,
    maxStars: totalChars * 3,
    completedChars,
    totalChars,
  };
}

export function getGradeStats(
  state: ProgressState,
  catalog: LexiconEntry[],
  gradeNum: GradeNumber,
): { earnedStars: number; maxStars: number; completedChars: number; totalChars: number } {
  let earnedStars = 0;
  let completedChars = 0;
  let totalChars = 0;
  for (const item of catalog) {
    if (item.gradeNum !== gradeNum) continue;
    totalChars += 1;
    const m = state.mastery[item.id];
    if (m && m.bestStars > 0) {
      earnedStars += Math.min(3, m.bestStars);
      completedChars += 1;
    }
  }
  return {
    earnedStars,
    maxStars: totalChars * 3,
    completedChars,
    totalChars,
  };
}

export function getNextRecommendedCharId(state: ProgressState, catalog?: LexiconEntry[]): string {
  if (catalog && catalog.length > 0) {
    for (const item of catalog) {
      const m = state.mastery[item.id];
      if (!m || m.bestStars === 0) return item.id;
    }
  }
  for (const ch of LEVEL_CHAPTERS) {
    if (!isChapterUnlocked(state, ch.id)) continue;
    for (const cid of ch.characterIds) {
      const m = state.mastery[cid];
      if (!m || m.bestStars === 0) return cid;
    }
  }
  for (const c of HANZI_CHARACTERS) {
    const m = state.mastery[c.id];
    if (!m || m.bestStars < 3) return c.id;
  }
  return HANZI_CHARACTERS[0].id;
}
