#!/bin/bash

# Force Chrome to reload extension by touching manifest
# This changes the file timestamp, forcing Chrome to detect a change

echo "Touching manifest.json to force Chrome reload..."
touch manifest.json

echo "✅ Done! Now:"
echo "1. Go to chrome://extensions/"
echo "2. Click the reload icon (circular arrow) on the extension card"
echo "3. The icon should appear in the toolbar"
