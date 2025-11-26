#!/bin/bash
# Phase 4 Deployment Script
# Run this from the directory containing the downloaded files

UI_DIR="/Users/tem/humanizer_root/workers/post-social-ui"

echo "Deploying Phase 4: Comment Thread UI..."

# Backup existing files
echo "Creating backups..."
cp "$UI_DIR/src/components/studio/ContextPanel.tsx" "$UI_DIR/src/components/studio/ContextPanel.tsx.bak" 2>/dev/null
cp "$UI_DIR/src/types/models.ts" "$UI_DIR/src/types/models.ts.bak" 2>/dev/null
cp "$UI_DIR/src/services/nodes.ts" "$UI_DIR/src/services/nodes.ts.bak" 2>/dev/null

# Copy new files
echo "Copying new files..."
cp ContextPanel.tsx "$UI_DIR/src/components/studio/ContextPanel.tsx"
cp models.ts "$UI_DIR/src/types/models.ts"
cp nodes.ts "$UI_DIR/src/services/nodes.ts"

# Append CSS
echo "Appending CSS styles..."
echo "" >> "$UI_DIR/src/styles/studio.css"
cat comment-thread-styles.css >> "$UI_DIR/src/styles/studio.css"

echo "Phase 4 files deployed!"
echo ""
echo "To build and deploy:"
echo "  cd $UI_DIR"
echo "  npm run build"
echo "  npx wrangler pages deploy dist --project-name=post-social-ui --branch=main --commit-dirty=true"
