import { createCanvasElement } from './drawing/canvas.ts';
import { createDrawingEngine } from './drawing/engine.ts';
import { createRenderer } from './drawing/renderer.ts';
import type { BrushSettings } from './drawing/stroke.ts';
import { createOverlayInputController } from './input/overlayInput.ts';
import type { ApplicationSettings } from './settings/settings.ts';

export type OverlayInteractionState = 'inactive' | 'drawing';

export interface OverlayController {
  canvas: HTMLCanvasElement;
  renderer: ReturnType<typeof createRenderer>;
  engine: ReturnType<typeof createDrawingEngine>;
  inputController: ReturnType<typeof createOverlayInputController>;
  getState: () => OverlayInteractionState;
  setState: (state: OverlayInteractionState) => void;
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  forceClickThrough: () => void;
  applySettings: (settings: ApplicationSettings) => void;
  destroy: () => void;
}

export function createOverlay(options: { brush?: Partial<BrushSettings>; settings?: ApplicationSettings } = {}): OverlayController {
  const applySettingsToOverlay = (
    engine: ReturnType<typeof createDrawingEngine>,
    settings: ApplicationSettings,
  ): void => {
    engine.setBrush({
      color: settings.brush.colour,
      width: settings.brush.width,
      opacity: settings.brush.opacity / 100,
    });
    engine.setSessionConfig({
      visibleDurationMs: settings.session.timeoutSeconds * 1000,
      fadeDurationMs: settings.session.fadeSeconds * 1000,
      resetTimeoutOnNewStroke: settings.session.resetTimeoutOnNewStroke,
    });
  };

  if (document.querySelector('.overlay-shell')) {
    const existing = document.querySelector('.overlay-shell') as HTMLElement;
    const canvas = existing.querySelector('canvas') as HTMLCanvasElement;
    const renderer = createRenderer({ canvas, container: existing });
    const engine = createDrawingEngine({
      canvas,
      brush: options.brush,
      sessionConfig: options.settings
        ? {
            visibleDurationMs: options.settings.session.timeoutSeconds * 1000,
            fadeDurationMs: options.settings.session.fadeSeconds * 1000,
            resetTimeoutOnNewStroke: options.settings.session.resetTimeoutOnNewStroke,
          }
        : undefined,
      onStateChange: (state) => renderer.setState(state),
    });

    renderer.setState(engine.getState());

    let interactionState: OverlayInteractionState = 'inactive';

    const inputController = createOverlayInputController({
      engine,
      onInteractionStateChange: (state) => {
        interactionState = state;
        const nextState = state === 'drawing' ? 'drawing' : 'inactive';
        existing.style.pointerEvents = nextState === 'drawing' ? 'auto' : 'none';
        const existingCanvas = existing.querySelector('canvas') as HTMLCanvasElement | null;
        existingCanvas?.style.setProperty('pointer-events', nextState === 'drawing' ? 'auto' : 'none');
      },
    });
    inputController.start();

    return {
      canvas,
      renderer,
      engine,
      inputController,
      getState: () => interactionState,
      setState: (state) => {
        interactionState = state;
      },
      isEnabled: () => true,
      setEnabled: () => undefined,
      forceClickThrough: () => {
        interactionState = 'inactive';
        existing.style.pointerEvents = 'none';
      },
      applySettings: (settings) => {
        applySettingsToOverlay(engine, settings);
      },
      destroy: () => {
        inputController.dispose();
        renderer.dispose();
        existing.remove();
      },
    };
  }

  const shell = document.createElement('div');
  shell.className = 'overlay-shell';
  shell.setAttribute('aria-label', 'ScreenScribble overlay');
  shell.style.pointerEvents = 'none';

  const canvas = createCanvasElement({ className: 'overlay-canvas' });
  shell.appendChild(canvas);
  document.body.appendChild(shell);

  const renderer = createRenderer({ canvas, container: shell });
  const engine = createDrawingEngine({
    canvas,
    brush: options.brush,
    sessionConfig: options.settings
      ? {
          visibleDurationMs: options.settings.session.timeoutSeconds * 1000,
          fadeDurationMs: options.settings.session.fadeSeconds * 1000,
          resetTimeoutOnNewStroke: options.settings.session.resetTimeoutOnNewStroke,
        }
      : undefined,
    onStateChange: (state) => renderer.setState(state),
  });

  let interactionState: OverlayInteractionState = 'inactive';
  let isEnabled = true;
  const handleResize = () => renderer.resize();

  const applyOverlayInteractivity = (): void => {
    if (!isEnabled) {
      shell.style.pointerEvents = 'none';
      shell.style.visibility = 'visible';
      canvas.style.pointerEvents = 'none';
      return;
    }

    shell.style.visibility = 'visible';
    shell.style.pointerEvents = interactionState === 'drawing' ? 'auto' : 'none';
    canvas.style.pointerEvents = interactionState === 'drawing' ? 'auto' : 'none';
  };

  const setInteractionState = (state: OverlayInteractionState): void => {
    interactionState = state;
    applyOverlayInteractivity();
  };

  const setEnabled = (enabled: boolean): void => {
    if (isEnabled === enabled) return; // Only trigger if state actually changes
    
    isEnabled = enabled;
    if (!enabled && engine.getState().isDrawing) {
      engine.endStroke();
      interactionState = 'inactive';
    }
    applyOverlayInteractivity();
  };

  window.addEventListener('resize', handleResize);

  renderer.setState(engine.getState());
  applyOverlayInteractivity();
  const inputController = createOverlayInputController({
    engine,
    onInteractionStateChange: setInteractionState,
  });
  inputController.start();

  if (options.settings) {
    applySettingsToOverlay(engine, options.settings);
  }

  return {
    canvas,
    renderer,
    engine,
    inputController,
    getState: () => interactionState,
    setState: setInteractionState,
    isEnabled: () => isEnabled,
    setEnabled,
    forceClickThrough: () => setInteractionState('inactive'),
    applySettings: (settings) => {
      applySettingsToOverlay(engine, settings);
    },
    destroy: () => {
      inputController.dispose();
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      shell.remove();
    },
  };
}
