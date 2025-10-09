/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Results page controller
 */

interface BookmarkMove {
  bookmarkId: string;
  title: string;
  url: string;
  fromFolder: string;
  toFolder: string;
}

interface DuplicateRemoved {
  title: string;
  url: string;
  bookmarkId: string;
}

interface FolderCreated {
  name: string;
  id: string;
}

interface EmptyFolderRemoved {
  name: string;
  id: string;
}

interface OrganizationResult {
  success: boolean;
  bookmarksMoved: number;
  foldersCreated: number;
  duplicatesRemoved: number;
  emptyFoldersRemoved: number;
  bookmarksSkipped: number;
  errors: string[];
  moves: BookmarkMove[];
  duplicates: DuplicateRemoved[];
  folders: FolderCreated[];
  emptyFolders: EmptyFolderRemoved[];
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

class ResultsController {
  private result: OrganizationResult | null = null;

  constructor() {
    this.loadResults();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const viewBookmarksBtn = document.getElementById('view-bookmarks');
    const closeTabBtn = document.getElementById('close-tab');

    viewBookmarksBtn?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://bookmarks' });
    });

    closeTabBtn?.addEventListener('click', () => {
      window.close();
    });

    // Setup collapsible sections
    document.querySelectorAll('.section-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const targetId = toggle.getAttribute('data-target');
        if (targetId) {
          const content = document.getElementById(targetId);
          if (content) {
            content.classList.toggle('hidden');
            toggle.classList.toggle('collapsed');
          }
        }
      });
    });
  }

  private async loadResults() {
    // Get results from session storage
    const urlParams = new URLSearchParams(window.location.search);
    const resultsJson = urlParams.get('data');

    if (resultsJson) {
      try {
        this.result = JSON.parse(decodeURIComponent(resultsJson));
        this.displayResults();
      } catch (error) {
        console.error('Failed to parse results:', error);
        this.showError();
      }
    } else {
      // Try to get from chrome.storage as fallback
      try {
        const stored = await chrome.storage.local.get('lastOrganizationResult');
        if (stored.lastOrganizationResult) {
          this.result = stored.lastOrganizationResult;
          this.displayResults();
        } else {
          this.showError();
        }
      } catch (error) {
        console.error('Failed to load results:', error);
        this.showError();
      }
    }
  }

  private displayResults() {
    if (!this.result) return;

    // Handle failure case - show errors prominently, hide success content
    if (!this.result.success) {
      // Update header to show failure with warning styling
      const header = document.querySelector('.header');
      if (header) {
        // Change header background to warning colors
        (header as HTMLElement).style.background = 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)';
        header.innerHTML = `
          <div class="success-icon">⚠️</div>
          <h1>Organization Failed</h1>
          <p class="subtitle">Processing was stopped due to an error. No bookmarks were moved.</p>
        `;
      }

      // Hide stats grid and "What We Did" section since nothing happened
      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) (statsGrid as HTMLElement).style.display = 'none';

      const whatWeDidSection = document.querySelector('.content-section');
      if (whatWeDidSection) (whatWeDidSection as HTMLElement).style.display = 'none';

      // Show errors prominently at the top
      if (this.result.errors && this.result.errors.length > 0) {
        this.displayErrors();
        const errorsSection = document.getElementById('errors-section');
        if (errorsSection) {
          // Move errors to top after header
          const container = document.querySelector('.container');
          const headerElem = container?.querySelector('.header');
          if (container && headerElem) {
            container.insertBefore(errorsSection, headerElem.nextSibling);
          }
          errorsSection.style.display = 'block';
        }
      }

      // Still show duplicates if any were removed (that happens before batching)
      if (this.result.duplicatesRemoved > 0 && this.result.duplicates && this.result.duplicates.length > 0) {
        this.displayDuplicates();
      }

      return;
    }

    // Success case - show everything normally
    // Update stats
    this.updateStat('stat-duplicates', this.result.duplicatesRemoved);
    this.updateStat('stat-moved', this.result.bookmarksMoved);
    this.updateStat('stat-folders', this.result.foldersCreated);
    this.updateStat('stat-empty', this.result.emptyFoldersRemoved);
    this.updateStat('stat-skipped', this.result.bookmarksSkipped);

    // Display token usage if available
    if (this.result.tokenUsage) {
      this.displayTokenUsage();
    }

    // Build timeline
    this.buildTimeline();

    // Display detailed sections
    if (this.result.duplicates && this.result.duplicates.length > 0) {
      this.displayDuplicates();
    }
    if (this.result.moves && this.result.moves.length > 0) {
      this.displayMoves();
    }
    if (this.result.folders && this.result.folders.length > 0) {
      this.displayFolders();
    }
    if (this.result.emptyFolders && this.result.emptyFolders.length > 0) {
      this.displayEmptyFolders();
    }

    // Show errors if any, or success message
    // Filter out informational messages that aren't actual errors
    const actualErrors = this.result.errors?.filter(error =>
      !error.includes('No bookmarks need organizing')
    ) || [];

    if (actualErrors.length > 0) {
      this.displayErrors(actualErrors);
    } else {
      // Check if nothing was done because everything was skipped
      const nothingDone = this.result.bookmarksMoved === 0 &&
                          this.result.foldersCreated === 0 &&
                          this.result.duplicatesRemoved === 0 &&
                          this.result.emptyFoldersRemoved === 0 &&
                          this.result.bookmarksSkipped > 0;

      const noErrorsSection = document.getElementById('no-errors-section');
      if (noErrorsSection) {
        const noErrorsDiv = noErrorsSection.querySelector('.no-errors');
        if (noErrorsDiv) {
          if (nothingDone) {
            noErrorsDiv.innerHTML = `
              <h3>✓ All bookmarks already organized</h3>
              <p>All ${this.result.bookmarksSkipped} bookmarks were already organized - no changes needed!</p>
              <small>To reorganize these bookmarks, disable "Remember previous organization" in settings or click "Clear Organization History".</small>
            `;
          } else {
            noErrorsDiv.innerHTML = `
              <h3>✓ Success</h3>
              <p>All operations completed successfully with no errors!</p>
            `;
          }
        }
        noErrorsSection.style.display = 'block';
      }
    }
  }

  private displayTokenUsage() {
    if (!this.result?.tokenUsage) return;

    const container = document.getElementById('token-usage');
    if (!container) return;

    const { prompt, completion, total } = this.result.tokenUsage;

    container.innerHTML = `
      <div style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="font-size: 20px;">🎯</span>
          <h3 style="margin: 0; font-size: 16px;">Token Usage</h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${prompt.toLocaleString()}</div>
            <div style="font-size: 12px; opacity: 0.9;">Input Tokens</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${completion.toLocaleString()}</div>
            <div style="font-size: 12px; opacity: 0.9;">Output Tokens</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold;">${total.toLocaleString()}</div>
            <div style="font-size: 12px; opacity: 0.9;">Total Tokens</div>
          </div>
        </div>
      </div>
    `;
  }

  private updateStat(elementId: string, value: number) {
    const element = document.getElementById(elementId);
    if (element) {
      // Animate the number
      this.animateNumber(element, 0, value, 1000);
    }
  }

  private animateNumber(element: HTMLElement, start: number, end: number, duration: number) {
    const startTime = performance.now();

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * easeOutQuart);

      element.textContent = current.toString();

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = end.toString();
      }
    };

    requestAnimationFrame(update);
  }

  private buildTimeline() {
    if (!this.result) return;

    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    const steps: Array<{ title: string; description: string }> = [];

    if (this.result.duplicatesRemoved > 0) {
      steps.push({
        title: 'Removed Duplicate Bookmarks',
        description: `Found and removed ${this.result.duplicatesRemoved} duplicate bookmark${this.result.duplicatesRemoved === 1 ? '' : 's'} with identical URLs.`
      });
    }

    steps.push({
      title: 'Analyzed Your Bookmarks',
      description: `Scanned your collection and used AI to understand the content and context of each bookmark.`
    });

    if (this.result.foldersCreated > 0) {
      steps.push({
        title: 'Created Organized Folders',
        description: `Created ${this.result.foldersCreated} new folder${this.result.foldersCreated === 1 ? '' : 's'} to categorize your bookmarks intelligently.`
      });
    }

    if (this.result.bookmarksMoved > 0) {
      steps.push({
        title: 'Organized Bookmarks',
        description: `Moved ${this.result.bookmarksMoved} bookmark${this.result.bookmarksMoved === 1 ? '' : 's'} into appropriate folders based on their content.`
      });
    }

    if (this.result.bookmarksSkipped > 0) {
      steps.push({
        title: 'Skipped Previously Organized',
        description: `Skipped ${this.result.bookmarksSkipped} bookmark${this.result.bookmarksSkipped === 1 ? '' : 's'} that ${this.result.bookmarksSkipped === 1 ? 'was' : 'were'} previously organized. This preserves any manual moves you've made. You can disable "Remember previous organization" in settings to reorganize these bookmarks.`
      });
    }

    if (this.result.emptyFoldersRemoved > 0) {
      steps.push({
        title: 'Cleaned Up Empty Folders',
        description: `Removed ${this.result.emptyFoldersRemoved} empty folder${this.result.emptyFoldersRemoved === 1 ? '' : 's'} to keep your bookmarks tidy.`
      });
    }

    // Customize completion message based on what happened
    const nothingDone = this.result.bookmarksMoved === 0 &&
                        this.result.foldersCreated === 0 &&
                        this.result.duplicatesRemoved === 0 &&
                        this.result.emptyFoldersRemoved === 0 &&
                        this.result.bookmarksSkipped > 0;

    steps.push({
      title: 'Complete!',
      description: nothingDone
        ? 'Your bookmarks are already well organized! To reorganize them, visit settings and disable "Remember previous organization", or click "Clear Organization History".'
        : 'Your bookmarks are now organized and ready to use.'
    });

    timeline.innerHTML = steps.map(step => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <h4>${step.title}</h4>
          <p>${step.description}</p>
        </div>
      </div>
    `).join('');
  }

  private displayErrors(errors?: string[]) {
    const errorsToDisplay = errors || this.result.errors;
    if (!errorsToDisplay || errorsToDisplay.length === 0) return;

    const errorsSection = document.getElementById('errors-section');
    const errorList = document.getElementById('error-list');

    if (errorsSection && errorList) {
      errorsSection.style.display = 'block';
      errorList.innerHTML = errorsToDisplay
        .map(error => `<li>${this.escapeHtml(error)}</li>`)
        .join('');
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private displayDuplicates() {
    if (!this.result || !this.result.duplicates || this.result.duplicates.length === 0) return;

    const section = document.getElementById('duplicates-section');
    const content = document.getElementById('duplicates-content');
    const count = document.getElementById('duplicates-count');

    if (section && content && count) {
      section.style.display = 'block';
      count.textContent = this.result.duplicates.length.toString();

      content.innerHTML = `
        <table class="details-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            ${this.result.duplicates.map(dup => `
              <tr>
                <td>${this.escapeHtml(dup.title)}</td>
                <td><div class="bookmark-url">${this.escapeHtml(dup.url)}</div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  private displayMoves() {
    if (!this.result || !this.result.moves || this.result.moves.length === 0) return;

    const section = document.getElementById('moves-section');
    const content = document.getElementById('moves-content');
    const count = document.getElementById('moves-count');

    if (section && content && count) {
      // Filter out moves where source and destination are the same
      const actualMoves = this.result.moves.filter(move => move.fromFolder !== move.toFolder);

      if (actualMoves.length === 0) {
        // No actual moves to display
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      count.textContent = actualMoves.length.toString();

      content.innerHTML = `
        <table class="details-table">
          <thead>
            <tr>
              <th>Bookmark</th>
              <th>From → To</th>
            </tr>
          </thead>
          <tbody>
            ${actualMoves.map(move => `
              <tr>
                <td>
                  <strong>${this.escapeHtml(move.title)}</strong>
                  <div class="bookmark-url">${this.escapeHtml(move.url)}</div>
                </td>
                <td>
                  <span class="folder-badge">${this.escapeHtml(move.fromFolder)}</span>
                  <span class="arrow">→</span>
                  <span class="folder-badge">${this.escapeHtml(move.toFolder)}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  private displayFolders() {
    if (!this.result || !this.result.folders || this.result.folders.length === 0) return;

    const section = document.getElementById('folders-section');
    const content = document.getElementById('folders-content');
    const count = document.getElementById('folders-count');

    if (section && content && count) {
      section.style.display = 'block';
      count.textContent = this.result.folders.length.toString();

      content.innerHTML = `
        <table class="details-table">
          <thead>
            <tr>
              <th>Folder Name</th>
            </tr>
          </thead>
          <tbody>
            ${this.result.folders.map(folder => `
              <tr>
                <td><span class="folder-badge">${this.escapeHtml(folder.name)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  private displayEmptyFolders() {
    if (!this.result || !this.result.emptyFolders || this.result.emptyFolders.length === 0) return;

    const section = document.getElementById('empty-folders-section');
    const content = document.getElementById('empty-folders-content');
    const count = document.getElementById('empty-folders-count');

    if (section && content && count) {
      section.style.display = 'block';
      count.textContent = this.result.emptyFolders.length.toString();

      content.innerHTML = `
        <table class="details-table">
          <thead>
            <tr>
              <th>Folder Name</th>
            </tr>
          </thead>
          <tbody>
            ${this.result.emptyFolders.map(folder => `
              <tr>
                <td><span class="folder-badge">${this.escapeHtml(folder.name)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  private showError() {
    document.querySelector('.header h1')!.textContent = 'Unable to Load Results';
    document.querySelector('.header .subtitle')!.textContent = 'Could not retrieve organization results';
    document.querySelector('.success-icon')!.textContent = '⚠️';

    // Hide all content sections
    document.querySelectorAll('.stats-grid, .content-section').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ResultsController();
});
