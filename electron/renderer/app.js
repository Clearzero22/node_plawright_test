document.addEventListener('DOMContentLoaded', () => {
  const runBtnChatGPT = document.getElementById('btn-chatgpt');
  const runBtnBilibili = document.getElementById('btn-bilibili');
  const runBtnTaobao = document.getElementById('btn-taobao');
  const runBtnChrome = document.getElementById('btn-chrome');
  const statusEl = document.getElementById('browser-status');
  const userDataInfoEl = document.getElementById('user-data-info');
  const logs = document.getElementById('logs');
  const clearDataBtn = document.getElementById('btn-clear-data');
  const browserSelect = document.getElementById('browser-select');
  const showGuideBtn = document.getElementById('btn-show-guide');
  const guideModal = document.getElementById('guide-modal');
  const closeGuideBtn = document.getElementById('btn-close-guide');

  // 当前选择的浏览器类型
  let currentBrowserType = 'chrome'; // 默认使用 Chrome

  function addLog(msg) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
  }

  function setButtons(disabled) {
    [runBtnChatGPT, runBtnBilibili, runBtnTaobao, runBtnChrome, clearDataBtn].forEach(btn => {
      if (btn) btn.disabled = disabled;
    });
  }

  window.automation.onLog((msg) => addLog(msg));

  // 显示 CDP 设置指南
  if (showGuideBtn) {
    showGuideBtn.addEventListener('click', () => {
      if (guideModal) {
        guideModal.style.display = 'flex';
      }
    });
  }

  // 关闭指南
  if (closeGuideBtn) {
    closeGuideBtn.addEventListener('click', () => {
      if (guideModal) {
        guideModal.style.display = 'none';
      }
    });
  }

  // 点击模态框外部关闭
  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) {
        guideModal.style.display = 'none';
      }
    });
  }

  // 复制命令到剪贴板
  window.copyChromeCommand = function(button) {
    const commands = {
      'chrome-basic': 'chrome.exe --remote-debugging-port=9222',
      'chrome-full': '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222',
      'chrome-x64': '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222',
    };

    const command = commands[button.dataset.command];
    if (command) {
      navigator.clipboard.writeText(command).then(() => {
        const originalText = button.textContent;
        button.textContent = '✅ 已复制！';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      });
    }
  };

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

  // 浏览器类型选择
  if (browserSelect) {
    browserSelect.addEventListener('change', (e) => {
      currentBrowserType = e.target.value;
      const browserName = currentBrowserType === 'chrome' ? 'Google Chrome (CDP模式)' : 'Playwright Chromium';
      addLog(`🔄 切换浏览器: ${browserName}`);

      if (currentBrowserType === 'chrome') {
        addLog('💡 提示：Chrome 模式需要先启动调试模式');
        addLog('   点击上方"📖 CDP 设置指南"查看详细说明');
      }
    });
  }

  // 通用运行函数
  async function runAutomation(taskKey, taskName) {
    logs.innerHTML = '';
    setButtons(true);
    const browserName = currentBrowserType === 'chrome' ? 'Google Chrome (CDP)' : 'Playwright Chromium';
    addLog(`🚀 启动 ${taskName} 自动化（使用 ${browserName}）...`);

    if (currentBrowserType === 'chrome') {
      addLog('🔍 尝试连接到 Chrome 调试端口...');
    }

    try {
      const result = await window.automation.run(taskKey, currentBrowserType);

      if (result.requiresCDPSetup) {
        addLog('❌ 无法连接到 Chrome');
        addLog('💡 请按以下步骤操作：');
        addLog('   1. 点击"📖 CDP 设置指南"按钮');
        addLog('   2. 按照指南启动 Chrome 调试模式');
        addLog('   3. 重新点击按钮连接');
      } else {
        addLog(result.success ? '✅ 成功！' : `❌ 失败: ${result.error}`);
        if (result.success) {
          loadUserDataInfo();
        }
      }
    } catch (e) {
      addLog(`❌ 异常: ${e.message}`);
    }
    setButtons(false);
  }

  // ChatGPT 按钮
  runBtnChatGPT.addEventListener('click', () => runAutomation('chatgpt', 'ChatGPT'));

  // Bilibili 按钮
  runBtnBilibili.addEventListener('click', () => runAutomation('bilibili', 'Bilibili'));

  // Taobao 按钮
  runBtnTaobao.addEventListener('click', () => runAutomation('taobao', 'Taobao'));

  // Chrome 按钮
  runBtnChrome.addEventListener('click', () => runAutomation('chrome', '默认页面'));

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
