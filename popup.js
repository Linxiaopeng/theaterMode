document.addEventListener('DOMContentLoaded', () => {
  const jValueInput = document.getElementById('jValue');
  const jUnitSelect = document.getElementById('jUnit');
  const lValueInput = document.getElementById('lValue');
  const lUnitSelect = document.getElementById('lUnit');
  const opacityInput = document.getElementById('opacity');

  const subFontSizeInput = document.getElementById('subFontSize');
  const subFontColorInput = document.getElementById('subFontColor');
  const subBgColorInput = document.getElementById('subBgColor');
  const subBgOpacityInput = document.getElementById('subBgOpacity');
  const subFontWeightSelect = document.getElementById('subFontWeight');
  const subBottomOffsetInput = document.getElementById('subBottomOffset');

  const statusDiv = document.getElementById('status');

  // 加载存储的配置
  chrome.storage.sync.get({
    jDuration: 60,  // 默认60秒（1分钟）
    lDuration: 60,
    overlayOpacity: 0.88,
    subFontSize: 18,
    subFontColor: '#ffffff',
    subBgColor: '#000000',
    subBgOpacity: 0.6,
    subFontWeight: '500',
    subBottomOffset: 30
  }, (items) => {
    // 转换为合适单位展示
    parseToUI(items.jDuration, jValueInput, jUnitSelect);
    parseToUI(items.lDuration, lValueInput, lUnitSelect);
    opacityInput.value = items.overlayOpacity;

    subFontSizeInput.value = items.subFontSize;
    subFontColorInput.value = items.subFontColor;
    subBgColorInput.value = items.subBgColor;
    subBgOpacityInput.value = items.subBgOpacity;
    subFontWeightSelect.value = items.subFontWeight;
    subBottomOffsetInput.value = items.subBottomOffset;
  });

  document.getElementById('save').addEventListener('click', () => {
    const jSec = parseToSeconds(jValueInput.value, jUnitSelect.value);
    const lSec = parseToSeconds(lValueInput.value, lUnitSelect.value);
    const opacity = Math.max(0, Math.min(1, parseFloat(opacityInput.value) || 0.88));

    const subFontSize = Math.max(12, Math.min(48, parseFloat(subFontSizeInput.value) || 18));
    const subFontColor = subFontColorInput.value || '#ffffff';
    const subBgColor = subBgColorInput.value || '#000000';
    const subBgOpacity = Math.max(0, Math.min(1, parseFloat(subBgOpacityInput.value) || 0.6));
    const subFontWeight = subFontWeightSelect.value || '500';
    const subBottomOffset = Math.max(10, Math.min(200, parseFloat(subBottomOffsetInput.value) || 30));

    if (isNaN(jSec) || isNaN(lSec) || jSec <= 0 || lSec <= 0) {
      statusDiv.textContent = '请输入有效的时间数值！';
      statusDiv.style.color = '#ef4444';
      return;
    }

    chrome.storage.sync.set({
      jDuration: jSec,
      lDuration: lSec,
      overlayOpacity: opacity,
      subFontSize,
      subFontColor,
      subBgColor,
      subBgOpacity,
      subFontWeight,
      subBottomOffset
    }, () => {
      statusDiv.textContent = '保存成功！已即时生效';
      statusDiv.style.color = '#22c55e';
      setTimeout(() => {
        statusDiv.textContent = '设置修改后即时生效';
        statusDiv.style.color = '#71717a';
      }, 2000);
    });
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
