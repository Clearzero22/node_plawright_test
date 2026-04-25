import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('automation', {
  run: (key: string) => ipcRenderer.invoke('run-automation', key),
  checkBrowser: () => ipcRenderer.invoke('check-browser'),
  onLog: (cb: (msg: string) => void) => {
    ipcRenderer.on('automation-log', (_event, msg) => cb(msg));
  },
});
