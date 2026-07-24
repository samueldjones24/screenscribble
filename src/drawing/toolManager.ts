// ToolManager exposes the active drawing tool and brush, and will later own tool registration.
import type { Brush } from './brush.ts';
import type { BrushSettings } from './brush.ts';
import { createBrushManager, type BrushManager } from './brushManager.ts';
import { createPenTool } from './tools/penTool.ts';
import type { DrawingTool } from './tools/drawingTool.ts';

export interface ToolManager {
  getActiveTool: () => DrawingTool;
  getBrush: () => Brush;
  setBrush: (brush: BrushSettings) => Brush;
}

export function createToolManager(options: { brush?: BrushSettings } = {}): ToolManager {
  const brushManager: BrushManager = createBrushManager(options.brush);
  const activeTool = createPenTool();

  return {
    getActiveTool: () => activeTool,
    getBrush: () => brushManager.getBrush(),
    setBrush: (brush) => brushManager.setBrush(brush),
  };
}