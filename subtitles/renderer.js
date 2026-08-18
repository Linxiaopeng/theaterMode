/**
 * 字幕渲染模块 (Subtitle Renderer Module)
 * 职责：负责在影院模式的视频舞台渲染字幕、根据视频播放进度实时同步、处理样式及排版。
 * 架构设计：独立模块，支持样式动态更新、多行与长文本自动换行。
 */

/* exported SubtitleRenderer */
class SubtitleRenderer {
  constructor(stageElement, options = {}) {
    this.stage = stageElement;
    this.cues = [];
    this.currentIndex = 0;
    this.settings = {
      fontSize: 18,
      fontColor: '#ffffff',
      bgColor: '#000000',
      bgOpacity: 0.6,
      fontWeight: '500',
      bottomOffset: 30,
      ...options
    };

    this.container = null;
    this.textEl = null;

    this.initDOM();
  }

  /**
   * 初始化字幕 DOM 结构
   */
  initDOM() {
    if (!this.stage) return;

    this.container = document.createElement('div');
    this.container.className = 'cinema-subtitle-container';
    this.updateContainerStyles();

    this.textEl = document.createElement('div');
    this.textEl.className = 'cinema-subtitle-main-text';
    this.container.appendChild(this.textEl);

    this.stage.appendChild(this.container);
  }

  /**
   * 更新容器样式（根据用户设置）
   */
  updateContainerStyles() {
    if (!this.container) return;

    const { fontSize, fontColor, bgColor, bgOpacity, fontWeight, bottomOffset } = this.settings;

    // 转换背景颜色 hex/rgb 到 rgba
    let bgRgba = 'rgba(0, 0, 0, 0.6)';
    if (bgColor.startsWith('#')) {
      const r = parseInt(bgColor.slice(1, 3), 16) || 0;
      const g = parseInt(bgColor.slice(3, 5), 16) || 0;
      const b = parseInt(bgColor.slice(5, 7), 16) || 0;
      bgRgba = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
    }

    this.container.style.cssText = `
      position: absolute;
      bottom: ${bottomOffset}px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 900px;
      text-align: center;
      z-index: 2147483647;
      pointer-events: none;
      box-sizing: border-box;
      padding: 6px 14px;
      border-radius: 6px;
      background-color: ${bgRgba};
      color: ${fontColor};
      font-size: ${fontSize}px;
      font-weight: ${fontWeight};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      line-height: 1.4;
      word-break: break-word;
      white-space: pre-wrap;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      user-select: none;
      -webkit-user-select: none;
      display: none;
    `;
  }

  /**
   * 加载字幕数据
   * @param {Array} cues
   */
  setCues(cues) {
    this.cues = cues || [];
    this.currentIndex = 0;
    if (this.cues.length > 0 && this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * 更新字幕样式设置
   * @param {Object} newSettings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.updateContainerStyles();
  }

  /**
   * 根据视频当前时间同步字幕
   * @param {number} currentTime 视频当前秒数
   */
  syncTime(currentTime) {
    if (!this.cues || this.cues.length === 0 || !this.textEl) {
      if (this.container) this.container.style.display = 'none';
      return;
    }

    // 查找当前时间对应的字幕
    const activeCue = this.findCueAtTime(currentTime);

    if (activeCue) {
      this.container.style.display = 'block';
      this.textEl.textContent = activeCue.text;
    } else {
      this.textEl.textContent = '';
      this.container.style.display = 'none';
    }
  }

  /**
   * 高效查找指定时间的字幕（利用二分查找或缓存指针优化同步准确性）
   * @param {number} t
   */
  findCueAtTime(t) {
    // 优化：先检查当前索引及其邻近区域，提升性能与同步准确性
    const len = this.cues.length;
    if (len === 0) return null;

    if (
      this.currentIndex < len &&
      t >= this.cues[this.currentIndex].start &&
      t <= this.cues[this.currentIndex].end
    ) {
      return this.cues[this.currentIndex];
    }

    // 顺序/邻近扫描
    for (let i = 0; i < len; i++) {
      const cue = this.cues[i];
      if (t >= cue.start && t <= cue.end) {
        this.currentIndex = i;
        return cue;
      }
      if (cue.start > t) {
        // 时间还未到，后续的无需再查
        break;
      }
    }

    return null;
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.remove();
    }
    this.container = null;
    this.textEl = null;
    this.cues = [];
  }

  /* ========================================================
   * 未来规划架构预留方法（本次不实现具体逻辑）
   * ======================================================== */

  /**
   * [预留] 双语字幕显示开关
   */
  toggleBilingual(_enabled) {
    // 预留双语显示切换逻辑
  }

  /**
   * [预留] 字幕搜索与定位
   */
  searchCues(keyword) {
    return this.cues.filter(c => c.text.includes(keyword));
  }

  /**
   * [预留] 字幕导出
   */
  exportCues(_format = 'srt') {
    // 预留导出逻辑
  }
}
