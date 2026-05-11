const toggle = document.getElementById('toggleBtn');
const statusEl = document.getElementById('status-msg');

function setStatus(msg, color) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = color || '#888';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectIfNeeded(tabId) {
  try {
    // Try pinging the content script first
    await chrome.tabs.sendMessage(tabId, { type: 'GET_ENABLED' });
    return true;
  } catch {
    // Not injected yet — inject manually
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js'],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css'],
      });
      return true;
    } catch (err) {
      return false;
    }
  }
}

async function init() {
  const tab = await getActiveTab();
  if (!tab) return;

  // Can't inject into chrome:// or extension pages
  if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) {
    setStatus('無法在此頁面使用', '#ff6584');
    toggle.disabled = true;
    return;
  }

  const ok = await injectIfNeeded(tab.id);
  if (!ok) {
    setStatus('請重新整理頁面後再試', '#ff6584');
    toggle.disabled = true;
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'GET_ENABLED' }, (res) => {
    if (chrome.runtime.lastError) return;
    toggle.checked = res?.enabled ?? false;
    setStatus(toggle.checked ? '測量工具已啟用' : '點擊開關以啟用', toggle.checked ? '#4facfe' : '#888');
  });
}

toggle.addEventListener('change', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' }, (res) => {
    if (chrome.runtime.lastError) return;
    setStatus(res?.enabled ? '測量工具已啟用' : '已關閉', res?.enabled ? '#4facfe' : '#888');
  });
});

init();
