document.addEventListener('DOMContentLoaded', () => {
  const jValueInput = document.getElementById('jValue');
  const jUnitSelect = document.getElementById('jUnit');
  const lValueInput = document.getElementById('lValue');
  const lUnitSelect = document.getElementById('lUnit');
  const opacityInput = document.getElementById('opacity');
  const statusDiv = document.getElementById('status');

  // 加载存储的配置
  chrome.storage.sync.get({
    jDuration: 60,  // 默认60秒（1分钟）
    lDuration: 60,
    overlayOpacity: 0.88
  }, (items) => {
    // 转换为合适单位展示
    parseToUI(items.jDuration, jValueInput, jUnitSelect);
    parseToUI(items.lDuration, lValueInput, lUnitSelect);
    opacityInput.value = items.overlayOpacity;
  });

  document.getElementById('save').addEventListener('click', () => {
    const jSec = parseToSeconds(jValueInput.value, jUnitSelect.value);
    const lSec = parseToSeconds(lValueInput.value, lUnitSelect.value);
    const opacity = Math.max(0, Math.min(1, parseFloat(opacityInput.value) || 0.88));

    if (isNaN(jSec) || isNaN(lSec) || jSec <= 0 || lSec <= 0) {
      statusDiv.textContent = '请输入有效的时间数值！';
      statusDiv.style.color = '#ef4444';
      return;
    }

    chrome.storage.sync.set({
      jDuration: jSec,
      lDuration: lSec,
      overlayOpacity: opacity
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
