import React, { useState } from 'react';
import { Award, CheckCircle2, Lock } from 'lucide-react';
import { ProgressState } from '../types/hanzi';
import {
  ACHIEVEMENT_SEALS,
  getMasteredCount,
  getTotalStars,
  getUnlockedSealIds,
} from '../utils/progressStore';

interface RewardGalleryProps {
  progress: ProgressState;
  onGoPractice: () => void;
}

const SEAL_GALLERY_IMG = '/src/assets/images/seal_stamp_gallery_1795748214078.jpg';

export const RewardGallery: React.FC<RewardGalleryProps> = ({ progress, onGoPractice }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const unlockedIds = new Set(getUnlockedSealIds(progress));
  const totalStars = getTotalStars(progress);
  const masteredCount = getMasteredCount(progress);

  return (
    <div className="space-y-8">
      {/* Header Showcase Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">荣誉印章册 · 坚持书写奖励</p>
            <h1 className="font-hanzi text-3xl font-bold text-slate-900 mt-2">
              集齐传统朱砂印章，记录每一次进步
            </h1>
            <p className="text-sm text-slate-600 mt-3 max-w-xl leading-relaxed">
              每规范写好一个小学语文教材生字、拿下满星评价或完成认字连胜，就能积累墨宝积分并点亮专属中国风石刻印章。
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-slate-700 tabular-nums">
            <div>
              <span className="text-xs text-slate-500 block">已获印章</span>
              <span className="text-xl font-semibold text-[#D93829] font-mono-num">
                {unlockedIds.size} / {ACHIEVEMENT_SEALS.length}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-xs text-slate-500 block">墨宝积分</span>
              <span className="text-xl font-semibold text-[#1E3A5F] font-mono-num">
                {progress.inkPoints}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-xs text-slate-500 block">书写星星</span>
              <span className="text-xl font-semibold text-amber-600 font-mono-num">
                {totalStars}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-xs text-slate-500 block">掌握生字</span>
              <span className="text-xl font-semibold text-slate-900 font-mono-num">
                {masteredCount} 字
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[200px] bg-slate-100">
          {!imgFailed ? (
            <img
              src={SEAL_GALLERY_IMG}
              alt="传统中式朱砂玉石印章与青花印泥盒"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-600">
              <Award className="w-10 h-10 text-[#D93829] mb-2" />
              <span className="font-hanzi text-lg">朱砂印谱</span>
            </div>
          )}
        </div>
      </section>

      {/* 8 Collectible Chinese Seals Grid */}
      <section aria-label="荣誉印章列表">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">我的印章收藏</h2>
          <button
            type="button"
            onClick={onGoPractice}
            className="text-xs font-medium text-[#D93829] hover:underline cursor-pointer"
          >
            继续练字解锁更多印章
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACHIEVEMENT_SEALS.map((seal) => {
            const isUnlocked = unlockedIds.has(seal.id);
            return (
              <div
                key={seal.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                  isUnlocked
                    ? 'bg-white border-rose-200'
                    : 'bg-slate-50/70 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Carved Traditional Square Seal Stamp */}
                  <div
                    className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center shrink-0 font-hanzi text-lg font-bold tracking-widest ${
                      isUnlocked
                        ? 'border-[#C83226] bg-[#C83226] text-[#FAF8F3]'
                        : 'border-slate-300 bg-slate-100 text-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    {seal.sealText}
                  </div>

                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>已点亮</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                      <span>未解锁</span>
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3
                    className={`text-base font-semibold ${
                      isUnlocked ? 'text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {seal.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{seal.description}</p>
                </div>

                <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  解锁条件：{seal.conditionText}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
