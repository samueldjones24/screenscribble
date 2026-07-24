import assert from 'node:assert/strict';
import test from 'node:test';
import { createStroke, DEFAULT_BRUSH } from '../src/drawing/stroke.ts';
import { createAnnotationSessionManager } from '../src/drawing/annotationSession.ts';

function createClock(initialTime = 0): { now: () => number; setTime: (time: number) => void } {
  let currentTime = initialTime;

  return {
    now: () => currentTime,
    setTime: (time: number) => {
      currentTime = time;
    },
  };
}

test('stroke lifecycle fades after the visible window and expires automatically', () => {
  const clock = createClock(0);
  const manager = createAnnotationSessionManager({ clock });
  const stroke = createStroke(DEFAULT_BRUSH, {
    createdAt: 0,
  });

  manager.addStroke(stroke);

  let snapshot = manager.update(0);
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.activeStrokeCount, 1);
  assert.equal(snapshot.fadingStrokeCount, 0);
  assert.equal(snapshot.expiredStrokeCount, 0);
  assert.equal(snapshot.strokes[0].opacity, DEFAULT_BRUSH.opacity);
  assert.equal(snapshot.state, 'active');
  assert.equal(snapshot.opacity, 1);

  clock.setTime(10500);
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.activeStrokeCount, 0);
  assert.equal(snapshot.fadingStrokeCount, 1);
  assert.equal(snapshot.expiredStrokeCount, 0);
  assert.equal(snapshot.strokes[0].opacity, DEFAULT_BRUSH.opacity);
  assert.ok(snapshot.opacity < 1);
  assert.ok(snapshot.opacity > 0);

  clock.setTime(11001);
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.strokes.length, 0);
  assert.equal(snapshot.activeStrokeCount, 0);
  assert.equal(snapshot.fadingStrokeCount, 0);
  assert.equal(snapshot.expiredStrokeCount, 1);
});

test('stroke lifecycle clear removes tracked strokes immediately', () => {
  const manager = createAnnotationSessionManager();
  manager.addStroke(
    createStroke(DEFAULT_BRUSH, {
      createdAt: 0,
    }),
  );

  manager.clear();
  const snapshot = manager.getSnapshot();
  assert.equal(snapshot.strokes.length, 0);
  assert.equal(snapshot.activeStrokeCount, 0);
  assert.equal(snapshot.fadingStrokeCount, 0);
  assert.equal(snapshot.expiredStrokeCount, 0);
});

test('stroke lifecycle refreshes all visible strokes when drawing resumes', () => {
  const clock = createClock(0);
  const manager = createAnnotationSessionManager({ clock });
  const stroke = createStroke(DEFAULT_BRUSH, {
    createdAt: 0,
  });

  manager.addStroke(stroke);
  clock.setTime(10500);

  let snapshot = manager.update(clock.now());
  assert.equal(snapshot.state, 'fading');
  assert.ok(snapshot.opacity < 1);

  manager.refreshAll(clock.now());
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.activeStrokeCount, 1);
  assert.equal(snapshot.fadingStrokeCount, 0);
  assert.equal(snapshot.strokes[0].opacity, DEFAULT_BRUSH.opacity);
  assert.equal(snapshot.state, 'active');

  clock.setTime(19500);
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.activeStrokeCount, 1);
  assert.equal(snapshot.state, 'active');
});

test('stroke lifecycle pause preserves visible annotations until resume', () => {
  const clock = createClock(0);
  const manager = createAnnotationSessionManager({ clock });
  const stroke = createStroke(DEFAULT_BRUSH, {
    createdAt: 0,
  });

  manager.addStroke(stroke);
  clock.setTime(9000);

  let snapshot = manager.pause(clock.now());
  assert.equal(snapshot.isPaused, true);
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.state, 'active');
  assert.equal(snapshot.opacity, 1);

  clock.setTime(25000);
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.isPaused, true);
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.state, 'active');
  assert.equal(snapshot.opacity, 1);

  snapshot = manager.resume(clock.now());
  assert.equal(snapshot.isPaused, false);
  assert.equal(snapshot.strokes.length, 1);
  assert.equal(snapshot.state, 'active');

  clock.setTime(26500);
  snapshot = manager.update(clock.now());
  assert.equal(snapshot.state, 'fading');
  assert.ok(snapshot.opacity < 1);
});
