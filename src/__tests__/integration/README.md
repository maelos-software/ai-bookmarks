# Integration Tests for LLM Providers

This directory contains integration tests that use **real API keys** to test the extension with actual LLM providers. These tests are **NOT run as part of CI** and are intended for local development only.

## Purpose

These tests help us:
1. Verify that different LLM providers work correctly with our prompts
2. Diagnose provider-specific issues (like the empty categories bug we found with OpenRouter)
3. Test edge cases with real API responses
4. Compare behavior across different providers

## Setup

### 1. Create `.env.local` file

Copy the example file and add your real API keys:

```bash
cp .env.local.example .env.local
```

### 2. Add API Keys

Edit `.env.local` and add your API keys. You don't need all of them - tests will skip providers without keys:

```bash
# Example .env.local
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
GROK_API_KEY=xai-your-grok-key-here
OPENROUTER_API_KEY=sk-or-your-openrouter-key-here
```

**IMPORTANT:** `.env.local` is in `.gitignore` and should **NEVER** be committed to the repository.

### 3. Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run with verbose output
npm run test:integration -- --verbose

# Run a specific provider
npm run test:integration -- --testNamePattern="OpenAI"
```

## Test Structure

The tests cover:

### Empty Categories Test
Verifies that the empty categories bug is properly handled - should throw an error rather than crash.

### Minimal Categories Test
Tests with just 1-2 categories to ensure the LLM can handle limited options.

### Good Categories Test
Tests with a realistic set of categories (6-8) to verify proper distribution and assignment.

### Edge Cases
Tests unusual scenarios like single bookmarks, all bookmarks in one category, etc.

## Sample Data

Test fixtures are in `src/__tests__/fixtures/sample-bookmarks.ts`:

- **sampleBookmarks**: 21 realistic bookmarks covering various topics
- **emptyCategories**: Empty array (triggers the bug we fixed)
- **minimalCategories**: Just 2 categories
- **goodCategories**: 6 well-designed categories
- **excessiveCategories**: 20+ categories (tests over-fragmentation)

## Interpreting Results

Each test logs:
- Number of suggestions returned
- Token usage (prompt, completion, total)
- Distribution of bookmarks across categories
- Individual assignments for smaller tests

Example output:
```
OpenAI - Good categories result: {
  suggestions: 21,
  tokens: { prompt: 523, completion: 156, total: 679 },
  distribution: [
    { category: 'Technology & Development', count: 5 },
    { category: 'News & Media', count: 3 },
    { category: 'Shopping & E-commerce', count: 3 },
    { category: 'Entertainment & Streaming', count: 4 },
    { category: 'Social Media', count: 3 },
    { category: 'Education & Learning', count: 3 }
  ]
}
```

## Troubleshooting

### Tests are skipped
- Check that you've added API keys to `.env.local`
- Verify `.env.local` is in the project root directory

### API rate limits
- Tests use `--runInBand` to run sequentially and avoid rate limits
- If you hit rate limits, wait a few minutes and try again
- Consider running one provider at a time

### API errors
- Check that your API keys are valid and have sufficient credits
- Verify the API endpoint is accessible (check firewall/proxy)
- Look at the error messages for provider-specific issues

## Cost Considerations

These tests make real API calls and will consume credits/tokens:

- **Per test run**: Approximately 2000-4000 tokens total across all providers
- **Estimated cost**: $0.01-0.05 per full test run (varies by provider)

To minimize costs:
- Only configure API keys for providers you want to test
- Run specific tests instead of the full suite
- Use free tier / trial credits where available

## Adding New Tests

To add a new integration test:

1. Add test data to `fixtures/sample-bookmarks.ts` if needed
2. Add a new `test` or `testIf` block in `llm-providers.integration.test.ts`
3. Use the same pattern: API key check → skip if missing
4. Log results with `console.log` for debugging

Example:
```typescript
testIf('should handle special case', async () => {
  const llm = new LLMService(apiKey!, 'openai');

  const result = await llm.assignToFolders(
    specialBookmarks,
    specialCategories
  );

  expect(result.suggestions).toHaveLength(specialBookmarks.length);

  console.log('Special case result:', {
    suggestions: result.suggestions.length,
    tokens: result.tokenUsage
  });
});
```

## Best Practices

1. **Never commit API keys** - Always use `.env.local`
2. **Run before releases** - Verify all providers work before major releases
3. **Check logs** - Review console output for unexpected behavior
4. **Compare providers** - Look for differences in how providers handle the same data
5. **Document findings** - If you discover provider-specific quirks, document them

## Related Files

- `.env.local.example` - Template for API keys configuration
- `src/__tests__/fixtures/sample-bookmarks.ts` - Test data
- `src/services/LLMService.ts` - The service being tested
- `package.json` - Contains the `test:integration` script
