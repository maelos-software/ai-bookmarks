/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Popup controller
 */

import { logger } from '../services/Logger.js';
import { ProgressMonitor } from '../shared/ProgressMonitor.js';

interface ActivityLogEntry {
  type: 'auto-organize' | 'bulk-reorganize';
  timestamp: number;
  title?: string;
  category?: string;
  bookmarksMoved?: number;
  foldersCreated?: number;
}

interface StatusCache {
  timestamp: number;
  status: string;
  type: 'ready' | 'active' | 'warning' | 'error';
  isConfigured: boolean;
  organizeEnabled: boolean;
}

class PopupController {
  private static readonly STATUS_CACHE_KEY = 'statusCache';
  private static readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private organizeBtn: HTMLButtonElement;
  private statusValue: HTMLElement;
  private statusText: HTMLElement;
  private activityIndicator: HTMLElement;
  private activityMessage: HTMLElement;
  private activityCount: HTMLElement;
  private infoBox: HTMLElement;
  private openSettingsBtn: HTMLButtonElement;
  private recentActivitySection: HTMLElement;
  private activityList: HTMLElement;
  private clearActivityBtn: HTMLButtonElement;
  private autoOrganizeToggle: HTMLButtonElement;
  private toggleStatus: HTMLElement;
  private progressMonitor: ProgressMonitor;

  constructor() {
    logger.info('PopupController', 'Initializing popup');

    this.organizeBtn = document.getElementById('organize-btn') as HTMLButtonElement;
    this.statusValue = document.getElementById('status-value') as HTMLElement;
    this.statusText = document.getElementById('status-text') as HTMLElement;
    this.activityIndicator = document.getElementById('activity-indicator') as HTMLElement;
    this.activityMessage = document.getElementById('activity-message') as HTMLElement;
    this.activityCount = document.getElementById('activity-count') as HTMLElement;
    this.infoBox = document.getElementById('info-box') as HTMLElement;
    this.openSettingsBtn = document.getElementById('open-settings') as HTMLButtonElement;
    this.recentActivitySection = document.getElementById('recent-activity') as HTMLElement;
    this.activityList = document.getElementById('activity-list') as HTMLElement;
    this.clearActivityBtn = document.getElementById('clear-activity-btn') as HTMLButtonElement;
    this.autoOrganizeToggle = document.getElementById('auto-organize-toggle') as HTMLButtonElement;
    this.toggleStatus = document.getElementById('toggle-status') as HTMLElement;

    this.organizeBtn.addEventListener('click', () => this.handleOrganize());
    this.clearActivityBtn.addEventListener('click', () => this.clearActivityLog());
    this.autoOrganizeToggle.addEventListener('click', () => this.toggleAutoOrganize());
    this.openSettingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Initialize progress monitor
    this.progressMonitor = new ProgressMonitor({
      activityIndicatorSelector: '#activity-indicator',
      activityMessageSelector: '#activity-message',
      activityCountSelector: '#activity-count',
      onReorganizationStart: () => {
        this.showStatus('🔄 Organizing...', 'active');
        this.organizeBtn.disabled = true;
      },
      onReorganizationComplete: () => {
        this.clearStatusCache();
        this.checkConfiguration();
      },
    });

    logger.info('PopupController', 'Popup initialized, checking configuration');
    this.checkConfiguration();
    this.loadRecentActivity();
    this.loadAutoOrganizeState();

    // Restore monitoring state if reorganization is in progress
    this.progressMonitor.restoreMonitoringState();
  }


  private async getStatusCache(): Promise<StatusCache | null> {
    try {
      const result = await chrome.storage.local.get(PopupController.STATUS_CACHE_KEY);
      const cache: StatusCache | undefined = result[PopupController.STATUS_CACHE_KEY];

      if (!cache) return null;

      // Check if cache is still valid
      const age = Date.now() - cache.timestamp;
      if (age > PopupController.CACHE_DURATION_MS) {
        logger.debug('PopupController', 'Status cache expired');
        return null;
      }

      logger.debug('PopupController', `Using cached status (age: ${Math.round(age / 1000)}s)`);
      return cache;
    } catch (error) {
      logger.warn('PopupController', 'Failed to get status cache', error);
      return null;
    }
  }

  private async setStatusCache(cache: StatusCache): Promise<void> {
    try {
      await chrome.storage.local.set({ [PopupController.STATUS_CACHE_KEY]: cache });
      logger.debug('PopupController', 'Status cache saved');
    } catch (error) {
      logger.warn('PopupController', 'Failed to set status cache', error);
    }
  }

  private async clearStatusCache(): Promise<void> {
    try {
      await chrome.storage.local.remove(PopupController.STATUS_CACHE_KEY);
      logger.debug('PopupController', 'Status cache cleared');
    } catch (error) {
      logger.warn('PopupController', 'Failed to clear status cache', error);
    }
  }

  private async checkConfiguration() {
    try {
      // Check if already reorganizing (handled by progress monitor)
      if (this.progressMonitor.isActive()) {
        logger.info('PopupController', 'Reorganization in progress, skipping connection check');
        return;
      }

      // Try to use cached status
      const cachedStatus = await this.getStatusCache();
      if (cachedStatus && cachedStatus.type === 'ready') {
        logger.info('PopupController', 'Using cached ready status');
        this.showStatus(cachedStatus.status, cachedStatus.type);
        this.organizeBtn.disabled = !cachedStatus.organizeEnabled;
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'CHECK_CONFIG' });
      logger.debug('PopupController', 'CHECK_CONFIG response:', response);

      if (!response || !response.success || !response.isConfigured) {
        this.showStatus('⚠️ Configure API Key', 'warning');
        this.showInfo('Please click Settings below to configure your API key.', false);
        this.organizeBtn.disabled = true;
        return;
      }

      // Configuration exists, now test the API connection
      const provider = response.provider || 'unknown';
      this.showStatus('🔄 Testing connection...', 'active');
      logger.info('PopupController', 'Testing API connection');

      const connectionTest = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      logger.debug('PopupController', 'TEST_CONNECTION response:', connectionTest);

      if (connectionTest && connectionTest.success) {
        // Build status message with credits and rate limits if available
        let statusMessage = `✓ Ready (${provider})`;
        let warningMessage = '';
        let hasCapacity = true;

        if (connectionTest.credits !== undefined || connectionTest.rateLimit) {
          const credits = connectionTest.credits || 0;
          const rateLimit = connectionTest.rateLimit;

          // Add credits info
          statusMessage += ` - $${credits.toFixed(2)}`;

          // Check rate limits
          if (rateLimit && rateLimit.remaining !== undefined) {
            statusMessage += ` | ${rateLimit.remaining}/${rateLimit.limit} requests`;

            // No capacity if no credits AND no remaining requests
            if (credits === 0 && rateLimit.remaining === 0) {
              hasCapacity = false;
              const resetTime = rateLimit.reset
                ? new Date(rateLimit.reset).toLocaleTimeString()
                : 'later';
              warningMessage = `⚠️ No credits or free requests remaining. Rate limit resets at ${resetTime}.`;
            } else if (rateLimit.remaining <= 5 && credits < 0.1) {
              warningMessage = `⚠️ Low capacity: only ${rateLimit.remaining} free requests and $${credits.toFixed(2)} credits remaining.`;
            }
          } else if (credits < 1) {
            // Only credits info, no rate limit data
            warningMessage = `⚠️ Low credits: $${credits.toFixed(2)} remaining. You may need to add more credits soon.`;
          }
        }

        if (!hasCapacity) {
          this.showStatus('⚠️ No Capacity', 'warning');
          this.showInfo(warningMessage, true);
          this.organizeBtn.disabled = true;
        } else {
          this.showStatus(statusMessage, 'ready');
          if (warningMessage) {
            this.showInfo(warningMessage, false);
          }
          this.organizeBtn.disabled = false;

          // Cache the ready status
          await this.setStatusCache({
            timestamp: Date.now(),
            status: statusMessage,
            type: 'ready',
            isConfigured: true,
            organizeEnabled: true,
          });
        }
      } else {
        this.showStatus(`✗ ${provider} API Not Available`, 'error');
        this.showInfo(
          `${connectionTest?.error || 'Unable to connect to API. Please check your settings.'}`,
          true
        );
        this.organizeBtn.disabled = true;
      }
    } catch (error) {
      logger.error('PopupController', 'Configuration check failed', error);
      this.showStatus('✗ Configuration Error', 'error');
      this.showInfo(`Error checking configuration: ${error}`, true);
      this.organizeBtn.disabled = true;
    }
  }

  private async handleOrganize() {
    logger.info('PopupController', 'Opening folder selector');
    const selectorUrl = chrome.runtime.getURL('folder-selector.html');
    await chrome.tabs.create({ url: selectorUrl });
    window.close();
  }

  private showStatus(message: string, type: 'ready' | 'active' | 'warning' | 'error') {
    this.statusText.textContent = message
      .replace(/✓/gu, '')
      .replace(/✗/gu, '')
      .replace(/🔄/gu, '')
      .replace(/⚠️/gu, '')
      .trim();

    // Update icon based on type
    const icon = this.statusValue.querySelector('.status-icon');
    if (icon) {
      switch (type) {
        case 'ready':
          icon.textContent = '✓';
          break;
        case 'active':
          icon.textContent = '🔄';
          break;
        case 'warning':
          icon.textContent = '⚠️';
          break;
        case 'error':
          icon.textContent = '✗';
          break;
      }
    }

    // Update class
    this.statusValue.className = `status-value ${type}`;
  }

  private showInfo(message: string, isError: boolean) {
    this.infoBox.textContent = message;
    this.infoBox.className = isError ? 'info-box error' : 'info-box';
    this.infoBox.style.display = 'block';
  }

  private hideInfo() {
    this.infoBox.style.display = 'none';
  }

  private async loadRecentActivity() {
    try {
      const result = await chrome.storage.local.get('activityLog');
      const activityLog: ActivityLogEntry[] = result.activityLog || [];

      if (activityLog.length === 0) {
        this.recentActivitySection.style.display = 'none';
        return;
      }

      this.recentActivitySection.style.display = 'block';
      this.activityList.innerHTML = '';

      activityLog.forEach((entry) => {
        const li = document.createElement('li');
        li.className = `activity-item ${entry.type}`;

        const timeAgo = this.formatTimeAgo(entry.timestamp);

        if (entry.type === 'auto-organize') {
          li.innerHTML = `
            <div class="activity-item-title">📌 ${this.escapeHtml(entry.title || 'Untitled')}</div>
            <div class="activity-item-details">Organized to: ${this.escapeHtml(entry.category || 'Unknown')}</div>
            <div class="activity-item-time">${timeAgo}</div>
          `;
        } else {
          li.innerHTML = `
            <div class="activity-item-title">🗂️ Bulk Organization</div>
            <div class="activity-item-details">${entry.bookmarksMoved || 0} bookmarks, ${entry.foldersCreated || 0} folders</div>
            <div class="activity-item-time">${timeAgo}</div>
          `;
        }

        this.activityList.appendChild(li);
      });

      logger.debug('PopupController', `Loaded ${activityLog.length} activity entries`);
    } catch (error) {
      logger.warn('PopupController', 'Failed to load recent activity', error);
    }
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async clearActivityLog() {
    try {
      await chrome.storage.local.remove('activityLog');
      this.recentActivitySection.style.display = 'none';
      logger.info('PopupController', 'Activity log cleared');
    } catch (error) {
      logger.warn('PopupController', 'Failed to clear activity log', error);
    }
  }

  private async loadAutoOrganizeState() {
    try {
      const result = await chrome.storage.sync.get('app_config');
      const config = result.app_config;
      const isEnabled = config?.organization?.autoOrganize === true;

      this.updateToggleUI(isEnabled);
      logger.debug('PopupController', `Auto-organize state loaded: ${isEnabled}`);
    } catch (error) {
      logger.warn('PopupController', 'Failed to load auto-organize state', error);
    }
  }

  private async toggleAutoOrganize() {
    try {
      const result = await chrome.storage.sync.get('app_config');
      const config = result.app_config;

      if (!config) {
        logger.warn('PopupController', 'No configuration found');
        return;
      }

      // Toggle the setting
      const newState = !config.organization.autoOrganize;
      config.organization.autoOrganize = newState;

      // Save the config
      await chrome.storage.sync.set({ app_config: config });

      // Update UI
      this.updateToggleUI(newState);

      logger.info('PopupController', `Auto-organize toggled to: ${newState}`);
    } catch (error) {
      logger.error('PopupController', 'Failed to toggle auto-organize', error);
    }
  }

  private updateToggleUI(isEnabled: boolean) {
    if (isEnabled) {
      this.autoOrganizeToggle.classList.add('active');
      this.toggleStatus.textContent = 'ON';
    } else {
      this.autoOrganizeToggle.classList.remove('active');
      this.toggleStatus.textContent = 'OFF';
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
