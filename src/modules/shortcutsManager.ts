export type ShortcutAction = 'draw_mode_toggle' | 'pause_resume' | 'clear_drawing';

export interface KeyBinding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export interface ShortcutsConfig {
  draw_mode_toggle: KeyBinding;
  pause_resume: KeyBinding;
  clear_drawing: KeyBinding;
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  draw_mode_toggle: { ctrl: true, alt: true, shift: false, key: 'D' },
  pause_resume: { ctrl: true, alt: true, shift: false, key: 'P' },
  clear_drawing: { ctrl: true, alt: true, shift: false, key: 'C' },
};

export function keyBindingToString(binding: KeyBinding): string {
  const parts = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  parts.push(binding.key.toUpperCase());
  return parts.join(' + ');
}

export function actionLabel(action: ShortcutAction): string {
  switch (action) {
    case 'draw_mode_toggle':
      return 'Start/Stop Drawing';
    case 'pause_resume':
      return 'Pause/Resume';
    case 'clear_drawing':
      return 'Clear Screen';
    default:
      return action;
  }
}
