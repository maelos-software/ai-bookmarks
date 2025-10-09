# Contributing to AI Bookmark Organizer

Thank you for your interest in contributing to AI Bookmark Organizer! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project follows standard open source community guidelines:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/ai-bookmarks.git
   cd ai-bookmarks
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/rmk40/ai-bookmarks.git
   ```

## Development Setup

### Prerequisites
- Node.js 16 or higher
- npm or yarn
- Chrome browser for testing
- Git

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Load in Chrome for testing:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

### Development Commands

```bash
npm run build          # Production build
npm run build:dev      # Development build
npm run dev            # Watch mode (rebuilds on changes)
npm run type-check     # TypeScript type checking
npm run clean          # Remove build artifacts
```

## Making Changes

### Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes** thoroughly:
   - Load the extension in Chrome
   - Test all affected functionality
   - Verify no console errors
   - Check different AI providers if applicable

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Brief description of changes"
   ```

### Commit Message Guidelines

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep first line under 72 characters
- Reference issues and pull requests where relevant

Examples:
```
Add support for custom LLM endpoints
Fix duplicate bookmark detection logic
Update README with new configuration options
```

## Submitting Pull Requests

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes
   - List any breaking changes

3. **Respond to feedback**:
   - Address review comments promptly
   - Update your PR as needed
   - Keep the conversation focused and professional

### PR Checklist

Before submitting, ensure:
- [ ] Code builds without errors (`npm run build`)
- [ ] TypeScript types are correct (`npm run type-check`)
- [ ] Extension loads and functions in Chrome
- [ ] No console errors or warnings
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated for user-facing changes

## Coding Standards

### TypeScript

- **Use TypeScript**: All code should be written in TypeScript
- **Type Safety**: Avoid `any` types; use proper type definitions
- **Interfaces**: Define interfaces for data structures
- **Async/Await**: Prefer async/await over promises chains

Example:
```typescript
// Good
interface BookmarkData {
  id: string;
  title: string;
  url: string;
}

async function getBookmarks(): Promise<BookmarkData[]> {
  const result = await chrome.bookmarks.getTree();
  return processBookmarks(result);
}

// Avoid
function getBookmarks(): any {
  return chrome.bookmarks.getTree().then(result => {
    return processBookmarks(result);
  });
}
```

### Code Style

- **Indentation**: 2 spaces
- **Line Length**: 100 characters max
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Naming**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants

### Project Structure

Place files according to their purpose:
```
src/
├── background/     # Service worker code
├── popup/          # Popup UI logic
├── options/        # Settings page logic
├── results/        # Results page logic
└── services/       # Shared business logic
    ├── BookmarkManager.ts
    ├── LLMService.ts
    └── ...
```

### Error Handling

Always handle errors appropriately:

```typescript
try {
  const result = await someAsyncOperation();
  // Handle success
} catch (error) {
  logger.error('ComponentName', 'Operation failed', error);
  // Handle error gracefully
}
```

## Testing

Currently, testing is manual. When testing:

1. **Test Core Functionality**:
   - Bookmark organization with different providers
   - Settings persistence
   - Error handling

2. **Test Edge Cases**:
   - Large bookmark collections (1000+)
   - Empty bookmark folders
   - Special characters in bookmark names
   - Network errors and timeouts

3. **Browser Compatibility**:
   - Test in Chrome
   - Verify Manifest V3 compliance

## Reporting Bugs

### Before Reporting

1. Check if the bug has already been reported in [Issues](https://github.com/rmk40/ai-bookmarks/issues)
2. Verify you're using the latest version
3. Try reproducing with a fresh extension install

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - Chrome Version: [e.g. 120.0.6099.109]
 - Extension Version: [e.g. 1.0.1]
 - AI Provider: [e.g. OpenRouter]

**Additional context**
Any other relevant information.
```

## Suggesting Features

We welcome feature suggestions! Please:

1. **Check existing issues** to avoid duplicates
2. **Describe the problem** you're trying to solve
3. **Propose a solution** if you have one in mind
4. **Consider the scope**: Does it fit the project's goals?

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Questions**: Comment on specific lines in pull requests

## License

By contributing to AI Bookmark Organizer, you agree that your contributions will be licensed under the Mozilla Public License 2.0.

Thank you for contributing! 🎉
