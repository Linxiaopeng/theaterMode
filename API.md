# API 参考文档

本文档提供 Theatre Mode 扩展的所有公开 API 接口，包括 Content Script、Background Script 和 Popup API。

## 目录

- [Content Script API](#content-script-api)
  - [Cinema Mode API](#cinema-mode-api)
  - [Playback Controls API](#playback-controls-api)
  - [Detection API](#detection-api)
  - [Subtitle API](#subtitle-api)
  - [Storage API](#storage-api)
- [Background Script API](#background-script-api)
- [Popup API](#popup-api)
- [Event Listeners](#event-listeners)
- [Storage Schema](#storage-schema)

---

## Content Script API

### Cinema Mode API

#### `getCinemaContainer()`

获取影院模式容器元素。

**签名**：
```javascript
function getCinemaContainer(): CinemaContainer | null
```

**返回值**：
```typescript
interface CinemaContainer {
  container: HTMLElement;      // 影院容器
  controls: HTMLElement;        // 控制栏
}
```

**示例**：
```javascript
const container = getCinemaContainer();
if (container) {
  console.log('Container found:', container.container);
  console.log('Controls found:', container.controls);
} else {
  console.log('No cinema container found');
}
```

**代码位置**：content.js:100-120

---

#### `isCinemaMode()`

检查当前是否处于影院模式。

**签名**：
```javascript
function isCinemaMode(): boolean
```

**返回值**：`boolean` - 是否处于影院模式

**示例**：
```javascript
if (isCinemaMode()) {
  console.log('Cinema mode is active');
} else {
  console.log('Cinema mode is not active');
}
```

**代码位置**：content.js:120-130

---

#### `toggleCinema(forceState?)`

切换影院模式状态。

**签名**：
```javascript
function toggleCinema(forceState?: boolean): boolean
```

**参数**：
- `forceState` (`boolean`, 可选) - 强制设置状态

**返回值**：`boolean` - 切换后的状态（true=已启用）

**示例**：
```javascript
// 切换到启用状态
const enabled = toggleCinema(true);
console.log('Cinema mode enabled:', enabled);

// 切换到禁用状态
const disabled = toggleCinema(false);
console.log('Cinema mode disabled:', disabled);

// 自动切换
const newState = toggleCinema();
console.log('New state:', newState);
```

**代码位置**：content.js:1400-1450

---

#### `enterCinema()`

进入影院模式。

**签名**：
```javascript
function enterCinema(): Promise<void>
```

**示例**：
```javascript
enterCinema().then(() => {
  console.log('Entered cinema mode');
}).catch(err => {
  console.error('Failed to enter cinema mode:', err);
});
```

**代码位置**：content.js:1400-1410

---

#### `exitCinema()`

退出影院模式。

**签名**：
```javascript
function exitCinema(): Promise<void>
```

**示例**：
```javascript
exitCinema().then(() => {
  console.log('Exited cinema mode');
}).catch(err => {
  console.error('Failed to exit cinema mode:', err);
});
```

**代码位置**：content.js:1410-1450

---

### Playback Controls API

#### `playVideo()`

播放视频。

**签名**：
```javascript
function playVideo(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
playVideo().then(() => {
  console.log('Video played');
}).catch(err => {
  console.error('Failed to play video:', err);
});
```

**代码位置**：content.js:1465-1480

---

#### `pauseVideo()`

暂停视频。

**签名**：
```javascript
function pauseVideo(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
pauseVideo().then(() => {
  console.log('Video paused');
}).catch(err => {
  console.error('Failed to pause video:', err);
});
```

**代码位置**：content.js:1480-1490

---

#### `seekVideo(seconds)`

快进或回退视频。

**签名**：
```javascript
function seekVideo(seconds: number): Promise<void>
```

**参数**：
- `seconds` (`number`) - 秒数，正数=快进，负数=回退

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
// 快进 5 秒
seekVideo(5).catch(err => {
  console.error('Seek forward failed:', err);
});

// 回退 10 秒
seekVideo(-10).catch(err => {
  console.error('Seek back failed:', err);
});

// 跳转到 60 秒
seekVideo(60).catch(err => {
  console.error('Seek to time failed:', err);
});
```

**代码位置**：content.js:1490-1510

---

#### `setVolume(percent)`

设置音量。

**签名**：
```javascript
function setVolume(percent: number): Promise<void>
```

**参数**：
- `percent` (`number`) - 音量百分比（0-100）

**返回值**：`Promise<void>` - 操作完成

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

// 最大音量
setVolume(100).catch(err => {
  console.error('Volume setting failed:', err);
});
```

**代码位置**：content.js:1510-1530

---

#### `toggleFullscreen()`

切换全屏。

**签名**：
```javascript
function toggleFullscreen(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
toggleFullscreen().catch(err => {
  console.error('Fullscreen toggle failed:', err);
});
```

**代码位置**：content.js:1530-1550

---

#### `getCurrentTime()`

获取当前播放时间。

**签名**：
```javascript
function getCurrentTime(): number
```

**返回值**：`number` - 当前播放时间（秒）

**示例**：
```javascript
const currentTime = getCurrentTime();
console.log('Current time:', currentTime, 'seconds');
```

**代码位置**：content.js:1550-1560

---

#### `getDuration()`

获取视频总时长。

**签名**：
```javascript
function getDuration(): number
```

**返回值**：`number` - 视频总时长（秒）

**示例**：
```javascript
const duration = getDuration();
console.log('Video duration:', duration, 'seconds');
```

**代码位置**：content.js:1560-1570

---

### Detection API

#### `checkVideoElement()`

检查页面上是否存在视频元素。

**签名**：
```javascript
function checkVideoElement(): HTMLVideoElement | null
```

**返回值**：`HTMLVideoElement | null` - 视频元素或 null

**示例**：
```javascript
const video = checkVideoElement();
if (video) {
  console.log('Video found:', video.src);
} else {
  console.log('No video found on page');
}
```

**代码位置**：content.js:1570-1600

---

#### `handlePause()`

处理视频暂停事件。

**签名**：
```javascript
function handlePause(): void
```

**返回值**：无

**示例**：
```javascript
const video = document.querySelector('video');
video.addEventListener('pause', handlePause);
```

**代码位置**：content.js:1600-1620

---

#### `handleVideoVisibility()`

处理视频可见性变化。

**签名**：
```javascript
function handleVideoVisibility(): void
```

**返回值**：无

**示例**：
```javascript
const observer = new IntersectionObserver((entries) => {
  handleVideoVisibility();
});
observer.observe(videoElement);
```

**代码位置**：content.js:1620-1650

---

### Subtitle API

#### `loadSubtitle(url)`

加载字幕文件。

**签名**：
```javascript
function loadSubtitle(url: string): Promise<void>
```

**参数**：
- `url` (`string`) - 字幕文件 URL

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
loadSubtitle('https://example.com/subtitle.srt')
  .then(() => {
    console.log('Subtitle loaded successfully');
  })
  .catch(err => {
    console.error('Failed to load subtitle:', err);
    showToast('Failed to load subtitle', 'error');
  });
```

**支持的格式**：
- .srt (SubRip)
- .vtt (WebVTT)
- .ass (Advanced SubStation Alpha)

**代码位置**：content.js:1650-1670

---

#### `hideSubtitle()`

隐藏字幕。

**签名**：
```javascript
function hideSubtitle(): void
```

**返回值**：无

**示例**：
```javascript
hideSubtitle();
```

**代码位置**：content.js:1670-1690

---

#### `showSubtitle()`

显示字幕。

**签名**：
```javascript
function showSubtitle(): void
```

**返回值**：无

**示例**：
```javascript
showSubtitle();
```

**代码位置**：content.js:1690-1710

---

#### `getCurrentSubtitle()`

获取当前字幕。

**签名**：
```javascript
function getCurrentSubtitle(): SubtitleItem | null
```

**返回值**：`SubtitleItem | null` - 当前字幕对象或 null

**示例**：
```javascript
const subtitle = getCurrentSubtitle();
if (subtitle) {
  console.log('Current subtitle:', subtitle.text);
  console.log('Start time:', subtitle.startTime);
  console.log('End time:', subtitle.endTime);
}
```

**代码位置**：content.js:1710-1730

---

### Storage API

#### `saveSettings(settings)`

保存设置到本地存储。

**签名**：
```javascript
function saveSettings(settings: Settings): Promise<void>
```

**参数**：
- `settings` (`Settings`) - 设置对象

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
const settings = {
  timeStep: 10,
  opacity: 0.8,
  theme: 'dark',
  shortcuts: {
    Space: 'togglePlay',
    F: 'toggleFullscreen'
  },
  subtitles: {
    enabled: true,
    style: {
      font: 'Arial',
      fontSize: 16,
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)'
    }
  }
};

saveSettings(settings).catch(err => {
  console.error('Settings save failed:', err);
});
```

**代码位置**：content.js:1950-1970

---

#### `loadSettings()`

从本地存储加载设置。

**签名**：
```javascript
function loadSettings(): Promise<Settings>
```

**返回值**：`Promise<Settings>` - 设置对象

**示例**：
```javascript
loadSettings().then(settings => {
  console.log('Loaded settings:', settings);
  // 应用设置
  applySettings(settings);
}).catch(err => {
  console.error('Settings load failed:', err);
  // 使用默认设置
  applySettings(DEFAULT_SETTINGS);
});
```

**代码位置**：content.js:1970-1990

---

#### `saveHistory(history)`

保存观看历史。

**签名**：
```javascript
function saveHistory(history: HistoryItem[]): Promise<void>
```

**参数**：
- `history` (`HistoryItem[]`) - 历史记录数组

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
const history = [
  {
    url: 'https://example.com/video1',
    title: 'Video 1',
    timestamp: 1696980000000,
    duration: 600000
  }
];

saveHistory(history).catch(err => {
  console.error('History save failed:', err);
});
```

**代码位置**：content.js:2000-2020

---

#### `loadHistory()`

加载观看历史。

**签名**：
```javascript
function loadHistory(): Promise<HistoryItem[]>
```

**返回值**：`Promise<HistoryItem[]>` - 历史记录数组

**示例**：
```javascript
loadHistory().then(history => {
  console.log('Loaded history:', history);
}).catch(err => {
  console.error('History load failed:', err);
  return [];
});
```

**代码位置**：content.js:2020-2040

---

#### `clearHistory()`

清除观看历史。

**签名**：
```javascript
function clearHistory(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
clearHistory().then(() => {
  console.log('History cleared');
}).catch(err => {
  console.error('History clear failed:', err);
});
```

**代码位置**：content.js:2040-2060

---

### Music Mode API

#### `enableMusicMode()`

启用音乐模式。

**签名**：
```javascript
function enableMusicMode(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
enableMusicMode().then(() => {
  console.log('Music mode enabled');
}).catch(err => {
  console.error('Failed to enable music mode:', err);
});
```

**代码位置**：content.js:2060-2080

---

#### `disableMusicMode()`

禁用音乐模式。

**签名**：
```javascript
function disableMusicMode(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
disableMusicMode().then(() => {
  console.log('Music mode disabled');
}).catch(err => {
  console.error('Failed to disable music mode:', err);
});
```

**代码位置**：content.js:2080-2100

---

## Background Script API

### Message API

#### `sendMessage(message)`

向所有 content script 发送消息。

**签名**：
```javascript
function sendMessage(message: Message): Promise<void>
```

**参数**：
- `message` (`Message`) - 消息对象

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
// 发送消息
chrome.runtime.sendMessage({
  action: 'playVideo'
}).then(() => {
  console.log('Message sent');
});

// 接收消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'playVideo') {
    playVideo();
    sendResponse({ success: true });
  }
  return true; // 异步响应
});
```

**代码位置**：background.js:10-30

---

### Extension Lifecycle API

#### `handleExtensionInstall()`

处理扩展安装事件。

**签名**：
```javascript
function handleExtensionInstall(): void
```

**返回值**：无

**示例**：
```javascript
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  // 初始化默认设置
  saveSettings(DEFAULT_SETTINGS);
});
```

**代码位置**：background.js:40-60

---

#### `handleExtensionUpdate()`

处理扩展更新事件。

**签名**：
```javascript
function handleExtensionUpdate(): void
```

**返回值**：无

**示例**：
```javascript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    console.log('Extension updated to version:', details.previousVersion);
    // 迁移旧设置
    migrateSettings();
  }
});
```

**代码位置**：background.js:60-80

---

## Popup API

### Settings API

#### `updateSettings(settings)`

更新设置并保存。

**签名**：
```javascript
function updateSettings(settings: Partial<Settings>): Promise<void>
```

**参数**：
- `settings` (`Partial<Settings>`) - 部分设置对象

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
// 更新时间步长
updateSettings({ timeStep: 15 }).then(() => {
  console.log('Time step updated');
});

// 更新多个设置
updateSettings({
  timeStep: 15,
  opacity: 0.9,
  theme: 'light'
}).then(() => {
  console.log('Settings updated');
});
```

**代码位置**：popup/index.js:50-80

---

#### `resetSettings()`

重置设置到默认值。

**签名**：
```javascript
function resetSettings(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
resetSettings().then(() => {
  console.log('Settings reset to defaults');
}).catch(err => {
  console.error('Settings reset failed:', err);
});
```

**代码位置**：popup/index.js:80-100

---

### History API

#### `renderHistory(history)`

渲染观看历史。

**签名**：
```javascript
function renderHistory(history: HistoryItem[]): void
```

**参数**：
- `history` (`HistoryItem[]`) - 历史记录数组

**返回值**：无

**示例**：
```javascript
const history = [
  {
    url: 'https://example.com/video1',
    title: 'Video 1',
    timestamp: 1696980000000,
    duration: 600000
  },
  {
    url: 'https://example.com/video2',
    title: 'Video 2',
    timestamp: 1696980000000,
    duration: 900000
  }
];

renderHistory(history);
```

**代码位置**：popup/index.js:100-150

---

#### `clearHistory()`

清除观看历史。

**签名**：
```javascript
function clearHistory(): Promise<void>
```

**返回值**：`Promise<void>` - 操作完成

**示例**：
```javascript
clearHistory().then(() => {
  console.log('History cleared');
  renderHistory([]);
}).catch(err => {
  console.error('History clear failed:', err);
});
```

**代码位置**：popup/index.js:150-170

---

## Event Listeners

### Content Script Events

#### `onCinemaToggle`

影院模式切换事件。

**事件对象**：
```typescript
interface CinemaToggleEvent {
  enabled: boolean;
  timestamp: number;
}
```

**监听示例**：
```javascript
document.addEventListener('cinemaToggle', (event) => {
  const { enabled } = event.detail;
  console.log('Cinema mode toggled:', enabled);
});
```

---

#### `onPlaybackChange`

播放状态变化事件。

**事件对象**：
```typescript
interface PlaybackChangeEvent {
  playing: boolean;
  currentTime: number;
  duration: number;
}
```

**监听示例**：
```javascript
document.addEventListener('playbackChange', (event) => {
  const { playing, currentTime, duration } = event.detail;
  console.log('Playback changed:', {
    playing,
    currentTime,
    duration
  });
});
```

---

#### `onSubtitleLoad`

字幕加载事件。

**事件对象**：
```typescript
interface SubtitleLoadEvent {
  url: string;
  duration: number;
  itemCount: number;
}
```

**监听示例**：
```javascript
document.addEventListener('subtitleLoad', (event) => {
  const { url, duration, itemCount } = event.detail;
  console.log('Subtitle loaded:', {
    url,
    duration,
    itemCount
  });
});
```

---

## Storage Schema

### Settings Schema

```typescript
interface Settings {
  // 通用设置
  timeStep: number;           // 时间步长（秒）
  opacity: number;            // 遮罩透明度（0-1）
  theme: 'dark' | 'light';    // 主题

  // 播放控制
  shortcuts: {
    Space: string;            // 空格：togglePlay
    F: string;                // F：toggleFullscreen
    Left: string;             // 左箭头：seekBack
    Right: string;            // 右箭头：seekForward
    Up: string;               // 上箭头：volumeUp
    Down: string;             // 下箭头：volumeDown
    Q: string;                // Q：seekBack30
    E: string;                // E：seekForward30
    M: string;                // M：toggleMute
  };

  // 字幕设置
  subtitles: {
    enabled: boolean;
    autoLoad: boolean;
    style: {
      font: string;           // 字体
      fontSize: number;       // 字号
      color: string;          // 颜色
      backgroundColor: string; // 背景颜色
      position: 'top' | 'bottom';
      align: 'left' | 'center' | 'right';
    };
  };

  // 历史设置
  history: {
    maxItems: number;         // 最大历史记录数
    autoSave: boolean;        // 自动保存
  };

  // 音乐模式
  musicMode: {
    enabled: boolean;
    ambilight: boolean;
  };
}
```

### History Schema

```typescript
interface HistoryItem {
  url: string;                // 视频 URL
  title: string;              // 视频标题
  timestamp: number;          // 观看时间（毫秒时间戳）
  duration: number;           // 视频时长（毫秒）
}
```

### Message Schema

```typescript
interface Message {
  action: string;             // 动作名称
  params?: any;               // 参数
  requestId?: string;         // 请求 ID（可选）
}
```

### Response Schema

```typescript
interface Response {
  success: boolean;           // 是否成功
  data?: any;                 // 数据（成功时）
  error?: string;             // 错误信息（失败时）
  requestId?: string;         // 请求 ID（可选）
}
```

---

## Error Handling

### Common Errors

| 错误码 | 错误消息 | 说明 | 解决方案 |
|--------|---------|------|---------|
| E001 | "Video not found" | 页面上没有视频元素 | 刷新页面或进入有视频的页面 |
| E002 | "Cinema mode already active" | 影院模式已激活 | 直接使用 |
| E003 | "Cinema mode not active" | 影院模式未激活 | 先进入影院模式 |
| E004 | "Failed to load subtitle" | 字幕加载失败 | 检查字幕 URL |
| E005 | "Settings save failed" | 设置保存失败 | 检查存储权限 |
| E006 | "Invalid volume value" | 音量值无效 | 设置 0-100 之间的值 |

### Error Handling Example

```javascript
try {
  const result = await someAPI();
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error.code, error.message);

  // 显示用户友好的错误消息
  showToast(getErrorMessage(error.code), 'error');

  // 可选：发送错误报告
  sendErrorReport(error);
}
```

---

## Performance Considerations

### 1. 批量操作

```javascript
// 不好的做法：频繁调用 API
loadSettings().then(settings => {
  applySettings(settings);
});

loadSettings().then(settings => {
  applySettings(settings);
});

// 好的做法：批量操作
Promise.all([
  loadSettings(),
  loadHistory()
]).then(([settings, history]) => {
  applySettings(settings);
  renderHistory(history);
});
```

### 2. 异步处理

```javascript
// 不好的做法：阻塞操作
function doSomething() {
  const result = expensiveOperation(); // 阻塞
  return result;
}

// 好的做法：异步操作
async function doSomething() {
  const result = await expensiveOperation();
  return result;
}
```

### 3. 内存管理

```javascript
// 不好的做法：不清理资源
setInterval(() => {
  checkVideoElement();
}, 100);

// 好的做法：清理资源
const intervalId = setInterval(() => {
  checkVideoElement();
}, 100);

// 清理
clearInterval(intervalId);
```

---

## Type Definitions

### TypeScript Definitions

```typescript
// cinema.ts
interface CinemaContainer {
  container: HTMLElement;
  controls: HTMLElement;
}

// playback.ts
interface PlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

// subtitle.ts
interface SubtitleItem {
  text: string;
  startTime: number;
  endTime: number;
  position?: number;
}

// storage.ts
interface Settings {
  timeStep: number;
  opacity: number;
  theme: 'dark' | 'light';
  shortcuts: Record<string, string>;
  subtitles: SubtitleSettings;
  history: HistorySettings;
  musicMode: MusicModeSettings;
}

interface HistoryItem {
  url: string;
  title: string;
  timestamp: number;
  duration: number;
}

interface Message {
  action: string;
  params?: any;
  requestId?: string;
}

interface Response {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
}
```

---

## Browser Compatibility

### Supported Browsers

- ✅ Chrome 88+
- ✅ Chromium 88+
- ✅ Edge 88+
- ✅ Brave 88+

### API Compatibility

| API | Chrome 88+ | Edge 88+ | Brave 88+ |
|-----|-----------|----------|-----------|
| chrome.storage.local | ✅ | ✅ | ✅ |
| chrome.storage.sync | ✅ | ✅ | ✅ |
| chrome.runtime.sendMessage | ✅ | ✅ | ✅ |
| chrome.runtime.onMessage | ✅ | ✅ | ✅ |
| HTML5 Video API | ✅ | ✅ | ✅ |
| IntersectionObserver | ✅ | ✅ | ✅ |

---

## Security Considerations

### 1. 输入验证

```javascript
// 好的做法：验证输入
function seekVideo(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) {
    throw new Error('Invalid seconds value');
  }
  // 继续操作
}
```

### 2. XSS 防护

```javascript
// 好的做法：转义 HTML
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 3. 权限检查

```javascript
// 好的做法：检查权限
chrome.storage.local.get(null, (data) => {
  if (data !== null) {
    // 有权限
    saveSettings(data);
  }
});
```

---

## Debugging

### 1. 启用调试日志

```javascript
// 在代码中添加
const DEBUG = true;

function doSomething() {
  if (DEBUG) {
    console.log('[DEBUG] Doing something...');
  }
  // ...
}
```

### 2. 使用 Chrome DevTools

1. 打开 DevTools (F12)
2. 切换到 Console 标签
3. 监控消息：`chrome.runtime.onMessage.addListener(...)`
4. 查看存储：`chrome.storage.local.get(null, console.log)`

### 3. 使用断点

```javascript
// 在代码中添加
function toggleCinema() {
  debugger; // 断点
  // ...
}
```

---

## Changelog

### v2.2.0 (2026-08-10)

**新增 API**：
- `enableMusicMode()` - 启用音乐模式
- `disableMusicMode()` - 禁用音乐模式
- `getCurrentSubtitle()` - 获取当前字幕
- `clearHistory()` - 清除观看历史

**改进 API**：
- `toggleCinema()` - 支持强制状态参数
- `saveSettings()` - 增强错误处理
- `loadSettings()` - 支持默认值回退

---

## References

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Runtime API](https://developer.chrome.com/docs/extensions/reference/runtime/)
- [Web VTT](https://www.w3.org/TR/webvtt/)
