import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, validateAndNormalizeSettings } from '../src/settings/settings.ts';

test('settings validation clamps invalid brush and session values', () => {
  const result = validateAndNormalizeSettings({
    ...DEFAULT_SETTINGS,
    brush: {
      colour: '#zzz999',
      width: -10,
      opacity: 140,
    },
    session: {
      timeoutSeconds: 5,
      fadeSeconds: 25,
      resetTimeoutOnNewStroke: true,
    },
  });

  assert.equal(result.settings.brush.colour, DEFAULT_SETTINGS.brush.colour);
  assert.equal(result.settings.brush.width, 1);
  assert.equal(result.settings.brush.opacity, 100);
  assert.equal(result.settings.session.timeoutSeconds, 5);
  assert.equal(result.settings.session.fadeSeconds, 5);
  assert.equal(result.issues.length > 0, true);
});
