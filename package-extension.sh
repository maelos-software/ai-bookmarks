#!/bin/bash

# Package Chrome Extension for manual distribution
# Usage: ./package-extension.sh

set -e

echo "🔨 Building extension..."
npm run build

echo "📦 Creating package..."

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
PACKAGE_NAME="ai-bookmark-organizer-v${VERSION}.zip"

# Create zip with all necessary files
zip -r "$PACKAGE_NAME" \
  manifest.json \
  popup.html \
  options.html \
  results.html \
  icons/ \
  styles/ \
  dist/ \
  PRIVACY.md \
  README.md \
  -x "*.DS_Store" "*.git*"

echo "✅ Package created: $PACKAGE_NAME"
echo ""
echo "📋 Installation instructions for your friends:"
echo "1. Unzip the file"
echo "2. Open Chrome and go to chrome://extensions/"
echo "3. Enable 'Developer mode' (toggle in top right)"
echo "4. Click 'Load unpacked'"
echo "5. Select the unzipped folder"
echo ""
echo "⚠️  Note: Extensions loaded this way will show a 'Developer mode' warning"
