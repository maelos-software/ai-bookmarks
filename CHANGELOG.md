# Changelog

All notable changes to AI Bookmark Organizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2025-10-11

### Changed
- **Improved UX**: Popup now automatically closes after opening folder selector
- **Better Settings Access**: Added Settings button to folder selection page header
  - Button positioned in top-right corner with translucent styling
  - Provides quick access to settings without navigating away

### Fixed
- Popup window remaining open after clicking "Organize Bookmarks"

## [1.1.0] - 2025-10-08

### Added
- **Selective Folder Organization**: New hierarchical folder tree interface for choosing specific folders to organize
  - Visual tree with expand/collapse controls
  - Checkbox-based selection with parent/child relationships
  - Shows bookmark counts: direct (n) and total [n] including subfolders
  - Search/filter functionality to find folders by name
  - Bulk selection controls: Select All, Deselect All, Expand All, Collapse All
  - Live selection counter showing folders and bookmarks selected
  - Pre-selects folders containing bookmarks on load
  - Top-level folders automatically expanded for immediate visibility
- **Unified Organization Interface**: Both "Organize All" and "Organize Selected Folders" available from folder selector page
  - "Organize All" button prominently displayed with yellow/orange warning color
  - Stronger backup warnings for "Organize All" action
  - Dynamic confirmation dialogs based on action type
  - Progress tracking with badge indicators for both modes
- **Backend Support**: New methods in BookmarkManager and ReorganizationService
  - `getBookmarkTreeWithCounts()`: Builds hierarchical tree with bookmark counts
  - `getFolderDescendants()`: Recursively gets subfolder IDs
  - `getBookmarksInFolders()`: Retrieves bookmarks from specific folders
  - `reorganizeSpecificFolders()`: Selective organization for chosen folders
  - Respects organization history and all existing settings

### Changed
- **Simplified Popup**: Consolidated organization options into single "Organize Bookmarks" button
  - Removed "Organize All Bookmarks" button from popup
  - Removed confirmation dialog from popup (moved to folder selector)
  - Removed min/max height constraints for natural popup sizing
  - Cleaner interface with progressive disclosure of advanced options

### Technical
- Added folder-selector.html and folder-selector.ts (516 lines)
- Added GET_FOLDER_TREE and EXECUTE_SELECTIVE_REORGANIZATION message handlers
- Updated webpack config for new folder-selector entry point
- Popup controller simplified from ~500 lines to minimal delegation

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

[Unreleased]: https://github.com/rmk40/ai-bookmarks/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/rmk40/ai-bookmarks/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rmk40/ai-bookmarks/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/rmk40/ai-bookmarks/releases/tag/v1.0.1
