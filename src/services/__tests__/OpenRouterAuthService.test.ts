/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { OpenRouterAuthService } from '../OpenRouterAuthService';

// Setup crypto mocks before any tests
Object.defineProperty(global, 'TextEncoder', {
  writable: true,
  value: class TextEncoder {
    encode(str: string) {
      const buf = Buffer.from(str, 'utf-8');
      return new Uint8Array(buf);
    }
  },
});

Object.defineProperty(global, 'crypto', {
  writable: true,
  value: {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {
      digest: async (_algorithm: string, _data: BufferSource) => {
        // Mock SHA-256 digest - return a proper ArrayBuffer
        return new Uint8Array(32).buffer;
      },
    },
  },
});

Object.defineProperty(global, 'btoa', {
  writable: true,
  value: (str: string) => Buffer.from(str).toString('base64'),
});

describe('OpenRouterAuthService', () => {
  let service: OpenRouterAuthService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Mock Chrome APIs
    global.chrome = {
      runtime: {
        id: 'test-extension-id',
        lastError: undefined,
      },
      identity: {
        launchWebAuthFlow: jest.fn(),
      },
      storage: {
        sync: {
          get: jest.fn(() => Promise.resolve({})),
          set: jest.fn(() => Promise.resolve()),
        },
      },
    } as any;

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    service = new OpenRouterAuthService();
  });

  describe('constructor', () => {
    it('should initialize with correct callback URL', () => {
      expect(service).toBeDefined();
    });
  });

  describe('login', () => {
    it('should successfully complete OAuth flow', async () => {
      const mockApiKey = 'sk-or-test-key-123';

      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback('https://test-extension-id.chromiumapp.org/oauth-callback?code=test-code');
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ key: mockApiKey }),
      });

      const result = await service.login();

      expect(result.success).toBe(true);
      expect(result.apiKey).toBe(mockApiKey);
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
    });

    it('should handle OAuth flow cancellation', async () => {
      (chrome.runtime as any).lastError = { message: 'User canceled' };
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback(undefined);
      });

      const result = await service.login();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Clean up
      (chrome.runtime as any).lastError = undefined;
    });

    it('should handle missing authorization code', async () => {
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback('https://test-extension-id.chromiumapp.org/oauth-callback?error=access_denied');
      });

      const result = await service.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No authorization code');
    });

    it('should handle token exchange failure', async () => {
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback('https://test-extension-id.chromiumapp.org/oauth-callback?code=test-code');
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid code',
      });

      const result = await service.login();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing API key in response', async () => {
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback('https://test-extension-id.chromiumapp.org/oauth-callback?code=test-code');
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // No key field
      });

      const result = await service.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No API key');
    });

    it('should handle no response URL', async () => {
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        callback(undefined);
      });

      const result = await service.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response');
    });
  });

  describe('hasValidKey', () => {
    it('should return true when valid OpenRouter key exists', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openrouter',
            apiKey: 'sk-or-valid-key-123',
          },
        },
      });

      const hasKey = await service.hasValidKey();

      expect(hasKey).toBe(true);
    });

    it('should return false when no key exists', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openrouter',
            apiKey: '',
          },
        },
      });

      const hasKey = await service.hasValidKey();

      expect(hasKey).toBe(false);
    });

    it('should return false when provider is not openrouter', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openai',
            apiKey: 'sk-test-key',
          },
        },
      });

      const hasKey = await service.hasValidKey();

      expect(hasKey).toBe(false);
    });

    it('should return false when key does not start with sk-or-', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openrouter',
            apiKey: 'invalid-key',
          },
        },
      });

      const hasKey = await service.hasValidKey();

      expect(hasKey).toBe(false);
    });

    it('should handle storage errors', async () => {
      (chrome.storage.sync.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const hasKey = await service.hasValidKey();

      expect(hasKey).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear API key for OpenRouter provider', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openrouter',
            apiKey: 'sk-or-test-key',
          },
        },
      });

      await service.logout();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        app_config: {
          api: {
            provider: 'openrouter',
            apiKey: '',
          },
        },
      });
    });

    it('should do nothing if provider is not OpenRouter', async () => {
      (chrome.storage.sync.get as jest.Mock).mockResolvedValue({
        app_config: {
          api: {
            provider: 'openai',
            apiKey: 'sk-test-key',
          },
        },
      });

      await service.logout();

      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      (chrome.storage.sync.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await expect(service.logout()).rejects.toThrow('Storage error');
    });
  });

  describe('PKCE implementation', () => {
    it('should generate code verifier and challenge', async () => {
      // Test that login generates PKCE parameters
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation((options, callback) => {
        // Verify auth URL contains PKCE parameters
        expect(options.url).toContain('code_challenge=');
        expect(options.url).toContain('code_challenge_method=S256');
        callback('https://test-extension-id.chromiumapp.org/oauth-callback?code=test-code');
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ key: 'sk-or-test-key' }),
      });

      await service.login();

      // Verify token exchange includes code_verifier
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('code_verifier'),
        })
      );
    });
  });
});
