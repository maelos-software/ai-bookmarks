#!/bin/bash

# Package Chrome Extension as signed .crx file with 1Password key management
# Usage: ./package-crx.sh

set -e

echo "🔨 Building extension..."
npm run build

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
PACKAGE_NAME="ai-bookmark-organizer-v${VERSION}"
KEY_NAME="ai-bookmark-organizer-extension-key"

echo "📦 Creating .crx package..."
echo ""

# Check if 1Password CLI is available
if ! command -v op &> /dev/null; then
    echo "❌ 1Password CLI (op) not found"
    echo "Install with: brew install 1password-cli"
    exit 1
fi

# Check if key exists in 1Password
if op item get "$KEY_NAME" &>/dev/null; then
    echo "✅ Found key in 1Password: $KEY_NAME"
    echo "📥 Retrieving private key..."
    
    # Retrieve key from 1Password and save temporarily
    op item get "$KEY_NAME" --fields label=private_key > extension.pem
    
    echo "✅ Key retrieved successfully"
else
    echo "⚠️  No key found in 1Password"
    echo ""
    echo "First-time setup:"
    echo "1. Open Chrome and go to chrome://extensions/"
    echo "2. Enable 'Developer mode'"
    echo "3. Click 'Pack extension'"
    echo "4. Extension root directory: $(pwd)"
    echo "5. Leave 'Private key file' EMPTY"
    echo "6. Click 'Pack Extension'"
    echo ""
    echo "Chrome will create extension.pem"
    echo "Then run this command to store it in 1Password:"
    echo ""
    echo "  op item create --category='Secure Note' --title='$KEY_NAME' \\"
    echo "    private_key=\"\$(cat extension.pem)\" \\"
    echo "    --tags=chrome-extension"
    echo ""
    exit 0
fi

echo ""
echo "📋 Creating .crx package:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Pack extension'"
echo "4. Extension root directory: $(pwd)"
echo "5. Private key file: $(pwd)/extension.pem"
echo "6. Click 'Pack Extension'"
echo ""

# Clean up key after packaging
trap "rm -f extension.pem" EXIT

read -p "Press Enter after you've created the .crx package..."

# Remove temporary key file
rm -f extension.pem
echo "✅ Temporary key file removed"

if [ -f "${PACKAGE_NAME}.crx" ]; then
    echo ""
    echo "✅ Package created: ${PACKAGE_NAME}.crx"
    echo ""
    echo "📋 Installation instructions for your friends:"
    echo "1. Download the .crx file"
    echo "2. Open Chrome and go to chrome://extensions/"
    echo "3. Drag and drop the .crx file onto the page"
    echo "4. Click 'Add extension' when prompted"
    echo ""
    echo "✨ Benefits of .crx:"
    echo "   - No 'Developer mode' warning"
    echo "   - Cleaner installation experience"
    echo "   - Same extension ID for updates"
fi
