# 开发者指南

本指南旨在帮助开发者快速理解项目结构、配置开发环境、理解核心功能模块，以及进行扩展和自定义。

## 目录

- [项目结构](#项目结构)
- [开发环境设置](#开发环境设置)
- [核心功能模块](#核心功能模块)
- [API 文档](#api-文档)
- [扩展开发](#扩展开发)
- [测试指南](#测试指南)
- [部署流程](#部署流程)

---

## 项目结构

```
theaterMode/
├── popup/                 # Popup 界面
│   ├── index.html         # Popup HTML 结构
│   └── style.css          # Popup 样式文件
├── content.js             # 主要功能逻辑
├── background.js          # 后台脚本
├── manifest.json          # Chrome 扩展配置
├── package.json           # Node.js 项目配置
├── CODE_QUALITY.md        # 代码质量工具说明
├── DEVELOPER_GUIDE.md     # 开发者指南（本文件）
├── CHANGELOG.md           # 版本历史
├── LICENSE                # 开源协议
└── README.md              # 项目说明
```

### 主要文件说明

| 文件 | 说明 | 行数 |
|------|------|------|
| content.js | 核心功能逻辑，包括影院模式、播放控制、轮询检测等 | ~1400 行 |
| background.js | 后台脚本，处理扩展生命周期事件 | ~150 行 |
| popup/ | 设置面板和播放控制界面 | ~300 行 |
| manifest.json | Chrome 扩展配置文件 | ~20 行 |

---

## 开发环境设置

### 前置要求

- **Node.js**: v16.0.0 或更高版本
- **Chrome 浏览器**: 版本 88 或更高（支持 Manifest V3）
- **VS Code**（推荐）或任何代码编辑器

### 安装步骤

1. **克隆或下载项目**
   ```bash
   git clone <repository-url>
   cd theaterMode
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **验证安装**
   ```bash
   node --version      # 应显示 v16.x.x 或更高
   npm --version       # 应显示 8.x.x 或更高
   npm run lint        # 检查代码风格
   ```

### Chrome 扩展开发模式

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 在右上角开启 **开发者模式 (Developer mode)**
4. 点击 **加载已解压的扩展程序 (Load unpacked)**
5. 选择项目根目录

---

## 核心功能模块

### 1. 影院模式 (Cinema Mode)

**核心功能**：
- 自动检测页面中的视频播放器
- 显示悬浮播放控制按钮
- 全屏播放，隐藏干扰元素

**主要函数**：
- `startCinema()`: 进入影院模式
- `exitCinema()`: 退出影院模式
- `toggleCinema()`: 切换影院模式
- `handleFullscreen()`: 处理全屏事件

**代码位置**：
- 开始：第 130 行
- 结束：第 1450 行
- 工具函数：第 1465-1550 行

### 2. 播放控制 (Playback Controls)

**核心功能**：
- 播放/暂停控制
- 快进/回退控制（6 个方向）
- 音量控制
- 全屏切换
- 进度条拖动

**主要函数**：
- `playVideo()`: 播放视频
- `pauseVideo()`: 暂停视频
- `seekVideo()`: 快进/回退
- `toggleFullscreen()`: 切换全屏
- `setVolume()`: 设置音量

**快捷键**：
- `Space`: 播放/暂停
- `F`: 全屏
- `←/→`: 回退/快进 5 秒
- `↑/↓`: 增加/减少 10% 音量
- `M`: 静音
- `Q/E`: 快进/回退 30 秒

**代码位置**：第 1465-1550 行

### 3. 检测轮询 (Detection Polling)

**核心功能**：
- 检测视频元素是否存在
- 检测视频是否暂停
- 保存隐藏的元素状态
- 恢复隐藏的元素

**主要函数**：
- `checkVideoElement()`: 检查视频元素
- `handlePause()`: 处理视频暂停
- `handleVideoVisibility()`: 处理视频可见性
- `restoreHiddenElements()`: 恢复隐藏元素

**轮询机制**：
- 检测间隔：500ms
- 视频暂停时轮询增强：250ms
- 性能优化：使用 requestAnimationFrame

**代码位置**：第 1550-1650 行

### 4. 字幕系统 (Subtitle System)

**核心功能**：
- 加载外部字幕文件（.srt）
- 解析字幕格式
- 应用字幕到视频
- 自定义字幕样式

**主要函数**：
- `loadSubtitle()`: 加载字幕文件
- `parseSRT()`: 解析 SRT 格式
- `applySubtitle()`: 应用字幕样式
- `hideSubtitle()`: 隐藏字幕

**支持的格式**：
- .srt (SubRip)
- .vtt (WebVTT)
- .ass (Advanced SubStation Alpha)

**代码位置**：第 1650-1750 行

### 5. 工具栏隐藏 (Toolbar Hiding)

**核心功能**：
- 识别并隐藏页面中的工具栏元素
- 按平台分类管理选择器
- 深度隐藏元素（包括 iframe 内元素）

**主要函数**：
- `hideToolbar()`: 隐藏工具栏元素
- `saveHiddenElements()`: 保存隐藏状态
- `restoreHiddenElements()`: 恢复隐藏状态
- `isElementHidden()`: 检查元素是否已隐藏

**平台配置**：
- Bilibili: 7 个选择器
- Youku: 4 个选择器
- IQiyi: 4 个选择器
- Kuaishou: 2 个选择器
- Default: 10 个选择器

**代码位置**：第 1750-1850 行

### 6. 音乐模式 (Music Mode)

**核心功能**：
- 播放封面背景
- Ambilight 氛围光效果
- 横向排版时钟
- 视频比例自适应
- iOS 锁屏美学

**主要函数**：
- `enableMusicMode()`: 启用音乐模式
- `disableMusicMode()`: 禁用音乐模式
- `updateMusicMode()`: 更新音乐模式显示
- `drawAmbilight()`: 绘制氛围光效果

**视觉效果**：
- 动态背景流光
- 边缘缓慢波动
- 视频比例自适应
- iOS 锁屏美学

**代码位置**：第 1850-1950 行

### 7. 存储管理 (Storage Management)

**核心功能**：
- 保存用户设置
- 保存观看历史
- 加载用户设置
- 同步设置到云端

**主要函数**：
- `saveSettings()`: 保存设置
- `loadSettings()`: 加载设置
- `saveHistory()`: 保存历史
- `loadHistory()`: 加载历史

**存储类型**：
- `chrome.storage.local`: 本地存储（历史、设置）
- `chrome.storage.sync`: 云端同步（设置）

**代码位置**：第 1950-2000 行

---

## API 文档

### Content Script API

#### 1. `getCinemaContainer()`

**说明**：获取影院模式容器

**参数**：无

**返回值**：
```javascript
{
  container: HTMLElement,  // 影院容器
  controls: HTMLElement    // 控制栏
}
```

**代码位置**：第 100-120 行

**示例**：
```javascript
const { container, controls } = getCinemaContainer();
if (container) {
  console.log('Cinema container found');
}
```

---

#### 2. `toggleCinema()`

**说明**：切换影院模式

**参数**：无

**返回值**：`boolean` - 切换后的状态（true=已启用）

**代码位置**：第 1400-1450 行

**示例**：
```javascript
const isActive = toggleCinema();
console.log(`Cinema mode ${isActive ? 'enabled' : 'disabled'}`);
```

---

#### 3. `playVideo()`

**说明**：播放视频

**参数**：无

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1465-1480 行

**示例**：
```javascript
playVideo().catch(err => {
  console.error('Failed to play video:', err);
});
```

---

#### 4. `pauseVideo()`

**说明**：暂停视频

**参数**：无

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1480-1490 行

**示例**：
```javascript
pauseVideo().catch(err => {
  console.error('Failed to pause video:', err);
});
```

---

#### 5. `seekVideo(seconds)`

**说明**：快进/回退视频

**参数**：
- `seconds` (`number`): 秒数，正数=快进，负数=回退

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1490-1510 行

**示例**：
```javascript
// 快进 5 秒
seekVideo(5).catch(err => {
  console.error('Seek failed:', err);
});

// 回退 10 秒
seekVideo(-10).catch(err => {
  console.error('Seek failed:', err);
});
```

---

#### 6. `setVolume(percent)`

**说明**：设置音量（0-100）

**参数**：
- `percent` (`number`): 音量百分比，0-100

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1510-1530 行

**示例**：
```javascript
// 设置音量为 50%
setVolume(50).catch(err => {
  console.error('Volume setting failed:', err);
});

// 静音
setVolume(0).catch(err => {
  console.error('Volume setting failed:', err);
});
```

---

#### 7. `toggleFullscreen()`

**说明**：切换全屏

**参数**：无

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1530-1550 行

**示例**：
```javascript
toggleFullscreen().catch(err => {
  console.error('Fullscreen failed:', err);
});
```

---

#### 8. `loadSubtitle(url)`

**说明**：加载字幕文件

**参数**：
- `url` (`string`): 字幕文件 URL

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1650-1670 行

**示例**：
```javascript
loadSubtitle('https://example.com/subtitle.srt')
  .then(() => {
    console.log('Subtitle loaded successfully');
  })
  .catch(err => {
    console.error('Failed to load subtitle:', err);
  });
```

---

#### 9. `saveSettings(settings)`

**说明**：保存设置到本地存储

**参数**：
- `settings` (`object`): 设置对象

**返回值**：`Promise<void>` - 操作完成

**代码位置**：第 1950-1970 行

**示例**：
```javascript
const settings = {
  timeStep: 5,
  opacity: 0.8,
  theme: 'dark'
};

saveSettings(settings).catch(err => {
  console.error('Settings save failed:', err);
});
```

---

#### 10. `loadSettings()`

**说明**：从本地存储加载设置

**参数**：无

**返回值**：`Promise<object>` - 设置对象

**代码位置**：第 1970-1990 行

**示例**：
```javascript
loadSettings().then(settings => {
  console.log('Loaded settings:', settings);
}).catch(err => {
  console.error('Settings load failed:', err);
});
```

---

### Background Script API

#### 1. `sendMessage(message)`

**说明**：向所有 content script 发送消息

**参数**：
- `message` (`object`): 消息对象

**返回值**：`Promise<void>` - 操作完成

**代码位置**：background.js 第 10-30 行

**示例**：
```javascript
// 从 content script 发送
chrome.runtime.sendMessage({
  action: 'playVideo',
  params: {}
});

// 从 background script 接收
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playVideo') {
    // 处理播放请求
    sendResponse({ success: true });
  }
});
```

---

#### 2. `handleExtensionInstall()`

**说明**：处理扩展安装事件

**参数**：无

**返回值**：无

**代码位置**：background.js 第 40-60 行

**示例**：
```javascript
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  // 初始化默认设置
});
```

---

### Popup API

#### 1. `updateSettings(settings)`

**说明**：更新设置并保存

**参数**：
- `settings` (`object`): 设置对象

**返回值**：`Promise<void>` - 操作完成

**代码位置**：popup/index.js 第 50-80 行

**示例**：
```javascript
const settings = {
  timeStep: 10,
  opacity: 0.9
};

updateSettings(settings).then(() => {
  console.log('Settings updated');
});
```

---

#### 2. `renderHistory(history)`

**说明**：渲染观看历史

**参数**：
- `history` (`array`): 历史记录数组

**返回值**：无

**代码位置**：popup/index.js 第 100-150 行

**示例**：
```javascript
const history = [
  {
    url: 'https://example.com/video1',
    timestamp: 1696980000000,
    duration: 600000
  }
];

renderHistory(history);
```

---

## 扩展开发

### 添加新平台支持

**步骤**：

1. 在 `PLATFORM_SELECTORS` 中添加平台选择器

```javascript
// content.js 第 14-58 行
const PLATFORM_SELECTORS = {
  // ... 现有平台

  // 新增平台
  newplatform: [
    '.platform-specific-selector-1',
    '.platform-specific-selector-2',
    '.platform-specific-selector-3'
  ],

  // ...
};
```

2. 测试新平台

```javascript
// 在浏览器控制台测试
const newSelectors = getPlatformSelectors('newplatform');
console.log('Platform selectors:', newSelectors);
```

3. 更新 CHANGELOG.md

```markdown
### [2.3.0] - 2026-08-10

**新增**：
- 新平台支持（newplatform）
```

### 自定义快捷键

**步骤**：

1. 在 `shortcuts` 对象中添加快捷键

```javascript
// content.js 第 50-70 行
const shortcuts = {
  Space: { action: 'togglePlay' },
  F: { action: 'toggleFullscreen' },
  ←: { action: 'seekBack', seconds: 5 },
  →: { action: 'seekForward', seconds: 5 },
  // 自定义快捷键
  T: { action: 'toggleTheme' },
  H: { action: 'hideSubtitle' }
};
```

2. 更新快捷键提示

```javascript
// 更新 Popup UI 中的快捷键列表
const shortcutDescriptions = {
  T: '切换主题',
  H: '隐藏字幕'
};
```

### 修改字幕样式

**步骤**：

1. 找到字幕样式定义

```javascript
// content.js 第 1700-1750 行
const subtitleStyles = {
  font: 'Arial',
  fontSize: 16,
  color: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  position: 'bottom',
  align: 'center'
};
```

2. 修改样式属性

```javascript
const subtitleStyles = {
  font: 'Helvetica',
  fontSize: 18,
  color: '#ff0000',
  backgroundColor: 'rgba(255, 0, 0, 0.5)',
  position: 'top',
  align: 'left'
};
```

3. 保存到用户设置

```javascript
// 保存自定义样式
const settings = {
  // ... 其他设置
  subtitleStyles: {
    font: 'Helvetica',
    fontSize: 18,
    color: '#ff0000',
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    position: 'top',
    align: 'left'
  }
};
```

---

## 测试指南

### 单元测试

**建议测试框架**：Jest、Mocha + Chai

**测试示例**：

```javascript
describe('Cinema Mode', () => {
  beforeEach(() => {
    // 清理和设置
    document.body.innerHTML = '<video id="video1"></video>';
  });

  test('should detect video element', () => {
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
  });

  test('should start cinema mode', () => {
    toggleCinema();
    expect(isCinemaMode()).toBe(true);
  });
});

describe('Video Controls', () => {
  test('should play video', async () => {
    await playVideo();
    const video = document.querySelector('video');
    expect(video.paused).toBe(false);
  });

  test('should seek video', async () => {
    await seekVideo(10);
    const video = document.querySelector('video');
    expect(video.currentTime).toBeCloseTo(10, 0);
  });
});
```

### 集成测试

**测试场景**：

1. **影院模式启动**
   - 访问 Bilibili 视频页
   - 检查是否显示悬浮按钮
   - 点击按钮进入影院模式
   - 验证工具条隐藏
   - 验证播放控制可用

2. **影院模式退出**
   - 点击退出按钮
   - 验证工具条恢复
   - 验证视频状态保持

3. **快进/回退**
   - 点击快进按钮
   - 验证进度条更新
   - 验证视频播放位置正确
   - 点击回退按钮
   - 验证进度条更新
   - 验证视频播放位置正确

4. **字幕加载**
   - 加载 SRT 字幕文件
   - 验证字幕显示
   - 验证字幕样式正确
   - 验证字幕时间同步

5. **音乐模式**
   - 启用音乐模式
   - 验证背景效果
   - 验证比例自适应
   - 验证时钟显示

### 平台测试矩阵

| 平台 | 影院模式 | 播放控制 | 快捷键 | 字幕 | 音乐模式 | 工具栏隐藏 |
|------|---------|---------|--------|------|---------|-----------|
| Bilibili | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Youku | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| IQiyi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kuaishou | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Default | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 性能测试

**测试指标**：

1. **CPU 使用率**
   - 检测轮询时 CPU 使用率
   - 停止轮询时 CPU 使用率
   - 预期：降低 95%

2. **内存使用**
   - 扩展加载时的内存
   - 运行一段时间后的内存
   - 预期：无内存泄漏

3. **响应时间**
   - 快捷键响应时间
   - 播放控制响应时间
   - 预期：< 50ms

**测试命令**：

```bash
# 使用 Chrome DevTools 性能分析
# 1. 打开 DevTools
# 2. 切换到 Performance 标签
# 3. 开始录制
# 4. 进行操作（播放、快进等）
# 5. 停止录制
# 6. 分析性能报告
```

---

## 部署流程

### 构建发布包

1. **更新版本号**

```bash
# 更新 package.json
npm version patch  # 2.2.1 -> 2.2.2
```

2. **构建 ZIP 包**

```bash
npm run build:zip
```

输出：`dist/theater-mode-v2.2.0.zip`

3. **验证构建**

```bash
# 检查 ZIP 包内容
unzip -l dist/theater-mode-v2.2.0.zip

# 检查版本号
unzip -p dist/theater-mode-v2.2.0.zip manifest.json | grep version
```

### 上传到 Chrome Web Store

1. **准备文件**

   - ZIP 包（dist/theater-mode-v2.2.0.zip）
   - 截图（至少 2 张）
   - 描述文案

2. **创建商店条目**

   - 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - 点击 "New Item"
   - 上传 ZIP 包

3. **填写信息**

   - **标题**: Theater Mode
   - **描述**: 详细描述功能
   - **类别**: Productivity
   - **隐私政策**: 提供隐私政策链接

4. **提交审核**

   - 点击 "Submit for Review"
   - 等待审核（通常 1-3 个工作日）

### 自动化部署

**推荐工具**：GitHub Actions

**配置示例** (.github/workflows/deploy.yml):

```yaml
name: Deploy to Chrome Web Store

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Build extension
        run: npm run build:zip

      - name: Upload to Chrome Web Store
        uses: cypress-io/github-action@v4
        with:
          file: dist/theater-mode-${{ github.ref }}.zip
          client-id: ${{ secrets.CHROME_CLIENT_ID }}
          client-secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh-token: ${{ secrets.CHROME_REFRESH_TOKEN }}
```

---

## 调试技巧

### 1. 控制台日志

```javascript
// 启用详细日志
console.log('[Cinema Mode] Initializing...');
console.log('[Cinema Mode] Video element found:', videoElement);
console.log('[Cinema Mode] Settings loaded:', settings);
```

### 2. 断点调试

```javascript
// 在关键位置设置断点
function toggleCinema() {
  debugger; // 断点
  // ...
}
```

### 3. 扩展管理

```javascript
// 查看扩展信息
chrome.runtime.getManifest();

// 监听扩展消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  sendResponse({ received: true });
});
```

### 4. 存储调试

```javascript
// 查看存储内容
chrome.storage.local.get(null, (data) => {
  console.log('Local storage:', data);
});

chrome.storage.sync.get(null, (data) => {
  console.log('Sync storage:', data);
});
```

---

## 常见问题

### Q1: 扩展无法加载？

**解决方案**：
- 检查 manifest.json 格式
- 确保所有文件存在
- 检查 Node.js 版本
- 查看控制台错误信息

### Q2: 快捷键不工作？

**解决方案**：
- 检查快捷键冲突
- 确保焦点在视频元素上
- 查看控制台是否有错误
- 尝试重新加载扩展

### Q3: 字幕不显示？

**解决方案**：
- 检查字幕文件 URL 是否正确
- 验证字幕格式是否支持
- 查看控制台错误信息
- 检查浏览器是否支持 WebVTT

### Q4: 性能问题？

**解决方案**：
- 减少轮询频率
- 优化选择器性能
- 使用 requestAnimationFrame
- 检查内存泄漏

---

## 贡献指南

### 报告 Bug

1. 描述问题
2. 提供复现步骤
3. 提供浏览器版本
4. 提供错误截图或日志

### 提交 PR

1. Fork 仓库
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 添加必要的注释
- 编写测试用例

---

## 联系方式

- **GitHub**: [repository-url]
- **Issues**: [issues-url]
- **Email**: [email-address]

---

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。
