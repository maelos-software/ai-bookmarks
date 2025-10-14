#!/bin/bash
#
# Update version in package.json and manifest.json
#
# Usage:
#   ./update-version.sh <version>
#   Example: ./update-version.sh 1.3.0
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version argument provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.3.0"
    exit 1
fi

NEW_VERSION="$1"

# Validate version format (semantic versioning: major.minor.patch)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Version must be in format: major.minor.patch (e.g., 1.3.0)"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}Updating version to ${YELLOW}${NEW_VERSION}${NC}"
echo ""

# Update package.json
echo -e "${GREEN}Updating package.json...${NC}"
if [ -f "package.json" ]; then
    # Use sed to replace version in package.json (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS requires empty string after -i
        sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" package.json
    else
        # Linux
        sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" package.json
    fi
    echo -e "${GREEN}✓ package.json updated${NC}"
else
    echo -e "${RED}Error: package.json not found${NC}"
    exit 1
fi

# Update manifest.json
echo -e "${GREEN}Updating manifest.json...${NC}"
if [ -f "manifest.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" manifest.json
    else
        sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_VERSION}\"/" manifest.json
    fi
    echo -e "${GREEN}✓ manifest.json updated${NC}"
else
    echo -e "${RED}Error: manifest.json not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Version updated successfully!${NC}"
echo ""
echo "Files updated:"
echo "  - package.json"
echo "  - manifest.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the changes: git diff"
echo "  2. Build and test: npm run build && npm test"
echo "  3. Commit: git add package.json manifest.json && git commit -m \"Bump version to ${NEW_VERSION}\""
echo "  4. Tag: git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\""
