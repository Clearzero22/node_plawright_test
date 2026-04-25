document.addEventListener('DOMContentLoaded', () => {
  const runBtnBilibili = document.getElementById('btn-bilibili');
  const runBtnTaobao = document.getElementById('btn-taobao');
  const runBtnChrome = document.getElementById('btn-chrome');
  const statusEl = document.getElementById('browser-status');
  const userDataInfoEl = document.getElementById('user-data-info');
  const logs = document.getElementById('logs');
  const clearDataBtn = document.getElementById('btn-clear-data');

  function addLog(msg) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }

  function setButtons(disabled) {
    [runBtnBilibili, runBtnTaobao, runBtnChrome, clearDataBtn].forEach(btn => {
      if (btn) btn.disabled = disabled;
    });
  }

  window.automation.onLog((msg) => addLog(msg));

  // 加载用户数据信息
  async function loadUserDataInfo() {
    const result = await window.automation.getUserDataInfo();
    if (result.success) {
      if (result.exists) {
        const sizeMB = (result.size / (1024 * 1024)).toFixed(2);
        const date = new Date(result.modifiedAt).toLocaleString();
        userDataInfoEl.innerHTML = `
          <div class="info-item">
            <span class="info-label">📁 用户数据目录:</span>
            <span class="info-value">已创建 (${sizeMB} MB)</span>
          </div>
          <div class="info-item">
            <span class="info-label">🕐 最后更新:</span>
            <span class="info-value">${date}</span>
          </div>
          <div class="info-item">
            <span class="info-label">🍪 Cookies:</span>
            <span class="info-value">${result.hasCookies ? '✅ 存在' : '❌ 无'}</span>
          </div>
        `;
      } else {
        userDataInfoEl.innerHTML = `
          <div class="info-item">
            <span class="info-label">📁 用户数据目录:</span>
            <span class="info-value">未创建（首次运行将自动创建）</span>
          </div>
        `;
      }
    }
  }

  // 检查浏览器状态
  window.automation.checkBrowser().then((status) => {
    const parts = [];
    if (status.hasLocalChrome) parts.push('Google Chrome ✅');
    else parts.push('Google Chrome ❌ (需要安装)');
    if (status.hasPlaywrightChromium) parts.push('Playwright Chromium ✅');
    else parts.push('Playwright Chromium ❌');
    if (statusEl) statusEl.textContent = parts.join(' | ');

    if (!status.hasLocalChrome) {
      addLog('⚠️  提示：本方案需要安装 Google Chrome');
      addLog('📥 下载地址：https://www.google.com/chrome/');
    }

    // 加载用户数据信息
    loadUserDataInfo();
  });

  // Bilibili 按钮
  runBtnBilibili.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    addLog('🚀 启动 Bilibili 自动化（使用您的 Chrome 数据）...');
    try {
      const result = await window.automation.run('bilibili');
      addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
      if (result.success) {
        loadUserDataInfo(); // 刷新用户数据信息
      }
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  });

  // Taobao 按钮
  runBtnTaobao.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    addLog('🚀 启动 Taobao 自动化（使用您的 Chrome 数据）...');
    try {
      const result = await window.automation.run('taobao');
      addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
      if (result.success) {
        loadUserDataInfo();
      }
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  });

  // Chrome 按钮
  runBtnChrome.addEventListener('click', async () => {
    logs.innerHTML = '';
    setButtons(true);
    addLog('🚀 启动 Chrome 自动化（使用您的 Chrome 数据）...');
    try {
      const result = await window.automation.run('chrome');
      addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
      if (result.success) {
        loadUserDataInfo();
      }
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  });

  // 清除用户数据按钮
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
      if (confirm('确定要清除所有用户数据吗？这将删除所有登录状态和浏览记录。\n\n⚠️ 此操作不可恢复！')) {
        setButtons(true);
        addLog('🧹 正在清除用户数据...');
        try {
          const result = await window.automation.clearUserData();
          if (result.success) {
            addLog(`✅ ${result.message}`);
            loadUserDataInfo();
          } else {
            addLog(`❌ 失败: ${result.error}`);
          }
        } catch (e) {
          addLog(`❌ 异常: ${e.message}`);
        }
        setButtons(false);
      }
    });
  }
});
