/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ReorganizationService } from '../ReorganizationService';
import { BookmarkManager } from '../BookmarkManager';
import { LLMService } from '../LLMService';
import { ConfigurationManager } from '../ConfigurationManager';

describe('ReorganizationService', () => {
  let service: ReorganizationService;
  let mockBookmarkManager: jest.Mocked<BookmarkManager>;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  beforeEach(() => {
    // Create mock instances
    mockBookmarkManager = {
      getAllBookmarks: jest.fn(),
      getAllFolders: jest.fn(),
      findFolderByName: jest.fn(),
      ensureFolder: jest.fn(),
      moveBookmark: jest.fn(),
      removeDuplicates: jest.fn(),
      removeEmptyFolders: jest.fn(),
      getBookmarksInFolders: jest.fn(),
      getBookmarksInFolder: jest.fn(),
      renameFolder: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockLLMService = {
      organizeBookmarks: jest.fn(),
      assignToFolders: jest.fn().mockResolvedValue({
        suggestions: [
          { bookmarkId: '1', folderName: 'Tech' },
          { bookmarkId: '2', folderName: 'News' },
          { bookmarkId: '3', folderName: 'Tech' },
        ],
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
      }),
    } as any;

    mockConfigManager = {
      getConfig: jest.fn(),
      saveConfig: jest.fn().mockResolvedValue(undefined),
      isBookmarkOrganized: jest.fn(),
      markBookmarkAsOrganized: jest.fn(),
      getOrganizationHistory: jest.fn().mockResolvedValue({}),
    } as any;

    // Setup default mock responses
    mockBookmarkManager.getAllBookmarks.mockResolvedValue([
      { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '10' },
      { id: '2', title: 'BBC News', url: 'https://bbc.com', parentId: '10' },
      { id: '3', title: 'Stack Overflow', url: 'https://stackoverflow.com', parentId: '10' },
    ]);

    mockBookmarkManager.getAllFolders.mockResolvedValue([
      { id: '1', title: 'Bookmarks bar', parentId: '0' },
      { id: '10', title: 'Unsorted', parentId: '1' },
    ]);

    mockBookmarkManager.removeDuplicates.mockResolvedValue({
      removed: 0,
      details: [],
    });

    mockBookmarkManager.removeEmptyFolders.mockResolvedValue({
      removed: 0,
      details: [],
    });

    mockConfigManager.getConfig.mockResolvedValue({
      api: { provider: 'openai', apiKey: 'test' },
      performance: {
        apiTimeout: 60,
        batchSize: 50,
        maxTokens: 4096,
        retryAttempts: 3,
        retryDelay: 10,
      },
      organization: {
        removeDuplicates: true,
        removeEmptyFolders: true,
        ignoreFolders: [],
        excludedSystemFolderIds: ['3'],
        categories: ['Tech', 'News', 'Shopping'],
        renamedSpeedDialFolderIds: [],
        organizeSavedTabs: false,
        autoOrganize: false,
        respectOrganizationHistory: 'never',
        useExistingFolders: false,
      },
      debug: { logLevel: 0, consoleLogging: false },
      ignorePatterns: [],
    });

    mockConfigManager.isBookmarkOrganized.mockResolvedValue(false);

    mockLLMService.organizeBookmarks.mockResolvedValue({
      suggestions: [
        { bookmarkId: '1', folderName: 'Tech' },
        { bookmarkId: '2', folderName: 'News' },
        { bookmarkId: '3', folderName: 'Tech' },
      ],
      foldersToCreate: ['Tech', 'News'],
      tokenUsage: { prompt: 100, completion: 50, total: 150 },
    });

    mockBookmarkManager.ensureFolder.mockImplementation(async (name) => {
      return `folder-${name.toLowerCase()}`;
    });

    mockBookmarkManager.findFolderByName.mockResolvedValue(null);

    mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([]);

    mockBookmarkManager.moveBookmark.mockResolvedValue(undefined);

    service = new ReorganizationService(
      mockBookmarkManager,
      mockLLMService,
      mockConfigManager,
      50,
      ['Tech', 'News', 'Shopping']
    );
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service).toBeDefined();
    });
  });

  describe('generatePreview', () => {
    it('should generate preview with bookmark counts', async () => {
      const preview = await service.generatePreview(['2', '3', '4']);

      expect(preview.totalBookmarks).toBe(3);
      expect(preview.bookmarksToMove).toBe(3);
      expect(preview.foldersToCreate).toEqual(['Tech', 'News', 'Shopping']);
      expect(preview.estimatedTime).toBeGreaterThan(0);
    });

    it('should exclude existing folders from creation list', async () => {
      mockBookmarkManager.getAllFolders.mockResolvedValue([
        { id: '1', title: 'Bookmarks bar', parentId: '0' },
        { id: '10', title: 'Tech', parentId: '1' },
      ]);

      const preview = await service.generatePreview(['2', '3', '4']);

      expect(preview.foldersToCreate).not.toContain('Tech');
      expect(preview.foldersToCreate).toContain('News');
      expect(preview.foldersToCreate).toContain('Shopping');
    });

    it('should handle errors gracefully', async () => {
      mockBookmarkManager.getAllBookmarks.mockRejectedValue(new Error('Test error'));

      await expect(service.generatePreview()).rejects.toThrow('Test error');
    });
  });

  describe('executeReorganization', () => {
    it('should organize bookmarks successfully', async () => {
      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.bookmarksMoved).toBeDefined();
      expect(mockLLMService.assignToFolders).toHaveBeenCalled();
    });

    it('should create folders as needed', async () => {
      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.foldersCreated).toBeDefined();
      expect(result.foldersCreated).toBeGreaterThanOrEqual(0);
    });

    it('should track results', async () => {
      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.moves).toBeDefined();
      expect(result.folders).toBeDefined();
      expect(result.duplicates).toBeDefined();
    });

    it('should call progress callback', async () => {
      const progressCallback = jest.fn();

      await service.executeReorganization(['2', '3', '4'], progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle empty bookmark list', async () => {
      mockBookmarkManager.getAllBookmarks.mockResolvedValue([]);

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.success).toBe(true);
      expect(result.bookmarksMoved).toBe(0);
      expect(mockLLMService.organizeBookmarks).not.toHaveBeenCalled();
    });

    it('should remove duplicates when configured', async () => {
      mockBookmarkManager.removeDuplicates.mockResolvedValue({
        removed: 5,
        details: [{ title: 'Dup', url: 'http://example.com', bookmarkId: '99' }],
      });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.duplicatesRemoved).toBe(5);
      expect(mockBookmarkManager.removeDuplicates).toHaveBeenCalled();
    });

    it('should remove empty folders when configured', async () => {
      mockBookmarkManager.removeEmptyFolders.mockResolvedValue({
        removed: 3,
        details: [{ name: 'Empty Folder', id: '88' }],
      });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.emptyFoldersRemoved).toBeGreaterThanOrEqual(0);
    });

    it('should skip bookmarks in organization history when configured', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        api: { provider: 'openai', apiKey: 'test' },
        performance: {
          apiTimeout: 60,
          batchSize: 50,
          maxTokens: 4096,
          retryAttempts: 3,
          retryDelay: 10,
        },
        organization: {
          removeDuplicates: true,
          removeEmptyFolders: true,
          ignoreFolders: [],
          excludedSystemFolderIds: ['3'],
          categories: ['Tech', 'News'],
          renamedSpeedDialFolderIds: [],
          organizeSavedTabs: false,
          autoOrganize: false,
          respectOrganizationHistory: 'always',
          useExistingFolders: false,
        },
        debug: { logLevel: 0, consoleLogging: false },
        ignorePatterns: [],
      });

      // Mock all bookmarks as already organized
      mockConfigManager.getOrganizationHistory.mockResolvedValue({
        '1': { moved: true, timestamp: Date.now() },
        '2': { moved: true, timestamp: Date.now() },
        '3': { moved: true, timestamp: Date.now() },
      });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.bookmarksSkipped).toBeGreaterThan(0);
    });

    it('should handle LLM errors gracefully', async () => {
      mockLLMService.organizeBookmarks.mockRejectedValue(new Error('LLM API error'));

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should handle bookmark move errors', async () => {
      mockBookmarkManager.moveBookmark.mockRejectedValue(new Error('Move failed'));

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use existing folders mode when configured', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        api: { provider: 'openai', apiKey: 'test' },
        performance: {
          apiTimeout: 60,
          batchSize: 50,
          maxTokens: 4096,
          retryAttempts: 3,
          retryDelay: 10,
        },
        organization: {
          removeDuplicates: true,
          removeEmptyFolders: true,
          ignoreFolders: [],
          excludedSystemFolderIds: ['3'],
          categories: ['Tech', 'News'],
          renamedSpeedDialFolderIds: [],
          organizeSavedTabs: false,
          autoOrganize: false,
          respectOrganizationHistory: 'never',
          useExistingFolders: true,
        },
        debug: { logLevel: 0, consoleLogging: false },
        ignorePatterns: [],
      });

      mockLLMService.assignToFolders.mockResolvedValue({
        suggestions: [
          { bookmarkId: '1', folderName: 'Tech' },
          { bookmarkId: '2', folderName: 'KEEP_CURRENT' },
        ],
        foldersToCreate: [],
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
      });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.bookmarksMoved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reorganizeSpecificFolders', () => {
    it('should organize bookmarks in specific folders', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '10' },
        { id: '2', title: 'BBC News', url: 'https://bbc.com', parentId: '10' },
      ]);

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result).toBeDefined();
      expect(result.success).toBeTruthy();
      expect(mockLLMService.assignToFolders).toHaveBeenCalled();
    });

    it('should handle empty folder selection', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([]);

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result).toBeDefined();
      expect(result.success).toBeTruthy();
      expect(result.bookmarksMoved).toBe(0);
    });

    it('should call progress callback during reorganization', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'GitHub', url: 'https://github.com', parentId: '10' },
      ]);

      const progressCallback = jest.fn();
      await service.reorganizeSpecificFolders(['10'], progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle LLM errors in specific folder reorganization', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test', url: 'https://test.com', parentId: '10' },
      ]);

      mockLLMService.assignToFolders.mockRejectedValue(new Error('LLM Error'));

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle bookmark move errors in specific folders', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test', url: 'https://test.com', parentId: '10' },
      ]);

      mockBookmarkManager.moveBookmark.mockRejectedValue(new Error('Move failed'));

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should track token usage across batches', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test1', url: 'https://test1.com', parentId: '10' },
        { id: '2', title: 'Test2', url: 'https://test2.com', parentId: '10' },
      ]);

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeReorganization - additional edge cases', () => {
    it('should handle folder creation errors', async () => {
      mockBookmarkManager.ensureFolder.mockRejectedValue(new Error('Create failed'));

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue after batch errors', async () => {
      mockLLMService.assignToFolders
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockResolvedValueOnce({
          suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
          foldersToCreate: [],
          tokenUsage: { prompt: 100, completion: 50, total: 150 },
        });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
    });

    it('should handle empty categories list', async () => {
      const emptyService = new ReorganizationService(
        mockBookmarkManager,
        mockLLMService,
        mockConfigManager,
        50,
        []
      );

      const result = await emptyService.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
    });
  });

  describe('generatePreview - additional tests', () => {
    it('should handle getAllBookmarks errors', async () => {
      mockBookmarkManager.getAllBookmarks.mockRejectedValue(new Error('Bookmark fetch failed'));

      await expect(service.generatePreview(['2', '3', '4'])).rejects.toThrow();
    });
  });

  describe('Error handling paths', () => {
    it('should handle removeDuplicates errors', async () => {
      mockBookmarkManager.removeDuplicates.mockRejectedValue(new Error('Remove duplicates failed'));

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle removeEmptyFolders errors', async () => {
      mockBookmarkManager.removeEmptyFolders.mockRejectedValue(
        new Error('Remove empty folders failed')
      );

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle errors during folder ensuring', async () => {
      mockBookmarkManager.ensureFolder
        .mockResolvedValueOnce('folder-tech')
        .mockRejectedValueOnce(new Error('Ensure folder failed'));

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
    });

    it('should handle Speed Dial folder renaming', async () => {
      mockBookmarkManager.getAllFolders.mockResolvedValue([
        { id: '1', title: 'Bookmarks Bar', parentId: '0' },
        { id: '20', title: 'Home', parentId: '1' },
        { id: '21', title: 'Shopping', parentId: '1' },
      ]);

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
    });

    it('should handle folder move with KEEP_CURRENT', async () => {
      mockLLMService.assignToFolders.mockResolvedValue({
        suggestions: [
          { bookmarkId: '1', folderName: 'Tech' },
          { bookmarkId: '2', folderName: 'KEEP_CURRENT' },
          { bookmarkId: '3', folderName: 'Tech' },
        ],
        foldersToCreate: [],
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
      });

      const result = await service.executeReorganization(['2', '3', '4']);

      expect(result).toBeDefined();
      // Should have moved 2 bookmarks (1 and 3), skipped bookmark 2
      expect(result.bookmarksMoved).toBe(2);
    });
  });

  describe('reorganizeSpecificFolders - more edge cases', () => {
    it('should handle config save errors during specific folder reorganization', async () => {
      mockConfigManager.saveConfig.mockRejectedValue(new Error('Save failed'));
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test', url: 'https://test.com', parentId: '10' },
      ]);

      const result = await service.reorganizeSpecificFolders(['10']);

      // Should complete despite save error (error is logged, not fatal)
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle duplicate removal errors in specific folders', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test', url: 'https://test.com', parentId: '10' },
      ]);
      mockConfigManager.getConfig.mockResolvedValue({
        api: { provider: 'openai', apiKey: 'test' },
        performance: {
          apiTimeout: 60,
          batchSize: 50,
          maxTokens: 4096,
          retryAttempts: 3,
          retryDelay: 10,
        },
        organization: {
          removeDuplicates: true,
          removeEmptyFolders: true,
          ignoreFolders: [],
          excludedSystemFolderIds: ['3'],
          categories: ['Tech', 'News'],
          renamedSpeedDialFolderIds: [],
          organizeSavedTabs: false,
          autoOrganize: false,
          respectOrganizationHistory: 'never',
          useExistingFolders: false,
        },
        debug: { logLevel: 0, consoleLogging: false },
        ignorePatterns: [],
      });
      mockBookmarkManager.removeDuplicates.mockRejectedValue(new Error('Duplicate removal failed'));

      const result = await service.reorganizeSpecificFolders(['10']);

      // Should complete and report error
      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Operation continues despite duplicate removal failure
    });

    it('should handle empty folder removal errors in specific folders', async () => {
      mockBookmarkManager.getBookmarksInFolders.mockResolvedValue([
        { id: '1', title: 'Test', url: 'https://test.com', parentId: '10' },
      ]);
      mockConfigManager.getConfig.mockResolvedValue({
        api: { provider: 'openai', apiKey: 'test' },
        performance: {
          apiTimeout: 60,
          batchSize: 50,
          maxTokens: 4096,
          retryAttempts: 3,
          retryDelay: 10,
        },
        organization: {
          removeDuplicates: true,
          removeEmptyFolders: true,
          ignoreFolders: [],
          excludedSystemFolderIds: ['3'],
          categories: ['Tech', 'News'],
          renamedSpeedDialFolderIds: [],
          organizeSavedTabs: false,
          autoOrganize: false,
          respectOrganizationHistory: 'never',
          useExistingFolders: false,
        },
        debug: { logLevel: 0, consoleLogging: false },
        ignorePatterns: [],
      });
      mockBookmarkManager.removeEmptyFolders.mockRejectedValue(
        new Error('Empty folder removal failed')
      );

      const result = await service.reorganizeSpecificFolders(['10']);

      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
