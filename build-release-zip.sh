#!/bin/bash
#
# Build and package Chrome extension for Web Store submission
#
# Usage:
#   ./build-release-zip.sh [output-path]
#
# If output-path is not provided, generates filename automatically in current directory
# If output-path is a directory, generates filename automatically in that directory
# If output-path includes a filename, uses that exact filename
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory (where the extension is)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}Building Chrome Extension Release Package${NC}"
echo "=========================================="
echo ""

# Get version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not extract version from manifest.json${NC}"
    exit 1
fi
echo -e "Version: ${YELLOW}${VERSION}${NC}"

# Get git commit hash (last 8 characters)
GIT_HASH=$(git rev-parse --short=8 HEAD 2>/dev/null || echo "00000000")
echo -e "Git Hash: ${YELLOW}${GIT_HASH}${NC}"

# Determine output path
OUTPUT_ARG="${1:-.}"

# Check if the argument is a directory or a file path
if [ -d "$OUTPUT_ARG" ]; then
    # It's a directory, generate filename
    ZIP_FILENAME="ai-bookmarks-${VERSION}-${GIT_HASH}.zip"
    ZIP_PATH="${OUTPUT_ARG}/${ZIP_FILENAME}"
elif [ -z "$OUTPUT_ARG" ] || [ "$OUTPUT_ARG" = "." ]; then
    # No argument or current directory
    ZIP_FILENAME="ai-bookmarks-${VERSION}-${GIT_HASH}.zip"
    ZIP_PATH="./${ZIP_FILENAME}"
else
    # It's a file path, use it directly
    ZIP_PATH="$OUTPUT_ARG"
    ZIP_FILENAME=$(basename "$ZIP_PATH")
    OUTPUT_DIR=$(dirname "$ZIP_PATH")

    # Create directory if it doesn't exist
    if [ ! -d "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
    fi
fi

echo -e "Output: ${YELLOW}${ZIP_PATH}${NC}"
echo ""

# Clean and build
echo -e "${GREEN}Step 1: Cleaning previous build...${NC}"
npm run clean

echo ""
echo -e "${GREEN}Step 2: Building production version...${NC}"
npm run build

# Remove existing zip if it exists
if [ -f "$ZIP_PATH" ]; then
    echo ""
    echo -e "${YELLOW}Removing existing zip file...${NC}"
    rm "$ZIP_PATH"
fi

# Create the zip package
echo ""
echo -e "${GREEN}Step 3: Creating Chrome Web Store package...${NC}"
zip -r "$ZIP_PATH" \
  manifest.json \
  dist/*.js \
  icons/ \
  popup.html \
  options.html \
  results.html \
  folder-selector.html \
  styles/ \
  -x "*.DS_Store" "*.map" "*/.DS_Store" "*.d.ts" > /dev/null

# Verify the package
if [ -f "$ZIP_PATH" ]; then
    FILE_SIZE=$(ls -lh "$ZIP_PATH" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}✓ Package created successfully!${NC}"
    echo ""
    echo "=========================================="
    echo -e "Filename: ${YELLOW}${ZIP_FILENAME}${NC}"
    echo -e "Location: ${YELLOW}${ZIP_PATH}${NC}"
    echo -e "Size:     ${YELLOW}${FILE_SIZE}${NC}"
    echo "=========================================="
    echo ""
    echo "Package contents:"
    unzip -l "$ZIP_PATH" | grep -v "^Archive:" | grep -v "^-" | grep -v "^ *Length" | grep -v "files$" | grep -v "^$"
    echo ""
    echo -e "${GREEN}Ready for Chrome Web Store submission!${NC}"
else
    echo -e "${RED}Error: Failed to create package${NC}"
    exit 1
fi
