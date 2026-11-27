import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Star, Volume2, X } from 'lucide-react';
import {
  filterLexicon,
  getUnitLabel,
  GRADE_SEMESTERS,
} from '../data/hanziLexicon';
import {
  CapturedPoint,
  CapturedStrokeRecord,
  HanziCharacter,
  LexiconEntry,
  LiveCaptureTelemetry,
  ProgressState,
  SemesterId,
  StageDisplayMode,
} from '../types/hanzi';
import { speakChineseText } from '../utils/soundEngine';
import { Hanzi3DStage } from './Hanzi3DStage';
import { WritingCanvasPad } from './WritingCanvasPad';

interface PracticeStudioProps {
  character: HanziCharacter;
  isLoadingCharacter?: boolean;
  catalog: LexiconEntry[];
  progress: ProgressState;
  onSelectCharacter: (charId: string) => void;
  onBackToMap: () => void;
  onWritingComplete: (
    charId: string,
    result: { stars: number; averageAccuracy: number; inkReward: number },
  ) => void;
}

const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const PracticeStudio: React.FC<PracticeStudioProps> = ({
  character,
  isLoadingCharacter = false,
  catalog,
  progress,
  onSelectCharacter,
  onBackToMap,
  onWritingComplete,
}) => {
  const [focusedStrokeIdx, setFocusedStrokeIdx] = useState<number | null>(null);
  const [live3DStrokeIdx, setLive3DStrokeIdx] = useState<number>(0);
  const [stageMode, setStageMode] = useState<StageDisplayMode>('demo');
  const [capturedStrokes, setCapturedStrokes] = useState<CapturedStrokeRecord[]>([]);
  const [liveStrokePoints, setLiveStrokePoints] = useState<CapturedPoint[]>([]);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveCaptureTelemetry | null>(null);
  const [quickSearch, setQuickSearch] = useState('');

  const currentCatalogEntry = useMemo(
    () => catalog.find((c) => c.id === character.id) ?? catalog[0],
    [catalog, character.id],
  );

  const activeSemesterId: SemesterId =
    currentCatalogEntry?.semesterId ?? character.semesterId ?? 'g1s1';
  const activeUnitIndex: number =
    currentCatalogEntry?.unitIndex ?? character.unitIndex ?? 1;

  const unitChars = useMemo(
    () =>
      catalog.filter(
        (c) => c.semesterId === activeSemesterId && c.unitIndex === activeUnitIndex,
      ),
    [catalog, activeSemesterId, activeUnitIndex],
  );

  const quickSearchResults = useMemo(() => {
    const q = quickSearch.trim();
    if (!q) return [];
    return filterLexicon(catalog, { query: q }).slice(0, 12);
  }, [catalog, quickSearch]);

  const mastery = progress.mastery[character.id];
  const bestStars = mastery?.bestStars ?? 0;

  const currentIdxInUnit = unitChars.findIndex((c) => c.id === character.id);
  const prevChar = currentIdxInUnit > 0 ? unitChars[currentIdxInUnit - 1] : undefined;
  const nextChar =
    currentIdxInUnit >= 0 && currentIdxInUnit + 1 < unitChars.length
      ? unitChars[currentIdxInUnit + 1]
      : undefined;

  const handleSelectChar = (charId: string) => {
    setFocusedStrokeIdx(null);
    setLive3DStrokeIdx(0);
    setStageMode('demo');
    setCapturedStrokes([]);
    setLiveStrokePoints([]);
    setLiveTelemetry(null);
    setQuickSearch('');
    onSelectCharacter(charId);
  };

  const handleLiveCaptureChange = useCallback(
    (payload: {
      completedStrokes: CapturedStrokeRecord[];
      livePoints: CapturedPoint[];
      telemetry: LiveCaptureTelemetry | null;
    }) => {
      setCapturedStrokes(payload.completedStrokes);
      setLiveStrokePoints(payload.livePoints);
      setLiveTelemetry(payload.telemetry);
      if (payload.livePoints.length > 0 || payload.completedStrokes.length > 0) {
        setStageMode('live_capture');
      }
    },
    [],
  );

  return (
    <div className="space-y-5">
      {/* Compact Workspace Top Strip: Back + Semester/Unit Selectors + Quick 3,000-Char Jump */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回字库</span>
          </button>

          <label className="sr-only" htmlFor="semester-select">
            选择年级册次
          </label>
          <select
            id="semester-select"
            value={activeSemesterId}
            onChange={(e) => {
              const targetSem = e.target.value as SemesterId;
              const firstInSem = catalog.find(
                (c) => c.semesterId === targetSem && c.unitIndex === 1,
              );
              if (firstInSem) handleSelectChar(firstInSem.id);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 cursor-pointer"
          >
            {GRADE_SEMESTERS.map((sem) => (
              <option key={sem.id} value={sem.id}>
                {sem.gradeName}{sem.semesterLabel}（250字）
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="unit-select">
            选择单元
          </label>
          <select
            id="unit-select"
            value={activeUnitIndex}
            onChange={(e) => {
              const nextUnit = Number(e.target.value);
              const firstInUnit = catalog.find(
                (c) => c.semesterId === activeSemesterId && c.unitIndex === nextUnit,
              );
              if (firstInUnit) handleSelectChar(firstInUnit.id);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 cursor-pointer"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {getUnitLabel(u)}
              </option>
            ))}
          </select>

          {/* Prev / Next quick buttons */}
          <div className="inline-flex items-center gap-1 ml-1">
            <button
              type="button"
              disabled={!prevChar}
              onClick={() => prevChar && handleSelectChar(prevChar.id)}
              aria-label="上一个字"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!nextChar}
              onClick={() => nextChar && handleSelectChar(nextChar.id)}
              aria-label="下一个字"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick 3,000-Char Jump Search */}
        <div className="relative w-full lg:w-72">
          <label htmlFor="studio-quick-search" className="sr-only">
            快速搜字切换练习
          </label>
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="studio-quick-search"
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="快搜 3,000 字直达（如 龙、chun）"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F]"
          />
          {quickSearch && (
            <button
              type="button"
              aria-label="清空快搜"
              onClick={() => setQuickSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {quickSearch.trim().length > 0 && (
            <div
              role="listbox"
              aria-label="快速搜字结果"
              className="absolute right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 max-h-64 overflow-y-auto"
            >
              {quickSearchResults.length === 0 ? (
                <p className="text-xs text-slate-500 p-2 text-center">未找到匹配的生字</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {quickSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === character.id}
                      onClick={() => handleSelectChar(item.id)}
                      className="flex flex-col items-center p-2 rounded-lg border border-slate-100 hover:border-[#D93829] hover:bg-rose-50/40 text-center cursor-pointer"
                    >
                      <span className="font-hanzi text-xl font-bold text-slate-900">
                        {item.char}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.pinyin} · {item.grade}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Unit Character Strip (25 chars in current unit) */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label="本单元生字列表"
      >
        {unitChars.map((c) => {
          const isActive = c.id === character.id;
          const cStars = progress.mastery[c.id]?.bestStars ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectChar(c.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <span className="font-hanzi text-base">{c.char}</span>
              {cStars > 0 && (
                <span
                  className={`text-[10px] font-mono-num ${
                    isActive ? 'text-amber-300' : 'text-amber-600'
                  }`}
                >
                  ★{cStars}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Character Knowledge Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-slate-200 bg-[#FCFBF7] flex items-center justify-center shrink-0">
            <span className="font-hanzi text-4xl font-bold text-slate-900">{character.char}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-[#1E3A5F] tracking-wide">
                {character.pinyin}
              </h1>
              <button
                type="button"
                onClick={() =>
                  speakChineseText(
                    `${character.char}，${character.words.join('，')}。${character.mnemonic}`,
                  )
                }
                aria-label={`朗读汉字 ${character.char} 的读音和组词`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>听读音</span>
              </button>
              <div
                className="flex items-center gap-0.5 ml-1"
                aria-label={`历史最佳 ${bestStars} 颗星`}
              >
                {[1, 2, 3].map((idx) => (
                  <Star
                    key={idx}
                    className={`w-4 h-4 ${
                      idx <= bestStars
                        ? 'text-amber-500 fill-amber-400'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                ))}
              </div>
              {isLoadingCharacter && (
                <span className="text-xs text-slate-400">加载笔顺中...</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
              <span>{character.grade}</span>
              <span aria-hidden="true">·</span>
              <span>{character.unit}</span>
              <span aria-hidden="true">·</span>
              <span>部首：{character.radical}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">共 {character.strokes.length} 画</span>
              <span aria-hidden="true">·</span>
              <span>{character.structure}</span>
            </div>
          </div>
        </div>

        <div className="lg:text-right border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 max-w-lg">
          <p className="text-xs text-slate-700">
            <span className="text-slate-500">常用组词：</span>
            <span className="font-medium text-slate-900">{character.words.join(' · ')}</span>
          </p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            <span className="text-slate-500">书写要点：</span>
            {character.mnemonic}
          </p>
        </div>
      </section>

      {/* Two-Zone Interactive Sandbox: 3D Stage (Left 7 cols) + Writing Canvas (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-3">
          <Hanzi3DStage
            character={character}
            stageMode={stageMode}
            onStageModeChange={setStageMode}
            capturedStrokes={capturedStrokes}
            liveStrokePoints={liveStrokePoints}
            liveTelemetry={liveTelemetry}
            externalActiveStrokeIndex={focusedStrokeIdx}
            onStrokeStepChange={(idx) => setLive3DStrokeIdx(idx)}
          />

          {/* Interactive Stroke-by-Stroke Sequence Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-semibold text-slate-800">
                规范笔顺拆解（点击笔画可定点观看 3D 示范）
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                当前第 {Math.min(live3DStrokeIdx + 1, character.strokes.length)} /{' '}
                {character.strokes.length} 笔
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto">
              {character.strokes.map((st, idx) => {
                const active = idx === live3DStrokeIdx;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStageMode('demo');
                      setFocusedStrokeIdx(idx);
                      setLive3DStrokeIdx(idx);
                      speakChineseText(`第${idx + 1}笔，${st.name}`);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#D93829] border-[#D93829] text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono-num">{idx + 1}.</span>
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <WritingCanvasPad
            character={character}
            onComplete={(res) => onWritingComplete(character.id, res)}
            onNextCharacter={nextChar ? () => handleSelectChar(nextChar.id) : undefined}
            onStrokeFocus={(idx) => {
              setFocusedStrokeIdx(idx);
              setLive3DStrokeIdx(idx);
            }}
            onLiveCaptureChange={handleLiveCaptureChange}
          />
        </div>
      </div>
    </div>
  );
};
