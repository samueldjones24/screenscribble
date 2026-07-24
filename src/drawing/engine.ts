// The engine routes input to the active tool, keeps lifecycle scheduling separate, and stays tool-agnostic.
import { createPoint, type Point, type Stroke } from './stroke.ts';
import {
  createAnnotationSessionManager,
  type AnnotationSessionConfig,
  type AnnotationSessionSnapshot,
} from './annotationSession.ts';
import { systemClock, type Clock } from '../utils/clock.ts';
import { createToolManager, type ToolManager } from './toolManager.ts';
import type { Brush, BrushSettings } from './brush.ts';

export interface DrawingEngineState {
  strokes: Stroke[];
  activeStroke?: Stroke;
  brush: Brush;
  isDrawing: boolean;
  mousePosition?: Point;
  session: AnnotationSessionSnapshot;
}

export interface DrawingEngine {
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  beginStroke: (point: Point) => void;
  addPoint: (point: Point) => void;
  endStroke: (point?: Point) => void;
  clear: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  getState: () => DrawingEngineState;
  getVisibleStrokes: () => Stroke[];
  setBrush: (brush: Partial<BrushSettings>) => void;
  setSessionConfig: (config: Partial<AnnotationSessionConfig>) => void;
  dispose: () => void;
}

export function createDrawingEngine(options: {
  canvas: HTMLCanvasElement;
  brush?: Partial<BrushSettings>;
  sessionConfig?: Partial<AnnotationSessionConfig>;
  onStateChange?: (state: DrawingEngineState) => void;
  clock?: Clock;
}): DrawingEngine {
  const { canvas, onStateChange } = options;
  const clock = options.clock ?? systemClock;
  const sessionManager = createAnnotationSessionManager({ clock, config: options.sessionConfig });
  const toolManager: ToolManager = createToolManager({ brush: options.brush });

  let state: DrawingEngineState = {
    strokes: [],
    activeStroke: undefined,
    brush: toolManager.getBrush(),
    isDrawing: false,
    mousePosition: undefined,
    session: sessionManager.getSnapshot(),
  };
  let lifecycleTimeoutId: number | undefined;
  let lifecycleFrameId: number | undefined;

  const cancelLifecycleSchedule = (): void => {
    if (lifecycleTimeoutId !== undefined) {
      globalThis.clearTimeout(lifecycleTimeoutId);
      lifecycleTimeoutId = undefined;
    }

    if (lifecycleFrameId !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(lifecycleFrameId);
      lifecycleFrameId = undefined;
    }
  };

  const syncStateFromSession = (snapshot: AnnotationSessionSnapshot): void => {
    state.strokes = snapshot.strokes;
    state.session = snapshot;
    state.brush = toolManager.getBrush();
  };

  const scheduleSessionUpdate = (snapshot: AnnotationSessionSnapshot, now: number): void => {
    if (typeof window === 'undefined') {
      return;
    }

    cancelLifecycleSchedule();

    if (snapshot.state === 'fading') {
      const scheduleFrame = (): void => {
        lifecycleFrameId = window.requestAnimationFrame(() => {
          lifecycleFrameId = undefined;
          refreshSession(clock.now());
        });
      };

      scheduleFrame();
      return;
    }

    if (snapshot.nextTransitionAt !== undefined) {
      const delayMs = Math.max(0, snapshot.nextTransitionAt - now);
      lifecycleTimeoutId = globalThis.setTimeout(() => {
        lifecycleTimeoutId = undefined;
        refreshSession(clock.now());
      }, delayMs) as unknown as number;
    }
  };

  const refreshSession = (now = clock.now()): void => {
    const snapshot = sessionManager.update(now);
    syncStateFromSession(snapshot);
    onStateChange?.(state);
    if (!snapshot.isPaused) {
      scheduleSessionUpdate(snapshot, now);
    }
  };

  const emit = (): void => {
    refreshSession(clock.now());
  };

  const toCanvasPoint = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return createPoint(event.clientX - rect.left, event.clientY - rect.top);
  };

  const beginStroke = (point: Point): void => {
    const activeTool = toolManager.getActiveTool();
    sessionManager.touch(clock.now());
    const result = activeTool.beginStroke(point, toolManager.getBrush(), clock.now());
    state.activeStroke = result.activeStroke;
    state.isDrawing = true;
    state.mousePosition = point;
    emit();
  };

  const addPoint = (point: Point): void => {
    if (!state.isDrawing || !state.activeStroke) {
      return;
    }

    const activeTool = toolManager.getActiveTool();
    sessionManager.touch(clock.now());
    const result = activeTool.continueStroke(point);
    state.activeStroke = result.activeStroke ?? state.activeStroke;

    state.mousePosition = point;
    emit();
  };

  const endStroke = (point?: Point): void => {
    if (!state.isDrawing || !state.activeStroke) {
      return;
    }

    const activeTool = toolManager.getActiveTool();
    const result = activeTool.endStroke(point ?? state.activeStroke.points[state.activeStroke.points.length - 1], clock.now());
    if (result.committedStroke) {
      sessionManager.addStroke(result.committedStroke, clock.now());
    }
    state.activeStroke = undefined;
    state.isDrawing = false;
    state.mousePosition = point ?? state.mousePosition;
    emit();
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const point = toCanvasPoint(event);
    beginStroke(point);
    canvas.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!state.isDrawing || !state.activeStroke) {
      return;
    }

    event.preventDefault();
    addPoint(toCanvasPoint(event));
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (!state.isDrawing || !state.activeStroke) {
      return;
    }

    endStroke(toCanvasPoint(event));
  };

  const getState = (): DrawingEngineState => ({
    strokes: [...state.strokes],
    activeStroke: state.activeStroke
      ? {
          ...state.activeStroke,
          points: [...state.activeStroke.points],
        }
      : undefined,
    isDrawing: state.isDrawing,
    mousePosition: state.mousePosition ? { ...state.mousePosition } : undefined,
    session: { ...state.session, strokes: [...state.session.strokes] },
    brush: toolManager.getBrush(),
  });

  const getVisibleStrokes = (): Stroke[] => {
    return [...state.strokes, ...(state.activeStroke ? [state.activeStroke] : [])];
  };

  const setBrush = (nextBrush: Partial<BrushSettings>): void => {
    toolManager.setBrush(nextBrush);
    state.brush = toolManager.getBrush();
    emit();
  };

  const setSessionConfig = (config: Partial<AnnotationSessionConfig>): void => {
    const snapshot = sessionManager.setConfig(config, clock.now());
    syncStateFromSession(snapshot);
    onStateChange?.(state);
    scheduleSessionUpdate(snapshot, clock.now());
  };

  const clear = (): void => {
    cancelLifecycleSchedule();
    sessionManager.clear();
    state.strokes = [];
    state.activeStroke = undefined;
    state.isDrawing = false;
    state.mousePosition = undefined;
    state.session = sessionManager.getSnapshot();
    emit();
  };

  const pauseSession = (): void => {
    cancelLifecycleSchedule();
    const snapshot = sessionManager.pause(clock.now());
    syncStateFromSession(snapshot);
    onStateChange?.(state);
  };

  const resumeSession = (): void => {
    const snapshot = sessionManager.resume(clock.now());
    syncStateFromSession(snapshot);
    onStateChange?.(state);
    scheduleSessionUpdate(snapshot, clock.now());
  };

  const dispose = (): void => {
    cancelLifecycleSchedule();
    state.activeStroke = undefined;
    state.isDrawing = false;
    emit();
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    beginStroke,
    addPoint,
    endStroke,
    clear,
    pauseSession,
    resumeSession,
    getState,
    getVisibleStrokes,
    setBrush,
    setSessionConfig,
    dispose,
  };
}
