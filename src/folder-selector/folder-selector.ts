/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Folder selector controller for selective organization
 */

import type { BookmarkTreeNode } from '../services/BookmarkManager.js';

interface FolderSelectionState {
  selectedFolderIds: Set<string>;
  expandedFolderIds: Set<string>;
  folderTree: BookmarkTreeNode[];
}

class FolderSelectorController {
  private searchInput: HTMLInputElement;
  private selectAllBtn: HTMLButtonElement;
  private deselectAllBtn: HTMLButtonElement;
  private expandAllBtn: HTMLButtonElement;
  private collapseAllBtn: HTMLButtonElement;
  private selectedCountSpan: HTMLElement;
  private bookmarkCountSpan: HTMLElement;
  private folderTreeUl: HTMLElement;
  private emptyState: HTMLElement;
  private cancelBtn: HTMLButtonElement;
  private organizeAllBtn: HTMLButtonElement;
  private organizeBtn: HTMLButtonElement;
  private statusDiv: HTMLElement;
  private confirmationOverlay: HTMLElement;
  private confirmTitle: HTMLElement;
  private confirmMessage: HTMLElement;
  private confirmCancelBtn: HTMLButtonElement;
  private confirmProceedBtn: HTMLButtonElement;
  private confirmFolderCount: HTMLElement;
  private confirmBookmarkCount: HTMLElement;
  private settingsBtn: HTMLButtonElement;
  private quickSettingsBtns: NodeListOf<HTMLButtonElement>;

  private isOrganizeAll: boolean = false;

  private state: FolderSelectionState = {
    selectedFolderIds: new Set(),
    expandedFolderIds: new Set(),
    folderTree: [],
  };

  private folderMap = new Map<string, BookmarkTreeNode>();
  private systemFolderIds = new Set(['0', '1', '2', '3', '4']);

  constructor() {
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.selectAllBtn = document.getElementById('select-all-btn') as HTMLButtonElement;
    this.deselectAllBtn = document.getElementById('deselect-all-btn') as HTMLButtonElement;
    this.expandAllBtn = document.getElementById('expand-all-btn') as HTMLButtonElement;
    this.collapseAllBtn = document.getElementById('collapse-all-btn') as HTMLButtonElement;
    this.selectedCountSpan = document.getElementById('selected-count') as HTMLElement;
    this.bookmarkCountSpan = document.getElementById('bookmark-count') as HTMLElement;
    this.folderTreeUl = document.getElementById('folder-tree') as HTMLElement;
    this.emptyState = document.getElementById('empty-state') as HTMLElement;
    this.cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    this.organizeAllBtn = document.getElementById('organize-all-btn') as HTMLButtonElement;
    this.organizeBtn = document.getElementById('organize-btn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    this.confirmationOverlay = document.getElementById('confirmation-overlay') as HTMLElement;
    this.confirmTitle = document.getElementById('confirmation-title') as HTMLElement;
    this.confirmMessage = document.getElementById('confirmation-message') as HTMLElement;
    this.confirmCancelBtn = document.getElementById('confirm-cancel-btn') as HTMLButtonElement;
    this.confirmProceedBtn = document.getElementById('confirm-proceed-btn') as HTMLButtonElement;
    this.confirmFolderCount = document.getElementById('confirm-folder-count') as HTMLElement;
    this.confirmBookmarkCount = document.getElementById('confirm-bookmark-count') as HTMLElement;
    this.settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
    this.quickSettingsBtns = document.querySelectorAll(
      '.toggle-btn'
    ) as NodeListOf<HTMLButtonElement>;

    this.setupEventListeners();
    this.loadQuickSettings();
    this.loadFolders();
  }

  private setupEventListeners() {
    this.searchInput.addEventListener('input', () => this.handleSearch());
    this.selectAllBtn.addEventListener('click', () => this.selectAll());
    this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
    this.expandAllBtn.addEventListener('click', () => this.expandAll());
    this.collapseAllBtn.addEventListener('click', () => this.collapseAll());
    this.cancelBtn.addEventListener('click', () => this.handleCancel());
    this.organizeAllBtn.addEventListener('click', () => this.handleOrganizeAll());
    this.organizeBtn.addEventListener('click', () => this.handleOrganize());
    this.confirmCancelBtn.addEventListener('click', () => this.hideConfirmation());
    this.confirmProceedBtn.addEventListener('click', () => this.handleConfirm());
    this.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    // Quick settings toggle buttons
    this.quickSettingsBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.handleQuickSettingChange(btn));
    });
  }

  private async loadQuickSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      console.log('Quick settings config response:', response);

      if (response && response.success) {
        const config = response.config;

        // Set folder mode buttons
        const folderMode = config.organization.useExistingFolders ? 'existing' : 'create';
        console.log('Setting folderMode to:', folderMode);
        this.updateToggleButtons('folderMode', folderMode);

        // Set history mode buttons
        const historyMode = config.organization.respectOrganizationHistory || 'organizeAllOnly';
        console.log('Setting historyMode to:', historyMode);
        this.updateToggleButtons('historyMode', historyMode);
      }
    } catch (error) {
      console.error('Failed to load quick settings:', error);
    }
  }

  private updateToggleButtons(setting: string, value: string) {
    console.log(`Updating toggle buttons for ${setting} = ${value}`);
    let foundButtons = 0;
    this.quickSettingsBtns.forEach((btn) => {
      if (btn.dataset.setting === setting) {
        foundButtons++;
        const isActive = btn.dataset.value === value;
        console.log(`Button ${btn.dataset.value}: ${isActive ? 'ACTIVE' : 'inactive'}`);
        if (isActive) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
    console.log(`Found ${foundButtons} buttons for setting ${setting}`);
  }

  private async handleQuickSettingChange(btn: HTMLButtonElement) {
    const setting = btn.dataset.setting;
    const value = btn.dataset.value;

    if (!setting || !value) return;

    try {
      // Get current config
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (!response || !response.success) {
        throw new Error('Failed to get current config');
      }

      const config = response.config;

      // Update the specific setting
      if (setting === 'folderMode') {
        config.organization.useExistingFolders = value === 'existing';
      } else if (setting === 'historyMode') {
        config.organization.respectOrganizationHistory = value as
          | 'always'
          | 'never'
          | 'organizeAllOnly';
      }

      // Save updated config
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: config,
      });

      if (saveResponse && saveResponse.success) {
        // Update UI
        this.updateToggleButtons(setting, value);
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Failed to update quick setting:', error);
      this.showStatus('Failed to update setting', 'error');
    }
  }

  private async loadFolders() {
    try {
      this.showStatus('Loading folders...', 'info');

      const response = await chrome.runtime.sendMessage({ type: 'GET_FOLDER_TREE' });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to load folders');
      }

      this.state.folderTree = response.tree;
      this.buildFolderMap(this.state.folderTree);

      // Pre-select folders with bookmarks (excluding system folders)
      this.preselectFoldersWithBookmarks();

      // Expand top-level folders by default
      this.expandTopLevelFolders();

      this.renderTree();
      this.updateSelectionInfo();
      this.hideStatus();
    } catch (error) {
      console.error('Failed to load folders:', error);
      this.showStatus(`Error loading folders: ${error}`, 'error');
      this.emptyState.style.display = 'block';
    }
  }

  private buildFolderMap(nodes: BookmarkTreeNode[]) {
    for (const node of nodes) {
      this.folderMap.set(node.id, node);
      if (node.children && node.children.length > 0) {
        this.buildFolderMap(node.children);
      }
    }
  }

  private preselectFoldersWithBookmarks() {
    // Select folders that have bookmarks and are not system folders
    for (const [id, folder] of this.folderMap) {
      if (!this.systemFolderIds.has(id) && folder.directBookmarks > 0) {
        this.state.selectedFolderIds.add(id);
      }
    }
  }

  private expandTopLevelFolders() {
    // Expand the first level of folders (children of root)
    for (const rootNode of this.state.folderTree) {
      if (rootNode.children && rootNode.children.length > 0) {
        // Expand the root node itself (e.g., "Bookmarks bar")
        this.state.expandedFolderIds.add(rootNode.id);

        // Also expand its direct children (top-level user folders)
        for (const child of rootNode.children) {
          if (child.children && child.children.length > 0) {
            this.state.expandedFolderIds.add(child.id);
          }
        }
      }
    }
  }

  private renderTree() {
    this.folderTreeUl.innerHTML = '';

    if (this.state.folderTree.length === 0) {
      this.emptyState.style.display = 'block';
      return;
    }

    this.emptyState.style.display = 'none';

    // Render root folders (skip the root node itself)
    for (const rootNode of this.state.folderTree) {
      if (rootNode.children && rootNode.children.length > 0) {
        for (const child of rootNode.children) {
          const li = this.renderFolder(child, 0);
          this.folderTreeUl.appendChild(li);
        }
      }
    }
  }

  private renderFolder(folder: BookmarkTreeNode, depth: number): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'folder-item';
    li.dataset.folderId = folder.id;

    const row = document.createElement('div');
    row.className = 'folder-row';

    // Indent
    const indent = document.createElement('span');
    indent.className = 'folder-indent';
    indent.style.width = `${depth * 20}px`;
    row.appendChild(indent);

    // Expand/collapse toggle
    const hasChildren = folder.children && folder.children.length > 0;
    const toggle = document.createElement('span');
    toggle.className = hasChildren ? 'expand-toggle' : 'expand-toggle empty';
    toggle.textContent = hasChildren ? '▶' : '';
    if (hasChildren) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleExpand(folder.id);
      });
    }
    row.appendChild(toggle);

    // Checkbox (don't show for system root folders)
    if (!this.systemFolderIds.has(folder.id)) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'folder-checkbox';
      checkbox.checked = this.state.selectedFolderIds.has(folder.id);
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleSelection(folder.id, checkbox.checked);
      });
      row.appendChild(checkbox);
    }

    // Icon
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = this.state.selectedFolderIds.has(folder.id) ? '📂' : '📁';
    row.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.title;
    row.appendChild(name);

    // Counts
    if (folder.totalBookmarks > 0) {
      const counts = document.createElement('span');
      counts.className = 'folder-counts';

      if (folder.directBookmarks > 0) {
        const direct = document.createElement('span');
        direct.className = 'direct';
        direct.textContent = `(${folder.directBookmarks})`;
        counts.appendChild(direct);
      }

      if (folder.totalBookmarks > folder.directBookmarks) {
        const total = document.createElement('span');
        total.className = 'total';
        total.textContent = `[${folder.totalBookmarks} total]`;
        counts.appendChild(total);
      }

      row.appendChild(counts);
    }

    li.appendChild(row);

    // Children
    if (hasChildren) {
      const childrenUl = document.createElement('ul');
      childrenUl.className = 'folder-children';
      if (this.state.expandedFolderIds.has(folder.id)) {
        childrenUl.classList.add('expanded');
        toggle.textContent = '▼';
      }

      for (const child of folder.children) {
        const childLi = this.renderFolder(child, depth + 1);
        childrenUl.appendChild(childLi);
      }

      li.appendChild(childrenUl);
    }

    return li;
  }

  private toggleExpand(folderId: string) {
    if (this.state.expandedFolderIds.has(folderId)) {
      this.state.expandedFolderIds.delete(folderId);
    } else {
      this.state.expandedFolderIds.add(folderId);
    }
    this.renderTree();
  }

  private toggleSelection(folderId: string, selected: boolean) {
    if (selected) {
      this.state.selectedFolderIds.add(folderId);
      // Also select all children
      this.selectChildren(folderId, true);
    } else {
      this.state.selectedFolderIds.delete(folderId);
      // Also deselect all children
      this.selectChildren(folderId, false);
    }
    this.renderTree();
    this.updateSelectionInfo();
  }

  private selectChildren(folderId: string, select: boolean) {
    const folder = this.folderMap.get(folderId);
    if (!folder || !folder.children) return;

    for (const child of folder.children) {
      if (!this.systemFolderIds.has(child.id)) {
        if (select) {
          this.state.selectedFolderIds.add(child.id);
        } else {
          this.state.selectedFolderIds.delete(child.id);
        }
        this.selectChildren(child.id, select);
      }
    }
  }

  private updateSelectionInfo() {
    const selectedCount = this.state.selectedFolderIds.size;
    let totalBookmarks = 0;

    for (const folderId of this.state.selectedFolderIds) {
      const folder = this.folderMap.get(folderId);
      if (folder) {
        totalBookmarks += folder.totalBookmarks;
      }
    }

    this.selectedCountSpan.textContent = selectedCount.toString();
    this.bookmarkCountSpan.textContent = totalBookmarks.toString();

    // Enable/disable organize button
    this.organizeBtn.disabled = selectedCount === 0;
  }

  private handleSearch() {
    const query = this.searchInput.value.toLowerCase().trim();

    if (!query) {
      this.renderTree();
      return;
    }

    // Expand all folders that match or have matching descendants
    const matchingIds = new Set<string>();

    for (const [id, folder] of this.folderMap) {
      if (folder.title.toLowerCase().includes(query)) {
        matchingIds.add(id);
        // Expand path to this folder
        this.expandPathToFolder(id);
      }
    }

    // Render with highlighting
    this.renderTree();
  }

  private expandPathToFolder(folderId: string) {
    const folder = this.folderMap.get(folderId);
    if (!folder || !folder.parentId) return;

    this.state.expandedFolderIds.add(folder.parentId);
    this.expandPathToFolder(folder.parentId);
  }

  private selectAll() {
    for (const [id, folder] of this.folderMap) {
      if (!this.systemFolderIds.has(id) && folder.totalBookmarks > 0) {
        this.state.selectedFolderIds.add(id);
      }
    }
    this.renderTree();
    this.updateSelectionInfo();
  }

  private deselectAll() {
    this.state.selectedFolderIds.clear();
    this.renderTree();
    this.updateSelectionInfo();
  }

  private expandAll() {
    for (const [id, folder] of this.folderMap) {
      if (folder.children && folder.children.length > 0) {
        this.state.expandedFolderIds.add(id);
      }
    }
    this.renderTree();
  }

  private collapseAll() {
    this.state.expandedFolderIds.clear();
    this.renderTree();
  }

  private handleCancel() {
    window.close();
  }

  private handleOrganizeAll() {
    this.isOrganizeAll = true;

    // Calculate totals across all folders (excluding system folders)
    let totalFolders = 0;
    let totalBookmarks = 0;

    for (const [id, folder] of this.folderMap) {
      if (!this.systemFolderIds.has(id)) {
        totalFolders++;
        totalBookmarks += folder.totalBookmarks;
      }
    }

    this.confirmTitle.textContent = 'Organize All Bookmarks?';
    this.confirmMessage.innerHTML = `
      This will reorganize <strong>ALL</strong> your bookmarks into categorized folders.
      <br><br>
      <strong>⚠️ IMPORTANT: Backup First!</strong><br>
      It is strongly recommended to back up your bookmarks before proceeding.
      <br><br>
      <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 10px;">
        <strong>To backup:</strong><br>
        chrome://bookmarks → ⋮ (menu) → Export bookmarks
      </div>
    `;
    this.confirmFolderCount.textContent = totalFolders.toString();
    this.confirmBookmarkCount.textContent = totalBookmarks.toString();
    this.showConfirmation();
  }

  private handleOrganize() {
    if (this.state.selectedFolderIds.size === 0) {
      this.showStatus('Please select at least one folder', 'error');
      return;
    }

    this.isOrganizeAll = false;

    // Show confirmation dialog
    let totalBookmarks = 0;
    for (const folderId of this.state.selectedFolderIds) {
      const folder = this.folderMap.get(folderId);
      if (folder) {
        totalBookmarks += folder.totalBookmarks;
      }
    }

    this.confirmTitle.textContent = 'Organize Selected Folders?';
    this.confirmMessage.innerHTML = `
      This will reorganize <strong id="confirm-folder-count">${this.state.selectedFolderIds.size}</strong> folders containing <strong id="confirm-bookmark-count">${totalBookmarks}</strong> bookmarks into categorized folders.
      <br><br>
      <strong>Note:</strong> It's recommended to back up your bookmarks first (chrome://bookmarks → Export).
    `;
    this.confirmFolderCount.textContent = this.state.selectedFolderIds.size.toString();
    this.confirmBookmarkCount.textContent = totalBookmarks.toString();
    this.showConfirmation();
  }

  private showConfirmation() {
    this.confirmationOverlay.classList.add('active');
  }

  private hideConfirmation() {
    this.confirmationOverlay.classList.remove('active');
  }

  private async handleConfirm() {
    this.hideConfirmation();

    this.organizeBtn.disabled = true;
    this.organizeAllBtn.disabled = true;
    this.showStatus('Starting organization...', 'info');

    try {
      let response;

      if (this.isOrganizeAll) {
        // Execute full reorganization
        response = await chrome.runtime.sendMessage({
          type: 'EXECUTE_REORGANIZATION',
        });
      } else {
        // Execute selective reorganization
        const folderIds = Array.from(this.state.selectedFolderIds);
        response = await chrome.runtime.sendMessage({
          type: 'EXECUTE_SELECTIVE_REORGANIZATION',
          folderIds,
        });
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Organization failed');
      }

      // Background service has already stored results and opened results page
      // Just close this window
      window.close();
    } catch (error) {
      console.error('Organization failed:', error);
      this.showStatus(`Error: ${error}`, 'error');
      this.organizeBtn.disabled = false;
      this.organizeAllBtn.disabled = false;
    }
  }

  private showStatus(message: string, type: 'info' | 'success' | 'error') {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
  }

  private hideStatus() {
    this.statusDiv.className = 'status';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new FolderSelectorController();
});
