(() => {
  'use strict';

  const BTN_ID = 'cinema-mode-toggle-btn';
  const OVERLAY_ID = 'cinema-mode-overlay';
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
    musicCardWidth: 600,
    musicPadding: 40,
    musicBlurRadius: 65,
    musicStaticCoverEnabled: false,
    pomodoroEnabled: false,
    pomodoroWorkDuration: 45,
    pomodoroBreakDuration: 10
  };

  function cleanPageTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '未知视频/曲目';
    if (typeof MusicMetadataParser !== 'undefined' && MusicMetadataParser.stripNoise) {
      const stripped = MusicMetadataParser.stripNoise(rawTitle);
      if (stripped) return stripped;
    }
    let title = rawTitle.trim();
    title = title.replace(
      /^\s*(?:[([（][^)）]{0,16}(?:消息|播放|暂停|缓冲)[^)）]{0,6}[)）\]]|(?:\(|\[|（)\s*\d+\+?\s*(?:\)|\]|）)|[▶⏸⏯])\s*/gi,
      ''
    );
    // 精准剥离常见视频网站的固定后缀（保留原标题中所有曲名、歌手、分集、标签、横杠等）
    // B站: _哔哩哔哩_bilibili, _哔哩哔哩, -哔哩哔哩, _bilibili
    title = title.replace(/\s*([_—\-–]\s*)?(哔哩哔哩(_bilibili)?|bilibili)\s*$/i, '');
    // YouTube: - YouTube
    title = title.replace(/\s*([_—\-–]\s*)?YouTube\s*$/i, '');
    // 优酷: -电视剧-高清正版视频在线观看-优酷, _优酷视频, -优酷
    title = title.replace(/\s*([_—\-–]\s*)?(优酷(视频)?|YOUKU)(\s*.*)?$/i, '');
    // 爱奇艺: -高清正版视频在线观看-爱奇艺, _爱奇艺
    title = title.replace(/\s*([_—\-–]\s*)?爱奇艺(\s*.*)?$/i, '');
    // 腾讯视频: _腾讯视频, -腾讯视频
    title = title.replace(/\s*([_—\-–]\s*)?腾讯视频(\s*.*)?$/i, '');
    // 芒果TV: _芒果TV, -芒果TV
    title = title.replace(/\s*([_—\-–]\s*)?(芒果TV|mgtv)\s*$/i, '');
    // 抖音 / 西瓜 / 快手
    title = title.replace(/\s*([_—\-–]\s*)?(抖音|西瓜视频|快手)\s*$/i, '');

    title = title.trim();
    return title || rawTitle.trim() || '未知视频/曲目';
  }

  function updateMusicModeSettings() {
    if (musicCinema && musicCinema.stageEl) {
      musicCinema.stageEl.style.padding = `${currentSettings.musicPadding}px`;
    }
    if (musicCinema && musicCinema.bgBlurEl) {
      musicCinema.bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
    }
    if (musicCinema && musicCinema.columnEl) {
      musicCinema.columnEl.style.width = `${currentSettings.musicCardWidth}px`;
    }
    if (musicCinema && musicCinema.pomodoroBar) {
      musicCinema.pomodoroBar.style.setProperty('width', '100%', 'important');
    }
    if (pomodoroBarEl && document.body.classList.contains('music-mode-active')) {
      pomodoroBarEl.style.setProperty('width', '100%', 'important');
    }
    if (musicCinema && musicCinema.musicBlurController) {
      musicCinema.musicBlurController.updateOptions({
        isStatic: !!currentSettings.musicStaticCoverEnabled
      });
    }
    if (musicCinema && musicCinema.radiosityController) {
      musicCinema.radiosityController.updateOptions({
        isStatic: !!currentSettings.musicStaticCoverEnabled
      });
    }
    if (musicCinema && musicCinema.updateTitleMarquee) {
      musicCinema.updateTitleMarquee();
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentSettings, items => {
      currentSettings = Object.assign({}, currentSettings, items);
      currentSettings.musicCardWidth = parseInt(items.musicCardWidth, 10) || 600;
      currentSettings.musicPadding = parseInt(items.musicPadding, 10) || 40;
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
    const applySettingsUpdate = newSettings => {
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
        if (musicCinema && musicCinema.radiosityController) {
          musicCinema.radiosityController.updateOptions({
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
    };

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
  // 🍅 番茄钟 (Pomodoro Timer) 基于 Date.now() 真实物理时间戳与跨标签页同步
  // ==========================================================================
  let pomodoroTimerId = null;
  let pomodoroBarEl = null;
  const pomodoroState = {
    mode: 'work', // 'work' 或 'break'
    timeLeft: 45 * 60, // 当前剩余秒数
    targetEndTime: null, // 倒计时到达的目标 Date.now() 毫秒时间戳
    isRunning: false
  };

  function savePomodoroStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pomodoroRuntimeState: {
          mode: pomodoroState.mode,
          timeLeft: pomodoroState.timeLeft,
          targetEndTime: pomodoroState.targetEndTime,
          isRunning: pomodoroState.isRunning,
          updatedAt: Date.now()
        }
      });
    }
  }

  function loadPomodoroStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pomodoroRuntimeState'], items => {
        if (items && items.pomodoroRuntimeState) {
          const s = items.pomodoroRuntimeState;
          pomodoroState.mode = s.mode || 'work';
          pomodoroState.isRunning = !!s.isRunning;
          pomodoroState.targetEndTime = s.targetEndTime || null;

          if (pomodoroState.isRunning && pomodoroState.targetEndTime) {
            const now = Date.now();
            const remSec = Math.max(0, Math.ceil((pomodoroState.targetEndTime - now) / 1000));
            pomodoroState.timeLeft = remSec;
            startPomodoroTimer(false); // 恢复定时器但不覆盖 targetEndTime
          } else {
            pomodoroState.timeLeft = typeof s.timeLeft === 'number' ? s.timeLeft : 45 * 60;
            updatePomodoroUI();
          }
        }
      });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.pomodoroRuntimeState) {
        const s = changes.pomodoroRuntimeState.newValue;
        if (!s) return;
        pomodoroState.mode = s.mode || 'work';
        pomodoroState.isRunning = !!s.isRunning;
        pomodoroState.targetEndTime = s.targetEndTime || null;

        if (pomodoroState.isRunning && pomodoroState.targetEndTime) {
          const now = Date.now();
          pomodoroState.timeLeft = Math.max(
            0,
            Math.ceil((pomodoroState.targetEndTime - now) / 1000)
          );
          if (!pomodoroTimerId) {
            startPomodoroTimer(false);
          } else {
            updatePomodoroUI();
          }
        } else {
          if (pomodoroTimerId) {
            clearInterval(pomodoroTimerId);
            pomodoroTimerId = null;
          }
          pomodoroState.timeLeft = typeof s.timeLeft === 'number' ? s.timeLeft : 45 * 60;
          updatePomodoroUI();
        }
      }
    });
  }

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
      // 忽略 Web Audio 阻断
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

  function tickPomodoro() {
    if (!pomodoroState.isRunning || !pomodoroState.targetEndTime) return;

    const now = Date.now();
    const remSec = Math.max(0, Math.ceil((pomodoroState.targetEndTime - now) / 1000));

    if (remSec > 0) {
      pomodoroState.timeLeft = remSec;
      updatePomodoroUI();
    } else {
      const workM = currentSettings.pomodoroWorkDuration || 45;
      const breakM = currentSettings.pomodoroBreakDuration || 10;
      if (pomodoroState.mode === 'work') {
        pomodoroState.mode = 'break';
        pomodoroState.timeLeft = breakM * 60;
        pomodoroState.targetEndTime = Date.now() + pomodoroState.timeLeft * 1000;
        showToast(`🍅 ${workM} 分钟专注完成！休息 ${breakM} 分钟时间到 ~`, 'success');
        playPomodoroChime('work');
      } else {
        pomodoroState.mode = 'work';
        pomodoroState.timeLeft = workM * 60;
        pomodoroState.targetEndTime = Date.now() + pomodoroState.timeLeft * 1000;
        showToast(`☕ ${breakM} 分钟休息结束！开始新的 ${workM} 分钟专注 ~`, 'info');
        playPomodoroChime('break');
      }
      savePomodoroStorage();
      updatePomodoroUI();
    }
  }

  function startPomodoroTimer(setNewTarget = true) {
    if (pomodoroTimerId) clearInterval(pomodoroTimerId);
    pomodoroState.isRunning = true;

    if (setNewTarget || !pomodoroState.targetEndTime) {
      pomodoroState.targetEndTime = Date.now() + pomodoroState.timeLeft * 1000;
      savePomodoroStorage();
    }

    tickPomodoro();
    pomodoroTimerId = setInterval(tickPomodoro, 1000);
  }

  function pausePomodoroTimer() {
    if (pomodoroTimerId) {
      clearInterval(pomodoroTimerId);
      pomodoroTimerId = null;
    }
    if (pomodoroState.isRunning && pomodoroState.targetEndTime) {
      pomodoroState.timeLeft = Math.max(
        0,
        Math.ceil((pomodoroState.targetEndTime - Date.now()) / 1000)
      );
    }
    pomodoroState.targetEndTime = null;
    pomodoroState.isRunning = false;
    savePomodoroStorage();
    updatePomodoroUI();
  }

  function togglePomodoroTimer() {
    if (pomodoroState.isRunning) {
      pausePomodoroTimer();
    } else {
      startPomodoroTimer(true);
    }
  }

  function resetPomodoroTimer() {
    if (pomodoroTimerId) {
      clearInterval(pomodoroTimerId);
      pomodoroTimerId = null;
    }
    pomodoroState.isRunning = false;
    pomodoroState.targetEndTime = null;
    const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
    const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
    pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
    savePomodoroStorage();
    updatePomodoroUI();
  }

  function switchPomodoroMode(newMode) {
    if (pomodoroTimerId) {
      clearInterval(pomodoroTimerId);
      pomodoroTimerId = null;
    }
    pomodoroState.isRunning = false;
    pomodoroState.targetEndTime = null;
    pomodoroState.mode = newMode || (pomodoroState.mode === 'work' ? 'break' : 'work');
    const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
    const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
    pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
    savePomodoroStorage();
    updatePomodoroUI();
  }

  function updatePomodoroTimeFromSettings() {
    if (!pomodoroState.isRunning) {
      const workSec = (currentSettings.pomodoroWorkDuration || 45) * 60;
      const breakSec = (currentSettings.pomodoroBreakDuration || 10) * 60;
      pomodoroState.timeLeft = pomodoroState.mode === 'work' ? workSec : breakSec;
      pomodoroState.targetEndTime = null;
      savePomodoroStorage();
    }
    updatePomodoroUI();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pomodoroState.isRunning) {
      const now = Date.now();
      const remSec = Math.max(0, Math.ceil((pomodoroState.targetEndTime - now) / 1000));
      pomodoroState.timeLeft = remSec;
      if (!pomodoroTimerId) {
        startPomodoroTimer(false);
      }
    }
  });

  window.addEventListener('focus', () => {
    if (pomodoroState.isRunning) {
      const now = Date.now();
      const remSec = Math.max(0, Math.ceil((pomodoroState.targetEndTime - now) / 1000));
      pomodoroState.timeLeft = remSec;
      if (!pomodoroTimerId) {
        startPomodoroTimer(false);
      }
    }
  });

  loadPomodoroStorage();

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

  const trackedMediaElements = new Set();

  function registerActiveMedia(el) {
    if (el && (el.tagName === 'VIDEO' || el.tagName === 'AUDIO')) {
      trackedMediaElements.add(el);
      updateButton();
    }
  }

  // 在 window 和 document 捕获阶段监听全局媒体事件（可捕获 new Audio() 及任何动态音频）
  ['play', 'playing', 'timeupdate'].forEach(evt => {
    window.addEventListener(evt, e => registerActiveMedia(e.target), true);
    document.addEventListener(evt, e => registerActiveMedia(e.target), true);
    try {
      if (window.top && window.top !== window) {
        window.top.addEventListener(evt, e => registerActiveMedia(e.target), true);
      }
    } catch (e) {
      // 忽略跨域访问异常
    }
  });

  function getNeteasePlaybar() {
    return (
      document.querySelector('.m-playbar, .g-btmbar, #g_player') ||
      (typeof window !== 'undefined' && window.top && window.top !== window && window.top.document
        ? window.top.document.querySelector('.m-playbar, .g-btmbar, #g_player')
        : null)
    );
  }

  function isNeteasePlaying() {
    const playbar = getNeteasePlaybar();
    if (!playbar) return false;
    const isPas = !!playbar.querySelector(
      '.ply.pas, a.pas, [data-action="pause"], [title*="暂停"], [aria-label*="暂停"]'
    );
    const curTime = playbar.querySelector('.time em')?.textContent?.trim() || '';
    const hasCurTime = curTime && curTime !== '00:00';
    return isPas || !!hasCurTime;
  }

  function createNeteaseAudioProxy(playbar) {
    const proxy = {
      tagName: 'AUDIO',
      isProxy: true,
      playbar,
      get paused() {
        return !playbar.querySelector('.ply.pas, a.pas, [data-action="pause"]');
      },
      get ended() {
        return false;
      },
      get readyState() {
        return 4;
      },
      get duration() {
        const timeEl = playbar.querySelector('.time');
        const text = timeEl ? timeEl.textContent || '' : '';
        const match = text.match(/\/\s*(\d{1,2}):(\d{2})/);
        if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        return 240;
      },
      get currentTime() {
        const curEl = playbar.querySelector('.time em');
        const text = curEl ? curEl.textContent || '' : '';
        const match = text.match(/(\d{1,2}):(\d{2})/);
        if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        return 0;
      },
      set currentTime(val) {
        const bar = playbar.querySelector('.m-pbar .barbg, .m-pbar, .cur');
        if (bar && this.duration > 0) {
          const rect = bar.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, val / this.duration));
          const clientX = rect.left + rect.width * ratio;
          bar.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX }));
        }
      },
      play() {
        const btnEl = playbar.querySelector('.ply, [data-action="play"]');
        if (btnEl && this.paused) btnEl.click();
        return Promise.resolve();
      },
      pause() {
        const btnEl = playbar.querySelector('.ply.pas, a.pas, [data-action="pause"]');
        if (btnEl && !this.paused) btnEl.click();
      },
      addEventListener(evt, fn) {
        this._listeners = this._listeners || {};
        this._listeners[evt] = this._listeners[evt] || [];
        this._listeners[evt].push(fn);
      },
      removeEventListener(evt, fn) {
        if (!this._listeners || !this._listeners[evt]) return;
        this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
      },
      dispatchEvent(evt) {
        if (!this._listeners || !this._listeners[evt.type]) return true;
        this._listeners[evt.type].forEach(fn => fn(evt));
        return true;
      }
    };

    setInterval(() => {
      if (proxy._listeners && proxy._listeners.timeupdate && !proxy.paused) {
        proxy.dispatchEvent(new Event('timeupdate'));
      }
    }, 250);

    return proxy;
  }

  function isValidAudio(a) {
    if (!a) return false;
    if (a.isProxy) return true;
    if (!isNaN(a.duration) && a.duration > 0 && a.duration < 3) return false;
    const hasSource =
      a.src ||
      a.currentSrc ||
      a.srcObject ||
      (a.querySelector && a.querySelector('source')) ||
      a.readyState > 0 ||
      !a.paused ||
      a.currentTime > 0;
    return !!hasSource;
  }

  function isPlayingAudio(a) {
    if (!a) return false;
    if (a.isProxy) return !a.paused;
    if (!isValidAudio(a)) return false;
    return !a.paused && !a.ended;
  }

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
    if (!v) return false;
    if (v.isProxy || (v.tagName && v.tagName.toLowerCase() === 'audio')) {
      return isPlayingAudio(v);
    }
    if (!isValidVideo(v)) return false;
    // 只有当视频处于【非暂停状态（正在播放）、未播放结束、且数据就绪】时才判定为有效播放
    return !v.paused && !v.ended && v.readyState >= 2;
  }

  function isActiveVideo(v) {
    if (!v) return false;
    if (v.isProxy || (v.tagName && v.tagName.toLowerCase() === 'audio')) {
      return isValidAudio(v) && (!v.paused || v.currentTime > 0);
    }
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
    // 1. 优先查找当前文档的有效视频节点
    let bestVideo = null;
    let maxArea = 0;
    for (const v of document.querySelectorAll('video')) {
      if (!isValidVideo(v)) continue;
      const area = getVideoLayoutArea(v);
      if (area > maxArea) {
        maxArea = area;
        bestVideo = v;
      }
    }
    if (bestVideo) return bestVideo;

    // 2. 检查全局捕获的活跃音视频实例 (支持 new Audio() 及无 DOM 挂载音频)
    for (const el of trackedMediaElements) {
      if (el && el.tagName === 'AUDIO' && isPlayingAudio(el)) {
        return el;
      }
    }
    for (const el of trackedMediaElements) {
      if (el && el.tagName === 'AUDIO' && isValidAudio(el)) {
        return el;
      }
    }

    // 3. 遍历当前 DOM 与父级/顶层窗口中的 audio 元素
    const audioNodes = [
      ...Array.from(document.querySelectorAll('audio')),
      ...(typeof window !== 'undefined' &&
      window.top &&
      window.top !== window &&
      window.top.document
        ? Array.from(window.top.document.querySelectorAll('audio'))
        : [])
    ];
    for (const a of audioNodes) {
      if (isPlayingAudio(a)) return a;
    }
    for (const a of audioNodes) {
      if (isValidAudio(a)) return a;
    }

    // 4. 网易云音乐平台专属：若底部播放栏正处于播放态，构建桥接代理对象
    if (isNeteasePlaying()) {
      const playbar = getNeteasePlaybar();
      if (playbar) {
        const directAudio = playbar.querySelector('audio') || document.querySelector('audio');
        if (directAudio) return directAudio;
        if (!window._neteaseAudioProxy) {
          window._neteaseAudioProxy = createNeteaseAudioProxy(playbar);
        }
        return window._neteaseAudioProxy;
      }
    }

    return null;
  }

  /* ---------- 悬浮按钮 ---------- */

  function ensureButton() {
    const isMusicSite =
      typeof location !== 'undefined' &&
      location.hostname &&
      (location.hostname.includes('music.163.com') ||
        location.hostname.includes('163.com') ||
        location.hostname.includes('y.qq.com') ||
        location.hostname.includes('kugou.com') ||
        location.hostname.includes('kuwo.cn'));

    const targetDoc =
      typeof window !== 'undefined' &&
      window.top &&
      window.top !== window &&
      window.top.document &&
      window.top.document.body
        ? window.top.document
        : document;
    const rootEl = targetDoc.body || targetDoc.documentElement;

    if (!btn || btn.ownerDocument !== targetDoc) {
      btn = targetDoc.createElement('div');
      btn.id = BTN_ID;
      btn.className = 'cinema-float-bar';
      if (isMusicSite) {
        btn.classList.add('is-music-site');
      }
      btn.innerHTML =
        '<button class="cinema-float-btn" id="cinema-btn-cinema" title="影院模式 (按 ESC 退出)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2.5" y="4" width="19" height="16" rx="3"/>' +
        '<path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/>' +
        '</svg>' +
        '<span>影院</span>' +
        '</button>' +
        '<button class="cinema-float-btn" id="cinema-btn-music" title="音乐模式 (Apple Music 美学)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18V5l12-2v13"/>' +
        '<circle cx="6" cy="18" r="3"/>' +
        '<circle cx="18" cy="16" r="3"/>' +
        '</svg>' +
        '<span>音乐</span>' +
        '</button>';

      btn.querySelector('#cinema-btn-cinema').addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const v = findBestVideo();
        if (v) {
          if (v.isProxy || (v.tagName && v.tagName.toLowerCase() === 'audio')) {
            enterMusicMode(v);
          } else {
            enterCinema(v);
          }
        } else if (isNeteasePlaying()) {
          const playbar = getNeteasePlaybar();
          const proxy = createNeteaseAudioProxy(playbar);
          enterMusicMode(proxy);
        }
      });

      btn.querySelector('#cinema-btn-music').addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const v = findBestVideo();
        if (v) {
          enterMusicMode(v);
        } else if (isNeteasePlaying()) {
          const playbar = getNeteasePlaybar();
          const proxy = createNeteaseAudioProxy(playbar);
          enterMusicMode(proxy);
        }
      });
    }

    if (rootEl && (!btn.parentNode || !btn.isConnected)) {
      rootEl.appendChild(btn);
      console.log('[Button] Button created/re-appended to DOM');
    }
  }

  function setButtonVisible(v) {
    const isOverlayActive =
      !!document.getElementById('music-mode-overlay') ||
      !!document.getElementById('cinema-mode-overlay') ||
      (typeof window !== 'undefined' &&
        window.top &&
        window.top !== window &&
        window.top.document &&
        (!!window.top.document.getElementById('music-mode-overlay') ||
          !!window.top.document.getElementById('cinema-mode-overlay')));

    if (isOverlayActive) {
      v = false;
    }

    const allBtns = [
      btn,
      document.getElementById(BTN_ID),
      typeof window !== 'undefined' && window.top && window.top !== window && window.top.document
        ? window.top.document.getElementById(BTN_ID)
        : null
    ].filter(Boolean);

    allBtns.forEach(b => {
      b.classList.toggle('visible', v);
      if (!v) {
        b.style.setProperty('display', 'none', 'important');
        b.style.setProperty('opacity', '0', 'important');
        b.style.setProperty('visibility', 'hidden', 'important');
        b.style.setProperty('pointer-events', 'none', 'important');
      } else {
        b.style.removeProperty('display');
        b.style.removeProperty('opacity');
        b.style.removeProperty('visibility');
        b.style.removeProperty('pointer-events');
      }
    });
  }

  /* ---------- 影院模式 ---------- */

  function findPlayerContainer(video) {
    if (!video) return null;

    // 纯音频播放器容器 (如网易云音乐底部播放条)
    if (video.tagName && video.tagName.toLowerCase() === 'audio') {
      return (
        video.closest('.m-playbar, .g-btmbar, #g_player, [class*="playbar"], [class*="player"]') ||
        video.parentElement ||
        video
      );
    }

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
    return el || video;
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

    document.documentElement.classList.add('cinema-mode-active', 'has-cinema-overlay');
    document.body.classList.add('cinema-mode-active', 'has-cinema-overlay');
    try {
      if (window.top && window.top !== window && window.top.document) {
        window.top.document.documentElement.classList.add(
          'cinema-mode-active',
          'has-cinema-overlay'
        );
        window.top.document.body.classList.add('cinema-mode-active', 'has-cinema-overlay');
      }
    } catch (e) {
      // 忽略跨域访问限制
    }

    if (currentSettings.cleanPlayerEnabled) {
      document.documentElement.classList.add('clean-player-active');
      document.body.classList.add('clean-player-active');
      try {
        if (window.top && window.top !== window && window.top.document) {
          window.top.document.documentElement.classList.add('clean-player-active');
          window.top.document.body.classList.add('clean-player-active');
        }
      } catch (e) {
        // 忽略跨域访问限制
      }
    }

    setButtonVisible(false);

    const player = findPlayerContainer(video) || video;
    const saved = {
      parent: player ? player.parentNode : null,
      next: player ? player.nextSibling : null,
      playerStyle:
        player && typeof player.getAttribute === 'function' ? player.getAttribute('style') : null,
      videoStyle:
        video && typeof video.getAttribute === 'function' ? video.getAttribute('style') : null
    };

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentSettings.overlayOpacity})`;

    stage = document.createElement('div');
    stage.className = 'cinema-stage';

    if (player) {
      stage.appendChild(player);
    }

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
    musicModeBtn.title = '切换至 Apple Music 美学音乐模式';
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

      if (controlBar && pomodoroBar && !document.body.classList.contains('music-mode-active')) {
        const cbWidth = controlBar.offsetWidth;
        if (cbWidth > 0) {
          pomodoroBar.style.setProperty('width', `${cbWidth}px`, 'important');
        }
      }
    };

    updateStageDimensions();
    video.addEventListener('loadedmetadata', updateStageDimensions);
    video.addEventListener('resize', updateStageDimensions);
    window.addEventListener('resize', updateStageDimensions);

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.objectFit = 'contain';

    setTimeout(() => {
      updateStageDimensions();
      if (controlBar && pomodoroBar && !document.body.classList.contains('music-mode-active')) {
        const cbWidth = controlBar.offsetWidth;
        if (cbWidth > 0) {
          pomodoroBar.style.setProperty('width', `${cbWidth}px`, 'important');
        }
      }
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
      stageRef: stage,
      controlBar,
      pomodoroBar,
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

    document.documentElement.classList.remove(
      'cinema-mode-active',
      'has-cinema-overlay',
      'clean-player-active'
    );
    document.body.classList.remove(
      'cinema-mode-active',
      'has-cinema-overlay',
      'clean-player-active'
    );
    try {
      if (window.top && window.top !== window && window.top.document) {
        window.top.document.documentElement.classList.remove(
          'cinema-mode-active',
          'has-cinema-overlay',
          'clean-player-active'
        );
        window.top.document.body.classList.remove(
          'cinema-mode-active',
          'has-cinema-overlay',
          'clean-player-active'
        );
      }
    } catch (e) {
      // 忽略跨域访问限制
    }

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
    updateButton();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  /* ---------- 🎵 音乐模式 (Apple Music 正在播放美学) ---------- */

  function findNextVideoTrigger() {
    // 0. 网易云音乐 (music.163.com) 播放栏下一曲
    const neteaseNext =
      document.querySelector('.m-playbar .nxt, a[data-action="next"], .btnp.nxt, a.nxt') ||
      (typeof window !== 'undefined' && window.top && window.top !== window && window.top.document
        ? window.top.document.querySelector('.m-playbar .nxt, a[data-action="next"]')
        : null);
    if (neteaseNext && neteaseNext.offsetParent !== null) {
      return neteaseNext;
    }

    // 1. YouTube 播放器内置下一曲或播放列表
    const ytNext = document.querySelector('.ytp-next-button');
    if (ytNext && ytNext.offsetParent !== null && ytNext.getAttribute('aria-disabled') !== 'true') {
      return ytNext;
    }
    const ytPlaylistNext = document.querySelector(
      'ytd-playlist-panel-video-renderer[selected] + ytd-playlist-panel-video-renderer a#wc-endpoint, ytd-playlist-panel-video-renderer[selected] + ytd-playlist-panel-video-renderer a'
    );
    if (ytPlaylistNext && ytPlaylistNext.offsetParent !== null) {
      return ytPlaylistNext;
    }

    // 2. Bilibili 播放器下一P或分P/合集/播单列表下一项
    const biliNext = document.querySelector(
      '.bpx-player-ctrl-next, .bilibili-player-video-btn-next, .squirtle-video-next'
    );
    if (biliNext && biliNext.offsetParent !== null && !biliNext.classList.contains('disabled')) {
      return biliNext;
    }
    const biliPodNext = document.querySelector(
      '.video-pod__list .active + .video-pod__item, .video-pod__list .active + .video-pod__item a, .cur-list .on + li a, .cur-list .on + li, .list-box .active + li a, .list-box .active + li, .ep-item.cursor + .ep-item, .sections-item.active + .sections-item'
    );
    if (biliPodNext && biliPodNext.offsetParent !== null) {
      return biliPodNext;
    }

    // 3. 腾讯视频、爱奇艺等流媒体
    const txNext = document.querySelector(
      '.txp_btn_next, .txp_next, .episode-item.current + .episode-item'
    );
    if (txNext && txNext.offsetParent !== null) return txNext;
    const iqiyiNext = document.querySelector('.iqp-btn-next, .iqp-next');
    if (iqiyiNext && iqiyiNext.offsetParent !== null) return iqiyiNext;

    // 4. 通用属性选择器兜底
    const genericNext = document.querySelector(
      'button[aria-label*="下一"], [aria-label*="Next" i], [title*="下一"], [title*="Next" i], [class*="btn-next"], [class*="ctrl-next"]'
    );
    if (
      genericNext &&
      genericNext.offsetParent !== null &&
      !genericNext.closest('#music-mode-overlay')
    ) {
      return genericNext;
    }

    return null;
  }

  function findPrevVideoTrigger() {
    // 0. 网易云音乐 (music.163.com) 播放栏上一曲
    const neteasePrev =
      document.querySelector('.m-playbar .prv, a[data-action="prev"], .btnp.prv, a.prv') ||
      (typeof window !== 'undefined' && window.top && window.top !== window && window.top.document
        ? window.top.document.querySelector('.m-playbar .prv, a[data-action="prev"]')
        : null);
    if (neteasePrev && neteasePrev.offsetParent !== null) {
      return neteasePrev;
    }

    // 1. YouTube 播放器内置上一曲或播放列表
    const ytPrev = document.querySelector('.ytp-prev-button');
    if (ytPrev && ytPrev.offsetParent !== null && ytPrev.getAttribute('aria-disabled') !== 'true') {
      return ytPrev;
    }
    const ytSelected = document.querySelector('ytd-playlist-panel-video-renderer[selected]');
    if (ytSelected && ytSelected.previousElementSibling) {
      const prevA = ytSelected.previousElementSibling.querySelector('a#wc-endpoint, a');
      if (prevA && prevA.offsetParent !== null) return prevA;
    }

    // 2. Bilibili 播放器上一P或分P/合集/播单列表上一项
    const biliPrev = document.querySelector(
      '.bpx-player-ctrl-prev, .bilibili-player-video-btn-prev'
    );
    if (biliPrev && biliPrev.offsetParent !== null && !biliPrev.classList.contains('disabled')) {
      return biliPrev;
    }
    const biliPodActive = document.querySelector(
      '.video-pod__list .active, .cur-list .on, .list-box .active, .ep-item.cursor, .sections-item.active'
    );
    if (biliPodActive && biliPodActive.previousElementSibling) {
      const prevItem =
        biliPodActive.previousElementSibling.querySelector('a') ||
        biliPodActive.previousElementSibling;
      if (prevItem && prevItem.offsetParent !== null) return prevItem;
    }

    // 3. 腾讯视频、爱奇艺等流媒体
    const txPrev = document.querySelector('.txp_btn_prev, .txp_prev');
    if (txPrev && txPrev.offsetParent !== null) return txPrev;
    const iqiyiPrev = document.querySelector('.iqp-btn-prev, .iqp-next');
    if (iqiyiPrev && iqiyiPrev.offsetParent !== null) return iqiyiPrev;

    // 4. 通用属性选择器兜底
    const genericPrev = document.querySelector(
      'button[aria-label*="上一"], [aria-label*="Previous" i], [aria-label*="prev" i], [title*="上一"], [title*="Previous" i], [title*="prev" i], [class*="btn-prev"], [class*="ctrl-prev"]'
    );
    if (
      genericPrev &&
      genericPrev.offsetParent !== null &&
      !genericPrev.closest('#music-mode-overlay')
    ) {
      return genericPrev;
    }

    return null;
  }

  function enterMusicMode(video) {
    console.log('[Music Mode] Starting music mode...');
    if (!video) {
      console.error('[Music Mode] No video provided!');
      return;
    }
    autoExpandYouTubeDescription();
    if (cinema) exitCinema();
    if (musicCinema) exitMusicMode(true);

    recordWatchHistory(video);

    document.documentElement.classList.add('music-mode-active', 'has-music-overlay');
    document.body.classList.add('music-mode-active', 'has-music-overlay');
    try {
      if (window.top && window.top !== window && window.top.document) {
        window.top.document.documentElement.classList.add('music-mode-active', 'has-music-overlay');
        window.top.document.body.classList.add('music-mode-active', 'has-music-overlay');
      }
    } catch (e) {
      // 忽略跨域访问限制
    }

    if (currentSettings.cleanPlayerEnabled !== false) {
      document.documentElement.classList.add('clean-player-active');
      document.body.classList.add('clean-player-active');
      try {
        if (window.top && window.top !== window && window.top.document) {
          window.top.document.documentElement.classList.add('clean-player-active');
          window.top.document.body.classList.add('clean-player-active');
        }
      } catch (e) {
        // 忽略跨域访问限制
      }
    }

    setButtonVisible(false);

    const player = findPlayerContainer(video);
    const isVideoElement = video && video.tagName && video.tagName.toLowerCase() === 'video';
    const isAudioOnly = !isVideoElement;

    const playerMoved = !isAudioOnly && !currentSettings.musicStaticCoverEnabled;
    const saved = {
      parent: player ? player.parentNode : null,
      next: player ? player.nextSibling : null,
      playerStyle:
        player && typeof player.getAttribute === 'function' ? player.getAttribute('style') : null,
      videoStyle:
        video && typeof video.getAttribute === 'function' ? video.getAttribute('style') : null,
      playerMoved
    };

    const overlayEl = document.createElement('div');
    overlayEl.id = 'music-mode-overlay';
    console.log('[Music Mode] Overlay element created:', overlayEl);

    // 动态 3D 流体渐变背景 (优先使用 WebGL ShaderGradient 3D 流体引擎，优雅退化至 BlurBackgroundController)
    const bgBlurEl = document.createElement('div');
    bgBlurEl.className =
      'music-bg-blur' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
    console.log('[Music Mode] Background blur element created:', bgBlurEl);

    let musicBlurController = null;

    if (isVideoElement && typeof ShaderGradientController !== 'undefined') {
      try {
        musicBlurController = new ShaderGradientController(video, {
          isStatic: !!currentSettings.musicStaticCoverEnabled,
          speed: 0.65,
          strength: 2.1,
          density: 1.75,
          grain: 0.022,
          brightness: 0.86,
          saturation: 1.28
        });
        musicBlurController.mount(bgBlurEl);
        bgBlurEl.style.filter = 'none';
        console.log('[Music Mode] ShaderGradientController mounted successfully');
      } catch (error) {
        console.warn('[Music Mode] ShaderGradientController mount failed, falling back:', error);
      }
    }

    if (!musicBlurController && typeof BlurBackgroundController !== 'undefined') {
      try {
        musicBlurController = new BlurBackgroundController(video, {
          enableBlurHash: currentSettings.blurHashEnabled !== false,
          isStatic: !!currentSettings.musicStaticCoverEnabled,
          throttleMs: 150
        });
        musicBlurController.mount(bgBlurEl);
        bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
        console.log('[Music Mode] BlurBackgroundController fallback mounted successfully');
      } catch (error) {
        console.error('[Music Mode] Failed to mount background controller fallback:', error);
      }
    }

    // 全屏舞台框架 (Apple Music「正在播放」单列居中布局)
    const stageEl = document.createElement('div');
    stageEl.className = 'music-nowplaying-stage';
    stageEl.style.padding = `${currentSettings.musicPadding}px`;
    console.log('[Music Mode] Stage element created');

    // 内容单列: 封面 / 元信息 / 进度 / 控制
    const columnEl = document.createElement('div');
    columnEl.className = 'music-nowplaying-column';
    columnEl.style.width = `${currentSettings.musicCardWidth}px`;

    // 1. 封面区: Radiosity 光晕 + 方形封面卡片
    const artworkWrap = document.createElement('div');
    artworkWrap.className = 'music-artwork-wrap';

    const radiosityEl = document.createElement('div');
    radiosityEl.className = 'music-artwork-radiosity';

    let radiosityController = null;
    if (typeof BlurBackgroundController !== 'undefined') {
      try {
        radiosityController = new BlurBackgroundController(video, {
          enableBlurHash: currentSettings.blurHashEnabled !== false,
          isStatic: !!currentSettings.musicStaticCoverEnabled,
          throttleMs: 150
        });
        radiosityController.mount(radiosityEl);
        console.log('[Music Mode] Radiosity controller mounted successfully');
      } catch (error) {
        console.error('[Music Mode] Failed to mount radiosity controller:', error);
      }
    }

    const artworkCard = document.createElement('div');
    artworkCard.className = 'music-artwork-card';
    console.log('[Music Mode] Artwork card element created');

    artworkWrap.appendChild(radiosityEl);
    artworkWrap.appendChild(artworkCard);

    function mountLivePlayerToCard() {
      if (isAudioOnly) {
        console.log('[Music Mode] Audio element in use, artwork card prepared for cover image');
        return;
      }
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

    if (!isAudioOnly && currentSettings.musicStaticCoverEnabled) {
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

    // 2. 标题 / 来源（静止观赏态时于控制行位置居中展示）+ 辅助按钮 (字幕加载 / 模式切换)
    const titleWrap = document.createElement('div');
    titleWrap.className = 'music-track-title-wrap';

    const titleTrack = document.createElement('div');
    titleTrack.className = 'music-track-title-track';

    const trackTitleText = document.createElement('span');
    trackTitleText.className = 'music-track-title-text';
    const rawTitle = document.title || '未知视频/曲目';
    const domContext =
      typeof MusicMetadataParser !== 'undefined'
        ? MusicMetadataParser.extractDOMContext()
        : { mainTitle: rawTitle, partTitle: '', author: '' };

    const parsedInitial =
      typeof MusicMetadataParser !== 'undefined'
        ? MusicMetadataParser.parse(rawTitle, domContext)
        : {
            queryTitle: cleanPageTitle(rawTitle),
            queryArtist: '',
            queryAlbum: '',
            cleanFallbackTitle: cleanPageTitle(rawTitle)
          };

    const initialCleanTitle =
      parsedInitial.queryTitle || parsedInitial.cleanFallbackTitle || cleanPageTitle(rawTitle);
    trackTitleText.textContent = initialCleanTitle;

    const trackTitleDup = document.createElement('span');
    trackTitleDup.className = 'music-track-title-text music-track-title-dup';
    trackTitleDup.textContent = initialCleanTitle;

    titleTrack.appendChild(trackTitleText);
    titleTrack.appendChild(trackTitleDup);
    titleWrap.appendChild(titleTrack);
    titleWrap.title = initialCleanTitle;

    const defaultHostSub = window.location.hostname.replace('www.', '');
    const trackSub = document.createElement('div');
    trackSub.className = 'music-track-sub';
    if (parsedInitial.isAlbumCollection) {
      trackSub.textContent = parsedInitial.queryArtist || defaultHostSub;
      trackSub.title = `艺术家: ${parsedInitial.queryArtist || '未知'} | 专辑: ${parsedInitial.queryAlbum}`;
    } else {
      trackSub.textContent = parsedInitial.queryArtist
        ? parsedInitial.queryAlbum
          ? `${parsedInitial.queryArtist} — ${parsedInitial.queryAlbum}`
          : parsedInitial.queryArtist
        : defaultHostSub;
    }

    let isUserActive = false;

    const updateTitleMarquee = () => {
      if (!trackTitleText || !titleWrap || !titleTrack) return;
      titleWrap.classList.remove('has-overflow');
      titleTrack.classList.remove('is-marquee', 'is-running');
      titleTrack.style.removeProperty('--marquee-duration');

      // 获取单段标题实际渲染宽度（不含 padding-right）
      const textWidth = trackTitleText.scrollWidth;
      const containerWidth = titleWrap.clientWidth;

      if (textWidth > containerWidth + 2) {
        titleWrap.classList.add('has-overflow');
        titleTrack.classList.add('is-marquee');
        // 反转逻辑：静止观赏态下标题可见，此时才启动滚动；鼠标活动时暂停
        if (!isUserActive) {
          titleTrack.classList.add('is-running');
        }
        // 单个单元宽度（文字宽 + 48px 无缝衔接间隔）
        const singleWidth = textWidth + 48;
        // 舒缓匀速平滑移动速度：约 20px / 秒
        const duration = Math.max(14, Math.round(singleWidth / 20));
        titleTrack.style.setProperty('--marquee-duration', `${duration}s`);
      }
    };

    // 联网检索高精音乐元数据 (歌名、艺术家、专辑名称、专辑封面)
    const fallbackOnlineCover = () => {
      if (artworkCard) {
        const existingCover = artworkCard.querySelector('.music-artwork-online-cover');
        if (existingCover) {
          existingCover.classList.remove('is-loaded');
          setTimeout(() => {
            if (existingCover && existingCover.parentNode) {
              existingCover.remove();
            }
          }, 450);
        }
      }
      if (radiosityController && radiosityController.clearCustomImageSource) {
        radiosityController.clearCustomImageSource();
      }
      if (musicBlurController && musicBlurController.clearCustomImageSource) {
        musicBlurController.clearCustomImageSource();
      }
    };

    let activeMetadataReqId = 0;

    const loadOnlineMetadata = (currentRawTitle, explicitContext = null) => {
      if (typeof MusicMetadataService === 'undefined' || typeof MusicMetadataParser === 'undefined')
        return;
      const reqId = ++activeMetadataReqId;
      const ctx = explicitContext || MusicMetadataParser.extractDOMContext();
      const parsed = MusicMetadataParser.parse(currentRawTitle, ctx);

      // 0. 乐观即时更新：在发起网络请求前，立即根据当前 DOM 上下文更新标题和副标题（防止切分集时的 UI 滞后）
      const initialTitle =
        parsed.queryTitle || parsed.cleanFallbackTitle || cleanPageTitle(currentRawTitle);
      if (initialTitle && trackTitleText) {
        trackTitleText.textContent = initialTitle;
        if (trackTitleDup) trackTitleDup.textContent = initialTitle;
        if (titleWrap) titleWrap.title = initialTitle;
      }
      if (trackSub) {
        if (parsed.isAlbumCollection) {
          trackSub.textContent = parsed.queryArtist || defaultHostSub;
          trackSub.title = `艺术家: ${parsed.queryArtist || '未知'} | 专辑: ${parsed.queryAlbum}`;
        } else if (parsed.queryArtist && parsed.queryAlbum) {
          trackSub.textContent = `${parsed.queryArtist} — ${parsed.queryAlbum}`;
          trackSub.title = `艺术家: ${parsed.queryArtist} | 专辑: ${parsed.queryAlbum}`;
        } else if (parsed.queryArtist) {
          trackSub.textContent = parsed.queryArtist;
          trackSub.title = `艺术家: ${parsed.queryArtist}`;
        } else {
          trackSub.textContent = defaultHostSub;
          trackSub.title = '';
        }
      }
      if (updateTitleMarquee) {
        setTimeout(updateTitleMarquee, 50);
      }

      MusicMetadataService.fetchMetadata(parsed)
        .then(meta => {
          if (reqId !== activeMetadataReqId || !musicCinema || !stageEl.isConnected) return;

          let coverImg = artworkCard
            ? artworkCard.querySelector('.music-artwork-online-cover')
            : null;
          const currentLoadedSrc = coverImg ? coverImg.getAttribute('data-original-src') : '';
          const currentSourceType = coverImg ? coverImg.getAttribute('data-source-type') : '';
          const isCoverCurrentlyLoaded = coverImg && coverImg.classList.contains('is-loaded');

          if (!meta) {
            const fallbackTitle =
              parsed.queryTitle || parsed.cleanFallbackTitle || cleanPageTitle(currentRawTitle);
            if (trackTitleText) {
              trackTitleText.textContent = fallbackTitle;
              if (trackTitleDup) trackTitleDup.textContent = fallbackTitle;
              if (titleWrap) titleWrap.title = fallbackTitle;
            }
            if (trackSub) {
              if (parsed.isAlbumCollection) {
                trackSub.textContent = parsed.queryArtist || defaultHostSub;
              } else {
                trackSub.textContent = parsed.queryArtist
                  ? parsed.queryAlbum
                    ? `${parsed.queryArtist} — ${parsed.queryAlbum}`
                    : parsed.queryArtist
                  : defaultHostSub;
              }
            }
            // 关键保护：若当前已有成功展示的封面（如 API 获取的超清封面），绝不因重试未命中而盲目清除回退到视频旧图
            if (!isCoverCurrentlyLoaded) {
              fallbackOnlineCover();
            }
            if (updateTitleMarquee) {
              setTimeout(updateTitleMarquee, 50);
            }
            return;
          }

          // 1. 更新歌曲/专辑标题与跑马灯
          const displayTitle = meta.title || meta.album || parsed.queryTitle;
          if (displayTitle && trackTitleText) {
            trackTitleText.textContent = displayTitle;
            if (trackTitleDup) trackTitleDup.textContent = displayTitle;
            if (titleWrap)
              titleWrap.title = `${displayTitle}${meta.artist ? ' - ' + meta.artist : ''}`;
          }

          // 2. 更新副标题 (单曲显示 艺术家 — 专辑名称 或 艺术家；专辑合集纯粹呈现 艺术家)
          if (trackSub) {
            if (meta.isAlbumCollection) {
              trackSub.textContent = meta.artist || parsed.queryArtist || defaultHostSub;
              trackSub.title = `艺术家: ${meta.artist || parsed.queryArtist || '未知'} | 专辑: ${meta.album || displayTitle}`;
            } else if (meta.artist && meta.album) {
              trackSub.textContent = `${meta.artist} — ${meta.album}`;
              trackSub.title = `艺术家: ${meta.artist} | 专辑: ${meta.album}`;
            } else if (meta.artist) {
              trackSub.textContent = meta.artist;
              trackSub.title = `艺术家: ${meta.artist}`;
            } else if (parsed.queryArtist && parsed.queryAlbum) {
              trackSub.textContent = `${parsed.queryArtist} — ${parsed.queryAlbum}`;
              trackSub.title = `艺术家: ${parsed.queryArtist} | 专辑: ${parsed.queryAlbum}`;
            } else if (parsed.queryArtist) {
              trackSub.textContent = parsed.queryArtist;
              trackSub.title = `艺术家: ${parsed.queryArtist}`;
            } else {
              trackSub.textContent = defaultHostSub;
              trackSub.title = '';
            }
          }

          // 3. 更新官方高清专辑封面与背景流光
          if (meta.cover && artworkCard) {
            if (!coverImg) {
              coverImg = document.createElement('img');
              coverImg.className = 'music-artwork-online-cover';
              artworkCard.appendChild(coverImg);
            }

            // 保护机制：若当前已加载 LrcAPI 超清原盘封面 (3000px)，后续 DOM 重试带回的低清网页封面 (dom_structured_card) 绝不向下覆盖
            const isDowngradeToDom =
              isCoverCurrentlyLoaded &&
              (currentSourceType === 'lrc_api' || currentSourceType === 'bilibili_bgm') &&
              meta.source === 'dom_structured_card';

            if (!isDowngradeToDom) {
              const applyCoverSource = (imgEl, srcUrl, allowCors = true) => {
                imgEl.onload = () => {
                  if (reqId !== activeMetadataReqId || !musicCinema || !stageEl.isConnected) return;
                  imgEl.classList.add('is-loaded');
                  imgEl.setAttribute('data-source-type', meta.source || 'api');
                  if (radiosityController && radiosityController.setCustomImageSource) {
                    radiosityController.setCustomImageSource(imgEl);
                  }
                  if (musicBlurController && musicBlurController.setCustomImageSource) {
                    musicBlurController.setCustomImageSource(imgEl);
                  }
                };
                imgEl.onerror = () => {
                  if (reqId !== activeMetadataReqId) return;
                  // 若由于 crossOrigin 策略被拦截，剥离跨域限制并追加无 CORS 参数重试普通图片展示
                  if (allowCors && imgEl.hasAttribute('crossorigin')) {
                    imgEl.removeAttribute('crossorigin');
                    const sep = srcUrl.includes('?') ? '&' : '?';
                    applyCoverSource(imgEl, `${srcUrl}${sep}_tm_nocors=1`, false);
                  } else {
                    console.warn('[Music Mode] Failed to load cover image:', srcUrl);
                    if (!isCoverCurrentlyLoaded) {
                      fallbackOnlineCover();
                    }
                  }
                };

                if (allowCors) {
                  imgEl.crossOrigin = 'anonymous';
                } else {
                  imgEl.removeAttribute('crossorigin');
                }
                imgEl.src = srcUrl;
                if (imgEl.complete && imgEl.naturalWidth) {
                  imgEl.onload();
                }
              };

              if (currentLoadedSrc !== meta.cover || !isCoverCurrentlyLoaded) {
                coverImg.setAttribute('data-original-src', meta.cover);
                coverImg.classList.remove('is-loaded');
                applyCoverSource(coverImg, meta.cover, true);
              } else {
                coverImg.setAttribute('data-source-type', meta.source || 'api');
                if (radiosityController && radiosityController.setCustomImageSource) {
                  radiosityController.setCustomImageSource(coverImg);
                }
                if (musicBlurController && musicBlurController.setCustomImageSource) {
                  musicBlurController.setCustomImageSource(coverImg);
                }
              }
            }
          } else {
            if (!isCoverCurrentlyLoaded) {
              fallbackOnlineCover();
            }
          }

          // 4. 更新官方同步歌词
          if (meta.lyrics) {
            try {
              currentLyricsCues =
                typeof SubtitleParser !== 'undefined' ? SubtitleParser.parseLRC(meta.lyrics) : [];
              if (typeof renderLyrics === 'function') {
                renderLyrics(currentLyricsCues);
              }
            } catch (e) {
              console.warn('[Music Mode] Failed to parse LRC lyrics:', e);
            }
          } else {
            // 仅在当前没有歌词或未加载时置空
            if (!currentLyricsCues || currentLyricsCues.length === 0) {
              currentLyricsCues = [];
              if (isLyricsOpen && typeof renderLyrics === 'function') {
                renderLyrics([]);
              }
            }
          }

          if (updateTitleMarquee) {
            setTimeout(updateTitleMarquee, 50);
          }
        })
        .catch(err => {
          if (reqId !== activeMetadataReqId) return;
          console.warn('[Music Mode] Metadata retrieval fallback:', err);
          const coverImg = artworkCard
            ? artworkCard.querySelector('.music-artwork-online-cover')
            : null;
          if (!coverImg || !coverImg.classList.contains('is-loaded')) {
            fallbackOnlineCover();
          }
        });
    };

    loadOnlineMetadata(rawTitle);

    // YouTube / Bilibili 等单页应用常在初次渲染后异步加载结构化信息，错峰多级检测自愈
    [350, 800, 1500].forEach(delay => {
      setTimeout(() => {
        if (musicCinema && stageEl.isConnected) {
          const ctx = MusicMetadataParser.extractDOMContext();
          if (ctx.ytSong || ctx.musicId || ctx.discoveryTitle || ctx.biliArtist || ctx.biliCover) {
            loadOnlineMetadata(rawTitle, ctx);
          }
        }
      }, delay);
    });

    // 歌词与同步管理状态
    let isLyricsOpen = false;
    let currentLyricsCues = [];
    let currentActiveLyricsIndex = -1;
    let isUserScrollingLyrics = false;
    let userLyricsScrollTimer = null;

    const lyricsContainerEl = document.createElement('div');
    lyricsContainerEl.className = 'music-lyrics-container';

    const lyricsListEl = document.createElement('div');
    lyricsListEl.className = 'music-lyrics-list';
    lyricsContainerEl.appendChild(lyricsListEl);

    const onLyricsUserScroll = () => {
      isUserScrollingLyrics = true;
      if (userLyricsScrollTimer) clearTimeout(userLyricsScrollTimer);
      userLyricsScrollTimer = setTimeout(() => {
        isUserScrollingLyrics = false;
      }, 2500);
    };
    lyricsContainerEl.addEventListener('wheel', onLyricsUserScroll, { passive: true });
    lyricsContainerEl.addEventListener('touchmove', onLyricsUserScroll, { passive: true });

    const updateActiveLyrics = (activeIndex, forceScroll = false) => {
      if (currentActiveLyricsIndex >= 0 && lyricsListEl.children[currentActiveLyricsIndex]) {
        lyricsListEl.children[currentActiveLyricsIndex].classList.remove('is-active');
      }
      currentActiveLyricsIndex = activeIndex;
      if (activeIndex >= 0 && lyricsListEl.children[activeIndex]) {
        const activeLineEl = lyricsListEl.children[activeIndex];
        activeLineEl.classList.add('is-active');

        if (!isUserScrollingLyrics || forceScroll) {
          const containerHeight = lyricsContainerEl.clientHeight;
          const lineOffsetTop = activeLineEl.offsetTop;
          const lineHeight = activeLineEl.clientHeight;
          const targetScrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2;

          lyricsContainerEl.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        }
      }
    };

    const syncLyricsWithTime = (curTime, forceScroll = false) => {
      if (!isLyricsOpen || !currentLyricsCues || currentLyricsCues.length === 0) return;

      let activeIndex = -1;
      for (let i = 0; i < currentLyricsCues.length; i++) {
        const cue = currentLyricsCues[i];
        const nextCue = currentLyricsCues[i + 1];
        const nextStart = nextCue ? nextCue.start || nextCue.time : Infinity;
        const start = cue.start || cue.time || 0;
        if (curTime >= start && curTime < nextStart) {
          activeIndex = i;
          break;
        }
      }

      if (activeIndex === -1 && currentLyricsCues.length > 0) {
        if (curTime < (currentLyricsCues[0].start || currentLyricsCues[0].time)) {
          activeIndex = 0;
        } else {
          activeIndex = currentLyricsCues.length - 1;
        }
      }

      if (activeIndex !== currentActiveLyricsIndex || forceScroll) {
        updateActiveLyrics(activeIndex, forceScroll);
      }
    };

    const renderLyricsLoading = () => {
      lyricsListEl.innerHTML = `
        <div class="music-lyrics-empty is-loading">
          <div class="empty-icon">⏳</div>
          <div class="empty-title">正在从 LrcAPI 检索官方同步歌词...</div>
        </div>
      `;
    };

    const renderLyrics = cues => {
      lyricsListEl.innerHTML = '';
      currentActiveLyricsIndex = -1;

      if (!cues || cues.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'music-lyrics-empty';
        emptyEl.innerHTML = `
          <div class="empty-icon">🎵</div>
          <div class="empty-title">暂无同步歌词</div>
          <button class="music-lyrics-upload-btn">上传本地歌词 (.lrc / .srt / .vtt)</button>
        `;
        const uploadBtn = emptyEl.querySelector('.music-lyrics-upload-btn');
        if (uploadBtn) {
          uploadBtn.addEventListener('click', e => {
            e.stopPropagation();
            subFileInput.click();
          });
        }
        lyricsListEl.appendChild(emptyEl);
        return;
      }

      cues.forEach((cue, index) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'music-lyrics-line';
        lineEl.dataset.index = String(index);
        lineEl.dataset.time = String(cue.start || cue.time || 0);
        lineEl.textContent = cue.text;

        lineEl.addEventListener('click', e => {
          e.stopPropagation();
          const v = musicCinema ? musicCinema.video : video;
          if (v) {
            v.currentTime = cue.start || cue.time || 0;
            updateActiveLyrics(index, true);
          }
        });

        lyricsListEl.appendChild(lineEl);
      });
    };

    const toggleLyrics = forceOpen => {
      isLyricsOpen = typeof forceOpen === 'boolean' ? forceOpen : !isLyricsOpen;
      stageEl.classList.toggle('has-lyrics', isLyricsOpen);
      lyricsBtn.classList.toggle('is-active', isLyricsOpen);
      if (isLyricsOpen) {
        if (!currentLyricsCues || currentLyricsCues.length === 0) {
          renderLyricsLoading();
          const currentRaw = document.title || '未知视频/曲目';
          const ctx =
            typeof MusicMetadataParser !== 'undefined'
              ? MusicMetadataParser.extractDOMContext()
              : { mainTitle: currentRaw, partTitle: '', author: '' };
          const parsed =
            typeof MusicMetadataParser !== 'undefined'
              ? MusicMetadataParser.parse(currentRaw, ctx)
              : null;

          if (parsed && typeof MusicMetadataService !== 'undefined') {
            MusicMetadataService.fetchLyrics(
              parsed.queryTitle,
              parsed.queryArtist || '',
              parsed.queryAlbum || ''
            )
              .then(lrcText => {
                if (!musicCinema || !stageEl.isConnected) return;
                if (lrcText) {
                  currentLyricsCues =
                    typeof SubtitleParser !== 'undefined' ? SubtitleParser.parseLRC(lrcText) : [];
                }
                renderLyrics(currentLyricsCues);
                const v = musicCinema ? musicCinema.video : video;
                if (v) syncLyricsWithTime(v.currentTime, true);
              })
              .catch(() => {
                renderLyrics(currentLyricsCues);
              });
          } else {
            renderLyrics(currentLyricsCues);
          }
        }
        setTimeout(() => {
          const v = musicCinema ? musicCinema.video : video;
          if (v) syncLyricsWithTime(v.currentTime, true);
        }, 60);
      }
    };

    const lyricsBtn = document.createElement('button');
    lyricsBtn.className = 'music-icon-btn accessory music-lyrics-toggle-btn';
    lyricsBtn.title = '歌词 (显示 / 隐藏)';
    lyricsBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 4H3c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h4l4 4 4-4h6c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3 9H6v-2h12v2zm0-3H6V8h12v2z"/></svg>';

    const subFileInput = document.createElement('input');
    subFileInput.type = 'file';
    subFileInput.accept = '.lrc,.srt,.vtt';
    subFileInput.style.display = 'none';
    subFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const content = evt.target.result;
          const cues = SubtitleParser.parse(content, file.name);
          currentLyricsCues = cues;
          renderLyrics(currentLyricsCues);
          toggleLyrics(true);
          showToast(`歌词加载成功（${cues.length} 行）`, 'success');
        } catch (err) {
          showToast(`歌词解析失败：${err.message}`, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    lyricsBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleLyrics();
    });
    lyricsBtn.appendChild(subFileInput);

    const modeBtn = document.createElement('button');
    modeBtn.className = 'music-icon-btn accessory';
    modeBtn.title = '切换至影院模式';
    modeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/></svg>';
    modeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = video;
      exitMusicMode(true);
      enterCinema(v);
    });

    // 3. 进度区: 时间行 + 滑块（与专辑封面同宽）
    const timesRow = document.createElement('div');
    timesRow.className = 'music-time-row';

    const curTimeSpan = document.createElement('span');
    curTimeSpan.className = 'music-time music-time-elapsed';
    curTimeSpan.textContent = '0:00';

    const durTimeSpan = document.createElement('span');
    durTimeSpan.className = 'music-time music-time-remaining';
    durTimeSpan.textContent = '-0:00';

    timesRow.appendChild(curTimeSpan);
    timesRow.appendChild(durTimeSpan);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'music-progress-container';

    const progressTrack = document.createElement('div');
    progressTrack.className = 'music-progress-track';

    const progressFill = document.createElement('div');
    progressFill.className = 'music-progress-fill';
    progressTrack.appendChild(progressFill);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'music-progress-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '0';

    progressContainer.appendChild(progressTrack);
    progressContainer.appendChild(slider);

    const scrubberWrap = document.createElement('div');
    scrubberWrap.className = 'music-scrubber-wrap';
    scrubberWrap.appendChild(timesRow);
    scrubberWrap.appendChild(progressContainer);

    const updateSliderBg = val => {
      const pct = typeof val === 'number' ? val : parseFloat(slider.value) || 0;
      progressFill.style.width = `${pct}%`;
    };

    let isDraggingSlider = false;
    let lastRenderedTimeSec = -1;

    const onSliderDragStart = () => {
      isDraggingSlider = true;
    };
    const onSliderDragEnd = () => {
      isDraggingSlider = false;
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) {
        v.currentTime = (parseFloat(slider.value) / 100) * v.duration;
      }
      lastRenderedTimeSec = -1;
      updateSliderBg();
    };

    slider.addEventListener('mousedown', onSliderDragStart);
    slider.addEventListener('mouseup', onSliderDragEnd);
    slider.addEventListener('touchstart', onSliderDragStart, { passive: true });
    slider.addEventListener('touchend', onSliderDragEnd);
    slider.addEventListener('input', () => {
      const v = musicCinema ? musicCinema.video : video;
      if (v && !isNaN(v.duration)) {
        const cur = (parseFloat(slider.value) / 100) * v.duration;
        curTimeSpan.textContent = formatSec(cur);
        durTimeSpan.textContent = `-${formatSec(v.duration - cur)}`;
      }
      updateSliderBg();
    });

    // 4. 播放控制行: 辅助按钮分居左右，中间播放三键 / 标题（静止时）
    //    鼠标移动时显示三键；静止时三键隐藏，于原位置居中展示主副标题
    const controlsRow = document.createElement('div');
    controlsRow.className = 'music-controls';

    const transportEl = document.createElement('div');
    transportEl.className = 'music-controls-transport';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'music-icon-btn prev';
    prevBtn.title = '上一首 / 重新播放';
    prevBtn.innerHTML =
      '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M7 6.5a1.5 1.5 0 0 1 3 0v7.197l12.723-8.482A2 2 0 0 1 26 6.88v18.24a2 2 0 0 1-3.277 1.665L10 18.303v7.197a1.5 1.5 0 0 1-3 0V6.5z"/></svg>';
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      const prevTrigger = findPrevVideoTrigger();
      if (prevTrigger) {
        prevTrigger.click();
        showToast('已切换至上一首 / 上一个视频', 'info');
      } else if (v) {
        v.currentTime = 0;
        showToast('已从头重新播放', 'info');
      } else {
        showToast('未检测到上一曲', 'info');
      }
    });

    const playToggleBtn = document.createElement('button');
    playToggleBtn.className = 'music-icon-btn play-main';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'music-icon-btn next';
    nextBtn.title = '下一首 / 下一个视频';
    nextBtn.innerHTML =
      '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M25 6.5a1.5 1.5 0 0 0-3 0v7.197L9.277 5.215A2 2 0 0 0 6 6.88v18.24a2 2 0 0 0 3.277 1.665L22 18.303v7.197a1.5 1.5 0 0 0 3 0V6.5z"/></svg>';
    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      const nextTrigger = findNextVideoTrigger();
      if (nextTrigger) {
        nextTrigger.click();
        showToast('已切换至下一首 / 下一个视频', 'info');
      } else {
        showToast('当前已是最后一首或未检测到播放列表', 'info');
      }
    });

    transportEl.appendChild(prevBtn);
    transportEl.appendChild(playToggleBtn);
    transportEl.appendChild(nextBtn);

    // 静止观赏态标题层（与三键同位置互斥切换）
    const controlsTitleEl = document.createElement('div');
    controlsTitleEl.className = 'music-controls-title';
    controlsTitleEl.appendChild(titleWrap);
    controlsTitleEl.appendChild(trackSub);

    controlsRow.appendChild(lyricsBtn);
    controlsRow.appendChild(transportEl);
    controlsRow.appendChild(modeBtn);
    controlsRow.appendChild(controlsTitleEl);

    // 满帧动力学进度渲染循环 (requestAnimationFrame)
    const startProgressLoop = () => {
      if (musicCinema && musicCinema.progressRafId) {
        cancelAnimationFrame(musicCinema.progressRafId);
      }
      const loop = () => {
        if (!musicCinema || musicCinema.isExiting) return;
        const v = musicCinema.video || video;
        if (v && !isDraggingSlider && !isNaN(v.duration) && v.duration > 0) {
          const cur = v.currentTime;
          const dur = v.duration;
          const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
          slider.value = pct;
          updateSliderBg(pct);

          syncLyricsWithTime(cur);

          const curSecFloor = Math.floor(cur);
          if (curSecFloor !== lastRenderedTimeSec) {
            lastRenderedTimeSec = curSecFloor;
            curTimeSpan.textContent = formatSec(cur);
            durTimeSpan.textContent = `-${formatSec(dur - cur)}`;
          }
        }
        if (musicCinema) {
          musicCinema.progressRafId = requestAnimationFrame(loop);
        }
      };
      if (musicCinema) {
        musicCinema.progressRafId = requestAnimationFrame(loop);
      }
    };

    let lastKnownTitle = '';
    const syncUIStatus = () => {
      const v = musicCinema ? musicCinema.video : video;
      if (!v) return;

      playToggleBtn.title = v.paused ? '播放' : '暂停';
      playToggleBtn.innerHTML = v.paused
        ? '<svg viewBox="0 0 32 28" fill="currentColor"><path d="M10.345 23.287c.415 0 .763-.15 1.22-.407l12.742-7.404c.838-.481 1.178-.855 1.178-1.46 0-.599-.34-.972-1.178-1.462L11.565 5.158c-.457-.265-.805-.407-1.22-.407-.789 0-1.345.606-1.345 1.57V21.71c0 .971.556 1.577 1.345 1.577z"/></svg>'
        : '<svg viewBox="0 0 32 28" fill="currentColor"><path d="M13.293 22.772c.955 0 1.436-.481 1.436-1.436V6.677c0-.98-.481-1.427-1.436-1.427h-2.457c-.954 0-1.436.473-1.436 1.427v14.66c-.008.954.473 1.435 1.436 1.435h2.457zm7.87 0c.954 0 1.427-.481 1.427-1.436V6.677c0-.98-.473-1.427-1.428-1.427h-2.465c-.955 0-1.428.473-1.428 1.427v14.66c0 .954.473 1.435 1.428 1.435h2.465z"/></svg>';

      // 同步上一首 / 下一首可用性状态
      const hasNext = !!findNextVideoTrigger();
      const hasPrev = !!findPrevVideoTrigger() || (v && v.currentTime > 3);
      nextBtn.classList.toggle('disabled', !hasNext);
      nextBtn.title = hasNext ? '下一首 / 下一个视频' : '未检测到下一曲';
      prevBtn.classList.toggle('disabled', !hasPrev);
      prevBtn.title = hasPrev
        ? findPrevVideoTrigger()
          ? '上一首 / 上一个视频'
          : '从头重新播放'
        : '未检测到上一曲';

      // 实时同步切歌/分P切换后的标题更新与滚动计算
      const currentRaw = document.title || '未知视频/曲目';
      const currentCtx =
        typeof MusicMetadataParser !== 'undefined'
          ? MusicMetadataParser.extractDOMContext()
          : { mainTitle: currentRaw, partTitle: '', author: '' };
      const cleanMain =
        typeof MusicMetadataParser !== 'undefined'
          ? MusicMetadataParser.stripNoise(currentRaw)
          : cleanPageTitle(currentRaw);
      const cleanPart =
        typeof MusicMetadataParser !== 'undefined'
          ? MusicMetadataParser.stripNoise(currentCtx.partTitle)
          : '';
      const currentSignature = `${cleanMain}____${cleanPart}____${currentCtx.author || ''}____${location.pathname}${location.search}`;

      if (currentSignature !== lastKnownTitle && trackTitleText) {
        lastKnownTitle = currentSignature;
        const existingCover = artworkCard
          ? artworkCard.querySelector('.music-artwork-online-cover')
          : null;
        if (existingCover) {
          existingCover.removeAttribute('data-source-type');
          existingCover.removeAttribute('data-original-src');
        }
        currentLyricsCues = [];
        loadOnlineMetadata(currentRaw, currentCtx);
      }
    };

    playToggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const v = musicCinema ? musicCinema.video : video;
      if (v) {
        if (v.paused) {
          v.play().catch(() => {
            // 忽略播放被浏览器拦截的错误
          });
        } else {
          v.pause();
        }
        syncUIStatus();
      }
    });

    const syncProgressTimer = setInterval(syncUIStatus, 300);
    syncUIStatus();

    // 组装内容单列与舞台
    columnEl.appendChild(artworkWrap);
    columnEl.appendChild(scrubberWrap);
    columnEl.appendChild(controlsRow);

    const pomodoroBar = createPomodoroBar();
    if (pomodoroBar) {
      pomodoroBar.style.setProperty('width', '100%', 'important');
      columnEl.appendChild(pomodoroBar);
    }

    stageEl.appendChild(columnEl);
    stageEl.appendChild(lyricsContainerEl);
    console.log('[Music Mode] All stage elements added');

    // 右上角关闭/收起按钮 (对应 Apple Music 全屏视图收起按钮)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'music-close-btn';
    closeBtn.title = '收起音乐模式 (ESC)';
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg>';
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      exitMusicMode();
    });

    overlayEl.appendChild(bgBlurEl);
    overlayEl.appendChild(stageEl);
    overlayEl.appendChild(closeBtn);

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
      isUserActive = true;
      overlayEl.classList.add('user-active');
      overlayEl.classList.remove('user-idle');
      stageEl.classList.add('user-active');
      stageEl.classList.remove('user-idle');
      artworkCard.classList.add('user-active');
      artworkCard.classList.remove('user-idle');
      // 鼠标活动时标题隐藏，暂停无缝滚动
      if (titleTrack) {
        titleTrack.classList.remove('is-running');
      }
    };
    const hideMusicControls = () => {
      isUserActive = false;
      overlayEl.classList.remove('user-active');
      overlayEl.classList.add('user-idle');
      stageEl.classList.remove('user-active');
      stageEl.classList.add('user-idle');
      artworkCard.classList.remove('user-active');
      artworkCard.classList.add('user-idle');
      // 静止观赏态下标题可见，若标题溢出则启动无缝滚动
      if (titleTrack && titleTrack.classList.contains('is-marquee')) {
        titleTrack.classList.add('is-running');
      }
    };
    const handleMusicMouseMove = () => {
      showMusicControls();
      if (musicMouseIdleTimer) clearTimeout(musicMouseIdleTimer);
      musicMouseIdleTimer = setTimeout(() => {
        hideMusicControls();
      }, 3500);
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
      columnEl,
      artworkCard,
      trackTitleEl: trackTitleText,
      trackTitleDup,
      titleTrack,
      titleWrap,
      updateTitleMarquee,
      pomodoroBar,
      bgBlurEl,
      musicBlurController,
      radiosityController,
      loadOnlineMetadata,
      syncProgressTimer,
      progressRafId: null,
      musicMouseIdleTimer,
      handleMusicMouseMove,
      handleMusicMouseLeave
    };

    try {
      updateMusicModeSettings();
    } catch (error) {
      console.error('[Music Mode] Failed to update settings:', error);
    }

    ROOT().appendChild(overlayEl);
    console.log('[Music Mode] Overlay appended to DOM');
    console.log('[Music Mode] Music mode initialization complete');

    startProgressLoop();

    setTimeout(updateTitleMarquee, 60);
    window.addEventListener('resize', updateTitleMarquee);

    overlayEl.addEventListener('mousemove', handleMusicMouseMove);
    overlayEl.addEventListener('mouseenter', handleMusicMouseMove);
    overlayEl.addEventListener('mouseleave', handleMusicMouseLeave);

    artworkCard.addEventListener('mousemove', handleMusicMouseMove);
    artworkCard.addEventListener('mouseenter', handleMusicMouseMove);
    artworkCard.addEventListener('mouseleave', handleMusicMouseLeave);

    handleMusicMouseMove();
    setButtonVisible(false);
  }

  function exitMusicMode(immediate = false) {
    if (!musicCinema) return;
    if (musicCinema.isExiting && !immediate) return;

    const session = musicCinema;

    const cleanup = () => {
      if (session.collapseTimer) {
        clearTimeout(session.collapseTimer);
        session.collapseTimer = null;
      }

      const {
        video,
        player,
        saved,
        overlayEl,
        artworkCard,
        updateTitleMarquee,
        musicBlurController,
        radiosityController,
        syncProgressTimer,
        musicMouseIdleTimer,
        handleMusicMouseMove,
        handleMusicMouseLeave
      } = session;

      if (updateTitleMarquee) {
        window.removeEventListener('resize', updateTitleMarquee);
      }

      document.documentElement.classList.remove(
        'music-mode-active',
        'has-music-overlay',
        'clean-player-active'
      );
      document.body.classList.remove(
        'music-mode-active',
        'has-music-overlay',
        'clean-player-active'
      );
      try {
        if (window.top && window.top !== window && window.top.document) {
          window.top.document.documentElement.classList.remove(
            'music-mode-active',
            'has-music-overlay',
            'clean-player-active'
          );
          window.top.document.body.classList.remove(
            'music-mode-active',
            'has-music-overlay',
            'clean-player-active'
          );
        }
      } catch (e) {
        // 忽略跨域访问限制
      }

      if (musicBlurController) {
        musicBlurController.destroy();
      }

      if (radiosityController) {
        radiosityController.destroy();
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

      if (session.progressRafId) {
        cancelAnimationFrame(session.progressRafId);
        session.progressRafId = null;
      }
      if (syncProgressTimer) clearInterval(syncProgressTimer);

      const isPlayerMoved =
        saved &&
        (saved.playerMoved || (player && player.parentNode && player.parentNode !== saved.parent));
      if (isPlayerMoved && player && saved) {
        if (player.parentNode) {
          player.parentNode.removeChild(player);
        }
        if (saved.playerStyle != null && typeof player.setAttribute === 'function') {
          player.setAttribute('style', saved.playerStyle);
        } else if (typeof player.removeAttribute === 'function') {
          player.removeAttribute('style');
        }
        if (saved.videoStyle != null && typeof video.setAttribute === 'function') {
          video.setAttribute('style', saved.videoStyle);
        } else if (typeof video.removeAttribute === 'function') {
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

      if (musicCinema === session) {
        musicCinema = null;
      }
      console.log('[Exit Music Mode] musicCinema set to null');
      updateMusicModeSettings();
      // 延迟调用 updateButton，确保视频状态已更新
      setTimeout(() => {
        console.log('[Exit Music Mode] Calling updateButton() with delay');
        updateButton();
      }, 100);
    };

    if (immediate || !session.overlayEl) {
      cleanup();
    } else {
      session.isExiting = true;
      session.overlayEl.classList.add('is-collapsing');
      session.collapseTimer = setTimeout(() => {
        cleanup();
      }, 360);
    }
  }

  /* ---------- 状态刷新与自愈恢复 ---------- */

  function isCinemaOrMusicActive() {
    if (cinema || musicCinema) return true;
    if (
      document.getElementById('music-mode-overlay') ||
      document.getElementById('cinema-mode-overlay') ||
      document.body.classList.contains('has-music-overlay') ||
      document.body.classList.contains('has-cinema-overlay') ||
      document.body.classList.contains('music-mode-active') ||
      document.body.classList.contains('cinema-mode-active')
    ) {
      return true;
    }
    try {
      if (window.top && window.top !== window && window.top.document) {
        if (
          window.top.document.getElementById('music-mode-overlay') ||
          window.top.document.getElementById('cinema-mode-overlay') ||
          window.top.document.body.classList.contains('has-music-overlay') ||
          window.top.document.body.classList.contains('has-cinema-overlay') ||
          window.top.document.body.classList.contains('music-mode-active') ||
          window.top.document.body.classList.contains('cinema-mode-active')
        ) {
          return true;
        }
      }
    } catch (e) {
      // 忽略跨域访问限制
    }
    return false;
  }

  function updateButton() {
    if (isCinemaOrMusicActive()) {
      setButtonVisible(false);
      return;
    }
    const best = findBestVideo();
    const isPlaying = (best && isPlayingVideo(best)) || isNeteasePlaying();
    if (isPlaying) {
      ensureButton();
      setButtonVisible(true);
      autoExpandYouTubeDescription();
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
    if (!newVideo || (!isValidVideo(newVideo) && !isValidAudio(newVideo))) {
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
      if (session.radiosityController) {
        session.radiosityController.rebindVideo(newVideo);
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
      if (session.loadOnlineMetadata) {
        session.loadOnlineMetadata(document.title || '');
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
            exitMusicMode(true);
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

  /**
   * 针对 YouTube 视频页面：页面加载与切歌时自动提前展开下方说明栏
   * 使得 Polymer 音乐版权卡片 (yt-video-attribute-view-model) 与高清封面从打开页面起即加载就绪
   */
  function autoExpandYouTubeDescription() {
    if (typeof location === 'undefined' || !location.hostname.includes('youtube.com')) return;

    const tryExpand = () => {
      const expandBtn = document.querySelector(
        '#description-inline-expander #expand, ' +
          'ytd-text-inline-expander #expand, ' +
          '#description #expand, ' +
          '#description-inline-expander [aria-label*="more"], ' +
          '#description-inline-expander [aria-label*="展开"], ' +
          'tp-yt-paper-button#expand'
      );
      if (expandBtn && typeof expandBtn.click === 'function') {
        const isCollapsed =
          document.querySelector(
            '#description-inline-expander[collapsed], ytd-text-inline-expander[collapsed]'
          ) || expandBtn.offsetParent !== null;
        if (isCollapsed) {
          try {
            expandBtn.click();
          } catch (e) {
            // 忽略非交互异常
          }
        }
      }
    };

    tryExpand();
    setTimeout(tryExpand, 600);
    setTimeout(tryExpand, 1800);
  }

  if (
    typeof window !== 'undefined' &&
    typeof location !== 'undefined' &&
    location.hostname.includes('youtube.com')
  ) {
    window.addEventListener('yt-navigate-finish', () => autoExpandYouTubeDescription(), true);
    window.addEventListener('yt-page-data-updated', () => autoExpandYouTubeDescription(), true);
    window.addEventListener('spfdone', () => autoExpandYouTubeDescription(), true);
    window.addEventListener('popstate', () => autoExpandYouTubeDescription(), true);
    document.addEventListener('DOMContentLoaded', () => autoExpandYouTubeDescription(), true);
    autoExpandYouTubeDescription();
  }

  ensureButton();
  updateButton();
})();
