document.addEventListener('DOMContentLoaded', () => {
  // Tab 切换逻辑
  const tabSettingsBtn = document.getElementById('tabSettingsBtn');
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');
  const settingsTab = document.getElementById('settingsTab');
  const historyTab = document.getElementById('historyTab');

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');
    settingsTab.style.display = 'block';
    historyTab.style.display = 'none';
  });

  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.classList.add('active');
    tabSettingsBtn.classList.remove('active');
    historyTab.style.display = 'block';
    settingsTab.style.display = 'none';
    loadHistory();
  });

  // 偏好设置 DOM
  const jValueInput = document.getElementById('jValue');
  const jUnitSelect = document.getElementById('jUnit');
  const jKeyInput = document.getElementById('jKey');
  const lValueInput = document.getElementById('lValue');
  const lUnitSelect = document.getElementById('lUnit');
  const lKeyInput = document.getElementById('lKey');
  const opacityInput = document.getElementById('opacity');
  const cleanPlayerEnabledInput = document.getElementById('cleanPlayerEnabled');

  const subFontSizeInput = document.getElementById('subFontSize');
  const subFontColorInput = document.getElementById('subFontColor');
  const subBgColorInput = document.getElementById('subBgColor');
  const subBgOpacityInput = document.getElementById('subBgOpacity');
  const subFontWeightSelect = document.getElementById('subFontWeight');
  const subBottomOffsetInput = document.getElementById('subBottomOffset');

  const ambilightEnabledInput = document.getElementById('ambilightEnabled');
  const ambilightWaveEnabledInput = document.getElementById('ambilightWaveEnabled');
  const ambilightIntensityInput = document.getElementById('ambilightIntensity');

  const musicCardWidthInput = document.getElementById('musicCardWidth');
  const musicPaddingInput = document.getElementById('musicPadding');
  const musicClockTopOffsetInput = document.getElementById('musicClockTopOffset');
  const musicBlurRadiusInput = document.getElementById('musicBlurRadius');
  const musicStaticCoverEnabledInput = document.getElementById('musicStaticCoverEnabled');

  const statusDiv = document.getElementById('status');

  let isLoaded = false;

  // 加载存储的偏好配置
  chrome.storage.sync.get({
    jDuration: 60,  // 默认60秒（1分钟）
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
    musicBlurRadius: 65,
    musicStaticCoverEnabled: false
  }, (items) => {
    parseToUI(items.jDuration, jValueInput, jUnitSelect);
    jKeyInput.value = items.jKey || 'j';
    parseToUI(items.lDuration, lValueInput, lUnitSelect);
    lKeyInput.value = items.lKey || 'l';
    opacityInput.value = items.overlayOpacity;
    cleanPlayerEnabledInput.checked = items.cleanPlayerEnabled !== undefined ? items.cleanPlayerEnabled : true;

    subFontSizeInput.value = items.subFontSize;
    subFontColorInput.value = items.subFontColor;
    subBgColorInput.value = items.subBgColor;
    subBgOpacityInput.value = items.subBgOpacity;
    subFontWeightSelect.value = items.subFontWeight;
    subBottomOffsetInput.value = items.subBottomOffset;

    ambilightEnabledInput.checked = items.ambilightEnabled;
    ambilightWaveEnabledInput.checked = items.ambilightWaveEnabled;
    ambilightIntensityInput.value = items.ambilightIntensity;

    musicCardWidthInput.value = items.musicCardWidth;
    musicPaddingInput.value = items.musicPadding;
    musicClockTopOffsetInput.value = items.musicClockTopOffset;
    musicBlurRadiusInput.value = items.musicBlurRadius;
    musicStaticCoverEnabledInput.checked = !!items.musicStaticCoverEnabled;

    isLoaded = true;
  });

  function saveAllSettings(showNotification = false) {
    if (!isLoaded && !showNotification) return;

    const jSec = parseToSeconds(jValueInput.value, jUnitSelect.value);
    const jKey = (jKeyInput.value || 'j').trim().toLowerCase().charAt(0) || 'j';
    const lSec = parseToSeconds(lValueInput.value, lUnitSelect.value);
    const lKey = (lKeyInput.value || 'l').trim().toLowerCase().charAt(0) || 'l';
    const opacity = Math.max(0, Math.min(1, parseFloat(opacityInput.value) || 0.88));
    const cleanPlayerEnabled = cleanPlayerEnabledInput.checked;

    const subFontSize = Math.max(12, Math.min(48, parseFloat(subFontSizeInput.value) || 18));
    const subFontColor = subFontColorInput.value || '#ffffff';
    const subBgColor = subBgColorInput.value || '#000000';
    const subBgOpacity = Math.max(0, Math.min(1, parseFloat(subBgOpacityInput.value) || 0.6));
    const subFontWeight = subFontWeightSelect.value || '500';
    const subBottomOffset = Math.max(10, Math.min(200, parseFloat(subBottomOffsetInput.value) || 30));

    const ambilightEnabled = ambilightEnabledInput.checked;
    const ambilightWaveEnabled = ambilightWaveEnabledInput.checked;
    const ambilightIntensity = Math.max(0.1, Math.min(1.0, parseFloat(ambilightIntensityInput.value) || 0.65));

    const musicCardWidth = Math.max(260, Math.min(520, parseInt(musicCardWidthInput.value, 10) || 380));
    const musicPadding = Math.max(16, Math.min(80, parseInt(musicPaddingInput.value, 10) || 40));
    const musicClockTopOffset = Math.max(20, Math.min(120, parseInt(musicClockTopOffsetInput.value, 10) || 50));
    const musicBlurRadius = Math.max(20, Math.min(100, parseInt(musicBlurRadiusInput.value, 10) || 65));
    const musicStaticCoverEnabled = musicStaticCoverEnabledInput.checked;

    if (isNaN(jSec) || isNaN(lSec) || jSec <= 0 || lSec <= 0) {
      if (showNotification) {
        statusDiv.textContent = '⚠️ 请输入有效的时间数值！';
        statusDiv.style.color = '#ef4444';
      }
      return;
    }

    const settings = {
      jDuration: jSec,
      jKey,
      lDuration: lSec,
      lKey,
      overlayOpacity: opacity,
      cleanPlayerEnabled,
      subFontSize,
      subFontColor,
      subBgColor,
      subBgOpacity,
      subFontWeight,
      subBottomOffset,
      ambilightEnabled,
      ambilightWaveEnabled,
      ambilightIntensity,
      musicCardWidth,
      musicPadding,
      musicClockTopOffset,
      musicBlurRadius,
      musicStaticCoverEnabled
    };

    chrome.storage.sync.set(settings, () => {
      if (showNotification) {
        statusDiv.textContent = '✓ 保存成功，配置即时生效';
        statusDiv.style.color = '#34d399';
        setTimeout(() => {
          statusDiv.textContent = '修改设置后即时生效';
          statusDiv.style.color = '#71717a';
        }, 2000);
      }

      // 同步广播通知网页标签页立刻刷新设置
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
          }
        });
      }
    });
  }

  // 实时监听输入与选择框变动，实现无缝动态响应
  [musicCardWidthInput, musicPaddingInput, musicClockTopOffsetInput, musicBlurRadiusInput, opacityInput, ambilightIntensityInput, subFontSizeInput, subBottomOffsetInput, subBgOpacityInput, jValueInput, lValueInput].forEach(el => {
    if (el) el.addEventListener('input', () => saveAllSettings(false));
  });
  [musicStaticCoverEnabledInput, cleanPlayerEnabledInput, ambilightEnabledInput, ambilightWaveEnabledInput, subFontColorInput, subBgColorInput, subFontWeightSelect, jUnitSelect, lUnitSelect, jKeyInput, lKeyInput].forEach(el => {
    if (el) el.addEventListener('change', () => saveAllSettings(false));
  });

  // 手动点击保存按钮
  document.getElementById('save').addEventListener('click', () => saveAllSettings(true));


  // 历史记录加载与管理
  const historyList = document.getElementById('historyList');
  const historyCountSpan = document.getElementById('historyCount');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  function loadHistory() {
    chrome.storage.local.get({ history: [] }, (res) => {
      const list = Array.isArray(res.history) ? res.history : [];
      historyCountSpan.textContent = list.length;

      if (list.length === 0) {
        historyList.innerHTML = `
          <div class="history-empty">
            <div class="history-empty-icon">🎬</div>
            <div class="history-empty-text">尚无视频播放历史记录</div>
          </div>
        `;
        return;
      }

      historyList.innerHTML = '';
      list.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';

        const infoEl = document.createElement('div');
        infoEl.className = 'history-info';

        const titleLink = document.createElement('a');
        titleLink.className = 'history-title';
        titleLink.href = item.url;
        titleLink.target = '_blank';
        titleLink.title = `${item.title}\n${item.url}`;
        titleLink.textContent = item.title || item.url;

        const timeEl = document.createElement('div');
        timeEl.className = 'history-time';
        timeEl.textContent = item.time || '';

        infoEl.appendChild(titleLink);
        infoEl.appendChild(timeEl);

        const delBtn = document.createElement('button');
        delBtn.className = 'history-delete-btn';
        delBtn.title = '删除此条记录';
        delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHistoryItem(index);
        });

        itemEl.appendChild(infoEl);
        itemEl.appendChild(delBtn);
        historyList.appendChild(itemEl);
      });
    });
  }

  function deleteHistoryItem(indexToDelete) {
    chrome.storage.local.get({ history: [] }, (res) => {
      let list = Array.isArray(res.history) ? res.history : [];
      list.splice(indexToDelete, 1);
      chrome.storage.local.set({ history: list }, () => {
        loadHistory();
      });
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('确定要清空全部观看历史记录吗？')) {
      chrome.storage.local.set({ history: [] }, () => {
        loadHistory();
      });
    }
  });

  // 初始加载历史条目计数
  chrome.storage.local.get({ history: [] }, (res) => {
    const list = Array.isArray(res.history) ? res.history : [];
    historyCountSpan.textContent = list.length;
  });
});

function parseToSeconds(val, unit) {
  const n = parseFloat(val) || 0;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  return n;
}

function parseToUI(totalSec, valInput, unitSelect) {
  if (totalSec % 3600 === 0 && totalSec >= 3600) {
    valInput.value = totalSec / 3600;
    unitSelect.value = 'h';
  } else if (totalSec % 60 === 0 && totalSec >= 60) {
    valInput.value = totalSec / 60;
    unitSelect.value = 'm';
  } else {
    valInput.value = totalSec;
    unitSelect.value = 's';
  }
}
