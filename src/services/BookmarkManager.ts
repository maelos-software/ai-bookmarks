/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Simple Chrome Bookmarks API wrapper
 */

import { logger } from './Logger.js';
import {
  SYSTEM_FOLDER_IDS,
  PROTECTED_FOLDER_NAMES,
  SPEED_DIAL_RENAMED_FOLDERS,
} from './ConfigurationManager.js';

export interface Bookmark {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  children?: Bookmark[];
}

export interface BookmarkTreeNode {
  id: string;
  title: string;
  parentId?: string;
  directBookmarks: number;
  totalBookmarks: number;
  children: BookmarkTreeNode[];
}

export class BookmarkManager {
  /**
   * Normalize folder title for comparison (lowercase and trim)
   */
  static normalizeTitle(title: string): string {
    return title.toLowerCase().trim();
  }

  /**
   * Find folders by name (case-insensitive)
   */
  async findFoldersByName(name: string, allFolders?: Bookmark[]): Promise<Bookmark[]> {
    const folders = allFolders || (await this.getAllFolders());
    const normalized = BookmarkManager.normalizeTitle(name);
    return folders.filter((f) => BookmarkManager.normalizeTitle(f.title) === normalized);
  }

  /**
   * Find folders by name pattern (case-insensitive, starts with)
   */
  async findFoldersByPattern(pattern: string, allFolders?: Bookmark[]): Promise<Bookmark[]> {
    const folders = allFolders || (await this.getAllFolders());
    const normalized = BookmarkManager.normalizeTitle(pattern);
    return folders.filter((f) => BookmarkManager.normalizeTitle(f.title).startsWith(normalized));
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderId: string, newTitle: string): Promise<void> {
    await chrome.bookmarks.update(folderId, { title: newTitle });
    logger.debug('BookmarkManager', `Renamed folder ${folderId} to "${newTitle}"`);
  }

  /**
   * Get all bookmarks as flat list
   */
  async getAllBookmarks(): Promise<Bookmark[]> {
    logger.trace('BookmarkManager', 'getAllBookmarks() called');
    const tree = await chrome.bookmarks.getTree();
    logger.debug('BookmarkManager', 'Got bookmark tree from Chrome');
    const bookmarks: Bookmark[] = [];

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          // It's a bookmark
          bookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId,
          });
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    logger.info('BookmarkManager', `Found ${bookmarks.length} bookmarks`);
    return bookmarks;
  }

  /**
   * Get all folders (non-bookmark nodes)
   */
  async getAllFolders(): Promise<Bookmark[]> {
    logger.trace('BookmarkManager', 'getAllFolders() called');
    const tree = await chrome.bookmarks.getTree();
    const folders: Bookmark[] = [];

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of nodes) {
        if (!node.url && node.id) {
          folders.push({
            id: node.id,
            title: node.title,
            parentId: node.parentId,
          });
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    logger.info('BookmarkManager', `Found ${folders.length} folders`);
    return folders;
  }

  /**
   * Find folder by name (case-insensitive)
   */
  async findFolderByName(name: string): Promise<string | null> {
    logger.trace('BookmarkManager', `findFolderByName("${name}") called`);
    const folders = await this.getAllFolders();
    const normalized = name.toLowerCase().trim();

    const folder = folders.find((f) => f.title.toLowerCase().trim() === normalized);
    logger.debug('BookmarkManager', `findFolderByName("${name}")`, {
      found: !!folder,
      id: folder?.id,
    });
    return folder ? folder.id : null;
  }

  /**
   * Create folder if it doesn't exist, return folder ID
   */
  async ensureFolder(name: string, parentId: string = '1'): Promise<string> {
    logger.trace('BookmarkManager', `ensureFolder("${name}", "${parentId}") called`);
    // Check if already exists at this parent location
    const folders = await this.getAllFolders();
    const normalized = name.toLowerCase().trim();
    const existing = folders.find(
      (f) => f.title.toLowerCase().trim() === normalized && f.parentId === parentId
    );

    if (existing) {
      logger.debug(
        'BookmarkManager',
        `Folder "${name}" already exists at parent ${parentId} with ID ${existing.id}`
      );
      return existing.id;
    }

    // Create new folder
    logger.info('BookmarkManager', `Creating new folder "${name}" at parent ${parentId}`);
    const folder = await chrome.bookmarks.create({
      title: name,
      parentId: parentId,
    });

    logger.info('BookmarkManager', `Created folder "${name}" with ID ${folder.id}`);
    return folder.id;
  }

  /**
   * Move bookmark to folder
   */
  async moveBookmark(bookmarkId: string, folderId: string): Promise<void> {
    logger.trace('BookmarkManager', `moveBookmark("${bookmarkId}", "${folderId}") called`);
    await chrome.bookmarks.move(bookmarkId, { parentId: folderId });
    logger.debug('BookmarkManager', `Moved bookmark ${bookmarkId} to folder ${folderId}`);
  }

  /**
   * Get bookmarks in specific folder
   */
  async getBookmarksInFolder(folderId: string): Promise<Bookmark[]> {
    const allBookmarks = await this.getAllBookmarks();
    return allBookmarks.filter((b) => b.parentId === folderId);
  }

  /**
   * Normalize URL for duplicate detection
   * Only does exact matching - no URL manipulation
   */
  private normalizeUrl(url: string): string {
    // Return exact URL - we want to catch literally identical bookmarks only
    return url;
  }

  /**
   * Find duplicate bookmarks (same URL)
   * Returns map of normalized URL -> array of bookmark IDs
   */
  async findDuplicates(): Promise<Map<string, string[]>> {
    logger.trace('BookmarkManager', 'findDuplicates() called');
    const bookmarks = await this.getAllBookmarks();
    logger.debug('BookmarkManager', `Checking ${bookmarks.length} bookmarks for duplicates`);

    const urlMap = new Map<string, string[]>();

    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;

      const normalized = this.normalizeUrl(bookmark.url);
      if (!urlMap.has(normalized)) {
        urlMap.set(normalized, []);
      }
      const bookmarks = urlMap.get(normalized);
      if (bookmarks) {
        bookmarks.push(bookmark.id);
      }
    }

    // Filter to only duplicates (more than one bookmark per URL)
    const duplicates = new Map<string, string[]>();
    for (const [url, ids] of urlMap.entries()) {
      if (ids.length > 1) {
        duplicates.set(url, ids);
      }
    }

    logger.info('BookmarkManager', `Found ${duplicates.size} URLs with duplicates`);
    logger.trace('BookmarkManager', 'Duplicate URLs', Array.from(duplicates.keys()));
    return duplicates;
  }

  /**
   * Remove duplicate bookmarks, keeping only the first occurrence
   * Returns details about duplicates removed
   */
  async removeDuplicates(): Promise<{
    removed: number;
    details: Array<{ title: string; url: string; bookmarkId: string }>;
  }> {
    logger.info('BookmarkManager', 'removeDuplicates() called');
    const allBookmarks = await this.getAllBookmarks();
    const bookmarkMap = new Map<string, Bookmark>();
    for (const bookmark of allBookmarks) {
      if (bookmark.url) {
        bookmarkMap.set(bookmark.id, bookmark);
      }
    }

    const duplicates = await this.findDuplicates();
    const details: Array<{ title: string; url: string; bookmarkId: string }> = [];
    let removed = 0;

    for (const [url, ids] of duplicates.entries()) {
      logger.debug('BookmarkManager', `Removing ${ids.length - 1} duplicates of URL: ${url}`);

      // Keep first, remove rest
      for (let i = 1; i < ids.length; i++) {
        const bookmark = bookmarkMap.get(ids[i]);
        try {
          await chrome.bookmarks.remove(ids[i]);
          removed++;
          if (bookmark) {
            details.push({
              title: bookmark.title,
              url: bookmark.url || url,
              bookmarkId: ids[i],
            });
          }
          logger.trace('BookmarkManager', `Removed duplicate bookmark ${ids[i]}`);
        } catch (error) {
          logger.warn('BookmarkManager', `Failed to remove duplicate ${ids[i]}`, error);
        }
      }
    }

    logger.info('BookmarkManager', `Removed ${removed} duplicate bookmarks`);
    return { removed, details };
  }

  /**
   * Check if folder is empty (no bookmarks, no child folders)
   */
  private async isFolderEmpty(folderId: string): Promise<boolean> {
    try {
      const children = await chrome.bookmarks.getChildren(folderId);
      return children.length === 0;
    } catch (error) {
      logger.warn('BookmarkManager', `Failed to check if folder ${folderId} is empty`, error);
      return false;
    }
  }

  /**
   * Get all system/root-level folders that users might want to configure
   */
  async getSystemFolders(): Promise<Array<{ id: string; title: string; isRoot: boolean }>> {
    logger.trace('BookmarkManager', 'getSystemFolders() called');
    const tree = await chrome.bookmarks.getTree();
    const systemFolders: Array<{ id: string; title: string; isRoot: boolean }> = [];

    // Known root folder IDs
    const rootIds = ['0', '1', '2', '3', '4'];

    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[], parentId?: string) => {
      for (const node of nodes) {
        if (!node.url) {
          // It's a folder
          const isRoot = !parentId || parentId === '0' || rootIds.includes(node.id);

          // Add root folders and well-known system folders
          if (isRoot || this.isWellKnownSystemFolder(node.title)) {
            systemFolders.push({
              id: node.id,
              title: node.title,
              isRoot,
            });
          }

          if (node.children) {
            traverse(node.children, node.id);
          }
        }
      }
    };

    traverse(tree);
    logger.info('BookmarkManager', `Found ${systemFolders.length} system folders`);
    return systemFolders;
  }

  /**
   * Check if folder name matches well-known system folder patterns
   */
  private isWellKnownSystemFolder(title: string): boolean {
    const wellKnownNames = new Set([
      'bookmarks bar',
      'other bookmarks',
      'mobile bookmarks',
      'trash',
      'speed dial',
      'home',
      'bookmarks menu',
      'toolbar',
      'unsorted bookmarks',
      'bookmarks toolbar',
    ]);

    return wellKnownNames.has(title.toLowerCase().trim());
  }

  /**
   * Check if a folder is a system/protected folder that should never be removed
   */
  private isProtectedFolder(folder: Bookmark, allowRemoveSavedTabs: boolean = false): boolean {
    // System folder IDs to never remove (0=root, 1=bookmarks bar, 2=other bookmarks, 3=mobile, 4=trash)
    const systemFolderIds = new Set(SYSTEM_FOLDER_IDS);

    if (systemFolderIds.has(folder.id)) {
      return true;
    }

    // Protected folder names (case-insensitive)
    const protectedNames = new Set(PROTECTED_FOLDER_NAMES);

    const normalizedTitle = folder.title.toLowerCase().trim();
    if (protectedNames.has(normalizedTitle)) {
      return true;
    }

    // Protect renamed Speed Dial folders (these get renamed but still can't be deleted)
    const speedDialRenamedFolders = new Set(SPEED_DIAL_RENAMED_FOLDERS);
    if (speedDialRenamedFolders.has(normalizedTitle)) {
      logger.debug('BookmarkManager', `Protecting renamed Speed Dial folder: ${folder.title}`);
      return true;
    }

    // Protect "Saved Tabs" folders (browser-generated with timestamps) unless explicitly allowed
    if (normalizedTitle.startsWith('saved tabs') && !allowRemoveSavedTabs) {
      return true;
    }

    // Check if folder has no parent (root-level system folders)
    if (!folder.parentId || folder.parentId === '0') {
      // Only allow removal of user-created root folders, not system ones
      // If it's at root and has a protected name, don't remove
      return protectedNames.has(normalizedTitle);
    }

    return false;
  }

  /**
   * Find all empty folders (excluding system folders)
   */
  async findEmptyFolders(allowRemoveSavedTabs: boolean = false): Promise<Bookmark[]> {
    logger.trace('BookmarkManager', 'findEmptyFolders() called', { allowRemoveSavedTabs });
    const folders = await this.getAllFolders();
    logger.debug('BookmarkManager', `Checking ${folders.length} folders for emptiness`);

    const emptyFolders: Bookmark[] = [];

    for (const folder of folders) {
      if (this.isProtectedFolder(folder, allowRemoveSavedTabs)) {
        logger.trace(
          'BookmarkManager',
          `Skipping protected folder: ${folder.title} (${folder.id})`
        );
        continue;
      }

      const isEmpty = await this.isFolderEmpty(folder.id);
      if (isEmpty) {
        logger.debug('BookmarkManager', `Found empty folder: ${folder.title} (${folder.id})`);
        emptyFolders.push(folder);
      }
    }

    logger.info('BookmarkManager', `Found ${emptyFolders.length} empty folders`);
    return emptyFolders;
  }

  /**
   * Get all descendant folder IDs for a given folder (including the folder itself)
   */
  async getFolderDescendants(folderId: string): Promise<string[]> {
    logger.trace('BookmarkManager', `getFolderDescendants("${folderId}") called`);
    const descendants: string[] = [folderId];

    try {
      const folder = await chrome.bookmarks.getSubTree(folderId);
      const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const node of nodes) {
          if (!node.url && node.id !== folderId) {
            descendants.push(node.id);
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      };

      if (folder[0]?.children) {
        traverse(folder[0].children);
      }
    } catch (error) {
      logger.warn('BookmarkManager', `Failed to get descendants for folder ${folderId}`, error);
    }

    logger.debug(
      'BookmarkManager',
      `Found ${descendants.length} descendant folders for ${folderId}`
    );
    return descendants;
  }

  /**
   * Get bookmarks that are in any of the specified folders (including subfolders)
   */
  async getBookmarksInFolders(folderIds: string[]): Promise<Bookmark[]> {
    logger.trace(
      'BookmarkManager',
      `getBookmarksInFolders called with ${folderIds.length} folders`
    );

    // Get all descendant folders for each specified folder
    const allFolderIds = new Set<string>();
    for (const folderId of folderIds) {
      const descendants = await this.getFolderDescendants(folderId);
      descendants.forEach((id) => allFolderIds.add(id));
    }

    logger.debug(
      'BookmarkManager',
      `Total folders to check (including descendants): ${allFolderIds.size}`
    );

    // Get all bookmarks and filter to those in our folder set
    const allBookmarks = await this.getAllBookmarks();
    const filtered = allBookmarks.filter((b) => b.parentId && allFolderIds.has(b.parentId));

    logger.info('BookmarkManager', `Found ${filtered.length} bookmarks in specified folders`);
    return filtered;
  }

  /**
   * Get bookmark tree structure with metadata for folder selector UI
   */
  async getBookmarkTreeWithCounts(): Promise<BookmarkTreeNode[]> {
    logger.trace('BookmarkManager', 'getBookmarkTreeWithCounts() called');
    const tree = await chrome.bookmarks.getTree();
    const allBookmarks = await this.getAllBookmarks();

    // Count bookmarks per folder
    const bookmarkCounts = new Map<string, number>();
    for (const bookmark of allBookmarks) {
      if (bookmark.parentId) {
        bookmarkCounts.set(bookmark.parentId, (bookmarkCounts.get(bookmark.parentId) || 0) + 1);
      }
    }

    // Convert Chrome tree to our format with counts
    const convert = (nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkTreeNode[] => {
      return nodes
        .filter((node) => !node.url) // Only folders
        .map((node) => {
          const directCount = bookmarkCounts.get(node.id) || 0;
          let totalCount = directCount;

          // Recursively convert children
          const children = node.children ? convert(node.children) : [];

          // Add up total count from children
          for (const child of children) {
            totalCount += child.totalBookmarks;
          }

          return {
            id: node.id,
            title: node.title,
            parentId: node.parentId,
            directBookmarks: directCount,
            totalBookmarks: totalCount,
            children,
          };
        });
    };

    const result = convert(tree);
    logger.info('BookmarkManager', 'Generated bookmark tree with counts');
    return result;
  }

  /**
   * Remove empty folders (excluding system folders)
   * Returns details about folders removed
   */
  async removeEmptyFolders(
    renamedSpeedDialIds: string[] = [],
    allowRemoveSavedTabs: boolean = false
  ): Promise<{ removed: number; details: Array<{ name: string; id: string }> }> {
    logger.info('BookmarkManager', 'removeEmptyFolders() called', {
      renamedSpeedDialIdsCount: renamedSpeedDialIds.length,
      allowRemoveSavedTabs,
    });

    // Multiple passes to handle nested empty folders
    const details: Array<{ name: string; id: string }> = [];
    let totalRemoved = 0;
    let passNumber = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      logger.debug('BookmarkManager', `Empty folder removal pass ${passNumber}`);
      const emptyFolders = await this.findEmptyFolders(allowRemoveSavedTabs);

      if (emptyFolders.length === 0) {
        logger.info('BookmarkManager', 'No more empty folders found');
        break;
      }

      let removedThisPass = 0;
      for (const folder of emptyFolders) {
        logger.info(
          'BookmarkManager',
          `Attempting to remove empty folder: ${folder.title} (${folder.id}, parentId: ${folder.parentId})`
        );

        // Double-check protection before attempting removal
        if (
          this.isProtectedFolder(folder, allowRemoveSavedTabs) ||
          renamedSpeedDialIds.includes(folder.id)
        ) {
          if (renamedSpeedDialIds.includes(folder.id)) {
            logger.warn(
              'BookmarkManager',
              `Skipping renamed Speed Dial folder: ${folder.title} (${folder.id})`
            );
          } else {
            logger.warn(
              'BookmarkManager',
              `Skipping protected folder that passed initial filter: ${folder.title} (${folder.id})`
            );
          }
          continue;
        }

        try {
          // Check if Vivaldi Speed Dial API exists and try to remove from Speed Dial first
          // @ts-expect-error - Vivaldi-specific API not in Chrome types
          if (typeof chrome.speedDial !== 'undefined' && chrome.speedDial) {
            try {
              logger.info(
                'BookmarkManager',
                `Vivaldi detected - checking if ${folder.title} is in Speed Dial...`
              );
              // @ts-expect-error - Vivaldi-specific API not in Chrome types
              const speedDialFolders = await chrome.speedDial.getFolders();
              const speedDialFolder = speedDialFolders?.find((f: any) => f.id === folder.id);

              if (speedDialFolder) {
                logger.info(
                  'BookmarkManager',
                  `Removing folder from Speed Dial: ${folder.title} (${folder.id})`
                );
                // @ts-expect-error - Vivaldi-specific API not in Chrome types
                await chrome.speedDial.removeFolder(folder.id);
                logger.info(
                  'BookmarkManager',
                  `Successfully removed from Speed Dial: ${folder.title}`
                );
              }
            } catch (speedDialError: any) {
              logger.debug(
                'BookmarkManager',
                `Speed Dial check/removal failed (folder may not be in Speed Dial): ${speedDialError?.message || speedDialError}`
              );
            }
          }

          // Now try normal bookmark remove
          await chrome.bookmarks.remove(folder.id);
          removedThisPass++;
          totalRemoved++;
          details.push({
            name: folder.title,
            id: folder.id,
          });
          logger.debug('BookmarkManager', `Removed empty folder: ${folder.title} (${folder.id})`);
        } catch (error: any) {
          // Log more detail about what failed
          const errorMsg = error?.message || String(error);
          logger.warn(
            'BookmarkManager',
            `Failed to remove folder "${folder.title}" (${folder.id}): ${errorMsg}`
          );

          // Try removeTree as fallback
          try {
            logger.info(
              'BookmarkManager',
              `Attempting removeTree for "${folder.title}" (${folder.id})`
            );
            await chrome.bookmarks.removeTree(folder.id);
            removedThisPass++;
            totalRemoved++;
            details.push({
              name: folder.title,
              id: folder.id,
            });
            logger.info(
              'BookmarkManager',
              `Successfully removed with removeTree: ${folder.title} (${folder.id})`
            );
          } catch (removeTreeError: any) {
            const removeTreeMsg = removeTreeError?.message || String(removeTreeError);
            logger.error(
              'BookmarkManager',
              `removeTree also failed for "${folder.title}" (${folder.id}): ${removeTreeMsg}`
            );

            // If it's a Chrome error about modifying root, mark as protected
            if (
              errorMsg.includes("Can't modify") ||
              errorMsg.includes('root') ||
              errorMsg.includes('system')
            ) {
              logger.info(
                'BookmarkManager',
                `Folder "${folder.title}" appears to be system-protected, will skip in future`
              );
            }
          }
        }
      }

      logger.info('BookmarkManager', `Pass ${passNumber}: removed ${removedThisPass} folders`);

      // Safety check: stop if we're not making progress
      if (removedThisPass === 0) {
        break;
      }

      passNumber++;

      // Safety limit: max 10 passes
      if (passNumber > 10) {
        logger.warn('BookmarkManager', 'Reached maximum cleanup passes (10), stopping');
        break;
      }
    }

    // Deduplicate folder names in details (when importing, many duplicate empty folders exist)
    // Keep the count accurate but don't show "Shopping" 10 times
    const uniqueDetails = Array.from(new Map(details.map((d) => [d.name, d])).values());

    logger.info(
      'BookmarkManager',
      `Total removed: ${totalRemoved} empty folders (${uniqueDetails.length} unique names) in ${passNumber - 1} passes`
    );
    return { removed: totalRemoved, details: uniqueDetails };
  }
}
