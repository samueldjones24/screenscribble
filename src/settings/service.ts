import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  cloneDefaultSettings,
  validateAndNormalizeSettings,
  type ApplicationSettings,
} from './settings.ts';
import { log } from '../logger.ts';

export interface SettingsService {
  initialize: () => Promise<ApplicationSettings>;
  getSettings: () => ApplicationSettings;
  save: (settings: ApplicationSettings) => Promise<ApplicationSettings>;
  markFirstRunComplete: () => Promise<ApplicationSettings>;
  subscribe: (listener: (settings: ApplicationSettings) => void) => () => void;
  dispose: () => void;
}

export function createSettingsService(): SettingsService {
  let settings = cloneDefaultSettings();
  let unlisten: (() => void) | undefined;
  const listeners = new Set<(settings: ApplicationSettings) => void>();

  const notify = (): void => {
    for (const listener of listeners) {
      listener(settings);
    }
  };

  const setSettings = (next: ApplicationSettings): ApplicationSettings => {
    const normalized = validateAndNormalizeSettings(next).settings;
    settings = normalized;
    notify();
    return settings;
  };

  const initialize = async (): Promise<ApplicationSettings> => {
    try {
      const loaded = await invoke<ApplicationSettings>('load_settings');
      setSettings(loaded);
    } catch (error) {
      log('error', `Failed to load settings from backend: ${String(error)}`);
      settings = cloneDefaultSettings();
      notify();
    }

    try {
      unlisten = await getCurrentWindow().listen<ApplicationSettings>('screen_scribble:settings-updated', (event) => {
        setSettings(event.payload);
      });
    } catch (error) {
      log('warn', `Could not subscribe to settings updates: ${String(error)}`);
    }

    return settings;
  };

  const persistSettings = async (nextSettings: ApplicationSettings): Promise<ApplicationSettings> => {
    const normalized = validateAndNormalizeSettings(nextSettings).settings;
    try {
      const saved = await invoke<ApplicationSettings>('save_settings', { settings: normalized });
      return setSettings(saved);
    } catch (error) {
      log('error', `Failed to save settings: ${String(error)}`);
      return settings;
    }
  };

  return {
    initialize,
    getSettings: () => settings,
    save: persistSettings,
    markFirstRunComplete: async () => {
      const nextSettings: ApplicationSettings = {
        ...settings,
        general: {
          ...settings.general,
          firstRunCompleted: true,
        },
      };
      return persistSettings(nextSettings);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      unlisten?.();
      listeners.clear();
    },
  };
}
