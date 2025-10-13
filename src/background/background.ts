/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Simple background service worker
 */

import { logger } from '../services/Logger.js';
import {
  ConfigurationManager,
  DEFAULT_PERFORMANCE,
  type AppConfig,
} from '../services/ConfigurationManager.js';
import { BookmarkManager } from '../services/BookmarkManager.js';
import { LLMService } from '../services/LLMService.js';
import { ReorganizationService } from '../services/ReorganizationService.js';
import type {
  RuntimeMessage,
  MessageResponse,
  ReorganizationProgress,
  ReorganizationResult,
} from '../types/messages.js';

interface ActivityLogEntry {
  type: 'auto-organize' | 'bulk-reorganize';
  timestamp: number;
  title?: string; // for auto-organize: bookmark title
  category?: string; // for auto-organize: category name
  bookmarksMoved?: number; // for bulk-reorganize: total bookmarks moved
  foldersCreated?: number; // for bulk-reorganize: total folders created
}

class BackgroundService {
  private configManager: ConfigurationManager;
  private bookmarkManager: BookmarkManager;
  private reorganizationService: ReorganizationService | null = null;
  private isReorganizing: boolean = false;
  private reorganizationProgress: ReorganizationProgress | null = null;
  private static readonly MAX_ACTIVITY_LOG_SIZE = 10;

  /**
   * Match a folder name against a glob-style pattern
   * Supports * (any characters) and ? (single character)
   */
  private matchGlobPattern(folderName: string, pattern: string): boolean {
    // Normalize both strings to lowercase for case-insensitive matching
    const name = folderName.toLowerCase().trim();
    const pat = pattern.toLowerCase().trim();

    // If pattern has no wildcards, do exact match
    if (!pat.includes('*') && !pat.includes('?')) {
      return name === pat;
    }

    // Convert glob pattern to regex
    // Escape special regex characters except * and ?
    let regexPattern = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Replace glob wildcards with regex equivalents
    regexPattern = regexPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

    // Anchor the pattern to match the entire string
    regexPattern = `^${regexPattern}$`;

    const regex = new RegExp(regexPattern);
    return regex.test(name);
  }

  /**
   * Show a notification (always uses system notifications for reliability)
   */
  private async showNotification(title: string, message: string): Promise<void> {
    try {
      logger.info('BackgroundService', `showNotification called: ${title} - ${message}`);
      const notificationId = await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: title,
        message: message,
      });
      logger.info('BackgroundService', `Notification created: ${notificationId}`);
    } catch (error) {
      logger.warn('BackgroundService', 'Failed to show notification', error);
    }
  }

  /**
   * Add an entry to the activity log
   */
  private async addActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get('activityLog');
      let activityLog: ActivityLogEntry[] = result.activityLog || [];

      // Add new entry to the front
      activityLog.unshift(entry);

      // Keep only the last 10 entries
      if (activityLog.length > BackgroundService.MAX_ACTIVITY_LOG_SIZE) {
        activityLog = activityLog.slice(0, BackgroundService.MAX_ACTIVITY_LOG_SIZE);
      }

      await chrome.storage.local.set({ activityLog });
      logger.debug(
        'BackgroundService',
        `Added activity log entry, total entries: ${activityLog.length}`
      );
    } catch (error) {
      logger.warn('BackgroundService', 'Failed to add activity log entry', error);
    }
  }

  constructor() {
    logger.info('BackgroundService', '=== Background service initializing ===');
    this.configManager = new ConfigurationManager();
    this.bookmarkManager = new BookmarkManager();

    // Set up message handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse);
      return true; // Keep channel open for async response
    });

    // Set up bookmark creation listener for auto-organization
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      this.handleBookmarkCreated(id, bookmark).catch((error) => {
        logger.error('BackgroundService', 'Failed to auto-organize bookmark', error);
      });
    });

    // Open settings on first install
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        logger.info(
          'BackgroundService',
          'Extension installed for the first time, opening settings'
        );
        chrome.runtime.openOptionsPage();
      } else if (details.reason === 'update') {
        logger.info(
          'BackgroundService',
          `Extension updated to version ${chrome.runtime.getManifest().version}`
        );
      }
    });

    logger.info('BackgroundService', '=== Background service initialized and ready ===');
  }

  private async handleMessage(message: RuntimeMessage): Promise<MessageResponse> {
    logger.info('BackgroundService', `>>> Received message: ${message.type}`);
    try {
      switch (message.type) {
        case 'GENERATE_PREVIEW':
          logger.info('BackgroundService', 'Handling GENERATE_PREVIEW');
          return await this.generatePreview();

        case 'EXECUTE_REORGANIZATION':
          logger.info('BackgroundService', '!!! Handling EXECUTE_REORGANIZATION !!!');
          return await this.executeReorganization();

        case 'EXECUTE_SELECTIVE_REORGANIZATION':
          logger.info('BackgroundService', 'Handling EXECUTE_SELECTIVE_REORGANIZATION');
          return await this.executeSelectiveReorganization(message.folderIds);

        case 'GET_FOLDER_TREE':
          logger.info('BackgroundService', 'Handling GET_FOLDER_TREE');
          return await this.getFolderTree();

        case 'GET_REORGANIZATION_STATUS':
          return {
            success: true,
            isReorganizing: this.isReorganizing,
            progress: this.reorganizationProgress,
          };

        case 'CHECK_CONFIG':
          logger.trace('BackgroundService', 'Handling CHECK_CONFIG');
          return await this.checkConfig();

        case 'GET_CONFIG':
          logger.trace('BackgroundService', 'Handling GET_CONFIG');
          return await this.getConfig();

        case 'UPDATE_CONFIG':
          logger.info('BackgroundService', 'Handling UPDATE_CONFIG');
          return await this.saveConfig(message.config);

        case 'SAVE_CONFIG':
          logger.info('BackgroundService', 'Handling SAVE_CONFIG');
          return await this.saveConfig(message.config);

        case 'TEST_CONNECTION':
          logger.info('BackgroundService', 'Handling TEST_CONNECTION');
          return await this.testConnection(message.config);

        case 'UPDATE_LOGGER_CONFIG':
          logger.info('BackgroundService', 'Handling UPDATE_LOGGER_CONFIG');
          return await this.updateLoggerConfig(message.config);

        case 'GET_SYSTEM_FOLDERS':
          logger.info('BackgroundService', 'Handling GET_SYSTEM_FOLDERS');
          return await this.getSystemFolders();

        case 'CLEAR_ORGANIZATION_HISTORY':
          logger.info('BackgroundService', 'Handling CLEAR_ORGANIZATION_HISTORY');
          return await this.clearOrganizationHistory();

        case 'MARK_ALL_ORGANIZED':
          logger.info('BackgroundService', 'Handling MARK_ALL_ORGANIZED');
          return await this.markAllBookmarksAsOrganized();

        case 'PING':
          return { success: true };

        default: {
          // TypeScript exhaustiveness check - this should never be reached
          const _exhaustive: never = message;
          logger.warn(
            'BackgroundService',
            `Unknown message type: ${(_exhaustive as RuntimeMessage).type}`
          );
          return { success: false, error: 'Unknown message type' };
        }
      }
    } catch (error) {
      logger.error('BackgroundService', 'Message handling error', error);
      return { success: false, error: String(error) };
    }
  }

  private async initializeServices(): Promise<void> {
    logger.debug('BackgroundService', 'initializeServices called');

    if (this.reorganizationService) {
      logger.debug('BackgroundService', 'Services already initialized');
      return; // Already initialized
    }

    logger.debug('BackgroundService', 'Getting configuration');
    const config = await this.configManager.getConfig();
    logger.trace('BackgroundService', 'Config loaded', {
      provider: config.api.provider,
      hasApiKey: !!config.api.apiKey,
    });

    if (!config.api.apiKey) {
      logger.error('BackgroundService', 'API key not configured!');
      throw new Error('API key not configured');
    }

    const apiTimeout = config.performance?.apiTimeout || DEFAULT_PERFORMANCE.apiTimeout;
    const maxTokens = config.performance?.maxTokens || DEFAULT_PERFORMANCE.maxTokens;
    const batchSize = config.performance?.batchSize || DEFAULT_PERFORMANCE.batchSize;
    const categories = config.organization?.categories || [];
    logger.info('BackgroundService', 'Creating LLM service', {
      provider: config.api.provider,
      model: config.api.model,
      timeout: apiTimeout,
      maxTokens,
      batchSize,
      categoriesCount: categories.length,
    });
    const llmService = new LLMService(
      config.api.apiKey,
      config.api.provider,
      config.api.model,
      apiTimeout,
      maxTokens,
      config.api.customEndpoint,
      config.api.customModelName
    );

    logger.info('BackgroundService', 'Creating reorganization service');
    this.reorganizationService = new ReorganizationService(
      this.bookmarkManager,
      llmService,
      this.configManager,
      batchSize,
      categories
    );
    logger.info('BackgroundService', 'Services initialization complete');
  }

  private async generatePreview(): Promise<MessageResponse<ReorganizationResult>> {
    logger.info('BackgroundService', 'generatePreview started');

    try {
      await this.initializeServices();

      if (!this.reorganizationService) {
        logger.error('BackgroundService', 'Reorganization service is null after init');
        return { success: false, error: 'Service not initialized' };
      }

      // Get configuration for folder exclusions
      const config = await this.configManager.getConfig();
      let excludedFolderIds = config.organization?.excludedSystemFolderIds || ['3'];

      // Get all folders to match by name
      const allFolders = await this.bookmarkManager.getAllFolders();

      // Log root-level folders for debugging
      const rootFolders = allFolders.filter((f) => !f.parentId || f.parentId === '0');
      logger.info(
        'BackgroundService',
        `Preview - Root folders found:`,
        rootFolders.map((f) => `${f.title} (ID: ${f.id})`).join(', ')
      );
      logger.info(
        'BackgroundService',
        `Preview - Default excluded IDs: ${excludedFolderIds.join(', ')}`
      );

      // Always exclude Trash folder - find its ID dynamically
      const trashFolder = allFolders.find((f) => f.title.toLowerCase().trim() === 'trash');
      if (trashFolder && !excludedFolderIds.includes(trashFolder.id)) {
        excludedFolderIds = [...excludedFolderIds, trashFolder.id];
        logger.info(
          'BackgroundService',
          `Added Trash folder (ID: ${trashFolder.id}) to preview exclusions`
        );
      }

      // Add folders from ignoreFolders config by name (supports wildcards)
      const ignoreFolderPatterns = config.organization?.ignoreFolders || [];
      if (ignoreFolderPatterns.length > 0) {
        logger.info(
          'BackgroundService',
          `Preview looking for folders matching patterns: ${ignoreFolderPatterns.join(', ')}`
        );
        ignoreFolderPatterns.forEach((pattern) => {
          const matchingFolders = allFolders.filter((f) => this.matchGlobPattern(f.title, pattern));
          matchingFolders.forEach((folder) => {
            if (!excludedFolderIds.includes(folder.id)) {
              excludedFolderIds.push(folder.id);
              logger.info(
                'BackgroundService',
                `Preview added '${folder.title}' (matched pattern '${pattern}', ID: ${folder.id}) to exclusions`
              );
            }
          });
        });
      }

      logger.info(
        'BackgroundService',
        `Preview using excluded folder IDs: ${excludedFolderIds.join(', ')}`
      );

      logger.info('BackgroundService', 'Calling reorganizationService.generatePreview');
      const preview = await this.reorganizationService.generatePreview(excludedFolderIds);
      logger.info('BackgroundService', 'Preview generation successful', preview);

      return {
        success: true,
        preview,
      };
    } catch (error) {
      logger.error('BackgroundService', 'Preview generation failed', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async executeReorganization(): Promise<MessageResponse<ReorganizationResult>> {
    logger.info('BackgroundService', '!!! executeReorganization STARTED !!!');

    // Check if already reorganizing
    if (this.isReorganizing) {
      logger.warn('BackgroundService', 'Reorganization already in progress');
      return { success: false, error: 'Reorganization already in progress' };
    }

    // Set reorganizing state
    this.isReorganizing = true;
    this.reorganizationProgress = { current: 0, total: 100, message: 'Starting...' };
    await chrome.storage.local.set({
      isReorganizing: true,
      reorganizationProgress: this.reorganizationProgress,
    });

    // Show badge to indicate organizing in progress
    await chrome.action.setBadgeText({ text: '...' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4facfe' });
    await chrome.action.setTitle({ title: 'AI Bookmark Organizer - Organizing in progress...' });

    try {
      logger.info('BackgroundService', 'Initializing services');
      await this.initializeServices();
      logger.info('BackgroundService', 'Services initialized successfully');
    } catch (err) {
      logger.error('BackgroundService', 'Failed to initialize services', err);
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);
      return { success: false, error: `Failed to initialize: ${String(err)}` };
    }

    if (!this.reorganizationService) {
      logger.error('BackgroundService', 'Reorganization service is null after initialization!');
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);
      return { success: false, error: 'Service not initialized' };
    }

    // Show starting notification
    await this.showNotification('AI Bookmark Organizer', 'Starting bookmark organization...');

    // Get configuration for folder exclusions
    const config = await this.configManager.getConfig();
    let excludedFolderIds = config.organization?.excludedSystemFolderIds || ['3'];

    // Get all folders to match by name
    const allFolders = await this.bookmarkManager.getAllFolders();

    // Log root-level folders for debugging
    const rootFolders = allFolders.filter((f) => !f.parentId || f.parentId === '0');
    logger.info(
      'BackgroundService',
      `Root folders found:`,
      rootFolders.map((f) => `${f.title} (ID: ${f.id})`).join(', ')
    );
    logger.info('BackgroundService', `Default excluded IDs: ${excludedFolderIds.join(', ')}`);

    // Always exclude Trash folder - find its ID dynamically
    const trashFolder = allFolders.find((f) => f.title.toLowerCase().trim() === 'trash');
    if (trashFolder && !excludedFolderIds.includes(trashFolder.id)) {
      excludedFolderIds = [...excludedFolderIds, trashFolder.id];
      logger.info('BackgroundService', `Added Trash folder (ID: ${trashFolder.id}) to exclusions`);
    }

    // Add folders from ignoreFolders config by name (supports wildcards)
    const ignoreFolderPatterns = config.organization?.ignoreFolders || [];
    if (ignoreFolderPatterns.length > 0) {
      logger.info(
        'BackgroundService',
        `Looking for folders matching patterns: ${ignoreFolderPatterns.join(', ')}`
      );
      ignoreFolderPatterns.forEach((pattern) => {
        const matchingFolders = allFolders.filter((f) => this.matchGlobPattern(f.title, pattern));
        matchingFolders.forEach((folder) => {
          if (!excludedFolderIds.includes(folder.id)) {
            excludedFolderIds.push(folder.id);
            logger.info(
              'BackgroundService',
              `Added '${folder.title}' (matched pattern '${pattern}', ID: ${folder.id}) to exclusions`
            );
          }
        });
      });
    }

    // Exclude "Saved Tabs" folders if configured (disabled by default)
    if (!config.organization.organizeSavedTabs) {
      const savedTabsFolders = allFolders.filter((f) =>
        f.title.toLowerCase().trim().startsWith('saved tabs')
      );
      if (savedTabsFolders.length > 0) {
        logger.info(
          'BackgroundService',
          `Found ${savedTabsFolders.length} "Saved Tabs" folders to exclude (organizeSavedTabs=false)`
        );
        savedTabsFolders.forEach((folder) => {
          if (!excludedFolderIds.includes(folder.id)) {
            excludedFolderIds.push(folder.id);
            logger.info(
              'BackgroundService',
              `Added "Saved Tabs" folder (ID: ${folder.id}, title: "${folder.title}") to exclusions`
            );
          }
        });
      }
    } else {
      logger.info(
        'BackgroundService',
        'Saved Tabs folders will be organized (organizeSavedTabs=true)'
      );
    }

    logger.info('BackgroundService', `Using excluded folder IDs: ${excludedFolderIds.join(', ')}`);

    logger.info(
      'BackgroundService',
      '>>> About to call reorganizationService.executeReorganization <<<'
    );
    try {
      let lastNotificationTime = 0;
      const NOTIFICATION_THROTTLE = 5000; // Only show notification every 5 seconds

      const result = await this.reorganizationService.executeReorganization(
        excludedFolderIds,
        async (current, total, message) => {
          // Update local state
          this.reorganizationProgress = { current, total, message };

          // Store in chrome.storage for persistence
          await chrome.storage.local.set({ reorganizationProgress: this.reorganizationProgress });

          // Update badge with percentage
          const percent = Math.round((current / total) * 100);
          await chrome.action.setBadgeText({ text: `${percent}%` });
          await chrome.action.setTitle({
            title: `AI Bookmark Organizer - ${message} (${percent}%)`,
          });

          // Send progress updates to popup
          chrome.runtime
            .sendMessage({
              type: 'PROGRESS_UPDATE',
              current,
              total,
              message,
            })
            .catch(() => {
              // Popup might be closed, that's okay
            });

          // Show periodic progress notifications
          const now = Date.now();
          if (now - lastNotificationTime > NOTIFICATION_THROTTLE) {
            lastNotificationTime = now;
            const percent = Math.round((current / total) * 100);
            try {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                title: 'AI Bookmark Organizer',
                message: `${message} (${percent}%)`,
              });
            } catch (err) {
              console.log('Notification failed (non-critical):', err);
            }
          }
        }
      );

      logger.info('BackgroundService', '!!! Reorganization completed !!!', result);

      // Clear reorganizing state
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);

      // Clear badge
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'AI Bookmark Organizer' });

      // Store results for the results page
      await chrome.storage.local.set({ lastOrganizationResult: result });

      // Log to activity history
      await this.addActivityLogEntry({
        type: 'bulk-reorganize',
        timestamp: Date.now(),
        bookmarksMoved: result.bookmarksMoved,
        foldersCreated: result.foldersCreated,
      });

      // Show completion notification
      await this.showNotification(
        'Organization Complete!',
        `Moved ${result.bookmarksMoved} bookmarks, created ${result.foldersCreated} folders.`
      );

      // Open results page automatically
      const resultsUrl = chrome.runtime.getURL('results.html');
      await chrome.tabs.create({ url: resultsUrl });

      logger.info('BackgroundService', 'Returning success result to caller');
      const resultWithTimestamp: ReorganizationResult = {
        bookmarksMoved: result.bookmarksMoved,
        foldersCreated: result.foldersCreated,
        duplicatesRemoved: result.duplicatesRemoved,
        bookmarksSkipped: result.bookmarksSkipped,
        errors: result.errors,
        timestamp: Date.now(),
      };
      return {
        success: true,
        result: resultWithTimestamp,
      };
    } catch (error) {
      logger.error('BackgroundService', '!!! Reorganization FAILED !!!', error);

      // Clear reorganizing state
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);

      // Clear badge
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'AI Bookmark Organizer' });

      // Store error result
      await chrome.storage.local.set({
        lastOrganizationResult: {
          success: false,
          bookmarksMoved: 0,
          foldersCreated: 0,
          duplicatesRemoved: 0,
          emptyFoldersRemoved: 0,
          errors: [String(error)],
          moves: [],
          duplicates: [],
          folders: [],
          emptyFolders: [],
        },
      });

      // Show error notification
      await this.showNotification('Organization Failed', String(error));

      // Open results page to show error
      const resultsUrl = chrome.runtime.getURL('results.html');
      await chrome.tabs.create({ url: resultsUrl });

      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async checkConfig(): Promise<MessageResponse<{ isConfigured: boolean }>> {
    try {
      const config = await this.configManager.getConfig();
      const isConfigured = await this.configManager.isConfigured();

      return {
        success: true,
        isConfigured,
        provider: config.api.provider,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async getConfig(): Promise<MessageResponse<AppConfig>> {
    try {
      const config = await this.configManager.getConfig();

      return {
        success: true,
        config,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async saveConfig(config: AppConfig): Promise<MessageResponse> {
    try {
      await this.configManager.saveConfig(config);

      // Reset service to pick up new config
      this.reorganizationService = null;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async testConnection(configParam?: AppConfig): Promise<MessageResponse> {
    try {
      // Load config from storage if not provided (for popup calls)
      const fullConfig = configParam || (await this.configManager.getConfig());
      const config = 'api' in fullConfig ? fullConfig.api : fullConfig;

      logger.info('BackgroundService', 'Testing API connection', {
        provider: config.provider,
        model: config.model,
      });

      // Validate format first
      logger.debug('BackgroundService', 'Validating API key format');
      const formatCheck = LLMService.validateApiKeyFormat(config.apiKey, config.provider);
      if (!formatCheck.valid) {
        logger.warn('BackgroundService', 'API key format validation failed', {
          error: formatCheck.error,
        });
        return { success: false, error: formatCheck.error };
      }
      logger.debug('BackgroundService', 'API key format valid');

      // Create temp service and test (use default timeout and maxTokens for validation)
      logger.info('BackgroundService', 'Creating temporary LLM service for connection test');
      const llmService = new LLMService(
        config.apiKey,
        config.provider,
        config.model,
        30,
        100,
        config.customEndpoint,
        config.customModelName
      );

      logger.info('BackgroundService', 'Calling validateConnection');
      const result = await llmService.validateConnection();
      logger.info('BackgroundService', 'Connection test completed', result);

      return result as MessageResponse;
    } catch (error) {
      logger.error('BackgroundService', 'Connection test failed with exception', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async updateLoggerConfig(debugConfig: {
    logLevel: number;
    consoleLogging: boolean;
  }): Promise<MessageResponse> {
    try {
      logger.setLogLevel(debugConfig.logLevel);
      logger.setConsoleLogging(debugConfig.consoleLogging);
      logger.info('BackgroundService', 'Logger configuration updated', debugConfig);
      return { success: true };
    } catch (error) {
      logger.error('BackgroundService', 'Failed to update logger config', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async executeSelectiveReorganization(
    folderIds: string[]
  ): Promise<MessageResponse<ReorganizationResult>> {
    logger.info('BackgroundService', 'executeSelectiveReorganization STARTED', {
      folderCount: folderIds.length,
    });

    // Check if already reorganizing
    if (this.isReorganizing) {
      logger.warn('BackgroundService', 'Reorganization already in progress');
      return { success: false, error: 'Reorganization already in progress' };
    }

    // Set reorganizing state
    this.isReorganizing = true;
    this.reorganizationProgress = {
      current: 0,
      total: 100,
      message: 'Starting selective organization...',
    };
    await chrome.storage.local.set({
      isReorganizing: true,
      reorganizationProgress: this.reorganizationProgress,
    });

    // Show badge
    await chrome.action.setBadgeText({ text: '...' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4facfe' });
    await chrome.action.setTitle({
      title: 'AI Bookmark Organizer - Organizing selected folders...',
    });

    try {
      logger.info('BackgroundService', 'Initializing services');
      await this.initializeServices();
      logger.info('BackgroundService', 'Services initialized successfully');
    } catch (err) {
      logger.error('BackgroundService', 'Failed to initialize services', err);
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);
      return { success: false, error: `Failed to initialize: ${String(err)}` };
    }

    if (!this.reorganizationService) {
      logger.error('BackgroundService', 'Reorganization service is null after initialization!');
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);
      return { success: false, error: 'Failed to initialize reorganization service' };
    }

    try {
      logger.info('BackgroundService', 'Starting selective reorganization');

      const progressCallback = (current: number, total: number, message: string) => {
        logger.debug('BackgroundService', 'Progress update', { current, total, message });
        this.reorganizationProgress = { current, total, message };

        // Update badge with percentage
        const percentage = Math.round((current / total) * 100);
        chrome.action.setBadgeText({ text: `${percentage}%` }).catch(() => {});

        // Store progress state
        chrome.storage.local
          .set({
            reorganizationProgress: this.reorganizationProgress,
          })
          .catch(() => {});
      };

      logger.info(
        'BackgroundService',
        `Calling reorganizationService.reorganizeSpecificFolders with ${folderIds.length} folders`
      );
      const result = await this.reorganizationService.reorganizeSpecificFolders(
        folderIds,
        progressCallback
      );
      logger.info('BackgroundService', 'Selective reorganization completed', result);

      // Clear reorganizing state
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);

      // Update badge with checkmark for 3 seconds
      await chrome.action.setBadgeText({ text: '✓' });
      await chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
      await chrome.action.setTitle({ title: 'AI Bookmark Organizer - Organization complete!' });
      setTimeout(async () => {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'AI Bookmark Organizer' });
      }, 3000);

      // Store result
      await chrome.storage.local.set({ lastOrganizationResult: result });

      logger.info('BackgroundService', 'Returning success result to caller');
      const resultWithTimestamp: ReorganizationResult = {
        bookmarksMoved: result.bookmarksMoved,
        foldersCreated: result.foldersCreated,
        duplicatesRemoved: result.duplicatesRemoved,
        bookmarksSkipped: result.bookmarksSkipped,
        errors: result.errors,
        timestamp: Date.now(),
      };
      return {
        success: true,
        result: resultWithTimestamp,
      };
    } catch (error) {
      logger.error('BackgroundService', 'Selective reorganization FAILED', error);

      // Clear reorganizing state
      this.isReorganizing = false;
      this.reorganizationProgress = null;
      await chrome.storage.local.remove(['isReorganizing', 'reorganizationProgress']);

      // Clear badge
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'AI Bookmark Organizer' });

      // Store error result
      await chrome.storage.local.set({
        lastOrganizationResult: {
          success: false,
          bookmarksMoved: 0,
          foldersCreated: 0,
          duplicatesRemoved: 0,
          emptyFoldersRemoved: 0,
          errors: [String(error)],
          moves: [],
          duplicates: [],
          folders: [],
          emptyFolders: [],
        },
      });

      return { success: false, error: String(error) };
    }
  }

  private async getFolderTree(): Promise<MessageResponse> {
    try {
      const tree = await this.bookmarkManager.getBookmarkTreeWithCounts();
      return {
        success: true,
        tree,
      };
    } catch (error) {
      logger.error('BackgroundService', 'Failed to get folder tree', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async getSystemFolders(): Promise<MessageResponse<{ folderIds: string[] }>> {
    try {
      const folders = await this.bookmarkManager.getSystemFolders();
      logger.info('BackgroundService', `Retrieved ${folders.length} system folders`);
      return {
        success: true,
        folders,
      };
    } catch (error) {
      logger.error('BackgroundService', 'Failed to get system folders', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async clearOrganizationHistory(): Promise<MessageResponse> {
    try {
      await this.configManager.clearOrganizationHistory();
      logger.info('BackgroundService', 'Organization history cleared');
      return { success: true };
    } catch (error) {
      logger.error('BackgroundService', 'Failed to clear organization history', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  private async markAllBookmarksAsOrganized(): Promise<MessageResponse> {
    try {
      const count = await this.configManager.markAllBookmarksAsOrganized();
      logger.info('BackgroundService', `Marked ${count} bookmarks as organized`);
      return { success: true, count };
    } catch (error) {
      logger.error('BackgroundService', 'Failed to mark all bookmarks as organized', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Handle new bookmark creation for auto-organization
   */
  private async handleBookmarkCreated(
    id: string,
    bookmark: chrome.bookmarks.BookmarkTreeNode
  ): Promise<void> {
    // Only process actual bookmarks (not folders)
    if (!bookmark.url) {
      logger.trace('BackgroundService', `Ignoring folder creation: ${bookmark.title}`);
      return;
    }

    logger.info('BackgroundService', `New bookmark created: "${bookmark.title}" (${id})`);

    // Check if auto-organize is enabled
    const config = await this.configManager.getConfig();
    if (!config.organization.autoOrganize) {
      logger.debug('BackgroundService', 'Auto-organize disabled, skipping');
      return;
    }

    // Check if API is configured
    if (!config.api.apiKey) {
      logger.warn('BackgroundService', 'Cannot auto-organize: API key not configured');
      return;
    }

    try {
      logger.info('BackgroundService', 'Auto-organizing bookmark...');

      // Create LLM service
      const llmService = new LLMService(
        config.api.apiKey,
        config.api.provider,
        config.api.model,
        config.performance?.apiTimeout || DEFAULT_PERFORMANCE.apiTimeout,
        config.performance?.maxTokens || DEFAULT_PERFORMANCE.maxTokens,
        config.api.customEndpoint,
        config.api.customModelName
      );

      // Get categories
      const categories =
        config.organization.categories?.length > 0 ? config.organization.categories : [];

      if (categories.length === 0) {
        logger.warn('BackgroundService', 'No categories configured, cannot auto-organize');
        return;
      }

      // Categorize the bookmark
      const category = await llmService.categorizeSingleBookmark(
        { id, title: bookmark.title, url: bookmark.url },
        categories
      );

      logger.info('BackgroundService', `Bookmark categorized as: "${category}"`);

      // Ensure folder exists (create if needed)
      const folderId = await this.bookmarkManager.ensureFolder(category, '1');
      logger.debug('BackgroundService', `Target folder ID: ${folderId}`);

      // Move bookmark to folder (only if it's not already there)
      if (bookmark.parentId !== folderId) {
        await this.bookmarkManager.moveBookmark(id, folderId);
        logger.info('BackgroundService', `Moved bookmark to folder "${category}"`);

        // Record in organization history
        await this.configManager.markBookmarkAsOrganized(id, category);

        // Show feedback via badge
        try {
          chrome.action.setBadgeText({ text: '✓' });
          chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
          chrome.action.setTitle({ title: `Organized: "${bookmark.title}" → ${category}` });

          setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ title: 'AI Bookmark Organizer' });
          }, 3000);
        } catch (badgeError) {
          logger.warn('BackgroundService', 'Failed to update badge', badgeError);
        }

        // Log to activity history
        await this.addActivityLogEntry({
          type: 'auto-organize',
          timestamp: Date.now(),
          title: bookmark.title,
          category: category,
        });

        // Show notification (use system notification since we can't inject into arbitrary pages)
        await this.showNotification('Bookmark Organized', `"${bookmark.title}" → ${category}`);
      } else {
        logger.debug('BackgroundService', 'Bookmark already in correct folder');
      }
    } catch (error) {
      logger.error('BackgroundService', 'Auto-organization failed', error);
      // Don't throw - we don't want to break bookmark creation
    }
  }
}

// Initialize service
new BackgroundService();
