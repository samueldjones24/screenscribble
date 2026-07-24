import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrushManager } from '../src/drawing/brushManager.ts';
import { createPenTool } from '../src/drawing/tools/penTool.ts';


test('brush manager returns immutable brush instances', () => {
  const manager = createBrushManager({ color: '#123456', width: 4, opacity: 0.5 });
  const brush = manager.getBrush();
  const nextBrush = manager.setBrush({ width: 8 });

  assert.equal(Object.isFrozen(brush), true);
  assert.equal(brush.color, '#123456');
  assert.equal(brush.width, 4);
  assert.equal(brush.opacity, 0.5);
  assert.equal(nextBrush.width, 8);
  assert.notStrictEqual(brush, nextBrush);
});

test('pen tool creates and finalizes a freehand stroke', () => {
  const tool = createPenTool();
  const brush = { color: '#f43f5e', width: 5, opacity: 0.95 };

  const begun = tool.beginStroke({ x: 10, y: 10 }, brush, 1000);
  assert.ok(begun.activeStroke);
  assert.equal(tool.getActiveStroke(), begun.activeStroke);
  assert.equal(begun.activeStroke?.points.length, 1);

  const continued = tool.continueStroke({ x: 20, y: 20 });
  assert.equal(continued.activeStroke?.points.length, 2);

  const ended = tool.endStroke({ x: 20, y: 20 }, 2000);
  assert.ok(ended.committedStroke);
  assert.equal(ended.committedStroke?.points.length, 2);
  assert.equal(tool.getActiveStroke(), undefined);
});
