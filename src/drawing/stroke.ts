export interface Point {
  x: number;
  y: number;
}

export type StrokeState = 'active' | 'fading' | 'expired';

export interface StrokeLifecycleConfig {
  visibleDurationMs: number;
  fadeDurationMs: number;
}

import { DEFAULT_BRUSH as DEFAULT_TOOL_BRUSH, type Brush } from './brush.ts';

export interface Stroke {
  id: string;
  points: Point[];
  colour: string;
  width: number;
  opacity: number;
  createdAt: number;
}

export type BrushSettings = Brush;

export const DEFAULT_BRUSH: Brush = DEFAULT_TOOL_BRUSH;

export const DEFAULT_STROKE_LIFETIME_CONFIG: StrokeLifecycleConfig = {
  visibleDurationMs: 10000,
  fadeDurationMs: 1000,
};

export function createPoint(x: number, y: number): Point {
  return { x, y };
}

export function createStroke(
  brush: Brush = DEFAULT_BRUSH,
  options: {
    createdAt: number;
  },
): Stroke {
  return {
    id: crypto.randomUUID(),
    points: [],
    colour: brush.color,
    width: brush.width,
    opacity: brush.opacity,
    createdAt: options.createdAt,
  };
}
