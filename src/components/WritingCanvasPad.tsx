import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  HelpCircle,
  RotateCcw,
  Star,
  ArrowRight,
} from 'lucide-react';
import {
  CapturedPoint,
  CapturedStrokeRecord,
  HanziCharacter,
  LiveCaptureTelemetry,
  Point2D,
  PressureMode,
} from '../types/hanzi';
import { calculateCharacterStars, evaluateUserStroke } from '../utils/strokeEvaluator';
import {
  analyzeLiveStrokeStep,
  computeBrushPressure,
  getPressureLabel,
  pressureToMetrics,
} from '../utils/strokeCaptureEngine';
import {
  playCelebrationChime,
  playGentleErrorSound,
  playStrokeSuccessSound,
  speakChineseText,
} from '../utils/soundEngine';

interface WritingCanvasPadProps {
  character: HanziCharacter;
  onComplete: (result: { stars: number; averageAccuracy: number; inkReward: number }) => void;
  onNextCharacter?: () => void;
  onStrokeFocus?: (strokeIndex: number) => void;
  onLiveCaptureChange?: (payload: {
    completedStrokes: CapturedStrokeRecord[];
    livePoints: CapturedPoint[];
    telemetry: LiveCaptureTelemetry | null;
  }) => void;
}

const CANVAS_LOGICAL = 360;

function drawCanonicalStroke(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  scale: number,
  color: string,
  lineWidth: number,
  dashed = false,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dashed) {
    ctx.setLineDash([6, 6]);
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x * scale, points[0].y * scale);
  for (let i = 1; i < points.length - 1; i++) {
    const midX = ((points[i].x + points[i + 1].x) / 2) * scale;
    const midY = ((points[i].y + points[i + 1].y) / 2) * scale;
    ctx.quadraticCurveTo(points[i].x * scale, points[i].y * scale, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x * scale, last.y * scale);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders a captured calligraphic stroke with smooth segment-by-segment variable width
 * driven directly by captured brush pressure.
 */
function drawPressureStroke(
  ctx: CanvasRenderingContext2D,
  points: CapturedPoint[],
  scale: number,
  color: string,
) {
  if (points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    const w = pressureToMetrics(points[0].pressure).canvasWidthPx;
    ctx.beginPath();
    ctx.arc(points[0].x * scale, points[0].y * scale, w * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const avgP = (p0.pressure + p1.pressure) * 0.5;
    ctx.lineWidth = pressureToMetrics(avgP).canvasWidthPx;
    ctx.beginPath();
    ctx.moveTo(p0.x * scale, p0.y * scale);
    ctx.lineTo(p1.x * scale, p1.y * scale);
    ctx.stroke();
  }
  ctx.restore();
}

export const WritingCanvasPad: React.FC<WritingCanvasPadProps> = ({
  character,
  onComplete,
  onNextCharacter,
  onStrokeFocus,
  onLiveCaptureChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [capturedRecords, setCapturedRecords] = useState<CapturedStrokeRecord[]>([]);
  const [strokeAccuracies, setStrokeAccuracies] = useState<number[]>([]);
  const [traceGuide, setTraceGuide] = useState(true);
  const [pressureMode, setPressureMode] = useState<PressureMode>('auto');
  const [hintFlash, setHintFlash] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveCaptureTelemetry | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'info' | 'success' | 'gentle_warn' | 'error';
    text: string;
  }>({
    type: 'info',
    text: `请写第 1 笔「${character.strokes[0]?.name ?? ''}」：${character.strokes[0]?.directionTip ?? ''}`,
  });
  const [completionSummary, setCompletionSummary] = useState<{
    stars: number;
    averageAccuracy: number;
    inkReward: number;
  } | null>(null);

  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<CapturedPoint[]>([]);
  const lastPressureRef = useRef<number>(0.55);
  const lastSyncTimeRef = useRef<number>(0);

  // Reset pad whenever character changes
  useEffect(() => {
    setCompletedCount(0);
    setCapturedRecords([]);
    setStrokeAccuracies([]);
    setHintsUsed(0);
    setHintFlash(false);
    setLiveTelemetry(null);
    setCompletionSummary(null);
    currentPointsRef.current = [];
    isDrawingRef.current = false;
    lastPressureRef.current = 0.55;
    const first = character.strokes[0];
    setFeedback({
      type: 'info',
      text: first ? `请写第 1 笔「${first.name}」：${first.directionTip}` : '开始临摹吧',
    });
    onLiveCaptureChange?.({ completedStrokes: [], livePoints: [], telemetry: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  const redrawCanvas = useCallback(
    (livePoints: CapturedPoint[] = [], telemetry: LiveCaptureTelemetry | null = null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetPx = Math.round(CANVAS_LOGICAL * dpr);
      if (canvas.width !== targetPx || canvas.height !== targetPx) {
        canvas.width = targetPx;
        canvas.height = targetPx;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const size = CANVAS_LOGICAL;
      const scale = size / 100;

      // Xuan paper background
      ctx.fillStyle = '#FCFBF7';
      ctx.fillRect(0, 0, size, size);

      // Tianzige outer frame & dashed centerlines
      const margin = 10;
      ctx.strokeStyle = '#D96B62';
      ctx.lineWidth = 2;
      ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);

      ctx.save();
      ctx.strokeStyle = 'rgba(217, 107, 98, 0.45)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(margin, size / 2);
      ctx.lineTo(size - margin, size / 2);
      ctx.moveTo(size / 2, margin);
      ctx.lineTo(size / 2, size - margin);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(217, 107, 98, 0.2)';
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(size - margin, size - margin);
      ctx.moveTo(size - margin, margin);
      ctx.lineTo(margin, size - margin);
      ctx.stroke();
      ctx.restore();

      const isGentleDeviating =
        telemetry?.status === 'drifting' ||
        telemetry?.status === 'off_track' ||
        telemetry?.status === 'wrong_order' ||
        telemetry?.status === 'reverse_direction';

      // Faint tracing underlay & soft track corridor
      if (traceGuide || hintFlash || isGentleDeviating) {
        character.strokes.forEach((s, idx) => {
          if (idx >= completedCount) {
            const isTarget = idx === completedCount;
            if (isTarget && isGentleDeviating) {
              // Soft warm apricot/amber corridor halo guiding the student gently back onto the track
              drawCanonicalStroke(ctx, s.points, scale, 'rgba(245, 158, 11, 0.24)', 26);
              drawCanonicalStroke(ctx, s.points, scale, 'rgba(217, 119, 6, 0.55)', 14);
            } else if (traceGuide || hintFlash) {
              drawCanonicalStroke(
                ctx,
                s.points,
                scale,
                isTarget
                  ? hintFlash
                    ? 'rgba(217, 56, 41, 0.45)'
                    : 'rgba(148, 163, 184, 0.42)'
                  : 'rgba(203, 213, 225, 0.30)',
                isTarget ? 15 : 13,
              );
            }
          }
        });
      }

      // Draw completed user strokes using their actual captured variable-pressure ink!
      for (const rec of capturedRecords) {
        drawPressureStroke(ctx, rec.points, scale, '#182230');
      }

      // Highlight current stroke start dot + directional cue arrow
      const activeStroke = character.strokes[completedCount];
      if (activeStroke && !completionSummary && (traceGuide || hintFlash || isGentleDeviating)) {
        const start = activeStroke.points[0];
        const nextPt = activeStroke.points[1] ?? activeStroke.points[0];
        const sx = start.x * scale;
        const sy = start.y * scale;

        drawCanonicalStroke(
          ctx,
          activeStroke.points,
          scale,
          isGentleDeviating ? 'rgba(217, 119, 6, 0.72)' : 'rgba(217, 56, 41, 0.55)',
          2.5,
          true,
        );

        // Soft outer ring when wrong order is detected to gently draw attention to correct start
        if (telemetry?.status === 'wrong_order') {
          ctx.save();
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = '#D93829';
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(completedCount + 1), sx, sy + 0.5);

        const dx = nextPt.x - start.x;
        const dy = nextPt.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len > 2) {
          const ux = dx / len;
          const uy = dy / len;
          const ax = sx + ux * 18;
          const ay = sy + uy * 18;
          const angle = Math.atan2(uy, ux);
          ctx.fillStyle = '#D93829';
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - 7 * Math.cos(angle - 0.5), ay - 7 * Math.sin(angle - 0.5));
          ctx.lineTo(ax - 7 * Math.cos(angle + 0.5), ay - 7 * Math.sin(angle + 0.5));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw live variable-pressure user ink trail
      if (livePoints.length >= 1) {
        const liveInkColor = isGentleDeviating
          ? 'rgba(217, 119, 6, 0.82)' // Soft warm amber-ink tint when drifting off track
          : '#1E3A5F';
        drawPressureStroke(ctx, livePoints, scale, liveInkColor);

        // Soft magnetic guide tether connecting pen tip to nearest point on canonical track
        if (isGentleDeviating && telemetry?.nearestTrackPoint) {
          const tip = livePoints[livePoints.length - 1];
          const target = telemetry.nearestTrackPoint;
          ctx.save();
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.65)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(tip.x * scale, tip.y * scale);
          ctx.lineTo(target.x * scale, target.y * scale);
          ctx.stroke();

          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.beginPath();
          ctx.arc(target.x * scale, target.y * scale, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.arc(target.x * scale, target.y * scale, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    },
    [capturedRecords, character, completedCount, completionSummary, hintFlash, traceGuide],
  );

  useEffect(() => {
    redrawCanvas(currentPointsRef.current, liveTelemetry);
  }, [redrawCanvas, liveTelemetry]);

  const toCapturedPoint = (
    e: PointerEvent | React.PointerEvent<HTMLCanvasElement>,
    prevPoint: CapturedPoint | undefined,
    countSoFar: number,
  ): CapturedPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const now = performance.now();

    let speedPxPerMs = 0.25;
    if (prevPoint) {
      const dt = Math.max(4, now - prevPoint.timestamp);
      const distNorm = Math.hypot(x - prevPoint.x, y - prevPoint.y);
      const distPx = (distNorm / 100) * rect.width;
      speedPxPerMs = distPx / dt;
    }

    const pressure = computeBrushPressure({
      rawPointerPressure: e.pressure ?? 0.5,
      pointerType: e.pointerType || 'mouse',
      speedPxPerMs,
      prevPressure: lastPressureRef.current,
      mode: pressureMode,
      strokePointCount: countSoFar + 1,
    });
    lastPressureRef.current = pressure;

    return { x, y, pressure, timestamp: now };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (completionSummary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = toCapturedPoint(e, undefined, 0);
    currentPointsRef.current = [pt];

    const telemetry = analyzeLiveStrokeStep(
      currentPointsRef.current,
      character.strokes,
      completedCount,
    );
    setLiveTelemetry(telemetry);
    if (telemetry.status === 'wrong_order') {
      playGentleErrorSound();
      setFeedback({ type: 'gentle_warn', text: telemetry.coachingHint });
    } else {
      setFeedback({ type: 'info', text: telemetry.coachingHint });
    }

    redrawCanvas(currentPointsRef.current, telemetry);
    onLiveCaptureChange?.({
      completedStrokes: capturedRecords,
      livePoints: [...currentPointsRef.current],
      telemetry,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const nativeEvt = e.nativeEvent;
    const coalesced =
      typeof nativeEvt.getCoalescedEvents === 'function' ? nativeEvt.getCoalescedEvents() : [nativeEvt];
    const eventsToProcess = coalesced.length > 0 ? coalesced : [nativeEvt];

    let added = false;
    for (const evt of eventsToProcess) {
      const pts = currentPointsRef.current;
      const prev = pts[pts.length - 1];
      const nextPt = toCapturedPoint(evt, prev, pts.length);
      if (!prev || Math.hypot(nextPt.x - prev.x, nextPt.y - prev.y) >= 1.1) {
        pts.push(nextPt);
        added = true;
      }
    }

    if (!added) return;

    const telemetry = analyzeLiveStrokeStep(
      currentPointsRef.current,
      character.strokes,
      completedCount,
    );
    redrawCanvas(currentPointsRef.current, telemetry);

    // Throttle React + 3D live sync smoothly (~24Hz max) so software WebGL stays responsive
    const now = performance.now();
    if (now - lastSyncTimeRef.current >= 42) {
      lastSyncTimeRef.current = now;
      setLiveTelemetry(telemetry);
      if (
        telemetry.status === 'drifting' ||
        telemetry.status === 'off_track' ||
        telemetry.status === 'wrong_order' ||
        telemetry.status === 'reverse_direction'
      ) {
        setFeedback({ type: 'gentle_warn', text: telemetry.coachingHint });
      } else {
        setFeedback({ type: 'info', text: telemetry.coachingHint });
      }
      onLiveCaptureChange?.({
        completedStrokes: capturedRecords,
        livePoints: [...currentPointsRef.current],
        telemetry,
      });
    }
  };

  const finalizeStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const drawn = [...currentPointsRef.current];
    currentPointsRef.current = [];

    const activeStroke = character.strokes[completedCount];
    if (!activeStroke) return;

    const liveCheck = analyzeLiveStrokeStep(drawn, character.strokes, completedCount);
    if (liveCheck.status === 'wrong_order') {
      playGentleErrorSound();
      setLiveTelemetry(liveCheck);
      setFeedback({ type: 'gentle_warn', text: liveCheck.coachingHint });
      redrawCanvas([], liveCheck);
      onLiveCaptureChange?.({
        completedStrokes: capturedRecords,
        livePoints: [],
        telemetry: liveCheck,
      });
      return;
    }

    const evaluation = evaluateUserStroke(drawn, activeStroke);
    if (evaluation.accepted) {
      playStrokeSuccessSound(completedCount);
      const avgPressure =
        drawn.reduce((sum, p) => sum + p.pressure, 0) / Math.max(1, drawn.length);
      const newRecord: CapturedStrokeRecord = {
        strokeIndex: completedCount,
        points: drawn,
        averagePressure: Number(avgPressure.toFixed(2)),
        accuracy: evaluation.accuracy,
      };
      const nextRecords = [...capturedRecords, newRecord];
      const nextCount = completedCount + 1;
      const nextAccuracies = [...strokeAccuracies, evaluation.accuracy];

      setCapturedRecords(nextRecords);
      setCompletedCount(nextCount);
      setStrokeAccuracies(nextAccuracies);
      setHintFlash(false);
      setLiveTelemetry(null);

      onLiveCaptureChange?.({
        completedStrokes: nextRecords,
        livePoints: [],
        telemetry: null,
      });

      if (nextCount >= character.strokes.length) {
        const summary = calculateCharacterStars(nextAccuracies, hintsUsed, traceGuide);
        setCompletionSummary(summary);
        setFeedback({
          type: 'success',
          text: `太棒了！你规范写完了「${character.char}」字，获得 ${summary.stars} 颗星星！`,
        });
        playCelebrationChime();
        speakChineseText(`${character.char}，写得真棒！`);
        onComplete(summary);
      } else {
        const upcoming = character.strokes[nextCount];
        setFeedback({
          type: 'success',
          text: `${evaluation.feedback} 下一笔：第 ${nextCount + 1} 笔「${upcoming.name}」`,
        });
        onStrokeFocus?.(nextCount);
      }
    } else {
      playGentleErrorSound();
      setLiveTelemetry(null);
      setFeedback({
        type: 'gentle_warn',
        text: evaluation.feedback,
      });
      redrawCanvas([], null);
      onLiveCaptureChange?.({
        completedStrokes: capturedRecords,
        livePoints: [],
        telemetry: null,
      });
    }
  };

  const handleReset = () => {
    setCompletedCount(0);
    setCapturedRecords([]);
    setStrokeAccuracies([]);
    setHintsUsed(0);
    setHintFlash(false);
    setLiveTelemetry(null);
    setCompletionSummary(null);
    currentPointsRef.current = [];
    const first = character.strokes[0];
    setFeedback({
      type: 'info',
      text: first ? `重新开始！请写第 1 笔「${first.name}」：${first.directionTip}` : '重新开始练习',
    });
    onLiveCaptureChange?.({ completedStrokes: [], livePoints: [], telemetry: null });
    onStrokeFocus?.(0);
  };

  const handleHint = () => {
    if (completionSummary) return;
    setHintsUsed((h) => h + 1);
    setHintFlash(true);
    const active = character.strokes[completedCount];
    if (active) {
      setFeedback({
        type: 'info',
        text: `提示：第 ${completedCount + 1} 笔「${active.name}」— ${active.directionTip}`,
      });
      onStrokeFocus?.(completedCount);
      speakChineseText(`第${completedCount + 1}笔，${active.name}`);
    }
  };

  const activePressurePct = liveTelemetry
    ? Math.round(liveTelemetry.pressure * 100)
    : pressureMode === 'light'
      ? 24
      : pressureMode === 'heavy'
        ? 92
        : 56;
  const activePressureLabel = liveTelemetry
    ? getPressureLabel(liveTelemetry.pressureLevel)
    : pressureMode === 'light'
      ? '轻笔'
      : pressureMode === 'heavy'
        ? '重笔'
        : pressureMode === 'medium'
          ? '适中'
          : '自动压感';

  const statusText =
    liveTelemetry?.status === 'wrong_order'
      ? '笔顺提示'
      : liveTelemetry?.status === 'reverse_direction'
        ? '方向提醒'
        : liveTelemetry?.status === 'off_track'
          ? '柔和纠偏'
          : liveTelemetry?.status === 'drifting'
            ? '轻微偏移'
            : liveTelemetry?.status === 'on_track'
              ? '轨道贴合'
              : '等待落笔';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">田字格互动捕捉与临摹</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            进度 {completedCount}/{character.strokes.length} 笔
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span data-testid="live-track-status">{statusText}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{activePressureLabel}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTraceGuide((v) => !v)}
          aria-pressed={traceGuide}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            traceGuide
              ? 'bg-slate-100 border-slate-300 text-slate-800'
              : 'bg-indigo-50 border-indigo-200 text-[#1E3A5F]'
          }`}
        >
          {traceGuide ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{traceGuide ? '描红辅助' : '自主盲写'}</span>
        </button>
      </div>

      {/* Pressure Mode Selector & Compact Live Pressure Meter */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="笔压等级选择">
          {(
            [
              { id: 'auto', label: '自动压感' },
              { id: 'light', label: '轻笔' },
              { id: 'medium', label: '适中' },
              { id: 'heavy', label: '重笔' },
            ] as Array<{ id: PressureMode; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPressureMode(item.id)}
              aria-pressed={pressureMode === item.id}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                pressureMode === item.id
                  ? 'bg-white text-[#1E3A5F] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
          <span>笔压</span>
          <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-[#1E3A5F] rounded-full transition-all duration-100"
              style={{ width: `${activePressurePct}%` }}
            />
          </div>
          <span className="w-8 text-right font-medium text-slate-800">{activePressurePct}%</span>
        </div>
      </div>

      {/* Interactive Tianzige Canvas */}
      <div className="relative w-full max-w-[360px] mx-auto aspect-square rounded-lg overflow-hidden border border-slate-200 bg-[#FCFBF7]">
        <canvas
          ref={canvasRef}
          data-testid="writing-canvas"
          data-completed-strokes={completedCount}
          data-total-strokes={character.strokes.length}
          data-live-status={liveTelemetry?.status ?? 'idle'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finalizeStroke}
          onPointerCancel={finalizeStroke}
          className="w-full h-full touch-none cursor-crosshair block"
          aria-label={`田字格书写区：请临摹汉字${character.char}`}
        />

        {/* Completion Reward Overlay */}
        {completionSummary && (
          <div
            className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 text-center"
            data-testid="writing-complete-banner"
          >
            <div className="flex items-center gap-1.5 mb-2" aria-label={`获得 ${completionSummary.stars} 颗星`}>
              {[1, 2, 3].map((idx) => (
                <Star
                  key={idx}
                  className={`w-8 h-8 ${
                    idx <= completionSummary.stars
                      ? 'text-amber-500 fill-amber-400'
                      : 'text-slate-200 fill-slate-100'
                  }`}
                />
              ))}
            </div>
            <p className="font-hanzi text-5xl font-bold text-slate-900 mb-2">{character.char}</p>
            <p className="text-sm font-semibold text-[#0F766E]">书写通关成功！</p>
            <p className="text-xs text-slate-600 mt-1 tabular-nums">
              规范度 {completionSummary.averageAccuracy}% · 奖励 +{completionSummary.inkReward} 墨宝
            </p>
            <p className="text-xs text-slate-500 mt-1">
              左侧 3D 宣纸已完整保留你的压感立体笔迹，可旋转细赏
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>再写一遍</span>
              </button>
              {onNextCharacter && (
                <button
                  type="button"
                  onClick={onNextCharacter}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D93829] text-white text-xs font-medium hover:bg-[#B91C1C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>挑战下一字</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Pedagogical Feedback Bar (Gentle amber for soft guidance, never harsh) */}
      <div
        role="status"
        aria-live="polite"
        data-testid="writing-feedback"
        className={`mt-3.5 rounded-lg px-3.5 py-2.5 text-xs flex items-start gap-2 border transition-colors ${
          feedback.type === 'success'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : feedback.type === 'gentle_warn'
              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
              : feedback.type === 'error'
                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {feedback.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        ) : feedback.type === 'gentle_warn' ? (
          <Compass className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        ) : feedback.type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        )}
        <span className="leading-relaxed">{feedback.text}</span>
      </div>

      {/* Action Buttons Row */}
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleHint}
          disabled={Boolean(completionSummary)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>笔顺提示</span>
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重写本字</span>
        </button>
      </div>
    </div>
  );
};
