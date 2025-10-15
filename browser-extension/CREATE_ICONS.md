# Creating Extension Icons

The extension needs three icon sizes:
- `icon16.png` - 16x16 pixels (toolbar)
- `icon48.png` - 48x48 pixels (extension management)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Quick Option: Use Placeholder Text Icons

You can create simple text-based icons using any image editor or online tool:

1. Go to https://www.favicon.cc/ or similar
2. Create a simple design with "H" or "📊" emoji
3. Export as PNG in required sizes
4. Name them `icon16.png`, `icon48.png`, `icon128.png`
5. Place in `/browser-extension/` folder

## Option 2: Command Line (macOS)

Use ImageMagick to create simple icons:

```bash
cd /Users/tem/humanizer_root/browser-extension

# Create 128x128 base icon with gradient
convert -size 128x128 \
  gradient:#0066cc-#00ccff \
  -font Helvetica-Bold -pointsize 72 \
  -fill white -gravity center \
  -annotate +0+0 "H" \
  icon128.png

# Resize for other sizes
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

## Option 3: Use Existing Humanizer Logo

If you have a logo, convert it:

```bash
# Assuming logo.png exists
convert logo.png -resize 128x128 icon128.png
convert logo.png -resize 48x48 icon48.png
convert logo.png -resize 16x16 icon16.png
```

## Temporary Solution

For testing, the extension will work even with missing icons (Chrome shows a default icon).

To test immediately, you can skip icon creation - just load the extension without them.
