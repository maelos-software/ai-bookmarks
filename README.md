# AI Bookmark Organizer

A Chrome extension that uses AI to intelligently organize your bookmarks into categorized folders.

[![License](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](https://opensource.org/licenses/MPL-2.0)
[![CI](https://github.com/maelos-software/ai-bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/maelos-software/ai-bookmarks/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/maelos-software/ai-bookmarks/branch/main/graph/badge.svg)](https://codecov.io/gh/maelos-software/ai-bookmarks)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://chrome.google.com/webstore)

## Features

### Core Functionality
- **AI-Powered Categorization**: Automatically assigns bookmarks to predefined categories using LLMs
- **Flexible Organization Modes**:
  - **Organize All**: Organize all bookmarks across your entire library
  - **Organize Selected Folders**: Choose specific folders from a visual tree selector
  - **Use Existing Folders Mode**: Work only with your existing folders, no new ones created
- **Multi-Provider Support**: Compatible with OpenRouter, OpenAI, Claude (Anthropic), Grok (xAI), and custom OpenAI-compatible endpoints
- **Batch Processing**: Efficiently processes bookmarks in configurable batches (default: 50)
- **Smart Cleanup**: Removes duplicate bookmarks and empty folders automatically
- **Organization History**: Remembers previously organized bookmarks to preserve manual changes with flexible policies
- **Auto-Organize**: Optionally categorize new bookmarks in real-time as you add them

### User Experience
- **Intuitive Popup**: Clean interface with status indicator and recent activity log
- **Folder Selector**: Visual hierarchical tree to select specific folders for organization
- **Comprehensive Settings**: Organized configuration with validation and unsaved changes warnings
- **Detailed Results**: Complete breakdown with statistics, timeline, and item-by-item details
- **Visual Feedback**: Toast notifications, badge indicators, and progress updates
- **Customizable Categories**: Fully editable list of 25 default categories

### Security & Privacy
- **Local Storage**: All data stored securely in Chrome's local storage
- **No Third-Party Collection**: Extension doesn't collect or transmit data except to your chosen AI provider
- **OAuth Support**: Secure OpenRouter authentication without manual API key management
- **Open Source**: Transparent codebase for security auditing

## Installation

### From Chrome Web Store
Coming soon

### Manual Installation (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/rmk40/ai-bookmarks.git
   cd ai-bookmarks
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `ai-bookmarks` directory

## Quick Start

1. **Choose an AI Provider**
   - Click the extension icon
   - Click "Settings"
   - Select your preferred AI provider

2. **Configure Authentication**
   - **OpenRouter** (Recommended): Click "Sign In with OpenRouter"
   - **Others**: Enter your API key from the provider's dashboard

3. **Organize Your Bookmarks**
   - Click the extension icon in Chrome toolbar
   - Click "Organize Bookmarks"
   - Choose your organization method:
     - **Organize All**: Process all bookmarks across your entire library
     - **Organize Selected Folders**: Pick specific folders from a visual tree selector
   - Wait for processing (progress shown with real-time updates)
   - Review detailed results with statistics and item-by-item breakdown

**Important**: Always backup your bookmarks first!
- Go to `chrome://bookmarks`
- Click the ⋮ menu → "Export bookmarks"

## AI Provider Options

### OpenRouter (Recommended)
- **OAuth Login**: No API key required
- **Free Models**: Access to gpt-4o-mini and other free models
- **250+ Models**: Widest selection available
- **Get Started**: [openrouter.ai](https://openrouter.ai)

### OpenAI
- **API Key Required**: [platform.openai.com](https://platform.openai.com)
- **Default Model**: gpt-4o-mini
- **Cost**: Pay-per-use pricing

### Claude (Anthropic)
- **API Key Required**: [console.anthropic.com](https://console.anthropic.com)
- **Default Model**: claude-3-haiku-20240307
- **Cost**: Pay-per-use pricing

### Grok (xAI)
- **API Key Required**: [x.ai](https://x.ai)
- **Default Model**: grok-beta
- **Cost**: Pay-per-use pricing

### Custom Endpoints
- Support for any OpenAI-compatible API
- Useful for local LLMs (Ollama, LM Studio, etc.)
- Configure endpoint URL and model name in settings

## Configuration

### Organization Settings

**Organization Modes**:
- **Use Existing Folders**: When enabled, AI only assigns bookmarks to your existing folders and can leave bookmarks in their current location if they don't fit well (no new folders created)
- **Remove Empty Folders**: Automatically clean up empty folders after reorganization (enabled by default)

**Organization Behavior**:
- **Auto-Organize New Bookmarks**: Categorize bookmarks automatically as you add them (disabled by default)
- **Remember Previous Organization**: Control how previously organized bookmarks are handled:
  - **Always** (Default): Skip previously organized bookmarks in all operations to preserve manual changes
  - **Only During "Organize All"**: Skip during full organization, but always reorganize when selecting specific folders
  - **Never**: Always reorganize all bookmarks regardless of previous organization

**Folder Selection**:
- **System Folders**: Choose which root folders to organize (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks)
- **Saved Tabs**: Optionally include browser-generated "Saved Tabs" folders (disabled by default - Vivaldi-specific)
- **Custom Ignore List**: Specify additional folders to skip by name

### Bookmark Categories
Customize the 25 default categories to match your needs. Default categories include:
- Development & Programming
- Shopping & Services
- News & Media
- Social Media & Communication
- Entertainment & Streaming
- Finance & Banking
- And 19 more...

### Performance Settings (Advanced)
- **API Timeout**: Maximum wait time for API responses (default: 180 seconds)
- **Batch Size**: Number of bookmarks per batch (default: 50, range: 10-100)
- **Max Tokens**: Maximum response tokens (default: 4096, range: 1024-8192)

⚠️ Only modify these if experiencing rate limiting or errors from your LLM provider.

### Debug Settings
- **Log Level**: ERROR (default), WARN, INFO, DEBUG, or TRACE
- **Console Logging**: Enable/disable browser console output
- Logs always saved internally (last 1000 entries) regardless of settings

## How It Works

### Standard Mode (Default)
1. **Bookmark Collection**: Gathers all bookmarks from selected scope (all bookmarks or specific folders)
2. **History Filtering**: Optionally skips previously organized bookmarks based on policy
3. **Duplicate Removal**: Identifies and removes bookmarks with identical URLs (when enabled)
4. **Batch Categorization**: Sends bookmarks to AI in configurable batches (default: 50)
5. **Folder Creation**: Creates only the folders needed for assigned categories
6. **Bookmark Organization**: Moves bookmarks to their assigned folders
7. **Cleanup**: Removes empty folders left behind (when enabled)
8. **Results Display**: Shows detailed statistics, timeline, and item-by-item breakdown

### Use Existing Folders Mode
When enabled, the workflow changes to work within your existing structure:
1. **Existing Folder Detection**: Scans your current folder structure
2. **Restricted Categorization**: AI assigns bookmarks only to existing folders
3. **Smart Fallback**: AI can use special `KEEP_CURRENT` designation to leave bookmarks in place if no existing folder is a good fit
4. **No New Folders**: Prevents creating new folders, maintaining your existing organization
5. **Folder Validation**: Warns if AI attempts to use non-existent folders

This mode is ideal for refining an existing structure without introducing new categories.

## Development

### Prerequisites
- Node.js 20.x (LTS)
- npm 9.x or higher

### Quick Start Commands
```bash
# Development
npm run dev            # Watch mode (auto-rebuild on changes)
npm run build          # Production build
npm run build:dev      # Development build
npm run clean          # Remove build artifacts

# Code Quality
npm run type-check     # TypeScript validation
npm run lint           # ESLint (must pass with 0 errors)
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting

# Testing
npm run test           # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage (90%+ required)

# Security
npm run audit          # Check for vulnerabilities
```

### Quality Standards

- ✅ **90%+ test coverage** required for service layer
- ✅ **TypeScript** strict type checking
- ✅ **ESLint** with 0 errors (warnings acceptable)
- ✅ **Prettier** code formatting enforced
- ✅ **Automated CI** runs on all pushes and PRs

### Project Structure
```
ai-bookmarks/
├── manifest.json           # Chrome extension manifest (Manifest V3)
├── popup.html             # Extension popup UI
├── options.html           # Settings page
├── folder-selector.html   # Folder selection page
├── results.html           # Organization results page
├── icons/                 # Extension icons (16, 32, 48, 128px)
├── src/
│   ├── background/        # Service worker
│   ├── popup/             # Popup logic
│   ├── options/           # Settings logic
│   ├── folder-selector/   # Folder selection logic
│   ├── results/           # Results display logic
│   └── services/          # Core services
│       ├── BookmarkManager.ts          # Chrome Bookmarks API
│       ├── ConfigurationManager.ts     # Settings storage
│       ├── LLMService.ts              # Multi-provider LLM client
│       ├── ReorganizationService.ts   # Organization pipeline
│       ├── OpenRouterAuthService.ts   # OAuth authentication
│       └── Logger.ts                  # Logging utility
└── dist/                  # Compiled output
```

### Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contributing guidelines, code standards, and PR process
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Detailed development guide, testing, CI/CD, and architecture
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and release notes

## Privacy

- **Local Storage Only**: All settings and data stored in Chrome's local storage
- **No Analytics**: Extension doesn't collect usage analytics or telemetry
- **AI Provider Only**: Bookmark data only sent to your chosen AI provider during organization
- **No Third Parties**: No data shared with extension developers or other parties
- **Open Source**: Full transparency through open source code

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/rmk40/ai-bookmarks/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rmk40/ai-bookmarks/discussions)
- **Chrome Web Store**: Coming soon

## Acknowledgments

See [NOTICE](NOTICE) file for third-party licenses and attributions.
