# Changelog

All notable changes to AI Bookmark Organizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2025-10-08

### Initial Release

First public release of AI Bookmark Organizer - a Chrome extension that intelligently organizes bookmarks using AI.

#### Features
- **AI-Powered Organization**: Categorize bookmarks using configurable categories
- **Multi-Provider Support**: OpenRouter, OpenAI, Claude (Anthropic), Grok (xAI), and custom OpenAI-compatible endpoints
- **OpenRouter OAuth**: Seamless authentication without manual API key entry
- **Batch Processing**: Process bookmarks in configurable batches (default: 50)
- **Smart Cleanup**: Automatic duplicate removal and empty folder cleanup
- **Organization History**: Track and skip previously organized bookmarks to preserve manual changes
- **Auto-Organize**: Optionally categorize new bookmarks automatically as they're added
- **System Folder Protection**: Never modifies Bookmarks Bar, Other Bookmarks, or Mobile Bookmarks
- **Custom Categories**: Fully customizable list of 25 default categories
- **Saved Tabs Support**: Optional organization of browser-generated "Saved Tabs" folders

#### User Interface
- Clean popup with status indicator and recent activity log (10 items)
- Comprehensive settings page with organized sections
- Detailed results page with statistics, timeline, and item breakdowns
- Toast notifications for auto-organize events
- Badge indicators showing organization progress
- Unsaved changes warning in settings
- Custom favicon for extension pages

#### Performance
- Optimized token usage with compact JSON format
- Configurable batch size, API timeout, and max tokens
- Smart retry logic for rate limiting
- TypeScript compilation with Webpack
- Builds in under 1 second

#### Security & Privacy
- API keys stored securely in chrome.storage.sync
- OAuth tokens in chrome.storage.local
- No third-party data collection
- All processing through user's chosen AI provider
- Open source for transparency

[Unreleased]: https://github.com/rmk40/ai-bookmarks/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/rmk40/ai-bookmarks/releases/tag/v1.0.1
