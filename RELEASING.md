# Release Process

This document describes the process for creating a new release of the AI Bookmark Organizer.

## Version Management

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## Release Workflow

### 1. Run Tests

Before creating a release, ensure all tests pass:
```bash
npm test
```

### 2. Build Release Package

Build the Chrome Web Store package with the new version:
```bash
./build-release-zip.sh 1.3.0
```

This single command:
- Updates `package.json` version
- Updates `manifest.json` version
- Cleans previous builds
- Builds production version
- Creates properly named zip file (e.g., `ai-bookmarks-1.3.0-20678084.zip`)
- Excludes source maps and build artifacts
- Shows package contents for verification

The filename format is `ai-bookmarks-{version}-{git-hash}.zip` where:
- `{version}` is the version you specified (e.g., 1.3.0)
- `{git-hash}` is the short git commit hash (8 characters)

You can optionally specify an output path:
```bash
./build-release-zip.sh 1.3.0 ./releases/          # Output to releases directory
./build-release-zip.sh 1.3.0 custom-name.zip      # Use custom filename
```

### 3. Review and Commit

Review the version changes:
```bash
git diff package.json manifest.json
```

Commit the version bump:
```bash
git add package.json manifest.json
git commit -m "Bump version to 1.3.0"
```

### 4. Create Git Tag

Create an annotated tag with release notes:
```bash
git tag -a v1.3.0 -m "Release v1.3.0

Major feature release with Google Gemini integration, comprehensive testing
infrastructure, improved code quality, and automated CI/CD.

🎉 NEW FEATURES
- Google Gemini provider integration
- User-configurable organization modes
...
"
```

Or use a file for longer release notes:
```bash
git tag -a v1.3.0 -F release-notes.txt
```

### 5. Push Everything

Push the commits and tags:
```bash
git push origin main
git push origin v1.3.0
```

### 6. Update Stable Branch

Update the stable branch to the new release:
```bash
git checkout stable
git reset --hard v1.3.0
git push --force origin stable
git checkout main
```

### 7. Create GitHub Release

Upload the zip file to GitHub releases:
```bash
gh release create v1.3.0 \
  --title "Release v1.3.0" \
  --notes-file release-notes.txt \
  ai-bookmarks-1.3.0-*.zip
```

Or use the GitHub web interface:
1. Go to https://github.com/maelos-software/ai-bookmarks/releases/new
2. Select tag: v1.3.0
3. Add release title and notes
4. Upload the zip file
5. Publish release

### 8. Chrome Web Store Submission

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select "AI Bookmark Organizer"
3. Click "Package" tab
4. Upload the new zip file
5. Add release notes
6. Submit for review

## Quick Reference

```bash
# Complete release workflow (one command at a time)
npm test                                    # 1. Test first
./build-release-zip.sh 1.3.0               # 2. Build and update version
git add package.json manifest.json          # 3. Stage version changes
git commit -m "Bump version to 1.3.0"      # 4. Commit version
git tag -a v1.3.0 -F notes.txt             # 5. Tag release
git push origin main v1.3.0                # 6. Push everything
git checkout stable && git reset --hard v1.3.0 && git push -f origin stable  # 7. Update stable
gh release create v1.3.0 --title "Release v1.3.0" --notes-file notes.txt ai-bookmarks-1.3.0-*.zip  # 8. GitHub release
```

## Notes

- Always test thoroughly before releasing
- The build script updates both package.json and manifest.json automatically
- Git commit hash in filename helps track exactly what code is in each build
- Version parameter is required - no more hardcoded versions!
- Stable branch should always point to the latest release tag
- The `update-version.sh` script is now deprecated - use `build-release-zip.sh` with version parameter instead
