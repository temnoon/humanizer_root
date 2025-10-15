/**
 * Humanizer Capture - Content Script
 *
 * Runs on ChatGPT pages to capture conversations and media
 */

const API_BASE = 'http://localhost:8000/api/capture';

class ChatGPTCapture {
  constructor() {
    this.conversationId = null;
    this.capturedMessages = new Set();
    this.observerActive = false;
  }

  /**
   * Extract conversation UUID from URL
   * URL format: https://chatgpt.com/c/{uuid}
   */
  getConversationUUID() {
    const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Get conversation title from page
   */
  getConversationTitle() {
    // ChatGPT shows title in various places
    const titleElement = document.querySelector('h1') ||
                        document.querySelector('[class*="conversation-title"]') ||
                        document.querySelector('title');

    if (titleElement) {
      const title = titleElement.textContent.trim();
      // Filter out "ChatGPT" default title
      if (title && title !== 'ChatGPT' && title !== 'New chat') {
        return title;
      }
    }
    return null;
  }

  /**
   * Get model slug from page
   */
  getModelSlug() {
    // Look for model indicator in UI
    const modelElement = document.querySelector('[class*="model"]');
    if (modelElement) {
      const text = modelElement.textContent;
      if (text.includes('GPT-4')) return 'gpt-4';
      if (text.includes('GPT-3.5')) return 'gpt-3.5-turbo';
    }
    return null;
  }

  /**
   * Parse all messages from the conversation
   */
  parseMessages() {
    const messages = [];

    // ChatGPT uses div elements with data-message-author-role attribute
    const messageElements = document.querySelectorAll('[data-message-author-role]');

    messageElements.forEach((element, index) => {
      const role = element.getAttribute('data-message-author-role');
      const messageId = element.getAttribute('data-message-id');

      // Extract text content
      const textElements = element.querySelectorAll('[class*="markdown"], [class*="text"]');
      let contentText = '';
      textElements.forEach(el => {
        contentText += el.textContent + '\n';
      });
      contentText = contentText.trim();

      // Build content parts (simplified structure)
      const contentParts = [
        {
          content_type: 'text',
          parts: [contentText]
        }
      ];

      // Look for images in this message
      const images = element.querySelectorAll('img');
      images.forEach(img => {
        if (img.src && !img.src.includes('avatar')) {
          contentParts.push({
            content_type: 'image_asset_pointer',
            asset_pointer: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        }
      });

      if (messageId && contentText) {
        messages.push({
          uuid: messageId,
          author_role: role,
          content_text: contentText,
          content_parts: contentParts,
          created_at: new Date().toISOString() // Approximate timestamp
        });
      }
    });

    return messages;
  }

  /**
   * Extract media from message
   */
  extractMediaFromMessage(messageElement) {
    const media = [];
    const images = messageElement.querySelectorAll('img');

    images.forEach(img => {
      if (img.src && !img.src.includes('avatar')) {
        media.push({
          type: 'image',
          url: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          alt: img.alt
        });
      }
    });

    return media;
  }

  /**
   * Capture conversation metadata
   */
  async captureConversation() {
    const uuid = this.getConversationUUID();
    if (!uuid) {
      console.log('[Humanizer] No conversation UUID found in URL');
      return null;
    }

    const title = this.getConversationTitle();
    const modelSlug = this.getModelSlug();
    const sourceUrl = window.location.href;

    const payload = {
      uuid: uuid,
      title: title || 'Untitled Conversation',
      source_url: sourceUrl,
      model_slug: modelSlug
    };

    try {
      const response = await fetch(`${API_BASE}/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Humanizer] Conversation captured:', result);
        this.conversationId = uuid;
        return result;
      } else {
        const error = await response.text();
        console.error('[Humanizer] Failed to capture conversation:', error);
        return null;
      }
    } catch (error) {
      console.error('[Humanizer] Network error:', error);
      return null;
    }
  }

  /**
   * Capture a single message
   */
  async captureMessage(message) {
    if (!this.conversationId) {
      console.log('[Humanizer] No conversation ID, capturing conversation first...');
      await this.captureConversation();
    }

    if (this.capturedMessages.has(message.uuid)) {
      return; // Already captured
    }

    const payload = {
      ...message,
      conversation_uuid: this.conversationId
    };

    try {
      const response = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Humanizer] Message captured:', result);
        this.capturedMessages.add(message.uuid);
        return result;
      } else {
        const error = await response.text();
        console.error('[Humanizer] Failed to capture message:', error);
        return null;
      }
    } catch (error) {
      console.error('[Humanizer] Network error:', error);
      return null;
    }
  }

  /**
   * Capture media (image)
   */
  async captureMedia(mediaUrl, messageUuid) {
    try {
      // Download the image as blob
      const imageResponse = await fetch(mediaUrl);
      const blob = await imageResponse.blob();

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'image.png');
      formData.append('message_uuid', messageUuid);
      formData.append('conversation_uuid', this.conversationId);
      formData.append('source_url', mediaUrl);

      const response = await fetch(`${API_BASE}/media`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Humanizer] Media captured:', result);
        return result;
      } else {
        const error = await response.text();
        console.error('[Humanizer] Failed to capture media:', error);
        return null;
      }
    } catch (error) {
      console.error('[Humanizer] Failed to capture media:', error);
      return null;
    }
  }

  /**
   * Capture entire conversation
   */
  async captureAll() {
    console.log('[Humanizer] Starting full capture...');

    // 1. Capture conversation metadata
    await this.captureConversation();

    // 2. Parse and capture all messages
    const messages = this.parseMessages();
    console.log(`[Humanizer] Found ${messages.length} messages`);

    for (const message of messages) {
      await this.captureMessage(message);

      // Capture media in this message
      const messageParts = message.content_parts || [];
      for (const part of messageParts) {
        if (part.content_type === 'image_asset_pointer' && part.asset_pointer) {
          await this.captureMedia(part.asset_pointer, message.uuid);
        }
      }
    }

    console.log('[Humanizer] Capture complete!');
  }

  /**
   * Start observing for new messages
   */
  startObserver() {
    if (this.observerActive) return;

    const observer = new MutationObserver((mutations) => {
      // Check for new messages
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.hasAttribute?.('data-message-id')) {
            const messages = this.parseMessages();
            const newMessages = messages.filter(m => !this.capturedMessages.has(m.uuid));

            newMessages.forEach(async (msg) => {
              await this.captureMessage(msg);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observerActive = true;
    console.log('[Humanizer] Observer started');
  }
}

// Initialize capture
const capture = new ChatGPTCapture();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureNow') {
    capture.captureAll().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'startAutoCapture') {
    capture.startObserver();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'getStatus') {
    sendResponse({
      conversationId: capture.conversationId,
      messageCount: capture.capturedMessages.size
    });
    return true;
  }
});

// Auto-capture on page load (optional)
console.log('[Humanizer] Content script loaded');
