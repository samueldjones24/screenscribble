import { invoke } from '@tauri-apps/api/core';
import { createSettingsService } from './settings/service.ts';
import { mountSettingsWindow } from './settings/SettingsWindow.ts';

const app = document.querySelector<HTMLDivElement>('#app');

document.body.classList.add('settings-window');

if (app) {
  const settingsService = createSettingsService();
  mountSettingsWindow({ root: app, settingsService });
}
