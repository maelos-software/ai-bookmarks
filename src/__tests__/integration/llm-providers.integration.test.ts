/**
 * Integration tests for LLM providers
 *
 * These tests use real API keys stored in .env.local (NOT committed to git)
 * and are NOT run as part of CI - they are for local development only.
 *
 * Usage:
 *   1. Copy .env.local.example to .env.local
 *   2. Add your real API keys to .env.local
 *   3. Run: npm run test:integration
 *
 * These tests help verify that different LLM providers work correctly with
 * our prompts and can help diagnose issues like the empty categories bug.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { LLMService } from '../../services/LLMService';
import {
  sampleBookmarks,
  emptyCategories,
  minimalCategories,
  goodCategories,
} from '../fixtures/sample-bookmarks';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

// Skip all tests if no API keys are configured
const hasAnyApiKey =
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.GROK_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.GEMINI_API_KEY;

const describeIfConfigured = hasAnyApiKey ? describe : describe.skip;

describeIfConfigured('LLM Provider Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(60000);

  describe('OpenAI', () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const testIf = apiKey ? test : test.skip;

    testIf('should handle empty categories gracefully', async () => {
      const llm = new LLMService(apiKey!, 'openai');

      // This should throw an error with empty categories
      await expect(
        llm.assignToFolders(sampleBookmarks.slice(0, 5), emptyCategories)
      ).rejects.toThrow(/No approved folders provided/);
    });

    testIf('should work with minimal categories', async () => {
      const llm = new LLMService(apiKey!, 'openai');

      const result = await llm.assignToFolders(sampleBookmarks.slice(0, 5), minimalCategories);

      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions.every((s) => minimalCategories.includes(s.folderName))).toBe(true);
      expect(result.tokenUsage).toBeDefined();

      console.log('OpenAI - Minimal categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        assignments: result.suggestions.map((s) => `${s.bookmarkId} → ${s.folderName}`),
      });
    });

    testIf('should work with good categories', async () => {
      const llm = new LLMService(apiKey!, 'openai');

      const result = await llm.assignToFolders(sampleBookmarks, goodCategories);

      expect(result.suggestions).toHaveLength(sampleBookmarks.length);
      expect(result.suggestions.every((s) => goodCategories.includes(s.folderName))).toBe(true);
      expect(result.tokenUsage).toBeDefined();

      console.log('OpenAI - Good categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        distribution: goodCategories.map((cat) => ({
          category: cat,
          count: result.suggestions.filter((s) => s.folderName === cat).length,
        })),
      });
    });
  });

  describe('Anthropic/Claude', () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const testIf = apiKey ? test : test.skip;

    testIf('should handle empty categories gracefully', async () => {
      const llm = new LLMService(apiKey!, 'claude');

      await expect(
        llm.assignToFolders(sampleBookmarks.slice(0, 5), emptyCategories)
      ).rejects.toThrow(/No approved folders provided/);
    });

    testIf('should work with minimal categories', async () => {
      const llm = new LLMService(apiKey!, 'claude');

      const result = await llm.assignToFolders(sampleBookmarks.slice(0, 5), minimalCategories);

      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions.every((s) => minimalCategories.includes(s.folderName))).toBe(true);

      console.log('Claude - Minimal categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        assignments: result.suggestions.map((s) => `${s.bookmarkId} → ${s.folderName}`),
      });
    });

    testIf('should work with good categories', async () => {
      const llm = new LLMService(apiKey!, 'claude');

      const result = await llm.assignToFolders(sampleBookmarks, goodCategories);

      expect(result.suggestions).toHaveLength(sampleBookmarks.length);
      expect(result.suggestions.every((s) => goodCategories.includes(s.folderName))).toBe(true);

      console.log('Claude - Good categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        distribution: goodCategories.map((cat) => ({
          category: cat,
          count: result.suggestions.filter((s) => s.folderName === cat).length,
        })),
      });
    });
  });

  describe('Grok', () => {
    const apiKey = process.env.GROK_API_KEY;
    const testIf = apiKey ? test : test.skip;

    testIf('should handle empty categories gracefully', async () => {
      const llm = new LLMService(apiKey!, 'grok');

      await expect(
        llm.assignToFolders(sampleBookmarks.slice(0, 5), emptyCategories)
      ).rejects.toThrow(/No approved folders provided/);
    });

    testIf('should work with minimal categories', async () => {
      const llm = new LLMService(apiKey!, 'grok');

      const result = await llm.assignToFolders(sampleBookmarks.slice(0, 5), minimalCategories);

      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions.every((s) => minimalCategories.includes(s.folderName))).toBe(true);

      console.log('Grok - Minimal categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        assignments: result.suggestions.map((s) => `${s.bookmarkId} → ${s.folderName}`),
      });
    });

    testIf('should work with good categories', async () => {
      const llm = new LLMService(apiKey!, 'grok');

      const result = await llm.assignToFolders(sampleBookmarks, goodCategories);

      expect(result.suggestions).toHaveLength(sampleBookmarks.length);
      expect(result.suggestions.every((s) => goodCategories.includes(s.folderName))).toBe(true);

      console.log('Grok - Good categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        distribution: goodCategories.map((cat) => ({
          category: cat,
          count: result.suggestions.filter((s) => s.folderName === cat).length,
        })),
      });
    });
  });

  describe('OpenRouter', () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const testIf = apiKey ? test : test.skip;

    testIf('should handle empty categories gracefully', async () => {
      const llm = new LLMService(apiKey!, 'openrouter');

      await expect(
        llm.assignToFolders(sampleBookmarks.slice(0, 5), emptyCategories)
      ).rejects.toThrow(/No approved folders provided/);
    });

    testIf('should work with minimal categories', async () => {
      const llm = new LLMService(apiKey!, 'openrouter');

      const result = await llm.assignToFolders(sampleBookmarks.slice(0, 5), minimalCategories);

      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions.every((s) => minimalCategories.includes(s.folderName))).toBe(true);

      console.log('OpenRouter - Minimal categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        assignments: result.suggestions.map((s) => `${s.bookmarkId} → ${s.folderName}`),
      });
    });

    testIf('should work with good categories', async () => {
      const llm = new LLMService(apiKey!, 'openrouter');

      const result = await llm.assignToFolders(sampleBookmarks, goodCategories);

      expect(result.suggestions).toHaveLength(sampleBookmarks.length);
      expect(result.suggestions.every((s) => goodCategories.includes(s.folderName))).toBe(true);

      console.log('OpenRouter - Good categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        distribution: goodCategories.map((cat) => ({
          category: cat,
          count: result.suggestions.filter((s) => s.folderName === cat).length,
        })),
      });
    });
  });

  describe('Gemini', () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const testIf = apiKey ? test : test.skip;

    testIf('should handle empty categories gracefully', async () => {
      const llm = new LLMService(apiKey!, 'gemini');

      await expect(
        llm.assignToFolders(sampleBookmarks.slice(0, 5), emptyCategories)
      ).rejects.toThrow(/No approved folders provided/);
    });

    testIf('should work with minimal categories', async () => {
      const llm = new LLMService(apiKey!, 'gemini');

      const result = await llm.assignToFolders(sampleBookmarks.slice(0, 5), minimalCategories);

      expect(result.suggestions).toHaveLength(5);
      expect(result.suggestions.every((s) => minimalCategories.includes(s.folderName))).toBe(true);

      console.log('Gemini - Minimal categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        assignments: result.suggestions.map((s) => `${s.bookmarkId} → ${s.folderName}`),
      });
    });

    testIf('should work with good categories', async () => {
      const llm = new LLMService(apiKey!, 'gemini');

      const result = await llm.assignToFolders(sampleBookmarks, goodCategories);

      expect(result.suggestions).toHaveLength(sampleBookmarks.length);
      expect(result.suggestions.every((s) => goodCategories.includes(s.folderName))).toBe(true);

      console.log('Gemini - Good categories result:', {
        suggestions: result.suggestions.length,
        tokens: result.tokenUsage,
        distribution: goodCategories.map((cat) => ({
          category: cat,
          count: result.suggestions.filter((s) => s.folderName === cat).length,
        })),
      });
    });
  });

  describe('Edge Cases', () => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const provider: 'openai' | 'claude' = process.env.OPENAI_API_KEY ? 'openai' : 'claude';
    const testIf = apiKey ? test : test.skip;

    testIf('should handle single bookmark with single category', async () => {
      const llm = new LLMService(apiKey!, provider);

      const result = await llm.assignToFolders([sampleBookmarks[0]], ['Technology']);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].folderName).toBe('Technology');
    });

    testIf('should handle all bookmarks assigned to same category', async () => {
      const llm = new LLMService(apiKey!, provider);
      const techBookmarks = sampleBookmarks.slice(0, 5); // All tech-related

      const result = await llm.assignToFolders(techBookmarks, ['Technology', 'Other']);

      expect(result.suggestions).toHaveLength(5);
      // Most/all should go to Technology
      const techCount = result.suggestions.filter((s) => s.folderName === 'Technology').length;
      expect(techCount).toBeGreaterThanOrEqual(4); // At least 4 out of 5
    });
  });
});

// Helper to check if tests can run
if (!hasAnyApiKey && process.env.npm_lifecycle_event === 'test:integration') {
  console.warn('\n⚠️  No API keys found in .env.local');
  console.warn(
    'Copy .env.local.example to .env.local and add your API keys to run integration tests.\n'
  );
}
