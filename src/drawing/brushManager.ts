// BrushManager owns the current immutable brush and validates updates before tools see them.
import { createBrush, DEFAULT_BRUSH, type Brush, type BrushSettings } from './brush.ts';

export interface BrushManager {
  getBrush: () => Brush;
  setBrush: (brush: BrushSettings) => Brush;
}

export function createBrushManager(initialBrush?: BrushSettings): BrushManager {
  let brush = createBrush(initialBrush ?? DEFAULT_BRUSH);

  return {
    getBrush: () => brush,
    setBrush: (nextBrush) => {
      const validatedBrush: BrushSettings = {
        color: nextBrush.color ?? brush.color,
        width: Math.max(1, nextBrush.width ?? brush.width),
        opacity: Math.min(1, Math.max(0, nextBrush.opacity ?? brush.opacity)),
      };

      brush = createBrush(validatedBrush);
      return brush;
    },
  };
}