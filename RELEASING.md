# Release Process

This document describes the process for creating a new release of the AI Bookmark Organizer.

## Version Management

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

## Release Workflow

### 1. Update Version

Use the `update-version.sh` script to update version numbers in `package.json` and `manifest.json`:

```bash
./update-version.sh 1.3.0
```

This will:
- Update `package.json` version
- Update `manifest.json` version
- Show you the changes for review

### 2. Review and Commit

Review the changes:
```bash
git diff package.json manifest.json
```

Commit the version bump:
```bash
git add package.json manifest.json
git commit -m "Bump version to 1.3.0"
```

### 3. Build and Test

Build the production version:
```bash
npm run build
```

Run tests:
```bash
npm test
```

### 4. Create Release Package

Build the Chrome Web Store package:
```bash
./build-release-zip.sh
```

This creates a file like `ai-bookmarks-1.3.0-20678084.zip` where:
- `1.3.0` is the version from manifest.json
- `20678084` is the short git commit hash

The script automatically:
- Cleans previous builds
- Builds production version
- Creates properly named zip file
- Excludes source maps and build artifacts
- Shows package contents for verification

### 5. Create Git Tag

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

### 6. Push Everything

Push the commits and tags:
```bash
git push origin main
git push origin v1.3.0
```

### 7. Update Stable Branch

Update the stable branch to the new release:
```bash
git checkout stable
git reset --hard v1.3.0
git push --force origin stable
git checkout main
```

### 8. Create GitHub Release

Upload the zip file to GitHub releases:
```bash
gh release create v1.3.0 \
  --title "Release v1.3.0" \
  --notes-file release-notes.txt \
  ai-bookmarks-1.3.0-20678084.zip
```

Or use the GitHub web interface:
1. Go to https://github.com/maelos-software/ai-bookmarks/releases/new
2. Select tag: v1.3.0
3. Add release title and notes
4. Upload the zip file
5. Publish release

### 9. Chrome Web Store Submission

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select "AI Bookmark Organizer"
3. Click "Package" tab
4. Upload the new zip file
5. Add release notes
6. Submit for review

## Quick Reference

```bash
# Complete release workflow
./update-version.sh 1.3.0          # Update version
git diff && git add . && git commit -m "Bump version to 1.3.0"
npm run build && npm test           # Build and test
./build-release-zip.sh              # Create package
git tag -a v1.3.0 -F notes.txt     # Tag release
git push origin main v1.3.0         # Push everything
git checkout stable && git reset --hard v1.3.0 && git push -f origin stable
gh release create v1.3.0 --title "Release v1.3.0" --notes-file notes.txt *.zip
```

## Notes

- Always test thoroughly before releasing
- Version numbers in package.json and manifest.json must match
- Git commit hash in filename helps track exactly what code is in each build
- The build script automatically reads version from manifest.json
- Stable branch should always point to the latest release tag
