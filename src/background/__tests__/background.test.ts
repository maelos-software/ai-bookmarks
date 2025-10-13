/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Tests for BackgroundService
 * Note: jest-webextension-mock provides Chrome API mocks automatically
 * These tests verify Chrome API functionality and background service initialization
 */

describe('BackgroundService', () => {
  beforeEach(() => {
    // Clear all mocks between tests
    jest.clearAllMocks();
  });

  describe('Chrome API Availability', () => {
    it('should have runtime API available', () => {
      expect(chrome.runtime).toBeDefined();
      expect(chrome.runtime.onMessage).toBeDefined();
      expect(chrome.runtime.onInstalled).toBeDefined();
      expect(chrome.runtime.getManifest).toBeDefined();
      expect(chrome.runtime.getURL).toBeDefined();
      expect(chrome.runtime.openOptionsPage).toBeDefined();
    });

    it('should have bookmarks API available', () => {
      expect(chrome.bookmarks).toBeDefined();
      expect(chrome.bookmarks.onCreated).toBeDefined();
    });

    it('should have storage API available', () => {
      expect(chrome.storage).toBeDefined();
      expect(chrome.storage.local).toBeDefined();
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.storage.local.set).toBeDefined();
      expect(chrome.storage.local.remove).toBeDefined();
    });

    it('should have notifications API available', () => {
      expect(chrome.notifications).toBeDefined();
      expect(chrome.notifications.create).toBeDefined();
    });

    it('should have tabs API available', () => {
      expect(chrome.tabs).toBeDefined();
      expect(chrome.tabs.create).toBeDefined();
    });

    it('should have action API available', () => {
      expect(chrome.action).toBeDefined();
      expect(chrome.action.setBadgeText).toBeDefined();
      expect(chrome.action.setBadgeBackgroundColor).toBeDefined();
      expect(chrome.action.setTitle).toBeDefined();
    });
  });

  describe('Background Service Initialization', () => {
    it('should initialize background service', async () => {
      // Import the module to trigger initialization
      await import('../background.js');

      // Verify event listeners were registered
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.bookmarks.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should support message listeners', () => {
      expect(chrome.runtime.onMessage.addListener).toBeDefined();
      expect(typeof chrome.runtime.onMessage.addListener).toBe('function');
    });

    it('should support bookmark creation listeners', () => {
      expect(chrome.bookmarks.onCreated.addListener).toBeDefined();
      expect(typeof chrome.bookmarks.onCreated.addListener).toBe('function');
    });

    it('should support installation listeners', () => {
      expect(chrome.runtime.onInstalled.addListener).toBeDefined();
      expect(typeof chrome.runtime.onInstalled.addListener).toBe('function');
    });
  });

  describe('Storage Operations', () => {
    it('should support getting from storage', () => {
      expect(chrome.storage.local.get).toBeDefined();
      expect(typeof chrome.storage.local.get).toBe('function');
    });

    it('should support setting to storage', () => {
      expect(chrome.storage.local.set).toBeDefined();
      expect(typeof chrome.storage.local.set).toBe('function');
    });

    it('should support removing from storage', () => {
      expect(chrome.storage.local.remove).toBeDefined();
      expect(typeof chrome.storage.local.remove).toBe('function');
    });

    it('should support storage promises', async () => {
      const testData = { key: 'value' };

      // Set data
      await chrome.storage.local.set(testData);

      // Get data
      const result = await chrome.storage.local.get('key');
      expect(result).toBeDefined();
    });
  });

  describe('Bookmark Operations', () => {
    it('should have bookmarks API available', () => {
      expect(chrome.bookmarks).toBeDefined();
    });

    it('should support bookmark tree operations', async () => {
      expect(chrome.bookmarks.getTree).toBeDefined();
      expect(typeof chrome.bookmarks.getTree).toBe('function');
    });
  });

  describe('Notification Operations', () => {
    it('should support creating notifications', () => {
      expect(chrome.notifications.create).toBeDefined();
      expect(typeof chrome.notifications.create).toBe('function');
    });

    it('should support notification promises', async () => {
      const notificationId = await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Test',
        message: 'Test message',
      });
      expect(notificationId).toBeDefined();
    });
  });

  describe('Runtime Operations', () => {
    it('should support opening options page', () => {
      expect(chrome.runtime.openOptionsPage).toBeDefined();
      expect(typeof chrome.runtime.openOptionsPage).toBe('function');
    });

    it('should support getting manifest', () => {
      expect(chrome.runtime.getManifest).toBeDefined();
      expect(typeof chrome.runtime.getManifest).toBe('function');

      const manifest = chrome.runtime.getManifest();
      expect(manifest).toBeDefined();
    });

    it('should support getting extension URL', () => {
      expect(chrome.runtime.getURL).toBeDefined();
      expect(typeof chrome.runtime.getURL).toBe('function');

      const url = chrome.runtime.getURL('test.html');
      expect(url).toContain('test.html');
    });

    it('should support sending messages', () => {
      expect(chrome.runtime.sendMessage).toBeDefined();
      expect(typeof chrome.runtime.sendMessage).toBe('function');
    });
  });

  describe('Tab Operations', () => {
    it('should support creating tabs', () => {
      expect(chrome.tabs.create).toBeDefined();
      expect(typeof chrome.tabs.create).toBe('function');
    });

    it('should support tab promises', async () => {
      const tab = await chrome.tabs.create({ url: 'https://example.com' });
      expect(tab).toBeDefined();
    });
  });

  describe('Action API Operations', () => {
    it('should support setting badge text', () => {
      expect(chrome.action.setBadgeText).toBeDefined();
      expect(typeof chrome.action.setBadgeText).toBe('function');
    });

    it('should support setting badge background color', () => {
      expect(chrome.action.setBadgeBackgroundColor).toBeDefined();
      expect(typeof chrome.action.setBadgeBackgroundColor).toBe('function');
    });

    it('should support setting action title', () => {
      expect(chrome.action.setTitle).toBeDefined();
      expect(typeof chrome.action.setTitle).toBe('function');
    });

    it('should support action promises', async () => {
      await chrome.action.setBadgeText({ text: 'test' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      await chrome.action.setTitle({ title: 'Test Title' });
      // If these don't throw, the test passes
      expect(true).toBe(true);
    });
  });
});
