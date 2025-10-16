/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Simple LLM service for bookmark organization
 */

import { logger } from './Logger.js';
import { DEFAULT_MODELS, DEFAULT_PERFORMANCE } from './ConfigurationManager.js';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
}

export interface OrganizationPlan {
  suggestions: Array<{
    bookmarkId: string;
    folderName: string;
    confidence?: number;
    reasoning?: string;
  }>;
  foldersToCreate: string[];
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
    other?: number; // For reasoning/thoughts tokens (Gemini) or other provider-specific tokens
  };
}

export class LLMService {
  private apiKey: string;
  private provider: 'openai' | 'claude' | 'grok' | 'openrouter' | 'gemini' | 'custom';
  private model: string;
  private timeout: number; // milliseconds
  private maxTokens: number;
  private customEndpoint?: string;
  private customModelName?: string;
  private retryAttempts: number;
  private retryDelay: number; // milliseconds

  constructor(
    apiKey: string,
    provider: 'openai' | 'claude' | 'grok' | 'openrouter' | 'gemini' | 'custom' = 'openai',
    model?: string,
    timeoutSeconds?: number,
    maxTokens?: number,
    customEndpoint?: string,
    customModelName?: string,
    retryAttempts?: number,
    retryDelaySeconds?: number
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.customEndpoint = customEndpoint;
    this.customModelName = customModelName;

    // For custom provider, use customModelName if provided, otherwise fallback to model parameter
    if (provider === 'custom') {
      this.model = customModelName || model || 'gpt-3.5-turbo';
    } else {
      this.model = model || this.getDefaultModel();
    }

    this.timeout = (timeoutSeconds || DEFAULT_PERFORMANCE.apiTimeout) * 1000; // Convert to milliseconds
    this.maxTokens = maxTokens || DEFAULT_PERFORMANCE.maxTokens;
    this.retryAttempts = retryAttempts ?? DEFAULT_PERFORMANCE.retryAttempts;
    this.retryDelay = (retryDelaySeconds ?? DEFAULT_PERFORMANCE.retryDelay) * 1000; // Convert to milliseconds

    const endpointInfo = this.customEndpoint ? `, endpoint=${this.customEndpoint}` : '';
    logger.info(
      'LLMService',
      `Initialized with provider=${provider}, model=${this.model}, timeout=${this.timeout}ms, maxTokens=${this.maxTokens}${endpointInfo}`
    );
  }

  /**
   * Validate API key format for the given provider
   */
  static validateApiKeyFormat(
    apiKey: string,
    provider: string
  ): { valid: boolean; error?: string } {
    logger.trace('LLMService', `Validating API key format for ${provider}`);

    if (!apiKey || apiKey.trim().length === 0) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    const trimmedKey = apiKey.trim();

    switch (provider) {
      case 'openai':
        if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('sk-proj-')) {
          return {
            valid: false,
            error: 'OpenAI API keys must start with "sk-" or "sk-proj-"',
          };
        }
        if (trimmedKey.length < 20) {
          return {
            valid: false,
            error: 'OpenAI API key appears too short (minimum 20 characters)',
          };
        }
        break;

      case 'claude':
        if (!trimmedKey.startsWith('sk-ant-')) {
          return {
            valid: false,
            error: 'Claude (Anthropic) API keys must start with "sk-ant-"',
          };
        }
        if (trimmedKey.length < 20) {
          return {
            valid: false,
            error: 'Claude API key appears too short (minimum 20 characters)',
          };
        }
        break;

      case 'grok':
        if (!trimmedKey.startsWith('xai-')) {
          return {
            valid: false,
            error: 'Grok (xAI) API keys must start with "xai-"',
          };
        }
        if (trimmedKey.length < 20) {
          return {
            valid: false,
            error: 'Grok API key appears too short (minimum 20 characters)',
          };
        }
        break;

      case 'openrouter':
        if (!trimmedKey.startsWith('sk-or-')) {
          return {
            valid: false,
            error: 'OpenRouter API keys must start with "sk-or-"',
          };
        }
        if (trimmedKey.length < 20) {
          return {
            valid: false,
            error: 'OpenRouter API key appears too short (minimum 20 characters)',
          };
        }
        break;

      case 'gemini':
        // Gemini API keys start with "AI" followed by random characters
        if (!trimmedKey.startsWith('AI')) {
          return {
            valid: false,
            error: 'Gemini API keys must start with "AI"',
          };
        }
        if (trimmedKey.length < 20) {
          return {
            valid: false,
            error: 'Gemini API key appears too short (minimum 20 characters)',
          };
        }
        break;

      default:
        return {
          valid: false,
          error: `Unknown provider: ${provider}`,
        };
    }

    logger.debug('LLMService', `API key format valid for ${provider}`);
    return { valid: true };
  }

  private getDefaultModel(): string {
    return DEFAULT_MODELS[this.provider] || DEFAULT_MODELS.openai;
  }

  private getAPIEndpoint(): string {
    switch (this.provider) {
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'claude':
        return 'https://api.anthropic.com/v1/messages';
      case 'grok':
        return 'https://api.x.ai/v1/chat/completions';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1/chat/completions';
      case 'gemini':
        // Gemini uses a different URL structure with the model and API key in the URL
        return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      case 'custom':
        // For custom endpoints, ensure it ends with the chat completions path
        if (this.customEndpoint) {
          const endpoint = this.customEndpoint.replace(/\/$/, ''); // Remove trailing slash
          // If endpoint doesn't already include the chat completions path, add it
          if (!endpoint.includes('/chat/completions')) {
            return `${endpoint}/chat/completions`;
          }
          return endpoint;
        }
        return 'https://api.openai.com/v1/chat/completions'; // Fallback
      default:
        return 'https://api.openai.com/v1/chat/completions';
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.provider) {
      case 'openai':
      case 'grok':
      case 'openrouter':
      case 'custom':
        // Custom providers typically use OpenAI-compatible Bearer token auth
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        break;
      case 'claude':
        headers['x-api-key'] = this.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'gemini':
        // Gemini uses API key in URL, no auth header needed
        break;
    }

    return headers;
  }

  /**
   * Categorize a single bookmark into one of the provided categories
   */
  async categorizeSingleBookmark(bookmark: Bookmark, categories: string[]): Promise<string> {
    logger.info('LLMService', `categorizeSingleBookmark called for "${bookmark.title}"`, {
      categories: categories.length,
    });

    const prompt = `Categorize this bookmark into ONE category from the list below.

Bookmark to categorize:
- Title: ${bookmark.title}
- URL: ${bookmark.url}

Choose from these categories:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

IMPORTANT: Respond with ONLY the exact category name from the list above. Do not add any explanation or formatting.

Your response (category name only):`;

    logger.debug('LLMService', `Built single bookmark prompt, length=${prompt.length} chars`);

    try {
      const { content } = await this.callLLMWithRetry(prompt);
      let categoryResponse = content.trim();

      // Handle JSON response if LLM returns {"category": "..."} format
      if (categoryResponse.startsWith('{')) {
        try {
          const parsed = JSON.parse(categoryResponse);
          categoryResponse = parsed.category || categoryResponse;
        } catch {
          // Not valid JSON, use as-is
        }
      }

      // Validate the response is one of our categories (case-insensitive match)
      const categoryLower = categoryResponse.toLowerCase();
      const matchedCategory = categories.find((c) => c.toLowerCase() === categoryLower);

      if (!matchedCategory) {
        logger.warn(
          'LLMService',
          `LLM returned invalid category "${categoryResponse}", available: ${categories.join(', ')}`
        );
        logger.warn('LLMService', `Using first category as fallback: "${categories[0]}"`);
        return categories[0];
      }

      logger.info('LLMService', `Categorized "${bookmark.title}" → "${matchedCategory}"`);
      return matchedCategory;
    } catch (error) {
      logger.error('LLMService', 'Failed to categorize bookmark', error);
      throw error;
    }
  }

  /**
   * Organize a batch of bookmarks
   */
  async organizeBookmarks(
    bookmarks: Bookmark[],
    existingFolders: string[] = [],
    batchContext?: {
      current: number;
      total: number;
      totalBookmarks: number;
      folderSizes?: Record<string, number>;
    }
  ): Promise<OrganizationPlan> {
    logger.info(
      'LLMService',
      `organizeBookmarks called with ${bookmarks.length} bookmarks, ${existingFolders.length} existing folders`
    );
    if (batchContext) {
      logger.info(
        'LLMService',
        `Batch ${batchContext.current}/${batchContext.total}, processing ${bookmarks.length} of ${batchContext.totalBookmarks} total bookmarks`
      );
    }
    logger.trace('LLMService', 'Bookmarks', bookmarks);
    logger.trace('LLMService', 'Existing folders', existingFolders);

    const prompt = this.buildPrompt(bookmarks, existingFolders, batchContext);
    logger.debug('LLMService', `Built prompt, length=${prompt.length} chars`);

    // Retry with exponential backoff for rate limit errors (429)
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { content, usage } = await this.callLLMWithRetry(prompt);
        logger.debug('LLMService', 'Got response from LLM', { responseLength: content.length });

        const plan = this.parseResponse(content, bookmarks);
        plan.tokenUsage = usage; // Add token usage to plan
        logger.info(
          'LLMService',
          `Parsed plan: ${plan.suggestions.length} suggestions, ${plan.foldersToCreate.length} new folders, tokens: ${usage.total}`
        );
        logger.trace('LLMService', 'Organization plan', plan);

        return plan;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error (429)
        const isRateLimit =
          (error as { statusCode?: number }).statusCode === 429 ||
          (error instanceof Error && error.message.toLowerCase().includes('rate limit'));

        if (!isRateLimit || attempt === maxRetries) {
          // Not a rate limit error, or we've exhausted retries
          logger.error('LLMService', 'organizeBookmarks failed', error);
          throw lastError;
        }

        // Rate limit hit - calculate backoff and retry
        const backoffSeconds = Math.min(Math.pow(2, attempt) * 5, 60); // 5s, 10s, 20s, 40s, 60s max
        logger.warn(
          'LLMService',
          `Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${backoffSeconds}s...`
        );

        // Try to parse rate limit reset time from error
        const errorWithResponse = lastError as Error & { apiResponse?: string };
        if (errorWithResponse.apiResponse) {
          try {
            const errorData = JSON.parse(errorWithResponse.apiResponse);
            const resetTime = errorData.error?.metadata?.headers?.['X-RateLimit-Reset'];
            if (resetTime) {
              const resetDate = new Date(parseInt(resetTime));
              const waitSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000);
              if (waitSeconds > 0 && waitSeconds < 300) {
                // Only use if reasonable (< 5 min)
                logger.info(
                  'LLMService',
                  `Rate limit resets at ${resetDate.toLocaleTimeString()}, waiting ${waitSeconds}s`
                );
                await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
                continue; // Skip the exponential backoff, we waited for the exact reset time
              }
            }
          } catch (parseError) {
            // Couldn't parse reset time, use exponential backoff
          }
        }

        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('organizeBookmarks failed after retries');
  }

  /**
   * PHASE 1: Discover what folders should be created by analyzing all bookmarks
   * Returns a list of folder names (no assignments yet)
   */
  async discoverFolders(bookmarks: Bookmark[], existingFolders: string[]): Promise<string[]> {
    logger.info('LLMService', `Discovering folders for ${bookmarks.length} bookmarks`);

    // For discovery, we can sample bookmarks to reduce tokens
    // Take up to 100 representative bookmarks spread across the entire set
    const sampleSize = Math.min(100, bookmarks.length);
    const step = Math.floor(bookmarks.length / sampleSize);
    const sample = bookmarks.filter((_, i) => i % step === 0).slice(0, sampleSize);

    logger.debug('LLMService', `Using ${sample.length} bookmark samples for folder discovery`);

    // Build a compact list of bookmarks showing title and domain
    const bookmarkList = sample
      .map((b, i) => {
        const domain = b.url ? new URL(b.url).hostname.replace('www.', '') : '';
        return `${i + 1}. ${b.title} [${domain}]`;
      })
      .join('\n');

    const existingList =
      existingFolders.length > 0 ? `\n\nExisting folders: ${existingFolders.join(', ')}` : '';

    const prompt = `Analyze these ${sample.length} bookmarks (sampled from ${bookmarks.length} total) and determine what folder categories to create.

${existingList}

Bookmarks:
${bookmarkList}

Create 5-15 broad folder categories that will organize ALL ${bookmarks.length} bookmarks effectively.

RULES:
1. Create FEWER folders with MORE bookmarks in each (minimum 10-15 bookmarks per folder)
2. Use compound names with "&" to group related content (e.g., "Shopping & Services", "Travel & Accommodation")
3. NEVER create multiple folders with shared keywords - "Shopping" and "Shopping & Deals" is FORBIDDEN
4. Prefer reusing existing folders when they fit
5. NO vague names like "Other", "Misc", "Uncategorized", "General"

Return ONLY a JSON array of folder names, nothing else:
{
  "folders": ["Folder Name 1", "Folder Name 2", ...]
}

Target: 5-15 folders total.`;

    try {
      const { content, usage } = await this.callLLMWithRetry(prompt);

      // Parse response
      const jsonMatch =
        content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      const parsed = JSON.parse(jsonStr);

      if (!parsed.folders || !Array.isArray(parsed.folders)) {
        throw new Error('Invalid response: missing folders array');
      }

      logger.info('LLMService', `Discovered ${parsed.folders.length} folders:`, parsed.folders);
      logger.debug('LLMService', `Folder discovery used ${usage.total} tokens`);

      return parsed.folders;
    } catch (error) {
      logger.error('LLMService', 'Folder discovery failed', error);
      throw error;
    }
  }

  private buildPrompt(
    bookmarks: Bookmark[],
    existingFolders: string[],
    batchContext?: {
      current: number;
      total: number;
      totalBookmarks: number;
      folderSizes?: Record<string, number>;
    }
  ): string {
    // Extract domain from URL for categorization (much shorter than full URL)
    const bookmarkList = bookmarks
      .map((b, i) => {
        const domain = b.url ? new URL(b.url).hostname.replace('www.', '') : '';
        return `${i + 1}. ${b.title} [${domain}]`;
      })
      .join('\n');

    // Build existing folders list with sizes if available
    let existingList = '';
    if (existingFolders.length > 0) {
      if (batchContext?.folderSizes && Object.keys(batchContext.folderSizes).length > 0) {
        const foldersWithSizes = existingFolders.map((folder) => {
          const count = (batchContext.folderSizes && batchContext.folderSizes[folder]) || 0;
          return count > 0 ? `${folder} (${count} bookmarks)` : folder;
        });
        existingList = `\nExisting folders: ${foldersWithSizes.join(', ')}`;
      } else {
        existingList = `\nExisting folders: ${existingFolders.join(', ')}`;
      }
    }

    // Build batch context message
    let batchContextMsg = '';
    let folderGuidance = '';

    if (batchContext) {
      batchContextMsg = `\n\n⚠️ BATCH CONTEXT: This is batch ${batchContext.current} of ${batchContext.total}. You're processing ${bookmarks.length} bookmarks out of ${batchContext.totalBookmarks} total bookmarks.`;

      if (batchContext.current === 1) {
        // First batch - can create new folders more freely
        folderGuidance = `\nSince this is the FIRST batch, you can create new folders. Aim for ${Math.ceil(batchContext.totalBookmarks / 10)}-${Math.ceil(batchContext.totalBookmarks / 5)} folders TOTAL across ALL batches. For THIS batch, create 3-5 new folders maximum.`;
      } else {
        // Later batches - strongly prefer reusing existing folders
        folderGuidance = `\nSince this is batch ${batchContext.current}, STRONGLY PREFER using existing folders. Balance the folder sizes - favor folders with fewer bookmarks. Only create 1-2 new folders if absolutely necessary.`;
      }
    }

    return `Organize ${bookmarks.length} bookmarks into a SMALL NUMBER of broad folders.${batchContextMsg}${folderGuidance}${existingList}

Bookmarks:
${bookmarkList}

Return your response in this COMPACT JSON format. CRITICAL: You MUST provide a suggestion for EVERY SINGLE bookmark - exactly ${bookmarks.length} suggestions required. Use the sequential number (1, 2, 3...) as "i":
{
  "suggestions": [{"i": 1, "f": "Folder Name"}, {"i": 2, "f": "Folder Name"}],
  "foldersToCreate": ["Folder Name"]
}

CRITICAL RULES - MUST FOLLOW:
1. You MUST include ALL ${bookmarks.length} bookmarks in your suggestions array - NO EXCEPTIONS
2. NEVER create variations of existing folders - if "Travel" exists, DO NOT create "Travel Booking", "Travel & Booking", "Travel Services", etc. USE THE EXISTING FOLDER.
3. NEVER create folders with overlapping words - if you see "Shopping", "Shopping & Deals", "Shopping & Services" - this is WRONG. Use ONE folder only.
4. Create FEWER folders with MORE bookmarks in each (minimum 5 per folder, prefer 10+)
5. Use compound names with "&" to group related content (examples: "Shopping & Services", "News & Media", "Tech & Development")
6. DO NOT create separate folders for closely related topics - combine them
7. REUSE existing folders ALWAYS - creating a new folder when a similar one exists is a CRITICAL ERROR
8. NEVER use "Uncategorized", "Other", "Misc", "General", "Saved Tabs", "To Read", "Temp", or similar vague/temporary names
9. No slashes in names
10. Every bookmark must be assigned to a descriptive folder

BAD EXAMPLE (NEVER DO THIS):
- Travel, Travel Booking, Travel & Booking (WRONG - should be ONE folder: "Travel & Booking")
- Shopping, Shopping & Deals, Shopping & Services (WRONG - should be ONE folder: "Shopping & Services")

Think: "Can I use an existing folder?" FIRST, then "How can I create the FEWEST folders that still make sense?"`;
  }

  /**
   * PHASE 2: Assign bookmarks to approved folders
   * This replaces organizeBookmarks - it doesn't create folders, only assigns
   *
   * @param allowKeepCurrent - If true, allows bookmarks to stay in their current folder if it's a good fit
   */
  async assignToFolders(
    bookmarks: Bookmark[],
    approvedFolders: string[]
  ): Promise<OrganizationPlan> {
    logger.info(
      'LLMService',
      `Assigning ${bookmarks.length} bookmarks to ${approvedFolders.length} approved folders`
    );

    // Validate we have folders to work with
    if (approvedFolders.length === 0) {
      const error =
        'No approved folders provided. Please configure categories in settings.';
      logger.error('LLMService', error);
      throw new Error(error);
    }

    const bookmarkList = bookmarks
      .map((b, i) => {
        const domain = b.url ? new URL(b.url).hostname.replace('www.', '') : '';
        return `${i + 1}. ${b.title} [${domain}]`;
      })
      .join('\n');

    // Unified prompt - always allow KEEP_CURRENT for bookmarks that are already well-organized
    const prompt = `Review these ${bookmarks.length} bookmarks and assign them to the most appropriate folder.

APPROVED FOLDERS (you can ONLY use these folders):
${approvedFolders.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Bookmarks to review:
${bookmarkList}

For each bookmark, decide:
- Assign it to the best matching folder from the APPROVED FOLDERS list above
- If the bookmark is already in a good location and doesn't clearly fit any approved folder better, use "KEEP_CURRENT"

Return COMPACT JSON with ALL ${bookmarks.length} bookmarks:
{
  "suggestions": [{"i": 1, "f": "Folder Name or KEEP_CURRENT"}]
}

CRITICAL RULES:
1. You MUST include ALL ${bookmarks.length} bookmarks - NO EXCEPTIONS
2. Use folder names from the APPROVED FOLDERS list above, OR use "KEEP_CURRENT"
3. Only use KEEP_CURRENT if the bookmark is already well-organized and doesn't clearly fit any approved folder
4. Use "i" for index (1-${bookmarks.length}), "f" for folder name or "KEEP_CURRENT"`;

    // Use retry logic for rate limiting
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { content, usage } = await this.callLLMWithRetry(prompt);
        const plan = this.parseResponse(content, bookmarks);

        // Validate that all folder names are in approved list or KEEP_CURRENT
        const invalidFolders = plan.suggestions
          .map((s) => s.folderName)
          .filter((f) => f !== 'KEEP_CURRENT' && !approvedFolders.includes(f));

        if (invalidFolders.length > 0) {
          logger.warn('LLMService', `LLM used unapproved folders:`, invalidFolders);

          // Map invalid folders to KEEP_CURRENT as fallback
          plan.suggestions.forEach((s) => {
            const isValid = s.folderName === 'KEEP_CURRENT' || approvedFolders.includes(s.folderName);

            if (!isValid) {
              logger.warn('LLMService', `Mapping invalid folder "${s.folderName}" to KEEP_CURRENT`);
              s.folderName = 'KEEP_CURRENT';
            }
          });
        }

        plan.tokenUsage = usage;
        plan.foldersToCreate = []; // No folders created in assignment phase
        return plan;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is a retryable error
        const isRateLimit =
          (error as { statusCode?: number }).statusCode === 429 ||
          (error instanceof Error && error.message.toLowerCase().includes('rate limit'));

        // JSON parse errors are often transient (incomplete response, timeout, etc.)
        const isParseError =
          error instanceof Error &&
          (error.message.includes('Failed to parse LLM response') ||
            error.message.includes('Unexpected end of JSON input') ||
            error.message.includes('Unexpected token') ||
            error.message.includes('JSON'));

        const isRetryable = isRateLimit || isParseError;

        // Don't retry if we've exhausted attempts or it's a non-retryable error
        if (!isRetryable || attempt === maxRetries) {
          throw lastError;
        }

        const backoffSeconds = Math.min(Math.pow(2, attempt) * 2, 30); // Faster backoff for parse errors
        logger.warn(
          'LLMService',
          `${isRateLimit ? 'Rate limit' : 'Transient error'} detected (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${backoffSeconds}s...`,
          { error: lastError.message }
        );
        await new Promise((resolve) => setTimeout(resolve, backoffSeconds * 1000));
      }
    }

    throw lastError || new Error('assignToFolders failed after retries');
  }

  /**
   * Review and optimize folder assignments after all batches are processed
   */
  async reviewAndOptimize(
    allAssignments: Array<{ bookmarkId: string; title: string; url: string; folderName: string }>,
    folderSizes: Record<string, number>
  ): Promise<OrganizationPlan> {
    logger.info(
      'LLMService',
      `Reviewing ${allAssignments.length} bookmark assignments across ${Object.keys(folderSizes).length} folders`
    );

    const bookmarkList = allAssignments
      .map((a, i) => {
        const domain = a.url ? new URL(a.url).hostname.replace('www.', '') : '';
        return `${i + 1}. "${a.title}" [${domain}] → currently in "${a.folderName}"`;
      })
      .join('\n');

    const folderDistribution = Object.entries(folderSizes)
      .sort((a, b) => b[1] - a[1])
      .map(([folder, count]) => `${folder}: ${count} bookmarks`)
      .join('\n');

    const prompt = `CONSOLIDATION TASK: Fix duplicate/similar folder names in this bookmark organization.

Current ${Object.keys(folderSizes).length} folders (LOOK FOR DUPLICATES):
${folderDistribution}

STEP 1: Identify folders that share keywords and MUST be merged:
- If you see "Shopping" AND "Shopping & Deals" → DUPLICATE - merge to "Shopping & Services"
- If you see "Travel" AND "Travel Booking" → DUPLICATE - merge to "Travel & Booking"
- If you see "Entertainment & Media" AND "Entertainment & Streaming" → DUPLICATE - merge to "Entertainment & Media"
- Any folders with shared root words (Travel/Shopping/Entertainment/Tech/etc) are DUPLICATES

STEP 2: Consolidate ALL bookmarks into 5-15 UNIQUE folders with NO overlapping names.

Current assignments (${allAssignments.length} bookmarks):
${bookmarkList}

RULES:
1. NO folders with shared keywords - "Shopping" and "Shopping & Deals" is FORBIDDEN
2. NO folders with overlapping meanings - "Travel" and "Travel & Booking" is FORBIDDEN
3. Use compound names with "&" to make folders broader (e.g., "Shopping & Services")
4. Each folder must have 5+ bookmarks
5. Target 5-15 folders TOTAL

Return COMPACT JSON with ALL ${allAssignments.length} bookmarks reassigned using sequential numbers (1, 2, 3...):
{
  "suggestions": [{"i": 1, "f": "Consolidated Folder Name"}],
  "foldersToCreate": ["List of final consolidated folder names"]
}

CRITICAL: You MUST include all ${allAssignments.length} bookmarks. Use "i" for index (1-${allAssignments.length}), "f" for folder name. No "Uncategorized" or vague names allowed.`;

    try {
      const { content, usage } = await this.callLLMWithRetry(prompt);
      const plan = this.parseResponse(
        content,
        allAssignments.map((a) => ({ id: a.bookmarkId, title: a.title, url: a.url }))
      );
      plan.tokenUsage = usage;
      logger.info(
        'LLMService',
        `Review complete: ${plan.suggestions.length} assignments, ${plan.foldersToCreate.length} folders, tokens: ${usage.total}`
      );
      return plan;
    } catch (error) {
      logger.error('LLMService', 'Review and optimize failed', error);
      throw error;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry wrapper for LLM calls
   */
  private async callLLMWithRetry(
    prompt: string
  ): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.debug('LLMService', `LLM request attempt ${attempt}/${this.retryAttempts}`);
        return await this.callLLM(prompt);
      } catch (error) {
        lastError = error as Error;

        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable) {
          logger.warn('LLMService', `Non-retryable error encountered: ${lastError.message}`);
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === this.retryAttempts) {
          logger.error('LLMService', `All ${this.retryAttempts} retry attempts exhausted`);
          throw error;
        }

        // Wait before retrying
        logger.warn(
          'LLMService',
          `Attempt ${attempt} failed: ${lastError.message}. Retrying in ${this.retryDelay / 1000}s...`
        );
        await this.sleep(this.retryDelay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error during retry');
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const errorWithStatus = error as Error & { statusCode?: number };
    const statusCode = errorWithStatus.statusCode;

    // Retry on timeout, network errors, and server errors (5xx)
    if (error.name === 'AbortError') return true;
    if (error.message.includes('timeout')) return true;
    if (error.message.includes('network')) return true;
    if (error.message.includes('fetch failed')) return true;

    // Retry on specific HTTP status codes
    if (statusCode === 429) return true; // Rate limit
    if (statusCode === 500) return true; // Internal server error
    if (statusCode === 502) return true; // Bad gateway
    if (statusCode === 503) return true; // Service unavailable
    if (statusCode === 504) return true; // Gateway timeout

    // Don't retry on client errors (4xx except 429)
    if (statusCode && statusCode >= 400 && statusCode < 500) return false;

    // Retry on unknown errors (could be transient)
    return true;
  }

  private async callLLM(
    prompt: string
  ): Promise<{ content: string; usage: { prompt: number; completion: number; total: number } }> {
    logger.trace('LLMService', 'callLLM started');
    const endpoint = this.getAPIEndpoint();
    const headers = this.getHeaders();
    logger.debug('LLMService', `Calling ${this.provider} API at ${endpoint}`);

    interface Message {
      role: 'user' | 'system';
      content: string;
    }

    interface APIPayload {
      model: string;
      max_tokens: number;
      messages: Message[];
      temperature?: number;
      response_format?: { type: string };
    }

    let payload: any;

    if (this.provider === 'gemini') {
      // Gemini uses a different request format
      payload = {
        contents: [
          {
            parts: [
              {
                text: `You are a helpful assistant that organizes bookmarks. Always respond with valid JSON only.\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: this.maxTokens,
          responseMimeType: 'application/json',
        },
      };
    } else if (this.provider === 'claude') {
      payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };
    } else if (this.provider === 'openrouter') {
      // OpenRouter - don't use response_format as not all models support it
      payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that organizes bookmarks. Always respond with valid JSON only, no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      };
    } else {
      // OpenAI and Grok support response_format
      payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that organizes bookmarks. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      };
    }

    logger.trace('LLMService', 'Request payload', {
      model: payload.model || this.model,
      messageCount: payload.messages?.length || payload.contents?.length || 0,
    });

    try {
      logger.info('LLMService', 'Sending request to LLM API...');

      // Add timeout to prevent hanging forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        logger.error('LLMService', `Request timeout after ${this.timeout / 1000} seconds`);
        controller.abort();
      }, this.timeout);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        logger.debug(
          'LLMService',
          `Got response: status=${response.status} ${response.statusText}`
        );

        if (!response.ok) {
          const errorBody = await response.text();

          // Parse common error scenarios with user-friendly messages
          let userMessage = `API Error (${response.status})`;

          if (response.status === 401) {
            userMessage = 'Authentication failed. Please check your API key in settings.';
          } else if (response.status === 403) {
            userMessage = 'Access denied. Your API key may not have permission for this model.';
          } else if (response.status === 429) {
            userMessage =
              'Rate limit exceeded. Please wait a moment and try again, or upgrade your API plan.';
          } else if (
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503
          ) {
            userMessage = `${this.provider} API is experiencing issues. Please try again later.`;
          } else if (response.status === 400) {
            // Try to parse error for token limit issues
            try {
              const errorData = JSON.parse(errorBody);
              if (
                errorData.error?.message?.includes('token') ||
                errorData.error?.message?.includes('context_length')
              ) {
                userMessage =
                  'Token limit exceeded. Try reducing batch size or max tokens in settings.';
              } else {
                userMessage = `Invalid request: ${errorData.error?.message || errorBody}`;
              }
            } catch {
              userMessage = `Bad request (400): ${errorBody}`;
            }
          }

          // Log as WARN for retryable errors (will retry), ERROR for permanent failures
          const isRetryable = response.status === 429 || response.status >= 500;
          if (isRetryable) {
            logger.warn('LLMService', `API error (will retry): ${response.status}`, {
              error: errorBody,
              endpoint,
            });
          } else {
            logger.error('LLMService', `API error: ${response.status}`, {
              error: errorBody,
              endpoint,
            });
          }

          const error = new Error(userMessage) as Error & {
            statusCode: number;
            apiResponse: string;
          };
          error.statusCode = response.status;
          error.apiResponse = errorBody;
          throw error;
        }

        const data = await response.json();
        logger.trace('LLMService', 'Response data', data);

        let content: string;
        let usage: { prompt: number; completion: number; total: number; other?: number };

        if (this.provider === 'gemini') {
          // Gemini uses a different response format
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          // Log raw usage object to see all fields
          if (data.usageMetadata) {
            logger.debug('LLMService', 'Raw token usage from Gemini API:', data.usageMetadata);
          }

          const thoughtsTokens = data.usageMetadata?.thoughtsTokenCount || 0;
          usage = {
            prompt: data.usageMetadata?.promptTokenCount || 0,
            completion: data.usageMetadata?.candidatesTokenCount || 0,
            total: data.usageMetadata?.totalTokenCount || 0,
            other: thoughtsTokens > 0 ? thoughtsTokens : undefined,
          };
        } else if (this.provider === 'claude') {
          content = data.content[0].text;
          // Claude uses different field names
          usage = {
            prompt: data.usage?.input_tokens || 0,
            completion: data.usage?.output_tokens || 0,
            total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          };
        } else {
          // OpenAI, Grok, OpenRouter use same format
          content = data.choices[0].message.content;

          // Log raw usage object to see all fields
          if (data.usage) {
            logger.debug('LLMService', 'Raw token usage from API:', data.usage);
          }

          usage = {
            prompt: data.usage?.prompt_tokens || 0,
            completion: data.usage?.completion_tokens || 0,
            total: data.usage?.total_tokens || 0,
          };
        }

        logger.info(
          'LLMService',
          `LLM call successful, response length=${content.length} chars, tokens: ${usage.total} (prompt: ${usage.prompt}, completion: ${usage.completion})`
        );
        return { content, usage };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          logger.error('LLMService', 'Request aborted due to timeout');
          throw new Error(`Request timeout after ${this.timeout / 1000} seconds`);
        }
        throw fetchError;
      }
    } catch (error) {
      logger.error('LLMService', 'callLLM failed', { error, endpoint, provider: this.provider });
      throw error;
    }
  }

  /**
   * Check OpenRouter credits
   */
  async checkOpenRouterCredits(): Promise<{
    success: boolean;
    credits?: number;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: Date;
    };
    error?: string;
  }> {
    if (this.provider !== 'openrouter') {
      return { success: false, error: 'Not OpenRouter provider' };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to fetch credits' };
      }

      const data = await response.json();

      // Log full response for debugging
      logger.debug('LLMService', 'OpenRouter auth/key response:', data);

      // OpenRouter returns credits in cents, convert to dollars
      const credits = data.data?.limit_remaining ? data.data.limit_remaining / 100 : 0;

      // Check for rate limit info in response headers or data
      let rateLimit;
      const rateLimitHeader = response.headers.get('X-RateLimit-Remaining');
      const rateLimitLimitHeader = response.headers.get('X-RateLimit-Limit');
      const rateLimitResetHeader = response.headers.get('X-RateLimit-Reset');

      if (rateLimitHeader && rateLimitLimitHeader) {
        rateLimit = {
          limit: parseInt(rateLimitLimitHeader),
          remaining: parseInt(rateLimitHeader),
          reset: rateLimitResetHeader
            ? new Date(parseInt(rateLimitResetHeader) * 1000)
            : new Date(),
        };
        logger.info(
          'LLMService',
          `OpenRouter rate limit: ${rateLimit.remaining}/${rateLimit.limit}`
        );
      }

      logger.info('LLMService', `OpenRouter credits: $${credits.toFixed(2)}`);
      return { success: true, credits, rateLimit };
    } catch (error) {
      logger.error('LLMService', 'Failed to check OpenRouter credits', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate API connection with a minimal test call
   */
  async validateConnection(): Promise<{
    success: boolean;
    error?: string;
    responseTime: number;
    model?: string;
    credits?: number;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: Date;
    };
  }> {
    logger.info('LLMService', 'Validating API connection with test call (with retry)');

    // Wrap the validation in retry logic for transient failures
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        logger.debug(
          'LLMService',
          `Connection validation attempt ${attempt}/${this.retryAttempts}`
        );
        return await this.performValidation();
      } catch (error) {
        lastError = error as Error;

        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable) {
          logger.warn('LLMService', `Non-retryable error in validation: ${lastError.message}`);
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === this.retryAttempts) {
          logger.error('LLMService', `All ${this.retryAttempts} validation attempts exhausted`);
          throw error;
        }

        // Wait before retrying
        logger.warn(
          'LLMService',
          `Validation attempt ${attempt} failed: ${lastError.message}. Retrying in ${this.retryDelay / 1000}s...`
        );
        await this.sleep(this.retryDelay);
      }
    }

    throw lastError || new Error('Unknown error during validation retry');
  }

  /**
   * Perform the actual connection validation (called by validateConnection with retry)
   */
  private async performValidation(): Promise<{
    success: boolean;
    error?: string;
    responseTime: number;
    model?: string;
    credits?: number;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: Date;
    };
  }> {
    const startTime = Date.now();

    // Check credits first for OpenRouter to provide better error messages
    let credits: number | undefined;
    let rateLimit;
    if (this.provider === 'openrouter') {
      const creditsCheck = await this.checkOpenRouterCredits();
      if (creditsCheck.success) {
        credits = creditsCheck.credits;
        rateLimit = creditsCheck.rateLimit;
      }
    }

    try {
      const endpoint = this.getAPIEndpoint();
      const headers = this.getHeaders();

      interface Message {
        role: 'user' | 'system';
        content: string;
      }

      interface TestPayload {
        model?: string;
        max_tokens?: number;
        messages?: Message[];
        contents?: any;
        generationConfig?: any;
        temperature?: number;
        response_format?: { type: string };
      }

      let payload: TestPayload;

      // Use configured model and max_tokens, but keep the test simple
      // The test just validates API connectivity and basic JSON response capability
      const testPrompt = 'Reply with valid JSON: {"status": "ok"}';
      // Use configured max_tokens for the test to match actual usage
      const testMaxTokens = this.maxTokens;

      if (this.provider === 'gemini') {
        // Gemini uses a different request format
        payload = {
          contents: [
            {
              parts: [
                {
                  text: testPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: testMaxTokens,
            responseMimeType: 'application/json',
          },
        };
      } else if (this.provider === 'claude') {
        payload = {
          model: this.model,
          max_tokens: testMaxTokens,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
        };
      } else {
        // OpenAI, OpenRouter, and Grok
        payload = {
          model: this.model,
          max_tokens: testMaxTokens,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
        };
      }

      logger.debug('LLMService', 'Sending test request', { endpoint, model: this.model });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for test

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        logger.debug('LLMService', `Test response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();

          // Parse error message
          let errorMessage = `API error (${response.status})`;
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // Couldn't parse JSON, use status-based message
          }

          // Provide user-friendly error messages
          if (response.status === 401) {
            errorMessage = 'Invalid API key - please check your key and try again';
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded or insufficient credits';
          } else if (response.status === 404) {
            errorMessage = `Model "${this.model}" not found or you don't have access to it`;
          } else if (response.status === 403) {
            errorMessage = 'Access denied - check your API key permissions';
          }

          // Log as WARN for retryable errors, ERROR for permanent failures
          const isRetryable = response.status >= 500 || response.status === 429;
          if (isRetryable) {
            logger.warn('LLMService', `Test failed (will retry): ${response.status}`, { errorText });
          } else {
            logger.error('LLMService', `Test failed: ${response.status}`, { errorText });
          }

          // Throw error for retryable status codes (5xx, 429), return for others
          const error = new Error(errorMessage) as Error & { statusCode?: number };
          error.statusCode = response.status;

          if (isRetryable) {
            // Retryable error - throw it
            throw error;
          }

          // Non-retryable error - return it
          return {
            success: false,
            error: errorMessage,
            responseTime,
          };
        }

        const data = await response.json();
        logger.trace('LLMService', 'Test response data', data);

        // Verify response structure and extract content
        let content: string;
        let responseValid = false;
        let finishReason: string | undefined;

        if (this.provider === 'gemini') {
          responseValid = data.candidates && data.candidates.length > 0;
          content = data.candidates[0]?.content?.parts?.[0]?.text || '';
          finishReason = data.candidates[0]?.finishReason;
        } else if (this.provider === 'claude') {
          responseValid = data.content && data.content.length > 0;
          content = data.content[0]?.text || '';
          finishReason = data.stop_reason;
        } else {
          responseValid = data.choices && data.choices.length > 0;
          content = data.choices[0]?.message?.content || '';
          finishReason = data.choices[0]?.finish_reason;
        }

        logger.info('LLMService', 'Test response received', {
          contentLength: content.length,
          finishReason,
          credits,
          rateLimit,
        });

        if (!responseValid) {
          logger.error('LLMService', 'Test response invalid structure', data);
          return {
            success: false,
            error: 'API response has unexpected format',
            responseTime,
            credits,
            rateLimit,
          };
        }

        // Check if response was truncated due to length limit
        if (finishReason === 'length') {
          logger.warn(
            'LLMService',
            'Test response truncated with configured max_tokens, retrying with lower value',
            {
              configuredMaxTokens: testMaxTokens,
              contentLength: content.length,
              finishReason,
              credits,
              rateLimit,
            }
          );

          // Retry with a much smaller max_tokens to see if it's a config issue
          const fallbackMaxTokens = 100;
          const fallbackPayload =
            this.provider === 'claude'
              ? {
                  model: this.model,
                  max_tokens: fallbackMaxTokens,
                  messages: [{ role: 'user', content: testPrompt }],
                }
              : {
                  model: this.model,
                  max_tokens: fallbackMaxTokens,
                  messages: [{ role: 'user', content: testPrompt }],
                };

          try {
            const fallbackResponse = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackPayload),
              signal: controller.signal,
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackFinishReason =
                this.provider === 'claude'
                  ? fallbackData.stop_reason
                  : fallbackData.choices[0]?.finish_reason;

              if (fallbackFinishReason !== 'length') {
                // Success with lower tokens - it's a config issue
                logger.info('LLMService', 'Fallback test succeeded with lower max_tokens', {
                  fallbackMaxTokens,
                });

                let errorMsg = `Connection test succeeded with ${fallbackMaxTokens} tokens, but failed with your configured ${testMaxTokens} tokens. `;
                if (this.provider === 'openrouter' && credits !== undefined && credits === 0) {
                  errorMsg +=
                    'Free tier models have lower output limits. Try reducing max tokens to 500-1000 in Settings.';
                } else {
                  errorMsg += 'Try reducing max tokens to 1000-2000 in Settings.';
                }

                return {
                  success: false,
                  error: errorMsg,
                  responseTime,
                  credits,
                  rateLimit,
                };
              }
            }
          } catch (fallbackError) {
            logger.error('LLMService', 'Fallback test also failed', fallbackError);
          }

          // Even fallback failed or was truncated - more serious issue
          let errorMsg =
            'Connection test failed: Model output truncated even with low token limit.';
          if (this.provider === 'openrouter' && credits !== undefined && credits === 0) {
            errorMsg +=
              ' Your account has $0.00 credits, or you have used all free requests for the day. Please add credits at https://openrouter.ai/credits to use this extension.';
          } else {
            errorMsg += ' There may be an issue with your API access or model selection.';
          }

          return {
            success: false,
            error: errorMsg,
            responseTime,
            credits,
            rateLimit,
          };
        }

        // Verify the response contains valid JSON
        // This is just a basic connectivity test - we're not testing full workload capability
        try {
          const jsonMatch =
            content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : content;
          const parsed = JSON.parse(jsonStr);

          logger.info('LLMService', 'Test response parsed successfully', {
            parsed,
            contentLength: content.length,
          });

          // Just verify we got valid JSON - that's enough to confirm API is working
          if (!parsed || typeof parsed !== 'object') {
            logger.error('LLMService', 'Test response not a valid object', {
              parsed,
              contentLength: content.length,
              credits,
              rateLimit,
            });

            return {
              success: false,
              error: 'Connection test failed: Model response invalid.',
              responseTime,
              credits,
              rateLimit,
            };
          }
        } catch (parseError) {
          logger.warn('LLMService', 'Test response not valid JSON', {
            error: parseError,
            contentLength: content.length,
            contentPreview: content.substring(0, 500),
            fullContent: content,
            credits,
            rateLimit,
          });

          // Provide appropriate error message based on credits
          let errorMsg = 'Connection test failed: Model response truncated or invalid JSON.';
          if (this.provider === 'openrouter' && credits !== undefined && credits === 0) {
            errorMsg +=
              ' Your account has $0.00 credits, or you have used all free requests for the day. Please add credits at https://openrouter.ai/credits to use this extension.';
          } else {
            errorMsg += ' Try reducing max tokens to 2000-3000 or batch size to 20-30 in Settings.';
          }

          return {
            success: false,
            error: errorMsg,
            responseTime,
            credits,
            rateLimit,
          };
        }

        logger.info('LLMService', `Connection test successful! Response time: ${responseTime}ms`);

        // Credits already checked at the start, just return them
        return {
          success: true,
          responseTime,
          model: this.model,
          credits,
          rateLimit,
        };
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          logger.error('LLMService', 'Test request timeout');
          return {
            success: false,
            error: 'Connection timeout (30 seconds) - API not responding',
            responseTime,
          };
        }

        logger.error('LLMService', 'Test request failed', fetchError);
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Cannot reach API';
        return {
          success: false,
          error: `Network error: ${errorMessage}`,
          responseTime,
        };
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      logger.error('LLMService', 'Connection validation failed', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during connection test';
      return {
        success: false,
        error: errorMessage,
        responseTime,
      };
    }
  }

  private parseResponse(response: string, bookmarks: Bookmark[]): OrganizationPlan {
    logger.trace('LLMService', 'parseResponse called', {
      responseLength: response.length,
      bookmarkCount: bookmarks.length,
    });

    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch =
        response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      logger.debug('LLMService', `Extracted JSON string, length=${jsonStr.length}`);

      const parsed = JSON.parse(jsonStr);
      logger.trace('LLMService', 'Parsed JSON successfully', parsed);

      // Validate structure
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        logger.error('LLMService', 'Invalid response structure: missing suggestions array');
        throw new Error('Invalid response: missing suggestions array');
      }

      // Convert index-based suggestions to bookmarkId-based
      // Support both new format {"i": 1, "f": "folder"} and old format {"bookmarkId": "123", "folderName": "folder"}
      interface RawSuggestion {
        i?: number;
        f?: string;
        bookmarkId?: string;
        folderName?: string;
      }

      const normalizedSuggestions = parsed.suggestions.map((s: RawSuggestion) => {
        if (s.i !== undefined && s.f !== undefined) {
          // New compact format - map index to bookmark ID
          const bookmark = bookmarks[s.i - 1]; // i is 1-based
          if (!bookmark) {
            throw new Error(`Invalid index ${s.i} - only ${bookmarks.length} bookmarks provided`);
          }
          return {
            bookmarkId: bookmark.id,
            folderName: s.f,
          };
        } else if (s.bookmarkId !== undefined && s.folderName !== undefined) {
          // Old format - pass through
          return {
            bookmarkId: s.bookmarkId,
            folderName: s.folderName,
          };
        } else {
          throw new Error(`Invalid suggestion format: ${JSON.stringify(s)}`);
        }
      });

      // Ensure all bookmarks have suggestions
      const suggestedIds = new Set(normalizedSuggestions.map((s) => s.bookmarkId));
      const missingBookmarks = bookmarks.filter((b) => !suggestedIds.has(b.id));

      if (missingBookmarks.length > 0) {
        logger.error(
          'LLMService',
          `CRITICAL: ${missingBookmarks.length} bookmarks had no suggestions from LLM`,
          {
            missingIds: missingBookmarks.map((b) => b.id),
            missingTitles: missingBookmarks.map((b) => b.title),
            receivedSuggestions: normalizedSuggestions.length,
            expectedBookmarks: bookmarks.length,
            responseLength: response.length,
          }
        );
        throw new Error(
          `LLM failed to categorize ${missingBookmarks.length} of ${bookmarks.length} bookmarks. This should never happen.`
        );
      }

      const plan = {
        suggestions: normalizedSuggestions,
        foldersToCreate: parsed.foldersToCreate || [],
      };

      logger.info(
        'LLMService',
        `Successfully parsed response: ${plan.suggestions.length} suggestions, ${plan.foldersToCreate.length} folders to create`
      );
      return plan;
    } catch (error) {
      logger.warn('LLMService', 'Failed to parse LLM response (may retry)', {
        error,
        response: response.substring(0, 1000),
        fullResponseLength: response.length,
      });

      // Do NOT fallback to Uncategorized - that defeats the purpose
      // Re-throw to alert user that something went wrong
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
