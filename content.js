(() => {
  'use strict';

  const BTN_ID = 'cinema-mode-toggle-btn';
  const OVERLAY_ID = 'cinema-mode-overlay';
  const SCAN_INTERVAL = 500;
  const ROOT = () => document.body || document.documentElement;

  let btn = null;
  let overlay = null;
  let stage = null;
  let cinema = null;

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
    musicStaticCoverEnabled: false
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentSettings, (items) => {
      currentSettings = Object.assign({}, currentSettings, items);
      currentSettings.musicCardWidth = parseInt(currentSettings.musicCardWidth, 10) || 380;
      currentSettings.musicPadding = parseInt(currentSettings.musicPadding, 10) || 40;
      currentSettings.musicClockTopOffset = parseInt(currentSettings.musicClockTopOffset, 10) || 50;
      currentSettings.musicBlurRadius = parseInt(currentSettings.musicBlurRadius, 10) || 65;
      if (items.cleanPlayerEnabled === undefined) currentSettings.cleanPlayerEnabled = true;
      if (items.blurHashEnabled === undefined) currentSettings.blurHashEnabled = true;
      if (items.ambilightWaveEnabled === undefined) currentSettings.ambilightWaveEnabled = true;
      if (items.ambilightEnabled === undefined) currentSettings.ambilightEnabled = true;
    });
    function applySettingsUpdate(newSettings) {
      if (!newSettings) return;
      currentSettings = Object.assign({}, currentSettings, newSettings);

      if (newSettings.overlayOpacity !== undefined && overlay) {
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${newSettings.overlayOpacity})`;
      }
      if (newSettings.cleanPlayerEnabled !== undefined && (cinema || musicCinema)) {
        document.documentElement.classList.toggle('clean-player-active', !!newSettings.cleanPlayerEnabled);
        document.body.classList.toggle('clean-player-active', !!newSettings.cleanPlayerEnabled);
      }
      if (newSettings.ambilightEnabled !== undefined && cinema && cinema.ambilightEl) {
        cinema.ambilightEl.style.display = newSettings.ambilightEnabled ? 'block' : 'none';
      }
      if (newSettings.blurHashEnabled !== undefined) {
        if (cinema && cinema.ambilightController) {
          cinema.ambilightController.updateOptions({ enableBlurHash: !!newSettings.blurHashEnabled });
        }
        if (musicCinema && musicCinema.musicBlurController) {
          musicCinema.musicBlurController.updateOptions({ enableBlurHash: !!newSettings.blurHashEnabled });
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
      if (newSettings.musicCardWidth !== undefined && musicCinema) {
        if (musicCinema.artworkCard) musicCinema.artworkCard.style.width = `${newSettings.musicCardWidth}px`;
        if (musicCinema.controlsCard) musicCinema.controlsCard.style.width = `${newSettings.musicCardWidth}px`;
      }
      if (newSettings.musicPadding !== undefined && musicCinema && musicCinema.stageEl) {
        musicCinema.stageEl.style.padding = `${newSettings.musicPadding}px`;
      }
      if (newSettings.musicClockTopOffset !== undefined && musicCinema && musicCinema.clockHeader) {
        musicCinema.clockHeader.style.marginTop = `${newSettings.musicClockTopOffset}px`;
      }
      if (newSettings.musicBlurRadius !== undefined && musicCinema && musicCinema.bgBlurEl) {
        musicCinema.bgBlurEl.style.filter = `blur(${newSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
      }
      if (newSettings.musicStaticCoverEnabled !== undefined && musicCinema && musicCinema.musicBlurController) {
        musicCinema.musicBlurController.updateOptions({ isStatic: !!newSettings.musicStaticCoverEnabled });
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
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        const updated = {};
        for (const k in changes) {
          updated[k] = changes[k].newValue;
        }
        applySettingsUpdate(updated);
      }
    });

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'SETTINGS_UPDATED' && msg.settings) {
          applySettingsUpdate(msg.settings);
        }
      });
    }
  }

  /* ---------- 历史记录管理 (最多90条，播放满1分钟方可入库) ---------- */
  let recordedUrlForPage = '';

  function recordWatchHistory(video) {
    try {
      const url = window.location.href;
      if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return;
      if (recordedUrlForPage === url) return;

      // 必须播放达到或超过 1 分钟 (60秒) 才录入，防止误记
      if (!video || typeof video.currentTime !== 'number' || video.currentTime < 60) {
        return;
      }

      const rawTitle = document.title || url;
      const title = rawTitle.trim().replace(/\s+/g, ' ');
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ history: [] }, (res) => {
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

          chrome.storage.local.set({ history: list }, () => {
            recordedUrlForPage = url;
          });
        });
      }
    } catch (e) {
      console.warn('[Theater Mode] Failed to record watch history:', e);
    }
  }

  const px = (n) => `${n}px`;

  /* ---------- 检测 ---------- */

  function visibleArea(v) {
    const r = v.getBoundingClientRect();
    const left = Math.max(0, r.left);
    const top = Math.max(0, r.top);
    const right = Math.min(window.innerWidth, r.right);
    const bottom = Math.min(window.innerHeight, r.bottom);
    const w = right - left;
    const h = bottom - top;
    return w > 0 && h > 0 ? w * h : 0;
  }

  function isActiveVideo(v) {
    if (!v || v.readyState < 2) return false;
    if (visibleArea(v) <= 0) return false;
    return !v.paused || v.currentTime > 0;
  }

  function findBestVideo() {
    let best = null;
    let maxArea = 0;
    for (const v of document.querySelectorAll('video')) {
      const area = visibleArea(v);
      if (area <= 0) continue;
      if (area > maxArea) {
        maxArea = area;
        best = v;
      }
    }
    return best;
  }

  /* ---------- 悬浮按钮 ---------- */

  function ensureButton() {
    if (btn) return;
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

    btn.querySelector('#cinema-btn-cinema').addEventListener('click', (e) => {
      e.stopPropagation();
      const v = findBestVideo();
      if (v) enterCinema(v);
    });

    btn.querySelector('#cinema-btn-music').addEventListener('click', (e) => {
      e.stopPropagation();
      const v = findBestVideo();
      if (v) enterMusicMode(v);
    });

    ROOT().appendChild(btn);
  }

  function setButtonVisible(v) {
    if (!btn) return;
    btn.classList.toggle('visible', v);
  }

  /* ---------- 影院模式 ---------- */

  const EXTRA_BAR_SELECTORS = [
    '.bpx-player-sending-bar',
    '.bpx-player-sending-area',
    '.bilibili-player-video-sendbar',
    '.bilibili-player-area-danmaku-send',
    '.bpx-player-video-inputbar',
    '.bpx-player-sending-area-left',
    '.bpx-player-sending-area-right',
    '#arc_toolbar_report',
    '.video-toolbar-v1',
    '.video-toolbar-container',
    '.bpx-player-shadow-progress',
    '.txp_bottom',
    '.txp_tool',
    '.txp_danmu_send',
    '.iqp-bottom',
    '.iqp-tool',
    '.iqp-danmu-send',
    '.iqp-send-bar',
    '.youku-layer-sendbar',
    '.k-send-bar',
    '.play-fn-container',
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
  ];

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
      { label: '-10m', delta: -600, title: '回退 10 分钟' },
      { label: '-1m', delta: -60, title: '回退 1 分钟' },
      { label: '-10s', delta: -10, title: '回退 10 秒' },
      { label: '+10s', delta: 10, title: '快进 10 秒' },
      { label: '+1m', delta: 60, title: '快进 1 分钟' },
      { label: '+10m', delta: 600, title: '快进 10 分钟' }
    ];

    buttonsConfig.forEach(cfg => {
      const b = document.createElement('button');
      b.className = 'cinema-ctrl-btn';
      b.textContent = cfg.label;
      b.title = cfg.title;
      b.addEventListener('click', (e) => {
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
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          const cues = SubtitleParser.parse(content, file.name);
          if (subtitleRenderer) {
            subtitleRenderer.setCues(cues);
          }
          const shortName = file.name.length > 8 ? file.name.slice(0, 8) + '...' : file.name;
          uploadBtn.innerHTML = `✅ ${shortName}`;
          uploadBtn.title = `已加载字幕: ${file.name} (${cues.length}条)`;
        } catch (err) {
          alert(`字幕解析失败：\n${err.message}`);
          uploadBtn.innerHTML = '📂 加载失败';
        }
      };
      reader.onerror = () => {
        alert('读取字幕文件失败！');
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
    musicModeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const v = video;
      exitCinema();
      enterMusicMode(v);
    });
    controlBar.appendChild(musicModeBtn);

    overlay.appendChild(stage);
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

      const innerContainers = player.querySelectorAll('.html5-video-container, .bpx-player-video-area, .bpx-player-primary-area');
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
      ambilightEl.className = 'cinema-ambilight-glow' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
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

    let hiddenElements = [];
    if (currentSettings.cleanPlayerEnabled !== false) {
      EXTRA_BAR_SELECTORS.forEach(sel => {
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

    overlay = null;
    stage = null;
    cinema = null;
    updateButton();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  /* ---------- 🎵 音乐模式 (iOS 锁屏美学) ---------- */

  let musicCinema = null;

  function enterMusicMode(video) {
    if (!video) return;
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

    // 动态 3D 氛围光背景 (优先尝试 BlurHash 算法极佳色彩晕染)
    const bgBlurEl = document.createElement('div');
    bgBlurEl.className = 'music-bg-blur' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
    bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;

    let musicBlurController = null;

    if (typeof BlurBackgroundController !== 'undefined') {
      musicBlurController = new BlurBackgroundController(video, {
        enableBlurHash: currentSettings.blurHashEnabled !== false,
        isStatic: !!currentSettings.musicStaticCoverEnabled,
        throttleMs: 150
      });
      musicBlurController.mount(bgBlurEl);
    }

    // 锁屏全局框架
    const stageEl = document.createElement('div');
    stageEl.className = 'music-lockscreen-stage';
    stageEl.style.padding = `${currentSettings.musicPadding}px`;

    // 1. 顶部时间与日期 (iOS 锁屏横向排版 12:12  8月9日 星期日)
    const clockHeader = document.createElement('div');
    clockHeader.className = 'music-clock-header';
    clockHeader.style.marginTop = `${currentSettings.musicClockTopOffset}px`;

    const timeText = document.createElement('span');
    timeText.className = 'music-time-text';

    const dateText = document.createElement('span');
    dateText.className = 'music-date-text';

    const updateClock = () => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      timeText.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const options = { month: 'short', day: 'numeric', weekday: 'short' };
      dateText.textContent = now.toLocaleDateString('zh-CN', options);
    };
    updateClock();
    let clockTimer = setInterval(updateClock, 1000);

    clockHeader.appendChild(timeText);
    clockHeader.appendChild(dateText);

    // 2. 独立专辑封面大卡片 (视频真实宽高比动态自适应，消除黑边)
    const artworkCard = document.createElement('div');
    artworkCard.className = 'music-artwork-card';
    artworkCard.style.width = `${currentSettings.musicCardWidth}px`;

    const updateArtworkAspectRatio = () => {
      if (video) {
        const ar = getVideoAspectRatio(video);
        artworkCard.style.aspectRatio = `${ar}`;
      }
    };
    updateArtworkAspectRatio();
    video.addEventListener('loadedmetadata', updateArtworkAspectRatio);
    video.addEventListener('resize', updateArtworkAspectRatio);

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
        isStaticCaptured = false;
      }

      if (isStaticCaptured) {
        staticCanvas.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit;';
        artworkCard.appendChild(staticCanvas);
      } else {
        const img = document.createElement('img');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit;';
        img.src = video.poster || '';
        artworkCard.appendChild(img);
      }
    } else {
      player.style.width = '100%';
      player.style.height = '100%';
      player.style.objectFit = 'cover';
      artworkCard.appendChild(player);
    }

    // 3. 独立 iOS 播放控件小面板 (在封面正下方)
    const controlsCard = document.createElement('div');
    controlsCard.className = 'music-controls-card';
    controlsCard.style.width = `${currentSettings.musicCardWidth}px`;

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
    modeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/></svg>';
    modeBtn.addEventListener('click', (e) => {
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

    const formatSec = (sec) => {
      if (isNaN(sec) || sec < 0) return '0:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    let isDraggingSlider = false;
    slider.addEventListener('mousedown', () => { isDraggingSlider = true; });
    slider.addEventListener('mouseup', () => {
      isDraggingSlider = false;
      if (video && !isNaN(video.duration)) {
        video.currentTime = (parseFloat(slider.value) / 100) * video.duration;
      }
      updateSliderBg();
    });
    slider.addEventListener('input', () => {
      if (video && !isNaN(video.duration)) {
        const cur = (parseFloat(slider.value) / 100) * video.duration;
        curTimeSpan.textContent = formatSec(cur);
        durTimeSpan.textContent = `-${formatSec(video.duration - cur)}`;
      }
      updateSliderBg();
    });

    let syncProgressTimer = setInterval(() => {
      if (video && !isNaN(video.duration) && video.duration > 0) {
        if (!isDraggingSlider) {
          slider.value = (video.currentTime / video.duration) * 100;
          curTimeSpan.textContent = formatSec(video.currentTime);
          durTimeSpan.textContent = `-${formatSec(video.duration - video.currentTime)}`;
          updateSliderBg();
        }
      }
    }, 500);

    // 纯极简 Icon 控制条 (纯 Icon 无文字，极简苹果风格)
    const ctrlRow = document.createElement('div');
    ctrlRow.className = 'music-ctrl-row';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'music-icon-btn';
    muteBtn.title = video.muted ? '取消静音' : '静音';
    muteBtn.innerHTML = video.muted
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    });

    const rewindBtn = document.createElement('button');
    rewindBtn.className = 'music-icon-btn';
    rewindBtn.title = '回退 15 秒';
    rewindBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5l-7 7 7 7V5zm9 0l-7 7 7 7V5z"/></svg>';
    rewindBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video && !isNaN(video.duration)) video.currentTime = Math.max(0, video.currentTime - 15);
    });

    const playToggleBtn = document.createElement('button');
    playToggleBtn.className = 'music-icon-btn play-main';
    playToggleBtn.title = video.paused ? '播放' : '暂停';
    playToggleBtn.innerHTML = video.paused
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>';
    playToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video.paused) {
        video.play().catch(() => {});
        playToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>';
      } else {
        video.pause();
        playToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>';
      }
    });

    const forwardBtn = document.createElement('button');
    forwardBtn.className = 'music-icon-btn';
    forwardBtn.title = '快进 15 秒';
    forwardBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 19l7-7-7-7v14zm-9 0l7-7-7-7v14z"/></svg>';
    forwardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video && !isNaN(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 15);
    });

    const subBtn = document.createElement('button');
    subBtn.className = 'music-icon-btn';
    subBtn.title = '加载本地字幕';
    subBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 4H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>';
    const subFileInput = document.createElement('input');
    subFileInput.type = 'file';
    subFileInput.accept = '.srt,.vtt,.ass';
    subFileInput.style.display = 'none';
    subFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target.result;
          SubtitleParser.parse(content, file.name);
          alert(`字幕文件解析成功！`);
        } catch (err) {
          alert(`字幕解析失败：${err.message}`);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
    subBtn.addEventListener('click', (e) => {
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

    stageEl.appendChild(clockHeader);
    stageEl.appendChild(artworkCard);
    stageEl.appendChild(controlsCard);

    overlayEl.appendChild(bgBlurEl);
    overlayEl.appendChild(stageEl);

    ROOT().appendChild(overlayEl);

    // 鼠标在封面/播放器卡片上划过与无操作 2.5s 自动柔和隐藏播放器内置控件/头像/暂停图标
    let musicMouseIdleTimer = null;
    const showMusicControls = () => {
      artworkCard.classList.add('user-active');
      artworkCard.classList.remove('user-idle');
    };
    const hideMusicControls = () => {
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

    artworkCard.addEventListener('mousemove', handleMusicMouseMove);
    artworkCard.addEventListener('mouseenter', handleMusicMouseMove);
    artworkCard.addEventListener('mouseleave', handleMusicMouseLeave);

    handleMusicMouseMove();

    musicCinema = {
      video,
      player,
      saved,
      overlayEl,
      stageEl,
      artworkCard,
      controlsCard,
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

    setButtonVisible(false);
  }

  function exitMusicMode() {
    if (!musicCinema) return;
    const { video, player, saved, overlayEl, artworkCard, musicBlurController, clockTimer, syncProgressTimer, musicMouseIdleTimer, handleMusicMouseMove, handleMusicMouseLeave, updateArtworkAspectRatio } = musicCinema;

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

    if (artworkCard && handleMusicMouseMove && handleMusicMouseLeave) {
      artworkCard.removeEventListener('mousemove', handleMusicMouseMove);
      artworkCard.removeEventListener('mouseenter', handleMusicMouseMove);
      artworkCard.removeEventListener('mouseleave', handleMusicMouseLeave);
    }
    if (musicMouseIdleTimer) clearTimeout(musicMouseIdleTimer);

    if (clockTimer) clearInterval(clockTimer);
    if (syncProgressTimer) clearInterval(syncProgressTimer);

    if (saved && saved.playerMoved) {
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

    musicCinema = null;
    updateButton();
  }

  /* ---------- 状态刷新 ---------- */

  function updateButton() {
    if (cinema || musicCinema) {
      setButtonVisible(false);
      return;
    }
    const active = Array.from(document.querySelectorAll('video')).some(isActiveVideo);
    setButtonVisible(active);
  }

  setInterval(() => {
    const activeVideo = cinema ? cinema.video : (musicCinema ? musicCinema.video : findBestVideo());
    if (activeVideo && isActiveVideo(activeVideo)) {
      recordWatchHistory(activeVideo);
    }

    if (cinema) {
      if (!cinema.video.isConnected || !cinema.player.isConnected) {
        exitCinema();
      } else {
        if (cinema.subtitleRenderer && cinema.video) {
          cinema.subtitleRenderer.syncTime(cinema.video.currentTime);
        }
        if (currentSettings.cleanPlayerEnabled !== false) {
          EXTRA_BAR_SELECTORS.forEach(sel => {
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
      if (!musicCinema.video.isConnected || !musicCinema.player.isConnected) {
        exitMusicMode();
      }
      return;
    }
    updateButton();
  }, 500);

  document.addEventListener('play', () => {
    updateButton();
    const best = findBestVideo();
    if (best && isActiveVideo(best)) {
      recordWatchHistory(best);
    }
  }, true);
  document.addEventListener('pause', () => updateButton(), true);

  document.addEventListener('keydown', (e) => {
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
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement && document.activeElement.isContentEditable)) return;

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
  }, true);

  window.addEventListener('resize', () => {
    if (cinema && cinema.updateStageDimensions) {
      cinema.updateStageDimensions();
    }
  });

  ensureButton();
  updateButton();
})();
