
export interface BrushSettingsModel {
  colour: string;
  width: number;
  opacity: number;
}

export interface SessionSettings {
  timeoutSeconds: number;
  fadeSeconds: number;
  resetTimeoutOnNewStroke: boolean;
}

export interface InputSettings {}

export interface KeyBinding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export interface ShortcutsSettings {
  [key: string]: KeyBinding;
}

export interface GeneralSettings {
  launchAtStartup: boolean;
}

export interface ApplicationSettings {
  schemaVersion: number;
  brush: BrushSettingsModel;
  session: SessionSettings;
  input: InputSettings;
  shortcuts: ShortcutsSettings;
  general: GeneralSettings;
}

export const DEFAULT_SETTINGS: ApplicationSettings = Object.freeze({
  schemaVersion: 1,
  brush: {
    colour: '#FACC15',
    width: 5,
    opacity: 95,
  },
  session: {
    timeoutSeconds: 10,
    fadeSeconds: 1,
    resetTimeoutOnNewStroke: true,
  },
  input: {},
  shortcuts: {
    draw_mode_toggle: { ctrl: true, alt: true, shift: false, key: 'D' },
    pause_resume: { ctrl: true, alt: true, shift: false, key: 'P' },
    clear_drawing: { ctrl: true, alt: true, shift: false, key: 'C' },
  },
  general: {
    launchAtStartup: false,
  },
});

export interface SettingsValidationIssue {
  field: string;
  message: string;
}

export interface SettingsValidationResult {
  settings: ApplicationSettings;
  issues: SettingsValidationIssue[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isHexColour(colour: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(colour);
}

export function validateAndNormalizeSettings(input: ApplicationSettings): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];

  const colour = typeof input.brush.colour === 'string' && isHexColour(input.brush.colour)
    ? input.brush.colour
    : DEFAULT_SETTINGS.brush.colour;
  if (colour !== input.brush.colour) {
    issues.push({ field: 'brush.colour', message: 'Invalid colour; using default.' });
  }

  const width = Number.isFinite(input.brush.width)
    ? Math.round(clamp(input.brush.width, 1, 64))
    : DEFAULT_SETTINGS.brush.width;
  if (width !== input.brush.width) {
    issues.push({ field: 'brush.width', message: 'Brush width must be between 1 and 64.' });
  }

  const opacity = Number.isFinite(input.brush.opacity)
    ? Math.round(clamp(input.brush.opacity, 0, 100))
    : DEFAULT_SETTINGS.brush.opacity;
  if (opacity !== input.brush.opacity) {
    issues.push({ field: 'brush.opacity', message: 'Brush opacity must be between 0 and 100.' });
  }

  const timeoutSeconds = Number.isFinite(input.session.timeoutSeconds)
    ? Math.round(clamp(input.session.timeoutSeconds, 1, 600))
    : DEFAULT_SETTINGS.session.timeoutSeconds;

  let fadeSeconds = Number.isFinite(input.session.fadeSeconds)
    ? Math.round(clamp(input.session.fadeSeconds, 0, 600))
    : DEFAULT_SETTINGS.session.fadeSeconds;

  if (fadeSeconds > timeoutSeconds) {
    fadeSeconds = timeoutSeconds;
    issues.push({ field: 'session.fadeSeconds', message: 'Fade duration cannot exceed visible duration.' });
  }

  const normalized: ApplicationSettings = {
    schemaVersion: input.schemaVersion ?? 1,
    brush: {
      colour,
      width,
      opacity,
    },
    session: {
      timeoutSeconds,
      fadeSeconds,
      resetTimeoutOnNewStroke: Boolean(input.session.resetTimeoutOnNewStroke),
    },
    input: {},
    shortcuts: input.shortcuts ?? DEFAULT_SETTINGS.shortcuts,
    general: {
      launchAtStartup: Boolean(input.general.launchAtStartup),
    },
  };

  return { settings: normalized, issues };
}

export function cloneDefaultSettings(): ApplicationSettings {
  return structuredClone(DEFAULT_SETTINGS);
}
