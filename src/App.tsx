/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { getCharacterById } from './data/hanziCurriculum';
import {
  getBundledFallbackCatalog,
  loadCharacterWithStrokes,
  loadFullCatalog,
} from './data/hanziLexicon';
import { AppView, HanziCharacter, LexiconEntry, ProgressState } from './types/hanzi';
import {
  getNextRecommendedCharId,
  loadProgress,
  recordRecognitionAnswer,
  recordWritingCompletion,
  saveProgress,
} from './utils/progressStore';
import { AdventureMap } from './components/AdventureMap';
import { PracticeStudio } from './components/PracticeStudio';
import { RecognitionGame } from './components/RecognitionGame';
import { RewardGallery } from './components/RewardGallery';

function getInitialView(): AppView {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return 'studio';
    }
  }
  return 'map';
}

export default function App() {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [activeView, setActiveView] = useState<AppView>(() => getInitialView());
  const [catalog, setCatalog] = useState<LexiconEntry[]>(() => getBundledFallbackCatalog());
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [selectedCharId, setSelectedCharId] = useState<string>(() => {
    const initial = loadProgress();
    return getNextRecommendedCharId(initial);
  });

  const [activeCharacter, setActiveCharacter] = useState<HanziCharacter>(() =>
    getCharacterById(selectedCharId),
  );
  const [isLoadingCharacter, setIsLoadingCharacter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFullCatalog().then((entries) => {
      if (!cancelled) {
        setCatalog(entries);
        setCatalogLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingCharacter(true);
    loadCharacterWithStrokes(selectedCharId, catalog)
      .then((charData) => {
        if (!cancelled) {
          setActiveCharacter(charData);
          setIsLoadingCharacter(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoadingCharacter(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCharId, catalog]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const handleOpenCharacter = (charId: string) => {
    setSelectedCharId(charId);
    setActiveView('studio');
  };

  const handleWritingComplete = (
    charId: string,
    result: { stars: number; averageAccuracy: number; inkReward: number },
  ) => {
    setProgress((prev) =>
      recordWritingCompletion(prev, charId, result.stars, result.averageAccuracy, result.inkReward),
    );
  };

  const handleRecordGameAnswer = (charId: string, correct: boolean, isRoundComplete: boolean) => {
    setProgress((prev) => recordRecognitionAnswer(prev, charId, correct, isRoundComplete));
  };

  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'map', label: '闯关地图' },
    { id: 'studio', label: '3D练字台' },
    { id: 'game', label: '认字闯关' },
    { id: 'rewards', label: '荣誉印章' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-[#F6F7F9] text-[#182230]"
      data-active-view={activeView}
      data-lexicon-count={catalog.length}
      data-lexicon-ready={catalogLoaded ? 'true' : 'false'}
    >
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className="font-hanzi text-base sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            墨韵小书童
          </button>

          {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
          <nav
            aria-label="主导航"
            className="flex items-center gap-2.5 sm:gap-7"
          >
            {navItems.map((item) => {
              const isCurrent = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'border-[#D93829] text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="hidden sm:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextId = getNextRecommendedCharId(progress, catalog);
                handleOpenCharacter(nextId);
              }}
              className="px-4 py-2 rounded-lg bg-[#D93829] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              开始练字
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeView === 'map' && (
          <AdventureMap
            catalog={catalog}
            progress={progress}
            onSelectCharacter={handleOpenCharacter}
            onStartGame={() => setActiveView('game')}
            onOpenRewards={() => setActiveView('rewards')}
          />
        )}

        {activeView === 'studio' && (
          <PracticeStudio
            character={activeCharacter}
            isLoadingCharacter={isLoadingCharacter}
            catalog={catalog}
            progress={progress}
            onSelectCharacter={(id) => setSelectedCharId(id)}
            onBackToMap={() => setActiveView('map')}
            onWritingComplete={handleWritingComplete}
          />
        )}

        {activeView === 'game' && (
          <RecognitionGame
            catalog={catalog}
            progress={progress}
            onRecordAnswer={handleRecordGameAnswer}
            onPracticeChar={handleOpenCharacter}
          />
        )}

        {activeView === 'rewards' && (
          <RewardGallery
            progress={progress}
            onGoPractice={() => {
              const nextId = getNextRecommendedCharId(progress, catalog);
              handleOpenCharacter(nextId);
            }}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>墨韵小书童 · 小学一年级至六年级 3,000 规范汉字与 3D 书写练习</span>
          <span>依据国家语委通用规范汉字笔顺标准编排</span>
        </div>
      </footer>
    </div>
  );
}
