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
    ambilightWaveEnabled: true,
    ambilightIntensity: 0.65,
    musicCardWidth: 380,
    musicPadding: 40,
    musicClockTopOffset: 50,
    musicBlurRadius: 65
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentSettings, (items) => {
      currentSettings = Object.assign({}, currentSettings, items);
      if (items.cleanPlayerEnabled === undefined) currentSettings.cleanPlayerEnabled = true;
      if (items.ambilightWaveEnabled === undefined) currentSettings.ambilightWaveEnabled = true;
      if (items.ambilightEnabled === undefined) currentSettings.ambilightEnabled = true;
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        if (changes.jDuration) currentSettings.jDuration = changes.jDuration.newValue;
        if (changes.jKey) currentSettings.jKey = changes.jKey.newValue;
        if (changes.lDuration) currentSettings.lDuration = changes.lDuration.newValue;
        if (changes.lKey) currentSettings.lKey = changes.lKey.newValue;
        if (changes.overlayOpacity) {
          currentSettings.overlayOpacity = changes.overlayOpacity.newValue;
          if (overlay) {
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentSettings.overlayOpacity})`;
          }
        }
        if (changes.cleanPlayerEnabled) {
          currentSettings.cleanPlayerEnabled = changes.cleanPlayerEnabled.newValue;
          if (cinema || musicCinema) {
            document.documentElement.classList.toggle('clean-player-active', !!currentSettings.cleanPlayerEnabled);
            document.body.classList.toggle('clean-player-active', !!currentSettings.cleanPlayerEnabled);
          }
        }
        if (changes.subFontSize) currentSettings.subFontSize = changes.subFontSize.newValue;
        if (changes.subFontColor) currentSettings.subFontColor = changes.subFontColor.newValue;
        if (changes.subBgColor) currentSettings.subBgColor = changes.subBgColor.newValue;
        if (changes.subBgOpacity) currentSettings.subBgOpacity = changes.subBgOpacity.newValue;
        if (changes.subFontWeight) currentSettings.subFontWeight = changes.subFontWeight.newValue;
        if (changes.subBottomOffset) currentSettings.subBottomOffset = changes.subBottomOffset.newValue;
        if (changes.ambilightEnabled) currentSettings.ambilightEnabled = changes.ambilightEnabled.newValue;
        if (changes.ambilightWaveEnabled) {
          currentSettings.ambilightWaveEnabled = changes.ambilightWaveEnabled.newValue;
          if (cinema && cinema.ambilightEl) {
            cinema.ambilightEl.classList.toggle('has-edge-wave', !!currentSettings.ambilightWaveEnabled);
          }
        }
        if (changes.ambilightIntensity) {
          currentSettings.ambilightIntensity = changes.ambilightIntensity.newValue;
          if (cinema && cinema.ambilightEl) {
            cinema.ambilightEl.style.opacity = currentSettings.ambilightIntensity;
          }
        }
        if (changes.musicCardWidth) {
          currentSettings.musicCardWidth = changes.musicCardWidth.newValue;
          if (musicCinema && musicCinema.overlayEl) {
            const artCard = musicCinema.overlayEl.querySelector('.music-artwork-card');
            const ctrlCard = musicCinema.overlayEl.querySelector('.music-controls-card');
            if (artCard) artCard.style.width = `${currentSettings.musicCardWidth}px`;
            if (ctrlCard) ctrlCard.style.width = `${currentSettings.musicCardWidth}px`;
          }
        }
        if (changes.musicPadding) {
          currentSettings.musicPadding = changes.musicPadding.newValue;
          if (musicCinema && musicCinema.stageEl) {
            musicCinema.stageEl.style.padding = `${currentSettings.musicPadding}px 24px`;
          }
        }
        if (changes.musicClockTopOffset) {
          currentSettings.musicClockTopOffset = changes.musicClockTopOffset.newValue;
          if (musicCinema && musicCinema.overlayEl) {
            const clock = musicCinema.overlayEl.querySelector('.music-clock-header');
            if (clock) clock.style.marginTop = `${currentSettings.musicClockTopOffset}px`;
          }
        }
        if (changes.musicBlurRadius) {
          currentSettings.musicBlurRadius = changes.musicBlurRadius.newValue;
          if (musicCinema && musicCinema.overlayEl) {
            const bg = musicCinema.overlayEl.querySelector('.music-bg-blur');
            if (bg) bg.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;
          }
        }

        // 如果字幕渲染器已存在，实时更新其样式设置
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
    });
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

    // 1. 使用 closest 优先精确定位核心画面容器，剥离 Bilibili、YouTube、腾讯等平台的发弹幕工具条与侧栏
    const coreContainer = video.closest(
      '.bpx-player-video-area, .bilibili-player-video-area, .html5-video-container, .txp_video_container, .iqp-player-video, .xgplayer'
    );
    if (coreContainer) {
      return coreContainer;
    }

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

  function computeStageWidth(video) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vr =
      video.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : (video.clientWidth && video.clientHeight ? video.clientWidth / video.clientHeight : 16 / 9);
    return Math.min(vw * 0.94, vh * 0.94 * vr);
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

    stage.style.width = px(computeStageWidth(video));
    player.style.width = '100%';
    player.style.height = 'auto';
    player.style.margin = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.objectFit = 'contain';

    // 初始化字幕渲染器模块
    const subtitleRenderer = new SubtitleRenderer(stage, {
      fontSize: currentSettings.subFontSize,
      fontColor: currentSettings.subFontColor,
      bgColor: currentSettings.subBgColor,
      bgOpacity: currentSettings.subBgOpacity,
      fontWeight: currentSettings.subFontWeight,
      bottomOffset: currentSettings.subBottomOffset
    });

    // 网页背景氛围光（Ambilight 氛围光双向渲染，实时 Canvas 与 MSE/CORS 降级兼顾）
    let ambilightEl = null;
    let ambilightInterval = null;
    let removeAmbilightEvents = null;

    if (currentSettings.ambilightEnabled) {
      ambilightEl = document.createElement('div');
      ambilightEl.className = 'cinema-ambilight-glow' + (currentSettings.ambilightWaveEnabled ? ' has-edge-wave' : '');
      ambilightEl.style.opacity = currentSettings.ambilightIntensity;

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      canvas.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
      const ctx = canvas.getContext('2d', { alpha: false });

      ambilightEl.appendChild(canvas);
      stage.appendChild(ambilightEl);

      let usesFallbackVideo = false;
      let glowVideo = null;

      const drawAmbilight = () => {
        if (!video || !video.isConnected) return;
        if (usesFallbackVideo) {
          if (glowVideo) {
            if (glowVideo.paused !== video.paused) {
              video.paused ? glowVideo.pause() : glowVideo.play().catch(() => {});
            }
            if (Math.abs(glowVideo.currentTime - video.currentTime) > 0.3) {
              glowVideo.currentTime = video.currentTime;
            }
          }
          return;
        }

        try {
          if (video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } catch (e) {
          if (!usesFallbackVideo) {
            usesFallbackVideo = true;
            canvas.remove();
            glowVideo = video.cloneNode(true);
            glowVideo.muted = true;
            glowVideo.removeAttribute('id');
            glowVideo.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block; border-radius:24px;';
            ambilightEl.appendChild(glowVideo);
            if (!video.paused) glowVideo.play().catch(() => {});
          }
        }
      };

      // 立即触发首次绘制，解决暂停状态进入影院模式灯光不亮问题
      drawAmbilight();

      const onUpdate = () => drawAmbilight();
      video.addEventListener('play', onUpdate);
      video.addEventListener('pause', onUpdate);
      video.addEventListener('seeked', onUpdate);
      video.addEventListener('timeupdate', onUpdate);
      video.addEventListener('canplay', onUpdate);

      removeAmbilightEvents = () => {
        video.removeEventListener('play', onUpdate);
        video.removeEventListener('pause', onUpdate);
        video.removeEventListener('seeked', onUpdate);
        video.removeEventListener('timeupdate', onUpdate);
        video.removeEventListener('canplay', onUpdate);
      };

      ambilightInterval = setInterval(() => {
        if (video && (!video.paused || usesFallbackVideo) && !video.ended) {
          drawAmbilight();
        }
      }, 100);
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

    // 鼠标在播放器封面/舞台区域内移动时同步显示播放控制条/字幕工具，无操作 2.5 秒后自动柔和隐蔽
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
      ambilightInterval, 
      removeAmbilightEvents, 
      hiddenElements,
      stageRef,
      handleMouseMove,
      handleMouseLeave,
      mouseIdleTimer
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
      ambilightInterval, 
      removeAmbilightEvents, 
      hiddenElements,
      stageRef,
      handleMouseMove,
      handleMouseLeave,
      mouseIdleTimer
    } = cinema;

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

    if (removeAmbilightEvents) {
      removeAmbilightEvents();
    }

    if (subtitleRenderer) {
      subtitleRenderer.destroy();
    }

    if (ambilightInterval) {
      clearInterval(ambilightInterval);
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
    const saved = {
      parent: player.parentNode,
      next: player.nextSibling,
      playerStyle: player.getAttribute('style'),
      videoStyle: video.getAttribute('style')
    };

    const overlayEl = document.createElement('div');
    overlayEl.id = 'music-mode-overlay';

    // 动态模糊主色调背景
    const bgBlurEl = document.createElement('div');
    bgBlurEl.className = 'music-bg-blur';
    bgBlurEl.style.filter = `blur(${currentSettings.musicBlurRadius}px) brightness(0.68) saturate(180%)`;

    // 采样 DOM 动态主色提取器
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 16;
    sampleCanvas.height = 16;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    let updateBgColorTimer = setInterval(() => {
      if (!video || !video.isConnected) return;
      try {
        if (video.readyState >= 2) {
          sampleCtx.drawImage(video, 0, 0, 16, 16);
          const data = sampleCtx.getImageData(0, 0, 16, 16).data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          bgBlurEl.style.background = `radial-gradient(circle at 50% 30%, rgba(${r},${g},${b},0.85), rgba(${Math.max(0, r-50)},${Math.max(0, g-50)},${Math.max(0, b-50)},0.95) 75%, #050505 100%)`;
        }
      } catch (e) {
        bgBlurEl.style.background = `radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.45), rgba(15, 23, 42, 0.95) 75%, #050505 100%)`;
      }
    }, 250);

    // 锁屏全局框架
    const stageEl = document.createElement('div');
    stageEl.className = 'music-lockscreen-stage';
    stageEl.style.padding = `${currentSettings.musicPadding}px 24px`;

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

    // 2. 独立专辑封面大卡片 (与下控件隔离)
    const artworkCard = document.createElement('div');
    artworkCard.className = 'music-artwork-card';
    artworkCard.style.width = `${currentSettings.musicCardWidth}px`;

    player.style.width = '100%';
    player.style.height = '100%';
    player.style.objectFit = 'cover';
    artworkCard.appendChild(player);

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
    });
    slider.addEventListener('input', () => {
      if (video && !isNaN(video.duration)) {
        const cur = (parseFloat(slider.value) / 100) * video.duration;
        curTimeSpan.textContent = formatSec(cur);
        durTimeSpan.textContent = `-${formatSec(video.duration - cur)}`;
      }
    });

    let syncProgressTimer = setInterval(() => {
      if (video && !isNaN(video.duration) && video.duration > 0) {
        if (!isDraggingSlider) {
          slider.value = (video.currentTime / video.duration) * 100;
          curTimeSpan.textContent = formatSec(video.currentTime);
          durTimeSpan.textContent = `-${formatSec(video.duration - video.currentTime)}`;
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

    musicCinema = {
      video,
      player,
      saved,
      overlayEl,
      stageEl,
      clockTimer,
      updateBgColorTimer,
      syncProgressTimer
    };

    setButtonVisible(false);
  }

  function exitMusicMode() {
    if (!musicCinema) return;
    const { video, player, saved, overlayEl, clockTimer, updateBgColorTimer, syncProgressTimer } = musicCinema;

    document.documentElement.classList.remove('music-mode-active');
    document.body.classList.remove('music-mode-active');
    document.documentElement.classList.remove('clean-player-active');
    document.body.classList.remove('clean-player-active');

    if (clockTimer) clearInterval(clockTimer);
    if (updateBgColorTimer) clearInterval(updateBgColorTimer);
    if (syncProgressTimer) clearInterval(syncProgressTimer);

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
    if (cinema && stage) {
      stage.style.width = px(computeStageWidth(cinema.video));
    }
  });

  ensureButton();
  updateButton();
})();
