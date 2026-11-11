import { contextBridge, ipcRenderer } from 'electron';
const call = (method: string) => (...args: unknown[]) => ipcRenderer.invoke(`workspace:${method}`, ...args);
const subscribe = (channel: string) => (listener: (data: unknown) => void) => {
  const handler = (_event: unknown, data: unknown) => listener(data);
  ipcRenderer.on(channel, handler); return () => { ipcRenderer.removeListener(channel, handler); };
};
contextBridge.exposeInMainWorld('workspace', {
  ...Object.fromEntries(['snapshot', 'saveProfile', 'duplicateProfile', 'deleteProfiles', 'saveProxy', 'deleteProxy', 'checkProxy', 'saveSettings', 'launch', 'stop', 'cancelQueue', 'bulkUpdate', 'cookies', 'previewCookies', 'importCookies', 'exportCookies', 'clearCookies', 'revealData'].map(method => [method, call(method)])),
  onChange: subscribe('workspace:changed'),
  installEngine: call('installEngine'), saveSite: call('saveSite'), deleteSite: call('deleteSite'),
  saveGroup: call('saveGroup'), deleteGroup: call('deleteGroup'),
  checkUpdates: call('checkUpdates'), closeToUpdate: call('closeToUpdate'),
});
contextBridge.exposeInMainWorld('browser', {
  ...Object.fromEntries(['state', 'navigate', 'action', 'selectTab', 'closeTab', 'sites', 'saveSite', 'deleteSite', 'openSite', 'setSitesOpen'].map(method => [method, (...args: unknown[]) => ipcRenderer.invoke(`browser:${method}`, ...args)])),
  onChange: subscribe('browser:changed'),
});
