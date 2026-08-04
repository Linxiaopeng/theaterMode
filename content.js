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
        : 16 / 9;
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

    cinema = { video, player, saved };
    setButtonVisible(false);

    requestAnimationFrame(() => {
      stage.scrollIntoView({ block: 'center', inline: 'center' });
    });
  }

  function exitCinema() {
    if (!cinema) return;
    const { video, player, saved } = cinema;
    const stageRef = stage;

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
      }
      return;
    }
    updateButton();
  }, SCAN_INTERVAL);

  document.addEventListener('play', () => updateButton(), true);
  document.addEventListener('pause', () => updateButton(), true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cinema) {
      e.preventDefault();
      exitCinema();
    }
  });

  window.addEventListener('resize', () => {
    if (cinema && stage) {
      stage.style.width = px(computeStageWidth(cinema.video));
    }
  });

  ensureButton();
  updateButton();
})();
