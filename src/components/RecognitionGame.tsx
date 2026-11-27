import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Volume2,
  RotateCcw,
  Flame,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { loadCharacterWithStrokes } from '../data/hanziLexicon';
import { GradeNumber, HanziCharacter, LexiconEntry, ProgressState } from '../types/hanzi';
import {
  playCelebrationChime,
  playGentleErrorSound,
  playStrokeSuccessSound,
  speakChineseText,
} from '../utils/soundEngine';

interface RecognitionGameProps {
  catalog: LexiconEntry[];
  progress: ProgressState;
  onRecordAnswer: (charId: string, correct: boolean, isRoundComplete: boolean) => void;
  onPracticeChar: (charId: string) => void;
}

type GameMode = 'pinyin' | 'stroke_order';
type GradeScope = 'all' | GradeNumber;

interface QuizQuestion {
  target: LexiconEntry;
  targetFull?: HanziCharacter;
  options: string[];
  correctAnswer: string;
  promptTitle: string;
  promptSubtitle: string;
  highlightStrokeIndex?: number;
}

const ROUND_LENGTH = 8;

const GRADE_OPTIONS: Array<{ value: GradeScope; label: string }> = [
  { value: 'all', label: '全年级 (3,000字)' },
  { value: 1, label: '一年级' },
  { value: 2, label: '二年级' },
  { value: 3, label: '三年级' },
  { value: 4, label: '四年级' },
  { value: 5, label: '五年级' },
  { value: 6, label: '六年级' },
];

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed + 17;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getStrokeFamily(name: string): string {
  if (name.includes('折') || name.includes('钩')) return name;
  if (name.includes('横撇')) return '横撇';
  if (name.includes('点')) return '点';
  if (name.includes('撇')) return '撇';
  if (name.includes('横')) return '横';
  if (name.includes('竖')) return '竖';
  if (name.includes('捺')) return '捺';
  if (name.includes('提')) return '提';
  return name;
}

function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export const RecognitionGame: React.FC<RecognitionGameProps> = ({
  catalog,
  progress,
  onRecordAnswer,
  onPracticeChar,
}) => {
  const [mode, setMode] = useState<GameMode>('pinyin');
  const [gradeScope, setGradeScope] = useState<GradeScope>(1);
  const [roundSeed, setRoundSeed] = useState(1);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [roundFinished, setRoundFinished] = useState(false);
  const [strokeQuestions, setStrokeQuestions] = useState<QuizQuestion[]>([]);
  const [loadingStrokeQuiz, setLoadingStrokeQuiz] = useState(false);

  const scopedPool = useMemo(() => {
    const filtered =
      gradeScope === 'all'
        ? catalog
        : catalog.filter((c) => c.gradeNum === gradeScope);
    return filtered.length >= 8 ? filtered : catalog;
  }, [catalog, gradeScope]);

  const pinyinQuestions = useMemo<QuizQuestion[]>(() => {
    const selected = deterministicShuffle(scopedPool, roundSeed).slice(0, ROUND_LENGTH);
    return selected.map((target, idx) => {
      // Avoid picking homophone distractors when possible
      const nonSamePinyin = scopedPool.filter(
        (c) => c.id !== target.id && c.pinyin !== target.pinyin,
      );
      const distractorPool = nonSamePinyin.length >= 3 ? nonSamePinyin : scopedPool.filter((c) => c.id !== target.id);
      const distractors = deterministicShuffle(distractorPool, roundSeed + idx * 31)
        .slice(0, 3)
        .map((c) => c.char);

      const options = deterministicShuffle([target.char, ...distractors], roundSeed + idx * 13);
      return {
        target,
        options,
        correctAnswer: target.char,
        promptTitle: target.pinyin,
        promptSubtitle: `${target.grade} · 组词提示：${target.words.join('、')}`,
      };
    });
  }, [scopedPool, roundSeed]);

  // Build stroke-order detective questions asynchronously using real stroke data for the selected grade
  useEffect(() => {
    if (mode !== 'stroke_order') return;
    let cancelled = false;
    setLoadingStrokeQuiz(true);

    const eligible = scopedPool.filter((c) => c.strokeCount >= 2);
    const selectedEntries = deterministicShuffle(
      eligible.length >= ROUND_LENGTH ? eligible : scopedPool,
      roundSeed + 101,
    ).slice(0, ROUND_LENGTH);

    Promise.all(
      selectedEntries.map((entry) => loadCharacterWithStrokes(entry.id, catalog)),
    )
      .then((fullChars) => {
        if (cancelled) return;
        const strokeBank = ['横', '竖', '撇', '捺', '点', '提', '横折', '竖折', '竖钩', '横折钩', '横撇', '竖弯钩'];
        const built: QuizQuestion[] = fullChars.map((full, idx) => {
          const entry = selectedEntries[idx];
          const strokeIdx = idx % full.strokes.length;
          const targetStroke = full.strokes[strokeIdx];
          const targetFamily = getStrokeFamily(targetStroke.name);
          const distractors = deterministicShuffle(
            strokeBank.filter(
              (name) => name !== targetStroke.name && getStrokeFamily(name) !== targetFamily,
            ),
            roundSeed + idx * 29,
          ).slice(0, 3);
          const options = deterministicShuffle(
            [targetStroke.name, ...distractors],
            roundSeed + idx * 19,
          );
          return {
            target: entry,
            targetFull: full,
            options,
            correctAnswer: targetStroke.name,
            promptTitle: `「${full.char}」字的第 ${strokeIdx + 1} 笔是什么笔画？`,
            promptSubtitle: `${entry.grade} · 观察田字格中红色高亮的第 ${strokeIdx + 1} 笔（共 ${full.strokes.length} 画）`,
            highlightStrokeIndex: strokeIdx,
          };
        });
        setStrokeQuestions(built);
        setLoadingStrokeQuiz(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingStrokeQuiz(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, scopedPool, roundSeed, catalog]);

  const questions = mode === 'pinyin' ? pinyinQuestions : strokeQuestions;
  const currentQ = questions[questionIdx];

  const resetRound = (nextSeedDelta = 1) => {
    setRoundSeed((s) => s + nextSeedDelta);
    setQuestionIdx(0);
    setSelectedOption(null);
    setRoundScore(0);
    setRoundFinished(false);
  };

  const handleSwitchMode = (nextMode: GameMode) => {
    setMode(nextMode);
    resetRound(1);
  };

  const handleSwitchGrade = (nextGrade: GradeScope) => {
    setGradeScope(nextGrade);
    resetRound(2);
  };

  const handleAnswer = (option: string) => {
    if (selectedOption !== null || !currentQ) return;
    setSelectedOption(option);
    const isCorrect = option === currentQ.correctAnswer;
    const isLast = questionIdx + 1 >= questions.length;

    if (isCorrect) {
      setRoundScore((s) => s + 1);
      playStrokeSuccessSound(questionIdx);
      speakChineseText(currentQ.target.char);
    } else {
      playGentleErrorSound();
    }

    onRecordAnswer(currentQ.target.id, isCorrect, isLast);
  };

  const handleNextQuestion = () => {
    if (questionIdx + 1 >= questions.length) {
      setRoundFinished(true);
      playCelebrationChime();
    } else {
      setQuestionIdx((i) => i + 1);
      setSelectedOption(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header & Mode/Grade Switchers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">趣味认字与笔顺闯关</h1>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            当前连胜 {progress.currentStreak} 题 · 最高连胜 {progress.bestStreak} 题 · 墨宝积分{' '}
            {progress.inkPoints} 分
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="quiz-grade-select" className="sr-only">
            选择出题年级范围
          </label>
          <select
            id="quiz-grade-select"
            value={gradeScope}
            onChange={(e) => {
              const val = e.target.value;
              handleSwitchGrade(val === 'all' ? 'all' : (Number(val) as GradeNumber));
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 cursor-pointer"
          >
            {GRADE_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div
            className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
            role="tablist"
            aria-label="选择闯关玩法"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'pinyin'}
              onClick={() => handleSwitchMode('pinyin')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'pinyin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              听音辨字
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'stroke_order'}
              onClick={() => handleSwitchMode('stroke_order')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'stroke_order'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              笔顺小侦探
            </button>
          </div>
        </div>
      </div>

      {/* Main Quiz Arena Card */}
      {mode === 'stroke_order' && loadingStrokeQuiz ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-500">
          正在为当前年级生成笔顺侦探题目...
        </section>
      ) : !roundFinished && currentQ ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-6">
            <span className="font-mono-num">
              第 {questionIdx + 1} / {questions.length} 题
            </span>
            <div className="flex items-center gap-1.5 text-amber-700 font-medium tabular-nums">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>连胜 {progress.currentStreak}</span>
            </div>
          </div>

          <div className="text-center mb-7">
            {mode === 'pinyin' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <span className="text-4xl sm:text-5xl font-bold text-[#1E3A5F] tracking-wide">
                    {currentQ.promptTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      speakChineseText(
                        `${currentQ.target.char}，${currentQ.target.words[0] ?? ''}`,
                      )
                    }
                    aria-label="朗读拼音和词语"
                    className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-3">{currentQ.promptSubtitle}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-40 h-40 rounded-lg border border-[#D96B62] bg-[#FCFBF7] mb-4"
                  aria-label={`汉字 ${currentQ.target.char} 笔画示意图`}
                >
                  <line
                    x1="0"
                    y1="50"
                    x2="100"
                    y2="50"
                    stroke="#E5A29B"
                    strokeDasharray="3 3"
                    strokeWidth="0.8"
                  />
                  <line
                    x1="50"
                    y1="0"
                    x2="50"
                    y2="100"
                    stroke="#E5A29B"
                    strokeDasharray="3 3"
                    strokeWidth="0.8"
                  />
                  {(currentQ.targetFull?.strokes ?? []).map((st, idx) => {
                    const isHighlighted = idx === currentQ.highlightStrokeIndex;
                    const strokeW =
                      (currentQ.targetFull?.strokes.length ?? 4) >= 12
                        ? isHighlighted
                          ? 5.5
                          : 3.8
                        : isHighlighted
                          ? 7.5
                          : 5.5;
                    return (
                      <path
                        key={st.id}
                        d={pointsToSvgPath(st.points)}
                        fill="none"
                        stroke={isHighlighted ? '#D93829' : '#CBD5E1'}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </svg>
                <h2 className="text-lg font-semibold text-slate-900">{currentQ.promptTitle}</h2>
                <p className="text-xs text-slate-500 mt-1">{currentQ.promptSubtitle}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {currentQ.options.map((opt) => {
              const isSelected = selectedOption === opt;
              const isCorrectChoice = opt === currentQ.correctAnswer;
              let btnStyle =
                'border-slate-200 bg-white hover:border-[#1E3A5F] hover:bg-slate-50 text-slate-900';

              if (selectedOption !== null) {
                if (isCorrectChoice) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                } else if (isSelected) {
                  btnStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                } else {
                  btnStyle = 'border-slate-200 bg-slate-50/50 text-slate-400';
                }
              }

              return (
                <button
                  key={opt}
                  type="button"
                  disabled={selectedOption !== null}
                  onClick={() => handleAnswer(opt)}
                  className={`rounded-xl border-2 p-5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <span
                    className={
                      mode === 'pinyin'
                        ? 'font-hanzi text-4xl font-bold'
                        : 'text-lg font-semibold'
                    }
                  >
                    {opt}
                  </span>
                  {selectedOption !== null && isCorrectChoice && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {selectedOption !== null && isSelected && !isCorrectChoice && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <div
              role="status"
              className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                {selectedOption === currentQ.correctAnswer ? (
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>回答正确！墨宝积分增加！</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-rose-800 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>正确答案是「{currentQ.correctAnswer}」</span>
                  </p>
                )}
                <p className="text-xs text-slate-600 mt-1">
                  记忆要点：{currentQ.target.mnemonic}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onPracticeChar(currentQ.target.id)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  3D 练写「{currentQ.target.char}」
                </button>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D93829] text-white text-xs font-medium hover:bg-[#B91C1C] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{questionIdx + 1 >= questions.length ? '查看成绩' : '下一题'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-slate-900">本轮认字闯关完成！</h2>
          <p className="text-sm text-slate-600 mt-2 tabular-nums">
            答对 <strong className="text-slate-900">{roundScore}</strong> / {questions.length} 题 ·
            累计墨宝积分 <strong className="text-[#1E3A5F]">{progress.inkPoints}</strong> 分
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => resetRound(3)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#D93829] text-white text-sm font-medium hover:bg-[#B91C1C] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>再来一轮</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
