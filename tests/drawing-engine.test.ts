import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawingEngine } from '../src/drawing/engine.ts';
import { createCanvasElement } from '../src/drawing/canvas.ts';
import { createPoint, DEFAULT_BRUSH } from '../src/drawing/stroke.ts';

function withFakeWindow<T>(run: () => T): T {
  const previousWindow = globalThis.window;
  const rafCallbacks: Array<(time: number) => void> = [];

  (globalThis as never as { window: unknown }).window = {
    requestAnimationFrame: (callback: (time: number) => void) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
    cancelAnimationFrame: () => undefined,
  };

  try {
    return run();
  } finally {
    (globalThis as never as { window: unknown }).window = previousWindow;
  }
}

test('createDrawingEngine records a stroke after pointer events', () => {
  const canvas = createCanvasElement();
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 200, height: 200 }),
  });

  const engine = createDrawingEngine({ canvas });
  const downEvent = {
    clientX: 100,
    clientY: 100,
    button: 0,
    pointerId: 1,
    preventDefault: () => undefined,
    currentTarget: canvas,
  } as unknown as PointerEvent;

  engine.handlePointerDown(downEvent);
  engine.handlePointerMove({
    clientX: 120,
    clientY: 120,
    button: 0,
    pointerId: 1,
    preventDefault: () => undefined,
    currentTarget: canvas,
  } as unknown as PointerEvent);
  engine.handlePointerUp({
    clientX: 120,
    clientY: 120,
    button: 0,
    pointerId: 1,
    preventDefault: () => undefined,
    currentTarget: canvas,
  } as unknown as PointerEvent);

  const state = engine.getState();
  assert.equal(state.strokes.length, 1);
  assert.equal(state.strokes[0].points.length, 2);
  assert.equal(state.brush.color, DEFAULT_BRUSH.color);
});

test('createDrawingEngine exposes visible strokes through the session API', () => {
  const canvas = createCanvasElement();
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 200, height: 200 }),
  });

  const engine = createDrawingEngine({ canvas });
  engine.beginStroke(createPoint(10, 10));
  engine.addPoint(createPoint(20, 20));
  engine.endStroke(createPoint(20, 20));

  const visible = engine.getVisibleStrokes();
  assert.equal(visible.length, 1);
  assert.equal(visible[0].points.length, 2);

  engine.clear();
  assert.equal(engine.getVisibleStrokes().length, 0);
});

test('createDrawingEngine fades strokes using the clock timestamp during animation frames', () => {
  const canvas = createCanvasElement();
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 200, height: 200 }),
  });

  const rafCallbacks: Array<(time: number) => void> = [];
  const previousWindow = globalThis.window;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const timeoutCallbacks: Array<() => void> = [];

  (globalThis as never as { window: unknown }).window = {
    requestAnimationFrame: (callback: (time: number) => void) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
    cancelAnimationFrame: () => undefined,
  };

  globalThis.setTimeout = ((callback: () => void) => {
    timeoutCallbacks.push(callback);
    return timeoutCallbacks.length as never;
  }) as never;

  globalThis.clearTimeout = (() => undefined) as never;

  try {
    let now = 0;
    const engine = createDrawingEngine({
      canvas,
      clock: { now: () => now },
    });

    engine.beginStroke(createPoint(10, 10));
    engine.endStroke(createPoint(20, 20));

    now = 10500;
    timeoutCallbacks[0]?.();

    assert.equal(rafCallbacks.length > 0, true);

    now = 10500;
    rafCallbacks[0]?.(123.45);

    const state = engine.getState();
    assert.equal(state.strokes.length, 1);
    assert.equal(state.strokes[0].opacity, DEFAULT_BRUSH.opacity);
    assert.equal(state.session.state, 'fading');
    assert.ok(state.session.opacity < 1);
    assert.ok(state.session.opacity > 0);
  } finally {
    (globalThis as never as { window: unknown }).window = previousWindow;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
  }
});

test('createDrawingEngine pauses the session timer until resume', () => {
  const canvas = createCanvasElement();
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 200, height: 200 }),
  });

  const previousWindow = globalThis.window;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const timeoutCallbacks: Array<() => void> = [];

  (globalThis as never as { window: unknown }).window = {
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => undefined,
  };

  globalThis.setTimeout = ((callback: () => void) => {
    timeoutCallbacks.push(callback);
    return timeoutCallbacks.length as never;
  }) as never;

  globalThis.clearTimeout = (() => undefined) as never;

  try {
    let now = 0;
    const engine = createDrawingEngine({
      canvas,
      clock: { now: () => now },
    });

    engine.beginStroke(createPoint(10, 10));
    engine.endStroke(createPoint(20, 20));

    now = 5000;
    engine.pauseSession();

    now = 20000;
    let state = engine.getState();
    assert.equal(state.session.isPaused, true);
    assert.equal(state.session.state, 'active');
    assert.equal(state.session.opacity, 1);

    engine.resumeSession();

    state = engine.getState();
    assert.equal(state.session.isPaused, false);
    assert.equal(state.session.state, 'active');
    assert.equal(state.session.opacity, 1);

    now = 25500;
    timeoutCallbacks.at(-1)?.();

    state = engine.getState();
    assert.equal(state.session.state, 'fading');
    assert.ok(state.session.opacity < 1);
  } finally {
    (globalThis as never as { window: unknown }).window = previousWindow;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
  }
});
