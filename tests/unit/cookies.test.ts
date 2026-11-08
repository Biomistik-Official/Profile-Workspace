import { describe, expect, it } from 'vitest';
import { parseCookies, serializeCookies, cookieUrl } from '../../core/cookies';

describe('cookie exchange', () => {
  it('preserves host-only, HttpOnly and SameSite attributes through JSON', () => {
    const result = parseCookies(JSON.stringify([{ domain: 'example.com', name: 'sid', value: 'abc', path: '/', secure: true, httpOnly: true, hostOnly: true, sameSite: 'lax', expirationDate: 4102444800 }]));
    expect(result.errors).toEqual([]);
    expect(parseCookies(serializeCookies(result.cookies, 'json')).cookies).toEqual([{
      domain: 'example.com', name: 'sid', value: 'abc', path: '/', secure: true, httpOnly: true, hostOnly: true, sameSite: 'lax', expirationDate: 4102444800,
    }]);
    expect(cookieUrl(result.cookies[0])).toBe('https://example.com/');
  });
  it('reads Netscape HttpOnly and empty values without treating session cookies as expired', () => {
    const result = parseCookies('# Netscape HTTP Cookie File\n#HttpOnly_.example.com\tTRUE\t/account\tTRUE\t0\tsid\t\nexample.org\tFALSE\t/\tFALSE\t4102444800\tx\tvalue');
    expect(result.errors).toEqual([]);
    expect(result.cookies[0]).toMatchObject({ domain: '.example.com', name: 'sid', value: '', httpOnly: true, hostOnly: false });
    expect(result.cookies[0].expirationDate).toBeUndefined();
    expect(parseCookies(serializeCookies(result.cookies, 'netscape')).cookies).toEqual(result.cookies);
  });
  it('rejects malformed, unsafe domains and unsupported partition keys without hiding valid entries', () => {
    const result = parseCookies(JSON.stringify([
      { domain: 'example.com', name: 'good', value: 'x' },
      { domain: 'https://bad/path', name: 'bad', value: 'x' },
      { domain: 'example.com', name: 'chip', value: 'x', partitionKey: { topLevelSite: 'https://other.com' } },
      { domain: 'example.com', name: 'wrong', value: 'x', secure: 'false' },
    ]));
    expect(result.cookies.map(c => c.name)).toEqual(['good']);
    expect(result.errors).toHaveLength(3);
    expect(() => parseCookies('{broken')).toThrow();
    expect(parseCookies('[]').cookies).toHaveLength(0);
  });
  it('deduplicates by domain, path and name, with the last value winning', () => {
    const result = parseCookies('[{"domain":"example.com","name":"a","value":"old"},{"domain":"example.com","name":"a","value":"new"},{"domain":"example.com","path":"/other","name":"a","value":"other"}]');
    expect(result.cookies.map(c => c.value)).toEqual(['new', 'other']);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('warns when Netscape cannot preserve SameSite', () => {
    const result = parseCookies('[{"domain":"example.com","name":"a","value":"x","sameSite":"strict"}]');
    expect(serializeCookies(result.cookies, 'netscape')).toContain('# SameSite');
  });
  it('preserves the final Netscape empty value and trailing spaces', () => {
    for (const value of ['', 'token with trailing space ']) {
      const parsed = parseCookies(serializeCookies([{ domain: 'example.com', name: 'last', value, path: '/', hostOnly: true, secure: false, httpOnly: false, sameSite: 'unspecified' }], 'netscape'));
      expect(parsed.errors).toEqual([]);
      expect(parsed.cookies[0]?.value).toBe(value);
    }
  });
});
