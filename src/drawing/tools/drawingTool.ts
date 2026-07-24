// Drawing tools interpret pointer input and own the active stroke lifecycle.
import type { Brush } from '../brush.ts';
import type { Point, Stroke } from '../stroke.ts';

export interface DrawingToolResult {
  activeStroke?: Stroke;
  committedStroke?: Stroke;
}

export interface DrawingTool {
  beginStroke: (point: Point, brush: Brush, now: number) => DrawingToolResult;
  continueStroke: (point: Point) => DrawingToolResult;
  endStroke: (point: Point, now: number) => DrawingToolResult;
  getActiveStroke: () => Stroke | undefined;
}