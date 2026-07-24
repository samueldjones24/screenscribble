import type { DrawingEngine } from '../drawing/engine.ts';

export interface InputEvent {
  type: 'pointerDown' | 'pointerMove' | 'pointerUp';
  x: number;
  y: number;
}

export interface InputController {
  handleInputEvent: (event: InputEvent & { button?: number }) => void;
  dispose: () => void;
}

export function createInputController(options: {
  engine: DrawingEngine;
}): InputController {
  let isStrokeActive = false;

  const handleInputEvent = (event: InputEvent & { button?: number }): void => {
    switch (event.type) {
      case 'pointerDown':
        // When overlay is active (Start Drawing enabled), left click (button 0) draws
        if (event.button !== 0) {
          return;
        }
        isStrokeActive = true;
        options.engine.beginStroke({ x: event.x, y: event.y });
        break;
      case 'pointerMove':
        if (!isStrokeActive) {
          return;
        }
        options.engine.addPoint({ x: event.x, y: event.y });
        break;
      case 'pointerUp':
        if (!isStrokeActive) {
          return;
        }
        isStrokeActive = false;
        options.engine.endStroke({ x: event.x, y: event.y });
        break;
      default:
        break;
    }
  };

  return {
    handleInputEvent,
    dispose: () => {
      isStrokeActive = false;
    },
  };
}
