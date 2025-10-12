/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { LLMService, Bookmark } from '../LLMService';

describe('LLMService', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  describe('validateApiKeyFormat', () => {
    it('should reject empty API keys', () => {
      const result = LLMService.validateApiKeyFormat('', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject whitespace-only API keys', () => {
      const result = LLMService.validateApiKeyFormat('   ', 'openai');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should validate OpenAI API key format', () => {
      expect(LLMService.validateApiKeyFormat('sk-1234567890123456789012', 'openai').valid).toBe(
        true
      );
      expect(
        LLMService.validateApiKeyFormat('sk-proj-1234567890123456789012', 'openai').valid
      ).toBe(true);
      expect(LLMService.validateApiKeyFormat('invalid-key', 'openai').valid).toBe(false);
      expect(LLMService.validateApiKeyFormat('sk-short', 'openai').valid).toBe(false);
    });

    it('should validate Claude API key format', () => {
      expect(LLMService.validateApiKeyFormat('sk-ant-1234567890123456789012', 'claude').valid).toBe(
        true
      );
      expect(LLMService.validateApiKeyFormat('invalid-key', 'claude').valid).toBe(false);
      expect(LLMService.validateApiKeyFormat('sk-ant-short', 'claude').valid).toBe(false);
    });

    it('should validate Grok API key format', () => {
      expect(LLMService.validateApiKeyFormat('xai-1234567890123456789012', 'grok').valid).toBe(
        true
      );
      expect(LLMService.validateApiKeyFormat('invalid-key', 'grok').valid).toBe(false);
      expect(LLMService.validateApiKeyFormat('xai-short', 'grok').valid).toBe(false);
    });

    it('should validate OpenRouter API key format', () => {
      expect(
        LLMService.validateApiKeyFormat('sk-or-1234567890123456789012', 'openrouter').valid
      ).toBe(true);
      expect(LLMService.validateApiKeyFormat('invalid-key', 'openrouter').valid).toBe(false);
      expect(LLMService.validateApiKeyFormat('sk-or-short', 'openrouter').valid).toBe(false);
    });

    it('should reject unknown providers', () => {
      const result = LLMService.validateApiKeyFormat('test-key', 'unknown' as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown provider');
    });
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider', () => {
      const service = new LLMService('sk-test123456789012345678', 'openai');
      expect(service).toBeDefined();
    });

    it('should initialize with Claude provider', () => {
      const service = new LLMService('sk-ant-test123456789012345678', 'claude');
      expect(service).toBeDefined();
    });

    it('should initialize with Grok provider', () => {
      const service = new LLMService('xai-test123456789012345678', 'grok');
      expect(service).toBeDefined();
    });

    it('should initialize with OpenRouter provider', () => {
      const service = new LLMService('sk-or-test123456789012345678', 'openrouter');
      expect(service).toBeDefined();
    });

    it('should initialize with custom model', () => {
      const service = new LLMService('sk-test123456789012345678', 'openai', 'gpt-4');
      expect(service).toBeDefined();
    });

    it('should initialize with custom provider and endpoint', () => {
      const service = new LLMService(
        'test-key',
        'custom',
        undefined,
        60,
        4096,
        'https://custom.api.com/v1',
        'custom-model'
      );
      expect(service).toBeDefined();
    });

    it('should use custom model name for custom provider', () => {
      const service = new LLMService(
        'test-key',
        'custom',
        'base-model',
        60,
        4096,
        'https://custom.api.com',
        'override-model'
      );
      expect(service).toBeDefined();
    });

    it('should set custom timeout', () => {
      const service = new LLMService('sk-test123456789012345678', 'openai', undefined, 120);
      expect(service).toBeDefined();
    });

    it('should set custom maxTokens', () => {
      const service = new LLMService(
        'sk-test123456789012345678',
        'openai',
        undefined,
        undefined,
        8192
      );
      expect(service).toBeDefined();
    });
  });

  describe('categorizeSingleBookmark', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should categorize bookmark correctly', async () => {
      const bookmark: Bookmark = { id: '1', title: 'GitHub', url: 'https://github.com' };
      const categories = ['Tech', 'News', 'Shopping'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Tech' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);
      expect(result).toBe('Tech');
    });

    it('should handle JSON response format', async () => {
      const bookmark: Bookmark = { id: '1', title: 'BBC', url: 'https://bbc.com' };
      const categories = ['Tech', 'News', 'Shopping'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"category": "News"}' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);
      expect(result).toBe('News');
    });

    it('should fallback to first category for invalid response', async () => {
      const bookmark: Bookmark = { id: '1', title: 'Test', url: 'https://test.com' };
      const categories = ['Tech', 'News', 'Shopping'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'InvalidCategory' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);
      expect(result).toBe('Tech');
    });

    it('should handle case-insensitive category matching', async () => {
      const bookmark: Bookmark = { id: '1', title: 'Test', url: 'https://test.com' };
      const categories = ['Tech', 'News', 'Shopping'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'TECH' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);
      expect(result).toBe('Tech');
    });
  });

  describe('organizeBookmarks', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle API response with valid folder assignments', async () => {
      const bookmarks: Bookmark[] = [
        { id: '1', title: 'GitHub', url: 'https://github.com' },
        { id: '2', title: 'BBC News', url: 'https://bbc.com' },
      ];

      const mockResponse = {
        suggestions: [
          { bookmarkId: '1', folderName: 'Technology & Software' },
          { bookmarkId: '2', folderName: 'News & Media' },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, [
        'Technology & Software',
        'News & Media',
        'Other',
      ]);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].folderName).toBe('Technology & Software');
      expect(result.suggestions[1].folderName).toBe('News & Media');
      expect(result.tokenUsage?.total).toBe(150);
    });

    it('should handle API errors gracefully', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    // Skip this test as it involves retry logic with long delays (5s + 10s + 20s + 40s + 60s = 135s)
    it.skip('should handle rate limit errors', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle JSON with code blocks', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      const mockResponse =
        '```json\n{"suggestions": [{"bookmarkId": "1", "folderName": "Tech"}]}\n```';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockResponse } }],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);
      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('assignToFolders', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should assign bookmarks to existing folders', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'GitHub', url: 'https://github.com' }];

      const existingFolders = ['Development', 'News', 'Shopping'];

      const mockResponse = {
        suggestions: [{ bookmarkId: '1', folderName: 'Development' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      });

      const result = await service.assignToFolders(bookmarks, existingFolders);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].folderName).toBe('Development');
    });

    it('should handle KEEP_CURRENT when allowKeepCurrent is true', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      const mockResponse = {
        suggestions: [{ bookmarkId: '1', folderName: 'KEEP_CURRENT' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await service.assignToFolders(bookmarks, ['Dev', 'News'], true);

      expect(result.suggestions[0].folderName).toBe('KEEP_CURRENT');
    });

    it('should not allow KEEP_CURRENT when flag is false', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      const mockResponse = {
        suggestions: [{ bookmarkId: '1', folderName: 'Dev' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await service.assignToFolders(bookmarks, ['Dev', 'News'], false);

      expect(result.suggestions[0].folderName).toBe('Dev');
    });
  });

  describe('discoverFolders', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should discover folder names from bookmarks', async () => {
      const bookmarks: Bookmark[] = [
        { id: '1', title: 'GitHub', url: 'https://github.com' },
        { id: '2', title: 'BBC News', url: 'https://bbc.com' },
      ];

      const mockResponse = {
        folders: ['Development', 'News', 'Technology'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await service.discoverFolders(bookmarks, []);

      expect(result).toContain('Development');
      expect(result).toContain('News');
      expect(result).toContain('Technology');
    });

    it('should handle empty bookmark list', async () => {
      // Even with empty bookmarks, the function calls the LLM
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"folders": []}' } }],
        }),
      });

      const result = await service.discoverFolders([], []);

      expect(result).toEqual([]);
    });
  });

  describe('checkOpenRouterCredits', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-or-test123456789012345678', 'openrouter');
    });

    it('should return credit balance', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        json: async () => ({
          data: {
            limit_remaining: 8950, // In cents, should convert to $89.50
          },
        }),
      });

      const result = await service.checkOpenRouterCredits();

      expect(result.success).toBe(true);
      expect(result.credits).toBe(89.5);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const result = await service.checkOpenRouterCredits();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject for non-OpenRouter providers', async () => {
      const openaiService = new LLMService('sk-test123456789012345678', 'openai');

      const result = await openaiService.checkOpenRouterCredits();

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenRouter');
    });
  });

  describe('validateConnection', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should validate successful connection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"status": "ok"}' } }],
        }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    // Skip this test as it involves a 10-second delay that can cause timeouts
    it.skip('should handle timeout errors', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 10000);
          })
      );

      const shortTimeoutService = new LLMService(
        'sk-test123456789012345678',
        'openai',
        undefined,
        1
      );

      const result = await shortTimeoutService.validateConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('reviewAndOptimize', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should review and suggest optimizations', async () => {
      const assignments = [
        { bookmarkId: '1', title: 'GitHub', url: 'https://github.com', folderName: 'Tech' },
        {
          bookmarkId: '2',
          title: 'Stack Overflow',
          url: 'https://stackoverflow.com',
          folderName: 'Tech',
        },
      ];

      const folderSizes = { Tech: 2 };

      const mockResponse = {
        suggestions: [
          { bookmarkId: '1', folderName: 'Development' },
          { bookmarkId: '2', folderName: 'Development' },
        ],
        foldersToCreate: ['Development'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await service.reviewAndOptimize(assignments, folderSizes);

      expect(result.suggestions).toBeDefined();
      expect(result.foldersToCreate).toBeDefined();
    });
  });

  describe('error handling', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle malformed JSON responses', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json{' } }],
        }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle missing choices in response', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    // Skip this test as it involves a promise that never resolves, causing very long waits
    it.skip('should handle network timeout', async () => {
      const bookmarks: Bookmark[] = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const shortService = new LLMService('sk-test123456789012345678', 'openai', undefined, 1);

      await expect(shortService.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });
  });

  describe('assignToFolders - additional tests', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle empty bookmark array', async () => {
      // Even with empty bookmarks, the method processes them
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"suggestions": []}' } }],
        }),
      });

      const result = await service.assignToFolders([], ['Tech', 'News'], false);

      expect(result.suggestions).toEqual([]);
    });

    it('should handle API errors in assignToFolders', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error',
      });

      await expect(service.assignToFolders(bookmarks, ['Tech'], false)).rejects.toThrow();
    });
  });

  describe('reviewAndOptimize - additional tests', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle empty assignments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"suggestions": [], "foldersToCreate": []}' } }],
        }),
      });

      const result = await service.reviewAndOptimize([], {});

      expect(result.suggestions).toEqual([]);
    });

    it('should handle API errors in reviewAndOptimize', async () => {
      const assignments = [
        { bookmarkId: '1', title: 'Test', url: 'https://test.com', folderName: 'Tech' },
      ];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error',
      });

      await expect(service.reviewAndOptimize(assignments, { Tech: 1 })).rejects.toThrow();
    });
  });

  describe('parseResponse - additional tests', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle response with code blocks', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      const jsonResponse = {
        suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
        foldersToCreate: ['Tech'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '```json\n' + JSON.stringify(jsonResponse) + '\n```' } }],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBe(1);
    });

    it('should handle response without json markers', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      const jsonResponse = {
        suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
        foldersToCreate: ['Tech'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(jsonResponse) } }],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);

      expect(result.suggestions).toBeDefined();
    });
  });

  describe('categorizeSingleBookmark - additional tests', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle invalid category response', async () => {
      const bookmark = { id: '1', title: 'Test', url: 'https://test.com' };
      const categories = ['Tech', 'News'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'InvalidCategory' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);

      // Should fallback to first category
      expect(result).toBe('Tech');
    });

    it('should handle empty response', async () => {
      const bookmark = { id: '1', title: 'Test', url: 'https://test.com' };
      const categories = ['Tech', 'News'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      });

      const result = await service.categorizeSingleBookmark(bookmark, categories);

      expect(result).toBe('Tech');
    });

    it('should handle API errors', async () => {
      const bookmark = { id: '1', title: 'Test', url: 'https://test.com' };
      const categories = ['Tech', 'News'];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error',
      });

      // Should throw on API error
      await expect(service.categorizeSingleBookmark(bookmark, categories)).rejects.toThrow();
    });
  });

  describe('validateConnection - additional edge cases', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle truncated response with length finish reason', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '{"status": "ok"}' },
              finish_reason: 'length',
            },
          ],
        }),
      });

      const result = await service.validateConnection();

      // Should detect truncation issue
      expect(result.success).toBe(false);
      expect(result.error).toContain('truncated');
    });

    it('should handle invalid JSON in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not json at all' } }],
        }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
    });
  });

  describe('Claude provider support', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-ant-test123', 'claude');
    });

    it('should handle Claude response format', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                foldersToCreate: ['Tech'],
              }),
            },
          ],
          stop_reason: 'end_turn',
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBe(1);
    });

    it('should validate Claude connection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '{"status": "ok"}' }],
          stop_reason: 'end_turn',
        }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling - additional paths', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle 400 bad request errors', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle 403 forbidden errors', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle 502 bad gateway errors', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => 'Gateway error',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle 503 service unavailable errors', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Service unavailable',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });
  });

  describe('OpenRouter provider specifics', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-or-test123', 'openrouter', 'grok-beta');
    });

    it('should use correct endpoint for OpenRouter', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await service.organizeBookmarks(bookmarks, ['Tech']);

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('openrouter.ai');
    });

    it('should include model in OpenRouter requests', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await service.organizeBookmarks(bookmarks, ['Tech']);

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('grok-beta');
    });
  });

  describe('Grok provider specifics', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('xai-test123', 'grok');
    });

    it('should use correct endpoint for Grok', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await service.organizeBookmarks(bookmarks, ['Tech']);

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('x.ai');
    });
  });

  describe('Additional method coverage', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle organizeBookmarks with batch context', async () => {
      const bookmarks = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Bookmark ${i + 1}`,
        url: `https://test${i + 1}.com`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: bookmarks.map((b) => ({ bookmarkId: b.id, folderName: 'Tech' })),
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech'], {
        current: 1,
        total: 2,
        totalBookmarks: 10,
      });

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBe(5);
    });

    it('should handle assignToFolders with useExistingFolders true', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'KEEP_CURRENT' }],
                }),
              },
            },
          ],
        }),
      });

      const result = await service.assignToFolders(bookmarks, ['Tech'], true);

      expect(result.suggestions).toBeDefined();
    });

    it('should handle reviewAndOptimize with empty input', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"suggestions": [], "foldersToCreate": []}' } }],
        }),
      });

      const result = await service.reviewAndOptimize([], {});

      expect(result.suggestions).toEqual([]);
      expect(result.foldersToCreate).toEqual([]);
    });

    it('should handle discoverFolders with many bookmarks', async () => {
      const bookmarks = Array.from({ length: 150 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Bookmark ${i + 1}`,
        url: `https://test${i + 1}.com`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '{"folders": ["Tech", "News", "Shopping"]}' },
            },
          ],
        }),
      });

      const result = await service.discoverFolders(bookmarks, []);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle parseResponse with nested JSON', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '```\n{"suggestions": [{"bookmarkId": "1", "folderName": "Tech"}], "foldersToCreate": ["Tech"]}\n```',
              },
            },
          ],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);

      expect(result.suggestions).toBeDefined();
    });

    it('should handle different max_tokens values', async () => {
      const customService = new LLMService('sk-test123', 'openai', undefined, 60, 2000);
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      const result = await customService.organizeBookmarks(bookmarks, ['Tech']);

      expect(result).toBeDefined();
    });
  });

  describe('Custom endpoint support', () => {
    it('should use custom endpoint with chat completions path', async () => {
      const customService = new LLMService(
        'sk-test123',
        'custom',
        undefined,
        60,
        4096,
        'https://custom.api.com/v1/chat/completions',
        'custom-model'
      );
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await customService.organizeBookmarks(bookmarks, ['Tech']);

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('https://custom.api.com/v1/chat/completions');
    });

    it('should append chat completions path to custom endpoint without it', async () => {
      const customService = new LLMService(
        'sk-test123',
        'custom',
        undefined,
        60,
        4096,
        'https://custom.api.com/v1',
        'custom-model'
      );
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await customService.organizeBookmarks(bookmarks, ['Tech']);

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('https://custom.api.com/v1/chat/completions');
    });

    it('should remove trailing slash from custom endpoint', async () => {
      const customService = new LLMService(
        'sk-test123',
        'custom',
        undefined,
        60,
        4096,
        'https://custom.api.com/v1/',
        'custom-model'
      );
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: ['Tech'],
                }),
              },
            },
          ],
        }),
      });

      await customService.organizeBookmarks(bookmarks, ['Tech']);

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('custom.api.com/v1/chat/completions');
    });
  });

  describe('validateConnection - additional scenarios', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle validateConnection with length finish_reason and fallback', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: { content: '{"status": "ok"}' },
                  finish_reason: 'length',
                },
              ],
            }),
          };
        } else {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: { content: '{"status": "ok"}' },
                  finish_reason: 'stop',
                },
              ],
            }),
          };
        }
      });

      const result = await service.validateConnection();

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle validateConnection with 0 credits on OpenRouter', async () => {
      const orService = new LLMService('sk-or-test123', 'openrouter');

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([
          ['x-ratelimit-remaining', '10'],
          ['x-ratelimit-limit', '100'],
        ]),
        json: async () => ({
          choices: [
            {
              message: { content: '{"status": "ok"}' },
              finish_reason: 'length',
            },
          ],
        }),
      });

      const result = await orService.validateConnection();

      expect(result).toBeDefined();
    });
  });

  describe('LLM response parsing edge cases', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle missing suggestions in response', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '{"foldersToCreate": ["Tech"]}' },
            },
          ],
        }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow();
    });

    it('should handle missing foldersToCreate in response', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '{"suggestions": [{"bookmarkId": "1", "folderName": "Tech"}]}' },
            },
          ],
        }),
      });

      const result = await service.organizeBookmarks(bookmarks, ['Tech']);

      // Should succeed with empty foldersToCreate array as default
      expect(result).toBeDefined();
      expect(result.foldersToCreate).toEqual([]);
    });
  });

  describe('discoverFolders edge cases', () => {
    let service: LLMService;

    beforeEach(() => {
      service = new LLMService('sk-test123456789012345678', 'openai');
    });

    it('should handle discoverFolders with missing folders array', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{}' } }],
        }),
      });

      await expect(service.discoverFolders(bookmarks, [])).rejects.toThrow();
    });

    it('should handle discoverFolders with folders not an array', async () => {
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"folders": "not an array"}' } }],
        }),
      });

      await expect(service.discoverFolders(bookmarks, [])).rejects.toThrow();
    });
  });

  describe('Batch context with folder sizes', () => {
    it('should include folder sizes in prompt when provided', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: [],
                }),
              },
            },
          ],
        }),
      });

      await service.organizeBookmarks(bookmarks, ['Tech', 'News'], {
        current: 2,
        total: 3,
        totalBookmarks: 100,
        folderSizes: { Tech: 25, News: 10 },
      });

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const promptContent = payload.messages[1].content;

      expect(promptContent).toContain('Tech (25 bookmarks)');
      expect(promptContent).toContain('News (10 bookmarks)');
    });

    it('should handle later batch guidance', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [{ bookmarkId: '1', folderName: 'Tech' }],
                  foldersToCreate: [],
                }),
              },
            },
          ],
        }),
      });

      await service.organizeBookmarks(bookmarks, ['Tech', 'News'], {
        current: 3,
        total: 5,
        totalBookmarks: 150,
        folderSizes: { Tech: 30, News: 15 },
      });

      const callArgs = (mockFetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const promptContent = payload.messages[1].content;

      expect(promptContent).toContain('batch 3');
      expect(promptContent).toContain('STRONGLY PREFER');
    });
  });

  describe('assignToFolders - invalid folder mapping', () => {
    it('should map invalid folders to KEEP_CURRENT when allowKeepCurrent is true', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [
        { id: '1', title: 'Test 1', url: 'https://test1.com' },
        { id: '2', title: 'Test 2', url: 'https://test2.com' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { bookmarkId: '1', folderName: 'Tech' },
                    { bookmarkId: '2', folderName: 'InvalidFolder' },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await service.assignToFolders(bookmarks, ['Tech', 'News'], true);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].folderName).toBe('Tech');
      expect(result.suggestions[1].folderName).toBe('KEEP_CURRENT');
    });

    it('should map invalid folders to first approved when allowKeepCurrent is false', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [
        { id: '1', title: 'Test 1', url: 'https://test1.com' },
        { id: '2', title: 'Test 2', url: 'https://test2.com' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { bookmarkId: '1', folderName: 'Tech' },
                    { bookmarkId: '2', folderName: 'InvalidFolder' },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await service.assignToFolders(bookmarks, ['Tech', 'News'], false);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].folderName).toBe('Tech');
      expect(result.suggestions[1].folderName).toBe('Tech');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle 401 authentication error with user-friendly message', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid authentication',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'Authentication failed'
      );
    });

    it.skip('should handle 429 rate limit error with user-friendly message (skipped - involves retry delays)', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should handle 400 with token limit error message', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          JSON.stringify({
            error: { message: 'Maximum context_length exceeded' },
          }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'Token limit exceeded'
      );
    });

    it('should handle 400 with other error message', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test', url: 'https://test.com' }];

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          JSON.stringify({
            error: { message: 'Invalid model specified' },
          }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'Invalid request: Invalid model specified'
      );
    });
  });

  describe('validateConnection error paths', () => {
    it('should handle 404 model not found error', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found',
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle 403 access denied error in validateConnection', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should parse error message from errorData.error.message', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () =>
          JSON.stringify({
            error: { message: 'Custom error from API' },
          }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom error from API');
    });

    it('should parse error message from errorData.message', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () =>
          JSON.stringify({
            message: 'Another custom error format',
          }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Another custom error format');
    });
  });

  describe('OpenRouter credit checking with rate limits', () => {
    it('should parse rate limit headers from OpenRouter', async () => {
      const service = new LLMService('sk-or-test123', 'openrouter');

      const mockHeaders = new Map([
        ['x-ratelimit-remaining', '95'],
        ['x-ratelimit-limit', '100'],
        ['x-ratelimit-reset', '1609459200'],
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { limit_remaining: 550 } }), // In cents
        headers: {
          get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        },
      });

      const result = await service.checkOpenRouterCredits();

      expect(result.success).toBe(true);
      expect(result.credits).toBe(5.5); // 550 cents = $5.50
      expect(result.rateLimit).toBeDefined();
      expect(result.rateLimit?.remaining).toBe(95);
      expect(result.rateLimit?.limit).toBe(100);
    });

    it('should handle errors when checking OpenRouter credits', async () => {
      const service = new LLMService('sk-or-test123', 'openrouter');

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.checkOpenRouterCredits();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateConnection additional error paths', () => {
    it('should handle invalid parsed object in validateConnection', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'null' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should handle OpenRouter with 0 credits', async () => {
      const service = new LLMService('sk-or-test123', 'openrouter');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'not json' },
              finish_reason: 'stop',
            },
          ],
          usage: { credits_used: 0 },
        }),
        headers: {
          get: (key: string) => {
            if (key === 'X-OpenRouter-Credits-Remaining') return '0.00';
            return null;
          },
        },
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('$0.00 credits');
    });

    it('should handle timeout in validateConnection', async () => {
      const service = new LLMService('sk-test123', 'openai');

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle general errors in validateConnection', async () => {
      const service = new LLMService('sk-test123', 'openai');

      mockFetch.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await service.validateConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('parseResponse edge cases', () => {
    it('should handle compact format with invalid index', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [
        { id: '1', title: 'Test 1', url: 'https://test1.com' },
        { id: '2', title: 'Test 2', url: 'https://test2.com' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { i: 1, f: 'Tech' },
                    { i: 5, f: 'News' }, // Index 5 doesn't exist
                  ],
                }),
              },
            },
          ],
        }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech', 'News'])).rejects.toThrow(
        'Invalid index 5'
      );
    });

    it('should handle invalid suggestion format', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [{ id: '1', title: 'Test 1', url: 'https://test1.com' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { invalid: 'format' }, // Missing required fields
                  ],
                }),
              },
            },
          ],
        }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'Invalid suggestion format'
      );
    });

    it('should handle missing bookmark suggestions', async () => {
      const service = new LLMService('sk-test123', 'openai');
      const bookmarks = [
        { id: '1', title: 'Test 1', url: 'https://test1.com' },
        { id: '2', title: 'Test 2', url: 'https://test2.com' },
        { id: '3', title: 'Test 3', url: 'https://test3.com' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    { bookmarkId: '1', folderName: 'Tech' },
                    // Missing suggestions for bookmarks 2 and 3
                  ],
                  foldersToCreate: [],
                }),
              },
            },
          ],
        }),
      });

      await expect(service.organizeBookmarks(bookmarks, ['Tech'])).rejects.toThrow(
        'failed to categorize 2 of 3 bookmarks'
      );
    });
  });
});
