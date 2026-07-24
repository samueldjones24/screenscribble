import { createInputController } from './controller.ts';
import type { DrawingEngine } from '../drawing/engine.ts';

export interface OverlayInputController {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  handleInputEvent: (event: { type: 'pointerDown' | 'pointerMove' | 'pointerUp'; x: number; y: number; button?: number }) => void;
}

export function createOverlayInputController(options: {
  engine: DrawingEngine;
  onInteractionStateChange?: (state: 'inactive' | 'drawing') => void;
}): OverlayInputController {
  const controller = createInputController({ engine: options.engine });

  const handleInputEvent = (event: { type: 'pointerDown' | 'pointerMove' | 'pointerUp'; x: number; y: number; button?: number }): void => {
    if (event.type === 'pointerDown') {
      options.onInteractionStateChange?.('drawing');
    } else if (event.type === 'pointerUp') {
      options.onInteractionStateChange?.('inactive');
    }

    controller.handleInputEvent(event);
  };

  return {
    start: () => undefined,
    stop: () => undefined,
    dispose: () => {
      controller.dispose();
    },
    handleInputEvent,
  };
}
