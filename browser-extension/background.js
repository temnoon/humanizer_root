/**
 * Humanizer Capture - Background Service Worker
 *
 * Handles extension lifecycle and communication
 */

console.log('[Humanizer] Background service worker loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Humanizer] Extension installed');

  // Set default settings
  chrome.storage.local.set({
    apiUrl: 'http://localhost:8000/api/capture',
    autoCapture: false
  });
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Humanizer] Background received message:', request);

  // Forward to active tab if needed
  if (request.action === 'forwardToContent') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, request.data, sendResponse);
      }
    });
    return true; // Keep channel open
  }

  sendResponse({ received: true });
});
