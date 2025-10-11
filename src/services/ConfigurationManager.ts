/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Simple configuration manager for API keys and settings
 */

export interface OrganizationHistoryEntry {
  moved: boolean;
  timestamp: number;
  category?: string;
}

export interface OrganizationHistory {
  [bookmarkId: string]: OrganizationHistoryEntry;
}

export interface APIConfig {
  provider: 'openai' | 'claude' | 'grok' | 'openrouter' | 'custom';
  apiKey: string;
  model?: string;
  customEndpoint?: string;     // For custom OpenAI-compatible endpoints
  customModelName?: string;    // Custom model name to use
}

export interface PerformanceConfig {
  apiTimeout: number;         // seconds
  batchSize: number;          // number of bookmarks per batch
  maxTokens: number;          // maximum tokens for LLM response
}

export interface OrganizationConfig {
  removeDuplicates: boolean;
  removeEmptyFolders: boolean;
  ignoreFolders: string[];    // folder names to ignore
  excludedSystemFolderIds: string[];  // system folder IDs to exclude from organization
  categories: string[];       // predefined bookmark categories
  renamedSpeedDialFolderIds: string[];  // IDs of Speed Dial folders that were renamed (can't be deleted)
  organizeSavedTabs: boolean; // whether to organize "Saved Tabs" folders (disabled by default)
  autoOrganize: boolean;      // automatically organize bookmarks as they're added (disabled by default)
  respectOrganizationHistory: 'always' | 'never' | 'organizeAllOnly'; // when to skip previously organized bookmarks
  useExistingFolders: boolean; // when true, only use existing folders and allow bookmarks to stay in current location
}

export interface DebugConfig {
  logLevel: number;           // 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE
  consoleLogging: boolean;
}

export interface AppConfig {
  api: APIConfig;
  performance: PerformanceConfig;
  organization: OrganizationConfig;
  debug: DebugConfig;
  ignorePatterns: string[];   // deprecated, use organization.ignoreFolders
}

export const DEFAULT_CATEGORIES = [
  'Shopping & E-commerce',
  'Travel & Transportation',
  'News & Media',
  'Social Networks',
  'Entertainment & Streaming',
  'Finance & Banking',
  'Technology & Software',
  'Development & Programming',
  'Design & Creative',
  'Productivity & Tools',
  'Communication & Email',
  'Education & Learning',
  'Health & Wellness',
  'Food & Dining',
  'Real Estate & Housing',
  'Jobs & Career',
  'Business & Marketing',
  'Sports & Recreation',
  'Music & Audio',
  'Photography & Video',
  'Gaming',
  'Science & Research',
  'Government & Legal',
  'Home & Lifestyle',
  'Automotive'
];

// Default model names by provider
export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-haiku-20240307',
  grok: 'grok-beta',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free'
} as const;

// Default performance settings
export const DEFAULT_PERFORMANCE = {
  apiTimeout: 180,
  batchSize: 50,
  maxTokens: 4096
} as const;

// System folder IDs (browser-specific, immutable)
export const SYSTEM_FOLDER_IDS = ['0', '1', '2', '3', '4'];

// Protected folder names that should never be removed (case-insensitive)
export const PROTECTED_FOLDER_NAMES = [
  'bookmarks bar',
  'other bookmarks',
  'mobile bookmarks',
  'trash',
  'speed dial',
  'home',
  'bookmarks menu',
  'toolbar',
  'unsorted bookmarks',
  'shopping',  // Vivaldi Speed Dial folder - can't be deleted
  'travel'     // Vivaldi Speed Dial folder - can't be deleted
];

// Vivaldi Speed Dial folders that get renamed to match categories
export const SPEED_DIAL_RENAMES: Record<string, string> = {
  'Home': 'Home & Lifestyle',
  'Shopping': 'Shopping & E-commerce',
  'Travel': 'Travel & Transportation'
};

// Protected renamed Speed Dial folder names (case-insensitive)
export const SPEED_DIAL_RENAMED_FOLDERS = [
  'home & lifestyle',
  'shopping & e-commerce',
  'travel & transportation'
];

const DEFAULT_CONFIG: AppConfig = {
  api: {
    provider: 'openrouter',
    apiKey: '',
    model: undefined
  },
  performance: DEFAULT_PERFORMANCE,
  organization: {
    removeDuplicates: true,
    removeEmptyFolders: true,
    ignoreFolders: [],
    excludedSystemFolderIds: ['3'],  // Default: exclude Mobile Bookmarks only (Trash handled dynamically)
    categories: DEFAULT_CATEGORIES,
    renamedSpeedDialFolderIds: [],  // Populated during first organization when Speed Dial folders are renamed
    organizeSavedTabs: false,  // Default: exclude "Saved Tabs" folders from organization
    autoOrganize: false,  // Default: don't automatically organize bookmarks as they're added
    respectOrganizationHistory: 'always',  // Default: always skip previously organized bookmarks
    useExistingFolders: false  // Default: allow creating new folders
  },
  debug: {
    logLevel: 0,              // ERROR by default
    consoleLogging: true
  },
  ignorePatterns: []
};

export class ConfigurationManager {
  private static readonly STORAGE_KEY = 'app_config';

  async getConfig(): Promise<AppConfig> {
    const result = await chrome.storage.sync.get(ConfigurationManager.STORAGE_KEY);
    const stored = result[ConfigurationManager.STORAGE_KEY];

    // Merge with defaults for backward compatibility
    if (!stored) return DEFAULT_CONFIG;

    return {
      api: { ...DEFAULT_CONFIG.api, ...stored.api },
      performance: { ...DEFAULT_CONFIG.performance, ...stored.performance },
      organization: { ...DEFAULT_CONFIG.organization, ...stored.organization },
      debug: { ...DEFAULT_CONFIG.debug, ...stored.debug },
      ignorePatterns: stored.ignorePatterns || []
    };
  }

  async saveConfig(config: AppConfig): Promise<void> {
    await chrome.storage.sync.set({
      [ConfigurationManager.STORAGE_KEY]: config
    });
  }

  async updateAPIConfig(apiConfig: Partial<APIConfig>): Promise<void> {
    const config = await this.getConfig();
    config.api = { ...config.api, ...apiConfig };
    await this.saveConfig(config);
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config.api.apiKey && config.api.apiKey.length > 0;
  }

  // Organization History Management
  private static readonly HISTORY_STORAGE_KEY = 'organizationHistory';

  async getOrganizationHistory(): Promise<OrganizationHistory> {
    const result = await chrome.storage.local.get(ConfigurationManager.HISTORY_STORAGE_KEY);
    return result[ConfigurationManager.HISTORY_STORAGE_KEY] || {};
  }

  async markBookmarkAsOrganized(bookmarkId: string, category?: string): Promise<void> {
    const history = await this.getOrganizationHistory();
    history[bookmarkId] = {
      moved: true,
      timestamp: Date.now(),
      category
    };
    await chrome.storage.local.set({ [ConfigurationManager.HISTORY_STORAGE_KEY]: history });
  }

  async isBookmarkOrganized(bookmarkId: string): Promise<boolean> {
    const history = await this.getOrganizationHistory();
    return history[bookmarkId]?.moved === true;
  }

  async clearOrganizationHistory(): Promise<void> {
    await chrome.storage.local.remove(ConfigurationManager.HISTORY_STORAGE_KEY);
  }

  async markAllBookmarksAsOrganized(): Promise<number> {
    // Get all bookmarks recursively
    const getAllBookmarks = async (nodes: chrome.bookmarks.BookmarkTreeNode[]): Promise<string[]> => {
      const bookmarkIds: string[] = [];
      for (const node of nodes) {
        if (node.url) {
          // It's a bookmark, not a folder
          bookmarkIds.push(node.id);
        }
        if (node.children) {
          // Recursively get children
          const childIds = await getAllBookmarks(node.children);
          bookmarkIds.push(...childIds);
        }
      }
      return bookmarkIds;
    };

    // Get entire bookmark tree
    const tree = await chrome.bookmarks.getTree();
    const allBookmarkIds = await getAllBookmarks(tree);

    // Mark all as organized
    const history = await this.getOrganizationHistory();
    const timestamp = Date.now();
    for (const bookmarkId of allBookmarkIds) {
      history[bookmarkId] = {
        moved: true,
        timestamp,
        category: undefined  // No category since this is a manual marking
      };
    }
    await chrome.storage.local.set({ [ConfigurationManager.HISTORY_STORAGE_KEY]: history });

    return allBookmarkIds.length;
  }
}
