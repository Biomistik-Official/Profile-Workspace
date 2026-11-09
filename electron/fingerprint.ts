import type { WebContents } from 'electron';
import type { Fingerprint } from '../shared/types';

export async function applyFingerprint(wc: WebContents, fp: Fingerprint, defaultUserAgent: string, metadata?: Record<string, unknown>): Promise<void> {
  if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
  const primary = fp.language.split('-')[0];
  await Promise.all([
    wc.debugger.sendCommand('Emulation.setUserAgentOverride', {
      userAgent: fp.userAgent || defaultUserAgent, acceptLanguage: `${fp.language},${primary}`, platform: 'Win32',
      ...(metadata ? { userAgentMetadata: metadata } : {}),
    }),
    wc.debugger.sendCommand('Emulation.setLocaleOverride', { locale: fp.language }),
    wc.debugger.sendCommand('Emulation.setTimezoneOverride', { timezoneId: fp.timezone }),
    wc.debugger.sendCommand('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: fp.hardwareConcurrency }),
    wc.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 0, height: 0, deviceScaleFactor: 1, mobile: false, screenWidth: fp.screenWidth, screenHeight: fp.screenHeight }),
  ]);
}
