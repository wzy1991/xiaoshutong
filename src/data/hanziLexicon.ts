import {
  GradeNumber,
  HanziCharacter,
  HanziStructure,
  LexiconEntry,
  ProgressState,
  SemesterId,
  SemesterInfo,
  StrokeDef,
} from '../types/hanzi';
import { HANZI_CHARACTERS } from './hanziCurriculum';

export const TOTAL_LEXICON_COUNT = 3000;

export const GRADE_SEMESTERS: SemesterInfo[] = [
  {
    id: 'g1s1',
    gradeNum: 1,
    semester: 1,
    gradeLabel: '一年级上',
    gradeName: '一年级',
    semesterLabel: '上册',
    title: '一年级上册 · 象形启蒙与基础识字',
    subtitle: '涵盖一至八画高频启蒙字，打牢横竖撇捺点基本笔画与规范笔顺。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g1s2',
    gradeNum: 1,
    semester: 2,
    gradeLabel: '一年级下',
    gradeName: '一年级',
    semesterLabel: '下册',
    title: '一年级下册 · 生活百态与常用偏旁',
    subtitle: '认识常见偏旁部首，掌握左右与上下结构汉字的对称平稳写法。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g2s1',
    gradeNum: 2,
    semester: 1,
    gradeLabel: '二年级上',
    gradeName: '二年级',
    semesterLabel: '上册',
    title: '二年级上册 · 校园生活与自然童趣',
    subtitle: '进阶练习折钩笔画与复合部首，丰富日常阅读与组词表达。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g2s2',
    gradeNum: 2,
    semester: 2,
    gradeLabel: '二年级下',
    gradeName: '二年级',
    semesterLabel: '下册',
    title: '二年级下册 · 四季风光与寓言故事',
    subtitle: '训练半包围与全包围结构笔顺规则，提升独立识字与控笔稳定性。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g3s1',
    gradeNum: 3,
    semester: 1,
    gradeLabel: '三年级上',
    gradeName: '三年级',
    semesterLabel: '上册',
    title: '三年级上册 · 童话山河与习作起步',
    subtitle: '迈入中年段核心字库，攻克形近字辨析与多部件汉字空间排布。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g3s2',
    gradeNum: 3,
    semester: 2,
    gradeLabel: '三年级下',
    gradeName: '三年级',
    semesterLabel: '下册',
    title: '三年级下册 · 传统技艺与自然观察',
    subtitle: '积累描写、叙事高频汉字，练习笔画避让穿插与紧凑结构。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g4s1',
    gradeNum: 4,
    semester: 1,
    gradeLabel: '四年级上',
    gradeName: '四年级',
    semesterLabel: '上册',
    title: '四年级上册 · 奇观探索与神话传说',
    subtitle: '拓展中高频书面语汉字，强化长篇阅读理解与工整行楷过渡。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g4s2',
    gradeNum: 4,
    semester: 2,
    gradeLabel: '四年级下',
    gradeName: '四年级',
    semesterLabel: '下册',
    title: '四年级下册 · 科学发现与田园诗意',
    subtitle: '攻克十画以上多笔画汉字，做到主笔突出、疏密有致。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g5s1',
    gradeNum: 5,
    semester: 1,
    gradeLabel: '五年级上',
    gradeName: '五年级',
    semesterLabel: '上册',
    title: '五年级上册 · 经典散文与民间故事',
    subtitle: '进入高年段深度字库，掌握文学描写与成语核心汉字。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g5s2',
    gradeNum: 5,
    semester: 2,
    gradeLabel: '五年级下',
    gradeName: '五年级',
    semesterLabel: '下册',
    title: '五年级下册 · 名著导读与汉字文化',
    subtitle: '领略古典名著与汉字演变之美，精准书写复杂偏旁组合。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g6s1',
    gradeNum: 6,
    semester: 1,
    gradeLabel: '六年级上',
    gradeName: '六年级',
    semesterLabel: '上册',
    title: '六年级上册 · 锦绣山河与艺术人生',
    subtitle: '涵盖高阶书面语与古诗词常用字，全面衔接小升初语文素养。',
    totalChars: 250,
    unitsCount: 10,
  },
  {
    id: 'g6s2',
    gradeNum: 6,
    semester: 2,
    gradeLabel: '六年级下',
    gradeName: '六年级',
    semesterLabel: '下册',
    title: '六年级下册 · 综合冲刺与博学精进',
    subtitle: '冲刺小学阶段 3,000 规范汉字全覆盖，熟练驾驭繁难字规范笔顺。',
    totalChars: 250,
    unitsCount: 10,
  },
];

const SEMESTER_MAP = new Map<SemesterId, SemesterInfo>(
  GRADE_SEMESTERS.map((s) => [s.id, s]),
);

const STRUCTURE_LIST: HanziStructure[] = ['独体字', '左右结构', '上下结构', '半包围', '全包围'];
const UNIT_CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export type RawCatalogTuple = [
  string, // 0: id
  string, // 1: char
  string, // 2: pinyin
  string, // 3: pinyinPlain
  string, // 4: radical
  number, // 5: structCode
  SemesterId, // 6: semesterId
  number, // 7: unitIndex (1..10)
  number, // 8: strokeCount
  string[], // 9: words
  string, // 10: mnemonic
];

export type RawCompactStroke = [string, number[]];

export function getSemesterInfo(semesterId: SemesterId): SemesterInfo {
  return SEMESTER_MAP.get(semesterId) ?? GRADE_SEMESTERS[0];
}

export function getUnitLabel(unitIndex: number): string {
  const cn = UNIT_CN_NUM[Math.max(0, Math.min(9, unitIndex - 1))] ?? String(unitIndex);
  return `第${cn}单元`;
}

export function getStrokeDirectionTip(strokeName: string): string {
  if (strokeName.includes('横折弯钩')) return '先右横，顿笔折下再圆转向右平拖，最后向上轻快出钩';
  if (strokeName.includes('横折折撇') || strokeName.includes('横撇弯钩')) return '先横折转笔，顺势左下轻快撇出或弯钩收笔';
  if (strokeName.includes('横折钩')) return '从左向右写横，转折顿笔向下行笔，末端向左上出钩';
  if (strokeName.includes('横折提')) return '先向右写横，顿笔垂直向下，再向右上轻快挑提';
  if (strokeName.includes('横折')) return '先从左向右行横，顿笔转折向下收笔';
  if (strokeName.includes('横撇')) return '先从左向右平横，折锋向左下方舒展撇出';
  if (strokeName.includes('横钩')) return '从左向右平横，末端顿笔向左下方短促出钩';
  if (strokeName.includes('竖弯钩')) return '先垂直向下行笔，圆转向右平拖，末端向上有力出钩';
  if (strokeName.includes('竖折折钩')) return '先竖后横再折竖，末尾向左上轻快出钩';
  if (strokeName.includes('竖折')) return '先从上往下写竖，转折向右平稳写横';
  if (strokeName.includes('竖提')) return '垂直向下行笔，末端顿笔向右上轻快挑出';
  if (strokeName.includes('竖钩')) return '从上到下垂直行笔，末端顿笔向左上轻快出钩';
  if (strokeName.includes('卧钩')) return '顺势右下弧形躺卧，末端向左上轻快挑钩';
  if (strokeName.includes('斜钩')) return '从左上向右下方微弯斜行，末尾向上劲挺出钩';
  if (strokeName.includes('弯钩')) return '微弯向下行笔，重心对正，末端向左上出钩';
  if (strokeName.includes('撇点')) return '先向左下斜撇，再顿笔向右下方稳稳写长点';
  if (strokeName.includes('撇折')) return '先向左下斜撇，顿笔向右略上挑横折收笔';
  if (strokeName.includes('提')) return '顿笔起笔，向右上斜方果断轻快挑出';
  if (strokeName.includes('横')) return '从左向右略微右上倾斜，行笔平稳有力';
  if (strokeName.includes('竖')) return '从上到下垂直稳健行笔，重心挺拔端正';
  if (strokeName.includes('撇')) return '顿笔起笔向左下方舒展撇出，行笔流畅轻盈';
  if (strokeName.includes('捺')) return '轻起向右下方渐按行笔，顿笔平出捺脚';
  if (strokeName.includes('点')) return '轻落微按，小巧饱满有神';
  return '顺着红色起笔点沿着轨迹稳稳运笔';
}

export function decodeCatalogTuples(tuples: RawCatalogTuple[]): LexiconEntry[] {
  return tuples.map((t) => {
    const sem = getSemesterInfo(t[6]);
    return {
      id: t[0],
      char: t[1],
      pinyin: t[2],
      pinyinPlain: t[3],
      radical: t[4],
      structure: STRUCTURE_LIST[t[5]] ?? '独体字',
      semesterId: t[6],
      gradeNum: sem.gradeNum,
      grade: sem.gradeLabel,
      unitIndex: t[7],
      unit: getUnitLabel(t[7]),
      strokeCount: t[8],
      words: t[9],
      mnemonic: t[10],
      chapterId: t[6],
    };
  });
}

export function decodeCompactStrokes(charId: string, compact: RawCompactStroke[]): StrokeDef[] {
  return compact.map(([name, flat], idx) => {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      points.push({
        x: flat[i] / 10,
        y: flat[i + 1] / 10,
      });
    }
    if (points.length < 2) {
      points.push({ x: 48, y: 48 }, { x: 52, y: 52 });
    }
    return {
      id: `${charId}-${idx + 1}`,
      name,
      directionTip: getStrokeDirectionTip(name),
      points,
    };
  });
}

const BUNDLED_BY_ID = new Map<string, HanziCharacter>(
  HANZI_CHARACTERS.map((c) => [c.id, c]),
);

const BUNDLED_FALLBACK_CATALOG: LexiconEntry[] = HANZI_CHARACTERS.map((c, idx) => ({
  id: c.id,
  char: c.char,
  pinyin: c.pinyin,
  pinyinPlain: c.pinyin
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase(),
  radical: c.radical,
  structure: c.structure,
  semesterId: 'g1s1',
  gradeNum: 1,
  grade: '一年级上',
  unitIndex: 1,
  unit: '第一单元',
  strokeCount: c.strokes.length,
  words: c.words,
  mnemonic: c.mnemonic,
  chapterId: idx < 24 ? 'g1s1' : 'g1s1',
}));

export function getBundledFallbackCatalog(): LexiconEntry[] {
  return BUNDLED_FALLBACK_CATALOG;
}

export interface LexiconFilterOptions {
  gradeNum?: GradeNumber | 'all';
  semesterId?: SemesterId | 'all';
  unitIndex?: number | 'all';
  query?: string;
  masteryFilter?: 'all' | 'unpracticed' | 'practiced' | 'three_star';
  progress?: ProgressState;
}

export function filterLexicon(
  entries: LexiconEntry[],
  opts: LexiconFilterOptions,
): LexiconEntry[] {
  const rawQuery = (opts.query ?? '').trim().toLowerCase();
  const hasQuery = rawQuery.length > 0;
  const plainQuery = rawQuery
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'v');

  return entries.filter((entry) => {
    // When searching with text, search across ALL 3,000 characters unless grade explicitly restricted
    if (!hasQuery) {
      if (opts.semesterId && opts.semesterId !== 'all' && entry.semesterId !== opts.semesterId) {
        return false;
      }
      if (opts.gradeNum && opts.gradeNum !== 'all' && entry.gradeNum !== opts.gradeNum) {
        return false;
      }
      if (opts.unitIndex && opts.unitIndex !== 'all' && entry.unitIndex !== opts.unitIndex) {
        return false;
      }
    } else {
      const charMatch = entry.char.includes(rawQuery);
      const radicalMatch = entry.radical === rawQuery;
      const pinyinMatch =
        entry.pinyin.toLowerCase().includes(rawQuery) ||
        entry.pinyinPlain.startsWith(plainQuery) ||
        entry.pinyinPlain === plainQuery;
      const wordMatch = entry.words.some((w) => w.includes(rawQuery));
      if (!charMatch && !radicalMatch && !pinyinMatch && !wordMatch) {
        return false;
      }
    }

    if (opts.masteryFilter && opts.masteryFilter !== 'all' && opts.progress) {
      const stars = opts.progress.mastery[entry.id]?.bestStars ?? 0;
      if (opts.masteryFilter === 'unpracticed' && stars > 0) return false;
      if (opts.masteryFilter === 'practiced' && stars === 0) return false;
      if (opts.masteryFilter === 'three_star' && stars < 3) return false;
    }

    return true;
  });
}

// In-memory browser caches
let catalogCache: LexiconEntry[] | null = null;
let catalogPromise: Promise<LexiconEntry[]> | null = null;
const strokeChunkCache = new Map<SemesterId, Record<string, RawCompactStroke[]>>();
const strokeChunkPromises = new Map<SemesterId, Promise<Record<string, RawCompactStroke[]>>>();

export async function loadFullCatalog(): Promise<LexiconEntry[]> {
  if (catalogCache) return catalogCache;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const res = await fetch('/hanzi-data/catalog.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tuples = (await res.json()) as RawCatalogTuple[];
      const decoded = decodeCatalogTuples(tuples);
      catalogCache = decoded;
      return decoded;
    } catch {
      return BUNDLED_FALLBACK_CATALOG;
    }
  })();

  return catalogPromise;
}

export async function loadSemesterStrokesRaw(
  semesterId: SemesterId,
): Promise<Record<string, RawCompactStroke[]>> {
  const cached = strokeChunkCache.get(semesterId);
  if (cached) return cached;

  const existing = strokeChunkPromises.get(semesterId);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(`/hanzi-data/strokes/${semesterId}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load stroke chunk ${semesterId}: HTTP ${res.status}`);
    }
    const data = (await res.json()) as Record<string, RawCompactStroke[]>;
    strokeChunkCache.set(semesterId, data);
    return data;
  })();

  strokeChunkPromises.set(semesterId, promise);
  return promise;
}

export async function loadCharacterWithStrokes(
  charId: string,
  catalogEntries?: LexiconEntry[],
): Promise<HanziCharacter> {
  // Fast synchronous path for our 24 hand-crafted showcase characters
  const bundled = BUNDLED_BY_ID.get(charId);
  if (bundled) {
    return {
      ...bundled,
      gradeNum: 1,
      semesterId: 'g1s1',
      unitIndex: 1,
    };
  }

  const catalog = catalogEntries && catalogEntries.length > 24 ? catalogEntries : await loadFullCatalog();
  const entry = catalog.find((c) => c.id === charId || c.char === charId);
  if (!entry) {
    return {
      ...HANZI_CHARACTERS[0],
      gradeNum: 1,
      semesterId: 'g1s1',
      unitIndex: 1,
    };
  }

  const chunk = await loadSemesterStrokesRaw(entry.semesterId);
  const compact = chunk[entry.id];
  const strokes = compact ? decodeCompactStrokes(entry.id, compact) : HANZI_CHARACTERS[0].strokes;

  return {
    id: entry.id,
    char: entry.char,
    pinyin: entry.pinyin,
    radical: entry.radical,
    structure: entry.structure,
    grade: entry.grade,
    unit: entry.unit,
    meaning: entry.words.length > 0 ? `常用词语：${entry.words.join('、')}` : `规范汉字「${entry.char}」`,
    words: entry.words,
    mnemonic: entry.mnemonic,
    chapterId: entry.semesterId,
    gradeNum: entry.gradeNum,
    semesterId: entry.semesterId,
    unitIndex: entry.unitIndex,
    strokes,
  };
}
