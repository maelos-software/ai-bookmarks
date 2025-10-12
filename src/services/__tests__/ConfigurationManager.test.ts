/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ConfigurationManager, AppConfig, DEFAULT_CATEGORIES } from '../ConfigurationManager';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockStorage: { [key: string]: any };

  beforeEach(() => {
    mockStorage = {};
    configManager = new ConfigurationManager();

    // Mock chrome.storage.sync
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn((key) => Promise.resolve(mockStorage)),
          set: jest.fn((data) => {
            Object.assign(mockStorage, data);
            return Promise.resolve();
          })
        },
        local: {
          get: jest.fn((key) => Promise.resolve({})),
          set: jest.fn(() => Promise.resolve()),
          remove: jest.fn(() => Promise.resolve())
        }
      },
      bookmarks: {
        getTree: jest.fn(() => Promise.resolve([]))
      }
    } as any;
  });

  describe('getConfig', () => {
    it('should return default config when no stored config exists', async () => {
      const config = await configManager.getConfig();

      expect(config.api.provider).toBe('openrouter');
      expect(config.api.apiKey).toBe('');
      expect(config.organization.removeDuplicates).toBe(true);
      expect(config.organization.categories).toEqual(DEFAULT_CATEGORIES);
      expect(config.organization.useExistingFolders).toBe(false);
      expect(config.organization.respectOrganizationHistory).toBe('always');
    });

    it('should merge stored config with defaults', async () => {
      mockStorage['app_config'] = {
        api: { provider: 'openai', apiKey: 'test-key' },
        organization: { removeDuplicates: false }
      };

      const config = await configManager.getConfig();

      expect(config.api.provider).toBe('openai');
      expect(config.api.apiKey).toBe('test-key');
      expect(config.organization.removeDuplicates).toBe(false);
      expect(config.organization.categories).toEqual(DEFAULT_CATEGORIES);
    });
  });

  describe('saveConfig', () => {
    it('should save config to chrome storage', async () => {
      const testConfig: AppConfig = {
        api: { provider: 'openai', apiKey: 'test-key' },
        performance: { apiTimeout: 60, batchSize: 25, maxTokens: 2048 },
        organization: {
          removeDuplicates: false,
          removeEmptyFolders: true,
          ignoreFolders: ['test'],
          excludedSystemFolderIds: ['3'],
          categories: DEFAULT_CATEGORIES,
          renamedSpeedDialFolderIds: [],
          organizeSavedTabs: false,
          autoOrganize: false,
          respectOrganizationHistory: 'never',
          useExistingFolders: true
        },
        debug: { logLevel: 2, consoleLogging: true },
        ignorePatterns: []
      };

      await configManager.saveConfig(testConfig);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        app_config: testConfig
      });
    });
  });

  describe('updateAPIConfig', () => {
    it('should update only API config fields', async () => {
      const config = await configManager.getConfig();

      await configManager.updateAPIConfig({
        provider: 'claude',
        apiKey: 'new-key'
      });

      const updatedConfig = await configManager.getConfig();
      expect(updatedConfig.api.provider).toBe('claude');
      expect(updatedConfig.api.apiKey).toBe('new-key');
    });
  });

  describe('isConfigured', () => {
    it('should return false when no API key is set', async () => {
      // Explicitly set empty apiKey
      mockStorage['app_config'] = {
        api: { apiKey: '' }
      };

      const configured = await configManager.isConfigured();
      expect(configured).toBe(false);
    });

    it('should return true when API key is set', async () => {
      mockStorage['app_config'] = {
        api: { apiKey: 'test-key' }
      };

      const configured = await configManager.isConfigured();
      expect(configured).toBe(true);
    });
  });

  describe('Organization History', () => {
    let historyStorage: { [key: string]: any };

    beforeEach(() => {
      historyStorage = {};
      (chrome.storage.local.get as jest.Mock).mockImplementation(() =>
        Promise.resolve(historyStorage)
      );
      (chrome.storage.local.set as jest.Mock).mockImplementation((data) => {
        Object.assign(historyStorage, data);
        return Promise.resolve();
      });
      (chrome.storage.local.remove as jest.Mock).mockImplementation(() => {
        historyStorage = {};
        return Promise.resolve();
      });
    });

    it('should mark bookmark as organized', async () => {
      await configManager.markBookmarkAsOrganized('123', 'Technology & Software');

      const history = await configManager.getOrganizationHistory();
      expect(history['123']).toBeDefined();
      expect(history['123'].moved).toBe(true);
      expect(history['123'].category).toBe('Technology & Software');
    });

    it('should check if bookmark is organized', async () => {
      await configManager.markBookmarkAsOrganized('123');

      const isOrganized = await configManager.isBookmarkOrganized('123');
      expect(isOrganized).toBe(true);

      const isNotOrganized = await configManager.isBookmarkOrganized('456');
      expect(isNotOrganized).toBe(false);
    });

    it('should clear organization history', async () => {
      await configManager.markBookmarkAsOrganized('123');
      await configManager.clearOrganizationHistory();

      const history = await configManager.getOrganizationHistory();
      expect(Object.keys(history).length).toBe(0);
    });

    it('should mark all bookmarks as organized', async () => {
      const mockTree = [{
        id: '0',
        children: [
          { id: '1', url: 'http://example.com' },
          { id: '2', url: 'http://test.com' },
          {
            id: '3',
            children: [
              { id: '4', url: 'http://nested.com' }
            ]
          }
        ]
      }];

      (chrome.bookmarks.getTree as jest.Mock).mockResolvedValue(mockTree);

      const count = await configManager.markAllBookmarksAsOrganized();

      expect(count).toBe(3);
      const history = await configManager.getOrganizationHistory();
      expect(history['1']).toBeDefined();
      expect(history['2']).toBeDefined();
      expect(history['4']).toBeDefined();
    });
  });
});
