import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('automation', {
  // 运行自动化任务
  run: (key: string, browserType?: 'chrome' | 'chromium') =>
    ipcRenderer.invoke('run-automation', key, browserType),

  // 检查浏览器可用性
  checkBrowser: () => ipcRenderer.invoke('check-browser'),

  // 获取用户数据目录信息
  getUserDataInfo: () => ipcRenderer.invoke('get-user-data-info'),

  // 清除用户数据
  clearUserData: () => ipcRenderer.invoke('clear-user-data'),

  // 关闭浏览器
  closeBrowsers: () => ipcRenderer.invoke('close-browsers'),

  // 日志监听
  onLog: (cb: (msg: string) => void) => {
    ipcRenderer.on('automation-log', (_event, msg) => cb(msg));
  },
});
