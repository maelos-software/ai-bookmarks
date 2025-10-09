/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Simple bookmark reorganization service
 *
 * Pipeline:
 * 1. Collect bookmarks to organize
 * 2. Ask LLM for organization plan
 * 3. Execute: create folders, move bookmarks
 */

import { logger } from './Logger.js';
import { BookmarkManager } from './BookmarkManager.js';
import { LLMService, OrganizationPlan } from './LLMService.js';
import { DEFAULT_PERFORMANCE, SPEED_DIAL_RENAMES } from './ConfigurationManager.js';
import type { ConfigurationManager } from './ConfigurationManager.js';

export interface BookmarkMove {
  bookmarkId: string;
  title: string;
  url: string;
  fromFolder: string;
  toFolder: string;
}

export interface DuplicateRemoved {
  title: string;
  url: string;
  bookmarkId: string;
}

export interface FolderCreated {
  name: string;
  id: string;
}

export interface EmptyFolderRemoved {
  name: string;
  id: string;
}

export interface OrganizationResult {
  success: boolean;
  bookmarksMoved: number;
  foldersCreated: number;
  duplicatesRemoved: number;
  emptyFoldersRemoved: number;
  bookmarksSkipped: number;  // bookmarks skipped due to organization history
  errors: string[];
  // Detailed tracking
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

export interface OrganizationPreview {
  totalBookmarks: number;
  bookmarksToMove: number;
  foldersToCreate: string[];
  estimatedTime: number;
}

export class ReorganizationService {
  private bookmarkManager: BookmarkManager;
  private llmService: LLMService;
  private batchSize: number;
  private categories: string[];
  private configManager: ConfigurationManager;

  constructor(bookmarkManager: BookmarkManager, llmService: LLMService, configManager: ConfigurationManager, batchSize: number = DEFAULT_PERFORMANCE.batchSize, categories: string[] = []) {
    this.bookmarkManager = bookmarkManager;
    this.llmService = llmService;
    this.configManager = configManager;
    this.batchSize = batchSize;
    this.categories = categories;
    logger.info('ReorganizationService', 'Service initialized', { batchSize, categoriesCount: categories.length });
  }

  /**
   * Generate preview of what will happen
   */
  async generatePreview(ignoreFolderIds: string[] = ['2', '3', '4']): Promise<OrganizationPreview> {
    logger.info('ReorganizationService', 'generatePreview called', { ignoreFolderIds });

    try {
      const { bookmarks } = await this.getBookmarksToOrganize(ignoreFolderIds);
      logger.info('ReorganizationService', `Found ${bookmarks.length} bookmarks to organize`);

      const existingFolders = await this.bookmarkManager.getAllFolders();
      const existingFolderNames = existingFolders
        .filter(f => !['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks'].includes(f.title))
        .map(f => f.title);

      logger.debug('ReorganizationService', `${existingFolderNames.length} existing folders (excluding system folders)`);

      // Use configured categories
      logger.info('ReorganizationService', `Using ${this.categories.length} configured categories`);

      // Filter out folders that already exist
      const foldersToCreate = this.categories.filter(f => !existingFolderNames.includes(f));

      const preview = {
        totalBookmarks: bookmarks.length,
        bookmarksToMove: bookmarks.length,
        foldersToCreate,
        estimatedTime: Math.ceil(bookmarks.length / 20) // Faster with two-phase approach
      };

      logger.info('ReorganizationService', 'Preview generated', preview);
      return preview;
    } catch (error) {
      logger.error('ReorganizationService', 'generatePreview failed', error);
      throw error;
    }
  }

  /**
   * Execute full reorganization
   */
  async executeReorganization(
    ignoreFolderIds: string[] = ['2', '3', '4'],
    progressCallback?: (current: number, total: number, message: string) => void
  ): Promise<OrganizationResult> {
    logger.info('ReorganizationService', 'executeReorganization called', { ignoreFolderIds });

    const errors: string[] = [];
    let bookmarksMoved = 0;
    let duplicatesRemoved = 0;
    let emptyFoldersRemoved = 0;
    let bookmarksSkipped = 0;
    const createdFolders = new Set<string>();

    // Detailed tracking arrays
    const moves: BookmarkMove[] = [];
    const duplicates: DuplicateRemoved[] = [];
    const folders: FolderCreated[] = [];
    const emptyFolders: EmptyFolderRemoved[] = [];

    try {
      // Step 0: Remove duplicate bookmarks
      logger.info('ReorganizationService', 'Step 0: Removing duplicate bookmarks');
      progressCallback?.(0, 100, 'Removing duplicate bookmarks...');
      try {
        const duplicateDetails = await this.bookmarkManager.removeDuplicates();
        duplicatesRemoved = duplicateDetails.removed;
        duplicates.push(...duplicateDetails.details);
        logger.info('ReorganizationService', `Removed ${duplicatesRemoved} duplicate bookmarks`);
      } catch (error) {
        const errorMsg = `Failed to remove duplicates: ${error}`;
        errors.push(errorMsg);
        logger.error('ReorganizationService', errorMsg, error);
      }

      // Step 1: Get bookmarks to organize
      logger.info('ReorganizationService', 'Step 1: Getting bookmarks to organize');
      progressCallback?.(0, 100, 'Scanning bookmarks...');
      const { bookmarks, skipped } = await this.getBookmarksToOrganize(ignoreFolderIds);
      bookmarksSkipped = skipped;
      logger.info('ReorganizationService', `Found ${bookmarks.length} bookmarks to organize (skipped ${bookmarksSkipped})`);

      if (bookmarks.length === 0) {
        logger.info('ReorganizationService', 'No bookmarks need organizing');
        return {
          success: true,
          bookmarksMoved: 0,
          foldersCreated: 0,
          duplicatesRemoved,
          emptyFoldersRemoved: 0,
          bookmarksSkipped,
          errors: [],
          moves: [],
          duplicates,
          folders: [],
          emptyFolders: []
        };
      }

      progressCallback?.(0, bookmarks.length, `Found ${bookmarks.length} bookmarks to organize`);

      // Step 2: Get existing folders (only root-level to guide LLM)
      logger.info('ReorganizationService', 'Step 2: Getting existing folders');
      const existingFolders = await this.bookmarkManager.getAllFolders();
      const existingFolderNames = existingFolders
        .filter(f =>
          !['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks'].includes(f.title) &&
          f.parentId === '1'  // Only include folders at root (Bookmarks Bar)
        )
        .map(f => f.title);

      logger.info('ReorganizationService', `Found ${existingFolderNames.length} root-level folders`);
      logger.trace('ReorganizationService', 'Root folder names', existingFolderNames);

      // Step 2.5: Rename Speed Dial folders to match approved categories
      // Vivaldi Speed Dial creates "Home", "Shopping", and "Travel" that can't be deleted
      logger.info('ReorganizationService', 'Step 2.5: Renaming Speed Dial folders to match categories');

      const renamedSpeedDialIds: string[] = [];
      for (const [oldName, newName] of Object.entries(SPEED_DIAL_RENAMES)) {
        const speedDialFolder = existingFolders.find(f => f.title === oldName && f.parentId === '1');
        if (speedDialFolder && this.categories.includes(newName)) {
          try {
            logger.info('ReorganizationService', `Renaming Speed Dial folder "${oldName}" → "${newName}" (${speedDialFolder.id})`);
            await this.bookmarkManager.renameFolder(speedDialFolder.id, newName);
            renamedSpeedDialIds.push(speedDialFolder.id);
            // Update existingFolderNames to reflect the rename
            const idx = existingFolderNames.indexOf(oldName);
            if (idx !== -1) {
              existingFolderNames[idx] = newName;
            }
            logger.info('ReorganizationService', `Successfully renamed "${oldName}" to "${newName}"`);
          } catch (error) {
            logger.warn('ReorganizationService', `Failed to rename "${oldName}": ${error}`);
          }
        }
      }

      // Save renamed Speed Dial folder IDs to config for future protection
      if (renamedSpeedDialIds.length > 0) {
        try {
          const config = await this.configManager.getConfig();
          config.organization.renamedSpeedDialFolderIds = renamedSpeedDialIds;
          await this.configManager.saveConfig(config);
          logger.info('ReorganizationService', `Saved ${renamedSpeedDialIds.length} renamed Speed Dial folder IDs to config:`, renamedSpeedDialIds);
        } catch (error) {
          logger.warn('ReorganizationService', `Failed to save renamed Speed Dial IDs: ${error}`);
        }
      }

      // Step 3: TWO-PHASE APPROACH
      // Use configured categories (no discovery phase needed)
      logger.info('ReorganizationService', 'Step 3: Using configured categories');
      progressCallback?.(0, bookmarks.length, 'Using configured categories...');

      const approvedFolders = this.categories;
      logger.info('ReorganizationService', `Using ${approvedFolders.length} configured categories:`, approvedFolders);

      // Assign bookmarks to approved folders in batches
      logger.info('ReorganizationService', 'Step 4: PHASE 2 - Assigning bookmarks to approved folders');
      const allPlans: OrganizationPlan[] = [];
      const totalBatches = Math.ceil(bookmarks.length / this.batchSize);

      // Track how many bookmarks have been assigned to each folder so far
      const folderSizes = new Map<string, number>();

      for (let i = 0; i < bookmarks.length; i += this.batchSize) {
        const batch = bookmarks.slice(i, i + this.batchSize);
        const batchNum = Math.floor(i/this.batchSize) + 1;

        logger.info('ReorganizationService', `Assigning batch ${batchNum}/${totalBatches}, ${batch.length} bookmarks`);
        progressCallback?.(i, bookmarks.length, `Assigning batch ${batchNum}/${totalBatches}`);

        try {
          // Assign bookmarks to approved folders only (no new folder creation)
          const plan = await this.llmService.assignToFolders(batch, approvedFolders);
          allPlans.push(plan);

          // Update folder sizes based on this batch's assignments
          plan.suggestions.forEach(suggestion => {
            const count = folderSizes.get(suggestion.folderName) || 0;
            folderSizes.set(suggestion.folderName, count + 1);
          });

          logger.debug('ReorganizationService', `Batch ${batchNum} completed successfully`);
          logger.debug('ReorganizationService', `Current folder distribution:`, Object.fromEntries(folderSizes));

          // Rate limiting is now handled automatically by LLMService retry logic
        } catch (error) {
          const errorMsg = `Batch ${batchNum} failed: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logger.error('ReorganizationService', errorMsg, error);

          // Stop processing on API error - don't continue with remaining batches
          logger.warn('ReorganizationService', `Stopping after batch ${batchNum} due to API error. ${allPlans.length} of ${totalBatches} batches completed.`);

          // Add user-friendly error to results
          const userError = `⚠️ Processing stopped at batch ${batchNum} of ${totalBatches}. ${error instanceof Error ? error.message : String(error)}`;
          errors.push(userError);

          break; // Exit the batch processing loop
        }
      }

      logger.info('ReorganizationService', `Completed ${allPlans.length}/${totalBatches} batches successfully`);

      // If we didn't complete all batches, abort - don't process partial results
      if (allPlans.length < totalBatches) {
        logger.error('ReorganizationService', 'Aborting reorganization due to incomplete batch processing');
        return {
          success: false,
          bookmarksMoved: 0,
          foldersCreated: 0,
          duplicatesRemoved,
          emptyFoldersRemoved: 0,
          bookmarksSkipped,
          errors,
          moves: [],
          duplicates,
          folders: [],
          emptyFolders: []
        };
      }

      // Aggregate token usage across all batches
      const totalTokens = {
        prompt: allPlans.reduce((sum, plan) => sum + (plan.tokenUsage?.prompt || 0), 0),
        completion: allPlans.reduce((sum, plan) => sum + (plan.tokenUsage?.completion || 0), 0),
        total: allPlans.reduce((sum, plan) => sum + (plan.tokenUsage?.total || 0), 0)
      };
      logger.info('ReorganizationService', `Total tokens used: ${totalTokens.total} (prompt: ${totalTokens.prompt}, completion: ${totalTokens.completion})`);

      // Step 5: Collect folders that actually have bookmarks assigned (don't create empty folders)
      logger.info('ReorganizationService', 'Step 5: Collecting folders that need to be created');

      // Get unique folder names that bookmarks were actually assigned to
      const foldersWithBookmarks = new Set<string>();
      allPlans.forEach(plan => {
        plan.suggestions.forEach(s => foldersWithBookmarks.add(s.folderName));
      });

      // Only create folders that have bookmarks AND don't exist yet
      const foldersToCreate = Array.from(foldersWithBookmarks).filter(f => !existingFolderNames.includes(f));

      logger.info('ReorganizationService', `Need to create ${foldersToCreate.length} folders (only folders with bookmarks):`, foldersToCreate);
      logger.debug('ReorganizationService', `Folders in assignment but not being created: ${approvedFolders.filter(f => !foldersWithBookmarks.has(f)).join(', ') || 'none'}`);

      // Step 6: Create all approved folders that don't exist yet
      logger.info('ReorganizationService', 'Step 6: Creating folders');
      const folderIdMap = new Map<string, string>();
      const createdFolders = new Set<string>();

      for (const folderName of foldersToCreate) {
        try {
          logger.debug('ReorganizationService', `Creating folder "${folderName}"`);

          // Always create at root level (parentId = '1' is Bookmarks Bar)
          const folderId = await this.bookmarkManager.ensureFolder(folderName, '1');
          folderIdMap.set(folderName, folderId);
          createdFolders.add(folderName);
          folders.push({ name: folderName, id: folderId });
          logger.debug('ReorganizationService', `Folder "${folderName}" ready with ID ${folderId}`);
        } catch (error) {
          const errorMsg = `Failed to create folder "${folderName}": ${error}`;
          errors.push(errorMsg);
          logger.error('ReorganizationService', errorMsg, error);
        }
      }

      logger.info('ReorganizationService', `Created/ensured ${createdFolders.size} folders`);

      // Step 7: Move all bookmarks
      logger.info('ReorganizationService', 'Step 7: Moving bookmarks to folders');
      let movedCount = 0;

      // Build bookmark lookup map
      const bookmarkMap = new Map<string, { id: string; title: string; url: string; parentId?: string }>();
      for (const bookmark of bookmarks) {
        bookmarkMap.set(bookmark.id, bookmark);
      }

      // Get all folders for resolving parent folder names
      const allFolders = await this.bookmarkManager.getAllFolders();
      const folderNamesMap = new Map<string, string>();
      for (const folder of allFolders) {
        folderNamesMap.set(folder.id, folder.title);
      }

      for (const plan of allPlans) {
        for (const suggestion of plan.suggestions) {
          try {
            const bookmark = bookmarkMap.get(suggestion.bookmarkId);
            if (!bookmark) continue;

            const fromFolderName = bookmark.parentId ? folderNamesMap.get(bookmark.parentId) || 'Unknown' : 'Root';

            // Resolve folder name to ID
            let folderId = folderIdMap.get(suggestion.folderName) ||
                           await this.bookmarkManager.findFolderByName(suggestion.folderName) ||
                           await this.bookmarkManager.ensureFolder(suggestion.folderName);

            logger.trace('ReorganizationService', `Moving bookmark ${suggestion.bookmarkId} to folder "${suggestion.folderName}" (${folderId})`);
            await this.bookmarkManager.moveBookmark(suggestion.bookmarkId, folderId);

            // Record in organization history
            await this.configManager.markBookmarkAsOrganized(suggestion.bookmarkId, suggestion.folderName);

            moves.push({
              bookmarkId: bookmark.id,
              title: bookmark.title,
              url: bookmark.url,
              fromFolder: fromFolderName,
              toFolder: suggestion.folderName
            });

            bookmarksMoved++;
            movedCount++;

            if (movedCount % 10 === 0) {
              progressCallback?.(movedCount, bookmarks.length, `Moved ${movedCount}/${bookmarks.length} bookmarks`);
              logger.debug('ReorganizationService', `Progress: ${movedCount}/${bookmarks.length} bookmarks moved`);
            }
          } catch (error) {
            const errorMsg = `Failed to move bookmark ${suggestion.bookmarkId}: ${error}`;
            errors.push(errorMsg);
            logger.error('ReorganizationService', errorMsg, error);
          }
        }
      }

      logger.info('ReorganizationService', `Successfully moved ${bookmarksMoved} bookmarks`);

      // Step 7: Remove empty folders
      logger.info('ReorganizationService', 'Step 7: Removing empty folders');
      progressCallback?.(bookmarks.length, bookmarks.length, 'Cleaning up empty folders...');
      try {
        const config = await this.configManager.getConfig();
        const renamedSpeedDialIds = config.organization.renamedSpeedDialFolderIds || [];
        const allowRemoveSavedTabs = config.organization.organizeSavedTabs === true;
        const emptyFolderDetails = await this.bookmarkManager.removeEmptyFolders(renamedSpeedDialIds, allowRemoveSavedTabs);
        emptyFoldersRemoved = emptyFolderDetails.removed;
        emptyFolders.push(...emptyFolderDetails.details);
        logger.info('ReorganizationService', `Removed ${emptyFoldersRemoved} empty folders`);
      } catch (error) {
        const errorMsg = `Failed to remove empty folders: ${error}`;
        errors.push(errorMsg);
        logger.error('ReorganizationService', errorMsg, error);
      }

      progressCallback?.(bookmarks.length, bookmarks.length, 'Organization complete!');

      const result = {
        success: true,
        bookmarksMoved,
        foldersCreated: createdFolders.size,
        duplicatesRemoved,
        emptyFoldersRemoved,
        bookmarksSkipped,
        errors,
        moves,
        duplicates,
        folders,
        emptyFolders,
        tokenUsage: totalTokens.total > 0 ? totalTokens : undefined
      };

      logger.info('ReorganizationService', 'executeReorganization completed', result);
      return result;

    } catch (error) {
      logger.error('ReorganizationService', 'executeReorganization failed catastrophically', error);
      errors.push(`Fatal error: ${error}`);
      return {
        success: false,
        bookmarksMoved,
        bookmarksSkipped,
        foldersCreated: createdFolders.size,
        duplicatesRemoved,
        emptyFoldersRemoved,
        errors,
        moves,
        duplicates,
        folders,
        emptyFolders
      };
    }
  }

  /**
   * Get bookmarks that need organizing (not in ignored folders)
   */
  private async getBookmarksToOrganize(ignoreFolderIds: string[]): Promise<{ bookmarks: Array<{ id: string; title: string; url: string }>; skipped: number }> {
    logger.trace('ReorganizationService', 'getBookmarksToOrganize called', { ignoreFolderIds });

    // Build complete list of folder IDs to ignore (including all descendants)
    const allFolders = await this.bookmarkManager.getAllFolders();
    const allIgnoredFolderIds = new Set(ignoreFolderIds);

    // Recursively find all descendants of ignored folders
    const addDescendants = (parentId: string) => {
      const children = allFolders.filter(f => f.parentId === parentId);
      for (const child of children) {
        if (!allIgnoredFolderIds.has(child.id)) {
          allIgnoredFolderIds.add(child.id);
          addDescendants(child.id); // Recursively add descendants
        }
      }
    };

    for (const folderId of ignoreFolderIds) {
      addDescendants(folderId);
    }

    logger.debug('ReorganizationService', `Expanded ${ignoreFolderIds.length} ignored folders to ${allIgnoredFolderIds.size} total (including descendants)`);

    const allBookmarks = await this.bookmarkManager.getAllBookmarks();
    logger.debug('ReorganizationService', `Total bookmarks in browser: ${allBookmarks.length}`);

    let filtered = allBookmarks.filter(b =>
      b.url && b.parentId && !allIgnoredFolderIds.has(b.parentId)
    ) as Array<{ id: string; title: string; url: string }>;

    let skippedCount = 0;

    // Check if we should respect organization history
    const config = await this.configManager.getConfig();
    if (config.organization.respectOrganizationHistory) {
      const beforeHistoryFilter = filtered.length;
      const organizationHistory = await this.configManager.getOrganizationHistory();
      filtered = filtered.filter(b => !organizationHistory[b.id]?.moved);
      skippedCount = beforeHistoryFilter - filtered.length;
      if (skippedCount > 0) {
        logger.info('ReorganizationService', `Skipped ${skippedCount} previously organized bookmarks (respectOrganizationHistory enabled)`);
      }
    }

    logger.info('ReorganizationService', `Filtered to ${filtered.length} bookmarks (ignored ${allBookmarks.length - filtered.length})`);
    return { bookmarks: filtered, skipped: skippedCount };
  }
}
