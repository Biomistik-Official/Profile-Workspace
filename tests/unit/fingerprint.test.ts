import { expect, it } from 'vitest';
import { generateFingerprint, validateFingerprint } from '../../core/fingerprint';
it('generates distinct settings with stable validation and a fresh revision', () => {
  const first = generateFingerprint([]); const second = generateFingerprint([first]);
  expect(first.id).not.toBe(second.id);
  expect({ ...first, id: '' }).not.toEqual({ ...second, id: '' });
  expect(validateFingerprint(first)).toEqual(first);
});
it('rejects invalid timezones, dimensions, CPU counts and User-Agent injection', () => {
  const fp = generateFingerprint([]);
  for (const patch of [{ timezone: 'Bad/Timezone' }, { language: 'invalid\r\nX: yes' }, { screenWidth: 0 }, { hardwareConcurrency: 0 }, { userAgent: 'Chrome\r\nX-Test: yes' }]) {
    expect(() => validateFingerprint({ ...fp, ...patch })).toThrow();
  }
});
