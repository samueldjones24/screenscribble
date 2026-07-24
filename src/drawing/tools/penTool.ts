// PenTool reproduces the existing freehand drawing behaviour exactly.
import { createStroke, type Point, type Stroke } from '../stroke.ts';
import type { Brush } from '../brush.ts';
import type { DrawingTool, DrawingToolResult } from './drawingTool.ts';

export function createPenTool(): DrawingTool {
  let activeStroke: Stroke | undefined;

  const beginStroke = (point: Point, brush: Brush, now: number): DrawingToolResult => {
    activeStroke = createStroke(brush, {
      createdAt: now,
    });
    activeStroke.points.push(point);
    return { activeStroke };
  };

  const continueStroke = (point: Point): DrawingToolResult => {
    if (!activeStroke) {
      return {};
    }

    const lastPoint = activeStroke.points[activeStroke.points.length - 1];
    if (!lastPoint || lastPoint.x !== point.x || lastPoint.y !== point.y) {
      activeStroke.points.push(point);
    }

    return { activeStroke };
  };

  const endStroke = (point: Point, now: number): DrawingToolResult => {
    if (!activeStroke) {
      return {};
    }

    const lastPoint = activeStroke.points[activeStroke.points.length - 1];
    if (!lastPoint || lastPoint.x !== point.x || lastPoint.y !== point.y) {
      activeStroke.points.push(point);
    }

    activeStroke.createdAt = now;

    const committedStroke = activeStroke;
    activeStroke = undefined;

    return {
      committedStroke,
      activeStroke: undefined,
    };
  };

  return {
    beginStroke,
    continueStroke,
    endStroke,
    getActiveStroke: () => activeStroke,
  };
}