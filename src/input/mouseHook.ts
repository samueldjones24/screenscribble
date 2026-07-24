import type { InputEvent } from './controller.ts';

export interface MouseHookEvent {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
  button: number;
}

export interface MouseHook {
  start: () => void;
  stop: () => void;
  onEvent: (handler: (event: MouseHookEvent) => void) => void;
}

export function createMouseHook(): MouseHook {
  let handler: ((event: MouseHookEvent) => void) | undefined;
  let isTracking = false;

  const emit = (event: MouseHookEvent): void => {
    handler?.(event);
  };

  const start = (): void => {
    if (isTracking) {
      return;
    }

    isTracking = true;

    const handleWindowMouseMove = (event: MouseEvent): void => {
      emit({ type: 'move', x: event.screenX, y: event.screenY, button: event.button });
    };

    const handleWindowMouseDown = (event: MouseEvent): void => {
      if (event.button === 1) {
        emit({ type: 'down', x: event.screenX, y: event.screenY, button: event.button });
      }
    };

    const handleWindowMouseUp = (event: MouseEvent): void => {
      if (event.button === 1) {
        emit({ type: 'up', x: event.screenX, y: event.screenY, button: event.button });
      }
    };

    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    const originalStop = () => {
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      isTracking = false;
    };

    const existingStop = (handler as unknown as { stop?: () => void })?.stop;
    if (existingStop) {
      existingStop();
    }

    (handler as unknown as { stop?: () => void }).stop = originalStop;
  };

  return {
    start,
    stop: () => {
      if (handler) {
        (handler as unknown as { stop?: () => void }).stop?.();
      }
    },
    onEvent: (nextHandler) => {
      handler = nextHandler;
    },
  };
}

export function mapMouseHookEventToInputEvent(event: MouseHookEvent): InputEvent {
  switch (event.type) {
    case 'down':
      return { type: 'pointerDown', x: event.x, y: event.y };
    case 'move':
      return { type: 'pointerMove', x: event.x, y: event.y };
    case 'up':
      return { type: 'pointerUp', x: event.x, y: event.y };
    default:
      return { type: 'pointerMove', x: event.x, y: event.y };
  }
}
