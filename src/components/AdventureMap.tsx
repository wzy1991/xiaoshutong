import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Search,
  Star,
  X,
} from 'lucide-react';
import {
  filterLexicon,
  getSemesterInfo,
  getUnitLabel,
  GRADE_SEMESTERS,
  TOTAL_LEXICON_COUNT,
} from '../data/hanziLexicon';
import { GradeNumber, LexiconEntry, ProgressState, SemesterId } from '../types/hanzi';
import {
  ACHIEVEMENT_SEALS,
  getGradeStats,
  getMasteredCount,
  getNextRecommendedCharId,
  getSemesterStats,
  getTotalStars,
  getUnlockedSealIds,
} from '../utils/progressStore';

interface AdventureMapProps {
  catalog: LexiconEntry[];
  progress: ProgressState;
  onSelectCharacter: (charId: string) => void;
  onStartGame: () => void;
  onOpenRewards: () => void;
}

const HERO_IMAGE_PATH = '/src/assets/images/hero_calligraphy_studio_1795748213868.jpg';
const GRADES: Array<{ num: GradeNumber; label: string }> = [
  { num: 1, label: '一年级' },
  { num: 2, label: '二年级' },
  { num: 3, label: '三年级' },
  { num: 4, label: '四年级' },
  { num: 5, label: '五年级' },
  { num: 6, label: '六年级' },
];
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SEARCH_PAGE_SIZE = 60;

export const AdventureMap: React.FC<AdventureMapProps> = ({
  catalog,
  progress,
  onSelectCharacter,
  onStartGame,
  onOpenRewards,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeNumber>(1);
  const [selectedSemesterNum, setSelectedSemesterNum] = useState<1 | 2>(1);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  const [masteryFilter, setMasteryFilter] = useState<'all' | 'unpracticed' | 'practiced' | 'three_star'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisibleCount, setSearchVisibleCount] = useState(SEARCH_PAGE_SIZE);

  const activeSemesterId = `g${selectedGrade}s${selectedSemesterNum}` as SemesterId;
  const activeSemesterInfo = getSemesterInfo(activeSemesterId);

  const totalCatalogCount = Math.max(catalog.length, TOTAL_LEXICON_COUNT);
  const totalStars = getTotalStars(progress);
  const maxStars = totalCatalogCount * 3;
  const masteredCount = getMasteredCount(progress);
  const unlockedSealsCount = getUnlockedSealIds(progress).length;
  const recommendedId = getNextRecommendedCharId(progress, catalog);
  const recommendedChar =
    catalog.find((c) => c.id === recommendedId) ?? catalog[0];

  const isSearching = searchQuery.trim().length > 0;

  const gradeStatsMap = useMemo(() => {
    const map = new Map<GradeNumber, { completedChars: number; totalChars: number; earnedStars: number }>();
    for (const g of GRADES) {
      map.set(g.num, getGradeStats(progress, catalog, g.num));
    }
    return map;
  }, [progress, catalog]);

  const semesterStats = useMemo(
    () => getSemesterStats(progress, catalog, activeSemesterId),
    [progress, catalog, activeSemesterId],
  );

  const unitCountsMap = useMemo(() => {
    const counts = new Map<number, { completed: number; total: number }>();
    for (const u of UNITS) counts.set(u, { completed: 0, total: 0 });
    for (const item of catalog) {
      if (item.semesterId !== activeSemesterId) continue;
      const bucket = counts.get(item.unitIndex);
      if (bucket) {
        bucket.total += 1;
        if ((progress.mastery[item.id]?.bestStars ?? 0) > 0) {
          bucket.completed += 1;
        }
      }
    }
    return counts;
  }, [catalog, activeSemesterId, progress]);

  const filteredChars = useMemo(() => {
    return filterLexicon(catalog, {
      semesterId: isSearching ? 'all' : activeSemesterId,
      unitIndex: isSearching ? 'all' : selectedUnit,
      query: searchQuery,
      masteryFilter,
      progress,
    });
  }, [catalog, isSearching, activeSemesterId, selectedUnit, searchQuery, masteryFilter, progress]);

  const displayedChars = isSearching
    ? filteredChars.slice(0, searchVisibleCount)
    : filteredChars;

  const semesterPct =
    semesterStats.totalChars > 0
      ? Math.round((semesterStats.completedChars / semesterStats.totalChars) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Hero Split Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              小学一年级至六年级 · 3,000 规范汉字全字库 · 3D 笔顺与压感临摹
            </p>
            <h1 className="font-hanzi text-3xl sm:text-4xl font-bold text-slate-900 mt-2.5 leading-snug max-w-xl">
              在立体书案上，
              <br />
              一笔一画写好规范中国字
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed max-w-xl">
              完整覆盖小学一至六年级上下册共 3,000 个常用汉字，每字均支持 3D 毛笔空间运笔动画、实时笔顺检测与多级压感笔迹渲染，按年级分单元自由闯关。
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {recommendedChar && (
              <button
                type="button"
                onClick={() => onSelectCharacter(recommendedChar.id)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D93829] text-white text-sm font-medium hover:bg-[#B91C1C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>开始练习「{recommendedChar.char}」字</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onStartGame}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>去玩认字闯关</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-[280px] bg-slate-100">
          {!heroImgFailed ? (
            <img
              src={HERO_IMAGE_PATH}
              alt="日光下的传统中式书法书案，宣纸田字格与青瓷笔山"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
              <BookOpen className="w-10 h-10 mb-2 text-[#1E3A5F]" />
              <span className="font-hanzi text-xl text-slate-800">墨韵书房</span>
            </div>
          )}
        </div>
      </section>

      {/* 4-Column KPI Progress Strip */}
      <section
        aria-label="学习成就概览"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 whitespace-nowrap">已掌握生字</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {masteredCount.toLocaleString()}
            <span className="text-sm font-normal text-slate-400">
              {' '}
              / {totalCatalogCount.toLocaleString()} 字
            </span>
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 whitespace-nowrap">累计书写星星</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-600 tabular-nums">
            {totalStars.toLocaleString()}
            <span className="text-sm font-normal text-slate-400">
              {' '}
              / {maxStars.toLocaleString()} 颗
            </span>
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 whitespace-nowrap">墨宝积分</p>
          <p className="mt-1.5 text-2xl font-bold text-[#1E3A5F] tabular-nums">
            {progress.inkPoints.toLocaleString()}
            <span className="text-sm font-normal text-slate-400"> 分</span>
          </p>
        </div>
        <div className="p-4 sm:p-5 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500 whitespace-nowrap">荣誉印章</p>
            <p className="mt-1.5 text-2xl font-bold text-[#D93829] tabular-nums">
              {unlockedSealsCount}
              <span className="text-sm font-normal text-slate-400">
                {' '}
                / {ACHIEVEMENT_SEALS.length} 枚
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRewards}
            className="text-xs font-medium text-[#1E3A5F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            查看印章
          </button>
        </div>
      </section>

      {/* Grade 1-6 Full 3,000-Character Textbook Explorer */}
      <section aria-label="小学一至六年级生字字库" className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              小学一至六年级教材生字库
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              共 {GRADE_SEMESTERS.length} 册 · 120 个学习单元 · 3,000 个规范汉字，全部支持 3D 笔画示范与实时压感临摹
            </p>
          </div>

          {/* Instant Full-Library Search Bar */}
          <div className="relative w-full md:w-80">
            <label htmlFor="lexicon-search" className="sr-only">
              全字库搜索汉字、拼音、部首或词语
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="lexicon-search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchVisibleCount(SEARCH_PAGE_SIZE);
              }}
              placeholder="搜全库 3,000 字：汉字/拼音/部首（如 春、long、氵）"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1E3A5F]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => {
                  setSearchQuery('');
                  setSearchVisibleCount(SEARCH_PAGE_SIZE);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Grade 1-6 Primary Selector Row */}
        {!isSearching && (
          <div
            role="tablist"
            aria-label="选择小学年级"
            className="grid grid-cols-3 sm:grid-cols-6 gap-2.5"
          >
            {GRADES.map((g) => {
              const active = selectedGrade === g.num;
              const stats = gradeStatsMap.get(g.num);
              const totalInGrade = stats?.totalChars || 500;
              const doneInGrade = stats?.completedChars || 0;
              return (
                <button
                  key={g.num}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedGrade(g.num);
                    setSelectedSemesterNum(1);
                    setSelectedUnit(1);
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{g.label}</span>
                    <span
                      className={`text-[11px] tabular-nums ${
                        active ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {totalInGrade}字
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 tabular-nums ${
                      active ? 'text-amber-300' : 'text-slate-500'
                    }`}
                  >
                    已学 {doneInGrade} 字
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Semester / Unit Container Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          {!isSearching ? (
            <>
              {/* Semester Header & 上/下册 Switcher */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{activeSemesterInfo.gradeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      本册 {semesterStats.totalChars || 250} 字
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums text-amber-700 font-medium">
                      已点亮 {semesterStats.completedChars} 字（{semesterStats.earnedStars} 星）
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    {activeSemesterInfo.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">{activeSemesterInfo.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {/* 上册 / 下册 Segmented Toggle */}
                  <div
                    className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200/80"
                    role="tablist"
                    aria-label="选择上下册"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedSemesterNum === 1}
                      onClick={() => {
                        setSelectedSemesterNum(1);
                        setSelectedUnit(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        selectedSemesterNum === 1
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      上册 (250字)
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedSemesterNum === 2}
                      onClick={() => {
                        setSelectedSemesterNum(2);
                        setSelectedUnit(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        selectedSemesterNum === 2
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      下册 (250字)
                    </button>
                  </div>

                  {/* Semester Progress Bar */}
                  <div className="w-28 hidden sm:block">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1 tabular-nums">
                      <span>本册进度</span>
                      <span>{semesterPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#0F766E] rounded-full transition-all"
                        style={{ width: `${semesterPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 10 Units Strip + Mastery Filter */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0"
                  role="tablist"
                  aria-label="选择学习单元"
                >
                  {UNITS.map((u) => {
                    const active = selectedUnit === u;
                    const stat = unitCountsMap.get(u);
                    return (
                      <button
                        key={u}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedUnit(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[#D93829] border-[#D93829] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {getUnitLabel(u)}
                        {stat && stat.completed > 0 && (
                          <span
                            className={`ml-1 font-mono-num text-[10px] ${
                              active ? 'text-amber-200' : 'text-emerald-700'
                            }`}
                          >
                            {stat.completed}/{stat.total}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Mastery Filter */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {(
                    [
                      ['all', '全部'],
                      ['unpracticed', '未练'],
                      ['practiced', '已练'],
                      ['three_star', '满星'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMasteryFilter(val)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        masteryFilter === val
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <p className="text-sm text-slate-700">
                全字库搜索 <strong className="text-slate-900">“{searchQuery.trim()}”</strong>，共找到{' '}
                <strong className="text-[#D93829] tabular-nums">{filteredChars.length}</strong> 个生字
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchVisibleCount(SEARCH_PAGE_SIZE);
                }}
                className="text-xs font-medium text-[#1E3A5F] hover:underline cursor-pointer"
              >
                返回年级单元视图
              </button>
            </div>
          )}

          {/* Character Tile Grid (25 tiles per unit or paginated search matches) */}
          {displayedChars.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              当前筛选条件下暂无匹配生字，试试切换筛选条件或搜索其他拼音/汉字。
            </div>
          ) : (
            <>
              <div
                data-testid="lexicon-char-grid"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
              >
                {displayedChars.map((c) => {
                  const mastery = progress.mastery[c.id];
                  const stars = mastery?.bestStars ?? 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCharacter(c.id)}
                      aria-label={`练习汉字 ${c.char}，${c.grade}，拼音 ${c.pinyin}，当前 ${stars} 颗星`}
                      className={`group relative rounded-xl border p-3.5 text-center transition-all flex flex-col items-center cursor-pointer ${
                        stars >= 3
                          ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/70'
                          : 'border-slate-200 bg-[#FCFBF7] hover:border-[#D93829] hover:bg-white'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-medium text-[#1E3A5F]">{c.pinyin}</span>
                        <span className="tabular-nums text-slate-400">
                          {isSearching ? c.grade : `${c.strokeCount}画`}
                        </span>
                      </div>
                      <span className="font-hanzi text-4xl font-bold text-slate-900 my-1.5 group-hover:text-[#D93829] transition-colors">
                        {c.char}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate max-w-full">
                        {c.radical}部 · {c.words[0] ?? c.char}
                      </span>

                      <div className="flex items-center gap-0.5 mt-2">
                        {[1, 2, 3].map((idx) => (
                          <Star
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx <= stars
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-200 fill-slate-100'
                            }`}
                          />
                        ))}
                      </div>

                      {stars >= 1 && (
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-emerald-600 absolute top-2 right-2"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {isSearching && filteredChars.length > searchVisibleCount && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setSearchVisibleCount((n) => n + SEARCH_PAGE_SIZE)}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    展开更多结果（已显示 {displayedChars.length} / {filteredChars.length}）
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
