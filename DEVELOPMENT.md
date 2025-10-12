# Development Guide

This guide provides detailed information for developers working on the AI Bookmark Organizer extension.

## Table of Contents
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Code Quality](#code-quality)
- [Testing](#testing)
- [Continuous Integration](#continuous-integration)
- [Architecture](#architecture)
- [Debugging](#debugging)
- [Release Process](#release-process)

## Quick Start

### Prerequisites
- Node.js 20.x (LTS)
- npm 9.x or higher
- Chrome browser
- Git

### Setup
```bash
# Clone and install
git clone https://github.com/rmk40/ai-bookmarks.git
cd ai-bookmarks
npm install

# Build and load in Chrome
npm run build
# Then load unpacked extension from chrome://extensions/
```

## Development Workflow

### Daily Development

1. **Start development mode**:
   ```bash
   npm run dev  # Watches for changes and rebuilds automatically
   ```

2. **Make changes** to TypeScript source files in `src/`

3. **Reload extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh icon on the extension card
   - Or use the keyboard shortcut (varies by OS)

4. **Check for errors**:
   - Browser console (F12)
   - Extension background page console
   - Terminal output from webpack

### Before Committing

Run all quality checks locally to ensure CI will pass:

```bash
# Quick check (runs all in sequence)
npm run type-check && npm run lint && npm run format:check && npm run test && npm run build

# Or run individually:
npm run type-check     # TypeScript validation
npm run lint           # ESLint (must have 0 errors)
npm run format:check   # Prettier formatting
npm run test:coverage  # Jest tests (90%+ coverage required)
npm run audit          # Security vulnerabilities
npm run build          # Production build
```

### Fixing Issues

**Auto-fix formatting and lint issues**:
```bash
npm run format      # Fix formatting
npm run lint:fix    # Fix auto-fixable lint issues
```

**Common issues**:
- TypeScript errors: Check types, imports, and interface definitions
- Lint errors: Run `npm run lint:fix` first, then fix remaining manually
- Format errors: Run `npm run format`
- Test failures: Check test output, update mocks if Chrome APIs changed
- Build errors: Check webpack output, verify imports

## Code Quality

### TypeScript

**Configuration**: `tsconfig.json`
- Target: ES2020
- Strict mode: Partially enabled (working toward full strict)
- Source maps enabled for debugging

**Best Practices**:
- Use explicit types, avoid `any` (warnings acceptable in error handlers)
- Prefer interfaces over types for object shapes
- Use async/await over promise chains
- Leverage TypeScript's type inference where clear

### Linting

**Configuration**: `.eslintrc.js`
- Parser: @typescript-eslint/parser
- Extends: eslint:recommended, plugin:@typescript-eslint/recommended, prettier
- Rules: See `.eslintrc.js` for full list

**Key Rules**:
- No `var` keyword (use `const`/`let`)
- Prefer `const` over `let`
- No unused variables (prefix with `_` if intentionally unused)
- Minimize `any` types (39 remaining in error handlers)
- Console statements allowed (Chrome extension debugging)

**Test File Overrides**:
- `any` types allowed in test files for mocking
- Unused variables allowed in test mocks

### Formatting

**Configuration**: `.prettierrc`
- Single quotes
- 2-space indentation
- 100 character line length
- Semicolons required
- Trailing commas (ES5)
- LF line endings

**Integration**: Prettier is integrated with ESLint via `eslint-plugin-prettier`

## Testing

### Test Stack
- **Framework**: Jest 29.x
- **Environment**: jsdom (simulates browser DOM)
- **Coverage**: 90%+ required for service layer
- **Mocking**: Chrome APIs mocked via jest.fn()

### Running Tests

```bash
npm run test              # Run all tests once
npm run test:watch        # Watch mode for development
npm run test:coverage     # Full coverage report
```

### Writing Tests

**Location**: `src/services/__tests__/`

**File Naming**: `ServiceName.test.ts` or `ServiceName.spec.ts`

**Structure**:
```typescript
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MyService } from '../MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    // Setup: Create fresh instances and mocks
    service = new MyService();

    // Mock Chrome APIs
    global.chrome = {
      bookmarks: {
        getTree: jest.fn(() => Promise.resolve([])),
      },
      storage: {
        local: {
          get: jest.fn(() => Promise.resolve({})),
          set: jest.fn(() => Promise.resolve()),
        },
      },
    } as any;
  });

  afterEach(() => {
    // Cleanup: Clear mocks
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      const result = await service.methodName(input);
      expect(result).toEqual(expected);
    });

    it('should handle error case', async () => {
      jest.spyOn(service, 'someMethod').mockRejectedValue(new Error('Test error'));
      await expect(service.methodName(input)).rejects.toThrow('Test error');
    });
  });
});
```

### Coverage Requirements

- **Overall**: 90%+ for service layer
- **Statements**: 90%+
- **Branches**: 75%+
- **Functions**: 90%+
- **Lines**: 90%+

**Current Coverage** (as of last update):
- LLMService: 91.87%
- BookmarkManager: 90.15%
- ConfigurationManager: 100%
- OpenRouterAuthService: 96.20%
- Logger: 95.91%
- ReorganizationService: 85.00%

**Coverage Report**: `coverage/lcov-report/index.html` (generated after `npm run test:coverage`)

### Console Suppression

Tests suppress console.error and console.warn to prevent expected error logs from cluttering output.

**Global Setup**: `src/services/__tests__/setup.ts`
- Suppresses console.error and console.warn globally
- Restores original methods after tests complete

## Continuous Integration

### GitHub Actions Workflows

**CI Workflow** (`.github/workflows/ci.yml`):
- **Triggers**: Push to main/devel, PRs to main/devel
- **Node Version**: 20.x
- **Steps**:
  1. Security audit (npm audit, non-blocking)
  2. Check code formatting (Prettier)
  3. Lint code (ESLint)
  4. Type check (TypeScript)
  5. Run tests with coverage (Jest)
  6. Build extension (webpack)
  7. Upload coverage to Codecov
  8. Archive build artifacts (7 days)
  9. Publish snapshot release (main branch only)

**Release Workflow** (`.github/workflows/release.yml`):
- **Triggers**: Version tags (v*.*.*)
- **Node Version**: 20.x
- **Steps**:
  1. Run full CI pipeline
  2. Build release package (build-release-zip.sh)
  3. Generate release notes from commits
  4. Create GitHub Release with .zip artifact

### Branch Protection

**Current Status**: Not enabled (requires GitHub Pro or public repo)

**Manual Process**:
- Check for green checkmark on PR before merging
- All CI checks must pass
- No merge if any check fails

**If Enabled** (Pro/Public):
- Require status checks to pass: `build-and-test`
- Require branches to be up to date
- Optional: Require pull request reviews

### Artifacts

**Build Artifacts** (7-day retention):
- `extension-build` - Production build from dist/
- `test-coverage` - HTML coverage report

**Release Assets** (permanent):
- `ai-bookmarks-{version}-{hash}.zip` - Chrome Web Store package
- Includes manifest, dist/, icons/, HTML, and styles/

## Architecture

### Project Structure

```
ai-bookmarks/
├── .github/workflows/       # CI/CD workflows
├── dist/                    # Compiled output (gitignored)
├── coverage/                # Test coverage reports (gitignored)
├── icons/                   # Extension icons (16, 32, 48, 128px)
├── styles/                  # Shared CSS
├── src/
│   ├── background/         # Service worker (background.ts)
│   ├── popup/              # Extension popup (popup.ts)
│   ├── options/            # Settings page (options.ts)
│   ├── folder-selector/    # Folder selection (folder-selector.ts)
│   ├── results/            # Results display (results.ts)
│   └── services/           # Core business logic
│       ├── __tests__/      # Unit tests
│       │   └── setup.ts    # Global test setup
│       ├── BookmarkManager.ts       # Chrome Bookmarks API wrapper
│       ├── ConfigurationManager.ts  # Settings & storage
│       ├── LLMService.ts            # Multi-provider LLM client
│       ├── ReorganizationService.ts # Organization pipeline
│       ├── OpenRouterAuthService.ts # OAuth authentication
│       └── Logger.ts                # Logging utility
├── manifest.json           # Extension manifest (Manifest V3)
├── popup.html             # Popup UI
├── options.html           # Settings UI
├── folder-selector.html   # Folder selection UI
├── results.html           # Results UI
├── webpack.config.js      # Build configuration
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest configuration
├── .eslintrc.js          # ESLint configuration
├── .prettierrc           # Prettier configuration
└── package.json          # Dependencies and scripts
```

### Service Layer

**BookmarkManager** (`BookmarkManager.ts`):
- Wraps Chrome Bookmarks API
- Handles bookmark CRUD operations
- Duplicate detection and removal
- Empty folder cleanup
- Vivaldi Speed Dial integration

**ConfigurationManager** (`ConfigurationManager.ts`):
- Chrome storage wrapper (sync + local)
- Settings management
- Organization history tracking
- Default configuration

**LLMService** (`LLMService.ts`):
- Multi-provider LLM client (OpenRouter, OpenAI, Claude, Grok, Custom)
- Prompt engineering for categorization
- Batch processing
- Token usage tracking
- Rate limiting and retries

**ReorganizationService** (`ReorganizationService.ts`):
- High-level organization pipeline
- Coordinates other services
- Progress callbacks
- Error aggregation
- Statistics collection

**OpenRouterAuthService** (`OpenRouterAuthService.ts`):
- OAuth 2.0 PKCE flow
- Token management
- Secure storage
- Auto-refresh

**Logger** (`Logger.ts`):
- Structured logging (TRACE, DEBUG, INFO, WARN, ERROR)
- Chrome storage persistence
- Console output (configurable)
- Circular buffer (1000 entries)

### UI Layer

**Background Service Worker** (`background.ts`):
- Extension lifecycle management
- Message passing hub
- Badge updates
- Storage migration
- Auto-organize on bookmark create

**Popup** (`popup.ts`):
- Main extension interface
- Quick actions
- Status display
- Recent activity log

**Options Page** (`options.ts`):
- Comprehensive settings
- API provider configuration
- Category customization
- Debug controls

**Folder Selector** (`folder-selector.ts`):
- Hierarchical bookmark tree
- Multi-select with checkboxes
- Folder statistics
- Search/filter

**Results Page** (`results.ts`):
- Organization results display
- Statistics dashboard
- Timeline view
- Detailed item lists

## Debugging

### Chrome DevTools

**Extension Popup**:
- Right-click extension icon → "Inspect popup"
- Console, network, and debugging tools

**Background Service Worker**:
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"
- View console logs, network requests, storage

**Extension Pages** (options, results, etc.):
- Right-click page → "Inspect"
- Standard DevTools

### Logging

**Logger Configuration** (Options → Debug):
- **Log Level**: TRACE, DEBUG, INFO, WARN, ERROR
- **Console Logging**: Enable/disable browser console output
- Logs always persisted internally (last 1000)

**Accessing Logs**:
```typescript
// In code
import { Logger } from './services/Logger';
const logger = Logger.getInstance();
logger.debug('ComponentName', 'Message', optionalData);

// View logs
logger.getAllLogs();  // Returns array of log entries
```

**Log Entry Format**:
```typescript
{
  timestamp: string,      // ISO 8601
  level: LogLevel,        // TRACE | DEBUG | INFO | WARN | ERROR
  component: string,      // Source component
  message: string,        // Log message
  data?: any             // Optional structured data
}
```

### Common Debugging Scenarios

**Bookmark Organization Failures**:
1. Check background service worker console for errors
2. Review Logger output for detailed trace
3. Verify API key/auth in storage
4. Check network tab for failed API calls

**Settings Not Persisting**:
1. Check chrome.storage quota
2. Verify storage permissions in manifest
3. Look for storage.set() errors in console

**Extension Not Loading**:
1. Check manifest.json syntax
2. Verify all file paths are correct
3. Check for TypeScript/webpack build errors
4. Review extension errors in chrome://extensions/

## Release Process

### Versioning

Follow [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features (backward compatible)
- **Patch** (0.0.1): Bug fixes

### Creating a Release

1. **Update version** in `manifest.json`:
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Update CHANGELOG.md**:
   - Move "Unreleased" changes to new version section
   - Add release date
   - Follow [Keep a Changelog](https://keepachangelog.com/) format

3. **Commit and push**:
   ```bash
   git add manifest.json CHANGELOG.md
   git commit -m "Release version 1.2.3"
   git push origin main
   ```

4. **Create and push tag**:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

5. **GitHub Actions automatically**:
   - Runs full CI pipeline
   - Builds release package
   - Generates release notes
   - Creates GitHub Release
   - Uploads .zip artifact

6. **Manual steps**:
   - Review release notes on GitHub
   - Download .zip from release
   - Submit to Chrome Web Store (when ready)

### Build Script

`build-release-zip.sh`:
- Extracts version from manifest.json
- Gets git commit hash
- Cleans and builds production bundle
- Creates zip with naming: `ai-bookmarks-{version}-{hash}.zip`
- Includes: manifest.json, dist/, icons/, *.html, styles/
- Excludes: source maps, .DS_Store files

## Additional Resources

- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [GitHub Actions](https://docs.github.com/en/actions)

## Questions?

- Check [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Open an issue on GitHub
- Start a discussion in GitHub Discussions
