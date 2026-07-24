// Immutable brush values are produced by the brush manager and consumed by tools.
export interface Brush {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
}

export type BrushSettings = Partial<Brush>;

export const DEFAULT_BRUSH: Brush = Object.freeze({
  color: '#FACC15',
  width: 5,
  opacity: 0.95,
});

export function createBrush(settings: BrushSettings = {}): Brush {
  return Object.freeze({
    color: settings.color ?? DEFAULT_BRUSH.color,
    width: settings.width ?? DEFAULT_BRUSH.width,
    opacity: settings.opacity ?? DEFAULT_BRUSH.opacity,
  });
}