import assert from 'node:assert/strict';
import test from 'node:test';
import { createInputController } from '../src/input/controller.ts';

function createStubEngine() {
  const calls: Array<{ type: 'begin' | 'add' | 'end'; x: number; y: number }> = [];

  return {
    engine: {
      beginStroke(point: { x: number; y: number }) {
        calls.push({ type: 'begin', x: point.x, y: point.y });
      },
      addPoint(point: { x: number; y: number }) {
        calls.push({ type: 'add', x: point.x, y: point.y });
      },
      endStroke(point?: { x: number; y: number }) {
        calls.push({ type: 'end', x: point?.x ?? -1, y: point?.y ?? -1 });
      },
    },
    calls,
  };
}

test('input controller accepts left click', () => {
  const { engine, calls } = createStubEngine();
  const controller = createInputController({ engine: engine as never });

  controller.handleInputEvent({ type: 'pointerDown', x: 10, y: 20, button: 0 });
  controller.handleInputEvent({ type: 'pointerMove', x: 12, y: 22, button: 0 });
  controller.handleInputEvent({ type: 'pointerUp', x: 14, y: 24, button: 0 });

  assert.deepEqual(calls, [
    { type: 'begin', x: 10, y: 20 },
    { type: 'add', x: 12, y: 22 },
    { type: 'end', x: 14, y: 24 },
  ]);
});

test('input controller ignores right click', () => {
  const { engine, calls } = createStubEngine();
  const controller = createInputController({ engine: engine as never });

  controller.handleInputEvent({ type: 'pointerDown', x: 1, y: 2, button: 2 });
  controller.handleInputEvent({ type: 'pointerUp', x: 3, y: 4, button: 2 });

  assert.deepEqual(calls, []);
});
