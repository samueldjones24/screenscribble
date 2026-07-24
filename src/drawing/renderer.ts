import type { BrushSettings, Point, Stroke } from './stroke.ts';
import type { AnnotationSessionSnapshot } from './annotationSession.ts';

export interface RendererState {
  strokes: Stroke[];
  activeStroke?: Stroke;
  brush: BrushSettings;
  isDrawing: boolean;
  mousePosition?: Point;
  session: AnnotationSessionSnapshot;
}

export interface Renderer {
  canvas: HTMLCanvasElement;
  resize: () => void;
  setState: (state: RendererState) => void;
  dispose: () => void;
}

export function createRenderer(options: {
  canvas: HTMLCanvasElement;
  container?: HTMLElement;
}): Renderer {
  const { canvas, container } = options;
  const context = canvas.getContext('2d');
  const host = container ?? canvas.parentElement;

  let state: RendererState = {
    strokes: [],
    activeStroke: undefined,
    brush: { color: '#FACC15', width: 5, opacity: 0.95 },
    isDrawing: false,
    mousePosition: undefined,
    session: {
      strokes: [],
      lastActivity: performance.now(),
      timeoutMs: 10000,
      fadeDurationMs: 1000,
      state: 'expired',
      isPaused: false,
      opacity: 0,
      activeStrokeCount: 0,
      fadingStrokeCount: 0,
      expiredStrokeCount: 0,
      averageStrokeAgeMs: 0,
    },
  };
  let animationFrameId = 0;
  let pendingRender = false;
  let width = 0;
  let height = 0;

  function scheduleRender(): void {
    if (pendingRender) {
      return;
    }

    pendingRender = true;
    animationFrameId = window.requestAnimationFrame(() => {
      pendingRender = false;
      renderFrame();
    });
  }

  function renderFrame(): void {
    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    let strokeMemoryBytesEstimate = 0;
    let totalPointCount = 0;

    const drawStroke = (stroke: Stroke): void => {
      const points = stroke.points;
      if (points.length === 0) {
        return;
      }

      totalPointCount += points.length;
      strokeMemoryBytesEstimate += 64 + points.length * 16;

      context.beginPath();
      context.strokeStyle = stroke.colour;
      context.globalAlpha = stroke.opacity * state.session.opacity;
      context.lineWidth = stroke.width;

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      }

      if (points.length === 1) {
        context.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      }

      context.stroke();
    };

    for (let index = 0; index < state.strokes.length; index += 1) {
      drawStroke(state.strokes[index]);
    }

    if (state.activeStroke) {
      drawStroke(state.activeStroke);
    }

    context.restore();
  }

  function resize(): void {
    const rect = host?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (context) {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    scheduleRender();
  }

  function setState(nextState: RendererState): void {
    state = {
      ...state,
      ...nextState,
      session: {
        ...state.session,
        ...nextState.session,
        strokes: nextState.session.strokes,
      },
    };
    scheduleRender();
  }

  function dispose(): void {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
    }

  }

  resize();

  return {
    canvas,
    resize,
    setState,
    dispose,
  };
}
