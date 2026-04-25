document.addEventListener('DOMContentLoaded', () => {
  const runBtnChromium = document.getElementById('btn-chromium');
  const runBtnChrome = document.getElementById('btn-chrome');
  const logs = document.getElementById('logs');

  console.log('app.js loaded, buttons:', runBtnChromium, runBtnChrome);
  console.log('automation API available:', !!window.automation);

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

  runBtnChromium.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    try {
      addLog('正在发送请求...');
      const result = await window.automation.run('chromium');
      addLog(result.success ? '成功！' : `失败: ${result.error}`);
    } catch (e) {
      addLog(`异常: ${e.message}`);
    }
    setButtons(false);
  });

  runBtnChrome.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    try {
      addLog('正在发送请求...');
      const result = await window.automation.run('chrome');
      addLog(result.success ? '成功！' : `失败: ${result.error}`);
    } catch (e) {
      addLog(`异常: ${e.message}`);
    }
    setButtons(false);
  });
});
