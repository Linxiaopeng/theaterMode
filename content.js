(() => {
  'use strict';

  const BTN_ID = 'cinema-mode-toggle-btn';
  const OVERLAY_ID = 'cinema-mode-overlay';
  const SCAN_INTERVAL = 500;
  const ROOT = () => document.body || document.documentElement;

  /**
   * 平台特定的工具栏选择器配置
   * 按平台分类，便于管理和扩展
   */
  const PLATFORM_SELECTORS = {
    bilibili: [
      '.bpx-player-sending-bar',
      '.bpx-player-sending-area',
      '.bilibili-player-video-sendbar',
      '.bilibili-player-area-danmaku-send',
      '.bpx-player-video-inputbar',
      '.bpx-player-sending-area-left',
      '.bpx-player-sending-area-right'
    ],
    youku: ['.txp_bottom', '.txp_tool', '.txp_danmu_send', '.youku-layer-sendbar'],
    iqiyi: ['.iqp-bottom', '.iqp-tool', '.iqp-danmu-send', '.iqp-send-bar'],
    kuaishou: ['.k-send-bar', '.play-fn-container'],
    default: [
      '.danmu-send-bar',
      '.player-bottom-bar',
      '.video-bottom-bar',
      '.player-extra-bar',
      '.video-toolbar',
      '.comment-send-box',
      '.send-btn-wrap',
      '#actions',
      '#actions-inner',
      '#meta'
    ]
  };

  /**
   * 获取指定平台的工具栏选择器
   * @param {string} platform 平台名称
   * @param {boolean} includeDefault 是否包含默认选择器
   * @returns {string[]} 选择器数组
   */
  function getPlatformSelectors(platform, includeDefault = true) {
    const selectors = [...(PLATFORM_SELECTORS[platform] || [])];
    if (includeDefault) {
      selectors.push(...PLATFORM_SELECTORS.default);
    }
    return selectors;
  }

  /**
   * 获取所有平台的选择器（包括所有平台的特殊选择器 + 默认选择器）
   * @returns {string[]} 所有选择器数组
   */
  function getAllSelectors() {
    const selectors = new Set();
    Object.values(PLATFORM_SELECTORS).forEach(platformSelectors => {
      platformSelectors.forEach(selector => selectors.add(selector));
    });
    return Array.from(selectors);
  }

  /**
   * 显示 Toast 通知（非阻塞，3秒后自动消失）
   * @param {string} message 通知消息
   * @param {string} type 通知类型：'success' | 'error' | 'info'
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `cinema-toast cinema-toast-${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    toast.innerHTML = `
      <span class="cinema-toast-icon">${icon}</span>
      <span class="cinema-toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
      toast.classList.add('cinema-toast-fade-out');
      toast.addEventListener('transitionend', () => {
        if (toast.parentNode) toast.remove();
      });
    }, 3000);
  }

  let btn = null;
  let overlay = null;
  let stage = null;
  let cinema = null;
  let musicCinema = null;
  let keydownListener = null;

  let currentSettings = {
    jDuration: 60,
    jKey: 'j',
    lDuration: 60,
    lKey: 'l',
    overlayOpacity: 0.88,
    cleanPlayerEnabled: true,
    subFontSize: 18,
    subFontColor: '#ffffff',
    subBgColor: '#000000',
    subBgOpacity: 0.6,
    subFontWeight: '500',
    subBottomOffset: 30,
    ambilightEnabled: true,
    blurHashEnabled: true,
    ambilightWaveEnabled: true,
    ambilightIntensity: 0.65,
    musicCardWidth: 380,
    musicPadding: 40,
    musicClockTopOffset: 50,
    musicBlurRadius: 65,
    musicStaticCoverEnabled: false,
    pomodoroEnabled: false,
    pomodoroWorkDuration: 45,
    pomodoroBreakDuration: 10
  };

  function updateMusicModeSettings() {
    if (musicCinema && musicCinema.stageEl) {
      musicCinema.stageEl.style.padding = `${currentSettings.musicPadding}px`;
    }
    if (musicCinema && musicCinema.bgBlurEl) {
      musicCinema.bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
    }
    if (musicCinema && musicCinema.clockHeader) {
      musicCinema.clockHeader.style.marginTop = `${currentSettings.musicClockTopOffset}px`;
    }
    if (musicCinema && musicCinema.artworkCard) {
      musicCinema.artworkCard.style.width = `${currentSettings.musicCardWidth}px`;
    }
    if (musicCinema && musicCinema.controlsCard) {
      musicCinema.controlsCard.style.width = `${currentSettings.musicCardWidth}px`;
    }
    if (musicCinema && musicCinema.pomodoroBar) {
      musicCinema.pomodoroBar.style.setProperty(
        'width',
        `${currentSettings.musicCardWidth}px`,
        'important'
      );
    }
    if (pomodoroBarEl && document.body.classList.contains('music-mode-active')) {
      pomodoroBarEl.style.setProperty('width', `${currentSettings.musicCardWidth}px`, 'important');
    }
    if (musicCinema && musicCinema.musicBlurController) {
      musicCinema.musicBlurController.updateOptions({
        isStatic: !!currentSettings.musicStaticCoverEnabled
      });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentSettings, items => {
      currentSettings = Object.assign({}, currentSettings, items);
      currentSettings.musicCardWidth = parseInt(items.musicCardWidth, 10) || 380;
      currentSettings.musicPadding = parseInt(items.musicPadding, 10) || 40;
      currentSettings.musicClockTopOffset = parseInt(items.musicClockTopOffset, 10) || 50;
      currentSettings.musicBlurRadius = parseInt(items.musicBlurRadius, 10) || 65;
      if (items.cleanPlayerEnabled === undefined) currentSettings.cleanPlayerEnabled = true;
      if (items.blurHashEnabled === undefined) currentSettings.blurHashEnabled = true;
      if (items.ambilightWaveEnabled === undefined) currentSettings.ambilightWaveEnabled = true;
      if (items.ambilightEnabled === undefined) currentSettings.ambilightEnabled = true;
      if (items.jDuration !== undefined)
        currentSettings.jDuration = parseInt(items.jDuration, 10) || 60;
      if (items.jKey !== undefined) currentSettings.jKey = items.jKey || 'j';
      if (items.lDuration !== undefined)
        currentSettings.lDuration = parseInt(items.lDuration, 10) || 60;
      if (items.lKey !== undefined) currentSettings.lKey = items.lKey || 'l';
      if (items.pomodoroEnabled !== undefined)
        currentSettings.pomodoroEnabled = !!items.pomodoroEnabled;
      if (items.pomodoroWorkDuration !== undefined)
        currentSettings.pomodoroWorkDuration = parseInt(items.pomodoroWorkDuration, 10) || 45;
      if (items.pomodoroBreakDuration !== undefined)
        currentSettings.pomodoroBreakDuration = parseInt(items.pomodoroBreakDuration, 10) || 10;
    });
    function applySettingsUpdate(newSettings) {
      if (!newSettings) return;
      currentSettings = Object.assign({}, currentSettings, newSettings);

      if (newSettings.overlayOpacity !== undefined && overlay) {
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${newSettings.overlayOpacity})`;
      }
      if (newSettings.cleanPlayerEnabled !== undefined && (cinema || musicCinema)) {
        document.documentElement.classList.toggle(
          'clean-player-active',
          !!newSettings.cleanPlayerEnabled
        );
        document.body.classList.toggle('clean-player-active', !!newSettings.cleanPlayerEnabled);
      }
      if (newSettings.ambilightEnabled !== undefined && cinema && cinema.ambilightEl) {
        cinema.ambilightEl.style.display = newSettings.ambilightEnabled ? 'block' : 'none';
      }
      if (newSettings.blurHashEnabled !== undefined) {
        if (cinema && cinema.ambilightController) {
          cinema.ambilightController.updateOptions({
            enableBlurHash: !!newSettings.blurHashEnabled
          });
        }
        if (musicCinema && musicCinema.musicBlurController) {
          musicCinema.musicBlurController.updateOptions({
            enableBlurHash: !!newSettings.blurHashEnabled
          });
        }
      }
      if (newSettings.ambilightWaveEnabled !== undefined) {
        if (cinema && cinema.ambilightEl) {
          cinema.ambilightEl.classList.toggle('has-edge-wave', !!newSettings.ambilightWaveEnabled);
        }
        if (musicCinema && musicCinema.overlayEl) {
          const bg = musicCinema.overlayEl.querySelector('.music-bg-blur');
          if (bg) bg.classList.toggle('has-edge-wave', !!newSettings.ambilightWaveEnabled);
        }
      }
      if (newSettings.ambilightIntensity !== undefined && cinema && cinema.ambilightEl) {
        cinema.ambilightEl.style.opacity = newSettings.ambilightIntensity;
      }
      if (
        newSettings.musicCardWidth !== undefined ||
        newSettings.musicPadding !== undefined ||
        newSettings.musicClockTopOffset !== undefined ||
        newSettings.musicBlurRadius !== undefined ||
        newSettings.musicStaticCoverEnabled !== undefined
      ) {
        updateMusicModeSettings();
      }
      if (cinema && cinema.subtitleRenderer) {
        cinema.subtitleRenderer.updateSettings({
          fontSize: currentSettings.subFontSize,
          fontColor: currentSettings.subFontColor,
          bgColor: currentSettings.subBgColor,
          bgOpacity: currentSettings.subBgOpacity,
          fontWeight: currentSettings.subFontWeight,
          bottomOffset: currentSettings.subBottomOffset
        });
      }
      if (newSettings.jDuration !== undefined) currentSettings.jDuration = newSettings.jDuration;
      if (newSettings.jKey !== undefined) currentSettings.jKey = newSettings.jKey;
      if (newSettings.lDuration !== undefined) currentSettings.lDuration = newSettings.lDuration;
      if (newSettings.lKey !== undefined) currentSettings.lKey = newSettings.lKey;
      if (newSettings.pomodoroEnabled !== undefined) {
        currentSettings.pomodoroEnabled = !!newSettings.pomodoroEnabled;
        updatePomodoroVisibility();
      }
      if (newSettings.pomodoroWorkDuration !== undefined) {
        currentSettings.pomodoroWorkDuration = parseInt(newSettings.pomodoroWorkDuration, 10) || 45;
        updatePomodoroTimeFromSettings();
      }
      if (newSettings.pomodoroBreakDuration !== undefined) {
        currentSettings.pomodoroBreakDuration =
          parseInt(newSettings.pomodoroBreakDuration, 10) || 10;
        updatePomodoroTimeFromSettings();
      }
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        const updated = {};
        for (const k in changes) {
          updated[k] = changes[k].newValue;
        }
        applySettingsUpdate(updated);
        updateMusicModeSettings();
      }
    });

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(msg => {
        if (msg && msg.type === 'SETTINGS_UPDATED' && msg.settings) {
          applySettingsUpdate(msg.settings);
          updateMusicModeSettings();
        }
      });
    }
  }

  // ==========================================================================
  // 🍅 番茄钟 (Pomodoro Timer) 专注与休息模式全局控制器
  // ==========================================================================
  let pomodoroTimerId = null;
  let pomodoroBarEl = null;
  const pomodoroState = {
    mode: 'work', // 'work' (45分钟) 或 'break' (10分钟)
    timeLeft: 45 * 60, // 初始 45 分钟 (2700秒)
    isRunning: false
  };

  function formatPomodoroTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function playPomodoroChime(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes = type === 'work' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.45);
      });
    } catch (e) {
      // 忽略 Web Audio 声音阻断异常
    }
  }

  function updatePomodoroUI() {
    if (!pomodoroBarEl) return;

    const modeBadge = pomodoroBarEl.querySelector('.pomodoro-badge');
    const timeDisplay = pomodoroBarEl.querySelector('.pomodoro-timer-time');
    const playPauseBtn = pomodoroBarEl.querySelector('.pomodoro-toggle-btn');

    const workM = currentSettings.pomodoroWorkDuration || 45;
    const breakM = currentSettings.pomodoroBreakDuration || 10;

    if (modeBadge) {
      if (pomodoroState.mode === 'work') {
        modeBadge.className = 'pomodoro-badge mode-work';
        modeBadge.innerHTML = `🍅 专注 ${workM}m`;
        modeBadge.title = `点击手动切换至 ${breakM} 分钟休息模式`;
      } else {
        modeBadge.className = 'pomodoro-badge mode-break';
        modeBadge.innerHTML = `☕ 休息 ${breakM}m`;
        modeBadge.title = `点击手动切换至 ${workM} 分钟专注模式`;
      }
    }

    if (timeDisplay) {
      timeDisplay.textContent = formatPomodoroTime(pomodoroState.timeLeft);
    }

    if (playPauseBtn) {
      const playSvg =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6,4 20,12 6,20"/></svg>';
      const pauseSvg =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      playPauseBtn.innerHTML = pomodoroState.isRunning ? pauseSvg : playSvg;
      playPauseBtn.title = pomodoroState.isRunning ? '暂停倒计时' : '开始倒计时';
    }
  }

  function startPomodoroTimer() {
    if (pomodoroTimerId) clearInterval(pomodoroTimerId);
    pomodoroState.isRunning = true;
    pomodoroTimerId = setInterval(() => {
      if (pomodoroState.timeLeft > 0) {
        pomodoroState.timeLeft--;
        updatePomodoroUI();
      } else {
        const workM = currentSettings.pomodoroWorkDuration || 45;
        const breakM = currentSettings.pomodoroBreakDuration || 10;
        if (pomodoroState.mode === 'work') {
          pomodoroState.mode = 'break';
          pomodoroState.timeLeft = breakM * 60;
          showToast(`🍅 ${workM} 分钟专注完成！休息 ${breakM} 分钟时间到 ~`, 'success');
          playPomodoroChime('work');
        } else {
          pomodoroState.mode = 'work';
          pomodoroState.timeLeft = workM * 60;
          showToast(`☕ ${breakM} 分钟休息结束！开始新的 ${workM} 分钟专注 ~`, 'info');
          playPomodoroChime('break');
        }
        updatePomodoroUI();
      }
    }, 1000);
    updatePomodoroUI();
  }

  function pausePomodoroTimer() {
    if (pomodoroTimerId) {
      clearInterval(pomodoroTimerId);
      pomodoroTimerId = null;
    }
    pomodoroState.isRunning = false;
    updatePomodoroUI();
  }

  function togglePomodoroTimer() {
    if (pomodoroState.isRunning) {
      pausePomodoroTimer();
    } else {
      startPomodoroTimer();
    }
  }

  function resetPomodoroTimer() {
    pausePomodoroTimer();
    const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
    const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
    pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
    updatePomodoroUI();
  }

  function switchPomodoroMode(newMode) {
    pausePomodoroTimer();
    pomodoroState.mode = newMode || (pomodoroState.mode === 'work' ? 'break' : 'work');
    const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
    const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
    pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
    updatePomodoroUI();
  }

  function updatePomodoroTimeFromSettings() {
    if (!pomodoroState.isRunning) {
      const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
      const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
      pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
    }
    updatePomodoroUI();
  }

  function updatePomodoroVisibility() {
    if (!pomodoroBarEl) return;
    if (currentSettings.pomodoroEnabled) {
      pomodoroBarEl.classList.remove('hidden');
    } else {
      pomodoroBarEl.classList.add('hidden');
    }
  }

  function createPomodoroBar() {
    if (pomodoroBarEl && pomodoroBarEl.isConnected) return pomodoroBarEl;

    const bar = document.createElement('div');
    bar.className = 'cinema-pomodoro-bar';
    if (!currentSettings.pomodoroEnabled) {
      bar.classList.add('hidden');
    }

    // 1. 模式 Badge
    const modeBadge = document.createElement('div');
    modeBadge.className = 'pomodoro-badge mode-work';
    modeBadge.addEventListener('click', e => {
      e.stopPropagation();
      switchPomodoroMode();
    });
    bar.appendChild(modeBadge);

    // 2. 时间显示
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'pomodoro-timer-time';
    timeDisplay.textContent = formatPomodoroTime(pomodoroState.timeLeft);
    bar.appendChild(timeDisplay);

    // 3. 分割线
    const divider = document.createElement('div');
    divider.className = 'pomodoro-divider';
    bar.appendChild(divider);

    // 4. 按钮组 (播放/暂停 + 重置)
    const actionsBox = document.createElement('div');
    actionsBox.className = 'pomodoro-actions';

    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'cinema-ctrl-btn cinema-icon-btn pomodoro-toggle-btn';
    playPauseBtn.addEventListener('click', e => {
      e.stopPropagation();
      togglePomodoroTimer();
    });
    actionsBox.appendChild(playPauseBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'cinema-ctrl-btn cinema-icon-btn';
    resetBtn.title = '重置倒计时';
    resetBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    resetBtn.addEventListener('click', e => {
      e.stopPropagation();
      resetPomodoroTimer();
    });
    actionsBox.appendChild(resetBtn);

    bar.appendChild(actionsBox);

    pomodoroBarEl = bar;
    updatePomodoroUI();
    return bar;
  }

  /* ---------- 历史记录管理 (最多90条，播放满1分钟方可入库) ---------- */
  let recordedUrlForPage = '';

  function recordWatchHistory(video) {
    try {
      const url = window.location.href;
      if (
        !url ||
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:')
      )
        return;
      if (recordedUrlForPage === url) return;

      // 必须播放达到或超过 1 分钟 (60秒) 才录入，防止误记
      if (!video || typeof video.currentTime !== 'number' || video.currentTime < 60) {
        console.log('[Theater Mode] Watch history skipped: video not played for 60 seconds');
        return;
      }

      const rawTitle = document.title || url;
      const title = rawTitle.trim().replace(/\s+/g, ' ');
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const timeString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      console.log('[Theater Mode] Attempting to save watch history:', { url, title, timeString });

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ history: [] }, res => {
          try {
            let list = Array.isArray(res.history) ? res.history : [];
            // 如果已有相同 URL 记录，滤除旧项，最新放至队首
            list = list.filter(item => item && item.url !== url);
            list.unshift({
              url: url,
              title: title,
              time: timeString,
              timestamp: now.getTime()
            });

            // 保留最多 90 条历史记录
            if (list.length > 90) {
              list = list.slice(0, 90);
            }

            console.log('[Theater Mode] Watch history saved successfully:', {
              total: list.length,
              latest: list[0]
            });

            chrome.storage.local.set({ history: list }, () => {
              recordedUrlForPage = url;
            });
          } catch (storageError) {
            console.error('[Theater Mode] Failed to process watch history:', storageError);
          }
        });
      }
    } catch (e) {
      console.error('[Theater Mode] Failed to record watch history:', e);
    }
  }

  const px = n => `${n}px`;

  /**
   * 将秒数格式化为 MM:SS 格式
   * @param {number} sec 秒数
   * @returns {string} 格式化后的时间字符串
   */
  function formatSec(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * 生成极简苹果/iOS 风格环状快退与快进 SVG 图标
   * @param {'rewind'|'forward'} type 箭头方向：'rewind' (逆时针环状) | 'forward' (顺时针环状)
   * @param {string} textLabel 中心显示的字样（如 '15', '10s', '1m', '10m'）
   * @returns {string} SVG HTML 字符串
   */
  function createCircularJumpIcon(type, textLabel) {
    const isRewind = type === 'rewind';
    const arrowPath = isRewind
      ? '<path d="M3.5 12a8.5 8.5 0 1 0 8.5-8.5 9.2 9.2 0 0 0-6.4 2.6L3.5 8"/><path d="M3.5 3.5v4.5h4.5"/>'
      : '<path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5 9.2 9.2 0 0 1 6.4 2.6l2.1 1.9"/><path d="M20.5 3.5v4.5h-4.5"/>';

    const fontSize = textLabel.length > 3 ? '6' : textLabel.length > 2 ? '6.8' : '8';

    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="cinema-circular-icon">
      ${arrowPath}
      <text x="12" y="12.6" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="currentColor" stroke="none" font-family="system-ui, -apple-system, sans-serif">${textLabel}</text>
    </svg>`;
  }

  /* ---------- 检测 ---------- */

  function isValidVideo(v) {
    if (!v || !v.isConnected) return false;
    const r = v.getBoundingClientRect();
    const w = r.width || v.offsetWidth || v.videoWidth || 0;
    const h = r.height || v.offsetHeight || v.videoHeight || 0;

    // 1. 尺寸过滤：忽略尺寸过小（小于 200x120）的预览小控件、悬停卡片或小图标视频
    if (w < 200 || h < 120 || w * h < 24000) return false;

    // 2. 视频时长过滤：忽略小于 15 秒的短视频预览、动图替代品或广告片条
    if (!isNaN(v.duration) && v.duration > 0 && v.duration < 15) return false;

    // 3. CSS 隐蔽性过滤
    try {
      const style = window.getComputedStyle(v);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch (e) {
      // 忽略无法获取 style 的异常
    }

    // 4. 预览卡片与广告 DOM 节点过滤 (如 Bilibili 鼠标悬停预览卡片、YouTube 悬停预览、广告 Overlay)
    if (
      v.closest &&
      v.closest(
        '.bili-feed-card, .bili-video-card__cover, .bili-video-card__stats, [data-preview], [data-is-preview], .ytp-ad-module, .ytp-ad-overlay, .ad-showing'
      )
    ) {
      return false;
    }

    const hasSource =
      v.src ||
      v.currentSrc ||
      v.srcObject ||
      v.querySelector('source') ||
      v.readyState > 0 ||
      v.videoWidth > 0;

    return !!hasSource;
  }

  function isPlayingVideo(v) {
    if (!isValidVideo(v)) return false;
    // 只有当视频处于【非暂停状态（正在播放）、未播放结束、且数据就绪】时才判定为有效播放
    return !v.paused && !v.ended && v.readyState >= 2;
  }

  function isActiveVideo(v) {
    if (!isValidVideo(v)) return false;
    return !v.paused || v.currentTime > 0;
  }

  function getVideoLayoutArea(v) {
    if (!v) return 0;
    const r = v.getBoundingClientRect();
    const w = r.width || v.offsetWidth || v.videoWidth || 0;
    const h = r.height || v.offsetHeight || v.videoHeight || 0;
    return w * h;
  }

  function findBestVideo() {
    let best = null;
    let maxArea = 0;
    for (const v of document.querySelectorAll('video')) {
      if (!isValidVideo(v)) continue;
      const area = getVideoLayoutArea(v);
      if (area > maxArea) {
        maxArea = area;
        best = v;
      }
    }
    return best;
  }

  /* ---------- 悬浮按钮 ---------- */

  function ensureButton() {
    if (!btn) {
      btn = document.createElement('div');
      btn.id = BTN_ID;
      btn.className = 'cinema-float-bar';
      btn.innerHTML =
        '<button class="cinema-float-btn" id="cinema-btn-cinema" title="影院模式 (按 ESC 退出)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2.5" y="4" width="19" height="16" rx="3"/>' +
        '<path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/>' +
        '</svg>' +
        '<span>影院</span>' +
        '</button>' +
        '<button class="cinema-float-btn" id="cinema-btn-music" title="音乐模式 (iOS 锁屏美学)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18V5l12-2v13"/>' +
        '<circle cx="6" cy="18" r="3"/>' +
        '<circle cx="18" cy="16" r="3"/>' +
        '</svg>' +
        '<span>音乐</span>' +
        '</button>';

      btn.querySelector('#cinema-btn-cinema').addEventListener('click', e => {
        e.stopPropagation();
        const v = findBestVideo();
        if (v) enterCinema(v);
      });

      btn.querySelector('#cinema-btn-music').addEventListener('click', e => {
        e.stopPropagation();
        const v = findBestVideo();
        if (v) enterMusicMode(v);
      });
    }

    const rootEl = ROOT();
    if (rootEl && (!btn.parentNode || !btn.isConnected)) {
      rootEl.appendChild(btn);
      console.log('[Button] Button created/re-appended to DOM');
    }
  }

  function setButtonVisible(v) {
    if (!btn) return;
    btn.classList.toggle('visible', v);
  }

  /* ---------- 影院模式 ---------- */

  function findPlayerContainer(video) {
    if (!video) return null;

    // 优先匹配 YouTube 核心播放器容器
    const ytPlayer = video.closest('#movie_player');
    if (ytPlayer) return ytPlayer;

    // 优先匹配 Bilibili 核心播放器容器
    const biliPlayer = video.closest('.bpx-player-container') || video.closest('#bilibili-player');
    if (biliPlayer) return biliPlayer;

    const vw = video.getBoundingClientRect().width;
    let el = video;
    for (let i = 0; i < 6; i++) {
      const p = el.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      const pw = p.getBoundingClientRect().width;
      if (pw <= 0 || (vw > 0 && pw > vw * 1.5)) break;
      el = p;
    }
    return el;
  }

  function getVideoAspectRatio(video) {
    if (!video) return 16 / 9;
    if (video.videoWidth && video.videoHeight && video.videoHeight > 0) {
      return video.videoWidth / video.videoHeight;
    }
    if (video.clientWidth && video.clientHeight && video.clientHeight > 0) {
      return video.clientWidth / video.clientHeight;
    }
    const r = video.getBoundingClientRect();
    if (r.width && r.height && r.height > 0) {
      return r.width / r.height;
    }
    return 16 / 9;
  }

  function computeStageWidth(video) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vr = getVideoAspectRatio(video);
    const maxH = Math.max(200, vh - 100);
    return Math.min(vw * 0.94, maxH * 0.94 * vr);
  }

  function enterCinema(video) {
    if (cinema) return;

    recordWatchHistory(video);

    document.documentElement.classList.add('cinema-mode-active');
    document.body.classList.add('cinema-mode-active');

    if (currentSettings.cleanPlayerEnabled) {
      document.documentElement.classList.add('clean-player-active');
      document.body.classList.add('clean-player-active');
    }

    const player = findPlayerContainer(video);
    const saved = {
      parent: player.parentNode,
      next: player.nextSibling,
      playerStyle: player.getAttribute('style'),
      videoStyle: video.getAttribute('style')
    };

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentSettings.overlayOpacity})`;

    stage = document.createElement('div');
    stage.className = 'cinema-stage';

    stage.appendChild(player);

    // 创建快进/回退控制栏与字幕加载按钮
    const controlBar = document.createElement('div');
    controlBar.className = 'cinema-control-bar';

    const buttonsConfig = [
      { label: '10m', type: 'rewind', delta: -600, title: '回退 10 分钟' },
      { label: '1m', type: 'rewind', delta: -60, title: '回退 1 分钟' },
      { label: '10s', type: 'rewind', delta: -10, title: '回退 10 秒' },
      { label: '10s', type: 'forward', delta: 10, title: '快进 10 秒' },
      { label: '1m', type: 'forward', delta: 60, title: '快进 1 分钟' },
      { label: '10m', type: 'forward', delta: 600, title: '快进 10 分钟' }
    ];

    buttonsConfig.forEach(cfg => {
      const b = document.createElement('button');
      b.className = 'cinema-ctrl-btn cinema-icon-btn';
      b.innerHTML = createCircularJumpIcon(cfg.type, cfg.label);
      b.title = cfg.title;
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (video && !isNaN(video.duration)) {
          video.currentTime = Math.min(Math.max(0, video.currentTime + cfg.delta), video.duration);
        }
      });
      controlBar.appendChild(b);
    });

    // 新增：字幕加载按钮（支持 .srt, .vtt, .ass）
    const uploadBtn = document.createElement('label');
    uploadBtn.className = 'cinema-upload-btn';
    uploadBtn.title = '加载本地字幕文件 (.srt, .vtt)';
    uploadBtn.innerHTML = '📂 加载字幕';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.srt,.vtt,.ass';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const content = evt.target.result;
          const cues = SubtitleParser.parse(content, file.name);
          if (subtitleRenderer) {
            subtitleRenderer.setCues(cues);
          }
          const shortName = file.name.length > 8 ? file.name.slice(0, 8) + '...' : file.name;
          uploadBtn.innerHTML = `✅ ${shortName}`;
          uploadBtn.title = `已加载字幕: ${file.name} (${cues.length}条)`;
          showToast(`字幕加载成功：${file.name}`, 'success');
        } catch (err) {
          showToast(`字幕解析失败：${err.message}`, 'error');
          uploadBtn.innerHTML = '📂 加载失败';
        }
      };
      reader.onerror = () => {
        showToast('读取字幕文件失败', 'error');
      };
      reader.readAsText(file, 'utf-8');
    });
    uploadBtn.appendChild(fileInput);
    controlBar.appendChild(uploadBtn);

    // 新增：切换至音乐模式按钮
    const musicModeBtn = document.createElement('button');
    musicModeBtn.className = 'cinema-ctrl-btn';
    musicModeBtn.textContent = '🎵 音乐模式';
    musicModeBtn.title = '切换至 iOS 锁屏美学音乐模式';
    musicModeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = video;
      exitCinema();
      enterMusicMode(v);
    });
    controlBar.appendChild(musicModeBtn);

    // 新增：番茄钟显隐切换按钮
    const pomodoroToggleBtn = document.createElement('button');
    pomodoroToggleBtn.className = 'cinema-ctrl-btn';
    pomodoroToggleBtn.textContent = '🍅 番茄钟';
    pomodoroToggleBtn.title = '切换显示/隐藏番茄钟倒计时';
    pomodoroToggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      currentSettings.pomodoroEnabled = !currentSettings.pomodoroEnabled;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ pomodoroEnabled: currentSettings.pomodoroEnabled });
      }
      updatePomodoroVisibility();
      showToast(currentSettings.pomodoroEnabled ? '🍅 已开启番茄钟' : '🍅 已隐藏番茄钟', 'info');
    });
    controlBar.appendChild(pomodoroToggleBtn);

    const pomodoroBar = createPomodoroBar();

    overlay.appendChild(stage);
    if (pomodoroBar) overlay.appendChild(pomodoroBar);
    overlay.appendChild(controlBar);
    ROOT().appendChild(overlay);

    const updateStageDimensions = () => {
      if (!stage || !player || !video) return;
      const w = computeStageWidth(video);
      const ratio = getVideoAspectRatio(video);
      const h = w / ratio;
      stage.style.setProperty('width', px(w), 'important');
      stage.style.setProperty('height', px(h), 'important');
      stage.style.setProperty('aspect-ratio', `${ratio}`, 'important');

      player.style.setProperty('width', '100%', 'important');
      player.style.setProperty('height', '100%', 'important');

      const innerContainers = player.querySelectorAll(
        '.html5-video-container, .bpx-player-video-area, .bpx-player-primary-area'
      );
      innerContainers.forEach(c => {
        c.style.setProperty('width', '100%', 'important');
        c.style.setProperty('height', '100%', 'important');
      });
    };

    updateStageDimensions();
    video.addEventListener('loadedmetadata', updateStageDimensions);
    video.addEventListener('resize', updateStageDimensions);

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.objectFit = 'contain';

    setTimeout(() => {
      updateStageDimensions();
      window.dispatchEvent(new Event('resize'));
    }, 50);

    // 初始化字幕渲染器模块
    const subtitleRenderer = new SubtitleRenderer(stage, {
      fontSize: currentSettings.subFontSize,
      fontColor: currentSettings.subFontColor,
      bgColor: currentSettings.subBgColor,
      bgOpacity: currentSettings.subBgOpacity,
      fontWeight: currentSettings.subFontWeight,
      bottomOffset: currentSettings.subBottomOffset
    });

    // 网页背景氛围光（Ambilight，优先尝试 BlurHash 算法极佳色彩晕染）
    let ambilightEl = null;
    let ambilightController = null;

    if (currentSettings.ambilightEnabled) {
      ambilightEl = document.createElement('div');
      ambilightEl.className =
        'cinema-ambilight-glow' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
      ambilightEl.style.opacity = currentSettings.ambilightIntensity;

      if (typeof BlurBackgroundController !== 'undefined') {
        ambilightController = new BlurBackgroundController(video, {
          enableBlurHash: currentSettings.blurHashEnabled !== false,
          throttleMs: 150
        });
        ambilightController.mount(ambilightEl);
      }

      stage.appendChild(ambilightEl);
    }

    const hiddenElements = [];
    if (currentSettings.cleanPlayerEnabled !== false) {
      getAllSelectors().forEach(sel => {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach(el => {
          hiddenElements.push({ el, display: el.style.display });
          el.style.setProperty('display', 'none', 'important');
        });
      });
    }

    // 鼠标在播放器区域内移动时同步显示播放控制条，无操作 2.5 秒后自动柔和隐蔽
    let mouseIdleTimer = null;
    const stageRef = stage;

    const showControls = () => {
      if (stageRef) {
        stageRef.classList.add('user-active');
        stageRef.classList.remove('user-idle');
      }
      if (controlBar) {
        controlBar.classList.add('visible');
      }
    };

    const hideControls = () => {
      if (stageRef) {
        stageRef.classList.remove('user-active');
        stageRef.classList.add('user-idle');
      }
      if (controlBar && !controlBar.matches(':hover')) {
        controlBar.classList.remove('visible');
      }
    };

    const handleMouseMove = () => {
      showControls();
      if (mouseIdleTimer) clearTimeout(mouseIdleTimer);
      mouseIdleTimer = setTimeout(() => {
        hideControls();
      }, 2500);
    };

    const handleMouseLeave = () => {
      if (mouseIdleTimer) clearTimeout(mouseIdleTimer);
      hideControls();
    };

    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseenter', handleMouseMove);

    stage.addEventListener('mousemove', handleMouseMove);
    stage.addEventListener('mouseenter', handleMouseMove);
    stage.addEventListener('mouseleave', handleMouseLeave);

    controlBar.addEventListener('mousemove', handleMouseMove);
    controlBar.addEventListener('mouseenter', handleMouseMove);
    controlBar.addEventListener('mouseleave', handleMouseLeave);

    handleMouseMove();

    cinema = {
      video,
      player,
      saved,
      subtitleRenderer,
      ambilightEl,
      ambilightController,
      hiddenElements,
      stageRef,
      handleMouseMove,
      handleMouseLeave,
      mouseIdleTimer,
      updateStageDimensions
    };
    setButtonVisible(false);

    requestAnimationFrame(() => {
      stage.scrollIntoView({ block: 'center', inline: 'center' });
    });
  }

  function exitCinema() {
    if (!cinema) return;
    const {
      video,
      player,
      saved,
      subtitleRenderer,
      ambilightEl,
      ambilightController,
      hiddenElements,
      stageRef,
      handleMouseMove,
      handleMouseLeave,
      mouseIdleTimer,
      updateStageDimensions
    } = cinema;

    if (video && updateStageDimensions) {
      video.removeEventListener('loadedmetadata', updateStageDimensions);
      video.removeEventListener('resize', updateStageDimensions);
    }

    document.documentElement.classList.remove('cinema-mode-active');
    document.body.classList.remove('cinema-mode-active');
    document.documentElement.classList.remove('clean-player-active');
    document.body.classList.remove('clean-player-active');

    if (stageRef && handleMouseMove && handleMouseLeave) {
      stageRef.removeEventListener('mousemove', handleMouseMove);
      stageRef.removeEventListener('mouseenter', handleMouseMove);
      stageRef.removeEventListener('mouseleave', handleMouseLeave);
    }
    if (mouseIdleTimer) {
      clearTimeout(mouseIdleTimer);
    }

    if (hiddenElements) {
      hiddenElements.forEach(({ el, display }) => {
        if (el && el.isConnected) {
          if (display) {
            el.style.display = display;
          } else {
            el.style.removeProperty('display');
          }
        }
      });
    }

    if (subtitleRenderer) {
      subtitleRenderer.destroy();
    }

    if (ambilightController) {
      ambilightController.destroy();
    }
    if (ambilightEl) {
      ambilightEl.remove();
    }

    if (stageRef && player.parentNode === stageRef) {
      stageRef.removeChild(player);
    }
    if (saved.playerStyle != null) {
      player.setAttribute('style', saved.playerStyle);
    } else {
      player.removeAttribute('style');
    }
    if (saved.videoStyle != null) {
      video.setAttribute('style', saved.videoStyle);
    } else {
      video.removeAttribute('style');
    }
    if (saved.parent) {
      if (saved.next && saved.next.parentNode === saved.parent) {
        saved.parent.insertBefore(player, saved.next);
      } else {
        saved.parent.appendChild(player);
      }
    }
    if (overlay) overlay.remove();
    if (pomodoroBarEl) pomodoroBarEl = null;

    overlay = null;
    stage = null;
    cinema = null;
    if (keydownListener) {
      document.removeEventListener('keydown', keydownListener);
      keydownListener = null;
    }
    updateButton();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  /* ---------- 🎵 音乐模式 (iOS 锁屏美学) ---------- */

  function enterMusicMode(video) {
    console.log('[Music Mode] Starting music mode...');
    if (!video) {
      console.error('[Music Mode] No video provided!');
      return;
    }
    if (cinema) exitCinema();
    if (musicCinema) exitMusicMode();

    recordWatchHistory(video);

    document.documentElement.classList.add('music-mode-active');
    document.body.classList.add('music-mode-active');

    if (currentSettings.cleanPlayerEnabled !== false) {
      document.documentElement.classList.add('clean-player-active');
      document.body.classList.add('clean-player-active');
    }

    const player = findPlayerContainer(video);
    if (!player) {
      console.error('[Music Mode] Player container not found!');
    }

    const playerMoved = !currentSettings.musicStaticCoverEnabled;
    const saved = {
      parent: player.parentNode,
      next: player.nextSibling,
      playerStyle: player.getAttribute('style'),
      videoStyle: video.getAttribute('style'),
      playerMoved
    };

    const overlayEl = document.createElement('div');
    overlayEl.id = 'music-mode-overlay';
    console.log('[Music Mode] Overlay element created:', overlayEl);

    // 动态 3D 氛围光背景 (优先尝试 BlurHash 算法极佳色彩晕染)
    const bgBlurEl = document.createElement('div');
    bgBlurEl.className =
      'music-bg-blur' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
    bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
    console.log('[Music Mode] Background blur element created:', bgBlurEl);

    let musicBlurController = null;

    if (typeof BlurBackgroundController !== 'undefined') {
      try {
        musicBlurController = new BlurBackgroundController(video, {
          enableBlurHash: currentSettings.blurHashEnabled !== false,
          isStatic: !!currentSettings.musicStaticCoverEnabled,
          throttleMs: 150
        });
        musicBlurController.mount(bgBlurEl);
        console.log('[Music Mode] Background controller mounted successfully');
      } catch (error) {
        console.error('[Music Mode] Failed to mount background controller:', error);
      }
    } else {
      console.warn('[Music Mode] BlurBackgroundController not available');
    }

    // 锁屏全局框架
    const stageEl = document.createElement('div');
    stageEl.className = 'music-lockscreen-stage';
    stageEl.style.padding = `${currentSettings.musicPadding}px`;
    console.log('[Music Mode] Stage element created');

    // 1. 顶部时间与日期 (iOS 锁屏横向排版 12:12  8月9日 星期日)
    const clockHeader = document.createElement('div');
    clockHeader.className = 'music-clock-header';
    clockHeader.style.marginTop = `${currentSettings.musicClockTopOffset}px`;
    console.log('[Music Mode] Clock header element created');

    const timeText = document.createElement('span');
    timeText.className = 'music-time-text';

    const dateText = document.createElement('span');
    dateText.className = 'music-date-text';

    const updateClock = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      timeText.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const options = { month: 'short', day: 'numeric', weekday: 'short' };
      dateText.textContent = now.toLocaleDateString('zh-CN', options);
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);

    clockHeader.appendChild(timeText);
    clockHeader.appendChild(dateText);

    // 2. 独立专辑封面大卡片 (视频真实宽高比动态自适应，消除黑边)
    const artworkCard = document.createElement('div');
    artworkCard.className = 'music-artwork-card';
    artworkCard.style.width = `${currentSettings.musicCardWidth}px`;
    console.log('[Music Mode] Artwork card element created');

    const updateArtworkAspectRatio = () => {
      if (video) {
        const ar = getVideoAspectRatio(video);
        artworkCard.style.aspectRatio = `${ar}`;
      }
    };
    updateArtworkAspectRatio();
    video.addEventListener('loadedmetadata', updateArtworkAspectRatio);
    video.addEventListener('resize', updateArtworkAspectRatio);

    function mountLivePlayerToCard() {
      if (!player) return;
      if (saved) saved.playerMoved = true;
      player.style.setProperty('width', '100%', 'important');
      player.style.setProperty('height', '100%', 'important');

      if (video) {
        video.style.setProperty('width', '100%', 'important');
        video.style.setProperty('height', '100%', 'important');
        video.style.setProperty('object-fit', 'cover', 'important');
        video.style.setProperty('position', 'absolute', 'important');
        video.style.setProperty('left', '0', 'important');
        video.style.setProperty('top', '0', 'important');
        video.style.setProperty('transform', 'none', 'important');
      }

      const innerContainers = player.querySelectorAll(
        '.html5-video-container, .bpx-player-video-area, .bpx-player-primary-area, .bpx-player-video-wrap, .bpx-player-video-periph'
      );
      innerContainers.forEach(c => {
        c.style.setProperty('width', '100%', 'important');
        c.style.setProperty('height', '100%', 'important');
      });

      artworkCard.appendChild(player);
      console.log('[Music Mode] Live video player mounted to artwork card');
    }

    if (currentSettings.musicStaticCoverEnabled) {
      let isStaticCaptured = false;
      const staticCanvas = document.createElement('canvas');
      staticCanvas.width = video.videoWidth || 1280;
      staticCanvas.height = video.videoHeight || 720;
      const staticCtx = staticCanvas.getContext('2d');
      try {
        if (video.readyState >= 2) {
          staticCtx.drawImage(video, 0, 0, staticCanvas.width, staticCanvas.height);
          isStaticCaptured = true;
        }
      } catch (e) {
        console.error('[Music Mode] Failed to capture static image (CORS/Tainted):', e);
        isStaticCaptured = false;
      }

      if (isStaticCaptured) {
        staticCanvas.style.cssText =
          'width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit;';
        artworkCard.appendChild(staticCanvas);
        console.log('[Music Mode] Static image appended to artwork card');
      } else {
        const metaPoster =
          video.poster ||
          document.querySelector('meta[property="og:image"]')?.content ||
          document.querySelector('meta[name="twitter:image"]')?.content ||
          '';
        if (metaPoster) {
          const img = document.createElement('img');
          img.style.cssText =
            'width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit;';
          img.src = metaPoster;
          artworkCard.appendChild(img);
          console.log('[Music Mode] Poster image appended to artwork card');
        } else {
          // 截图与 Poster 均不可用时，安全退化降级挂载 Live Video Player
          mountLivePlayerToCard();
        }
      }
    } else {
      mountLivePlayerToCard();
    }

    // 3. 独立 iOS 播放控件小面板 (在封面正下方)
    const controlsCard = document.createElement('div');
    controlsCard.className = 'music-controls-card';
    controlsCard.style.width = `${currentSettings.musicCardWidth}px`;
    console.log('[Music Mode] Controls card element created');

    // 头部: 标题与作者信息 + 模式切换小按钮
    const metaBox = document.createElement('div');
    metaBox.className = 'music-meta-box';

    const textGroup = document.createElement('div');
    textGroup.className = 'music-text-group';

    const trackTitle = document.createElement('div');
    trackTitle.className = 'music-track-title';
    const rawTitle = document.title || '未知视频/曲目';
    trackTitle.textContent = rawTitle.replace(/\s*[-_|_—].*$/, '').trim() || rawTitle;

    const trackSub = document.createElement('div');
    trackSub.className = 'music-track-sub';
    trackSub.textContent = window.location.hostname.replace('www.', '');

    textGroup.appendChild(trackTitle);
    textGroup.appendChild(trackSub);

    const modeBtn = document.createElement('button');
    modeBtn.className = 'music-icon-btn mode-switch-icon';
    modeBtn.title = '切换至影院模式';
    modeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/></svg>';
    modeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = video;
      exitMusicMode();
      enterCinema(v);
    });

    metaBox.appendChild(textGroup);
    metaBox.appendChild(modeBtn);

    // 进度条与数字时间
    const progressBox = document.createElement('div');
    progressBox.className = 'music-progress-box';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'music-progress-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';

    const timeLabels = document.createElement('div');
    timeLabels.className = 'music-time-labels';

    const curTimeSpan = document.createElement('span');
    curTimeSpan.textContent = '0:00';

    const durTimeSpan = document.createElement('span');
    durTimeSpan.textContent = '-0:00';

    timeLabels.appendChild(curTimeSpan);
    timeLabels.appendChild(durTimeSpan);
    progressBox.appendChild(slider);
    progressBox.appendChild(timeLabels);

    const updateSliderBg = () => {
      const val = parseFloat(slider.value) || 0;
      slider.style.background = `linear-gradient(to right, #ffffff ${val}%, rgba(255, 255, 255, 0.25) ${val}%)`;
    };

    let isDraggingSlider = false;
    slider.addEventListener('mousedown', () => {
      isDraggingSlider = true;
    });
    slider.addEventListener('mouseup', () => {
      isDraggingSlider = false;
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) {
        v.currentTime = (parseFloat(slider.value) / 100) * v.duration;
      }
      updateSliderBg();
    });
    slider.addEventListener('input', () => {
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) {
        const cur = (parseFloat(slider.value) / 100) * v.duration;
        curTimeSpan.textContent = formatSec(cur);
        durTimeSpan.textContent = `-${formatSec(v.duration - cur)}`;
      }
      updateSliderBg();
    });

    // 纯极简 Icon 控制条 (纯 Icon 无文字，极简苹果风格)
    const ctrlRow = document.createElement('div');
    ctrlRow.className = 'music-ctrl-row';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'music-icon-btn';

    const rewindBtn = document.createElement('button');
    rewindBtn.className = 'music-icon-btn';
    rewindBtn.title = '回退 15 秒';
    rewindBtn.innerHTML = createCircularJumpIcon('rewind', '15');
    rewindBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) v.currentTime = Math.max(0, v.currentTime - 15);
    });

    const playToggleBtn = document.createElement('button');
    playToggleBtn.className = 'music-icon-btn play-main';

    const syncUIStatus = () => {
      const v = musicCinema ? musicCinema.video : video;
      if (!v) return;
      if (!isNaN(v.duration) && v.duration > 0 && !isDraggingSlider) {
        slider.value = (v.currentTime / v.duration) * 100;
        curTimeSpan.textContent = formatSec(v.currentTime);
        durTimeSpan.textContent = `-${formatSec(v.duration - v.currentTime)}`;
        updateSliderBg();
      }

      playToggleBtn.title = v.paused ? '播放' : '暂停';
      playToggleBtn.innerHTML = v.paused
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>';

      muteBtn.title = v.muted ? '取消静音' : '静音';
      muteBtn.innerHTML = v.muted
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    };

    muteBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      if (v) {
        v.muted = !v.muted;
        syncUIStatus();
      }
    });

    playToggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      if (v) {
        if (v.paused) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
        syncUIStatus();
      }
    });

    const syncProgressTimer = setInterval(syncUIStatus, 300);
    syncUIStatus();

    const forwardBtn = document.createElement('button');
    forwardBtn.className = 'music-icon-btn';
    forwardBtn.title = '快进 15 秒';
    forwardBtn.innerHTML = createCircularJumpIcon('forward', '15');
    forwardBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) v.currentTime = Math.min(v.duration, v.currentTime + 15);
    });

    const subBtn = document.createElement('button');
    subBtn.className = 'music-icon-btn';
    subBtn.title = '加载本地字幕';
    subBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 4H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>';
    const subFileInput = document.createElement('input');
    subFileInput.type = 'file';
    subFileInput.accept = '.srt,.vtt,.ass';
    subFileInput.style.display = 'none';
    subFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const content = evt.target.result;
          SubtitleParser.parse(content, file.name);
          showToast(`字幕加载成功`, 'success');
        } catch (err) {
          showToast(`字幕解析失败：${err.message}`, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    });
    subBtn.addEventListener('click', e => {
      e.stopPropagation();
      subFileInput.click();
    });
    subBtn.appendChild(subFileInput);

    ctrlRow.appendChild(muteBtn);
    ctrlRow.appendChild(rewindBtn);
    ctrlRow.appendChild(playToggleBtn);
    ctrlRow.appendChild(forwardBtn);
    ctrlRow.appendChild(subBtn);

    controlsCard.appendChild(metaBox);
    controlsCard.appendChild(progressBox);
    controlsCard.appendChild(ctrlRow);

    const pomodoroBar = createPomodoroBar();
    if (pomodoroBar) {
      pomodoroBar.style.setProperty('width', `${currentSettings.musicCardWidth}px`, 'important');
    }

    stageEl.appendChild(clockHeader);
    stageEl.appendChild(artworkCard);
    if (pomodoroBar) stageEl.appendChild(pomodoroBar);
    stageEl.appendChild(controlsCard);
    console.log('[Music Mode] All stage elements added');

    overlayEl.appendChild(bgBlurEl);
    overlayEl.appendChild(stageEl);

    // 右下角悬浮番茄钟开关按钮
    const musicPomodoroFab = document.createElement('button');
    musicPomodoroFab.className = 'music-pomodoro-fab';
    musicPomodoroFab.title = '切换显示/隐藏番茄钟倒计时';
    musicPomodoroFab.innerHTML = '🍅 <span class="fab-label">番茄钟</span>';
    musicPomodoroFab.addEventListener('click', e => {
      e.stopPropagation();
      currentSettings.pomodoroEnabled = !currentSettings.pomodoroEnabled;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ pomodoroEnabled: currentSettings.pomodoroEnabled });
      }
      updatePomodoroVisibility();
      showToast(currentSettings.pomodoroEnabled ? '🍅 已开启番茄钟' : '🍅 已隐藏番茄钟', 'info');
    });
    overlayEl.appendChild(musicPomodoroFab);

    console.log('[Music Mode] All elements appended to overlay');

    // 鼠标在页面/封面卡片上划过与无操作 2.5s 自动柔和隐藏播放器内置控件与番茄钟
    let musicMouseIdleTimer = null;
    const showMusicControls = () => {
      overlayEl.classList.add('user-active');
      overlayEl.classList.remove('user-idle');
      stageEl.classList.add('user-active');
      stageEl.classList.remove('user-idle');
      artworkCard.classList.add('user-active');
      artworkCard.classList.remove('user-idle');
    };
    const hideMusicControls = () => {
      overlayEl.classList.remove('user-active');
      overlayEl.classList.add('user-idle');
      stageEl.classList.remove('user-active');
      stageEl.classList.add('user-idle');
      artworkCard.classList.remove('user-active');
      artworkCard.classList.add('user-idle');
    };
    const handleMusicMouseMove = () => {
      showMusicControls();
      if (musicMouseIdleTimer) clearTimeout(musicMouseIdleTimer);
      musicMouseIdleTimer = setTimeout(() => {
        hideMusicControls();
      }, 2500);
    };
    const handleMusicMouseLeave = () => {
      if (musicMouseIdleTimer) clearTimeout(musicMouseIdleTimer);
      hideMusicControls();
    };

    musicCinema = {
      video,
      player,
      saved,
      overlayEl,
      stageEl,
      artworkCard,
      controlsCard,
      pomodoroBar,
      clockHeader,
      bgBlurEl,
      musicBlurController,
      clockTimer,
      syncProgressTimer,
      musicMouseIdleTimer,
      handleMusicMouseMove,
      handleMusicMouseLeave,
      updateArtworkAspectRatio
    };

    try {
      updateMusicModeSettings();
    } catch (error) {
      console.error('[Music Mode] Failed to update settings:', error);
    }

    ROOT().appendChild(overlayEl);
    console.log('[Music Mode] Overlay appended to DOM');
    console.log('[Music Mode] Music mode initialization complete');

    overlayEl.addEventListener('mousemove', handleMusicMouseMove);
    overlayEl.addEventListener('mouseenter', handleMusicMouseMove);
    overlayEl.addEventListener('mouseleave', handleMusicMouseLeave);

    artworkCard.addEventListener('mousemove', handleMusicMouseMove);
    artworkCard.addEventListener('mouseenter', handleMusicMouseMove);
    artworkCard.addEventListener('mouseleave', handleMusicMouseLeave);

    handleMusicMouseMove();
    setButtonVisible(false);
  }

  function exitMusicMode() {
    if (!musicCinema) return;
    const {
      video,
      player,
      saved,
      overlayEl,
      artworkCard,
      musicBlurController,
      clockTimer,
      syncProgressTimer,
      musicMouseIdleTimer,
      handleMusicMouseMove,
      handleMusicMouseLeave,
      updateArtworkAspectRatio
    } = musicCinema;

    document.documentElement.classList.remove('music-mode-active');
    document.body.classList.remove('music-mode-active');
    document.documentElement.classList.remove('clean-player-active');
    document.body.classList.remove('clean-player-active');

    if (musicBlurController) {
      musicBlurController.destroy();
    }

    if (video && updateArtworkAspectRatio) {
      video.removeEventListener('loadedmetadata', updateArtworkAspectRatio);
      video.removeEventListener('resize', updateArtworkAspectRatio);
    }

    if (overlayEl && handleMusicMouseMove && handleMusicMouseLeave) {
      overlayEl.removeEventListener('mousemove', handleMusicMouseMove);
      overlayEl.removeEventListener('mouseenter', handleMusicMouseMove);
      overlayEl.removeEventListener('mouseleave', handleMusicMouseLeave);
    }

    if (artworkCard && handleMusicMouseMove && handleMusicMouseLeave) {
      artworkCard.removeEventListener('mousemove', handleMusicMouseMove);
      artworkCard.removeEventListener('mouseenter', handleMusicMouseMove);
      artworkCard.removeEventListener('mouseleave', handleMusicMouseLeave);
    }
    if (musicMouseIdleTimer) clearTimeout(musicMouseIdleTimer);

    if (clockTimer) clearInterval(clockTimer);
    if (syncProgressTimer) clearInterval(syncProgressTimer);

    const isPlayerMoved =
      saved &&
      (saved.playerMoved || (player && player.parentNode && player.parentNode !== saved.parent));
    if (isPlayerMoved && player && saved) {
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
      if (saved.playerStyle != null) {
        player.setAttribute('style', saved.playerStyle);
      } else {
        player.removeAttribute('style');
      }
      if (saved.videoStyle != null) {
        video.setAttribute('style', saved.videoStyle);
      } else {
        video.removeAttribute('style');
      }
      if (saved.parent) {
        if (saved.next && saved.next.parentNode === saved.parent) {
          saved.parent.insertBefore(player, saved.next);
        } else {
          saved.parent.appendChild(player);
        }
      }
    }

    if (overlayEl) overlayEl.remove();
    if (pomodoroBarEl) pomodoroBarEl = null;

    musicCinema = null;
    console.log('[Exit Music Mode] musicCinema set to null');
    updateMusicModeSettings();
    if (keydownListener) {
      document.removeEventListener('keydown', keydownListener);
      keydownListener = null;
    }
    // 延迟调用 updateButton，确保视频状态已更新
    setTimeout(() => {
      console.log('[Exit Music Mode] Calling updateButton() with delay');
      updateButton();
    }, 100);
  }

  /* ---------- 状态刷新与自愈恢复 ---------- */

  function updateButton() {
    if (cinema || musicCinema) {
      setButtonVisible(false);
      return;
    }
    const best = findBestVideo();
    // 仅当找到有效主视频，且该视频正处于【播放状态】时，才显示悬浮按钮
    if (best && isPlayingVideo(best)) {
      ensureButton();
      setButtonVisible(true);
    } else {
      setButtonVisible(false);
    }
  }

  /**
   * 自动修复重连：当播放器/视频节点离线或受切页影响时，尝试在 DOM 中寻获新节点并无感重连
   * @param {Object} session 当前影院模式/音乐模式会话
   * @param {string} type 'cinema' | 'music'
   * @returns {boolean} 是否重连成功
   */
  function tryRebindSession(session, type) {
    if (!session) return false;
    const newVideo = findBestVideo();
    if (!newVideo || !isValidVideo(newVideo)) {
      return false;
    }

    const newPlayer = findPlayerContainer(newVideo);
    if (!newPlayer) return false;

    console.log(`[Self-Healing] Re-binding ${type} session to new video element:`, newVideo);

    session.video = newVideo;
    session.player = newPlayer;

    if (type === 'cinema') {
      if (session.ambilightController) {
        session.ambilightController.rebindVideo(newVideo);
      }
      if (session.updateStageDimensions) {
        newVideo.addEventListener('loadedmetadata', session.updateStageDimensions);
        newVideo.addEventListener('resize', session.updateStageDimensions);
        session.updateStageDimensions();
      }
      newVideo.style.width = '100%';
      newVideo.style.height = '100%';
      newVideo.style.maxWidth = '100%';
      newVideo.style.maxHeight = '100%';
      newVideo.style.objectFit = 'contain';

      if (session.stageRef && newPlayer.parentNode !== session.stageRef) {
        session.stageRef.appendChild(newPlayer);
      }
    } else if (type === 'music') {
      if (session.musicBlurController) {
        session.musicBlurController.rebindVideo(newVideo);
      }
      if (session.updateArtworkAspectRatio) {
        newVideo.addEventListener('loadedmetadata', session.updateArtworkAspectRatio);
        newVideo.addEventListener('resize', session.updateArtworkAspectRatio);
        session.updateArtworkAspectRatio();
      }
      if (!currentSettings.musicStaticCoverEnabled && session.artworkCard) {
        newPlayer.style.setProperty('width', '100%', 'important');
        newPlayer.style.setProperty('height', '100%', 'important');
        newVideo.style.setProperty('width', '100%', 'important');
        newVideo.style.setProperty('height', '100%', 'important');
        newVideo.style.setProperty('object-fit', 'cover', 'important');
        newVideo.style.setProperty('position', 'absolute', 'important');
        newVideo.style.setProperty('left', '0', 'important');
        newVideo.style.setProperty('top', '0', 'important');
        newVideo.style.setProperty('transform', 'none', 'important');
        if (newPlayer.parentNode !== session.artworkCard) {
          session.artworkCard.appendChild(newPlayer);
        }
      }
      if (session.controlsCard) {
        const titleEl = session.controlsCard.querySelector('.music-track-title');
        if (titleEl) {
          const rawTitle = document.title || '未知视频/曲目';
          titleEl.textContent = rawTitle.replace(/\s*[-_|_—].*$/, '').trim() || rawTitle;
        }
      }
    }

    session.disconnectCount = 0;
    showToast('播放器恢复自愈连接', 'success');
    return true;
  }

  function checkAndHealSession() {
    // 当 Chrome 标签页处于后台隐藏状态时，挂起断开剔除逻辑，防止误关
    if (document.hidden) return;

    if (cinema) {
      const isConnected =
        cinema.video && cinema.video.isConnected && cinema.player && cinema.player.isConnected;
      if (!isConnected) {
        const ok = tryRebindSession(cinema, 'cinema');
        if (!ok) {
          cinema.disconnectCount = (cinema.disconnectCount || 0) + 1;
          if (cinema.disconnectCount >= 3) {
            console.warn('[Self-Healing] Cinema video lost for 3 checks while visible. Exiting...');
            exitCinema();
          }
        }
      } else {
        cinema.disconnectCount = 0;
      }
    }

    if (musicCinema) {
      const isConnected =
        musicCinema.video &&
        musicCinema.video.isConnected &&
        musicCinema.player &&
        musicCinema.player.isConnected;
      if (!isConnected) {
        const ok = tryRebindSession(musicCinema, 'music');
        if (!ok) {
          musicCinema.disconnectCount = (musicCinema.disconnectCount || 0) + 1;
          if (musicCinema.disconnectCount >= 3) {
            console.warn('[Self-Healing] Music video lost for 3 checks while visible. Exiting...');
            exitMusicMode();
          }
        }
      } else {
        musicCinema.disconnectCount = 0;
      }
    }
  }

  setInterval(() => {
    const activeVideo = cinema ? cinema.video : musicCinema ? musicCinema.video : findBestVideo();
    if (activeVideo && isActiveVideo(activeVideo)) {
      recordWatchHistory(activeVideo);
    }

    if (cinema) {
      checkAndHealSession();
      if (cinema) {
        if (cinema.subtitleRenderer && cinema.video && !cinema.video.paused) {
          cinema.subtitleRenderer.syncTime(cinema.video.currentTime);
        }
        if (currentSettings.cleanPlayerEnabled !== false) {
          getAllSelectors().forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              if (el.style.display !== 'none') {
                if (cinema.hiddenElements && !cinema.hiddenElements.some(item => item.el === el)) {
                  cinema.hiddenElements.push({ el, display: el.style.display });
                }
                el.style.setProperty('display', 'none', 'important');
              }
            });
          });
        }
      }
      return;
    }
    if (musicCinema) {
      checkAndHealSession();
      return;
    }
    updateButton();
  }, 500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('[Theater Mode] Tab regained visibility. Running self-healing checks...');
      setTimeout(checkAndHealSession, 150);
      setTimeout(checkAndHealSession, 600);
      setTimeout(checkAndHealSession, 1200);
    }
  });

  window.addEventListener('focus', () => {
    if (!document.hidden) {
      setTimeout(checkAndHealSession, 200);
    }
  });

  document.addEventListener(
    'play',
    () => {
      updateButton();
      const best = findBestVideo();
      if (best && isActiveVideo(best)) {
        recordWatchHistory(best);
      }
    },
    true
  );
  document.addEventListener('playing', () => updateButton(), true);
  document.addEventListener('pause', () => updateButton(), true);
  document.addEventListener('ended', () => updateButton(), true);

  keydownListener = e => {
    if (!cinema && !musicCinema) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cinema) exitCinema();
      if (musicCinema) exitMusicMode();
      return;
    }
    // 忽略在输入框中的按键
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (document.activeElement && document.activeElement.isContentEditable)
    )
      return;

    const key = e.key.toLowerCase();
    const activeSession = cinema || musicCinema;
    const v = activeSession.video;
    if (!v || isNaN(v.duration)) return;

    const jKey = (currentSettings.jKey || 'j').toLowerCase();
    const lKey = (currentSettings.lKey || 'l').toLowerCase();

    if (key === jKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      v.currentTime = Math.max(0, v.currentTime - currentSettings.jDuration);
    } else if (key === lKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      v.currentTime = Math.min(v.duration, v.currentTime + currentSettings.lDuration);
    }
  };

  document.addEventListener('keydown', keydownListener, true);

  window.addEventListener('resize', () => {
    if (cinema && cinema.updateStageDimensions) {
      cinema.updateStageDimensions();
    }
  });

  ensureButton();
  updateButton();
})();
