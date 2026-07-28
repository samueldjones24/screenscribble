import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createOverlay } from './overlay.ts';
import { log } from './logger.ts';
import { createSettingsService } from './settings/service.ts';

interface NativeMouseEventPayload {
  kind: string;
  x: number;
  y: number;
  button: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

interface NativeSafetyEventPayload {
  kind: 'exit_app' | 'toggle_overlay' | 'pause_drawing';
  enabled?: boolean;
}

interface NativeDiagnosticEventPayload {
  stage: string;
  message: string;
}

interface ReleaseMetadata {
  appName: string;
  version: string;
  buildNumber: string;
  website: string;
  supportUrl: string;
  repositoryUrl: string;
  license: string;
  company: string;
  description: string;
  copyright: string;
}

interface SessionControlEventPayload {
  kind: 'clear_current_session' | 'shutdown';
}

const currentWindow = getCurrentWindow();
const app = document.querySelector<HTMLDivElement>('#app');
const forcedView = window.location.hash.replace(/^#/, '').toLowerCase();
const isSettingsView = currentWindow.label === 'settings' || forcedView === 'settings';

if (isSettingsView) {
  void import('./settings/settings.css');
} else if (currentWindow.label === 'overlay') {
  void import('./overlay.css');
} else {
  void import('./control.css');
}

if (app) {
  if (isSettingsView) {
    document.body.classList.add('settings-window');
    const settingsService = createSettingsService();
    void import('./settings/SettingsWindow.ts').then(({ mountSettingsWindow }) => {
      mountSettingsWindow({ root: app, settingsService });
    });
  } else if (currentWindow.label === 'overlay') {
    document.body.classList.add('overlay-window');
    app.innerHTML = '<main class="overlay-app"></main>';

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'overlay-notification';
    notification.style.display = 'none';
    document.body.appendChild(notification);

    const showNotification = (message: string): void => {
      notification.textContent = message;
      notification.style.display = 'block';
      notification.style.animation = 'none';
      void notification.offsetHeight;
      notification.style.animation = 'overlayNotificationFade 5s ease-out forwards';
    };

    const settingsService = createSettingsService();
    const overlay = createOverlay();
    log('info', 'Overlay window initialized.');

    void settingsService.initialize().then((settings) => {
      overlay.applySettings(settings);
    });

    const unsubscribeSettings = settingsService.subscribe((settings) => {
      overlay.applySettings(settings);
    });

    let overlayOrigin = { x: 0, y: 0 };
    let overlayScaleFactor = 1;

    const refreshOverlayTransform = async (): Promise<void> => {
      const [position, scaleFactor] = await Promise.all([currentWindow.innerPosition(), currentWindow.scaleFactor()]);
      overlayOrigin = position;
      overlayScaleFactor = scaleFactor || 1;
    };

    void refreshOverlayTransform();

    let lastGlobalInputAt = Date.now();
    const DRAWING_STUCK_TIMEOUT_MS = 10000;
    let watchdogTimeoutId: number | undefined;

    const clearWatchdogTimer = (): void => {
      if (watchdogTimeoutId !== undefined) {
        window.clearTimeout(watchdogTimeoutId);
        watchdogTimeoutId = undefined;
      }
    };

    const scheduleWatchdogTimer = (): void => {
      clearWatchdogTimer();

      if (overlay.getState() !== 'drawing') {
        return;
      }

      const elapsedMs = Date.now() - lastGlobalInputAt;
      const remainingMs = Math.max(0, DRAWING_STUCK_TIMEOUT_MS - elapsedMs);

      watchdogTimeoutId = window.setTimeout(() => {
        watchdogTimeoutId = undefined;

        if (overlay.getState() !== 'drawing') {
          return;
        }

        if (Date.now() - lastGlobalInputAt <= DRAWING_STUCK_TIMEOUT_MS) {
          scheduleWatchdogTimer();
          return;
        }

        overlay.forceClickThrough();
        void invoke('force_overlay_clickthrough');
        log('warn', 'Watchdog forced click-through after stalled drawing state.');
      }, remainingMs);
    };

    // Set up safety event listener immediately (outside async IIFE) to avoid missing events
    const setupSafetyListener = async (): Promise<() => void> => {
      return currentWindow.listen<NativeSafetyEventPayload>('screen_scribble:safety', (event) => {
        if (event.payload.kind === 'pause_drawing') {
          const enabled = event.payload.enabled ?? !overlay.isEnabled();
          overlay.setEnabled(enabled);
          if (!enabled) {
            overlay.engine.pauseSession();
            overlay.forceClickThrough();
          } else {
            overlay.engine.resumeSession();
          }
          scheduleWatchdogTimer();
          log('info', `Drawing ${enabled ? 'resumed' : 'paused'} via native pause event.`);
          return;
        }

        if (event.payload.kind === 'toggle_overlay') {
          const enabled = event.payload.enabled ?? !overlay.isEnabled();
          overlay.setEnabled(enabled);

          const message = enabled ? 'Draw Mode: ON' : 'Draw Mode: OFF';
          showNotification(message);
          log('info', `Showing notification: ${message}`);
          
          if (!enabled) {
            overlay.engine.clear();
            overlay.forceClickThrough();
          } else {
            overlay.engine.resumeSession();
          }
          scheduleWatchdogTimer();
          log('info', `Drawing ${enabled ? 'enabled' : 'disabled'} via native safety event.`);
        }
      });
    };

    // Start listener setup immediately
    const safetyListenerPromise = setupSafetyListener();

    void (async () => {
      const unlistenMoved = await currentWindow.onMoved(() => {
        void refreshOverlayTransform();
      });

      const unlistenScaleChanged = await currentWindow.onScaleChanged(() => {
        void refreshOverlayTransform();
      });

      const unlistenInput = await currentWindow.listen<NativeMouseEventPayload>('screen_scribble:input', (event) => {
        if (!overlay.isEnabled()) {
          return;
        }

        if (event.payload.kind !== 'down' && event.payload.kind !== 'move' && event.payload.kind !== 'up') {
          return;
        }

        lastGlobalInputAt = Date.now();

        const localX = (event.payload.x - overlayOrigin.x) / overlayScaleFactor;
        const localY = (event.payload.y - overlayOrigin.y) / overlayScaleFactor;

        const type =
          event.payload.kind === 'down'
            ? 'pointerDown'
            : event.payload.kind === 'up'
              ? 'pointerUp'
              : 'pointerMove';

        overlay.inputController.handleInputEvent({
          type,
          x: localX,
          y: localY,
          button: event.payload.button,
        });

        scheduleWatchdogTimer();
      });

      const unlistenSafety = await safetyListenerPromise;

      const unlistenSessionControl = await currentWindow.listen<SessionControlEventPayload>(
        'screen_scribble:session-control',
        (event) => {
          if (event.payload.kind === 'clear_current_session') {
            overlay.engine.clear();
            overlay.forceClickThrough();
            scheduleWatchdogTimer();
            return;
          }

          if (event.payload.kind === 'shutdown') {
            overlay.engine.clear();
            overlay.setEnabled(false);
            overlay.forceClickThrough();
          }
        },
      );

      window.addEventListener('beforeunload', () => {
        clearWatchdogTimer();
        unsubscribeSettings();
        settingsService.dispose();
        unlistenMoved();
        unlistenScaleChanged();
        unlistenInput();
        unlistenSafety();
        unlistenSessionControl();
      });
    })();

    window.addEventListener('beforeunload', () => {
      clearWatchdogTimer();
      overlay.destroy();
    });
  } else {
    document.body.classList.add('control-window');
    const isWelcomeView = forcedView === 'welcome';
    const isAboutView = forcedView === 'about';

    const loadReleaseMetadata = async (): Promise<ReleaseMetadata> => {
      try {
        return await invoke<ReleaseMetadata>('get_release_metadata');
      } catch (error) {
        log('warn', `Failed to load release metadata: ${String(error)}`);
        return {
          appName: 'ScreenScribble',
          version: '0.1.0',
          buildNumber: 'local',
          website: 'https://screenscribble.app',
          supportUrl: 'https://github.com/screenscribble/screenscribble/issues',
          repositoryUrl: 'https://github.com/screenscribble/screenscribble',
          license: 'MIT',
          company: 'ScreenScribble',
          description: 'Transient desktop annotation overlay for demos, meetings, and screenshots.',
          copyright: 'Copyright (c) 2026 ScreenScribble',
        };
      }
    };

    if (isWelcomeView) {
      app.innerHTML = `
        <main class="dialog-shell">
          <section class="dialog-card" aria-label="Welcome dialog">
            <h1>Welcome to ScreenScribble</h1>
            <p>Runs quietly from your system tray.</p>
            <p>Press <strong>Ctrl + Alt + D</strong> to enter Draw Mode.</p>
            <footer class="dialog-actions">
              <button id="welcome-open-settings" class="control-button" type="button">Open Settings</button>
              <button id="welcome-close" class="control-button" type="button">Close</button>
            </footer>
          </section>
        </main>
      `;

      const completeFirstRun = async (): Promise<void> => {
        await invoke('mark_first_run_complete');
      };

      const openSettingsButton = document.querySelector<HTMLButtonElement>('#welcome-open-settings');
      const closeButton = document.querySelector<HTMLButtonElement>('#welcome-close');

      openSettingsButton?.addEventListener('click', async () => {
        await invoke('open_settings_window');
        await completeFirstRun();
        await currentWindow.hide();
      });

      closeButton?.addEventListener('click', async () => {
        await completeFirstRun();
        await currentWindow.hide();
      });
    } else if (isAboutView) {
      app.innerHTML = `
        <main class="dialog-shell">
          <section class="dialog-card" aria-label="About dialog">
            <h1>About ScreenScribble</h1>
            <dl class="about-grid">
              <dt>Version</dt>
              <dd id="about-version">Loading…</dd>
              <dt>Build</dt>
              <dd id="about-build">Loading…</dd>
              <dt>Website</dt>
              <dd><a id="about-website" href="#" rel="noreferrer">Loading…</a></dd>
              <dt>GitHub</dt>
              <dd><a id="about-github" href="#" rel="noreferrer">Loading…</a></dd>
              <dt>License</dt>
              <dd id="about-license">Loading…</dd>
            </dl>
            <footer class="dialog-actions">
              <button id="about-close" class="control-button" type="button">Close</button>
            </footer>
          </section>
        </main>
      `;

      void loadReleaseMetadata().then((metadata) => {
        const versionNode = document.querySelector<HTMLElement>('#about-version');
        const buildNode = document.querySelector<HTMLElement>('#about-build');
        const websiteNode = document.querySelector<HTMLAnchorElement>('#about-website');
        const githubNode = document.querySelector<HTMLAnchorElement>('#about-github');
        const licenseNode = document.querySelector<HTMLElement>('#about-license');

        if (versionNode) {
          versionNode.textContent = metadata.version;
        }
        if (buildNode) {
          buildNode.textContent = metadata.buildNumber;
        }
        if (websiteNode) {
          websiteNode.textContent = metadata.website;
          websiteNode.href = metadata.website;
        }
        if (githubNode) {
          githubNode.textContent = metadata.repositoryUrl;
          githubNode.href = metadata.repositoryUrl;
        }
        if (licenseNode) {
          licenseNode.textContent = metadata.license;
        }
      });

      document.querySelector<HTMLButtonElement>('#about-close')?.addEventListener('click', async () => {
        await currentWindow.hide();
      });
    } else {
      app.innerHTML = `
      <main class="control-shell">
        <section class="control-panel">
          <header class="control-header">
            <div>
              <h1>ScreenScribble</h1>
              <p>Draw globally from the overlay, then manage behavior below.</p>
            </div>
            <aside id="overlay-status" class="status-strip" aria-live="polite">Drawing: Running</aside>
          </header>

          <section class="control-toolbar" aria-label="Application actions">
            <div class="control-actions">
              <button id="toggle-overlay" class="control-button" type="button">Pause Drawing</button>
              <button id="exit-application" class="control-button control-button-danger" type="button">Exit App</button>
            </div>
            <p id="backend-diagnostic" class="hint">Backend diagnostic: active</p>
          </section>

          <section id="inline-settings" class="inline-settings-host" aria-label="Settings"></section>
        </section>
      </main>
    `;

    let overlayEnabled = true;
    const overlayStatus = document.querySelector<HTMLElement>('#overlay-status');
    const diagnostic = document.querySelector<HTMLElement>('#backend-diagnostic');
    const inlineSettingsRoot = document.querySelector<HTMLElement>('#inline-settings');
    const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-overlay');
    const exitButton = document.querySelector<HTMLButtonElement>('#exit-application');
    const settingsService = createSettingsService();

    if (inlineSettingsRoot) {
      void import('./settings/SettingsWindow.ts').then(({ mountSettingsWindow }) => {
        mountSettingsWindow({ root: inlineSettingsRoot, settingsService });
      });
    }

    const updateOverlayStatus = (): void => {
      if (overlayStatus) {
        overlayStatus.textContent = `Drawing: ${overlayEnabled ? 'Running' : 'Paused'}`;
        overlayStatus.dataset.state = overlayEnabled ? 'enabled' : 'disabled';
      }
      if (toggleButton) {
        toggleButton.textContent = overlayEnabled ? 'Pause Drawing' : 'Resume Drawing';
      }
    };

    toggleButton?.addEventListener('click', async () => {
      overlayEnabled = await invoke<boolean>('toggle_overlay_state');
      updateOverlayStatus();
    });

    exitButton?.addEventListener('click', async () => {
      await invoke('exit_application');
    });

    void (async () => {
      const unlistenSafety = await currentWindow.listen<NativeSafetyEventPayload>('screen_scribble:safety', (event) => {
        log('info', `Safety event: kind=${event.payload.kind}, enabled=${event.payload.enabled}`);
        if (event.payload.kind === 'toggle_overlay' || event.payload.kind === 'pause_drawing') {
          overlayEnabled = event.payload.enabled ?? !overlayEnabled;
          updateOverlayStatus();
          log('info', `Syncing input state after ${event.payload.kind}`);
          void invoke('sync_input_state').then(() => {
            log('info', 'Input state synced');
          });
        }
      });

      const unlistenDiagnostic = await currentWindow.listen<NativeDiagnosticEventPayload>(
        'screen_scribble:diagnostic',
        (event) => {
          if (diagnostic) {
            diagnostic.textContent = `Backend diagnostic: [${event.payload.stage}] ${event.payload.message}`;
          }
        },
      );

      window.addEventListener('beforeunload', () => {
        settingsService.dispose();
        unlistenSafety();
        unlistenDiagnostic();
      });
    })();

      updateOverlayStatus();
    }
  }
}
