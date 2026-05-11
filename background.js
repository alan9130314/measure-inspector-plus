const ICON_DEFAULT = { 16: 'icons/icon16.png',        48: 'icons/icon48.png'        };
const ICON_ACTIVE  = { 16: 'icons/icon16-active.png', 48: 'icons/icon48-active.png' };

// Per-tab enabled state
const tabState = new Map();

function setIcon(tabId, enabled) {
  chrome.action.setIcon({ tabId, path: enabled ? ICON_ACTIVE : ICON_DEFAULT });
  chrome.action.setTitle({ tabId, title: enabled ? 'MeasureTool (啟動中)' : 'MeasureTool (點擊開關)' });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' });
  if (response) {
    tabState.set(tab.id, response.enabled);
    setIcon(tab.id, response.enabled);
  }
});

// Restore correct icon when switching tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
  const enabled = tabState.get(tabId) ?? false;
  setIcon(tabId, enabled);
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});
