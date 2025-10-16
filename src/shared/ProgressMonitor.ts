/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Shared progress monitoring utility for tracking reorganization progress
 * Used by both popup and folder-selector to display live progress updates
 */

import { logger } from '../services/Logger.js';
import type { ReorganizationProgress } from '../types/messages.js';

/**
 * Options for initializing the progress monitor
 */
export interface ProgressMonitorOptions {
  // CSS selectors for progress UI elements
  activityIndicatorSelector: string;
  activityMessageSelector: string;
  activityCountSelector: string;

  // Optional callback when progress updates
  onProgressUpdate?: (progress: ReorganizationProgress) => void;

  // Optional callback when reorganization starts
  onReorganizationStart?: () => void;

  // Optional callback when reorganization completes
  onReorganizationComplete?: () => void;
}

/**
 * ProgressMonitor class for monitoring and displaying reorganization progress
 */
export class ProgressMonitor {
  private activityIndicator: HTMLElement;
  private activityMessage: HTMLElement;
  private activityCount: HTMLElement;
  private options: ProgressMonitorOptions;
  private pollingInterval: number | null = null;
  private isMonitoring: boolean = false;
  private hasSeenProgress: boolean = false;

  constructor(options: ProgressMonitorOptions) {
    this.options = options;

    // Get DOM elements
    const indicator = document.querySelector(options.activityIndicatorSelector);
    const message = document.querySelector(options.activityMessageSelector);
    const count = document.querySelector(options.activityCountSelector);

    if (!indicator || !message || !count) {
      throw new Error('Progress monitor: Required DOM elements not found');
    }

    this.activityIndicator = indicator as HTMLElement;
    this.activityMessage = message as HTMLElement;
    this.activityCount = count as HTMLElement;

    // Listen for progress update messages from background service
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'PROGRESS_UPDATE') {
        logger.debug('ProgressMonitor', 'Progress update received', message);
        this.updateProgress(message.current, message.total, message.message);
      }
    });
  }

  /**
   * Start monitoring reorganization progress
   * Polls the background service for status updates
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.debug('ProgressMonitor', 'Already monitoring, ignoring start request');
      return;
    }

    logger.info('ProgressMonitor', 'Starting progress monitoring');
    this.isMonitoring = true;
    this.hasSeenProgress = false;
    this.showActivity(true);

    if (this.options.onReorganizationStart) {
      this.options.onReorganizationStart();
    }

    // Wait a brief moment for the background service to set up its state
    // before checking status (avoids race condition)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check status immediately
    await this.checkStatus();

    // Poll every 500ms for updates
    this.pollingInterval = window.setInterval(() => {
      this.checkStatus();
    }, 500);
  }

  /**
   * Stop monitoring reorganization progress
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('ProgressMonitor', 'Stopping progress monitoring');
    this.isMonitoring = false;

    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.showActivity(false);

    if (this.options.onReorganizationComplete) {
      this.options.onReorganizationComplete();
    }
  }

  /**
   * Check current reorganization status
   */
  private async checkStatus(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_REORGANIZATION_STATUS',
      });

      if (response && response.isReorganizing && response.progress) {
        this.hasSeenProgress = true;
        this.updateProgress(
          response.progress.current,
          response.progress.total,
          response.progress.message
        );
        return true;
      } else {
        // Reorganization completed or not running
        // Only stop monitoring if we've seen at least one progress update
        // (avoids race condition where we start monitoring before background service sets state)
        if (this.isMonitoring && this.hasSeenProgress) {
          this.stopMonitoring();
        }
        return false;
      }
    } catch (error) {
      logger.warn('ProgressMonitor', 'Failed to check reorganization status', error);
      return false;
    }
  }

  /**
   * Update progress display
   */
  private updateProgress(current: number, total: number, message: string): void {
    this.activityMessage.textContent = message;
    this.activityCount.textContent = `${current} of ${total} items`;

    if (this.options.onProgressUpdate) {
      this.options.onProgressUpdate({ current, total, message });
    }
  }

  /**
   * Show or hide activity indicator
   */
  private showActivity(show: boolean): void {
    if (show) {
      this.activityIndicator.classList.add('active');
    } else {
      this.activityIndicator.classList.remove('active');
    }
  }

  /**
   * Check if currently monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Restore monitoring state from background service
   * Call this on page load to resume monitoring if reorganization is in progress
   */
  async restoreMonitoringState(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_REORGANIZATION_STATUS',
      });

      if (response && response.isReorganizing && response.progress) {
        logger.info('ProgressMonitor', 'Reorganization in progress, restoring monitoring state');
        await this.startMonitoring();
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('ProgressMonitor', 'Failed to restore monitoring state', error);
      return false;
    }
  }
}
