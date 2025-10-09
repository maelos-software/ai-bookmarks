/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Options page controller
 */

import { AppConfig, DEFAULT_CATEGORIES, DEFAULT_MODELS, DEFAULT_PERFORMANCE } from '../services/ConfigurationManager.js';
import { OpenRouterAuthService } from '../services/OpenRouterAuthService.js';

class OptionsController {
  private form: HTMLFormElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private apiTimeoutInput: HTMLInputElement;
  private batchSizeInput: HTMLInputElement;
  private maxTokensInput: HTMLInputElement;
  private removeDuplicatesCheckbox: HTMLInputElement;
  private removeEmptyFoldersCheckbox: HTMLInputElement;
  private categoriesTextarea: HTMLTextAreaElement;
  private ignoreFoldersInput: HTMLInputElement;
  private organizeSavedTabsCheckbox: HTMLInputElement;
  private autoOrganizeCheckbox: HTMLInputElement;
  private respectOrganizationHistoryCheckbox: HTMLInputElement;
  private clearHistoryBtn: HTMLButtonElement;
  private logLevelSelect: HTMLSelectElement;
  private consoleLoggingCheckbox: HTMLInputElement;
  private saveBtn: HTMLButtonElement;
  private testBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private statusDiv: HTMLElement;
  private testStatusDiv: HTMLElement;
  private systemFoldersList: HTMLElement;
  private systemFolders: Array<{ id: string; title: string; isRoot: boolean }> = [];
  private openrouterOAuthSection: HTMLElement;
  private openrouterLoginBtn: HTMLButtonElement;
  private openrouterLogoutBtn: HTMLButtonElement;
  private oauthStatusDiv: HTMLElement;
  private openrouterModelsHelp: HTMLElement;
  private authService: OpenRouterAuthService;
  private customEndpointSection: HTMLElement;
  private customEndpointInput: HTMLInputElement;
  private customModelNameInput: HTMLInputElement;
  private unsavedChangesBanner: HTMLElement;
  private hasUnsavedChanges: boolean = false;

  constructor() {
    this.form = document.getElementById('optionsForm') as HTMLFormElement;
    this.providerSelect = document.getElementById('provider') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    this.modelInput = document.getElementById('model') as HTMLInputElement;
    this.apiTimeoutInput = document.getElementById('apiTimeout') as HTMLInputElement;
    this.batchSizeInput = document.getElementById('batchSize') as HTMLInputElement;
    this.maxTokensInput = document.getElementById('maxTokens') as HTMLInputElement;
    this.removeDuplicatesCheckbox = document.getElementById('removeDuplicates') as HTMLInputElement;
    this.removeEmptyFoldersCheckbox = document.getElementById('removeEmptyFolders') as HTMLInputElement;
    this.categoriesTextarea = document.getElementById('categories') as HTMLTextAreaElement;
    this.ignoreFoldersInput = document.getElementById('ignoreFolders') as HTMLInputElement;
    this.organizeSavedTabsCheckbox = document.getElementById('organizeSavedTabs') as HTMLInputElement;
    this.autoOrganizeCheckbox = document.getElementById('autoOrganize') as HTMLInputElement;
    this.respectOrganizationHistoryCheckbox = document.getElementById('respectOrganizationHistory') as HTMLInputElement;
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;
    this.logLevelSelect = document.getElementById('logLevel') as HTMLSelectElement;
    this.consoleLoggingCheckbox = document.getElementById('consoleLogging') as HTMLInputElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.testBtn = document.getElementById('testBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    this.testStatusDiv = document.getElementById('test-status') as HTMLElement;
    this.systemFoldersList = document.getElementById('system-folders-list') as HTMLElement;
    this.openrouterOAuthSection = document.getElementById('openrouter-oauth-section') as HTMLElement;
    this.openrouterLoginBtn = document.getElementById('openrouter-login-btn') as HTMLButtonElement;
    this.openrouterLogoutBtn = document.getElementById('openrouter-logout-btn') as HTMLButtonElement;
    this.oauthStatusDiv = document.getElementById('oauth-status') as HTMLElement;
    this.openrouterModelsHelp = document.getElementById('openrouter-models-help') as HTMLElement;
    this.customEndpointSection = document.getElementById('custom-endpoint-section') as HTMLElement;
    this.customEndpointInput = document.getElementById('customEndpoint') as HTMLInputElement;
    this.customModelNameInput = document.getElementById('customModelName') as HTMLInputElement;
    this.unsavedChangesBanner = document.getElementById('unsaved-changes-banner') as HTMLElement;

    this.authService = new OpenRouterAuthService();

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });

    this.testBtn.addEventListener('click', () => {
      this.handleTest();
    });

    this.resetBtn.addEventListener('click', () => {
      this.handleReset();
    });

    this.clearHistoryBtn.addEventListener('click', () => {
      this.handleClearHistory();
    });

    this.openrouterLoginBtn.addEventListener('click', () => {
      this.handleOpenRouterLogin();
    });

    this.openrouterLogoutBtn.addEventListener('click', () => {
      this.handleOpenRouterLogout();
    });

    this.providerSelect.addEventListener('change', () => {
      this.updateModelPlaceholder();
      this.toggleOpenRouterOAuthSection();
      this.toggleCustomEndpointSection();
      this.highlightTestButton();
      this.markUnsavedChanges();
    });

    this.apiKeyInput.addEventListener('input', () => {
      this.highlightTestButton();
      this.markUnsavedChanges();
    });

    this.modelInput.addEventListener('input', () => {
      this.highlightTestButton();
      this.markUnsavedChanges();
    });

    // Add change detection to all form inputs
    this.customEndpointInput.addEventListener('input', () => this.markUnsavedChanges());
    this.customModelNameInput.addEventListener('input', () => this.markUnsavedChanges());
    this.apiTimeoutInput.addEventListener('input', () => this.markUnsavedChanges());
    this.batchSizeInput.addEventListener('input', () => this.markUnsavedChanges());
    this.maxTokensInput.addEventListener('input', () => this.markUnsavedChanges());
    this.categoriesTextarea.addEventListener('input', () => this.markUnsavedChanges());
    this.ignoreFoldersInput.addEventListener('input', () => this.markUnsavedChanges());
    this.removeDuplicatesCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.removeEmptyFoldersCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.organizeSavedTabsCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.autoOrganizeCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.respectOrganizationHistoryCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.logLevelSelect.addEventListener('change', () => this.markUnsavedChanges());
    this.consoleLoggingCheckbox.addEventListener('change', () => this.markUnsavedChanges());

    this.loadSystemFolders();
    this.loadConfig();
  }

  private async loadSystemFolders() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SYSTEM_FOLDERS' });
      if (response.success) {
        this.systemFolders = response.folders;
        this.renderSystemFolders();
      } else {
        this.systemFoldersList.innerHTML = '<div style="text-align: center; color: #c62828;">Failed to load system folders</div>';
      }
    } catch (error) {
      console.error('Failed to load system folders:', error);
      this.systemFoldersList.innerHTML = '<div style="text-align: center; color: #c62828;">Error loading system folders</div>';
    }
  }

  private renderSystemFolders() {
    if (this.systemFolders.length === 0) {
      this.systemFoldersList.innerHTML = '<div style="text-align: center; color: #999;">No system folders found</div>';
      return;
    }

    // Filter out Trash - should never be organized (always excluded)
    const visibleFolders = this.systemFolders.filter(f =>
      f.title.toLowerCase().trim() !== 'trash'
    );

    // Set Speed Dial and Home unchecked by default
    const defaultUnchecked = new Set(['speed dial', 'home']);

    this.systemFoldersList.innerHTML = visibleFolders.map(folder => {
      const isUncheckedByDefault = defaultUnchecked.has(folder.title.toLowerCase().trim());
      const checkedAttr = isUncheckedByDefault ? '' : 'checked';

      return `
        <div class="checkbox-group">
          <input type="checkbox" id="folder-${folder.id}" data-folder-id="${folder.id}" ${checkedAttr}>
          <label for="folder-${folder.id}">${this.escapeHtml(folder.title)}${folder.isRoot ? ' <span style="color: #999; font-size: 0.85em;">(Root)</span>' : ''}</label>
        </div>
      `;
    }).join('');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async loadConfig() {
    try {
      const result = await chrome.storage.sync.get('app_config');
      const config: AppConfig = result.app_config;

      if (config) {
        // API Config
        this.providerSelect.value = config.api.provider || 'openai';
        this.apiKeyInput.value = config.api.apiKey || '';
        this.modelInput.value = config.api.model || '';
        this.customEndpointInput.value = config.api.customEndpoint || '';
        this.customModelNameInput.value = config.api.customModelName || '';

        // Performance Config
        if (config.performance) {
          this.apiTimeoutInput.value = String(config.performance.apiTimeout || DEFAULT_PERFORMANCE.apiTimeout);
          this.batchSizeInput.value = String(config.performance.batchSize || DEFAULT_PERFORMANCE.batchSize);
          this.maxTokensInput.value = String(config.performance.maxTokens || DEFAULT_PERFORMANCE.maxTokens);
        }

        // Organization Config
        if (config.organization) {
          this.removeDuplicatesCheckbox.checked = config.organization.removeDuplicates !== false;
          this.removeEmptyFoldersCheckbox.checked = config.organization.removeEmptyFolders !== false;

          // Use default categories if none are configured
          const categories = (config.organization.categories?.length > 0)
            ? config.organization.categories
            : DEFAULT_CATEGORIES;
          this.categoriesTextarea.value = categories.join('\n');

          this.ignoreFoldersInput.value = (config.organization.ignoreFolders || []).join(', ');
          this.organizeSavedTabsCheckbox.checked = config.organization.organizeSavedTabs === true;
          this.autoOrganizeCheckbox.checked = config.organization.autoOrganize === true;
          this.respectOrganizationHistoryCheckbox.checked = config.organization.respectOrganizationHistory === true;

          // Apply excluded system folder IDs
          const excludedIds = new Set(config.organization.excludedSystemFolderIds || []);
          this.systemFolders.forEach(folder => {
            const checkbox = document.getElementById(`folder-${folder.id}`) as HTMLInputElement;
            if (checkbox) {
              checkbox.checked = !excludedIds.has(folder.id);
            }
          });
        }

        // Debug Config
        if (config.debug) {
          this.logLevelSelect.value = String(config.debug.logLevel !== undefined ? config.debug.logLevel : 0);
          this.consoleLoggingCheckbox.checked = config.debug.consoleLogging !== false;
        }

        this.updateModelPlaceholder();
      } else {
        // No config yet - set defaults
        this.providerSelect.value = 'openrouter';
        this.updateModelPlaceholder();
      }

      // Toggle OAuth and custom endpoint sections after config is loaded
      this.toggleOpenRouterOAuthSection();
      this.toggleCustomEndpointSection();
    } catch (error) {
      this.showStatus('Error loading configuration', 'error');
      console.error('Failed to load config:', error);
    }
  }

  private highlightTestButton() {
    // Only highlight if there's an API key entered
    if (this.apiKeyInput.value.trim()) {
      this.testBtn.classList.add('highlight');
    }
  }

  private unhighlightTestButton() {
    this.testBtn.classList.remove('highlight');
  }

  private async handleTest() {
    const provider = this.providerSelect.value as 'openai' | 'claude' | 'grok' | 'openrouter' | 'custom';
    const apiKey = this.apiKeyInput.value.trim();
    const model = this.modelInput.value.trim();
    const customEndpoint = this.customEndpointInput.value.trim();
    const customModelName = this.customModelNameInput.value.trim();

    if (!apiKey) {
      this.showTestStatus('Please enter an API key', 'error');
      return;
    }

    this.testBtn.disabled = true;
    this.unhighlightTestButton();
    this.showTestStatus('Testing connection...', 'info');

    try {
      const config = {
        provider,
        apiKey,
        model: model || undefined,
        customEndpoint: customEndpoint || undefined,
        customModelName: customModelName || undefined
      };

      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        config
      });

      if (response.success) {
        const responseTime = Math.round(response.responseTime);
        let statusMessage = `✓ Connection successful! (${responseTime}ms) Model: ${response.model}`;

        // Add credits and rate limit info if available (OpenRouter)
        if (response.credits !== undefined || response.rateLimit) {
          const credits = response.credits || 0;
          statusMessage += ` | Credits: $${credits.toFixed(2)}`;

          if (response.rateLimit && response.rateLimit.remaining !== undefined) {
            statusMessage += ` | Rate Limit: ${response.rateLimit.remaining}/${response.rateLimit.limit}`;

            // Show warnings
            if (credits === 0 && response.rateLimit.remaining === 0) {
              statusMessage += ' ⚠️ NO CAPACITY';
            } else if (response.rateLimit.remaining <= 5 && credits < 0.10) {
              statusMessage += ' ⚠️ LOW';
            }
          } else if (credits < 1) {
            statusMessage += ' ⚠️ Low';
          }
        }

        this.showTestStatus(statusMessage, 'success');
      } else {
        this.showTestStatus(`✗ ${provider} API not available: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showTestStatus(`✗ Error: ${error}`, 'error');
    } finally {
      this.testBtn.disabled = false;
    }
  }

  private async handleSave() {
    // Get current config to preserve renamedSpeedDialFolderIds
    const result = await chrome.storage.sync.get('app_config');
    const currentConfig: AppConfig = result.app_config;

    const provider = this.providerSelect.value as 'openai' | 'claude' | 'grok' | 'openrouter' | 'custom';
    const apiKey = this.apiKeyInput.value.trim();
    const model = this.modelInput.value.trim();
    const customEndpoint = this.customEndpointInput.value.trim();
    const customModelName = this.customModelNameInput.value.trim();
    const apiTimeout = parseInt(this.apiTimeoutInput.value);
    const batchSize = parseInt(this.batchSizeInput.value);
    const maxTokens = parseInt(this.maxTokensInput.value);
    const removeDuplicates = this.removeDuplicatesCheckbox.checked;
    const removeEmptyFolders = this.removeEmptyFoldersCheckbox.checked;
    const categoriesText = this.categoriesTextarea.value.trim();
    const ignoreFoldersText = this.ignoreFoldersInput.value.trim();
    const organizeSavedTabs = this.organizeSavedTabsCheckbox.checked;
    const autoOrganize = this.autoOrganizeCheckbox.checked;
    const respectOrganizationHistory = this.respectOrganizationHistoryCheckbox.checked;
    const logLevel = parseInt(this.logLevelSelect.value);
    const consoleLogging = this.consoleLoggingCheckbox.checked;

    // Validation
    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    if (apiTimeout < 30 || apiTimeout > 600) {
      this.showStatus('API timeout must be between 30 and 600 seconds', 'error');
      return;
    }

    if (batchSize < 10 || batchSize > 100) {
      this.showStatus('Batch size must be between 10 and 100 bookmarks', 'error');
      return;
    }

    this.saveBtn.disabled = true;
    this.showStatus('Saving...', 'info');

    try {
      const categories = categoriesText
        ? categoriesText.split('\n').map(c => c.trim()).filter(c => c.length > 0)
        : [];

      const ignoreFolders = ignoreFoldersText
        ? ignoreFoldersText.split(',').map(f => f.trim()).filter(f => f.length > 0)
        : [];

      // Collect excluded system folder IDs (unchecked = excluded)
      const excludedSystemFolderIds: string[] = [];
      this.systemFolders.forEach(folder => {
        const checkbox = document.getElementById(`folder-${folder.id}`) as HTMLInputElement;
        if (checkbox && !checkbox.checked) {
          excludedSystemFolderIds.push(folder.id);
        }
      });

      const config: AppConfig = {
        api: {
          provider,
          apiKey,
          model: model || undefined,
          customEndpoint: customEndpoint || undefined,
          customModelName: customModelName || undefined
        },
        performance: {
          apiTimeout,
          batchSize,
          maxTokens
        },
        organization: {
          removeDuplicates,
          removeEmptyFolders,
          categories,
          ignoreFolders,
          excludedSystemFolderIds,
          renamedSpeedDialFolderIds: currentConfig?.organization?.renamedSpeedDialFolderIds || [],
          organizeSavedTabs,
          autoOrganize,
          respectOrganizationHistory
        },
        debug: {
          logLevel,
          consoleLogging
        },
        ignorePatterns: []
      };

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config
      });

      if (response.success) {
        this.showStatus('✓ Configuration saved successfully!', 'success');
        this.clearUnsavedChanges();

        // Update logger settings immediately
        await chrome.runtime.sendMessage({
          type: 'UPDATE_LOGGER_CONFIG',
          config: config.debug
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      this.showStatus(`Error: ${error}`, 'error');
      console.error('Failed to save config:', error);
    } finally {
      this.saveBtn.disabled = false;
    }
  }

  private updateModelPlaceholder() {
    const provider = this.providerSelect.value as keyof typeof DEFAULT_MODELS;
    const placeholder = DEFAULT_MODELS[provider] || '';
    this.modelInput.placeholder = placeholder;
  }

  private async handleReset() {
    if (!confirm('Are you sure you want to reset all settings to defaults? Your API key will be cleared and you will be signed out of OpenRouter.')) {
      return;
    }

    this.resetBtn.disabled = true;
    this.showStatus('Resetting to defaults...', 'info');

    try {
      // Get current config to preserve API key
      const result = await chrome.storage.sync.get('app_config');
      const currentConfig: AppConfig = result.app_config;

      // Sign out of OpenRouter if logged in
      if (this.providerSelect.value === 'openrouter') {
        await this.authService.logout();
      }

      // Set defaults (preserve existing API key and provider if they exist)
      // User must manually change provider/key if they want to clear it
      this.providerSelect.value = currentConfig?.api?.provider || 'openrouter';
      this.apiKeyInput.value = currentConfig?.api?.apiKey || '';
      this.modelInput.value = '';
      this.apiTimeoutInput.value = String(DEFAULT_PERFORMANCE.apiTimeout);
      this.batchSizeInput.value = String(DEFAULT_PERFORMANCE.batchSize);
      this.maxTokensInput.value = String(DEFAULT_PERFORMANCE.maxTokens);
      this.removeDuplicatesCheckbox.checked = true;
      this.removeEmptyFoldersCheckbox.checked = true;
      this.categoriesTextarea.value = DEFAULT_CATEGORIES.join('\n');
      this.ignoreFoldersInput.value = '';
      this.organizeSavedTabsCheckbox.checked = false;
      this.autoOrganizeCheckbox.checked = false;
      this.respectOrganizationHistoryCheckbox.checked = true;
      this.logLevelSelect.value = '0';
      this.consoleLoggingCheckbox.checked = true;

      this.updateModelPlaceholder();
      this.toggleOpenRouterOAuthSection();
      this.markUnsavedChanges();
      this.showStatus('✓ Reset to defaults! (API key preserved) Click Save to apply changes.', 'success');
    } catch (error) {
      this.showStatus(`Error: ${error}`, 'error');
      console.error('Failed to reset:', error);
    } finally {
      this.resetBtn.disabled = false;
    }
  }

  private showStatus(message: string, type: 'info' | 'success' | 'error') {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;

    if (type === 'success') {
      setTimeout(() => {
        this.statusDiv.className = 'status';
      }, 5000);
    }
  }

  private showTestStatus(message: string, type: 'info' | 'success' | 'error') {
    this.testStatusDiv.textContent = message;
    this.testStatusDiv.className = `status ${type}`;

    if (type === 'success') {
      setTimeout(() => {
        this.testStatusDiv.className = 'status';
      }, 5000);
    }
  }

  private markUnsavedChanges() {
    if (!this.hasUnsavedChanges) {
      this.hasUnsavedChanges = true;
      this.unsavedChangesBanner.classList.add('visible');
    }
  }

  private clearUnsavedChanges() {
    this.hasUnsavedChanges = false;
    this.unsavedChangesBanner.classList.remove('visible');
  }

  private toggleCustomEndpointSection() {
    const isCustom = this.providerSelect.value === 'custom';
    this.customEndpointSection.style.display = isCustom ? 'block' : 'none';
  }

  private toggleOpenRouterOAuthSection() {
    const isOpenRouter = this.providerSelect.value === 'openrouter';
    this.openrouterOAuthSection.style.display = isOpenRouter ? 'block' : 'none';
    this.openrouterModelsHelp.style.display = isOpenRouter ? 'block' : 'none';

    // Check if already logged in
    if (isOpenRouter) {
      this.updateOAuthStatus();
    } else {
      // Re-enable API key field for non-OpenRouter providers
      this.apiKeyInput.disabled = false;
      this.apiKeyInput.placeholder = 'sk-...';
    }
  }

  private async updateOAuthStatus() {
    const hasKey = await this.authService.hasValidKey();

    if (hasKey) {
      this.openrouterLoginBtn.style.display = 'none';
      this.openrouterLogoutBtn.style.display = 'block';
      this.oauthStatusDiv.style.display = 'block';
      this.oauthStatusDiv.innerHTML = '<span style="color: #2e7d32;">✓ Signed in with OpenRouter</span>';
      this.apiKeyInput.disabled = true;
      this.apiKeyInput.placeholder = 'Using OAuth - signed in successfully';
    } else {
      this.openrouterLoginBtn.style.display = 'block';
      this.openrouterLogoutBtn.style.display = 'none';
      this.oauthStatusDiv.style.display = 'none';
      this.apiKeyInput.disabled = false;
      this.apiKeyInput.placeholder = 'sk-or-...';
    }
  }

  private async handleOpenRouterLogin() {
    this.openrouterLoginBtn.disabled = true;
    this.openrouterLoginBtn.textContent = '⏳ Opening OpenRouter...';
    this.oauthStatusDiv.style.display = 'block';
    this.oauthStatusDiv.innerHTML = '<span style="color: #1976d2;">Opening authorization page...</span>';

    try {
      const result = await this.authService.login();

      if (result.success && result.apiKey) {
        // Store the API key
        this.apiKeyInput.value = result.apiKey;
        this.providerSelect.value = 'openrouter';

        // Show success status
        this.oauthStatusDiv.innerHTML = '<span style="color: #2e7d32;">✓ Successfully signed in! Saving configuration...</span>';

        // Auto-save the configuration
        await this.handleSave();

        // Update UI
        await this.updateOAuthStatus();

        this.showStatus('✓ Successfully signed in with OpenRouter!', 'success');

        // Automatically run connection test
        this.unhighlightTestButton();
        this.showTestStatus('Testing connection...', 'info');
        await this.handleTest();
      } else {
        this.oauthStatusDiv.innerHTML = `<span style="color: #c62828;">✗ ${result.error || 'Login failed'}</span>`;
        this.showStatus(`Login failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('OAuth login error:', error);
      this.oauthStatusDiv.innerHTML = '<span style="color: #c62828;">✗ An error occurred during login</span>';
      this.showStatus(`Error: ${error}`, 'error');
    } finally {
      this.openrouterLoginBtn.disabled = false;
      this.openrouterLoginBtn.textContent = '🚀 Sign In with OpenRouter';
    }
  }

  private async handleOpenRouterLogout() {
    if (!confirm('Are you sure you want to sign out of OpenRouter? Your API key will be removed.')) {
      return;
    }

    this.openrouterLogoutBtn.disabled = true;

    try {
      await this.authService.logout();
      this.apiKeyInput.value = '';
      await this.updateOAuthStatus();
      this.showStatus('✓ Signed out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      this.showStatus(`Error during logout: ${error}`, 'error');
    } finally {
      this.openrouterLogoutBtn.disabled = false;
    }
  }

  private async handleClearHistory() {
    if (!confirm('Are you sure you want to clear the organization history? This will allow all bookmarks to be reorganized in future runs.')) {
      return;
    }

    this.clearHistoryBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_ORGANIZATION_HISTORY' });

      if (response && response.success) {
        this.showStatus('✓ Organization history cleared successfully', 'success');
      } else {
        throw new Error(response?.error || 'Failed to clear history');
      }
    } catch (error) {
      console.error('Clear history error:', error);
      this.showStatus(`Error clearing history: ${error}`, 'error');
    } finally {
      this.clearHistoryBtn.disabled = false;
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
