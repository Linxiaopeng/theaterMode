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
    lDuration: 60,
    overlayOpacity: 0.88,
    subFontSize: 18,
    subFontColor: '#ffffff',
    subBgColor: '#000000',
    subBgOpacity: 0.6,
    subFontWeight: '500',
    subBottomOffset: 30
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(currentSettings, (items) => {
      currentSettings = items;
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        if (changes.jDuration) currentSettings.jDuration = changes.jDuration.newValue;
        if (changes.lDuration) currentSettings.lDuration = changes.lDuration.newValue;
        if (changes.overlayOpacity) {
          currentSettings.overlayOpacity = changes.overlayOpacity.newValue;
          if (overlay) {
            overlay.style.backgroundColor = `rgba(0, 0, 0, ${currentSettings.overlayOpacity})`;
          }
        }
        if (changes.subFontSize) currentSettings.subFontSize = changes.subFontSize.newValue;
        if (changes.subFontColor) currentSettings.subFontColor = changes.subFontColor.newValue;
        if (changes.subBgColor) currentSettings.subBgColor = changes.subBgColor.newValue;
        if (changes.subBgOpacity) currentSettings.subBgOpacity = changes.subBgOpacity.newValue;
        if (changes.subFontWeight) currentSettings.subFontWeight = changes.subFontWeight.newValue;
        if (changes.subBottomOffset) currentSettings.subBottomOffset = changes.subBottomOffset.newValue;

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
    btn.title = '影院模式（按 ESC 退出）';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', '进入影院模式');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="4" width="19" height="16" rx="3"/>' +
      '<path d="M10 9v6l5-3z" fill="currentColor" stroke="none"/>' +
      '</svg>';
    btn.addEventListener('click', () => {
      const v = findBestVideo();
      if (v) enterCinema(v);
    });
    ROOT().appendChild(btn);
  }

  function setButtonVisible(v) {
    if (!btn) return;
    btn.classList.toggle('visible', v);
  }

  /* ---------- 影院模式 ---------- */

  function findPlayerContainer(video) {
    const vw = video.getBoundingClientRect().width;
    let el = video;
    for (let i = 0; i < 5; i++) {
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

    const exitBtn = document.createElement('button');
    exitBtn.className = 'cinema-exit-btn';
    exitBtn.title = '退出影院模式（ESC）';
    exitBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
      '</svg>';
    exitBtn.addEventListener('click', exitCinema);

    const hint = document.createElement('div');
    hint.className = 'cinema-hint';
    hint.textContent = '按 ESC 退出影院模式';

    stage.appendChild(exitBtn);
    stage.appendChild(hint);
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

    overlay.appendChild(controlBar);
    overlay.appendChild(stage);
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

    cinema = { video, player, saved, subtitleRenderer };
    setButtonVisible(false);

    requestAnimationFrame(() => {
      stage.scrollIntoView({ block: 'center', inline: 'center' });
    });
  }

  function exitCinema() {
    if (!cinema) return;
    const { video, player, saved, subtitleRenderer } = cinema;
    const stageRef = stage;

    if (subtitleRenderer) {
      subtitleRenderer.destroy();
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

  /* ---------- 状态刷新 ---------- */

  function updateButton() {
    if (cinema) {
      setButtonVisible(false);
      return;
    }
    const active = Array.from(document.querySelectorAll('video')).some(isActiveVideo);
    setButtonVisible(active);
  }

  setInterval(() => {
    if (cinema) {
      if (!cinema.video.isConnected || !cinema.player.isConnected) {
        exitCinema();
      } else if (cinema.subtitleRenderer && cinema.video) {
        cinema.subtitleRenderer.syncTime(cinema.video.currentTime);
      }
      return;
    }
    updateButton();
  }, 100);

  document.addEventListener('play', () => updateButton(), true);
  document.addEventListener('pause', () => updateButton(), true);

  document.addEventListener('keydown', (e) => {
    if (!cinema) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      exitCinema();
      return;
    }
    // 忽略在输入框中的按键
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement && document.activeElement.isContentEditable)) return;

    const key = e.key.toLowerCase();
    const v = cinema.video;
    if (!v || isNaN(v.duration)) return;

    if (key === 'j') {
      e.preventDefault();
      e.stopImmediatePropagation();
      v.currentTime = Math.max(0, v.currentTime - currentSettings.jDuration);
    } else if (key === 'l') {
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
