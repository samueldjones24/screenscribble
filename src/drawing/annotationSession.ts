import {
  DEFAULT_STROKE_LIFETIME_CONFIG,
  type Stroke,
} from './stroke.ts';
import type { Clock } from '../utils/clock.ts';

export interface AnnotationSessionConfig {
  visibleDurationMs: number;
  fadeDurationMs: number;
  resetTimeoutOnNewStroke: boolean;
}

export type AnnotationSessionState = 'active' | 'fading' | 'expired';

export interface AnnotationSessionSnapshot {
  strokes: Stroke[];
  lastActivity: number;
  timeoutMs: number;
  fadeDurationMs: number;
  state: AnnotationSessionState;
  isPaused: boolean;
  opacity: number;
  activeStrokeCount: number;
  fadingStrokeCount: number;
  expiredStrokeCount: number;
  averageStrokeAgeMs: number;
  nextTransitionAt?: number;
}

export interface AnnotationSessionManager {
  touch: (now?: number) => void;
  refreshAll: (now?: number) => void;
  pause: (now?: number) => AnnotationSessionSnapshot;
  resume: (now?: number) => AnnotationSessionSnapshot;
  addStroke: (stroke: Stroke, now?: number) => void;
  setConfig: (config: Partial<AnnotationSessionConfig>, now?: number) => AnnotationSessionSnapshot;
  update: (now?: number) => AnnotationSessionSnapshot;
  clear: () => void;
  getSnapshot: () => AnnotationSessionSnapshot;
}

export function createAnnotationSessionManager(options: {
  clock?: Clock;
  config?: Partial<AnnotationSessionConfig>;
} = {}): AnnotationSessionManager {
  const clock = options.clock;
  let timeoutMs = options.config?.visibleDurationMs ?? DEFAULT_STROKE_LIFETIME_CONFIG.visibleDurationMs;
  let fadeDurationMs = options.config?.fadeDurationMs ?? DEFAULT_STROKE_LIFETIME_CONFIG.fadeDurationMs;
  let resetTimeoutOnNewStroke = options.config?.resetTimeoutOnNewStroke ?? true;

  const strokes: Stroke[] = [];
  let lastActivity = clock?.now() ?? Date.now();
  let pausedAt: number | undefined;

  let snapshot: AnnotationSessionSnapshot = {
    strokes,
    lastActivity,
    timeoutMs,
    fadeDurationMs,
    state: 'expired',
    isPaused: false,
    opacity: 0,
    activeStrokeCount: 0,
    fadingStrokeCount: 0,
    expiredStrokeCount: 0,
    averageStrokeAgeMs: 0,
  };

  const applySessionOpacity = (now: number): AnnotationSessionSnapshot => {
    if (pausedAt !== undefined) {
      snapshot = {
        ...snapshot,
        strokes,
        lastActivity,
        isPaused: true,
        nextTransitionAt: undefined,
      };
      return snapshot;
    }

    const elapsedMs = Math.max(0, now - lastActivity);
    const activeUntilMs = timeoutMs;
    const fadingUntilMs = timeoutMs + fadeDurationMs;

    if (strokes.length === 0) {
      if (elapsedMs < activeUntilMs) {
        snapshot = {
          ...snapshot,
          strokes,
          lastActivity,
          state: 'active',
          isPaused: false,
          opacity: 1,
          activeStrokeCount: 0,
          fadingStrokeCount: 0,
          expiredStrokeCount: 0,
          averageStrokeAgeMs: 0,
          nextTransitionAt: lastActivity + timeoutMs,
        };
        return snapshot;
      }

      if (elapsedMs < fadingUntilMs) {
        const fadeProgress = fadeDurationMs === 0 ? 1 : Math.min(1, (elapsedMs - timeoutMs) / fadeDurationMs);
        snapshot = {
          ...snapshot,
          strokes,
          lastActivity,
          state: 'fading',
          isPaused: false,
          opacity: 1 - fadeProgress,
          activeStrokeCount: 0,
          fadingStrokeCount: 0,
          expiredStrokeCount: 0,
          averageStrokeAgeMs: 0,
          nextTransitionAt: lastActivity + fadingUntilMs,
        };
        return snapshot;
      }

      snapshot = {
        ...snapshot,
        strokes,
        lastActivity,
        state: 'expired',
        isPaused: false,
        opacity: 0,
        activeStrokeCount: 0,
        fadingStrokeCount: 0,
        expiredStrokeCount: 0,
        averageStrokeAgeMs: 0,
        nextTransitionAt: undefined,
      };
      return snapshot;
    }

    const visibleStrokeAgeSum = strokes.reduce((sum, stroke) => sum + Math.max(0, now - stroke.createdAt), 0);

    if (elapsedMs < activeUntilMs) {
      snapshot = {
        ...snapshot,
        strokes,
        lastActivity,
        state: 'active',
        isPaused: false,
        opacity: 1,
        activeStrokeCount: strokes.length,
        fadingStrokeCount: 0,
        expiredStrokeCount: 0,
        averageStrokeAgeMs: visibleStrokeAgeSum / strokes.length,
        nextTransitionAt: lastActivity + timeoutMs,
      };
      return snapshot;
    }

    if (elapsedMs < fadingUntilMs) {
      const fadeProgress = fadeDurationMs === 0 ? 1 : Math.min(1, (elapsedMs - timeoutMs) / fadeDurationMs);
      const sessionOpacity = 1 - fadeProgress;

      snapshot = {
        ...snapshot,
        strokes,
        lastActivity,
        state: 'fading',
        isPaused: false,
        opacity: sessionOpacity,
        activeStrokeCount: 0,
        fadingStrokeCount: strokes.length,
        expiredStrokeCount: 0,
        averageStrokeAgeMs: visibleStrokeAgeSum / strokes.length,
        nextTransitionAt: lastActivity + fadingUntilMs,
      };
      return snapshot;
    }

    const expiredStrokeCount = strokes.length;
    strokes.length = 0;

    snapshot = {
      ...snapshot,
      strokes,
      lastActivity,
      state: 'expired',
      isPaused: false,
      opacity: 0,
      activeStrokeCount: 0,
      fadingStrokeCount: 0,
      expiredStrokeCount,
      averageStrokeAgeMs: 0,
      nextTransitionAt: undefined,
    };

    return snapshot;
  };

  const touch = (now = clock?.now() ?? Date.now()): void => {
    lastActivity = now;
    snapshot = {
      ...snapshot,
      lastActivity,
      state: 'active',
      isPaused: false,
    };
  };

  const pause = (now = clock?.now() ?? Date.now()): AnnotationSessionSnapshot => {
    if (pausedAt !== undefined) {
      return snapshot;
    }

    snapshot = applySessionOpacity(now);
    pausedAt = now;
    snapshot = {
      ...snapshot,
      isPaused: true,
      nextTransitionAt: undefined,
    };

    return snapshot;
  };

  const resume = (now = clock?.now() ?? Date.now()): AnnotationSessionSnapshot => {
    if (pausedAt === undefined) {
      return applySessionOpacity(now);
    }

    lastActivity += Math.max(0, now - pausedAt);
    pausedAt = undefined;
    snapshot = {
      ...snapshot,
      lastActivity,
      isPaused: false,
    };

    return applySessionOpacity(now);
  };

  const addStroke = (stroke: Stroke, now = clock?.now() ?? Date.now()): void => {
    strokes.push(stroke);
    if (resetTimeoutOnNewStroke) {
      touch(now);
    }
    snapshot = applySessionOpacity(now);
  };

  const setConfig = (config: Partial<AnnotationSessionConfig>, now = clock?.now() ?? Date.now()): AnnotationSessionSnapshot => {
    if (typeof config.visibleDurationMs === 'number' && Number.isFinite(config.visibleDurationMs)) {
      timeoutMs = Math.max(0, config.visibleDurationMs);
    }

    if (typeof config.fadeDurationMs === 'number' && Number.isFinite(config.fadeDurationMs)) {
      fadeDurationMs = Math.max(0, config.fadeDurationMs);
    }

    if (typeof config.resetTimeoutOnNewStroke === 'boolean') {
      resetTimeoutOnNewStroke = config.resetTimeoutOnNewStroke;
    }

    if (fadeDurationMs > timeoutMs) {
      fadeDurationMs = timeoutMs;
    }

    snapshot = {
      ...snapshot,
      timeoutMs,
      fadeDurationMs,
      isPaused: pausedAt !== undefined,
    };

    return applySessionOpacity(now);
  };

  const update = (now = clock?.now() ?? Date.now()): AnnotationSessionSnapshot => applySessionOpacity(now);

  return {
    touch,
    refreshAll: touch,
    pause,
    resume,
    addStroke,
    setConfig,
    update,
    clear: () => {
      strokes.length = 0;
      lastActivity = clock?.now() ?? Date.now();
      snapshot = {
        strokes,
        lastActivity,
        timeoutMs,
        fadeDurationMs,
        state: 'expired',
        isPaused: false,
        opacity: 0,
        activeStrokeCount: 0,
        fadingStrokeCount: 0,
        expiredStrokeCount: 0,
        averageStrokeAgeMs: 0,
      };
    },
    getSnapshot: () => snapshot,
  };
}