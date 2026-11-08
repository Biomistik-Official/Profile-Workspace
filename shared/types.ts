export type ProfileStatus = 'stopped' | 'queued' | 'starting' | 'running' | 'stopping' | 'error';
export type ProxyProtocol = 'http' | 'https' | 'socks5';
export interface Profile {
  id: string; name: string; notes: string; tags: string[]; proxyId: string | null;
  startUrl: string; restoreSessionCookies: boolean; createdAt: string; updatedAt: string;
  lastOpenedAt: string | null;
}
export interface ProfileDraft {
  id?: string; name: string; notes?: string; tags?: string[]; proxyId?: string | null;
  startUrl?: string; restoreSessionCookies?: boolean;
}
export interface ProxyDraft {
  id?: string; name: string; protocol: ProxyProtocol; host: string; port: number;
  username?: string; password?: string; clearPassword?: boolean;
}
export interface ProxyInfo {
  id: string; name: string; protocol: ProxyProtocol; host: string; port: number;
  username: string; hasPassword: boolean;
}
export interface Settings { maxConcurrent: number; launchDelayMs: number; defaultUrl: string }
export interface RuntimeState { status: ProfileStatus; error?: string }
export interface ProxyCheck { status: 'checking' | 'ok' | 'error'; ip?: string; error?: string; checkedAt?: string }
export interface WorkspaceSnapshot {
  profiles: Profile[]; proxies: ProxyInfo[]; settings: Settings;
  runtime: Record<string, RuntimeState>; proxyChecks: Record<string, ProxyCheck>;
  queue: { pending: number; active: number }; dataPath?: string; version?: string;
}
export interface PortableCookie {
  domain: string; name: string; value: string; path: string; secure: boolean;
  httpOnly: boolean; hostOnly: boolean; sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
}
export interface CookieParseResult { cookies: PortableCookie[]; errors: string[]; warnings: string[] }
export interface CookiePreview { token: string; fileName: string; count: number; errors: string[]; warnings: string[] }
export type CookieFormat = 'json' | 'netscape';
export interface WorkspaceApi {
  snapshot(): Promise<WorkspaceSnapshot>;
  saveProfile(input: ProfileDraft): Promise<void>;
  duplicateProfile(id: string): Promise<void>;
  deleteProfiles(ids: string[]): Promise<void>;
  saveProxy(input: ProxyDraft): Promise<void>;
  deleteProxy(id: string): Promise<void>;
  checkProxy(id: string): Promise<ProxyCheck>;
  saveSettings(input: Settings): Promise<void>;
  launch(ids: string[]): Promise<void>;
  stop(ids: string[]): Promise<void>;
  cancelQueue(): Promise<void>;
  bulkUpdate(ids: string[], input: { tags?: string[]; proxyId?: string | null }): Promise<void>;
  cookies(id: string): Promise<PortableCookie[]>;
  previewCookies(id: string): Promise<CookiePreview | null>;
  importCookies(id: string, token: string, mode: 'merge' | 'replace'): Promise<number>;
  exportCookies(ids: string[], format: CookieFormat): Promise<boolean>;
  clearCookies(id: string): Promise<void>;
  revealData(): Promise<void>;
  onChange(listener: (snapshot: WorkspaceSnapshot) => void): () => void;
}
export interface BrowserTab { id: number; title: string; url: string; loading: boolean }
export interface BrowserState { profileName: string; tabs: BrowserTab[]; activeId: number; canGoBack: boolean; canGoForward: boolean }
export interface BrowserApi {
  state(): Promise<BrowserState>; navigate(url: string): Promise<void>;
  action(action: 'back' | 'forward' | 'reload' | 'newTab'): Promise<void>;
  selectTab(id: number): Promise<void>; closeTab(id: number): Promise<void>;
  onChange(listener: (state: BrowserState) => void): () => void;
}
declare global { interface Window { workspace: WorkspaceApi; browser: BrowserApi } }
