import './settings.css';
import type { SettingsService } from './service.ts';
import { cloneDefaultSettings, type ApplicationSettings } from './settings.ts';
import { DEFAULT_SHORTCUTS, keyBindingToString, actionLabel } from '../modules/shortcutsManager.ts';

function parseNumber(input: string, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mountSettingsWindow(options: { root: HTMLElement; settingsService: SettingsService }): void {
  const { root, settingsService } = options;

  root.innerHTML = `
    <main class="settings-shell">
      <header class="settings-header">
        <h1>Settings</h1>
        <p>Changes are applied immediately for supported options and can be saved for next launch.</p>
        <p id="settings-help" class="settings-help">Use Tab to navigate. Numeric fields enforce safe ranges.</p>
      </header>

      <form id="settings-form" class="settings-grid" autocomplete="off" aria-describedby="settings-help">
        <fieldset class="settings-section">
          <legend>Brush</legend>
          <label class="settings-field">Colour <input name="brush-colour" type="color" /></label>
          <label class="settings-field">Width <input name="brush-width" type="number" min="1" max="64" step="1" /></label>
          <label class="settings-field">Opacity (%) <input name="brush-opacity" type="number" min="0" max="100" step="1" /></label>
        </fieldset>

        <fieldset class="settings-section">
          <legend>Session</legend>
          <label class="settings-field">Visible duration (seconds) <input name="session-timeout" type="number" min="1" max="600" step="1" /></label>
          <label class="settings-field">Fade duration (seconds) <input name="session-fade" type="number" min="0" max="600" step="1" /></label>
          <label class="settings-field settings-checkbox"><input name="session-reset-timeout" type="checkbox" /> Reset timeout on new stroke</label>
        </fieldset>

        <fieldset class="settings-section">
          <legend>Shortcuts</legend>
          <div id="shortcuts-list" class="shortcuts-list"></div>
        </fieldset>

        <fieldset class="settings-section">
          <legend>General</legend>
          <label class="settings-field settings-checkbox"><input name="general-launch-startup" type="checkbox" /> Launch at startup</label>
        </fieldset>

        <footer class="settings-actions">
          <button id="settings-reset" class="settings-button" type="button">Reset to Defaults</button>
          <button id="settings-save" class="settings-button settings-button-primary" type="submit">Save</button>
          <span id="settings-status" class="settings-status" aria-live="polite">Loading settings…</span>
        </footer>
      </form>
    </main>
  `;

  const form = root.querySelector<HTMLFormElement>('#settings-form');
  const status = root.querySelector<HTMLElement>('#settings-status');
  const resetButton = root.querySelector<HTMLButtonElement>('#settings-reset');

  if (!form || !status || !resetButton) {
    return;
  }

  // Track edited shortcuts locally
  const editedShortcuts: { [key: string]: any } = {};

  const captureKeyBinding = (): Promise<{ ctrl: boolean; alt: boolean; shift: boolean; key: string } | null> => {
    return new Promise((resolve) => {
      const handleKeyDown = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const key = event.key.toUpperCase();
        // Only capture letter/digit keys as the main key
        if (!/^[A-Z0-9]$/.test(key)) {
          return;
        }

        const binding = {
          ctrl: event.ctrlKey,
          alt: event.altKey,
          shift: event.shiftKey,
          key: key,
        };

        cleanup();
        resolve(binding);
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      };

      const cleanup = () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('keydown', handleEscape);
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('keydown', handleEscape);
    });
  };

  const updateFormFromSettings = (settings: ApplicationSettings): void => {
    (form.elements.namedItem('brush-colour') as HTMLInputElement).value = settings.brush.colour;
    (form.elements.namedItem('brush-width') as HTMLInputElement).value = String(settings.brush.width);
    (form.elements.namedItem('brush-opacity') as HTMLInputElement).value = String(settings.brush.opacity);

    (form.elements.namedItem('session-timeout') as HTMLInputElement).value = String(settings.session.timeoutSeconds);
    (form.elements.namedItem('session-fade') as HTMLInputElement).value = String(settings.session.fadeSeconds);
    (form.elements.namedItem('session-reset-timeout') as HTMLInputElement).checked = settings.session.resetTimeoutOnNewStroke;

    (form.elements.namedItem('general-launch-startup') as HTMLInputElement).checked = settings.general.launchAtStartup;

    // Render shortcuts
    const shortcutsList = form.querySelector<HTMLElement>('#shortcuts-list');
    if (shortcutsList) {
      shortcutsList.innerHTML = '<p class="shortcuts-hint">Click a binding to edit it</p>';
      const shortcuts = { ...settings.shortcuts, ...editedShortcuts };

      const defaultOrder = Object.keys(DEFAULT_SHORTCUTS);
      const defaultKeys = defaultOrder.filter((key) => key in shortcuts);
      const additionalKeys = Object.keys(shortcuts)
        .filter((key) => !defaultOrder.includes(key))
        .sort((left, right) => left.localeCompare(right));
      const orderedKeys = [...defaultKeys, ...additionalKeys] as Array<keyof typeof shortcuts>;

      for (const key of orderedKeys) {
        const binding = shortcuts[key];
        const div = document.createElement('div');
        div.className = 'shortcut-item';
        
        const actionSpan = document.createElement('span');
        actionSpan.className = 'shortcut-action';
        actionSpan.textContent = actionLabel(key as any);
        
        const bindingButton = document.createElement('button');
        bindingButton.type = 'button';
        bindingButton.className = 'shortcut-binding-button';
        bindingButton.textContent = keyBindingToString(binding);
        
        bindingButton.addEventListener('click', async (e) => {
          e.preventDefault();
          bindingButton.disabled = true;
          bindingButton.classList.add('shortcut-editing');
          bindingButton.textContent = 'Waiting for key…';
          
          const newBinding = await captureKeyBinding();
          
          if (newBinding) {
            editedShortcuts[key as string] = newBinding;
            bindingButton.textContent = keyBindingToString(newBinding);
            bindingButton.classList.remove('shortcut-editing');
            bindingButton.disabled = false;
            status.textContent = 'Shortcut updated. Save to persist.';
          } else {
            bindingButton.textContent = keyBindingToString(binding);
            bindingButton.classList.remove('shortcut-editing');
            bindingButton.disabled = false;
          }
        });
        
        div.appendChild(actionSpan);
        div.appendChild(bindingButton);
        shortcutsList.appendChild(div);
      }
    }
  };

  const readSettingsFromForm = (): ApplicationSettings => {
    const current = settingsService.getSettings();

    return {
      schemaVersion: current.schemaVersion,
      brush: {
        colour: (form.elements.namedItem('brush-colour') as HTMLInputElement).value,
        width: parseNumber((form.elements.namedItem('brush-width') as HTMLInputElement).value, current.brush.width),
        opacity: parseNumber((form.elements.namedItem('brush-opacity') as HTMLInputElement).value, current.brush.opacity),
      },
      session: {
        timeoutSeconds: parseNumber(
          (form.elements.namedItem('session-timeout') as HTMLInputElement).value,
          current.session.timeoutSeconds,
        ),
        fadeSeconds: parseNumber((form.elements.namedItem('session-fade') as HTMLInputElement).value, current.session.fadeSeconds),
        resetTimeoutOnNewStroke: (form.elements.namedItem('session-reset-timeout') as HTMLInputElement).checked,
      },
      input: {},
      shortcuts: { ...current.shortcuts, ...editedShortcuts },
      general: {
        launchAtStartup: (form.elements.namedItem('general-launch-startup') as HTMLInputElement).checked,
        firstRunCompleted: current.general.firstRunCompleted,
      },
    };
  };

  void settingsService.initialize().then((initialSettings) => {
    updateFormFromSettings(initialSettings);
    status.textContent = 'Loaded from user configuration.';
  });

  const unsubscribe = settingsService.subscribe((next) => {
    updateFormFromSettings(next);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = 'Saving…';
    void settingsService.save(readSettingsFromForm()).then((saved) => {
      Object.keys(editedShortcuts).forEach((key) => delete editedShortcuts[key]); // Clear edited shortcuts after save
      updateFormFromSettings(saved);
      status.textContent = 'Saved.';
    });
  });

  resetButton.addEventListener('click', () => {
    const defaults = cloneDefaultSettings();
    Object.keys(editedShortcuts).forEach((key) => delete editedShortcuts[key]); // Clear any pending edits
    updateFormFromSettings(defaults);
    status.textContent = 'Defaults applied in form. Save to persist.';
  });

  window.addEventListener('beforeunload', () => {
    unsubscribe();
    settingsService.dispose();
  });
}
