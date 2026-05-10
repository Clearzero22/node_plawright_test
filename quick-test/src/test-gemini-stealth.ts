import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

/**
 * Gemini 隐身模式测试：使用完整反检测配置进行 Google 登录
 */
(async () => {
  console.log('🚀 启动 Gemini 隐身模式...');

  // 使用统一的用户数据目录（所有Gemini脚本共享）
  const userDataDir = path.join(os.homedir(), '.node-plawright-test', 'chrome-profile', 'automation');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',

      // 核心：禁用自动化检测特征
      '--disable-blink-features=AutomationControlled',

      // 隐藏 Chrome 正在被自动化的提示
      '--disable-infobars',

      // 禁用各种可能导致检测的特征
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',

      // 窗口设置
      '--start-maximized',

      // 禁用密码保存提示（可能暴露自动化）
      '--disable-save-password-bubble',

      // 禁用默认浏览器检查
      '--no-first-run',
      '--no-default-browser-check',

      // 禁用翻译提示
      '--disable-translate',

      // 使用真实用户代理（重要！）
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ],
    viewport: null, // 跟随窗口大小

    // 关键：忽略默认的自动化参数
    ignoreDefaultArgs: [
      '--enable-automation',
      '--enable-blink-features=IdleDetection',
    ],

    // 禁用超时，避免暴露自动化
    actionTimeout: 0,
  });

  // 注入深度反检测脚本
  await context.addInitScript(() => {
    // 1. 隐藏 navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 2. 模拟真实的 window.chrome 对象
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // 3. 模拟真实的插件
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
          description: "Portable Document Format",
          filename: "internal-pdf-viewer",
          length: 1,
          name: "Chrome PDF Plugin"
        },
        {
          0: { type: "application/pdf", suffixes: "pdf", description: "" },
          description: "",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          length: 1,
          name: "Chrome PDF Viewer"
        },
        {
          0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable" },
          1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable" },
          description: "",
          filename: "internal-nacl-plugin",
          length: 2,
          name: "Native Client"
        }
      ],
    });

    // 4. 模拟真实的语言设置
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'zh-CN', 'zh'],
    });

    // 5. 修正权限 API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as any)
        : originalQuery(parameters)
    );

    // 6. 隐藏 Playwright/自动化特征
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__pw_inspect;

    // 7. 模拟真实的屏幕属性
    Object.defineProperty(screen, 'availHeight', { get: () => screen.height - 40 });
    Object.defineProperty(screen, 'availWidth', { get: () => screen.width });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    // 8. 模拟真实的设备内存
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // 9. 模拟硬件并发
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });

    // 10. 伪装连接类型
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });

    // 11. 覆盖 WebGL 指纹
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.call(this, parameter);
    };

    // 12. 伪装 Canvas 指纹
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
      if (type === 'image/png') {
        return originalToDataURL.call(this);
      }
      return originalToDataURL.call(this, type);
    };
  });

  const page = context.pages()[0] || await context.newPage();

  console.log('🌐 访问 Google 登录页面...');

  // 先访问 Google 主页建立信任
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', {
    waitUntil: 'networkidle',
  });

  console.log('');
  console.log('=================================================');
  console.log('📌 重要提示：');
  console.log('1. 如果看到 "browser not secure" 错误：');
  console.log('   - 这是 Google 的反自动化保护');
  console.log('   - 请在浏览器中完成登录流程');
  console.log('   - 登录成功后，配置文件会保存 cookies');
  console.log('');
  console.log('2. 下次运行时会使用保存的登录状态');
  console.log('');
  console.log('3. 如果仍然被拦截，请尝试：');
  console.log('   - 使用真实的 Chrome 配置文件');
  console.log('   - 或者使用 OAuth2 Token 方式（推荐）');
  console.log('=================================================');
  console.log('');

  // 监听 URL 变化
  page.on('load', () => {
    console.log(`📄 页面加载: ${page.url()}`);
  });

  console.log('✅ 浏览器已启动，等待手动登录...');
  console.log('💡 按 Ctrl+C 退出');

  // 保持浏览器打开
  await new Promise(() => {});
})();
