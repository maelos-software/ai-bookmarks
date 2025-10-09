/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * OpenRouter OAuth PKCE authentication service
 * Handles OAuth login flow for OpenRouter to allow users to authenticate
 * without manually creating API keys
 */

import { logger } from './Logger.js';

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  callbackUrl: string;
}

export class OpenRouterAuthService {
  private config: OAuthConfig;
  private codeVerifier: string | null = null;

  constructor() {
    // Get the extension's callback URL
    const extensionId = chrome.runtime.id;

    this.config = {
      authUrl: 'https://openrouter.ai/auth',
      tokenUrl: 'https://openrouter.ai/api/v1/auth/keys',
      callbackUrl: `https://${extensionId}.chromiumapp.org/oauth-callback`
    };

    logger.info('OpenRouterAuthService', 'Initialized with callback URL:', this.config.callbackUrl);
  }

  /**
   * Generate a random code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate SHA-256 code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode (RFC 4648)
   */
  private base64URLEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Initiate OAuth login flow
   * Opens OpenRouter authorization page in a new window
   */
  async login(): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    logger.info('OpenRouterAuthService', 'Starting OAuth login flow');

    try {
      // Generate PKCE code verifier and challenge
      this.codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

      logger.debug('OpenRouterAuthService', 'Generated PKCE challenge');

      // Build authorization URL
      const authParams = new URLSearchParams({
        callback_url: this.config.callbackUrl,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

      const authUrl = `${this.config.authUrl}?${authParams.toString()}`;
      logger.info('OpenRouterAuthService', 'Opening authorization URL');

      // Launch OAuth flow using Chrome identity API
      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true
          },
          async (responseUrl) => {
            if (chrome.runtime.lastError) {
              logger.error('OpenRouterAuthService', 'OAuth flow error:', chrome.runtime.lastError);
              resolve({
                success: false,
                error: chrome.runtime.lastError.message || 'Authentication failed'
              });
              return;
            }

            if (!responseUrl) {
              logger.error('OpenRouterAuthService', 'No response URL received');
              resolve({
                success: false,
                error: 'No response from authentication'
              });
              return;
            }

            logger.debug('OpenRouterAuthService', 'Received callback URL');

            try {
              // Extract authorization code from callback URL
              const url = new URL(responseUrl);
              const code = url.searchParams.get('code');

              if (!code) {
                logger.error('OpenRouterAuthService', 'No authorization code in callback');
                resolve({
                  success: false,
                  error: 'No authorization code received'
                });
                return;
              }

              logger.info('OpenRouterAuthService', 'Authorization code received, exchanging for API key');

              // Exchange authorization code for API key
              const apiKey = await this.exchangeCodeForKey(code);

              logger.info('OpenRouterAuthService', 'Successfully obtained API key');
              resolve({
                success: true,
                apiKey
              });
            } catch (error) {
              logger.error('OpenRouterAuthService', 'Failed to process callback:', error);
              resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to complete authentication'
              });
            }
          }
        );
      });
    } catch (error) {
      logger.error('OpenRouterAuthService', 'Login flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during login'
      };
    }
  }

  /**
   * Exchange authorization code for API key
   */
  private async exchangeCodeForKey(code: string): Promise<string> {
    logger.info('OpenRouterAuthService', 'Exchanging authorization code for API key');

    if (!this.codeVerifier) {
      throw new Error('No code verifier available');
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code,
        code_verifier: this.codeVerifier,
        code_challenge_method: 'S256'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouterAuthService', `Token exchange failed: ${response.status}`, errorText);
      throw new Error(`Failed to exchange code for API key: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.key) {
      logger.error('OpenRouterAuthService', 'No API key in response:', data);
      throw new Error('No API key in response');
    }

    // Clear code verifier after use
    this.codeVerifier = null;

    return data.key;
  }

  /**
   * Check if we have a valid stored API key from OAuth
   */
  async hasValidKey(): Promise<boolean> {
    try {
      const result = await chrome.storage.sync.get('app_config');
      const config = result.app_config;

      return !!(
        config?.api?.provider === 'openrouter' &&
        config?.api?.apiKey &&
        config?.api?.apiKey.startsWith('sk-or-')
      );
    } catch (error) {
      logger.error('OpenRouterAuthService', 'Failed to check for valid key:', error);
      return false;
    }
  }

  /**
   * Logout - clear stored API key
   */
  async logout(): Promise<void> {
    logger.info('OpenRouterAuthService', 'Logging out - clearing stored API key');

    try {
      const result = await chrome.storage.sync.get('app_config');
      const config = result.app_config;

      if (config?.api?.provider === 'openrouter') {
        config.api.apiKey = '';
        await chrome.storage.sync.set({ app_config: config });
        logger.info('OpenRouterAuthService', 'API key cleared');
      }
    } catch (error) {
      logger.error('OpenRouterAuthService', 'Failed to logout:', error);
      throw error;
    }
  }
}
