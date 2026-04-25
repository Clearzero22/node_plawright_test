document.addEventListener('DOMContentLoaded', () => {
  const runBtnChromium = document.getElementById('btn-chromium');
  const runBtnChrome = document.getElementById('btn-chrome');
  const statusEl = document.getElementById('browser-status');
  const logs = document.getElementById('logs');

  function addLog(msg) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }

  function setButtons(disabled) {
    runBtnChromium.disabled = disabled;
    runBtnChrome.disabled = disabled;
  }

  window.automation.onLog((msg) => addLog(msg));

  // 检查浏览器状态
  window.automation.checkBrowser().then((status) => {
    const parts = [];
    if (status.hasLocalChrome) parts.push('Google Chrome ✅');
    else parts.push('Google Chrome ❌');
    if (status.hasPlaywrightChromium) parts.push('Playwright Chromium ✅');
    else parts.push('Playwright Chromium ❌ (首次使用将自动下载)');
    if (statusEl) statusEl.textContent = parts.join(' | ');

    // 没有 Playwright Chromium 时，chromium 按钮点击会触发下载
    if (!status.hasPlaywrightChromium) {
      addLog('提示: 首次点击 Chromium 按钮将自动下载浏览器（约 100MB）');
    }
  });

  runBtnChromium.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    try {
      const result = await window.automation.run('chromium');
      addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  });

  runBtnChrome.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    try {
      const result = await window.automation.run('chrome');
      addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  });
});
