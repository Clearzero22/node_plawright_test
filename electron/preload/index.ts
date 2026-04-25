import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('automation', {
  run: (url: string) => ipcRenderer.invoke('run-automation', url),
  onLog: (cb: (msg: string) => void) => {
    ipcRenderer.on('automation-log', (_event, msg) => cb(msg));
  },
});
