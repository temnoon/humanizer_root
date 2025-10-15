/**
 * Humanizer Capture - Popup Script
 */

const statusElements = {
  conversationId: document.getElementById('conversationId'),
  messageCount: document.getElementById('messageCount'),
  message: document.getElementById('message')
};

const buttons = {
  capture: document.getElementById('captureBtn'),
  dashboard: document.getElementById('openDashboard'),
  autoCapture: document.getElementById('autoCapture')
};

// Show message
function showMessage(text, type = 'info') {
  statusElements.message.style.display = 'block';
  statusElements.message.className = `message message-${type}`;
  statusElements.message.textContent = text;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusElements.message.style.display = 'none';
  }, 3000);
}

// Update status display
async function updateStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url?.includes('chatgpt.com')) {
      statusElements.conversationId.textContent = 'Not on ChatGPT';
      statusElements.messageCount.textContent = '0';
      buttons.capture.disabled = true;
      return;
    }

    buttons.capture.disabled = false;

    // Get status from content script
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not ready:', chrome.runtime.lastError.message);
        statusElements.conversationId.textContent = 'Not loaded';
        return;
      }

      if (response) {
        const shortId = response.conversationId
          ? response.conversationId.substring(0, 8) + '...'
          : 'Not detected';
        statusElements.conversationId.textContent = shortId;
        statusElements.messageCount.textContent = response.messageCount || 0;
      }
    });
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

// Capture now button
buttons.capture.addEventListener('click', async () => {
  buttons.capture.disabled = true;
  buttons.capture.textContent = 'Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'captureNow' }, (response) => {
      if (response?.success) {
        showMessage('Conversation captured successfully!', 'success');
        updateStatus();
      } else {
        showMessage('Failed to capture: ' + (response?.error || 'Unknown error'), 'error');
      }

      buttons.capture.disabled = false;
      buttons.capture.textContent = 'Capture Now';
    });
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
    buttons.capture.disabled = false;
    buttons.capture.textContent = 'Capture Now';
  }
});

// Open dashboard button
buttons.dashboard.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3001' });
});

// Auto-capture toggle
buttons.autoCapture.addEventListener('change', async (e) => {
  const enabled = e.target.checked;

  // Save setting
  await chrome.storage.local.set({ autoCapture: enabled });

  if (enabled) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'startAutoCapture' });
    showMessage('Auto-capture enabled', 'success');
  } else {
    showMessage('Auto-capture disabled', 'info');
  }
});

// Load settings
async function loadSettings() {
  const settings = await chrome.storage.local.get(['autoCapture']);
  buttons.autoCapture.checked = settings.autoCapture || false;
}

// Initialize
loadSettings();
updateStatus();

// Update status every 2 seconds
setInterval(updateStatus, 2000);
