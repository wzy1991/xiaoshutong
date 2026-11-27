export interface Point2D {
  x: number; // Normalized 0..100 inside Tianzige
  y: number; // Normalized 0..100 inside Tianzige (0 top, 100 bottom)
}

export interface CapturedPoint extends Point2D {
  pressure: number; // Normalized 0.15..1.0 brush pressure
  timestamp: number; // ms
}

export type PressureMode = 'auto' | 'light' | 'medium' | 'heavy';
export type PressureLevel = 'light' | 'medium' | 'heavy';
export type DeviationStatus =
  | 'idle'
  | 'on_track'
  | 'drifting'
  | 'off_track'
  | 'wrong_order'
  | 'reverse_direction';

export interface LiveCaptureTelemetry {
  status: DeviationStatus;
  deviation: number; // Distance in 0..100 Tianzige units
  nearestTrackPoint: Point2D | null;
  progressAlongStroke: number; // 0..1
  pressure: number; // 0.15..1.0
  pressureLevel: PressureLevel;
  wrongOrderTargetIndex: number | null;
  coachingHint: string;
}

export interface CapturedStrokeRecord {
  strokeIndex: number;
  points: CapturedPoint[];
  averagePressure: number;
  accuracy: number;
}

export interface StrokeDef {
  id: string;
  name: string; // e.g. '横', '竖', '撇', '捺', '横折', '竖钩'
  directionTip: string; // Short kid-friendly guidance e.g. '从左向右平平稳稳写横'
  points: Point2D[]; // Canonical path in 0..100 coordinates
}

export type GradeNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type SemesterId =
  | 'g1s1'
  | 'g1s2'
  | 'g2s1'
  | 'g2s2'
  | 'g3s1'
  | 'g3s2'
  | 'g4s1'
  | 'g4s2'
  | 'g5s1'
  | 'g5s2'
  | 'g6s1'
  | 'g6s2';

export type HanziStructure = '独体字' | '上下结构' | '左右结构' | '半包围' | '全包围';

export interface SemesterInfo {
  id: SemesterId;
  gradeNum: GradeNumber;
  semester: 1 | 2;
  gradeLabel: string; // e.g. '一年级上'
  gradeName: string; // e.g. '一年级'
  semesterLabel: string; // '上册' | '下册'
  title: string;
  subtitle: string;
  totalChars: number;
  unitsCount: number;
}

export interface LexiconEntry {
  id: string;
  char: string;
  pinyin: string;
  pinyinPlain: string;
  radical: string;
  structure: HanziStructure;
  semesterId: SemesterId;
  gradeNum: GradeNumber;
  grade: string; // e.g. '一年级上'
  unitIndex: number; // 1..10
  unit: string; // e.g. '第一单元'
  strokeCount: number;
  words: string[];
  mnemonic: string;
  chapterId: string;
}

export interface HanziCharacter {
  id: string;
  char: string;
  pinyin: string;
  radical: string;
  structure: HanziStructure;
  grade: string; // e.g. '一年级上'
  unit: string; // e.g. '识字一'
  meaning: string;
  words: string[];
  mnemonic: string; // Kid-friendly memory tip
  chapterId: string;
  gradeNum?: GradeNumber;
  semesterId?: SemesterId;
  unitIndex?: number;
  strokes: StrokeDef[];
}

export interface LevelChapter {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  gradeLabel: string;
  unlockStarsRequired: number;
  characterIds: string[];
}

export interface CharacterMastery {
  charId: string;
  bestStars: number; // 0..3
  bestAccuracy: number; // 0..100
  practiceCount: number;
  recognizedCount: number;
  lastPracticedAt: number;
}

export interface AchievementSeal {
  id: string;
  name: string;
  sealText: string; // 2-4 chars carved on the seal
  description: string;
  conditionText: string;
}

export interface ProgressState {
  inkPoints: number;
  bestStreak: number;
  currentStreak: number;
  gamesCompleted: number;
  mastery: Record<string, CharacterMastery>;
}

export interface StrokeEvaluation {
  accepted: boolean;
  accuracy: number; // 0..100
  feedback: string;
  issue?: 'too_short' | 'wrong_start' | 'wrong_direction' | 'off_path';
}

export type AppView = 'map' | 'studio' | 'game' | 'rewards';
export type CameraPreset = 'isometric' | 'top' | 'closeup';
export type StageDisplayMode = 'demo' | 'live_capture';
