/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Options page controller
 */

import {
  AppConfig,
  DEFAULT_CATEGORIES,
  DEFAULT_MODELS,
  DEFAULT_PERFORMANCE,
} from '../services/ConfigurationManager.js';
import { OpenRouterAuthService } from '../services/OpenRouterAuthService.js';

class OptionsController {
  private form: HTMLFormElement;
  private providerSelect: HTMLSelectElement;
  private apiKeyInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private apiTimeoutInput: HTMLInputElement;
  private batchSizeInput: HTMLInputElement;
  private maxTokensInput: HTMLInputElement;
  private retryAttemptsInput: HTMLInputElement;
  private retryDelayInput: HTMLInputElement;
  private removeDuplicatesCheckbox: HTMLInputElement;
  private removeEmptyFoldersCheckbox: HTMLInputElement;
  private categoriesTextarea: HTMLTextAreaElement;
  private ignoreFoldersInput: HTMLInputElement;
  private organizeSavedTabsCheckbox: HTMLInputElement;
  private autoOrganizeCheckbox: HTMLInputElement;
  private folderModeRadios: NodeListOf<HTMLInputElement>;
  private respectOrganizationHistoryRadios: NodeListOf<HTMLInputElement>;
  private clearHistoryBtn: HTMLButtonElement;
  private markAllOrganizedBtn: HTMLButtonElement;
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
  private apiKeySection: HTMLElement;
  private customEndpointSection: HTMLElement;
  private customEndpointInput: HTMLInputElement;
  private customModelNameInput: HTMLInputElement;
  private geminiSetupSection: HTMLElement;
  private geminiGetKeyBtn: HTMLButtonElement;
  private unsavedChangesBanner: HTMLElement;
  private bannerSaveBtn: HTMLButtonElement;
  private hasUnsavedChanges: boolean = false;
  private confirmationOverlay: HTMLElement;
  private confirmationTitle: HTMLElement;
  private confirmationMessage: HTMLElement;
  private confirmCancelBtn: HTMLButtonElement;
  private confirmProceedBtn: HTMLButtonElement;
  private confirmCallback: (() => void) | null = null;

  constructor() {
    this.form = document.getElementById('optionsForm') as HTMLFormElement;
    this.providerSelect = document.getElementById('provider') as HTMLSelectElement;
    this.apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    this.modelInput = document.getElementById('model') as HTMLInputElement;
    this.apiTimeoutInput = document.getElementById('apiTimeout') as HTMLInputElement;
    this.batchSizeInput = document.getElementById('batchSize') as HTMLInputElement;
    this.maxTokensInput = document.getElementById('maxTokens') as HTMLInputElement;
    this.retryAttemptsInput = document.getElementById('retryAttempts') as HTMLInputElement;
    this.retryDelayInput = document.getElementById('retryDelay') as HTMLInputElement;
    this.removeDuplicatesCheckbox = document.getElementById('removeDuplicates') as HTMLInputElement;
    this.removeEmptyFoldersCheckbox = document.getElementById(
      'removeEmptyFolders'
    ) as HTMLInputElement;
    this.categoriesTextarea = document.getElementById('categories') as HTMLTextAreaElement;
    this.ignoreFoldersInput = document.getElementById('ignoreFolders') as HTMLInputElement;
    this.organizeSavedTabsCheckbox = document.getElementById(
      'organizeSavedTabs'
    ) as HTMLInputElement;
    this.autoOrganizeCheckbox = document.getElementById('autoOrganize') as HTMLInputElement;
    this.folderModeRadios = document.querySelectorAll(
      'input[name="folderMode"]'
    ) as NodeListOf<HTMLInputElement>;
    this.respectOrganizationHistoryRadios = document.querySelectorAll(
      'input[name="respectOrganizationHistory"]'
    ) as NodeListOf<HTMLInputElement>;
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn') as HTMLButtonElement;
    this.markAllOrganizedBtn = document.getElementById('markAllOrganizedBtn') as HTMLButtonElement;
    this.logLevelSelect = document.getElementById('logLevel') as HTMLSelectElement;
    this.consoleLoggingCheckbox = document.getElementById('consoleLogging') as HTMLInputElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.testBtn = document.getElementById('testBtn') as HTMLButtonElement;
    this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    this.testStatusDiv = document.getElementById('test-status') as HTMLElement;
    this.systemFoldersList = document.getElementById('system-folders-list') as HTMLElement;
    this.openrouterOAuthSection = document.getElementById(
      'openrouter-oauth-section'
    ) as HTMLElement;
    this.openrouterLoginBtn = document.getElementById('openrouter-login-btn') as HTMLButtonElement;
    this.openrouterLogoutBtn = document.getElementById(
      'openrouter-logout-btn'
    ) as HTMLButtonElement;
    this.oauthStatusDiv = document.getElementById('oauth-status') as HTMLElement;
    this.openrouterModelsHelp = document.getElementById('openrouter-models-help') as HTMLElement;
    this.apiKeySection = document.getElementById('api-key-section') as HTMLElement;
    this.customEndpointSection = document.getElementById('custom-endpoint-section') as HTMLElement;
    this.customEndpointInput = document.getElementById('customEndpoint') as HTMLInputElement;
    this.customModelNameInput = document.getElementById('customModelName') as HTMLInputElement;
    this.geminiSetupSection = document.getElementById('gemini-setup-section') as HTMLElement;
    this.geminiGetKeyBtn = document.getElementById('gemini-get-key-btn') as HTMLButtonElement;
    this.unsavedChangesBanner = document.getElementById('unsaved-changes-banner') as HTMLElement;
    this.bannerSaveBtn = document.getElementById('banner-save-btn') as HTMLButtonElement;
    this.confirmationOverlay = document.getElementById('confirmation-overlay') as HTMLElement;
    this.confirmationTitle = document.getElementById('confirmation-title') as HTMLElement;
    this.confirmationMessage = document.getElementById('confirmation-message') as HTMLElement;
    this.confirmCancelBtn = document.getElementById('confirm-cancel-btn') as HTMLButtonElement;
    this.confirmProceedBtn = document.getElementById('confirm-proceed-btn') as HTMLButtonElement;

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

    this.markAllOrganizedBtn.addEventListener('click', () => {
      this.handleMarkAllOrganized();
    });

    this.openrouterLoginBtn.addEventListener('click', () => {
      this.handleOpenRouterLogin();
    });

    this.openrouterLogoutBtn.addEventListener('click', () => {
      this.handleOpenRouterLogout();
    });

    this.geminiGetKeyBtn.addEventListener('click', () => {
      window.open('https://aistudio.google.com/apikey', '_blank');
    });

    this.bannerSaveBtn.addEventListener('click', () => {
      this.handleSave();
    });

    this.confirmCancelBtn.addEventListener('click', () => {
      this.hideConfirmation();
    });

    this.confirmProceedBtn.addEventListener('click', () => {
      if (this.confirmCallback) {
        this.confirmCallback();
      }
      this.hideConfirmation();
    });

    // Setup collapsible Advanced Settings
    this.setupCollapsibleSection();

    this.providerSelect.addEventListener('change', () => {
      this.updateModelPlaceholder();
      this.toggleOpenRouterOAuthSection();
      this.toggleGeminiSetupSection();
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
    this.retryAttemptsInput.addEventListener('input', () => this.markUnsavedChanges());
    this.retryDelayInput.addEventListener('input', () => this.markUnsavedChanges());
    this.categoriesTextarea.addEventListener('input', () => this.markUnsavedChanges());
    this.ignoreFoldersInput.addEventListener('input', () => this.markUnsavedChanges());
    this.removeDuplicatesCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.removeEmptyFoldersCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.organizeSavedTabsCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.autoOrganizeCheckbox.addEventListener('change', () => this.markUnsavedChanges());
    this.folderModeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.markUnsavedChanges();
        this.updateFolderModeUI();
        this.updateRadioCardStates();
      });
    });
    this.respectOrganizationHistoryRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.markUnsavedChanges();
        this.updateRadioCardStates();
      });
    });
    this.logLevelSelect.addEventListener('change', () => this.markUnsavedChanges());
    this.consoleLoggingCheckbox.addEventListener('change', () => this.markUnsavedChanges());

    // Setup radio card visual feedback
    this.setupRadioCardFeedback();

    this.loadSystemFolders();
    this.loadConfig();
  }

  /**
   * Add visual feedback for radio option cards
   */
  private setupRadioCardFeedback() {
    // Initialize on load (will be called again after config loads)
    this.updateRadioCardStates();
  }

  /**
   * Update visual state of radio option cards based on selection
   */
  private updateRadioCardStates() {
    const radioCards = document.querySelectorAll('.radio-option-card');
    radioCards.forEach((card) => {
      const radio = card.querySelector('input[type="radio"]') as HTMLInputElement;
      if (radio && radio.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  /**
   * Update UI based on folder mode selection (enable/disable categories textarea)
   */
  private updateFolderModeUI() {
    let useExisting = false;
    this.folderModeRadios.forEach((radio) => {
      if (radio.checked && radio.value === 'existing') {
        useExisting = true;
      }
    });

    // Gray out and disable categories textarea when using existing folders
    this.categoriesTextarea.disabled = useExisting;
    this.categoriesTextarea.style.opacity = useExisting ? '0.5' : '1';
    this.categoriesTextarea.style.cursor = useExisting ? 'not-allowed' : 'text';

    // Update help text
    const helpText = document.getElementById('categories-help');
    if (helpText) {
      if (useExisting) {
        helpText.textContent =
          'Categories are not used when "Use Existing Folders Only" mode is selected. Your existing folder structure will be used instead.';
        helpText.style.fontStyle = 'italic';
        helpText.style.color = '#999';
      } else {
        helpText.textContent =
          'One category per line. These categories will be used to organize your bookmarks. Add, remove, or rename categories to match your preferences.';
        helpText.style.fontStyle = 'normal';
        helpText.style.color = '';
      }
    }
  }

  private async loadSystemFolders() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SYSTEM_FOLDERS' });
      if (response.success) {
        this.systemFolders = response.folders;
        this.renderSystemFolders();
      } else {
        this.systemFoldersList.innerHTML =
          '<div style="text-align: center; color: #c62828;">Failed to load system folders</div>';
      }
    } catch (error) {
      console.error('Failed to load system folders:', error);
      this.systemFoldersList.innerHTML =
        '<div style="text-align: center; color: #c62828;">Error loading system folders</div>';
    }
  }

  private renderSystemFolders() {
    if (this.systemFolders.length === 0) {
      this.systemFoldersList.innerHTML =
        '<div style="text-align: center; color: #999;">No system folders found</div>';
      return;
    }

    // Filter out Trash - should never be organized (always excluded)
    const visibleFolders = this.systemFolders.filter(
      (f) => f.title.toLowerCase().trim() !== 'trash'
    );

    // Set Speed Dial and Home unchecked by default
    const defaultUnchecked = new Set(['speed dial', 'home']);

    this.systemFoldersList.innerHTML = visibleFolders
      .map((folder) => {
        const isUncheckedByDefault = defaultUnchecked.has(folder.title.toLowerCase().trim());
        const checkedAttr = isUncheckedByDefault ? '' : 'checked';

        return `
        <div class="checkbox-group">
          <input type="checkbox" id="folder-${folder.id}" data-folder-id="${folder.id}" ${checkedAttr}>
          <label for="folder-${folder.id}">${this.escapeHtml(folder.title)}${folder.isRoot ? ' <span style="color: #999; font-size: 0.85em;">(Root)</span>' : ''}</label>
        </div>
      `;
      })
      .join('');
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
          this.apiTimeoutInput.value = String(
            config.performance.apiTimeout || DEFAULT_PERFORMANCE.apiTimeout
          );
          this.batchSizeInput.value = String(
            config.performance.batchSize || DEFAULT_PERFORMANCE.batchSize
          );
          this.maxTokensInput.value = String(
            config.performance.maxTokens || DEFAULT_PERFORMANCE.maxTokens
          );
          this.retryAttemptsInput.value = String(
            config.performance.retryAttempts ?? DEFAULT_PERFORMANCE.retryAttempts
          );
          this.retryDelayInput.value = String(
            config.performance.retryDelay ?? DEFAULT_PERFORMANCE.retryDelay
          );
        }

        // Organization Config
        if (config.organization) {
          this.removeDuplicatesCheckbox.checked = config.organization.removeDuplicates !== false;
          this.removeEmptyFoldersCheckbox.checked =
            config.organization.removeEmptyFolders !== false;

          // Use default categories if none are configured
          const categories =
            config.organization.categories?.length > 0
              ? config.organization.categories
              : DEFAULT_CATEGORIES;
          this.categoriesTextarea.value = categories.join('\n');

          this.ignoreFoldersInput.value = (config.organization.ignoreFolders || []).join(', ');
          this.organizeSavedTabsCheckbox.checked = config.organization.organizeSavedTabs === true;
          this.autoOrganizeCheckbox.checked = config.organization.autoOrganize === true;

          // Set folder mode radio button
          const folderMode = config.organization.useExistingFolders ? 'existing' : 'create';
          this.folderModeRadios.forEach((radio) => {
            radio.checked = radio.value === folderMode;
          });

          // Set radio button based on config value (with backward compatibility)
          const historyValue = config.organization.respectOrganizationHistory;
          let selectedValue: string;
          if (typeof historyValue === 'boolean') {
            // Backward compatibility: convert old boolean to new string format
            selectedValue = historyValue ? 'always' : 'never';
          } else {
            selectedValue = historyValue || 'organizeAllOnly';
          }
          this.respectOrganizationHistoryRadios.forEach((radio) => {
            radio.checked = radio.value === selectedValue;
          });

          // Update radio card visual states after setting values
          this.updateRadioCardStates();

          // Update folder mode UI (enable/disable categories textarea)
          this.updateFolderModeUI();

          // Apply excluded system folder IDs
          const excludedIds = new Set(config.organization.excludedSystemFolderIds || []);
          this.systemFolders.forEach((folder) => {
            const checkbox = document.getElementById(`folder-${folder.id}`) as HTMLInputElement;
            if (checkbox) {
              checkbox.checked = !excludedIds.has(folder.id);
            }
          });
        }

        // Debug Config
        if (config.debug) {
          this.logLevelSelect.value = String(
            config.debug.logLevel !== undefined ? config.debug.logLevel : 0
          );
          this.consoleLoggingCheckbox.checked = config.debug.consoleLogging !== false;
        }

        this.updateModelPlaceholder();
      } else {
        // No config yet - set defaults
        this.providerSelect.value = 'gemini';
        this.updateModelPlaceholder();
      }

      // Toggle OAuth, Gemini, and custom endpoint sections after config is loaded
      this.toggleOpenRouterOAuthSection();
      this.toggleGeminiSetupSection();
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
    const provider = this.providerSelect.value as
      | 'openai'
      | 'claude'
      | 'grok'
      | 'openrouter'
      | 'gemini'
      | 'custom';
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
        customModelName: customModelName || undefined,
      };

      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        config,
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
            } else if (response.rateLimit.remaining <= 5 && credits < 0.1) {
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

    const provider = this.providerSelect.value as
      | 'openai'
      | 'claude'
      | 'grok'
      | 'openrouter'
      | 'gemini'
      | 'custom';
    const apiKey = this.apiKeyInput.value.trim();
    const model = this.modelInput.value.trim();
    const customEndpoint = this.customEndpointInput.value.trim();
    const customModelName = this.customModelNameInput.value.trim();
    const apiTimeout = parseInt(this.apiTimeoutInput.value);
    const batchSize = parseInt(this.batchSizeInput.value);
    const maxTokens = parseInt(this.maxTokensInput.value);
    const retryAttempts = parseInt(this.retryAttemptsInput.value);
    const retryDelay = parseInt(this.retryDelayInput.value);
    const removeDuplicates = this.removeDuplicatesCheckbox.checked;
    const removeEmptyFolders = this.removeEmptyFoldersCheckbox.checked;
    const categoriesText = this.categoriesTextarea.value.trim();
    const ignoreFoldersText = this.ignoreFoldersInput.value.trim();
    const organizeSavedTabs = this.organizeSavedTabsCheckbox.checked;
    const autoOrganize = this.autoOrganizeCheckbox.checked;

    // Get folder mode from radio buttons
    let useExistingFolders = false;
    this.folderModeRadios.forEach((radio) => {
      if (radio.checked && radio.value === 'existing') {
        useExistingFolders = true;
      }
    });

    // Get selected radio button value
    let respectOrganizationHistory: 'always' | 'never' | 'organizeAllOnly' = 'organizeAllOnly';
    this.respectOrganizationHistoryRadios.forEach((radio) => {
      if (radio.checked) {
        respectOrganizationHistory = radio.value as 'always' | 'never' | 'organizeAllOnly';
      }
    });

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

    if (retryAttempts < 1 || retryAttempts > 10) {
      this.showStatus('Retry attempts must be between 1 and 10', 'error');
      return;
    }

    if (retryDelay < 1 || retryDelay > 60) {
      this.showStatus('Retry delay must be between 1 and 60 seconds', 'error');
      return;
    }

    this.saveBtn.disabled = true;
    this.showStatus('Saving...', 'info');

    try {
      const categories = categoriesText
        ? categoriesText
            .split('\n')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        : [];

      const ignoreFolders = ignoreFoldersText
        ? ignoreFoldersText
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0)
        : [];

      // Collect excluded system folder IDs (unchecked = excluded)
      const excludedSystemFolderIds: string[] = [];
      this.systemFolders.forEach((folder) => {
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
          customModelName: customModelName || undefined,
        },
        performance: {
          apiTimeout,
          batchSize,
          maxTokens,
          retryAttempts,
          retryDelay,
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
          respectOrganizationHistory,
          useExistingFolders,
        },
        debug: {
          logLevel,
          consoleLogging,
        },
        ignorePatterns: [],
      };

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config,
      });

      if (response.success) {
        this.showStatus('✓ Configuration saved successfully!', 'success');
        this.clearUnsavedChanges();

        // Update logger settings immediately
        await chrome.runtime.sendMessage({
          type: 'UPDATE_LOGGER_CONFIG',
          config: config.debug,
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
    this.showConfirmation(
      'Reset All Settings?',
      'Are you sure you want to reset all settings to defaults?<br><br>Your API key will be cleared and you will be signed out of OpenRouter.',
      async () => {
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
          this.providerSelect.value = currentConfig?.api?.provider || 'gemini';
          this.apiKeyInput.value = currentConfig?.api?.apiKey || '';
          this.modelInput.value = '';
          this.apiTimeoutInput.value = String(DEFAULT_PERFORMANCE.apiTimeout);
          this.batchSizeInput.value = String(DEFAULT_PERFORMANCE.batchSize);
          this.maxTokensInput.value = String(DEFAULT_PERFORMANCE.maxTokens);
          this.retryAttemptsInput.value = String(DEFAULT_PERFORMANCE.retryAttempts);
          this.retryDelayInput.value = String(DEFAULT_PERFORMANCE.retryDelay);
          this.removeDuplicatesCheckbox.checked = true;
          this.removeEmptyFoldersCheckbox.checked = true;
          this.categoriesTextarea.value = DEFAULT_CATEGORIES.join('\n');
          this.ignoreFoldersInput.value = '';
          this.organizeSavedTabsCheckbox.checked = false;
          this.autoOrganizeCheckbox.checked = false;

          // Set default folder mode (create)
          this.folderModeRadios.forEach((radio) => {
            radio.checked = radio.value === 'create';
          });

          // Set default radio button
          this.respectOrganizationHistoryRadios.forEach((radio) => {
            radio.checked = radio.value === 'organizeAllOnly';
          });

          this.logLevelSelect.value = '0';
          this.consoleLoggingCheckbox.checked = true;

          this.updateModelPlaceholder();
          this.toggleOpenRouterOAuthSection();
          this.updateRadioCardStates();
          this.updateFolderModeUI();
          this.markUnsavedChanges();
          this.showStatus(
            '✓ Reset to defaults! (API key preserved) Click Save to apply changes.',
            'success'
          );
        } catch (error) {
          this.showStatus(`Error: ${error}`, 'error');
          console.error('Failed to reset:', error);
        } finally {
          this.resetBtn.disabled = false;
        }
      }
    );
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

  private toggleGeminiSetupSection() {
    const isGemini = this.providerSelect.value === 'gemini';
    this.geminiSetupSection.style.display = isGemini ? 'block' : 'none';

    // Update API key placeholder for Gemini
    if (isGemini) {
      this.apiKeyInput.placeholder = 'AI...';
    }
  }

  private toggleOpenRouterOAuthSection() {
    const isOpenRouter = this.providerSelect.value === 'openrouter';
    this.openrouterOAuthSection.style.display = isOpenRouter ? 'block' : 'none';
    this.openrouterModelsHelp.style.display = isOpenRouter ? 'block' : 'none';

    // Check if already logged in
    if (isOpenRouter) {
      this.updateOAuthStatus();
    } else {
      // Re-enable and show API key field for non-OpenRouter providers
      this.apiKeySection.style.display = 'block';
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
      this.oauthStatusDiv.innerHTML =
        '<span style="color: #2e7d32;">✓ Signed in with OpenRouter</span>';
      this.apiKeySection.style.display = 'none'; // Hide API key field when using OAuth
      this.apiKeyInput.disabled = true;
    } else {
      this.openrouterLoginBtn.style.display = 'block';
      this.openrouterLogoutBtn.style.display = 'none';
      this.oauthStatusDiv.style.display = 'none';
      this.apiKeySection.style.display = 'block'; // Show API key field when not using OAuth
      this.apiKeyInput.disabled = false;
      this.apiKeyInput.placeholder = 'sk-or-...';
    }
  }

  private async handleOpenRouterLogin() {
    this.openrouterLoginBtn.disabled = true;
    this.openrouterLoginBtn.textContent = '⏳ Opening OpenRouter...';
    this.oauthStatusDiv.style.display = 'block';
    this.oauthStatusDiv.innerHTML =
      '<span style="color: #1976d2;">Opening authorization page...</span>';

    try {
      const result = await this.authService.login();

      if (result.success && result.apiKey) {
        // Store the API key
        this.apiKeyInput.value = result.apiKey;
        this.providerSelect.value = 'openrouter';

        // Show success status
        this.oauthStatusDiv.innerHTML =
          '<span style="color: #2e7d32;">✓ Successfully signed in! Saving configuration...</span>';

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
      this.oauthStatusDiv.innerHTML =
        '<span style="color: #c62828;">✗ An error occurred during login</span>';
      this.showStatus(`Error: ${error}`, 'error');
    } finally {
      this.openrouterLoginBtn.disabled = false;
      this.openrouterLoginBtn.textContent = '🚀 Sign In with OpenRouter';
    }
  }

  private async handleOpenRouterLogout() {
    this.showConfirmation(
      'Sign Out of OpenRouter?',
      'Are you sure you want to sign out of OpenRouter?<br><br>Your API key will be removed.',
      async () => {
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
    );
  }

  private async handleClearHistory() {
    this.showConfirmation(
      'Clear Organization History?',
      'Are you sure you want to clear the organization history?<br><br>This will allow all bookmarks to be reorganized in future runs.',
      async () => {
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
    );
  }

  private async handleMarkAllOrganized() {
    this.showConfirmation(
      'Mark All as Organized?',
      'Mark all bookmarks as organized?<br><br>This will prevent the AI from reorganizing any of your existing bookmarks until you clear the history.',
      async () => {
        this.markAllOrganizedBtn.disabled = true;

        try {
          const response = await chrome.runtime.sendMessage({ type: 'MARK_ALL_ORGANIZED' });

          if (response && response.success) {
            this.showStatus(
              `✓ Successfully marked ${response.count} bookmarks as organized`,
              'success'
            );
          } else {
            throw new Error(response?.error || 'Failed to mark bookmarks as organized');
          }
        } catch (error) {
          console.error('Mark all organized error:', error);
          this.showStatus(`Error marking bookmarks as organized: ${error}`, 'error');
        } finally {
          this.markAllOrganizedBtn.disabled = false;
        }
      }
    );
  }

  private setupCollapsibleSection() {
    const header = document.getElementById('advanced-settings-header');
    const content = document.getElementById('advanced-settings-content');

    if (!header || !content) {
      return;
    }

    header.addEventListener('click', () => {
      const isCollapsed = header.classList.contains('collapsed');

      if (isCollapsed) {
        // Expand
        header.classList.remove('collapsed');
        content.classList.remove('collapsed');
      } else {
        // Collapse
        header.classList.add('collapsed');
        content.classList.add('collapsed');
      }
    });
  }

  private showConfirmation(title: string, message: string, callback: () => void) {
    this.confirmationTitle.textContent = title;
    this.confirmationMessage.innerHTML = message;
    this.confirmCallback = callback;
    this.confirmationOverlay.classList.add('active');
  }

  private hideConfirmation() {
    this.confirmationOverlay.classList.remove('active');
    this.confirmCallback = null;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
