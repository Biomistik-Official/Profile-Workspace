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
it('generates only Russian or English and rejects other languages on save', () => {
  const existing = [];
  for (let i = 0; i < 576; i++) {
    const fp = generateFingerprint(existing);
    expect(fp.language).toMatch(/^(ru|en)(-|$)/);
    existing.push(fp);
  }
  const fp = existing[0];
  for (const language of ['nl-NL', 'de-DE', 'fr-FR']) expect(() => validateFingerprint({ ...fp, language })).toThrow();
  for (const language of ['ru-RU', 'en-US', 'en-GB']) expect(validateFingerprint({ ...fp, language }).language).toBe(language);
});
